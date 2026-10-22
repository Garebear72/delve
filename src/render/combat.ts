// The Expedition battle view. Draws into whichever canvas is showing (Battle tab or the mini window).
// Visuals are driven by hit / hurt / heal events from the simulation, so every number matches a real hit.
import { CLASSES, CLASS_IDS, ClassId, ZONE_CELLS } from '../data/defs';
import { Derived, enemyStats, squadStats } from '../game/calc';
import { on } from '../game/events';
import type { GameState } from '../game/state';
import { fmt } from '../ui/format';
import { drawSprite } from './sprites';

interface Fx { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; text?: string; size: number; grav?: boolean }

const BANDS = [
  ['#2a2233', '#3d3049'], ['#22302e', '#2f4440'], ['#2e2a24', '#4a3e30'], ['#2b2033', '#45305a'], ['#331d1a', '#5a2c22'],
  ['#1f2a3a', '#2f4560'], ['#2e2740', '#4a3d6a'], ['#26303a', '#3b4752'], ['#14283a', '#1f3b4d'], ['#2c2826', '#4a4440'],
  ['#3a1a10', '#5a2a1a'], ['#1b1622', '#3d2a4a'],
];
const HIT_COLOR: Record<ClassId, string> = { recruit: '#f3ead8', fighter: '#cfe3ff', cleric: '#fff6a8', wizard: '#d6a8ff' };
const LUNGE = 0.18;

export class CombatView {
  private fx: Fx[] = [];
  private W = 300; private H = 200; private mini = false;
  private list: ClassId[] = []; // classes of the soldiers currently drawn, left to right
  private lunge: number[] = [];
  private turn: Partial<Record<ClassId, number>> = {};
  private enemyLunge = 0; private enemyFlash = 0; private squadFlash = 0; private shake = 0;
  private squadGhost = 1; private enemyGhost = 1; private lastKey = '';
  private abilityFlash: { kind: string; t: number } | null = null;

  constructor() {
    on('hit', (h: { cls: ClassId; dmg: number; crit: boolean }) => this.onHit(h));
    on('hurt', (h: { dmg: number }) => this.onHurt(h.dmg));
    on('heal', (h: { amt: number; cleric: boolean }) => this.onHeal(h.amt, h.cleric));
    on('kill', () => this.poof());
    on('ability', (kind: string) => { this.abilityFlash = { kind, t: 0 }; });
  }

  // ---------------------------------------------------------------- positions
  private get ground() { return this.H * 0.82; }
  private get sc() { return this.mini ? 0.55 : 1; }
  private enemyX() { return this.W * 0.72; }
  private slotX(i: number) { const col = i % 3, row = Math.floor(i / 3); return this.W * 0.12 + col * 22 * this.sc + row * 11 * this.sc; }

  // ---------------------------------------------------------------- events
  private text(x: number, y: number, text: string, color: string, size: number, vy = -55) {
    this.fx.push({ x: x + (Math.random() - 0.5) * 16, y, vx: 0, vy, life: 0, max: 0.9, color, text, size: this.mini ? Math.max(9, size * 0.65) : size });
  }

  private onHit(h: { cls: ClassId; dmg: number; crit: boolean }) {
    // Lunge one soldier of that class, taking turns among them.
    const idxs = this.list.map((c, i) => (c === h.cls ? i : -1)).filter((i) => i >= 0);
    if (idxs.length) {
      const n = (this.turn[h.cls] ?? 0) % idxs.length;
      this.turn[h.cls] = n + 1;
      this.lunge[idxs[n]] = LUNGE;
    }
    this.enemyFlash = 0.1;
    const ex = this.enemyX(), ey = this.ground - 40 * this.sc;
    if (h.crit) {
      this.shake = 0.18;
      this.text(ex, ey - 16, `${fmt(h.dmg)}!`, '#ffb000', 22);
    } else this.text(ex, ey, fmt(h.dmg), HIT_COLOR[h.cls], h.cls === 'wizard' ? 18 : 14);
    if (h.cls === 'wizard') this.burst(ex, ey + 10, ['#d6a8ff', '#8f56c9', '#ffffff'], 12);
    else this.burst(ex - 8, ey + 14, ['#ffffff', '#fbf236'], 4);
  }

