# Bench Test — Water Level Sensor (QDY30A) over RS485 → ESP8266

> **Prerequisites:** [00-bench-rig.md](00-bench-rig.md), then **[01-bench-soil-sensor-rs485.md](01-bench-soil-sensor-rs485.md)**.
> **Sensor:** QDY30A submersible hydrostatic level transmitter, RS485 (4-wire) variant
> **Manual:** `hardware/Manual - Water Level Option A.pdf` — covers wiring and voltage, but has **no Modbus section**.
> **Register map below is community-sourced.** See [Provenance](#provenance-of-the-register-map).

**Do the soil sensor first.** It has a manufacturer-documented register map, so it proves your RS485 chain against a known-good target. Bring a working chain here.

## Two things to know before wiring anything

### 1. Your pack cannot run this sensor directly — boost it to 18 V

Neither candidate sensor is happy on a bare 3S2P pack (9.0–12.6 V):

| Sensor | Spec'd supply |
|---|---|
| QDY30A | **12–36 V** (24 V standard) |
| HTP-300Y | **9–24 V** (24 V default) |

The QDY30A clears its 12 V floor only near full charge, then spends the rest of the pack's life **below spec**. Don't split hairs over "12.4 V is basically 12 V" — an under-volted transmitter doesn't necessarily fail *cleanly*. It can return plausible readings that drift as the pack sags, so you'd be calibrating against a moving zero while chasing a fault that actually lives in your power rail.

**Boost the pack with the MT3608. If you don't yet know which sensor you have, set it to 18.0 V.**

That number isn't arbitrary. The two sensors overlap at **12–24 V**, and 18 V sits in the middle of that window:

```
QDY30A     12 V ├──────────────────────────────────────┤ 36 V
HTP-300Y  9 V ├──────────────────────┤ 24 V
                       ↓
overlap        12 V ├──────────┤ 24 V
                        18 V ← safe for either, with margin both ways
```

18 V clears the QDY30A's 12 V minimum with room to spare and stays well under the HTP-300Y's 24 V ceiling. **Do not default to 24 V while the model is unknown** — that's the HTP-300Y's absolute maximum, and a trimpot nudged slightly past it puts you over the limit on a sensor that says *"ensure the supply voltage does not exceed the specified limits to prevent permanent damage."*

Once you've positively identified a QDY30A, 24 V is its standard operating point and you can raise it if you like. There's no need to — 18 V works fine for both, so the simplest thing is to set it once and leave it.

### 2. Your manual has no Modbus section — but the map is known

None of the three water-level PDFs in `hardware/` document the protocol. The map below was reconstructed from Home Assistant and ESPHome community integrations of this exact sensor, cross-checked across three independent threads. **Step 2 is a five-minute confirmation** that your unit matches. Skip it and you're trusting the internet about your hardware.

## Which sensor do you actually have?

You listed three options in `hardware.md`, but **they're only two sensors**:

| Option | Model | Manual |
|---|---|---|
| **A** | QDY30A | `Manual - Water Level Option A.pdf` |
| **C** | QDY30A | `Manual - Water Level Option C.pdf` — **byte-identical to A** (same MD5) |
| **B** | **HTP-300Y** | different sensor, different manufacturer |

A and C are the same product listed by two sellers. So the real question is only: **QDY30A or HTP-300Y?**

### Telling them apart

Check in this order — first match wins:

1. **The body label.** Both are usually laser-etched or carry a hang tag with the model number. Easiest answer, so look here first.
2. **Count and colour the wires.** The QDY30A RS485 variant has exactly **four wires: red, green, blue, yellow.** If yours matches that, it's the QDY30A and the map below applies.
3. **Housing.** QDY30A is 316 stainless throughout, ~28 mm probe diameter, 7 mm PUR cable. The HTP-300Y has an **aluminium alloy housing** on a 316L diaphragm.
4. **Just run Step 2.** The confirmation poll below *is* an identification test — see below.

### If it's the HTP-300Y

**There is no published register map for this sensor.** I searched for one and it does not exist publicly — no datasheet, no community integration, no forum thread. Its own manual is a placeholder: no wire colours, no baud rate, no registers, just an instruction to wire it *"according to the wiring definition provided by the seller."*

> ⚠️ **Do not trust search results for "HTP Modbus."** There's a boiler manufacturer called HTP (Heat Transfer Products) whose Modbus adapter documentation ranks well and looks superficially relevant — it talks about baud rates and slave addresses, but configures them through an *installer menu on a boiler* ("press ENTER to advance to Parameter 38"). It is a completely unrelated product. I nearly quoted it. If you go looking yourself, that's the rock to not turn over.

This doesn't sink you, because **Step 2 is model-agnostic** — the address/baud sweep and the block read find the map empirically whether or not you know the model. And:

- **Both sensors are happy at 18 V**, so you can power either one before identifying it.
- If the QDY30A map responds cleanly, you've *identified* your sensor. If not, fall back to the sweep.
- **Try the QDY30A map on it anyway.** These Chinese hydrostatic transmitters overwhelmingly share a firmware family, and the `0x0000`=addr / `0x0001`=baud / `0x0004`=value layout is close to a de-facto standard among them. It costs nothing to try, and **reads cannot damage anything.**

> ⚠️ **Reads are safe. Blind writes are not.** Never write registers on an unidentified sensor. If the layout differs and you write to what you *think* is the unit register, you could land on its address or baud register instead — and immediately lose the ability to talk to it. Read-only until you've confirmed the map.

If it is the HTP-300Y, **ask the seller for the wiring definition and register map.** Their own manual says that's where it lives, and it's a five-minute message versus a day of sweeping. Note also that wire colours vary across this class of sensor — some use yellow=A / white=B rather than the QDY30A's blue/yellow — which is exactly why you don't assume a pinout you haven't confirmed.

## Wire colours — QDY30A (RS485 4-wire variant)

| Wire | Function |
|---|---|
| **Red** | Power + |
| **Green** | Power − |
| **Blue** | RS485 **A** |
| **Yellow** | RS485 **B** |

> These are **reversed relative to the soil sensor**, where yellow is A and blue is B. Here **blue is A, yellow is B**. And multiple people integrating this sensor reported having to swap A and B anyway versus what the diagram implies. Swapping is harmless — if you get silence, just try it.
>
> **If your sensor's wires aren't red/green/blue/yellow, it's not the QDY30A** and you should not assume these roles. Get the wiring definition from the seller.

## Modbus parameters

| Setting | Value |
|---|---|
| Slave address | `1` (default) |
| Baud | **9600** 8N1, no parity |
| Function code | `0x03` read, `0x06` write |

Note this differs from the soil sensor, which is **4800**. Same bus wiring, different baud — don't copy the constant across.

## Register map

| Reg | Holds | Notes |
|---|---|---|
| `0x0000` | Device address | 1–255 |
| `0x0001` | Baud rate **code** | `0`=1200 · `3`=9600 · `4`=19200 · `7`=115200 |
| `0x0002` | **Unit code** | QDY uses `0x11`=cm, `0x12`=m, `0x13`=kPa, `0x14`=Bar, `0x15`=PSI |
| `0x0003` | **Decimal places** | 0–3. Sets the implied scaling of reg `0x0004` |
| `0x0004` | **Measured value** ← the level | **int16, SIGNED** (−32768…32767) |
| `0x0005` | Range zero point | Writable. Added to the result in `0x0004` |
| `0x0006` | Range full point | Writable |
| `0x000F` (15) | **Save settings** | Write `0` to persist — see gotcha below |
| `0x0010` (16) | Factory reset | Write `1` |

### The two gotchas that will bite you

**Registers `0x0002` and `0x0003` decide what `0x0004` actually means.** The raw number is meaningless until you know the unit code and the decimal-place count. Multiple people reported the sensor returning **millimetres while the unit register claimed centimetres**. So don't assume — read `0x0002` and `0x0003` on your unit, then calibrate against a ruler (Step 4). That resolves it regardless of what the registers claim.

**Config changes are volatile until you save them.** Writing a setting is a *two-command* operation: write the register, then **write `0` to register `0x000F`** to commit it to non-volatile memory. Skip the second command and your change silently evaporates on the next power cycle — which, on a solar node that browns out overnight, is a bug you'd chase for weeks.

## Step 1 — Set the MT3608 to 18 V *before* the sensor exists

This is the step where you can actually destroy something. The trimpot ships at an arbitrary setting. **Never adjust it with the sensor connected** — you'd be sweeping an unknown voltage across its input while you hunt for the target.

1. Connect **pack → MT3608 IN+ / IN−**. Output open, nothing attached.
2. Multimeter across **OUT+ / OUT−**.
3. Turn the trimpot — it's multi-turn, so expect many rotations, and it may initially move the wrong way. Watch the meter, don't count turns.
4. Settle on a steady **18.0 V** (safe for either sensor — see above).
5. Power down. *Now* attach the sensor: red → OUT+, green → OUT−.

- The MT3608 is a **boost** converter — it cannot output below its input. 12 V → 18 V is fine; it can't give you 5 V.
- Its ceiling is 28 V, but **that is not your limit** — if this is an HTP-300Y, anything over **24 V can permanently damage it**. Approach 18 V from below and stop there.
- **The boosted rail goes to the sensor's red wire and nowhere else.** Not the MAX485, not the ESP8266 — both are 3.3 V parts. Trace the wire with a finger before switching on.

## Step 2 — Confirm the map from the laptop (no ESP8266 yet)

> **Full walkthrough: [00-bench-rig.md § Step 0](00-bench-rig.md#step-0--prove-the-sensor-works-before-the-esp8266-is-involved)** — installing `mbpoll`, finding `/dev/ttyUSB0`, what every flag means, and what to do when it times out. Read that if any of the below is unclear. This section is just the water-sensor specifics.

Sensor → FT232 USB-RS485 adapter → laptop. Sensor powered **from the MT3608 boost at 18 V** — set that first (Step 1 above), never straight off the pack.

| Sensor wire | Goes to |
|---|---|
| **Blue** (A) | FT232 **A** |
| **Yellow** (B) | FT232 **B** |
| **Red** (+) | MT3608 **OUT+** (18 V) |
| **Green** (−) | MT3608 **OUT−** *and* FT232 **GND** |

> **Note the A/B colours are the opposite of the soil sensor** — there, yellow is A and blue is B. Here blue is A. Read it twice; it's a genuinely nasty trap.

Green must reach **both** the boost negative and the adapter's GND — the common-ground rule.

Read the whole config block plus the value in one shot:

```bash
# registers 0x0000-0x0006 (mbpoll is 1-based: -r 1 == 0x0000)
mbpoll -m rtu -a 1 -b 9600 -P none -d 8 -s 1 -t 4 -r 1 -c 7 /dev/ttyUSB0
```

Expect roughly:

```
[1]:  1        <- 0x0000  device address
[2]:  3        <- 0x0001  baud code 3 = 9600
[3]:  17       <- 0x0002  unit code 0x11 = cm
[4]:  1        <- 0x0003  decimal places
[5]:  0        <- 0x0004  measured value (0 in air)
[6]:  0        <- 0x0005  zero point
[7]:  5000     <- 0x0006  full range
```

**Write down your actual `0x0002` and `0x0003`.** They set the scaling for everything downstream.

Now make it *move*: lower the probe into a bucket of water and watch `[5]`. It should climb clearly and settle. Lift it out — back toward zero. A value that doesn't respond to depth isn't the level register, and everything after this depends on it.

Silence? **Swap blue and yellow**, retry. Then try `-b 4800`. Then sweep addresses:

```bash
for addr in $(seq 1 16); do
  timeout 1 mbpoll -m rtu -a $addr -b 9600 -P none -t 4 -r 5 -c 1 -1 /dev/ttyUSB0 2>/dev/null \
    | grep -q '\[' && echo "FOUND at address $addr"
done
```

## Step 3 — Move to the ESP8266

Wiring is exactly the rig from [00-bench-rig.md](00-bench-rig.md) — **check which MAX485 variant you have first**, the listing ships two. Ours is the **HW-0519** (auto-direction, no DE/RE): `RXD→D5`, `TXD→D6`, `VCC→3V3`, `GND→GND`, and D1 goes unused. The classic breakout instead wants `RO→D5`, `DI→D6`, `DE+RE→D1`.

> **Production firmware for this module is [`firmware/water-level/`](../../firmware/water-level/)** — set `BENCH_MODE 1` in `config.h` for serial-only bring-up before you involve WiFi. The minimal sketch below is kept for reference and for anyone wanting to see the bare read path.

| Sensor | Goes to |
|---|---|
| Blue (A) | MAX485 A |
| Yellow (B) | MAX485 B |
| Red (+) | MT3608 OUT+ (**18 V**) |
| Green (−) | MT3608 OUT− **and the common ground rail** |

Pack −, MT3608 OUT−, MAX485 GND and ESP8266 GND are **one ground**. The sensor runs off a boosted rail while the ESP runs off laptop USB — two supplies, one reference. Miss this and you get intermittent CRC failures that look exactly like a flaky sensor.

Take the sketch from [guide 01](01-bench-soil-sensor-rs485.md) — the CRC and frame code are unchanged — and swap the constants and the `loop()`:

```cpp
#define SENSOR_ADDR  1      // reg 0x0000
#define RS485_BAUD   9600   // reg 0x0001 code 3. NOT 4800 like the soil sensor.

void loop() {
  uint16_t r[1];
  if (readRegisters(0x0004, 1, r)) {          // 0x0004 = measured value
    int16_t raw = (int16_t)r[0];              // SIGNED — below-zero readings are real

    // Scaling depends on YOUR reg 0x0002 (unit) and 0x0003 (decimals).
    // Confirm against a ruler in step 4 before trusting this divisor.
    float level = raw / 10.0f;

    Serial.printf("raw %d | level %.2f\n", raw, level);
  }
  delay(2000);
}
```

Print **raw alongside scaled**. While the scaling is still a hypothesis, raw is the only number you can reason about — and `(int16_t)` matters, because a sensor reading slightly below its zero point returns a genuine negative that parses as ~65000 unsigned.

## Step 4 — Calibrate against a ruler

> ### ✅ Result on our unit (2026-07-16): **1 count = 1 mm**. Use `level_cm = raw / 10`.
>
> Four points over a 90 mm span fitted `level_cm = 0.10363 * raw − 1.824` (R² = 0.9966) —
> within 3.6% of the 0.1 the register map implies, and 865% away from the "raw is cm"
> alternative. **The register map was right.** `unit=0x11` (cm) with `decimals=1` means
> counts of 0.1 cm, which *is* 1 mm/count. The mm-vs-cm trap only catches people who read
> `decimals=1` and then treat raw as cm anyway. Full write-up in [`devlog.md`](../../devlog.md).
>
> **Do this test anyway on your own unit** — it's five minutes and it's the only thing
> standing between you and a silent 10× error. But read the next box before you chase
> anything finer than that.

> ### ⚠️ Do NOT chase a precise slope in a bucket
>
> This test answers a **10× question** (mm or cm?), not a 1% question. The manual specs
> **Accuracy: 0.5% F.S** and **Zero Drift: ±2% F.S** — on a 5000 mm sensor that's **±25 mm**
> accuracy and **±100 mm** of zero drift. A bucket gives you maybe 90 mm of span, so your
> entire experiment is ~3.6× the instrument's own error bar. We watched the per-step figure
> wobble 1.176 → 1.062 → 0.909 mm/count and spent two extra points chasing it. It's inside
> spec and unresolvable at bucket scale.
>
> **R² will not save you** — it measures collinearity, not extrapolation, and read 0.999
> throughout. Nor will the standard error at 3 points: 1 degree of freedom means a 95%
> t-multiplier of **12.7**, so a ±0.033 mm/count SE is really ±0.42.
>
> Pinning the slope to ±5% needs a multi-metre standpipe. For a farm tank you don't need it:
> ±25 mm is ±2.5 cm, which nobody irrigating a field will ever notice.

The sensor reports water depth *above the probe*. It knows nothing about your tank, and the community reports of mm-vs-cm confusion mean the register's claimed unit is not authoritative. A ruler is.

**Use the tool, not pen and paper:**

```bash
bun tools/poll-water.ts --point=65mm    # capture a point at each known depth
bun tools/poll-water.ts --point=95mm
bun tools/poll-water.ts --fit           # fit + verdict over all stored points
bun tools/poll-water.ts --read          # averaged read, stores nothing
bun tools/poll-water.ts --calibrate     # or: interactive prompt loop
```

Each `--point` averages 8 CRC-validated frames and reports the spread, so you can see whether
the surface has settled. Depth entry takes `mm`/`cm` suffixes — **the units trap is real:
typing `65` (mm) where cm is expected fits a line that is silently 10× wrong.**

Two things that wreck a fit, neither of which the numbers will confess to:
- **A probe that shifts between points.** A *constant* offset is harmless — the intercept
  absorbs it, so you don't need to know where the diaphragm sits inside the probe body. But a
  probe that moves *between* readings injects a fake slope and there's no way to detect it after.
- **Measuring inconsistently.** Pick one reference (a mark on the probe, or the vessel floor)
  and use it every single time. Consistency beats absolute accuracy here.

The method:

1. Probe flat on the bottom, and **don't let it move again**. Measure the actual water depth above it and capture: `--point=65mm`.
2. Add water to a new measured depth. Capture again. Repeat — **4 points minimum**, spread as widely as your vessel allows.
3. `--fit`. It reports `cm_per_count`, per-point residuals, the slope's standard error, and a verdict.

The tool fits least-squares over *every* point rather than the older fit-2-verify-1 method. The residuals give you the same hold-out signal — a line that predicts each point within a few mm is right — while wasting no data.

**Reading the result:**

| `cm_per_count` | Meaning |
|---|---|
| ≈ **0.1** | 1 count = 1 mm. Sensor reports millimetres. `level_cm = raw / 10`. **← what our unit does** |
| ≈ **1.0** | 1 count = 1 cm, and `decimals=1` is lying. |
| neither | Re-check `0x0003`, and check you measured above the **probe**, not the bucket floor. |

Anything within ~15% of 0.1 is a pass — see the "don't chase a precise slope in a bucket" box above. A few percent off 0.1 is **not** evidence the register map is wrong; it's evidence you're calibrating a 5 m instrument in a bucket.

### The zero offset is the number that actually matters

Our probe read **raw ≈ 26 sitting in air** — 26 mm of water that doesn't exist. That's normal (spec allows ±2% F.S = ±100 mm of zero drift) and it dwarfs every slope subtlety on this page.

Take a dry reading at install and subtract it in software: `level_mm = raw − dry_offset`. Register `0x0005` (zero) exists for this, but it needs the `0x000F` commit dance and **a bad write on an unconfirmed map costs you the sensor**. A software offset is free, reversible, and re-measurable when the zero drifts.

> **Keep the breather tube clear.** This is a *gauge* pressure sensor — it references atmosphere through a vent tube in the cable. Seal, kink, or submerge that cable end and your readings drift with the weather.

> **Bubbles: warned about everywhere, not observed here.** Community reports say air trapped in the probe cavity causes up to 15 mm of error, and a compressing bubble is a *very* convincing explanation for counts-per-step that grow with depth — we chased exactly that. We tested it directly: read at a fixed level, wiggled the probe underwater to shed anything clinging, re-read. **169.0 → 168.** One count. A probe simply set down in a bucket didn't trap one. Still tilt when submerging (it's free), but if your steps look curved, don't assume bubbles — check where you are in the sensor's range first.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Silence at every address/baud | A/B swapped | Swap blue and yellow. Commonly needed on this sensor. |
| Silence, sensor cold | Under-volted | Meter red↔green: must be the boosted **18 V**, not the raw pack. |
| Silence, MT3608 reads 0 V | Trimpot at range bottom | Multi-turn — keep going, watch the meter. |
| Readings 10× off | Wrong decimals assumption | Read `0x0003`. Calibrate with a ruler; likely mm not cm. |
| Reading ≈ 65000 | Parsed unsigned | Cast to `int16_t`. Below-zero readings are legitimate. |
| Config change lost on reboot | Didn't persist it | After any write, **write `0` to reg `0x000F`**. |
| Drifts over hours | Pack sagging, sensor under-volted | You're running direct off the pack. Use the boost. |
| Drifts with the weather | Breather tube blocked | Keep the cable end dry and open to air. |
| Off by ~15 mm, erratic | Air bubble in the probe cavity | Tilt when submerging; mount horizontally. |
| Intermittent CRC failures | No common ground | Boost OUT−, MAX485 GND, ESP GND — one rail. |
| Value never changes | Not actually reading `0x0004` | Poll `0x0000`–`0x0006` as a block, watch which moves. |
| `/dev/ttyUSB0` vanishes mid-session | FT232 dropping off the USB bus | `sudo dmesg -T \| grep -i ftdi`. Repeated "converter now disconnected" + `Unable to read latency timer: -32` = a real fault, not software. **De-energise the 18 V first** — if the common ground is what's intermittent, the A/B pins become the only bridge between an 18 V rail and your laptop, which is how you kill an adapter. Then: USB plug/cable/port alone → continuity FT232 GND ↔ boost OUT− → re-plug the adapter with nothing attached. |
| First read after opening the port fails | Adapter TX→RX turnaround eats the frame header | Known and harmless. The pollers burn a warmup exchange and retry. Don't chase it. |

## Provenance of the register map

Your manual documents wiring and voltage but **no Modbus protocol at all**. The map above comes from three independent Home Assistant / ESPHome community integrations of this same QDY30A. They agree with each other on every register.

I verified the community-posted read frame is valid Modbus RTU by independently computing its CRC:

```
01 03 00 04 00 01 C5 CB      ← read reg 0x0004, addr 1
                  ^^^^^ CRC recomputed → 0xC5 0xCB ✓
```

That proves the frame is well-formed, **not** that the register semantics are right for your unit. Hence Step 2 (confirm the block) and Step 4 (calibrate against a ruler). If the seller can supply an official "QDY30A Modbus register map" PDF, get it — but the ruler outranks any datasheet.

**Sources:**
- [Water level sensor QDY30A modbus RS485 with ESP32 S2 mini — ESPHome](https://community.home-assistant.io/t/water-level-sensor-qdy30a-modbus-rs485-with-esp32-s2-mini/698712) ([page 2](https://community.home-assistant.io/t/water-level-sensor-qdy30a-modbus-rs485-with-esp32-s2-mini/698712?page=2))
- [Modbus with EW11 + QDY30A RS485 water level measure probe](https://community.home-assistant.io/t/modbus-with-ew11-qdy30a-rs485-water-level-measure-probe/688694)
- [QDY30A RS485 + Waveshare RS485-to-POE-ETH](https://community.home-assistant.io/t/water-level-sensor-qdy30a-rs485-waveshare-rs485-to-poe-eth-b-modbus-mqtt/739638)
- [QDY30A Submersible Level Transmitter manual (manuals.plus)](https://manuals.plus/ae/3256804725368942)

## The module doc

[`docs/01-water-tank-level-sensor.md`](../01-water-tank-level-sensor.md) is the farmer-facing build guide for this sensor. It was rewritten on 2026-07-16 to match what we actually built — it previously described an HC-SR04 ultrasonic sensor on an ESP32, which was never built.

The switch was deliberate: a tank is an enclosed cylinder full of reflective surfaces with a moving surface, which is precisely what an echo-based sensor handles worst. A submersible pressure probe ignores walls, ripples and foam entirely because it doesn't look at the water — it sits underneath it. The cost is that it needs 12–36 V (hence the MT3608 boost) and speaks RS485 rather than two GPIO pins.

> ⚠️ **The funded proposal still specifies "ultrasonic detection"** (`proposal/README.md`). That document is the record of what Float agreed to fund and should not be quietly rewritten — but the divergence is real and belongs in the scope-change log in [`STATUS.md`](../../STATUS.md).
