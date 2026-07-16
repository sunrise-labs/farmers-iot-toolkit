#!/usr/bin/env bun
/**
 * poll-water.ts — QDY30A water-level RS485 (Modbus RTU) bench poller.
 *
 * Same adapter-tolerant approach as poll-soil.ts (see that file / devlog.md for
 * WHY mbpoll fails here): send request, read a generous window, resync on a valid
 * frame, validate CRC before trusting it, retry past turnaround corruption.
 *
 * Reads the whole config block 0x0000–0x0006 so you can CONFIRM the community
 * register map against your actual unit (Step 2 of docs/bench/02-...). The register
 * semantics are community-sourced, not from the manual — trust the ruler, not this.
 *
 * Usage:
 *   bun tools/poll-water.ts [device] [--once]
 *   bun tools/poll-water.ts --calibrate         # Step 4 ruler test, interactive
 *   bun tools/poll-water.ts --calibrate --mm    # ...entering depths in mm
 *   bun tools/poll-water.ts --point=65mm        # capture one ruler point
 *   bun tools/poll-water.ts --fit               # fit + verdict over stored points
 *   bun tools/poll-water.ts --reset             # clear stored points
 *
 * Sensor facts: 9600 8N1 (NOT 4800 like soil), slave address 1.
 *   0x0000 addr · 0x0001 baud code (3=9600) · 0x0002 unit code · 0x0003 decimals
 *   0x0004 measured value (int16 SIGNED) ← the level · 0x0005 zero · 0x0006 range
 */
