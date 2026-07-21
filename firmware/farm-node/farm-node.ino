/*
 * farm-node.ino — Farmers IoT Toolkit, COMBINED NODE (modules 1 + 2 sensing)
 *
 * Reads BOTH sensors from one ESP8266 and POSTs each as JSON to the Node-RED
 * base station (Module 4). Import flows/both-sensors-flow.json to receive them.
 *
 *   water  QDY30A  RS485 @ 9600 -> HW-0519 #1 -> RXD=D7  TXD=D1   (probe needs 18V)
 *   soil   THC-S   RS485 @ 4800 -> HW-0519 #2 -> RXD=D6  TXD=D5   (probe runs on 5V)
 *   (pins as physically soldered 2026-07-19 — water & soil swapped vs the original
 *    D5/D6-water, D7/D1-soil layout; firmware follows the iron, not the other way.)
 *
 * TWO SEPARATE BUSES, one transceiver each. That is what lets both sensors keep
 * slave address 1 AND run different bauds with no register writes on either — a
 * dollar of hardware deletes two problems that would otherwise need risky writes
 * to registers we own exactly one sensor of. Proven on hardware 2026-07-16.
 *
 * ** NO DE PIN. ** Both boards are HW-0519 auto-direction — they derive transmit
 * enable from TXD via an onboard 74HC04. water-level.ino toggles D1 as DE, which
 * was harmless when D1 was disconnected but D1 is now water's TXD: driving it would
 * clamp the water board's driver onto the water bus and the sensor could never reply.
 * Never add a DE pin back on a combined node.
 *
 * Pin budget is exactly spent: D7/D1 water, D6/D5 soil, D2 free for the valve.
 * D3/D4/D8 are boot straps and D0 has no interrupts (so it cannot do SoftwareSerial
 * RX). There is no sixth safe pin. See docs/02 for the full table.
 *
 * Board: NodeMCU 1.0 (ESP-12E Module)   [Arduino IDE -> Boards Manager -> esp8266]
 * No libraries to install. Modbus frame and CRC are hand-rolled so you can see
 * exactly what goes on the wire — that matters when it doesn't work.
 *
 * Copy config.example.h to config.h and edit it before flashing.
 *
 *   arduino-cli compile --upload --fqbn esp8266:esp8266:nodemcuv2 \
 *       -p /dev/ttyUSB0 firmware/farm-node
 *   (compile --upload — plain `upload` flashes a STALE binary, devlog 2026-07-16)
 *
 * OTA (over-the-air) update — reflash over WiFi, no cable. Needs OTA_ENABLE=1 in
 * config.h. The FIRST flash carrying OTA must still go over USB (above); after it
 * boots, the node advertises itself and every later update can go wireless:
 *
 *   arduino-cli compile --fqbn esp8266:esp8266:nodemcuv2 \
 *       --output-dir /tmp/farm-node firmware/farm-node
 *   python3 ~/.arduino15/packages/esp8266/hardware/esp8266/<ver>/tools/espota.py \
 *       -i farm-node-1.local -p 8266 --auth=change-me-ota \
 *       -f /tmp/farm-node/farm-node.ino.bin
 *   (<ver> is the installed core version, e.g. 3.1.2)
 *
 *   (-i takes <OTA_HOSTNAME>.local or the node's IP; --auth is OTA_PASSWORD.
 *    Both node and laptop must be on the same hotspot. The node closes the valve
 *    before flashing and reboots when done.)
 */
#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>
#include <SoftwareSerial.h>
#include "config.h"

// OTA fallback guards — a pre-OTA config.h still compiles (same #ifndef pattern
// as the VALVE_* and POST_* fallbacks below). Copy real values from config.example.h.
#ifndef OTA_ENABLE
#define OTA_ENABLE   0
#endif
#ifndef OTA_HOSTNAME
#define OTA_HOSTNAME "farm-node"
#endif
#ifndef OTA_PASSWORD
#define OTA_PASSWORD ""
#endif

