/**
 * Single source of truth for the website.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS
 *
 * `docs/deployment-wiring.md` §9 records a real failure: the combined node's pin
 * assignment was changed at the soldering iron on 2026-07-19, the firmware was
 * updated to match, and FOUR prose files kept teaching the old order. Anyone
 * rebuilding from the docs wired it wrong and got two dead buses.
 *
 * The website would have been a fifth place for that to rot. So it isn't prose —
 * every pin table, every bus parameter and every BOM row on the site is rendered
 * from the structures below. Change a pin here and the module page, the wiring
 * cheatsheet and the SVG diagram all move together, because they are one input.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PROVENANCE — where each fact came from, so it can be re-checked
 *
 *   pins, buses       firmware/farm-node/farm-node.ino  (the flashed binary wins)
 *   power figures     hardware/3S2P.md
 *   endpoints         flows/both-sensors-flow.json, server/README.md
 *   parts + links     hardware/hardware.md, docs/01–04 frontmatter
 *   status            STATUS.md  ← keep these two in step
 */

export const SITE = {
  name: "Farmers IoT Toolkit",
  tagline: "Build your own farm sensors, from parts you can afford.",
  description:
    "An open-source toolkit that shows farmers how to build low-cost IoT sensors " +
    "on ESP8266 microcontrollers. Four modules, full parts lists, and honest " +
    "build guides that say what is proven and what is not.",
  funder: { name: "Float", url: "https://float.ag" },
  builder: { name: "Sunrise Labs", url: "https://sunriselabs.io", place: "Mauke, Cook Islands" },
  repo: "https://github.com/sunrise-labs/farmers-iot-toolkit",
  license: "Open source — use, share, and adapt freely.",
};

/**
 * The project video.
 *
 * Video *tutorials* were dropped from scope on 2026-07-10 (see STATUS.md) to
 * de-risk the deadline. A single overview video is a different, smaller thing.
 * Until one exists, set `id` to null and the page renders an honest placeholder
 * rather than a broken embed. Drop a YouTube ID in and the section becomes a
 * real, privacy-respecting facade player (no third-party request until clicked).
 */
export const VIDEO: {
  id: string | null;
  title: string;
  runtime: string;
  poster: string | null;
  chapters: { at: string; label: string }[];
} = {
  id: null,
  title: "The Farmers IoT Toolkit in six minutes",
  runtime: "~6 min",
  poster: null,
  chapters: [
    { at: "0:00", label: "The problem: knowing what your farm is doing" },
    { at: "0:50", label: "Module 1 — how deep is the tank?" },
    { at: "2:10", label: "Module 2 — soil moisture opens a valve" },
    { at: "3:30", label: "Module 3 — running it all on sunlight" },
    { at: "4:40", label: "Module 4 — an old phone as the brain" },
    { at: "5:30", label: "Putting the four together" },
  ],
};

/* ───────────────────────────── status vocabulary ─────────────────────────── */

export type StatusKey = "proven" | "partial" | "open" | "designed";

export const STATUS: Record<StatusKey, { label: string; note: string }> = {
  proven: { label: "Bench-proven", note: "Built and measured on our bench. Not the same as field-soaked." },
  partial: { label: "Half built", note: "One half works and is measured; the other half is design, not report." },
  open: { label: "Open question", note: "We do not know the answer yet. The guide says so where it matters." },
  designed: { label: "Designed, not built", note: "Worked out on paper and costed. No hardware has confirmed it." },
};

/* ─────────────────────────────── parts catalogue ─────────────────────────── */

export type Part = {
  id: string;
  name: string;
  role: string;
  usd: number | null; // null = we haven't paid a confirmed price yet
  qty?: number;
  url?: string;
  /** The thing that goes wrong if you buy the wrong variant. */
  caution?: string;
};

export const PARTS: Record<string, Part> = {
  esp8266: {
    id: "esp8266",
    name: "ESP8266 NodeMCU v3 (ESP-12E)",
    role: "The small computer that runs the node",
    usd: 3,
    url: "https://www.aliexpress.com/item/1005006889833004.html",
  },
  qdy30a: {
    id: "qdy30a",
    name: "QDY30A submersible pressure probe",
    role: "Sits on the tank floor and measures the depth of water above it",
    usd: null,
    url: "https://www.aliexpress.com/item/1005006415176688.html",
    caution:
      "Buy the RS485 variant. The same listing sells 4–20 mA, 0–5 V and 0–10 V outputs, " +
      "and only RS485 works with this guide. Check the options before you pay.",
  },
  thcs: {
    id: "thcs",
    name: "CWT THC-S soil probe",
    role: "Buried at root depth — moisture, temperature and EC",
    usd: null,
    url: "https://www.aliexpress.com/item/1005001524845572.html",
    caution:
      "Buy the RS485 variant. You do not need the pH/NPK versions — a cheap probe " +
      "claiming NPK is inferring it from EC anyway.",
  },
  hw0519: {
    id: "hw0519",
    name: "MAX485 / HW-0519 RS485 module",
    role: "Lets the ESP8266 speak RS485 to the probe",
    usd: 2,
    url: "https://www.aliexpress.com/item/1005003716689999.html",
    caution:
      "The listing ships two different boards. The HW-0519 is auto-direction and needs " +
      "no DE pin; the classic breakout has DE/RE and costs you a GPIO. Both work — but " +
      "only the HW-0519 lets both sensors share one ESP8266.",
  },
  mt3608: {
    id: "mt3608",
    name: "MT3608 boost converter",
    role: "Lifts the pack to the 18 V the water probe needs",
    usd: 2,
    url: "https://www.aliexpress.com/item/1005006361814667.html",
    caution: "Set it to 18 V with NOTHING on the output, before the probe is ever connected.",
  },
  relay: {
    id: "relay",
    name: "1-channel relay module",
    role: "Lets the 3.3 V ESP8266 switch the valve",
    usd: 2,
  },
  solenoid: {
    id: "solenoid",
    name: "12 V solenoid valve, normally closed",
    role: "Opens to let water into the drip line",
    usd: 8,
    url: "https://www.aliexpress.com/item/1005006146766362.html",
    caution:
      "Normally-closed is the safety property this module rests on: no power = shut. " +
      "Also check the minimum pressure differential — a pilot/servo valve needs ~0.2 bar " +
      "and will not open on a low gravity tank no matter how good your wiring is.",
  },
  diode: {
    id: "diode",
    name: "1N5819 flyback diode",
    role: "Absorbs the spike the valve coil throws when it shuts",
    usd: 1,
    url: "https://www.aliexpress.com/item/1005001552094086.html",
    caution: "Not optional. Without it the ESP8266 reboots — but only when the valve closes.",
  },
  cells: {
    id: "cells",
    name: "18650 lithium cells ×6",
    role: "Store the day's sunlight",
    usd: 15,
    qty: 6,
    caution:
      "Ours are Samsung INR18650-32E (3200 mAh). Use the real figure off the wrapper — " +
      "treat unbranded or salvaged cells as 60–70% of whatever they claim.",
  },
  panel: {
    id: "panel",
    name: "20 W solar panel, Vmp 18.6 V",
    role: "Charges the pack",
    usd: 20,
    url: "https://www.marine-deals.com.au/rv-solar-panels-chargers/voltify-mono-perc-solar-panel-20w-375x350x17mm/p/177917/c/1686",
    caution:
      "Vmp matters more than watts. Subtract ~11% for heat and the result must still sit " +
      "≳2 V above your pack's full-charge voltage, or the pack never finishes charging.",
  },
  mppt: {
    id: "mppt",
    name: "CN3722 MPPT solar charger",
    role: "Gets the most out of the panel and charges the pack safely",
    usd: 10,
    url: "https://www.aliexpress.com/item/1005009883114947.html",
  },
  bms: {
    id: "bms",
    name: "3S BMS protection board",
    role: "Guards against overcharge, over-discharge and short circuit",
    usd: 5,
    caution: "Every load taps pack+ / P−, never B−. Tapping B− silently bypasses the protection.",
  },
  buck: {
    id: "buck",
    name: "5 V / 3 A synchronous buck converter",
    role: "Steps the pack down to 5 V USB",
    usd: 3,
    caution:
      "For a phone, do not use a tiny Mini360 — it is rated 3 A and misbehaves above ~1.5 A " +
      "in a hot box. Set 5.15–5.2 V and short USB D+ to D−.",
  },
  holder: { id: "holder", name: "Battery holder or spot-welded pack", role: "Holds the six cells in 3S2P", usd: 5 },
  fuses: { id: "fuses", name: "Fuse holders + fuses", role: "Cuts power if a leg shorts", usd: 5 },
  enclosure: { id: "enclosure", name: "Weatherproof enclosure", role: "Keeps rain, dust and sun off", usd: 10 },
  phone: {
    id: "phone",
    name: "Android phone, v7 or newer",
    role: "Runs the WiFi hotspot and Node-RED — the brain",
    usd: 0,
    caution: "An old phone you already own is the intended answer. Ours is an OPPO A3 4G (CPH2669).",
  },
  sim: { id: "sim", name: "SIM with a data plan", role: "Backhaul to the internet", usd: 5 },
  jumpers: { id: "jumpers", name: "Jumper wires", role: "Connects everything", usd: 1 },
  breadboard: { id: "breadboard", name: "Breadboard", role: "Lets you build without soldering", usd: 3 },
  usbcable: { id: "usbcable", name: "USB cable", role: "Powers the ESP8266 and loads code onto it", usd: 2 },
  box: { id: "box", name: "Waterproof container", role: "Protects the electronics", usd: 5 },
  fittings: { id: "fittings", name: "Hose fittings for the valve", role: "Joins the valve into your drip line", usd: 5 },
  ft232: {
    id: "ft232",
    name: "FT232 USB-to-RS485 adapter",
    role: "Optional — proves a probe from a laptop before any ESP8266 exists",
    usd: 3,
    url: "https://www.aliexpress.com/item/1005006448907596.html",
    caution:
      "Do not use `mbpoll` with this adapter. It reports Invalid CRC on every frame while " +
      "the sensor is perfectly fine. Use the bundled bun pollers instead.",
  },
};

