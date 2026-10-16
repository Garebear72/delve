// The Skills tab: skill levels, the node map for each tree, and run perks.
import { NODES, NODE_BY_ID, NodeKind, PERKS, SKILLS, SKILL_IDS, SkillId, TIER_REQ } from '../data/skills';
import {
  generalEarned, generalFree, learnState, levelOf, perkFree, perkRespecCost, perkSpent, rank, skillLevel, skillXp,
  treeFree, treePoints, treeSpent, xpForLevel,
} from '../game/skills';
import type { GameState } from '../game/state';
import { fmt } from './format';

export interface SkillsUI { skillTree: SkillId | 'run'; skillNode: string }

const KIND: Record<NodeKind, string> = { small: 'Passive', notable: 'Notable', keystone: 'Keystone', ability: 'Ability', choice: 'Choice' };

// Map geometry (px): the map is a fixed-width column, centred in the panel.
const W = 330, CX = W / 2, COL = 70, TIER_H = 176, ROW_H = 80, TOP = 34;
const pos = (n: { tier: number; row?: number; col: number }) => ({ x: CX + n.col * COL, y: TOP + n.tier * TIER_H + (n.row ?? 0) * ROW_H + 44 });

export function unspentPoints(s: GameState) {
  return SKILL_IDS.reduce((a, t) => a + treeFree(s, t), 0) + generalFree(s) + perkFree(s);
}

export function skillsPanel(s: GameState, ui: SkillsUI) {
  // A compact 3×2 grid of skills (plus run perks); the selected one shows its XP bar below.
  const chip = (id: string, icon: string, name: string, sub: string, free: number) =>
    `<button class="skchip ${ui.skillTree === id ? 'on' : ''}" data-act="skillTree" data-arg="${id}">
      <span class="sk-icon">${icon}</span><span class="sk-main"><b>${name}</b><span class="sub">${sub}</span></span>
      ${free ? `<span class="pts">${free}</span>` : ''}</button>`;
  const chips = SKILL_IDS.map((id) => chip(id, SKILLS[id].icon, SKILLS[id].name, `Lv ${skillLevel(s, id)}`, treeFree(s, id))).join('')
    + chip('run', '🎲', 'Run Perks', `${perkSpent(s)} spent`, perkFree(s));

  let detail = '';
  if (ui.skillTree !== 'run') {
    const id = ui.skillTree;
    const xp = skillXp(s, id), lvl = levelOf(xp);
    const lo = xpForLevel(lvl), hi = xpForLevel(lvl + 1);
    const frac = lvl >= 99 ? 1 : (xp - lo) / Math.max(1, hi - lo);
    detail = `<div class="skdetail"><div class="sk-top"><b>${SKILLS[id].icon} ${SKILLS[id].name} level ${lvl}</b>
      <span class="sub">${lvl >= 99 ? 'Max level' : `${fmt(xp - lo)} / ${fmt(hi - lo)} XP`}</span></div>
      <span class="xpbar"><i style="width:${(frac * 100).toFixed(1)}%"></i></span></div>`;
  }

  const gen = generalFree(s);
  return `
    <h3>Skills <span class="sub">General points: <b class="${gen ? 'good' : ''}">${gen}</b> free of ${generalEarned(s)}</span></h3>
    <div class="skgrid">${chips}</div>
    ${detail}
    ${ui.skillTree === 'run' ? perksView(s) : treeView(s, ui.skillTree, ui.skillNode)}
    <p class="sub">Skills level up by doing. Each level gives a point for that skill's tree. General points come from achievements, guardians and zone milestones, and work in any tree.</p>`;
}

