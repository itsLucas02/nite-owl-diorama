// Layer C: the neighbourhood. Hand-placed buildings, living windows, signage,
// the maglev line, air traffic and the holographic koi.
import {
  W, makeCanvas, pixelFill, makeGlow, rng, hash, vnoise, clamp, R, P, line, disc, mix, bayer, text, glyph,
  KANA, KANJI, flicker, neonCol, glowAt, vine, newDyn, sprite,
} from './gfx';
import type { Ctx, Cv, Dyn, Win } from './gfx';

const HI = '#26366a';
const EDGE = '#1a2650';
const SHADE = '#070915';

function wall(g: Ctx, x: number, y: number, w: number, h: number, base: string, seed: number) {
  R(g, x, y, w, h, base);
  const r = rng(seed);
  const dk = mix(base, '#000000', 0.3);
  const lt = mix(base, '#3c5a90', 0.16);
  for (let i = 0; i < (w * h) / 55; i++) {
    const sx = x + ((r() * w) | 0);
    const sy = y + ((r() * h) | 0);
    R(g, sx, sy, 1, Math.min(2 + ((r() * 11) | 0), y + h - sy), r() < 0.72 ? dk : lt);
  }
  for (let i = 0; i < (w * h) / 160; i++) P(g, x + ((r() * w) | 0), y + ((r() * h) | 0), lt);
}

const WARM = ['#e08326', '#f7b040', '#ffd87a', '#d86a2a', '#f09a4a', '#ffc060'];
function addWin(g: Ctx, dyn: Dyn, x: number, y: number, w: number, h: number, seed: number, pAlive: number) {
  R(g, x - 1, y - 1, w + 2, h + 2, '#060813');
  R(g, x, y, w, h, '#0a0d1f');
  P(g, x + 1, y + 1, '#1a244a');
  if (hash(seed, 1) > pAlive) {
    if (hash(seed, 8) < 0.3) for (let yy = y + 1; yy < y + h; yy += 2) R(g, x, yy, w, 1, '#0e1329');
    return;
  }
  const k = hash(seed, 2);
  let kind = 1;
  let col = WARM[(hash(seed, 3) * WARM.length) | 0];
  if (k < 0.22) kind = 3;
  else if (k < 0.36) {
    kind = 2;
    col = '#5a7ad8';
  } else if (k < 0.43) col = '#a8d8d8';
  else if (k < 0.48) col = '#b858e8';
  else if (k < 0.53) col = '#e8607a';
  dyn.wins.push({ x, y, w, h, kind, col, dim: mix(col, '#1a1020', 0.3), decor: (hash(seed, 4) * 8) | 0, seed, h1: hash(seed, 5), h2: hash(seed, 6) });
}