/* ─────────────────────────────── the RS485 buses ─────────────────────────── */

export type BusWire = { colour: string; hex: string; from: string; to: string; note?: string };

/**
 * A bus has MORE THAN ONE correct pin assignment, and conflating them is exactly
 * the failure this file exists to prevent.
 *
 * The standalone module build and Ian's deployed node do not use the same pins —
 * the deployed node's were changed at the soldering iron on 2026-07-19 and the
 * firmware was made to follow the iron. Both are correct for their own sketch.
 * Which one you want depends on which `.ino` you are about to flash, so every
 * pin set names its firmware file.
 */
export type PinSet = {
  label: string;
  /** The file this was read out of. The flashed binary wins over every doc. */
  firmware: string;
  /** True for the assignment a farmer following this module's guide should use. */
  teaching: boolean;
  note?: string;
  pins: { pad: string; esp: string; gpio: string; dir: string }[];
};

export type Bus = {
  id: string;
  label: string;
  baud: number;
  frame: string;
  slave: number;
  registers: { addr: string; means: string; scale: string; signed: boolean }[];
  /** Probe wire → where it lands. Colour codes differ per manufacturer; that is the trap. */
  wires: BusWire[];
  pinsets: PinSet[];
};

/** The pin set a farmer building this module on its own should wire to. */
export const teachingPins = (bus: Bus): PinSet => bus.pinsets.find((p) => p.teaching)!;

export const BUSES: Record<string, Bus> = {
  water: {
    id: "water",
    label: "Water bus — QDY30A",
    baud: 9600,
    frame: "8N1",
    slave: 1,
    registers: [{ addr: "0x0004", means: "Depth above the probe", scale: "1 count = 1 mm", signed: true }],
    wires: [
      { colour: "Red", hex: "#C0392B", from: "probe red", to: "MT3608 OUT+ (18 V)", note: "18 V — this wire and nothing else. 18 V into the MAX485 or the ESP destroys both." },
      { colour: "Green", hex: "#4A7A3B", from: "probe green", to: "MT3608 OUT− + common ground", note: "Prime suspect for the open intermittent. One ground, not two." },
      { colour: "Blue", hex: "#2B6E7A", from: "probe blue", to: "HW-0519 #1 A", note: "A+ — note this is the OPPOSITE colour convention to the soil probe." },
      { colour: "Yellow", hex: "#D8A521", from: "probe yellow", to: "HW-0519 #1 B", note: "B−" },
    ],
    pinsets: [
      {
        label: "Module 1 on its own",
        firmware: "firmware/water-level/water-level.ino",
        teaching: true,
        note:
          "This is what you want if you are building the tank sensor by itself. On a classic " +
          "DE/RE breakout, join DE and RE and drive them from D1; an auto-direction HW-0519 " +
          "needs no DE pin at all.",
        pins: [
          { pad: "RXD / RO", esp: "D5", gpio: "GPIO14", dir: "in — data toward the ESP" },
          { pad: "TXD / DI", esp: "D6", gpio: "GPIO12", dir: "out — data toward the probe" },
          { pad: "DE + RE", esp: "D1", gpio: "GPIO5", dir: "classic breakout only — omit on HW-0519" },
          { pad: "VCC", esp: "3V3", gpio: "—", dir: "power" },
          { pad: "GND", esp: "GND", gpio: "—", dir: "common ground star" },
        ],
      },
      {
        label: "Ian's deployed farm-node (water + valve)",
        firmware: "firmware/farm-node/farm-node.ino",
        teaching: false,
        note:
          "Swapped relative to the standalone build — the pins follow how the board was actually " +
          "soldered on 2026-07-19, and the firmware follows the iron. NEVER run water-level.ino " +
          "on this board: it drives D1 as DE, and D1 here is the water probe's TXD, so it would " +
          "clamp the driver onto the bus and the probe could never reply.",
        pins: [
          { pad: "RXD", esp: "D7", gpio: "GPIO13", dir: "in — data toward the ESP" },
          { pad: "TXD", esp: "D1", gpio: "GPIO5", dir: "out — data toward the probe" },
          { pad: "VCC", esp: "3V3", gpio: "—", dir: "power" },
          { pad: "GND", esp: "GND", gpio: "—", dir: "common ground star" },
        ],
      },
    ],
  },
  soil: {
    id: "soil",
    label: "Soil bus — THC-S",
    baud: 4800,
    frame: "8N1",
    slave: 1,
    registers: [
      { addr: "0x0000", means: "Moisture", scale: "÷10 → %", signed: false },
      { addr: "0x0001", means: "Temperature", scale: "÷10 → °C", signed: true },
      { addr: "0x0002", means: "EC", scale: "µS/cm as-is", signed: false },
    ],
    wires: [
      { colour: "Brown", hex: "#8B5A2B", from: "probe brown", to: "pack + (4.5–30 V)", note: "No converter needed — the pack feeds it directly at every state of charge." },
      { colour: "Black", hex: "#1A1815", from: "probe black", to: "pack − / common ground" },
      { colour: "Yellow", hex: "#D8A521", from: "probe yellow", to: "HW-0519 #2 A", note: "A+ — yellow is A here and B on the water probe. This is the single easiest wiring mistake in the build." },
      { colour: "Blue", hex: "#2B6E7A", from: "probe blue", to: "HW-0519 #2 B", note: "B−" },
    ],
    pinsets: [
      {
        label: "Module 2 on its own",
        firmware: "docs/02 — firmware/soil-moisture/ is not written yet",
        teaching: true,
        note:
          "D7/D1 deliberately, so that this module and Module 1 never collide. Wire it this way " +
          "whether or not you build the tank sensor — then if you later put both probes on one " +
          "ESP8266 they simply coexist, with no rewiring. On a classic DE/RE breakout, direction " +
          "takes D2, which pushes the valve relay to D5.",
        pins: [
          { pad: "RXD / RO", esp: "D7", gpio: "GPIO13", dir: "in — data toward the ESP" },
          { pad: "TXD / DI", esp: "D1", gpio: "GPIO5", dir: "out — data toward the probe" },
          { pad: "DE + RE", esp: "D2", gpio: "GPIO4", dir: "classic breakout only — then the relay moves to D5" },
          { pad: "VCC", esp: "3V3", gpio: "—", dir: "power" },
          { pad: "GND", esp: "GND", gpio: "—", dir: "common ground star" },
        ],
      },
      {
        label: "Deep-sleep soil node (battery-swap variant)",
        firmware: "firmware/soil-node-sleep/soil-node-sleep.ino",
        teaching: false,
        note:
          "The standalone node that replaced soil-on-the-combined-board. It also needs D0 wired " +
          "to RST as the deep-sleep wake wire — removable, because flashing needs it off.",
        pins: [
          { pad: "RXD", esp: "D6", gpio: "GPIO12", dir: "in — data toward the ESP" },
          { pad: "TXD", esp: "D5", gpio: "GPIO14", dir: "out — data toward the probe" },
          { pad: "VCC", esp: "3V3", gpio: "—", dir: "power" },
          { pad: "GND", esp: "GND", gpio: "—", dir: "common ground star" },
        ],
      },
    ],
  },
};

