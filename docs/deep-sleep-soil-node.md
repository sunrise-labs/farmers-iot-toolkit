---
# ---- Module Info ----
title: "Deep-Sleep Soil Node (battery-swap variant)"
module_id: null        # variant of Module 2's sensor half, not a fifth module
difficulty: medium
status: testing        # bench-proven 2026-07-28 on a Winbond-flash board; field soak pending

# ---- What It Does (plain language) ----
summary: >
  A soil sensor node that runs for weeks to months on a handful of 18650 cells
  you swap by hand — no solar panel, no charging electronics. It sleeps almost
  all the time, waking every ten minutes to read the soil probe, send one
  reading to the base station over WiFi, and go back to sleep.

# ---- Who Is This For? ----
target_user: "Farmers who want a soil sensor in a spot with no solar rig, and don't mind swapping a battery holder on a schedule."
prior_knowledge: "Build Module 2's sensor half first (or at least its bench steps) — this variant assumes the THC-S + MAX485 wiring already makes sense to you."

# ---- Hardware ----
microcontroller: "ESP8266 (NodeMCU v2/v3)"
sensors:
  - name: "CWT-Soil-THC-S soil sensor (RS485 variant)"
    purpose: "Buried at root depth — reads soil moisture, temperature and EC"
    approx_cost_usd: null

other_parts:
  - name: "MAX485 module (HW-0519 auto-direction, TTL to RS485)"
    quantity: 1
    approx_cost_usd: 2
  - name: "MT3608 boost converter"
    purpose: "Boosts the single Li-ion cell (3.0-4.2V) to the 5V everything here actually needs"
    quantity: 1
    approx_cost_usd: 1
  - name: "1S3P or 1S4P 18650 battery holder + cells"
    purpose: "The whole power system. Two holders means one charges while one runs"
    quantity: 1
    approx_cost_usd: 5
  - name: "Jumper wire or pin header jumper (D0 to RST)"
    purpose: "The deep-sleep wake-up wire — removable, because flashing needs it off"
    quantity: 1
    approx_cost_usd: 0
  - name: "100k resistor (optional, recommended)"
    purpose: "Battery gauge: cell voltage in every reading, so the dashboard warns you before the node dies"
    quantity: 1
    approx_cost_usd: 0
  - name: "AO3400 or 2N7000 N-MOSFET + 100k resistor (optional upgrade)"
    purpose: "Cuts sensor power during sleep — roughly triples battery life"
    quantity: 1
    approx_cost_usd: 0.5

total_approx_cost_usd: null

# ---- Power ----
power_source: "1S3P or 1S4P 18650 holder, manually swapped and recharged. No panel."
power_notes: >
  A single Li-ion cell (4.2V full, ~3.2V empty) is below spec for every part
  here: the THC-S floor is 4.5V, the MAX485 is a 5V part, and the NodeMCU's
  onboard regulator needs ~4.3V+. An MT3608 boost set to 5.0-5.2V fixes all
  three at once and keeps working across the cell's whole discharge. Deep sleep
  is what makes swapping viable: always-on firmware drains a 1S4P in ~4 days;
  this variant runs ~3-4 weeks, or 2-3 months with the FET upgrade.

# ---- Connectivity ----
connects_to: "Mobile WiFi Base Station (Module 4) — same /soil endpoint, no flow changes needed"
protocol: "WiFi (sensor to ESP8266 is RS485 / Modbus RTU)"
---

# Deep-Sleep Soil Node (battery-swap variant)

## Why this variant exists

Module ②'s node stays awake 24/7 because it has a job that needs it: polling the
base station for valve commands every second. That costs ~80 mA continuously,
which is fine on the solar powerbank (Module ③) and hopeless on a battery you
swap by hand — a 1S4P holder lasts about four days.

Drop the valve and the always-on requirement disappears. Soil moisture changes
over hours, not seconds, so a node that wakes every 10 minutes, reads, reports,
and sleeps loses nothing a farmer cares about — and the battery math changes
from *days* to *weeks or months*. That's the trade this variant makes:

|  | `farm-node` / Module ② | This variant |
|---|---|---|
| Valve control | yes (polls every 1 s) | **no — sensor only** |
| Power source | solar powerbank (Module ③) | swappable 18650 holder |
| Awake | always | ~15 s per wake cycle |
| OTA reflash | yes | no (USB only — see gotchas) |
| Battery life | n/a (solar) | weeks–months (table below) |

