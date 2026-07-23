# Devlog — Farmers IoT Toolkit

Running log of decisions, gotchas, and dead-ends found during development. Newest
entries at the top. The point is to save future-us (and anyone else building this
rig) the hours we burned the first time.

Format per entry: date, what we were doing, what bit us, and what actually worked.

---

## 2026-07-23 — USB-meter readings on the OPPO from a PC port (a charge curve, NOT the budget)

Put the OPPO A3 on charge through a USB power meter. **Source is a PC USB port, not the 3S2P
pack** — important for how these read. Two frames, ~27 min apart:

```
  frame 1  hardware/android-charging.webp    4.9319 V  0.3618 A  → 1.78 W   00:00:41  25.2 °C
  frame 2  hardware/android-charging-2.webp  5.0312 V  0.0663 A  → 0.33 W   00:27:46  25.8 °C
                                             303.0 mWh  60.7 mAh accumulated (Set 1)
```

Both frames cross-check internally (mWh÷mAh and mAh÷time both reproduce the live V/A), so they're
real. Cumulative average over the 27:46 run: **131 mA / 0.66 W**. The current **tapered 362 → 66
mA** — a textbook charge curve flattening as the phone fills. Frame 2 is near-full trickle.

**What the two load points measure together — series resistance:**

Voltage *rose* (4.93 → 5.03 V) as current *fell* (362 → 66 mA). That's load-dependent IR drop, and
two points solve it:

- Effective series R (PC-port cable + connectors + meter) ≈ **0.34 Ω**, implied open-circuit
  ≈ 5.05 V.
- Extrapolated, **at 2 A the terminal voltage would fall to ~4.4 V — under the 4.75 V floor**, at
  which point the phone throttles to trickle.

So the "4.93 V looks low" note from the first frame was right and is now quantified. ⚠️ **But this
resistance is a PC USB port and its cable — not the deployed pack→buck→cable path.** It does not
condemn the field rig; it demonstrates the mechanism, and it's exactly why `docs/03` says short
thick cable + set the buck to 5.15–5.2 V. The number that matters must be re-measured on the real
buck.

**What these frames do NOT settle — the source rules them out structurally:**

- **Not the budget number (bench Test 3).** That needs the phone at ~100 % in *deployed* config
  (hotspot + 4G + Node-RED, screen off) at its *steady* draw off the pack. This is charge-in
  current on a PC port, tapering to trickle — a different thing entirely.
- **Cannot test the 500 mA cap (bench Test 4), and not because of the number.** A PC port
  enumerates the phone as a data host (SDP), so the phone caps *itself* and will never ask for the
  ~2 A DCP path regardless of D+/D−. The 66 mA here is near-full trickle, not a cap. **Test 4 only
  works off the pack+buck path with the phone run LOW** — pinned at ~500 mA = D+/D− open (bad),
  climbing toward ~2 A = shorted (good).

Next, both off the pack (not the PC): steady plateau in deployed config (Test 3), and a low-phone
peak (Test 4). Bench sheet: `docs/bench/03-bench-phone-power.md`.

---

## 2026-07-23 — The cells are Samsung INR18650-32E: the pack is 70 Wh, not 55

Datasheet arrived and is now in `hardware/18650-cells-INR18650-32E.pdf` (Samsung SDI, v2.0,
made in Korea). It closes the "confirm the cell capacity" caveat that every pack number in this
project was hanging off.

| | Was assumed | Actually |
|---|---|---|
| Cell capacity | ~2500 mAh (back-derived) | **3200 mAh** typical, 3100 min |
| Cell nominal | 3.7 V | **3.65 V** |
| Pack nominal | 11.1 V | **10.95 V** |
| Pack energy | ~55 Wh | **~70 Wh** (6.4 Ah × 10.95 V) |
| Usable @ 80 % DoD | 44 Wh | **56 Wh** |
| Everyday usable (~55 %) | 28–33 Wh | **~38 Wh** |

**27 % more pack than the docs were designed against**, which improves every autonomy figure —
phone-attached wet-season drain goes from ~2–4 days to ~2–5 days, and phone autonomy from
0.5–1.3 days to 0.6–1.5.

**It changes no design conclusion.** The binding constraint on this system was never the size of
the bucket, it's the 20 W panel's daily harvest. `docs/03` already says this better than I can:
more batteries don't make the tap run faster. Tier selection for the phone charger is unchanged
and still waits on the measurement.

### Three things the datasheet settles that we'd been hand-waving

- ⚠️ **Charging is rated 0–45 °C. Discharging is fine to −20…60 °C.** That asymmetry is the
  useful part: *powering* sensors in a hot box is fine, *charging* in one is not — and a sealed
  box in tropical sun runs 20–30 °C over ambient at exactly the hour the panel is pushing
  hardest. The NTC charge-temperature cutoff already chosen in `pcb/DESIGN-BRIEF.md` (C2) now
  has a trip point with a spec behind it rather than a general worry about heat. Set it at 45 °C;
  recorded in `ATO-HANDOFF.md`.
- **The sag to ~9.0 V is state-of-charge, not impedance.** ≤35 mΩ/cell → ~53 mΩ for the pack, so
  a 1 A load costs ~53 mV and 2 A costs ~105 mV. When the valve question talks about "a pack
  that sags to 9.0 V", that's a *discharged* pack — not the solenoid pulling it down. A 0.5–1 A
  inrush is nothing to cells rated 6.4 A continuous (12.8 A for the pack). Doesn't solve the
  valve pull-in problem, but it does rule out one suspect: don't go looking for dynamic sag.
- **The MPPT can't overdrive these cells.** 20 W panel through the CN3722 tops out around 1.6 A
  at 12.6 V, under the 1.92 A pack standard-charge current (2 × 960 mA). No derating needed.

### Propagated to

`hardware/3S2P.md` (source of truth — full spec table + a "what the datasheet corrected"
comparison), `docs/03` (frontmatter, parts table, the 3S2P explainer now has a "how much energy
is actually in there?" worked example, the usable-figure caution, the phone-as-second-pack
table, and a new ⚠️ safety box on the charge-temperature limit), `docs/bench/00-bench-rig.md`,
`docs/bench/03-bench-phone-power.md` (Test 6 struck out as answered — but keep the 60-second
wrapper check, since the datasheet says what was *ordered* and the wrapper says what *arrived*),
`pcb/DESIGN-BRIEF.md`, `pcb/ATO-HANDOFF.md`, `STATUS.md`.

---

## 2026-07-22 — Powering the base-station phone off the pack: duty-cycle the CHARGER, not the phone

