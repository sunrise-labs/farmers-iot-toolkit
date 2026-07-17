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

> ### ⚠️ If you power a phone from this: do not leave it at 100% in a hot box
>
> This one catches almost everybody, and it is a **fire risk**, not a
> maintenance annoyance.
>
> A lithium battery held at **100% charge** and **high temperature** degrades
> fast — every 10°C above 25°C roughly doubles the damage. A phone sealed in a
> box in tropical sun, plugged in permanently, sits at *both* extremes at once.
> A cell held at 40°C and full charge can lose ~35% of its capacity in a year,
> and swollen phone batteries catch fire.
>
> Using an old phone as a solar-powered base station is exactly this scenario.
> **It is a matter of when, not if.** Reduce the risk:
>
> - **Shade and ventilate the enclosure.** Never mount it in direct sun. This is
>   the single easiest win.
> - **Don't charge the phone to 100%.** Some phones can cap the charge level in
>   settings; there are also inline USB "charge limiter" gadgets.
> - **Inspect the phone every few months.** Any bulge, any lifting of the screen
>   or back cover — retire it immediately.
> - **Never mount a phone against anything flammable** — not on a dry timber
>   wall, not in a shed full of hay or fuel.

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

Here is the part that makes this genuinely nasty. A 4S pack on this panel does
**not** look obviously broken. It charges on a cool morning, settles around
15–15.5V, and reads like a working battery. What it never does is **finish**.

Completing a charge matters for a reason that isn't obvious: **the BMS only
balances the cells at the top of a full charge.** A pack that never reaches full
never balances. The cells drift apart over months, the weakest one starts hitting
the cutoff early, and the pack's usable capacity quietly collapses — long after
you've stopped suspecting the panel.

So the 4S failure isn't "it won't charge." It's **"it charges just enough to look
fine, and destroys itself over a year."** That is the worst kind of fault.

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


## How long will it last? (the energy budget)

> **This is the most important section in this guide, and the one people skip.**

Here is the rule that decides whether your system runs forever or dies in a week:

> **Batteries are a bucket, not a tap.**
> The panel fills the bucket. Your devices empty it. Adding more batteries makes
> the bucket bigger — it does **not** make the tap run faster.
>
> If your devices use more energy each day than the panel collects, **more
> batteries will not save you.** You will just take longer to run flat.

So you have to compare two numbers, both measured in **watt-hours per day (Wh/day)**.

### What the panel collects

A 20W panel does not give you 20W all day. Between heat, dust, angle and cloud, a
realistic figure for a well-aimed panel in the tropics is:

**About 50–60 Wh on a good day.** Plan on less in the wet season.

### What your devices use

Multiply each device's watts by the **hours per day it is actually awake**:

| Device | Power while awake | Awake how often? | Wh/day |
|--------|-------------------|------------------|--------|
| Soil sensor (x2) | 0.35W each | 5% (wakes to read) | **~1** |
| Water level probe | 0.5W | 5% | **~0.6** |
| ESP32 sensor node (x2) | 0.6W each | 5% (deep sleep between reads) | **~1.5** |
| Solenoid valve | ~7W | 20 min/day | **~2.5** |
| **Field gear total (sleeping properly)** | | | **~5.5** |
| Android phone (see below) | **measure it** | 100% — cannot sleep while charging | **~17–67** ⚠️ |

### The phone: measure it, don't estimate it

The phone is the one device you should not guess at, because the guesses are
badly wrong in both directions.

**A WiFi hotspot sitting idle costs only ~0.3W** — much less than people assume.
So the hotspot is *not* usually the problem.

**But a phone that is plugged in can never go into deep sleep.** Android's Doze
mode only engages when a device is *unplugged* — connecting a charger wakes it
straight back up. A permanently solar-charged phone therefore runs at its
awake-idle floor forever, and that floor is what costs you, not the hotspot.

Realistic total for a plugged-in phone running a hotspot and Node-RED:
**~0.5–2W**, which is **~17–67 Wh/day** out of your pack. That range is too wide
to design against — so **measure yours** with an inline USB power meter (~$10) on
the charge cable, and use the real number.

