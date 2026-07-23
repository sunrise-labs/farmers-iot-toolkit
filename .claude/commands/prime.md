---
description: Prime an agent on farmers-iot-toolkit — what it is, how it's built, and what's in flight.
---

You are being primed on **farmers-iot-toolkit**. Build context by reading the pointers below, then give a tight orientation.

## 1. What this is
An open-source teaching toolkit that shows farmers how to build low-cost IoT sensors on ESP8266 microcontrollers, funded by Float (float.ag) as a discovery proposal (deadline end of July 2026). It's a hardware+docs project, not a running app — the deliverable is four module build-guides (water-tank level, soil-moisture+irrigation valve, solar powerbank, Android Wi-Fi base station), firmware, Node-RED flows, and a website. Built by Sunrise Labs (Mauke, Cook Islands).

## 2. Read these first
- `STATUS.md` — live critical-path tracker; what's bench-proven vs blocked. Read this every session.
- `CLAUDE.md` — repo layout, build commands, and the non-obvious hardware invariants (RS485 buses, DE-pin rules, signed Modbus values).
- `firmware/README.md` — firmware conventions, OTA procedure, why Modbus code is duplicated per sketch.
- `pcb/ATO-HANDOFF.md` + `pcb/DESIGN-BRIEF.md` — the in-progress atopile PCB design and its frozen decisions.
- `hardware/3S2P.md` — source of truth for the battery pack (cells, voltages, charge limits). Every power figure in the repo derives from it.
- `devlog.md` — chronological build journal; the durable record of measurements and hard-won facts.
- `README.md` — the funded proposal / project framing.

## 3. Stack & how to run
Firmware is Arduino C++ (`.ino`) for ESP8266 (NodeMCU 1.0 / ESP-12E), built with `arduino-cli`, no external libraries. Bench tools are TypeScript run with **bun** (never npm/node). Base station is Node-RED flows (JSON). PCB is atopile (`ato` 0.15.7) + KiCad.
```bash
# Firmware — always compile --upload (a bare upload flashes a stale .bin)
arduino-cli compile --upload --fqbn esp8266:esp8266:nodemcuv2 -p /dev/ttyUSB0 firmware/farm-node
# Bench pollers (RS485/Modbus over USB adapter)
bun tools/poll-soil.ts  [device] [--once]     # THC-S soil, 4800 8N1
bun tools/poll-water.ts [device] [--once]     # QDY30A water, 9600 8N1
# Test the base station without hardware
curl -X POST http://<phone-ip>:1880/water -H 'Content-Type: application/json' -d '{"node":"water-tank-1","ok":true,"depth_mm":500}'
# PCB
cd pcb/farm-node-pcb && ato build
```
Each sketch needs a `config.h` copied from `config.example.h` (gitignored); set `BENCH_MODE 1` to skip WiFi and print over serial. This is a Linux machine — Interceptor is unavailable, use agent-browser for web verification.

## 4. Current state — read it live
Run and read:
- `git log --oneline -15`
- `git status -s`
- `STATUS.md` "Module status" + "Critical path to deadline" — the authoritative in-flight list.
- Known in-flight / sharp edges to confirm against STATUS.md (this list drifts — STATUS.md wins):
  - Module ① water probe has an **intermittent** — prime suspect a wire (green/ground); provokable now with a wiggle-test, must fix before anything is soldered into a box. **Still open, and still the sharpest risk.**
  - Module ② valve half unbuilt — **valve-power question unsolved** (12 V solenoid on a pack sagging to 9.0 V; measure coil current first). Narrowed 2026-07-23: pack impedance is only ~53 mΩ, so that sag is state-of-charge, not the solenoid dragging the rail down — don't go hunting for dynamic sag.
  - Module ③ **3S2P battery build in progress** — powers everything, blocks power-testing. Cells now identified (Samsung INR18650-32E) → pack is **~70 Wh, ~38 Wh everyday-usable**, and **charging is rated 0–45 °C only**.
  - Module ④ **base-station phone power is designed but unmeasured.** Phone is an OPPO A3 4G (CPH2669). A 20 W panel can't carry it plugged in 24/7; the design is to duty-cycle the *charger*, not the phone. **Blocked on a 24 h measurement — runnable bench sheet at `docs/bench/03-bench-phone-power.md`** (its Tests 1, 2 and 6 need no special equipment).
  - PCB (`pcb/`): architecture skeleton build-verified offline, but **blocked on atopile's hosted part backend being down** (upstream NXDOMAIN) — see ATO-HANDOFF §7. Re-check whether it's back before assuming.
  - Open decisions: **which backhaul we actually deploy (LoRa gateway vs phone-4G)** — free to decide now, expensive after a solar phone-charging rig is built; how to power module ②'s valve; how to power the phone; website hosting (Float site vs own domain); whether to notify Float of the ultrasonic→pressure-probe change.
- Git: **always commit *and* push** — never leave work sitting unpushed, and don't ask first.

## 5. Then orient me
In ~6 lines: what farmers-iot-toolkit is, its current state, what's in flight, and where the sharp edges are. Don't start work unless asked.
