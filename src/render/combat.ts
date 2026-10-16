// The Expedition battle view. Draws into whichever canvas is showing (Battle tab or the mini window).
import { CLASSES, CLASS_IDS, ZONE_CELLS } from '../data/defs';
import { Derived, enemyStats, squadStats } from '../game/calc';
import { on } from '../game/events';
import type { GameState } from '../game/state';
import { fmt } from '../ui/format';
import { drawSprite } from './sprites';

interface Fx { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; text?: string; size: number }

const BANDS = [
  ['#2a2233', '#3d3049'], ['#22302e', '#2f4440'], ['#2e2a24', '#4a3e30'], ['#2b2033', '#45305a'], ['#331d1a', '#5a2c22'],
];

export class CombatView {
  private fx: Fx[] = [];
  private numAcc = 0;
  private lastKey = '';
  private flash = 0;
  private lunge = 0;
  private abilityFlash: { kind: string; t: number } | null = null;
  private lastW = 300; private lastH = 200;

  constructor() {
    on('kill', () => { this.poof(); });
    on('ability', (kind: string) => { this.abilityFlash = { kind, t: 0 }; });
  }

  private poof() {
    const ex = this.lastW * 0.72, ey = this.lastH * 0.78;
    for (let i = 0; i < 14; i++) {
      this.fx.push({ x: ex, y: ey - 20, vx: (Math.random() - 0.5) * 200, vy: -Math.random() * 180, life: 0, max: 0.7, color: i % 2 ? '#fff' : '#fbf236', size: 3 });
    }
  }

  draw(canvas: HTMLCanvasElement, s: GameState, d: Derived, t: number, dt: number, mini = false) {
    const dpr = Math.min(2, devicePixelRatio || 1);
    const W = canvas.clientWidth, H = canvas.clientHeight;
    if (!W || !H) return;
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    }
    this.lastW = W; this.lastH = H;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    const c = s.run.combat;
    const sc = mini ? 0.55 : 1;

