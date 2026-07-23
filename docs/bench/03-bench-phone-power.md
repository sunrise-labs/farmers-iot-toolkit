# Bench Test — Base-Station Phone Power (OPPO A3 4G)

> **Prerequisites:** none. This one is independent of the RS485 chain — you can run it while
> the sensor work is blocked.
> **Phone:** OPPO A3 4G, model **CPH2669** — 5100 mAh (**~19.4 Wh**), Android 14 / ColorOS 14.
> **Design this feeds:** `docs/03` → "Powering a phone from this pack", and `devlog.md` 2026-07-22.
> **Why it exists:** every phone-power decision is currently a 3× range. This closes it.

## What you're actually deciding

Not "does the phone work" — it works. You're deciding **whether the phone can live in the field
at all**, and if so, which of three designs to build:

| | Design | Cost | Decided by |
|---|---|---|---|
| **Tier 1** | $3 pack-voltage relay, charge only on solar surplus | ~$3 | Tests 1 + 3 |
| **Tier 2** | Phone-commanded 60–80% charge band | ~$3 + firmware | Test 1 |
| **Tier 3** | Second 20 W panel, keep it simple | ~$20 | Test 3 |
| **Tier 0** | Phone goes in the shed on mains, node talks LoRa | $0 today | All of them |

That last row is real and it's the cheapest. Keep it on the table while you measure.

## The good news: the two most important tests need no equipment

You probably don't have an inline USB power meter, and one won't arrive in Mauke this week.
**You don't need one.** Tests 1 and 2 need only the phone's own battery percentage and a clock,
and between them they decide whether Tier 1 is viable at all.

Test 3 does need a current measurement — but your **multimeter in series** gives a *better*
number than a USB meter would, because it measures on the pack side and therefore includes the
buck converter's losses automatically. See Test 3.

## Parts

| Item | For | Have it? |
|---|---|---|
| The phone, SIM in, in its final software config | everything | ✅ |
| A clock / your laptop | Tests 1, 2 | ✅ |
| Multimeter with a 10 A DC current range | Test 3, 5 | ✅ |
| The 3S2P pack | Tests 3, 5 | 🚧 mid-build |
| A 5 V buck + USB socket wired up | Tests 3, 4, 5 | ❓ build it first |
| Inline USB power meter (~$10) | optional convenience | ❌ don't wait for one |

---

## Test 0 — Put the phone in its *deployed* configuration

Everything below is worthless if you measure a different configuration than you deploy. Ten
minutes, do it properly.

- [ ] **Screen off**, and set screen timeout to the shortest option
- [ ] **WiFi hotspot ON**, named as it will be in the field
- [ ] **Mobile data ON**, 4G, SIM active
- [ ] **Node-RED running** under Termux, with the real flow loaded (`flows/water-level-flow.json`)
- [ ] **Battery optimisation disabled for Termux** (as per `docs/04` Step 4) — otherwise you'll
      measure a phone that quietly killed Node-RED an hour in
- [ ] **Adaptive brightness / auto-sync / background app refresh** left exactly as they'll be
- [ ] **Nothing else running.** No YouTube, no camera, no other apps you opened to check something
- [ ] **Note the mobile signal strength** in Settings → About → Status (dBm). Write it down —
      this is the single biggest swing factor in the whole budget

> ⚠️ **Do not "clean up" the phone to make the test look good.** If you're going to deploy it
> with three Google apps syncing in the background, measure it with three Google apps syncing
> in the background. A flattering bench number that doesn't survive the field is worse than no
> number, because you'll design against it.

**Leave at least one ESP node connected to the hotspot and POSTing**, if you can. An idle AP
with no clients is a different power state than a working one.

---

## Test 1 — Overnight unplugged drain ⭐ *the one that matters most*

**Why:** In the recommended design the phone spends most of its life **unplugged**, running on
its own 19.4 Wh. This test tells you directly how long it survives a night and a cloudy morning.
If the answer is "6 hours", Tier 1 is dead and you need Tier 3 or Tier 0. Nothing else you
measure changes that.

**It costs you nothing but going to bed.** Start it tonight.

