# Bench Test — Water Level Sensor (QDY30A) over RS485 → ESP8266

> **Prerequisites:** [00-bench-rig.md](00-bench-rig.md), then **[01-bench-soil-sensor-rs485.md](01-bench-soil-sensor-rs485.md)**.
> **Sensor:** QDY30A submersible hydrostatic level transmitter, RS485 (4-wire) variant
> **Source:** `hardware/Manual - Water Level Option A.pdf`

**Do the soil sensor first.** Not a style preference — this guide has two unknowns the soil guide doesn't (a boost converter to set, and an undocumented register map). You want the RS485 chain already proven before you take those on.

## Two things you need to know before wiring anything

### 1. Your pack cannot run this sensor directly

The QDY30A needs **DC 12–36 V**, 24 V standard. Your 3S2P pack gives 9.0–12.6 V. It clears the 12 V floor only at near-full charge, then spends the rest of its life **below spec**.

Don't be tempted by "12.4 V is basically 12 V." An under-volted transmitter is not reliably a *dead* transmitter — it can return readings that look fine and drift as the pack sags. You'd be calibrating against a moving zero and chasing a fault that lives in your power rail.

**Boost the pack to 24 V with the MT3608.** That's the sensor's design point and it's stable across the pack's whole discharge curve.

### 2. The register map is not in any of your manuals

I checked all three water-level PDFs in `hardware/`. They give you the wire colours, the voltage range, and the fact that RS485 is supported — and then **nothing about slave address, baud rate, or which register holds the level value.** No Modbus section at all.

So unlike the soil sensor, I can't hand you a table. **Step 2 below is a discovery procedure** to find the register map empirically. It's straightforward, it just takes twenty minutes. Budget for it.

If a datasheet came in the box or the seller has a spec sheet on the AliExpress listing, grab it — it'll save you the hunt. Worth asking the seller directly for "QDY30A Modbus RTU register map"; they usually have a PDF.

## Wire colours (RS485 4-wire variant)

From the manual's wiring diagram:

| Wire | Function |
|---|---|
| **Red** | Power + (12–36 V) |
| **Green** | Power − |
| **Blue** | RS485 **A** |
| **Yellow** | RS485 **B** |

> Note these differ from the soil sensor, and confusingly so — on the soil sensor *yellow* is A and *blue* is B. Here it's the reverse: **blue is A, yellow is B**. Getting this backwards costs you nothing but a swap, but knowing it up front saves confusion.

## Step 1 — Set the MT3608 to 24 V *before* the sensor exists

This is the step where you can actually destroy something. The MT3608 ships with its trimpot at an arbitrary setting. Do not connect the sensor and then adjust.

1. Connect **pack → MT3608 IN+ / IN−**. Nothing on the output.
2. Multimeter across **OUT+ / OUT−**.
3. Turn the trimpot — it's multi-turn, so it takes many rotations, and it may go the "wrong" way at first. Watch the meter, don't count turns.
4. Bring it to a **steady 24.0 V**.
5. Power down. *Now* connect the sensor's red to OUT+ and green to OUT−.

Sanity checks:

- The MT3608 is a **boost** converter. It cannot output *below* its input. 12 V in → 24 V out is fine; it can't give you 5 V.
- Max output is 28 V. Don't overshoot toward it — 24.0 V is the target.
- **24 V must reach the sensor's red wire and nowhere else.** Not the MAX485, not the ESP8266. Both are 3.3 V parts. Trace the wire with your finger before you switch on.

## Step 2 — Find the register map (laptop, no ESP8266 yet)

Sensor → FT232 USB-RS485 adapter → laptop. Sensor powered from the MT3608 at 24 V. Sensor green → **common ground rail**.

| Sensor | FT232 |
|---|---|
| Blue (A) | A |
| Yellow (B) | B |
| Green (−) | GND |

### 2a. Find the address and baud rate

These transmitters commonly ship as address `1` at `9600 8N1`, but yours is unverified — so scan rather than assume. Try the likely combination first:

```bash
mbpoll -m rtu -a 1 -b 9600 -P none -d 8 -s 1 -t 4 -r 1 -c 4 /dev/ttyUSB0
```

If that's silent, sweep addresses across the two plausible baud rates:

```bash
for baud in 9600 4800; do
  for addr in $(seq 1 16); do
    if timeout 1 mbpoll -m rtu -a $addr -b $baud -P none -d 8 -s 1 \
         -t 4 -r 1 -c 2 -1 /dev/ttyUSB0 2>/dev/null | grep -q '\['; then
      echo "FOUND — address $addr @ $baud baud"
    fi
  done
done
```

(`-1` polls once and exits.) Addresses 1–16 catch almost every factory default. If that sweep comes up empty: **swap blue and yellow** and run it again — A/B reversal is silent and harmless, and it's still the most likely fault. Then widen to `seq 1 247`.

### 2b. Find which register holds the level

Once you have an address and baud, dump a block of registers and watch which one *moves*:

```bash
# adjust -a and -b to what you found
mbpoll -m rtu -a 1 -b 9600 -P none -d 8 -s 1 -t 4 -r 1 -c 10 /dev/ttyUSB0
```

That reads registers `0x0000`–`0x0009` on a repeating poll. Now **change the physical input** and watch the output:

- Lower the probe into a **bucket of water**, then lift it out. Roughly 30 cm of submersion is plenty of signal.
- The register tracking depth will swing clearly. Others will sit still or jitter in the noise.

Some registers will hold a value scaled ×10 or ×100, some may be a 32-bit float split across two consecutive registers. Note *which* register moved and *by how much* for a known depth change — that's your scaling factor, and you'll confirm it in Step 4.

Write down what you find:

```
address: ___    baud: ___
level register: 0x____    scaling: ÷____    units: ____
```

## Step 3 — Move to the ESP8266

Wiring is **exactly** the rig from [00-bench-rig.md](00-bench-rig.md) — `RO→D5`, `DI→D6`, `DE+RE→D1`, MAX485 `VCC→3V3`.

| Sensor | Goes to |
|---|---|
| Blue (A) | MAX485 A |
| Yellow (B) | MAX485 B |
| Red (+) | MT3608 OUT+ (**24 V**) |
| Green (−) | MT3608 OUT− **and the common ground rail** |

Pack −, MT3608 OUT−, MAX485 GND, and ESP8266 GND are all **one ground**. The sensor is running from a boosted rail while the ESP runs from laptop USB — two supplies, one reference. Miss this and you'll get intermittent CRC failures that look like a flaky sensor.

Firmware is the soil sketch from [guide 01](01-bench-soil-sensor-rs485.md) with three lines changed to match what you found in Step 2:

```cpp
#define SENSOR_ADDR  1      // <- from step 2a
#define RS485_BAUD   9600   // <- from step 2a

// ...and in loop(), read your level register instead of 0x0000-0x0002:
void loop() {
  uint16_t r[2];
  if (readRegisters(0x0000, 2, r)) {        // <- your register from step 2b
    float level = r[0] / 10.0f;             // <- your scaling from step 2b
    Serial.printf("raw %u | level %.2f\n", r[0], level);
  }
  delay(2000);
}
```

Print the **raw** value alongside the scaled one. While the register map is still a hypothesis, raw is the number you can actually reason about.

## Step 4 — Calibrate against a known depth

The sensor reports *pressure* as depth of water above the probe. It knows nothing about your tank. So:

1. Probe in a bucket, sitting on the bottom. Note the raw reading — call it **zero offset**. It won't be 0; there's water above the probe and the diaphragm has its own offset.
2. Measure the actual water depth above the probe with a ruler. Say 25 cm.
3. Add water to a new measured depth, say 40 cm. Note the new raw reading.
4. Two points give you scale and offset:

```
level_cm = (raw - raw_at_zero) * (cm_per_count)
cm_per_count = (40 - 25) / (raw_at_40 - raw_at_25)
```

Confirm with a **third** depth you didn't use to fit the line. If it predicts that one correctly, your scaling is right. If it doesn't, the register is probably 32-bit across two registers, or scaled differently than you assumed — go back to Step 2b.

> **Keep the breather tube clear.** These are *gauge* pressure sensors — they reference the vent tube in the cable to atmosphere. The manual is emphatic about this. If you seal, kink, or submerge that cable end, readings drift with the weather. On the bench, just leave the cable end dry and open.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Nothing at any address or baud | A/B swapped | Swap blue and yellow. Then rescan. |
| Nothing, and the sensor is cold | Under-volted | Meter across red/green — must read **24 V**, not 12. |
| Nothing, MT3608 output reads 0 V | Trimpot at the bottom of its range | It's multi-turn. Keep going, watch the meter. |
| Readings drift over hours | Pack sagging *and* sensor under-volted | You're running direct off the pack. Use the boost. |
| Readings drift with the weather | Breather tube blocked | Keep the cable end dry and open to air. |
| Intermittent CRC failures | No common ground between boost rail and ESP | One ground rail. Everything joins it. |
| Value never changes | Wrong register | Back to Step 2b — poll a block, watch which one moves. |
| Level looks 10× or 100× off | Wrong scaling | Two-point calibrate, then verify with a third depth. |
| Value jumps wildly between two extremes | 32-bit value read as 16-bit | Try reading two consecutive registers as one 32-bit int/float. |

## Note on the existing module doc

`docs/01-water-tank-level-sensor.md` still describes an **HC-SR04 ultrasonic sensor on an ESP32** — a completely different design from what you actually bought. `hardware.md` records that you "went with RS485 variant," and this submersible hydrostatic transmitter is a better call for a real tank (no false echoes off tank walls, ripples, or foam). But that doc is now stale and will mislead anyone who reads it. Worth rewriting once this bench test passes and you know the real wiring and register map.