The field phone is an **OPPO A3 4G (CPH2669)**: 5100 mAh (**~19.4 Wh**), Snapdragon 6s Gen 1,
Android 14 / ColorOS 14, 45 W SuperVOOC, 6.67" 120 Hz LCD. Question: can the 3S2P pack carry it
24/7 so we get its 4G as backhaul, and how does the charger wire in.

**Answer: not plugged in permanently, not on one 20 W panel. And the pack isn't the binding
constraint — the panel is.**

### The energy budget for this specific phone

Screen off, hotspot up, 4G attached, Node-RED running. Buck loss taken at 85%:

| Case | At phone USB | At pack | Wh/day |
|------|-------------|---------|--------|
| Good signal, quiet flows | 0.7 W | 0.82 W | **20** |
| Typical | 1.3 W | 1.5 W | **37** |
| **Poor signal** (modem straining for a distant tower) | 2.0 W | 2.4 W | **57** |
| + field gear, sleeping | | | +5.5 |

Against a 20 W panel: **50–60 Wh clear, 6–15 Wh heavy overcast.** So a clear day is break-even
at best and a deficit at worst — marginal *in full sun* — and an overcast run is a 10–56 Wh/day
deficit. With ~38 Wh everyday-usable in the pack that's **0.6–1.5 days of autonomy.**
*(Updated 2026-07-23 — was 0.5–1.3 on the pre-datasheet 28–33 Wh estimate.)*

Mauke is a small island a long way from a tower, so the poor-signal row is a live risk, not a
hypothetical. A straining modem can outdraw everything else on the phone combined. ~~⚠️ The pack
figure is derived from the doc's "44 Wh at 80% DoD", implying ~2500 mAh cells — confirm the
actual cell capacity.~~ **Resolved 2026-07-23: Samsung INR18650-32E, 3200 mAh → pack is ~70 Wh,
~38 Wh everyday-usable. See the entry above.**

### Why you can't just make the phone sleep

Three facts that kill the obvious approach:

1. **Doze only engages when unplugged.** Android exits Doze the instant a charger connects, and
   that is unchanged through Android 14. A permanently-plugged phone never gets the win.
2. **The hotspot defeats Doze anyway.** Tethering holds a wakelock, so unplugging alone buys
   nothing while the AP is up.
3. **Duty-cycling the hotspot is a dead end.** It's only ~0.3 W, and ColorOS won't let a script
   toggle it without root.

### The reframe: the phone's own battery IS the night buffer

19.4 Wh in the phone vs ~38 Wh everyday-usable in the pack. The phone is carrying **half a
second pack** and we were treating it as a load. Charge it in bursts from daytime surplus and
let it coast on its own cell overnight. Three wins at once: skips the pack's round-trip loss,
removes the "sits at 100% in a hot box" fire/degradation mode `docs/03` already calls *when, not
if*, and puts the field gear ahead of the phone in the failure order.

**Tier 1 — hardware hysteresis, zero code.** Adjustable voltage-comparator relay (XH-M203 /
XY-DJ class, ~$3) in the pack→buck→phone line. **ON at ~12.3 V** (pack near full = solar has
surplus), **OFF at ~11.6 V** (pack falling = protect the sensors). On a cloudy run the phone
stops charging, runs ~20 h on its own battery, then dies *while the sensors keep logging*.
Backhaul degrades before sensing does — that's the correct failure ordering.
⚠️ These modules have real quiescent draw (5–20 mA = 0.7–2.6 Wh/day at 11 V). Measure it; prefer
a MOSFET or latching-relay output over a continuously-held coil.

**Tier 2 — phone-commanded, fail-safe to charging.** Reuse the `GET /valve` polling pattern
exactly: node polls `GET /charge`, phone answers from `termux-battery-status` — `false` above
80%, `true` below 60%. Node drives a MOSFET on the 5 V line. That 60–80% band is the single
biggest lever on the phone battery's life in a hot box.
**Fail-safe rule: default CLOSED (charging) on timeout or boot.** If the phone dies it must be
able to come back. Do not invert this — an inverted default is a base station that can never
restart itself, and nobody is standing there to notice.

Tier 1 is the outer loop (protects the pack), Tier 2 the inner loop (protects the phone
battery). Neither can strand the other.

**Tier 3 — buy the second panel (~$20).** Per the doc's own ranking this is cheaper than any of
the above engineering, and it's the only fix that addresses the cloudy-run deficit rather than
rationing around it.

### Charger wiring — the gotchas

- **Mini360 won't cut it.** MP2307, 17×11 mm, no heatsink: rated 3 A peak but realistically
  ~1.5 A sustained before it drifts or shuts down. A phone pulling 2 A in a sealed tropical box
  will cook it. Use a synchronous 5 V/3 A buck (MP1584-class, ~90%). Avoid LM2596 — 75–80%
  efficiency is ~1 W of heat paid for daily, out of a budget this tight.
- ⚠️ **Short D+ to D− at the USB socket or you get 500 mA.** A bare buck + soldered socket
  presents an SDP and Android caps at 500 mA = 2.5 W, which will never keep up with ~1 W
  continuous *plus* recharging. Shorting the data pins signals DCP → the phone pulls up to ~2 A.
  Pre-made USB step-down modules usually do this already; **verify with a meter, don't assume.**
  This one looks exactly like "the solar isn't keeping up" and it isn't.
- **SuperVOOC will not engage** — it needs OPPO's own brick and handshake. We get plain 5 V, and
  that's desirable: 10 W instead of 45 W is far less heat in the box.
- **Set the buck to 5.15–5.2 V** and use a short, thick cable. At 2 A a long thin cable drops
  below the 4.75 V the phone wants and it silently throttles to trickle. Don't exceed 5.25 V.
- **Tap at P−, through the BMS** — same rule as everything else (`hardware/3S2P.md`). The phone
  is a load; it goes through the protection FETs.
- **Its own 2 A fuse**, so a chafed phone cable can't take the sensors down with it.
- **Sequence it after the ground fault.** The phone branch shares ground with the node. With ①'s
  green/ground intermittent still open, don't add a second ground path until that's fixed — one
  gremlin at a time.

### Two flags before any of this gets built

- **LoRa makes this problem optional.** PCB decision A2 already has LoRa-first with the phone as
  *one of two* gateway backhauls. If the node talks LoRa, the phone doesn't have to be in the
  field at all — it sits in the shed on mains and none of this exists. Deciding which variant we
  actually deploy is free today and expensive after a solar phone-charging rig is built and
  documented.
