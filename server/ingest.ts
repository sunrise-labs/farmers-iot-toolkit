/**
 * farm-ingest — the cloud half of the "push, don't expose" backhaul.
 *
 * The base-station phone sits behind carrier CGNAT, so nothing on the internet can
 * dial *in* to it. This service is what it dials *out* to: a small bun + SQLite
 * receiver that accepts the exact JSON the ESP nodes already POST to Node-RED,
 * stores it, and serves a read-only page you can open from anywhere.
 *
 * Design notes worth keeping:
 *
 *  - **Failed reads are first-class.** `{"ok":false,"error":"..."}` rows are stored,
 *    not rejected. A silent node is indistinguishable from a dead battery; an
 *    explicit error says "node alive, probe isn't". Same invariant as the firmware.
 *
 *  - **`client_id` makes delivery idempotent.** Store-and-forward on the phone will
 *    re-send a batch whose response was lost in a 4G dropout. Without a dedupe key
 *    that silently double-counts every reading taken during bad signal — which is
 *    exactly when you care about the data. `INSERT OR IGNORE` on a UNIQUE column.
 *
 *  - **The server clock is authoritative for time.** The ESP has no RTC and the
 *    phone's clock can be anything. We store `received_at` ourselves and keep the
 *    node's own `uptime_s` alongside it as a liveness signal, not a timestamp.
 *
 *  - **Nothing is thrown away.** Known fields get typed columns for querying; the
 *    complete original JSON goes into `payload` so a field we haven't thought of
 *    yet is still there when we do.
 *
 * Binds to 127.0.0.1 only — nginx terminates TLS in front of it. Never expose the
 * raw port; the bearer token is the only thing between this and the open internet.
 */

import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

// ── config ───────────────────────────────────────────────────────────────────

const PORT = Number(process.env.FARM_PORT ?? 8790);
const HOST = process.env.FARM_HOST ?? "127.0.0.1";
const DB_PATH = process.env.FARM_DB ?? join(import.meta.dir, "data", "readings.db");
const TOKEN = process.env.FARM_TOKEN ?? "";
const RETENTION_DAYS = Number(process.env.FARM_RETENTION_DAYS ?? 400);
const MAX_BODY = 1_000_000; // 1 MB — a 50-reading batch is ~8 KB
const MAX_BATCH = 500;

if (!TOKEN || TOKEN.length < 24) {
  console.error(
    "FATAL: FARM_TOKEN is unset or too short. Refusing to start unauthenticated.\n" +
      "       Generate one with:  openssl rand -hex 32",
  );
  process.exit(1);
}

// ── storage ──────────────────────────────────────────────────────────────────

