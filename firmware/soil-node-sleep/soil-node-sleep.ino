/*
 * soil-node-sleep.ino — Farmers IoT Toolkit, DEEP-SLEEP SOIL-ONLY NODE
 *
 * A battery-swap variant of the soil sensor: no solar panel, no valve. The node
 * wakes every SLEEP_MINUTES, powers up, reads the THC-S, POSTs one JSON reading
 * to the Node-RED base station (Module 4), and goes back to deep sleep. Awake
 * ~10–20 s per cycle, asleep the rest — a 1S3P/1S4P 18650 holder lasts weeks to
 * months instead of days. Full build guide: docs/deep-sleep-soil-node.md
 *
 * POWER: a single Li-ion cell (3.0–4.2 V) is below spec for everything here —
 * the THC-S floor is 4.5 V, the MAX485 is a 5 V part, and the NodeMCU's AMS1117
 * needs ~4.3 V+ on Vin. So the cell feeds an MT3608 boost set to 5.0–5.2 V, and
 * that 5 V rail feeds all three. Set the boost voltage BEFORE connecting loads.
 *
 *   soil  THC-S  RS485 @ 4800 -> HW-0519 -> RXD=D6  TXD=D5   (same pins as the
 *                                           soil bus on farm-node — one wiring
 *                                           story across the toolkit)
 *
 * ** NO DE PIN. ** The HW-0519 is auto-direction — it derives transmit enable
 * from TXD. Same rule as farm-node: never add one back.
 *
 * ** DEEP SLEEP NEEDS A JUMPER: D0 (GPIO16) -> RST. ** The ESP8266 wakes from
 * deep sleep by pulsing GPIO16 low into its own reset pin. Without the jumper
 * the node sleeps once and never wakes. WITH the jumper, USB flashing usually
 * FAILS (D0 fights the auto-reset circuit) — so the jumper goes on LAST, after
 * the firmware is flashed and proven, and comes off for any reflash.
 *
 * NO OTA, deliberately: the node is awake seconds per cycle — too short a
 * window to catch for a wireless flash. Reflash over USB with the jumper pulled.
 *
 * Board: NodeMCU 1.0 (ESP-12E Module). No libraries to install — the Modbus
 * frame and CRC are hand-rolled (copied from the proven farm-node.ino) so you
 * can see exactly what goes on the wire.
 *
 * Copy config.example.h to config.h and edit it before flashing.
 *
 *   arduino-cli compile --upload --fqbn esp8266:esp8266:nodemcuv2 \
 *       -p /dev/ttyUSB0 firmware/soil-node-sleep
 *   (compile --upload — plain `upload` flashes a STALE binary, devlog 2026-07-16)
 */
#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>
#include <SoftwareSerial.h>
#include "config.h"

// Fallbacks so an older config.h still compiles (same pattern as farm-node).
#ifndef SLEEP_MINUTES
#define SLEEP_MINUTES     10
#endif
#ifndef WIFI_TIMEOUT_S
#define WIFI_TIMEOUT_S    15
#endif
#ifndef SENSOR_PWR_PIN
#define SENSOR_PWR_PIN    -1
#endif
#ifndef SENSOR_WARMUP_MS
#define SENSOR_WARMUP_MS  500
#endif
#ifndef VBAT_ENABLE
#define VBAT_ENABLE       0
#endif
#ifndef VBAT_CAL
#define VBAT_CAL          1.00f
#endif
#ifndef VBAT_CUTOFF_V
#define VBAT_CUTOFF_V     3.30f
#endif

// --- soil bus (identical to farm-node's soil half) ---
#define SOIL_RX     D6     // GPIO12 <- HW-0519 RXD
#define SOIL_TX     D5     // GPIO14 -> HW-0519 TXD
#define SOIL_BAUD   4800   // THC-S default. NOT 9600 — that's the water probe.
#define SOIL_REG    0x0000 // 0=moisture /10 %, 1=temp /10 C SIGNED, 2=EC uS/cm
#define SENSOR_ADDR 1

SoftwareSerial soil(SOIL_RX, SOIL_TX);

unsigned long wokeAt = 0;   // millis() is ~0 at wake; kept explicit for clarity

uint16_t modbusCRC(const uint8_t *buf, uint8_t len) {
  uint16_t crc = 0xFFFF;
  for (uint8_t i = 0; i < len; i++) {
    crc ^= buf[i];
    for (uint8_t b = 0; b < 8; b++) crc = (crc & 1) ? (crc >> 1) ^ 0xA001 : (crc >> 1);
  }
  return crc;
}

