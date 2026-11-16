// ---------------------------------------------------------------------------
// Pixel graphics toolkit. Everything here draws on the integer pixel grid.
// No paths, no strokes, no antialiasing: only 1x1 rects, blits and ImageData.
// ---------------------------------------------------------------------------
export const W = 640;
export const H = 360;
export type Ctx = CanvasRenderingContext2D;
export type Cv = HTMLCanvasElement;

type Factory = (w: number, h: number) => Cv;
let factory: Factory = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};
export function setCanvasFactory(f: Factory) {
  factory = f;
}
export function makeCanvas(w: number, h: number): [Cv, Ctx] {
  const c = factory(w, h);
  const g = c.getContext('2d') as Ctx;
  g.imageSmoothingEnabled = false;
  return [c, g];
}

// ------------------------------- randomness -------------------------------
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Stateless integer hash -> [0,1). Used for all time-slot based events. */
export function hash(a: number, b = 0, c = 0): number {
  let h = (Math.imul(a | 0, 0x27d4eb2d) + Math.imul(b | 0, 0x165667b1) + Math.imul(c | 0, 0x9e3779b1) + 0x85ebca6b) | 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
/** Smooth 1D value noise, endless and non-repeating. */
export function vnoise(x: number, seed: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const s = f * f * (3 - 2 * f);
  return hash(i, seed) * (1 - s) + hash(i + 1, seed) * s;
}
export const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);

// --------------------------------- colour ---------------------------------
const colCache = new Map<string, [number, number, number]>();
export function rgb(hex: string): [number, number, number] {
  let v = colCache.get(hex);
  if (!v) {
    const n = parseInt(hex.slice(1), 16);
    v = [n >> 16, (n >> 8) & 255, n & 255];
    colCache.set(hex, v);
  }
  return v;
}
const mixCache = new Map<string, string>();
export function mix(a: string, b: string, t: number): string {
  const key = a + b + t.toFixed(3);
  let v = mixCache.get(key);
  if (!v) {
    const A = rgb(a);
    const B = rgb(b);
    v = '#' + [0, 1, 2].map((i) => Math.round(A[i] + (B[i] - A[i]) * t).toString(16).padStart(2, '0')).join('');
    mixCache.set(key, v);
  }
  return v;
}
export function rgba(hex: string, a: number): string {
  const [r, g, b] = rgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

// ------------------------------- primitives -------------------------------
export function R(g: Ctx, x: number, y: number, w: number, h: number, c: string) {
  g.fillStyle = c;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}
export function P(g: Ctx, x: number, y: number, c: string) {
  g.fillStyle = c;
  g.fillRect(Math.round(x), Math.round(y), 1, 1);
}
export function line(g: Ctx, x0: number, y0: number, x1: number, y1: number, c: string) {
  g.fillStyle = c;
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (let n = 0; n < 2000; n++) {
    g.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}
export function disc(g: Ctx, cx: number, cy: number, r: number, c: string) {
  g.fillStyle = c;
  cx = Math.round(cx);
  cy = Math.round(cy);
  if (r <= 0) {
    g.fillRect(cx, cy, 1, 1);
    return;
  }
  for (let dy = -r; dy <= r; dy++) {
    const dx = Math.floor(Math.sqrt(r * r - dy * dy) + 0.35);
    g.fillRect(cx - dx, cy + dy, dx * 2 + 1, 1);
  }
}
export function ring(g: Ctx, cx: number, cy: number, rx: number, ry: number, c: string) {
  g.fillStyle = c;
  const n = Math.max(8, Math.ceil((rx + ry) * 3));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    g.fillRect(Math.round(cx + Math.cos(a) * rx), Math.round(cy + Math.sin(a) * ry), 1, 1);
  }
}
export function blit(g: Ctx, c: Cv, x: number, y: number) {
  g.drawImage(c, Math.round(x), Math.round(y));
}
/** Draw a horizontally tileable texture with an endless integer scroll. */
export function wrapDraw(g: Ctx, c: Cv, off: number, y: number) {
  const w = c.width;
  const o = ((Math.floor(off) % w) + w) % w;
  g.drawImage(c, -o, y);
  if (w - o < W) g.drawImage(c, w - o, y);
}

// -------------------------------- dithering -------------------------------
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
export const bayer = (x: number, y: number) => BAYER[(x & 3) + ((y & 3) << 2)];
export const ditherPick = (a: string, b: string, t: number, x: number, y: number) => (t > bayer(x, y) ? b : a);
export function gradColor(stops: [number, string][], u: number, x: number, y: number): string {
  for (let i = 0; i < stops.length - 1; i++) {
    const [a, ca] = stops[i];
    const [b, cb] = stops[i + 1];
    if (u <= b) return ditherPick(ca, cb, (u - a) / (b - a), x, y);
  }
  return stops[stops.length - 1][1];
}

/** Per-pixel generator (init-time only). fn returns a hex colour or null. */
export function pixelFill(
  g: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  fn: (px: number, py: number) => string | null,
  alphaFn?: (px: number, py: number) => number,
) {
  const [c, cg] = makeCanvas(w, h);
  const img = cg.createImageData(w, h);
  const d = img.data;
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const col = fn(x + i, y + j);
      if (!col) continue;
      const [r, gg, b] = rgb(col);
      const o = (j * w + i) * 4;
      d[o] = r;
      d[o + 1] = gg;
      d[o + 2] = b;
      d[o + 3] = alphaFn ? Math.round(clamp(alphaFn(x + i, y + j)) * 255) : 255;
    }
  cg.putImageData(img, 0, 0);
  g.drawImage(c, x, y);
}

