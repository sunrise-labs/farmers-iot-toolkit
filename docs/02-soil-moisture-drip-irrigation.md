---
# ---- Module Info ----
title: "Soil Moisture Sensor to Drip Irrigation Valve"
module_id: 2
difficulty: advanced
status: in-progress        # draft | in-progress | testing | complete

# ---- What It Does (plain language) ----
summary: >
  A sealed probe buried at root depth measures how much water is actually in
  your soil, along with its temperature and how salty it is. When the soil
  dries past the level you set, the system opens a valve and waters your drip
  line. When the soil is wet enough, it closes it again.

# ---- Who Is This For? ----
target_user: "Farmers who use drip irrigation and want to water automatically based on what the soil actually needs."
prior_knowledge: "Build Module 1 first. It teaches the same RS485 wiring with none of the risk, because nothing floods if you get it wrong."

# ---- Hardware ----
microcontroller: "ESP8266 (NodeMCU v3)"
sensors:
  - name: "CWT-Soil-THC-S soil sensor (RS485 variant)"
    purpose: "Buried at root depth — reads soil moisture, temperature and EC"
    approx_cost_usd: null    # TODO: fill from the actual AliExpress order

actuators:
  - name: "12V Solenoid Valve (normally closed)"
    purpose: "Opens and closes to control water flow into the drip line"
    approx_cost_usd: 8
  - name: "Relay module (1-channel)"
    purpose: "Lets the ESP8266 safely switch the 12V valve on and off"
    approx_cost_usd: 2

other_parts:
  - name: "MAX485 module (TTL to RS485)"
    purpose: "Lets the ESP8266 talk to the sensor's RS485 wiring"
    quantity: 1
    approx_cost_usd: 2
  - name: "1N5819 flyback diode"
    purpose: "Absorbs the voltage spike the valve coil throws when it closes"
    quantity: 1
    approx_cost_usd: 1
  - name: "Jumper wires"
    quantity: 10
    approx_cost_usd: 1
  - name: "Breadboard"
    quantity: 1
    approx_cost_usd: 3
  - name: "12V power supply or battery"
    quantity: 1
    approx_cost_usd: 8
  - name: "USB cable (Type-C)"
    quantity: 1
    approx_cost_usd: 2
  - name: "Hose fittings / connectors for the solenoid valve"
    quantity: 1
    approx_cost_usd: 5
  - name: "Waterproof enclosure / container"
    quantity: 1
    approx_cost_usd: 5

total_approx_cost_usd: null  # TODO: depends on the sensor price

# ---- Power ----
power_source: "IoT Solar Powerbank (Module 3) for the sensor and ESP8266; see the power note for the valve"
power_notes: >
  The sensor is the easy part — it takes 4.5-30V, and the 3S2P pack swings
  9.0-12.6V, so the pack feeds it directly with margin at both ends. No boost,
  no buck. The valve is the hard part: a 12V solenoid on a pack that sags to
  9.0V when flat may not actually pull in. That is an open question, not a
  solved one - see "Powering the valve" below. Never feed 12V to the ESP8266.

# ---- Connectivity ----
connects_to: "Mobile WiFi Base Station (Module 4)"
protocol: "WiFi (sensor to ESP8266 is RS485 / Modbus RTU)"

# ---- Links (fill in as you go) ----
purchase_links:
  - "https://www.aliexpress.com/item/1005001524845572.html"   # THC-S soil sensor
  - "https://www.aliexpress.com/item/1005003716689999.html"   # MAX485
  - "https://www.aliexpress.com/item/1005006889833004.html"   # ESP8266 NodeMCU
  - "https://www.aliexpress.com/item/1005006146766362.html"   # 12V solenoid valve
  - "https://www.aliexpress.com/item/1005001552094086.html"   # 1N5819 diode
video_tutorial_url: ""
source_code_url: ""

# ---- Tags ----
tags: ["soil", "moisture", "irrigation", "drip", "valve", "solenoid", "rs485", "modbus", "automation", "advanced"]
---


