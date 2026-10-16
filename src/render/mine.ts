// The mine: a vertically scrolling cross-section of the colony.
import { BIOMES, FLOORS, GUARDIANS } from '../data/defs';
import { biomeAt, biomeIndexAt, Derived, levelHp } from '../game/calc';
import { on } from '../game/events';
import type { GameState } from '../game/state';
import { fmt } from '../ui/format';
import { drawSprite } from './sprites';

export const SURF = 150;
export const FH = 66;
const SHAFT_X = 6;
const SHAFT_W = 34;
const ROOM_X = SHAFT_X + SHAFT_W + 6;
const TOP_INSET = 70;
const BOTTOM_INSET = 70;

interface Particle {
  x: number; y: number; vx: number; vy: number; life: number; max: number;
  color: string; size: number; floorY?: number; text?: string; small?: boolean; ring?: boolean;
}

const BTN = 34; // size of the per-row build / manage button

function rng(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pingpong = (v: number, span: number) => {
  const m = ((v % (2 * span)) + 2 * span) % (2 * span);
  return m < span ? { x: m, right: true } : { x: 2 * span - m, right: false };
};

export class MineView {
  ctx: CanvasRenderingContext2D;
  w = 0; h = 0; dpr = 1;
  scrollY = -TOP_INSET; vel = 0; follow = true;
  particles: Particle[] = [];
  private patterns = new Map<number, CanvasPattern>();
  // Every finger is tracked; the first one down scrolls, and any that barely moved count as a tap.
  private pointers = new Map<number, { startX: number; startY: number; lastY: number; lastT: number; moved: number }>();
  private scroller = -1;
  private spawnAcc = 0;
  private front = { x: 0, y: 0 };
  private sealX = 0;
  private depth = 0;
  private lastTap = { x: 0, y: 0 }; // world coordinates of the latest tap, for feedback

  constructor(
    public canvas: HTMLCanvasElement,
    private onTap: (level: number) => void,
    private onButton: (level: number) => void,
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.resize();
    addEventListener('resize', () => this.resize());
    canvas.addEventListener('pointerdown', (e) => {
      try { canvas.setPointerCapture(e.pointerId); } catch { /* not capturable; fine */ }
      this.pointers.set(e.pointerId, { startX: e.clientX, startY: e.clientY, lastY: e.clientY, lastT: performance.now(), moved: 0 });
      if (this.scroller < 0) { this.scroller = e.pointerId; this.vel = 0; }
    });
    canvas.addEventListener('pointermove', (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      p.moved = Math.max(p.moved, Math.hypot(e.clientX - p.startX, e.clientY - p.startY));
      if (e.pointerId === this.scroller && p.moved > 10) {
        const dy = e.clientY - p.lastY;
        const now = performance.now();
        this.scrollY -= dy;
        this.vel = (-dy / Math.max(1, now - p.lastT)) * 1000;
        this.follow = false;
        p.lastT = now;
      }
      p.lastY = e.clientY;
    });
    const end = (e: PointerEvent) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      this.pointers.delete(e.pointerId);
      if (e.pointerId === this.scroller) this.scroller = -1;
      if (p.moved < 10 && e.type === 'pointerup') this.tapAt(e.clientX, e.clientY);
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);

    on('tap', (t: { power: number; combo: number }) => this.burst(t.power, t.combo));
    on('tapBlocked', (t: { stone: number }) => {
      this.ring(this.lastTap.x, this.lastTap.y, '#d95763');
      if (t.stone > 0) {
        this.particles.push({
          x: this.lastTap.x - 12, y: this.lastTap.y - 18, vx: 0, vy: -70, life: 0, max: 0.8,
          color: '#b0a08f', size: 0, text: '+' + t.stone.toFixed(1) + ' stone', small: true,
        });
      }
      for (let i = 0; i < 6; i++) this.spark(this.sealX, this.front.y - 8);
    });
    on('dug', () => this.dugBurst());
  }

  private tapAt(x: number, y: number) {
    const wy = y + this.scrollY;
    const level = Math.floor((wy - SURF) / FH); // negative = above ground
    this.lastTap = { x, y: wy };
    if (level >= 0 && level < this.depth && this.hitButton(x, wy, level)) this.onButton(level);
    else this.onTap(level);
  }

  /** The build / manage button on the right of each dug row (world coordinates). */
  private button(level: number) {
    const x = this.w - 6 - BTN - 5;
    const y = SURF + level * FH + (FH - BTN) / 2 + 1;
    return { x, y };
  }
  private hitButton(x: number, wy: number, level: number) {
    const b = this.button(level);
    return x >= b.x - 8 && x <= b.x + BTN + 8 && wy >= b.y - 6 && wy <= b.y + BTN + 6;
  }

  resize() {
    this.dpr = Math.min(2, devicePixelRatio || 1);
    this.w = innerWidth; this.h = innerHeight;
    this.canvas.width = this.w * this.dpr; this.canvas.height = this.h * this.dpr;
    this.canvas.style.width = this.w + 'px'; this.canvas.style.height = this.h + 'px';
  }

  jumpToFront() { this.follow = true; }
  frontVisible() {
    const y = SURF + this.depth * FH - this.scrollY;
    return y > TOP_INSET - FH && y < this.h - BOTTOM_INSET;
  }

  private pattern(bi: number): CanvasPattern {
    let p = this.patterns.get(bi);
    if (p) return p;
    const b = BIOMES[bi];
    const c = document.createElement('canvas');
    const N = 16, PX = 3;
    c.width = c.height = N * PX;
    const x = c.getContext('2d')!;
    const r = rng(bi * 991 + 7);
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const v = r();
      x.fillStyle = v < 0.04 ? b.speck : v < 0.4 ? b.colors[0] : v < 0.75 ? b.colors[1] : b.colors[2];
      x.fillRect(i * PX, j * PX, PX, PX);
    }
    p = this.ctx.createPattern(c, 'repeat')!;
    this.patterns.set(bi, p);
    return p;
  }

  private burst(power: number, combo: number) {
    const b = biomeAt(this.depth);
    for (let i = 0; i < 8; i++) this.spawnChunk(this.front.x, this.front.y, b.colors[i % 3], 1.4);
    if (Math.random() < 0.6) this.spawnChunk(this.front.x, this.front.y, b.speck, 1.4);
    // Feedback right under the finger: a ripple, the amount dug and the combo.
    const { x, y } = this.lastTap;
    this.ring(x, y, '#fbf236');
    this.particles.push({
      x: x - 12 + (Math.random() - 0.5) * 14, y: y - 18, vx: 0, vy: -70, life: 0, max: 0.8,
      color: '#fbf236', size: 0, text: '+' + (power < 10 ? power.toFixed(1) : fmt(power)),
    });
    if (combo >= 5) {
      this.particles.push({
        x: x + 14, y: y - 34, vx: 0, vy: -50, life: 0, max: 0.6,
        color: combo >= 50 ? '#ff8a3d' : '#f3ead8', size: 0, text: `x${combo}`, small: true,
      });
    }
  }
  private ring(x: number, y: number, color: string) {
    this.particles.push({ x, y, vx: 0, vy: 0, life: 0, max: 0.35, color, size: 0, ring: true });
  }
  /** A bright spark bouncing off the guardian's seal. */
  private spark(x: number, y: number) {
    this.particles.push({
      x, y, vx: -40 - Math.random() * 120, vy: -Math.random() * 180 - 40, life: 0, max: 0.4 + Math.random() * 0.3,
      color: Math.random() < 0.5 ? '#fbf236' : '#ffffff', size: 2, floorY: y + 8,
    });
  }
  private dugBurst() {
    const b = biomeAt(this.depth);
    for (let i = 0; i < 24; i++) this.spawnChunk(ROOM_X + Math.random() * (this.w - ROOM_X), this.front.y - 20, b.colors[i % 3], 1.8);
  }
  private spawnChunk(x: number, y: number, color: string, force = 1) {
    this.particles.push({
      x, y: y - 20 - Math.random() * 20,
      vx: (Math.random() - 0.6) * 160 * force, vy: (-Math.random() * 200 - 60) * force,
      life: 0, max: 1.2 + Math.random(), color, size: 2 + Math.floor(Math.random() * 3) * 2, floorY: y,
    });
  }

  render(s: GameState, d: Derived, t: number, dt: number) {
    const { ctx, w, h } = this;
    const r = s.run;
    this.depth = r.depth;
    const frontWorldY = SURF + r.depth * FH;

    // Scrolling: follow the dig front, or coast with inertia.
    const maxScroll = Math.max(-TOP_INSET, frontWorldY + 3 * FH - h + BOTTOM_INSET);
    if (this.scroller < 0) {
      if (this.follow) this.scrollY += (frontWorldY - h * 0.55 - this.scrollY) * Math.min(1, dt * 4);
      else { this.scrollY += this.vel * dt; this.vel *= Math.pow(0.04, dt); }
    }
    this.scrollY = Math.max(-TOP_INSET, Math.min(maxScroll, this.scrollY));
    const sy = this.scrollY;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#120e14';
    ctx.fillRect(0, 0, w, h);

    if (sy < SURF) this.drawSurface(t);

    const first = Math.max(0, Math.floor((sy - SURF) / FH));
    const last = Math.min(r.depth + 8, Math.ceil((sy + h - SURF) / FH));
    const walkers = this.walkerPlan(s, d);
    for (let i = first; i <= last; i++) {
      const y = SURF + i * FH - sy;
      const pat = this.pattern(biomeIndexAt(i));
      pat.setTransform(new DOMMatrix([1, 0, 0, 1, 0, -sy]));
      ctx.fillStyle = pat;
      ctx.fillRect(0, y, w, FH);
      if (i < r.depth) this.drawFloor(s, i, y, t, walkers);
      else if (i === r.depth) this.drawFront(s, d, y, t, dt);
      else {
        ctx.fillStyle = `rgba(10,6,12,${Math.min(0.9, 0.5 + (i - r.depth) * 0.12)})`;
        ctx.fillRect(0, y, w, FH);
      }
      const b = BIOMES.find((x) => x.from === i && i > 0);
      if (b) this.banner(b.name, y);
    }

    this.drawShaft(s, t, frontWorldY - sy);
    this.updateParticles(dt, sy);
  }

  private drawSurface(t: number) {
    const { ctx, w } = this;
    const y0 = -this.scrollY;
    const g = ctx.createLinearGradient(0, y0 - 200, 0, y0 + SURF);
    g.addColorStop(0, '#3a5f9e'); g.addColorStop(1, '#a8dcf0');
    ctx.fillStyle = g;
    ctx.fillRect(0, y0 - 400, w, SURF + 400);
    ctx.fillStyle = '#fff3b0';
    ctx.fillRect(w * 0.18, y0 + 30, 22, 22);
    ctx.fillStyle = '#7fae7a';
    for (let x = 0; x < w; x += 6) {
      const hh = 20 + Math.sin(x * 0.02) * 10 + Math.sin(x * 0.05 + 1) * 6;
      ctx.fillRect(x, y0 + SURF - 14 - hh, 6, hh);
    }
    // clouds
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    const cx = ((t * 6) % (w + 120)) - 60;
    ctx.fillRect(cx, y0 + 50, 48, 10); ctx.fillRect(cx + 10, y0 + 42, 28, 10);
    ctx.fillStyle = '#4f8a3a';
    ctx.fillRect(0, y0 + SURF - 14, w, 14);
    ctx.fillStyle = '#6abe30';
    ctx.fillRect(0, y0 + SURF - 14, w, 4);
    drawSprite(ctx, 'hut', w * 0.68, y0 + SURF - 13, 4);
    // winch over the shaft
    ctx.fillStyle = '#5e3119';
    ctx.fillRect(SHAFT_X, y0 + SURF - 60, 4, 50);
    ctx.fillRect(SHAFT_X + SHAFT_W - 4, y0 + SURF - 60, 4, 50);
    ctx.fillRect(SHAFT_X - 2, y0 + SURF - 62, SHAFT_W + 4, 5);
    ctx.font = '700 22px "Pixelify Sans", monospace';
    ctx.fillStyle = '#1b1622';
    ctx.fillText('DELVE', ROOM_X + 10, y0 + SURF - 40);
  }

  private drawShaft(s: GameState, t: number, bottom: number) {
    const { ctx } = this;
    const top = SURF - this.scrollY - 10;
    if (bottom < 0) return;
    ctx.fillStyle = 'rgba(10,6,8,0.85)';
    ctx.fillRect(SHAFT_X, Math.max(top, -10), SHAFT_W, bottom - Math.max(top, -10) + FH);
    const mid = SHAFT_X + SHAFT_W / 2;
    const span = Math.max(1, bottom + FH - 20 - top);
    const ph = (t * (60 / Math.max(120, span))) % 2;
    const f = ph < 1 ? ph : 2 - ph;
    const e = f * f * (3 - 2 * f);
    const by = top + e * (span - 10);
    ctx.fillStyle = '#b0a08f';
    ctx.fillRect(mid - 1, top - 50, 2, by - top + 50);
    ctx.fillStyle = '#8a4b2a';
    ctx.fillRect(mid - 9, by, 18, 12);
    ctx.fillStyle = '#5e3119';
    ctx.fillRect(mid - 9, by + 4, 18, 2);
    if (s.run.jobs.miner > 0) {
      ctx.fillStyle = biomeAt(s.run.depth).speck;
      ctx.fillRect(mid - 6, by - 3, 4, 4); ctx.fillRect(mid + 1, by - 2, 4, 3);
    }
  }

  private banner(name: string, y: number) {
    const { ctx, w } = this;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(ROOM_X, y - 7, w - ROOM_X - 6, 14);
    ctx.font = '700 12px "Pixelify Sans", monospace';
    ctx.fillStyle = '#fbf236';
    ctx.textAlign = 'center';
    ctx.fillText(`~ ${name} ~`, (ROOM_X + w) / 2, y + 4);
    ctx.textAlign = 'left';
  }

  private walkerPlan(s: GameState, d: Derived) {
    const r = s.run;
    const counts: Record<string, number> = {};
    for (const f of r.floors) if (f) counts[f.type] = (counts[f.type] ?? 0) + 1;
    const per = (people: number, type: string) => (counts[type] ? Math.min(4, Math.ceil(people / counts[type])) : 0);
    const homes = (counts.bunk ?? 0) + (counts.tavern ?? 0);
    const idleEach = homes ? Math.min(4, Math.ceil(d.idle / homes)) : 0;
    return {
      farm: per(r.jobs.farmer, 'farm'),
      library: per(r.jobs.scholar, 'library'),
      bunk: idleEach, tavern: idleEach,
      barracks: Math.min(3, d.reserved),
      forge: 1, storage: 1, shrine: 1,
    } as Record<string, number>;
  }

  private drawFloor(s: GameState, i: number, y: number, t: number, walkers: Record<string, number>) {
    const { ctx, w } = this;
    const rx = ROOM_X, ry = y + 5, rw = w - ROOM_X - 6, rh = FH - 9;
    const f = s.run.floors[i];
    if (!f) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.setLineDash([6, 6]);
      ctx.strokeRect(rx + 0.5, ry + 0.5, rw - 1, rh - 1);
      ctx.setLineDash([]);
      ctx.font = '700 12px "Nunito", sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillText('Empty level', rx + 10, ry + rh / 2 + 4);
      this.drawButton(i, true, t);
      return;
    }
    const def = FLOORS[f.type];
    ctx.fillStyle = def.color;
    ctx.fillRect(rx, ry, rw, rh);
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    for (let x = rx; x < rx + rw; x += 12) ctx.fillRect(x, ry, 6, rh - 5);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(rx, ry + rh - 5, rw, 5);
    ctx.fillStyle = 'rgba(255,220,150,0.08)';
    ctx.fillRect(rx, ry, rw, 3);

    const n = def.props.length;
    def.props.forEach((p, k) => {
      const px = n === 1 ? rx + rw * 0.6 : rx + 30 + (k * (rw - 70 - BTN)) / (n - 1);
      drawSprite(ctx, p, px, ry + rh - 5, 3);
    });
    if (f.type === 'forge' || f.type === 'shrine') {
      ctx.fillStyle = `rgba(255,160,60,${0.08 + 0.05 * Math.sin(t * 6 + i)})`;
      ctx.fillRect(rx, ry, rw, rh);
    }

    const count = walkers[f.type] ?? 0;
    const pal: Record<string, string> = f.type === 'shrine' ? { c: '#f4f4f4', h: '#fbf236' } : f.type === 'forge' ? { c: '#5c6b78' } : {};
    for (let k = 0; k < count; k++) {
      const seed = i * 7 + k * 13;
      const p = pingpong(t * (14 + (seed % 9)) + seed * 23, rw - 50 - BTN);
      const bob = Math.abs(Math.sin(t * 8 + seed)) * 2;
      drawSprite(ctx, 'worker', rx + 20 + p.x, ry + rh - 5 - bob, 2, !p.right, pal);
    }

    const bm = biomeAt(i).floorMult[f.type] ?? 1;
    ctx.font = '800 11px "Nunito", sans-serif';
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    const label = `${def.name}${f.level > 1 ? ' Lv' + f.level : ''}`;
    ctx.fillRect(rx + 3, ry + 3, ctx.measureText(label).width + (bm !== 1 ? 18 : 8), 14);
    ctx.fillStyle = '#fff';
    ctx.fillText(label, rx + 7, ry + 14);
    if (bm !== 1) {
      ctx.fillStyle = bm > 1 ? '#6abe30' : '#d95763';
      ctx.fillText(bm > 1 ? '▲' : '▼', rx + 9 + ctx.measureText(label).width, ry + 14);
    }
    this.drawButton(i, false, t);
  }

  /** Gold "+" on empty rows, a gear on built floors. Everything else in the mine digs when tapped. */
  private drawButton(level: number, empty: boolean, t: number) {
    const { ctx } = this;
    const b = this.button(level);
    const x = b.x, y = b.y - this.scrollY;
    ctx.fillStyle = empty ? 'rgba(60,45,10,0.92)' : 'rgba(20,14,26,0.8)';
    ctx.fillRect(x, y, BTN, BTN);
    ctx.strokeStyle = empty ? `rgba(251,242,54,${0.7 + 0.3 * Math.sin(t * 4 + level)})` : 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, BTN - 2, BTN - 2);
    ctx.fillStyle = empty ? '#fbf236' : '#f3ead8';
    ctx.font = `800 ${empty ? 24 : 18}px "Nunito", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(empty ? '+' : '⚙', x + BTN / 2, y + BTN / 2 + (empty ? 8 : 6));
    ctx.textAlign = 'left';
  }

  private drawFront(s: GameState, d: Derived, y: number, t: number, dt: number) {
    const { ctx, w } = this;
    const r = s.run;
    const rx = ROOM_X, ry = y + 5, rw = w - ROOM_X - 6, rh = FH - 9;
    const frac = Math.min(1, r.dig / levelHp(r.depth));
    const cw = Math.max(14, rw * frac);

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(rx, ry, cw, rh);
    // jagged edge
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    for (let k = 0; k < rh; k += 6) ctx.fillRect(rx + cw, ry + k, ((k * 7) % 5) + 2, 6);
    this.front = { x: rx + cw, y: ry + rh + this.scrollY - 5 };

    const miners = Math.min(8, r.jobs.miner);

    if (d.blocked >= 0) {
      // Miners keep chipping at a glowing seal; sparks fly but nothing gives.
      const g = GUARDIANS[d.blocked];
      const sealX = rx + Math.min(rw * 0.55, 150);
      this.sealX = sealX;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(rx, ry, sealX - rx, rh);
      const glow = 0.55 + 0.35 * Math.sin(t * 3);
      for (let k = 0; k < rh; k += 10) {
        ctx.fillStyle = '#5c4a66';
        ctx.fillRect(sealX, ry + k, 12, 9);
        ctx.fillStyle = `rgba(217,87,99,${glow})`;
        ctx.fillRect(sealX + 4, ry + k + 3, 4, 3);
      }
      ctx.fillStyle = `rgba(217,87,99,${0.08 + 0.06 * Math.sin(t * 3)})`;
      ctx.fillRect(sealX + 12, ry, rx + rw - sealX - 12, rh);
      drawSprite(ctx, g.sprite, rx + rw - 36, ry + rh - 2, 3.4 * (1 + Math.sin(t * 3) * 0.04), true, g.pal);
      for (let k = 0; k < miners; k++) {
        const x = sealX - 12 - k * 15;
        if (x < rx + 8) break;
        const frame = Math.floor(t * 5 + k * 0.7) % 2;
        drawSprite(ctx, 'worker', x, ry + rh - 5, 2);
        drawSprite(ctx, 'pick', x + 9, ry + rh - (frame ? 22 : 14), 2, frame === 1);
      }
      if (miners > 0) {
        this.spawnAcc += dt * Math.min(10, 2 + miners);
        while (this.spawnAcc > 1) { this.spawnAcc--; this.spark(sealX, ry + rh - 12 + this.scrollY); }
      }
      ctx.font = '800 11px "Nunito", sans-serif';
      ctx.fillStyle = '#fbf236';
      ctx.fillText(`Sealed by ${g.name}!`, rx + 6, ry + 13);
      return;
    }

    for (let k = 0; k < miners; k++) {
      const x = Math.max(rx + 10, rx + cw - 12 - k * 15);
      const frame = Math.floor(t * 5 + k * 0.7) % 2;
      drawSprite(ctx, 'worker', x, ry + rh - 5, 2);
      drawSprite(ctx, 'pick', x + 9, ry + rh - (frame ? 22 : 14), 2, frame === 1);
    }
    // ambient digging debris
    if (d.digPower > 0) {
      this.spawnAcc += dt * Math.min(20, 2 + d.digPower * 0.5);
      const b = biomeAt(r.depth);
      while (this.spawnAcc > 1) { this.spawnAcc--; this.spawnChunk(this.front.x, this.front.y, b.colors[Math.floor(Math.random() * 3)], 0.6); }
    }
    if (r.depth < 3) {
      ctx.font = '800 13px "Nunito", sans-serif';
      ctx.fillStyle = `rgba(251,242,54,${0.6 + 0.4 * Math.sin(t * 4)})`;
      ctx.textAlign = 'right';
      ctx.fillText('Tap anywhere to dig!', rx + rw - 8, ry + 18);
      ctx.textAlign = 'left';
    }
    // progress bar
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(rx, ry + rh + 1, rw, 3);
    ctx.fillStyle = '#fbf236';
    ctx.fillRect(rx, ry + rh + 1, rw * frac, 3);
  }

  private updateParticles(dt: number, sy: number) {
    const { ctx } = this;
    const keep: Particle[] = [];
    for (const p of this.particles) {
      p.life += dt;
      if (p.life >= p.max) continue;
      if (p.ring) {
        const k = p.life / p.max;
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3 - 2 * k;
        ctx.beginPath(); ctx.arc(p.x, p.y - sy, 6 + k * 26, 0, Math.PI * 2); ctx.stroke();
      } else if (p.text) {
        p.y += p.vy * dt;
        ctx.globalAlpha = 1 - p.life / p.max;
        ctx.font = `800 ${p.small ? 13 : 18}px "Nunito", sans-serif`;
        ctx.fillStyle = '#1b1622';
        ctx.fillText(p.text, p.x + 1, p.y - sy + 1);
        ctx.fillStyle = p.color;
        ctx.fillText(p.text, p.x, p.y - sy);
      } else {
        p.vy += 700 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.floorY !== undefined && p.y > p.floorY) { p.y = p.floorY; p.vy *= -0.35; p.vx *= 0.6; }
        ctx.globalAlpha = Math.min(1, 2 * (1 - p.life / p.max));
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x), Math.round(p.y - sy - p.size), p.size, p.size);
      }
      keep.push(p);
    }
    ctx.globalAlpha = 1;
    this.particles = keep.length > 300 ? keep.slice(-300) : keep;
  }
}
