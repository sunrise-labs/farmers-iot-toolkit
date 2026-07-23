# Bench Rig — Shared Setup

> Read this once. Both sensor bench guides build on it.
> **Guides:** [Soil sensor](01-bench-soil-sensor-rs485.md) · [Water level sensor](02-bench-water-level-rs485.md)
> **Independent of this rig:** [Base-station phone power](03-bench-phone-power.md) — needs no RS485 chain, so it can run while sensor work is blocked.

## The power problem, and why the two sensors differ

You don't have a bench 12 V supply. You have the **3S2P Li-ion pack**. That pack is:

| State | Voltage |
|---|---|
| Full charge | 12.6 V |
| Nominal | 10.95 V |
| Empty (cutoff) | ~9.0 V |

(Cells are Samsung INR18650-32E — 3200 mAh, 3.65 V nominal, so the pack is 6.4 Ah / **~70 Wh**.
Datasheet in `hardware/`, pack details in `hardware/3S2P.md`.)

Now compare that against what each sensor demands — straight from the manuals in `hardware/`:

| Sensor | Spec'd supply | Pack direct? |
|---|---|---|
| Soil THC-S | **DC 4.5–30 V** | **Yes.** Any pack state is comfortably in range. |
| Water level QDY30A | **DC 12–36 V** (24 V standard) | **No.** |

That second row is the thing to notice. Your pack only clears the QDY30A's 12 V minimum when it's near *full*. The moment it sags to 11.5 V — which is most of its useful life — the sensor is **under-volted and out of spec**. It might return nothing, or worse, it might return readings that look plausible and drift as the pack discharges. A sensor that fails cleanly is annoying; one that lies to you quietly will cost you a day.

**So: the soil sensor runs off the pack directly, and the water sensor runs off the pack through the MT3608 boost converter set to 18 V.** You already own the MT3608. This is exactly the job it's for.

## Parts you'll pull from the kit

- 3S2P Li-ion pack
- NodeMCU v3 ESP8266 (CH340, USB-C)
- MAX485 TTL↔RS485 module
- MT3608 boost converter — **water sensor only**
- FT232 USB→RS485 adapter — for Step 0 (see below)
- Multimeter — **not optional**, you need it to set the boost output
- Breadboard, jumpers

## Step 0 — Prove the sensor works *before* the ESP8266 is involved

### Why bother

If you wire sensor + MAX485 + ESP8266 all at once and get nothing back, you have **five** suspects and no way to tell them apart: dead sensor, wrong power, A/B swapped, MAX485 miswired, firmware bug. Every fix you try changes two things at once. This is how a two-hour job becomes a weekend.

Step 0 removes the ESP8266 and the MAX485 entirely. **Your laptop talks to the sensor directly** through the FT232 USB→RS485 adapter. If you get a reading, you have proven — with certainty — that the sensor works, your power is right, and your A/B orientation is correct. Three suspects eliminated. Whatever breaks later is firmware or MAX485 wiring, and you'll know it.

Don't skip this even though it feels like a detour. It is the shortest path.

### What the FT232 adapter is

It's the small board with a **USB plug on one end and screw terminals on the other**. Yours is the dual-function FT232RL + SN75176 module. It replaces the *whole* ESP8266 side of the rig: your laptop becomes the Modbus master.

Look at the screw terminals. On the RS485 side you want the two marked **`A`** and **`B`** (sometimes `A+`/`B-`, or `D+`/`D-`). There's usually a `GND` terminal too. Ignore the TTL-side pins (`TXD`, `RXD`, `VCC`, `3V3`) entirely — you're not using them.

> Some dual-function modules have a **jumper or solder pad to select TTL vs RS485 mode**. Look yours over. If there's a jumper, make sure it's set to RS485 before you wonder why nothing works.

### 0.1 — Install the tool

`mbpoll` is a command-line Modbus client. It is **not in the official Arch repos** — it's in the AUR, and you already have `yay`:

```bash
yay -S mbpoll-git
```

