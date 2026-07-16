---
# ---- Module Info ----
title: "IoT Solar Powerbank"
module_id: 3
difficulty: medium
status: draft              # draft | in-progress | testing | complete

# ---- What It Does (plain language) ----
summary: >
  An off-grid power supply that uses a 20W solar panel to charge 6
  rechargeable batteries. It keeps your IoT sensors and microcontrollers
  running in the field — no mains power needed.

# ---- Who Is This For? ----
target_user: "Farmers who need to power IoT devices in places with no mains electricity."
prior_knowledge: "Basic comfort with wiring. Read the safety notes carefully — this module uses lithium batteries."

# ---- Hardware ----
microcontroller: "None (this is a power supply module, but it powers ESP32s in other modules)"
batteries:
  - name: "18650 Lithium-ion battery"
    quantity: 6
    configuration: "3S2P (3 in series, 2 in parallel)"
    approx_cost_usd: 15

solar:
  - name: "20W solar panel (Vmp 18.6V)"
    approx_cost_usd: 20
    notes: >
      The panel's Vmp (voltage at maximum power) matters as much as its wattage.
      It must stay above the pack's full-charge voltage by ~2V even when hot.
      See "Why 3 in series and not 4?" below before substituting a different panel.

other_parts:
  - name: "3S BMS (Battery Management System) board"
    quantity: 1
    purpose: "Protects the batteries from overcharge, over-discharge, and short circuit"
    approx_cost_usd: 5
  - name: "Solar charge controller (suitable for 3S lithium)"
    quantity: 1
    approx_cost_usd: 10
  - name: "DC-DC buck converter (step-down to 5V USB)"
    quantity: 1
    purpose: "Converts battery voltage down to 5V to power ESP32 devices"
    approx_cost_usd: 3
  - name: "Battery holder or spot-welded pack"
    quantity: 1
    approx_cost_usd: 5
  - name: "Wires, connectors, fuse holder, and fuse"
    quantity: 1
    approx_cost_usd: 5
  - name: "Weatherproof enclosure / box"
    quantity: 1
    approx_cost_usd: 10

total_approx_cost_usd: 75

# ---- Power ----
power_source: "20W solar panel"
power_output: "5V USB (via DC-DC converter)"
power_notes: >
  The 3S2P battery pack gives roughly 11.1V nominal (12.6V fully charged).
  A buck converter steps this down to 5V for USB-powered devices.
  With 6 batteries, this can power a sleeping ESP32 for many days without sun.
  Devices that never sleep — especially a phone running a WiFi hotspot — will
  outrun a 20W panel no matter how many batteries you add. See "How long will
  it last?" below.

# ---- Connectivity ----
connects_to: "Powers Module 1, Module 2 (ESP32 only), and Module 4"
protocol: "N/A — this is a power supply"

# ---- Links (fill in as you go) ----
purchase_links: []
video_tutorial_url: ""
source_code_url: ""

# ---- Tags ----
tags: ["solar", "power", "battery", "18650", "off-grid", "medium"]
---


# IoT Solar Powerbank

> **Difficulty:** Medium | **Cost:** ~$80 USD | **Build time:** 3-4 hours


## What does this do?

This is a rechargeable battery pack powered by a solar panel. It sits in the
field and keeps your IoT sensors running day and night — even when there is no
mains electricity.

The solar panel charges the batteries during the day. The batteries power your
ESP32 devices around the clock. A protection board keeps the batteries safe.


## Why would I want this?

- Run IoT sensors anywhere on your farm — no power outlet needed
- Solar keeps it running for free after the initial build
- Reliable power means your sensors do not stop working unexpectedly
- One powerbank can run multiple ESP32 devices at the same time


## What you will need

