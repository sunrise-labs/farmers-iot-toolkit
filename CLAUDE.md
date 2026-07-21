# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An open-source **teaching toolkit** that shows farmers how to build low-cost IoT sensors on
ESP8266 microcontrollers. Funded by [Float](https://float.ag) as a discovery proposal;
deadline end of July 2026. This is a hardware+docs project, not a conventional software app —
"the deliverable" is the module docs, firmware, flows, and a website, not a running service.

Four modules: ① water-tank level sensor, ② soil moisture + irrigation valve, ③ solar
powerbank, ④ Android Wi-Fi base station (Node-RED). Read `STATUS.md` first on any session —
it's the live critical-path tracker and records what's bench-proven vs blocked.

## Repo layout

- `firmware/` — Arduino sketches (`.ino`), one folder per node. See `firmware/README.md`.
- `tools/*.ts` — TypeScript RS485/Modbus bench pollers, run with **bun** (not the firmware path).
- `flows/*.json` — Node-RED flows for the Module 4 base station, imported into Node-RED.
- `docs/` — the four module build guides + `docs/bench/` bring-up notes; `docs/fritzing parts/`.
- `hardware/` — datasheets (PDFs) and the soil-sensor config tool.
- `devlog.md` — chronological build journal; the durable record of what was learned/measured.
- `STATUS.md` — live status + decisions + open questions. `proposal/` — what Float funded (frozen).

## Commands

### Firmware (arduino-cli, ESP8266 — no libraries)
```bash
arduino-cli core install esp8266:esp8266                                        # once
arduino-cli compile --fqbn esp8266:esp8266:nodemcuv2 firmware/farm-node
arduino-cli compile --upload --fqbn esp8266:esp8266:nodemcuv2 -p /dev/ttyUSB0 firmware/farm-node
```
Always use `compile --upload`. A bare `upload` flashes a **stale** `.bin` already on disk
(cost ~30 min once — see devlog 2026-07-16). Board is NodeMCU 1.0 (ESP-12E). No library
installs — everything ships with the ESP8266 core.

Each sketch needs a `config.h`, copied from its `config.example.h` and edited (holds WiFi
password + per-probe calibration). `config.h` is **gitignored** — when you add a setting,
update `config.example.h` too. Set `BENCH_MODE 1` in config.h to skip WiFi and print readings
over serial (bring sensors up before adding WiFi to the list of things that can be broken).

OTA reflash (WiFi, no cable) works on `farm-node/` only — but the *first* OTA-capable flash
must still go over USB. Full procedure in `firmware/README.md`.

### Bench pollers (bun)
```bash
bun tools/poll-soil.ts  [device] [--once]     # THC-S soil, 4800 8N1
bun tools/poll-water.ts [device] [--once]     # QDY30A water, 9600 8N1
```
Use **bun**, never npm/npx/node. These exist because `mbpoll` reports false "Invalid CRC" on
the cheap FT232RL auto-direction USB-RS485 adapter (it echoes/clips bytes on a shared fd); the
pollers send, read a generous window, resync on a valid frame header, and validate CRC.

### Testing the base station (no hardware needed)
```bash
curl -X POST http://<phone-ip>:1880/water -H 'Content-Type: application/json' \
     -d '{"node":"water-tank-1","ok":true,"depth_mm":500}'
```
Verify the Node-RED endpoint before ever blaming firmware. Every `http in` node needs a paired
`http response` or the ESP blocks until timeout.

## Architecture & non-obvious invariants

**Data path:** each sensor node reads over RS485/Modbus RTU → ESP8266 → **HTTP POST of JSON** to
a Node-RED `http in` node on the Module 4 Android phone. Not MQTT (no broker to run on the
phone; curl-testable). MQTT is the documented upgrade path for downlink/sleeping nodes.

**Failed reads still POST** with `"ok":false` + an `error` field. A silent node is
indistinguishable from dead WiFi/battery; an explicit error says "node alive, probe isn't".

**The base station is found via the gateway, not a hardcoded IP.** Leave `POST_HOST` empty —
the phone running the hotspot *is* the node's gateway. Android randomises the hotspot subnet
(ours came up 10.215.63.x, not the 192.168.43.1 every guide quotes), so a hardcoded IP goes
stale *silently*. Same principle: the node polls `GET /valve` rather than running a server,
because the phone can change the node's IP but the node always knows its gateway.

**Two separate RS485 buses, one transceiver each — never one shared bus.** Both sensors ship as
slave address 1 and run different bauds (soil 4800, water 9600). A second ~$1 transceiver means
one slave + one baud per bus and **zero register writes** to sensors we own exactly one of (a
bad address/baud write can brick comms). Pins are exactly spent: D5/D6 water, D7/D1 soil, D2
valve relay. D3/D4/D8 are boot straps, D0 has no interrupts — there is no sixth safe pin.

**`farm-node/` drives NO DE pin; `water-level/` drives D1 as DE.** The boards are HW-0519
auto-direction (derive TX-enable from TXD). On the combined node D1 is soil's TXD, so driving
it as DE would clamp the soil driver onto the bus and the sensor could never reply. **Never run
`water-level.ino` on a combined node, and never add a DE pin back to `farm-node.ino`.**

**Modbus values are SIGNED int16** (temperature, water level) — sign-extend, don't read as
unsigned (0xFF9B is -10.1 °C, not 65435). Water register 0x0004 = 1 count = 1 mm (ruler-confirmed).

**Two truths, both intentional:** the module docs describe *two independent nodes* (a farmer
must be able to build Module ① alone — better teaching), while Ian's farm runs *one combined
`farm-node`*. Each sensor has its own endpoint, so the flow supports either. Don't "fix" the
docs to match the combined build.

**Modbus CRC/`readRegisters` is duplicated across sketches on purpose** — each module must be
independently buildable (download one `.ino`, flash it, no library-install preamble). The cost
is fixing a Modbus bug twice. The "extract a library" trigger has now fired for *our own* nodes,
but the downloadable module sketches stay self-contained. See `firmware/README.md`.

## Conventions

- **bun/bunx always** for TypeScript tools. Never npm/npx. TypeScript, never Python.
- The **devlog is the durable record** — bench measurements, calibration, and hard-won facts go
  there, not into transient files (`water-calibration.json` is rewritten every poller run).
- The `proposal/` reflects what Float funded and is left frozen even where the build diverged
  (e.g. Module ①: ultrasonic → submersible pressure probe). Record divergences in `STATUS.md`.
- This is a **Linux machine** — Interceptor is unavailable; use agent-browser for web verification.