- **A CPH2669 is a current-model phone, not the old one `docs/04` is written around.** Cycling it
  at 40 °C in a sealed box will visibly degrade it and the doc's fire warning applies in full.

### The measurement plan (do this before building anything)

The doc's own rule is *measure, don't estimate*. Half a day of bench work turns every range above
into a decision. **Written up as a runnable bench sheet: `docs/bench/03-bench-phone-power.md`.**

1. **Overnight unplugged drain** (battery % + a clock, no equipment) → real autonomy on 19.4 Wh,
   and the number Tier 1 lives or dies on. Start it tonight.
2. **Repeat with mobile data OFF** → isolates the modem, tests the poor-signal risk directly.
3. **Plugged-in steady draw, multimeter in series on the pack side** → the Wh/day budget figure.
4. **Does the phone actually pull >500 mA on our buck?** → confirms D+/D− is right.
5. **Mini360 under load: output voltage + case temp after 20 min** → confirms whether it's replaced.
6. **Confirm the 18650 cell capacity** → every pack number scales off it.

Two things worth recording about the method, because they were the useful realisations:

- **The most important test needs no equipment at all.** In the recommended design the phone is
  *unplugged* most of the time, so its unplugged drain rate is the number that decides
  everything — and that's just battery percentage over a night. No USB meter, no waiting for
  parts, no excuse to defer it.
- **A multimeter in series beats an inline USB meter here.** A USB meter reads *after* the buck
  and tells you what the phone draws; we care what the *pack pays*, which is 15–25% more.
  Measuring on the pack side gives that directly with no efficiency assumption. Use the **10 A
  jack** — steady draw is ~150 mA but a top-up spike hits ~1 A and would blow the mA fuse.

---

## 2026-07-17 — This node's relay is active-HIGH: `VALVE_ACTIVE_LOW` → 0

Set `VALVE_ACTIVE_LOW 0` in config.h — the relay board on this node energises on a
HIGH input, not LOW. The default assumed active-LOW (most 1-channel boards, and it
gives fail-safe-closed at boot when the pin floats). This board is the other kind.

Consequence to keep in mind now that it's active-HIGH: at boot the pin floats LOW,
which is de-energised = valve CLOSED, so it *still* fails safe — good. But `setup()`
writes the CLOSED level before `pinMode(OUTPUT)` regardless, so boot is covered either
way. If a future board clicks the wrong direction, this flag is the first thing to flip.