  private onHurt(dmg: number) {
    this.enemyLunge = 0.2;
    this.squadFlash = 0.12;
    this.text(this.W * 0.2, this.ground - 55 * this.sc, '-' + fmt(dmg), '#ff7b86', 14);
  }

  private onHeal(amt: number, cleric: boolean) {
    this.text(this.W * 0.14, this.ground - 70 * this.sc, '+' + fmt(amt), '#8fe05a', 13, -40);
    if (cleric) for (let i = 0; i < 8; i++) {
      this.fx.push({ x: this.W * 0.08 + Math.random() * 70 * this.sc, y: this.ground - Math.random() * 30, vx: 0, vy: -30 - Math.random() * 30, life: 0, max: 0.9, color: '#8fe05a', size: 3 });
    }
  }

  private burst(x: number, y: number, colors: string[], n: number) {
    for (let i = 0; i < n; i++) {
      this.fx.push({ x, y, vx: (Math.random() - 0.5) * 220, vy: -Math.random() * 160, life: 0, max: 0.5, color: colors[i % colors.length], size: 3, grav: true });
    }
  }

  private poof() {
    this.burst(this.enemyX(), this.ground - 20, ['#ffffff', '#fbf236', '#b0a08f'], 16);
  }

  // ---------------------------------------------------------------- drawing
  draw(canvas: HTMLCanvasElement, s: GameState, d: Derived, t: number, dt: number, mini = false) {
    const dpr = Math.min(2, devicePixelRatio || 1);
    const W = canvas.clientWidth, H = canvas.clientHeight;
    if (!W || !H) return;
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    }
    this.W = W; this.H = H; this.mini = mini;
    const ctx = canvas.getContext('2d')!;
    const c = s.run.combat;
    const sc = this.sc, ground = this.ground;

    // timers
    this.lunge = this.lunge.map((v) => Math.max(0, v - dt));
    this.enemyLunge = Math.max(0, this.enemyLunge - dt);
    this.enemyFlash = Math.max(0, this.enemyFlash - dt);
    this.squadFlash = Math.max(0, this.squadFlash - dt);
    this.shake = Math.max(0, this.shake - dt);

    const sx = this.shake > 0 ? (Math.random() - 0.5) * 6 : 0, sy = this.shake > 0 ? (Math.random() - 0.5) * 6 : 0;
    ctx.setTransform(dpr, 0, 0, dpr, sx * dpr, sy * dpr);
    ctx.imageSmoothingEnabled = false;

