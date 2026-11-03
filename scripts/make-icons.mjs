// 外部ライブラリなしでホーム画面アイコン(藍地に赤ペンの丸)のPNGを生成する
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

const INK = [22, 38, 58];
const RED = [240, 84, 104];
const PAPER = [233, 238, 242];

function makeIcon(size) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  const c = size / 2;
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  for (let y = 0; y < size; y++) {
    const row = y * (size * 3 + 1);
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - c;
      const dy = y + 0.5 - c;
      const angle = Math.atan2(dy, dx);
      // 手書きの丸に見えるよう半径と太さを角度で揺らす
      const r = size * (0.27 + 0.012 * Math.sin(angle * 2 + 0.6));
      const width = size * (0.032 + 0.012 * Math.sin(angle + 1));
      const d = Math.abs(Math.hypot(dx, dy) - r);
      const ring = Math.max(0, Math.min(1, width - d + 0.5));
      // 丸の中央に原稿の行を表す短い線
      const inLine = Math.abs(dx) < size * 0.012 && Math.abs(dy) < size * 0.12;
      let color = ring > 0 ? mix(INK, RED, ring) : INK;
      if (inLine) color = PAPER;
      raw.set(color, row + 1 + x * 3);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('public', { recursive: true });
writeFileSync('public/icon-192.png', makeIcon(192));
writeFileSync('public/icon-512.png', makeIcon(512));
writeFileSync('public/apple-touch-icon.png', makeIcon(180));