# Soil Moisture Sensor to Drip Irrigation Valve

> **Difficulty:** Advanced | **Build time:** 3-5 hours
> **Status:** Sensor is bench-proven from a laptop. The ESP8266 node and the valve
> half are not built yet — see "What is actually proven" below before you rely on this.


## What is actually proven

Being straight with you about which parts of this guide are tested, because the
difference matters when something doesn't work:

| Part | State |
|---|---|
| Sensor reads over RS485 from a laptop | ✅ Proven on our bench — moisture, temperature and EC all respond |
| Wiring, register map, baud rate | ✅ Confirmed against our own unit |
| ESP8266 reads the sensor via MAX485 | ⏳ Not yet — but the identical chain is proven in Module 1 |
| Firmware | ⏳ Not written. `firmware/soil-moisture/` does not exist yet |
| Relay + valve | ⏳ Not built |
| Powering the valve from the solar pack | ⚠️ Open question, see below |

Steps 1-3 rest on work we've done. Steps 4 onward are the design, not a report.


## What does this do?

A sealed probe buried at root depth measures how much water is actually in the
ground around your plants. When the soil dries past a level you choose, the
ESP8266 opens a valve and lets water into your drip line. When the soil comes
back up to wet enough, it closes it.

You set what "dry" and "wet" mean. The system does the rest, and reports what
it's doing over WiFi so you can see it from your phone.

The probe also reports **soil temperature** and **EC** (electrical conductivity,
which tracks how much dissolved salt and fertiliser is in your soil). You get
those free — same sensor, same wire.


## Why would I want this?

