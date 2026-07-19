# atopile Design — Handoff / Start-Here-Tomorrow

> **Purpose:** everything needed to begin the `ato` (atopile) electrical design of the
> Farmers IoT Toolkit field node **cold**, without re-deciding anything. Requirements
> are FROZEN in `DESIGN-BRIEF.md` (9 decisions, A1–F2). This doc turns those decisions
> into a concrete build plan.
>
> **Written:** 2026-07-19 (end of grilling session). **Updated:** 2026-07-19 (build
> session — scaffold + architecture skeleton done). **Next session:** pick up at
> "§7 Remaining work" — the gate is now **part resolution**, which needs network.

---

## 1. Where we are

- ✅ Requirements grilled and **FROZEN** — `pcb/DESIGN-BRIEF.md` Decision Log is the source of truth.
- ✅ **`ato` project scaffolded** at `pcb/farm-node-pcb/` (flattened, no nested git). Entry `main.ato:App`.
- ✅ **Architecture skeleton written and BUILD-VERIFIED offline** — 5 `.ato` files
  (`power`, `rs485`, `valve`, `mcu`, `main`) capture every decision A1–F2 as module
  stubs with typed interfaces. `ato build` → SUCCESS (31 "no footprint" warnings, all
  expected — parts pending). This is the real electrical topology; only the physical
  parts are deferred.
- ✅ **Step-4 spine decision MADE** (was the one open architecture item) — see §7.
- ✅ **LoRa band resolved: 915 MHz / AS923** (Cook Islands follows NZ AS923). The BOM's
  **868 MHz Heltec is the wrong variant** — order the 915 part + matching antenna.
