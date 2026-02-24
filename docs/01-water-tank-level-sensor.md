---
# ---- Module Info ----
title: "Water Tank Level Sensor"
module_id: 1
difficulty: beginner
status: draft              # draft | in-progress | testing | complete

# ---- What It Does (plain language) ----
summary: >
  An ultrasonic sensor sits on top of your water tank and measures how
  full it is. The reading is sent to your phone or computer so you can
  check your water level from anywhere.

# ---- Who Is This For? ----
target_user: "Any farmer who wants to know how much water is in their tank without climbing up to look."
prior_knowledge: "None. This is a first-time project."

# ---- Hardware ----
microcontroller: "ESP32"
sensors:
  - name: "HC-SR04 Ultrasonic Sensor"
    purpose: "Measures distance from top of tank to the water surface"
    approx_cost_usd: 2

other_parts:
  - name: "Jumper wires"
    quantity: 4
    approx_cost_usd: 1
  - name: "Breadboard"
    quantity: 1
    approx_cost_usd: 3
  - name: "USB cable (micro-USB or USB-C, depends on your ESP32)"
    quantity: 1
    approx_cost_usd: 2
  - name: "Waterproof enclosure / container"
    quantity: 1
    approx_cost_usd: 5

total_approx_cost_usd: 20

# ---- Power ----
power_source: "USB power bank, mains USB adapter, or IoT Solar Powerbank (Module 3)"
power_notes: "The ESP32 uses very little power. A basic USB power bank can run it for days."

# ---- Connectivity ----
connects_to: "Mobile WiFi Base Station (Module 4)"
protocol: "WiFi"

# ---- Links (fill in as you go) ----
purchase_links: []          # e.g. ["https://example.com/esp32", "https://example.com/hcsr04"]
video_tutorial_url: ""
source_code_url: ""

# ---- Tags ----
tags: ["water", "tank", "ultrasonic", "beginner", "monitoring"]
---


# Water Tank Level Sensor

> **Difficulty:** Beginner | **Cost:** ~$20 USD | **Build time:** 1-2 hours


## What does this do?

This sensor sits on top of your water tank. It sends out a sound pulse (you
cannot hear it) and measures how long it takes to bounce back off the water.
From that, it works out how full your tank is.

The reading is sent over WiFi so you can check the water level on your phone
or computer — no need to walk to the tank or climb up to look inside.


## Why would I want this?

- Know when your tank is getting low **before** you run out
- Keep a record of water use over days and weeks
- Save time — check from your house instead of walking to the tank
- Plan ahead for dry spells


## What you will need

| # | Part | What it does | Est. cost | Link to buy |
|---|------|-------------|-----------|-------------|
| 1 | ESP32 board | The small computer that runs everything | ~$7 | *(add link)* |
| 2 | HC-SR04 ultrasonic sensor | Measures distance to the water | ~$2 | *(add link)* |
| 3 | Jumper wires (x4) | Connects the sensor to the ESP32 | ~$1 | *(add link)* |
| 4 | Breadboard | Lets you connect parts without soldering | ~$3 | *(add link)* |
| 5 | USB cable | Powers the ESP32 and loads code onto it | ~$2 | *(add link)* |
| 6 | Waterproof container | Protects the electronics from rain and humidity | ~$5 | *(add link)* |


## How it works (the simple version)

```
[ Ultrasonic sensor ]
        |
    sends sound down
        |
        v
  ~~~~ water surface ~~~~
        |
    sound bounces back
        |
        v
[ ESP32 calculates distance ]
        |
    sends reading over WiFi
        |
        v
[ Your phone / computer ]
```

1. The sensor sends a tiny pulse of sound downward
2. The sound hits the water and bounces back
3. The ESP32 measures how long that took
4. It calculates the distance to the water (shorter distance = more water)
5. It sends the result over WiFi to your dashboard


## Step-by-step build guide

### Step 1 — Wire it up

*(Wiring diagram and photo to be added)*

Connect the HC-SR04 to the ESP32:

| HC-SR04 pin | ESP32 pin |
|-------------|-----------|
| VCC         | 5V        |
| GND         | GND       |
| TRIG        | GPIO 5    |
| ECHO        | GPIO 18   |

> **Tip:** If you have never used a breadboard before, watch the wiring
> video first. It is easier than it looks.

### Step 2 — Load the code

*(Instructions for installing firmware will be added — step by step with
screenshots)*

### Step 3 — Test it

- Point the sensor at a flat surface (like a table or the floor)
- Check that the distance reading changes when you move it closer or farther
- If it reads zero or a very large number, double-check your wiring

### Step 4 — Install on your tank

- Mount the sensor so it points straight down at the water
- Protect the ESP32 and wiring inside the waterproof container
- Make sure the sensor face is not blocked

### Step 5 — Connect to WiFi

*(Instructions for connecting to the Mobile WiFi Base Station will be added)*


## Troubleshooting

| Problem | Possible cause | What to try |
|---------|---------------|-------------|
| Reading is always zero | Wires are loose or in the wrong pin | Check each wire matches the table above |
| Reading jumps around a lot | Sensor is not pointing straight down | Re-mount so it faces directly at the water |
| No WiFi connection | Wrong WiFi name or password in the code | Double-check the WiFi settings in the code |
| ESP32 does not turn on | USB cable is charge-only (no data) | Try a different USB cable |


## How this connects to the other modules

This module works on its own, but it works even better with:

- **Module 3 — IoT Solar Powerbank:** Powers this sensor off-grid with solar
- **Module 4 — Mobile WiFi Base Station:** Receives the sensor data and lets
  you view it on your phone


## Notes and learnings

*(This section will be updated as the module is built and tested. We will
share what went well, what was tricky, and any changes we made along the way.)*


---

**License:** Open source — use, share, and adapt freely.
**Project:** [Farmers IoT Toolkit](https://github.com/sunriselabs)
