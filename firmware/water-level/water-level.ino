/*
 * water-level.ino — Farmers IoT Toolkit, Module 1
 *
 * Reads a QDY30A submersible pressure probe over RS485 (Modbus RTU) and POSTs
 * the depth as JSON to the Node-RED base station (Module 4).
 *
 * Board: NodeMCU 1.0 (ESP-12E Module)   [Arduino IDE → Boards Manager → esp8266]
 * No libraries to install. The Modbus frame and CRC are hand-rolled so you can
 * see exactly what goes on the wire — that matters when it doesn't work.
 *
 * Copy config.example.h to config.h and edit it before flashing.
 *
 * Wiring — see docs/01-water-tank-level-sensor.md:
 *   probe red    -> MT3608 OUT+ (18V)      ** never to the ESP or MAX485 **
 *   probe green  -> MT3608 OUT- AND the common ground rail
 *   probe blue   -> MAX485 A
 *   probe yellow -> MAX485 B
 *   MAX485 RO->D5  DI->D6  DE+RE->D1  VCC->3V3  GND->GND
 *
 * Sensor facts confirmed on the bench (devlog 2026-07-15/16):
 *   9600 8N1 (NOT 4800 like the soil sensor), slave address 1,
 *   register 0x0004 = level, int16 SIGNED, 1 count = 1 mm.
 */
#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>
#include <SoftwareSerial.h>
#include "config.h"

// --- pins (see docs/bench/00-bench-rig.md) ---
#define RS485_RX  D5   // GPIO14  <- MAX485 RO
#define RS485_TX  D6   // GPIO12  -> MAX485 DI
#define RS485_DE  D1   // GPIO5   -> MAX485 DE+RE (tied together)

#define SENSOR_ADDR  1
#define RS485_BAUD   9600    // QDY30A default. NOT 4800 — that's the soil sensor.
#define REG_LEVEL    0x0004  // measured value

// Fallbacks so a config.h written before these existed still builds.
#ifndef POST_PORT
#define POST_PORT 1880
#endif
#ifndef POST_PATH
#define POST_PATH "/water"
#endif

SoftwareSerial rs485(RS485_RX, RS485_TX);

uint16_t modbusCRC(const uint8_t *buf, uint8_t len) {
  uint16_t crc = 0xFFFF;
  for (uint8_t i = 0; i < len; i++) {
    crc ^= buf[i];
    for (uint8_t b = 0; b < 8; b++) {
      crc = (crc & 1) ? (crc >> 1) ^ 0xA001 : (crc >> 1);
    }
  }
  return crc;
}

// Half-duplex: raise DE to talk, drop it to listen.
// The flush() matters — drop DE too early and you truncate your own frame.
void sendFrame(uint8_t *frame, uint8_t len) {
  digitalWrite(RS485_DE, HIGH);
  delayMicroseconds(50);
  rs485.write(frame, len);
  rs485.flush();
  delayMicroseconds(50);
  digitalWrite(RS485_DE, LOW);
}

/*
 * Read `count` registers from `start`. Returns true only on a CRC-valid frame.
 * Everything downstream trusts this, so it fails closed: a bad frame is no data,
 * never partial data.
 *
 * WHY THIS RESYNCS INSTEAD OF READING FROM BYTE 0:
 * Auto-direction RS485 boards (our HW-0519, and the FT232 USB adapter) echo our
 * own transmitted bytes back into the receive path. So the buffer looks like
 *
 *     01 03 00 04 00 01 C5 CB | 01 03 02 00 99 ...
 *     └──── our echoed request ────┘ └── the actual reply ──┘
 *
 * Parsing from byte 0 lands on the echo, fails CRC, and scores a timeout — which
 * is exactly the fault that made `mbpoll` report "Invalid CRC" on every frame
 * (devlog 2026-07-15). So: collect a window, then slide along it looking for a
 * well-formed header, and only trust a candidate once its CRC checks out.
 *
 * Requiring resp[2] == count*2 (the byte-count field) is what skips the echo:
 * in our request that position holds the register address high byte (0x00), never
 * the byte count. The CRC is the real proof; this just finds candidates fast.
 */