// ArduinoOTA only makes sense with a live radio, so it's gated on !BENCH_MODE too.
// Pulling the header in only when used keeps the bench build lean.
#if !BENCH_MODE && OTA_ENABLE
#include <ArduinoOTA.h>
#endif

// Valve config fallbacks — a pre-valve config.h still compiles (same idea as the
// POST_* #ifndef guards). Copy the real values from config.example.h.
#ifndef VALVE_PIN
#define VALVE_PIN        D2
#endif
#ifndef VALVE_ACTIVE_LOW
#define VALVE_ACTIVE_LOW 1
#endif
#ifndef VALVE_POLL_S
#define VALVE_POLL_S     1
#endif
#ifndef VALVE_PATH
#define VALVE_PATH       "/valve"
#endif
#ifndef VALVE_MAX_OPEN_S
#define VALVE_MAX_OPEN_S 0
#endif

// --- water bus ---
#define WATER_RX   D7      // GPIO13 <- HW-0519 #1 RXD  (as soldered 2026-07-19)
#define WATER_TX   D1      // GPIO5  -> HW-0519 #1 TXD  (as soldered 2026-07-19)
#define WATER_BAUD 9600    // QDY30A default. NOT 4800 — that's the soil probe.
#define WATER_REG  0x0004  // level, int16 SIGNED, 1 count = 1 mm (ruler-confirmed)

// --- soil bus ---
#define SOIL_RX    D6      // GPIO12 <- HW-0519 #2 RXD  (as soldered 2026-07-19)
#define SOIL_TX    D5      // GPIO14 -> HW-0519 #2 TXD  (as soldered 2026-07-19)
#define SOIL_BAUD  4800    // THC-S default. NOT 9600 — that's the water probe.
#define SOIL_REG   0x0000  // 0=moisture /10 %, 1=temp /10 C SIGNED, 2=EC uS/cm

#define SENSOR_ADDR 1      // both sensors ship as address 1 — fine, separate buses

SoftwareSerial water(WATER_RX, WATER_TX);
SoftwareSerial soil(SOIL_RX, SOIL_TX);

// --- valve (Module 2), MANUAL control for now ---------------------------------
// No moisture thresholds yet: the base station (Node-RED) holds the desired
// state and a button on its page sets it; this node polls that state and drives
// the relay on D2. Thresholds + the full safety cutoff are the next step.
bool valveOpen = false;
unsigned long valveOpenedAt = 0;

// Relay-OFF must equal valve-CLOSED so a crash, reset, or lost link fails safe.
// Most 1-channel boards are active-LOW (IN low = energised) — set VALVE_ACTIVE_LOW.
inline int valveLevel(bool open) {
  return open ? (VALVE_ACTIVE_LOW ? LOW : HIGH)
              : (VALVE_ACTIVE_LOW ? HIGH : LOW);
}
void setValve(bool open) {
  if (open && !valveOpen) valveOpenedAt = millis();   // start the open timer
  digitalWrite(VALVE_PIN, valveLevel(open));
  valveOpen = open;
}

// Optional belt-and-braces even in manual mode: force shut after VALVE_MAX_OPEN_S
// so "opened it and walked away" can't empty the tank. 0 = disabled (pure manual).
void valveSafety() {
  if (VALVE_MAX_OPEN_S > 0 && valveOpen &&
      (millis() - valveOpenedAt) > (unsigned long)VALVE_MAX_OPEN_S * 1000UL) {
    setValve(false);
    Serial.println(F("VALVE  force-closed: max open time reached"));
  }
}

uint16_t modbusCRC(const uint8_t *buf, uint8_t len) {
  uint16_t crc = 0xFFFF;
  for (uint8_t i = 0; i < len; i++) {
    crc ^= buf[i];
    for (uint8_t b = 0; b < 8; b++) crc = (crc & 1) ? (crc >> 1) ^ 0xA001 : (crc >> 1);
  }
  return crc;
}