/**
 * The five GPIOs an ESP8266 NodeMCU actually gives you, and the four traps.
 * There is no sixth safe pin — that constraint is why per-row zone valves need
 * a separate controller.
 */
export const PIN_BUDGET: { esp: string; gpio: string; safe: boolean; use: string; why?: string }[] = [
  { esp: "D1", gpio: "GPIO5", safe: true, use: "Module 2 soil TX · farm-node water TX · water-level.ino DE" },
  { esp: "D2", gpio: "GPIO4", safe: true, use: "valve relay IN" },
  { esp: "D5", gpio: "GPIO14", safe: true, use: "Module 1 water RX · deep-sleep soil TX" },
  { esp: "D6", gpio: "GPIO12", safe: true, use: "Module 1 water TX · deep-sleep soil RX" },
  { esp: "D7", gpio: "GPIO13", safe: true, use: "Module 2 soil RX · farm-node water RX" },
  { esp: "D0", gpio: "GPIO16", safe: false, use: "deep-sleep wake only", why: "No interrupts at all — it physically cannot receive SoftwareSerial." },
  { esp: "D3", gpio: "GPIO0", safe: false, use: "leave alone", why: "Boot strap — must be HIGH at boot." },
  { esp: "D4", gpio: "GPIO2", safe: false, use: "leave alone", why: "Boot strap — must be HIGH at boot." },
  { esp: "D8", gpio: "GPIO15", safe: false, use: "leave alone", why: "Boot strap — must be LOW at boot." },
];

/* ─────────────────────────────── the data path ───────────────────────────── */

export const ENDPOINTS: { dir: "up" | "down" | "page"; method: string; path: string; payload: string }[] = [
  { dir: "up", method: "POST", path: "/water", payload: "{node, ok, raw, depth_mm, valve, rssi, uptime_s}" },
  { dir: "up", method: "POST", path: "/soil", payload: "{node, ok, moisture_pct, temp_c, ec, valve, rssi, uptime_s}" },
  { dir: "down", method: "GET (poll, 1 s)", path: "/valve", payload: '"1" / "0"' },
  { dir: "page", method: "GET", path: "/page", payload: "live readings, one card per node" },
  { dir: "page", method: "POST", path: "/valve/set", payload: "sets flow.valveCmd" },
];

export const POWER = {
  panel: { w: 20, vmp: "18.6 V @ 25 °C", hot: "≈16.5 V hot", harvestClear: "50–60 Wh/day", harvestCloud: "6–15 Wh/day" },
  pack: { cells: "6 × INR18650-32E", config: "3S2P", ah: "6.4 Ah", wh: "~70 Wh", usable: "~38 Wh everyday", full: "12.6 V", nom: "10.95 V", empty: "~9.0 V", esr: "53 mΩ" },
  chargeTemp: "0–45 °C only",
  dischargeTemp: "−20 to 60 °C",
  loads: [
    { what: "Sleeping sensor node", w: "0.6 W awake", duty: "~5%", whDay: "~1.5" },
    { what: "Water probe", w: "0.5 W", duty: "~5%", whDay: "~0.6" },
    { what: "Solenoid valve", w: "~7 W", duty: "20 min/day", whDay: "~2.5" },
    { what: "Field gear, total", w: "—", duty: "sleeping properly", whDay: "~5.5" },
    { what: "Android phone, plugged in", w: "0.7–2.0 W", duty: "100% — cannot Doze while charging", whDay: "20–57" },
  ],
};

/* ──────────────────────────────── the modules ────────────────────────────── */

export type Step = {
  title: string;
  body: string[];
  /** Things that will bite. Rendered as inline warnings inside the step. */
  gotchas?: { level: "warn" | "danger" | "note"; text: string }[];
  code?: { lang: string; text: string };
  /** false → this step is design, not a report. The page says so. */
  proven?: boolean;
};

export type Module = {
  n: string;
  slug: string;
  title: string;
  short: string;
  difficulty: "Beginner" | "Medium" | "Advanced";
  buildTime: string;
  status: StatusKey;
  statusLine: string;
  accent: string;
  accentDark: string;
  /** One sentence a farmer would say. */
  plain: string;
  why: string[];
  /** The design decision worth defending, and what it replaced. */
  choice?: { title: string; body: string; table?: { head: string[]; rows: string[][] } };
  parts: string[];
  extraParts?: Part[];
  steps: Step[];
  faults: { symptom: string; cause: string; fix: string }[];
  connects: { to: string; why: string }[];
  docPath: string;
  firmware?: string;
};

