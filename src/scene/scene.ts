// Scene compositor. Everything is rendered into one 640x360 buffer, back to
// front, then handed to the display for an exact nearest-neighbour upscale.
import {
  W, H, makeCanvas, makeGlow, pixelFill, bayer, clamp, hash, rng, glowAt, newDyn, drawBeacons, drawTwinkles, wrapDraw, R, P,
} from './gfx';
import type { Ctx, Cv, Dyn } from './gfx';
import { buildSky, buildBands, buildFar, buildMidFar, lightningAt, drawSearchlight, drawBlimp } from './sky';
import { City, drawTrain, drawLanes, drawKoi, LANES_FAR, LANES_MID, LANES_NEAR } from './city';
import { Roof, FLOOR, brownout } from './roof';
import { Rain, Splashes, Smoke, gustAt } from './weather';

export { setCanvasFactory, W, H, hash } from './gfx';

const smokeCols = (r: number, g: number, b: number, a: number[]) => a.map((v) => `rgba(${r},${g},${b},${v})`);

export class Scene {
  cv: Cv;
  g: Ctx;
  /** 0.45 drizzle .. 1 downpour */
  rainLevel = 0.75;

  sky = buildSky();
  clouds1 = buildBands(11, 1280, 170, 128, 48, 0.44, 0.055, ['#0a0e24', '#10173a', '#171f4a'], null, (u) => 1 - u * 0.2);
  clouds2 = buildBands(12, 1024, 120, 128, 32, 0.56, 0.05, ['#070a1c', '#05070f'], null, (u) => 0.75 + 0.25 * Math.sin(Math.PI * u));
  fog1 = buildBands(13, 768, 90, 96, 24, 0.33, 0.06, ['#3d5488', '#3d5488', '#3d5488'], [0.12, 0.22, 0.33], (u) => Math.sin(Math.PI * u));
  fog2 = buildBands(14, 1024, 90, 128, 24, 0.34, 0.06, ['#2c4274', '#2c4274', '#2c4274'], [0.14, 0.25, 0.36], (u) => Math.sin(Math.PI * u));
  fog3 = buildBands(15, 768, 70, 96, 16, 0.36, 0.06, ['#34507f', '#34507f', '#34507f'], [0.1, 0.18, 0.27], (u) => Math.sin(Math.PI * u));
  dynA: Dyn = newDyn();
  dynB: Dyn = newDyn();
  far: Cv;
  midFar: Cv;
  city = new City();
  roof = new Roof();
  rain = new Rain(2089);
  spl = new Splashes();
  rnd = rng(237);
  splAcc = 0;
  surfLen = 0;
  /** Maglev head position while a train is passing (else null). */
  trainX: number | null = null;

  boltGlow = makeGlow(170, 80, '#8fa8ff', 0.5, 5, 1.4);
  trainGlow = makeGlow(9, 5, '#c8f0ff', 0.5, 3);
  poolWarm = makeGlow(92, 16, '#e08326', 0.3, 4);
  poolDoor = makeGlow(22, 9, '#f7b040', 0.3, 3);
  poolVend = makeGlow(34, 12, '#7adada', 0.26, 3);
  poolLamp = makeGlow(40, 13, '#f7a838', 0.28, 4);
  poolPink = makeGlow(30, 10, '#ff3a90', 0.2, 3);
  vignette: Cv;

  smChimney = new Smoke({ x: 207, y: 209, rate: 3.2, vx: 0, vy: -7.5, life: 8, r0: 1, r1: 5, spread: 2, windK: 16, cols: smokeCols(78, 92, 138, [0.5, 0.4, 0.3, 0.2, 0.1]) }, 1);
  smDuct = new Smoke({ x: 194, y: 258, rate: 7, vx: 13, vy: -15, life: 2.6, r0: 1, r1: 4, spread: 5, windK: 10, cols: smokeCols(170, 195, 225, [0.42, 0.32, 0.22, 0.12, 0.06]) }, 2);
  smStove = new Smoke({ x: 483, y: 193, rate: 1.8, vx: 0, vy: -6.5, life: 5, r0: 0, r1: 3, spread: 2, windK: 14, cols: smokeCols(150, 135, 160, [0.4, 0.3, 0.2, 0.1]) }, 3);
  smValve = new Smoke({ x: 74, y: 215, rate: 24, vx: 42, vy: -5, life: 1.3, r0: 1, r1: 4, spread: 10, windK: 6, cols: smokeCols(200, 220, 240, [0.45, 0.32, 0.2, 0.1]) }, 4);