/*
 * Read `count` registers from `start` on `port`. True ONLY on a CRC-valid frame.
 * Everything downstream trusts this, so it fails closed: a bad frame is no data,
 * never partial data.
 *
 * Slides along the receive window looking for a well-formed header rather than
 * parsing from byte 0. Measured on our hardware neither HW-0519 echoes (replies
 * arrive at exactly frameLen), but the FT232 USB adapter definitely does, and the
 * slide costs nothing when there's no echo. The CRC is the real proof; the header
 * match just finds candidates fast.
 */
bool readRegisters(SoftwareSerial &port, uint16_t start, uint16_t count, uint16_t *out) {
  uint8_t req[8] = {
    SENSOR_ADDR, 0x03,
    (uint8_t)(start >> 8), (uint8_t)(start & 0xFF),
    (uint8_t)(count >> 8), (uint8_t)(count & 0xFF),
    0, 0
  };
  uint16_t crc = modbusCRC(req, 6);
  req[6] = crc & 0xFF;          // CRC is little-endian on the wire
  req[7] = crc >> 8;

  while (port.available()) port.read();   // drop stale bytes
  port.write(req, 8);
  port.flush();

  const uint8_t frameLen = 5 + count * 2;   // addr fn bytecount [data] crc crc
  uint8_t buf[64];
  uint8_t n = 0;
  // 300ms is ~5x the worst real turnaround. Generous enough not to clip a slow
  // reply, short enough that a dead probe reports fast instead of burning CPU.
  unsigned long deadline = millis() + 300;
  while (millis() < deadline && n < sizeof(buf)) {
    if (port.available()) {
      buf[n++] = port.read();
      if (n >= frameLen + 8) break;
    }
  }
  if (n < frameLen) return false;

  for (uint8_t i = 0; i + frameLen <= n; i++) {
    if (buf[i] != SENSOR_ADDR) continue;
    if (buf[i+1] != 0x03) continue;
    if (buf[i+2] != count * 2) continue;    // byte count — skips any echo
    uint16_t rxCRC = buf[i+frameLen-2] | (buf[i+frameLen-1] << 8);
    if (rxCRC != modbusCRC(buf + i, frameLen - 2)) continue;
    for (uint16_t r = 0; r < count; r++)
      out[r] = (buf[i + 3 + r*2] << 8) | buf[i + 4 + r*2];
    return true;
  }
  return false;
}

// Retry — the first exchange after an idle period can lose its header to the
// transceiver's TX->RX turnaround. Known, harmless, just retry.
bool readWithRetry(SoftwareSerial &port, uint16_t start, uint16_t count,
                   uint16_t *out, uint8_t tries) {
  for (uint8_t t = 0; t < tries; t++) {
    if (readRegisters(port, start, count, out)) return true;
    delay(60);
  }
  return false;
}

#if BENCH_MODE
void connectWiFi() {}
bool postJSON(const char *, const String &) { return false; }
void pollValveCommand() {}
#else
void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.printf("WiFi: connecting to %s", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  // Bounded wait. If the base station is down we still want to keep reading and
  // reporting over serial rather than blocking here forever.
  unsigned long deadline = millis() + 20000;
  while (WiFi.status() != WL_CONNECTED && millis() < deadline) {
    delay(500);
    Serial.print(".");
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println(" ok");
    Serial.println("  my ip   : " + WiFi.localIP().toString());
    // The gateway IS the phone running the hotspot, so this is where we POST.
    // Printing it turns a failed POST from a mystery into an address comparison.
    Serial.println("  gateway : " + WiFi.gatewayIP().toString() + "   <- the phone");
    Serial.printf("  rssi    : %d dBm\n", WiFi.RSSI());
  } else {
    Serial.println(" FAILED (will retry next cycle)");
  }
}