Separate and still open: the relay clicks but the **solenoid doesn't actuate** — traced
to USB+MT3608 not sourcing enough current for the coil (fine open-circuit, collapses
under load — the project's recurring signature). Fix is to drive the valve from the
battery pack through the relay, not the boost. Being tackled with the battery switch.

---

## 2026-07-17 — OTA firmware update added to `farm-node`, before going to battery

Added ArduinoOTA to `firmware/farm-node/`. Reflash over WiFi, no cable — the point
being the node's about to move to battery and won't always have a USB cable on it.
Config gates it: `OTA_ENABLE`, `OTA_HOSTNAME`, `OTA_PASSWORD` in config.h. Compiles
clean; +37 KB flash (28% of 1 MB), IRAM 94%→95% (under ceiling).

**The one that must be said out loud: the FIRST flash carrying OTA still goes over
USB.** OTA can only *receive* an update once OTA-capable firmware is already running.
So flash this build over the cable one last time while it's still on the bench —
then every update after is wireless. Disconnect USB *after* that, not before.

Fail-safe wired in: `ArduinoOTA.onStart` forces the valve CLOSED before flashing.
The sketch stops running during an update, so a relay latched OPEN would otherwise
stay open across the whole flash + reboot — exactly when nobody's watching.

Non-blocking by construction: the report loop's `delay()` is now `otaDelay()`, which
services `ArduinoOTA.handle()` while it waits. A plain delay would leave the node deaf
to an update for the whole `REPORT_INTERVAL_S` and fail the handshake. Sensor reads
themselves (sub-second) are deliberately left alone — poking OTA mid-read risks the
bit-banged SoftwareSerial timing, and a missed window just means retrying the upload.

### ⚠️ GOTCHA: a glob path in a `/* */` header comment killed the whole build

The espota example in the header comment had `.../esp8266/*/tools/espota.py`. The
`*/` in that glob **closed the block comment early** — every line after became code,
and the compiler vomited 30 errors deep inside `IPAddress.h` that had nothing to do
with the real cause. The first error (`'tools' does not name a type`, `missing
terminating ' character` on an apostrophe further down) was the only honest one.
Fixed by writing `<ver>` instead of `*`. **Never put `*/` inside a C block comment**,
not even in a path — and when a build explodes in a system header, scroll to the
*first* error, it's usually yours.

### Push an update (once the OTA build is running)

```bash
arduino-cli compile --fqbn esp8266:esp8266:nodemcuv2 \
    --output-dir /tmp/farm-node firmware/farm-node
python3 ~/.arduino15/packages/esp8266/hardware/esp8266/<ver>/tools/espota.py \
    -i farm-node-1.local -p 8266 --auth=change-me-ota \
    -f /tmp/farm-node/farm-node.ino.bin
```

`-i` takes `<OTA_HOSTNAME>.local` or the node's IP; `--auth` is `OTA_PASSWORD`. Node
and laptop must be on the same hotspot. In the Arduino IDE it also just appears as a
network port. Change the password before the node leaves the desk — anyone on the
hotspot can otherwise overwrite it.

---

## 2026-07-17 — Module ② valve bring-up: manual control works, and the valve isn't the valve we documented

Shipped **manual** valve control end to end: firmware drives a relay on **D2**, and the
Node-RED page (`GET /`) grew **Open/Close buttons**. No moisture thresholds yet — that's
deliberate, it's the next step. `firmware/farm-node/` + `flows/both-sensors-flow.json`.
Verified by `arduino-cli compile` (clean) and by executing the flow functions with stubs
(button → state → poll round-trips; the page renders the buttons and confirmation).

### The valve on the bench is not the valve in the BOM

`hardware/Manual - Plastic Solenoid.pdf` describes a small plastic 12mm quick-connect valve.
The unit we're actually fitting is a **big all-brass ½" solenoid with a 4-bolt diaphragm
cover — a pilot/servo-assisted valve.** And the plan grew a second valve type: this brass one
is the **master on the 6000L tank** (gates every line); smaller **25mm brass valves become
per-row zone valves.**

Consequence for the node: **the combined ESP8266 has zero spare pins** (D5/D6 water, D7/D1
soil, D2 master valve). Each zone valve needs its own GPIO+relay, so zones are a **separate
controller (an ESP32), not this board.** The master valve *is* the D2 valve — nothing about
the current build changes.

### ⚠️ GOTCHA: you can't ohm-out a potted solenoid coil, and 0.3 Ω is not a coil

The brass valve's coil is a **sealed slide-on donut with two leads potted straight in — no
terminals.** Probing the bare wire ends read **~0.3 Ω, identical to shorting the probes.**
That's not a shorted coil; it's the two bare ends touching each other. **0.3 Ω across a "12V
coil" is physically impossible** (that would be 40 A) — a near-zero reading means *you are not
on the coil*, you're reading a short between your own probes. We never got a clean number off
it; pull-in will be judged empirically once it's wired.

Two smaller meter traps on the way: a reading in **`mV`** means the dial is on volts, not ohms;
and on ohms, **probes-together reading ~0.3 (even slightly negative) is normal** — that's lead
resistance, and it confirms you really are in resistance mode.

### The 25mm zone valve DID measure: 24.3 Ω → 0.49 A. And "inrush" is the wrong worry.

The smaller valve had real steel terminals: **24.3 Ω = 0.49 A / ~6 W at 12V** (0.37 A at 9V).
A comfortable, well-behaved load.

The reframe worth keeping: **a DC solenoid is an inductor, so its current *ramps up* from zero
— there is no capacitor-style inrush spike.** Worst-case current is simply **I = V / R_coil**,
reached after a few L/R time constants. So an **ohmmeter across the cold coil tells you the
entire load in ten seconds** — no bench supply, no current rig. That single reading sizes any
converter.

### The boost question: don't add one for an under-volt you haven't confirmed

Tempting to drop an MT3608 between the pack and the valve "in case it sags below 12V." Held off,
on this devlog's own principle — *don't add complexity to solve a problem you haven't measured.*
Two 10-second, no-power tests collapse the decision: **coil resistance** (current at any voltage)
and **pull-in voltage** (does it click in on the bare pack?). If it pulls in below ~9V, the pack
feeds it direct and there is no converter at all.

Topology note if a converter IS needed: it's a **boost, not a buck** — the 3S2P pack sits *below*
12V for most of its discharge (12.6 → 9.0V). And an 11→12V lift (ratio 1.09) is well within the
MT3608's comfort zone, unlike the 11→18V it already does for the water probe.

### ⚠️ Pilot/servo valves need minimum pressure — the gravity-tank trap

The brass valve's diaphragm cover marks it **pilot-operated.** Those need a **minimum pressure
differential (~0.2 bar / 0.02 MPa) to open** — they borrow line pressure to lift the diaphragm.
On a **gravity tank feed with low head, a pilot valve won't open no matter how perfect the
wiring**, and it looks exactly like an electrical fault. A ~2m water column is ~0.2 bar, right at
the edge. Check the head above the valve; if it's marginal, a **direct-acting ("0 bar") valve**
is the right part.

### Flyback diode: you don't need a 1N5819, or even a Schottky

For a **relay-switched DC solenoid, diode speed is irrelevant** (the relay opens in ms), so any
ordinary rectifier works: **1N400x (1A) or 1N540x (3A)**. Reverse voltage only needs to beat 12V
— any 50V+ part. Avoid the tiny glass **1N4148** (~0.2A, too small). We salvaged a **1N5408
(3A/1000V)** off a scrap board — tested good at **0.477 V forward / OL reverse** in diode mode.
3A covers both valves with margin.

Desolder lesson: those boards are **RoHS = lead-free solder**, which melts ~30°C hotter (~217 vs
183°C), so a modest iron struggles. Set ~**370°C**, clean/re-tin the tip, use a fat chisel tip,
and **add fresh leaded solder to the joint** to drop its melting point. When all else fails,
**snipping the part off is a legitimate fallback** — a cut diode with short leads still works.

### Polarity: the coil doesn't have one, the diode does

The solenoid **coil is just wound wire — non-polar; either lead can be +.** What *does* have
fixed polarity is the **12V supply** and the **flyback diode**. Rule: pick either coil lead as
the "+ leg", run 12V+ to it, and put the **diode's band (cathode) on that same +12V leg.**
Reversed, the diode is forward-biased the instant the valve powers on and **shorts the supply.**

Placement: landing the diode's anode on the **relay COM screw terminal is fine and tidy** — COM
is the same electrical node as the coil's − leg (they're wired together). Just don't confuse it
with putting the diode **across COM–NO** (the switch contacts) — it goes across the *coil*.

### The valve can't damage the laptop

The solenoid draws from the **12V adapter through the relay's isolated switched contacts** — its
current never touches USB. The laptop only feeds the ESP + relay coil (~0.1 A). **No common ground
is needed** between the 12V side and USB, and that isolation is exactly why 12V can't backfeed the
laptop. (Modern USB ports current-limit on overload anyway.) The only way to put valve current on
USB is to wire the coil to the ESP's 5V pin — don't.

### Firmware notes worth keeping

- **Downlink by POLLING, not a server.** The node GETs `/valve` every ~1s; a page button sets
  `flow.valveCmd` in Node-RED. We poll because the phone's hotspot hands the node its IP and can
  change it — the node always knows its gateway, never the reverse (same reasoning as deriving the
  POST host at runtime).
- **Fail-safe closed at boot:** write the CLOSED level *before* `pinMode(OUTPUT)` so the pin can't
  glitch open during boot.
- **A failed poll HOLDS the last state** — a WiFi blip shouldn't cycle the valve. (When autonomy
  lands, the real safety net is max-open + fail-closed-on-bad-read.)
- The node **echoes its actual pin state** back in the `/soil` payload (`valve:open|closed`) so the
  page shows commanded vs confirmed — not the same thing.
- **This node's relay turned out active-HIGH** — set `VALVE_ACTIVE_LOW 0`. Most 1-channel boards
  are active-LOW; ours wasn't. If Open/Close come out reversed, that's the flag.

---

## 2026-07-16 — BOTH sensors on ONE ESP8266 → Node-RED. And a wire that lies.

Both probes now read on a single ESP8266 and POST to the phone:

```
WiFi: connecting to FarmIoT............. ok
  gateway : 10.215.63.55   <- the phone
WATER  raw=139    depth=113 mm
SOIL   moisture=0.0 %   temp=20.2 C   EC=0 uS/cm
POST /water: 200 ok
POST /soil: 200 ok
```

Two sensors, two bauds, both slave address 1, one board. Firmware `firmware/farm-node/`,
flow `flows/both-sensors-flow.json`. **First time the soil sensor has run on the ESP8266.**

### The two-bus decision: a dollar of hardware beats a risky write

