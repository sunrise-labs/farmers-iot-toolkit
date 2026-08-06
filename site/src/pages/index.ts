import { MODULES, SITE, VIDEO } from "../data.ts";
import { esc, moduleCard, systemDiagram, endpointTable, pinBudgetTable } from "../components.ts";
import { shell } from "../layout.ts";

const hero = `
<section class="hero">
  <div class="hero__rule" aria-hidden="true"></div>
  <p class="hero__eyebrow">
    A discovery project funded by <a href="${SITE.funder.url}" rel="noopener">Float</a>,
    implemented by <a href="${SITE.builder.url}" rel="noopener">Sunrise Labs</a>
    <span class="hero__place">${esc(SITE.builder.place)}</span>
  </p>

  <h1 class="hero__h1">Farmers<br>IoT Toolkit</h1>

  <p class="hero__lede">Low-cost farm sensors you build yourself.</p>

  <p class="hero__sub">Four modules, complete parts lists with links, working firmware, and
  build guides that say plainly what is proven and what is not.</p>

  <div class="hero__actions">
    <a class="btn btn--primary" href="#modules">Start with a module</a>
    <a class="btn" href="cheatsheet.html">Wiring cheatsheet</a>
  </div>

  <dl class="hero__facts">
    <div><dt>Modules</dt><dd>4</dd></div>
    <div><dt>Board</dt><dd>ESP8266</dd></div>
    <div><dt>A node costs</dt><dd>under $30</dd></div>
    <div><dt>Licence</dt><dd>Open</dd></div>
  </dl>
</section>`;

const argument = `
<section class="prose prose--wide" id="why">
  <p class="lead">Farms already run on measurement. How much water is in the tank, whether the
  bed needs watering, whether the pump ran last night — every one of those is a number somebody
  walks out to read with their own eyes.</p>

  <p>The technology to read them remotely has been cheap for a decade. What is not cheap is the
  way it is sold: a subscription per sensor, a proprietary gateway, a phone app that stops working
  when a company changes direction, and data about your own soil sitting on somebody else's server.
  For a farm in the Cook Islands, or anywhere the nearest technician is a flight away, that model
  does not just cost money. It fails, and there is nobody to call.</p>

  <p class="pull">A twenty-dollar microcontroller, a probe, and an old phone can do the same job —
  and you can repair it yourself, because you built it.</p>

  <p>So this toolkit is written the other way around. Everything runs on hardware you can buy in
  ones and twos and replace at the market price of the part. The code is yours. The data goes to a
  phone in your own shed. There is no account, no subscription, and no company that can turn it off.</p>

  <h2>What is different about these guides</h2>

  <p>Most build tutorials describe the version that worked. This one records the whole road,
  because the road is where the useful knowledge is. When a design changed — the tank sensor
  moved from ultrasonic to a pressure probe, the soil sensor from a $3 capacitive board to a
  sealed RS485 one, the battery pack from 4S to 3S — the guide explains what was wrong with the
  first answer and how the failure showed itself. Those sections are the most valuable thing here.</p>

  <p>And where we do not yet know, the page says so. The valve half of Module 2 is designed and
  not built. The water probe has an intermittent fault we are still chasing. A page that quietly
  presented those as finished would be worse than useless to somebody standing in a field with a
  multimeter.</p>
</section>`;

const modules = `
<section class="section" id="modules">
  <div class="section__head">
    <h2 class="section__h">The four modules</h2>
    <p class="section__sub">Each one solves a real problem on its own. Build one, or build all
    four and they become a single system. Module 1 is the place to start — it teaches the RS485
    wiring that Module 2 depends on, with nothing that can flood a field if you get it wrong.</p>
  </div>
  <div class="mgrid">${MODULES.map((m) => moduleCard(m)).join("")}</div>
</section>`;