const TVC = ['#5a7ad8', '#8ab0f0', '#d8e8ff', '#7a5ad8', '#3a5aa8', '#c87ad8', '#58c8d8'];
let litBuf = new Uint8Array(0);
/** Every window keeps its own schedule: lights go out, people wander, TVs flicker. */
export function drawWins(g: Ctx, wins: Win[], t: number) {
  if (litBuf.length < wins.length) litBuf = new Uint8Array(wins.length);
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = 0.13;
  for (let i = 0; i < wins.length; i++) {
    const wn = wins[i];
    const slot = 50 + wn.h1 * 240;
    const on = hash(wn.seed, Math.floor(t / slot + wn.h2), 3) < 0.84 ? 1 : 0;
    litBuf[i] = on;
    if (on) {
      g.fillStyle = wn.col;
      g.fillRect(wn.x - 1, wn.y - 1, wn.w + 2, wn.h + 2);
    }
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  for (let i = 0; i < wins.length; i++) {
    if (!litBuf[i]) continue;
    const wn = wins[i];
    const { x, y, w, h } = wn;
    if (wn.kind === 2) {
      const col = TVC[(hash(wn.seed, Math.floor(t * (1.5 + wn.h1 * 3)), 5) * TVC.length) | 0];
      R(g, x, y, w, h, '#12183a');
      g.globalAlpha = 0.5;
      R(g, x, y, w, h, col);
      g.globalAlpha = 1;
      R(g, wn.decor & 1 ? x + 1 : x + w - 3, y + h - 3, 2, 2, col);
      R(g, x + (w >> 1) - 1, y + h - 2, 2, 2, '#0a0d1f');
      continue;
    }
    const col = hash(wn.seed, Math.floor(t * 4), 9) < 0.012 ? wn.dim : wn.col;
    R(g, x, y, w, h, col);
    R(g, x, y, w, 1, wn.dim);
    switch (wn.decor) {
      case 1: R(g, x, y, 2, h, wn.dim); break;
      case 2: R(g, x + w - 2, y, 2, h, wn.dim); break;
      case 3: for (let yy = y + 1; yy < y + h; yy += 2) R(g, x, yy, w, 1, wn.dim); break;
      case 4: P(g, x + 1, y + h - 1, '#16403a'); P(g, x + 2, y + h - 2, '#23604c'); P(g, x + 2, y + h - 1, '#16403a'); break;
      case 5: R(g, x + (w >> 1), y, 1, h, '#0a0d1f'); break;
      case 6: R(g, x + 1, y + 2, w - 2, 1, wn.dim); P(g, x + 2, y + 1, '#2a120e'); P(g, x + w - 3, y + 1, '#2a120e'); break;
      default:
    }
    if (wn.kind === 3) {
      const per = 18 + wn.h1 * 40;
      const ph = t / per + wn.h2;
      const cyc = Math.floor(ph);
      const u = ph - cyc;
      const a = hash(wn.seed, cyc, 11);
      const b = hash(wn.seed, cyc + 1, 11);
      const m = u < 0.6 ? 0 : (u - 0.6) / 0.4;
      const px = x + Math.round((a + (b - a) * m * m * (3 - 2 * m)) * (w - 3));
      R(g, px, y + h - 4, 3, 4, '#161020');
      R(g, px + (b > a ? 1 : 0), y + h - 6, 2, 2, '#161020');
    }
  }
}

// ------------------------------------------------------------- static city
function c1(g: Ctx, dyn: Dyn) {
  const x = 86;
  const w = 90;
  const top = 96;
  wall(g, x, top, w, 204, '#0c1025', 101);
  R(g, x, top, 1, 204, EDGE);
  R(g, x + w - 2, top, 2, 204, SHADE);
  R(g, x - 1, top - 3, w + 2, 3, '#121938');
  R(g, x - 1, top - 3, w + 2, 1, HI);
  for (let j = 0; j < 12; j++) {
    const fy = 105 + j * 16;
    R(g, x + 1, fy + 10, 72, 1, '#18224a');
    R(g, x + 1, fy + 11, 72, 1, '#060813');
    for (let k = 0; k < 72; k += 4) P(g, x + 1 + k, fy + 9, '#141b3a');
    for (let i = 0; i < 5; i++) {
      const wx = 91 + i * 14;
      addWin(g, dyn, wx, fy, 9, 7, 1000 + j * 10 + i, 0.58);
      const q = hash(j, i, 77);
      if (q < 0.3) {
        R(g, wx + 2, fy + 8, 6, 3, '#18224a');
        R(g, wx + 2, fy + 8, 6, 1, HI);
        P(g, wx + 6, fy + 9, '#060813');
      } else if (q < 0.45) {
        for (let k = 0; k < 4; k++) R(g, wx + k * 2 + 1, fy + 8, 1, 2 + (k & 1), ['#3a4a7a', '#5a3a5a', '#2a5a6a', '#6a5a4a'][k]);
      } else if (q < 0.62) {
        P(g, wx + 1, fy + 9, '#1c4a3f');
        P(g, wx + 2, fy + 8, '#23604c');
        P(g, wx + 3, fy + 9, '#16403a');
        P(g, wx + 7, fy + 9, '#1c4a3f');
      }
    }
  }
  R(g, 158, top, 1, 204, '#18224a');
  // vertical sign board
  R(g, 160, 110, 14, 82, '#05060f');
  R(g, 160, 110, 14, 1, EDGE);
  R(g, 160, 110, 1, 82, EDGE);
  // rooftop: tank, stair hut, mast, billboard scaffold
  R(g, 89, 81, 12, 12, '#101633');
  R(g, 89, 81, 12, 1, HI);
  R(g, 89, 86, 12, 1, '#080b1a');
  R(g, 90, 93, 2, 3, '#080b1a');
  R(g, 98, 93, 2, 3, '#080b1a');
  R(g, 172, 56, 1, 37, '#18224a');
  R(g, 170, 61, 5, 1, '#18224a');
  R(g, 171, 66, 3, 1, '#18224a');
  dyn.beacons.push({ x: 172, y: 55, c: '#ff3848', per: 2.1, ph: 0.2, duty: 0.4, halo: true });
  for (const lx of [108, 128, 148, 166]) R(g, lx, 86, 1, 10, '#18224a');
  line(g, 108, 93, 128, 87, '#141b3a');
  line(g, 128, 93, 148, 87, '#141b3a');
  line(g, 148, 93, 166, 87, '#141b3a');
  R(g, 102, 61, 68, 26, '#060813');
  R(g, 102, 61, 68, 1, HI);
  R(g, 102, 61, 1, 26, EDGE);
}

function c2(g: Ctx, dyn: Dyn) {
  const x = 196;
  const w = 106;
  const top = 232;
  wall(g, x, top, w, 70, '#0d1127', 202);
  R(g, x, top, 1, 70, EDGE);
  R(g, x - 1, top - 2, w + 2, 3, '#141b3a');
  R(g, x - 1, top - 2, w + 2, 1, '#2c3f70');
  // chimney
  R(g, 203, 212, 9, 18, '#1a1626');
  R(g, 203, 212, 1, 18, '#34304e');
  for (let y = 215; y < 230; y += 3) R(g, 204, y, 8, 1, '#120f1c');
  R(g, 202, 210, 11, 3, '#0e1022');
  R(g, 202, 210, 11, 1, '#2c3f70');
  // holo projector
  R(g, 239, 227, 21, 3, '#141b3a');
  R(g, 242, 224, 15, 3, '#1c2752');
  R(g, 245, 222, 9, 2, '#2c3f70');
  R(g, 247, 221, 5, 1, '#58d8e8');
  dyn.beacons.push({ x: 240, y: 228, c: '#2ee6e6', per: 1.3, ph: 0, duty: 0.5 });
  dyn.beacons.push({ x: 258, y: 228, c: '#ff2e88', per: 1.3, ph: 0.5, duty: 0.5 });
  // rooftop grow-house, violet light and too many plants
  for (let i = 0; i < 5; i++) R(g, 268 + i * 3, 217 - i, 30 - i * 6, 1, i === 4 ? '#8a4ac0' : '#5a2a7a');
  R(g, 268, 218, 30, 12, '#5a2a7a');
  R(g, 268, 218, 30, 3, '#8a4ac0');
  const r = rng(9);
  for (let i = 0; i < 26; i++) {
    const px = 269 + ((r() * 28) | 0);
    const ph = 2 + ((r() * 6) | 0);
    R(g, px, 230 - ph, 1, ph, r() < 0.5 ? '#16403a' : '#0e2a28');
    if (r() < 0.5) P(g, px + 1, 230 - ph, '#3a8a5c');
  }
  for (let px = 268; px <= 298; px += 6) R(g, px, 214, 1, 16, '#141b3a');
  R(g, 268, 222, 31, 1, '#141b3a');
  for (let i = 0; i < 5; i++) {
    P(g, 268 + i * 3, 217 - i, '#22305c');
    P(g, 297 - i * 3, 217 - i, '#22305c');
  }
  g.globalCompositeOperation = 'lighter';
  g.drawImage(makeGlow(26, 18, '#9a4ae0', 0.3, 4), 283 - 26, 222 - 18);
  g.globalCompositeOperation = 'source-over';
  // facade: sign board, awning, lower shutters
  R(g, 200, 236, 60, 10, '#060813');
  R(g, 200, 236, 60, 1, EDGE);
  R(g, 264, 238, 36, 8, '#060813');
  for (let i = 0; i < 60; i += 4) R(g, 200 + i, 262, 4, 3, (i >> 2) & 1 ? '#8a1830' : '#2a0e1e');
  R(g, 200, 265, 60, 1, '#060813');
  R(g, 200, 248, 100, 14, '#060813');
  for (let y = 269; y < 286; y += 2) R(g, 202, y, 56, 1, '#131a36');
  R(g, 266, 268, 14, 18, '#080b1a');
  R(g, 284, 268, 14, 18, '#101633');
  P(g, 277, 277, '#8fbfc8');
}

function c3(g: Ctx, dyn: Dyn) {
  const x = 312;
  wall(g, x, 82, 56, 218, '#0c1025', 303);
  wall(g, x + 8, 58, 40, 24, '#0c1025', 304);
  R(g, x + 8, 58, 40, 1, HI);
  R(g, x, 82, 8, 1, HI);
  R(g, x + 48, 82, 8, 1, HI);
  R(g, x, 82, 1, 218, EDGE);
  R(g, x + 8, 58, 1, 24, EDGE);
  R(g, x + 54, 82, 2, 218, SHADE);
  R(g, 338, 36, 2, 22, '#141b3a');
  R(g, 334, 44, 10, 1, '#141b3a');
  R(g, 336, 50, 6, 1, '#141b3a');
  dyn.beacons.push({ x: 338, y: 35, c: '#ff3848', per: 1.8, ph: 0.6, duty: 0.4, halo: true });
  for (let y = 62; y < 80; y += 4) R(g, 324, y, 32, 1, hash(y, 3) < 0.5 ? '#1a2650' : '#7a5a34');
  R(g, 316, 86, 26, 70, '#05060f');
  R(g, 316, 86, 26, 1, HI);
  R(g, 342, 86, 1, 214, '#18224a');
  for (let j = 0; j < 17; j++) {
    const wy = 88 + j * 12;
    addWin(g, dyn, 346, wy, 8, 6, 3000 + j, 0.52);
    addWin(g, dyn, 357, wy, 7, 6, 3100 + j, 0.42);
    R(g, 344, wy + 8, 22, 1, '#141b3a');
  }
  for (let j = 0; j < 11; j++) {
    const wy = 162 + j * 12;
    addWin(g, dyn, 318, wy, 8, 6, 3200 + j, 0.5);
    addWin(g, dyn, 330, wy, 8, 6, 3300 + j, 0.5);
    R(g, 316, wy + 8, 24, 1, '#141b3a');
  }
}

function c4(g: Ctx, dyn: Dyn) {
  const x = 434;
  const w = 88;
  const top = 34;
  wall(g, x, top, w, 266, '#0b0f24', 405);
  R(g, x, top, 1, 266, EDGE);
  R(g, x + w - 2, top, 2, 266, SHADE);
  R(g, x - 2, top - 2, w + 4, 3, '#121938');
  R(g, x - 2, top - 2, w + 4, 1, HI);
  for (let j = 0; j < 14; j++) {
    const fy = 42 + j * 12;
    R(g, x - 1, fy + 8, w + 2, 2, '#141c3e');
    R(g, x - 1, fy + 8, w + 2, 1, '#22305c');
    R(g, x, fy + 10, w, 1, '#050610');
    for (let i = 0; i < 8; i++) addWin(g, dyn, 440 + i * 10, fy, 7, 6, 4000 + j * 10 + i, 0.44);
    if (hash(j, 5, 41) < 0.5) vine(g, 438 + ((hash(j, 6, 41) * 76) | 0), fy + 9, 4 + ((hash(j, 7, 41) * 7) | 0), 400 + j);
  }
  // roof: lattice mast + landing pad with a parked flyer
  R(g, 446, 10, 1, 22, '#18224a');
  R(g, 450, 16, 1, 16, '#18224a');
  line(g, 446, 14, 450, 20, '#141b3a');
  line(g, 446, 26, 450, 20, '#141b3a');
  dyn.beacons.push({ x: 446, y: 9, c: '#ff3848', per: 2.6, ph: 0.1, duty: 0.4, halo: true });
  R(g, 494, 29, 38, 2, '#141c3e');
  R(g, 494, 29, 38, 1, '#2c3f70');
  line(g, 524, 31, 518, 34, '#141c3e');
  dyn.beacons.push({ x: 495, y: 28, c: '#f7b040', per: 1.4, ph: 0, duty: 0.5 });
  dyn.beacons.push({ x: 530, y: 28, c: '#f7b040', per: 1.4, ph: 0.5, duty: 0.5 });
  R(g, 505, 25, 14, 4, '#1c2752');
  R(g, 508, 23, 7, 2, '#26366a');
  P(g, 505, 26, '#e8203c');
  P(g, 518, 27, '#c4e8e6');
  // hotel sign board
  R(g, 420, 54, 14, 48, '#05060f');
  R(g, 420, 54, 14, 1, EDGE);
  R(g, 420, 54, 1, 48, EDGE);
}

function c5(g: Ctx, dyn: Dyn) {
  const x = 572;
  wall(g, x, 116, 68, 184, '#0c1025', 506);
  for (let i = 0; i < 16; i++) {
    R(g, x + 32 - i * 2, 100 + i, 36 + i * 2, 1, '#0c1025');
    R(g, x + 32 - i * 2, 100 + i, 2, 1, HI);
  }
  R(g, x, 116, 1, 184, EDGE);
  disc(g, 606, 134, 16, '#1a244a');
  disc(g, 606, 134, 15, '#060813');
  for (let j = 0; j < 9; j++) {
    const wy = 160 + j * 16;
    for (let i = 0; i < 4; i++) addWin(g, dyn, 578 + i * 15, wy, 10, 8, 5000 + j * 10 + i, 0.5);
    R(g, 574, wy + 11, 66, 1, '#141b3a');
  }
}

function viaduct(g: Ctx, dyn: Dyn) {
  R(g, 0, 199, W, 3, '#0d1230');
  R(g, 0, 199, W, 1, '#24346a');
  R(g, 0, 202, W, 1, '#060813');
  for (let px = 30; px < W; px += 72) {
    R(g, px - 2, 202, 9, 2, '#0d1230');
    R(g, px, 204, 5, 96, '#0d1230');
    R(g, px, 204, 1, 96, '#1a244a');
    for (let y = 214; y < 300; y += 14) R(g, px, y, 5, 1, '#060813');
    dyn.beacons.push({ x: px + 2, y: 198, c: '#58c8d8', per: 3, ph: (px / 72) * 0.25, duty: 0.3 });
  }
}

// --------------------------------------------------------------- ad screens
function scan(g: Ctx, x: number, y: number, w: number, h: number) {
  g.fillStyle = 'rgba(4,5,14,0.24)';
  for (let j = 1; j < h; j += 2) g.fillRect(x, y + j, w, 1);
}
function glitchRows(g: Ctx, x: number, y: number, w: number, h: number, t: number) {
  const cols = ['#0a0d1f', '#0a0d1f', '#2ee6e6', '#ff2e88', '#c4e8e6', '#1a2650'];
  for (let j = 0; j < h; j++) {
    const q = hash(j, Math.floor(t * 24), 5);
    R(g, x, y + j, w, 1, cols[(q * cols.length) | 0]);
    if (q > 0.5) R(g, x + ((q * 977) % w | 0), y + j, 5, 1, '#0a0d1f');
  }
}
function drawWideAd(g: Ctx, x: number, y: number, t: number) {
  const w = 64;
  const h = 22;
  const L = 11;
  const k = Math.floor(t / L);
  const u = t - k * L;
  if (u < 0.22) return glitchRows(g, x, y, w, h, t);
  switch (k % 4) {
    case 0: {
      R(g, x, y, w, h, '#2a120e');
      R(g, x, y + 16, w, 6, '#4a1f12');
      R(g, x + 5, y + 9, 9, 8, '#fff2c4');
      R(g, x + 14, y + 11, 2, 4, '#fff2c4');
      P(g, x + 14, y + 12, '#2a120e');
      P(g, x + 14, y + 13, '#2a120e');
      R(g, x + 6, y + 10, 7, 2, '#7a3514');
      for (let i = 0; i < 3; i++) {
        const sy = Math.floor((t * 5 + i * 2.3) % 6);
        P(g, x + 7 + i * 2 + ((sy >> 1) & 1), y + 7 - sy, '#f7b040');
      }
      text(g, 'SYNTH', x + 21, y + 3, '#ffd87a', 2);
      text(g, 'COFFEE 24H', x + 21, y + 15, '#f7b040');
      break;
    }
    case 1: {
      R(g, x, y, w, h, '#06141c');
      text(g, 'KIRIN-9', x + 5, y + 3, '#2ee6e6', 2);
      text(g, 'NEURAL LAGER', x + 8, y + 15, '#a8fbfb');
      const sx = Math.floor((u * 34) % 110);
      if (sx < w - 3) {
        g.globalAlpha = 0.3;
        R(g, x + sx, y, 3, h, '#ffffff');
        g.globalAlpha = 1;
      }
      break;
    }
    case 2: {
      R(g, x, y, w, h, '#0a0d1f');
      for (let i = 0; i < 15; i++) {
        const bh = 2 + ((vnoise(t * 0.6 + i * 0.7, 40 + i) * 10) | 0);
        R(g, x + 2 + i * 4, y + 13 - bh, 3, bh, i % 5 === 2 ? '#ff2e88' : '#2ee6e6');
      }
      g.save();
      g.beginPath();
      g.rect(x, y + 14, w, 8);
      g.clip();
      const msg = 'NKX +2.4  OMNI -0.8  KOI +9.1  RAIN 100%  ';
      text(g, msg + msg, x - (Math.floor(t * 12) % (msg.length * 4)), y + 16, '#ffd87a');
      g.restore();
      break;
    }
    default: {
      R(g, x, y, w, h, '#1a0f3a');
      R(g, x, y + 15, w, 7, '#2a1658');
      disc(g, x + 11, y + 10, 6, '#ffd87a');
      disc(g, x + 14, y + 8, 5, '#1a0f3a');
      text(g, 'SLEEP IS', x + 24, y + 4, '#c9a3ff');
      text(g, 'A SERVICE', x + 24, y + 11, '#ff86c0');
      const z = Math.floor(t * 1.5) % 3;
      for (let i = 0; i <= z; i++) P(g, x + 17 + i * 2, y + 5 - i * 2, '#c9a3ff');
    }
  }
  scan(g, x, y, w, h);
}
const TALL_GLYPHS = ['ne', 'o', 'n', 'su', 'ka', 'ro', 'ki', 'a', 'to', 'sa'];
function drawTallAd(g: Ctx, x: number, y: number, t: number) {
  const w = 22;
  const h = 66;
  const L = 13;
  const k = Math.floor((t + 5) / L);
  const u = t + 5 - k * L;
  if (u < 0.22) return glitchRows(g, x, y, w, h, t);
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  switch (k % 3) {
    case 0: {
      R(g, x, y, w, h, '#1a0a2a');
      const off = Math.floor(t * 7) % (TALL_GLYPHS.length * 14);
      for (let i = 0; i < TALL_GLYPHS.length * 2; i++) {
        const gy = y + i * 14 - off;
        if (gy < y - 12 || gy > y + h) continue;
        glyph(g, KANA[TALL_GLYPHS[i % TALL_GLYPHS.length]], 5, x + 6, gy, i % 4 === 0 ? '#ffd0e8' : '#ff2e88', 2);
      }
      break;
    }
    case 1: {
      R(g, x, y, w, h, '#170c36');
      const sh = Math.floor(t * 3);
      for (let j = -9; j <= 9; j++) {
        if (j > 0 && (j + sh) % 3 === 0) continue;
        const hw = Math.round(Math.sqrt(81 - j * j));
        R(g, x + 11 - hw, y + 20 + j, hw * 2, 1, j < -4 ? '#ffd87a' : j < 1 ? '#f7a040' : j < 5 ? '#f0507a' : '#c82e98');
      }
      for (let j = 0; j < 4; j++) R(g, x, y + 33 + ((j * 3 + sh) % 9), w, 1, '#3a1a6a');
      text(g, 'NEO', x, y + 44, '#2ee6e6', 2);
      text(g, '2089', x + 3, y + 57, '#ff86c0');
      break;
    }
    default: {
      R(g, x, y, w, h, '#04100c');
      for (let c = 0; c < 7; c++) {
        const head = Math.floor((t * (7 + hash(c, 1) * 9) + hash(c, 2) * 90) % (h + 26));
        for (let j = 0; j < 14; j++) {
          const yy = y + head - j;
          if (yy < y || yy >= y + h) continue;
          if (hash(c, yy, Math.floor(t * 3)) < 0.3) continue;
          R(g, x + 1 + c * 3, yy, 2, 1, j === 0 ? '#c4ffe0' : j < 5 ? '#4dffa6' : j < 10 ? '#1a8a5a' : '#0e4a34');
        }
      }
    }
  }
  g.restore();
  scan(g, x, y, w, h);
}

// ---------------------------------------------------------------- the city
export class City {
  layer: Cv;
  via: Cv;
  dyn: Dyn = newDyn();
  viaDyn: Dyn = newDyn();
  beam: Cv;
  gMag = makeGlow(24, 52, '#ff2e88', 0.36, 4);
  gVio = makeGlow(22, 34, '#8f4dff', 0.4, 4);
  gCrim = makeGlow(40, 16, '#e8203c', 0.36, 4);
  gScreen = makeGlow(26, 46, '#5a6ae8', 0.26, 4);
  gBoard = makeGlow(46, 22, '#6a8ae8', 0.24, 4);
  gFan = makeGlow(26, 26, '#2a9aa0', 0.3, 4);
  gKoi = makeGlow(46, 22, '#2ee6e6', 0.2, 4);
  flyer: Cv;

  constructor() {
    const [c, g] = makeCanvas(W, 300);
    this.layer = c;
    c1(g, this.dyn);
    c2(g, this.dyn);
    c3(g, this.dyn);
    c4(g, this.dyn);
    c5(g, this.dyn);
    const [v, vg] = makeCanvas(W, 300);
    this.via = v;
    viaduct(vg, this.viaDyn);
    // holo-projector cone (dithered, static; flickers via alpha)
    const [b, bg] = makeCanvas(120, 120);
    this.beam = b;
    pixelFill(bg, 0, 0, 120, 120, (px, py) => {
      const d = 119 - py;
      if (Math.abs(px - 60) > 2 + d * 0.46) return null;
      const dens = 0.05 + 0.3 * (1 - d / 120) * (1 - Math.abs(px - 60) / (3 + d * 0.46));
      return dens > bayer(px, py) ? '#2ee6e6' : null;
    }, () => 0.16);
    this.flyer = sprite(
      ['....mmmmm....', '..mmlllllmm..', 'rmmmmmmmmmmmw', '.ddddddddddd.', '...c.....c...'],
      { m: '#1c2752', l: '#34507f', d: '#0a0d1f', r: '#e8203c', w: '#fff2c4', c: '#2ee6e6' },
    );
  }

  /** Windows, neon, screens and shopfronts of the mid layer. */
  drawDyn(g: Ctx, t: number) {
    drawWins(g, this.dyn.wins, t);
    // C1 kanji column
    const ks = ['ame', 'tsuki', 'naka', 'dai', 'mizu'];
    let sum = 0;
    for (let i = 0; i < 5; i++) {
      const lv = i === 3 ? flicker(60, t, 2.6) : flicker(50, t);
      sum += lv;
      glyph(g, KANJI[ks[i]], 7, 163, 114 + i * 15, neonCol('#ff2e88', lv));
    }
    glowAt(g, this.gMag, 166, 150, sum / 5);
    // hotel sign
    const hv = flicker(52, t, 0.7);
    ['ho', 'te', 'ru'].forEach((k, i) => glyph(g, KANA[k], 5, 422, 58 + i * 14, neonCol('#9a5aff', hv), 2));
    for (let y = 56; y < 100; y += 3) P(g, 432, y, (Math.floor(t * 4) + y) % 9 < 3 ? '#2ee6e6' : '#14506a');
    glowAt(g, this.gVio, 426, 78, hv);
    // noodle bar sign + lanterns
    const bv = flicker(53, t);
    glyph(g, KANJI.dai, 7, 203, 238, neonCol('#ff3a4a', bv));
    glyph(g, KANJI.naka, 7, 212, 238, neonCol('#ff3a4a', bv));
    text(g, 'NOODLES', 225, 239, neonCol('#ffb040', flicker(54, t, 1.5)));
    glowAt(g, this.gCrim, 230, 244, bv * 0.9);
    text(g, 'WASH', 268, 240, neonCol('#58d8e8', flicker(55, t)));
    this.shops(g, t);
    // screens
    drawWideAd(g, 104, 63, t);
    glowAt(g, this.gBoard, 136, 74, 0.8 + 0.2 * vnoise(t * 3, 4));
    drawTallAd(g, 318, 88, t);
    glowAt(g, this.gScreen, 329, 121, 0.8 + 0.2 * vnoise(t * 3, 5));
    // big backlit extractor fan
    drawFan(g, 606, 134, 13, t * 0.7, '#081018', '#2a8a90', '#0a1a20', 4);
    glowAt(g, this.gFan, 606, 134, 0.9);
    text(g, '24H', 580, 150, neonCol('#ff86c0', flicker(56, t, 1.4)));
  }

  private shops(g: Ctx, t: number) {
    for (let i = 0; i < 2; i++) {
      const x = 202 + i * 30;
      const y = 249;
      R(g, x, y, 26, 12, '#e89030');
      R(g, x, y, 26, 2, '#b2561a');
      R(g, x, y + 9, 26, 3, '#7a3514');
      P(g, x + 6, y + 2, '#fff2c4');
      P(g, x + 19, y + 2, '#fff2c4');
      for (const s of i === 0 ? [4, 11] : [3, 14, 21]) {
        R(g, x + s, y + 6, 3, 4, '#2a120e');
        R(g, x + s + 1, y + 4, 2, 2, '#2a120e');
      }
    }
    // the cook, forever pacing behind the counter
    const ph = t / 9;
    const cyc = Math.floor(ph);
    const m = clamp((ph - cyc - 0.55) / 0.45);
    const a = hash(cyc, 61);
    const b = hash(cyc + 1, 61);
    const cx = 216 + Math.round((a + (b - a) * m * m * (3 - 2 * m)) * 9);
    R(g, cx, 252, 3, 6, '#3a1a10');
    R(g, cx, 250, 3, 2, '#fff2c4');
    for (let i = 0; i < 2; i++) {
      const sy = Math.floor((t * 4 + i * 2.5) % 5);
      P(g, 222 + i * 3 + (sy & 1), 254 - sy, '#ffe8c0');
    }
    // laundromat under a tired fluorescent tube
    const fl = flicker(57, t, 2.2);
    R(g, 266, 249, 32, 12, fl > 0.9 ? '#a8d8d4' : fl > 0.3 ? '#6a98a0' : '#22304a');
    R(g, 266, 249, 32, 1, fl > 0.9 ? '#e8ffff' : '#3a506a');
    for (let k = 0; k < 3; k++) {
      const cx2 = 271 + k * 8;
      disc(g, cx2, 256, 3, '#1c2748');
      disc(g, cx2, 256, 2, '#0a0d1f');
      if (k !== 1) {
        const an = t * (k ? 5 : 7);
        P(g, cx2 + Math.round(Math.cos(an) * 1.3), 256 + Math.round(Math.sin(an) * 1.3), '#8fbfc8');
      }
    }
    R(g, 293, 254, 3, 7, '#1c2748');
    R(g, 293, 252, 2, 2, '#1c2748');
  }
}

/** Per-pixel rotating fan (no sprites, so it spins smoothly forever). */
export function drawFan(g: Ctx, cx: number, cy: number, r: number, ang: number, blade: string, bg: string, grille: string, blades = 3) {
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++) {
      const d2 = dx * dx + dy * dy;
      if (d2 > r * r + r * 0.6) continue;
      let col = bg;
      if (d2 <= 2) col = grille;
      else {
        const f = ((Math.atan2(dy, dx) + ang) * blades) / (Math.PI * 2);
        if (f - Math.floor(f) < 0.44) col = blade;
      }
      if ((dy + r) % 3 === 0 && col !== blade) col = grille;
      g.fillStyle = col;
      g.fillRect(cx + dx, cy + dy, 1, 1);
    }
}

