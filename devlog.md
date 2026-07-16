# Devlog — Farmers IoT Toolkit

Running log of decisions, gotchas, and dead-ends found during development. Newest
entries at the top. The point is to save future-us (and anyone else building this
rig) the hours we burned the first time.

Format per entry: date, what we were doing, what bit us, and what actually worked.

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
