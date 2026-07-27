// config.example.h — copy to config.h and edit. config.h is gitignored.
//
//   cp config.example.h config.h
//
// Every value you need to change lives here. You should not have to edit the
// .ino to get a working node.
#pragma once

// ─── Bench mode ─────────────────────────────────────────────────────────────
// 1 = skip WiFi AND deep sleep: just print readings to the Serial Monitor
//     every 2s. No D0->RST jumper needed, reflash freely.
// 0 = normal operation: wake, read, POST, deep sleep. NEEDS the D0->RST jumper
//     fitted or the node sleeps once and never wakes.
//
// START AT 1. Prove the probe reads through the ESP8266 before you add WiFi
// and sleep to the list of things that could be broken.
#define BENCH_MODE     1

// ─── WiFi ───────────────────────────────────────────────────────────────────
// The hotspot from Module 4 (the Android base station). Ignored in bench mode.
#define WIFI_SSID      "FarmIoT"
#define WIFI_PASSWORD  "change-me"

// How long to wait for WiFi each wake before giving up and sleeping anyway.
// The give-up matters: if the hotspot is off, a node that waits forever
// flattens its cells against a phone that isn't listening.
#define WIFI_TIMEOUT_S  15

// ─── Where to send readings ─────────────────────────────────────────────────
// LEAVE POST_HOST EMPTY and the node finds the base station by itself — the
// phone running the hotspot IS this node's gateway. Android RANDOMISES the
// hotspot subnet, so a hardcoded IP goes stale SILENTLY. Same rule as farm-node.
#define POST_HOST        ""
#define POST_PORT        1880
#define POST_PATH_SOIL   "/soil"

// Name for this node's readings. Unique per node if you run several.
#define NODE_ID_SOIL   "soil-bed-1"

// ─── Sleep cadence ──────────────────────────────────────────────────────────
// Minutes of deep sleep between readings. Longer = more weeks per battery swap;
// soil moisture moves slowly, so 10–30 min loses nothing agronomically.
// Hard ceiling 60 (the ESP8266's sleep timer maxes out around 71 min — the
// firmware clamps anything larger).
#define SLEEP_MINUTES  10

// ─── Sensor power gating (optional upgrade — OFF by default) ────────────────
// -1 = sensor permanently powered (simplest wiring; the probe's ~10-15 mA idle
//      draw runs 24/7 and dominates the battery budget).
// D2 = a low-side N-MOSFET (AO3400/2N7000) on the THC-S BLACK wire, gate on D2:
//      sensor only draws power while the node is awake. Roughly triples life.
//      See "The FET upgrade" in docs/deep-sleep-soil-node.md.
#define SENSOR_PWR_PIN    -1

// How long to wait after switching sensor power on before the first Modbus
// poll. Only used when SENSOR_PWR_PIN is set.
#define SENSOR_WARMUP_MS  500

// ─── Battery gauge (optional — strongly recommended) ────────────────────────
// 0 = off. 1 = a single 100k resistor from CELL+ to A0 reports the cell
// voltage in every POST, so the dashboard tells you when to swap instead of
// the node just going dark. This is your ONLY low-battery warning — a bare
// holder has no BMS.
#define VBAT_ENABLE    0

// Trim factor: measure the cell with a multimeter, divide by what the node
// reports, put the ratio here. Resistor tolerances make ±5% typical.
#define VBAT_CAL       1.00f

// Below this the node POSTs "low_battery":true one last time and then sleeps
// INDEFINITELY until you swap cells and press reset. 3.30 V leaves margin —
// the board still leaks a few mA asleep, and Li-ion below ~2.5 V is damage.
#define VBAT_CUTOFF_V  3.30f
