// Foreground: the rooftop, the NITE OWL hideaway and everything living on it.
import {
  W, H, makeCanvas, pixelFill, makeGlow, rng, hash, vnoise, clamp, R, P, line, disc, mix, ditherPick, bayer, text, glyph,
  KANA, sprite, flicker, neonCol, glowAt, vine, fern,
} from './gfx';
import type { Ctx, Cv } from './gfx';
import { drawFan } from './city';
import { drawDrips } from './weather';
import type { Drip } from './weather';

export const FLOOR = 300;
const WX = 420;
const WY = 235;
const WW = 100;
const WH = 50;
const ROBOT_X = 296;
const UMB_X = 300;
const UMB_Y = 257;

export interface Env { gust: number; trainX: number | null }

const WARM_LEAF = ['#2a4a22', '#4a7a32', '#6aa04a'];

function leftWall(g: Ctx) {
  R(g, 0, 0, 72, 300, '#070915');
  const r = rng(5);
  for (let y = 3; y < 300; y += 5) {
    R(g, 0, y, 70, 1, '#0a0d1e');
    for (let x = ((y / 5) & 1) * 5 + 2; x < 70; x += 10) R(g, x, y + 1, 1, 4, '#0a0d1e');
  }
  for (let i = 0; i < 70; i++) R(g, (r() * 70) | 0, (r() * 300) | 0, 1, 3 + ((r() * 14) | 0), '#05060f');
  for (let i = 0; i < 60; i++) P(g, (r() * 70) | 0, (r() * 300) | 0, '#111733');
  R(g, 70, 0, 2, 300, '#0c1024');
  R(g, 71, 0, 1, 300, '#1a2650');
  // cornice
  R(g, 0, 128, 77, 5, '#0d1228');
  R(g, 0, 128, 77, 1, '#2c3f70');
  R(g, 0, 133, 75, 1, '#04050c');
  // window A (someone is awake)
  R(g, 10, 146, 50, 54, '#04050c');
  R(g, 12, 148, 46, 50, '#131a36');
  const ramp = ['#f0a848', '#d98830', '#b86a24', '#8e4c1c', '#643214'];
  pixelFill(g, 14, 150, 42, 46, (x, y) => {
    const d = Math.hypot(x - 30, (y - 160) * 1.1) / 11;
    const i = Math.min(ramp.length - 2, Math.floor(d));
    return ditherPick(ramp[i], ramp[i + 1], Math.min(1, d - i), x, y);
  });
  R(g, 8, 200, 54, 3, '#131a36');
  R(g, 8, 200, 54, 1, '#34507f');
  // window C, high up: a kitchen under a tired fluorescent tube
  R(g, 18, 62, 30, 36, '#04050c');
  R(g, 20, 64, 26, 32, '#131a36');
  R(g, 16, 98, 34, 2, '#131a36');
  R(g, 16, 98, 34, 1, '#2c3f70');
  // window B (late-night television)
  R(g, 12, 222, 34, 34, '#04050c');
  R(g, 14, 224, 30, 30, '#131a36');
  R(g, 10, 256, 38, 2, '#131a36');
  R(g, 10, 256, 38, 1, '#2c3f70');
  // wall-mounted AC with a slow leak
  R(g, 46, 208, 16, 11, '#141b3a');
  R(g, 46, 208, 16, 1, '#2c3f70');
  for (let y = 211; y < 218; y += 2) R(g, 48, y, 9, 1, '#080b1a');
  P(g, 60, 210, '#0a0d1e');
  // drainpipe and spout
  R(g, 62, 0, 3, 128, '#111733');
  R(g, 62, 133, 3, 75, '#111733');
  R(g, 62, 219, 3, 33, '#111733');
  R(g, 62, 0, 1, 252, '#1e2b58');
  for (let y = 24; y < 250; y += 44) R(g, 61, y, 5, 2, '#0a0d1e');
  R(g, 62, 250, 18, 3, '#111733');
  R(g, 62, 250, 18, 1, '#1e2b58');
  R(g, 78, 252, 3, 2, '#0a0d1e');
  // steam valve
  R(g, 66, 213, 7, 5, '#1a244a');
  R(g, 68, 211, 3, 2, '#5c2c1e');
  // sign brackets + board
  R(g, 72, 60, 5, 1, '#111733');
  R(g, 72, 120, 5, 1, '#111733');
  R(g, 76, 54, 14, 74, '#05060f');
  R(g, 76, 54, 14, 1, '#1a244a');
  R(g, 76, 54, 1, 74, '#1a244a');
  // vines reclaiming the brickwork
  vine(g, 4, 0, 46, 11);
  vine(g, 9, 0, 70, 12);
  vine(g, 15, 0, 30, 13);
  vine(g, 52, 133, 16, 14);
  vine(g, 3, 133, 30, 15);
  vine(g, 67, 0, 40, 16);
  vine(g, 24, 0, 18, 17);
  fern(g, 14, 200, 7, 21);
  fern(g, 52, 200, 6, 22);
  R(g, 11, 197, 6, 3, '#3a1c18');
  R(g, 49, 197, 6, 3, '#3a1c18');
}

function acUnit(g: Ctx, x: number, y: number, w: number, h: number, cx: number, cy: number, fr: number) {
  R(g, x, y, w, h, '#111836');
  R(g, x, y, w, 2, '#2c3f70');
  R(g, x, y + 2, 1, h - 2, '#1c2850');
  R(g, x + w - 1, y + 2, 1, h - 2, '#080b1a');
  for (let yy = y + 5; yy < y + h - 3; yy += 2) R(g, x + w - 8, yy, 5, 1, '#080b1a');
  disc(g, cx, cy, fr + 2, '#1c2850');
  disc(g, cx, cy, fr + 1, '#05060f');
}

function leftGear(g: Ctx) {
  acUnit(g, 92, 270, 36, 30, 108, 286, 9);
  acUnit(g, 132, 279, 30, 21, 144, 290, 7);
  // refrigerant lines to the wall
  R(g, 72, 266, 26, 1, '#1a244a');
  R(g, 97, 266, 1, 4, '#1a244a');
  R(g, 72, 268, 20, 1, '#5c2c1e');
  // pot plant on the AC
  R(g, 150, 275, 6, 4, '#5c2c1e');
  R(g, 150, 275, 6, 1, '#7e4226');
  fern(g, 153, 275, 7, 31);
  // exhaust duct
  R(g, 174, 262, 12, 38, '#151d3e');
  R(g, 174, 262, 2, 38, '#2c3f70');
  R(g, 184, 262, 2, 38, '#0a0d1e');
  for (let y = 270; y < 300; y += 9) R(g, 173, y, 14, 1, '#0a0d1e');
  R(g, 174, 253, 19, 10, '#151d3e');
  R(g, 174, 253, 19, 1, '#34507f');
  R(g, 174, 254, 1, 9, '#2c3f70');
  for (let y = 255; y < 262; y += 2) R(g, 190, y, 4, 1, '#05060f');
  // string-light pole
  R(g, 200, 236, 2, 64, '#0f142c');
  R(g, 200, 236, 1, 64, '#22305c');
  R(g, 197, 296, 8, 4, '#0a0d1e');
  // planter crates under the spout
  R(g, 82, 292, 9, 8, '#2a1820');
  R(g, 82, 292, 9, 1, '#5c2c1e');
  fern(g, 86, 292, 6, 33);
}

