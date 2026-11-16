// Rain, splashes, ripples, smoke and drips. Particle systems are continuously
// simulated (never looped); timed events are derived from hashed time slots.
import { W, hash, rng, clamp, P, disc, ring } from './gfx';
import type { Ctx } from './gfx';

/** 0..1 wind strength: a slow swell plus rare, well-shaped gust events. */
export function gustAt(t: number): number {
  const swell = 0.5 + 0.5 * Math.sin(t * 0.05) * Math.sin(t * 0.013 + 1);
  const SL = 47;
  const k = Math.floor(t / SL);
  const u = t - (k * SL + hash(k, 31) * 30);
  const ev = hash(k, 32) < 0.55 && u > 0 && u < 10 ? Math.sin((Math.PI * u) / 10) ** 2 : 0;
  return clamp(swell * 0.22 + ev * 0.85);
}

interface Layer { n: number; x: Float32Array; y: Float32Array; v: Float32Array; len: Uint8Array; ground: number }

export class Rain {
  layers: Layer[] = [];
  rnd: () => number;
  constructor(seed: number) {
    this.rnd = rng(seed);
    // [count, vMin, vMax, lenMin, lenMax, ground]
    const defs = [
      [460, 120, 165, 2, 4, 300],
      [320, 215, 285, 4, 6, 300],
      [170, 360, 450, 7, 12, 372],
    ];
    for (const d of defs) {
      const L: Layer = { n: d[0], x: new Float32Array(d[0]), y: new Float32Array(d[0]), v: new Float32Array(d[0]), len: new Uint8Array(d[0]), ground: d[5] };
      for (let i = 0; i < L.n; i++) {
        L.x[i] = -250 + this.rnd() * (W + 260);
        L.y[i] = this.rnd() * d[5];
        L.v[i] = d[1] + this.rnd() * (d[2] - d[1]);
        L.len[i] = d[3] + Math.floor(this.rnd() * (d[4] - d[3] + 1));
      }
      this.layers.push(L);
    }
  }
  update(dt: number, slope: number) {
    for (const L of this.layers)
      for (let i = 0; i < L.n; i++) {
        const dy = L.v[i] * dt;
        L.y[i] += dy;
        L.x[i] += dy * slope;
        if (L.y[i] - L.len[i] > L.ground || L.x[i] > W + 14) {
          L.y[i] = -this.rnd() * 40;
          L.x[i] = -250 + this.rnd() * (W + 260);
        }
      }
  }
  draw(g: Ctx, li: number, slope: number, amount: number, base: string, tint?: (x: number, y: number) => string | null) {
    const L = this.layers[li];
    const n = Math.min(L.n, Math.floor(L.n * amount));
    g.fillStyle = base;
    for (let i = 0; i < n; i++) {
      const x = L.x[i];
      const y = L.y[i];
      if (x < -2 || y < 0) continue;
      const xi = x | 0;
      const yi = y | 0;
      const len = L.len[i];
      let tinted = false;
      if (tint) {
        const c = tint(xi, yi);
        if (c) {
          g.fillStyle = c;
          tinted = true;
        }
      }
      for (let k = 0; k < len; k++) g.fillRect(xi - Math.round(k * slope), yi - k, 1, 1);
      if (tinted) g.fillStyle = base;
    }
  }
}

const N_SPL = 220;
export class Splashes {
  x = new Float32Array(N_SPL);
  y = new Float32Array(N_SPL);
  age = new Float32Array(N_SPL).fill(9);
  kind = new Uint8Array(N_SPL);
  head = 0;
  spawn(x: number, y: number, kind: number) {
    const i = this.head;
    this.head = (i + 1) % N_SPL;
    this.x[i] = x;
    this.y[i] = y;
    this.age[i] = 0;
    this.kind[i] = kind;
  }
  update(dt: number) {
    for (let i = 0; i < N_SPL; i++) this.age[i] += dt;
  }
  /** Crown splashes on hard surfaces. */
  draw(g: Ctx) {
    for (let i = 0; i < N_SPL; i++) {
      if (this.kind[i] !== 0) continue;
      const a = this.age[i];
      if (a > 0.24) continue;
      const x = this.x[i] | 0;
      const y = this.y[i] | 0;
      if (a < 0.07) P(g, x, y - 1, 'rgba(200,232,240,0.75)');
      else if (a < 0.15) {
        g.fillStyle = 'rgba(180,220,236,0.55)';
        g.fillRect(x - 1, y - 2, 1, 1);
        g.fillRect(x + 1, y - 2, 1, 1);
      } else {
        g.fillStyle = 'rgba(160,200,226,0.3)';
        g.fillRect(x - 2, y - 1, 1, 1);
        g.fillRect(x + 2, y - 1, 1, 1);
      }
    }
  }
  /** Expanding rings, drawn into the puddle layer (so they clip to water). */
  drawRipples(g: Ctx) {
    for (let i = 0; i < N_SPL; i++) {
      if (this.kind[i] !== 1) continue;
      const a = this.age[i];
      if (a > 0.7) continue;
      const r = 1 + a * 8;
      ring(g, this.x[i] | 0, this.y[i] | 0, r, r * 0.42, a < 0.25 ? 'rgba(190,225,240,0.6)' : a < 0.48 ? 'rgba(170,205,230,0.36)' : 'rgba(150,190,220,0.18)');
    }
  }
}