export const MODULES: Module[] = [
  {
    n: "1",
    slug: "water-tank-level-sensor",
    title: "Water Tank Level Sensor",
    short: "Water tank level",
    difficulty: "Beginner",
    buildTime: "1–2 hours",
    status: "proven",
    statusLine:
      "Comms, register map and ruler calibration all confirmed; runs end-to-end to Node-RED. " +
      "One open fault: the probe reads, then goes silent, then reads again on identical code — " +
      "a wire, prime suspect the green/ground. Find it before you solder anything into a box.",
    accent: "#2B6E7A",
    accentDark: "#5FB3C4",
    plain:
      "A sealed probe sits on the bottom of your tank and feels the weight of the water above it. " +
      "The deeper the water, the harder it presses.",
    why: [
      "Know the tank is getting low <em>before</em> you run out",
      "Keep a record of water use across days and weeks",
      "Check from the house instead of walking to the tank and climbing up",
      "Plan ahead for dry spells",
    ],
    choice: {
      title: "Why a pressure probe and not an ultrasonic one",
      body:
        "Nearly every beginner tutorial puts an ultrasonic sensor on the tank lid and bounces sound " +
        "off the water. It is cheaper, and for a real farm tank it is the wrong tool — this module " +
        "used to describe that design and we changed it deliberately. A tank is an enclosed cylinder " +
        "full of reflective surfaces with a moving surface on top: the worst possible case for an echo. " +
        "A pressure probe ignores every one of those problems because it does not look at the water. " +
        "It sits underneath it.",
      table: {
        head: ["", "Ultrasonic, from the top", "Pressure probe — this module"],
        rows: [
          ["How it measures", "Times a sound echo off the surface", "Feels the weight of water above it"],
          ["Tank walls", "Sound bounces off them — false readings", "Doesn't care"],
          ["Ripples, foam, debris", "Scatter the echo", "Doesn't care"],
          ["Condensation on the face", "Blinds it", "Lives underwater anyway"],
          ["Mounting", "Needs clear line of sight straight down", "Just drop it in"],
          ["Cost", "Cheaper", "More"],
          ["Power", "Runs off the board", "Needs 12–36 V — hence the boost converter"],
        ],
      },
    },
    parts: ["esp8266", "qdy30a", "hw0519", "mt3608", "jumpers", "breadboard", "usbcable", "box"],
    steps: [
      {
        title: "Set the boost converter to 18 V before the probe exists",
        proven: true,
        body: [
          "This is the one step where you can actually destroy something. The MT3608's trimmer ships at a random setting.",
          "Connect your battery to <b>IN+ / IN−</b> with nothing on the output. Put a multimeter across <b>OUT+ / OUT−</b>. Turn the screw until the meter reads a steady <b>18.0 V</b>, then power down. <i>Now</i> connect the probe.",
        ],
        gotchas: [
          {
            level: "warn",
            text:
              "The trimmer feels like it does nothing. It is a 25-turn part with no end stops, so it spins " +
              "freely while the wiper sits parked. Pick a direction and turn ~30 full turns slowly, watching " +
              "the meter, not the screw. It eventually climbs.",
          },
        ],
      },
      {
        title: "Wire it up",
        proven: true,
        body: [
          "Four wires out of the probe, four wires between the RS485 module and the ESP8266. The tables below are generated from the same pin data as the wiring cheatsheet, so they cannot drift apart.",
        ],
        gotchas: [
          { level: "danger", text: "The 18 V goes to the probe's red wire and <b>nowhere else</b>. The MAX485 and the ESP8266 are 3.3 V parts — 18 V destroys both. Trace the wire with your finger before switching on." },
          { level: "warn", text: "<b>One ground, not two.</b> The probe's green wire, the boost OUT−, the MAX485 GND and the ESP GND must all be one rail. The probe runs on 18 V and the ESP on 3.3 V — two supplies, one shared return. Miss this and you get failures that look exactly like a broken sensor." },
          { level: "note", text: "The TXD and RXD LEDs are a free logic analyser. TXD flashes when the ESP asks; RXD flashes when the probe answers. TXD only means the probe isn't replying — swap blue and yellow before suspecting anything else." },
        ],
      },
      {
        title: "Load the code",
        proven: true,
        body: [
          "The firmware is <code>firmware/water-level/</code>. Install the Arduino IDE, add <code>esp8266</code> in Boards Manager, and select <b>NodeMCU 1.0 (ESP-12E)</b>. There are no libraries to install.",
          "Copy <code>config.example.h</code> to <code>config.h</code> and edit that — never the sketch itself. Start with <code>BENCH_MODE 1</code> so it prints over serial and skips WiFi entirely: bring the sensor up before WiFi joins the list of things that can be broken.",
        ],
        code: {
          lang: "bash",
          text:
            "# always compile --upload. A bare `upload` flashes a stale .bin\n" +
            "arduino-cli compile --upload \\\n" +
            "  --fqbn esp8266:esp8266:nodemcuv2 -p /dev/ttyUSB0 firmware/water-level",
        },
        gotchas: [
          { level: "warn", text: "<b>Note the baud rate.</b> This probe is 9600. The soil probe in Module 2 is 4800. Same wiring, different speed — don't carry the number across." },
          { level: "note", text: "Reads are safe; blind writes are not. Reading a register cannot damage the probe. Writing one you haven't confirmed can land on its address or baud rate and cost you the ability to talk to it at all." },
        ],
      },
      {
        title: "Zero it",
        proven: true,
        body: [
          "Read the probe dry, sitting in air. It will not read zero — ours read about <b>26</b>, which is 26 mm of water that does not exist. That is normal and within spec.",
          "Write that number down. Your depth is <code>reading − dry_reading</code>. Do this once at install; if readings drift over months, do it again.",
        ],
      },
      {
        title: "Check it actually moves",
        proven: true,
        body: [
          "Lower the probe into a bucket. The number should climb clearly, hold steady when it stops moving, and fall back when you lift it out. If it does not respond to depth, stop — nothing after this will work.",
        ],
        gotchas: [
          { level: "note", text: "Don't try to calibrate better than ±25 mm. That is the manufacturer's spec (0.5% of 5 m) and it is far better than irrigation needs. We tried a bucket and a ruler and learned that a 90 mm bucket cannot measure an instrument whose own error bar is 25 mm." },
        ],
      },
      {
        title: "Install on your tank",
        proven: true,
        body: [
          "Lower the probe to the <b>bottom</b> and let it sit flat. Protect the ESP8266, MAX485 and boost converter inside the waterproof container. Measure your tank's water depth when full, once — that is what turns millimetres into “how full is my tank”.",
        ],
        gotchas: [
          { level: "warn", text: "Keep the loose end of the cable <b>dry and open to the air</b>. There is a tiny breather tube running through it, and the probe compares against outside air pressure through it. Seal it, kink it, or let it sit in water and your readings wander with the weather." },
        ],
      },
      {
        title: "Point it at the base station",
        proven: true,
        body: [
          "Set <code>BENCH_MODE 0</code>, put your hotspot's name and password in <code>config.h</code>, and leave <code>POST_HOST</code> <b>empty</b>. The phone running the hotspot is the node's gateway by definition, so the node works out the address itself.",
          "Test the endpoint before you ever blame the firmware:",
        ],
        code: {
          lang: "bash",
          text:
            "curl -X POST http://<phone-ip>:1880/water \\\n" +
            "  -H 'Content-Type: application/json' \\\n" +
            "  -d '{\"node\":\"test\",\"ok\":true,\"depth_mm\":500}'",
        },
        gotchas: [
          { level: "danger", text: "<b>Never hardcode the phone's IP.</b> Android randomises the hotspot subnet — ours came up on <code>10.215.63.55</code>, not the <code>192.168.43.1</code> every guide quotes — and it can reshuffle on any restart. A hardcoded IP goes stale <i>silently</i>: the node keeps reading perfectly and publishes into the void, and the only symptom is absence." },
        ],
      },
    ],
    faults: [
      { symptom: "No reading at all", cause: "A and B swapped", fix: "Swap the blue and yellow wires. This is common — try it before anything else." },
      { symptom: "No reading, probe cold", cause: "Not enough voltage", fix: "Meter red to green: it must read 18 V, not the raw battery." },
      { symptom: "Boost converter reads 0 V", cause: "Trimmer parked mid-range", fix: "It is 25-turn with no end stops. Keep turning, watch the meter." },
      { symptom: "Readings 10× off", cause: "Wrong scaling", fix: "1 count = 1 mm. Check you are not treating it as centimetres." },
      { symptom: "Reading is about 65000", cause: "Read as unsigned", fix: "It is signed int16. Readings slightly below zero are real and legitimate." },
      { symptom: "Reading never changes", cause: "Wrong register", fix: "It is 0x0004." },
      { symptom: "Readings fail randomly", cause: "No common ground", fix: "Probe green, boost OUT−, MAX485 GND and ESP GND must be one rail." },
      { symptom: "Drifts with the weather", cause: "Breather tube blocked or wet", fix: "Keep the loose cable end dry and open to air." },
      { symptom: "Reads, then silent, then reads", cause: "The open intermittent", fix: "A wire. Wiggle-test each one while the node polls, prime suspect green/ground. Do this before soldering." },
    ],
    connects: [
      { to: "iot-solar-powerbank", why: "Powers this node off-grid so the tank can be anywhere." },
      { to: "mobile-wifi-base-station", why: "Receives the depth readings and puts them on your phone." },
      { to: "soil-moisture-drip-irrigation", why: "The best cross-check in the toolkit — don't irrigate from an empty tank." },
    ],
    docPath: "docs/01-water-tank-level-sensor.md",
    firmware: "firmware/water-level/",
  },

  {
    n: "2",
    slug: "soil-moisture-drip-irrigation",
    title: "Soil Moisture → Drip Irrigation",
    short: "Soil + irrigation valve",
    difficulty: "Advanced",
    buildTime: "3–5 hours",
    status: "partial",
    statusLine:
      "The sensor half is bench-proven and POSTs to Node-RED. The valve half is not built, " +
      "and how to power a 12 V solenoid from a pack that sags to 9.0 V is an open question. " +
      "Bench this module on a mains 12 V adapter until that is settled.",
    accent: "#4A7A3B",
    accentDark: "#8FBF6F",
    plain:
      "A sealed probe buried at root depth measures how much water is actually in your soil. " +
      "When it dries past the level you set, the system opens a valve and waters your drip line.",
    why: [
      "Water only when the crop actually needs it — no guessing",
      "Save water by not over-irrigating",
      "Keep soil moisture consistent, which plants prefer to feast-and-famine",
      "Spot fertiliser and salt build-up before it hurts yield — that's the EC reading, free",
    ],
    choice: {
      title: "Why this probe and not the $3 capacitive one",
      body:
        "Nearly every beginner tutorial uses a capacitive v1.2 board on an analog pin. The deciding " +
        "argument is what you get back. A capacitive sensor hands you an arbitrary number with no " +
        "physical meaning, and the only way to give it meaning is to calibrate against your own soil — " +
        "then recalibrate when the exposed traces corrode, which they will, because you buried bare " +
        "copper in wet dirt. <b>The number degrades and nothing tells you.</b> For a toolkit meant to " +
        "be handed to someone else and left in a field, a sealed probe reporting real percent is worth " +
        "the money — and it means your threshold is a number a person can reason about.",
      table: {
        head: ["", "Capacitive v1.2", "THC-S over RS485 — this module"],
        rows: [
          ["What you get back", "An arbitrary number, say “512”", "Calibrated %RH, plus °C and EC"],
          ["Meaning", "None until you calibrate, per soil type", "Real units out of the box"],
          ["Buried for a season", "Exposed traces corrode; readings drift", "Sealed stainless probe, built for soil"],
          ["Cable run to the field", "Analog over long wire picks up noise", "RS485 is a differential pair, designed for it"],
          ["On an ESP8266", "One ADC pin, 0–1 V, needs a divider", "Two GPIO pins, no analog at all"],
          ["Cost", "Cheaper", "More"],
        ],
      },
    },
    parts: ["esp8266", "thcs", "hw0519", "solenoid", "relay", "diode", "jumpers", "breadboard", "usbcable", "fittings", "box"],
    steps: [
      {
        title: "Prove the sensor from a laptop first",
        proven: true,
        body: [
          "Before the ESP8266, the relay or the valve exist. One thing at a time is the whole trick to bringing hardware up — and this probe needs no converter, so it is the easiest thing in the toolkit to prove.",
          "Wire the probe straight to an FT232 USB-RS485 adapter and power it off your pack. In open air, moisture and EC read <b>0</b> and that is correct — air has no water in it. Squeeze the probe in a damp hand and moisture climbs within seconds.",
        ],
        code: { lang: "bash", text: "bun tools/poll-soil.ts        # live readings, every 1 s" },
        gotchas: [
          { level: "warn", text: "<b>Don't use <code>mbpoll</code> with the cheap FT232 adapter.</b> It reports <code>Invalid CRC</code> on every single frame while the sensor is perfectly fine — the adapter echoes your own transmitted bytes back and mbpoll reads and writes on one file descriptor, so it chokes on its own echo. This cost us an afternoon." },
          { level: "note", text: "The <i>type</i> of error tells you the baud rate. Wrong baud gives you <b>timeouts</b> — it didn't understand you, so it stayed quiet. Right baud gives you <b>CRC errors</b> — it answered and the bytes got mangled. So CRC errors mean you're on the right baud. Don't go hunting it." },
        ],
      },
      {
        title: "Wire the ESP8266",
        proven: true,
        body: ["Four wires out of the probe, four between the RS485 module and the ESP8266."],
        gotchas: [
          { level: "danger", text: "<b>The A/B colours are the opposite of Module 1.</b> On the water probe blue is A and yellow is B. On this one <b>yellow is A and blue is B</b>. If you build this straight after the tank sensor you will get it wrong from muscle memory. Swapping them is harmless — if you get nothing back, swap and retry before suspecting anything else." },
          { level: "note", text: "Why D7/D1 when Module 1 uses D5/D6? So the two never collide. Wire it this way whether or not you build Module 1 — then if you later put both sensors on one ESP8266 they simply coexist. It costs nothing to do it this way from the start." },
        ],
      },
      {
        title: "Load the code",
        proven: false,
        body: [
          "<code>firmware/soil-moisture/</code> is not written yet. Until it is, the bench sketch in <code>docs/bench/01-bench-soil-sensor-rs485.md</code> reads the probe on the ESP8266 and prints to serial — that is the sensor half working.",
          "It will follow the same shape as the water node: copy <code>config.example.h</code> to <code>config.h</code>, edit that, never touch the sketch.",
        ],
        gotchas: [
          { level: "warn", text: "<b>Temperature is signed.</b> <code>0xFF9B</code> is −10.1 °C, not 65435. Parse it into an <code>int16_t</code> or your first frosty morning produces nonsense." },
          { level: "warn", text: "<b>The manual has a typo.</b> Its register table says function code <code>0x30</code>. There is no such function code — it's <code>0x03</code>. If you get <code>modbus exception 0x01</code> (illegal function), that is what happened." },
        ],
      },
      {
        title: "Choose your two thresholds",
        proven: true,
        body: [
          "You need <b>two</b> numbers, not one: open below <code>DRY_THRESHOLD</code> (say 30%), close above <code>WET_THRESHOLD</code> (say 45%).",
          "To pick them, water your bed the way you normally would and watch what the probe reads when the soil is how you like it — that is roughly your wet threshold. Then watch over the following days and note where the plants start to look thirsty. That is roughly your dry one.",
        ],
        gotchas: [
          { level: "warn", text: "<b>Leave at least 10 percentage points between them.</b> With a single threshold the valve opens, the soil creeps past it, the valve shuts, the soil dips, the valve opens — on and off every few seconds all day. That chatter wears out a mechanical valve and empties your tank in dribs." },
          { level: "note", text: "Sandy soil and clay hold water completely differently, and so do different crops. Use the probe in the actual bed you'll irrigate, not a test pot." },
        ],
      },
      {
        title: "Wire the relay and valve",
        proven: false,
        body: [
          "The valve goes on the relay's <b>switched</b> side, never the logic side. Use the <b>NO</b> (normally open) contact so that relay unpowered = valve unpowered = valve shut.",
        ],
        code: {
          lang: "text",
          text:
            "  12V +  ────────────────► valve terminal 1\n" +
            "  valve terminal 2 ──────► relay COM\n" +
            "  relay NO ──────────────► 12V −\n" +
            "\n" +
            "  1N5819 across the valve's two terminals, stripe (cathode) to the + side",
        },
        gotchas: [
          { level: "danger", text: "<b>VBUS, not VIN.</b> On the NodeMCU v3, <code>VIN</code> is the regulator's <i>input</i> and floats when the board is powered over USB — it reads a plausible ~3.1 V open-circuit and collapses the moment anything draws from it. <code>VBUS</code> is the pin that actually carries USB 5 V. We lost an hour to this." },
          { level: "danger", text: "<b>The diode is not optional.</b> A solenoid is a coil of wire; cutting its power throws a large reverse spike back down the wires — enough to weld relay contacts over time and enough to reset the ESP8266 next to it. The symptom of leaving it out is maddening: the ESP randomly reboots, but only when the valve closes." },
          { level: "note", text: "The coil is non-polar; the diode and the supply are not. Pick either coil lead as “+”, run pack+ to it, and put the diode band on that same leg. Reversed, the diode forward-biases the instant the valve powers and shorts the pack." },
        ],
      },
      {
        title: "Build the safety cutoff before you leave it alone",
        proven: false,
        body: [
          "This is the step people skip and then regret. If the probe fails, or gets pulled out of the ground, or the water never reaches it (blocked dripper, empty tank, kinked line), then moisture never rises, the threshold never trips, <b>and the valve stays open forever</b>. Nothing in the logic above stops it.",
          "So the firmware must enforce, independent of any reading: a <b>maximum run time</b> (a little more than one honest watering); a <b>cooldown</b> after a cutoff, reported loudly, because something is wrong and a human needs to look; and <b>fail closed on a bad read</b> — an unknown moisture is a reason to stop watering, not to keep going.",
        ],
        gotchas: [
          { level: "danger", text: "This is the only module in the toolkit that <b>acts</b> rather than just reads. Everything else fails by telling you nothing. This one fails by flooding a field." },
          { level: "note", text: "If you've built Module 1, the base station already knows your water level. Don't irrigate from an empty tank — running a pump dry can destroy it. That cross-check is the best argument for building both." },
        ],
      },
      {
        title: "Test with water, on the bench, before it touches a field",
        proven: false,
        body: [
          "Put the probe in dry soil and confirm the valve <b>opens</b>. Pour water in and confirm it <b>closes</b> past the wet threshold. <b>Pull the sensor wire out mid-cycle</b> and confirm the valve closes rather than sticking open — if it doesn't, the safety cutoff isn't done. Then let it hit the max run time with the probe in air and confirm it cuts out and complains. Yes, that means standing there for the full timeout. Do it once.",
        ],
      },
      {
        title: "Install in the field",
        proven: false,
        body: [
          "Bury the probe at <b>root depth</b> — the depth the roots actually drink from, not just under the surface. Too shallow and you water on the strength of a dry crust while the roots sit soaked. Pack soil firmly around it: an air gap around the tines reads dry forever, and dry forever means the valve never closes.",
          "<b>Don't put the probe next to a dripper.</b> You'll measure the dripper, not the bed, and it'll shut off long before the rest of the row has had a drink. Put it between emitters, where an average plant lives.",
        ],
      },
    ],
    faults: [
      { symptom: "No reading at all", cause: "A and B swapped", fix: "Swap the yellow and blue wires — note these are opposite to Module 1." },
      { symptom: "No reading at all", cause: "Wrong baud", fix: "This probe is 4800. Module 1's is 9600. Don't copy the number across." },
      { symptom: "Invalid CRC on every frame with mbpoll", cause: "Adapter echo, not a fault", fix: "Use bun tools/poll-soil.ts. The sensor is fine." },
      { symptom: "modbus exception 0x01", cause: "Used 0x30 from the manual", fix: "The manual has a typo. The function code is 0x03." },
      { symptom: "Temperature reads ~65000", cause: "Parsed as unsigned", fix: "Cast to int16_t. 0xFF9B = −10.1 °C." },
      { symptom: "Moisture always 0 and the probe IS buried", cause: "Air gap around the tines", fix: "Pack the soil firmly against the probe." },
      { symptom: "Relay clicks but the valve doesn't move", cause: "Not enough volts at the coil under load", fix: "Meter across the valve while the relay is on. A sagging pack meters fine at rest." },
      { symptom: "Relay doesn't click at all", cause: "Powered from VIN", fix: "Use VBUS. VIN floats when the board is on USB." },
      { symptom: "ESP reboots when the valve closes", cause: "Missing flyback diode", fix: "Fit the 1N5819 across the valve terminals, stripe to +." },
      { symptom: "Valve chatters on and off", cause: "Thresholds too close", fix: "Leave ≥10 points between dry and wet." },
      { symptom: "Valve never closes", cause: "Water isn't reaching the probe", fix: "Blocked dripper, empty tank, kinked line. Your max run time should have caught this — if it didn't, fix that first." },
      { symptom: "Valve opens on a full battery, not a flat one", cause: "Solenoid under-volted", fix: "See the open question on valve power." },
      { symptom: "Valve energised, nothing flows", cause: "Below the valve's minimum pressure differential", fix: "A pilot valve needs ~0.2 bar. Check the head above it; if marginal, spec a direct-acting “0 bar” valve." },
    ],
    connects: [
      { to: "water-tank-level-sensor", why: "Know how much water you have before this module spends it." },
      { to: "iot-solar-powerbank", why: "Powers the sensor half directly — the valve is a separate, open question." },
      { to: "mobile-wifi-base-station", why: "Receives soil readings and valve activity, and can command the valve." },
    ],
    docPath: "docs/02-soil-moisture-drip-irrigation.md",
    firmware: "firmware/farm-node/",
  },

  {
    n: "3",
    slug: "iot-solar-powerbank",
    title: "IoT Solar Powerbank",
    short: "Solar power",
    difficulty: "Medium",
    buildTime: "3–4 hours",
    status: "partial",
    statusLine:
      "The 3S2P pack build is in progress; the electrical design and energy budget are settled and " +
      "documented. It powers everything else, so nothing gets power-tested until it's finished.",
    accent: "#C77C1E",
    accentDark: "#E8A94A",
    plain:
      "A 20 W solar panel charging six 18650 cells, keeping your sensors running day and night " +
      "where there is no mains power.",
    why: [
      "Run sensors anywhere on the farm — no power outlet needed",
      "Free to run once it is built",
      "One powerbank can carry several sleeping nodes at once",
      "Sensors that sleep are almost free: ~5.5 Wh/day against a 50–60 Wh/day panel",
    ],
    choice: {
      title: "Why 3 cells in series and not 4",
      body:
        "An earlier version of this guide said 4S2P. That was wrong, and it is worth explaining why, " +
        "because the mistake is easy to repeat and it fails in a way that is hard to diagnose. A charge " +
        "controller cannot push energy uphill — it needs the panel about 2 V above the pack's full-charge " +
        "voltage. And a panel's Vmp <i>drops as it gets hot</i>: the 18.6 V on the label is measured at " +
        "25 °C, and a panel in tropical sun runs at 55–60 °C and loses ~11%. " +
        "<b>Here is the nasty part.</b> A 4S pack on this panel does not look broken. It charges on a cool " +
        "morning, settles around 15 V, and reads like a working battery. What it never does is <i>finish</i> — " +
        "and a BMS only balances cells at the top of a full charge. So the cells drift apart over months, the " +
        "weakest starts hitting cutoff early, and the pack's usable capacity quietly collapses long after you " +
        "stopped suspecting the panel. The 4S failure isn't “it won't charge”. It's “it charges just enough " +
        "to look fine, and destroys itself over a year.”",
      table: {
        head: ["Arrangement", "Full charge", "Panel voltage needed", "A hot panel gives 16.5 V"],
        rows: [
          ["3S — this guide", "12.6 V", "~14.6 V", "✅ works, ~1.9 V to spare"],
          ["4S — the old, wrong version", "16.8 V", "~18.8 V", "❌ short by 2.3 V"],
        ],
      },
    },
    parts: ["cells", "panel", "mppt", "bms", "buck", "holder", "fuses", "enclosure"],
    steps: [
      {
        title: "Test every cell before it goes in",
        proven: true,
        body: [
          "Multimeter each cell: it should read between 3.0 V and 4.2 V. Discard anything below 2.5 V or that looks damaged, swollen or smells wrong.",
        ],
        gotchas: [
          { level: "warn", text: "Check the number on the wrapper before you trust it. Cheap and salvaged 18650s are routinely relabelled — if yours are unbranded, or claim something like “5000 mAh” (no such 18650 exists), assume 60–70% of the printed figure. A pack built on a fictional capacity will surprise you on the first cloudy week." },
        ],
      },
      {
        title: "Arrange the cells 3S2P and fit the BMS",
        proven: true,
        body: [
          "Three cells in series makes ~11 V nominal (12.6 V full); two of those chains in parallel doubles the capacity. Follow the BMS markings for B+, B− and the balance taps — the taps read ascending: 0 → 4.2 → 8.4 → 12.6 V.",
        ],
        gotchas: [
          { level: "danger", text: "<b>Every load taps pack+ / P−, never B−.</b> Tapping B− routes discharge around the BMS protection FETs and you lose over-discharge and short-circuit protection <i>silently</i>." },
          { level: "danger", text: "Never short the cells, never puncture or crush one, always fit the BMS, always fit a fuse, and keep the pack dry. If a cell looks swollen or gets very hot, stop and dispose of it safely." },
        ],
      },
      {
        title: "Connect the MPPT charger and panel",
        proven: false,
        body: [
          "Panel to the controller's PV input, pack to its battery terminals. Set the CV pot to <b>12.6 V</b> and the MPPT pot to the panel's <i>hot</i> Vmp (~16.5 V), not the 18.6 V on the label.",
        ],
        gotchas: [
          { level: "warn", text: "<b>Power-on order is not arbitrary — a panel has no off switch.</b> Cover the panel, connect the battery through the BMS to the charger output, <i>then</i> uncover. Teardown is the reverse: cover and disconnect PV first, then the battery." },
          { level: "danger", text: "<b>Charging is rated 0–45 °C; discharging is −20 to 60 °C.</b> That gap is the important part. A sealed box in tropical sun runs 20–30 °C above ambient, so at midday it is easily above 45 °C inside — exactly when the panel is trying hardest to charge. Powering your sensors in that heat is fine. Charging in it damages the cells and is how a pack starts to swell. Shade and vent the enclosure." },
        ],
      },
      {
        title: "Set the buck converter and fuse each leg",
        proven: false,
        body: [
          "Feed the buck from the protected side of the BMS and adjust its output to exactly 5 V with a meter on it. Put a fuse between the pack and each load — 3 A is a sensible start for the sensor side, and the phone gets its own 2 A fuse so a chafed charging cable can't take your sensors down with it.",
        ],
        gotchas: [
          { level: "warn", text: "If this converter will charge a phone: set <b>5.15–5.2 V</b> (never above 5.25 V) to cover cable losses at 2 A, use a proper 5 V/3 A synchronous module rather than a tiny Mini360, and <b>short USB D+ to D−</b> — otherwise the phone thinks it is plugged into a computer, limits itself to 500 mA, and the failure looks exactly like a solar problem." },
        ],
      },
      {
        title: "Do the energy budget before you close the box",
        proven: true,
        body: [
          "This is the most important step in this module, and the one people skip. <b>Batteries are a bucket, not a tap.</b> The panel fills the bucket; your devices empty it. Adding more batteries makes the bucket bigger — it does not make the tap run faster. If your devices use more each day than the panel collects, more batteries will not save you; you will just take longer to run flat.",
          "A sunny-day surplus tells you almost nothing. Any solar system looks fine in the sun. What kills them is a run of overcast days, and in the tropics that means the wet season — not the dry months when you probably built it.",
        ],
        gotchas: [
          { level: "note", text: "Ranked by value for money when the budget doesn't close: (1) fix the panel you have — point it <b>north</b> in the southern hemisphere, tilt it, clean it, un-shade it, often worth 2× for free; (2) add a second 20 W panel, the only fix that addresses a cloudy run; (3) duty-cycle harder; (4) more batteries, last and only for riding out cloud." },
        ],
      },
      {
        title: "Charge the phone in bursts, not continuously",
        proven: false,
        body: [
          "If you're running Module 4 off this pack, do not leave the phone plugged in. A plugged-in phone can never enter Android's Doze (it only engages when <i>unplugged</i>), so it runs at its awake floor forever — 20–57 Wh/day out of a panel that collects 50–60 Wh on a <i>good</i> day.",
          "The trick: <b>the phone's own battery is a second battery pack.</b> A 5100 mAh handset holds ~19.4 Wh against the pack's ~38 Wh everyday-usable. Charge it from daytime surplus and let it coast overnight, exactly as it would in your pocket. A $3 pack-voltage relay does the whole job with no code: ON at ~12.3 V, OFF at ~11.6 V.",
        ],
        gotchas: [
          { level: "danger", text: "<b>Charging must be the DEFAULT state.</b> If the phone is the thing that decides when to charge and the phone goes flat, nothing is left to turn the charger back on — your base station is dead until someone walks out to it with a power bank. “Stop charging” must be a command the phone actively sends, and it must expire." },
          { level: "danger", text: "A lithium cell held at 100% and high temperature degrades fast, and swollen phone batteries catch fire. A phone sealed in a box in tropical sun, plugged in permanently, sits at both extremes at once. Shade and ventilate, don't hold it at 100%, inspect every few months, and never mount it against anything flammable." },
          { level: "note", text: "Three wins from duty-cycling the charger: no round-trip loss through the 18650s; the fire risk goes away; and when a cloudy run empties the pack the phone stops charging while the <i>sensors keep logging</i>. You lose your view of the farm before you lose the data. That is the correct order." },
        ],
      },
    ],
    faults: [
      { symptom: "No output voltage", cause: "Fuse has blown", fix: "Check and replace it — then find out why." },
      { symptom: "Pack charges partway then stops, never reaches full", cause: "Panel Vmp too low once hot", fix: "Subtract ~11% from the label Vmp and check it is ≳2 V above the pack's full-charge voltage." },
      { symptom: "Charges fine in the morning, stops by midday", cause: "Same cause — the panel heated up and Vmp fell", fix: "Higher-Vmp panel, or fewer cells in series." },
      { symptom: "Panel gives far less current than its rating", cause: "Facing the wrong way", fix: "In the southern hemisphere the midday sun is in the NORTH. Check Voc and Isc disconnected to confirm the panel itself is healthy." },
      { symptom: "BMS cuts power suddenly", cause: "A cell is faulty or badly connected", fix: "Check every connection, test each cell individually." },
      { symptom: "Phone charges very slowly — looks like the panel is too small", cause: "USB data pins not shorted", fix: "Short D+ to D− at the socket. Confirm with a USB power meter that it now draws >0.5 A. This failure impersonates a solar problem." },
      { symptom: "Phone charges but never reaches full on a sunny day", cause: "Voltage drop in a long thin USB cable at 2 A", fix: "Shorter, thicker cable; set the buck to 5.15–5.2 V." },
      { symptom: "Enclosure gets very hot inside", cause: "No ventilation", fix: "Vent holes on the shaded side, meshed to keep bugs out." },
    ],
    connects: [
      { to: "water-tank-level-sensor", why: "Powers the tank node so the tank can be anywhere." },
      { to: "soil-moisture-drip-irrigation", why: "Powers the probe directly — the pack's 9.0–12.6 V sits inside its 4.5–30 V input." },
      { to: "mobile-wifi-base-station", why: "Can charge the phone — in bursts, never continuously. Check the energy budget first." },
    ],
    docPath: "docs/03-iot-solar-powerbank.md",
  },

  {
    n: "4",
    slug: "mobile-wifi-base-station",
    title: "Mobile WiFi Base Station",
    short: "Base station",
    difficulty: "Beginner",
    buildTime: "1–2 hours",
    status: "proven",
    statusLine:
      "Done and documented, receiving live readings from Module 1 and pushing them out to a small " +
      "cloud service. How to power the phone in the field is designed but not yet measured.",
    accent: "#43587A",
    accentDark: "#8AA0C8",
    plain:
      "An old Android phone becomes the brain: it makes the WiFi network your sensors join, runs " +
      "Node-RED to collect the readings, and uses its own 4G to get them to you anywhere.",
    why: [
      "Gives every sensor a network to talk to, even with no router for miles",
      "All your readings in one place, on a dashboard",
      "Uses a phone you probably already own — close to free",
      "No computer needed to see your data",
    ],
    parts: ["phone", "sim", "usbcable"],
    steps: [
      {
        title: "Turn on the WiFi hotspot",
        proven: true,
        body: [
          "Settings → Network → Hotspot. Give it a name (ours is <code>FarmIoT</code>) and a password, and write the password down — your sensor nodes need it.",
        ],
        gotchas: [
          { level: "note", text: "Some phones switch the hotspot off automatically when nothing is connected. Look for a “keep hotspot on” setting." },
        ],
      },
      {
        title: "Install Termux — from F-Droid, not the Play Store",
        proven: true,
        body: [
          "Termux is a Linux terminal that runs on Android, and it is how Node-RED runs on a phone. Install F-Droid, then search it for Termux.",
        ],
        gotchas: [
          { level: "danger", text: "<b>The Play Store version was abandoned years ago and is frozen at an old release.</b> Package installs fail on it in ways that look like network or server errors, and you will waste an afternoon before suspecting the app itself. This is the single most common way this build goes wrong." },
          { level: "note", text: "Typing on a phone keyboard is miserable. <code>pkg install openssh</code>, run <code>sshd</code>, and type from a laptop on the same hotspot. Worth it if you have one." },
        ],
      },
      {
        title: "Install Node-RED inside Termux",
        proven: true,
        body: ["Type these one at a time. The first two take a few minutes each."],
        code: {
          lang: "bash",
          text:
            "pkg update && pkg upgrade -y\n" +
            "pkg install -y nodejs\n" +
            "npm install -g --unsafe-perm node-red\n" +
            "node-red",
        },
        gotchas: [
          { level: "warn", text: "<code>--unsafe-perm</code> is not optional. Without it the install dies partway through building native modules. It sounds alarming; it isn't — it just lets npm's build scripts run as the current user, which on Termux is the only user there is." },
          { level: "danger", text: "<b>Android will kill Node-RED unless you stop it.</b> Battery saver suspends Termux when the screen sleeps, Node-RED stops, your data vanishes, and <i>nothing reports an error</i>. Two things, both needed: run <code>termux-wake-lock</code>, and set Settings → Apps → Termux → Battery → <b>Unrestricted</b>." },
        ],
      },
      {
        title: "Import the ready-made flow and test it with curl",
        proven: true,
        body: [
          "In the Node-RED editor: ☰ → Import, paste <code>flows/water-level-flow.json</code>, Import, Deploy. You now have an endpoint at <code>/water</code>. Test it before any hardware is involved — open the debug sidebar and watch the message arrive.",
        ],
        code: {
          lang: "bash",
          text:
            "curl -X POST http://<phone-ip>:1880/water \\\n" +
            "  -H 'Content-Type: application/json' \\\n" +
            "  -d '{\"node\":\"test\",\"ok\":true,\"depth_mm\":500}'",
        },
        gotchas: [
          { level: "danger", text: "<b>Every <code>http in</code> needs a paired <code>http response</code>.</b> Without one the request hangs open — the sensor waits, times out, and reports a network failure, while Node-RED shows the message arriving perfectly fine. It looks like a network fault and is not. The bundled flow wires this correctly." },
          { level: "warn", text: "<b>The hotspot IP is not always 192.168.43.1.</b> Every guide on the internet says it is; ours came up on <code>10.215.63.55</code>. Modern Android randomises the subnet and it can change after a restart. Ask a sensor instead — the firmware prints <code>gateway :</code> on serial, and the gateway <i>is</i> the phone." },
        ],
      },
      {
        title: "Point a sensor at it",
        proven: true,
        body: [
          "In the node's <code>config.h</code> you only need three things — and an IP address is not one of them.",
        ],
        code: {
          lang: "c",
          text:
            "#define BENCH_MODE 0                    // was 1 for bring-up\n" +
            "#define WIFI_SSID  \"FarmIoT\"\n" +
            "#define WIFI_PASSWORD \"your-hotspot-password\"",
        },
        gotchas: [
          { level: "note", text: "Reading the serial output: <code>POST: failed (-1)</code> means the node couldn't open a socket at all — usually the address isn't on this network. A <i>positive</i> code like 404 means the server answered and didn't like the request, which is a flow problem, not a network one." },
        ],
      },
      {
        title: "See your farm from anywhere — push out, don't expose in",
        proven: true,
        body: [
          "The phone has 4G, so it can reach the internet — but the internet cannot reach it. Carriers put phones behind <b>CGNAT</b>: your phone shares one public address with thousands of others, so there is no port to forward and no address to type. Everything you read about port-forwarding assumes a home broadband line and does not apply here.",
          "So the phone dials out. Node-RED buffers every reading and POSTs it in batches to a small service you control (<code>server/</code>, ours runs at <code>farm.sunriselabs.io</code>). Nothing on the farm is ever exposed, it works on any carrier with zero configuration, and it survives dropouts because the phone keeps a backlog and re-sends. On a metered SIM it costs about 60 requests a day.",
          "The same channel carries commands back: because the phone is already POSTing, the server answers each batch with the desired valve state — so you can open and shut the irrigation valve from a dashboard without anything on your farm being reachable from the internet.",
        ],
        gotchas: [
          { level: "danger", text: "<b>Do not put the Node-RED editor on the public internet.</b> A tunnel like ngrok gives you a public URL in one command and it is very tempting — but the editor runs arbitrary code and, in this build, opens your irrigation valve. If you expose it, set <code>adminAuth</code> first. A private tunnel like Tailscale avoids the question entirely." },
          { level: "warn", text: "<b>Android freezes timers when the phone dozes.</b> A repeating <code>inject</code> node simply stops firing — no error, no warning, and the flow still looks healthy in the editor. Make work <b>event-driven</b> instead: our push flow sends on each arriving reading, because the incoming request has already woken the phone. The repeating inject survives only as a backstop." },
        ],
      },
    ],
    faults: [
      { symptom: "Node can't find the WiFi network", cause: "Hotspot off, or name mismatch", fix: "Check the hotspot is on and the SSID matches config.h exactly." },
      { symptom: "Can't open Node-RED in the browser", cause: "Node-RED isn't running", fix: "Open Termux and start it again — and check the wake-lock." },
      { symptom: "Dashboard shows no data", cause: "Node posting to the wrong address", fix: "Leave POST_HOST empty and let the node derive it from the gateway." },
      { symptom: "Flow looks healthy but nothing is scheduled", cause: "Android froze the timer", fix: "Make it event-driven; hold a wake-lock; set Termux to Unrestricted." },
      { symptom: "Phone battery drains fast", cause: "Hotspot + Node-RED never sleep", fix: "Keep it charged — and on solar, duty-cycle the charger, not the phone." },
      { symptom: "Mobile data disappearing quickly", cause: "Sending too often", fix: "Batch readings, or send summaries rather than every sample." },
    ],
    connects: [
      { to: "water-tank-level-sensor", why: "Receives depth readings over WiFi." },
      { to: "soil-moisture-drip-irrigation", why: "Receives soil readings and can command the valve on the reply to a batch." },
      { to: "iot-solar-powerbank", why: "Can power the phone — check the energy budget first." },
    ],
    docPath: "docs/04-mobile-wifi-base-station.md",
  },
];

export const moduleBySlug = (slug: string) => MODULES.find((m) => m.slug === slug)!;

/** Bill of materials for one module, resolved from the catalogue. */
export function bom(m: Module): Part[] {
  return [...m.parts.map((id) => PARTS[id]), ...(m.extraParts ?? [])];
}

/** Cost range for a module. `null`-priced parts are unknown, so we say so. */
export function cost(m: Module): { total: number; unknown: number } {
  const items = bom(m);
  return {
    total: items.reduce((sum, p) => sum + (p.usd ?? 0), 0),
    unknown: items.filter((p) => p.usd === null).length,
  };
}
