# Farmers IoT Toolkit — Field Node PCB · Design Brief

> **Living document.** Built by grilling Ian one decision at a time. Each decision
> gets logged here with its rationale so the `ato` (atopile) design that follows is
> traceable back to a *why*, not a guess. Ian has **no EE background** — every
> decision is written to be understandable and defensible to a non-engineer, and the
> board must be **plug-and-play and field-repairable by a farmer**.
>
> Status: **🔒 FROZEN 2026-07-19** — all 9 grill decisions made (A1–F2). Requirements
> locked. The `ato` electrical design starts from here — see `ATO-HANDOFF.md` for the
> build plan, part shortlist, and "start here tomorrow" steps. Reopen a decision only
> by editing its row below and noting the change.

## What this board is

A single **field-node carrier PCB** for the Farmers IoT Toolkit — the "brain box" that
sits in an enclosure on the farm, powered by solar, and does everything the current
ESP8266 breadboard prototype does, plus LoRa and more sensors. It replaces the jumper-wire
prototype with one board a farmer can build, deploy, and repair.

## Inherited hard facts (from the working prototype — do not re-litigate)

| Thing | Fact | Source |
|-------|------|--------|
| Water sensor | QDY30A, RS485 Modbus, **9600 8N1**, addr 1, needs **12–36V** (ran at 18V via MT3608), reg 0x0004 = 1mm, signed | docs/01, farm-node.ino |
| Soil sensor | THC-S, RS485 Modbus, **4800 8N1**, addr 1, runs **4.5–30V** (pack-direct), regs 0x0000–2 | docs/02, farm-node.ino |
| Both sensors | Ship as **slave address 1** from factory; blind register writes can brick them | docs/01, docs/02 |
| Valve | 12V solenoid, normally-closed, needs flyback diode (1N5819), ~0.5–1A inrush | docs/02 |
| Battery | 3S2P **Samsung INR18650-32E** (3200mAh, 3.65V nom) → 6.4Ah / **~70Wh**, 10.95V nom, 12.6V full → sags to ~9.0–9.6V near cutoff. **Charge rated 0–45°C only**; 12.8A max discharge; ~53mΩ pack | hardware/3S2P.md, hardware/18650-cells-INR18650-32E.pdf |
| Charger | CN3722 MPPT buck, CV set 12.6V, needs panel ≥~15V; **3S chosen over 4S for chargeability** | hardware/3S2P.md |
| Panel | 20W, Vmp 18.6V@25°C (~16.5V hot), Voc ~22V, Isc ~1.1A | hardware/3S2P.md |
| Valve sag risk | 12V solenoid may not pull in below ~15% SoC — **unsolved in prototype**, must be designed | STATUS.md, docs/02 |
| Radio (proto) | ESP8266 WiFi → phone Node-RED base station over HTTP POST JSON | firmware/README, CLAUDE.md |
| Radio (wanted) | Heltec WiFi LoRa 32 V3 (ESP32-S3 + SX1262 + OLED) already in BOM | hardware/hardware.md |

## Ian's stated PCB shopping list (the starting requirements)

ESP32 · LoRa · 18650 battery holders · BMS · 20W solar input · GX16 for water sensor ·
4× GX12 for soil sensors · screw terminals for relay/solenoid.

## Design tree (decisions in dependency order)

Each node gets resolved by grilling. ⬜ = open, ✅ = decided, 🔒 = frozen.

- ✅ **A. Architecture** — A1 hybrid ✅ · A2 LoRa-first + phone-4G option ✅ · A3 one flexible board ✅
- ✅ **B. MCU + radio** — socketed Heltec WiFi LoRa 32 V3 (ESP32-S3 + SX1262 + OLED) + external SMA ✅
- ✅ **C. Power tree** — C1 rails ✅ · C2 balanced safety posture ✅
- ✅ **D. Sensor interface** — D1 per-socket RS485 ✅ · D3 pinouts ✅ · D4 surge ✅
- ✅ **E. Valve/actuator** — E1 latching+H-bridge ✅ · E2 brown-out close ✅ · E3 one valve ✅
- ✅ **F. Physical / plug-and-play** — F1 OLED+LEDs+labels+button ✅ · F2 IP65 panel-mount ✅
- 🟡 **G. Tooling scope** — confirmed below; `ato` = electrical design + BOM + KiCad netlist, layout is a follow-on KiCad step

## Open items to resolve before/at layout (not blockers to starting `ato`)

- **LoRa region/frequency:** your BOM lists the **868 MHz** Heltec, but Cook Islands ISM is typically **915 MHz (AS923)**. Confirm the Heltec variant + antenna band before ordering. (Firmware/antenna, not board copper.)
- **LoRa mode:** raw point-to-point LoRa vs LoRaWAN — affects the gateway spec, not this board.
- **Cost target per node:** not yet set — would refine part choices (e.g. how fancy the regulators are).
- **Exact latching valve part:** its pulse voltage/energy spec sets the valve rail + reservoir sizing.
- **Heltec V3 power-input pin + free-GPIO map:** verify against the real pinout during `ato` (2 UARTs + 4 soil enables + valve H-bridge + status LEDs + button must all fit the exposed GPIO).
- **Enclosure part number:** default is a generic IP65 box; a specific one fixes the board outline.

## Decision Log

_(filled as we grill — newest at bottom)_