| # | Part | What it does | Est. cost | Link to buy |
|---|------|-------------|-----------|-------------|
| 1 | 18650 lithium batteries (x6) | Store energy from the solar panel | ~$15 | *(add link)* |
| 2 | 20W solar panel, **Vmp 18.6V** | Charges the batteries using sunlight | ~$20 | *(add link)* |
| 3 | 3S BMS board | Protects batteries from damage (overcharge, short circuit) | ~$5 | *(add link)* |
| 4 | Solar charge controller (3S lithium) | Manages charging from the solar panel | ~$10 | *(add link)* |
| 5 | DC-DC buck converter (to 5V) | Steps voltage down to 5V USB for your devices | ~$3 | *(add link)* |
| 6 | Battery holder or spot-welded pack | Holds the 8 batteries in the right arrangement | ~$5 | *(add link)* |
| 7 | Wires, connectors, fuse + holder | Connects everything and adds short-circuit protection | ~$5 | *(add link)* |
| 8 | Weatherproof enclosure / box | Keeps rain and dust out | ~$10 | *(add link)* |


## How it works (the simple version)

```
    ☀️  sunlight
        |
        v
[ 20W Solar Panel ]
   (Vmp 18.6V)
        |
        v
[ Charge Controller ]
        |
        v
[ 6 x 18650 Batteries ]  <-- protected by BMS board
   (3S2P arrangement)
        |
        v
[ DC-DC Buck Converter ]
        |
    outputs 5V USB
        |
        v
[ ESP32 / your IoT devices ]
```

1. The solar panel turns sunlight into electricity
2. The charge controller feeds that power safely into the batteries
3. The BMS board protects the batteries from being overcharged or drained too low
4. The buck converter steps the battery voltage down to 5V
5. Your ESP32 plugs in via USB and runs continuously


## Important safety notes

> **Lithium batteries can be dangerous if handled incorrectly.**
> Please read these warnings before you start.

- **Never short-circuit the batteries** — keep bare wires away from each other
- **Never puncture, crush, or burn a lithium battery**
- **Always use a BMS board** — it protects against overcharge and over-discharge
- **Always include a fuse** — it cuts power if something goes wrong
- **Keep batteries dry** — use a sealed, weatherproof enclosure
- **Buy batteries from reputable sellers** — cheap fakes can be unsafe
- **If a battery looks swollen, smells bad, or gets very hot, stop using it immediately and dispose of it safely**

> If you are not comfortable working with batteries, ask someone with
> electrical experience to help. Safety first.


## Understanding the battery arrangement: 3S2P

This sounds complicated but it is simple:

- **3S** = 3 batteries connected in **series** (end to end) — this adds up
  the voltage (3.7V x 3 = 11.1V nominal, 12.6V when fully charged)
- **2P** = 2 of these 3-battery chains connected in **parallel** (side by
  side) — this doubles the capacity so it lasts longer

```
  Group A:  [bat1]--[bat2]--[bat3]  = 11.1V
                      +
  Group B:  [bat4]--[bat5]--[bat6]  = 11.1V

  A and B in parallel = 11.1V, double the capacity
```

### Why 3 in series and not 4?

> **An earlier version of this guide said 4S2P. That was wrong, and it is worth
> explaining why — because the mistake is easy to repeat and it fails in a way
> that is hard to diagnose.**

A solar charge controller cannot push energy uphill. It needs the panel's voltage
to sit **about 2V above the battery's full-charge voltage**, or it simply stops
charging.

Now the trap: **a panel's Vmp drops as it gets hot.** The "18.6V" on the label is
measured at 25°C in a laboratory. A panel in real tropical sun runs at 55–60°C,
and it loses roughly 0.35% of its Vmp per degree:

```
18.6V x (1 - 0.0035 x 33°C)  =  16.5V   <-- what you actually get in the field
```

So compare the two arrangements against a **real, hot** 16.5V:

| Arrangement | Full charge | Panel voltage needed | Hot panel gives 16.5V |
|-------------|-------------|----------------------|-----------------------|
| **3S** (this guide) | 12.6V | ~14.6V | ✅ works, ~1.9V to spare |
| **4S** (the old, wrong version) | 16.8V | ~18.8V | ❌ short by 2.3V |

