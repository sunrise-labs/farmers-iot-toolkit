---
# ---- Module Info ----
title: "Soil Moisture Sensor to Drip Irrigation Valve"
module_id: 2
difficulty: advanced
status: draft              # draft | in-progress | testing | complete

# ---- What It Does (plain language) ----
summary: >
  A sensor in the ground checks how wet or dry the soil is. When the soil
  gets too dry, it automatically opens a valve to release water into your
  drip irrigation. When the soil is wet enough, it closes the valve again.

# ---- Who Is This For? ----
target_user: "Farmers who use drip irrigation and want to water automatically based on what the soil actually needs."
prior_knowledge: "Some comfort with wiring and basic electronics helps. We recommend building Module 1 first."

# ---- Hardware ----
microcontroller: "ESP32"
sensors:
  - name: "Capacitive Soil Moisture Sensor v1.2"
    purpose: "Reads the moisture level in the soil"
    approx_cost_usd: 3

actuators:
  - name: "12V Solenoid Valve (normally closed)"
    purpose: "Opens and closes to control water flow into the drip line"
    approx_cost_usd: 8
  - name: "Relay module (1-channel)"
    purpose: "Lets the ESP32 safely switch the 12V valve on and off"
    approx_cost_usd: 2

other_parts:
  - name: "Jumper wires"
    quantity: 6
    approx_cost_usd: 1
  - name: "Breadboard"
    quantity: 1
    approx_cost_usd: 3
  - name: "12V power supply or battery"
    quantity: 1
    approx_cost_usd: 8
  - name: "USB cable (micro-USB or USB-C, depends on your ESP32)"
    quantity: 1
    approx_cost_usd: 2
  - name: "Hose fittings / connectors for the solenoid valve"
    quantity: 1
    approx_cost_usd: 5
  - name: "Waterproof enclosure / container"
    quantity: 1
    approx_cost_usd: 5

total_approx_cost_usd: 45

# ---- Power ----
power_source: "12V battery or mains adapter for the valve, USB for the ESP32"
power_notes: >
  The solenoid valve needs 12V — it cannot run from USB alone.
  The ESP32 itself can be powered by USB or the IoT Solar Powerbank (Module 3).

# ---- Connectivity ----
connects_to: "Mobile WiFi Base Station (Module 4)"
protocol: "WiFi"

# ---- Links (fill in as you go) ----
purchase_links: []
video_tutorial_url: ""
source_code_url: ""

# ---- Tags ----
tags: ["soil", "moisture", "irrigation", "drip", "valve", "solenoid", "automation", "advanced"]
---


# Soil Moisture Sensor to Drip Irrigation Valve

> **Difficulty:** Advanced | **Cost:** ~$45 USD | **Build time:** 3-5 hours


## What does this do?

A small sensor buried in your soil checks how moist the ground is. When the
soil gets too dry, the ESP32 tells a valve to open and let water flow through
your drip irrigation line. When the soil has enough water, it closes the valve.

You set the "dry" and "wet" thresholds — so you decide how moist you want the
soil to be. The system does the rest.


## Why would I want this?

- Water your crops only when they actually need it — no guessing
- Save water by not over-irrigating
- Keep soil moisture consistent, which helps plants grow better
- Free up your time — no need to manually turn irrigation on and off
- Reduce runoff and waterlogging


## What you will need

| # | Part | What it does | Est. cost | Link to buy |
|---|------|-------------|-----------|-------------|
| 1 | ESP32 board | The small computer that runs everything | ~$7 | *(add link)* |
| 2 | Capacitive soil moisture sensor v1.2 | Reads how wet or dry the soil is | ~$3 | *(add link)* |
| 3 | 12V solenoid valve (normally closed) | Opens to let water through, closes to stop it | ~$8 | *(add link)* |
| 4 | 1-channel relay module | Lets the ESP32 safely switch the 12V valve | ~$2 | *(add link)* |
| 5 | Jumper wires (x6) | Connects everything together | ~$1 | *(add link)* |
| 6 | Breadboard | Lets you connect parts without soldering | ~$3 | *(add link)* |
| 7 | 12V power supply or battery | Powers the solenoid valve | ~$8 | *(add link)* |
| 8 | USB cable | Powers the ESP32 and loads code onto it | ~$2 | *(add link)* |
| 9 | Hose fittings / connectors | Attaches the valve to your drip line | ~$5 | *(add link)* |
| 10 | Waterproof container | Protects the electronics | ~$5 | *(add link)* |