If you need the valve, build Module ② on the powerbank. If you need a sensor in
a second bed, a far corner, or anywhere a panel isn't worth rigging — build this.

## Spec

| Item | Value |
|---|---|
| Firmware | `firmware/soil-node-sleep/` — self-contained, no libraries |
| MCU | NodeMCU ESP8266 (ESP-12E) |
| Sensor | THC-S over RS485/Modbus, 4800 8N1, address 1, registers 0x0000–0x0002 |
| Transceiver | HW-0519 auto-direction — **no DE pin, ever** |
| Pins | RS485 on **D6 (RX) / D5 (TX)** — same as farm-node's soil bus. **D0→RST** wake jumper. Optional: **D2** sensor-power FET gate, **A0** battery gauge |
| Power | 1S3P/1S4P holder → **MT3608 @ 5.0–5.2 V** → NodeMCU Vin + THC-S brown. MAX485 VCC from the ESP **3V3** pin |
| Cycle | wake → read (5 retries) → join WiFi (25 s cap) → POST JSON → sleep `SLEEP_MINUTES` (default 10, max 60). Measured awake time: **4.2 s** when WiFi joins promptly |
| Reporting | POST to `/soil` on the gateway (= the hotspot phone), same JSON as farm-node plus `vbat`, `sleep_min`, `awake_ms`. Failed reads still POST `"ok":false` |
| Low battery | with the gauge fitted: below 3.30 V it POSTs `"low_battery":true` and sleeps until you swap cells and press reset |

## The battery math

Assumptions: Samsung INR18650-32E cells (3100–3200 mAh each), 10-minute cycle,
~15 s awake at ~80 mA per wake (≈2 mA average; bench-measured 4.2 s on good cycles, so this is conservative), NodeMCU + boost sleep floor
~4 mA, MAX485 idle ~1 mA, THC-S idle ~10–15 mA *when left powered*.

| Build | Average draw | 1S3P (~9.6 Ah) | 1S4P (~12.8 Ah) |
|---|---|---|---|
| Simple (sensor always powered) | ~17–20 mA | **~3 weeks** | **~4 weeks** |
| With the FET upgrade | ~6–7 mA | **~2 months** | **~2.5–3 months** |

Two honest caveats:

- **The sensor's idle draw dominates the simple build and we haven't measured
  ours.** Step 8 below measures it; if your probe idles at 5 mA instead of 15,
  the simple build stretches toward 5–6 weeks.
- The sleep floor is the NodeMCU dev board's own overhead (USB-serial chip,
  regulator, LED) plus the boost converter's no-load draw. A bare ESP-12F would
  sleep at microamps, but that build loses the flash-it-yourself simplicity this
  toolkit is for. Weeks-to-months is the honest number for this board.

⚠️ **A bare holder has no BMS.** Nothing stops these cells from over-discharging
except you (and the firmware cutoff, if you fit the battery gauge — do). Swap on
a schedule, not when the node goes quiet.

## Wiring

```
 1S holder (3P/4P)         MT3608                  NodeMCU
   (+) ─────────────────  IN+  OUT+ ──┬─────────── Vin
   (−) ─────┬───────────  IN−  OUT− ──┼──┬──────── GND
            │   ⚠️ set OUT+ to 5.0–5.2V │  │
            │   with NOTHING connected  │  │
            │   before wiring any loads │  │
            │                           │  │
            │              MAX485 HW-0519  │
            │                VCC ◄── NodeMCU **3V3** pin (NOT the 5 V rail —
            │                GND ◄─────────┘   3.3 V logic into D6, matches farm-node)
            │                RXD ──── D6
            │                TXD ──── D5      (auto-direction — NO DE pin)
            │                A ────── THC-S yellow
            │                B ────── THC-S blue
            │
            │              THC-S
            │                brown (V+) ◄── 5V rail
            └─────────────── black (V−) ─── GND
   
   D0 ──── RST            removable jumper — fit at step 6, NOT before
   (+) ── 100k ── A0      optional battery gauge (step 7)
```

Sensor wire colours are the same as every other soil doc in this toolkit:
**yellow=A, blue=B, brown=V+, black=V−**. If moisture reads garbage or the
probe never answers, A/B swapped is the first suspect.

## Build steps

### 0. Check your board's flash chip — before building anything

