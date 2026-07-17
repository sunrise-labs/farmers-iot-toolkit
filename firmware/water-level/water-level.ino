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

// Read `count` registers from `start`. Returns true only on a CRC-valid frame.
// Everything downstream trusts this, so it fails closed: a bad frame is no data,
// never partial data.
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

  const uint8_t expected = 5 + count * 2;   // addr fn bytecount [data] crc crc
  uint8_t resp[64];
  uint8_t got = 0;
  // 300ms is ~5x the worst real turnaround (a 7-byte reply at 9600 is ~7ms on the
  // wire; the probe answers well inside 50ms). Generous enough not to clip a slow
  // reply, short enough that a DEAD probe reports in ~5s instead of ~16s — which
  // matters both when you're bench-wiring and when a solar node burns CPU retrying.
  unsigned long deadline = millis() + 300;

  while (got < expected && millis() < deadline) {
    if (rs485.available()) resp[got++] = rs485.read();
  }

  if (got < expected)         { Serial.println(F("  timeout")); return false; }
  if (resp[0] != SENSOR_ADDR) { Serial.println(F("  wrong addr")); return false; }
  if (resp[1] & 0x80)         { Serial.printf("  modbus exception 0x%02X\n", resp[2]); return false; }

  uint16_t rxCRC = resp[expected-2] | (resp[expected-1] << 8);
  if (rxCRC != modbusCRC(resp, expected-2)) { Serial.println(F("  CRC fail")); return false; }

  for (uint16_t i = 0; i < count; i++) {
    out[i] = (resp[3 + i*2] << 8) | resp[4 + i*2];
  }
  return true;
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
  Serial.println(WiFi.status() == WL_CONNECTED
                   ? " ok, ip " + WiFi.localIP().toString()
                   : " FAILED (will retry next cycle)");
}

bool postJSON(const String &json) {
  if (WiFi.status() != WL_CONNECTED) return false;
  WiFiClient client;
  HTTPClient http;
  if (!http.begin(client, POST_URL)) {
    Serial.println(F("POST: bad URL"));
    return false;
  }
  http.addHeader("Content-Type", "application/json");
  int code = http.POST(json);
  http.end();
  if (code > 0 && code < 300) {
    Serial.printf("POST: %d ok\n", code);
    return true;
  }
  Serial.printf("POST: failed (%d)\n", code);   // negative = client-side error
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
    json += ",\"rssi\":" + String(WiFi.RSSI());
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
    json += ",\"rssi\":" + String(WiFi.RSSI());
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
