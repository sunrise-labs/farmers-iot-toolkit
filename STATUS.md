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
| ① | Water-tank level sensor (QDY30A RS485) | beginner | **Bench-proven** ✅ — comms, register map, and ruler calibration all confirmed (1 count = 1 mm). Module doc rewritten to the pressure-probe design. **Runs end-to-end on its own hardware** → WiFi → Node-RED (`POST: 200 ok`). Next: field enclosure + real tank. ⚠️ FT232 adapter has an undiagnosed intermittent USB dropout |
| ② | Soil-moisture + auto irrigation valve → drip tape | advanced | Sensor to be **pre-coded now**; deploy/test after battery |
| ③ | Solar IoT powerbank (**3S2P** battery) | medium | **In progress** — finishing the 3S2P battery build |
| ④ | Mobile Wi-Fi base station (Android + Node-RED) | — | ✅ **Done** — and now actually *documented* (`docs/04`), with an importable flow at `flows/water-level-flow.json`. Proven receiving live readings from ① |

## Critical path to deadline

1. **Finish the 3S2P battery build (③).** It's the current blocker — it powers everything, so sensors can't be power-tested until it's done.
2. **Pre-code the sensors (①②③) now, in parallel** — so they're ready to deploy the moment the battery is finalised. This is the parallelisable win; don't wait on the battery to start coding.
3. **Test all sensors off the battery** (integration of power + sensing).
4. **Build the Toolkit website + seed it with the four module docs.** The biggest remaining knowledge-work piece.
5. **Integration demo** — the four modules working together as one system.

## Decisions

- ✅ **Firmware (2026-07-16): our own code first.** Get the system fully working with custom ESP8266 firmware, *then* evaluate Frugal IoT — you can't judge what a framework gains or loses you until you've built the thing and felt the problem it solves. Mitra Ardron's collaboration offer stands if we later adopt it; this is sequencing, not rejection. See `firmware/README.md`.
- ✅ **ESP → base station protocol (2026-07-16): HTTP POST of JSON**, not MQTT. Node-RED's `http in` node is built in and needs no broker on the phone; testable with curl. MQTT is documented as the upgrade path (downlink commands, sleeping nodes). See `firmware/README.md`.

## Open decisions

- **Website hosting:** on the Float site or Ian's own domain? Affects step 4.
- **Tell Float about the module ① sensor change?** Ultrasonic → pressure probe. Deliverable unchanged; see Scope changes above.

## Source

Proposal + impact: `README.md`. Module docs: `docs/`.