Deep sleep has a hardware prerequisite that nothing on the board's silkscreen
tells you: **the flash chip must wake from power-down fast enough for the boot
ROM.** Brand-name flash (Winbond, GigaDevice) does; the anonymous clone flash
on many NodeMCU boards does not — those boards *sleep* fine but never wake (the
reset fires, the boot ROM starts, and it hangs trying to read firmware from a
chip that's still asleep). We lost two days to this; you get to spend one minute:

```bash
python3 ~/.arduino15/packages/esp8266/hardware/esp8266/<ver>/tools/esptool/esptool.py \
    --port /dev/ttyUSB0 flash_id
```

| `Manufacturer:` | Verdict |
|---|---|
| `ef` (Winbond), `c8` (GigaDevice), `20` (XMC) | ✅ build the sleep node on this board — `ef` and `20` both bench-proven here (4/4 and 5/5 self-wakes) |
| anything else (we hit `c4`) | ❌ **don't** — it will zombie on wake. The board is still perfectly good for always-on nodes (Module ② / farm-node); label it and pick another for sleeping. If a vendor isn't listed, run the 1-minute-sleep wake test before trusting it |

If every board you own fails the check, a 100 nF cap from RST to GND *sometimes*
rescues them (it stretches the reset, buying the flash time) — but treat that as
a salvage attempt, not a design. Buy a board with real flash.

### 1. Set the boost voltage — before anything is connected

Wire only the holder to the MT3608's input. Meter on OUT+/OUT−, and adjust to
**5.0–5.2 V**.

⚠️ The pot is a ~25-turn trimmer and the cheap ones slip at the end stops, so it
can feel like turning does nothing (devlog 2026-07-15). Pick one direction and
turn up to ~30 full turns slowly, watching the meter. If OUT equals IN the IC
isn't switching yet — keep turning before concluding it's broken.

### 2. Wire everything except the D0→RST jumper

Per the diagram above. Leave D0 unconnected for now — **flashing fails with the
jumper fitted**. Common ground everywhere: holder −, MT3608 OUT−, NodeMCU GND,
MAX485 GND, THC-S black are all one net.

### 3. Configure and flash in bench mode

```bash
cd firmware/soil-node-sleep
cp config.example.h config.h    # then edit: WiFi credentials, node name
```

`config.example.h` ships with `BENCH_MODE 1` — leave it for now. Flash over USB:

```bash
arduino-cli compile --upload --fqbn esp8266:esp8266:nodemcuv2 \
    -p /dev/ttyUSB0 firmware/soil-node-sleep
```

(Always `compile --upload` — a bare `upload` flashes a stale binary.)

### 4. Prove the probe reads

Serial monitor at 115200. Bench mode prints a reading every 2 s, no WiFi, no
sleep:

```
SOIL   moisture=0.0 %   temp=22.5 C   EC=0
```

Dip the tines in a cup of water — moisture should jump to 80–90 % and snap back
to 0 when you pull it out. If instead you see `SOIL FAILED`: check 5 V on
brown/black at the probe end, then swap A/B.

### 5. Switch to real mode and verify one full cycle — still no jumper

Edit `config.h`: `BENCH_MODE 0`. Reflash (same command). With the hotspot up,
watch one complete cycle on serial:

```
SOIL   moisture=34.2 %   temp=21.8 C   EC=210
WiFi: joining FarmIoT.... ok
  gateway : 10.215.63.55   <- the phone
POST /soil: 200 ok
SLEEP  10 min  (awake 9871 ms)
```

Then — silence. Without the jumper the node sleeps and never wakes, which right
now is exactly what you want: it proves the whole cycle, and the board is still
one `compile --upload` from a config tweak. Check the reading arrived in
Node-RED (it lands on the same `/soil` endpoint as every other soil node; the
extra fields ride along harmlessly).

If the POST fails, test the endpoint from your laptop before blaming firmware:

```bash
curl -X POST http://<phone-ip>:1880/soil -H 'Content-Type: application/json' \
     -d '{"node":"test","ok":true,"moisture_pct":50}'
```

### 6. Fit the D0→RST jumper and watch it wake itself

Press reset once after fitting the jumper. Now leave the serial monitor open
for `SLEEP_MINUTES` + a bit: the node should reappear on its own, read, POST,
and sleep again. That self-wake is the only new thing this step adds, so if it
doesn't happen, the jumper (or D0) is the entire suspect list.

**From here on: pull the jumper before any USB reflash, refit it after.** If an
upload ever hangs at `Connecting...`, the jumper is why.

### 7. (Recommended) fit the battery gauge

One 100 kΩ resistor from **cell +** (holder side, not the 5 V rail) to **A0**.
In `config.h` set `VBAT_ENABLE 1`, reflash (jumper off, remember), and compare
the reported `vbat` against a multimeter on the cell — put the correction ratio
in `VBAT_CAL`.

Now every reading carries the cell voltage, and below 3.30 V the node sends one
final `"low_battery":true` and parks itself until you swap cells and press
reset. In Node-RED, wire a switch node on `msg.payload.vbat < 3.5` to whatever
gets your attention — that's your swap reminder, arriving days before the
cutoff.

### 8. Measure your actual draw, then set your swap schedule

The runtime table above is an estimate; your cells and your probe are the real
numbers. Multimeter in mA range **in series with the holder**, and note two
values: awake (during a cycle) and asleep (between cycles). Then:

```
days ≈ holder mAh ÷ average mA ÷ 24
average mA ≈ asleep_mA + awake_mA × (awake_seconds ÷ cycle_seconds)
```

Set your swap schedule at **~70 % of that** — cells age, WiFi retries happen,
and the last 30 % of a Li-ion's range is where the damage lives. Two holders
make this painless: one in the field, one on the charger, swap on market day.

### 9. (Optional) the FET upgrade — weeks become months

The simple build leaves the THC-S powered through every sleep, and its idle
draw is most of the battery budget. One transistor fixes it:

- **AO3400** (or 2N7000): source → GND, drain → THC-S **black** wire, gate →
  **D2** with a 100 kΩ resistor from gate to GND (so the sensor stays off while
  the ESP boots).
- In `config.h`: `SENSOR_PWR_PIN D2`, reflash.

The firmware now grounds the sensor only while awake, waits `SENSOR_WARMUP_MS`
(default 500 ms) for the probe to settle, reads, and cuts it again before
sleeping. The MAX485 stays permanently powered on purpose — its idle draw is
~1 mA, and switching it off invites parasitic back-powering through the data
pins.

## Gotchas

- **The node sleeps but never wakes → it's almost certainly the flash chip.**
  See step 0. The tell on serial: the wake reset fires on time, you get a burst
  of boot noise, and the sketch never starts — while the reset *button* always
  works (a long press gives the flash time to wake; the ~100 µs D0 pulse
  doesn't). Don't spend time on the jumper, a diode, or the power supply first —
  we did, and it was the flash chip all along (devlog 2026-07-28).
- **Flashing fails with the D0→RST jumper fitted.** D0 actively drives the RST
  line while the chip is awake, fighting the auto-reset circuit — `esptool`
  times out at `Connecting...`. Pull it, flash, refit. This will bite you
  exactly once per forgotten time.
- **A sleeping node can't keep the phone's hotspot alive.** An always-on node
  holds a connection, so Android never sees "no clients". This node is
  disconnected ~95 % of the time — if the phone auto-disables its idle hotspot
  (many do), every wake finds no network. Turn off the hotspot's auto-off /
  timeout setting, and remember the base station phone must itself stay
  charged — a flat phone looks exactly like a broken node from the data's
  point of view.
- **No OTA, on purpose.** The node is awake ~15 s per cycle — too short a window
  to catch for a wireless flash, and firmware listening for OTA is firmware
  burning battery. Reflashing means walking to the node with a cable. Weigh that
  before deploying somewhere painful, and get the config right on the bench.
- **`SLEEP_MINUTES` tops out at 60.** The ESP8266's sleep timer wraps around
  ~71 minutes; the firmware clamps at 60 rather than sleeping a bogus interval.
  For multi-hour cadences you'd chain wakes with an RTC-memory counter — not
  built here, weeks of runtime don't need it.
- **The hotspot must be up when the node wakes.** A dead phone doesn't hurt the
  node (it gives up after `WIFI_TIMEOUT_S` and sleeps on schedule) but the
  readings from those wakes are gone — this node fires and forgets; nothing is
  queued. Gaps in the graph that match the phone being off are not a node fault.
- **Wake timing drifts.** The sleep timer is the ESP's internal RC oscillator —
  expect minutes of drift per day. Irrelevant for soil moisture; just don't
  build anything that assumes wakes land on exact clock times.
- **A silent node is a flat battery until proven otherwise.** With the gauge
  fitted you'll have seen `vbat` sagging for days beforehand — which is the
  argument for fitting it.