interface Puff { x: number; y: number; vx: number; vy: number; age: number; life: number; r1: number; ph: number }
export interface SmokeDef {
  x: number; y: number; rate: number; vx: number; vy: number; life: number; r0: number; r1: number;
  spread: number; windK: number; cols: string[];
}
export class Smoke {
  p: Puff[] = [];
  acc = 0;
  rnd: () => number;
  def: SmokeDef;
  constructor(def: SmokeDef, seed: number) {
    this.def = def;
    this.rnd = rng(seed);
  }
  update(dt: number, wind: number, active = 1) {
    const d = this.def;
    this.acc += dt * d.rate * active;
    while (this.acc >= 1) {
      this.acc -= 1;
      this.p.push({
        x: d.x + (this.rnd() - 0.5) * 2, y: d.y, vx: d.vx + (this.rnd() - 0.5) * d.spread, vy: d.vy * (0.75 + this.rnd() * 0.5),
        age: 0, life: d.life * (0.7 + this.rnd() * 0.6), r1: d.r1 * (0.7 + this.rnd() * 0.5), ph: this.rnd() * 6.28,
      });
    }
    for (let i = this.p.length - 1; i >= 0; i--) {
      const q = this.p[i];
      q.age += dt;
      if (q.age >= q.life) {
        this.p[i] = this.p[this.p.length - 1];
        this.p.pop();
        continue;
      }
      const u = q.age / q.life;
      q.x += (q.vx * (1 - u * 0.6) + wind * d.windK * (0.3 + u) + Math.sin(q.age * 1.7 + q.ph) * 2.2) * dt;
      q.y += q.vy * (1 - u * 0.5) * dt;
    }
  }
  draw(g: Ctx) {
    const d = this.def;
    for (const q of this.p) {
      const u = q.age / q.life;
      const r = Math.round(d.r0 + (q.r1 - d.r0) * Math.sqrt(u));
      disc(g, q.x, q.y, r, d.cols[Math.min(d.cols.length - 1, (u * d.cols.length) | 0)]);
    }
  }
}

// ----------------------------------------------------------------- drips
export interface Drip { x: number; y0: number; y1: number; per: number; ph: number }
/** Stateless gravity drips: swell, let go, fall, splash. Each on its own clock. */
export function drawDrips(g: Ctx, drips: Drip[], t: number) {
  for (const d of drips) {
    const cyc = t / d.per + d.ph;
    const k = Math.floor(cyc);
    const u = (cyc - k) * d.per;
    const hang = d.per * (0.3 + 0.3 * hash(d.x, k, 17));
    if (u < hang) {
      if (u > hang * 0.45) P(g, d.x, d.y0, 'rgba(170,215,235,0.7)');
      if (u > hang * 0.8) P(g, d.x, d.y0 + 1, 'rgba(200,235,245,0.8)');
      continue;
    }
    const tau = u - hang;
    const y = d.y0 + 270 * tau * tau;
    if (y < d.y1 - 1) {
      g.fillStyle = 'rgba(190,228,242,0.8)';
      g.fillRect(d.x, y | 0, 1, tau > 0.22 ? 3 : 2);
    } else {
      const s = tau - Math.sqrt((d.y1 - d.y0) / 270);
      if (s < 0.08) P(g, d.x, d.y1 - 1, 'rgba(210,238,246,0.8)');
      else if (s < 0.16) {
        P(g, d.x - 1, d.y1 - 2, 'rgba(190,225,240,0.6)');
        P(g, d.x + 1, d.y1 - 2, 'rgba(190,225,240,0.6)');
      } else if (s < 0.24) {
        P(g, d.x - 2, d.y1 - 1, 'rgba(170,205,230,0.35)');
        P(g, d.x + 2, d.y1 - 1, 'rgba(170,205,230,0.35)');
      }
    }
  }
}
