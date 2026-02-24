---
# ---- Module Info ----
title: "IoT Solar Powerbank"
module_id: 3
difficulty: medium
status: draft              # draft | in-progress | testing | complete

# ---- What It Does (plain language) ----
summary: >
  An off-grid power supply that uses a 20W solar panel to charge 8
  rechargeable batteries. It keeps your IoT sensors and microcontrollers
  running in the field — no mains power needed.

# ---- Who Is This For? ----
target_user: "Farmers who need to power IoT devices in places with no mains electricity."
prior_knowledge: "Basic comfort with wiring. Read the safety notes carefully — this module uses lithium batteries."

# ---- Hardware ----
microcontroller: "None (this is a power supply module, but it powers ESP32s in other modules)"
batteries:
  - name: "18650 Lithium-ion battery"
    quantity: 8
    configuration: "4S2P (4 in series, 2 in parallel)"
    approx_cost_usd: 20

solar:
  - name: "20W solar panel"
    approx_cost_usd: 20

other_parts:
  - name: "4S BMS (Battery Management System) board"
    quantity: 1
    purpose: "Protects the batteries from overcharge, over-discharge, and short circuit"
    approx_cost_usd: 5
  - name: "Solar charge controller (suitable for 4S lithium)"
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

total_approx_cost_usd: 80

# ---- Power ----
power_source: "20W solar panel"
power_output: "5V USB (via DC-DC converter)"
power_notes: >
  The 4S2P battery pack gives roughly 14.8V nominal.
  A buck converter steps this down to 5V for USB-powered devices.
  With 8 batteries, this can power an ESP32 for many days without sun.

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
| 1 | 18650 lithium batteries (x8) | Store energy from the solar panel | ~$20 | *(add link)* |
| 2 | 20W solar panel | Charges the batteries using sunlight | ~$20 | *(add link)* |
| 3 | 4S BMS board | Protects batteries from damage (overcharge, short circuit) | ~$5 | *(add link)* |
| 4 | Solar charge controller (4S lithium) | Manages charging from the solar panel | ~$10 | *(add link)* |
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
        |
        v
[ Charge Controller ]
        |
        v
[ 8 x 18650 Batteries ]  <-- protected by BMS board
   (4S2P arrangement)
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


## Understanding the battery arrangement: 4S2P

This sounds complicated but it is simple:

- **4S** = 4 batteries connected in **series** (end to end) — this adds up
  the voltage (3.7V x 4 = 14.8V)
- **2P** = 2 of these 4-battery chains connected in **parallel** (side by
  side) — this doubles the capacity so it lasts longer

```
  Group A:  [bat1]--[bat2]--[bat3]--[bat4]  = 14.8V
                        +
  Group B:  [bat5]--[bat6]--[bat7]--[bat8]  = 14.8V

  A and B in parallel = 14.8V, double the capacity
```


## Step-by-step build guide

### Step 1 — Test your batteries

*(Instructions and photos to be added)*

- Use a multimeter to check each battery reads between 3.0V and 4.2V
- Discard any battery that reads below 2.5V or looks damaged

### Step 2 — Arrange batteries in 4S2P

*(Wiring diagram and photo to be added)*

- Place 4 batteries in series for Group A
- Place 4 batteries in series for Group B
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
| Batteries drain overnight even with sun during the day | Solar panel is too shaded or too small | Move panel to a sunnier spot, check it is angled toward the sun |
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
