// Sky, clouds, fog bands and the two distant skyline layers.
import { W, makeCanvas, pixelFill, gradColor, makeGlow, tileNoise, rng, rgb, hash, clamp, R, P, mix, ditherPick, text } from './gfx';
import type { Ctx, Cv, Dyn } from './gfx';

export function buildSky(): Cv {
  const [c, g] = makeCanvas(W, 300);
  const stops: [number, string][] = [
    [0, '#04050e'], [0.2, '#070a1b'], [0.42, '#0b1130'], [0.62, '#121b44'], [0.8, '#1b2a58'], [1, '#283b6a'],
  ];
  pixelFill(g, 0, 0, W, 300, (x, y) => gradColor(stops, y / 299, x, y));
  // city light domes bleeding into the overcast
  g.globalCompositeOperation = 'lighter';
  g.drawImage(makeGlow(190, 90, '#6a2a90', 0.2, 5, 1.5), 250 - 190, 262 - 90);
  g.drawImage(makeGlow(170, 76, '#1a6a80', 0.2, 5, 1.5), 520 - 170, 252 - 76);
  g.drawImage(makeGlow(120, 60, '#8a2a60', 0.14, 4, 1.5), 60 - 120, 244 - 60);
  // the moon, somewhere behind days of rain
  g.drawImage(makeGlow(52, 30, '#3a4a8a', 0.26, 4, 1.4), 300 - 52, 30 - 30);
  g.globalCompositeOperation = 'source-over';
  return c;
}