    // background
    const band = BANDS[Math.min(BANDS.length - 1, Math.floor((c.zone - 1) / 5))];
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, band[0]); g.addColorStop(1, band[1]);
    ctx.fillStyle = g; ctx.fillRect(-4, -4, W + 8, H + 8);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let i = 0; i < 9; i++) {
      const x = ((i * 97 - t * 8) % (W + 40) + W + 40) % (W + 40) - 20;
      const hh = 10 + ((i * 37) % 30);
      ctx.fillRect(x, 0, 10, hh * sc * 1.4);
      ctx.fillRect(x + 3, hh * sc * 1.4, 4, 6);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-4, ground, W + 8, H - ground + 4);

    // zone progress
    if (!mini) {
      const cw = Math.min(10, (W - 20) / ZONE_CELLS - 2);
      for (let i = 0; i < ZONE_CELLS; i++) {
        ctx.fillStyle = c.mode === 'guardian' ? '#d95763' : i < c.cell ? '#6abe30' : i === c.cell ? '#fbf236' : i === ZONE_CELLS - 1 ? '#9e2a3a' : 'rgba(255,255,255,0.2)';
        ctx.fillRect(10 + i * (cw + 2), 8, cw, 6);
      }
    }
    ctx.font = `800 ${mini ? 10 : 12}px "Nunito", sans-serif`;
    ctx.fillStyle = '#fff';
    ctx.fillText(c.mode === 'guardian' ? 'GUARDIAN FIGHT' : `Zone ${c.zone} · ${c.cell + 1}/${ZONE_CELLS}`, mini ? 4 : 10, mini ? 12 : 30);

    if (!c.alive) {
      this.list = [];
      const size = Object.values(c.plan).reduce((a, b) => a + b, 0);
      ctx.fillStyle = '#fbf236';
      ctx.textAlign = 'center';
      // Soldiers are a job: they're always there, just knocked out until the regroup timer runs out.
      const left = Math.max(0, Math.ceil(d.regroupTime - c.regroup));
      const msg = size === 0 ? 'Add soldiers to your squad' : `Knocked out! Back up in ${left}s`;
      ctx.fillText(msg, W / 2, H / 2);
      if (size > 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(W / 2 - 50, H / 2 + 8, 100, 5);
        ctx.fillStyle = '#6abe30'; ctx.fillRect(W / 2 - 50, H / 2 + 8, 100 * Math.min(1, c.regroup / d.regroupTime), 5);
      }
      ctx.textAlign = 'left';
      this.drawFx(ctx, dt);
      return;
    }

    const e = enemyStats(s);
    const sq = squadStats(s);

    // squad: up to 6 soldiers drawn, in proportion to the classes in it
    const list: ClassId[] = [];
    const total = sq.size || 1;
    const shown = Math.min(6, sq.size);
    for (const id of CLASS_IDS) {
      const k = Math.max(c.squad[id] ? 1 : 0, Math.round((c.squad[id] / total) * shown));
      for (let i = 0; i < k && list.length < shown; i++) list.push(id);
    }
    if (list.join() !== this.list.join()) { this.list = list; this.lunge = list.map(() => 0); this.turn = {}; }
    list.forEach((id, i) => {
      const row = Math.floor(i / 3);
      const push = (this.lunge[i] ?? 0) > 0 ? 10 * sc * Math.sin(((LUNGE - this.lunge[i]) / LUNGE) * Math.PI) : 0;
      const x = this.slotX(i) + push;
      const y = ground - row * 6 * sc + Math.abs(Math.sin(t * 6 + i)) * -2;
      const pal = this.squadFlash > 0 ? { ...CLASSES[id].pal, c: '#ff8a8a', s: '#ffb0b0' } : CLASSES[id].pal;
      drawSprite(ctx, 'worker', x, y, 3 * sc, false, pal);
      drawSprite(ctx, id === 'cleric' ? 'i_know' : 'sword', x + 9 * sc, y - 12 * sc, 2 * sc);
    });
    if (c.cry > 0) {
      ctx.strokeStyle = `rgba(217,87,99,${0.5 + 0.3 * Math.sin(t * 12)})`;
      ctx.lineWidth = 3;
      ctx.strokeRect(W * 0.06, ground - 50 * sc, 90 * sc, 54 * sc);
    }
    if (c.wall > 0) {
      ctx.fillStyle = 'rgba(123,213,245,0.22)';
      ctx.beginPath(); ctx.ellipse(W * 0.2, ground, 70 * sc, 60 * sc, 0, Math.PI, 0); ctx.fill();
      ctx.strokeStyle = 'rgba(123,213,245,0.7)'; ctx.lineWidth = 2; ctx.stroke();
    }

    // enemy: recoils when hit, lunges when it attacks
    const key = `${c.zone}:${c.cell}:${c.mode}`;
    if (key !== this.lastKey) { this.lastKey = key; this.enemyGhost = 1; }
    const lungeE = this.enemyLunge > 0 ? -14 * sc * Math.sin(((0.2 - this.enemyLunge) / 0.2) * Math.PI) : 0;
    const recoil = this.enemyFlash > 0 ? 4 * sc : 0;
    drawSprite(ctx, e.sprite, this.enemyX() + lungeE + recoil, ground + Math.sin(t * 3) * 2, e.scale * sc, true, this.enemyFlash > 0 ? whiten(e.pal) : e.pal);

    // HP bars, with a pale "ghost" that catches up so each hit reads as a chunk
    const sqFrac = Math.max(0, c.squadHp / sq.maxHp), enFrac = Math.max(0, c.enemyHp / c.enemyMax);
    this.squadGhost = sqFrac > this.squadGhost ? sqFrac : Math.max(sqFrac, this.squadGhost - dt * 0.8);
    this.enemyGhost = enFrac > this.enemyGhost ? enFrac : Math.max(enFrac, this.enemyGhost - dt * 0.8);
    if (!mini) {
      this.bar(ctx, 10, 40, W * 0.4, 8, sqFrac, this.squadGhost, '#6abe30', `${fmt(c.squadHp)} / ${fmt(sq.maxHp)}`);
      this.bar(ctx, W * 0.55, 40, W * 0.42, 8, enFrac, this.enemyGhost, '#d95763', e.name);
    } else {
      this.bar(ctx, 4, 18, W * 0.4, 4, sqFrac, this.squadGhost, '#6abe30');
      this.bar(ctx, W * 0.55, 18, W * 0.4, 4, enFrac, this.enemyGhost, '#d95763');
    }

    if (this.abilityFlash) {
      this.abilityFlash.t += dt;
      const a = 1 - this.abilityFlash.t / 0.6;
      if (a <= 0) this.abilityFlash = null;
      else {
        ctx.fillStyle = this.abilityFlash.kind === 'cry' ? `rgba(217,87,99,${a * 0.4})` : `rgba(123,213,245,${a * 0.4})`;
        ctx.fillRect(-4, -4, W + 8, H + 8);
        if (!mini) {
          ctx.font = '800 22px "Nunito", sans-serif';
          ctx.fillStyle = `rgba(255,255,255,${a})`;
          ctx.textAlign = 'center';
          ctx.fillText(this.abilityFlash.kind === 'cry' ? 'BATTLE CRY!' : 'SHIELD WALL!', W / 2, H * 0.45);
          ctx.textAlign = 'left';
        }
      }
    }
    this.drawFx(ctx, dt);
  }

  private bar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, frac: number, ghost: number, color: string, label?: string) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fillRect(x, y, w * Math.min(1, ghost), h);
    ctx.fillStyle = color; ctx.fillRect(x, y, w * Math.min(1, frac), h);
    if (label) {
      ctx.font = '700 11px "Nunito", sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText(label, x, y + h + 12);
    }
  }

  private drawFx(ctx: CanvasRenderingContext2D, dt: number) {
    const keep: Fx[] = [];
    for (const p of this.fx) {
      p.life += dt;
      if (p.life >= p.max) continue;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.grav) p.vy += 500 * dt;
      ctx.globalAlpha = Math.min(1, 1.6 * (1 - p.life / p.max));
      if (p.text) {
        const pop = p.life < 0.08 ? 1.35 : 1;
        ctx.font = `800 ${Math.round(p.size * pop)}px "Nunito", sans-serif`;
        ctx.fillStyle = '#000'; ctx.fillText(p.text, p.x + 1, p.y + 1);
        ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, p.y);
      } else { ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.size, p.size); }
      keep.push(p);
    }
    ctx.globalAlpha = 1;
    this.fx = keep.slice(-120);
  }
}

function whiten(pal: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const ch of 'kwsShbBcCgGrRyopPeEmMuilnx') out[ch] = '#ffffff';
  return { ...out, ...Object.fromEntries(Object.keys(pal).map((k) => [k, '#ffffff'])) };
}