import { openSync, readSync, writeSync, writeFileSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { createInterface } from "node:readline/promises";

const argv = process.argv.slice(2);
const once = argv.includes("--once");
const calibrateMode = argv.includes("--calibrate");
const mmMode = argv.includes("--mm"); // enter ruler depths in mm instead of cm
const DEV = argv.find((a) => !a.startsWith("--")) ?? "/dev/ttyUSB0";

execSync(`stty -F ${DEV} 9600 cs8 -cstopb -parenb -icanon -echo -isig min 0 time 3`);

function crc16(buf: number[], len: number): number {
  let crc = 0xffff;
  for (let i = 0; i < len; i++) {
    crc ^= buf[i];
    for (let b = 0; b < 8; b++) crc = crc & 1 ? (crc >> 1) ^ 0xa001 : crc >> 1;
  }
  return crc;
}

// Read 7 holding registers (0x0000–0x0006) from slave 1. CRC computed, not hardcoded.
function buildReq(): Buffer {
  const body = [0x01, 0x03, 0x00, 0x00, 0x00, 0x07];
  const c = crc16(body, body.length);
  return Buffer.from([...body, c & 0xff, (c >> 8) & 0xff]);
}
const REQ = buildReq();

const UNITS: Record<number, string> = {
  0x11: "cm", 0x12: "m", 0x13: "kPa", 0x14: "Bar", 0x15: "PSI",
};

// Separate read and write handles. At 9600 a single handle loses the reply header
// to the adapter's TX→RX turnaround; a dedicated always-in-RX reader fd avoids it.
const fdW = openSync(DEV, "w");
const fdR = openSync(DEV, "r");
const rbuf = Buffer.alloc(64);

/** One exchange → validated 19-byte frame (01 03 0E <14 data> <crc>), or null. */
function exchange(): number[] | null {
  writeSync(fdW, REQ);
  const acc: number[] = [];
  const deadline = Date.now() + 400;
  while (Date.now() < deadline && acc.length < 40) {
    let n = 0;
    try { n = readSync(fdR, rbuf, 0, rbuf.length, null); } catch { n = 0; }
    for (let i = 0; i < n; i++) acc.push(rbuf[i]);
  }
  for (let i = 0; i + 19 <= acc.length; i++) {
    if (acc[i] === 0x01 && acc[i + 1] === 0x03 && acc[i + 2] === 0x0e) {
      const f = acc.slice(i, i + 19);
      if (crc16(f, 17) === (f[17] | (f[18] << 8))) return f;
    }
  }
  return null;
}

function reg(f: number[], n: number): number {
  const hi = f[3 + n * 2], lo = f[4 + n * 2];
  return (hi << 8) | lo;
}

function poll(maxTries = 5): void {
  for (let t = 0; t < maxTries; t++) {
    const f = exchange();
    if (!f) continue;
    const addr = reg(f, 0);
    const baud = reg(f, 1);
    const unit = reg(f, 2);
    const dec = reg(f, 3);
    const level = ((reg(f, 4) << 16) >> 16); // signed
    const zero = reg(f, 5);
    const range = reg(f, 6);
    const unitName = UNITS[unit] ?? `0x${unit.toString(16)}`;
    console.log(
      `addr=${addr} baudCode=${baud} unit=${unitName} decimals=${dec} | ` +
        `LEVEL(0x0004)=${level} (raw) zero=${zero} range=${range}`,
    );
    return;
  }
  console.log(`--  no valid frame after ${maxTries} tries`);
}

// ─── Step 4: ruler calibration ──────────────────────────────────────────────
// The unit/decimals registers are community-sourced and reportedly lie (mm vs cm).
// A ruler doesn't. Fit depth_cm = slope*raw + intercept against known depths.

type Point = { depth: number; raw: number; spread: number };

/** Just the level register, with retries. Returns raw signed counts, or null. */
function readLevel(maxTries = 5): number | null {
  for (let t = 0; t < maxTries; t++) {
    const f = exchange();
    if (f) return (reg(f, 4) << 16) >> 16;
  }
  return null;
}

/** Average n readings. Spread exposes an unsettled surface or a bubble on the probe. */
function sample(n = 8): { mean: number; spread: number; ok: number } | null {
  const vals: number[] = [];
  for (let i = 0; i < n; i++) {
    const v = readLevel();
    if (v !== null) vals.push(v);
    Bun.sleepSync(120);
  }
  if (!vals.length) return null;
  return {
    mean: vals.reduce((a, b) => a + b, 0) / vals.length,
    spread: Math.max(...vals) - Math.min(...vals),
    ok: vals.length,
  };
}

/**
 * Least-squares fit over ALL points. Deliberately not the guide's fit-2-verify-1:
 * using every point and reporting residuals gives the same hold-out signal (a line
 * that predicts each point within a few mm is right) while wasting no data.
 */
function fit(pts: Point[]) {
  const n = pts.length;
  const sx = pts.reduce((a, p) => a + p.raw, 0);
  const sy = pts.reduce((a, p) => a + p.depth, 0);
  const sxy = pts.reduce((a, p) => a + p.raw * p.depth, 0);
  const sxx = pts.reduce((a, p) => a + p.raw * p.raw, 0);
  const denom = n * sxx - sx * sx;
  if (Math.abs(denom) < 1e-9) return null; // every point at the same raw value
  const slope = (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  const ybar = sy / n;
  const ssTot = pts.reduce((a, p) => a + (p.depth - ybar) ** 2, 0);
  const ssRes = pts.reduce((a, p) => a + (p.depth - (slope * p.raw + intercept)) ** 2, 0);
  // Standard error of the slope. This — not R² — is what says whether a fit taken
  // over a short span can be trusted when extrapolated to a full tank.
  const xbar = sx / n;
  const sxxC = pts.reduce((a, p) => a + (p.raw - xbar) ** 2, 0);
  const seSlope = n > 2 && sxxC > 0 ? Math.sqrt(ssRes / (n - 2) / sxxC) : NaN;
  return { slope, intercept, r2: ssTot > 0 ? 1 - ssRes / ssTot : 1, seSlope };
}

/**
 * Parse a ruler entry to cm. An explicit mm/cm suffix always wins; a bare number
 * means the --mm default. The units trap is real: typing "65" (mm) into a cm
 * prompt fits a line that is silently 10x wrong, and R² can't see the error.
 */
function parseDepthCm(s: string): number | null {
  const m = s.match(/^\s*(-?[\d.]+)\s*(mm|cm)?\s*$/i);
  if (!m) return null;
  const v = Number(m[1]);
  if (!Number.isFinite(v)) return null;
  const unit = m[2]?.toLowerCase() ?? (mmMode ? "mm" : "cm");
  return unit === "mm" ? v / 10 : v;
}

const STORE = `${import.meta.dir}/../water-calibration.json`;

function loadPoints(): Point[] {
  try {
    return JSON.parse(readFileSync(STORE, "utf8")).points ?? [];
  } catch {
    return [];
  }
}
function savePoints(pts: Point[], f: ReturnType<typeof fit> = null): void {
  writeFileSync(STORE, JSON.stringify({ device: DEV, points: pts, fit: f }, null, 2) + "\n");
}

/**
 * Capture one ruler point non-interactively and append it to the store.
 * Split out from the interactive loop so the calibration can be driven a point at
 * a time from outside — hands in a bucket, no terminal prompt to babysit.
 */
function capturePoint(depthCm: number): void {
  // First exchange after a cold port open loses its header to the adapter's
  // TX→RX turnaround (devlog 2026-07-15). Burn it before the real samples.
  readLevel(8);
  const s = sample();
  if (!s) {
    console.log("NO VALID FRAME — check power (18 V) and A/B wiring");
    process.exit(1);
  }
  const pts = loadPoints();
  pts.push({ depth: depthCm, raw: s.mean, spread: s.spread });
  savePoints(pts);
  console.log(
    `point ${pts.length}: ruler=${(depthCm * 10).toFixed(0)} mm  raw mean=${s.mean.toFixed(1)}  spread=${s.spread}  (${s.ok}/8 frames)`,
  );
  if (s.spread > 5) console.log("  ⚠ spread >5 counts — surface unsettled, or a bubble on the probe");
  if (pts.length >= 2) {
    const prev = pts[pts.length - 2];
    const dDepth = (depthCm - prev.depth) * 10;
    const dRaw = s.mean - prev.raw;
    console.log(`  since last: ruler +${dDepth.toFixed(0)} mm → raw +${dRaw.toFixed(1)} counts  (${(dDepth / dRaw).toFixed(3)} mm/count)`);
  }
  console.log(`  ${pts.length} point(s) stored. --fit when done.`);
}

/** The fit + verdict report. Shared by --fit and the interactive --calibrate loop. */
function report(pts: Point[]): void {
  if (pts.length < 2) {
    console.log("Need at least 2 points to fit a line.");
    return;
  }
  const f = fit(pts);
  if (!f) {
    console.log("All points read the same raw value — the level isn't tracking depth. Stop and check 0x0004.");
    return;
  }
  savePoints(pts, f);

  const span = Math.max(...pts.map((p) => p.depth)) - Math.min(...pts.map((p) => p.depth));
  console.log(`\n─── FIT ───────────────────────────────────────────
  level_cm = ${f.slope.toFixed(5)} * raw + ${f.intercept.toFixed(3)}
  cm_per_count = ${f.slope.toFixed(5)}     R² = ${f.r2.toFixed(6)}
  ${pts.length} points over ${(span * 10).toFixed(0)} mm of depth

  ruler_mm     raw   predicted_mm   residual_mm`);
  for (const p of pts) {
    const pred = f.slope * p.raw + f.intercept;
    const res = (pred - p.depth) * 10;
    const flag = Math.abs(res) > 5 ? "  ← off by >5 mm" : "";
    console.log(
      `  ${(p.depth * 10).toFixed(0).padStart(8)}  ${p.raw.toFixed(1).padStart(6)}   ${(pred * 10).toFixed(1).padStart(12)}   ${(res >= 0 ? "+" : "") + res.toFixed(1)}${flag}`,
    );
  }

  // The whole point of the ruler test: which unit is the sensor actually in?
  const near = (v: number, t: number) => Math.abs(v - t) / t < 0.15;
  console.log("\n─── VERDICT ───────────────────────────────────────");
  if (near(f.slope, 0.1)) {
    console.log("  slope ≈ 0.1 → 1 count = 1 mm. Sensor reports MILLIMETRES.");
    console.log("  Consistent with unit=cm + decimals=1. Divide raw by 10 for cm.");
  } else if (near(f.slope, 1.0)) {
    console.log("  slope ≈ 1.0 → 1 count = 1 cm. Raw IS centimetres, decimals=1 is a lie.");
  } else {
    console.log(`  slope = ${f.slope.toFixed(5)} — matches neither mm (0.1) nor cm (1.0).`);
    console.log("  Re-check reg 0x0003 (decimals) and that the ruler measured above the PROBE, not the bucket floor.");
  }
  if (f.r2 < 0.999) console.log(`  ⚠ R² = ${f.r2.toFixed(6)} — points aren't collinear. Suspect bubbles or a moving probe.`);

  // Extrapolation honesty. A tight R² over a short span still hides a slope error
  // that grows linearly with depth, so state it in mm at real tank heights.
  if (Number.isFinite(f.seSlope)) {
    const errAt = (cm: number) => ((f.seSlope * (cm / f.slope)) * 10).toFixed(1);
    console.log(`\n  slope standard error = ±${f.seSlope.toExponential(2)} cm/count`);
    console.log(`  → extrapolated 1σ error:  ±${errAt(100)} mm at 1 m ·  ±${errAt(200)} mm at 2 m`);
    if (span < 20) {
      console.log(`  ⚠ only ${(span * 10).toFixed(0)} mm of span on a 5 m sensor. R² will look great regardless —`);
      console.log(`    it measures collinearity, not extrapolation. Widen the span to tighten this.`);
    }
  } else {
    console.log(`\n  (3+ points needed to estimate slope uncertainty)`);
  }

  console.log(`\n  points + fit written to ${STORE}`);
}

/** Interactive loop — for anyone running this rig from the guide, unattended. */
async function calibrate(): Promise<void> {
  const U = mmMode ? "mm" : "cm";
  console.log(`
Ruler calibration — QDY30A on ${DEV}

  Probe flat on the bottom, and DON'T let it shift between points.
  For each point: set a depth, measure the water ABOVE THE PROBE, type it in ${U}.
  (A "mm" or "cm" suffix overrides — e.g. "65mm" or "6.5cm".)

  Use the widest depth range you can — this is a 5 m sensor (range=5000), so a
  narrow span makes the slope noisy when extrapolated to tank depths.
  Take at least 3 points; 4-5 is better. Tilt the probe when submerging to
  shed air bubbles (community reports ~15 mm of error from a trapped bubble).

  Blank line (or q) when done.
`);
  process.stdout.write("  warming up the port… ");
  const warm = readLevel(8);
  console.log(warm === null ? "no frame yet — check power/wiring before starting" : `ok (raw=${warm})`);

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const pts: Point[] = [];
  for (;;) {
    const ans = (await rl.question(`[point ${pts.length + 1}] depth above probe, ${U} (blank = fit): `)).trim();
    if (ans === "" || ans.toLowerCase() === "q") break;
    const depth = parseDepthCm(ans);
    if (depth === null) {
      console.log(`  can't read that — give a number, optionally with mm/cm\n`);
      continue;
    }
    process.stdout.write(`  ${(depth * 10).toFixed(0)} mm → sampling… `);
    const s = sample();
    if (!s) {
      console.log("NO VALID FRAME — check power (18 V) and A/B wiring\n");
      continue;
    }
    console.log(`raw mean=${s.mean.toFixed(1)}  spread=${s.spread}  (${s.ok}/8 frames)`);
    if (s.spread > 5) console.log("  ⚠ spread >5 counts — let it settle, or shake a bubble off the probe");
    pts.push({ depth, raw: s.mean, spread: s.spread });
    console.log();
  }
  rl.close();
  report(pts);
}

const pointArg = argv.find((a) => a.startsWith("--point="))?.slice(8);

if (argv.includes("--read")) {
  // Averaged read that stores nothing — for checking a level against a previous
  // capture without adding a duplicate point to the fit.
  readLevel(8); // burn the cold-port exchange
  const s = sample();
  if (!s) {
    console.log("NO VALID FRAME");
    process.exit(1);
  }
  console.log(`raw mean=${s.mean.toFixed(1)}  spread=${s.spread}  (${s.ok}/8 frames)  [not stored]`);
} else if (argv.includes("--reset")) {
  savePoints([]);
  console.log(`cleared ${STORE}`);
} else if (pointArg !== undefined) {
  const d = parseDepthCm(pointArg);
  if (d === null) {
    console.log(`can't parse depth "${pointArg}" — use e.g. --point=65mm or --point=6.5cm`);
    process.exit(1);
  }
  capturePoint(d);
} else if (argv.includes("--fit")) {
  report(loadPoints());
} else if (calibrateMode) {
  await calibrate();
  process.exit(0);
} else if (once) {
  poll();
} else {
  console.log(`Polling ${DEV} @ 9600 8N1 — Ctrl-C to stop. Watch LEVEL as you dunk the probe.`);
  poll();
  setInterval(() => poll(), 1000);
}
