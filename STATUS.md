# Farmers IoT Toolkit — Status & Critical Path

> Live delivery tracker. **Funder:** Float. **Deadline:** end of July 2026 (~3 weeks from 2026-07-10). Project scope/impact detail lives in `README.md` (the funded proposal).

## Scope changes

### 2026-07-10 — video tutorials dropped
- **Video tutorials are NO LONGER in scope.** Revised deliverable = the **Toolkit website** + **four documented modules** (BOM + purchase links, build/config guide, source code) + **integration demo** + **contribution framework**. (Removing video production is a meaningful de-risk with 3 weeks left.)

### 2026-07-16 — module ① sensor changed: ultrasonic → submersible pressure probe
- The proposal specifies *"a water tank level sensor using **ultrasonic detection**"*. We built a **QDY30A submersible hydrostatic pressure probe (RS485)** on an ESP8266 instead, and it is now bench-proven.
- **Why:** a tank is an enclosed cylinder full of reflective surfaces with a moving surface — the worst case for an echo-based sensor (false returns off walls, ripples, foam, condensation on the sensor face). A pressure probe ignores all of it because it sits under the water rather than looking at it. Cost: needs 12–36 V (MT3608 boost) and speaks RS485 rather than two GPIO pins.
- The deliverable is unchanged — a beginner-level water tank level sensor — so this reads as an implementation improvement, not a scope reduction. **`proposal/README.md` is left as-written** (it's the record of what Float funded, not a live spec). ⚠️ **Worth a line to Float** so the divergence is theirs to hear from us first.

## Module status

| # | Module | Level | Status |
|---|--------|-------|--------|
| ① | Water-tank level sensor (QDY30A RS485) | beginner | **Bench-proven** ✅ — comms, register map, and ruler calibration all confirmed (1 count = 1 mm). Module doc rewritten to the pressure-probe design. Runs end-to-end → WiFi → Node-RED (`POST: 200 ok`). ✅ **BLOCKER CLEARED 2026-08-07 — the intermittent was a dying HW-0519 transceiver**, not a wire. It kept transmitting (TX LED blinking throughout) while its receive path degraded, which is why every symptom pointed downstream of it. Eliminated by measurement: 18 V held at the probe *during* the failure, A/B read 9.16 kΩ (cable and probe receiver both good), `RXD`→D7 continuous. Swapped for the spare → both LEDs flash, probe replies. Field build flashed. Next: soak, then seal |
| ② | Soil-moisture + auto irrigation valve → drip tape | advanced | **Sensor half done** ✅ — THC-S reads on the ESP8266 and POSTs to Node-RED (`firmware/farm-node/`). Module doc rewritten from the stale capacitive-v1.2/ESP32 design to THC-S RS485/ESP8266. Remaining: relay + valve + safety cutoff, and ⚠️ **the valve power question is unsolved** — a 12 V solenoid on a pack that sags to 9.0 V may not pull in; options are a separate 12 V supply, an MT3608 (0.5–1 A inrush vs 2 A ceiling), or a latching valve. Measure the coil current before choosing |
| ③ | Solar IoT powerbank (**3S2P** battery) | medium | **In progress** — finishing the 3S2P battery build |
| ④ | Mobile Wi-Fi base station (Android + Node-RED) | — | ✅ **Done** — and now actually *documented* (`docs/04`), with an importable flow at `flows/water-level-flow.json`. Proven receiving live readings from ① |

## Critical path to deadline

1. ~~**Find the water probe's intermittent (①).**~~ — **done** ✅ (2026-08-07). A dying HW-0519 transceiver, not a wire; swapped and the node runs. ⚠️ **This does *not* close the FT232 USB dropout** — the "one fault, two costumes" theory died when 18 V measured stable at the probe during a failure. Treat the FT232 as open and unexplained. Remaining here: an hour's soak at 60 s reporting before anything is sealed into a box, and re-read `DRY_OFFSET_COUNTS` in air (the 26 was measured through the failing transceiver).
2. **Finish the 3S2P battery build (③).** It powers everything, so nothing gets power-tested until it's done.
3. ~~Pre-code the sensors~~ — **done** ✅. Both sensors read and POST to Node-RED (`firmware/farm-node/`). What remains is module ②'s valve half (relay, safety cutoff, and the unsolved valve-power question).
4. **Test all sensors off the battery** (integration of power + sensing). **Includes the base-station phone**: a 24 h inline-USB-meter measurement of the OPPO A3 is the input to every power decision below — see `devlog.md` 2026-07-22 for the measurement plan.
5. ~~**Build the Toolkit website + seed it with the four module docs.**~~ — **done** ✅ (`site/`, 2026-08-05; restructured 2026-08-06). Seven static pages: hero + modules overview + full wiring cheatsheet + four module deep-dives (photo, BOM with buy links, wiring tables, step-by-step) + a branded 404. Zero dependencies, self-hosted fonts, **no third-party request of any kind** — verified by loading every page and reading `performance.getEntriesByType('resource')`. **Every pin table, bus parameter, BOM row and cross-link renders from `site/src/data.ts`**, so the site cannot drift from the firmware the way the prose did (see below). GitHub Pages deploy is wired at `.github/workflows/pages.yml` and waits only on Settings → Pages → Source: GitHub Actions. Remaining: fill the two `TBC` probe prices, record the overview video (`VIDEO.id` is a slot), and decide hosting.

### 2026-08-06 — site modules renumbered to match the build, and the generated SVGs replaced by photos
- **The four modules are now ① Power ② Water + valve ③ Soil ④ Phone** (was water / soil+valve / power / phone). This is build order and it matches how the farm is actually wired: the valve lives on the **water** node because that is where the tank is, and the soil probe is its own deep-sleep node on a 1S4P pack. The `docs/0N-*.md` filenames keep their old numbering; `docPath` in `site/src/data.ts` maps between them, so nothing in `docs/` had to move.
- **The generated SVG wiring diagrams are gone**, replaced by photographs of the real build (`docs/wiring-diagram-module-*.jpg`, `docs/wiring-cheatsheet-full.jpg` → web-sized into `site/assets/img/`). A farmer matching a picture to the parts in their hand is doing something a schematic cannot help with. The pin/register **tables** are still generated from `data.ts` and are still the authority.
- ⚠️ **`docs/01`–`docs/04` now disagree with the site's module numbering and with where the valve lives.** The site is correct. Propagating the renumber into the prose docs is outstanding.
6. **Integration demo** — the four modules working together as one system.

## Decisions

- ✅ **Firmware (2026-07-16): our own code first.** Get the system fully working with custom ESP8266 firmware, *then* evaluate Frugal IoT — you can't judge what a framework gains or loses you until you've built the thing and felt the problem it solves. Mitra Ardron's collaboration offer stands if we later adopt it; this is sequencing, not rejection. See `firmware/README.md`.
- ✅ **ESP → base station protocol (2026-07-16): HTTP POST of JSON**, not MQTT. Node-RED's `http in` node is built in and needs no broker on the phone; testable with curl. MQTT is documented as the upgrade path (downlink commands, sleeping nodes). See `firmware/README.md`.
- ✅ **Two RS485 buses, not one shared bus (2026-07-16).** Both sensors ship as slave address 1 and run different bauds (soil 4800, water 9600). Sharing one bus would need address *and* baud register writes on sensors we own exactly one of each — where a bad write costs you the ability to talk to the thing at all. A second transceiver (~$1) deletes both problems: one slave per bus, one baud per SoftwareSerial instance, zero writes. Pins: D5/D6 water, D7/D1 soil, D2 relay — all five safe pins spent. See `firmware/farm-node/`.
- ✅ **Ian's farm runs ONE combined node (2026-07-16)** — both sensors on one ESP8266, one enclosure, one battery. The **module docs still describe two independent nodes**, deliberately: a farmer must be able to build Module ① alone, and that's the better teaching story. Both are true and the flow supports either — each sensor has its own endpoint, so nothing cares where the POST came from.

## Decisions (cont.)

- ✅ **Remote access (2026-08-01): push out, don't expose in.** The base-station phone is behind carrier CGNAT — no inbound port exists. Rather than tunnelling in, Node-RED buffers every reading and POSTs it in batches to **`farm-ingest`** on the hetzner VPS (`server/`, live at `https://farm.sunriselabs.io`). Store-and-forward with a `client_id` dedupe key, so a 4G dropout costs latency and never data. Nothing on the farm is reachable from the internet; a tunnel (Tailscale) stays the answer for *editing flows*, not for telemetry. See `server/README.md`.
- ✅ **Valve downlink rides on the ingest response (2026-08-01).** The cloud dashboard can open/shut the master valve without anything being reachable on the farm: each batch POST is answered with the desired state, the phone applies it on the **edge of a `seq`** (never re-asserted, so the local page's buttons still work offline), and the ESP picks it up on its next 1 s poll. Latency is one reporting interval + one poll. Open commands expire server-side (`FARM_VALVE_TTL_S`, default 30 min) and fail closed. ✅ **`VALVE_MAX_OPEN_S` set to 1800 s (2026-08-05)** — the server expiry cannot help if the *link* drops (a failed poll deliberately holds the last state, so open + dead hotspot = open forever). The node-side timer is the only guard that runs when the node is alone; it now mirrors the server's 30 min ceiling. `config.example.h` defaults to 1800 too, so a farmer opts *out* of the guard rather than into it.
- ✅ **Dashboard is per-node (2026-08-01).** One card per reporting node, so `soil-bed-2`/`-3` appear by reporting rather than by a code edit. Staleness is learned per node (3× its own median gap) because the deep-sleep node's cadence is nothing like `farm-node`'s.
- ⚠️ **Found while building it: Android freezes Node-RED's timers when the phone dozes.** A 30 s repeating `inject` stops firing with no error and the flow still looks healthy. The push is therefore **event-driven** — each arriving reading triggers the drain, because the incoming request has already woken the phone — with the inject kept only as a backstop. Anything else in these flows that relies on a timer is suspect. Wake-lock is still required.

- ✅ **`farm-node` is water + valve only.** Flagged off 2026-08-03 (`ENABLE_SOIL 0`); the soil code was **deleted outright on 2026-08-05** now that the probe is permanently on its own deep-sleep node. The combined sketch had kept reading a bus with nothing on it and POSTing `{"node":"soil-bed-1","ok":false}` every cycle — **under the same node name as the real soil-bed-1**, so two devices published into one identity. That is what produced the "90 % soil-bed-1 fault rate" on 2026-08-01: a probe that was not connected. A flag defaulting to *on* left that trap one stale `config.h` away from returning, so it's gone. The valve's pin state rides on the `/water` payload — it used to be reported *only* in the soil message. **Nothing about the module docs changes:** no doc ever pointed a farmer at `farm-node/`, and the one-ESP-two-buses build is still demonstrated in `firmware/bench-both/`.

## Open decisions

- **Website hosting:** on the Float site or Ian's own domain? The build is deliberately host-agnostic — `site/dist/` is relative-linked static HTML with a `.nojekyll`, so it drops onto GitHub Pages, the hetzner box, or inside Float's site unchanged. Deciding late costs nothing.
- **Tell Float about the module ① sensor change?** Ultrasonic → pressure probe. Deliverable unchanged; see Scope changes above.
- **How to power the base-station phone in the field (③ + ④).** Phone is an **OPPO A3 4G (CPH2669)** — 5100 mAh (~19.4 Wh), Android 14. **A 20 W panel cannot carry it plugged in 24/7** (est. 20–57 Wh/day at the pack vs 50–60 Wh clear / 6–15 Wh overcast → ~0.6–1.5 days autonomy on the ~38 Wh everyday-usable pack). Recommended: **duty-cycle the charger, not the phone** — Tier 1 a $3 pack-voltage hysteresis relay (ON 12.3 V / OFF 11.6 V), Tier 2 phone-commanded 60–80 % SoC band **defaulting to charging**, Tier 3 a second panel. Also needs a bigger buck than the Mini360 and **D+/D− shorted** or the phone caps at 500 mA. Design + wiring gotchas written into `docs/03` and `docs/04`; **blocked on measurement — bench sheet ready at `docs/bench/03-bench-phone-power.md`** (critical path #4). Tests 1 & 2 need no equipment beyond the phone and can run tonight. ✅ Cell capacity resolved 2026-07-23 (Samsung INR18650-32E, 3200 mAh → pack is ~70 Wh, not the ~55 Wh assumed).
- **Which backhaul variant are we actually deploying?** PCB decision A2 keeps both LoRa-gateway and phone-4G. **If the node talks LoRa, the phone can sit in the shed on mains and this whole power problem disappears.** Free to decide now, expensive after a solar phone-charging rig is built and documented.
- **How to power module ②'s valve.** A 12 V solenoid on a pack that sags to 9.0 V may not pull in — and the failure is silent and load-dependent (works on a full battery, quietly stops on a low one, looks exactly like a sensor fault). Separate 12 V supply, MT3608 boost, or a latching valve? **Measure the coil current before choosing.** Bench module ② on a mains 12 V adapter until this is settled; see `docs/02`.

## Found while building the website (2026-08-05)

- ⚠️ **A bus has more than one correct pin assignment, and the docs were flattening them into one.**
  `firmware/water-level/` (standalone Module ①) is **D5 RX / D6 TX / D1 DE**; the deployed
  `firmware/farm-node/` is **D7 RX / D1 TX**; `firmware/soil-node-sleep/` is **D6 RX / D5 TX**;
  `firmware/bench-both/` is water D5/D6 + soil D7/D1. All four are correct *for their own sketch*.
  The site now models this explicitly — every pin set names the `.ino` it was read out of, and the
  one a farmer should wire is flagged. This is the same class of failure as
  `docs/deployment-wiring.md` §9, and it is worth propagating the fix back into `docs/01`–`docs/02`.

## Source

Proposal + impact: `README.md`. Module docs: `docs/`.