mkdirSync(dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH, { create: true });
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA synchronous = NORMAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS readings (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    received_at  TEXT    NOT NULL,
    client_id    TEXT    UNIQUE,
    kind         TEXT    NOT NULL,
    node         TEXT,
    ok           INTEGER NOT NULL,
    error        TEXT,
    depth_mm     REAL,
    raw          REAL,
    percent      REAL,
    moisture_pct REAL,
    temp_c       REAL,
    ec           REAL,
    valve        INTEGER,
    rssi         INTEGER,
    uptime_s     INTEGER,
    payload      TEXT    NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_kind_time ON readings (kind, received_at DESC);
  CREATE INDEX IF NOT EXISTS idx_time      ON readings (received_at DESC);
`);

const insert = db.query(`
  INSERT OR IGNORE INTO readings
    (received_at, client_id, kind, node, ok, error,
     depth_mm, raw, percent, moisture_pct, temp_c, ec, valve, rssi, uptime_s, payload)
  VALUES
    ($received_at, $client_id, $kind, $node, $ok, $error,
     $depth_mm, $raw, $percent, $moisture_pct, $temp_c, $ec, $valve, $rssi, $uptime_s, $payload)
`);

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

type Stored = { accepted: number; duplicates: number };

function store(items: unknown[]): Stored {
  let accepted = 0;
  let duplicates = 0;
  const now = new Date().toISOString();

  const tx = db.transaction((rows: unknown[]) => {
    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;

      // `kind` may be sent explicitly; otherwise infer it from which fields are present.
      const kind =
        typeof r.kind === "string" && r.kind
          ? r.kind
          : "depth_mm" in r || "raw" in r
            ? "water"
            : "moisture_pct" in r
              ? "soil"
              : "unknown";

      const res = insert.run({
        $received_at: now,
        $client_id: typeof r.client_id === "string" ? r.client_id : null,
        $kind: kind,
        $node: typeof r.node === "string" ? r.node : null,
        // Anything that isn't explicitly ok:true is treated as not-ok. A missing
        // flag is a broken publisher, and optimism here would hide real faults.
        $ok: r.ok === true ? 1 : 0,
        $error: typeof r.error === "string" ? r.error : null,
        $depth_mm: num(r.depth_mm),
        $raw: num(r.raw),
        $percent: num(r.percent),
        $moisture_pct: num(r.moisture_pct),
        $temp_c: num(r.temp_c),
        $ec: num(r.ec),
        $valve: r.valve === true || r.valve === 1 ? 1 : r.valve === false || r.valve === 0 ? 0 : null,
        $rssi: num(r.rssi),
        $uptime_s: num(r.uptime_s),
        $payload: JSON.stringify(r),
      });
      if (res.changes > 0) accepted++;
      else duplicates++;
    }
  });

  tx(items);
  return { accepted, duplicates };
}

function prune() {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString();
  const res = db.run("DELETE FROM readings WHERE received_at < ?", [cutoff]);
  if (res.changes > 0) console.log(`[prune] removed ${res.changes} rows older than ${RETENTION_DAYS}d`);
}
prune();
setInterval(prune, 24 * 3600 * 1000);

// ── auth ─────────────────────────────────────────────────────────────────────

/** Constant-time-ish compare. Lengths differ → mismatch, which is fine to leak. */
function tokenOk(candidate: string | null | undefined): boolean {
  if (!candidate || candidate.length !== TOKEN.length) return false;
  let diff = 0;
  for (let i = 0; i < TOKEN.length; i++) diff |= TOKEN.charCodeAt(i) ^ candidate.charCodeAt(i);
  return diff === 0;
}

function bearer(req: Request): string | null {
  const h = req.headers.get("authorization");
  return h?.startsWith("Bearer ") ? h.slice(7).trim() : null;
}

function cookieToken(req: Request): string | null {
  const raw = req.headers.get("cookie");
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === "farm_token") return decodeURIComponent(v.join("="));
  }
  return null;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

const UNAUTHORIZED = () => json({ error: "unauthorized" }, 401);

// ── queries for the read side ────────────────────────────────────────────────

const qRecent = db.query(
  "SELECT * FROM readings WHERE ($kind IS NULL OR kind = $kind) ORDER BY id DESC LIMIT $limit",
);
const qLatestPerKind = db.query(`
  SELECT r.* FROM readings r
  JOIN (SELECT kind, MAX(id) AS id FROM readings GROUP BY kind) m ON m.id = r.id
`);
const qStats = db.query(`
  SELECT kind,
         COUNT(*)                          AS total,
         SUM(CASE WHEN ok = 0 THEN 1 ELSE 0 END) AS failures,
         MIN(received_at)                  AS first_seen,
         MAX(received_at)                  AS last_seen
  FROM readings GROUP BY kind
`);

// ── the page ─────────────────────────────────────────────────────────────────

function escapeHtml(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

function ago(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function renderPage(): string {
  const latest = qLatestPerKind.all() as any[];
  const recent = qRecent.all({ $kind: null, $limit: 60 }) as any[];
  const stats = qStats.all() as any[];

  const card = (kind: string, label: string, body: string) => {
    const l = latest.find((r) => r.kind === kind);
    if (!l) return `<div class="card stale"><h2>${label}</h2><p class="muted">no readings yet</p></div>`;
    const staleMin = (Date.now() - Date.parse(l.received_at)) / 60000;
    const cls = !l.ok ? "bad" : staleMin > 15 ? "stale" : "good";
    return `<div class="card ${cls}">
      <h2>${label}</h2>
      ${l.ok ? body : `<p class="err">FAULT — ${escapeHtml(l.error ?? "no error given")}</p>`}
      <p class="muted">${escapeHtml(l.node ?? "?")} · ${ago(l.received_at)}${
        l.rssi != null ? ` · ${l.rssi} dBm` : ""
      }${l.uptime_s != null ? ` · up ${Math.floor(l.uptime_s / 3600)}h` : ""}</p>
    </div>`;
  };

  const water = latest.find((r) => r.kind === "water");
  const soil = latest.find((r) => r.kind === "soil");

  const cards =
    card(
      "water",
      "Water tank",
      `<p class="big">${water?.depth_mm != null ? `${water.depth_mm} <small>mm</small>` : "—"}</p>` +
        (water?.percent != null ? `<p class="sub">${water.percent}% full</p>` : ""),
    ) +
    card(
      "soil",
      "Soil",
      `<p class="big">${soil?.moisture_pct != null ? `${soil.moisture_pct} <small>%</small>` : "—"}</p>` +
        `<p class="sub">${soil?.temp_c != null ? `${soil.temp_c} °C` : ""}${
          soil?.ec != null ? ` · EC ${soil.ec}` : ""
        }${soil?.valve != null ? ` · valve ${soil.valve ? "OPEN" : "shut"}` : ""}</p>`,
    );

  const rows = recent
    .map(
      (r) => `<tr class="${r.ok ? "" : "rowbad"}">
        <td class="mono">${escapeHtml(r.received_at.replace("T", " ").slice(0, 19))}</td>
        <td>${escapeHtml(r.kind)}</td>
        <td>${escapeHtml(r.node ?? "")}</td>
        <td class="mono">${
          r.ok
            ? r.kind === "water"
              ? `${r.depth_mm ?? "—"} mm`
              : `${r.moisture_pct ?? "—"}% · ${r.temp_c ?? "—"}°C`
            : `<span class="err">${escapeHtml(r.error ?? "fault")}</span>`
        }</td>
        <td class="mono muted">${r.rssi ?? ""}</td>
      </tr>`,
    )
    .join("");

  const statRows = stats
    .map(
      (s) =>
        `<tr><td>${escapeHtml(s.kind)}</td><td class="mono">${s.total}</td><td class="mono">${
          s.failures
        }</td><td class="mono muted">${escapeHtml(s.last_seen.replace("T", " ").slice(0, 19))}</td></tr>`,
    )
    .join("");

  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Maani Plantation — farm telemetry</title>
<meta http-equiv="refresh" content="60">
<style>
  :root { color-scheme: light dark; --bg:#fff; --fg:#111; --mut:#666; --line:#e3e3e3; --card:#fafafa;
          --good:#1a7f37; --bad:#b3261e; --stale:#8a6d00; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#0f1113; --fg:#e8e8e8; --mut:#9aa0a6; --line:#272b30; --card:#16191c;
            --good:#3fb950; --bad:#f85149; --stale:#d29922; }
  }
  * { box-sizing: border-box; }
  body { margin:0; padding:1.25rem; background:var(--bg); color:var(--fg);
         font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
  h1 { font-size:1.1rem; font-weight:600; margin:0 0 1rem; }
  h1 small { color:var(--mut); font-weight:400; }
  .cards { display:grid; gap:1rem; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); margin-bottom:1.5rem; }
  .card { border:1px solid var(--line); border-left-width:4px; border-radius:10px; padding:1rem; background:var(--card); }
  .card.good { border-left-color:var(--good); }
  .card.bad  { border-left-color:var(--bad); }
  .card.stale{ border-left-color:var(--stale); }
  .card h2 { font-size:.8rem; text-transform:uppercase; letter-spacing:.05em; color:var(--mut); margin:0 0 .5rem; font-weight:600; }
  .big { font-size:2.2rem; font-weight:600; margin:0; line-height:1.1; }
  .big small { font-size:1rem; color:var(--mut); font-weight:400; }
  .sub { margin:.25rem 0 0; color:var(--mut); font-size:.9rem; }
  .muted { color:var(--mut); font-size:.8rem; margin:.5rem 0 0; }
  .err { color:var(--bad); font-weight:600; margin:0; }
  h3 { font-size:.8rem; text-transform:uppercase; letter-spacing:.05em; color:var(--mut); margin:1.5rem 0 .5rem; }
  .scroll { overflow-x:auto; border:1px solid var(--line); border-radius:10px; }
  table { border-collapse:collapse; width:100%; font-size:.85rem; }
  th,td { text-align:left; padding:.4rem .7rem; border-bottom:1px solid var(--line); white-space:nowrap; }
  th { color:var(--mut); font-weight:600; font-size:.75rem; text-transform:uppercase; }
  tr:last-child td { border-bottom:none; }
  .rowbad td { background:color-mix(in srgb, var(--bad) 8%, transparent); }
  .mono { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; }
  footer { margin-top:1.5rem; color:var(--mut); font-size:.75rem; }
</style></head><body>
<h1>Maani Plantation <small>· farm telemetry · auto-refresh 60 s</small></h1>
<div class="cards">${cards}</div>
<h3>Per-sensor totals</h3>
<div class="scroll"><table><thead><tr><th>Sensor</th><th>Readings</th><th>Faults</th><th>Last seen</th></tr></thead>
<tbody>${statRows || '<tr><td colspan="4" class="muted">nothing yet</td></tr>'}</tbody></table></div>
<h3>Last 60 readings</h3>
<div class="scroll"><table><thead><tr><th>Received (UTC)</th><th>Kind</th><th>Node</th><th>Value</th><th>RSSI</th></tr></thead>
<tbody>${rows || '<tr><td colspan="5" class="muted">nothing yet</td></tr>'}</tbody></table></div>
<footer>Times are UTC (server clock — the ESP has no RTC). JSON at <code>/api/readings</code>.</footer>
</body></html>`;
}