- **Tool state:** `atopile 0.15.7` (`~/.local/bin/ato`, via `uv tool`) ✅ · **KiCad 10.0.3
  installed** ✅ (handoff's prereq gap is CLOSED).
- **The KiCad-plugin-path warning is HARMLESS** — verified: `ato build` produces a full
  KiCad PCB + BOM + netlist despite it. The warning only affects interactive layout
  push-sync into an open KiCad session (atopile 0.15.7 looks for KiCad 9.x's plugin dir).
- **⚠️ NEW BLOCKER for the next pass — part resolution needs network this env can't give:**
  - `ato build` runs a **part picker that fetches from `api.atopile.io`** on every valued
    passive / real part. In this session that host **won't resolve** (`Name or service not
    known`) — the machine has IPv6-only egress via the netbird VPN and `api.atopile.io` /
    `packages.atopile.io` return no AAAA record, while `atopile.io`, `google.com`, raw IPs
    all work. So `ato add` (registry) and part-picking both fail here.
  - `ato create part -s <mpn>` **also needs a TTY** ("Input is not a terminal — Aborted"),
    so it can't be driven from a non-interactive shell regardless.
  - **Consequence:** the skeleton builds offline (stubs have nothing to pick), but resolving
    real LCSC parts + valued passives must happen where `api.atopile.io` resolves and a real
    terminal is available (fix IPv6/DNS for that host, or run on a normal network). See §7.

## 2. The board in one line

Solar-powered LoRa field node: socketed Heltec WiFi LoRa 32 V3 + 3S2P 18650 power with MPPT/BMS, 4× plug-and-play soil sensors + 1 water sensor over RS485, 1 latching irrigation valve with fail-closed brown-out, farmer-visible OLED/LEDs — on one IP65 board.

## 3. Frozen decisions (quick reference — detail in DESIGN-BRIEF.md)

| ID | Decision |
|----|----------|
| A1 | **Hybrid** integration — socket Heltec/MPPT/BMS; integrate the rest as bare parts |
| A2 | **LoRa-first** + WiFi available; backhaul choice (LoRa gateway *or* phone 4G) at the gateway; **external SMA** |
| A3 | **One flexible board**, depopulate for simpler builds |
| B  | Socketed **Heltec WiFi LoRa 32 V3** (ESP32-S3 + SX1262 + OLED) |
| C1 | Rails: buck→5V (Heltec), 3V3 from Heltec LDO (logic/RS485), boost→~18V (water probe), regulated pulse rail (valve); soil pack-direct |
| C2 | **Balanced safety:** revpol + fuses (batt+solar), TVS, MPPT thermally isolated, **charge-temp cutoff (NTC)** |
| D1 | **One RS485 chip per soil socket** (4×), shared UART, one-at-a-time select → all sensors stay addr 1 |
| D3 | Water **GX16-4** (18V/GND/A/B); soil **GX12-4** ×4 (packV+/GND/A/B) |
| D4 | **±15kV ESD RS485 + TVS** on all 5 field connectors |
| E1 | **Latching** solenoid via **H-bridge** (pulse open/close) |
| E2 | **Brown-out auto-close** (reservoir + power-loss detector fires close pulse) |
| E3 | **One valve** (v1) |
| F1 | **OLED visible + status LED per function + connector labels + test-valve button** |
| F2 | **IP65**, GX connectors panel-mounted on one gland face, pigtailed to board headers |

## 4. Functional block diagram (text)

```
                    20W PANEL ──▶ [Solar in + revpol + fuse + TVS]
                                        │
                                  [CN3722 MPPT]  (socketed, vented, NTC on cells)
                                        │
   [6× 18650 holders 3S2P] ── [3S BMS] ─┴─ VBAT (9.0–12.6V, protected P-)
                                        │
        ┌───────────────┬──────────────┼──────────────┬─────────────────┐
        │               │              │              │                 │
   [Buck →5V]     [Boost →18V]   [Valve pulse    [Soil V+ =         [revpol/
        │          (water probe)   rail + resv]    VBAT direct]      fuse/TVS
   [Heltec V3] ◀─5V   │              │                │              already at
   ESP32-S3+LoRa      │         [H-bridge]      (to 4× GX12)         inputs]
   +OLED, 3V3 out ─┐  │         [brown-out
        │          │  │          detector] ──▶ screw terminals ▶ LATCHING VALVE
   ┌────┴────┐     │  │
  I²C      UARTs   │  │     RS485 (3V3, ESD) + TVS:
   │  (OLED +      │  │      • water xcvr ──▶ GX16 (9600)
   │   SC16IS752   │  └──────• water probe power = 18V
   │   + PCF8574?) │
   │               └── 4× soil xcvr (one enabled at a time) ──▶ 4× GX12 (4800)
   │
  status LEDs ×~7, test button
```

## 5. Power rails / budget (fill exact currents at design)

| Rail | Source | Feeds | Approx current | Candidate regulator |
|------|--------|-------|----------------|---------------------|
| VBAT 9–12.6V | pack via BMS P- | everything downstream | — | (protected node) |
| 5V | buck from VBAT | Heltec 5V in | ~0.3–0.5A (LoRa TX spikes) | MP1584 / TPS563201 |
| 3V3 | Heltec on-board LDO | RS485 xcvrs, I²C chips, LEDs | <100mA | (from Heltec — verify budget) |
| ~18V | boost from VBAT | water probe only | <50mA | small boost (MT3608-class / MP3423) |
| valve pulse | reg rail + reservoir cap | H-bridge → latching coil | pulse ~0.5–1A, ms | size to chosen valve |

## 6. Candidate part shortlist (verify + resolve LCSC IDs in `ato`)

| Block | Candidate part | Note |
|-------|----------------|------|
| MCU+radio | **Heltec WiFi LoRa 32 V3** | Socket on 2× female headers; confirm **868 vs 915 MHz** (Cook Is = likely 915/AS923) |
| RS485 xcvr ×5 | **THVD1450** (TI, 3.3V, ±18kV IEC ESD, sep DE/RE) | ESD-rated satisfies D4; sep DE/RE enables the one-at-a-time select |
| RS485↔MCU | **SC16IS752** (I²C dual-UART, +8 GPIO) | *Strongly consider* — gives both UARTs **and** soil-select/LED GPIO over I²C, sidestepping Heltec's tight free-pin count |
| Valve driver | **DRV8871** (H-bridge, 6.5–45V, 3.6A) | Handles 12V latching pulse + inrush; 2 control pins |
| RS485 TVS | **SM712** (RS485-specific bidir TVS) | On each A/B pair |
| Buck 5V | **MP1584** or **TPS563201** | From VBAT |
| Boost 18V | **MT3608**(bare) / **MP3423** | Low-current, water probe only |
| Rev-pol | P-FET ideal diode (e.g. **DMP3017SFG**) | On battery + solar inputs |
| Charge temp cutoff | **10k NTC** on cells → **CN3722 NTC pin** | The MPPT already has a temp-sense input (3S2P.md flagged it unpopulated) — populate it; no extra IC |
| LED/GPIO expander | **PCF8574** (I²C) *if not using SC16IS752 GPIO* | Offloads ~7 status LEDs + soil selects |
| Brown-out detect | voltage supervisor + reservoir/supercap | Fires H-bridge close as rail collapses |
| Connectors | GX16-4 (water), GX12-4 ×4 (soil), screw terminals (valve/solar) | Panel-mount, pigtail to board headers (F2) |

## 7. Remaining work (ordered) — updated 2026-07-19

**DONE this session (steps 1–5 of the original plan):**

1. ✅ **LoRa band confirmed: 915 MHz / AS923.** Order the 915 Heltec variant + 915 antenna;
   the BOM's 868 part is wrong. (Firmware/antenna choice, not board copper — doesn't gate `ato`.)
2. ✅ **KiCad installed** (10.0.3). Build works; the plugin-path warning is cosmetic (see §1).
3. ✅ **Project scaffolded** at `pcb/farm-node-pcb/` (`main.ato:App` is the build target).
4. ✅ **Interconnect spine DECIDED — I²C-expander spine, and it's mandatory, not optional.**
   The Heltec V3 breaks out almost no free GPIO (SX1262 SPI + OLED + USB eat nearly
   everything; effectively only ~GPIO47/48 free; OLED I²C is SDA=GPIO41/SCL=GPIO42). Native
   UARTs cannot fit 2 UARTs + 4 soil-selects + 2 valve + button + ~7 LEDs. So: **SC16IS752**
   (I²C dual-UART + 8 GPIO) carries both UARTs + soil-selects/valve control, and **PCF8574**
   (I²C 8-bit GPIO) drives the status LEDs + test button — both hang off the OLED's existing
   I²C bus. Net MCU-pin cost of all sensor/valve/UI I/O = the 2 I²C pins already in use.
   Captured in `mcu.ato`.
5. ✅ **Modules written and build-verified offline** — `power.ato`, `rs485.ato`, `valve.ato`,
   `mcu.ato`, `main.ato`. Each independently `ato build`-able; the top builds clean (stub
   warnings only). Every decision A1–F2 is traced in the module docstrings.

**NEXT — the gate is part resolution, which needs network (see §1 blocker):**

6. **Get to an environment where `api.atopile.io` resolves** (normal network / fix the
   IPv6-only-egress DNS for that host) **and a real terminal is available.** Then:
7. **Resolve real parts** with `ato create part -s <mpn>` (interactive) for each stub — start
   with the shortlist in §6 (THVD1450, SC16IS752, PCF8574, DRV8871, SM712, MP1584, MT3608,
   Heltec socket, GX12/GX16). Each creates a pinned component under `parts/`; swap it in for
   the matching stub module.
8. **Add valued passives** (pull-ups, series R for LEDs, reservoir/bypass caps, feedback
   dividers). Values must be **intervals** (`10kohm +/- 5%`), never exact — the picker rejects
   exact values.
9. **`ato build`** → first real netlist + BOM. Iterate on picker/DRC feedback.
10. **KiCad layout** (separate phase): place panel-mount connectors on one gland face, power
    creepage/thermal for the MPPT zone, route. This is the manual step `ato` won't do (A1).

**How the skeleton is structured** (so the swap-in is mechanical): each socketed/complex IC
is a `module` stub exposing typed interfaces (`ElectricPower`, `I2C`, `UART`, `ElectricLogic`)
with a `# TODO(part):` line naming the intended LCSC part. Replacing a stub = create the real
part, give it the same interface pins, drop it in. The nets in `main.ato` don't change.

## 8. Open items (from DESIGN-BRIEF §"Open items")

- ✅ LoRa **region/frequency** — RESOLVED: **915 MHz / AS923** (order the 915 Heltec + antenna).
- ✅ **Heltec V3 free-GPIO map** — RESOLVED enough to decide the spine: only ~GPIO47/48 free,
  OLED I²C = GPIO41/42 → I²C-expander spine is mandatory (see §7.4). Exact per-pin map still
  worth confirming against the real socket footprint when resolving the Heltec part.
- LoRa **mode** (raw P2P vs LoRaWAN) — affects the **gateway** spec (separate doc), not this board.
- **Cost target** per node — would refine regulator/part choices.
- **Latching valve part** — its pulse V/energy spec sizes the valve rail + reservoir (`ValvePulseRail`).
- **Enclosure** part number — fixes board outline for layout.

## 9. Gateway box (noted, not this board)

The other half of A2: a **second Heltec** as the LoRa gateway, forwarding to internet
directly *or* via an Android phone on 4G (farmer's choice). Spec it as its own small
doc/board later — it's out of scope for this field-node PCB but part of the system.