function parapet(g: Ctx) {
  R(g, 188, 287, 186, 13, '#0b0e20');
  R(g, 188, 285, 186, 2, '#141b3a');
  R(g, 188, 285, 186, 1, '#34507f');
  const r = rng(41);
  for (let x = 196; x < 372; x += 17) R(g, x, 287, 1, 13, '#070915');
  for (let i = 0; i < 26; i++) P(g, 188 + ((r() * 186) | 0), 285, '#6494ae');
  for (let i = 0; i < 20; i++) R(g, 188 + ((r() * 186) | 0), 287, 1, 2 + ((r() * 6) | 0), '#070915');
  R(g, 188, 296, 186, 1, '#1a244a');
  R(g, 188, 297, 186, 1, '#05060f');
  for (let x = 204; x < 372; x += 34) R(g, x, 295, 2, 4, '#0a0d1e');
  text(g, 'NO SLEEP', 222, 289, '#4a2a7a');
  R(g, 222, 295, 20, 1, '#1a5a6a');
  // junction box
  R(g, 334, 288, 9, 9, '#18224a');
  R(g, 334, 288, 9, 1, '#34507f');
  // improvised planters
  const pots: [number, number, string][] = [[208, 5, '#5c2c1e'], [219, 7, '#2a3a5a'], [232, 5, '#3a1c18'], [352, 6, '#5c2c1e']];
  pots.forEach(([x, s, c], i) => {
    R(g, x - 3, 281, 7, 4, c);
    R(g, x - 3, 281, 7, 1, mix(c, '#8fbfc8', 0.3));
    fern(g, x, 281, s, 50 + i);
  });
}

function interior(g: Ctx) {
  const ramp = ['#f6b85c', '#e39a3a', '#c67a2a', '#a25c20', '#7e4218', '#5c2c12', '#44200e'];
  pixelFill(g, WX, WY, WW, WH, (x, y) => {
    const d = Math.hypot((x - 466) * 0.8, (y - 248) * 1.25) / 13;
    const i = Math.min(ramp.length - 2, Math.floor(d));
    return ditherPick(ramp[i], ramp[i + 1], Math.min(1, d - i), x, y);
  });
  g.fillStyle = 'rgba(46,16,8,0.4)';
  g.fillRect(WX, 268, WW, 17);
  R(g, WX, 267, WW, 1, '#5c2c12');
  // bookshelf
  R(g, 423, 240, 27, 43, '#3a1a0e');
  R(g, 424, 241, 25, 41, '#24100a');
  const r = rng(31);
  const spines = ['#9a3a2a', '#2a6a7a', '#d8a850', '#6a4a8a', '#3a7a5a', '#c86a30', '#e8d8b0', '#b84a5a'];
  for (let s = 0; s < 4; s++) {
    const sy = 250 + s * 10;
    R(g, 424, sy, 25, 1, '#6a3418');
    let bx = 425;
    while (bx < 447) {
      const bw = 1 + ((r() * 2) | 0);
      const bh = 5 + ((r() * 3) | 0);
      if (r() < 0.88) R(g, bx, sy - bh, bw, bh, spines[(r() * spines.length) | 0]);
      bx += bw + (r() < 0.2 ? 1 : 0);
    }
  }
  R(g, 428, 237, 5, 3, '#b85a30');
  P(g, 429, 236, '#6aa04a');
  P(g, 431, 235, '#6aa04a');
  P(g, 432, 236, '#4a7a32');
  vine(g, 449, 240, 15, 3, WARM_LEAF);
  // pendant lamp
  R(g, 466, 235, 1, 5, '#2a120e');
  R(g, 463, 240, 7, 1, '#3a1a0e');
  R(g, 462, 241, 9, 2, '#6a3418');
  R(g, 461, 243, 11, 1, '#3a1a0e');
  R(g, 465, 244, 3, 2, '#fff2c4');
  // poster: moon over a skyline
  R(g, 476, 246, 13, 15, '#2a120e');
  R(g, 477, 247, 11, 13, '#3a2a6a');
  disc(g, 485, 251, 2, '#ffd87a');
  R(g, 477, 256, 3, 4, '#1a1030');
  R(g, 480, 254, 2, 6, '#1a1030');
  R(g, 483, 257, 3, 3, '#1a1030');
  R(g, 486, 255, 2, 5, '#1a1030');
  P(g, 479, 249, '#c9a3ff');
  // clock housing
  R(g, 492, 239, 23, 9, '#1a0a0a');
  R(g, 492, 239, 23, 1, '#4a2414');
  // chair + legs
  R(g, 462, 262, 3, 23, '#2a120e');
  R(g, 462, 262, 1, 23, '#6a3418');
  R(g, 462, 277, 18, 2, '#2a120e');
  R(g, 470, 274, 12, 4, '#2a2a4a');
  // desk
  R(g, 478, 272, 42, 1, '#d08a3a');
  R(g, 478, 273, 42, 1, '#8a4a20');
  R(g, 480, 274, 40, 11, '#4a2414');
  R(g, 480, 274, 2, 11, '#34180c');
  R(g, 498, 277, 18, 1, '#34180c');
  P(g, 507, 280, '#d08a3a');
  // monitor + keyboard
  R(g, 499, 255, 18, 14, '#1a1020');
  R(g, 499, 255, 18, 1, '#4a3a4a');
  R(g, 506, 269, 4, 3, '#1a1020');
  R(g, 503, 271, 10, 1, '#1a1020');
  P(g, 499, 259, '#ffd87a');
  R(g, 485, 271, 11, 1, '#2a1a2a');
  P(g, 487, 271, '#58a8b0');
  P(g, 490, 271, '#58a8b0');
  P(g, 493, 271, '#58a8b0');
  // inner sill (the cat's spot) and fairy-light wire
  R(g, WX, 283, 32, 2, '#7a4218');
  R(g, WX, 283, 32, 1, '#b86a2a');
  R(g, WX, 236, WW, 1, '#2a120e');
}

