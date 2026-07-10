// Minimal, dependency-free PNG codec + pixel utilities for the quality judges.
//
// Decodes 8-bit truecolor PNGs (colorType 2 = RGB, colorType 6 = RGBA),
// non-interlaced — the only shapes Remotion stills and `remotion ffmpeg`
// extracts produce in this repo. Anything else fails loudly rather than
// returning wrong pixels. Also carries a tiny filter-0 encoder so the judges
// (and their tests) can synthesize known images without a native dependency.
//
// Shared by scripts/judge-demo-pacing.mjs (frame-diff dead-air detection) and
// scripts/judge-palette.mjs (brand-compliance color sampling). Unit-tested in
// scripts/lib/png.test.mjs (node --test) via an encode -> decode round trip and
// a hand-built filter sweep.
import zlib from 'node:zlib';

const SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

// Decode a PNG Buffer into {width, height, data} where data is a Uint8Array of
// RGBA bytes (row-major, alpha=255 for RGB sources).
export function decodePng(buf) {
  for (let i = 0; i < 8; i++) {
    if (buf[i] !== SIG[i]) throw new Error('png: bad PNG signature');
  }
  let pos = 8;
  let width;
  let height;
  let bitDepth;
  let colorType;
  let interlace;
  const idat = [];
  while (pos + 8 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    pos += 4;
    const type = buf.toString('ascii', pos, pos + 4);
    pos += 4;
    const data = buf.subarray(pos, pos + len);
    pos += len + 4; // skip chunk data + CRC
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'IDAT') {
      idat.push(Buffer.from(data));
    } else if (type === 'IEND') {
      break;
    }
  }
  if (width === undefined) throw new Error('png: no IHDR chunk');
  if (bitDepth !== 8) throw new Error(`png: unsupported bit depth ${bitDepth} (need 8)`);
  if (interlace !== 0) throw new Error('png: interlaced PNGs are not supported');
  let channels;
  if (colorType === 2) channels = 3;
  else if (colorType === 6) channels = 4;
  else throw new Error(`png: unsupported color type ${colorType} (need 2 or 6)`);

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const bpp = channels;
  const out = new Uint8Array(width * height * 4);
  let prev = new Uint8Array(stride);
  let rpos = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[rpos++];
    const line = new Uint8Array(stride);
    for (let x = 0; x < stride; x++) {
      const rawByte = raw[rpos++];
      const a = x >= bpp ? line[x - bpp] : 0;
      const b = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      let val;
      switch (filter) {
        case 0:
          val = rawByte;
          break;
        case 1:
          val = rawByte + a;
          break;
        case 2:
          val = rawByte + b;
          break;
        case 3:
          val = rawByte + ((a + b) >> 1);
          break;
        case 4:
          val = rawByte + paeth(a, b, c);
          break;
        default:
          throw new Error(`png: unknown filter type ${filter} on row ${y}`);
      }
      line[x] = val & 0xff;
    }
    for (let x = 0; x < width; x++) {
      const si = x * channels;
      const di = (y * width + x) * 4;
      out[di] = line[si];
      out[di + 1] = line[si + 1];
      out[di + 2] = line[si + 2];
      out[di + 3] = channels === 4 ? line[si + 3] : 255;
    }
    prev = line;
  }
  return {width, height, data: out};
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

// Encode RGBA bytes to a PNG Buffer (filter type 0 on every scanline). Not
// size-optimized; used only to synthesize test/probe images.
export function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    for (let x = 0; x < stride; x++) {
      raw[y * (stride + 1) + 1 + x] = rgba[y * stride + x];
    }
  }
  const idat = zlib.deflateSync(raw);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  return Buffer.concat([
    Buffer.from(SIG),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Build a solid RGBA image, handy for synthetic test/probe frames.
export function solidImage(width, height, {r, g, b, a = 255}) {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = a;
  }
  return {width, height, data};
}

// --- pixel utilities -------------------------------------------------------

// Mean absolute per-channel difference over RGB (alpha ignored), 0..255.
export function meanAbsDelta(a, b) {
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error(
      `meanAbsDelta: dimension mismatch ${a.width}x${a.height} vs ${b.width}x${b.height}`,
    );
  }
  const da = a.data;
  const db = b.data;
  const n = a.width * a.height;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    sum += Math.abs(da[o] - db[o]) + Math.abs(da[o + 1] - db[o + 1]) + Math.abs(da[o + 2] - db[o + 2]);
  }
  return sum / (n * 3);
}

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const s = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return {
    r: parseInt(s.slice(0, 2), 16),
    g: parseInt(s.slice(2, 4), 16),
    b: parseInt(s.slice(4, 6), 16),
  };
}

export function colorDistance(a, b) {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

// r,g,b in 0..255 -> {h: 0..360, s: 0..1, v: 0..1}
export function rgbToHsv(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return {h, s: max === 0 ? 0 : d / max, v: max};
}

// Quantize the image to a coarse color grid and return dominant buckets
// (center color + share of counted pixels), sorted by count desc.
// `mask` {x,y,w,h} pixels are excluded from both counts and the denominator.
// Fully transparent pixels are skipped.
export function quantize(img, {bucket = 32, mask = null} = {}) {
  const levels = Math.ceil(256 / bucket);
  const counts = new Map();
  const {width, height, data} = img;
  let total = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask && x >= mask.x && x < mask.x + mask.w && y >= mask.y && y < mask.y + mask.h) continue;
      const o = (y * width + x) * 4;
      if (data[o + 3] === 0) continue;
      const qr = Math.min(levels - 1, Math.floor(data[o] / bucket));
      const qg = Math.min(levels - 1, Math.floor(data[o + 1] / bucket));
      const qb = Math.min(levels - 1, Math.floor(data[o + 2] / bucket));
      const key = (qr * levels + qg) * levels + qb;
      counts.set(key, (counts.get(key) || 0) + 1);
      total++;
    }
  }
  const half = Math.floor(bucket / 2);
  const buckets = [...counts.entries()]
    .map(([key, count]) => {
      const qb = key % levels;
      const qg = Math.floor(key / levels) % levels;
      const qr = Math.floor(key / (levels * levels));
      return {
        r: Math.min(255, qr * bucket + half),
        g: Math.min(255, qg * bucket + half),
        b: Math.min(255, qb * bucket + half),
        count,
        fraction: total ? count / total : 0,
      };
    })
    .sort((a, b) => b.count - a.count);
  return {total, buckets};
}