// -------------------------------------------------------------------- train
/** Maglev on the viaduct. Returns head x while visible (the robot watches it). */
export function drawTrain(g: Ctx, t: number, glow: Cv): number | null {
  const SL = 64;
  const k = Math.floor(t / SL);
  const u = t - (k * SL + 4 + hash(k, 77) * 30);
  const speed = 84;
  const CAR = 29;
  const n = 5 + ((hash(k, 79) * 3) | 0);
  if (u < 0 || u * speed > W + n * CAR + 60) return null;
  const dir = hash(k, 78) < 0.5 ? 1 : -1;
  const head = Math.round(dir > 0 ? -20 + u * speed : W + 20 - u * speed);
  for (let c = 0; c < n; c++) {
    const x = dir > 0 ? head - (c + 1) * CAR + 1 : head + c * CAR;
    if (x > W || x < -CAR) continue;
    R(g, x, 193, 28, 6, '#1c2748');
    R(g, x + 1, 192, 26, 1, '#34507f');
    R(g, x, 198, 28, 1, '#8a2038');
    for (let i = 0; i < 8; i++) R(g, x + 3 + i * 3, 195, 2, 2, hash(c, i, k) < 0.86 ? '#ffd87a' : '#6a4a2a');
    if (c === 0) {
      const fx = dir > 0 ? x + 27 : x;
      R(g, fx, 193, 1, 2, '#0d1230');
      P(g, fx, 196, '#e8ffff');
      glowAt(g, glow, fx + dir * 3, 196, 1);
    }
    if (c === n - 1) P(g, dir > 0 ? x : x + 27, 196, '#e8203c');
  }
  // warm light sliding along the deck
  g.globalAlpha = 0.3;
  R(g, Math.max(0, dir > 0 ? head - n * CAR : head), 199, Math.min(W, n * CAR), 1, '#f7b040');
  g.globalAlpha = 1;
  return head;
}

