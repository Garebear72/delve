// Canvas views for the full-screen mini-games (Plinko, Mine-Cart, Wheel). Purely visual: results are
// decided by game/minigames.ts the moment you play, and these views animate them from the events it emits.
import { BOONS, BOON_IDS, CART, PLINKO } from '../data/minigames';
import { on } from '../game/events';
import type { PlinkoResult } from '../game/minigames';
import type { GameState } from '../game/state';
import { fmt } from '../ui/format';

interface Ball { path: number[]; t: number; mult: number; gold: number; slot: number; done: boolean; golden: boolean }
interface Pop { x: number; y: number; text: string; color: string; life: number }
interface Spark { x: number; y: number; vx: number; vy: number; life: number; color: string }

const ROW_TIME = 0.13; // seconds per peg row
const SPIN_TIME = 3.2;

export class ArcadeView {
  private balls: Ball[] = [];
  private pops: Pop[] = [];
  private sparks: Spark[] = [];
  private slotFlash: number[] = PLINKO.slots.map(() => 0);
  private W = 300; private H = 300;
  // wheel
  private angle = 0; private spinFrom = 0; private spinTo = 0; private spinT = -1; private spinIdx = -1;
  /** Name of the last boon, shown once the wheel stops. */
  lastBoon = '';
  // cart
  private cartPos = 0; private cartTarget = 0; private crash = 0;

  constructor() {
    on('plinko', (r: PlinkoResult) => this.balls.push({ path: r.path, t: 0, mult: r.mult, gold: r.gold, slot: r.slot, done: false, golden: r.golden }));
    on('wheel', (idx: number) => this.spin(idx));
    on('cart', (what: string) => {
      if (what === 'start') { this.cartPos = 0; this.cartTarget = 0; this.crash = 0; }
      if (what === 'safe') this.cartTarget++;
      if (what === 'crash') { this.crash = 1.2; this.burst(this.cartX(this.cartTarget + 0.5), this.H * 0.55, ['#df7126', '#fbf236', '#6f6559'], 26); }
    });
  }

  get spinning() { return this.spinT >= 0; }