function hideaway(g: Ctx) {
  const r = rng(77);
  for (let px = 380; px < 548; px += 14) {
    const c = ['#131a38', '#111733', '#151d3e', '#10152e'][(r() * 4) | 0];
    R(g, px, 222, 14, 78, c);
    if (r() < 0.5) for (let x = px + 1; x < px + 14; x += 2) R(g, x, 222, 1, 78, mix(c, '#000000', 0.2));
    R(g, px, 222, 1, 78, '#0a0d1f');
  }
  for (let i = 0; i < 30; i++) R(g, 381 + ((r() * 165) | 0), 224 + ((r() * 74) | 0), 1 + ((r() * 2) | 0), 1 + ((r() * 4) | 0), r() < 0.5 ? '#3a1c18' : '#2a1820');
  R(g, 378, 296, 172, 4, '#0a0d1f');
  R(g, 378, 296, 172, 1, '#22305c');
  // awning roof
  R(g, 370, 214, 192, 6, '#121938');
  R(g, 370, 214, 192, 1, '#486e96');
  R(g, 370, 215, 192, 1, '#1e2b58');
  R(g, 370, 219, 192, 1, '#05060f');
  for (let x = 370; x < 562; x += 2) P(g, x, 220, '#0a0d1f');
  R(g, 380, 220, 168, 3, '#05060f');
  for (let i = 0; i < 24; i++) P(g, 370 + ((r() * 192) | 0), 214, '#8fbfc8');
  R(g, 374, 220, 2, 80, '#141b3a');
  P(g, 374, 240, '#2c3f70');
  // door
  R(g, 386, 250, 24, 50, '#080b1a');
  R(g, 388, 252, 20, 48, '#1d3a44');
  R(g, 388, 252, 20, 1, '#2c5a62');
  R(g, 388, 252, 1, 48, '#2c5a62');
  R(g, 391, 276, 14, 20, '#19323a');
  R(g, 391, 276, 14, 1, '#14262e');
  disc(g, 398, 264, 4, '#080b1a');
  disc(g, 398, 264, 3, '#e08326');
  P(g, 397, 263, '#ffd87a');
  R(g, 405, 277, 2, 3, '#8fbfc8');
  R(g, 395, 244, 7, 2, '#0a0d1f');
  R(g, 396, 246, 5, 2, '#fff2c4');
  text(g, '7F', 412, 252, '#34507f');
  // window frame + interior
  R(g, 416, 231, 108, 58, '#080b1a');
  R(g, 417, 232, 106, 56, '#1a1020');
  R(g, 418, 233, 104, 54, '#4a2414');
  interior(g);
  R(g, 414, 287, 112, 3, '#18224a');
  R(g, 414, 287, 112, 1, '#6494ae');
  // flower box
  R(g, 470, 291, 48, 5, '#2a1820');
  R(g, 470, 291, 48, 1, '#5c2c1e');
  fern(g, 478, 291, 4, 61);
  fern(g, 492, 291, 4, 62);
  fern(g, 507, 291, 4, 63);
  P(g, 484, 289, '#ff86c0');
  P(g, 499, 288, '#ff86c0');
  P(g, 512, 289, '#ffd87a');
  // right wall: meter, conduit, ladder
  R(g, 528, 240, 13, 16, '#18224a');
  R(g, 528, 240, 13, 1, '#34507f');
  disc(g, 534, 247, 3, '#0a0d1f');
  P(g, 534, 246, '#8fbfc8');
  R(g, 534, 222, 1, 18, '#22305c');
  R(g, 543, 221, 1, 79, '#22305c');
  R(g, 547, 221, 1, 79, '#22305c');
  for (let y = 225; y < 298; y += 5) R(g, 543, y, 5, 1, '#1a244a');
  // --- rooftop clutter ---
  R(g, 390, 186, 1, 28, '#141b3a');
  R(g, 472, 186, 1, 28, '#141b3a');
  line(g, 391, 213, 400, 208, '#141b3a');
  line(g, 471, 213, 462, 208, '#141b3a');
  R(g, 386, 186, 90, 22, '#05060f');
  R(g, 386, 186, 90, 1, '#1e2b58');
  R(g, 386, 186, 1, 22, '#1e2b58');
  // stove pipe
  R(g, 482, 198, 3, 16, '#1a1626');
  R(g, 482, 198, 1, 16, '#3a3654');
  R(g, 480, 195, 7, 2, '#0e1022');
  P(g, 483, 197, '#0e1022');
  // satellite dish
  R(g, 498, 204, 2, 10, '#141b3a');
  g.drawImage(
    sprite(
      ['........ll.', '......llDDl', '....llDDDDl', '...lDDDDDl.', '..lDDDDDl..', '.lDDDDDl...', '.lDDDDl....', '..lDDl.....', '...ll......'],
      { l: '#486e96', D: '#1a244a' },
    ),
    490, 195,
  );
  line(g, 494, 201, 489, 194, '#22305c');
  P(g, 489, 194, '#8fbfc8');
  // water tank on stilts
  R(g, 514, 204, 2, 10, '#0f142c');
  R(g, 542, 204, 2, 10, '#0f142c');
  line(g, 515, 213, 542, 205, '#0f142c');
  R(g, 512, 203, 34, 2, '#141b3a');
  pixelFill(g, 513, 180, 32, 23, (x) => {
    const u = (x - 513) / 31;
    const c = u < 0.1 ? '#34507f' : u < 0.36 ? '#1e2b58' : u < 0.74 ? '#161f44' : '#0e1430';
    return (x - 513) % 4 === 3 ? mix(c, '#000000', 0.25) : c;
  });
  R(g, 513, 185, 32, 1, '#0a0d1f');
  R(g, 513, 197, 32, 1, '#0a0d1f');
  for (let i = 0; i < 6; i++) R(g, 512 + i * 3, 179 - i, 34 - i * 6, 1, i === 0 ? '#486e96' : '#1a244a');
  R(g, 521, 186, 1, 7, '#5c2c1e');
  R(g, 533, 188, 1, 5, '#3a1c18');
  R(g, 527, 198, 2, 4, '#5c2c1e');
  vine(g, 541, 180, 22, 9);
  vine(g, 538, 180, 12, 10);
  R(g, 546, 196, 2, 18, '#141b3a');
  // antenna mast
  R(g, 552, 150, 1, 64, '#1a244a');
  R(g, 553, 150, 1, 64, '#0a0d1f');
  R(g, 546, 156, 13, 1, '#1a244a');
  R(g, 548, 161, 9, 1, '#1a244a');
  R(g, 549, 166, 7, 1, '#1a244a');
  line(g, 553, 172, 561, 213, '#0a0d1f');
}