/*
 * An explicit POST_HOST wins; otherwise derive from the gateway.
 *
 * The phone running the hotspot IS our gateway, so it can't go stale — and Android
 * randomises the hotspot subnet and can reshuffle on any restart. A hardcoded IP
 * fails silently: the node keeps reading happily and nothing ever arrives.
 * Deriving it deletes that whole failure class, and means a farmer never has to
 * find an IP address — which is the better toolkit anyway.
 */
String postUrl(const char *path) {
  String host = (sizeof(POST_HOST) > 1)               // sizeof("") == 1
              ? String(POST_HOST)
              : WiFi.gatewayIP().toString();
  return "http://" + host + ":" + String(POST_PORT) + path;
}

bool postJSON(const char *path, const String &json) {
  if (WiFi.status() != WL_CONNECTED) return false;
  const String url = postUrl(path);
  WiFiClient client;
  HTTPClient http;
  if (!http.begin(client, url)) {
    Serial.println("POST: bad URL: " + url);
    return false;
  }
  http.addHeader("Content-Type", "application/json");
  int code = http.POST(json);
  http.end();
  if (code > 0 && code < 300) {
    Serial.printf("POST %s: %d ok\n", path, code);
    return true;
  }
  // Negative = client-side (couldn't open a socket); positive = the server
  // answered and didn't like it. Printing the URL turns "-1" from a mystery into
  // "that address isn't on this network", which is the usual cause.
  Serial.printf("POST %s: failed (%d) -> %s\n", path, code, url.c_str());
  return false;
}

// Ask the base station whether the valve should be open. Manual for now — a
// button on the Node-RED page sets it, and GET /valve returns "1" or "0".
//
// We POLL rather than run a server on the node because the phone's hotspot hands
// the node its IP and can change it; the node always knows how to reach the base
// station (its gateway), never the reverse. A failed poll HOLDS the last state —
// a brief WiFi blip shouldn't cycle the valve.
void pollValveCommand() {
  if (WiFi.status() != WL_CONNECTED) return;
  const String url = postUrl(VALVE_PATH);
  WiFiClient client;
  HTTPClient http;
  if (!http.begin(client, url)) return;
  int code = http.GET();
  if (code == 200) {
    const String body = http.getString();
    const bool want = body.indexOf('1') >= 0;   // "1" = open, "0" = closed
    if (want != valveOpen) {
      setValve(want);
      Serial.printf("VALVE  -> %s  (base station)\n", want ? "OPEN" : "CLOSED");
    }
  }
  http.end();
}
#endif  // BENCH_MODE

// --- OTA (over-the-air firmware update) ---------------------------------------
// Lets you reflash over WiFi once the node is on battery / sealed / up a tank.
// Everything here is a no-op when OTA is off or in bench mode, so the rest of the
// sketch calls setupOTA()/otaHandle()/otaDelay() unconditionally.
#if !BENCH_MODE && OTA_ENABLE
bool otaReady = false;

// begin() runs ONCE per boot, and only after WiFi is up (it starts mDNS). Called
// every loop but self-guards, so it just latches on at the first connected pass.
void setupOTA() {
  if (otaReady || WiFi.status() != WL_CONNECTED) return;

  ArduinoOTA.setHostname(OTA_HOSTNAME);
  if (sizeof(OTA_PASSWORD) > 1) ArduinoOTA.setPassword(OTA_PASSWORD);  // "" == no auth

  // Fail safe: the sketch stops running during a flash, so a relay latched OPEN
  // would stay open across the whole update + reboot. Shut the valve first.
  ArduinoOTA.onStart([]() {
    setValve(false);
    Serial.println(F("OTA: update starting — valve forced CLOSED, hold still"));
  });
  ArduinoOTA.onEnd([]() { Serial.println(F("\nOTA: complete, rebooting")); });
  ArduinoOTA.onProgress([](unsigned int done, unsigned int total) {
    Serial.printf("OTA: %u%%\r", total ? (done * 100) / total : 0);
  });
  ArduinoOTA.onError([](ota_error_t e) { Serial.printf("\nOTA: error %u\n", e); });

  ArduinoOTA.begin();
  otaReady = true;
  Serial.printf("OTA: ready as \"%s\" (%s.local) at %s\n",
                OTA_HOSTNAME, OTA_HOSTNAME, WiFi.localIP().toString().c_str());
}