  refl: Cv;
  reflG: Ctx;
  pud: Cv;
  pudG: Ctx;

  constructor() {
    [this.cv, this.g] = makeCanvas(W, H);
    [this.refl, this.reflG] = makeCanvas(W, 60);
    [this.pud, this.pudG] = makeCanvas(W, 60);
    this.far = buildFar(this.dynA);
    this.midFar = buildMidFar(this.dynB);
    for (const s of this.roof.surfaces) this.surfLen += s[1] - s[0];
    const [v, vg] = makeCanvas(W, H);
    this.vignette = v;
    const lvAt = (x: number, y: number) => {
      const dx = (x - 320) / 320;
      const dy = (y - 180) / 180;
      const a = clamp((Math.sqrt(dx * dx * 0.9 + dy * dy * 0.8) - 0.8) / 0.5) * 3;
      const lv = Math.floor(a);
      return a - lv > bayer(x, y) ? lv + 1 : lv;
    };
    pixelFill(vg, 0, 0, W, H, (x, y) => (lvAt(x, y) > 0 ? '#020308' : null), (x, y) => lvAt(x, y) * 0.15);
    // let smoke and rain settle before the first visible frame
    for (let i = 0; i < 360; i++) this.step(1 / 30, i / 30);
  }

  private amount(gs: number) {
    return clamp(this.rainLevel * (0.78 + 0.42 * gs));
  }

  /** Advance the continuous particle systems. */
  step(dt: number, t: number) {
    const gs = gustAt(t);
    const slope = 0.1 + 0.55 * gs;
    const roof = this.roof;
    this.rain.update(dt, slope);
    this.spl.update(dt);
    this.splAcc += dt * 95 * this.amount(gs);
    while (this.splAcc >= 1) {
      this.splAcc -= 1;
      const r = this.rnd();
      if (r < 0.5) {
        const x = (this.rnd() * W) | 0;
        const y = 1 + ((this.rnd() * 58) | 0);
        if (roof.puddle[y * W + x]) this.spl.spawn(x, y, 1);
        else this.spl.spawn(x, FLOOR + y, 0);
      } else if (r < 0.6) {
        const [x, y] = roof.umbrellaHit(this.rnd());
        this.spl.spawn(x, y, 0);
      } else {
        let q = this.rnd() * this.surfLen;
        for (const s of roof.surfaces) {
          if (q < s[1] - s[0]) {
            this.spl.spawn(s[0] + q, s[2], 0);
            break;
          }
          q -= s[1] - s[0];
        }
      }
    }
    this.smChimney.update(dt, gs);
    this.smDuct.update(dt, gs);
    this.smStove.update(dt, gs);
    const vk = Math.floor(t / 23);
    const vu = t - vk * 23 - hash(vk, 141) * 16;
    this.smValve.update(dt, gs, vu > 0 && vu < 2.6 ? 1 : 0);
  }

  private drone(g: Ctx, t: number) {
    const SL = 230;
    const k = Math.floor(t / SL);
    const u = t - k * SL - 40 - hash(k, 151) * 120;
    if (u < 0 || u > 22) return;
    const e = (v: number) => {
      const c = clamp(v);
      return c * c * (3 - 2 * c);
    };
    let x: number;
    let y: number;
    if (u < 6) {
      x = 690 - 190 * e(u / 6);
      y = 50 + 104 * e(u / 6);
    } else if (u < 15) {
      x = 500 + Math.sin(u * 0.9) * 3;
      y = 154 + Math.sin(u * 2.3) * 1.5;
    } else {
      x = 500 - 560 * e((u - 15) / 7);
      y = 154 - 90 * e((u - 15) / 7);
    }
    x = Math.round(x);
    y = Math.round(y);
    R(g, x - 3, y, 7, 2, '#141b3a');
    R(g, x - 1, y + 2, 3, 2, '#b89020');
    const f = Math.floor(t * 24) & 1;
    R(g, x - 6 + f, y - 1, 3, 1, '#486e96');
    R(g, x + 3 - f, y - 1, 3, 1, '#486e96');
    if (t % 0.6 < 0.3) P(g, x - 3, y + 1, '#4dffa6');
    else P(g, x + 3, y + 1, '#ff3848');
    if (u > 7 && u < 14) for (let j = 4; j < 24; j += 2) P(g, x + (((j >> 1) + Math.floor(t * 8)) & 1), y + j, 'rgba(46,230,230,0.55)');
  }