const CANS = ['#e8203c', '#2ee6e6', '#f7b040', '#8f4dff', '#4dffa6', '#ff86c0', '#e8e8e8'];
function rightSide(g: Ctx) {
  // crates and a gas bottle between hut and kiosk
  R(g, 552, 286, 12, 14, '#141b3a');
  R(g, 552, 286, 12, 1, '#2c3f70');
  R(g, 554, 290, 8, 1, '#0a0d1f');
  R(g, 566, 280, 5, 20, '#3a1c18');
  R(g, 566, 280, 1, 20, '#7e4226');
  R(g, 567, 277, 3, 3, '#1a244a');
  // kiosk awning + posts
  R(g, 573, 250, 1, 50, '#141b3a');
  R(g, 607, 250, 1, 50, '#141b3a');
  R(g, 570, 246, 41, 4, '#121938');
  R(g, 570, 246, 41, 1, '#486e96');
  R(g, 570, 249, 41, 1, '#05060f');
  // vending machine body
  R(g, 578, 254, 24, 46, '#16224a');
  R(g, 578, 254, 24, 1, '#486e96');
  R(g, 578, 254, 1, 46, '#2c3f70');
  R(g, 601, 254, 1, 46, '#0a0d1e');
  R(g, 595, 265, 6, 22, '#0c1228');
  R(g, 597, 284, 2, 1, '#8fbfc8');
  R(g, 580, 290, 15, 6, '#080b1a');
  R(g, 580, 290, 15, 1, '#22305c');
  // stool
  R(g, 610, 290, 8, 2, '#1a244a');
  R(g, 611, 292, 1, 8, '#141b3a');
  R(g, 616, 292, 1, 8, '#141b3a');
  // utility pole, crossarm, transformer, lamp
  R(g, 620, 138, 4, 162, '#080a18');
  R(g, 620, 138, 1, 162, '#1a2650');
  R(g, 620, 184, 1, 116, '#6a4420');
  R(g, 604, 158, 36, 2, '#0a0d1e');
  R(g, 604, 158, 36, 1, '#1a2650');
  for (const x of [606, 613, 630, 637]) R(g, x, 155, 2, 3, '#34507f');
  R(g, 613, 188, 16, 20, '#111836');
  R(g, 613, 188, 16, 1, '#34507f');
  for (let x = 615; x < 628; x += 3) R(g, x, 191, 1, 11, '#080b1a');
  for (let x = 613; x < 629; x += 2) R(g, x, 204, 2, 2, ((x - 613) >> 1) & 1 ? '#0a0d1e' : '#b89020');
  R(g, 613, 189, 1, 19, '#7a5228');
  R(g, 598, 176, 22, 1, '#22305c');
  line(g, 608, 176, 620, 170, '#141b3a');
  R(g, 595, 177, 9, 3, '#0a0d1e');
  R(g, 595, 177, 9, 1, '#2c3f70');
  // tangle of low-voltage wiring down the pole
  line(g, 624, 208, 627, 232, '#04050c');
  line(g, 627, 232, 623, 262, '#04050c');
}

function buildFront(): Cv {
  const [c, g] = makeCanvas(W, H);
  const r = rng(88);
  // near-camera foliage, bottom-left
  for (let i = 0; i < 16; i++) {
    const a = 0.25 + r() * 1.25;
    const len = 26 + r() * 34;
    const x0 = -4 + r() * 34;
    const curve = 0.004 + r() * 0.01;
    for (let k = 0; k < len; k++) {
      const wdt = Math.max(1, Math.round(4 * Math.sin((Math.PI * k) / len) + 0.5));
      const x = x0 + Math.cos(a) * k;
      const y = 366 - Math.sin(a) * k + curve * k * k;
      R(g, x - wdt / 2, y, wdt, 1, '#03040a');
      if (k % 5 === 2 && k > 8) P(g, x - wdt / 2, y, '#0e2a28');
    }
  }
  // pipe railing with a valve, bottom-right
  R(g, 546, 344, 94, 4, '#03040a');
  R(g, 546, 344, 94, 1, '#1a2650');
  for (const x of [556, 612]) {
    R(g, x, 344, 4, 16, '#03040a');
    R(g, x - 1, 343, 6, 2, '#03040a');
  }
  for (let a = 0; a < 40; a++) {
    const an = (a / 40) * Math.PI * 2;
    R(g, 586 + Math.cos(an) * 7, 337 + Math.sin(an) * 7, 2, 2, '#03040a');
  }
  line(g, 579, 337, 593, 337, '#03040a');
  line(g, 586, 330, 586, 344, '#03040a');
  line(g, 581, 332, 591, 342, '#03040a');
  line(g, 591, 332, 581, 342, '#03040a');
  P(g, 582, 331, '#1a2650');
  P(g, 584, 330, '#1a2650');
  return c;
}

const PUDDLES = [[52, 20, 50, 8], [160, 42, 62, 10], [262, 13, 40, 6], [338, 34, 56, 10], [456, 19, 70, 8], [548, 44, 72, 10], [604, 12, 30, 5], [232, 56, 50, 5]];

function cable(g: Ctx, x0: number, y0: number, x1: number, y1: number, sag: number, col: string) {
  g.fillStyle = col;
  let py = -1;
  for (let x = x0; x <= x1; x++) {
    const u = (x - x0) / (x1 - x0);
    const y = Math.round(y0 + (y1 - y0) * u + sag * 4 * u * (1 - u));
    if (py >= 0 && Math.abs(y - py) > 1) g.fillRect(x, Math.min(y, py) + 1, 1, Math.abs(y - py) - 1);
    g.fillRect(x, y, 1, 1);
    py = y;
  }
}
function neonGlyph(g: Ctx, bits: string, n: number, x: number, y: number, base: string, lvl: number) {
  if (lvl > 0.9) {
    g.globalAlpha = 0.4;
    glyph(g, bits, n, x - 1, y, base, 2);
    glyph(g, bits, n, x + 1, y, base, 2);
    glyph(g, bits, n, x, y - 1, base, 2);
    glyph(g, bits, n, x, y + 1, base, 2);
    g.globalAlpha = 1;
  }
  glyph(g, bits, n, x, y, neonCol(base, lvl), 2);
}
function neonText(g: Ctx, s: string, x: number, y: number, base: string, lvl: number) {
  if (lvl > 0.9) {
    g.globalAlpha = 0.4;
    text(g, s, x - 1, y, base, 2);
    text(g, s, x + 1, y, base, 2);
    text(g, s, x, y - 1, base, 2);
    text(g, s, x, y + 1, base, 2);
    g.globalAlpha = 1;
  }
  text(g, s, x, y, neonCol(base, lvl), 2);
}

/** Rare transformer fault: [slot index, seconds since it began]. */
function sparkEvent(t: number): [number, number] {
  const SL = 53;
  const k = Math.floor(t / SL);
  return [k, t - (k * SL + 8 + hash(k, 201) * 36)];
}
export function brownout(t: number): number {
  const [k, u] = sparkEvent(t);
  return u > 0 && u < 0.9 && hash(k, Math.floor(u * 18), 5) < 0.5 ? 0.3 : 1;
}

const FAIRY = ['#ffd87a', '#ff86c0', '#7adada', '#ffb040', '#c9a3ff'];
const TV2 = ['#6a5ae8', '#8ab0f0', '#c87ad8', '#3a5aa8', '#d8e8ff'];