const system = `
<section class="section section--tint" id="system">
  <div class="section__head">
    <h2 class="section__h">How they interact</h2>
    <p class="section__sub">Sensors read over RS485 and post over WiFi to an old Android phone
    running Node-RED. The phone pushes batches out over 4G. Power comes from one solar pack.
    Nothing on the farm accepts an inbound connection.</p>
  </div>

  ${systemDiagram()}

  <div class="cols cols--3">
    <div class="col">
      <h3>Two buses, never one</h3>
      <p>Both probes ship as slave address 1 and run different bauds — 4800 for soil, 9600 for
      water. Sharing one bus would mean writing address <em>and</em> baud registers on sensors we
      own exactly one of each, where a bad write costs you the ability to talk to the thing at all.
      A second one-dollar transceiver deletes both problems and needs zero register writes.</p>
    </div>
    <div class="col">
      <h3>Found by gateway, not by IP</h3>
      <p>The phone running the hotspot <em>is</em> the node's gateway, so the node works out where
      to post by itself. Android randomises the hotspot subnet — ours came up on 10.215.63.55, not
      the 192.168.43.1 every guide quotes — and a hardcoded IP goes stale silently. The node keeps
      reading perfectly and publishes into the void.</p>
    </div>
    <div class="col">
      <h3>Push out, never expose in</h3>
      <p>The phone sits behind carrier CGNAT: there is no port to forward. So it dials out, keeping
      a backlog and re-sending after a dropout. Valve commands ride back as the reply to a batch, so
      you can shut the water off from anywhere without anything on the farm being reachable.</p>
    </div>
  </div>

  <details class="disclose">
    <summary>The endpoints, if you want to build your own dashboard</summary>
    ${endpointTable()}
    <p class="fineprint">Failed reads still POST, with <code>"ok":false</code> and an
    <code>error</code> field. A silent node is indistinguishable from dead WiFi or a flat battery;
    an explicit error says “node alive, probe isn't”.</p>
  </details>

  <details class="disclose">
    <summary>Why the system has this shape: the ESP8266 gives you five pins</summary>
    <p>Everything about the node's layout follows from one constraint. A NodeMCU has exactly five
    GPIOs that are both free and safe, and a combined node spends all five: two per RS485 bus, one
    for the valve relay. There is no sixth. That is why per-row zone valves need a separate
    controller, and it is why the toolkit standardises which pins each module claims — so two
    modules built independently can later share one board without rewiring.</p>
    ${pinBudgetTable()}
  </details>
</section>`;

const video = `
<section class="section" id="video">
  <div class="section__head">
    <h2 class="section__h">The project in six minutes</h2>
    <p class="section__sub">What we built, what it measures, and what it cost — start here if you
    would rather watch than read.</p>
  </div>

  <div class="videowrap">
    ${
      VIDEO.id
        ? `<div class="video" data-video-id="${VIDEO.id}">
             <button class="video__play" type="button" aria-label="Play: ${esc(VIDEO.title)}">
               <span aria-hidden="true">▶</span>
             </button>
             <p class="video__privacy">Nothing loads from YouTube until you press play.</p>
           </div>`
        : `<div class="video video--pending" role="note">
             <p class="video__title">${esc(VIDEO.title)}</p>
             <p class="video__pending">Not filmed yet. Video <em>tutorials</em> were taken out of
             scope in July to protect the build deadline — this is a single overview film, and it
             gets made once the last two open questions are closed. The chapters below are the
             running order.</p>
           </div>`
    }
    <ol class="chapters">
      ${VIDEO.chapters
        .map(
          (c) => `<li><span class="chapters__at mono">${esc(c.at)}</span>
            <span class="chapters__l">${esc(c.label)}</span></li>`,
        )
        .join("")}
    </ol>
  </div>
</section>`;

const cheat = `
<section class="section section--cta" id="cheat">
  <div class="cta">
    <div class="cta__body">
      <h2>The full wiring cheatsheet</h2>
      <p>Every pin, every wire colour, every baud rate and register, the pin budget, the ground
      topology, and a symptom-to-cause table — on one page you can keep open on a phone while
      your hands are busy.</p>
      <p class="cta__note">Printed, it is two pages. That is deliberate.</p>
      <a class="btn btn--primary" href="cheatsheet.html">Open the cheatsheet</a>
    </div>
    <div class="cta__aside">
      <p class="cta__stat"><span>5</span> safe GPIOs</p>
      <p class="cta__stat"><span>2</span> RS485 buses</p>
      <p class="cta__stat"><span>0</span> register writes</p>
    </div>
  </div>
</section>`;

const contribute = `
<section class="section" id="contribute">
  <div class="section__head">
    <h2 class="section__h">Add to it</h2>
    <p class="section__sub">Four modules is a starting set, not a product. A fifth module, a
    correction, a cheaper part that works, a photo of yours in a field — all of it is welcome.</p>
  </div>
  <div class="cols cols--2">
    <div class="col">
      <h3>What would help most right now</h3>
      <ul class="ticks">
        <li>Anyone who has powered a 12&nbsp;V solenoid off a sagging lithium pack — we have an
        open question there and a bench measurement to do.</li>
        <li>A long-run reading of an Android phone's real draw as a plugged-in hotspot.</li>
        <li>Translations. Plain-language build guides are worth more in more languages.</li>
        <li>Photographs from actual installs, especially the ugly ones.</li>
      </ul>
    </div>
    <div class="col">
      <h3>How the project is funded</h3>
      <p>Float selected this as a <em>discovery</em> proposal rather than a full one, so it is being
      developed incrementally and documented as it goes. That framing is why this site shows work in
      progress rather than a finished product — the documenting <em>is</em> the deliverable.</p>
      <p><a class="arrowlink" href="${SITE.repo}" rel="noopener">Source, firmware and flows on GitHub</a></p>
    </div>
  </div>
</section>`;

export const page = shell(
  {
    title: "Farmers IoT Toolkit — low-cost farm sensors you build yourself",
    description: SITE.description,
    base: "",
    bodyClass: "page-home",
  },
  hero + argument + modules + system + video + cheat + contribute,
);
