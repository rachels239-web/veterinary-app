// Generates the PWA icons as PNGs with no external dependencies.
//
// There is no image tooling in this environment, so this writes PNGs directly:
// signature, IHDR, a zlib-deflated IDAT of raw RGBA scanlines, and IEND.
//
//   node tools/make-icons.mjs

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const TEAL = [14, 124, 114];
const WHITE = [255, 255, 255];

/* ---------- PNG encoding ---------- */

const crcTable = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // colour type: RGBA
  ihdr[10] = 0;  // deflate
  ihdr[11] = 0;  // adaptive filtering
  ihdr[12] = 0;  // no interlace

  // Each scanline is prefixed with its filter type byte (0 = none).
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---------- the mark: a paw print on a rounded square ---------- */

/** Signed test for a rounded square, in 0–1 coordinates. */
function inRoundedSquare(x, y, inset, radius) {
  const lo = inset;
  const hi = 1 - inset;
  if (x < lo || x > hi || y < lo || y > hi) return false;
  const dx = Math.max(lo + radius - x, 0, x - (hi - radius));
  const dy = Math.max(lo + radius - y, 0, y - (hi - radius));
  return dx * dx + dy * dy <= radius * radius;
}

const inEllipse = (x, y, cx, cy, rx, ry) =>
  ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;

/** Four toes and a pad, positioned in 0–1 space relative to the icon face. */
function inPaw(x, y, scale, offsetY) {
  const sx = 0.5 + (x - 0.5) / scale;
  const sy = 0.5 + (y - 0.5 - offsetY) / scale;
  const toes = [
    [0.285, 0.345, 0.088, 0.108],
    [0.428, 0.275, 0.094, 0.115],
    [0.578, 0.275, 0.094, 0.115],
    [0.720, 0.345, 0.088, 0.108],
  ];
  for (const [cx, cy, rx, ry] of toes) if (inEllipse(sx, sy, cx, cy, rx, ry)) return true;
  // The main pad: a wide ellipse with the top corners pulled in.
  return inEllipse(sx, sy, 0.5, 0.625, 0.215, 0.185);
}

/**
 * Render one icon. `padding` shrinks the artwork for maskable icons, which get
 * cropped to a circle by the launcher.
 */
function renderIcon(size, { padding = 0, squareBackground = false } = {}) {
  const rgba = Buffer.alloc(size * size * 4);
  const SS = 3; // supersample factor for smooth edges
  const inset = padding;
  const radius = squareBackground ? 0 : 0.21 * (1 - 2 * padding);
  const pawScale = 1 / (1 - 2 * padding) * 1.04;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let bg = 0;
      let fg = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (px + (sx + 0.5) / SS) / size;
          const y = (py + (sy + 0.5) / SS) / size;
          if (!inRoundedSquare(x, y, inset, radius)) continue;
          bg++;
          if (inPaw(x, y, pawScale, 0)) fg++;
        }
      }
      const total = SS * SS;
      const i = (py * size + px) * 4;
      if (bg === 0) continue;
      const alpha = Math.round((bg / total) * 255);
      const mix = fg / bg; // how much of the covered area is paw
      for (let c = 0; c < 3; c++) {
        rgba[i + c] = Math.round(TEAL[c] * (1 - mix) + WHITE[c] * mix);
      }
      rgba[i + 3] = alpha;
    }
  }
  return encodePng(size, size, rgba);
}

/* ---------- write them ---------- */

mkdirSync('icons', { recursive: true });

const outputs = [
  ['icons/icon-192.png', renderIcon(192)],
  ['icons/icon-512.png', renderIcon(512)],
  // Maskable icons need the artwork inside the safe zone, on a full bleed square.
  ['icons/icon-maskable-512.png', renderIcon(512, { padding: 0.14, squareBackground: true })],
  // iOS does not honour transparency or rounding, so give it a full square.
  ['icons/apple-touch-icon.png', renderIcon(180, { squareBackground: true })],
  ['icons/favicon-32.png', renderIcon(32)],
];

for (const [path, buf] of outputs) {
  writeFileSync(path, buf);
  console.log(`${path}  ${(buf.length / 1024).toFixed(1)} kB`);
}
