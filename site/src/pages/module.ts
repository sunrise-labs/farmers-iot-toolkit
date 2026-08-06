import { BUSES, MODULES, POWER, SITE, STATUS, cost, moduleBySlug, type Module } from "../data.ts";
import {
  bomTable,
  busDiagram,
  busTable,
  endpointTable,
  esc,
  faultTable,
  moduleNav,
  pinBudgetTable,
  powerTable,
  statusBadge,
  stepList,
} from "../components.ts";
import { shell } from "../layout.ts";

/** The wiring section differs per module: two have an RS485 bus, one is power, one is a phone. */
function wiring(m: Module): string {
  switch (m.slug) {
    case "water-tank-level-sensor":
      return `${busDiagram(BUSES.water, m.accent)}
        ${busTable(BUSES.water)}
        <p class="fineprint">Both RS485 board variants work and the firmware handles both — but only
        the auto-direction HW-0519 lets Module 1 and Module 2 later share one ESP8266, because the
        classic DE/RE breakout spends an extra GPIO on direction and the budget is only five.</p>`;

    case "soil-moisture-drip-irrigation":
      return `${busDiagram(BUSES.soil, m.accent)}
        ${busTable(BUSES.soil)}
        <h3>The valve side</h3>
        <p>The valve never touches the logic side of the board. It hangs off the relay's switched
        contacts, which are electrically isolated from the ESP8266 — that isolation is exactly why
        12&nbsp;V cannot backfeed your laptop while you bench it. The only way to put valve current
        onto USB is to wire the coil to the ESP's 5&nbsp;V pin. Don't.</p>
        <div class="table-wrap"><table class="wiring">
          <thead><tr><th scope="col">Relay pin</th><th scope="col">Goes to</th><th scope="col">Note</th></tr></thead>
          <tbody>
            <tr><th scope="row" class="mono">VCC</th><td class="mono strong">VBUS</td><td class="note">Not <code>VIN</code> — VIN floats when the board is on USB.</td></tr>
            <tr><th scope="row" class="mono">GND</th><td class="mono strong">GND</td><td class="note">Common ground with the ESP.</td></tr>
            <tr><th scope="row" class="mono">IN</th><td class="mono strong">D2 (GPIO4)</td><td class="note">Or D5 on a classic DE/RE breakout, which takes D2 for direction.</td></tr>
            <tr><th scope="row" class="mono">COM / NO</th><td class="mono strong">valve coil</td><td class="note">NO, so relay unpowered = valve unpowered = valve shut.</td></tr>
          </tbody>
        </table></div>`;

    case "iot-solar-powerbank":
      return `<h3>The power tree</h3>
        <p>Everything hangs off one chain, and the order is not negotiable. Note where the loads tap:
        <b>pack+ / P−</b>, on the protected side of the BMS — never B−.</p>
        <pre class="code code--tree"><code>  ☀ ${POWER.panel.w} W panel · Vmp ${esc(POWER.panel.vmp)} → ${esc(POWER.panel.hot)}
        │
        ▼
  CN3722 MPPT charger        CV pot → 12.6 V · MPPT pot → the HOT Vmp, not the label
        │
        ▼
  3S BMS  (B+ B− P−)         balance taps ascending: 0 → 4.2 → 8.4 → 12.6 V
        │                    ⚠ every load taps pack+ / P−, never B−
        ▼
  3S2P pack · ${esc(POWER.pack.cells)}
  ${esc(POWER.pack.ah)} · ${esc(POWER.pack.wh)} · ${esc(POWER.pack.esr)}     ${esc(POWER.pack.full)} full · ${esc(POWER.pack.nom)} nominal · ${esc(POWER.pack.empty)} near empty
        │                    charge ${esc(POWER.chargeTemp)} · discharge ${esc(POWER.dischargeTemp)}
        │
        ├─[fuse 3 A]─► MT3608 boost ──► 18 V ──► water probe
        ├─[fuse]─────► relay COM/NO ──► solenoid coil
        └─[fuse 2 A]─► 5 V buck ─┬──► ESP8266 VBUS + RS485 VCC
                                 └──► USB socket, D+ ⎯ D− shorted ──► phone</code></pre>
        <h3>The energy budget</h3>
        <p>This is the number that decides whether the system runs forever or dies in a week.
        Compare two figures in watt-hours per day: what the panel collects, and what your devices
        spend. Not what the battery holds — the battery is a bucket, not a tap.</p>
        ${powerTable()}
        <p class="fineprint">Our ~70&nbsp;Wh pack gives 56&nbsp;Wh drained to 80% depth, but that is an
        <em>emergency</em> depth. Cycling that deep daily in tropical heat wears the cells out in a
        year or two, so plan against <b>${esc(POWER.pack.usable)}</b>.</p>`;

    case "mobile-wifi-base-station":
      return `<h3>What the phone answers</h3>
        <p>There is no wiring here beyond a USB cable — the interesting connections are network
        ones. These are the endpoints Node-RED serves once you import the bundled flow.</p>
        ${endpointTable()}
        <h3>Powering it in the field</h3>
        <p>On mains, plug it in and forget it. On solar it is the opposite: a plugged-in phone can
        never enter Android's Doze, so it runs at its awake floor forever and can outrun a 20&nbsp;W
        panel on its own. Switch the <em>charger</em>, not the phone — and charging must be the
        default state, because if the phone is flat and the charger is off, nothing is left to turn
        it back on.</p>`;

    default:
      return "";
  }
}