  render(t: number) {
    const g = this.g;
    const city = this.city;
    const roof = this.roof;
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    const gs = gustAt(t);
    const slope = 0.1 + 0.55 * gs;
    const amt = this.amount(gs);

    // ------------------------------------------------------------ sky
    g.drawImage(this.sky, 0, 0);
    const lt = lightningAt(t);
    glowAt(g, this.boltGlow, lt.x, lt.y, lt.a);
    wrapDraw(g, this.clouds1, t * 1.3, 0);
    if (lt.a > 0) {
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = lt.a * 0.5;
      wrapDraw(g, this.clouds1, t * 1.3, 0);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
    }
    wrapDraw(g, this.clouds2, t * 3.1 + 300, 18);
    drawBlimp(g, t);
    drawSearchlight(g, 150, 200, 0.34 * Math.sin(t * 0.11), 190, '#8aa8e0');
    drawSearchlight(g, 592, 190, -0.18 + 0.3 * Math.sin(t * 0.083 + 2), 180, '#8aa8e0');

    // ------------------------------------------------------------ far city
    g.drawImage(this.far, 0, 0);
    drawTwinkles(g, this.dynA.twinkles, t);
    drawBeacons(g, this.dynA.beacons, t);
    wrapDraw(g, this.fog1, t * 2.2, 140);
    drawLanes(g, LANES_FAR, t, city.flyer);
    this.rain.draw(g, 0, slope, amt, 'rgba(110,150,200,0.34)');
    g.drawImage(this.midFar, 0, 0);
    drawTwinkles(g, this.dynB.twinkles, t);
    drawBeacons(g, this.dynB.beacons, t);
    wrapDraw(g, this.fog2, -t * 3.4, 176);

    // ------------------------------------------------------------ maglev
    g.drawImage(city.via, 0, 0);
    drawBeacons(g, city.viaDyn.beacons, t);
    const trainX = drawTrain(g, t, this.trainGlow);
    this.trainX = trainX;
    drawLanes(g, LANES_MID, t, city.flyer);

    // ------------------------------------------------------------ neighbourhood
    g.drawImage(city.layer, 0, 0);
    city.drawDyn(g, t);
    drawBeacons(g, city.dyn.beacons, t);
    this.smChimney.draw(g);
    drawKoi(g, t, city);
    drawLanes(g, LANES_NEAR, t, city.flyer);
    this.rain.draw(g, 1, slope, amt, 'rgba(140,185,215,0.46)', roof.tint);
    wrapDraw(g, this.fog3, t * 5.2, 232);

    // ------------------------------------------------------------ rooftop
    g.drawImage(roof.fg, 0, 0);
    roof.drawDyn(g, t, { gust: gs, trainX });
    this.smDuct.draw(g);
    this.smStove.draw(g);
    this.smValve.draw(g);
    this.drone(g, t);

    // ------------------------------------------------------------ wet floor
    const rg = this.reflG;
    rg.clearRect(0, 0, W, 60);
    for (let j = 0; j < 60; j++) {
      const sy = 299 - Math.floor(j * 1.9);
      const dx = Math.round(Math.sin(j * 0.8 + t * 2.0) + Math.sin(j * 0.31 - t * 1.3) * (0.4 + j * 0.02));
      rg.drawImage(this.cv, 0, sy, W, 1, dx, j, W, 1);
    }
    g.drawImage(roof.floor, 0, FLOOR);
    g.globalAlpha = 0.3;
    g.drawImage(this.refl, 0, FLOOR);
    g.globalAlpha = 1;
    const br = brownout(t);
    glowAt(g, this.poolWarm, 470, 306, br);
    glowAt(g, this.poolDoor, 398, 304, br);
    glowAt(g, this.poolVend, 590, 305, br);
    glowAt(g, this.poolLamp, 600, 312, br);
    glowAt(g, this.poolPink, 84, 306, 1);
    const pg = this.pudG;
    pg.globalCompositeOperation = 'source-over';
    pg.clearRect(0, 0, W, 60);
    pg.drawImage(this.refl, 0, 0);
    this.spl.drawRipples(pg);
    pg.globalCompositeOperation = 'destination-in';
    pg.drawImage(roof.puddleMask, 0, 0);
    g.globalAlpha = 0.8;
    g.drawImage(this.pud, 0, FLOOR);
    g.globalAlpha = 1;

    // ------------------------------------------------------------ near rain
    this.spl.draw(g);
    this.rain.draw(g, 2, slope, amt, 'rgba(185,222,238,0.52)', roof.tint);
    g.drawImage(roof.front, 0, 0);
    g.drawImage(this.vignette, 0, 0);
  }

  frame(t: number, dt: number) {
    if (dt > 0) this.step(dt, t);
    this.render(t);
  }
}
