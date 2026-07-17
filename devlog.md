# Devlog — Farmers IoT Toolkit

Running log of decisions, gotchas, and dead-ends found during development. Newest
entries at the top. The point is to save future-us (and anyone else building this
rig) the hours we burned the first time.

Format per entry: date, what we were doing, what bit us, and what actually worked.

---

## 2026-07-16 — END TO END: probe → ESP8266 → WiFi → Node-RED on the phone

```
WiFi: connecting to FarmIoT....... ok
  my ip   : 10.215.63.141
  gateway : 10.215.63.55
  rssi    : -49 dBm
raw=153  depth=127 mm
{"node":"water-tank-1","ok":true,"raw":153,"depth_mm":127,"rssi":-49,"uptime_s":6}
POST: 200 ok
```
Modules ① and ④ talking, our own code, real hardware. Backbone of the integration demo.

### ⚠️ GOTCHA: the Android hotspot IP is NOT 192.168.43.1
Every guide says it is. **Ours came up on `10.215.63.55`.** Modern Android randomises
the hotspot subnet, and it can reshuffle on any hotspot restart or reboot.

First POST attempt failed with `-1` (couldn't open a socket) against the hardcoded
`192.168.43.1` from the docs. **The `gateway :` line printed on connect — added maybe
an hour earlier — diagnosed it instantly.**

**Fix: derive the URL from `WiFi.gatewayIP()` at runtime.** The phone running the
hotspot IS the node's gateway, by definition, so the address can't go stale. Leave
`POST_URL` empty in config and the node finds the base station by itself; set it only
to override (a real server on a LAN). **Verified on hardware with no IP configured
anywhere: `POST: 200 ok`.**

Worth dwelling on the failure mode this kills: a hardcoded IP goes stale *silently*.
The node keeps reading the sensor perfectly, publishes happily into the void, and
nothing anywhere reports an error. Every node in the field stops reporting and the
only symptom is absence. Deriving it deletes the whole class — and a farmer never has
to find an IP address, which is the better toolkit anyway.

### Fixed: RSSI sentinel published as data
Disconnected, `WiFi.RSSI()` returns a sentinel (we saw **31**) that looks exactly like
a plausible reading, and we were publishing it. Now only included when the link is
actually up. Publishing a sentinel as data is the same sin as reporting a wrong depth.

### Notes
- Laptop scanning: this box runs **iwd**, not NetworkManager — `nmcli` silently returns
  nothing. `iw dev wlan0 scan` works. That scan confirmed FarmIoT was on 2412 MHz
  (channel 1, 2.4 GHz), ruling out the classic ESP8266 killer of a 5 GHz-only hotspot.
- Config permutations verified to build: auto-derive + WiFi, auto-derive + bench,
  explicit override, and a **legacy config.h with no POST_PORT/POST_PATH** (`#ifndef`
  fallbacks cover it, so nobody's existing config breaks).
- `docs/04` Termux/Node-RED/flow steps were all `(to be added)` placeholders despite
  module ④ being marked Done — written up now, plus `flows/water-level-flow.json`.

---

## 2026-07-16 — Module ① runs on its own hardware: ESP8266 reads the probe

First reading off the ESP8266, no laptop in the chain:
```
raw=153  depth=127 mm
{"node":"water-tank-1","ok":true,"raw":153,"depth_mm":127,"uptime_s":2}
```
Whole chain proven: ESP8266 → HW-0519 → RS485 → QDY30A → back, CRC-valid, with the
ruler-test scaling and dry offset applied. Firmware: `firmware/water-level/`.

### ⚠️ GOTCHA: the MAX485 listing ships TWO different boards
`hardware.md`'s RS485 module link delivered an **HW-0519 auto-direction** board, not
the classic breakout every guide (including ours) assumes. **It has no DE or RE pin**
— a 74HC04D inverter derives transmit-enable from the TXD line itself.

| | Classic breakout | HW-0519 (what we got) |
|---|---|---|
| Spot it | has DE + RE pins | no DE/RE; silkscreen `HW-0519`; extra 14-pin 74HC04D |
| TTL pins | RO, RE, DE, DI, VCC, GND | GND, RXD, TXD, VCC |
| RS485 pins | A, B | A+, B−, 接大地 (earth/shield) |
| Direction | you drive DE/RE from a GPIO | the board does it |

Wiring for the HW-0519: `RXD→D5`, `TXD→D6`, `VCC→3V3`, `GND→GND`. **D1 unused** (the
firmware still toggles it as DE — harmless, it wiggles a disconnected pin). `接大地`
= "connect to earth", the cable shield terminal for long field runs; leave it floating.
Docs updated to cover both variants.

**The TXD/RXD LEDs are a free logic analyser.** TXD flashes on ask, RXD on answer.
Neither = ESP isn't reaching the module. TXD only = sensor not replying, swap A/B.

### ⚠️ GOTCHA: NodeMCU VIN is NOT USB 5V — use VBUS
Metering VIN gave **3.10 V unloaded, collapsing to 20–40 mV** the moment the boost
drew from it. That's not a supply — it's **backfeed through the 3.3 V regulator's
parasitic diode** (3.3 − 0.2 = 3.1 V, exactly). VIN is the regulator's *input*, left
floating when powered over USB. **`VBUS` is the pin that carries USB 5 V.**

That collapse-under-load signature is worth remembering: a rail that reads plausible
open-circuit and dies under any load is a floating pin, not a weak supply.

Bonus: on the MT3608, IN− and OUT− are the same node (non-isolated boost), so
`probe green → OUT− → IN− → NodeMCU GND` satisfies the common-ground rule by topology.
The whole bench rig runs off one USB cable. Boost outputs 18.2 V — fine, the QDY30A
is confirmed 12–36 V (the 18.0 V target only mattered while the HTP-300Y's 24 V
ceiling was still in play).

### ⚠️ GOTCHA: `arduino-cli upload` does NOT recompile
Cost ~30 minutes chasing a board that looked dead. Sequence was: compile with
`BENCH_MODE 1` → flip to 0 → compile to check the WiFi path → flip back to 1 →
`upload`. **The upload flashed the stale `BENCH_MODE 0` binary**, so the board sat in
a 20 s WiFi wait for a hotspot that doesn't exist. Use **`compile --upload`**.

Related trap: the board only prints in `setup()`, so `cat /dev/ttyUSB0` on an
already-running board shows nothing until the next loop print — which looked exactly
like a dead board. **Pulse RESET (RTS) while listening**, or you're reading a window
where nothing is due. `scratchpad/espread2.py` does this via the pyserial bundled at
`~/.arduino15/packages/esp8266/hardware/esp8266/3.1.2/tools/pyserial`. Note `cat` at
**74880** (the boot-ROM rate) is impossible — termios rejects the non-standard baud.

### ⚠️ OPEN: auto-direction echo is eating the retry budget
Serial shows clean reads interleaved with runs of `timeout`. Reads succeed — 5 good
samples out of up to 15 tries — so nothing is broken. But **most of the retry budget
is being spent**, and that margin is what protects a field node on a long, noisy cable.

Cause is the same one the FT232 had (`devlog` 2026-07-15): the auto-direction board
**echoes our own transmitted bytes back**, the reader takes the echo for the reply,
CRC rejects it, attempt scored a timeout. Fix is the pattern `poll-soil.ts` already
uses: **resync on a valid frame header inside the buffer** instead of assuming the
reply starts at byte 0. Next job.

---

## 2026-07-16 — Water sensor Step 4: ruler test PASSED — sensor reports **millimetres**

Closes the last open item on the water sensor. Probe flat on the bottom of a bucket
marked at 30 mm intervals, powered from the MT3608 boost @ 18 V, 4 points captured
with `tools/poll-water.ts --point=<n>mm` (8 CRC-validated frames averaged per point).

| ruler | raw (mean of 8) | spread |
|---|---|---|
| 65 mm | 82.25 | 1 |
| 95 mm | 107.75 | 1 |
| 125 mm | 136.0 | 0 |
| 155 mm | 169.0 | 0 |

Least-squares fit: **`level_cm = 0.10363 * raw − 1.824`**, R² = 0.9966.

### ✅ VERDICT: 1 count = 1 mm. The register map was RIGHT.

```
raw is mm  → predicted slope 0.100 cm/count → measured 0.1036   (3.6% off)
raw is cm  → predicted slope 1.000 cm/count → measured 0.1036   (865% off)
```

The community's mm-vs-cm confusion **does not apply to this unit**. `unit=0x11` (cm)
with `decimals=1` means counts of 0.1 cm — which *is* 1 mm/count. The registers and
the ruler agree. The 10× trap only catches people who read `decimals=1` and then treat
raw as cm anyway. **Use `level_cm = raw / 10`.**

### ⚠️ GOTCHA: you cannot calibrate a 5 m sensor in a bucket — and don't need to

We burned two extra points chasing a 3.6–11% slope discrepancy before reading the spec:

```
Accuracy: 0.2%F.S ; 0.5%FS     ← 0.5% of 5000 mm = ±25 mm
Zero Drift: ±2%F.S             ← ±100 mm
Sensitivity Drift: ±2%F.S
```

Full scale is 5000 mm. Our whole calibration span was 90 mm — **3.6× the instrument's
own error bar**. Fitting a slope across that is measuring a desk with a ruler marked
every 30 cm. The per-step numbers wobbled (1.176 → 1.062 → 0.909 mm/count) and the
residuals showed a real arch (+2.0, −1.6, −2.3, +1.9 mm), but ~4 mm of curvature is
**6× smaller than the sensor's rated accuracy**. It is not resolvable in a bucket and
not worth resolving: ±25 mm on a farm tank is ±2.5 cm, far below what anyone irrigating
a field cares about.

**The ruler test's job is the 10× question (mm vs cm), not the 1% question.** It answered
that decisively at 4 points. Don't rat-hole chasing percent-level slope in a bucket —
pinning the slope to even ±5% would need a multi-metre standpipe.

Statistical trap worth remembering: at 3 points you have **1 degree of freedom**, so the
95% t-multiplier is **12.7**. A tiny-looking standard error (±0.033 mm/count) became a
real CI of ±0.42 — spanning 1.0 easily. R² was 0.999 throughout and told us nothing:
**R² measures collinearity, not extrapolation.**

### GOTCHA: bubble hypothesis — tested, NEGATIVE
The guide warns trapped air in the probe cavity causes up to 15 mm of error, and the
increasing counts-per-step looked exactly like a bubble compressing with depth. Tested
directly: read at 155 mm, wiggled the probe underwater to shed anything clinging, re-read
at the same level. **169.0 → 168.** One count. No bubble. A probe simply set down in a
bucket doesn't trap one — the curvature is the sensor's own low-end behaviour (we were
at 1.3–3% of full scale, where cheap transducers are worst).

### Zero offset is real and bigger than anything above
Probe reads **raw ≈ 26 in air** (~26 mm of water that isn't there). Normal — spec allows
±2% FS = ±100 mm of zero drift. It's a constant, so handle it in software:
`level_mm = raw − dry_offset`, with `dry_offset` read at install time. Reg `0x0005` (zero)
exists for this but needs the `0x000F` commit dance, and a bad write on an unconfirmed
map costs you the sensor. Software offset is free and reversible.

### ⚠️ OPEN: FT232 adapter intermittently drops off the USB bus
Surfaced by luck at the end of the session. `dmesg -T` disconnects by minute:
```
09:51 ×1 (initial plug — normal)   10:04 ×1   10:05 ×1   10:07 ×1   10:08 ×6   → then ABSENT
```
`ftdi_sio ttyUSB0: Unable to read latency timer: -32` on every re-enumeration. Deteriorating,
not stable. **The fault predates the probe wiggle** — it was already dropping during the
calibration, and the wiggle only accelerated it.

**The calibration data survived it because of CRC** — a flaky link drops frames or kills the
port, it cannot forge a CRC-valid frame with a plausible value. All 4 points were 8/8 valid.

Not yet diagnosed. Check in order: (1) the USB plug/cable/port alone; (2) continuity from
FT232 GND to MT3608 OUT− — the green wire must reach **both**, and an intermittent there
leaves the A/B pins as the only bridge between an 18 V rail and the laptop, which is how you
kill an adapter; (3) re-plug the FT232 with no sensor and no 18 V — if it still cycles, the
adapter is dying.

### Tooling
`tools/poll-water.ts` gained: `--point=65mm` (capture one ruler point, averaged, stored),
`--fit` (fit + verdict over stored points), `--read` (averaged read, stores nothing),
`--reset`, and `--calibrate` (interactive loop for anyone following the guide). Depth entry
accepts `mm`/`cm` suffixes — a bare number in `--mm` mode is mm. **That units trap is real:
typing `65` (mm) into a cm prompt fits a line that's silently 10× wrong and R² can't see it.**
Results land in `water-calibration.json`.

**TODO:** the tool writes no per-point timestamps, so captures couldn't be correlated against
the dmesg disconnects. Add them.

---

## 2026-07-15 — Water sensor (QDY30A) bench bring-up: comms + map CONFIRMED

Powered via **MT3608 boost @ 18 V** off the 3S2P pack (pack was 11.31–11.48 V;
sensor spec 12–36 V, so it needs the boost). Wiring per guide: **blue=A, yellow=B**
(reversed vs soil), red=OUT+, green=OUT−&GND. Baud **9600**.

**Register map CONFIRMED against the community source** — raw block read (0x0000–0x0006):
```
01 03 0e | 0001 0003 0011 0001 001a 0000 1388 | 66 d4
addr=1  baudCode=3(9600)  unit=0x11(cm)  decimals=1  value=26  zero=0  range=5000
```
Matches the guide's map exactly. Baseline in air: raw 26 → 2.6 (cm, 1 decimal).

### ⚠️ GOTCHA: MT3608 pot "does nothing" — it's just a 25-turn trimmer
Both MT3608 modules showed Vout = Vin and the pot seemed inert. Cause: it's a
multi-turn trimmer (~25 turns) and the cheap ones **slip at the end stops**, so it
feels like turning while the wiper is parked. Fix: pick ONE direction and turn a
full ~30 turns slowly watching the meter — voltage eventually climbs. (Vout==Vin
also means the IC isn't switching yet — check IN/OUT aren't swapped, but here it
was just the traverse.)

### GOTCHA: the poller needs SEPARATE read/write fds at 9600
`poll-water.ts` first reported "no valid frame" even though a separate `cat`
listener captured a perfect reply. At 9600 the reply arrives ~2× faster than soil's
4800, so on a single r+ handle the adapter's TX→RX turnaround clips the reply
header before the resync can lock on. Fix: open one write fd + one read fd (the read
fd stays in RX the whole time, like the working `cat` capture). After that, 3/3
clean reads in air. (poll-soil.ts left on single-fd — it works at 4800; unify later.)

### Move-test — PASSED
Live poll while lowering the probe into a bucket: LEVEL(0x0004) climbed
26 → 105 (raw) on the way down, held steady at 105 submerged, fell back to ~25 on
lift-out. Smooth, monotonic, repeatable — confirmed it tracks real depth.
Bucket depth produced ~79 counts of change. **Water sensor comms + liveness done.**

### Still open (water)
- Step 4: calibrate raw→cm against a ruler (two known depths, fit the line, verify
  with a third). Community reports mm-vs-cm confusion; the ruler outranks the unit
  register (which claims cm/decimals=1).

---

## 2026-07-15 — Soil sensor (THC-S) bench bring-up: PASSED

Working through `docs/bench/00-bench-rig.md` Step 0 (prove the sensor over the
FT232 USB→RS485 adapter, before the ESP8266 is involved).

**Wiring confirmed** (THC-S, matches the guide):

| Wire | Role | To |
|---|---|---|
| Yellow | A (D+) | adapter `A` |
| Blue | B (D−) | adapter `B` / `−` |
| Brown | V+ | pack + (9–12.6 V direct, no boost) |
| Black | V− | pack − **and** adapter `GD` (common ground) |

- **Baud is 4800**, slave address **1**. Register map: reg0 = moisture (0.1 %),
  reg1 = temperature (0.1 °C, signed), reg2 = EC (µS/cm).
- First bench reading in air: moisture 0 %, temp ~22.5 °C, EC 0 — all physically
  sensible for a probe sitting on the bench.

### ⚠️ GOTCHA: `mbpoll` reports "Invalid CRC" but the sensor is fine

`mbpoll -m rtu -a 1 -b 4800 -P none -d 8 -s 1 -t 4 -r 1 -c 3 /dev/ttyUSB0`
returned **`Invalid CRC` on every frame** — deterministically, 100 %. Looked like
a broken sensor or bad wiring. It was neither.

**Root cause:** the cheap **FT232RL + SN75176 auto-direction USB→RS485 adapter**
echoes/clips bytes when a *single* file descriptor both transmits and reads (which
is exactly what `mbpoll` does). The sensor, wiring, power, and baud were all correct.

**How we proved it:** read the port with a *separate* listener that never
transmits, while sending the request from another fd:

```bash
stty -F /dev/ttyUSB0 4800 cs8 -cstopb -parenb raw -echo
( timeout 2 cat /dev/ttyUSB0 | od -An -tx1 ) &
sleep 0.3
printf '\x01\x03\x00\x00\x00\x03\x05\xcb' > /dev/ttyUSB0
wait
# → 01 03 06 00 00 00 e1 00 00 71 43   (a clean, valid frame — no echo, CRC OK)
```

A dedicated listener sees a perfect frame; `mbpoll` on the same handle chokes.
That split *is* the diagnosis.

**Diagnostic tell worth remembering:** the error *type* flips with baud —
- wrong baud (9600) → **timeout** (sensor doesn't understand the request, stays silent)
- right baud (4800) → **Invalid CRC** (sensor answers; bytes present but mangled)

So "CRC errors, not timeouts" actually means *you're on the right baud* — don't go
hunting the baud rate when you see CRC.

**Fix / tooling:** wrote `tools/poll-soil.ts` (bun) — sends the request, reads a
generous ~400 ms window, resyncs on a valid `01 03 06 …` frame, validates CRC
before trusting it. Tolerant of the adapter's echo/turnaround. Gives live readings:

```bash
bun tools/poll-soil.ts            # live, every 1s
bun tools/poll-soil.ts --once     # single reading
```

**Note for the guide:** don't rely on `mbpoll` with this specific adapter. It's a
tool ↔ adapter interaction, not a rig fault. `tools/poll-soil.ts` is the bench
poller to use instead. (Left `00-bench-rig.md` as-is; this log is the record.)

### Minor environment notes
- `xxd` is not installed on this Arch box — use `od -An -tx1` for hex dumps.
- `mbpoll` is the AUR `mbpoll-git`; already installed, user is in `uucp` group.

### Step 0.7 (make the reading move) — PASSED
Dipped the probe tines in a cup of tap water while `poll-soil.ts` streamed:
- In air: moisture 0.0 %, EC 0, temp 22.5 °C.
- In water: moisture jumped to **83–90 %**, EC to **55–95 µS/cm**, temp *fell*
  toward ~20.7 °C (water cooler than room).
- Pulled out: moisture and EC **snapped back to 0**.
Three registers responded correctly and simultaneously — confirmed live measurement,
not a stale buffer. **Soil sensor Step 0 fully closed.**

### Next
- Water sensor (QDY30A): power via MT3608 boost @ 18 V (pack is 11.48 V, sensor
  spec 12–36 V), baud **9600**, A/B colours **reversed** vs soil (blue=A, yellow=B).
  Tool `tools/poll-water.ts` written and ready (reads config block 0x0000–0x0006),
  untested until the sensor is powered. See `docs/bench/02-bench-water-level-rs485.md`.
- Then ESP8266 + MAX485 for both sensors.