// ------------------------------------------------------------------ traffic
export interface Lane { y: number; dir: number; sp: number; n: number; depth: number; seed: number; skip: number }
export const LANES_FAR: Lane[] = [
  { y: 131, dir: 1, sp: 9, n: 10, depth: 0, seed: 1, skip: 0.25 },
  { y: 142, dir: -1, sp: 12, n: 9, depth: 0, seed: 2, skip: 0.25 },
  { y: 170, dir: 1, sp: 7, n: 8, depth: 0, seed: 3, skip: 0.3 },
  { y: 88, dir: -1, sp: 6, n: 5, depth: 0, seed: 4, skip: 0.4 },
];
export const LANES_MID: Lane[] = [
  { y: 116, dir: -1, sp: 26, n: 4, depth: 1, seed: 5, skip: 0.3 },
  { y: 186, dir: 1, sp: 34, n: 3, depth: 1, seed: 6, skip: 0.3 },
];
export const LANES_NEAR: Lane[] = [{ y: 158, dir: 1, sp: 92, n: 1, depth: 2, seed: 7, skip: 0.55 }, { y: 100, dir: -1, sp: 74, n: 1, depth: 2, seed: 8, skip: 0.6 }];

export function drawLanes(g: Ctx, lanes: Lane[], t: number, flyer: Cv) {
  const S = W + 160;
  for (const ln of lanes)
    for (let i = 0; i < ln.n; i++) {
      const q = t * ln.sp + (i / ln.n) * S + hash(ln.seed, i) * 70;
      const k = Math.floor(q / S);
      if (hash(ln.seed, i, k + 1) < ln.skip) continue;
      const pos = q - k * S - 80;
      const x = Math.round(ln.dir > 0 ? pos : W - pos);
      const y = ln.y + Math.round((hash(ln.seed, i + 50, k) - 0.5) * 7);
      if (ln.depth === 0) {
        P(g, x, y, '#b8c8e8');
        P(g, x - ln.dir, y, '#a03048');
      } else if (ln.depth === 1) {
        const yy = y + Math.round(Math.sin(t * 0.9 + i * 2) * 1);
        R(g, x - 2, yy, 5, 2, '#080b1a');
        P(g, x + 2 * ln.dir, yy + 1, '#fff2c4');
        P(g, x - 2 * ln.dir, yy, '#e8203c');
        g.globalAlpha = 0.3;
        P(g, x + 3 * ln.dir, yy + 1, '#fff2c4');
        g.globalAlpha = 1;
      } else {
        const yy = y + Math.round(Math.sin(t * 1.3 + i) * 1.5);
        const police = hash(ln.seed, k, 99) < 0.3;
        if (ln.dir > 0) g.drawImage(flyer, x - 6, yy);
        else {
          g.save();
          g.translate(x + 7, yy);
          g.scale(-1, 1);
          g.drawImage(flyer, 0, 0);
          g.restore();
        }
        if (police) {
          const f = Math.floor(t * 6) & 1;
          R(g, x - 2, yy - 1, 2, 1, f ? '#ff3848' : '#3a0a14');
          R(g, x + 1, yy - 1, 2, 1, f ? '#0a143a' : '#4a7aff');
        }
        g.globalAlpha = 0.35;
        R(g, x + ln.dir * 7, yy + 2, 3, 1, '#fff2c4');
        g.globalAlpha = 1;
      }
    }
}

