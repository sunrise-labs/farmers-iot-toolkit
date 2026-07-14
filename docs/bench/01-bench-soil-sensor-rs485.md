# Bench Test — Soil Sensor (THC-S) over RS485 → ESP8266

> **Prerequisite:** [00-bench-rig.md](00-bench-rig.md) — shared wiring, grounding, and the MAX485 hookup.
> **Sensor:** CWT-Soil-THC-S · **Source:** `hardware/Manual - Soil Sensor THC-S (3pin probe).pdf`
> **Do this one first.** It runs straight off your pack, and it proves your whole RS485 chain works.

## Why this is the easy one

The THC-S accepts **DC 4.5–30 V**. Your 3S2P pack swings 9.0–12.6 V across its discharge. That sits inside the sensor's range at every state of charge, with margin at both ends. **No boost converter, no buck, no bench 12 V needed — pack straight to the sensor.**

Everything you learn here (A/B orientation, DE/RE timing, CRC, framing) transfers directly to the water sensor, which is fussier.

## Sensor facts, from the manual

**Wire colours:**

| Wire | Function |
|---|---|
| Brown | Power + (DC 4.5–30 V) |
| Black | Power − |
| Yellow | RS485 **A+** |
| Blue | RS485 **B−** |

**Serial defaults:** `4800 baud, 8N1`, slave address `1`, Modbus RTU.

Note **4800**, not 9600. It's the single most common reason a first read returns nothing.

**Register map** (function code `0x03`):

