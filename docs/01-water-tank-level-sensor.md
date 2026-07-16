---
# ---- Module Info ----
title: "Water Tank Level Sensor"
module_id: 1
difficulty: beginner
status: testing            # draft | in-progress | testing | complete

# ---- What It Does (plain language) ----
summary: >
  A sealed probe sits on the bottom of your water tank and feels the weight
  of the water above it. The deeper the water, the harder it presses. That
  reading is sent to your phone or computer so you can check your water level
  without climbing up to look.

# ---- Who Is This For? ----
target_user: "Any farmer who wants to know how much water is in their tank without climbing up to look."
prior_knowledge: "None. This is a first-time project."

# ---- Hardware ----
microcontroller: "ESP8266 (NodeMCU v3)"
sensors:
  - name: "QDY30A Submersible Hydrostatic Level Transmitter (RS485 variant)"
    purpose: "Sits on the tank floor and measures the depth of water above it"
    approx_cost_usd: null    # TODO: fill from the actual AliExpress order

other_parts:
  - name: "MAX485 module (TTL to RS485)"
    purpose: "Lets the ESP8266 talk to the sensor's RS485 wiring"
    quantity: 1
    approx_cost_usd: 2
  - name: "MT3608 boost converter"
    purpose: "Raises the battery's ~12V up to 18V, which the sensor needs"
    quantity: 1
    approx_cost_usd: 2
  - name: "Jumper wires"
    quantity: 8
    approx_cost_usd: 1
  - name: "Breadboard"
    quantity: 1
    approx_cost_usd: 3
  - name: "USB cable (Type-C)"
    quantity: 1
    approx_cost_usd: 2
  - name: "Waterproof enclosure / container"
    quantity: 1
    approx_cost_usd: 5

total_approx_cost_usd: null  # TODO: depends on the sensor price

# ---- Power ----
power_source: "IoT Solar Powerbank (Module 3), or any 12V battery / mains adapter"
power_notes: >
  The sensor needs 12-36V, which is MORE than the battery gives, so an MT3608
  boost converter lifts the rail to 18V. The ESP8266 runs from its own USB or
  3.3V supply — never feed it the 18V. The sensor itself draws very little
  (under 50mA).

# ---- Connectivity ----
connects_to: "Mobile WiFi Base Station (Module 4)"
protocol: "WiFi (sensor to ESP8266 is RS485 / Modbus RTU)"

# ---- Links (fill in as you go) ----
purchase_links:
  - "https://www.aliexpress.com/item/1005006415176688.html"   # QDY30A
  - "https://www.aliexpress.com/item/1005003716689999.html"   # MAX485
  - "https://www.aliexpress.com/item/1005006361814667.html"   # MT3608 boost
  - "https://www.aliexpress.com/item/1005006889833004.html"   # ESP8266 NodeMCU
video_tutorial_url: ""
source_code_url: ""

# ---- Tags ----
tags: ["water", "tank", "pressure", "hydrostatic", "rs485", "modbus", "beginner", "monitoring"]
---


# Water Tank Level Sensor

> **Difficulty:** Beginner | **Build time:** 1-2 hours
> **Status:** Bench-proven — comms, register map and calibration confirmed. Not yet field-deployed.


## What does this do?

A small sealed probe hangs down to the bottom of your water tank. Water is
heavy, so the deeper the water above the probe, the harder it pushes down on it.
The probe feels that push and turns it into a depth reading.

The reading is sent over WiFi so you can check the water level on your phone
or computer — no need to walk to the tank or climb up to look inside.


## Why would I want this?

- Know when your tank is getting low **before** you run out
- Keep a record of water use over days and weeks
- Save time — check from your house instead of walking to the tank
- Plan ahead for dry spells


## Why a pressure probe and not an ultrasonic one?

Most beginner tutorials use an ultrasonic sensor (like the HC-SR04) that sits on
the tank lid and bounces sound off the water. It is cheaper, and for a real farm
tank it is the wrong tool. **This module used to describe that design; we changed
it deliberately.**

| | Ultrasonic (from the top) | **Pressure probe (this module)** |
|---|---|---|
| How it measures | Times a sound echo off the water surface | Feels the weight of the water above it |
| Tank walls | Sound bounces off them — false readings | Doesn't care |
| Ripples, foam, floating debris | Scatter the echo | Doesn't care |
| Condensation on the sensor face | Blinds it | Sensor lives underwater anyway |
| Narrow or odd-shaped tanks | Struggles | Fine |
| Mounting | Needs a clear line of sight straight down | Just drop it in |
| Cost | Cheaper | More |
| Power | Runs off the board | Needs 12-36V (hence the boost converter) |