### Procedure

1. Charge the phone to **100%**, then **unplug it**
2. Note the time and the percentage
3. Leave it alone, in Test 0 config, somewhere it won't be picked up
4. Read it again after **at least 8 hours** — longer is better, 12–14 h is ideal

If you have Termux:API installed (`pkg install termux-api` + the Termux:API app from F-Droid),
log it properly instead and get a curve rather than two points:

```bash
while true; do
  echo "$(date -Iseconds) $(termux-battery-status | tr -d '\n')" >> ~/batlog.txt
  sleep 300
done
```

A curve is worth having — a phone that drops fast for two hours then flattens is telling you
something (a sync finishing, a wakelock releasing) that two endpoints hide.

### Convert %/hour → watts

1% of this phone = **0.194 Wh**. So:

| Drop | Draw | Runs 100% → 20% in | Verdict |
|------|------|--------------------|---------|
| 1 %/h | 0.19 W | 80 h | 🟢 excellent |
| 2 %/h | 0.39 W | 40 h | 🟢 comfortable |
| 3 %/h | 0.58 W | 27 h | 🟢 fine |
| 4 %/h | 0.78 W | 20 h | 🟡 workable — covers a night, not a whole grey day |
| 5 %/h | 0.97 W | 16 h | 🟡 marginal |
| 6 %/h | 1.16 W | 13 h | 🟠 tight — Tier 1 needs a generous ON threshold |
| 8 %/h | 1.55 W | 10 h | 🔴 won't reliably cover a night |
| 10 %/h | 1.94 W | 8 h | 🔴 Tier 1 is not viable |

### Decision rule

**≤4 %/h → build Tier 1.** The phone covers a 14 h night with margin and tops up next morning.

**5–7 %/h → build Tier 1 but pair it with Tier 3** (second panel), and set the relay's ON
threshold lower so it starts charging earlier in the day.

**≥8 %/h → stop and go to Test 2 before deciding anything.** A phone burning 1.5 W+ at idle
almost always has one specific cause, and it's usually fixable. Don't accept it as a given.

### Record

```
Start:      ____ %  at ____
End:        ____ %  at ____
Elapsed:    ____ h
Drop:       ____ %  =  ____ %/h  =  ____ W
Signal:     ____ dBm
Node-RED still running at the end?   Y / N
```

That last line is not a formality. If Node-RED died at 2am, you measured the wrong thing.

---

## Test 2 — Repeat with mobile data OFF

**Why:** To find out how much of Test 1 was the **modem**. Mauke is a long way from a tower, and
a phone straining for a weak signal can pull 0.5–1 W on the radio alone — more than everything
else on the phone combined. This is the difference between "the phone is expensive" and "the
*signal* is expensive", and they have completely different fixes.

**This test only needs 3–4 hours**, not overnight, because you're looking for a difference, not
an absolute.

### Procedure

Same as Test 1, but **Settings → Mobile data OFF**. Hotspot stays on. Node-RED stays running.
(The hotspot still works without mobile data — it just has no internet. That's fine, you're
measuring power, not connectivity.)

### Decision rule

| Test 1 − Test 2 | Meaning | What to do |
|---|---|---|
| < 0.2 W | Modem is cheap. Signal is fine. | Nothing — the cost is elsewhere |
| 0.2–0.5 W | Normal for a rural cell | Nothing, but budget for it |
| **> 0.5 W** | **The modem is your biggest single load** | Fixable — see below |

**If it's >0.5 W, the fix is cheap and it's not a power fix:**
- **Lock the phone to 4G only** (Settings → Mobile network → Preferred network type). A phone
  hunting between 4G/3G/2G at the edge of coverage burns power on every switch.
- **A cheap external LTE antenna** if the phone supports one, or simply **mounting the box
  higher / on the tower-facing side of the shed**. Line of sight is worth more than watts.
- If the phone reaches the tower fine but *drops* often, that's the same problem wearing a
  different hat.

### Record

```
Start:      ____ %  at ____        End: ____ %  at ____
Drop:       ____ %/h  =  ____ W
vs Test 1:  ____ W  ←  this is the modem's share
```