void otaHandle() { if (otaReady) ArduinoOTA.handle(); }

// A drop-in for delay() that keeps servicing OTA while it waits. The sensor cadence
// spends most of its time sleeping between polls; a plain delay() there would make
// the node deaf to an update for seconds and fail the handshake. Sensor reads
// themselves (~sub-second) are left alone — poking OTA mid-read risks the bit-banged
// SoftwareSerial timing, and a missed window just means retrying the upload.
void otaDelay(unsigned long ms) {
  unsigned long start = millis();
  while (millis() - start < ms) { otaHandle(); delay(10); }
}
#else
void setupOTA() {}
void otaHandle() {}
void otaDelay(unsigned long ms) { delay(ms); }
#endif

// Only publish RSSI when there's a link to measure. Disconnected, WiFi.RSSI()
// returns a sentinel (we saw 31) that looks exactly like a real reading — and
// publishing a sentinel as data is the same sin as reporting a wrong depth.
void appendTail(String &json) {
#if !BENCH_MODE
  if (WiFi.status() == WL_CONNECTED) json += ",\"rssi\":" + String(WiFi.RSSI());
#endif
  json += ",\"uptime_s\":" + String(millis() / 1000) + "}";
}

void readAndSendWater() {
  uint16_t v[1];
  String json;

  if (readWithRetry(water, WATER_REG, 1, v, 5)) {
    int16_t raw = (int16_t)v[0];   // SIGNED — a probe just under its zero returns
                                   // a real negative, not 65000-odd
    int depth_mm = raw - DRY_OFFSET_COUNTS;
    // A probe reading just under its zero is normal, not a fault. Clamp what we
    // report so the dashboard never shows a negative tank, but keep raw in the
    // payload so a drifting zero stays visible to whoever looks.
    int reported = depth_mm < 0 ? 0 : depth_mm;

    json = String("{\"node\":\"") + NODE_ID_WATER + "\",\"ok\":true"
         + ",\"raw\":" + raw
         + ",\"depth_mm\":" + reported;
    if (TANK_FULL_MM > 0) {
      float pct = (100.0f * reported) / (float)TANK_FULL_MM;
      if (pct > 100.0f) pct = 100.0f;     // overfull reads as full, not 103%
      json += ",\"percent\":" + String(pct, 1);
    }
    appendTail(json);
    Serial.printf("WATER  raw=%-6d depth=%d mm%s\n", raw, depth_mm,
                  depth_mm < 0 ? "  (below zero — check the dry offset)" : "");
  } else {
    // Report the failure rather than staying silent. A missing message looks
    // identical to a dead node or dead WiFi; an explicit error tells the
    // dashboard the node is alive and the probe is not.
    json = String("{\"node\":\"") + NODE_ID_WATER + "\",\"ok\":false"
         + ",\"error\":\"no valid modbus frame\"";
    appendTail(json);
    Serial.println(F("WATER  FAILED — check 18V at the probe, and blue=A yellow=B"));
  }
  Serial.println(json);
  postJSON(POST_PATH_WATER, json);
}