// ---------------------------------------------------------------------- koi
const KOI_MSG = ['KOI-NET', 'DREAM DEEPER', 'SWIM HOME', '2089'];
/** The neighbourhood's hologram: a koi circling forever above the rooftops. */
export function drawKoi(g: Ctx, t: number, city: City) {
  const flick = 0.82 + 0.18 * vnoise(t * 7, 71) - (hash(Math.floor(t * 11), 72) < 0.03 ? 0.4 : 0);
  // projector cone
  g.globalAlpha = clamp(flick);
  g.drawImage(city.beam, 249 - 60, 221 - 119);
  g.globalAlpha = 1;
  const a = t * 0.13;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const cx = 250 + sa * 36;
  const cy = 142 + Math.sin(t * 0.21 + 1) * 9;
  const dir = ca >= 0 ? 1 : -1;
  const fore = Math.max(0.24, Math.abs(ca));
  const S = 1 - 0.14 * ca;
  const L = Math.max(12, Math.round(76 * S * fore));
  const hx = Math.round(cx + (dir * L) / 2);
  const gk = Math.floor(t / 23);
  const gu = t - gk * 23 - hash(gk, 73) * 20;
  const glitch = gu > 0 && gu < 0.28;
  const gt = Math.floor(t * 20);

  g.globalCompositeOperation = 'lighter';
  // orbit trail
  for (let i = 0; i < 28; i++) {
    const an = (i / 28) * Math.PI * 2 + a;
    const depth = Math.cos(an);
    g.globalAlpha = (0.16 + 0.22 * (1 - depth) * 0.5) * flick * (i % 7 === 0 ? 2 : 1);
    P(g, 250 + Math.sin(an) * 50, 146 + depth * -6, i % 7 === 0 ? '#ff86c0' : '#2ee6e6');
  }
  for (let i = 0; i < L; i++) {
    const u = i / L;
    const x = hx - dir * i;
    let hh = u < 0.8 ? 9.5 * Math.pow(Math.sin(Math.PI * Math.pow(u / 0.8, 0.62) * 0.93), 0.85) : 2.6 + ((u - 0.8) / 0.2) * 8.4;
    hh *= S;
    const yc = cy + Math.sin(t * 2.4 - u * 5.2) * (0.5 + 4.2 * u * u) * S * (0.45 + 0.55 * fore);
    let top = Math.round(yc - hh);
    const bot = Math.round(yc + hh);
    if (u > 0.26 && u < 0.56) top -= Math.round(3.2 * S * Math.sin((Math.PI * (u - 0.26)) / 0.3)); // dorsal fin
    const pec = u > 0.2 && u < 0.36 ? Math.round((3 + Math.sin(t * 3) * 1.2) * S * Math.sin((Math.PI * (u - 0.2)) / 0.16)) : 0;
    for (let y = top; y <= bot + pec; y++) {
      const v = (y - yc) / (hh + 0.01);
      if (u > 0.87 && Math.abs(y - yc) < (u - 0.87) * 15 * S) continue; // tail fork
      if (u > 0.06 && u < 0.12 && v < -0.1 && v > -0.5) continue; // eye
      let col = '#1fb8c8';
      if (v < -1 || v > 1) col = '#ff86c0';
      else if (u >= 0.8) col = '#8a7aff';
      else {
        const s1 = Math.sin(u * 11 + 0.8) + Math.sin(v * 2.6 + u * 5);
        if (s1 > 1.0) col = '#ff2e88';
        else if (s1 < -1.15) col = '#d8ffff';
      }
      if (y === top || y === bot) col = '#a8fbfb';
      const xo = glitch && hash(y, gt) < 0.45 ? ((hash(y, 3, gt) * 11) | 0) - 5 : 0;
      g.globalAlpha = (y & 1 ? 0.3 : 0.8) * clamp(flick);
      g.fillStyle = col;
      g.fillRect(x + xo, y, 1, 1);
    }
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  glowAt(g, city.gKoi, cx, cy, clamp(flick) * (0.6 + 0.4 * fore));
  // tagline, typed out by the projector
  const mk = Math.floor(t / 10);
  const mu = t - mk * 10;
  const msg = KOI_MSG[mk % KOI_MSG.length];
  const shown = mu > 9.2 ? 0 : Math.min(msg.length, Math.floor(mu * 9));
  if (shown > 0) {
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.75 * clamp(flick);
    const tx = 250 - msg.length * 2;
    text(g, msg.slice(0, shown), tx, 178, '#ff2e88');
    if (shown < msg.length) R(g, tx + shown * 4, 178, 3, 5, '#ff86c0');
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }
}