bool readRegisters(uint16_t start, uint16_t count, uint16_t *out) {
  uint8_t req[8] = {
    SENSOR_ADDR, 0x03,
    (uint8_t)(start >> 8), (uint8_t)(start & 0xFF),
    (uint8_t)(count >> 8), (uint8_t)(count & 0xFF),
    0, 0
  };
  uint16_t crc = modbusCRC(req, 6);
  req[6] = crc & 0xFF;          // CRC is little-endian on the wire
  req[7] = crc >> 8;

  while (rs485.available()) rs485.read();   // drop stale bytes
  sendFrame(req, 8);

  const uint8_t frameLen = 5 + count * 2;   // addr fn bytecount [data] crc crc
  uint8_t buf[64];
  uint8_t n = 0;
  // Read a WINDOW, not just frameLen bytes — the echo sits in front of the reply,
  // so stopping at frameLen would stop inside the echo and never see the answer.
  //
  // 300ms is ~5x the worst real turnaround (a 7-byte reply at 9600 is ~7ms on the
  // wire; the probe answers well inside 50ms). Generous enough not to clip a slow
  // reply, short enough that a DEAD probe reports in ~5s instead of ~16s — which
  // matters both when you're bench-wiring and when a solar node burns CPU retrying.
  unsigned long deadline = millis() + 300;
  while (millis() < deadline && n < sizeof(buf)) {
    if (rs485.available()) {
      buf[n++] = rs485.read();
      // Once a valid frame could fit, give the rest of it a moment to arrive
      // rather than sitting out the whole 300ms. Keeps a good read fast.
      if (n >= frameLen + 8) break;
    }
  }

  if (n < frameLen) { Serial.println(F("  timeout")); return false; }

  // Slide along the window looking for a CRC-valid reply.
  for (uint8_t i = 0; i + frameLen <= n; i++) {
    if (buf[i] != SENSOR_ADDR) continue;
    if (buf[i+1] != 0x03) continue;            // our function code
    if (buf[i+2] != count * 2) continue;       // byte count — this is what skips the echo
    uint16_t rxCRC = buf[i+frameLen-2] | (buf[i+frameLen-1] << 8);
    if (rxCRC != modbusCRC(buf + i, frameLen - 2)) continue;

    for (uint16_t r = 0; r < count; r++) {
      out[r] = (buf[i + 3 + r*2] << 8) | buf[i + 4 + r*2];
    }
    return true;
  }

  // Nothing valid in the window. Report a Modbus exception if the sensor sent one
  // — that's the sensor answering with a complaint, a different fault from silence.
  for (uint8_t i = 0; i + 2 <= n; i++) {
    if (buf[i] == SENSOR_ADDR && (buf[i+1] & 0x80)) {
      Serial.printf("  modbus exception 0x%02X\n", buf[i+2]);
      return false;
    }
  }
  Serial.printf("  no valid frame in %d bytes\n", n);
  return false;
}

/*
 * One averaged reading, or false.
 *
 * Averages several samples because it's nearly free and it smooths a rippling
 * surface. Retries because the first exchange after an idle period can lose its
 * header to the RS485 transceiver's TX->RX turnaround — a known, harmless quirk
 * of this hardware (devlog 2026-07-15). Don't chase it; just retry.
 */
bool readLevelRaw(int16_t *out) {
  const uint8_t WANT = 5;
  long sum = 0;
  uint8_t got = 0;

  for (uint8_t t = 0; t < WANT * 3 && got < WANT; t++) {
    uint16_t r[1];
    if (readRegisters(REG_LEVEL, 1, r)) {
      sum += (int16_t)r[0];   // SIGNED — a probe slightly below its zero point
      got++;                  // returns a real negative, not 65000-odd
    }
    delay(60);
  }
  if (got == 0) return false;
  *out = (int16_t)(sum / got);
  return true;
}

#if BENCH_MODE
void connectWiFi() {}                       // bench mode: no radio, no waiting
bool postJSON(const String &) { return false; }
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
    // The gateway IS the phone running the hotspot, so this is the address your
    // POST_URL needs. Printing it saves hunting for it on the phone, and if your
    // POST fails this is the first thing to compare against POST_URL.
    Serial.println("  gateway : " + WiFi.gatewayIP().toString() + "   <- the phone. POST_URL should point here.");
    Serial.printf("  rssi    : %d dBm\n", WiFi.RSSI());
  } else {
    Serial.println(" FAILED (will retry next cycle)");
  }
}

/*
 * Where to POST. An explicit POST_URL wins; otherwise derive it from the gateway.
 *
 * The phone running the hotspot IS our gateway, so it can't go stale — and Android
 * randomises the hotspot subnet (ours came up 10.215.63.x, not the 192.168.43.1
 * every guide quotes) and can reshuffle on any restart. A hardcoded IP fails silently:
 * the node keeps reading happily and nothing ever arrives. Deriving it deletes that
 * whole failure class, and means a farmer never has to find an IP address.
 */
String postUrl() {
  if (sizeof(POST_URL) > 1) return String(POST_URL);   // sizeof("") == 1
  return "http://" + WiFi.gatewayIP().toString() + ":" + String(POST_PORT) + POST_PATH;
}