void readAndSendSoil() {
  uint16_t v[3];
  String json;

  if (readWithRetry(soil, SOIL_REG, 3, v, 5)) {
    float moisture = v[0] / 10.0f;
    float tempC    = (int16_t)v[1] / 10.0f;   // SIGNED — 0xFF9B is -10.1C, not 65435
    uint16_t ec    = v[2];

    json = String("{\"node\":\"") + NODE_ID_SOIL + "\",\"ok\":true"
         + ",\"moisture_pct\":" + String(moisture, 1)
         + ",\"temp_c\":" + String(tempC, 1)
         + ",\"ec\":" + String(ec)
         + ",\"valve\":\"" + (valveOpen ? "open" : "closed") + "\"";  // actual pin state
    appendTail(json);
    Serial.printf("SOIL   moisture=%.1f %%   temp=%.1f C   EC=%u uS/cm\n",
                  moisture, tempC, ec);
  } else {
    json = String("{\"node\":\"") + NODE_ID_SOIL + "\",\"ok\":false"
         + ",\"error\":\"no valid modbus frame\""
         + ",\"valve\":\"" + (valveOpen ? "open" : "closed") + "\"";  // report even on fault
    appendTail(json);
    Serial.println(F("SOIL   FAILED — check 5V on brown/black, and yellow=A blue=B"));
  }
  Serial.println(json);
  postJSON(POST_PATH_SOIL, json);
}

void setup() {
  Serial.begin(115200);          // debug, over USB

  // Valve fails safe from the first instant: write the CLOSED level, THEN make
  // the pin an output, so it can't glitch through OPEN during boot.
  digitalWrite(VALVE_PIN, valveLevel(false));
  pinMode(VALVE_PIN, OUTPUT);
  valveOpen = false;

  water.begin(WATER_BAUD);
  soil.begin(SOIL_BAUD);
  delay(500);
  Serial.println(F("\n\nFarmers IoT Toolkit — combined node (water + soil + valve)"));
  Serial.printf("water=%s  soil=%s  dry_offset=%d  tank_full=%d mm\n",
                NODE_ID_WATER, NODE_ID_SOIL, DRY_OFFSET_COUNTS, TANK_FULL_MM);
  Serial.printf("valve on GPIO%d  active-%s  poll=%ds  max-open=%ds  (manual)\n",
                VALVE_PIN, VALVE_ACTIVE_LOW ? "LOW" : "HIGH",
                VALVE_POLL_S, VALVE_MAX_OPEN_S);
  if (TANK_FULL_MM <= 0)
    Serial.println(F("tank_full_mm not set — reporting depth only, no percentage"));
#if BENCH_MODE
  // Radio off, and mean it: the SDK auto-connects to the last known AP on boot
  // whether you asked or not. That's ~80mA with 300mA spikes on a rail already
  // feeding a boost, plus interrupt pressure on two bit-banged serial buses.
  WiFi.mode(WIFI_OFF);
  WiFi.forceSleepBegin();
  Serial.println(F("BENCH MODE — WiFi off, polling every 2s, serial only."));
  Serial.println(F("Set BENCH_MODE 0 in config.h once both probes read reliably.\n"));
#else
  connectWiFi();
#endif
}

void loop() {
  connectWiFi();   // no-op when already up, reconnects when it isn't
  setupOTA();      // latches on at the first connected pass, no-op after
  otaHandle();     // service any in-flight update before the blocking sensor reads

  readAndSendWater();
  readAndSendSoil();
  Serial.println();

#if BENCH_MODE
  delay(2000);
#else
  // Keep the sensor cadence at REPORT_INTERVAL_S, but poll the valve command
  // every VALVE_POLL_S during the wait so the base-station button responds in
  // ~1s instead of once per report. valveSafety() runs on the same tick, and
  // otaDelay() keeps OTA alive across the wait (a plain delay would make the node
  // deaf to an update for the whole interval).
  for (int elapsed = 0; elapsed < REPORT_INTERVAL_S; elapsed += VALVE_POLL_S) {
    pollValveCommand();
    valveSafety();
    otaDelay((unsigned long)VALVE_POLL_S * 1000UL);
  }
#endif
}
