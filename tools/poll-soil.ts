#!/usr/bin/env bun
/**
 * poll-soil.ts — Soil THC-S RS485 (Modbus RTU) bench poller.
 *
 * WHY THIS EXISTS: `mbpoll` reports "Invalid CRC" against this sensor when used
 * with the cheap FT232RL + SN75176 auto-direction USB-RS485 adapter. The sensor
 * is fine — the adapter echoes/clips bytes when a single fd both transmits AND
 * reads. Proof: a separate listener (`cat /dev/ttyUSB0`) captures a perfectly
 * clean frame while `mbpoll` on the same handle fails. See devlog.md 2026-07-15.
 *
 * This poller sidesteps it: send request, read a generous window, then resync on
 * a valid `01 03 06 …` frame and validate the CRC before trusting it.
 *
 * Usage:
 *   bun tools/poll-soil.ts [device] [--once]
 *   bun tools/poll-soil.ts                 # /dev/ttyUSB0, poll every 1s
 *   bun tools/poll-soil.ts /dev/ttyUSB1    # different port
 *   bun tools/poll-soil.ts --once          # single reading, then exit
 *
 * Sensor facts (confirmed on the bench): 4800 8N1, slave address 1.
 *   reg0 = moisture (0.1 %)   reg1 = temperature (0.1 °C, signed)   reg2 = EC (µS/cm)
 */
import { openSync, readSync, writeSync } from "node:fs";
import { execSync } from "node:child_process";

const argv = process.argv.slice(2);
const once = argv.includes("--once");
const DEV = argv.find((a) => !a.startsWith("--")) ?? "/dev/ttyUSB0";

// 4800 8N1, raw, non-canonical, 0.3 s read timeout (time = 3 tenths, min = 0)
execSync(`stty -F ${DEV} 4800 cs8 -cstopb -parenb -icanon -echo -isig min 0 time 3`);

// Modbus RTU: read 3 holding registers from 0x0000 of slave 1. CRC precomputed.
const REQ = Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x03, 0x05, 0xcb]);

function crc16(buf: number[], len: number): number {
  let crc = 0xffff;
  for (let i = 0; i < len; i++) {
    crc ^= buf[i];
    for (let b = 0; b < 8; b++) crc = crc & 1 ? (crc >> 1) ^ 0xa001 : crc >> 1;
  }
  return crc;
}

const fd = openSync(DEV, "r+");
const rbuf = Buffer.alloc(64);

/** One request/response exchange. Returns a validated frame, or null. */
function exchange(): number[] | null {
  writeSync(fd, REQ);
  const acc: number[] = [];
  const deadline = Date.now() + 400;
  while (Date.now() < deadline && acc.length < 24) {
    let n = 0;
    try { n = readSync(fd, rbuf, 0, rbuf.length, null); } catch { n = 0; }
    for (let i = 0; i < n; i++) acc.push(rbuf[i]);
  }
  // Resync: find a well-formed 01 03 06 <6 bytes> <crc lo> <crc hi> and verify CRC.
  // Requiring byte[2] === 0x06 skips any echoed request (whose byte[2] is 0x00).
  for (let i = 0; i + 11 <= acc.length; i++) {
    if (acc[i] === 0x01 && acc[i + 1] === 0x03 && acc[i + 2] === 0x06) {
      const f = acc.slice(i, i + 11);
      if (crc16(f, 9) === (f[9] | (f[10] << 8))) return f;
    }
  }
  return null;
}

/**
 * Poll with internal retries. The first exchange after the port opens (and,
 * occasionally, later ones) can have its frame header eaten by the adapter's
 * TX→RX turnaround. Retrying a few times reliably lands a clean frame.
 */
function poll(maxTries = 5): void {
  for (let t = 0; t < maxTries; t++) {
    const f = exchange();
    if (f) {
      const moist = (f[3] << 8) | f[4];
      const temp = (((f[5] << 8) | f[6]) << 16) >> 16; // sign-extend 16-bit
      const ec = (f[7] << 8) | f[8];
      const hex = f.map((x) => x.toString(16).padStart(2, "0")).join(" ");
      console.log(
        `OK  moisture=${(moist / 10).toFixed(1)}%  temp=${(temp / 10).toFixed(1)}°C  EC=${ec} µS/cm   [${hex}]`,
      );
      return;
    }
  }
  console.log(`--  no valid frame after ${maxTries} tries`);
}

if (once) {
  poll();
} else {
  console.log(`Polling ${DEV} @ 4800 8N1 — Ctrl-C to stop`);
  poll();
  setInterval(() => poll(), 1000);
}