/*
 * Read `count` registers from `start`. True ONLY on a CRC-valid frame — a bad
 * frame is no data, never partial data. Slides along the receive window for a
 * well-formed header rather than parsing from byte 0 (tolerates echo/turnaround
 * artifacts). Copied verbatim from the proven farm-node.ino.
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

// The first exchange after power-on can lose its header to the transceiver's
// TX->RX turnaround — and on this node the sensor is COLD at every wake, so
// the retry earns its keep every single cycle.
bool readWithRetry(SoftwareSerial &port, uint16_t start, uint16_t count,
                   uint16_t *out, uint8_t tries) {
  for (uint8_t t = 0; t < tries; t++) {
    if (readRegisters(port, start, count, out)) return true;
    delay(60);
  }
  return false;
}

// --- sensor power gating (optional — the FET upgrade in the guide) -----------
// With SENSOR_PWR_PIN unset (-1) these are no-ops and the sensor is powered
// whenever the node is. With the low-side FET fitted, the sensor only draws
// current while the node is awake — the difference between ~3 weeks and ~2
// months on a 1S3P holder.
void sensorPowerOn() {
  if (SENSOR_PWR_PIN < 0) return;
  pinMode(SENSOR_PWR_PIN, OUTPUT);
  digitalWrite(SENSOR_PWR_PIN, HIGH);      // N-FET gate high = sensor grounded = on
  delay(SENSOR_WARMUP_MS);                 // let the probe's own electronics settle
}
void sensorPowerOff() {
  if (SENSOR_PWR_PIN < 0) return;
  digitalWrite(SENSOR_PWR_PIN, LOW);
}

// --- battery gauge (optional) -------------------------------------------------
// Cell+ -> 100k resistor -> A0. The NodeMCU's own divider (220k/100k) plus that
// 100k puts a full 4.2 V cell right at the ADC's 1.0 V ceiling, so:
//   vbat = reading/1023 * 4.2, trimmed by VBAT_CAL against your multimeter.
// Drain through the chain is ~10 uA — irrelevant even asleep.
float readVbat() {
  long sum = 0;
  for (uint8_t i = 0; i < 8; i++) { sum += analogRead(A0); delay(5); }
  return (sum / 8) / 1023.0f * 4.2f * VBAT_CAL;
}

void goToSleep() {
  sensorPowerOff();
  Serial.printf("SLEEP  %d min  (awake %lu ms)\n", SLEEP_MINUTES, millis() - wokeAt);
  Serial.flush();
#if !BENCH_MODE
  // Shut the radio down CLEANLY and give it time to finish before sleeping.
  // deepSleep() entered mid-WiFi-teardown can hang some boards permanently
  // ("zombie mode" — asleep-looking, never wakes, only a power cycle recovers).
  // WiFi.disconnect(true) immediately before sleep is the classic trigger.
  WiFi.mode(WIFI_OFF);
  delay(100);
#endif
  // ESP.deepSleep() maxes out around 71 minutes (32-bit us timer wrapped in
  // uint64). Clamp rather than silently wrapping to a bogus interval.
  uint32_t mins = SLEEP_MINUTES > 60 ? 60 : SLEEP_MINUTES;
  ESP.deepSleep((uint64_t)mins * 60ULL * 1000000ULL);
  delay(100);   // deepSleep takes a moment to engage; never actually runs on
}

#if BENCH_MODE
bool postJSON(const char *, const String &) { return false; }
#else
void connectWiFi() {
  // WiFi.begin() was already called in setup() so association ran WHILE we were
  // reading the sensor. This just waits (bounded) for it to finish. If the base
  // station is down we still sleep on schedule — a node that waits forever for
  // WiFi is a node that flattens its cells against a dead hotspot.
  Serial.printf("WiFi: joining %s", WIFI_SSID);
  unsigned long deadline = millis() + (unsigned long)WIFI_TIMEOUT_S * 1000UL;
  while (WiFi.status() != WL_CONNECTED && millis() < deadline) {
    delay(250);
    Serial.print(".");
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println(" ok");
    Serial.println("  my ip   : " + WiFi.localIP().toString());
    Serial.println("  gateway : " + WiFi.gatewayIP().toString() + "   <- the phone");
  } else {
    Serial.println(" FAILED — sleeping anyway, will retry next wake");
  }
}

// An explicit POST_HOST wins; otherwise derive from the gateway. The phone
// running the hotspot IS our gateway — Android randomises the hotspot subnet,
// so a hardcoded IP goes stale silently. Same logic as farm-node.
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
  Serial.printf("POST %s: failed (%d) -> %s\n", path, code, url.c_str());
  return false;
}
#endif  // BENCH_MODE

// Build the reading. Same shape as farm-node's soil JSON (minus the valve —
// this node has none) plus the sleep-node extras: vbat and awake_ms.
String buildJson(bool ok, uint16_t *v, float vbat) {
  String json = String("{\"node\":\"") + NODE_ID_SOIL + "\"";
  if (ok) {
    float moisture = v[0] / 10.0f;
    float tempC    = (int16_t)v[1] / 10.0f;   // SIGNED — 0xFF9B is -10.1C, not 65435
    json += ",\"ok\":true"
            ",\"moisture_pct\":" + String(moisture, 1)
          + ",\"temp_c\":" + String(tempC, 1)
          + ",\"ec\":" + String(v[2]);
  } else {
    // Report the failure rather than staying silent — an explicit error says
    // "node alive, probe isn't", which is a different repair job to a flat cell.
    json += ",\"ok\":false,\"error\":\"no valid modbus frame\"";
  }
  if (VBAT_ENABLE) {
    json += ",\"vbat\":" + String(vbat, 2);
    if (vbat < VBAT_CUTOFF_V) json += ",\"low_battery\":true";
  }
#if !BENCH_MODE
  if (WiFi.status() == WL_CONNECTED) json += ",\"rssi\":" + String(WiFi.RSSI());
#endif
  json += ",\"sleep_min\":" + String(SLEEP_MINUTES)
        + ",\"awake_ms\":" + String(millis() - wokeAt) + "}";
  return json;
}

void setup() {
  wokeAt = millis();
  Serial.begin(115200);
  delay(50);
  Serial.println(F("\n\nFarmers IoT Toolkit — deep-sleep soil node"));

#if BENCH_MODE
  // Radio off, and mean it: the SDK auto-connects to the last known AP on boot
  // whether you asked or not (~80 mA on a rail already feeding a boost).
  WiFi.mode(WIFI_OFF);
  WiFi.forceSleepBegin();
  Serial.println(F("BENCH MODE — WiFi off, no sleep, polling every 2s, serial only."));
  Serial.println(F("Set BENCH_MODE 0 in config.h once the probe reads reliably.\n"));
  sensorPowerOn();
  soil.begin(SOIL_BAUD);
#else
  // Start associating FIRST, then read the sensor while the radio negotiates —
  // the two overlap, and every second shaved off awake time is battery.
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  sensorPowerOn();
  soil.begin(SOIL_BAUD);

  uint16_t v[3];
  bool ok = readWithRetry(soil, SOIL_REG, 3, v, 5);
  if (ok) {
    Serial.printf("SOIL   moisture=%.1f %%   temp=%.1f C   EC=%u uS/cm\n",
                  v[0] / 10.0f, (int16_t)v[1] / 10.0f, v[2]);
  } else {
    Serial.println(F("SOIL   FAILED — check 5V on brown/black, and yellow=A blue=B"));
  }

  float vbat = VBAT_ENABLE ? readVbat() : 0.0f;
  if (VBAT_ENABLE) Serial.printf("VBAT   %.2f V\n", vbat);

  connectWiFi();
  const String json = buildJson(ok, v, vbat);
  Serial.println(json);
  postJSON(POST_PATH_SOIL, json);

  // Below the cutoff, park for good: POST already carried the low_battery flag,
  // now sleep INDEFINITELY (wake = physical reset after a cell swap). This is
  // firmware-level protection only — the board still leaks a few mA asleep, so
  // swap promptly once the dashboard shows low_battery. There is no BMS here.
  if (VBAT_ENABLE && vbat > 0.5f && vbat < VBAT_CUTOFF_V) {
    Serial.printf("VBAT   %.2f V < %.2f V cutoff — sleeping until cells are swapped\n",
                  vbat, VBAT_CUTOFF_V);
    sensorPowerOff();
    Serial.flush();
    WiFi.mode(WIFI_OFF);   // same clean shutdown as goToSleep() — see note there
    delay(100);
    ESP.deepSleep(0);   // forever — only a reset wakes it
  }

  goToSleep();
#endif
}

void loop() {
#if BENCH_MODE
  uint16_t v[3];
  if (readWithRetry(soil, SOIL_REG, 3, v, 5)) {
    Serial.printf("SOIL   moisture=%.1f %%   temp=%.1f C   EC=%u uS/cm",
                  v[0] / 10.0f, (int16_t)v[1] / 10.0f, v[2]);
  } else {
    Serial.print(F("SOIL   FAILED — check 5V on brown/black, and yellow=A blue=B"));
  }
  if (VBAT_ENABLE) Serial.printf("   vbat=%.2f V", readVbat());
  Serial.println();
  delay(2000);
#endif
  // Normal mode never reaches loop() — setup() ends in ESP.deepSleep().
}