| # | Decision | Choice | Why |
|---|----------|--------|-----|
| A1 | Integration philosophy | **Hybrid — socket the hard/certified/expensive blocks (Heltec LoRa radio, CN3722 MPPT, BMS); integrate the cheap glue as bare parts (RS485 transceivers, MOSFET valve driver instead of relay module, on-board regulators instead of MT3608 boards, all protection, connectors, power distribution)** | Ian, Q1. Balances repairability (swap a dead radio/MPPT) against a cleaner, smaller, more reliable board than pure jumper-modules. Bare protection is mandatory anyway (can't socket a TVS). Natural v1 that a v2 could integrate further. |
| A2 | Comms model | **LoRa-first field node with WiFi available. Backhaul choice lives at the GATEWAY: (a) LoRa→2nd-Heltec gateway→internet, or (b) Android phone as 4G backhaul. Both offered to the farmer.** Board impact: socket Heltec (both radios) + **external SMA antenna mount for LoRa range**. Gateway box = separate spec (2nd Heltec). | Ian, Q2. LoRa is the point (sensors far from shed); phone-4G stays as an alternative backhaul so no one is forced to build a gateway. |
| A3 | Board scope | **One flexible carrier — full water + 4×soil + valve node; simpler builds just depopulate unused connectors/sections.** (Decided without grilling — reversible, zero-cost design choice; Ian can veto.) | One PCB to fab + document; matches "Ian's farm runs one combined node" while still serving a water-only farmer by depopulation. |
| D1 | Soil RS485 topology | **One RS485 transceiver per GX12 socket (4 total, 3.3V parts e.g. MAX3485/THVD1450). All share one ESP32-S3 UART @4800; ESP32 selects/reads ONE socket at a time so every sensor stays factory addr 1.** Water sensor = its own separate transceiver + UART @9600 → GX16. Exact select scheme (per-chip RE enable + shared DE, or an I2C dual-UART bridge like SC16IS752) finalized at design time. | Ian, Q3. True plug-and-play — 4 identical unconfigured sensors just work; no addressing chore; no brick risk; honours the toolkit's 'never write to sensors' rule. Costs ~$1.50 + a few GPIO (ESP32-S3 has them). |
| E1 | Valve type + driver | **Latching solenoid only, driven by an H-bridge (single-coil bistable, pulse-to-open / pulse-to-close). Near-zero energy between changes.** Pulse fed from a regulated source so it fires consistently at any pack SoC. Water probe therefore gets its OWN boost rail (~18V, low current) since it no longer shares a held 12V valve rail. ⚠️ Farmer must source a latching valve (pricier/less common than the $8 standard NC one). | Ian, Q4. Lowest power = best for solar. |
| E2 | Valve fail-safe | **Brown-out auto-close: reservoir/supercap + power-loss detector fires ONE close pulse through the H-bridge as the rail collapses, so the valve shuts even on a dying battery.** Restores fail-closed despite the latching valve. | Ian, Q5. Keeps latching power savings AND the 'water stops when power dies' guarantee the docs promise. |
| E3 | Valve count | **1 valve for the whole node (v1).** 4 soil sensors inform the single valve (trigger on driest/average). | Ian, Q6. Simplest/cheapest first board; matches Ian's single 'solenoid' wording; expandable in v2. |
| C1 | Power architecture (defaults) | **6× 18650 in holders on-board (3S2P, no spot-weld) · socketed 3S BMS · socketed CN3722 MPPT + solar input · buck→5V (Heltec) · 3.3V from Heltec LDO for logic/RS485 · boost→~18V water probe · regulated pulse source + reservoir for latching valve · soil sensors pack-direct · reverse-polarity + fusing + TVS throughout.** | Holders (not welded pack) suit a toolkit farmer; rails match each load's real spec; protection is mandatory. Safety posture depth = Q7. |
| C2 | Power/battery safety posture | **Recommended balanced: reverse-polarity + fuses on battery AND solar, TVS surge clamps, warm MPPT in its own vented thermal zone away from cells, + charge-temperature cutoff (NTC on cells pauses charging when hot).** | Ian, Q7. Sane safety for an unattended sealed tropical box; closes the unresolved NTC worry in 3S2P.md. |
| D3 | Field connector pinouts | **Water = GX16 4-pin (18V, GND, A, B); each soil = GX12 4-pin (pack V+, GND, A, B).** | Matches each sensor's 4-wire cable; aviation connectors chosen for IP/weatherproofing. |
| D4 | Field-cable surge protection | **±15kV ESD-rated RS485 transceivers + TVS clamps on every A/B pair and field power line, all 5 field connectors.** | Ian, Q8. Survives induced surges from nearby lightning — the common tropical field-cable killer. |
| F1 | On-board human interface | **Heltec OLED made visible (live readings + status) · one labelled status LED per function (power, charging, radio link, per-sensor OK/fault, valve state) · clear silkscreen labels on every connector · a 'test valve' button.** | Ian, Q9. On-site install + fault diagnosis with no phone — the core of 'plug and play for farmers'. |
| F2 | Enclosure + connector mounting (default) | **Design to a standard IP65 sealed enclosure; GX12/GX16 connectors PANEL-mounted on one gland face, pigtailed to board headers (not board-edge). OLED behind a window; solar + valve glands on the same face.** (Default — Ian can name a specific enclosure.) | Panel-mount aviation connectors are the rugged, weatherproof, field-serviceable norm; one connector face simplifies sealing. |

## What `ato` (atopile 0.15.7) will and won't do — set expectations early

- **Will:** capture the electrical design as code (modules, nets, connectors, power
  rails, protection), generate a **netlist, BOM, and a KiCad PCB** with parts and
  ratsnest, pick real JLCPCB-orderable parts.
- **Won't (by itself):** auto-place and auto-route a finished, manufacturable board.
  Physical layout — where connectors sit, copper pours, thermal/creepage for the
  power section — is a KiCad step after `ato`. For a farmer-repairable carrier board
  this is very tractable; for a fully-integrated RF board it is a professional job.
- This is *the* reason the A1 root decision matters so much.