**If you measure more than ~1W, the hotspot is not your culprit.** Look at:
- a wake-lock holding the CPU out of idle
- Node-RED flows polling on a timer, so the processor never settles
- **poor mobile signal** — a phone straining to reach a distant tower can pull
  0.5–1W on the modem alone
- charging losses, or a worn-out phone battery

### What this tells you

- **Sensors that sleep are almost free.** ~5.5 Wh/day against a 50–60 Wh/day
  panel is a ten-fold margin. This is what the module was designed for.
- **A phone is not free, but the hotspot is not why.** At ~17–67 Wh/day a
  plugged-in phone can rival the whole panel — because it can never deep-sleep
  while charging, not because of the WiFi.
- **Don't bother duty-cycling the hotspot.** It only costs ~0.3W, so switching it
  off for 50 minutes an hour saves ~5 Wh/day — and Android won't let you toggle a
  hotspot from a script without rooting the phone. The effort is far better spent
  on the panel.

### The test that actually matters: cloudy days in a row

**A sunny-day surplus tells you almost nothing.** Any solar system looks fine in
the sun. What kills them is a run of overcast days — and in the tropics that means
the wet season (Nov–Apr), not the dry months when you probably built it.

A heavily overcast tropical day collects only **10–25%** of a clear day:

| | Clear day | Heavy overcast |
|---|---|---|
| Panel collects | 50–60 Wh | **6–15 Wh** |
| Sleeping sensors only (5.5 Wh/day) | ✅ big surplus | ✅ still fine |
| Sensors + duty-cycled phone (~22–29 Wh/day) | ✅ surplus | ❌ **deficit of 7–23 Wh/day** |

With the phone attached, a wet-season cloud sequence drains the pack in roughly
**2–4 days — under 2 days in the worst case.** That is the number to design
against, not the sunny-day margin.

> **A caution about the "usable" figure.** The 44Wh usable number assumes draining
> the pack to 80%, which is an *emergency* depth, not an everyday one. Cycling that
> deep daily in tropical heat wears the cells out in a year or two. For everyday
> planning, treat usable as ~28–33Wh — which halves the autonomy above again.

### The cheapest fix is almost always another panel

If your budget doesn't close, the instinct is to add batteries. **Resist it** —
re-read the bucket rule above. Ranked by value for money:

1. **Fix the panel you have.** Point it north (southern hemisphere!), tilt it,
   clean it, un-shade it. Often worth 2× on its own, for free.
2. **Add a second 20W panel (~$15–25).** Doubles your harvest. This is the only
   fix that addresses the cloudy-run failure, and it is far cheaper than the
   engineering effort of shaving every device's budget.
3. **Duty-cycle harder.** Real, but it's the last lever, not the first.
4. **More batteries.** Only after 1–3, and only for riding out cloud — never to
   fix a daily deficit.

> **Keeping the phone's mobile data on is cheap** (~0.1–0.3W). It is the **WiFi
> hotspot** that is expensive — it transmits a beacon every 0.1 seconds and can
> never sleep while it is on. If you need the phone for internet backhaul, keep
> it; just don't leave the hotspot running all night.

**The habit to build:** before adding any device, ask "how many watt-hours a day?"
and check it against your panel. Not against your battery.


## How this connects to the other modules

This module provides power to the other modules:

- **Module 1 — Water Tank Level Sensor:** Plug the ESP32 into this powerbank
- **Module 2 — Soil Moisture Sensor:** Powers the ESP32 (valve still needs
  its own 12V source)
- **Module 4 — Mobile WiFi Base Station:** ⚠️ **Check the energy budget first.**
  A phone running its hotspot 24/7 can outrun this panel on its own. Either
  duty-cycle the hotspot, or give the phone its own panel and pack.


## Notes and learnings

*(This section will be updated as the module is built and tested. We will
share what went well, what was tricky, and any changes we made along the way.)*


---

**License:** Open source — use, share, and adapt freely.
**Project:** [Farmers IoT Toolkit](https://github.com/sunriselabs)
