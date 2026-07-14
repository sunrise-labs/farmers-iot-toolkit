# Bench Rig — Shared Setup

> Read this once. Both sensor bench guides build on it.
> **Guides:** [Soil sensor](01-bench-soil-sensor-rs485.md) · [Water level sensor](02-bench-water-level-rs485.md)

## The power problem, and why the two sensors differ

You don't have a bench 12 V supply. You have the **3S2P Li-ion pack**. That pack is:

| State | Voltage |
|---|---|
| Full charge | 12.6 V |
| Nominal | 11.1 V |
| Empty (cutoff) | ~9.0 V |

Now compare that against what each sensor demands — straight from the manuals in `hardware/`:

| Sensor | Spec'd supply | Pack direct? |
|---|---|---|
| Soil THC-S | **DC 4.5–30 V** | **Yes.** Any pack state is comfortably in range. |
| Water level QDY30A | **DC 12–36 V** (24 V standard) | **No.** |

That second row is the thing to notice. Your pack only clears the QDY30A's 12 V minimum when it's near *full*. The moment it sags to 11.5 V — which is most of its useful life — the sensor is **under-volted and out of spec**. It might return nothing, or worse, it might return readings that look plausible and drift as the pack discharges. A sensor that fails cleanly is annoying; one that lies to you quietly will cost you a day.

**So: the soil sensor runs off the pack directly, and the water sensor runs off the pack through the MT3608 boost converter set to 24 V.** You already own the MT3608. This is exactly the job it's for.

## Parts you'll pull from the kit

- 3S2P Li-ion pack
- NodeMCU v3 ESP8266 (CH340, USB-C)
- MAX485 TTL↔RS485 module
- MT3608 boost converter — **water sensor only**
- FT232 USB→RS485 adapter — for Step 0 (see below)
- Multimeter — **not optional**, you need it to set the boost output
- Breadboard, jumpers

## Step 0 — Prove the sensor works *before* the ESP8266 is involved

Do not skip this. If you wire sensor + MAX485 + ESP8266 all at once and get silence, you have five suspects: sensor, power, A/B swap, MAX485, firmware. You will burn hours.

Instead use the **FT232 USB→RS485 adapter** to talk to the sensor straight from your laptop. Two suspects, not five.

```bash
sudo pacman -S mbpoll        # Arch
sudo usermod -aG uucp $USER  # serial port access; log out/in after
```

Wire sensor A→A, B→B into the FT232, power the sensor per its guide, then poll. Each sensor guide gives you the exact `mbpoll` command.

Once the laptop can read the sensor, *and only then*, move to the ESP8266. Now any failure is firmware or MAX485 wiring — and you already know the sensor and your A/B orientation are good.

## ESP8266 ↔ MAX485 wiring (identical for both sensors)

The ESP8266 has one usable hardware UART and it's already committed to USB debug output. So RS485 goes on **SoftwareSerial**, and debug stays on USB where you can see it.

| MAX485 pin | NodeMCU pin | GPIO | Why |
|---|---|---|---|
| RO (receive out) | D5 | GPIO14 | SoftwareSerial RX |
| DI (driver in) | D6 | GPIO12 | SoftwareSerial TX |
| DE + RE (tied together) | D1 | GPIO5 | direction control — one pin drives both |
| VCC | **3V3** | — | see warning below |
| GND | GND | — | |

**Tie DE and RE together** with a jumper and drive both from D1. RS485 is half-duplex: HIGH = transmit, LOW = receive. The firmware handles the flipping.

> **Power the MAX485 from 3V3, not 5V.** At 5 V its RO pin outputs 5 V logic into an ESP8266 pin rated for 3.3 V. That's how you cook a GPIO. If your particular module misbehaves at 3.3 V and you must run it at 5 V, put the 4-channel level shifter between RO and D5 — don't wire it direct.

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
       └────────────┼──► [MT3608 boost] ──── 24.0V ────────► Water V+ (red)  │
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
- **[Water level bench guide](02-bench-water-level-rs485.md)** — do this second. Needs the 24 V boost, and its register map is *not* in the manual — it's reconstructed from community sources, so there's a confirm-and-calibrate step.

One thing to carry between them: **the two sensors run at different baud rates.** Soil THC-S is **4800**, water QDY30A is **9600**. Same bus wiring, different constant — don't copy it across.