/** Flat-banded noise texture, tileable in X (clouds / fog). */
export function buildBands(
  seed: number, w: number, h: number, cellX: number, cellY: number,
  thr: number, step: number, cols: string[], alphas: number[] | null, env: (u: number) => number,
): Cv {
  const n = tileNoise(w, h, cellX, cellY, 4, seed);
  const [c, g] = makeCanvas(w, h);
  const img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    const e = env(y / (h - 1));
    for (let x = 0; x < w; x++) {
      const v = n[y * w + x] * e;
      if (v < thr) continue;
      const b = Math.min(cols.length - 1, ((v - thr) / step) | 0);
      const [r, gg, bb] = rgb(cols[b]);
      const o = (y * w + x) * 4;
      img.data[o] = r;
      img.data[o + 1] = gg;
      img.data[o + 2] = bb;
      img.data[o + 3] = alphas ? Math.round(alphas[b] * 255) : 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

// ------------------------------------------------------------------ skyline
export interface BSpec {
  x: number; w: number; top: number; tiers?: number[][]; crown?: string; win?: string; slant?: number; seed: number;
}
export interface LayerStyle {
  base: number; top: string; bot: string; edge: string; dark: string; wins: string[];
  dens: number; big: boolean; gradTop: number; gradBot: number;
}

export function building(g: Ctx, s: BSpec, st: LayerStyle, dyn: Dyn) {
  const r = rng(s.seed * 7919 + 13);
  const hgt = st.base - s.top;
  const x0s = new Int16Array(hgt);
  const x1s = new Int16Array(hgt);
  const tiers = s.tiers || [];
  for (let y = 0; y < hgt; y++) {
    let inL = 0;
    let inR = 0;
    let a = 0;
    for (const t of tiers) {
      if (y < a + t[0]) {
        inL = t[1];
        inR = t[2];
        break;
      }
      a += t[0];
    }
    if (s.slant && y < Math.abs(s.slant)) {
      if (s.slant > 0) inL += s.slant - y;
      else inR += -s.slant - y;
    }
    x0s[y] = s.x + inL;
    x1s[y] = s.x + s.w - inR;
  }
  const bodyAt = (y: number) => mix(st.top, st.bot, clamp((y - st.gradTop) / (st.gradBot - st.gradTop)));
  pixelFill(g, s.x, s.top, s.w, hgt, (x, y) => {
    const j = y - s.top;
    if (x < x0s[j] || x >= x1s[j]) return null;
    if (x === x0s[j]) return st.edge;
    if (x >= x1s[j] - 1) return st.dark;
    // flat tonal bands with a narrow dithered seam: reads as haze, not noise
    const u = clamp((y - st.gradTop) / (st.gradBot - st.gradTop)) * 7;
    const b = Math.floor(u);
    const f = u - b;
    const ca = mix(st.top, st.bot, b / 7);
    return f > 0.72 ? ditherPick(ca, mix(st.top, st.bot, Math.min(1, (b + 1) / 7)), (f - 0.72) * 3.5, x, y) : ca;
  });
  // tier ledges catch a little light
  let acc = 0;
  for (const t of tiers) {
    acc += t[0];
    if (acc < hgt) R(g, x0s[acc], s.top + acc, x1s[acc] - x0s[acc], 1, st.edge);
  }
  R(g, x0s[0], s.top, x1s[0] - x0s[0], 1, st.edge);

  const pick = () => st.wins[(r() * st.wins.length) | 0];
  const style = s.win || 'dots';
  const ws = st.big ? 2 : 1;
  const pitchX = st.big ? 4 : 2;
  const pitchY = st.big ? 5 : 3;
  if (style === 'dots' || style === 'grid') {
    for (let y = 4; y < hgt - 2; y += pitchY) {
      const q = r();
      const fd = q < 0.1 ? 0.85 : q < 0.24 ? 0.04 : st.dens;
      const fc = pick();
      for (let x = x0s[y] + 2; x < x1s[y] - 1 - ws; x += pitchX) {
        if (r() < fd) {
          const c = r() < 0.7 ? fc : pick();
          const wh = style === 'grid' ? ws : ws + (r() < 0.3 ? 1 : 0);
          R(g, x, s.top + y, ws, wh, c);
          if (r() < 0.09) dyn.twinkles.push({ x, y: s.top + y, w: ws, h: wh, bg: bodyAt(s.top + y), per: 5 + r() * 40, seed: (r() * 1e6) | 0 });
        }
      }
    }
  } else if (style === 'bands') {
    for (let y = 5; y < hgt - 2; y += pitchY + 1) {
      if (r() < 0.45) continue;
      const c = pick();
      let x = x0s[y] + 2;
      while (x < x1s[y] - 3) {
        const e = Math.min(x + 2 + ((r() * 9) | 0), x1s[y] - 2);
        if (r() < 0.72) R(g, x, s.top + y, e - x, ws, c);
        x = e + 1 + ((r() * 3) | 0);
      }
    }
  } else if (style === 'vert') {
    const cols = 1 + ((r() * 2) | 0);
    for (let k = 0; k < cols; k++) {
      const c = pick();
      for (let y = 3; y < hgt - 2; y += 2) {
        const x = x0s[y] + (((x1s[y] - x0s[y]) * (k + 1)) / (cols + 1)) | 0;
        if (r() < 0.82) R(g, x, s.top + y, ws, 1, c);
      }
    }
    for (let y = 6; y < hgt - 2; y += pitchY * 2) for (let x = x0s[y] + 2; x < x1s[y] - 2; x += pitchX) if (r() < st.dens * 0.5) R(g, x, s.top + y, ws, ws, pick());
  }

  const cx = (x0s[0] + x1s[0]) >> 1;
  const ty = s.top;
  const beacon = (x: number, y: number) => dyn.beacons.push({ x, y, c: '#ff3848', per: 1.6 + r() * 2.2, ph: r(), duty: 0.4, halo: true });
  switch (s.crown) {
    case 'mast': {
      const mh = 10 + ((r() * 16) | 0);
      R(g, cx, ty - mh, 1, mh, st.edge);
      R(g, cx - 2, ty - mh + 4, 5, 1, st.edge);
      R(g, cx - 1, ty - mh + 8, 3, 1, st.edge);
      beacon(cx, ty - mh - 1);
      break;
    }
    case 'spire': {
      const sh = 14 + ((r() * 14) | 0);
      const bw = Math.min(9, (x1s[0] - x0s[0]) | 1);
      for (let i = 0; i < sh; i++) {
        const ww = Math.max(1, Math.round(bw * (1 - i / sh)));
        R(g, cx - (ww >> 1), ty - 1 - i, ww, 1, i % 5 === 4 ? st.edge : st.top);
      }
      beacon(cx, ty - sh - 1);
      break;
    }
    case 'dome': {
      const rad = (x1s[0] - x0s[0]) >> 1;
      const dh = Math.round(rad * 0.6);
      for (let i = 0; i < dh; i++) {
        const ww = Math.round(Math.sqrt(1 - (i / dh) ** 2) * rad);
        R(g, cx - ww, ty - 1 - i, ww * 2, 1, st.top);
        P(g, cx - ww, ty - 1 - i, st.edge);
      }
      R(g, cx, ty - dh - 6, 1, 6, st.edge);
      beacon(cx, ty - dh - 7);
      break;
    }
    case 'twin': {
      R(g, x0s[0] + 3, ty - 9, 1, 9, st.edge);
      R(g, x1s[0] - 4, ty - 14, 1, 14, st.edge);
      beacon(x1s[0] - 4, ty - 15);
      break;
    }
    case 'tank': {
      R(g, cx - 4, ty - 6, 8, 6, st.top);
      R(g, cx - 4, ty - 6, 8, 1, st.edge);
      R(g, cx + 7, ty - 10, 1, 10, st.edge);
      break;
    }
    default:
  }
}

/** Layer A: megatowers dissolving into the haze. */
export function buildFar(dyn: Dyn): Cv {
  const [c, g] = makeCanvas(W, 300);
  const st: LayerStyle = {
    base: 300, top: '#141d44', bot: '#2a3d6c', edge: '#2e4476', dark: '#121a3e',
    wins: ['#48689c', '#5c86b0', '#3d5a8e', '#9a8468', '#b89a6c'], dens: 0.17, big: false, gradTop: 10, gradBot: 230,
  };
  const specs: BSpec[] = [
    // the arcology: a stepped city-within-a-city
    { x: 344, w: 268, top: 74, tiers: [[13, 122, 122], [14, 108, 108], [14, 94, 94], [15, 79, 79], [15, 64, 64], [16, 48, 48], [16, 32, 32], [18, 16, 16]], win: 'bands', seed: 1 },
    { x: 6, w: 46, top: 62, tiers: [[14, 11, 11], [30, 4, 4]], crown: 'mast', win: 'dots', seed: 2 },
    { x: 58, w: 30, top: 116, win: 'grid', seed: 3 },
    { x: 116, w: 28, top: 30, tiers: [[22, 9, 9], [58, 3, 3]], crown: 'spire', win: 'vert', seed: 4 },
    { x: 152, w: 24, top: 50, tiers: [[16, 6, 6]], crown: 'mast', win: 'dots', seed: 5 },
    { x: 184, w: 52, top: 104, tiers: [[10, 16, 16], [24, 8, 8]], crown: 'dome', win: 'bands', seed: 6 },
    { x: 240, w: 16, top: 16, tiers: [[38, 6, 6], [90, 3, 3]], crown: 'spire', win: 'vert', seed: 7 },
    { x: 262, w: 44, top: 88, slant: 14, win: 'dots', seed: 8 },
    { x: 310, w: 34, top: 60, tiers: [[20, 5, 5]], crown: 'twin', win: 'grid', seed: 9 },
    { x: 556, w: 40, top: 44, tiers: [[18, 12, 12], [50, 5, 5]], crown: 'mast', win: 'dots', seed: 10 },
    { x: 604, w: 40, top: 92, slant: -10, win: 'bands', seed: 11 },
  ];
  specs.forEach((s) => building(g, s, st, dyn));
  // sky-bridge between the twin spires
  R(g, 141, 96, 14, 3, '#1c2852');
  R(g, 141, 96, 14, 1, st.edge);
  for (let x = 142; x < 155; x += 2) P(g, x, 97, '#5c86b0');
  // observation ring on the needle
  R(g, 239, 58, 18, 2, '#1c2852');
  R(g, 239, 58, 18, 1, st.edge);
  for (let x = 240; x < 257; x += 3) P(g, x, 59, '#b89a6c');
  // arcology light spine
  for (let y = 78; y < 200; y++) if (y % 3 !== 0) P(g, 478, y, y % 2 ? '#5c86b0' : '#48689c');
  R(g, 477, 62, 3, 12, st.top);
  R(g, 478, 48, 1, 14, st.edge);
  dyn.beacons.push({ x: 478, y: 47, c: '#ff3848', per: 2.4, ph: 0.3, duty: 0.45, halo: true });
  return c;
}

/** Layer B: closer, denser, with the first readable windows and tiny signs. */
export function buildMidFar(dyn: Dyn): Cv {
  const [c, g] = makeCanvas(W, 300);
  const st: LayerStyle = {
    base: 300, top: '#0e1433', bot: '#18244e', edge: '#22346a', dark: '#0a0f28',
    wins: ['#b87a34', '#d09848', '#b87a34', '#3e96ae', '#c4bca0', '#8a6a3a', '#d09848', '#a84e7c'], dens: 0.2, big: true, gradTop: 100, gradBot: 290,
  };
  const specs: BSpec[] = [
    { x: 46, w: 44, top: 128, win: 'grid', crown: 'tank', seed: 21 },
    { x: 170, w: 36, top: 136, tiers: [[10, 6, 6]], crown: 'mast', win: 'grid', seed: 22 },
    { x: 202, w: 48, top: 166, win: 'dots', crown: 'tank', seed: 23 },
    { x: 246, w: 32, top: 118, tiers: [[14, 8, 0]], crown: 'mast', win: 'grid', seed: 24 },
    { x: 276, w: 46, top: 178, win: 'bands', seed: 25 },
    { x: 300, w: 28, top: 144, slant: 8, win: 'dots', seed: 26 },
    { x: 360, w: 42, top: 120, tiers: [[12, 7, 7]], crown: 'twin', win: 'grid', seed: 27 },
    { x: 398, w: 44, top: 158, win: 'bands', seed: 28 },
    { x: 514, w: 34, top: 102, tiers: [[16, 6, 6]], crown: 'spire', win: 'dots', seed: 29 },
    { x: 546, w: 36, top: 140, win: 'grid', crown: 'tank', seed: 30 },
    { x: 598, w: 46, top: 126, win: 'dots', seed: 31 },
  ];
  specs.forEach((s) => building(g, s, st, dyn));
  // tiny distant signage
  const signs: [number, number, number, number, string][] = [
    [176, 150, 3, 14, '#d0407a'], [258, 136, 3, 18, '#3ec8d8'], [214, 176, 10, 3, '#d09848'],
    [372, 134, 3, 16, '#9a5ae8'], [404, 168, 12, 3, '#d0407a'], [286, 186, 9, 3, '#3ec8d8'], [522, 124, 3, 14, '#d09848'],
  ];
  const r = rng(55);
  for (const [x, y, w, h, col] of signs) {
    R(g, x - 1, y - 1, w + 2, h + 2, '#070a1c');
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (r() < 0.62) P(g, x + i, y + j, col);
    dyn.twinkles.push({ x, y, w, h, bg: '#0b0f26', per: 0.25 + r() * 0.5, seed: 9000 + x });
  }
  return c;
}

// ------------------------------------------------------------ sky dynamics
export function lightningAt(t: number) {
  const SL = 170;
  const k = Math.floor(t / SL);
  const u = t - (k * SL + 20 + hash(k, 91) * 120);
  let a = 0;
  if (u >= 0 && u < 0.7) a = u < 0.06 ? 1 : u < 0.12 ? 0.25 : u < 0.2 ? 0.8 : Math.max(0, 0.8 * (1 - (u - 0.2) / 0.5));
  return { a: a * 0.6, x: 80 + hash(k, 92) * 480, y: 36 + hash(k, 93) * 50 };
}

export function drawSearchlight(g: Ctx, x0: number, y0: number, ang: number, len: number, col: string) {
  const tn = Math.tan(ang);
  const cs = Math.cos(ang);
  const rows = Math.floor(len * cs);
  g.fillStyle = col;
  for (let j = 3; j < rows; j++) {
    const d = j / rows;
    g.globalAlpha = d < 0.3 ? 0.11 : d < 0.62 ? 0.075 : 0.04;
    const hw = 1 + j * 0.045;
    g.fillRect(Math.round(x0 + tn * j - hw), y0 - j, Math.round(hw * 2), 1);
  }
  g.globalAlpha = 1;
}

/** A slow advertising blimp that wanders through every few minutes. */
export function drawBlimp(g: Ctx, t: number) {
  const SL = 400;
  const k = Math.floor(t / SL);
  const u = t - k * SL - 15 - hash(k, 5) * 90;
  if (u < 0 || u > 160) return;
  const dir = hash(k, 6) < 0.5 ? 1 : -1;
  const x = Math.round(dir > 0 ? -70 + u * 4.8 : W + 70 - u * 4.8);
  const y = 54 + ((hash(k, 7) * 26) | 0) + Math.round(Math.sin(t * 0.35) * 1.5);
  for (let j = -7; j <= 7; j++) {
    const hw = Math.round(27 * Math.sqrt(1 - (j / 7.6) ** 2));
    R(g, x - hw, y + j, hw * 2, 1, j < -5 ? '#4a5e98' : j < -2 ? '#34467c' : j < 3 ? '#26335f' : '#182146');
  }
  // tail fins
  const tx = x - dir * 25;
  R(g, tx - 2, y - 10, 5, 5, '#34467c');
  R(g, tx - 2, y + 5, 5, 5, '#182146');
  R(g, tx - dir * 4, y - 1, 5, 3, '#26335f');
  // gondola
  R(g, x - 6, y + 8, 12, 3, '#141c40');
  for (let i = 0; i < 4; i++) P(g, x - 4 + i * 3, y + 9, '#d09848');
  // side screen
  R(g, x - 17, y - 3, 34, 7, '#050a14');
  g.save();
  g.beginPath();
  g.rect(x - 16, y - 2, 32, 5);
  g.clip();
  const msg = 'KIRIN-9 * OFFWORLD JOBS * SLEEP LESS * ';
  const off = Math.floor(t * 9) % (msg.length * 4);
  text(g, msg + msg, x - 16 - off, y - 2, '#58d8e8');
  g.restore();
  const bl = t * 1.2 - Math.floor(t * 1.2);
  if (bl < 0.25) P(g, x + dir * 27, y, '#ff3848');
  if (bl > 0.5 && bl < 0.7) P(g, x, y - 8, '#e8f8ff');
}