A 4S pack on this panel would charge a little on a cool morning and then **stop
charging completely once the sun warmed the panel up** — so it would look fine on
your bench and quietly fail in the field. That is the worst kind of fault.

**If you substitute a different panel,** check its Vmp, subtract ~11% for heat,
and make sure the result is at least 2V above your pack's full-charge voltage.
Wattage alone will not tell you whether a panel can charge your battery.


## Step-by-step build guide

### Step 1 — Test your batteries

*(Instructions and photos to be added)*

- Use a multimeter to check each battery reads between 3.0V and 4.2V
- Discard any battery that reads below 2.5V or looks damaged

### Step 2 — Arrange batteries in 3S2P

*(Wiring diagram and photo to be added)*

- Place 3 batteries in series for Group A
- Place 3 batteries in series for Group B
- Connect Group A and Group B in parallel

### Step 3 — Connect the BMS board

*(Wiring diagram and photo to be added)*

- Follow the BMS board's markings for B+, B-, and the balance wires
- The BMS sits between the batteries and everything else

### Step 4 — Connect the charge controller and solar panel

*(Wiring diagram and photo to be added)*

- Solar panel connects to the input of the charge controller
- Battery pack connects to the battery terminals of the charge controller

### Step 5 — Connect the buck converter

*(Wiring diagram and photo to be added)*

- Input from the battery pack (through the BMS)
- Adjust output to exactly 5V using the small screw on the converter
- Add a USB socket or cable to the output

### Step 6 — Add a fuse

- Place a fuse between the battery pack and the buck converter
- A 3A fuse is a good starting point for powering ESP32 devices

### Step 7 — Put it all in the enclosure

- Arrange parts so nothing touches metal-to-metal where it should not
- Drill a small hole for the solar panel cable to enter the box
- Seal the hole with silicone to keep water out
- Mount the solar panel where it gets the most sun


## Troubleshooting

| Problem | Possible cause | What to try |
|---------|---------------|-------------|
| No output voltage | Fuse has blown | Check and replace the fuse |
| Output voltage is not 5V | Buck converter needs adjusting | Turn the small screw on the converter with a screwdriver while checking voltage |
| Batteries drain overnight even with sun during the day | Panel too shaded/small, **or your devices never sleep** | Move the panel to a sunnier spot. Then check your daily energy budget — see "How long will it last?" |
| Pack charges partway then stops, never reaches full | Panel Vmp too low for the pack (especially once hot) | Check Vmp against the table in "Why 3 in series and not 4?". A hot panel loses ~11% of its Vmp |
| Charges fine in the morning, stops by midday | Same cause — the panel heated up and its Vmp fell below what the controller needs | You need a higher-Vmp panel, or fewer cells in series |
| Panel gives far less current than its rating | Panel facing the wrong way | In the southern hemisphere the midday sun is in the **NORTH**. Check Voc and Isc with the panel disconnected to confirm the panel itself is healthy |
| BMS cuts power suddenly | A battery is faulty or badly connected | Check all battery connections, test each battery individually |
| Enclosure gets very hot inside | No ventilation | Add small vent holes (covered with mesh to keep bugs out) on the shaded side |


## How this connects to the other modules

This module provides power to the other modules:

- **Module 1 — Water Tank Level Sensor:** Plug the ESP32 into this powerbank
- **Module 2 — Soil Moisture Sensor:** Powers the ESP32 (valve still needs
  its own 12V source)
- **Module 4 — Mobile WiFi Base Station:** Powers the Android phone and
  router via USB


## Notes and learnings

*(This section will be updated as the module is built and tested. We will
share what went well, what was tricky, and any changes we made along the way.)*


---

**License:** Open source — use, share, and adapt freely.
**Project:** [Farmers IoT Toolkit](https://github.com/sunriselabs)