---

## Test 3 — Plugged-in draw at the pack ⭐ *the budget number*

**Why:** This is the number that goes into the Wh/day budget and decides Tier 3. It's what the
pack actually pays to keep the phone running once it's full.

**Prerequisite:** you need the 5 V charge path built — pack → buck → USB socket. If it isn't
built yet, build it before this test, using the wiring rules in `docs/03` → "Wiring the charger:
five things that catch people". Do not skip the D+/D− short; Test 4 checks it.

### Why the multimeter beats a USB power meter here

A USB meter measures **after** the buck converter, so it tells you what the *phone* draws. You
care what the *pack* pays, which is 15–25% more. Measuring on the pack side with your multimeter
in series gives you that directly — no efficiency assumption needed.

### Procedure

1. **Charge the phone to 100% first** and let it sit plugged in for 20 minutes. You want the
   steady state where all input goes to *running* the phone, not filling it
2. Set the multimeter to **DC current, 10 A range**, leads in the **10 A jack**
3. Break the **positive** wire of the phone's charge branch and put the meter **in series**
4. Read the current. Also read the **pack voltage** with the phone still connected
5. **Watts at the pack = amps × pack volts**

> ⚠️ **Use the 10 A jack, not the mA jack.** Steady draw will be ~100–250 mA, which the mA range
> would handle — but the moment the phone decides to top up it can pull ~1 A, and that blows the
> mA fuse. Ask how I know is a joke here; just use the 10 A jack.
>
> ⚠️ **A meter in current mode is a wire.** Never put it across the pack terminals in that
> configuration, and take it out of series when you're done — don't leave it in the rig.

### Also worth capturing while you're there

**Peak charging current**, with the phone at ~50% and actively charging. This sizes the buck and
the fuse — not the daily budget, but you need it before you pick parts.

### Convert to a daily budget

**Wh/day = watts × 24.** Then compare:

| Your figure | Wh/day (phone) | + field gear 5.5 | vs 20 W panel |
|---|---|---|---|
| 0.5 W | 12 | 17.5 | 🟢 clear day fine, overcast survivable |
| 0.8 W | 19 | 24.5 | 🟢 clear day fine, overcast = deficit |
| 1.2 W | 29 | 34.5 | 🟡 eats 60% of a clear day |
| 1.5 W | 36 | 41.5 | 🟠 eats 70%+ of a clear day |
| 2.0 W | 48 | 53.5 | 🔴 eats a whole clear day. Panel cannot keep up |
| 2.5 W | 60 | 65.5 | 🔴 deficit even in full sun |

Panel reference: **50–60 Wh clear, 6–15 Wh heavy overcast.**

### Decision rule

**Under 1.0 W → one panel is enough if you duty-cycle (Tier 1). Don't buy the second panel yet.**

**1.0–1.5 W → Tier 1 *and* the second panel.** Duty-cycling alone won't carry a wet-season run.

**Over 1.5 W → don't put this phone in the field on one 20 W panel.** Either two panels
minimum, or seriously revisit Tier 0 (LoRa + phone in the shed). At this draw the phone is the
system's dominant load and everything else is a rounding error.

### Record

```
Steady current (phone at 100%):   ____ mA   at pack ____ V   =  ____ W
Peak current (phone charging):    ____ mA   at pack ____ V   =  ____ W
Wh/day (steady × 24):             ____ Wh
```

---

## Test 4 — Is the phone actually allowed to draw more than 500 mA?

**Why:** If the USB data pins aren't shorted, Android sees a "computer port" and politely caps
itself at 500 mA — 2.5 W. It will charge, slowly, and then fall behind. **And the symptom is
indistinguishable from an undersized panel.** This test takes two minutes and rules out a fault
that could otherwise eat a week of blaming the solar.

### Procedure

Phone at ~50%, actively charging, multimeter in series as in Test 3.

| You see | Meaning |
|---|---|
| **~150 mA at the pack** (≈0.5 A at 5 V after buck ratio) | ❌ **Capped.** D+/D− not shorted |
| **500–900 mA at the pack** | ✅ Correct — phone is taking 1.5–2 A at 5 V |

