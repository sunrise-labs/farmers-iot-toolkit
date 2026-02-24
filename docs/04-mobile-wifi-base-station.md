---
# ---- Module Info ----
title: "Mobile WiFi Base Station"
module_id: 4
difficulty: beginner
status: draft              # draft | in-progress | testing | complete

# ---- What It Does (plain language) ----
summary: >
  A repurposed Android phone that creates a local WiFi network for your
  IoT sensors to connect to. It runs Node-RED to collect and display
  sensor data, and uses the phone's 3G/4G to send data to the internet.

# ---- Who Is This For? ----
target_user: "Any farmer setting up IoT sensors who needs a way to collect and view the data."
prior_knowledge: "None. If you can use a smartphone, you can set this up."

# ---- Hardware ----
microcontroller: "N/A — uses an Android phone"
phone_requirements:
  - "Any Android phone (version 7 or newer recommended)"
  - "Working WiFi hotspot feature"
  - "3G or 4G data connection (for sending data to the internet)"
  - "An old or second-hand phone works fine"

software:
  - name: "Termux"
    purpose: "Lets you run server software on the Android phone"
  - name: "Node-RED"
    purpose: "Receives data from sensors, displays it in a dashboard, and can send alerts"

other_parts:
  - name: "USB cable for charging the phone"
    quantity: 1
    approx_cost_usd: 2
  - name: "Phone mount or stand (optional)"
    quantity: 1
    approx_cost_usd: 3
  - name: "SIM card with data plan"
    quantity: 1
    approx_cost_usd: 5

total_approx_cost_usd: 10
cost_notes: "If you already have an old Android phone and a SIM card, this module is nearly free."

# ---- Power ----
power_source: "Phone's own battery, charged via USB"
power_notes: >
  Keep the phone plugged into a charger (mains or the IoT Solar Powerbank
  from Module 3). Running WiFi hotspot and Node-RED drains the battery
  faster than normal.

# ---- Connectivity ----
connects_to: "All other modules connect to this base station over WiFi"
protocol: "WiFi (local hotspot) + 3G/4G (internet backhaul)"

# ---- Links (fill in as you go) ----
purchase_links: []
video_tutorial_url: ""
source_code_url: ""

# ---- Tags ----
tags: ["wifi", "base-station", "node-red", "android", "hub", "beginner", "connectivity"]
---


# Mobile WiFi Base Station

> **Difficulty:** Beginner | **Cost:** ~$10 USD (or free if you have an old phone) | **Setup time:** 1-2 hours


## What does this do?

An old Android phone becomes the "brain" of your farm IoT system. It does
three things:

1. **Creates a WiFi network** — your ESP32 sensors connect to this
2. **Runs Node-RED** — a visual tool that collects sensor data and shows it
   on a dashboard
3. **Connects to the internet** — uses the phone's 3G/4G to send data
   online so you can check it from anywhere


## Why would I want this?

- Gives all your sensors a WiFi network to talk to — even if there is no
  internet router nearby
- See all your sensor data in one place on a simple dashboard
- Get alerts (e.g. "water tank is low") sent to your phone or email
- Uses an old phone you probably already have — very low cost
- No computer or laptop needed to view your data


## What you will need

| # | Part | What it does | Est. cost | Link to buy |
|---|------|-------------|-----------|-------------|
| 1 | Android phone (v7+) | Runs the WiFi hotspot and Node-RED | Free (use an old phone) | *(add link if buying second-hand)* |
| 2 | SIM card with data | Connects the phone to the internet | ~$5/month | *(add link to local provider)* |
| 3 | USB charging cable | Keeps the phone powered | ~$2 | *(add link)* |
| 4 | Phone mount or stand | Keeps the phone in place (optional) | ~$3 | *(add link)* |


## How it works (the simple version)

```
[ ESP32 sensor ]  --WiFi-->  [ Android Phone ]  --3G/4G-->  [ Internet ]
[ ESP32 sensor ]  --WiFi-->  [  (WiFi Hotspot  ]
[ ESP32 sensor ]  --WiFi-->  [   + Node-RED)   ]
                                     |
                              shows dashboard
                              on the phone screen
                              or any device on
                              the same WiFi
```

