# Firmware

Sensor firmware for the Farmers IoT Toolkit. One folder per module, each one a
self-contained Arduino sketch for the **ESP8266 NodeMCU**.

| Folder | Module | Status |
|---|---|---|
| `water-level/` | ① Water tank level (QDY30A pressure probe, RS485) | **Proven on hardware** — reads, POSTs, `200 ok` |
| `farm-node/` | ①+② combined — both sensors on one ESP8266, POSTs each | **Proven on hardware.** What Ian's farm runs |
| `bench-both/` | Bench tool — both sensors, serial only, dumps raw frames on failure | Bench tool, not a deliverable |
| `soil-moisture/` | ② Soil moisture + irrigation valve (THC-S, RS485) | Not started — the *sensor* half is proven in `farm-node/`; this folder is for the standalone module plus the valve logic |

> **`water-level.ino` drives D1 as a DE pin. Do not run it on a combined node** — D1
> is soil's HW-0519 TXD there, and an auto-direction board derives transmit-enable
> from TXD, so a LOW D1 clamps its driver onto the soil bus and the sensor can never
> reply. `farm-node.ino` drives no DE pin at all, which is correct for HW-0519 boards.

## Why our own code (and not Frugal IoT, ESPHome, Tasmota…)

**Decided 2026-07-16.** Get the system fully working with our own code first, so we
understand what a framework would gain or lose us before adopting one. You cannot
judge an abstraction until you've felt the problem it claims to solve. Mitra Ardron
offered to collaborate if we go with [Frugal IoT](https://github.com/mitraardron)
— that door stays open. This is sequencing, not rejection.

There's a second reason that outlives the evaluation: this is a **teaching toolkit**.
The Modbus frame and CRC are hand-rolled in ~60 lines you can read top to bottom, so
when a sensor doesn't answer you can see exactly what went on the wire. A library
that "just works" is worth less here than one you can debug at 6am in a field.

## Why the Modbus code is duplicated between sketches

Deliberate. Each module must be **independently buildable** — a farmer downloads
one sketch, opens it in the Arduino IDE, and flashes it. No library install step, no
"first, clone this repo" preamble. That's worth more than DRY across two sketches.

The tradeoff is real: fix a Modbus bug and you fix it twice. If a third RS485 module
appears, revisit this — a proper Arduino library becomes worth the install step.

**That trigger has now fired** (2026-07-16). `water-level/`, `farm-node/` and
`bench-both/` each carry their own copy of `modbusCRC` and `readRegisters`, and the
resync fix already had to be applied more than once. The decision above still holds for
the *module* sketches a farmer downloads — that's the whole point of them — but the
duplication is now a real maintenance cost rather than a hypothetical one. Worth
revisiting once the field build settles: likely a shared library for our own nodes,
with the module sketches staying self-contained for anyone following the guide.

## Setup

**Board:** Arduino IDE → Boards Manager → `esp8266` → **NodeMCU 1.0 (ESP-12E Module)**
**Libraries:** none. Everything used ships with the ESP8266 core.

```bash
cp water-level/config.example.h water-level/config.h   # then edit it
```

`config.h` is gitignored — it holds your WiFi password and your probe's own
calibration. `config.example.h` is the template; keep it in sync when you add a
setting.

### Building from the command line

```bash
arduino-cli core install esp8266:esp8266     # once
arduino-cli compile --fqbn esp8266:esp8266:nodemcuv2 firmware/water-level
arduino-cli upload  --fqbn esp8266:esp8266:nodemcuv2 -p /dev/ttyUSB0 firmware/water-level
```

## How data reaches the base station

**HTTP POST of JSON** to a Node-RED `http in` node on the Module 4 phone.

```json
{"node":"water-tank-1","ok":true,"raw":169,"depth_mm":143,"percent":47.6,"rssi":-62,"uptime_s":1234}
```

A failed sensor read still POSTs, with `"ok":false` and an `error` field. That's
deliberate — a node that goes silent looks exactly like dead WiFi or a flat battery.
An explicit error says "the node is alive, the probe isn't", which is a different
repair job.

**Why not MQTT?** It would mean running a broker on an Android phone in Termux, and
every extra install step is a place a build dies. `http in` is built into Node-RED
and needs no setup. You can test the endpoint with curl or a browser instead of
needing an MQTT client to debug it. Both sensors are push-only — Module 2's valve
logic is local, so there's no downlink to justify pub/sub.

**When to switch to MQTT:** if you want to send commands *down* to a node (remote
valve control), if nodes start sleeping and need retained messages, or once there are
enough nodes that Node-RED's HTTP endpoints get unwieldy. It's a better protocol for
this class of problem — it just isn't worth its setup cost yet.

## Testing the endpoint before you flash

```bash
curl -X POST http://192.168.43.1:1880/water \
     -H 'Content-Type: application/json' \
     -d '{"node":"test","ok":true,"depth_mm":500}'
```

If that doesn't reach Node-RED, no amount of firmware debugging will help.