export class Roof {
  fg: Cv;
  overlay: Cv;
  front: Cv;
  floor: Cv;
  puddleMask: Cv;
  puddle = new Uint8Array(W * 60);
  cone: Cv;
  umbrella: Cv;
  head = sprite(
    ['..rrrrrr..', '.rhhhhhhr.', '.hhhhhhhh.', 'hhhhhhhsss', 'hRRhhsssss', 'hRRRhssess', 'hRRhhsssss', '.hhhhssss.', '..hhhsss..'],
    { r: '#a81c34', R: '#e8203c', h: '#2b1b3d', s: '#f0b890', e: '#3a1a20' },
  );
  torso = sprite(
    ['...nn........', '.hhhhhh......', 'hhcccccc.....', 'hccccccccc...', 'hcCccccccc...', 'cCCcccccccc..', 'cCCcccccccc..', 'cCCccccccc...', 'cCCcccccc....', 'cCCcccccc....', 'cCCcccccc....', 'cCCcccccc....', 'cCCcccccc....', 'cCCccccccc...', 'cCCccccccc...'],
    { c: '#3d7f7c', C: '#2a5c60', h: '#2f6668', n: '#c8906a' },
  );
  cat = sprite(
    ['.a..a...........', '.aaaa...........', 'aaaaaa..llslla..', 'aaaaaaalasaasal.', 'aawaaaaasaasaaaa', 'awwwaaaaaaaaaaaa', '.wwaaaaaaaaaaaa.'],
    { a: '#d88838', l: '#f4b860', s: '#a85a20', w: '#f4e8d0' },
  );
  botHead = sprite(['....m....', '.mmmmmmm.', 'mMMMMMMMm', 'mMMMMMMMm', 'mMMMMMMMm', '.mmmmmmm.'], { m: '#42568a', M: '#1e2848' });
  botBody = sprite(
    ['...ddddd...', '.mMMMMMMMm.', 'mMMmmmmmMMm', 'mMMmdddmMMm', 'mMMmmmmmMMm', 'mMMMMMMMMMm', '.mmmmmmmmm.'],
    { m: '#42568a', M: '#1e2848', d: '#0e1430' },
  );
  gWin = makeGlow(104, 62, '#e8862a', 0.46, 6, 1.6);
  gDoor = makeGlow(24, 24, '#f7b040', 0.42, 4);
  gNeon = makeGlow(64, 30, '#ff2e88', 0.36, 4);
  gVend = makeGlow(38, 38, '#7adada', 0.3, 4);
  gWallWin = makeGlow(46, 42, '#e08326', 0.3, 4);
  gTv = makeGlow(28, 26, '#6a5ae8', 0.3, 4);
  gLeftNeon = makeGlow(28, 54, '#ff3a90', 0.36, 4);
  gCool = makeGlow(26, 28, '#5a9aaa', 0.24, 4);
  gLantern = makeGlow(11, 11, '#e8203c', 0.45, 3);
  gSpark = makeGlow(32, 32, '#a8d8ff', 0.6, 4);
  drips: Drip[] = [];

  constructor() {
    const [c, g] = makeCanvas(W, 300);
    this.fg = c;
    leftWall(g);
    leftGear(g);
    parapet(g);
    hideaway(g);
    rightSide(g);

    // glass overlay: mullion, reflections, condensation, resting droplets
    const [o, og] = makeCanvas(WW, WH);
    this.overlay = o;
    og.translate(-WX, -WY);
    R(og, 451, 235, 3, 50, '#1a1020');
    R(og, 451, 235, 1, 50, '#5a2a14');
    og.fillStyle = 'rgba(190,225,255,0.10)';
    for (let i = 0; i < 13; i++) og.fillRect(424 + i, 250 - i, 6, 1);
    for (let i = 0; i < 16; i++) og.fillRect(498 + i, 254 - i, 8, 1);
    for (let i = 0; i < 9; i++) og.fillRect(462 + i, 246 - i, 3, 1);
    const r = rng(19);
    for (let x = WX; x < WX + WW; x++) {
      if (r() < 0.55) P(og, x, 284, 'rgba(255,240,210,0.22)');
      if (r() < 0.25) P(og, x, 283, 'rgba(255,240,210,0.16)');
    }
    for (let i = 0; i < 30; i++) P(og, WX + ((r() * WW) | 0), WY + ((r() * WH) | 0), 'rgba(255,246,222,0.3)');

    this.front = buildFront();

    // wet floor + puddle mask
    for (let y = 0; y < 60; y++)
      for (let x = 0; x < W; x++)
        for (const [cx, cy, rx, ry] of PUDDLES) {
          const dx = (x - cx) / rx;
          const dy = (y - cy) / ry;
          const an = Math.atan2(dy, dx);
          const rr = 1 + 0.16 * Math.sin(an * 3 + cx) + 0.09 * Math.sin(an * 7 + cy);
          if (dx * dx + dy * dy < rr * rr) {
            this.puddle[y * W + x] = 1;
            break;
          }
        }
    const [f, fg2] = makeCanvas(W, 60);
    this.floor = f;
    const pd = this.puddle;
    pixelFill(fg2, 0, 0, W, 60, (x, y) => {
      if (pd[y * W + x]) return y > 0 && !pd[(y - 1) * W + x] ? '#1c2b56' : '#04060e';
      if (y === 8 || y === 19 || y === 34 || y === 52) return '#060813';
      const xp = Math.round((x - 320) / (0.55 + y * 0.022));
      if (((xp % 60) + 60) % 60 === 0) return '#060813';
      if (hash(x, y, 3) < 0.035) return '#141c3c';
      return ditherPick('#0c1126', '#070a17', y / 59, x, y);
    });
    const [m, mg] = makeCanvas(W, 60);
    this.puddleMask = m;
    pixelFill(mg, 0, 0, W, 60, (x, y) => (pd[y * W + x] ? '#ffffff' : null));

    // sodium lamp cone
    const [cn, cg] = makeCanvas(90, 120);
    this.cone = cn;
    pixelFill(cg, 0, 0, 90, 120, (x, y) => {
      const hw = 4 + y * 0.26;
      const dx = Math.abs(x - 45);
      if (dx > hw) return null;
      return 0.5 * (1 - y / 170) * (1 - (dx / hw) * 0.8) > bayer(x, y) ? '#f7a838' : null;
    }, () => 0.2);

    // the robot's umbrella
    const [u, ug] = makeCanvas(25, 8);
    this.umbrella = u;
    const hw = [3, 6, 8, 10, 11, 12];
    P(ug, 12, 0, '#8fbfc8');
    hw.forEach((w, j) => {
      for (let dx = -w; dx <= w; dx++) {
        let col = '#c81e38';
        if (dx > w * 0.45) col = '#8a1430';
        if (dx < -w * 0.2 && j < 4) col = '#ff5a6e';
        if (dx === -6 || dx === 0 || dx === 6) col = '#9a1830';
        P(ug, 12 + dx, 1 + j, col);
      }
    });
    for (const dx of [-12, -11, -7, -6, -5, -1, 0, 1, 5, 6, 7, 11, 12]) P(ug, 12 + dx, 7, '#8a1430');

    // drip points: awning lip, cornice, AC, umbrella, kiosk, signs
    const dr = rng(123);
    const add = (x: number, y0: number, y1: number) => this.drips.push({ x, y0, y1, per: 2.6 + dr() * 3.4, ph: dr() });
    for (const x of [372, 383, 412, 436, 458, 481, 503, 528, 549, 560]) add(x, 221, x > 414 && x < 526 ? 287 : FLOOR);
    add(73, 134, FLOOR);
    add(76, 134, FLOOR);
    add(53, 219, 256);
    add(83, 128, FLOOR);
    add(UMB_X - 12, UMB_Y + 8, 285);
    add(UMB_X + 12, UMB_Y + 8, 285);
    add(571, 250, FLOOR);
    add(609, 250, FLOOR);
    add(599, 180, FLOOR);
    add(430, 209, 214);
    add(193, 263, FLOOR);
  }