Both sensors ship as **slave address 1**, and they run different bauds (soil 4800,
water 9600). Sharing one RS485 bus needs us to rewrite one sensor's address *and*
baud registers — on sensors we own exactly one of each, three weeks from a deadline,
where a bad write lands on the address and costs you the ability to talk to the thing
at all.

**Two transceivers on separate pins deletes both problems for about a dollar.** Each
bus has one slave, so address 1 collides with nothing. Each SoftwareSerial instance
carries its own baud, so the mismatch evaporates. No writes, no risk.

Pin budget is now exactly spent: **D5/D6 water, D7/D1 soil, D2 relay.** That is all
five free-and-safe pins. D3/D4/D8 are boot straps; **D0 (GPIO16) has no interrupt
support at all**, so it physically cannot do SoftwareSerial RX — and it's the
deep-sleep wake pin besides. A sixth peripheral means an ESP32.

Consequence worth knowing: **a classic DE/RE breakout cannot share an ESP8266 with
module 1** — two buses plus two DE pins plus a relay wants seven safe pins. The
HW-0519's *missing* DE pin, the thing we cursed on 2026-07-15, is exactly what makes
the combined node fit.

### ⚠️ GOTCHA: `water-level.ino`'s DE pin now jams the soil bus

It drives **D1** as DE and holds it LOW at boot. Harmless while D1 was a disconnected
pin ("it wiggles a disconnected pin", entry below). **D1 is now soil's HW-0519 TXD**,
and an HW-0519 derives transmit-enable *from* TXD — so a LOW D1 clamps its driver onto
the soil bus permanently and the sensor can never answer.

Caught before flashing. Never drive a DE pin on a combined node; `farm-node.ino` has
none. This is the cost of a pin assignment outliving the assumption that justified it.

### CORRECTION: neither HW-0519 echoes. The entry below is wrong.

The entry below says the auto-direction board "echoes our own transmitted bytes back",
and `water-level.ino`'s resync is built on that premise. **Measured on both boards:
no echo.** Replies arrive at exactly `frameLen`:

```
SOIL   sent: 01 03 00 00 00 03 05 CB
SOIL   got : n=11  01 03 06 00 00 00 C9 00 00 F1 4B    <- reply only, no echo prefix
```

The echo is real on the **FT232 USB adapter** (2026-07-15, proven there). It got
attributed to the HW-0519 by analogy when the same symptom appeared. The resync fix
worked — but for a different reason than we thought: it finds the frame at offset 0,
which costs nothing.

**Keep the resync** — it's free, and the FT232 genuinely does echo. But **"no echo" is
not a board-is-alive heartbeat**, which is exactly what we tried to diagnose with
tonight and got wrong. *A fix that works does not confirm the theory that motivated it.*

### ⚠️ GOTCHA: `cat /dev/ttyUSB0` reads ZERO bytes from a perfectly running board

Not the "only prints in `setup()`" trap from earlier today — a second, distinct one.
**Opening the port with `cat`/`stty` drives DTR and RTS, which on a NodeMCU *is* the
auto-reset circuit.** The board sits in reset and emits nothing. Looks exactly like
dead hardware, and cost us a detour while chasing a real fault.

What works — the bundled pyserial, parking DTR and pulsing RTS:

```bash
PYTHONPATH=~/.arduino15/packages/esp8266/hardware/esp8266/3.1.2/tools/pyserial \
python3 -c "
import serial, time, sys
s = serial.Serial('/dev/ttyUSB0', 115200, timeout=0.2)
s.setDTR(False); s.setRTS(True); time.sleep(0.15); s.setRTS(False)
t0=time.time()
while time.time()-t0 < 12:
    d = s.read(512)
    if d: sys.stdout.write(d.decode('utf-8','replace')); sys.stdout.flush()
"
```

The garbage at the start is the 74880-baud boot ROM message read at 115200. Expected,
harmless, ignore it.

### ⚠️ OPEN — THE BIG ONE: the water probe has an intermittent, and it lies

Water went silent mid-session. Then read `raw=139` right after the heat shrink came off
the wires. Then went silent again ~20 minutes later. **Same code, same wiring, three
different results.**

Everything else is eliminated by test, not by argument:

| Ruled out | How |
|---|---|
| Firmware | Known-good `water-level.ino` fails identically |
| The WiFi radio | Fails with `WiFi.forceSleepBegin()`, radio fully off — tested twice |
| MT3608 | 18 V measured at the boost |
| ESP → HW-0519 | TX LED flashing, 3.3 V at VCC |
| A/B orientation | This exact wiring worked 20 minutes earlier |

**What's left is a wire.** `n=0` — total silence, not garbage, not CRC errors — is an
*unpowered probe*, not a confused one. Prime suspect is **green/ground**, which is the
same wire this devlog already fingered for the still-open FT232 dropout:

> *"continuity from FT232 GND to MT3608 OUT− — the green wire must reach **both**"*

**One intermittent, two costumes.** The FT232 dropping off the USB bus and the probe
going silent are very likely the same fault.

**Two lessons worth more than the fix:**

**Submersion cannot make Modbus work.** The probe answers whether it's wet or dry —
depth changes *what number* it reports, never *whether it replies*. So "it started
working when I put it in the bucket" was never a candidate, however suggestive the
timing. When two things change and one of them is *physically incapable* of causing the
effect, you already know which one did it. Don't let coincidence outrank mechanism.

**18 V at the source proves nothing about the load.** We measured 18 V at the MT3608 and
moved on. That is the **third** time this project has been bitten by the same shape: VIN
read 3.10 V open-circuit and collapsed to 20–40 mV under load; the FT232 looked fine
until it didn't; now this. **Meter at the load, under load.** Red-to-green at the probe
would have caught it in ten seconds.

**Next: wiggle each wire while it polls, localise it, then solder.** An intermittent you
can provoke is a gift — normally you can't. And a fault fixed by accident un-fixes itself
by accident: next time inside a sealed box, on a tank, in the rain, where the only
symptom is a node that stopped reporting.

### Node-RED: both sensors, core nodes only

`flows/both-sensors-flow.json` — `POST /water`, `POST /soil`, and `GET /` serving a live
page. **Core nodes only, no `node-red-dashboard`**: every extra install step is a place a
build dies on someone else's phone.

It tracks **staleness** and marks a reading STALE past 90 s. That's the failure you can't
otherwise see — a node that stops reporting produces no error anywhere, so the only symptom
is a number that quietly stops changing. Supersedes `flows/water-level-flow.json`; don't
import both, two `http in` on `/water` conflict.

---

