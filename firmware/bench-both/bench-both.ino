/*
 * bench-both.ino — Farmers IoT Toolkit, BENCH TOOL (not a module deliverable)
 *
 * Reads BOTH sensors from one ESP8266 and prints decoded values plus the raw
 * frame. No WiFi. The point is to prove the two-bus wiring in one shot:
 *
 *   water  QDY30A  RS485 @ 9600 -> HW-0519 #1 -> RXD=D5  TXD=D6   (probe needs 18V)
 *   soil   THC-S   RS485 @ 4800 -> HW-0519 #2 -> RXD=D7  TXD=D1   (probe runs on 5V)
 *
 * Two SEPARATE buses, one transceiver each. That's what lets both sensors keep
 * slave address 1 AND run different bauds with no register writes on either.
 * Proven on hardware 2026-07-16: both read simultaneously, CRC-valid.
 *
 * ** NO DE PIN. ** Both boards are HW-0519 auto-direction — they derive transmit
 * enable from TXD via an onboard 74HC04. water-level.ino still toggles D1 as DE,
 * which was harmless when D1 was a disconnected pin, but D1 is now soil's TXD:
 * driving it would clamp the soil board's driver onto the soil bus and the sensor
 * could never reply. Do not add a DE pin back on a combined node.
 *
 * NOTE ON ECHO: water-level.ino's resync assumes the auto-direction board echoes
 * our transmitted bytes back ahead of the reply. Measured here, neither board does
 * — replies arrive at exactly frameLen with no echo prefix. The resync is still
 * correct (it just finds the frame at offset 0), but "no echo" is NOT a sign the
 * board is dead. Don't diagnose with it.
 *
 * Board: NodeMCU 1.0 (ESP-12E Module)
 *   arduino-cli compile --upload --fqbn esp8266:esp8266:nodemcuv2 \
 *       -p /dev/ttyUSB0 firmware/bench-both
 *   (compile --upload — plain `upload` flashes a STALE binary, devlog 2026-07-16)
 */
#include <ESP8266WiFi.h>
#include <SoftwareSerial.h>

#define WATER_RX   D5
#define WATER_TX   D6
#define WATER_BAUD 9600
#define WATER_REG  0x0004    // level, int16 SIGNED, 1 count = 1 mm
#define WATER_DRY_OFFSET 26  // ours read ~26 in air; re-measure yours, docs/01 Step 4

#define SOIL_RX    D7
#define SOIL_TX    D1
#define SOIL_BAUD  4800      // NOT 9600 — that's the water probe
#define SOIL_REG   0x0000    // 0=moisture /10 %, 1=temp /10 C SIGNED, 2=EC uS/cm

SoftwareSerial water(WATER_RX, WATER_TX);
SoftwareSerial soil(SOIL_RX, SOIL_TX);

uint16_t modbusCRC(const uint8_t *buf, uint8_t len) {
  uint16_t crc = 0xFFFF;
  for (uint8_t i = 0; i < len; i++) {
    crc ^= buf[i];
    for (uint8_t b = 0; b < 8; b++) crc = (crc & 1) ? (crc >> 1) ^ 0xA001 : (crc >> 1);
  }
  return crc;
}

/*
 * Read `count` registers from `start` on `port`. True only on a CRC-valid frame —
 * fails closed, so a bad frame is no data, never partial data.
 *
 * Slides along the receive window looking for a well-formed header rather than
 * parsing from byte 0. Costs nothing when there's no echo and saves you when there
 * is (the FT232 adapter definitely does echo — devlog 2026-07-15).
 */