function related(m: Module): string {
  return `<div class="related">${m.connects
    .map((c) => {
      const t = MODULES.find((x) => x.slug === c.to)!;
      return `<a class="related__i" href="${t.slug}.html"
        style="--accent:${t.accent};--accent-dark:${t.accentDark}">
        <span class="related__n">${t.n}</span>
        <span class="related__t">${esc(t.title)}</span>
        <span class="related__w">${esc(c.why)}</span></a>`;
    })
    .join("")}</div>`;
}

export function modulePage(m: Module): string {
  const c = cost(m);
  const provenSteps = m.steps.filter((s) => s.proven !== false).length;

  const body = `
<article class="mod">
  <header class="mod__hero">
    <div class="mod__rule" aria-hidden="true"></div>
    <p class="mod__kicker"><span class="mod__n">${m.n}</span> Module ${m.n} · ${m.difficulty} · ${esc(m.buildTime)}</p>
    <h1 class="mod__h1">${esc(m.title)}</h1>
    <p class="mod__plain">${esc(m.plain)}</p>

    <div class="mod__status">
      ${statusBadge(m.status)}
      <p>${esc(m.statusLine)}</p>
    </div>

    <dl class="mod__facts">
      <div><dt>Parts</dt><dd>~$${c.total}${c.unknown ? `<span class="tbc">+${c.unknown} TBC</span>` : ""}</dd></div>
      <div><dt>Build time</dt><dd>${esc(m.buildTime)}</dd></div>
      <div><dt>Steps proven</dt><dd>${provenSteps} of ${m.steps.length}</dd></div>
      <div><dt>Board</dt><dd>${m.slug === "mobile-wifi-base-station" ? "Android phone" : m.slug === "iot-solar-powerbank" ? "none — power only" : "ESP8266"}</dd></div>
    </dl>
  </header>

  ${moduleNav(m.slug, "")}

  <section class="mod__sec">
    <h2>Why you would want this</h2>
    <ul class="ticks">${m.why.map((w) => `<li>${w}</li>`).join("")}</ul>
  </section>

  ${
    m.choice
      ? `<section class="mod__sec mod__sec--choice">
      <h2>${esc(m.choice.title)}</h2>
      <p>${m.choice.body}</p>
      ${
        m.choice.table
          ? `<div class="table-wrap"><table class="compare">
        <thead><tr>${m.choice.table.head.map((h) => `<th scope="col">${esc(h)}</th>`).join("")}</tr></thead>
        <tbody>${m.choice.table.rows
          .map(
            (r) =>
              `<tr>${r.map((cell, i) => (i === 0 ? `<th scope="row">${esc(cell)}</th>` : `<td>${esc(cell)}</td>`)).join("")}</tr>`,
          )
          .join("")}</tbody></table></div>`
          : ""
      }
    </section>`
      : ""
  }

  <section class="mod__sec" id="bom">
    <h2>What you will need</h2>
    ${bomTable(m)}
  </section>

  <section class="mod__sec" id="wiring">
    <h2>Wiring</h2>
    ${wiring(m)}
  </section>

  <section class="mod__sec" id="build">
    <h2>Build it, step by step</h2>
    ${
      m.steps.some((s) => s.proven === false)
        ? `<p class="mod__honesty">Some steps below are marked as <b>design, not report</b>. Those are
      worked out and costed, but no hardware has confirmed them yet. We would rather tell you which
      is which than have you find out with a multimeter in your hand.</p>`
        : ""
    }
    ${stepList(m.steps)}
  </section>

  <section class="mod__sec" id="faults">
    <h2>When it doesn't work</h2>
    <p>Ordered roughly by how often it has actually been the answer.</p>
    ${faultTable(m.faults)}
  </section>

  <section class="mod__sec" id="connects">
    <h2>How this fits with the others</h2>
    ${related(m)}
  </section>

  <section class="mod__sec mod__sec--source">
    <h2>The source</h2>
    <ul class="ticks">
      <li><a href="${SITE.repo}/blob/main/${m.docPath}" rel="noopener">Full module document — ${esc(m.docPath)} ↗</a></li>
      ${m.firmware ? `<li><a href="${SITE.repo}/tree/main/${m.firmware}" rel="noopener">Firmware — ${esc(m.firmware)} ↗</a></li>` : ""}
      <li><a href="${SITE.repo}/blob/main/devlog.md" rel="noopener">Build journal, including everything that went wrong ↗</a></li>
      <li><a href="../cheatsheet.html">Full wiring cheatsheet</a></li>
    </ul>
    <p class="fineprint">${esc(STATUS[m.status].note)}</p>
  </section>
</article>`;

  return shell(
    {
      title: `${m.title} — Farmers IoT Toolkit`,
      description: m.plain,
      base: "../",
      accent: m.accent,
      accentDark: m.accentDark,
      bodyClass: "page-module",
    },
    body,
  );
}

export const pages = MODULES.map((m) => ({ path: `modules/${m.slug}.html`, html: modulePage(m) }));
export { moduleBySlug, pinBudgetTable };