/** Banded, Bayer-dithered light sprite. Meant to be drawn additively. */
export function makeGlow(rx: number, ry: number, color: string, strength: number, levels = 4, falloff = 1.8): Cv {
  const w = rx * 2 + 1;
  const h = ry * 2 + 1;
  const [c, g] = makeCanvas(w, h);
  const img = g.createImageData(w, h);
  const [r, gg, b] = rgb(color);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const dx = (x - rx) / rx;
      const dy = (y - ry) / ry;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d >= 1) continue;
      const v = Math.pow(1 - d, falloff) * levels;
      let lv = Math.floor(v);
      if (v - lv > bayer(x, y)) lv++;
      if (lv <= 0) continue;
      const o = (y * w + x) * 4;
      img.data[o] = r;
      img.data[o + 1] = gg;
      img.data[o + 2] = b;
      img.data[o + 3] = Math.round(clamp((lv / levels) * strength) * 255);
    }
  g.putImageData(img, 0, 0);
  return c;
}
export function glowAt(g: Ctx, s: Cv, cx: number, cy: number, a = 1) {
  if (a <= 0.01) return;
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = a > 1 ? 1 : a;
  g.drawImage(s, Math.round(cx - (s.width >> 1)), Math.round(cy - (s.height >> 1)));
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
}