| Register | Value | Scaling |
|---|---|---|
| `0x0000` | Humidity | ÷10 → %RH |
| `0x0001` | Temperature | ÷10 → °C, **signed** (two's complement) |
| `0x0002` | Conductivity (EC) | µS/cm, no scaling |
| `0x0003` | Salinity | — |
| `0x0004` | TDS | — |

Temperature is signed. `0xFF9B` = −101 = **−10.1 °C**, not 65435. Parse it into an `int16_t` or you'll get nonsense the first frosty morning.

## Step 0 — Read it from the laptop first

Sensor → FT232 USB-RS485 adapter → laptop. Sensor powered from the pack (brown to pack +, black to pack −).

| Sensor | FT232 |
|---|---|
| Yellow (A+) | A |
| Blue (B−) | B |
| Black (−) | GND |

```bash
# read 3 holding registers from addr 1 @ 4800 8N1
mbpoll -m rtu -a 1 -b 4800 -P none -d 8 -s 1 -t 4 -r 1 -c 3 /dev/ttyUSB0
```

`-t 4 -r 1` means "holding registers, starting at 4x reference 1" — that's register `0x0000`. mbpoll counts from 1; the manual counts from 0.

Expect something like:

```
[1]: 658      ->  65.8 %RH
[2]: 210      ->  21.0 °C
[3]: 1000     ->  1000 µS/cm
```

Squeeze the probe in a damp hand — humidity should climb within a few seconds.

**Nothing back?** Swap yellow and blue. A/B reversal is the #1 RS485 fault and it's harmless to try — you cannot damage anything by swapping them. Then try `-b 9600` in case someone reconfigured it.

Only once this works do you touch the ESP8266.

## Step 1 — Wire the ESP8266

Per [00-bench-rig.md](00-bench-rig.md): MAX485 `RO→D5`, `DI→D6`, `DE+RE→D1`, `VCC→3V3`, `GND→GND`.

Then the sensor onto the RS485 bus:

| Sensor | MAX485 |
|---|---|
| Yellow (A+) | A |
| Blue (B−) | B |
| Brown (+) | pack + |
| Black (−) | pack − **and the common ground rail** |

ESP8266 powered by USB from your laptop. **Pack negative must join the ESP's GND** — see the ground rule in the rig guide.

## Step 2 — Firmware

Arduino IDE → Boards Manager → `esp8266` → board **NodeMCU 1.0 (ESP-12E Module)**. No libraries to install; the Modbus frame and CRC are hand-rolled below so you can see exactly what's on the wire.

```cpp
#include <SoftwareSerial.h>

// --- pins (see 00-bench-rig.md) ---
#define RS485_RX  D5   // GPIO14  <- MAX485 RO
#define RS485_TX  D6   // GPIO12  -> MAX485 DI
#define RS485_DE  D1   // GPIO5   -> MAX485 DE+RE (tied together)

#define SENSOR_ADDR  1
#define RS485_BAUD   4800   // THC-S default. Not 9600.

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

// Read `count` registers starting at `start`. Returns true on a good frame.
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
  unsigned long deadline = millis() + 1000;

  while (got < expected && millis() < deadline) {
    if (rs485.available()) resp[got++] = rs485.read();
  }

  if (got < expected)            { Serial.println("  timeout"); return false; }
  if (resp[0] != SENSOR_ADDR)    { Serial.println("  wrong addr"); return false; }
  if (resp[1] & 0x80)            { Serial.printf("  modbus exception 0x%02X\n", resp[2]); return false; }

  uint16_t rxCRC = resp[expected-2] | (resp[expected-1] << 8);
  if (rxCRC != modbusCRC(resp, expected-2)) { Serial.println("  CRC fail"); return false; }

  for (uint16_t i = 0; i < count; i++) {
    out[i] = (resp[3 + i*2] << 8) | resp[4 + i*2];
  }
  return true;
}

void setup() {
  Serial.begin(115200);         // debug, over USB
  pinMode(RS485_DE, OUTPUT);
  digitalWrite(RS485_DE, LOW);  // default to listening
  rs485.begin(RS485_BAUD);
  delay(500);
  Serial.println("\n\nTHC-S soil sensor bench test");
}

void loop() {
  uint16_t r[3];
  if (readRegisters(0x0000, 3, r)) {
    float humidity = r[0] / 10.0f;
    float tempC    = (int16_t)r[1] / 10.0f;   // signed! see note above
    uint16_t ec    = r[2];

    Serial.printf("humidity %.1f %%RH | temp %.1f C | EC %u uS/cm\n",
                  humidity, tempC, ec);
  }
  delay(2000);
}
```

## Step 3 — Verify it's real

Serial monitor at **115200**. You should see a line every 2 seconds.

Do not trust a plausible-looking number. Make it *move*:

- **Squeeze the probe in a damp hand** → humidity rises within a few seconds (manual says ≤4 s response).
- **Cup the probe in your palm** → temperature drifts toward body temp (≤15 s response).
- **Probe in a glass of tap water** → EC jumps to the hundreds or low thousands µS/cm. Distilled water reads near zero. Add a pinch of salt → EC climbs sharply.

If a number sits perfectly constant while you do this, it isn't a reading — it's a stale buffer or a parse bug.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `timeout`, every poll | A/B swapped | Swap yellow and blue. Harmless to try. |
| `timeout`, every poll | Wrong baud | Sensor default is **4800**. Try 9600 if someone changed it. |
| `timeout`, and Step 0 also failed | Sensor unpowered | Meter across brown/black — expect pack voltage. |
| Garbage / intermittent CRC fails | **No common ground** | Pack − must tie to ESP GND. The classic. |
| `modbus exception 0x01` | Illegal function | You used `0x30` from the manual's table. It's a typo — use `0x03`. |
| Temperature reads ~6500 | Parsed unsigned | Cast to `int16_t`. `0xFF9B` = −10.1 °C. |
| Humidity always 0, EC always 0 | Probe in air | Air is genuinely ~0. Put it in soil or a damp hand. |
| ESP won't boot with sensor attached | Wired to a strap pin | Keep off GPIO0/2/15. Use D5/D6/D1. |
| Nothing on serial monitor | Baud mismatch | Monitor at **115200**. |

## Once it works

You now have a validated RS485 chain — MAX485 wiring, DE/RE timing, CRC, framing, all proven against a sensor with a known-good register map. Take that straight to **[the water level sensor](02-bench-water-level-rs485.md)**, where the register map is *not* documented and you'll have to find it. Much easier to hunt for registers when you already trust everything underneath.