  draw(canvas: HTMLCanvasElement, game: string, s: GameState, t: number, dt: number) {
    const dpr = Math.min(2, devicePixelRatio || 1);
    const W = canvas.clientWidth, H = canvas.clientHeight;
    if (!W || !H) return;
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    }
    this.W = W; this.H = H;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (game === 'plinko') this.drawPlinko(ctx, s, t, dt);
    else if (game === 'wheel') this.drawWheel(ctx, dt);
    else if (game === 'cart') this.drawCart(ctx, s, t, dt);
    this.drawFx(ctx, dt);
  }

  // ---------------------------------------------------------------- plinko
  private colX(c: number) { const pad = this.W * 0.08; return pad + (c * (this.W - 2 * pad)) / (PLINKO.cols - 1); }
  private rowY(r: number) { return this.H * 0.1 + (r * this.H * 0.68) / PLINKO.rows; }
  /** Which drop column a tap at x lands in. */
  columnAt(x: number) { const pad = this.W * 0.08; return Math.round(((x - pad) / (this.W - 2 * pad)) * (PLINKO.cols - 1)); }

  private drawPlinko(ctx: CanvasRenderingContext2D, s: GameState, t: number, dt: number) {
    const { W, H } = this;
    ctx.fillStyle = '#2b2033'; ctx.fillRect(0, 0, W, H);
    // drop markers
    ctx.fillStyle = 'rgba(251,242,54,0.25)';
    for (let c = 0; c < PLINKO.cols; c++) { ctx.beginPath(); ctx.moveTo(this.colX(c) - 6, 4); ctx.lineTo(this.colX(c) + 6, 4); ctx.lineTo(this.colX(c), 14); ctx.fill(); }
    // pegs sit between the columns the ball can be in on each row
    ctx.fillStyle = '#b0a08f';
    for (let r = 1; r <= PLINKO.rows; r++) {
      const y = (this.rowY(r - 1) + this.rowY(r)) / 2;
      for (let c = 0; c < PLINKO.cols - 1; c++) {
        if ((c + r) % 2) continue;
        ctx.beginPath(); ctx.arc((this.colX(c) + this.colX(c + 1)) / 2, y, 3, 0, Math.PI * 2); ctx.fill();
      }
    }
    // the golden peg (moves after every drop): pass through it for extra Curio luck
    const [gr, gc] = s.run.plinkoPeg;
    const gx = this.colX(gc), gy = this.rowY(gr), pulse = 1 + Math.sin(t * 5) * 0.15;
    ctx.fillStyle = 'rgba(251,242,54,0.25)'; ctx.beginPath(); ctx.arc(gx, gy, 11 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fbf236'; ctx.beginPath(); ctx.arc(gx, gy, 5, 0, Math.PI * 2); ctx.fill();
    // gutters
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, this.W * 0.03, H); ctx.fillRect(W - this.W * 0.03, 0, this.W * 0.03, H);
    // slots
    const sy = this.rowY(PLINKO.rows) + 14, sh = H - sy - 6;
    const sw = (W * 0.84) / (PLINKO.cols - 1);
    PLINKO.slots.forEach((m, c) => {
      this.slotFlash[c] = Math.max(0, this.slotFlash[c] - dt);
      const x = this.colX(c) - sw / 2 + 2;
      ctx.fillStyle = m >= 5 ? '#8a5a12' : m >= 2 ? '#2f5a24' : m >= 1 ? '#3b4a5c' : '#4a2a2a';
      if (this.slotFlash[c] > 0) ctx.fillStyle = '#fbf236';
      ctx.fillRect(x, sy, sw - 4, sh);
      ctx.fillStyle = this.slotFlash[c] > 0 ? '#1b1622' : '#f3ead8';
      ctx.font = `800 ${Math.max(10, Math.min(14, sw * 0.38))}px Nunito, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(`×${m}`, this.colX(c), sy + sh / 2 + 5);
    });
    // balls
    for (const b of this.balls) {
      b.t += dt;
      const seg = b.t / ROW_TIME;
      const steps = b.path.length - 1;
      const i = Math.min(steps, Math.floor(seg));
      const f = Math.min(1, seg - i);
      let x: number, y: number;
      if (b.slot < 0 && i >= steps) {
        // fell into the gutter: tumble off the side of the board
        const side = b.path[steps] < 0 ? -1 : 1;
        const k = (b.t - steps * ROW_TIME);
        x = this.colX(b.path[steps]) + side * k * 30; y = this.rowY(steps) + k * k * 400;
        if (!b.done) { b.done = true; this.pops.push({ x: this.colX(b.path[steps - 1]), y: this.rowY(steps), text: 'Gutter!', color: '#ff7b86', life: 1 }); }
      } else if (i >= steps) {
        x = this.colX(b.slot); y = this.rowY(PLINKO.rows) + Math.min(1, (b.t - PLINKO.rows * ROW_TIME) / 0.2) * 20;
        if (!b.done) {
          b.done = true;
          this.slotFlash[b.slot] = 0.5;
          this.pops.push({ x, y: sy - 8, text: `+${fmt(b.gold)}`, color: b.mult >= 1 ? '#8fe05a' : '#f3ead8', life: 1.2 });
          if (b.mult >= 5) this.burst(x, sy, ['#fbf236', '#ffffff', '#df7126'], 30);
        }
      } else {
        const x0 = this.colX(b.path[i]), x1 = this.colX(b.path[i + 1]);
        x = x0 + (x1 - x0) * f;
        y = this.rowY(i) + (this.rowY(i + 1) - this.rowY(i)) * f - Math.sin(f * Math.PI) * 8;
        if (b.golden && i + 1 === gr && f > 0.9 && !b.done) this.burst(x, y, ['#fbf236', '#ffffff'], 4);
      }
      ctx.fillStyle = '#c27b3e'; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e8b796'; ctx.beginPath(); ctx.arc(x - 2, y - 2, 2, 0, Math.PI * 2); ctx.fill();
    }
    this.balls = this.balls.filter((b) => b.t < (b.path.length - 1) * ROW_TIME + 0.6);
  }

  // ---------------------------------------------------------------- wheel
  private spin(idx: number) {
    const n = BOON_IDS.length, seg = (Math.PI * 2) / n;
    // The pointer is at the top (-90°). Segment i spans [i*seg, (i+1)*seg) from the wheel's own zero.
    const jitter = (Math.random() - 0.5) * seg * 0.6;
    const want = -Math.PI / 2 - (idx + 0.5) * seg + jitter;
    const base = this.angle % (Math.PI * 2);
    let target = want;
    while (target < base) target += Math.PI * 2;
    this.spinFrom = this.angle; this.spinTo = this.angle - base + target + Math.PI * 2 * 5;
    this.spinT = 0; this.spinIdx = idx; this.lastBoon = '';
  }

  private drawWheel(ctx: CanvasRenderingContext2D, dt: number) {
    const { W, H } = this;
    const cx = W / 2, cy = H / 2 + 6, R = Math.min(W, H) * 0.42;
    if (this.spinT >= 0) {
      this.spinT += dt;
      const p = Math.min(1, this.spinT / SPIN_TIME);
      const ease = 1 - Math.pow(1 - p, 4);
      this.angle = this.spinFrom + (this.spinTo - this.spinFrom) * ease;
      if (p >= 1) {
        this.spinT = -1;
        const id = BOON_IDS[this.spinIdx];
        this.lastBoon = id;
        this.burst(cx, cy - R, [BOONS[id].color, '#ffffff', '#fbf236'], 30);
      }
    }
    const n = BOON_IDS.length, seg = (Math.PI * 2) / n;
    // glow
    ctx.fillStyle = 'rgba(251,242,54,0.08)'; ctx.beginPath(); ctx.arc(cx, cy, R + 14, 0, Math.PI * 2); ctx.fill();
    BOON_IDS.forEach((id, i) => {
      const a0 = this.angle + i * seg, a1 = a0 + seg;
      ctx.fillStyle = BOONS[id].color;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, a0, a1); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#1b1622'; ctx.lineWidth = 2; ctx.stroke();
      ctx.save();
      ctx.translate(cx, cy); ctx.rotate(a0 + seg / 2);
      ctx.textAlign = 'center';
      ctx.font = `${Math.max(14, R * 0.17)}px sans-serif`;
      ctx.fillText(BOONS[id].icon, R * 0.72, R * 0.06);
      ctx.fillStyle = id === 'nothing' ? '#f3ead8' : '#1b1622';
      ctx.font = `800 ${Math.max(9, R * 0.075)}px Nunito, sans-serif`;
      ctx.fillText(BOONS[id].name.split(' ').slice(-1)[0], R * 0.42, 4);
      ctx.restore();
    });
    ctx.fillStyle = '#5a3a24'; ctx.beginPath(); ctx.arc(cx, cy, R * 0.16, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fbf236'; ctx.beginPath(); ctx.arc(cx, cy, R * 0.07, 0, Math.PI * 2); ctx.fill();
    // pointer
    ctx.fillStyle = '#f3ead8';
    ctx.beginPath(); ctx.moveTo(cx - 12, cy - R - 16); ctx.lineTo(cx + 12, cy - R - 16); ctx.lineTo(cx, cy - R + 8); ctx.closePath(); ctx.fill();
  }

  // ---------------------------------------------------------------- cart
  private cartX(p: number) { return this.W * 0.08 + (p / CART.forks) * this.W * 0.84; }

  private drawCart(ctx: CanvasRenderingContext2D, s: GameState, t: number, dt: number) {
    const { W, H } = this;
    const c = s.run.cart;
    ctx.fillStyle = '#22302e'; ctx.fillRect(0, 0, W, H);
    // stalactites
    ctx.fillStyle = '#1b2422';
    for (let i = 0; i < 12; i++) { const x = (i * 53) % W; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 10, 0); ctx.lineTo(x + 5, 14 + (i * 17) % 24); ctx.fill(); }
    const mid = H * 0.55;
    // track so far and the next fork
    const yOf = (k: string | undefined) => (k === 'rickety' ? mid + H * 0.14 : k === 'sturdy' ? mid - H * 0.14 : mid);
    for (let i = 0; i <= CART.forks; i++) {
      const x = this.cartX(i);
      ctx.fillStyle = '#4a3a2e'; ctx.fillRect(x - 2, mid - H * 0.2, 4, H * 0.4);
      ctx.fillStyle = '#b0a08f'; ctx.font = '700 11px Nunito, sans-serif'; ctx.textAlign = 'center';
      if (i < CART.forks) ctx.fillText(`Fork ${i + 1}`, (x + this.cartX(i + 1)) / 2, H - 10);
    }
    for (let i = 0; i < CART.forks; i++) {
      const x0 = this.cartX(i), x1 = this.cartX(i + 1);
      const taken = c.path[i];
      for (const k of ['sturdy', 'rickety'] as const) {
        const y = yOf(k);
        const on = taken === k;
        ctx.strokeStyle = k === 'sturdy' ? (on ? '#c27b3e' : 'rgba(194,123,62,0.35)') : (on ? '#d95763' : 'rgba(217,87,99,0.35)');
        ctx.lineWidth = on ? 4 : 2;
        ctx.setLineDash(k === 'rickety' ? [6, 5] : []);
        ctx.beginPath(); ctx.moveTo(x0, mid); ctx.lineTo(x0 + 16, y); ctx.lineTo(x1 - 16, y); ctx.lineTo(x1, mid); ctx.stroke();
      }
      ctx.setLineDash([]);
    }
    // cart
    this.cartPos += Math.sign(this.cartTarget - this.cartPos) * Math.min(Math.abs(this.cartTarget - this.cartPos), dt * 1.6);
    const seg = Math.floor(Math.min(this.cartPos, CART.forks - 0.001));
    const f = this.cartPos - seg;
    const kind = c.path[seg];
    const lane = f < 0.12 ? f / 0.12 : f > 0.88 ? (1 - f) / 0.12 : 1;
    let x = this.cartX(this.cartPos);
    let y = mid + (yOf(kind) - mid) * lane - 10;
    let rot = 0;
    if (this.crash > 0) {
      this.crash = Math.max(0, this.crash - dt);
      x = this.cartX(this.cartTarget + 0.5); y = yOf(c.path[this.cartTarget]) - 10 + (1.2 - this.crash) * 30; rot = (1.2 - this.crash) * 4;
    } else if (c.result === 'crash') {
      x = this.cartX(this.cartTarget + 0.5); y = yOf(c.path[this.cartTarget]) + 26; rot = Math.PI * 0.9;
    }
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    const bob = c.result === 'riding' ? Math.sin(t * 20) * 1 : 0;
    ctx.fillStyle = '#6f6559'; ctx.fillRect(-16, -12 + bob, 32, 14);
    ctx.fillStyle = '#9badb7'; ctx.fillRect(-16, -12 + bob, 32, 3);
    ctx.fillStyle = '#fbf236'; ctx.fillRect(-10, -17 + bob, 8, 6); ctx.fillRect(1, -16 + bob, 7, 5);
    ctx.fillStyle = '#1b1b26'; ctx.beginPath(); ctx.arc(-9, 4, 5, 0, Math.PI * 2); ctx.arc(9, 4, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if (c.result === 'riding' && this.cartPos >= this.cartTarget - 0.01 && Math.random() < 0.3) {
      this.sparks.push({ x: x - 12, y: y + 8, vx: -40 - Math.random() * 40, vy: -Math.random() * 30, life: 0.3, color: '#fbf236' });
    }
  }

  // ---------------------------------------------------------------- effects
  private burst(x: number, y: number, colors: string[], n: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = 60 + Math.random() * 140;
      this.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: 0.6 + Math.random() * 0.5, color: colors[i % colors.length] });
    }
  }

  private drawFx(ctx: CanvasRenderingContext2D, dt: number) {
    for (const p of this.sparks) {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt;
      ctx.fillStyle = p.color; ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2));
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    this.sparks = this.sparks.filter((p) => p.life > 0);
    ctx.textAlign = 'center';
    for (const p of this.pops) {
      p.life -= dt; p.y -= 30 * dt;
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.5));
      ctx.fillStyle = p.color; ctx.font = '800 16px Nunito, sans-serif';
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
    this.pops = this.pops.filter((p) => p.life > 0);
  }
}
