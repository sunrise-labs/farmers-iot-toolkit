import { BUSES, MODULES, POWER, SITE, STATUS, cost, moduleBySlug, type Module } from "../data.ts";
import {
  bomTable,
  busTable,
  diagramFigure,
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

/** The wiring detail differs per module: two have an RS485 bus, one is power, one is a phone. */
function wiring(m: Module): string {
  switch (m.slug) {
    case "solar-power-pack":
      return `<p>Everything hangs off one chain: panel → MPPT → BMS → pack → terminal block. The
        order is not negotiable, and neither is where the loads tap — <b>pack+ / P−</b>, on the
        protected side of the BMS, never B−. Tapping B− routes discharge around the protection FETs
        and you lose over-discharge and short-circuit protection silently.</p>
        <p>Set the charger's CV pot to <b>${esc(POWER.pack.full)}</b> and its MPPT pot to the panel's
        <i>hot</i> Vmp (${esc(POWER.panel.hot)}), not the ${esc(POWER.panel.vmp)} on the label. The
        pack sits at ${esc(POWER.pack.full)} full and ${esc(POWER.pack.empty)} near empty, with an
        ESR of ${esc(POWER.pack.esr)} — so voltage sag under load is telling you the state of
        charge, not that something is dragging the rail down.</p>
        <h3>The energy budget</h3>
        <p>This is the number that decides whether the system runs forever or dies in a week.
        Compare two figures in watt-hours per day: what the panel collects, and what your devices
        spend. Not what the battery holds — the battery is a bucket, not a tap.</p>
        ${powerTable()}
        <p class="fineprint">Our ~70&nbsp;Wh pack gives 56&nbsp;Wh drained to 80% depth, but that is an
        <em>emergency</em> depth. Cycling that deep daily in tropical heat wears the cells out in a
        year or two, so plan against <b>${esc(POWER.pack.usable)}</b>. Charging is rated
        ${esc(POWER.chargeTemp)}; discharging ${esc(POWER.dischargeTemp)}.</p>`;

    case "water-tank-and-valve":
      return `${busTable(BUSES.water)}
        <p class="fineprint">Both RS485 board variants work and the firmware handles both — but the
        auto-direction HW-0519 is what leaves D2 free for the valve relay. A classic DE/RE breakout
        spends an extra GPIO on direction, and the budget is only five.</p>
        <h3>The valve side</h3>
        <p>The valve never touches the logic side of the board. It hangs off the relay's switched
        contacts, which are electrically isolated from the ESP8266 — that isolation is exactly why
        12&nbsp;V cannot backfeed your laptop while you bench it. The only way to put valve current
        onto USB is to wire the coil to the ESP's 5&nbsp;V pin. Don't.</p>
        <div class="table-wrap"><table class="wiring">
          <thead><tr><th scope="col">Relay pin</th><th scope="col">Goes to</th><th scope="col">Note</th></tr></thead>
          <tbody>
            <tr><th scope="row" class="mono">VCC</th><td class="mono strong">5 V</td><td class="note">From the Mini360 — or <code>VBUS</code> if you are on USB. Never <code>VIN</code>, which floats.</td></tr>
            <tr><th scope="row" class="mono">GND</th><td class="mono strong">GND</td><td class="note">Common ground with the ESP.</td></tr>
            <tr><th scope="row" class="mono">IN</th><td class="mono strong">D2 (GPIO4)</td><td class="note">The one safe pin left once the bus has taken D5 and D6.</td></tr>
            <tr><th scope="row" class="mono">COM / NO</th><td class="mono strong">valve coil</td><td class="note">NO, so relay unpowered = valve unpowered = valve shut.</td></tr>
          </tbody>
        </table></div>`;

    case "soil-moisture-sensor":
      return `${busTable(BUSES.soil)}
        <h3>The node's own power</h3>
        <p>Four 18650s in parallel is a single cell electrically — ~3.7&nbsp;V nominal, 4.2&nbsp;V
        full, four times the capacity, and no balancing to do because parallel cells balance
        themselves. The MT3608 lifts that to a steady 5&nbsp;V for the ESP8266, the RS485 board and
        the probe, which is happy anywhere from 4.5 to 30&nbsp;V.</p>
        <p>The reason this module carries its own pack rather than tapping Module 1 is placement: a
        soil probe belongs in the middle of a bed, and a bed is rarely where the panel is. The node
        sleeps between readings, so four cells carry it a long way.</p>`;

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
      <div><dt>Board</dt><dd>${m.slug === "mobile-wifi-base-station" ? "Android phone" : m.slug === "solar-power-pack" ? "none — power only" : "ESP8266"}</dd></div>
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

  <section class="mod__sec" id="diagram">
    <h2>How it goes together</h2>
    ${diagramFigure(m.diagram, "../")}
  </section>

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