Rough conversion: pack current ≈ USB current × (5 V ÷ pack V) ÷ 0.85. At 11 V pack, 2 A on the
USB side ≈ 1.07 A on the pack side.

**If capped:** short **D+ to D−** at the USB socket (the two inner pins). Re-test. This is the
single most common way this build silently underperforms.

---

## Test 5 — Is the buck converter big enough?

**Why:** The Mini360 in your BOM is an MP2307 in a 17×11 mm package with no heatsink. Rated 3 A
on paper; realistically ~1.5 A before it gets hot, drifts, or shuts down. A sealed box in
tropical sun is the worst possible environment for a converter that's already at its limit.

### Procedure

Phone charging at full rate (from Test 4), so the buck is at its hardest working point.

1. Measure the **buck's output voltage** with the phone connected and drawing. Not open-circuit —
   open-circuit tells you nothing. This project's recurring signature is exactly this: *fine
   open-circuit, collapses under load*
2. Leave it running **20 minutes**, then carefully feel / measure the converter's case temperature

| Result | Verdict |
|---|---|
| Output holds ≥5.0 V, case warm | ✅ Acceptable — but still consider a bigger one for a sealed box |
| Output sags below 4.9 V under load | ❌ Too small. Replace with a 5 V/3 A synchronous module |
| Too hot to hold a finger on (>60 °C) | ❌ Replace. It will get worse inside an enclosure in the sun |

Remember it will run **hotter in the field than on your bench** — a sealed box in Mauke sun is
20–30 °C above ambient before the converter adds its own heat.

**Target output setting: 5.15–5.2 V** (not 5.0 V) to cover cable and connector drop at 2 A.
Never above 5.25 V.

---

## ~~Test 6 — Confirm the 18650 cell capacity~~ ✅ **ANSWERED 2026-07-23, no bench work needed**

The cells are **Samsung SDI INR18650-32E** — datasheet now in
`hardware/18650-cells-INR18650-32E.pdf`. That closes this test from paper:

| | |
|---|---|
| Cell capacity | **3200 mAh** typical (3100 min) |
| Cell nominal | **3.65 V** — not the 3.7 V that gets assumed |
| Pack | 6.4 Ah × 10.95 V = **~70 Wh** |
| Usable at 80 % DoD (emergency) | **56 Wh** |
| **Everyday usable (~55 %)** | **~38 Wh** ← use this one |

**This was 27 % more pack than the docs assumed**, so every autonomy figure below improved.
It does **not** change which Tier you build — the panel is the constraint, not the bucket.

> **Still worth 60 seconds at the bench:** pull one cell and check the wrapper actually says
> INR18650-32E. The datasheet tells you what was *ordered*; the wrapper tells you what
> *arrived*. Relabelled 18650s are common enough that this is cheap insurance — and if they
> turn out to be something else, redo the sums with `mAh × 2 × 10.95 ÷ 1000`.

```
Wrapper says:     ____________________   (expect: INR18650-32E)
Matches?          Y / N   — if N, recompute everything below
```

---

## Filling in the decision

When you're done, you should be able to complete this sentence and stop guessing:

> The phone draws **____ W** unplugged and **____ W** plugged in, of which **____ W** is the
> modem. On a **~38 Wh** usable pack against a 20 W panel, that means we build **Tier ____**.

Then update:
- `STATUS.md` → the "How to power the base-station phone in the field" open decision → resolved
- `devlog.md` → a new entry with the measured numbers (the durable record — this file is a
  worksheet, the devlog is the archive)
- `docs/03` → replace the estimated table in "A worked example — the phone we're using" with
  the real figures

## The question to ask before you buy anything

If Test 3 comes back over 1.5 W, don't reflexively buy a second panel. **Ask whether the phone
needs to be in the field at all.** PCB decision A2 already keeps LoRa as a backhaul option, and
a LoRa node reporting to a phone that lives in the shed on mains power makes this entire
document unnecessary. Two panels cost $40 and permanent maintenance; that decision costs nothing
today and stops being free the moment you build and document a solar phone-charging rig.