You are **already in the `uucp` group** (that's what grants access to serial ports on Arch), so there's nothing to do there. If you ever hit a "permission denied" on `/dev/ttyUSB0`, that's the group to check — but you're set.

### 0.2 — Plug in the adapter and find its device name

Plug the FT232 into a USB port with **nothing else attached to it yet**. Then:

```bash
ls /dev/ttyUSB*
```

You should see `/dev/ttyUSB0`. That's the adapter — the `ftdi_sio` kernel driver claims it automatically, no setup needed.

If nothing appears, watch the kernel as you plug it in:

```bash
sudo dmesg -w        # leave this running, then plug the adapter in
```

You want a line like `FTDI USB Serial Device converter now attached to ttyUSB0`. If you see nothing at all, it's a dead cable or a charge-only USB lead — try another cable before suspecting the adapter.

If you already have *other* USB serial devices plugged in (the NodeMCU, for instance), the adapter might land on `ttyUSB1` instead. Unplug everything else for this step so there's no ambiguity.

### 0.3 — Wire the sensor to the adapter

Four connections. Power comes from the pack (soil) or the boost converter (water) — **not from the adapter**, which cannot supply enough.

```
                              ┌──────────────────────┐
   [ SENSOR ]                 │  FT232 USB→RS485     │──USB──► your laptop
       │                      │                      │
       ├── A wire ────────────┤ A                    │
       ├── B wire ────────────┤ B                    │
       │                      │                      │
       ├── V+ ────────────────┼──────────────┐       │
       │                      │              │       │
       └── V− ──┬─────────────┤ GND          │       │
                │             └──────────────┼───────┘
                │                            │
                └──► COMMON GROUND ◄─────────┴── [ power source ]
                                                 pack (soil)
                                                 or MT3608 @ 18V (water)
```

Which wire is which, per sensor:

| | Soil THC-S | Water QDY30A |
|---|---|---|
| **A** | **yellow** | **blue** |
| **B** | **blue** | **yellow** |
| **V+** | brown | red |
| **V−** | black | green |

> Yes, really — **the A/B colours are opposite between the two sensors.** This is a genuinely nasty trap and it's not your fault. Read that table twice.

**The sensor's V− must connect to *both* the power source's negative *and* the adapter's GND.** This is the common-ground rule from below, and it is the single most common reason a correctly-wired bench rig returns nothing. Two devices cannot agree on a signal if they don't agree on what zero volts means.

Now plug the USB in and power the sensor.

### 0.4 — Poll it

Each sensor guide gives you the exact command, but here's the shape so the flags aren't a mystery:

```bash
mbpoll -m rtu -a 1 -b 4800 -P none -d 8 -s 1 -t 4 -r 1 -c 3 /dev/ttyUSB0
```

| Flag | Means |
|---|---|
| `-m rtu` | Modbus RTU (serial), not TCP |
| `-a 1` | slave **a**ddress 1 — the sensor's ID on the bus |
| `-b 4800` | **b**aud rate. **Soil = 4800, water = 9600.** Different! |
| `-P none` | **P**arity: none |
| `-d 8` `-s 1` | 8 **d**ata bits, 1 **s**top bit |
| `-t 4` | register type 4 = **holding registers** |
| `-r 1` | start at **r**egister 1 |
| `-c 3` | read a **c**ount of 3 registers |
| `/dev/ttyUSB0` | the adapter |

> **The off-by-one that will confuse you:** `mbpoll` numbers registers from **1**, but the sensor manuals number them from **0**. So `-r 1` reads register `0x0000`, and `-r 5` reads register `0x0004`. Not a bug — just two conventions meeting.

### 0.5 — Reading the result

**Success looks like this** — a value per register, updating every second:

```
-- Polling slave 1... Ctrl-C to stop)
[1]:    658
[2]:    210
[3]:    1000
```

**Failure looks like this:**

```
Read output (holding) register failed: Connection timed out
```

That timeout means *the sensor did not answer*. It does **not** mean the sensor is broken — work the list below.

### 0.6 — When it times out

Work these in order. The first two fix the overwhelming majority of cases.

1. **Swap A and B.** Undo the two data wires and swap them. This is the #1 RS485 fault, it's completely harmless to try, and it costs thirty seconds. Do it before anything clever.
2. **Check the common ground.** Meter between the sensor's V− and the adapter's GND terminal — you want continuity (near 0 Ω). No shared ground, no communication.
3. **Check the sensor has power.** Meter across the sensor's V+ and V−. Soil: expect pack voltage (9–12.6 V). Water: expect **18 V** from the boost. A sensor with no power is silent and looks exactly like a wiring fault.
4. **Check the baud rate.** Soil is **4800**, water is **9600**. Try the other one — a previous owner or a factory batch can differ.
5. **Check the device name.** `ls /dev/ttyUSB*` — are you actually talking to `ttyUSB0`?
6. **Check the mode jumper** on the adapter, if it has one. TTL mode won't drive the RS485 lines.
7. **Sweep the address.** If the sensor was ever reconfigured, its address may not be 1:
   ```bash
   for addr in $(seq 1 16); do
     timeout 1 mbpoll -m rtu -a $addr -b 4800 -P none -t 4 -r 1 -c 1 -1 /dev/ttyUSB0 2>/dev/null \
       | grep -q '\[' && echo "FOUND at address $addr"
   done
   ```
   (`-1` means poll once and exit.) Re-run with `-b 9600` if 4800 finds nothing.

### 0.7 — Prove the reading is real

A number on screen is not yet a working sensor. **Make it move.** Squeeze the soil probe in a damp hand; dunk the water probe in a bucket. If the value doesn't respond to the physical world, you're looking at a stale buffer or the wrong register — not a measurement.

Each sensor guide tells you exactly what to expect here.

### Only now move to the ESP8266

Once the laptop reads the sensor and the value tracks reality, you're done with Step 0. You now **know**:

- the sensor is alive and correctly powered
- your A/B orientation is right
- the baud rate and slave address are right
- the register you're reading is the right one

Carry those four facts to the ESP8266. If it then fails, the fault is in the MAX485 wiring or the firmware — and you have a *two*-suspect problem instead of a five-suspect one. That's the whole point.

## ESP8266 ↔ MAX485 wiring (identical for both sensors)

The ESP8266 has one usable hardware UART and it's already committed to USB debug output. So RS485 goes on **SoftwareSerial**, and debug stays on USB where you can see it.

### ⚠️ First: which MAX485 module did you actually get?

The AliExpress listing in `hardware.md` ships **two physically different boards** under the same name, and they wire up differently. **Count the control pins before you wire anything.**

| | **Classic breakout** | **Auto-direction (HW-0519)** |
|---|---|---|
| How to spot it | Has a pin labelled **DE** and one labelled **RE** | **No DE, no RE.** Silkscreen says `HW-0519`. Carries an extra 14-pin `74HC04D` inverter |
| TTL pins | RO, RE, DE, DI, VCC, GND | GND, RXD, TXD, VCC |
| RS485 pins | A, B | A+, B−, 接大地 (earth/shield) |
| Direction control | **You** drive DE/RE from a GPIO | The board does it itself from the TXD line |

We received the **HW-0519**. Both work; the wiring differs.

### If yours is the classic breakout (has DE/RE)

| MAX485 pin | NodeMCU pin | GPIO | Why |
|---|---|---|---|
| RO (receive out) | D5 | GPIO14 | SoftwareSerial RX |
| DI (driver in) | D6 | GPIO12 | SoftwareSerial TX |
| DE + RE (tied together) | D1 | GPIO5 | direction control — one pin drives both |
| VCC | **3V3** | — | see warning below |
| GND | GND | — | |

**Tie DE and RE together** with a jumper and drive both from D1. RS485 is half-duplex: HIGH = transmit, LOW = receive. The firmware handles the flipping.

### If yours is the HW-0519 (no DE/RE) ← what we have

| HW-0519 pin | NodeMCU pin | GPIO | Why |
|---|---|---|---|
| RXD | D5 | GPIO14 | SoftwareSerial RX — the module's output to you |
| TXD | D6 | GPIO12 | SoftwareSerial TX — the module's input from you |
| VCC | **3V3** | — | see warning below |
| GND | GND | — | |
| A+ | — | — | to the sensor's A wire |
| B− | — | — | to the sensor's B wire |
| 接大地 | *(nothing)* | — | "connect to earth" — cable shield for long field runs. Leave it floating on the bench. |

**D1 goes unused.** The firmware still toggles it as a DE pin, which is harmless — it wiggles a disconnected pin. There is nothing to connect it to.

**If you get silence, swap D5 and D6.** The TXD/RXD labels on these boards are inconsistent about whose perspective they're from. Both are logic-level pins, so trying it costs nothing.

> **The TXD/RXD LEDs are a free logic analyser.** TXD flashes when the ESP asks a question; RXD flashes when the sensor answers.
> - Neither blinks → the ESP isn't reaching the module. Check D5/D6 and VCC.
> - TXD blinks, RXD doesn't → the sensor isn't replying. Swap A and B.
> - Both blink → you're talking. Any remaining problem is baud, address, or registers.

> ⚠️ **Auto-direction boards echo your own transmission back.** Both the HW-0519 and the FT232 USB adapter do this — it's the same fault that made `mbpoll` report "Invalid CRC" on every frame (see `devlog.md` 2026-07-15). Your reader must **resync on a valid frame header** inside the receive buffer instead of assuming the reply starts at byte 0. `tools/poll-soil.ts` and the module firmware both do this. If you write your own, expect it.

### Both variants

> **Power the MAX485 from 3V3, not 5V.** At 5 V its RO/RXD pin outputs 5 V logic into an ESP8266 pin rated for 3.3 V. That's how you cook a GPIO. If your particular module misbehaves at 3.3 V and you must run it at 5 V, put the 4-channel level shifter between that pin and D5 — don't wire it direct.

**Avoid GPIO0, GPIO2, GPIO15.** They're boot-strapping pins; a sensor pulling one at reset stops the board booting. D5/D6/D1 as above are safe.

## The ground rule that catches everyone

**The sensor's negative, the MAX485's GND, and the ESP8266's GND must all be the same ground.** During bench testing your ESP is powered by USB from the laptop while the sensor is powered by the pack — two separate sources. RS485 is a *differential* signal but it still needs a shared reference. Without a common ground you get garbage, intermittent reads, or nothing at all, and the wiring will look perfectly correct.

Run one jumper from pack negative to the ESP8266 GND rail. Do it before you power anything.

## Bench power topology

```
                    ┌─────────────────────────── SOIL SENSOR ONLY ───────────┐
                    │                                                        │
  [3S2P pack]───────┼──── 9.0–12.6V ────────────────────────► Soil V+ (brown)│
   9.0–12.6V        │                                                        │
       │            └────────────────────────────────────────────────────────┘
       │
       │            ┌─────────────────────────── WATER SENSOR ONLY ──────────┐
       └────────────┼──► [MT3608 boost] ──── 18.0V ────────► Water V+ (red)  │
       │            │     set with multimeter BEFORE                         │
       │            │     connecting the sensor                              │
       │            └────────────────────────────────────────────────────────┘
       │
       ├── pack negative ──────► COMMON GROUND RAIL ◄──── ESP8266 GND
       │                              ▲                    (USB-powered
       │                              │                     from laptop)
       │                         MAX485 GND
       │
       └── (later, off-bench) ──► [Mini360 buck] ── 5V ──► ESP8266 VIN
```

For bench work, just power the ESP8266 from your laptop's USB — you need the USB cable for serial output anyway. The Mini360 buck is for the field build, when there's no laptop.

## Reading the RS485 frames

Both sensors speak **Modbus RTU**. Every request is the same shape:

```
[addr] [function] [reg hi] [reg lo] [count hi] [count lo] [crc lo] [crc hi]
```

The soil sensor's manual has a **typo worth knowing about**: its register table says "read function code: 0x30, write function code: 0x60". That's wrong. The worked examples further down the same manual use **0x03 (read) and 0x06 (write)**, which are the standard Modbus codes. Use 0x03 and 0x06. If you'd trusted the table you'd have gotten an illegal-function exception and no explanation.

## Where to go next

- **[Soil sensor bench guide](01-bench-soil-sensor-rs485.md)** — start here. Fully documented register map, runs straight off the pack, no boost converter. It's the easier win and it validates your whole RS485 chain.
- **[Water level bench guide](02-bench-water-level-rs485.md)** — do this second. Needs an 18 V boost, and its register map is *not* in the manual — it's reconstructed from community sources, so there's a confirm-and-calibrate step.

One thing to carry between them: **the two sensors run at different baud rates.** Soil THC-S is **4800**, water QDY30A is **9600**. Same bus wiring, different constant — don't copy it across.
