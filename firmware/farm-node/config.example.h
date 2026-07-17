// config.example.h — copy to config.h and edit. config.h is gitignored.
//
//   cp config.example.h config.h
//
// Every value you need to change lives here. You should not have to edit the
// .ino to get a working node.
#pragma once

// ─── Bench mode ─────────────────────────────────────────────────────────────
// 1 = skip WiFi entirely and just print readings to the Serial Monitor, fast.
// 0 = normal operation: read both sensors, and POST to the base station.
//
// START AT 1. Prove both probes read through the ESP8266 before you add WiFi to
// the list of things that could be broken. One thing at a time is the whole
// trick to bringing hardware up.
#define BENCH_MODE     0

// ─── WiFi ───────────────────────────────────────────────────────────────────
// The hotspot from Module 4 (the Android base station). Ignored in bench mode.
#define WIFI_SSID      "FarmIoT"
#define WIFI_PASSWORD  "change-me"

// ─── Where to send readings ─────────────────────────────────────────────────
// LEAVE POST_HOST EMPTY and the node finds the base station by itself.
//
// The phone running the hotspot IS this node's gateway, by definition — so the
// node already knows its address the moment it connects. You never have to look
// up an IP.
//
// This is not just convenience. Android RANDOMISES the hotspot subnet: ours came
// up on 10.215.63.55, not the 192.168.43.1 every guide quotes, and it can shuffle
// again on any hotspot restart or reboot. A hardcoded IP goes stale SILENTLY —
// the node keeps reading perfectly and publishes into the void, every node in the
// field stops reporting, and the only symptom is absence.
//
// Set POST_HOST only to override: a real server on the LAN, a different host, etc.
//   #define POST_HOST "192.168.1.50"
#define POST_HOST        ""
#define POST_PORT        1880
#define POST_PATH_WATER  "/water"
#define POST_PATH_SOIL   "/soil"

// Test the endpoints before you blame the firmware — from any device on the hotspot:
//   curl -X POST http://<phone-ip>:1880/water -H 'Content-Type: application/json' \
//        -d '{"node":"test","ok":true,"depth_mm":500}'
// The node prints the phone's address on serial as `gateway :` when it connects.

// Names for the two readings. If you run more than one of either, make these unique.
#define NODE_ID_WATER  "water-tank-1"
#define NODE_ID_SOIL   "soil-bed-1"

// How often to read and send, in seconds. Ignored in bench mode, which polls
// every 2s so you get a fast feedback loop while wiring.
#define REPORT_INTERVAL_S  60

// ─── Water probe calibration ────────────────────────────────────────────────
// THE DRY READING. Power the probe up sitting in air (NOT in the tank) and read
// the raw value — see Step 4 of docs/01-water-tank-level-sensor.md. It will NOT
// be zero. Ours read 26. Put YOUR number here.
//
// This is per-probe and it drifts over months. Re-measure if readings look off.
#define DRY_OFFSET_COUNTS  26

// Water depth above the probe when the tank is FULL, in mm. Measure this once.
// Set to 0 if you don't know it yet — the node reports depth in mm and simply
// omits the percentage.
#define TANK_FULL_MM   0