A tank is a hard place for an echo: it's an enclosed cylinder full of reflective
surfaces, and the water moves. A pressure probe ignores every one of those problems
because it doesn't look at the water — it sits underneath it.


## What you will need

| # | Part | What it does | Est. cost | Link to buy |
|---|------|-------------|-----------|-------------|
| 1 | ESP8266 NodeMCU board | The small computer that runs everything | ~$3 | [link](https://www.aliexpress.com/item/1005006889833004.html) |
| 2 | QDY30A pressure probe (**RS485 version**) | Sits on the tank floor, measures water depth | *(TBC)* | [link](https://www.aliexpress.com/item/1005006415176688.html) |
| 3 | MAX485 module | Lets the ESP8266 talk to the probe | ~$2 | [link](https://www.aliexpress.com/item/1005003716689999.html) |
| 4 | MT3608 boost converter | Lifts battery voltage to the 18V the probe needs | ~$2 | [link](https://www.aliexpress.com/item/1005006361814667.html) |
| 5 | Jumper wires (x8) | Connects everything | ~$1 | *(add link)* |
| 6 | Breadboard | Lets you connect parts without soldering | ~$3 | *(add link)* |
| 7 | USB cable | Powers the ESP8266 and loads code onto it | ~$2 | *(add link)* |
| 8 | Waterproof container | Protects the electronics from rain and humidity | ~$5 | *(add link)* |

> **Buy the RS485 version.** These probes are sold with several different outputs
> (4-20mA, 0-5V, 0-10V, RS485). Only the RS485 one works with this guide. Check the
> listing options before you pay.


## How it works (the simple version)

```
        [ ESP8266 ]  ---WiFi--->  [ Your phone / computer ]
             |
        [ MAX485 ]                  [ Battery ] --> [ MT3608 boost ]
             |                                            |
             |  (RS485: two wires)                        |  18V
             +--------------------+-----------------------+
                                  |
                          ~~~~ water surface ~~~~
                                  |
                                  |  <-- the deeper this is,
                                  |      the harder the push
                                  v
                          [ probe on tank floor ]
```

1. Water pushes down on the probe. More water = more push.
2. The probe turns that push into a depth number.
3. The ESP8266 asks the probe for that number over RS485 (a two-wire connection
   that works fine over long cable runs — important, because your tank is probably
   not next to your electronics).
4. The ESP8266 sends the result over WiFi to your dashboard.

**What it actually measures is the depth of water *above the probe*** — not "how
full the tank is". To turn depth into a percentage you also need to know how tall
your tank is. That's a number you measure once and put in the code.


## Step-by-step build guide

> **The full bench walkthrough is [`docs/bench/02-bench-water-level-rs485.md`](bench/02-bench-water-level-rs485.md).**
> It covers proving the sensor from a laptop before the ESP8266 is involved, which is
> the fastest way to find a wiring mistake. Do that first if anything here goes wrong.

### Step 1 — Set the boost converter to 18V *before* the probe exists

This is the step where you can actually damage something. The MT3608's little screw
ships at a random setting.

1. Connect your battery to the MT3608 **IN+ / IN−**. Nothing on the output.
2. Put a multimeter across **OUT+ / OUT−**.
3. Turn the screw. It's a multi-turn trimmer — expect **many** rotations before
   anything moves, and it may go the wrong way first. Watch the meter, not the screw.
4. Settle on a steady **18.0V**, then power down.
5. *Now* connect the probe.

> **Gotcha we hit:** the trimmer feels like it does nothing. Cheap ones slip at the
> end stops, so it spins freely while the wiper sits parked. Pick one direction and
> turn ~30 full turns slowly, watching the meter. It eventually climbs.

### Step 2 — Wire it up

The probe has four wires:

| Probe wire | Goes to |
|---|---|
| **Red** | MT3608 **OUT+** (18V) |
| **Green** | MT3608 **OUT−** *and* the common ground |
| **Blue** | MAX485 **A** |
| **Yellow** | MAX485 **B** |

And the MAX485 to the ESP8266:

| MAX485 pin | ESP8266 pin |
|---|---|
| RO | D5 |
| DI | D6 |
| DE + RE (joined) | D1 |
| VCC | **3V3** |
| GND | GND |

> **The 18V goes to the probe's red wire and nowhere else.** The MAX485 and the
> ESP8266 are 3.3V parts — 18V will destroy both. Trace the wire with your finger
> before switching on.

> **One ground, not two.** The probe's green wire, the MT3608's OUT−, the MAX485's
> GND and the ESP8266's GND must all be connected together. The probe runs off the
> boosted rail while the ESP runs off USB — two supplies, but they need one shared
> reference. Miss this and you get readings that fail randomly and look exactly like
> a broken sensor.

### Step 3 — Load the code

*(Firmware to be added — the choice of framework is still being confirmed.
The bench guide has a minimal Arduino sketch that reads the sensor and prints
to serial, which is enough to prove your wiring.)*

The settings your code needs:

| Setting | Value |
|---|---|
| Baud rate | **9600** |
| Slave address | 1 |
| Register to read | `0x0004` |
| Scaling | **1 count = 1 mm** |

> **Note the baud rate.** The soil sensor in Module 2 runs at **4800**. This one is
> **9600**. Same wiring, different speed — don't copy the number across.

### Step 4 — Zero it

Read the probe while it's **dry, sitting in air**. It will not read zero — ours read
about **26**, which is 26mm of water that doesn't exist. That's normal and within the
manufacturer's spec.

Write that number down. Your depth is:

```
depth_mm = reading - dry_reading
```

Do this once at install. If the readings drift over months, do it again.

### Step 5 — Check it moves

Lower the probe into a bucket of water. The number should climb clearly, hold steady
when it stops moving, and fall back when you lift it out. If it doesn't respond to
depth, stop — nothing after this will work.

### Step 6 — Install on your tank

- Lower the probe to the **bottom** of the tank and let it sit flat.
- **Keep the loose end of the cable dry and open to the air.** There is a tiny breather
  tube running through it, and the probe needs it to compare against outside air
  pressure. Seal it, kink it, or let it sit in water and your readings will wander with
  the weather.
- Protect the ESP8266, MAX485 and boost converter inside the waterproof container.
- Measure your tank's water depth when full, once. That's what turns millimetres into
  "how full is my tank".

### Step 7 — Connect to WiFi

*(Instructions for connecting to the Mobile WiFi Base Station will be added)*


## How accurate is it?

**About ±25mm** (±2.5cm) — that's the manufacturer's spec (0.5% of its 5-metre range),
and it's far better than you need. Nobody irrigating a field cares whether the tank is
at 1.475m or 1.500m.

Don't try to do better than that. We tried calibrating ours in a bucket against a ruler
and learned the hard way that a 90mm bucket can't measure an instrument whose own error
bar is 25mm. The bench guide has the full story.


## Troubleshooting

| Problem | Possible cause | What to try |
|---------|---------------|-------------|
| No reading at all | A and B swapped | Swap the blue and yellow wires. This is common — try it before anything else. |
| No reading, probe cold | Not enough voltage | Meter red to green: it must read **18V**, not the raw battery. |
| Boost converter reads 0V | Trimmer at the bottom of its range | It's multi-turn. Keep turning, watch the meter. |
| Readings 10x off | Wrong scaling in the code | 1 count = 1mm. Check you're not treating the number as centimetres. |
| Reading is about 65000 | The number was read as unsigned | It's signed. Readings slightly below zero are real and legitimate. |
| Reading never changes | Reading the wrong register | It's `0x0004`. |
| Readings fail randomly | No common ground | The probe's green wire, boost OUT−, MAX485 GND and ESP GND must all be one rail. |
| Drifts with the weather | Breather tube blocked or wet | Keep the loose cable end dry and open to air. |
| Settings lost after power cut | Change was never saved | After any settings write, write `0` to register `0x000F` to store it. |


## How this connects to the other modules

This module works on its own, but it works even better with:

- **Module 3 — IoT Solar Powerbank:** Powers this sensor off-grid with solar
- **Module 4 — Mobile WiFi Base Station:** Receives the sensor data and lets
  you view it on your phone


## Notes and learnings

- **We changed sensors partway.** This module originally specified an HC-SR04
  ultrasonic sensor on an ESP32. We switched to a submersible pressure probe on an
  ESP8266 because a tank is full of reflective surfaces and moving water, which is
  exactly what an echo-based sensor is worst at.
- **The probe's manual has no Modbus section.** The register map came from the
  community and we confirmed it against our own unit. It was correct. See the bench
  guide's provenance section.
- **Reads are safe, blind writes are not.** Reading registers cannot damage the sensor.
  Writing to one you haven't confirmed can land on its address or baud rate and lose
  you the ability to talk to it at all.
- **±25mm is the floor, and it's fine.** See "How accurate is it?" above.


---

**License:** Open source — use, share, and adapt freely.
**Project:** [Farmers IoT Toolkit](https://github.com/sunriselabs)
