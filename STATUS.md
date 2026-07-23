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
| ① | Water-tank level sensor (QDY30A RS485) | beginner | **Bench-proven** ✅ — comms, register map, and ruler calibration all confirmed (1 count = 1 mm). Module doc rewritten to the pressure-probe design. Runs end-to-end → WiFi → Node-RED (`POST: 200 ok`). ⚠️ **BLOCKER: the probe has an intermittent** — silent, then reading, then silent again on identical code and wiring. Firmware, radio, boost and A/B all eliminated by test; it's a wire, prime suspect green/ground. Same suspect as the open FT232 dropout — likely one fault, two costumes. Next: wiggle-test to localise, then solder |
| ② | Soil-moisture + auto irrigation valve → drip tape | advanced | **Sensor half done** ✅ — THC-S reads on the ESP8266 and POSTs to Node-RED (`firmware/farm-node/`). Module doc rewritten from the stale capacitive-v1.2/ESP32 design to THC-S RS485/ESP8266. Remaining: relay + valve + safety cutoff, and ⚠️ **the valve power question is unsolved** — a 12 V solenoid on a pack that sags to 9.0 V may not pull in; options are a separate 12 V supply, an MT3608 (0.5–1 A inrush vs 2 A ceiling), or a latching valve. Measure the coil current before choosing |
| ③ | Solar IoT powerbank (**3S2P** battery) | medium | **In progress** — finishing the 3S2P battery build |
| ④ | Mobile Wi-Fi base station (Android + Node-RED) | — | ✅ **Done** — and now actually *documented* (`docs/04`), with an importable flow at `flows/water-level-flow.json`. Proven receiving live readings from ① |

## Critical path to deadline

1. **Find the water probe's intermittent (①).** Newly the sharpest risk: it's a wire, it's provokable *right now*, and it stops being findable the moment anything is soldered into a box. Wiggle-test each wire while the node polls, localise, fix. Likely also closes the open FT232 dropout.
2. **Finish the 3S2P battery build (③).** It powers everything, so nothing gets power-tested until it's done.
3. ~~Pre-code the sensors~~ — **done** ✅. Both sensors read and POST to Node-RED (`firmware/farm-node/`). What remains is module ②'s valve half (relay, safety cutoff, and the unsolved valve-power question).
4. **Test all sensors off the battery** (integration of power + sensing). **Includes the base-station phone**: a 24 h inline-USB-meter measurement of the OPPO A3 is the input to every power decision below — see `devlog.md` 2026-07-22 for the measurement plan.
5. **Build the Toolkit website + seed it with the four module docs.** The biggest remaining knowledge-work piece.
6. **Integration demo** — the four modules working together as one system.

## Decisions

- ✅ **Firmware (2026-07-16): our own code first.** Get the system fully working with custom ESP8266 firmware, *then* evaluate Frugal IoT — you can't judge what a framework gains or loses you until you've built the thing and felt the problem it solves. Mitra Ardron's collaboration offer stands if we later adopt it; this is sequencing, not rejection. See `firmware/README.md`.
- ✅ **ESP → base station protocol (2026-07-16): HTTP POST of JSON**, not MQTT. Node-RED's `http in` node is built in and needs no broker on the phone; testable with curl. MQTT is documented as the upgrade path (downlink commands, sleeping nodes). See `firmware/README.md`.
- ✅ **Two RS485 buses, not one shared bus (2026-07-16).** Both sensors ship as slave address 1 and run different bauds (soil 4800, water 9600). Sharing one bus would need address *and* baud register writes on sensors we own exactly one of each — where a bad write costs you the ability to talk to the thing at all. A second transceiver (~$1) deletes both problems: one slave per bus, one baud per SoftwareSerial instance, zero writes. Pins: D5/D6 water, D7/D1 soil, D2 relay — all five safe pins spent. See `firmware/farm-node/`.
- ✅ **Ian's farm runs ONE combined node (2026-07-16)** — both sensors on one ESP8266, one enclosure, one battery. The **module docs still describe two independent nodes**, deliberately: a farmer must be able to build Module ① alone, and that's the better teaching story. Both are true and the flow supports either — each sensor has its own endpoint, so nothing cares where the POST came from.

## Open decisions

- **Website hosting:** on the Float site or Ian's own domain? Affects step 5.
- **Tell Float about the module ① sensor change?** Ultrasonic → pressure probe. Deliverable unchanged; see Scope changes above.
- **How to power the base-station phone in the field (③ + ④).** Phone is an **OPPO A3 4G (CPH2669)** — 5100 mAh (~19.4 Wh), Android 14. **A 20 W panel cannot carry it plugged in 24/7** (est. 20–57 Wh/day at the pack vs 50–60 Wh clear / 6–15 Wh overcast → ~0.6–1.5 days autonomy on the ~38 Wh everyday-usable pack). Recommended: **duty-cycle the charger, not the phone** — Tier 1 a $3 pack-voltage hysteresis relay (ON 12.3 V / OFF 11.6 V), Tier 2 phone-commanded 60–80 % SoC band **defaulting to charging**, Tier 3 a second panel. Also needs a bigger buck than the Mini360 and **D+/D− shorted** or the phone caps at 500 mA. Design + wiring gotchas written into `docs/03` and `docs/04`; **blocked on measurement — bench sheet ready at `docs/bench/03-bench-phone-power.md`** (critical path #4). Tests 1 & 2 need no equipment beyond the phone and can run tonight. ✅ Cell capacity resolved 2026-07-23 (Samsung INR18650-32E, 3200 mAh → pack is ~70 Wh, not the ~55 Wh assumed).
- **Which backhaul variant are we actually deploying?** PCB decision A2 keeps both LoRa-gateway and phone-4G. **If the node talks LoRa, the phone can sit in the shed on mains and this whole power problem disappears.** Free to decide now, expensive after a solar phone-charging rig is built and documented.
- **How to power module ②'s valve.** A 12 V solenoid on a pack that sags to 9.0 V may not pull in — and the failure is silent and load-dependent (works on a full battery, quietly stops on a low one, looks exactly like a sensor fault). Separate 12 V supply, MT3608 boost, or a latching valve? **Measure the coil current before choosing.** Bench module ② on a mains 12 V adapter until this is settled; see `docs/02`.

## Source

Proposal + impact: `README.md`. Module docs: `docs/`.
