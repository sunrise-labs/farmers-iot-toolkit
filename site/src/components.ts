/**
 * Rendering helpers. Everything here takes data from `data.ts` and returns HTML
 * strings — no template engine, no dependencies.
 *
 * The wiring tables and the wiring SVGs are rendered from the SAME `Bus` object,
 * which is the point: a diagram cannot disagree with the table beside it.
 */

import type { Bus, Module, Part, Step } from "./data.ts";
import { BUSES, ENDPOINTS, MODULES, PARTS, PIN_BUDGET, POWER, STATUS, bom, cost, teachingPins } from "./data.ts";

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
          ? `<p class="step__unproven">This step is the design, not a report — no hardware has confirmed it yet.</p>`
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

/* ──────────────────────────────── SVG diagrams ───────────────────────────── */

/**
 * The whole-system diagram: how the four modules interact.
 *
 * Deliberately drawn as three zones (field / shed / anywhere) because the
 * interesting property of this system is which arrows cross which boundary —
 * nothing on the farm is reachable from the internet, so every arrow leaving
 * the farm points outward.
 */
export function systemDiagram(): string {
  // Module badges are drawn, not typeset: the circled numerals U+2460.. are not
  // present in the display face and render as tofu boxes on most devices.
  const box = (
    x: number, y: number, w: number, h: number,
    n: string, title: string, sub: string, accent: string,
  ) => `
    <g class="node" transform="translate(${x} ${y})">
      <rect width="${w}" height="${h}" rx="10" class="node__box" style="--accent:${accent}"/>
      ${n ? `<circle cx="26" cy="25" r="11" class="node__badge" style="--accent:${accent}"/>
      <text class="node__n" x="26" y="29.5" text-anchor="middle">${n}</text>` : ""}
      <text class="node__t" x="${n ? 46 : 14}" y="${n ? 30 : 34}">${esc(title)}</text>
      <text class="node__s" x="14" y="${n ? 58 : 56}">${esc(sub)}</text>
    </g>`;

  return `<figure class="figure figure--system">
  <svg viewBox="0 0 1120 600" role="img" aria-labelledby="sysdiag-t sysdiag-d" class="diagram">
    <title id="sysdiag-t">How the four modules fit together</title>
    <desc id="sysdiag-d">The solar powerbank feeds the sensor node and, once built, the base-station
      phone. The node reads the water and soil probes over two separate RS485 buses and posts
      readings over WiFi to Node-RED on the phone. The phone pushes batches out over 4G to a small
      cloud service; nothing on the farm accepts an inbound connection. The valve command travels
      back as the reply to a batch.</desc>

    <defs>
      <marker id="arw" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0 0 L10 5 L0 10 z" class="arrowhead"/>
      </marker>
      <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
        <path d="M20 0 L0 0 0 20" fill="none" class="gridline"/>
      </pattern>
    </defs>

    <rect width="1120" height="600" fill="url(#grid)" opacity="0.5"/>

    <g class="zone">
      <rect x="16" y="60" width="484" height="510" rx="14"/>
      <text x="34" y="88">The field</text>
    </g>
    <g class="zone">
      <rect x="560" y="60" width="270" height="510" rx="14"/>
      <text x="578" y="88">The shed</text>
    </g>
    <g class="zone zone--out">
      <rect x="872" y="60" width="232" height="510" rx="14"/>
      <text x="890" y="88">Anywhere</text>
    </g>

    <line x1="852" y1="60" x2="852" y2="570" class="boundary"/>
    <text x="852" y="46" class="boundary__label" text-anchor="middle">no inbound connection exists</text>

    ${box(44, 108, 196, 88, "3", "Solar powerbank", "20 W → 3S2P · ~70 Wh", "#C77C1E")}
    ${box(44, 254, 196, 88, "1", "Water probe", "QDY30A · 9600 8N1", "#2B6E7A")}
    ${box(44, 392, 196, 88, "2", "Soil probe", "THC-S · 4800 8N1", "#4A7A3B")}
    ${box(296, 254, 180, 100, "", "ESP8266 node", "2 buses · 1 radio", "#8A8175")}
    ${box(296, 412, 180, 78, "2", "Relay → valve", "NC = fails shut", "#4A7A3B")}
    ${box(588, 254, 212, 100, "4", "Android phone", "hotspot · Node-RED :1880", "#43587A")}
    ${box(896, 254, 190, 88, "", "farm-ingest", "SQLite · read-only", "#43587A")}

    <g class="wire wire--power">
      <path d="M142 196 V254" marker-end="url(#arw)"/>
      <path d="M142 342 V392" marker-end="url(#arw)"/>
      <path d="M240 152 H386 V254" marker-end="url(#arw)"/>
      <path d="M240 126 H694 V254" marker-end="url(#arw)" stroke-dasharray="6 5" opacity=".65"/>
      <text x="256" y="144" class="wlabel">power</text>
      <text x="440" y="118" class="wlabel wlabel--soft">planned — read the energy budget first</text>
    </g>

    <g class="wire wire--data">
      <path d="M240 298 H296" marker-end="url(#arw)"/>
      <path d="M240 436 H268 V330 H296" marker-end="url(#arw)"/>
      <path d="M386 354 V412" marker-end="url(#arw)"/>
      <text x="246" y="288" class="wlabel">RS485</text>
      <text x="394" y="388" class="wlabel">D2</text>
    </g>

    <g class="wire wire--radio">
      <path d="M476 286 H588" marker-end="url(#arw)"/>
      <path d="M588 322 H476" marker-end="url(#arw)"/>
      <text x="532" y="274" class="wlabel" text-anchor="middle">POST</text>
      <text x="532" y="344" class="wlabel" text-anchor="middle">GET /valve</text>
      <text x="532" y="228" class="wlabel wlabel--soft" text-anchor="middle">WiFi</text>
    </g>

    <g class="wire wire--radio">
      <path d="M800 286 H896" marker-end="url(#arw)"/>
      <path d="M896 322 H800" marker-end="url(#arw)"/>
      <text x="848" y="274" class="wlabel" text-anchor="middle">batches</text>
      <text x="848" y="344" class="wlabel" text-anchor="middle">valve state</text>
      <text x="848" y="228" class="wlabel wlabel--soft" text-anchor="middle">4G, outbound only</text>
    </g>

    <text x="560" y="546" class="caption" text-anchor="middle">
      A failed read still posts, with ok:false — a silent node is indistinguishable from a flat battery.
    </text>
  </svg>
  <figcaption>
    Each module works alone. Together they make one system — and the shape of it is set by two
    constraints: the ESP8266 has exactly five safe GPIOs, and the phone is behind carrier CGNAT,
    so every arrow that leaves the farm points <em>outward</em>. Uplinks carry
    <code>/water</code> and <code>/soil</code>; the valve state rides back on the reply to a batch.
  </figcaption>
</figure>`;
}