- Water your crops only when they actually need it — no guessing
- Save water by not over-irrigating
- Keep soil moisture consistent, which helps plants grow better
- Free up your time — no manually turning irrigation on and off
- Reduce runoff and waterlogging
- Spot fertiliser and salt build-up before it hurts your yield (that's the EC reading)


## Why this sensor and not the cheap capacitive one?

Nearly every beginner tutorial uses a **capacitive soil moisture sensor v1.2** — a
flat board you push in the dirt, wired to an analog pin. It costs about $3. **This
module used to describe that design; we changed it deliberately.**

| | Capacitive v1.2 | **THC-S over RS485 (this module)** |
|---|---|---|
| What you get back | An arbitrary number (say "512") | Calibrated **%RH**, plus °C and EC |
| Meaning | None until *you* calibrate it, per soil type | Real units out of the box |
| Buried for a season | Exposed traces corrode; readings drift | Sealed stainless probe, built to live in soil |
| Cable run to the field | Analog over long wire picks up noise | RS485 is a differential pair — designed for long runs |
| On an ESP8266 | Awkward — one ADC pin, 0-1V, needs a divider | Two GPIO pins, no analog at all |
| Extra data | None | Soil temperature and EC, free |
| Cost | Cheaper | More |

The deciding argument is the second row. A capacitive sensor hands you a number
with no physical meaning, and the only way to give it one is to calibrate against
your own soil — then recalibrate when the traces corrode, which they will, because
you buried bare copper in wet dirt. **The number degrades and nothing tells you.**

For a toolkit meant to be handed to someone else and left in a field, a sealed
probe that reports actual percent is worth the money. It also means your irrigation
threshold is a number a person can reason about ("water below 30%") rather than an
ADC count that means nothing to anyone but the person who calibrated it.

> **We also moved from the ESP32 to the ESP8266** so this module runs the same board
> as Module 1 — one toolchain, one set of gotchas, one firmware pattern to learn.
> Once the sensor speaks RS485 there's nothing left that needs the ESP32's extra pins.


## What you will need

| # | Part | What it does | Est. cost | Link to buy |
|---|------|-------------|-----------|-------------|
| 1 | ESP8266 NodeMCU board | The small computer that runs everything | ~$3 | [link](https://www.aliexpress.com/item/1005006889833004.html) |
| 2 | THC-S soil sensor (**RS485 version**) | Buried at root depth, reads moisture/temp/EC | *(TBC)* | [link](https://www.aliexpress.com/item/1005001524845572.html) |
| 3 | MAX485 module | Lets the ESP8266 talk to the sensor | ~$2 | [link](https://www.aliexpress.com/item/1005003716689999.html) |
| 4 | 12V solenoid valve (normally closed) | Opens to let water through, closes to stop it | ~$8 | [link](https://www.aliexpress.com/item/1005006146766362.html) |
| 5 | 1-channel relay module | Lets the ESP8266 safely switch the 12V valve | ~$2 | *(add link)* |
| 6 | 1N5819 diode | Absorbs the coil spike when the valve closes | ~$1 | [link](https://www.aliexpress.com/item/1005001552094086.html) |
| 7 | Jumper wires (x10) | Connects everything | ~$1 | *(add link)* |
| 8 | Breadboard | Lets you connect parts without soldering | ~$3 | *(add link)* |
| 9 | 12V power supply or battery | Powers the valve | ~$8 | *(add link)* |
| 10 | USB cable | Powers the ESP8266 and loads code onto it | ~$2 | *(add link)* |
| 11 | Hose fittings / connectors | Attaches the valve to your drip line | ~$5 | *(add link)* |
| 12 | Waterproof container | Protects the electronics | ~$5 | *(add link)* |

> **Buy the RS485 version.** This sensor is sold with several different outputs
> (4-20mA, 0-5V, RS485). Only the RS485 one works with this guide. Some listings
> also add pH and NPK — you don't need those, and the ones that claim NPK on a cheap
> probe are guessing it from EC anyway. Check the listing options before you pay.

> **Get a normally-closed valve.** "Normally closed" means no power = shut. If your
> ESP8266 crashes, the battery dies, or a wire falls out, the water stops instead of
> running all night. That's not a preference, it's the safety property this whole
> module rests on.


## How it works (the simple version)

```
        [ ESP8266 ]  ---WiFi--->  [ Your phone / computer ]
          |     |
          |     +----> [ Relay ] ----> [ 12V valve ] ----> drip line
          |                                  ^
        [ MAX485 ]                     [ 12V supply ]
          |
          |  (RS485: two wires, happy over a long run)
          |
          v
     [ probe buried at root depth ]
          |
      ~~~ soil ~~~
```

1. The probe reads how much water is in the soil around it.
2. The ESP8266 asks the probe for that number over RS485.
3. If the soil is drier than your "open" threshold, it switches the relay on.
4. The relay powers the valve, the valve opens, water flows into the drip line.
5. When the soil reaches your "close" threshold, the valve shuts.
6. Every reading and every valve change is sent over WiFi to your dashboard.

**The valve decision is made on the node, not on your phone.** If WiFi drops, the
irrigation keeps working — you just stop seeing it. That's deliberate: a farm
shouldn't stop watering because a phone ran out of battery.


## Important safety note

> **The solenoid valve uses 12V power.** This is safe to handle but you must keep it
> away from the logic. **Never connect 12V to the ESP8266** — it is a 3.3V part and
> 12V will destroy it. The 12V goes to the relay's switched terminals and the valve,
> and nowhere else. Trace the wire with your finger before switching on.

> **This module can flood your field.** Everything else in the toolkit only reads.
> This one turns water on. Build Step 6's safety cutoff before you leave it alone.


## Step-by-step build guide

> **The full bench walkthrough is [`docs/bench/01-bench-soil-sensor-rs485.md`](bench/01-bench-soil-sensor-rs485.md).**
> It covers proving the sensor from a laptop before the ESP8266 is involved, which is
> the fastest way to find a wiring mistake. Do that first if anything here goes wrong.

### Step 1 — Prove the sensor from a laptop first

Before the ESP8266, the relay or the valve exist. One thing at a time is the whole
trick to bringing hardware up — and this sensor needs no converter, so it's the
easiest thing in the toolkit to prove.

Sensor → FT232 USB-RS485 adapter → laptop, powered straight off your pack:

| Sensor wire | Goes to |
|---|---|
| **Yellow** (A+) | FT232 **A** |
| **Blue** (B−) | FT232 **B** |
| **Brown** (+) | pack **+** (anything 4.5-30V) |
| **Black** (−) | pack **−** *and* FT232 **GND** |

```bash
bun tools/poll-soil.ts        # live readings, every 1s
```

You should see moisture, temperature and EC. In open air, moisture and EC read
**0** and that's correct — air has no water in it. Squeeze the probe in a damp hand
and moisture should climb within a few seconds.

> **Don't use `mbpoll` with this adapter.** It reports `Invalid CRC` on every single
> frame while the sensor is perfectly fine. The cheap FT232 adapter echoes your own
> transmitted bytes back, and `mbpoll` reads and writes on one file descriptor, so it
> chokes on its own echo. `tools/poll-soil.ts` handles it. This cost us an afternoon —
> the full diagnosis is in the devlog for 2026-07-15.

> **Diagnostic worth knowing:** the *type* of error tells you the baud rate. Wrong
> baud gives you **timeouts** (the sensor doesn't understand you, so it stays quiet).
> Right baud gives you **CRC errors** (it answered, the bytes just got mangled). So
> CRC errors actually mean you're on the right baud — don't go hunting the baud rate.

### Step 2 — Wire the ESP8266

The sensor's four wires:

| Sensor wire | Goes to |
|---|---|
| **Yellow** | MAX485 **A** |
| **Blue** | MAX485 **B** |
| **Brown** | pack **+** (4.5-30V, no converter needed) |
| **Black** | pack **−** *and* the common ground |

> ⚠️ **The A/B colours are the opposite of Module 1.** On the water probe, blue is A
> and yellow is B. On this sensor, **yellow is A and blue is B.** If you build this
> straight after the tank sensor, you will get this wrong from muscle memory. Swapping
> them is harmless — if you get nothing back, swap them and try again before you
> suspect anything else.

And the MAX485 to the ESP8266. **Check which module you have first** — the same
listing ships two different boards:

**If it says `HW-0519` and has no DE/RE pins** (this is what we have):

| HW-0519 pin | ESP8266 pin |
|---|---|
| RXD | **D7** (GPIO13) |
| TXD | **D1** (GPIO5) |
| VCC | **3V3** |
| GND | GND |
| 接大地 | *(leave it — that's the cable shield terminal)* |

> **Why D7 and D1 when Module 1 uses D5 and D6?** So the two modules never collide.
> Wire the soil sensor to D7/D1 whether or not you ever build Module 1 — the pins work
> identically, and it means that if you later put both sensors on one ESP8266 they
> simply coexist. No rewiring, no conflict, no thinking about it. It costs nothing to
> do it this way from the start.

**If it has DE and RE pins** (the classic breakout):

| MAX485 pin | ESP8266 pin |
|---|---|
| RO | **D7** (GPIO13) |
| DI | **D1** (GPIO5) |
| DE + RE (joined together) | **D2** (GPIO4) |
| VCC | **3V3** |
| GND | GND |

The classic breakout needs a third pin to switch direction, so it takes D2 — which
means **the relay moves to D5** for this variant. And a warning that follows from the
pin budget below: **a classic breakout cannot share an ESP8266 with Module 1.** Two
buses plus two DE pins plus a relay wants seven safe pins and you have five. If you
want both sensors on one board, use HW-0519s — they derive direction themselves and
need no DE pin at all.

> **The ESP8266's pin budget is tight — know it before you plan.** Only five pins are
> both free and safe: **D1, D2, D5, D6, D7**. Everything else is a trap: D3 (GPIO0) and
> D4 (GPIO2) must be HIGH at boot, D8 (GPIO15) must be LOW at boot, and **D0 (GPIO16)
> has no interrupt support at all**, so it physically cannot receive SoftwareSerial —
> it's also your deep-sleep wake pin. TX/RX are the hardware UART you flash and debug
> through.
>
> With HW-0519s, a combined node spends them exactly: D5/D6 water, D7/D1 soil, D2 relay.
> Zero spare. If you need a status LED or an override button on top of that, you're out
> of pins and looking at an ESP32.

> **The little TXD and RXD LEDs are a free logic analyser.** TXD flashes when the ESP
> asks a question; RXD flashes when the sensor answers. Neither = the ESP isn't
> reaching the module. TXD only = the sensor isn't replying, so swap yellow and blue.

> **One ground, not two.** The sensor's black wire, the MAX485's GND and the ESP8266's
> GND must all be connected together. Miss this and you get readings that fail
> randomly and look exactly like a broken sensor.

> **Two SoftwareSerial buses is more interrupt pressure than one.** The ESP8266 has no
> spare hardware UART, so on a combined node both sensors are bit-banged in software
> alongside WiFi. At 4800 and 9600 that's comfortable, and you poll one at a time so
> they never receive at once. But if reads turn flaky *after* you add the second bus,
> this is the suspect — not your wiring. Only `listen()` to the bus you're polling.

### Step 3 — Load the code

> ⏳ **`firmware/soil-moisture/` is not written yet.** This section describes what it
> will do. Until then, the bench sketch in
> [`docs/bench/01-bench-soil-sensor-rs485.md`](bench/01-bench-soil-sensor-rs485.md#step-2--firmware)
> reads the sensor on the ESP8266 and prints to serial — that's the sensor half working.

It will follow the same shape as [`firmware/water-level/`](../firmware/water-level/):
copy `config.example.h` to `config.h`, edit that, never touch the sketch.

1. Install the Arduino IDE, then **Boards Manager → `esp8266`**, and pick the board
   **NodeMCU 1.0 (ESP-12E Module)**. No libraries to install.
2. Copy `config.example.h` to `config.h` and edit it — WiFi name and password, your
   two moisture thresholds, and your safety cutoff.
3. Start with `BENCH_MODE 1` so it just prints to serial and skips WiFi entirely.
   Prove the sensor reads through the ESP8266 before WiFi joins the list of things
   that could be broken.
4. Plug the ESP8266 in with a USB cable and hit Upload.
5. Open the Serial Monitor at **115200** to watch it work.

The settings the code uses, if you're curious or writing your own:

| Setting | Value |
|---|---|
| RS485 RX pin | **D7** (GPIO13) — from the HW-0519's `RXD` |
| RS485 TX pin | **D1** (GPIO5) — to the HW-0519's `TXD` |
| Relay pin | **D2** (GPIO4) |
| Baud rate | **4800** |
| Slave address | 1 |
| Registers to read | `0x0000` (moisture), `0x0001` (temp), `0x0002` (EC) |
| Scaling | moisture ÷10 → %, temp ÷10 → °C, EC is µS/cm as-is |
| Number type | temperature is **signed** 16-bit; the others unsigned |

> **Note the baud rate.** The water probe in Module 1 runs at **9600**. This one is
> **4800**. Same wiring, different speed — don't copy the number across.

> **Temperature is signed.** `0xFF9B` is −10.1°C, not 65435. Parse it into an `int16_t`
> or your first frosty morning produces nonsense.

> **The manual has a typo.** Its register table says function code `0x30`. There is no
> such function code — it's `0x03`. If you get `modbus exception 0x01` (illegal
> function), that's what happened.

> ⚠️ **Reads are safe. Blind writes are not.** Reading registers cannot damage the
> sensor. Writing to one you haven't confirmed can land on its address or baud rate and
> lose you the ability to talk to it at all. Don't write registers to "fix" a reading.

### Step 4 — Choose your two thresholds

You need **two** numbers, not one.

```
open the valve   when moisture drops below  DRY_THRESHOLD   (e.g. 30%)
close the valve  when moisture rises above  WET_THRESHOLD   (e.g. 45%)
```

> **Why two?** With a single threshold, the moment the valve opens the soil creeps
> past it, the valve shuts, the soil dips back, the valve opens again — on and off
> every few seconds, all day. That's called chatter, and it will wear out a mechanical
> valve and empty your tank in dribs. The gap between the two numbers is what stops it.
> **Leave at least 10 percentage points between them.**

To pick the numbers: water your bed the way you normally would, and watch what the
probe reads when the soil is how you like it. That reading is roughly your wet
threshold. Then watch it over the following days and note where the plants start to
look thirsty — that's roughly your dry one.

> **Tip:** sandy soil and clay soil hold water completely differently, and so do
> different crops. Use the probe in the actual bed you'll irrigate, not a test pot.

### Step 5 — Wire the relay and valve

*(Wiring diagram and photo to be added)*

| Relay pin | ESP8266 pin |
|---|---|
| VCC | **VBUS** (the 5V pin) |
| GND | GND |
| IN | **D2** (GPIO4) — or **D5** if you're on a classic DE/RE breakout, which takes D2 for direction. See Step 2. |

> **VBUS, not VIN.** On the NodeMCU v3, `VIN` is the regulator's *input* and is left
> floating when the board is powered over USB — it reads a plausible ~3.1V open-circuit
> and collapses to nothing the moment anything draws from it. **`VBUS` is the pin that
> actually carries USB 5V.** We lost an hour to this on Module 1.

The valve goes on the relay's **switched** side, not the logic side:

```
  12V +  ────────────────► valve terminal 1
  valve terminal 2 ──────► relay COM
  relay NO ──────────────► 12V −

  1N5819 diode across the valve's two terminals,
  stripe (cathode) to the + side.
```

Using **NO** (normally open) means the relay only completes the circuit when the
ESP8266 asks it to. Relay unpowered = valve unpowered = valve shut.

> **The diode is not optional.** A solenoid is a coil of wire. When you cut its power
> the collapsing magnetic field throws a large reverse voltage spike back down the
> wires — enough to weld relay contacts over time, and enough to reset or damage the
> ESP8266 sitting next to it. The **1N5819 across the valve terminals, stripe to +**,
> gives that spike somewhere harmless to go. Symptoms of leaving it out are maddening:
> the ESP randomly reboots, but only when the valve closes.

### Step 6 — Build the safety cutoff *before* you leave it alone

This is the step people skip and then regret.

If the sensor fails, or the probe gets pulled out of the ground, or the water never
actually reaches the probe (blocked dripper, empty tank, kinked line), then moisture
never rises, the threshold never trips, **and the valve stays open forever.** Nothing
in the logic above stops it. You come back to a flooded bed and an empty tank.

So the firmware must enforce, independent of any reading:

- **A maximum run time.** Never hold the valve open longer than `MAX_OPEN_S` in one
  go, no matter what the sensor says. Set it to a little more than one honest
  watering — if a normal cycle takes 15 minutes, set 20.
- **A cooldown.** After a max-run cutoff, refuse to open again for a while, and
  report it loudly. Something is wrong and a human needs to look.
- **Fail closed on a bad read.** If the sensor doesn't answer, close the valve. Do
  not hold the last state and hope. An unknown moisture is a reason to stop watering,
  not to keep going.

> **Sanity check against Module 1.** If you've built the tank sensor, the base station
> already knows your water level. Don't irrigate from an empty tank — running a pump
> dry can destroy it. That cross-check is the best argument for building both.

### Step 7 — Test with water, on the bench, before it touches a field

- Put the probe in dry soil and confirm the valve **opens**.
- Pour water in and confirm the valve **closes** once you pass the wet threshold.
- **Pull the sensor wire out mid-cycle** and confirm the valve closes rather than
  sticking open. If it doesn't, Step 6 isn't done.
- **Let it hit the max run time** with the probe sitting in air, and confirm it cuts
  out and complains. Yes, this means standing there for the full timeout. Do it once.
- Watch for leaks at the hose fittings, with a bucket underneath.

### Step 8 — Install in the field

- Bury the probe at **root depth** in the bed you're irrigating — the depth the roots
  actually drink from, not just under the surface. Too shallow and you'll water on the
  strength of a dry crust while the roots sit soaked.
- Pack soil firmly around the probe so it makes real contact. An air gap around the
  tines reads dry forever, and dry forever means the valve never closes.
- **Don't put the probe right next to a dripper.** You'll measure the dripper, not the
  bed, and it'll shut off long before the rest of the row has had a drink. Put it
  between emitters, where an average plant lives.
- Connect the valve into your drip line, minding the flow arrow on its body.
- Protect the ESP8266, MAX485 and relay inside the waterproof container. Keep the 12V
  supply dry and secure.

### Step 9 — Connect to WiFi

Same as Module 1 — leave `POST_URL` empty in `config.h` and the node finds the base
station by itself. **Don't hardcode the phone's IP.** Android randomises the hotspot
subnet (ours came up on `10.215.63.55`, not the `192.168.43.1` every guide quotes) and
it reshuffles on any hotspot restart. A hardcoded IP goes stale *silently* — the node
keeps reading perfectly and publishes into the void.

> **Test your base station first.** Before blaming the firmware, check the endpoint
> is actually listening:
> ```
> curl -X POST http://<phone-ip>:1880/soil \
>      -H 'Content-Type: application/json' -d '{"node":"test","moisture_pct":22.5}'
> ```
> If that doesn't reach Node-RED, no amount of firmware fiddling will help. The node
> prints the phone's address on serial as `gateway :` when it connects.


## Powering the valve — an open question

The sensor is easy: it takes **4.5-30V** and the 3S2P pack (Module 3) swings
**9.0-12.6V** across its discharge, so the pack feeds it directly at every state of
charge, with margin at both ends. No converter.

**The valve is not solved.** It's a *12V* solenoid, and the same pack sags toward
**9.0V** as it empties. A solenoid at 75% of its rated voltage may not develop enough
force to pull in — and the failure is nasty, because it's silent and load-dependent:
the valve works fine on a full battery and quietly stops opening on a low one, which
looks exactly like a sensor fault.

The options, none yet tested:

- **Separate 12V supply for the valve.** Simplest and most reliable. Costs you the
  off-grid story for this module.
- **Boost the pack to 12V** with an MT3608, as Module 1 does for the water probe. But
  a solenoid draws far more than a sensor — likely 0.5-1A inrush against the MT3608's
  2A ceiling. Plausible, needs measuring.
- **A valve rated lower, or a latching valve.** A latching solenoid only draws current
  during the *change* — a pulse to open, a pulse to close, nothing in between. That's
  a much better fit for a solar node, and worth pricing before committing.

**Measure the actual coil current before choosing.** Until then, bench this module on
a mains 12V adapter and treat off-grid valve power as unfinished.


## How accurate is it?

Accurate enough, and that's the wrong question anyway.

The probe reports moisture as a percentage that responds properly and repeatably —
we watched it go 0% in air to 83-90% in water and snap back to 0 on the way out, with
EC and temperature tracking at the same time. What matters for irrigation is that the
number moves the right way, means the same thing tomorrow as today, and can be
compared to a threshold. It does all three.

What you should *not* do is chase absolute soil-science accuracy. "30% moisture" in
your clay is not the same amount of plant-available water as "30%" in someone else's
sand. **The number's job is to be consistent for your bed, so you can set a threshold
against it.** Calibrating it against a laboratory figure would buy you nothing —
you'd still be picking the threshold by watching your own plants.


## Troubleshooting

| Problem | Possible cause | What to try |
|---------|---------------|-------------|
| No reading at all | A and B swapped | Swap the **yellow and blue** wires. Note these are opposite to Module 1. Harmless to try — do it first. |
| No reading at all | Wrong baud | This sensor is **4800**. Module 1's probe is 9600. Don't copy the number across. |
| `Invalid CRC` on every frame with `mbpoll` | Adapter echo, not a fault | Use `bun tools/poll-soil.ts`. The sensor is fine. |
| CRC errors rather than timeouts | You're on the *right* baud | Errors mean it answered. Look at wiring and grounding, not baud. |
| Garbage / intermittent CRC fails | No common ground | Sensor black, MAX485 GND and ESP GND must all be one rail. |
| `modbus exception 0x01` | Used `0x30` from the manual | The manual has a typo. The function code is `0x03`. |
| Temperature reads ~6500 | Parsed as unsigned | Cast to `int16_t`. `0xFF9B` = −10.1°C. |
| Moisture always 0, EC always 0 | Probe is in air | Air genuinely reads 0. Put it in soil or a damp hand. |
| Moisture always 0, probe *is* buried | Air gap around the tines | Pack the soil firmly against the probe. |
| ESP won't boot with sensor attached | Wired to a strap pin | Keep off D3/D4/D8 (GPIO0/2/15). Use D7/D1. |
| Sensor never answers, wiring looks right | RS485 RX on D0 (GPIO16) | GPIO16 has no interrupts and cannot receive SoftwareSerial. Move to D7. |
| Nothing on serial monitor | Baud mismatch | The monitor is **115200**. That's the debug port, not the sensor. |
| Relay clicks but valve doesn't move | Not enough voltage at the coil | Meter across the valve *while the relay is on*. A sagging pack reads fine at rest. |
| Relay doesn't click | Powered from VIN | Use **VBUS**. VIN floats when the board is on USB. |
| ESP reboots when the valve closes | Missing flyback diode | Fit the 1N5819 across the valve terminals, stripe to +. |
| Valve chatters on and off | Thresholds too close | Leave ≥10 points between dry and wet. |
| Valve never closes | Water isn't reaching the probe | Check for a blocked dripper, empty tank, kinked line. **Your max run time should have caught this** — if it didn't, fix that first. |
| Valve opens on a full battery, not a flat one | Solenoid under-volted | See "Powering the valve" above. |
| Readings fine, nothing on the dashboard | Hardcoded a stale IP | Leave `POST_URL` empty and let the node derive it from the gateway. |


## How this connects to the other modules

This module works on its own, but it works even better with:

- **Module 1 — Water Tank Level Sensor:** Know how much water you have before this
  module spends it — and don't irrigate from an empty tank. The best cross-check in
  the toolkit.
- **Module 3 — IoT Solar Powerbank:** Powers the sensor and ESP8266 off-grid. The
  valve is a separate question — see "Powering the valve" above.
- **Module 4 — Mobile WiFi Base Station:** Receives soil readings and valve activity
  and shows them on your phone.


## Notes and learnings

- **We changed sensors partway.** This module originally specified a capacitive soil
  moisture sensor v1.2 on an ESP32. We switched to the THC-S over RS485 on an ESP8266
  because a capacitive probe returns a meaningless number that silently degrades as its
  exposed traces corrode in wet soil — and because RS485 travels a field cable that
  analog can't. See "Why this sensor" above.
- **This is the only module that acts, not just reads.** That's what makes it advanced,
  and it's why the safety cutoff in Step 6 is not optional. Everything else in the
  toolkit fails by telling you nothing. This one fails by flooding a field.
- **The sensor half was the easy half.** It runs straight off the pack with no
  converter, its register map is in the manual, and it was the first thing on the bench
  to work. The valve is where the real engineering is.
- **The A/B colour reversal between modules is a trap.** Yellow is A here, blue is A on
  the water probe. Different manufacturers, no standard. Always be willing to swap.
- **Reads are safe, blind writes are not.** Reading registers cannot damage the sensor.
  Writing to an unconfirmed one can land on its address or baud rate and lose you the
  ability to talk to it at all.
- **Don't use `mbpoll` with the cheap FT232 adapter.** It's a tool-adapter interaction,
  not a rig fault, and it cost us an afternoon. `tools/poll-soil.ts` exists because of it.


---

**License:** Open source — use, share, and adapt freely.
**Project:** [Farmers IoT Toolkit](https://github.com/sunriselabs)
</content>
</invoke>
