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

// ─── Valve (Module 2 — MANUAL control for now) ──────────────────────────────
// The valve is driven through a relay on this pin. D2 is the last free-and-safe
// pin once both sensors are wired (D5/D6 water, D7/D1 soil). Don't move it onto
// a boot-strap pin (D3/D4/D8) or D0.
#define VALVE_PIN         D2

// Most 1-channel relay boards are ACTIVE-LOW: IN LOW energises the relay. That
// suits us — at boot the pin floats and the board's pull-up holds it de-energised,
// so the valve is CLOSED before code runs. If your relay clicks the wrong way
// (opens when it should close), set this to 0.
#define VALVE_ACTIVE_LOW  1

// How often (seconds) to ask the base station for the desired valve state, so the
// page button feels responsive. Sensors still report every REPORT_INTERVAL_S.
#define VALVE_POLL_S      1

// Endpoint on the base station that returns "1" (open) or "0" (closed).
#define VALVE_PATH        "/valve"

// Safety: force the valve shut after this many seconds open, even in manual mode
// (guards against "opened it and walked away"). 0 = disabled. Turn it on before
// you leave the node unattended.
#define VALVE_MAX_OPEN_S  0

// ─── OTA — over-the-air firmware update ─────────────────────────────────────
// Reflash this node over WiFi, no USB cable. This is what makes the node
// maintainable once it's on battery, sealed in a box, or up a tank — you push a
// new build from your laptop on the same hotspot instead of unwiring it.
//
// FIRST FLASH IS STILL USB. OTA can only receive an update once OTA-capable
// firmware is ALREADY running. So flash this build over the cable one last time;
// every update after that can go wireless.
//
// 1 = enable, 0 = disable. Auto-off in bench mode (no WiFi there anyway).
#define OTA_ENABLE     1

// The name the node advertises. Appears as a network port in the Arduino IDE and
// resolves as <hostname>.local via mDNS, so you never chase its IP. Make it
// unique per node if you run several.
#define OTA_HOSTNAME   "farm-node-1"

// Password required to push an update. DO NOT ship a node with this empty —
// anyone on the hotspot could otherwise overwrite your firmware. Leave "" only
// on the bench. Change it before the node leaves your desk.
#define OTA_PASSWORD   "change-me-ota"