/** Per-module wiring diagram, rendered from the same Bus object as the tables. */
export function busDiagram(bus: Bus, accent: string): string {
  const set = teachingPins(bus);
  const rowY = (i: number) => 78 + i * 46;

  const wires = bus.wires
    .map((w, i) => {
      const y = rowY(i);
      return `
      <g class="bw">
        <line x1="146" y1="${y}" x2="404" y2="${y}" style="stroke:${w.hex}"/>
        <circle cx="146" cy="${y}" r="5" style="fill:${w.hex}"/>
        <circle cx="404" cy="${y}" r="5" style="fill:${w.hex}"/>
        <text x="83" y="${y + 4}" text-anchor="middle" class="bw__l">${esc(w.colour)}</text>
        <text x="416" y="${y + 4}" class="bw__r mono">${esc(w.to)}</text>
      </g>`;
    })
    .join("");

  const pins = set.pins
    .map((p, i) => {
      const y = rowY(i);
      return `
      <g class="bw">
        <text x="866" y="${y + 4}" text-anchor="end" class="bw__r mono">${esc(p.pad)}</text>
        <line x1="874" y1="${y}" x2="928" y2="${y}" class="bw__pin"/>
        <text x="940" y="${y + 4}" class="bw__r mono strong">${esc(p.esp)}</text>
      </g>`;
    })
    .join("");

  const rows = Math.max(bus.wires.length, set.pins.length);
  const h = 78 + rows * 46 + 46;
  const boxH = h - 96;

  return `<figure class="figure">
  <svg viewBox="0 0 1010 ${h}" role="img" aria-label="${esc(bus.label)} wiring: probe wires on the left, RS485 module to ESP8266 pins on the right" class="diagram diagram--bus" style="--accent:${accent}">
    <rect x="24" y="52" width="118" height="${boxH}" rx="9" class="node__box"/>
    <text x="83" y="40" text-anchor="middle" class="bw__cap">probe</text>

    <line x1="792" y1="46" x2="792" y2="${52 + boxH}" class="bw__div"/>
    <text x="866" y="40" text-anchor="end" class="bw__cap">HW-0519</text>

    <rect x="928" y="52" width="58" height="${boxH}" rx="9" class="node__box"/>
    <text x="957" y="40" text-anchor="middle" class="bw__cap">ESP</text>

    ${wires}
    ${pins}
    <text x="404" y="${h - 14}" text-anchor="middle" class="caption mono">${bus.baud} ${esc(bus.frame)} · slave ${bus.slave}</text>
    <text x="890" y="${h - 14}" text-anchor="middle" class="caption">${esc(set.label)}</text>
  </svg>
  <figcaption>Drawn from the same pin data as the tables below, so the two cannot disagree. The
  right-hand column is the pin set for <b>${esc(set.label)}</b> — other builds use different pins,
  and they are listed underneath.</figcaption>
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