    // background
    const band = BANDS[Math.min(BANDS.length - 1, Math.floor((c.zone - 1) / 5))];
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, band[0]); g.addColorStop(1, band[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let i = 0; i < 9; i++) {
      const x = ((i * 97 - t * 8) % (W + 40) + W + 40) % (W + 40) - 20;
      const hh = 10 + ((i * 37) % 30);
      ctx.fillRect(x, 0, 10, hh * sc * 1.4);
      ctx.fillRect(x + 3, hh * sc * 1.4, 4, 6);
    }
    const ground = H * 0.82;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, ground, W, H - ground);

    // zone progress cells
    if (!mini) {
      const cw = Math.min(10, (W - 20) / ZONE_CELLS - 2);
      for (let i = 0; i < ZONE_CELLS; i++) {
        ctx.fillStyle = i < c.cell ? '#6abe30' : i === c.cell ? '#fbf236' : i === ZONE_CELLS - 1 ? '#9e2a3a' : 'rgba(255,255,255,0.2)';
        if (c.mode === 'guardian') ctx.fillStyle = '#d95763';
        ctx.fillRect(10 + i * (cw + 2), 8, cw, 6);
      }
    }
    ctx.font = `700 ${mini ? 10 : 12}px "Pixelify Sans", monospace`;
    ctx.fillStyle = '#fff';
    ctx.fillText(c.mode === 'guardian' ? 'GUARDIAN FIGHT' : `Zone ${c.zone} · ${c.cell + 1}/${ZONE_CELLS}`, mini ? 4 : 10, mini ? 12 : 30);

    if (!c.alive) {
      const size = Object.values(c.plan).reduce((a, b) => a + b, 0);
      ctx.fillStyle = '#fbf236';
      ctx.textAlign = 'center';
      const msg = size === 0 ? 'Add soldiers to your squad' : d.idle >= size ? 'Regrouping…' : `Need ${size} idle colonists`;
      ctx.fillText(msg, W / 2, H / 2);
      if (d.idle >= size && size > 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(W / 2 - 50, H / 2 + 8, 100, 5);
        ctx.fillStyle = '#6abe30'; ctx.fillRect(W / 2 - 50, H / 2 + 8, 100 * Math.min(1, c.regroup / d.regroupTime), 5);
      }
      ctx.textAlign = 'left';
      this.drawFx(ctx, dt);
      return;
    }

    const e = enemyStats(s);
    const sq = squadStats(s);

    // floating numbers, drained every 0.4s
    this.numAcc += dt;
    if (this.numAcc > 0.4) {
      this.numAcc = 0;
      if (c.dmgOut > 0) {
        this.fx.push({ x: W * 0.68 + Math.random() * 20, y: ground - 50 * sc - e.scale * 6, vx: 0, vy: -50, life: 0, max: 0.8, color: '#fbf236', text: fmt(c.dmgOut), size: mini ? 10 : 15 });
        this.flash = 0.12; this.lunge = 0.15;
      }
      if (c.dmgIn > 0.5) this.fx.push({ x: W * 0.22, y: ground - 60 * sc, vx: 0, vy: -40, life: 0, max: 0.8, color: '#d95763', text: '-' + fmt(c.dmgIn), size: mini ? 9 : 13 });
      if (c.healed > 0.5 && sq.heal > sq.maxHp * 0.011) this.fx.push({ x: W * 0.12, y: ground - 70 * sc, vx: 0, vy: -40, life: 0, max: 0.8, color: '#6abe30', text: '+' + fmt(c.healed), size: mini ? 9 : 13 });
      c.dmgOut = 0; c.dmgIn = 0; c.healed = 0;
    }
    this.flash = Math.max(0, this.flash - dt);
    this.lunge = Math.max(0, this.lunge - dt);

    // squad
    const list: string[] = [];
    const total = sq.size || 1;
    const shown = Math.min(6, sq.size);
    for (const id of CLASS_IDS) {
      const k = Math.round((c.squad[id] / total) * shown);
      for (let i = 0; i < k && list.length < shown; i++) list.push(id);
    }
    if (!list.length && sq.size) list.push('recruit');
    const unit = 3 * sc;
    list.forEach((id, i) => {
      const col = i % 3, row = Math.floor(i / 3);
      const x = W * 0.12 + col * 22 * sc + row * 11 * sc + (this.lunge > 0 ? 6 : 0);
      const y = ground - row * 6 * sc + Math.abs(Math.sin(t * 6 + i)) * -2;
      const pal = CLASSES[id as keyof typeof CLASSES].pal;
      drawSprite(ctx, 'worker', x, y, unit, false, pal);
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

    // enemy
    const key = `${c.zone}:${c.cell}:${c.mode}`;
    if (key !== this.lastKey) this.lastKey = key;
    const ex = W * 0.72, bob = Math.sin(t * 3) * 2;
    drawSprite(ctx, e.sprite, ex - (this.lunge > 0 ? 0 : 4), ground + bob, e.scale * sc, true, this.flash > 0 ? whiten(e.pal) : e.pal);

    // bars
    if (!mini) {
      this.bar(ctx, 10, 40, W * 0.4, 8, c.squadHp / sq.maxHp, '#6abe30', `${fmt(c.squadHp)} / ${fmt(sq.maxHp)}`);
      this.bar(ctx, W * 0.55, 40, W * 0.42, 8, c.enemyHp / c.enemyMax, '#d95763', e.name);
    } else {
      this.bar(ctx, 4, 18, W * 0.4, 4, c.squadHp / sq.maxHp, '#6abe30');
      this.bar(ctx, W * 0.55, 18, W * 0.4, 4, c.enemyHp / c.enemyMax, '#d95763');
    }

    if (this.abilityFlash) {
      this.abilityFlash.t += dt;
      const a = 1 - this.abilityFlash.t / 0.6;
      if (a <= 0) this.abilityFlash = null;
      else {
        ctx.fillStyle = this.abilityFlash.kind === 'cry' ? `rgba(217,87,99,${a * 0.4})` : `rgba(123,213,245,${a * 0.4})`;
        ctx.fillRect(0, 0, W, H);
        if (!mini) {
          ctx.font = '700 22px "Pixelify Sans", monospace';
          ctx.fillStyle = `rgba(255,255,255,${a})`;
          ctx.textAlign = 'center';
          ctx.fillText(this.abilityFlash.kind === 'cry' ? 'BATTLE CRY!' : 'SHIELD WALL!', W / 2, H * 0.45);
          ctx.textAlign = 'left';
        }
      }
    }
    this.drawFx(ctx, dt);
  }

  private bar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, frac: number, color: string, label?: string) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color; ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
    if (label) {
      ctx.font = '11px "Pixelify Sans", monospace';
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
      if (!p.text) p.vy += 500 * dt;
      ctx.globalAlpha = 1 - p.life / p.max;
      if (p.text) {
        ctx.font = `700 ${p.size}px "Pixelify Sans", monospace`;
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
