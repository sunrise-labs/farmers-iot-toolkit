#!/usr/bin/env bun
/**
 * poll-water.ts — QDY30A water-level RS485 (Modbus RTU) bench poller.
 *
 * Same adapter-tolerant approach as poll-soil.ts (see that file / devlog.md for
 * WHY mbpoll fails here): send request, read a generous window, resync on a valid
 * frame, validate CRC before trusting it, retry past turnaround corruption.
 *
 * Reads the whole config block 0x0000–0x0006 so you can CONFIRM the community
 * register map against your actual unit (Step 2 of docs/bench/02-...). The register
 * semantics are community-sourced, not from the manual — trust the ruler, not this.
 *
 * Usage:
 *   bun tools/poll-water.ts [device] [--once]
 *
 * Sensor facts: 9600 8N1 (NOT 4800 like soil), slave address 1.
 *   0x0000 addr · 0x0001 baud code (3=9600) · 0x0002 unit code · 0x0003 decimals
 *   0x0004 measured value (int16 SIGNED) ← the level · 0x0005 zero · 0x0006 range
 */
import { openSync, readSync, writeSync } from "node:fs";
import { execSync } from "node:child_process";

const argv = process.argv.slice(2);
const once = argv.includes("--once");
const DEV = argv.find((a) => !a.startsWith("--")) ?? "/dev/ttyUSB0";

execSync(`stty -F ${DEV} 9600 cs8 -cstopb -parenb -icanon -echo -isig min 0 time 3`);

function crc16(buf: number[], len: number): number {
  let crc = 0xffff;
  for (let i = 0; i < len; i++) {
    crc ^= buf[i];
    for (let b = 0; b < 8; b++) crc = crc & 1 ? (crc >> 1) ^ 0xa001 : crc >> 1;
  }
  return crc;
}

// Read 7 holding registers (0x0000–0x0006) from slave 1. CRC computed, not hardcoded.
function buildReq(): Buffer {
  const body = [0x01, 0x03, 0x00, 0x00, 0x00, 0x07];
  const c = crc16(body, body.length);
  return Buffer.from([...body, c & 0xff, (c >> 8) & 0xff]);
}
const REQ = buildReq();

const UNITS: Record<number, string> = {
  0x11: "cm", 0x12: "m", 0x13: "kPa", 0x14: "Bar", 0x15: "PSI",
};

// Separate read and write handles. At 9600 a single handle loses the reply header
// to the adapter's TX→RX turnaround; a dedicated always-in-RX reader fd avoids it.
const fdW = openSync(DEV, "w");
const fdR = openSync(DEV, "r");
const rbuf = Buffer.alloc(64);

/** One exchange → validated 19-byte frame (01 03 0E <14 data> <crc>), or null. */
function exchange(): number[] | null {
  writeSync(fdW, REQ);
  const acc: number[] = [];
  const deadline = Date.now() + 400;
  while (Date.now() < deadline && acc.length < 40) {
    let n = 0;
    try { n = readSync(fdR, rbuf, 0, rbuf.length, null); } catch { n = 0; }
    for (let i = 0; i < n; i++) acc.push(rbuf[i]);
  }
  for (let i = 0; i + 19 <= acc.length; i++) {
    if (acc[i] === 0x01 && acc[i + 1] === 0x03 && acc[i + 2] === 0x0e) {
      const f = acc.slice(i, i + 19);
      if (crc16(f, 17) === (f[17] | (f[18] << 8))) return f;
    }
  }
  return null;
}

function reg(f: number[], n: number): number {
  const hi = f[3 + n * 2], lo = f[4 + n * 2];
  return (hi << 8) | lo;
}

function poll(maxTries = 5): void {
  for (let t = 0; t < maxTries; t++) {
    const f = exchange();
    if (!f) continue;
    const addr = reg(f, 0);
    const baud = reg(f, 1);
    const unit = reg(f, 2);
    const dec = reg(f, 3);
    const level = ((reg(f, 4) << 16) >> 16); // signed
    const zero = reg(f, 5);
    const range = reg(f, 6);
    const unitName = UNITS[unit] ?? `0x${unit.toString(16)}`;
    console.log(
      `addr=${addr} baudCode=${baud} unit=${unitName} decimals=${dec} | ` +
        `LEVEL(0x0004)=${level} (raw) zero=${zero} range=${range}`,
    );
    return;
  }
  console.log(`--  no valid frame after ${maxTries} tries`);
}

if (once) {
  poll();
} else {
  console.log(`Polling ${DEV} @ 9600 8N1 — Ctrl-C to stop. Watch LEVEL as you dunk the probe.`);
  poll();
  setInterval(() => poll(), 1000);
}