bool readRegisters(SoftwareSerial &port, uint16_t start, uint16_t count,
                   uint16_t *out, uint8_t *rawBuf, uint8_t *rawLen) {
  uint8_t req[8] = { 1, 0x03, (uint8_t)(start >> 8), (uint8_t)(start & 0xFF),
                     (uint8_t)(count >> 8), (uint8_t)(count & 0xFF), 0, 0 };
  uint16_t crc = modbusCRC(req, 6);
  req[6] = crc & 0xFF;          // CRC little-endian on the wire
  req[7] = crc >> 8;

  while (port.available()) port.read();   // drop stale bytes
  port.write(req, 8);
  port.flush();

  const uint8_t frameLen = 5 + count * 2;
  uint8_t n = 0;
  unsigned long deadline = millis() + 300;
  while (millis() < deadline && n < 48) {
    if (port.available()) {
      rawBuf[n++] = port.read();
      if (n >= frameLen + 8) break;
    }
  }
  *rawLen = n;
  if (n < frameLen) return false;

  for (uint8_t i = 0; i + frameLen <= n; i++) {
    if (rawBuf[i] != 1 || rawBuf[i+1] != 0x03 || rawBuf[i+2] != count * 2) continue;
    uint16_t rxCRC = rawBuf[i+frameLen-2] | (rawBuf[i+frameLen-1] << 8);
    if (rxCRC != modbusCRC(rawBuf + i, frameLen - 2)) continue;
    for (uint16_t r = 0; r < count; r++)
      out[r] = (rawBuf[i + 3 + r*2] << 8) | rawBuf[i + 4 + r*2];
    return true;
  }
  return false;
}

// Retry — the first exchange after idle can lose its header to the transceiver's
// TX->RX turnaround. Known, harmless, just retry (devlog 2026-07-15).
bool readWithRetry(SoftwareSerial &port, uint16_t start, uint16_t count,
                   uint16_t *out, uint8_t *rawBuf, uint8_t *rawLen, uint8_t tries) {
  for (uint8_t t = 0; t < tries; t++) {
    if (readRegisters(port, start, count, out, rawBuf, rawLen)) return true;
    delay(60);
  }
  return false;
}

void printRaw(uint8_t *b, uint8_t n) {
  Serial.printf("   [n=%d]", n);
  for (uint8_t i = 0; i < n; i++) Serial.printf(" %02X", b[i]);
  Serial.println();
}

void setup() {
  Serial.begin(115200);
  // The SDK auto-connects to the last known AP on boot unless you kill the radio.
  // That costs ~80mA with 300mA spikes on a USB rail already feeding a boost, and
  // steals interrupts from two bit-banged serial buses. Off, and mean it.
  WiFi.mode(WIFI_OFF);
  WiFi.forceSleepBegin();
  delay(1);
  water.begin(WATER_BAUD);
  soil.begin(SOIL_BAUD);
  delay(500);
  Serial.println(F("\n\nFarmers IoT Toolkit — BENCH: both sensors, one ESP8266"));
  Serial.println(F("water D5/D6 @9600   soil D7/D1 @4800   WiFi off, no DE pin"));
  Serial.println(F("MAKE IT MOVE: dip the water probe, squeeze the soil probe."));
  Serial.println(F("A number that won't move isn't a reading."));
  Serial.println(F("-------------------------------------------------------------"));
}

void loop() {
  uint8_t raw[48], n;
  uint16_t v[3];

  if (readWithRetry(water, WATER_REG, 1, v, raw, &n, 5)) {
    int16_t r = (int16_t)v[0];          // SIGNED — below-zero readings are real
    Serial.printf("WATER  raw=%-6d depth=%d mm\n", r, r - WATER_DRY_OFFSET);
  } else {
    Serial.print(F("WATER  FAILED"));
    printRaw(raw, n);
  }

  if (readWithRetry(soil, SOIL_REG, 3, v, raw, &n, 5)) {
    Serial.printf("SOIL   moisture=%.1f %%   temp=%.1f C   EC=%u uS/cm\n",
                  v[0] / 10.0f, (int16_t)v[1] / 10.0f, v[2]);
  } else {
    Serial.print(F("SOIL   FAILED"));
    printRaw(raw, n);
  }

  Serial.println();
  delay(2000);
}
