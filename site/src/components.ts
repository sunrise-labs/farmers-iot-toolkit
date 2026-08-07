/**
 * Rendering helpers. Everything here takes data from `data.ts` and returns HTML
 * strings — no template engine, no dependencies.
 *
 * The wiring PICTURES are photographs of the real build, not drawings generated
 * from this data. We used to generate SVG schematics here; they were harder to
 * follow than a photo of the actual boards, so they are gone. The tables below
 * remain generated, and they remain the authority on pins and registers.
 */

import type { Bus, Diagram, Module, Part, Step } from "./data.ts";
import { BUSES, ENDPOINTS, MODULES, PARTS, PIN_BUDGET, POWER, STATUS, bom, cost } from "./data.ts";

/* ─────────────────────────────────── atoms ───────────────────────────────── */

export const esc = (s: string) =>
  s.replace(/&(?!#?\w+;)/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const money = (n: number | null) =>
  n === null ? `<span class="tbc" title="We have not paid a confirmed price for this yet">TBC</span>` : `$${n}`;

export function statusBadge(key: keyof typeof STATUS): string {
  return `<span class="badge badge--${key}" title="${esc(STATUS[key].note)}">
    <span class="badge__dot" aria-hidden="true"></span>${STATUS[key].label}</span>`;
}

export function callout(level: "warn" | "danger" | "note", text: string): string {
  const mark = { warn: "Watch out", danger: "This will bite you", note: "Worth knowing" }[level];
  return `<aside class="callout callout--${level}">
    <span class="callout__label">${mark}</span>
    <p>${text}</p>
  </aside>`;
}

export function code(lang: string, text: string): string {
  return `<pre class="code" data-lang="${esc(lang)}"><code>${esc(text)}</code></pre>`;
}

/* ─────────────────────────────────── tables ──────────────────────────────── */

export function bomTable(m: Module): string {
  const items = bom(m);
  const c = cost(m);
  const rows = items
    .map(
      (p: Part) => `<tr>
      <th scope="row">
        ${p.url ? `<a href="${p.url}" rel="noopener nofollow">${esc(p.name)}</a>` : esc(p.name)}
        ${p.qty ? `<span class="qty">×${p.qty}</span>` : ""}
        ${p.caution ? `<p class="part__caution">${p.caution}</p>` : ""}
      </th>
      <td>${esc(p.role)}</td>
      <td class="num">${money(p.usd)}</td>
      <td class="buy">${p.url ? `<a class="buylink" href="${p.url}" rel="noopener nofollow">Buy<span class="sr-only"> ${esc(p.name)}</span> ↗</a>` : `<span class="nolink">—</span>`}</td>
    </tr>`,
    )
    .join("");

  return `<div class="table-wrap">
    <table class="bom">
      <caption class="sr-only">Bill of materials for ${esc(m.title)}</caption>
      <thead><tr><th scope="col">Part</th><th scope="col">What it does</th><th scope="col" class="num">Est.</th><th scope="col">Link</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr>
        <th scope="row" colspan="2">Approximate total</th>
        <td class="num">~$${c.total}</td>
        <td>${c.unknown ? `<span class="tbc">+${c.unknown} TBC</span>` : ""}</td>
      </tr></tfoot>
    </table>
  </div>
  <p class="fineprint">Prices are what we paid or expect to pay, in USD, mostly on AliExpress —
  they move, and shipping to a small island is its own line item. Links are not affiliate links
  and we get nothing if you use them.</p>`;
}

export function busTable(bus: Bus): string {
  const wires = bus.wires
    .map(
      (w) => `<tr>
      <th scope="row"><span class="swatch" style="--swatch:${w.hex}" aria-hidden="true"></span>${esc(w.colour)}</th>
      <td class="mono">${esc(w.from)}</td>
      <td class="mono">${esc(w.to)}</td>
      <td class="note">${w.note ? esc(w.note) : ""}</td>
    </tr>`,
    )
    .join("");

  // Every pin set the bus has, teaching one first. Conflating them is the bug
  // this whole file exists to prevent, so they are shown side by side and each
  // one names the .ino it was read out of.
  const pinsets = [...bus.pinsets]
    .sort((a, b) => Number(b.teaching) - Number(a.teaching))
    .map(
      (ps) => `<div class="pinset${ps.teaching ? " pinset--teach" : ""}">
      <div class="pinset__head">
        <h5>${esc(ps.label)}</h5>
        ${ps.teaching ? `<span class="pinset__tag">wire this one</span>` : ""}
        <code class="pinset__src">${esc(ps.firmware)}</code>
      </div>
      ${ps.note ? `<p class="pinset__note">${esc(ps.note)}</p>` : ""}
      <div class="table-wrap"><table class="wiring">
        <thead><tr><th scope="col">RS485 pad</th><th scope="col">ESP pin</th><th scope="col">GPIO</th><th scope="col">Direction</th></tr></thead>
        <tbody>${ps.pins
          .map(
            (p) => `<tr>
          <th scope="row" class="mono">${esc(p.pad)}</th>
          <td class="mono strong">${esc(p.esp)}</td>
          <td class="mono dim">${esc(p.gpio)}</td>
          <td class="note">${esc(p.dir)}</td>
        </tr>`,
          )
          .join("")}</tbody>
      </table></div>
    </div>`,
    )
    .join("");

  const regs = bus.registers
    .map(
      (r) => `<tr>
      <th scope="row" class="mono">${esc(r.addr)}</th>
      <td>${esc(r.means)}</td>
      <td class="mono">${esc(r.scale)}</td>
      <td>${r.signed ? `<b class="warnword">signed int16</b>` : "unsigned"}</td>
    </tr>`,
    )
    .join("");

  return `<div class="bus">
    <div class="bus__head">
      <h4>${esc(bus.label)}</h4>
      <dl class="spec">
        <div><dt>Baud</dt><dd class="mono">${bus.baud}</dd></div>
        <div><dt>Frame</dt><dd class="mono">${esc(bus.frame)}</dd></div>
        <div><dt>Slave</dt><dd class="mono">${bus.slave}</dd></div>
      </dl>
    </div>
    <div class="table-wrap"><table class="wiring">
      <thead><tr><th scope="col">Probe wire</th><th scope="col">From</th><th scope="col">Goes to</th><th scope="col">Note</th></tr></thead>
      <tbody>${wires}</tbody>
    </table></div>
    ${pinsets}
    <div class="table-wrap"><table class="wiring">
      <thead><tr><th scope="col">Register</th><th scope="col">Means</th><th scope="col">Scaling</th><th scope="col">Type</th></tr></thead>
      <tbody>${regs}</tbody>
    </table></div>
  </div>`;
}

export function pinBudgetTable(): string {
  const rows = PIN_BUDGET.map(
    (p) => `<tr class="${p.safe ? "safe" : "trap"}">
      <th scope="row" class="mono strong">${esc(p.esp)}</th>
      <td class="mono dim">${esc(p.gpio)}</td>
      <td>${p.safe ? `<span class="ok">safe</span>` : `<span class="no">trap</span>`}</td>
      <td>${esc(p.use)}</td>
      <td class="note">${p.why ? esc(p.why) : ""}</td>
    </tr>`,
  ).join("");

  return `<div class="table-wrap"><table class="wiring pinbudget">
    <caption>Every GPIO on a NodeMCU 1.0, and what it can actually be used for</caption>
    <thead><tr><th scope="col">Pin</th><th scope="col">GPIO</th><th scope="col"></th><th scope="col">Used for</th><th scope="col">Why not</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

export function faultTable(faults: { symptom: string; cause: string; fix: string }[]): string {
  const rows = faults
    .map(
      (f) => `<tr>
      <th scope="row">${esc(f.symptom)}</th>
      <td class="cause">${esc(f.cause)}</td>
      <td>${esc(f.fix)}</td>
    </tr>`,
    )
    .join("");
  return `<div class="table-wrap"><table class="faults">
    <thead><tr><th scope="col">Symptom</th><th scope="col">Almost always</th><th scope="col">What to do</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

export function endpointTable(): string {
  const rows = ENDPOINTS.map(
    (e) => `<tr>
      <td><span class="dirpill dirpill--${e.dir}">${e.dir === "up" ? "uplink" : e.dir === "down" ? "downlink" : "page"}</span></td>
      <th scope="row" class="mono">${esc(e.method)}</th>
      <td class="mono strong">${esc(e.path)}</td>
      <td class="mono dim">${esc(e.payload)}</td>
    </tr>`,
  ).join("");
  return `<div class="table-wrap"><table class="wiring">
    <thead><tr><th scope="col"></th><th scope="col">Method</th><th scope="col">Path</th><th scope="col">Payload</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

export function powerTable(): string {
  const rows = POWER.loads
    .map(
      (l) => `<tr class="${l.what.includes("total") ? "sum" : ""}">
      <th scope="row">${esc(l.what)}</th>
      <td class="mono">${esc(l.w)}</td>
      <td>${esc(l.duty)}</td>
      <td class="num mono strong">${esc(l.whDay)}</td>
    </tr>`,
    )
    .join("");
  return `<div class="table-wrap"><table class="wiring">
    <caption>What each thing costs you per day, against a panel that collects ${POWER.panel.harvestClear} clear and ${POWER.panel.harvestCloud} under heavy cloud</caption>
    <thead><tr><th scope="col">Device</th><th scope="col">Power awake</th><th scope="col">Awake how often</th><th scope="col" class="num">Wh/day</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

/* ─────────────────────────────────── steps ───────────────────────────────── */

export function stepList(steps: Step[]): string {
  return `<ol class="steps">${steps
    .map((s, i) => {
      const unproven =
        s.proven === false
          ? `<p class="step__unproven">Design guidance — our own build hasn't reached this step yet.</p>`
          : "";
      return `<li class="step${s.proven === false ? " step--unproven" : ""}">
      <div class="step__n" aria-hidden="true">${String(i + 1).padStart(2, "0")}</div>
      <div class="step__body">
        <h3>${esc(s.title)}</h3>
        ${unproven}
        ${s.body.map((p) => `<p>${p}</p>`).join("")}
        ${s.code ? code(s.code.lang, s.code.text) : ""}
        ${(s.gotchas ?? []).map((g) => callout(g.level, g.text)).join("")}
      </div>
    </li>`;
    })
    .join("")}</ol>`;
}

/* ──────────────────────────────── figures ────────────────────────────────── */

/* ──────────────────────────────── wiring photos ──────────────────────────── */

/**
 * A wiring photograph.
 *
 * Linked to itself so a tap opens the full-size file — these get read on a phone
 * with a probe in the other hand, and the detail that matters is which pin a wire
 * lands on. `loading="lazy"` because the picture is never the first thing on a
 * page, and width/height are set so the layout does not jump while it arrives.
 */
export function diagramFigure(d: Diagram, base = "", cls = ""): string {
  const src = `${base}assets/img/${d.src}`;
  return `<figure class="figure figure--photo${cls ? ` ${cls}` : ""}">
    <a class="figure__zoom" href="${src}" title="Open the full-size diagram">
      <img src="${src}" alt="${esc(d.alt)}" loading="lazy" decoding="async">
    </a>
    <figcaption>${d.caption}</figcaption>
  </figure>`;
}

/* ─────────────────────────────── module cards ────────────────────────────── */

export function moduleCard(m: Module, base = ""): string {
  const c = cost(m);
  return `<a class="mcard" href="${base}modules/${m.slug}.html" style="--accent:${m.accent};--accent-dark:${m.accentDark}">
    <div class="mcard__top">
      <span class="mcard__n">${m.n}</span>
      ${statusBadge(m.status)}
    </div>
    <h3 class="mcard__title">${esc(m.title)}</h3>
    <p class="mcard__plain">${esc(m.plain)}</p>
    <dl class="mcard__meta">
      <div><dt>Level</dt><dd>${m.difficulty}</dd></div>
      <div><dt>Build</dt><dd>${esc(m.buildTime)}</dd></div>
      <div><dt>Parts</dt><dd>~$${c.total}${c.unknown ? "+" : ""}</dd></div>
    </dl>
    <span class="mcard__go">Build it <span aria-hidden="true">→</span></span>
  </a>`;
}

export function moduleNav(current: string, base = ""): string {
  return `<nav class="modnav" aria-label="Modules">
    ${MODULES.map(
      (m) => `<a href="${base}modules/${m.slug}.html"
      class="modnav__i${m.slug === current ? " is-current" : ""}"
      style="--accent:${m.accent};--accent-dark:${m.accentDark}"
      ${m.slug === current ? 'aria-current="page"' : ""}>
      <span class="modnav__n">${m.n}</span><span class="modnav__t">${esc(m.short)}</span></a>`,
    ).join("")}
  </nav>`;
}

export { BUSES, MODULES, PARTS, POWER, bom, cost, teachingPins };