## How it works (the simple version)

```
[ Soil moisture sensor ]
        |
    reads soil wetness
        |
        v
[ ESP32 checks the reading ]
        |
   Is soil too dry?
      /        \
    YES          NO
     |            |
  open valve   keep valve closed
     |
  water flows into drip line
     |
  soil gets wetter
     |
  close valve when wet enough
```

1. The sensor reads the moisture level in the soil
2. The ESP32 compares the reading to your set thresholds
3. If the soil is too dry, it turns on the relay, which opens the valve
4. Water flows through the drip irrigation line
5. When the soil reaches your "wet enough" level, it closes the valve
6. Readings are sent over WiFi so you can see what is happening


## Important safety note

> **The solenoid valve uses 12V power.** This is safe but you need to be
> careful with the wiring. Always double-check connections before turning on
> the 12V supply. If you are unsure, ask someone with electrical experience
> to help. Never connect 12V directly to the ESP32 — it will damage it.


## Step-by-step build guide

### Step 1 — Wire up the soil moisture sensor

*(Wiring diagram and photo to be added)*

| Sensor pin | ESP32 pin |
|------------|-----------|
| VCC        | 3.3V      |
| GND        | GND       |
| AOUT       | GPIO 34   |

### Step 2 — Wire up the relay and solenoid valve

*(Wiring diagram and photo to be added)*

| Relay pin | ESP32 pin |
|-----------|-----------|
| VCC       | 5V        |
| GND       | GND       |
| IN        | GPIO 26   |

The solenoid valve connects to the relay's normally-open (NO) terminal
and the 12V power supply.

### Step 3 — Load the code

*(Instructions for installing firmware will be added — step by step with
screenshots)*

### Step 4 — Calibrate the sensor

This is important. Every soil type is different, so you need to tell the
sensor what "dry" and "wet" look like for your soil:

1. Put the sensor in completely dry soil — write down the reading
2. Water the soil thoroughly — write down the reading
3. Use these two numbers as your thresholds in the code

> **Tip:** Test with soil from the actual field you will use. Sandy soil
> and clay soil give very different readings.

### Step 5 — Test with water

- Manually dry the sensor (wipe it off) and confirm the valve opens
- Put it back in wet soil and confirm the valve closes
- Watch for leaks at the hose fittings

### Step 6 — Install in the field

- Bury the sensor at root depth in your crop bed
- Connect the valve into your drip line
- Protect all electronics in the waterproof container
- Keep the 12V power source dry and secure

### Step 7 — Connect to WiFi

*(Instructions for connecting to the Mobile WiFi Base Station will be added)*


## Troubleshooting

| Problem | Possible cause | What to try |
|---------|---------------|-------------|
| Valve never opens | Relay is not wired correctly | Check relay wiring matches the table above |
| Valve never closes | Sensor threshold is set wrong | Re-calibrate using Step 4 |
| Sensor always reads the same value | Sensor is not making good contact with soil | Push it in firmly, make sure soil is around it |
| ESP32 resets or restarts randomly | 12V is leaking into the ESP32 circuit | Make sure 12V only goes to the relay/valve, not the ESP32 |
| Water keeps flowing after valve should close | Valve is stuck open or fittings are loose | Clean the valve, check hose connections |


## How this connects to the other modules

This module works on its own, but it works even better with:

- **Module 1 — Water Tank Level Sensor:** Know how much water you have
  before the irrigation system uses it
- **Module 3 — IoT Solar Powerbank:** Power the ESP32 off-grid (you still
  need a separate 12V source for the valve)
- **Module 4 — Mobile WiFi Base Station:** See soil moisture data and valve
  activity from your phone


## Notes and learnings

*(This section will be updated as the module is built and tested. We will
share what went well, what was tricky, and any changes we made along the way.)*


---

**License:** Open source — use, share, and adapt freely.
**Project:** [Farmers IoT Toolkit](https://github.com/sunriselabs)