## 2026-07-16 — END TO END: probe → ESP8266 → WiFi → Node-RED on the phone

```
WiFi: connecting to FarmIoT....... ok
  my ip   : 10.215.63.141
  gateway : 10.215.63.55
  rssi    : -49 dBm
raw=153  depth=127 mm
{"node":"water-tank-1","ok":true,"raw":153,"depth_mm":127,"rssi":-49,"uptime_s":6}
POST: 200 ok
```
Modules ① and ④ talking, our own code, real hardware. Backbone of the integration demo.

### ⚠️ GOTCHA: the Android hotspot IP is NOT 192.168.43.1
Every guide says it is. **Ours came up on `10.215.63.55`.** Modern Android randomises
the hotspot subnet, and it can reshuffle on any hotspot restart or reboot.

First POST attempt failed with `-1` (couldn't open a socket) against the hardcoded
`192.168.43.1` from the docs. **The `gateway :` line printed on connect — added maybe
an hour earlier — diagnosed it instantly.**

**Fix: derive the URL from `WiFi.gatewayIP()` at runtime.** The phone running the
hotspot IS the node's gateway, by definition, so the address can't go stale. Leave
`POST_URL` empty in config and the node finds the base station by itself; set it only
to override (a real server on a LAN). **Verified on hardware with no IP configured
anywhere: `POST: 200 ok`.**

Worth dwelling on the failure mode this kills: a hardcoded IP goes stale *silently*.
The node keeps reading the sensor perfectly, publishes happily into the void, and
nothing anywhere reports an error. Every node in the field stops reporting and the
only symptom is absence. Deriving it deletes the whole class — and a farmer never has
to find an IP address, which is the better toolkit anyway.

### Fixed: RSSI sentinel published as data
Disconnected, `WiFi.RSSI()` returns a sentinel (we saw **31**) that looks exactly like
a plausible reading, and we were publishing it. Now only included when the link is
actually up. Publishing a sentinel as data is the same sin as reporting a wrong depth.

### Notes
- Laptop scanning: this box runs **iwd**, not NetworkManager — `nmcli` silently returns
  nothing. `iw dev wlan0 scan` works. That scan confirmed FarmIoT was on 2412 MHz
  (channel 1, 2.4 GHz), ruling out the classic ESP8266 killer of a 5 GHz-only hotspot.
- Config permutations verified to build: auto-derive + WiFi, auto-derive + bench,
  explicit override, and a **legacy config.h with no POST_PORT/POST_PATH** (`#ifndef`
  fallbacks cover it, so nobody's existing config breaks).
- `docs/04` Termux/Node-RED/flow steps were all `(to be added)` placeholders despite
  module ④ being marked Done — written up now, plus `flows/water-level-flow.json`.

---

## 2026-07-16 — Module ① runs on its own hardware: ESP8266 reads the probe

First reading off the ESP8266, no laptop in the chain:
```
raw=153  depth=127 mm
{"node":"water-tank-1","ok":true,"raw":153,"depth_mm":127,"uptime_s":2}
```
Whole chain proven: ESP8266 → HW-0519 → RS485 → QDY30A → back, CRC-valid, with the
ruler-test scaling and dry offset applied. Firmware: `firmware/water-level/`.

### ⚠️ GOTCHA: the MAX485 listing ships TWO different boards
`hardware.md`'s RS485 module link delivered an **HW-0519 auto-direction** board, not
the classic breakout every guide (including ours) assumes. **It has no DE or RE pin**
— a 74HC04D inverter derives transmit-enable from the TXD line itself.

| | Classic breakout | HW-0519 (what we got) |
|---|---|---|
| Spot it | has DE + RE pins | no DE/RE; silkscreen `HW-0519`; extra 14-pin 74HC04D |
| TTL pins | RO, RE, DE, DI, VCC, GND | GND, RXD, TXD, VCC |
| RS485 pins | A, B | A+, B−, 接大地 (earth/shield) |
| Direction | you drive DE/RE from a GPIO | the board does it |

Wiring for the HW-0519: `RXD→D5`, `TXD→D6`, `VCC→3V3`, `GND→GND`. **D1 unused** (the
firmware still toggles it as DE — harmless, it wiggles a disconnected pin). `接大地`
= "connect to earth", the cable shield terminal for long field runs; leave it floating.
Docs updated to cover both variants.

**The TXD/RXD LEDs are a free logic analyser.** TXD flashes on ask, RXD on answer.
Neither = ESP isn't reaching the module. TXD only = sensor not replying, swap A/B.

### ⚠️ GOTCHA: NodeMCU VIN is NOT USB 5V — use VBUS
Metering VIN gave **3.10 V unloaded, collapsing to 20–40 mV** the moment the boost
drew from it. That's not a supply — it's **backfeed through the 3.3 V regulator's
parasitic diode** (3.3 − 0.2 = 3.1 V, exactly). VIN is the regulator's *input*, left
floating when powered over USB. **`VBUS` is the pin that carries USB 5 V.**

That collapse-under-load signature is worth remembering: a rail that reads plausible
open-circuit and dies under any load is a floating pin, not a weak supply.

Bonus: on the MT3608, IN− and OUT− are the same node (non-isolated boost), so
`probe green → OUT− → IN− → NodeMCU GND` satisfies the common-ground rule by topology.
The whole bench rig runs off one USB cable. Boost outputs 18.2 V — fine, the QDY30A
is confirmed 12–36 V (the 18.0 V target only mattered while the HTP-300Y's 24 V
ceiling was still in play).

### ⚠️ GOTCHA: `arduino-cli upload` does NOT recompile
Cost ~30 minutes chasing a board that looked dead. Sequence was: compile with
`BENCH_MODE 1` → flip to 0 → compile to check the WiFi path → flip back to 1 →
`upload`. **The upload flashed the stale `BENCH_MODE 0` binary**, so the board sat in
a 20 s WiFi wait for a hotspot that doesn't exist. Use **`compile --upload`**.

Related trap: the board only prints in `setup()`, so `cat /dev/ttyUSB0` on an
already-running board shows nothing until the next loop print — which looked exactly
like a dead board. **Pulse RESET (RTS) while listening**, or you're reading a window
where nothing is due. `scratchpad/espread2.py` does this via the pyserial bundled at
`~/.arduino15/packages/esp8266/hardware/esp8266/3.1.2/tools/pyserial`. Note `cat` at
**74880** (the boot-ROM rate) is impossible — termios rejects the non-standard baud.

### ⚠️ OPEN: auto-direction echo is eating the retry budget
Serial shows clean reads interleaved with runs of `timeout`. Reads succeed — 5 good
samples out of up to 15 tries — so nothing is broken. But **most of the retry budget
is being spent**, and that margin is what protects a field node on a long, noisy cable.

Cause is the same one the FT232 had (`devlog` 2026-07-15): the auto-direction board
**echoes our own transmitted bytes back**, the reader takes the echo for the reply,
CRC rejects it, attempt scored a timeout. Fix is the pattern `poll-soil.ts` already
uses: **resync on a valid frame header inside the buffer** instead of assuming the
reply starts at byte 0. Next job.

---

## 2026-07-16 — Water sensor Step 4: ruler test PASSED — sensor reports **millimetres**

Closes the last open item on the water sensor. Probe flat on the bottom of a bucket
marked at 30 mm intervals, powered from the MT3608 boost @ 18 V, 4 points captured
with `tools/poll-water.ts --point=<n>mm` (8 CRC-validated frames averaged per point).

| ruler | raw (mean of 8) | spread |
|---|---|---|
| 65 mm | 82.25 | 1 |
| 95 mm | 107.75 | 1 |
| 125 mm | 136.0 | 0 |
| 155 mm | 169.0 | 0 |

Least-squares fit: **`level_cm = 0.10363 * raw − 1.824`**, R² = 0.9966.

### ✅ VERDICT: 1 count = 1 mm. The register map was RIGHT.

```
raw is mm  → predicted slope 0.100 cm/count → measured 0.1036   (3.6% off)
raw is cm  → predicted slope 1.000 cm/count → measured 0.1036   (865% off)
```

The community's mm-vs-cm confusion **does not apply to this unit**. `unit=0x11` (cm)
with `decimals=1` means counts of 0.1 cm — which *is* 1 mm/count. The registers and
the ruler agree. The 10× trap only catches people who read `decimals=1` and then treat
raw as cm anyway. **Use `level_cm = raw / 10`.**

### ⚠️ GOTCHA: you cannot calibrate a 5 m sensor in a bucket — and don't need to

We burned two extra points chasing a 3.6–11% slope discrepancy before reading the spec:

```
Accuracy: 0.2%F.S ; 0.5%FS     ← 0.5% of 5000 mm = ±25 mm
Zero Drift: ±2%F.S             ← ±100 mm
Sensitivity Drift: ±2%F.S
```

Full scale is 5000 mm. Our whole calibration span was 90 mm — **3.6× the instrument's
own error bar**. Fitting a slope across that is measuring a desk with a ruler marked
every 30 cm. The per-step numbers wobbled (1.176 → 1.062 → 0.909 mm/count) and the
residuals showed a real arch (+2.0, −1.6, −2.3, +1.9 mm), but ~4 mm of curvature is
**6× smaller than the sensor's rated accuracy**. It is not resolvable in a bucket and
not worth resolving: ±25 mm on a farm tank is ±2.5 cm, far below what anyone irrigating
a field cares about.

**The ruler test's job is the 10× question (mm vs cm), not the 1% question.** It answered
that decisively at 4 points. Don't rat-hole chasing percent-level slope in a bucket —
pinning the slope to even ±5% would need a multi-metre standpipe.

Statistical trap worth remembering: at 3 points you have **1 degree of freedom**, so the
95% t-multiplier is **12.7**. A tiny-looking standard error (±0.033 mm/count) became a
real CI of ±0.42 — spanning 1.0 easily. R² was 0.999 throughout and told us nothing:
**R² measures collinearity, not extrapolation.**

### GOTCHA: bubble hypothesis — tested, NEGATIVE
The guide warns trapped air in the probe cavity causes up to 15 mm of error, and the
increasing counts-per-step looked exactly like a bubble compressing with depth. Tested
directly: read at 155 mm, wiggled the probe underwater to shed anything clinging, re-read
at the same level. **169.0 → 168.** One count. No bubble. A probe simply set down in a
bucket doesn't trap one — the curvature is the sensor's own low-end behaviour (we were
at 1.3–3% of full scale, where cheap transducers are worst).

### Zero offset is real and bigger than anything above
Probe reads **raw ≈ 26 in air** (~26 mm of water that isn't there). Normal — spec allows
±2% FS = ±100 mm of zero drift. It's a constant, so handle it in software:
`level_mm = raw − dry_offset`, with `dry_offset` read at install time. Reg `0x0005` (zero)
exists for this but needs the `0x000F` commit dance, and a bad write on an unconfirmed
map costs you the sensor. Software offset is free and reversible.

### ⚠️ OPEN: FT232 adapter intermittently drops off the USB bus
Surfaced by luck at the end of the session. `dmesg -T` disconnects by minute:
```
09:51 ×1 (initial plug — normal)   10:04 ×1   10:05 ×1   10:07 ×1   10:08 ×6   → then ABSENT
```
`ftdi_sio ttyUSB0: Unable to read latency timer: -32` on every re-enumeration. Deteriorating,
not stable. **The fault predates the probe wiggle** — it was already dropping during the
calibration, and the wiggle only accelerated it.

**The calibration data survived it because of CRC** — a flaky link drops frames or kills the
port, it cannot forge a CRC-valid frame with a plausible value. All 4 points were 8/8 valid.

Not yet diagnosed. Check in order: (1) the USB plug/cable/port alone; (2) continuity from
FT232 GND to MT3608 OUT− — the green wire must reach **both**, and an intermittent there
leaves the A/B pins as the only bridge between an 18 V rail and the laptop, which is how you
kill an adapter; (3) re-plug the FT232 with no sensor and no 18 V — if it still cycles, the
adapter is dying.

### Tooling
`tools/poll-water.ts` gained: `--point=65mm` (capture one ruler point, averaged, stored),
`--fit` (fit + verdict over stored points), `--read` (averaged read, stores nothing),
`--reset`, and `--calibrate` (interactive loop for anyone following the guide). Depth entry
accepts `mm`/`cm` suffixes — a bare number in `--mm` mode is mm. **That units trap is real:
typing `65` (mm) into a cm prompt fits a line that's silently 10× wrong and R² can't see it.**
Results land in `water-calibration.json`.

**TODO:** the tool writes no per-point timestamps, so captures couldn't be correlated against
the dmesg disconnects. Add them.

---

## 2026-07-15 — Water sensor (QDY30A) bench bring-up: comms + map CONFIRMED

Powered via **MT3608 boost @ 18 V** off the 3S2P pack (pack was 11.31–11.48 V;
sensor spec 12–36 V, so it needs the boost). Wiring per guide: **blue=A, yellow=B**
(reversed vs soil), red=OUT+, green=OUT−&GND. Baud **9600**.

**Register map CONFIRMED against the community source** — raw block read (0x0000–0x0006):
```
01 03 0e | 0001 0003 0011 0001 001a 0000 1388 | 66 d4
addr=1  baudCode=3(9600)  unit=0x11(cm)  decimals=1  value=26  zero=0  range=5000
```
Matches the guide's map exactly. Baseline in air: raw 26 → 2.6 (cm, 1 decimal).

### ⚠️ GOTCHA: MT3608 pot "does nothing" — it's just a 25-turn trimmer
Both MT3608 modules showed Vout = Vin and the pot seemed inert. Cause: it's a
multi-turn trimmer (~25 turns) and the cheap ones **slip at the end stops**, so it
feels like turning while the wiper is parked. Fix: pick ONE direction and turn a
full ~30 turns slowly watching the meter — voltage eventually climbs. (Vout==Vin
also means the IC isn't switching yet — check IN/OUT aren't swapped, but here it
was just the traverse.)

### GOTCHA: the poller needs SEPARATE read/write fds at 9600
`poll-water.ts` first reported "no valid frame" even though a separate `cat`
listener captured a perfect reply. At 9600 the reply arrives ~2× faster than soil's
4800, so on a single r+ handle the adapter's TX→RX turnaround clips the reply
header before the resync can lock on. Fix: open one write fd + one read fd (the read
fd stays in RX the whole time, like the working `cat` capture). After that, 3/3
clean reads in air. (poll-soil.ts left on single-fd — it works at 4800; unify later.)

### Move-test — PASSED
Live poll while lowering the probe into a bucket: LEVEL(0x0004) climbed
26 → 105 (raw) on the way down, held steady at 105 submerged, fell back to ~25 on
lift-out. Smooth, monotonic, repeatable — confirmed it tracks real depth.
Bucket depth produced ~79 counts of change. **Water sensor comms + liveness done.**

### Still open (water)
- Step 4: calibrate raw→cm against a ruler (two known depths, fit the line, verify
  with a third). Community reports mm-vs-cm confusion; the ruler outranks the unit
  register (which claims cm/decimals=1).

---

## 2026-07-15 — Soil sensor (THC-S) bench bring-up: PASSED

Working through `docs/bench/00-bench-rig.md` Step 0 (prove the sensor over the
FT232 USB→RS485 adapter, before the ESP8266 is involved).

**Wiring confirmed** (THC-S, matches the guide):

| Wire | Role | To |
|---|---|---|
| Yellow | A (D+) | adapter `A` |
| Blue | B (D−) | adapter `B` / `−` |
| Brown | V+ | pack + (9–12.6 V direct, no boost) |
| Black | V− | pack − **and** adapter `GD` (common ground) |

- **Baud is 4800**, slave address **1**. Register map: reg0 = moisture (0.1 %),
  reg1 = temperature (0.1 °C, signed), reg2 = EC (µS/cm).
- First bench reading in air: moisture 0 %, temp ~22.5 °C, EC 0 — all physically
  sensible for a probe sitting on the bench.

### ⚠️ GOTCHA: `mbpoll` reports "Invalid CRC" but the sensor is fine

`mbpoll -m rtu -a 1 -b 4800 -P none -d 8 -s 1 -t 4 -r 1 -c 3 /dev/ttyUSB0`
returned **`Invalid CRC` on every frame** — deterministically, 100 %. Looked like
a broken sensor or bad wiring. It was neither.

**Root cause:** the cheap **FT232RL + SN75176 auto-direction USB→RS485 adapter**
echoes/clips bytes when a *single* file descriptor both transmits and reads (which
is exactly what `mbpoll` does). The sensor, wiring, power, and baud were all correct.

**How we proved it:** read the port with a *separate* listener that never
transmits, while sending the request from another fd:

```bash
stty -F /dev/ttyUSB0 4800 cs8 -cstopb -parenb raw -echo
( timeout 2 cat /dev/ttyUSB0 | od -An -tx1 ) &
sleep 0.3
printf '\x01\x03\x00\x00\x00\x03\x05\xcb' > /dev/ttyUSB0
wait
# → 01 03 06 00 00 00 e1 00 00 71 43   (a clean, valid frame — no echo, CRC OK)
```

A dedicated listener sees a perfect frame; `mbpoll` on the same handle chokes.
That split *is* the diagnosis.

**Diagnostic tell worth remembering:** the error *type* flips with baud —
- wrong baud (9600) → **timeout** (sensor doesn't understand the request, stays silent)
- right baud (4800) → **Invalid CRC** (sensor answers; bytes present but mangled)

So "CRC errors, not timeouts" actually means *you're on the right baud* — don't go
hunting the baud rate when you see CRC.

**Fix / tooling:** wrote `tools/poll-soil.ts` (bun) — sends the request, reads a
generous ~400 ms window, resyncs on a valid `01 03 06 …` frame, validates CRC
before trusting it. Tolerant of the adapter's echo/turnaround. Gives live readings:

```bash
bun tools/poll-soil.ts            # live, every 1s
bun tools/poll-soil.ts --once     # single reading
```

**Note for the guide:** don't rely on `mbpoll` with this specific adapter. It's a
tool ↔ adapter interaction, not a rig fault. `tools/poll-soil.ts` is the bench
poller to use instead. (Left `00-bench-rig.md` as-is; this log is the record.)

### Minor environment notes
- `xxd` is not installed on this Arch box — use `od -An -tx1` for hex dumps.
- `mbpoll` is the AUR `mbpoll-git`; already installed, user is in `uucp` group.

### Step 0.7 (make the reading move) — PASSED
Dipped the probe tines in a cup of tap water while `poll-soil.ts` streamed:
- In air: moisture 0.0 %, EC 0, temp 22.5 °C.
- In water: moisture jumped to **83–90 %**, EC to **55–95 µS/cm**, temp *fell*
  toward ~20.7 °C (water cooler than room).
- Pulled out: moisture and EC **snapped back to 0**.
Three registers responded correctly and simultaneously — confirmed live measurement,
not a stale buffer. **Soil sensor Step 0 fully closed.**

### Next
- Water sensor (QDY30A): power via MT3608 boost @ 18 V (pack is 11.48 V, sensor
  spec 12–36 V), baud **9600**, A/B colours **reversed** vs soil (blue=A, yellow=B).
  Tool `tools/poll-water.ts` written and ready (reads config block 0x0000–0x0006),
  untested until the sensor is powered. See `docs/bench/02-bench-water-level-rs485.md`.
- Then ESP8266 + MAX485 for both sensors.