  /** Light colour picked up by raindrops falling through lit air. */
  tint = (x: number, y: number): string | null => {
    if (y > 226 && x > 408 && x < 534) return 'rgba(255,214,130,0.6)';
    if (y > 180 && x > 560 && Math.abs(x - 600) < (y - 180) * 0.28 + 4) return 'rgba(255,214,130,0.55)';
    if (y > 244 && x > 384 && x <= 408) return 'rgba(255,214,130,0.55)';
    if (y > 180 && y < 218 && x > 384 && x < 478) return 'rgba(255,130,190,0.6)';
    if (y > 48 && y < 132 && x > 70 && x < 96) return 'rgba(255,130,190,0.6)';
    if (y > 146 && y < 204 && x < 66) return 'rgba(255,214,130,0.5)';
    return null;
  };

  /** Where rain lands on hard foreground surfaces: [x0, x1, y]. */
  surfaces: number[][] = [[370, 562, 213], [188, 372, 284], [92, 128, 269], [132, 162, 278], [570, 611, 245], [174, 193, 252], [72, 77, 127], [512, 546, 178]];
  umbrellaHit(u: number): [number, number] {
    const dx = Math.round((u - 0.5) * 24);
    return [UMB_X + dx, UMB_Y + 1 + Math.round((dx * dx) / 26)];
  }

