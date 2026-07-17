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

Termux is a Linux terminal that runs on Android. It's how Node-RED runs on a phone.

> ### ⚠️ Get it from F-Droid, NOT the Google Play Store
> The Play Store version was abandoned years ago and is frozen at an old release.
> Package installs fail on it in ways that look like network or server errors, and
> you will waste an afternoon before suspecting the app itself. This is the single
> most common way this build goes wrong.
>
> Install from **[f-droid.org/packages/com.termux](https://f-droid.org/en/packages/com.termux/)**
> or the **[Termux GitHub releases](https://github.com/termux/termux-app/releases)**.

1. Install **F-Droid** (you'll need to allow "install from unknown sources").
2. Search F-Droid for **Termux** and install it.
3. Open Termux. You get a black screen with a `$` prompt. That's correct.

> **Typing on a phone keyboard is miserable.** Termux supports copy/paste — long-press
> the screen. You can also `pkg install openssh`, run `sshd`, and type from a laptop
> on the same hotspot. Worth it if you have one.

### Step 4 — Install Node-RED inside Termux

Type these one at a time. The first two take a few minutes each.

```bash
pkg update && pkg upgrade -y
pkg install -y nodejs
npm install -g --unsafe-perm node-red
```

> **`--unsafe-perm` is not optional.** Without it the install dies partway through
> building native modules. It sounds alarming; it isn't. It just lets npm's build
> scripts run as the current user, which on Termux is the only user there is.

Start it:

```bash
node-red
```

Leave that running. It prints a wall of text ending with `Server now running at
http://127.0.0.1:1880/`.

> ### ⚠️ Android will kill Node-RED unless you stop it
> This is the second afternoon-waster. Android's battery saver ("doze") suspends
> Termux when the screen sleeps. Node-RED stops, your sensors' data vanishes, and
> **nothing reports an error** — the sensor nodes just time out silently.
>
> Two things, both needed:
> 1. In Termux, run **`termux-wake-lock`** (or swipe down the notification shade and
>    tap **Acquire wakelock** on the Termux notification).
> 2. **Settings → Apps → Termux → Battery → Unrestricted** (the exact path varies by
>    phone; look for "battery optimisation" and exempt Termux).
>
> Keep the phone on its charger regardless — running a hotspot plus Node-RED will
> flatten a battery in hours.

### Step 5 — Open the Node-RED dashboard

- On the phone, open a browser to **`http://localhost:1880`**
- From a laptop on the same hotspot, use **`http://192.168.43.1:1880`**

You should see the Node-RED editor — a blank canvas with a palette of blocks.

> **What's the phone's IP?** On its own hotspot Android is almost always
> **192.168.43.1**. If that doesn't work, the easiest way to find it is to *ask a
> sensor*: the water level firmware prints `gateway : <ip>` on its serial output when
> it connects, and the gateway **is** the phone.

### Step 6 — Import the ready-made flow

We ship a flow that receives water level readings. Import it:

1. In the Node-RED editor, tap the **☰ menu** (top right) → **Import**.
2. Paste the contents of **[`flows/water-level-flow.json`](../flows/water-level-flow.json)**.
3. Tap **Import**, then **Deploy** (top right).

You now have an endpoint at `/water` listening for readings.

**Test it before involving any hardware:**

```bash
curl -X POST http://192.168.43.1:1880/water \
     -H 'Content-Type: application/json' \
     -d '{"node":"test","ok":true,"depth_mm":500}'
```

Open the **debug sidebar** (the bug icon, right-hand panel) and you should see the
message arrive. If this doesn't work, no amount of sensor debugging will help — fix
it here first.

> ### ⚠️ Every `http in` needs an `http response`
> If you build your own flow, remember this. An `http in` node with nothing sending a
> response leaves the request hanging open — the sensor waits, times out, and reports
> a failure, while Node-RED shows the message arriving perfectly fine. It looks like
> a network fault and is not. The bundled flow already wires this correctly.

### Step 7 — Point a sensor at it

In the sensor's `config.h`, you only need three things:

```c
#define BENCH_MODE 0                    // was 1 for bring-up
#define WIFI_SSID  "FarmIoT"
#define WIFI_PASSWORD "your-hotspot-password"
```

**You do not need to set an IP address.** Leave `POST_URL` empty and the node works
out where the base station is by itself — the phone running the hotspot is the node's
gateway by definition, so it already knows the address the moment it connects.

Flash with:

```bash
arduino-cli compile --upload --fqbn esp8266:esp8266:nodemcuv2 -p /dev/ttyUSB0 firmware/water-level
```

(**`compile --upload`, not `upload`** — bare `upload` doesn't rebuild and will flash
whatever was compiled last, so your config changes silently don't take effect.)

Watch the serial output at 115200. A working node says:

```
WiFi: connecting to FarmIoT....... ok
  my ip   : 10.215.63.141
  gateway : 10.215.63.55   <- the phone. POST_URL should point here.
  rssi    : -49 dBm
raw=153  depth=127 mm
{"node":"water-tank-1","ok":true,"raw":153,"depth_mm":127,"rssi":-49,"uptime_s":6}
POST: 200 ok
```

> ### ⚠️ The hotspot IP is NOT always 192.168.43.1
> Every guide on the internet says it is. **Ours came up on `10.215.63.55`.** Modern
> Android randomises the hotspot subnet, and it can change again after a hotspot
> restart or a reboot.
>
> This is why the firmware derives the address instead of storing it. If you hardcode
> an IP, it will work until the day it silently doesn't — the node keeps reading the
> sensor perfectly and nothing ever arrives, with no error anywhere to tell you why.
>
> If you do need to point at a real server rather than the phone, set `POST_URL`
> explicitly and it overrides the auto-detection.

### Reading the serial output

`POST: failed (-1)` means the node couldn't open a socket at all — usually the address
isn't on this network. It prints the URL it tried, so compare it with the `gateway`
line. A **positive** code (like 404) means the server answered and didn't like the
request — that's a Node-RED flow problem, not a network one.


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