// ── routes ───────────────────────────────────────────────────────────────────

const server = Bun.serve({
  port: PORT,
  hostname: HOST,
  maxRequestBodySize: MAX_BODY,

  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    // Unauthenticated liveness probe. Deliberately says nothing about the data.
    if (path === "/health") return json({ ok: true, service: "farm-ingest" });

    // ── write side ──────────────────────────────────────────────────────────
    if (req.method === "POST" && (path === "/ingest" || path === "/ingest/batch")) {
      if (!tokenOk(bearer(req))) return UNAUTHORIZED();

      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return json({ error: "invalid json" }, 400);
      }

      // Accept a bare reading, an array, or {readings:[...]} — Node-RED users will
      // send all three eventually, and rejecting two of them is a support burden.
      const items = Array.isArray(body)
        ? body
        : body && typeof body === "object" && Array.isArray((body as any).readings)
          ? (body as any).readings
          : [body];

      if (items.length > MAX_BATCH) return json({ error: `batch too large (max ${MAX_BATCH})` }, 413);

      const { accepted, duplicates } = store(items);
      console.log(`[ingest] ${accepted} stored, ${duplicates} dup, ${items.length} offered`);
      return json({ ok: true, accepted, duplicates, received: items.length });
    }

    // ── read side ───────────────────────────────────────────────────────────
    const authed = tokenOk(bearer(req)) || tokenOk(cookieToken(req)) || tokenOk(url.searchParams.get("k"));

    if (path === "/api/readings") {
      if (!authed) return UNAUTHORIZED();
      const limit = Math.min(Number(url.searchParams.get("limit") ?? 200) || 200, 5000);
      const kind = url.searchParams.get("kind");
      return json(qRecent.all({ $kind: kind, $limit: limit }));
    }

    if (path === "/api/latest") {
      if (!authed) return UNAUTHORIZED();
      return json(qLatestPerKind.all());
    }

    if (path === "/") {
      if (!authed) {
        return new Response(
          "farm-ingest\n\nAdd ?k=<token> to view, or send Authorization: Bearer <token>.\n",
          { status: 401, headers: { "content-type": "text/plain; charset=utf-8" } },
        );
      }
      const headers: Record<string, string> = { "content-type": "text/html; charset=utf-8" };
      // First visit carries the token in the URL; park it in a cookie so the
      // secret stops appearing in the address bar, browser history, and referrers.
      if (url.searchParams.get("k")) {
        headers["set-cookie"] =
          `farm_token=${encodeURIComponent(TOKEN)}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax`;
        headers["location"] = "/";
        return new Response(null, { status: 302, headers });
      }
      return new Response(renderPage(), { headers });
    }

    return json({ error: "not found" }, 404);
  },
});

console.log(`farm-ingest listening on http://${server.hostname}:${server.port} · db ${DB_PATH}`);