function treeView(s: GameState, tree: SkillId, selected: string) {
  const nodes = NODES.filter((n) => n.tree === tree);
  const spent = treeSpent(s, tree);
  const tiers = Math.max(...nodes.map((n) => n.tier)) + 1;
  const height = TOP + tiers * TIER_H;

  const bands = Array.from({ length: tiers }, (_, t) => {
    const need = TIER_REQ[t] ?? 0;
    const open = spent >= need;
    return `<div class="tierband ${open ? '' : 'locked'}" style="top:${TOP + t * TIER_H}px">
      <span>Tier ${t + 1}</span>${open ? '' : `<span>🔒 ${spent}/${need} points spent</span>`}</div>`;
  }).join('');

  const lines = nodes.flatMap((n) => (n.req ?? []).map((r) => {
    const a = pos(NODE_BY_ID[r]), b = pos(n);
    const lit = rank(s, r) > 0;
    return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="${lit ? 'lit' : ''}"/>`;
  })).join('');

  const buttons = nodes.map((n) => {
    const r = rank(s, n.id);
    const st = learnState(s, n.id);
    const excluded = !!n.group && r === 0 && NODES.some((o) => o.group === n.group && rank(s, o.id) > 0);
    const state = r >= n.max ? 'maxed' : r > 0 ? 'learned' : st.ok ? 'avail' : excluded ? 'excluded' : 'locked';
    const p = pos(n);
    const badge = n.max > 1 ? `<span class="rank">${r}/${n.max}</span>` : r ? '<span class="rank">✓</span>' : '';
    return `<button id="node-${n.id}" class="node k-${n.kind} ${state} ${selected === n.id ? 'sel' : ''}" style="left:${p.x}px;top:${p.y}px"
      data-act="skillNode" data-arg="${n.id}"><span>${n.icon}</span>${badge}</button>`;
  }).join('');

  const tp = treePoints(s, tree), tf = treeFree(s, tree);
  const sel = NODE_BY_ID[selected];
  const card = sel && sel.tree === tree ? (() => {
    const st = learnState(s, sel.id);
    const r = rank(s, sel.id);
    const pool = tf > 0 ? `uses 1 ${SKILLS[tree].name} point` : 'uses 1 general point';
    return `<div class="node-card k-${sel.kind}">
      <div class="nc-head"><span class="nc-icon">${sel.icon}</span><div class="grow"><b>${sel.name}</b>
        <div class="sub">${KIND[sel.kind]}${sel.max > 1 ? ` · rank ${r}/${sel.max}` : r ? ' · learned' : ''}</div></div>
        <button class="btn small" data-act="skillNode" data-arg="">✕</button></div>
      <div>${sel.desc}</div>
      ${st.ok ? `<div class="center"><button class="btn epic" data-act="learn" data-arg="${sel.id}">Learn (${pool})</button></div>`
        : st.reason ? `<div class="sub neg">${st.reason}</div>` : ''}
    </div>`;
  })() : '<div class="node-card hint">Tap a node to see what it does.</div>';

  return `
    <h3>${SKILLS[tree].icon} ${SKILLS[tree].name} tree <span class="sub">${tf} of ${tp} points free · ${spent} spent</span></h3>
    <div class="sub">${SKILLS[tree].desc} Respec this tree when you prestige.</div>
    <div class="skillmap" style="width:${W}px;height:${height}px">
      ${bands}<svg width="${W}" height="${height}">${lines}</svg>${buttons}
    </div>
    ${card}`;
}

function perksView(s: GameState) {
  const free = perkFree(s);
  const rows = PERKS.map((p) => {
    const r = s.run.perks[p.id] ?? 0;
    return `<div class="row"><span class="nc-icon">${p.icon}</span><div class="grow"><b>${p.name}</b> <span class="num">${r}/${p.max}</span>
      <div class="sub">${p.desc}</div></div>
      <button class="btn small" data-act="perk" data-arg="${p.id}" ${free > 0 && r < p.max ? '' : 'disabled'}>+</button></div>`;
  }).join('');
  const cost = perkRespecCost(s);
  return `
    <h3>🎲 Run Perks <span class="sub">${free} of ${s.run.perkPoints} points free</span></h3>
    <div class="sub">Earn a point for each new zone you clear and 3 for each guardian, this run. They reset when you prestige.</div>
    ${rows}
    <div class="row"><div class="grow"><b>Respec run perks</b><div class="sub">Refunds all run perk points. Costs ${fmt(cost)} gold (triples each time).</div></div>
      <button class="btn small" data-act="perkRespec" ${perkSpent(s) > 0 && s.run.res.gold >= cost ? '' : 'disabled'}>Respec</button></div>`;
}
