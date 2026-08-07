import { BUSES, CHEATSHEET_DIAGRAM, MODULES, POWER, SITE } from "../data.ts";
import {
  busTable,
  diagramFigure,
  callout,
  code,
  endpointTable,
  esc,
  faultTable,
  pinBudgetTable,
  powerTable,
} from "../components.ts";
import { shell } from "../layout.ts";

/** Every module's fault table, merged, so one page answers "why isn't it working". */
const allFaults = MODULES.flatMap((m) =>
  m.faults.map((f) => ({ ...f, symptom: `${f.symptom}  ·  ${m.short}` })),
);

const body = `
<article class="sheet">
  <header class="sheet__hero">
    <div class="sheet__rule" aria-hidden="true"></div>
    <p class="sheet__kicker">Reference</p>
    <h1 class="sheet__h1">Wiring cheatsheet</h1>
    <p class="sheet__lede">Every pin, wire colour, baud rate, register and voltage in the toolkit,
    on one page. Written to be read on a phone with a probe in your other hand, and to print onto
    two sheets you can tape inside the enclosure lid.</p>
    <nav class="sheet__toc" aria-label="On this page">
      <a href="#whole">The whole system</a>
      <a href="#pins">Pin budget</a>
      <a href="#buses">The two buses</a>
      <a href="#colours">Wire colours</a>
      <a href="#ground">Grounding</a>
      <a href="#power">Voltages</a>
      <a href="#net">Network</a>
      <a href="#order">Bring-up order</a>
      <a href="#faults">Symptom → cause</a>
    </nav>
  </header>

  <section class="sheet__sec" id="whole">
    <h2>1 · The whole system, in one picture</h2>
    <p>Every module wired the way the farm actually runs. If you only print one thing, print this.</p>
    ${diagramFigure(CHEATSHEET_DIAGRAM, "", "figure--full")}
  </section>

  <section class="sheet__sec" id="pins">
    <h2>2 · The pin budget</h2>
    <p>A NodeMCU 1.0 gives you five GPIOs that are both free and safe, and a combined node spends
    every one of them. There is no sixth. Plan around this before you design anything.</p>
    ${pinBudgetTable()}
    ${callout(
      "note",
      "This is why the toolkit standardises which pins each module claims. Module 2 takes D5/D6 for " +
        "the water bus and D2 for the valve relay; Module 3 takes D5/D6 on its own board. If you ever " +
        "want both probes on one ESP8266, that is the bench build in <code>firmware/bench-both/</code>, " +
        "which moves the soil bus to D7/D1 so the two never collide.",
    )}
    ${callout(
      "danger",
      "<b>A bus has more than one correct pin assignment, and mixing them up gives you two dead " +
        "buses.</b> Ian's deployed <code>farm-node</code> runs water on D7/D1 — swapped relative to " +
        "the standalone Module 2 build — because the board was soldered that way on 2026-07-19 and " +
        "the firmware was made to follow the iron. The flashed binary is always authoritative. Every " +
        "pin table below therefore names the <code>.ino</code> it was read out of; wire the one " +
        "marked <em>wire this one</em> unless you are rebuilding our node specifically.",
    )}
  </section>

  <section class="sheet__sec" id="buses">
    <h2>3 · The two RS485 buses</h2>
    <p>Two separate buses, one transceiver each — never one shared bus. Both probes ship as slave
    address 1 and run different bauds, so sharing would require writing address <em>and</em> baud
    registers on sensors we own exactly one of each. A second one-dollar transceiver deletes both
    problems and needs <b>zero register writes</b>.</p>

    <h3>${esc(BUSES.water.label)}</h3>
    ${busTable(BUSES.water)}

    <h3>${esc(BUSES.soil.label)}</h3>
    ${busTable(BUSES.soil)}

    ${callout(
      "warn",
      "Both values are <b>signed int16</b> where marked. <code>0xFF9B</code> is −10.1 °C, not 65435, " +
        "and a water reading slightly below zero is real and legitimate. Parse into <code>int16_t</code> " +
        "or your first frosty morning produces nonsense.",
    )}
    ${callout(
      "note",
      "Reads are safe; blind writes are not. Reading a register cannot damage a probe. Writing one " +
        "you have not confirmed can land on its slave address or baud rate and cost you the ability " +
        "to talk to the thing at all. Never write a register to “fix” a reading.",
    )}
  </section>

  <section class="sheet__sec" id="colours">
    <h2>4 · Wire colours — the trap</h2>
    <p>The two probes use the same two colours for A and B, and they mean opposite things. Different
    manufacturers, no standard. This is the single easiest wiring mistake in the whole build, and it
    is most likely to catch you on the day you build the second module from muscle memory.</p>

    <div class="trapgrid">
      <div class="trapgrid__c" style="--accent:#2B6E7A">
        <h3>QDY30A — water</h3>
        <p><span class="swatch" style="--swatch:#2B6E7A"></span><b>Blue = A+</b></p>
        <p><span class="swatch" style="--swatch:#D8A521"></span><b>Yellow = B−</b></p>
        <p class="trapgrid__n">Red = 18&nbsp;V, green = ground</p>
      </div>
      <div class="trapgrid__x" aria-hidden="true">≠</div>
      <div class="trapgrid__c" style="--accent:#4A7A3B">
        <h3>THC-S — soil</h3>
        <p><span class="swatch" style="--swatch:#D8A521"></span><b>Yellow = A+</b></p>
        <p><span class="swatch" style="--swatch:#2B6E7A"></span><b>Blue = B−</b></p>
        <p class="trapgrid__n">Brown = 4.5–30&nbsp;V, black = ground</p>
      </div>
    </div>

    ${callout(
      "note",
      "Swapping A and B is <b>harmless</b>. If a probe never answers, swap the two data wires and try " +
        "again before suspecting anything else. The TXD and RXD LEDs on the RS485 board are a free " +
        "logic analyser: TXD flashes when the ESP asks, RXD flashes when the probe answers. TXD only " +
        "means the probe isn't replying.",
    )}
  </section>

  <section class="sheet__sec" id="ground">
    <h2>5 · Grounding — what must be common, and what must not</h2>
    <p><b>One ground per node, and everything on that node shares it.</b> On Module 2 these are all
    the same electrical node:</p>
    ${code(
      "text",
      "probe green (water) ── MT3608 OUT− ── MT3608 IN− ── Mini360 OUT− ── Mini360 IN−\n" +
        "      ── RS485 GND ── ESP GND ── pack P−",
    )}
    <p>The water probe runs on the boosted 18&nbsp;V rail while the ESP runs on 3.3&nbsp;V — two
    supplies, one shared return. <b>Random intermittent failures with wiring that “looks right” are
    usually this.</b> Module 3 has the same rule on a smaller chain: probe black, boost OUT−, boost
    IN−, RS485 GND and ESP GND are one rail, referenced to its own 1S pack.</p>
    <p>The two nodes do <em>not</em> share a ground with each other. They are separate boxes joined
    only by WiFi, which is exactly why a soil probe can sit a hundred metres from the tank.</p>

    <p><b>Deliberately not common:</b> when you bench the valve from a separate 12&nbsp;V mains
    adapter, the solenoid draws through the relay's isolated switched contacts. Its current never
    touches USB and no common ground is wanted between the 12&nbsp;V side and your laptop. That
    isolation is exactly why 12&nbsp;V cannot backfeed the laptop.</p>

    ${callout(
      "danger",
      "Every load taps <b>pack+ / P−</b>, never <b>B−</b>. Tapping B− routes discharge around the BMS " +
        "protection FETs and you lose over-discharge and short-circuit protection <em>silently</em>.",
    )}
  </section>

  <section class="sheet__sec" id="power">
    <h2>6 · Voltages, and what happens if you get them wrong</h2>
    <div class="table-wrap"><table class="wiring">
      <thead><tr><th scope="col">Rail</th><th scope="col">Value</th><th scope="col">Feeds</th><th scope="col">If it's wrong</th></tr></thead>
      <tbody>
        <tr><th scope="row">Panel Vmp</th><td class="mono">${esc(POWER.panel.vmp)}, ${esc(POWER.panel.hot)}</td><td>MPPT input</td><td class="note">Below pack+2 V once hot and the pack charges partway forever, never balances, and quietly dies over a year.</td></tr>
        <tr><th scope="row">Charge CV</th><td class="mono">12.6 V</td><td>the pack</td><td class="note">Charging is rated ${esc(POWER.chargeTemp)} only. A sealed box in tropical sun exceeds that at midday.</td></tr>
        <tr><th scope="row">Pack</th><td class="mono">${esc(POWER.pack.full)} → ${esc(POWER.pack.empty)}</td><td>everything</td><td class="note">${esc(POWER.pack.wh)} stored, ${esc(POWER.pack.usable)} everyday-usable. ESR ${esc(POWER.pack.esr)}, so sag is state-of-charge, not load.</td></tr>
        <tr><th scope="row">Boost</th><td class="mono strong">18.0 V</td><td>water probe red wire <b>only</b></td><td class="note">18 V into the RS485 module or the ESP destroys both. Set it with nothing on the output.</td></tr>
        <tr><th scope="row">Soil probe</th><td class="mono">4.5–30 V</td><td>straight off the pack</td><td class="note">No converter needed — the pack sits inside its input range at every state of charge.</td></tr>
        <tr><th scope="row">Logic</th><td class="mono">3V3</td><td>both RS485 modules</td><td class="note">—</td></tr>
        <tr><th scope="row">Relay</th><td class="mono strong">VBUS</td><td>relay VCC</td><td class="note"><code>VIN</code> floats when the board is on USB: reads ~3.1 V open-circuit, collapses under load. The relay simply won't click.</td></tr>
        <tr><th scope="row">Phone</th><td class="mono">5.15–5.2 V</td><td>USB, D+ shorted to D−</td><td class="note">Unshorted data pins → the phone thinks it's a computer port and takes 500 mA. This failure impersonates a solar problem.</td></tr>
      </tbody>
    </table></div>
    ${powerTable()}
  </section>

  <section class="sheet__sec" id="net">
    <h2>7 · Network</h2>
    ${endpointTable()}
    ${callout(
      "danger",
      "<b>Leave <code>POST_HOST</code> empty.</b> The phone running the hotspot is the node's gateway " +
        "by definition. Android randomises the hotspot subnet — ours came up on <code>10.215.63.55</code>, " +
        "not the <code>192.168.43.1</code> every guide quotes — and a hardcoded IP goes stale silently: " +
        "the node keeps reading perfectly and publishes into the void.",
    )}
    ${callout(
      "warn",
      "Every <code>http in</code> node needs a paired <code>http response</code>, or the ESP blocks " +
        "until timeout and reports a network fault that isn't one.",
    )}
  </section>

  <section class="sheet__sec" id="order">
    <h2>8 · Bring-up order</h2>
    <p>Not arbitrary. A panel has no off switch, and a boost converter set wrong destroys a probe.</p>
    <ol class="numbered">
      <li><b>Cover the panel.</b> Connect the battery through the BMS to the MPPT output, then uncover. Teardown is the reverse — cover and disconnect PV first, then the battery.</li>
      <li><b>Set the MT3608 to 18&nbsp;V with nothing on its output.</b> Meter it. Only then connect the probe's red wire.</li>
      <li><b>Verify one ground</b> with a continuity beep: probe green ↔ ESP GND ↔ P−.</li>
      <li><b>Flash with <code>BENCH_MODE 1</code></b> and prove both probes over serial, before WiFi joins the list of things that can be broken.</li>
      <li>Set <code>BENCH_MODE 0</code>; confirm serial prints a <code>gateway :</code> matching the phone, and <code>POST /water: 200 ok</code>.</li>
      <li><b>Curl the endpoint from a laptop</b> before ever blaming firmware.</li>
      <li><b>Valve last</b>, and only after its pull-in voltage is known.</li>
    </ol>
    ${code(
      "bash",
      "# always compile --upload — a bare `upload` flashes a stale .bin\n" +
        "arduino-cli compile --upload --fqbn esp8266:esp8266:nodemcuv2 -p /dev/ttyUSB0 firmware/farm-node\n\n" +
        "# prove a probe from a laptop, before any ESP8266 exists\n" +
        "bun tools/poll-soil.ts  [device] [--once]     # THC-S, 4800 8N1\n" +
        "bun tools/poll-water.ts [device] [--once]     # QDY30A, 9600 8N1\n\n" +
        "# prove the base station, before blaming firmware\n" +
        "curl -X POST http://<phone-ip>:1880/water -H 'Content-Type: application/json' \\\n" +
        "     -d '{\"node\":\"water-tank-1\",\"ok\":true,\"depth_mm\":500}'",
    )}
    ${callout(
      "warn",
      "Do not use <code>mbpoll</code> with the cheap FT232 USB-RS485 adapter. It reports " +
        "<code>Invalid CRC</code> on every frame while the sensor is perfectly fine — the adapter echoes " +
        "your transmitted bytes back and mbpoll reads and writes on one file descriptor. The bundled " +
        "bun pollers resync on a valid frame header and validate CRC properly.",
    )}
  </section>

  <section class="sheet__sec" id="faults">
    <h2>9 · Symptom → cause</h2>
    <p>Every fault table in the toolkit, merged. If something is not working, start here.</p>
    ${faultTable(allFaults)}
  </section>

  <footer class="sheet__foot">
    <p>Generated from the same data as the module pages — the pin maps come from
    <code>firmware/farm-node/farm-node.ino</code>, the power figures from
    <code>hardware/3S2P.md</code>, and the endpoints from the Node-RED flows. If a table here
    disagrees with the hardware, the hardware is right and this page is a bug:
    <a href="${SITE.repo}/issues" rel="noopener">open an issue</a>.</p>
    <button class="btn" type="button" onclick="window.print()">Print this page</button>
  </footer>
</article>`;

export const page = shell(
  {
    title: "Wiring cheatsheet — Farmers IoT Toolkit",
    description:
      "Every pin, wire colour, baud rate, register and voltage in the Farmers IoT Toolkit, on one " +
      "page — plus the bring-up order and a symptom-to-cause table.",
    base: "",
    bodyClass: "page-sheet",
  },
  body,
);
