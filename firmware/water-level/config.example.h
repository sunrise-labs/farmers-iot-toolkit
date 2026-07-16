// config.example.h — copy to config.h and edit. config.h is gitignored.
//
//   cp config.example.h config.h
//
// Every value you need to change lives here. You should not have to edit the
// .ino to get a working node.
#pragma once

// ─── WiFi ───────────────────────────────────────────────────────────────────
// The hotspot from Module 4 (the Android base station).
#define WIFI_SSID      "FarmIoT"
#define WIFI_PASSWORD  "change-me"

// ─── Where to send readings ─────────────────────────────────────────────────
// A Node-RED `http in` node listening for POST. The IP is the phone's address
// on its own hotspot — check Module 4, it's usually 192.168.43.1.
// Test it before flashing:
//   curl -X POST http://192.168.43.1:1880/water -H 'Content-Type: application/json' -d '{"test":1}'
#define POST_URL       "http://192.168.43.1:1880/water"

// Name for this node. If you ever run two tanks, give them different names.
#define NODE_ID        "water-tank-1"

// How often to read and send, in seconds.
#define REPORT_INTERVAL_S  60

// ─── Sensor calibration ─────────────────────────────────────────────────────
// THE DRY READING. Power the probe up sitting in air (not in the tank) and read
// the raw value — see Step 4 of docs/01-water-tank-level-sensor.md. It will NOT
// be zero. Ours read 26. Put YOUR number here.
//
// This is per-probe and it drifts over months. Re-measure if readings look off.
#define DRY_OFFSET_COUNTS  26

// ─── Your tank ──────────────────────────────────────────────────────────────
// Water depth above the probe when the tank is FULL, in mm. Measure this once.
// Set to 0 if you don't know it yet — the node will report depth in mm and
// simply omit the percentage.
#define TANK_FULL_MM   0