1. The phone creates a WiFi hotspot (like a mini router)
2. Your ESP32 devices connect to this WiFi and send their data
3. Node-RED (running on the phone) receives the data
4. It displays readings on a dashboard you can open in any browser
5. The phone's 3G/4G sends data to the internet if you want remote access


## What is Node-RED?

Node-RED is a free, visual programming tool. Instead of writing code, you
connect "blocks" together on screen to tell it what to do with your data.

For example:
- **Receive** soil moisture reading from ESP32
- **Display** it on a gauge on the dashboard
- **If** the reading is too low, **send** an alert

It runs inside an app called Termux on the Android phone. You do not need a
computer to set it up — but a computer makes it easier if you have one.


## Step-by-step setup guide

### Step 1 — Get the phone ready

- Factory reset the phone (optional but recommended for a clean start)
- Make sure the phone is charged and has a working SIM card with data
- Connect it to a charger — it should stay plugged in at all times

### Step 2 — Turn on WiFi Hotspot

- Go to **Settings > Network > Hotspot** (exact path depends on your phone)
- Set a name for the network, e.g. `FarmIoT`
- Set a password — write it down, you will need it for your ESP32 devices
- Turn the hotspot on

> **Tip:** Some phones turn off the hotspot automatically after a while if
> nothing is connected. Look for a "keep hotspot on" setting, or connect a
> device to it to keep it active.

### Step 3 — Install Termux

*(Step-by-step instructions with screenshots to be added)*

- Download Termux from F-Droid (a free app store)
- Do NOT use the Google Play Store version — it is outdated

### Step 4 — Install Node-RED inside Termux

*(Step-by-step instructions with screenshots to be added)*

- Open Termux and type the setup commands (we will list them here)
- Node-RED will install automatically
- Start Node-RED with a single command

### Step 5 — Open the Node-RED dashboard

- On the phone (or any device connected to the hotspot), open a web browser
- Go to: `http://localhost:1880` (on the phone) or `http://<phone-ip>:1880`
  (from another device)
- You should see the Node-RED editor

### Step 6 — Set up a basic flow

*(Instructions and example flow to be added)*

- We will provide a ready-made flow you can import with one click
- It will be pre-configured to receive data from the other modules


## Troubleshooting

| Problem | Possible cause | What to try |
|---------|---------------|-------------|
| ESP32 cannot find the WiFi network | Hotspot is turned off | Check hotspot is on and the name matches what is in your ESP32 code |
| Cannot open Node-RED in the browser | Node-RED is not running | Open Termux and start Node-RED again |
| Dashboard shows no data | ESP32 is not sending data, or is sending to the wrong address | Check the ESP32 code has the right IP address for the phone |
| Phone battery drains fast | Hotspot + Node-RED uses a lot of power | Keep the phone plugged into a charger (or Module 3 solar powerbank) |
| Internet data is being used up quickly | Node-RED is sending too much data online | Reduce how often data is sent, or only send summaries |


## How this connects to the other modules

This is the hub that ties everything together:

- **Module 1 — Water Tank Level Sensor:** Sends water level data to this
  base station over WiFi
- **Module 2 — Soil Moisture Sensor:** Sends soil moisture and valve status
  to this base station over WiFi
- **Module 3 — IoT Solar Powerbank:** Can power this phone when there is no
  mains electricity


## Putting it all together

When all four modules are running, your system looks like this:

```
  ☀️ Solar Panel
      |
  [ Module 3: Solar Powerbank ]
      |         |          |
   powers    powers     powers
      |         |          |
  [ Module 1 ] [ Module 2 ] [ Module 4 ]
   Tank Sensor  Soil+Valve   This Phone
      |            |             ^
      |            |             |
      +-----WiFi--+------WiFi---+
                                 |
                           Node-RED dashboard
                                 |
                           3G/4G to internet
                                 |
                         view from anywhere
```


## Notes and learnings

*(This section will be updated as the module is built and tested. We will
share what went well, what was tricky, and any changes we made along the way.)*


---

**License:** Open source — use, share, and adapt freely.
**Project:** [Farmers IoT Toolkit](https://github.com/sunriselabs)