// ---------------------------------- noise ---------------------------------
/** Fractal value noise that tiles seamlessly along X. */
export function tileNoise(w: number, h: number, cellX: number, cellY: number, octaves: number, seed: number): Float32Array {
  const out = new Float32Array(w * h);
  let amp = 1;
  let tot = 0;
  for (let o = 0; o < octaves; o++) {
    const cx = Math.max(1, cellX >> o);
    const cy = Math.max(1, cellY >> o);
    const per = Math.max(1, Math.round(w / cx));
    for (let y = 0; y < h; y++) {
      const fy = y / cy;
      const y0 = Math.floor(fy);
      const ty = fy - y0;
      const sy = ty * ty * (3 - 2 * ty);
      for (let x = 0; x < w; x++) {
        const fx = x / cx;
        const x0 = Math.floor(fx);
        const tx = fx - x0;
        const sx = tx * tx * (3 - 2 * tx);
        const xa = x0 % per;
        const xb = (x0 + 1) % per;
        const a = hash(xa, y0, seed + o * 17);
        const b = hash(xb, y0, seed + o * 17);
        const c = hash(xa, y0 + 1, seed + o * 17);
        const d = hash(xb, y0 + 1, seed + o * 17);
        out[y * w + x] += amp * ((a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy);
      }
    }
    tot += amp;
    amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= tot;
  return out;
}

// --------------------------------- sprites --------------------------------
export function sprite(rows: string[], pal: Record<string, string>): Cv {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const [c, g] = makeCanvas(w, h);
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const col = pal[row[i]];
      if (col) {
        g.fillStyle = col;
        g.fillRect(i, j, 1, 1);
      }
    }
  });
  return c;
}

// ---------------------------------- fonts ---------------------------------
const F: Record<string, string> = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
  F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
  K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
  P: '110101110100100', Q: '010101101111011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
  Z: '111001010100111', '0': '111101101101111', '1': '010110010010111', '2': '110001010100111', '3': '110001010001110',
  '4': '101101111001001', '5': '111100110001110', '6': '011100111101111', '7': '111001010010010', '8': '111101111101111',
  '9': '111101111001110', '.': '000000000000010', ':': '000010000010000', '-': '000000111000000', '+': '000010111010000',
  '/': '001001010100100', '!': '010010010000010', '%': '101001010100101', '>': '100010001010100', '<': '001010100010001',
  '*': '000101010101000', $: '101010111010010', _: '000000000000111', '#': '101111101111101', '=': '000111000111000',
  '?': '110001010000010',
};
/** 3x5 bitmap font. Returns the advance in pixels. */
export function text(g: Ctx, s: string, x: number, y: number, col: string, sc = 1): number {
  g.fillStyle = col;
  let cx = Math.round(x);
  const yy = Math.round(y);
  for (const ch of s) {
    const b = F[ch];
    if (b) for (let i = 0; i < 15; i++) if (b[i] === '1') g.fillRect(cx + (i % 3) * sc, yy + ((i / 3) | 0) * sc, sc, sc);
    cx += 4 * sc;
  }
  return cx - x;
}
export const KANA: Record<string, string> = {
  ra: '0111000000111110000100110', me: '0001001010001000101010000', n: '1000001001000010001011100',
  bar: '0010000100001000010000100', ne: '0010011111000100111010101', o: '0001011111001100101010010',
  ka: '0100011111010010100110011', to: '0100001000011000101001000', ro: '1111110001100011000111111',
  ni: '0000001110000000000011111', sa: '0101011111010100001000100', ho: '0010011111001001010110101',
  te: '0111000000111110010001000', ru: '0101001010010100101110010', a: '1111100001001100010001000',
  ki: '0010011111001001111100100', su: '1111100001000100010111001', ku: '0111001001100010001001100',
};
export const KANJI: Record<string, string> = {
  ame: '1111111000100011111111001001110110110010011101101',
  tsuki: '0111110010001001111100100010011111001000101000110',
  naka: '0001000111111110010011001001111111100010000001000',
  dai: '0001000000100011111110001000001010001000101000001',
  mizu: '0001000000100111010100011100010101010010010011000',
  yama: '0001000000100010010011001001100100110010011111111',
  hi: '1111111100000110000011111111100000110000011111111',
  ta: '1111111100100110010011111111100100110010011111111',
};
/** Square bitmap glyph (n x n). */
export function glyph(g: Ctx, bits: string, n: number, x: number, y: number, col: string, sc = 1) {
  g.fillStyle = col;
  for (let i = 0; i < bits.length; i++) if (bits[i] === '1') g.fillRect(x + (i % n) * sc, y + ((i / n) | 0) * sc, sc, sc);
}