bool postJSON(const String &json) {
  if (WiFi.status() != WL_CONNECTED) return false;
  const String url = postUrl();
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
    Serial.printf("POST: %d ok\n", code);
    return true;
  }
  // Negative = client-side (couldn't even open a socket); positive = the server
  // answered and didn't like it. Printing the URL turns "-1" from a mystery into
  // "that address isn't on this network", which is the usual cause.
  Serial.printf("POST: failed (%d) -> %s\n", code, url.c_str());
  return false;
}
#endif  // BENCH_MODE

void setup() {
  Serial.begin(115200);          // debug, over USB
  pinMode(RS485_DE, OUTPUT);
  digitalWrite(RS485_DE, LOW);   // default to listening
  rs485.begin(RS485_BAUD);
  delay(500);
  Serial.println(F("\n\nFarmers IoT Toolkit — Module 1: water tank level"));
  Serial.printf("node=%s  dry_offset=%d counts  tank_full=%d mm\n",
                NODE_ID, DRY_OFFSET_COUNTS, TANK_FULL_MM);
  if (TANK_FULL_MM <= 0) {
    Serial.println(F("tank_full_mm not set — reporting depth only, no percentage"));
  }
#if BENCH_MODE
  WiFi.mode(WIFI_OFF);   // radio off: less power, less RF noise near the RS485 pair
  Serial.println(F("BENCH MODE — WiFi off, polling every 2s, serial only."));
  Serial.println(F("Set BENCH_MODE 0 in config.h once the probe reads reliably.\n"));
#else
  connectWiFi();
#endif
}

void loop() {
  connectWiFi();   // no-op when already up

  int16_t raw;
  String json;

  if (readLevelRaw(&raw)) {
    // 1 count = 1 mm, confirmed by ruler against this exact hardware. The dry
    // offset is the probe's own zero — real, per-unit, and bigger than any other
    // error here (ours was 26 mm of water that wasn't there).
    int depth_mm = raw - DRY_OFFSET_COUNTS;

    // A probe reading just under its zero is normal, not a fault. Clamp the
    // reported depth so the dashboard doesn't show a negative tank, but log the
    // raw value so a drifting zero is still visible to whoever reads the serial.
    int reported_mm = depth_mm < 0 ? 0 : depth_mm;

    json = String("{\"node\":\"") + NODE_ID + "\",\"ok\":true"
         + ",\"raw\":" + raw
         + ",\"depth_mm\":" + reported_mm;

    if (TANK_FULL_MM > 0) {
      float pct = (100.0f * reported_mm) / (float)TANK_FULL_MM;
      if (pct > 100.0f) pct = 100.0f;    // overfull reads as full, not 103%
      json += ",\"percent\":" + String(pct, 1);
    }
#if !BENCH_MODE
    // Only publish RSSI when there's a link to measure. Disconnected, WiFi.RSSI()
    // returns a sentinel (we saw 31) that looks exactly like a real reading — and
    // publishing a sentinel as data is the same sin as reporting a wrong depth.
    if (WiFi.status() == WL_CONNECTED) json += ",\"rssi\":" + String(WiFi.RSSI());
#endif
    json += ",\"uptime_s\":" + String(millis() / 1000) + "}";

    Serial.printf("raw=%d  depth=%d mm%s\n", raw, depth_mm,
                  depth_mm < 0 ? "  (below zero — check the dry offset)" : "");
  } else {
    // Report the failure rather than staying silent. A missing message looks
    // identical to a dead node or dead WiFi; an explicit error tells the
    // dashboard the node is alive and the probe is not.
    json = String("{\"node\":\"") + NODE_ID + "\",\"ok\":false"
         + ",\"error\":\"no valid modbus frame\"";
#if !BENCH_MODE
    // Only publish RSSI when there's a link to measure. Disconnected, WiFi.RSSI()
    // returns a sentinel (we saw 31) that looks exactly like a real reading — and
    // publishing a sentinel as data is the same sin as reporting a wrong depth.
    if (WiFi.status() == WL_CONNECTED) json += ",\"rssi\":" + String(WiFi.RSSI());
#endif
    json += ",\"uptime_s\":" + String(millis() / 1000) + "}";
    Serial.println(F("read FAILED — check 18V on the probe, and A/B wiring"));
  }

  Serial.println(json);
  postJSON(json);

#if BENCH_MODE
  delay(2000);   // fast loop while you're wiring
#else
  delay((unsigned long)REPORT_INTERVAL_S * 1000UL);
#endif
}