  drawDyn(g: Ctx, t: number, env: Env) {
    const brown = brownout(t);
    // ---------------------------------------------- left wall windows
    const wl = (0.9 + 0.1 * vnoise(t * 2.2, 91)) * brown;
    g.save();
    g.beginPath();
    g.rect(14, 150, 42, 46);
    g.clip();
    const vk = Math.floor(t / 75);
    const vu = t - vk * 75 - hash(vk, 94) * 30;
    if (vu > 0 && vu < 32) {
      const e = clamp(vu / 4) * clamp((32 - vu) / 4);
      const px = 66 - Math.round(e * e * (3 - 2 * e) * 30);
      disc(g, px, 167, 5, '#1a0c0a');
      R(g, px - 8, 173, 17, 24, '#1a0c0a');
      R(g, px - 6, 172, 13, 1, '#1a0c0a');
      if (e >= 1) P(g, px + 7, 176, vnoise(t * 0.9, 95) > 0.55 ? '#ff7a3a' : '#a83a1a'); // cigarette ember
    }
    for (let y = 151; y < 196; y += 3) R(g, 14, y, 42, 1, '#2a120e');
    R(g, 34, 150, 1, 46, '#2a120e');
    g.restore();
    glowAt(g, this.gWallWin, 35, 174, wl);
    const tv = TV2[(hash(Math.floor(t * 2.3), 95) * TV2.length) | 0];
    R(g, 16, 226, 26, 26, '#100c28');
    g.globalAlpha = 0.42 + 0.12 * hash(Math.floor(t * 8), 96);
    R(g, 16, 226, 26, 26, tv);
    g.globalAlpha = 1;
    R(g, 18, 245, 22, 7, '#0a0818');
    disc(g, 24, 243, 2, '#0a0818');
    disc(g, 32, 244, 2, '#0a0818');
    R(g, 16, 226, 4, 26, '#1a1030');
    R(g, 28, 226, 1, 26, '#04050c');
    R(g, 16, 238, 26, 1, '#04050c');
    glowAt(g, this.gTv, 29, 240, 0.7 + 0.3 * hash(Math.floor(t * 2.3), 97));
    const cf = flicker(98, t, 1.8) * (brown < 1 ? 0.4 : 1);
    R(g, 22, 66, 22, 28, cf > 0.9 ? '#5a8a9a' : cf > 0.3 ? '#3a5a6a' : '#141e30');
    R(g, 22, 66, 22, 2, cf > 0.9 ? '#c4e8e6' : '#2a3a4a');
    R(g, 22, 81, 22, 1, '#0a1420');
    R(g, 25, 77, 2, 4, '#0a1420');
    R(g, 29, 76, 2, 5, '#0a1420');
    R(g, 34, 78, 3, 3, '#0a1420');
    R(g, 40, 68, 1, 5, '#0a1420');
    disc(g, 40, 75, 2, '#0e2a28');
    P(g, 38, 77, '#16403a');
    P(g, 42, 78, '#16403a');
    R(g, 32, 66, 1, 28, '#04050c');
    glowAt(g, this.gCool, 33, 80, cf);
    // ---------------------------------------------- ramen sign
    const names = ['ra', 'bar', 'me', 'n'];
    let ls = 0;
    for (let i = 0; i < 4; i++) {
      const lv = (i === 1 ? flicker(81, t, 2.8) : flicker(80, t)) * (brown < 1 ? 0.4 : 1);
      ls += lv;
      neonGlyph(g, KANA[names[i]], 5, 78, 60 + i * 16, '#ff3a90', lv);
    }
    for (let y = 56; y < 126; y += 2) P(g, 88, y, (y + Math.floor(t * 6)) % 12 < 6 ? '#2ee6e6' : '#124a5a');
    glowAt(g, this.gLeftNeon, 83, 92, ls / 4);
    // ---------------------------------------------- AC fans, LEDs
    drawFan(g, 108, 286, 9, t * 5.2, '#22305c', '#05060f', '#0d1228');
    drawFan(g, 144, 290, 7, -t * 3.4, '#1c2850', '#05060f', '#0d1228');
    if (t % 2.2 < 1.1) P(g, 124, 274, '#4dffa6');
    if ((t + 0.7) % 3.1 < 0.4) P(g, 158, 282, '#f7b040');
    P(g, 337, 291, t % 1.7 < 0.85 ? '#4dffa6' : '#0e3a2a');
    P(g, 340, 291, hash(Math.floor(t * 5), 12) < 0.5 ? '#f7b040' : '#3a2a0e');
    if (Math.sin(t * 0.8) > 0) P(g, 219, 276, '#7adada'); // the glowing flower
    // waterfall from the spout
    for (let y = 254; y < FLOOR; y++) {
      const q = hash(y - Math.floor(t * 70), 7);
      g.fillStyle = q < 0.3 ? 'rgba(210,238,246,0.8)' : q < 0.7 ? 'rgba(130,180,210,0.6)' : 'rgba(90,140,180,0.45)';
      g.fillRect(79, y, 1, 1);
      if (hash(y - Math.floor(t * 55), 8) < 0.6) g.fillRect(80, y, 1, 1);
    }
    for (let i = 0; i < 5; i++) P(g, 76 + ((hash(i, Math.floor(t * 14), 9) * 8) | 0), 299 - ((hash(i, Math.floor(t * 14), 10) * 3) | 0), 'rgba(210,238,246,0.6)');

    // ---------------------------------------------- the room
    this.room(g, t, brown);
    // door lamp, porthole, moths, lantern
    const dl = (flicker(72, t, 0.5) > 0.5 ? 1 : 0.5) * brown;
    R(g, 396, 246, 5, 2, dl > 0.9 ? '#fff2c4' : '#8a6a3a');
    glowAt(g, this.gDoor, 398, 250, dl);
    for (let i = 0; i < 3; i++) {
      const mx = 398 + Math.sin(t * (2.1 + i * 0.7) + i * 2) * 6 + Math.sin(t * 5.3 + i) * 1.5;
      const my = 249 + Math.cos(t * (1.7 + i * 0.9) + i) * 3.5;
      P(g, mx, my, hash(i, Math.floor(t * 12)) < 0.6 ? '#fff2c4' : '#c8a060');
    }
    const lsw = Math.round(Math.sin(t * 1.15) * (0.7 + env.gust * 1.8));
    R(g, 413, 221, 1, 3, '#0a0d1f');
    R(g, 411 + lsw, 224, 5, 7, '#e8203c');
    R(g, 411 + lsw, 224, 5, 1, '#f7b040');
    R(g, 411 + lsw, 230, 5, 1, '#f7b040');
    R(g, 413 + lsw, 225, 1, 5, '#ff7a6a');
    P(g, 413 + lsw, 231, '#f7b040');
    glowAt(g, this.gLantern, 413 + lsw, 227, 0.8 + 0.2 * vnoise(t * 3, 14));
    // meter + tank LEDs, mast beacon
    P(g, 538, 253, t % 0.9 < 0.45 ? '#4dffa6' : '#0e3a2a');
    P(g, 518, 200, (t + 0.3) % 4 < 0.3 ? '#2ee6e6' : '#0e3040');
    if (t % 2.4 < 0.9) {
      P(g, 552, 149, '#ff3848');
      g.globalAlpha = 0.3;
      R(g, 551, 148, 3, 3, '#ff3848');
      g.globalAlpha = 1;
    }
    // ---------------------------------------------- NITE OWL neon
    let ns = 0;
    const base = flicker(90, t) * (brown < 1 ? 0.4 : 1);
    const eDead = hash(Math.floor(t / 7), 92) < 0.3;
    'NITE OWL'.split('').forEach((ch, i) => {
      if (ch === ' ') return;
      let lv = base;
      if (i === 3) lv = eDead ? (hash(Math.floor(t * 14), 93) < 0.12 ? 0.4 : 0) : flicker(91, t, 2.6) * base;
      ns += lv;
      neonText(g, ch, 404 + i * 8 + (i > 4 ? -2 : 0), 192, '#ff2e88', lv);
    });
    const ml = flicker(94, t, 0.6) * (brown < 1 ? 0.4 : 1);
    disc(g, 394, 197, 4, neonCol('#ffb040', ml));
    disc(g, 396, 195, 3, '#05060f');
    R(g, 404, 204, 62, 1, neonCol('#2ee6e6', flicker(95, t, 0.8)));
    glowAt(g, this.gNeon, 432, 198, ns / 7);
    // ---------------------------------------------- kiosk
    const vb = (flicker(70, t, 0.9) > 0.5 ? 1 : 0.35) * brown;
    const von = vb > 0.9;
    R(g, 580, 256, 21, 7, von ? '#0e3a4a' : '#08141c');
    text(g, 'DRINK', 581, 257, von ? '#a8fbfb' : '#2a6a7a');
    R(g, 580, 265, 14, 22, von ? '#d0f0ee' : '#4a6a7a');
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) R(g, 581 + col * 3 + (col > 1 ? 1 : 0), 266 + row * 7, 2, 5, CANS[(row * 3 + col * 2) % CANS.length]);
      R(g, 580, 271 + row * 7, 14, 1, '#486e96');
    }
    for (let i = 0; i < 5; i++) P(g, 598, 267 + i * 3, Math.floor(t * 2.5) % 5 === i ? '#4dffa6' : '#7a1828');
    glowAt(g, this.gVend, 589, 276, vb);
    const lamp = (flicker(71, t, 0.7) > 0.5 ? 1 : 0.4) * brown;
    R(g, 596, 180, 7, 1, lamp > 0.9 ? '#fff2c4' : '#8a6a3a');
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = clamp(lamp * (0.92 + 0.08 * vnoise(t * 5, 15)));
    g.drawImage(this.cone, 599 - 45, 181);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    P(g, 626, 191, t % 1.3 < 0.2 ? '#ff3848' : '#3a0a12');

    // ---------------------------------------------- robot under its umbrella
    this.robot(g, t, env);

    // ---------------------------------------------- cables + string lights
    const sw = (ph: number, amp: number) => Math.sin(t * 0.8 + ph) * amp * (0.4 + env.gust * 1.4) + Math.sin(t * 2.1 + ph * 3) * 0.3;
    cable(g, 72, 92, 552, 152, 34 + sw(0, 1.4), '#04050c');
    cable(g, 72, 108, 606, 158, 44 + sw(2, 1.8), '#070916');
    cable(g, 553, 152, 606, 158, 6 + sw(4, 0.8), '#04050c');
    cable(g, 624, 158, 640, 148, 2, '#04050c');
    cable(g, 624, 162, 640, 170, 2, '#04050c');
    const sag = 14 + sw(1, 1.2);
    cable(g, 201, 237, 372, 216, sag, '#0a0d1f');
    for (let i = 1; i <= 11; i++) {
      const u = i / 12;
      const bx = Math.round(201 + 171 * u);
      const by = Math.round(237 - 21 * u + sag * 4 * u * (1 - u)) + 1;
      let lv = (0.75 + 0.25 * vnoise(t * 0.7 + i * 1.9, 20 + i)) * brown;
      if (i === 7) lv = hash(Math.floor(t * 10), 22) < 0.07 ? 0.6 : 0.04; // the dead one
      const col = i % 4 === 2 ? '#ff86c0' : '#ffc860';
      R(g, bx, by, 2, 2, lv > 0.5 ? col : '#3a2a20');
      if (lv > 0.5) P(g, bx, by, '#fff2c4');
      if (lv > 0.5) {
        g.globalCompositeOperation = 'lighter';
        g.fillStyle = col;
        g.globalAlpha = 0.24 * lv;
        g.fillRect(bx - 1, by - 1, 4, 4);
        g.globalAlpha = 0.1 * lv;
        g.fillRect(bx - 2, by - 2, 6, 6);
        g.globalAlpha = 1;
        g.globalCompositeOperation = 'source-over';
      }
    }
    // ---------------------------------------------- transformer fault
    const [sk, su] = sparkEvent(t);
    const bursts = 1 + ((hash(sk, 202) * 3) | 0);
    for (let b = 0; b < bursts; b++) {
      const ub = su - b * 0.32;
      if (ub < 0 || ub > 1) continue;
      if (ub < 0.09) glowAt(g, this.gSpark, 621, 198, 1);
      for (let i = 0; i < 11; i++) {
        const life = 0.35 + hash(sk, b, i + 40) * 0.55;
        if (ub > life) continue;
        const ang = hash(sk, b, i) * Math.PI * 2;
        const sp = 24 + hash(sk, b, i + 20) * 70;
        const pos = (tt: number): [number, number] => [621 + Math.cos(ang) * sp * tt, 198 + Math.sin(ang) * sp * tt * 0.7 + 170 * tt * tt];
        const [x, y] = pos(ub);
        const [x2, y2] = pos(Math.max(0, ub - 0.035));
        const q = ub / life;
        P(g, x2, y2, q < 0.5 ? '#f7b040' : '#a8501a');
        P(g, x, y, q < 0.3 ? '#ffffff' : q < 0.65 ? '#ffd87a' : '#e08326');
      }
    }
    drawDrips(g, this.drips, t);
  }

  private room(g: Ctx, t: number, brown: number) {
    // fairy lights
    for (let i = 0; i < 14; i++) {
      const on = vnoise(t * 0.8 + i * 1.7, 60 + i) > 0.3;
      P(g, 424 + i * 7, 237 + (i & 1), on ? FAIRY[i % 5] : '#6a3418');
    }
    // clock: forever 02:37
    text(g, '02', 494, 241, '#ff5a3a');
    if (t % 1 < 0.5) {
      P(g, 503, 242, '#ff5a3a');
      P(g, 503, 244, '#ff5a3a');
    }
    text(g, '37', 505, 241, '#ff5a3a');
    // monitor: two lines of code + a little equaliser
    R(g, 501, 257, 14, 10, '#06141c');
    for (let i = 0; i < 2; i++) {
      const idx = Math.floor(t * 1.4) + i;
      R(g, 502, 258 + i * 2, 3 + ((hash(idx, 41) * 9) | 0), 1, ['#2ee6e6', '#4dffa6', '#ff86c0'][(hash(idx, 42) * 3) | 0]);
    }
    for (let i = 0; i < 6; i++) {
      const bh = 1 + ((vnoise(t * 4.5 + i * 3.1, 50 + i) * 4.4) | 0);
      R(g, 502 + i * 2, 267 - bh, 1, bh, '#4dffa6');
      P(g, 502 + i * 2, 267 - bh, '#c4ffe0');
    }
    // the resident
    const bob = (t * 1.25) % 2 < 0.28 ? 1 : 0;
    const sk = Math.floor(t / 34);
    const su = t - sk * 34 - 6 - hash(sk, 21) * 20;
    const sip = su > 0 && su < 3.4;
    g.drawImage(this.torso, 466, 261);
    g.drawImage(this.head, 468, 252 + bob);
    P(g, 477, 256 + bob, '#c8f0e8');
    P(g, 477, 258 + bob, '#c8f0e8');
    if (sip) {
      R(g, 474, 266, 4, 3, '#3d7f7c');
      R(g, 477, 262, 2, 5, '#4a8f8a');
      R(g, 478, 260, 2, 2, '#f0b890');
      R(g, 479, 256 + bob, 3, 4, '#f4e8d0');
      P(g, 482, 257 + bob, '#f4e8d0');
    } else {
      const typing = vnoise(t * 0.45, 5) > 0.38;
      const j = typing && hash(Math.floor(t * 9), 6) < 0.5 ? 1 : 0;
      R(g, 475, 268, 10, 2, '#4a8f8a');
      R(g, 485, 268 + j, 2, 2, '#f0b890');
      R(g, 496, 268, 3, 4, '#f4e8d0');
      P(g, 499, 269, '#f4e8d0');
      for (let i = 0; i < 2; i++) {
        const sy = Math.floor((t * 2.6 + i * 2.2) % 5);
        g.globalAlpha = 0.6 - sy * 0.1;
        P(g, 497 + ((sy + i) & 1), 266 - sy, '#fff2c4');
      }
      g.globalAlpha = 1;
    }
    // the cat: breathing, dreaming, occasionally judging
    g.drawImage(this.cat, 425, 276);
    if (t % 3.4 < 1.5) R(g, 433, 277, 5, 1, '#f4b860');
    const ck = Math.floor(t / 48);
    const cu = t - ck * 48 - hash(ck, 23) * 36;
    const awake = cu > 0 && cu < 5 && !(cu > 2 && cu < 2.2);
    P(g, 426, 278, awake ? '#4dffa6' : '#6a3418');
    P(g, 429, 278, awake ? '#4dffa6' : '#6a3418');
    if (hash(Math.floor(t / 0.2), 24) < 0.02) P(g, 429, 275, '#d88838');
    const tl = vnoise(t * 0.9, 25) > 0.6 ? Math.round(Math.sin(t * 6)) : 0;
    P(g, 441, 280, '#d88838');
    P(g, 442, 279, '#d88838');
    P(g, 442, 278, '#a85a20');
    P(g, 442 + tl, 277, '#d88838');
    // glass
    g.drawImage(this.overlay, WX, WY);
    for (let i = 0; i < 16; i++) {
      const q = t * (2.5 + hash(i, 81) * 7) + hash(i, 82) * 60;
      const k = Math.floor(q / 60);
      const yy = Math.floor(q - k * 60);
      if (yy > 47) continue;
      const x = WX + 1 + ((hash(i, k, 83) * 98) | 0);
      if (x >= 451 && x <= 453) continue;
      const tr = Math.min(4, yy);
      R(g, x, WY + yy - tr, 1, tr, 'rgba(255,240,205,0.16)');
      R(g, x, WY + yy, 1, 2, 'rgba(255,248,226,0.55)');
    }
    glowAt(g, this.gWin, 470, 262, (0.9 + 0.1 * vnoise(t * 1.7, 1)) * brown);
  }

  private robot(g: Ctx, t: number, env: Env) {
    const slot = Math.floor(t / 6);
    const q = hash(slot, 131);
    let gaze = q < 0.55 ? -1 : q < 0.85 ? 0 : 1;
    if (env.trainX !== null) gaze = env.trainX < ROBOT_X - 30 ? -1 : env.trainX > ROBOT_X + 30 ? 1 : 0;
    const tilt = hash(slot, 132) < 0.2 && t % 6 > 3 ? 1 : 0;
    const ux = UMB_X + (env.gust > 0.6 ? 1 : 0);
    R(g, ux + 3, UMB_Y + 6, 1, 18, '#486e96');
    g.drawImage(this.umbrella, ux - 12, UMB_Y);
    g.drawImage(this.botBody, ROBOT_X - 5, 278);
    R(g, ROBOT_X + 6, 279, 2, 3, '#42568a');
    const hx = ROBOT_X - 4 + gaze;
    g.drawImage(this.botHead, hx, 272 + tilt);
    const blink = t % 5.3 < 0.14;
    if (gaze !== 0 && !blink) {
      const ex = gaze < 0 ? hx : hx + 8;
      P(g, ex, 274 + tilt, '#ffc050');
      P(g, ex, 275 + tilt, '#ffc050');
      g.globalAlpha = 0.35;
      P(g, ex + gaze, 274 + tilt, '#ffc050');
      P(g, ex + gaze, 275 + tilt, '#ffc050');
      g.globalAlpha = 1;
    }
    if (t % 2.9 < 0.25) P(g, hx + 4, 271 + tilt, '#ff5a3a');
    P(g, ROBOT_X, 281, Math.sin(t * 1.3) > 0 ? '#2ee6e6' : '#14506a');
    R(g, ROBOT_X - 5, 285, 11, 1, '#0a0d1f');
  }
}