// ---------------------------------- neon ----------------------------------
/**
 * Convincing gas-tube behaviour: long steady stretches, a rare micro-dip,
 * and occasional stuttering bursts. Returns 1 (lit), ~0.4 (starved) or 0.
 */
export function flicker(id: number, t: number, rate = 1): number {
  const slot = 6 + hash(id, 1) * 11;
  const k = Math.floor(t / slot);
  if (hash(id, k, 7) < 0.34 * rate) {
    const start = k * slot + hash(id, k, 9) * (slot - 1.6);
    const u = t - start;
    const dur = 0.25 + hash(id, k, 11) * 1.2;
    if (u >= 0 && u < dur) {
      const f = hash(id, Math.floor(u * 22), k);
      return f < 0.42 ? 0 : f < 0.64 ? 0.4 : 1;
    }
  }
  return hash(id, Math.floor(t * 9), 3) < 0.012 ? 0.4 : 1;
}
export function neonCol(base: string, lvl: number): string {
  if (lvl > 0.9) return mix(base, '#ffffff', 0.5);
  if (lvl > 0.2) return mix(base, '#0a0a18', 0.35);
  return mix(base, '#0a0a18', 0.8);
}

// ---------------------------------- plants --------------------------------
export const LEAF = ['#0e2a28', '#16403a', '#23604c', '#3a8a5c'];
export function vine(g: Ctx, x: number, y: number, len: number, seed: number, cols: string[] = LEAF) {
  const r = rng(seed);
  let cx = x;
  for (let i = 0; i < len; i++) {
    if (r() < 0.3) cx += r() < 0.5 ? -1 : 1;
    P(g, cx, y + i, cols[0]);
    if (r() < 0.55) P(g, cx + (r() < 0.5 ? -1 : 1), y + i, cols[1 + ((r() * (cols.length - 1)) | 0)]);
  }
}
export function fern(g: Ctx, x: number, y: number, size: number, seed: number, cols: string[] = LEAF) {
  const r = rng(seed);
  for (let i = 0; i < size * 3; i++) {
    const a = -Math.PI * (0.08 + r() * 0.84);
    const len = size * (0.45 + r() * 0.6);
    for (let k = 0; k < len; k++) {
      const px = x + Math.cos(a) * k;
      const py = y + Math.sin(a) * k * 0.95 + (k * k) / (size * 2.6);
      P(g, px, py, cols[Math.min(cols.length - 1, ((k / len) * cols.length) | 0)]);
    }
  }
}

// ----------------------------- dynamic registry ---------------------------
export interface Beacon { x: number; y: number; c: string; per: number; ph: number; duty: number; halo?: boolean }
export interface Twinkle { x: number; y: number; w: number; h: number; bg: string; per: number; seed: number }
export interface Win {
  x: number; y: number; w: number; h: number; kind: number; col: string; dim: string;
  decor: number; seed: number; h1: number; h2: number;
}
export interface Dyn { beacons: Beacon[]; twinkles: Twinkle[]; wins: Win[] }
export const newDyn = (): Dyn => ({ beacons: [], twinkles: [], wins: [] });

export function drawBeacons(g: Ctx, list: Beacon[], t: number) {
  for (const b of list) {
    const ph = t / b.per + b.ph;
    if (ph - Math.floor(ph) >= b.duty) continue;
    if (b.halo) {
      g.globalAlpha = 0.28;
      g.fillStyle = b.c;
      g.fillRect(b.x - 1, b.y - 1, 3, 3);
      g.globalAlpha = 1;
    }
    P(g, b.x, b.y, b.c);
  }
}
export function drawTwinkles(g: Ctx, list: Twinkle[], t: number) {
  for (const w of list) {
    if (hash(w.seed, Math.floor(t / w.per + w.seed * 0.137)) > 0.62) R(g, w.x, w.y, w.w, w.h, w.bg);
  }
}
