// HTML for each sheet panel. Buttons use data-act / data-arg and are handled in ui.ts.
import {
  ABILITIES, AbilityId, ACHIEVEMENTS, ACH_BONUS, ADJACENCY, ASCEND, CELESTIAL, CLASSES, CLASS_IDS, DIVINE, ENEMIES, FLOORS, FLOOR_IDS, FOOD_PER_COLONIST, GEAR, GODS, GUARDIANS,
  GodId, ITEMS, JOBS, JOB_IDS, RACES, RaceId, RELICS, RESEARCH, RESOURCES, RES_IDS, ResId,
} from '../data/defs';
import {
  canAfford, celestialCost, divineCost, floorBuildCost, floorUnlocked, floorUpgradeCost, gearLevelCost, gearTierCost, gearTierReady, reliquarySlots, researchCost,
} from '../game/actions';
import { ascendOpen, biomeAt, canAscend, canPrestige, cel, celMult, celOn, Derived, div, divMult, enemyStats, guardianHp, pendingSparks, hasAbility, hasAutoCast, floorPower, gearMult, pendingFavor, squadStats } from '../game/calc';
import { backupTime, hasBackup, listSlots } from '../game/save';
import type { GameState } from '../game/state';
import { store } from '../game/store';
import { icon } from '../render/sprites';
import { esc, fmt, fmtRate, fmtTime } from './format';
import { prefs } from './prefs';
import { gamesTabOpen } from '../game/minigames';
import { curioList } from './gamesPanel';
import { cavernsSection } from './dungeonPanel';
import { dungeonsOpen } from '../game/dungeons';
import { SKILLS, SKILL_IDS, TREE_MAX } from '../data/skills';
import type { SkillId } from '../data/skills';
import { abilitySlots, knowsAbility, rank, skillLevel, treePoints } from '../game/skills';

export interface UIState {
  tab: string | null;
  slot: number;
  bookTab: string;
  bulk: number;
  armDemolish: number;
  keep: string[];
  nextRace: string;
  nextGod: string;
  pip: boolean;
  exportText: string;
  skillTree: SkillId | 'run';
  skillNode: string;
  showBonuses: boolean;
  respec: boolean; // reset skill trees on the next prestige
  game: string | null; // mini-game open full screen
}

type Cost = Partial<Record<ResId, number>>;

const btn = (label: string, act: string, arg: string | number = '', on = true, cls = '') =>
  `<button class="btn ${cls}" data-act="${act}" data-arg="${arg}" ${on ? '' : 'disabled'}>${label}</button>`;

function costHtml(s: GameState, cost: Cost) {
  return Object.entries(cost)
    .map(([k, v]) => {
      const ok = s.run.res[k as ResId] >= (v ?? 0);
      return `<span class="cost ${ok ? '' : 'short'}">${icon(RESOURCES[k as ResId].icon)}${fmt(v ?? 0)}</span>`;
    })
    .join(' ');
}

// ---------------------------------------------------------------- colony
export function colonyPanel(s: GameState, d: Derived, ui: UIState) {
  const r = s.run;
  const bulk = [1, 10, 100, 0].map((n) => btn(n ? '×' + n : 'Max', 'bulk', n, true, ui.bulk === n ? 'on small' : 'small')).join('');
  const jobs = JOB_IDS.map((j) => {
    const def = JOBS[j];
    if (!def.unlock(s)) {
      // Locked again (e.g. the Library was demolished) but still staffed: allow taking workers out.
      if (r.jobs[j] > 0) {
        return `<div class="row"><div class="grow"><b>${def.name}</b> <span class="num">${r.jobs[j]}</span>
          <div class="sub neg">No Library: these Scholars can't work. Reassign them.</div></div>${btn('−', 'job', j + ':-', true, 'small')}</div>`;
      }
      return `<div class="row locked"><div class="grow"><b>???</b><div class="sub">${j === 'scholar' ? 'Build a Library to train Scholars.' : ''}</div></div></div>`;
    }
    const each = j === 'miner' ? `${fmt(d.jobRate.miner)} dig/s each` : j === 'farmer' ? `${fmt(d.jobRate.farmer)} food/s each` : `${fmt(d.jobRate.scholar)} knowledge/s each`;
    return `<div class="row"><div class="grow"><b>${def.name}</b> <span class="num">${r.jobs[j]}</span><div class="sub">${def.desc} ${each}.</div></div>
      ${btn('−', 'job', j + ':-', r.jobs[j] > 0, 'small')}${btn('+', 'job', j + ':+', d.idle > 0, 'small')}</div>`;
  }).join('');

  const resRows = RES_IDS.filter((k) => r.res[k] > 0 || d.rates[k] !== 0).map((k) => {
    const cap = d.caps[k];
    return `<div class="kv">${icon(RESOURCES[k].icon)}<span>${RESOURCES[k].name}</span><span class="grow"></span>
      <span>${fmt(r.res[k])}${isFinite(cap) ? ' / ' + fmt(cap) : ''}</span><span class="rate ${d.rates[k] < 0 ? 'neg' : ''}">${fmtRate(d.rates[k])}</span></div>`;
  }).join('');

  const hasKnow = r.floors.some((f) => f?.type === 'library') || r.res.knowledge > 0;
  const avail = RESEARCH.filter((x) => !r.research.includes(x.id) && x.req(s));
  const research = !hasKnow ? '' : `<h3>Research <span class="sub">${r.research.length} done</span></h3>
    ${avail.map((x) => `<div class="row"><div class="grow"><b>${x.name}</b><div class="sub">${x.desc}</div><div>${costHtml(s, researchCost(s, x))}</div></div>
      ${btn('Research', 'research', x.id, canAfford(s, researchCost(s, x)))}</div>`).join('') || '<div class="sub">Nothing available right now. Dig and explore to reveal more.</div>'}`;

  const starving = d.rates.food < 0 && r.res.food < 30;
  return `
    <h3>Colony ${r.inBreak ? '<span class="tag bad">☕ Union Break</span>' : ''}</h3>
    <div class="kv">${icon('i_pop')}<span>Colonists</span><span class="grow"></span><b>${Math.floor(r.pop)} / ${d.maxPop}</b></div>
    <div class="kv"><span>Idle</span><span class="grow"></span><b>${d.idle}</b></div>
    ${d.reserved ? `<div class="kv"><span>Waiting to join the squad</span><span class="grow"></span><b>${d.reserved}</b></div>` : ''}
    <div class="kv"><span>Growth</span><span class="grow"></span><span>${r.pop >= d.maxPop ? 'Full (build Bunkhouses)' : r.res.food <= 0 ? '<span class="neg">Stopped: no food!</span>' : fmt(d.growth) + '/s'}</span></div>
    ${d.hungry ? '<div class="warn"><b>Your dwarves are starving!</b> Miners and Scholars work at half speed, and hungry dwarves wander off. Add Farmers or build a Mushroom Farm.</div>'
      : starving ? '<div class="warn">Mushrooms are running out. Add Farmers or build a Mushroom Farm.</div>' : ''}
    <div class="sub">Each dwarf eats ${FOOD_PER_COLONIST} mushrooms/s. A Farmer grows ${fmt(d.jobRate.farmer)}/s.</div>
    <h3>Jobs <span class="bulk">${bulk}</span></h3>
    ${jobs}
    <h3>Resources</h3>${resRows}
    ${research}`;
}

// ---------------------------------------------------------------- build / floor
export function buildPanel(s: GameState, d: Derived, ui: UIState) {
  const slot = ui.slot;
  const biome = biomeAt(slot);
  const nb = [s.run.floors[slot - 1], s.run.floors[slot + 1]].filter(Boolean).map((f) => f!.type);
  const rows = FLOOR_IDS.map((id) => {
    const def = FLOORS[id];
    if (!floorUnlocked(s, id)) return `<div class="row locked"><div class="grow"><b>${def.name}</b><div class="sub">🔒 ${def.unlockText}</div></div></div>`;
    const cost = floorBuildCost(s, id);
    const bm = biome.floorMult[id] ?? 1;
    const adj = nb.filter((n) => ADJACENCY.some(([a, b]) => (a === id && b === n) || (b === id && a === n))).length;
    const tags = [
      bm !== 1 ? `<span class="tag ${bm > 1 ? 'good' : 'bad'}">${biome.name} ×${bm}</span>` : '',
      adj ? `<span class="tag good">Neighbour bonus +${adj * 25}%</span>` : '',
    ].join('');
    return `<div class="row"><div class="grow"><b>${def.name}</b> ${tags}<div class="sub">${def.desc}</div><div>${costHtml(s, cost)}</div></div>
      ${btn('Build', 'build', id, canAfford(s, cost))}</div>`;
  }).join('');
  const pairs = ADJACENCY.map(([a, b]) => `${FLOORS[a].name} + ${FLOORS[b].name}`).join(' · ');
  return `<h3>Build on level ${slot + 1} <span class="sub">${biome.name}</span></h3>${rows}
    <p class="sub">Neighbours that boost each other: ${pairs}</p>`;
}

export function floorPanel(s: GameState, d: Derived, ui: UIState) {
  const f = s.run.floors[ui.slot];
  if (!f) return buildPanel(s, d, ui);
  const def = FLOORS[f.type];
  const cost = floorUpgradeCost(s, ui.slot);
  const bm = biomeAt(ui.slot).floorMult[f.type] ?? 1;
  const power = floorPower(s, ui.slot);
  return `<h3>${def.name} <span class="sub">Level ${f.level} · depth ${ui.slot + 1}</span></h3>
    <p>${def.desc}</p>
    <div class="kv"><span>Strength</span><span class="grow"></span><b>${power.toFixed(2)}</b></div>
    <div class="sub">Level ${f.level} × ${biomeAt(ui.slot).name} ${bm} × neighbours ${(power / f.level / bm).toFixed(2)}</div>
    <div class="row"><div class="grow"><b>Upgrade to level ${f.level + 1}</b><div>${costHtml(s, cost)}</div></div>${btn('Upgrade', 'upgrade', ui.slot, canAfford(s, cost))}</div>
    <div class="row"><div class="grow"><b>Demolish</b><div class="sub">Frees the level for something else. No refund.</div></div>
      ${btn(ui.armDemolish === ui.slot ? 'Really?' : 'Demolish', 'demolish', ui.slot, true, 'danger')}</div>`;
}

// ---------------------------------------------------------------- battle
export function battlePanel(s: GameState, d: Derived, ui: UIState) {
  const r = s.run, c = r.combat;
  const sq = squadStats(s);
  const plan = squadStats(s, c.plan);
  const planSize = Object.values(c.plan).reduce((a, b) => a + b, 0);
  const e = enemyStats(s);

  // Ability loadout: learned abilities can be equipped up to the slot limit; only equipped ones can be used.
  const cds: Record<AbilityId, number> = { cry: c.cryCd, wall: c.wallCd };
  const known = (Object.keys(ABILITIES) as AbilityId[]).filter((id) => knowsAbility(s, id));
  const slots = abilitySlots(s);
  const abilities = known.length
    ? `<h3>Abilities <span class="sub">${s.meta.loadout.length} / ${slots} equipped</span></h3>` +
      known.map((id) => {
        const on = hasAbility(s, id);
        return `<div class="row ${on ? '' : 'dim'}"><div class="grow"><b>${ABILITIES[id].name}</b><div class="sub">${ABILITIES[id].desc} Cooldown ${ABILITIES[id].cooldown}s.</div></div>
          ${on ? btn(cds[id] > 0 ? `${Math.ceil(cds[id])}s` : 'Use', 'ability', id, c.alive && cds[id] <= 0, 'ability ' + id) : ''}
          ${btn(on ? 'Unequip' : 'Equip', 'equip', id, on || s.meta.loadout.length < slots, 'small')}</div>`;
      }).join('')
      + (hasAutoCast(s) ? btn(c.autoCast ? 'Auto-cast: ON' : 'Auto-cast: OFF', 'autocast', '', true, c.autoCast ? 'on' : '') : '')
    : '<div class="sub">No abilities yet. Learn them in the Skills tab (Combat tree).</div>';

  const guardian = d.blocked >= 0 ? (() => {
    const g = GUARDIANS[d.blocked];
    const sealed = d.blocked === GUARDIANS.length - 1 && s.meta.ascensions < ASCEND.godlingAscensions;
    return `<div class="guardian"><b>${g.name}</b> blocks your mine.<div class="sub">HP ${fmt(guardianHp(s, d.blocked))} · Attack ${fmt(g.atk)}/s</div>
      ${sealed ? '<div class="sub">🔒 It only stirs for a god who has Ascended (Divine tab).</div>'
        : c.mode === 'guardian' ? '<div class="tag bad">Fighting!</div>' : btn('Challenge', 'guardian', '', c.alive, 'epic')}</div>`;
  })() : '';

  const classes = CLASS_IDS.map((id) => {
    const def = CLASSES[id];
    if (!def.unlock(s)) return `<div class="row locked"><div class="grow"><b>${def.name}</b><div class="sub">🔒 ${def.unlockText}</div></div></div>`;
    return `<div class="row">${icon('worker', def.pal)}<div class="grow"><b>${def.name}</b> <span class="num">${c.plan[id]}</span>
      <div class="sub">${def.desc} HP ${def.hp} · ${def.atk} dmg every ${def.speed}s${def.heal ? ` · heals ${def.heal}/s` : ''}</div></div>
      ${btn('−', 'plan', id + ':-', c.plan[id] > 0, 'small')}${btn('+', 'plan', id + ':+', planSize < d.squadCap && (c.alive || d.idle > 0), 'small')}</div>`;
  }).join('');

  const g = r.gear;
  const gearRow = (kind: 'w' | 'a') => {
    const tier = kind === 'w' ? g.wTier : g.aTier;
    const lvl = kind === 'w' ? g.wLvl : g.aLvl;
    const name = (kind === 'w' ? GEAR.weapon : GEAR.armor)[tier];
    const cost = gearLevelCost(s, kind);
    const tcost = gearTierCost(s, kind);
    const next = (kind === 'w' ? GEAR.weapon : GEAR.armor)[tier + 1];
    const tierRow = !tcost ? '' : gearTierReady(s, kind)
      ? `<div class="row"><div class="grow"><b>Forge ${next}</b><div class="sub">Much stronger. Resets the level to 0.</div><div>${costHtml(s, tcost)}</div></div>${btn('Forge', 'tier', kind, canAfford(s, tcost), 'epic')}</div>`
      : `<div class="row locked"><div class="grow"><b>${next}</b><div class="sub">🔒 Needs ${RESEARCH.find((x) => x.id === GEAR.tierResearch[tier + 1])?.name} and a Forge floor.</div></div></div>`;
    return `<div class="row"><div class="grow"><b>${name}</b> Lv ${lvl} <span class="sub">×${gearMult(s, kind).toFixed(2)} ${kind === 'w' ? 'attack' : 'HP'}</span><div>${costHtml(s, cost)}</div></div>
      ${btn('Upgrade', 'gear', kind, canAfford(s, cost))}</div>${tierRow}`;
  };

  return `
    <canvas id="battle" class="battle"></canvas>
    <div>${abilities}</div>
    ${guardian}
    ${cavernsSection(s)}
    ${c.bossHold && c.mode === 'zone' ? `<div class="guardian"><b>Zone ${c.zone} boss</b> beat your squad.<div class="sub">They're fighting this zone's monsters instead. Retry when you're stronger.</div>${btn('Retry boss', 'zoneBoss', '', true, 'epic')}</div>` : ''}
    <div class="row"><div class="grow"><b>${c.farm ? 'Staying in zone ' + c.zone : 'Pushing onward'}</b><div class="sub">${c.farm ? 'Repeat this zone for loot and gold.' : 'Advance after each zone boss.'}</div></div>${btn(c.farm ? 'Push on' : 'Stay here', 'farm')}</div>
    <h3>Squad <span class="sub">${planSize} / ${d.squadCap} · reforms in ${fmt(d.regroupTime)}s</span></h3>
    ${!c.alive && planSize > d.free ? `<div class="warn">Your squad needs ${planSize} colonists but only ${d.free} are free. Move some workers out of jobs in Colony, lower the squad size, or build Bunkhouses for more colonists.</div>` : ''}
    ${!c.alive && planSize < d.squadCap && d.idle === 0 ? '<div class="sub">No idle colonists to add. Free some up in Colony first.</div>' : ''}
    <div class="sub">Soldiers come from your idle colonists. When a squad gets bonked, those colonists are lost and new ones must grow.</div>
    ${classes}
    <div class="stats">
      <div><span>HP</span><b>${fmt(c.alive ? sq.maxHp : plan.maxHp)}</b></div>
      <div><span>Attack/s</span><b>${fmt(c.alive ? sq.atk : plan.atk)}</b></div>
      <div><span>Heal/s</span><b>${fmt(c.alive ? sq.heal : plan.heal)}</b></div>
      <div><span>Block</span><b>${Math.round((c.alive ? sq.block : plan.block) * 100)}%</b></div>
    </div>
    <div class="sub">Facing: ${esc(e.name)}, HP ${fmt(c.enemyMax)}, attack ${fmt(e.atk)}/s</div>
    <h3>Armory</h3>${gearRow('w')}${gearRow('a')}
    <div class="row"><div class="grow"><b>Mini battle window</b><div class="sub">Show the fight in a corner on other tabs.</div></div>${btn(ui.pip ? 'On' : 'Off', 'pip', '', true, ui.pip ? 'on' : '')}</div>`;
}

// ---------------------------------------------------------------- divine
export function divinePanel(s: GameState, d: Derived) {
  const m = s.meta;
  const pend = pendingFavor(s, d);
  const tree = DIVINE.map((x) => {
    const lvl = div(s, x.id);
    const maxed = x.max !== undefined && lvl >= x.max;
    const cost = divineCost(s, x.id);
    const mul = divMult(s, x.id);
    const now = x.mult && lvl ? ` Now ×${mul < 100 ? mul.toFixed(2) : fmt(mul)}.` : '';
    return `<div class="row"><div class="grow"><b>${x.name}</b> <span class="num">${lvl}${x.max ? '/' + x.max : ''}</span><div class="sub">${x.desc}${now}</div>
      ${maxed ? '' : `<span class="cost ${m.favor >= cost ? '' : 'short'}">${icon('i_favor')}${fmt(cost)}</span>`}</div>
      ${maxed ? '<span class="tag good">Max</span>' : btn('Bless', 'divine', x.id, m.favor >= cost)}</div>`;
  }).join('');
  return `
    <h3>Divine Favor</h3>
    <div class="kv">${icon('i_favor')}<span>Favor</span><span class="grow"></span><b>${fmt(m.favor)}</b></div>
    <div class="kv"><span>Earned on prestige</span><span class="grow"></span><b class="good">+${fmt(pend)}</b></div>
    <div class="sub">Grows with depth and Expedition zones. Guardians defeated ×${Math.pow(1.25, s.run.guardians.length).toFixed(2)}, Shrines ×${(1 + d.floors.shrine * 0.15).toFixed(2)}.</div>
    <div class="center">${btn('Begin a New Expedition', 'prestigeOpen', '', canPrestige(s, d), 'epic big')}</div>
    ${canPrestige(s, d) ? '' : `<div class="sub center">🔒 Defeat ${GUARDIANS[0].name} this run to prestige.</div>`}
    <p class="sub">Prestiging resets your colony, mine, gear and Expedition. You keep Favor, the Divine Tree, achievements, your collection and the relics in your Reliquary.</p>
    <h3>Divine Tree</h3>${tree}
    ${ascensionSection(s, d)}
    <h3>Your Patrons</h3>
    <div class="sub">Race: <b>${RACES[s.run.race].name}</b> · God: <b>${GODS[s.run.god].name}</b></div>
    <div class="sub">${RACES[s.run.race].desc} ${GODS[s.run.god].desc}</div>`;
}

/** Ascension (tier-2 prestige) and the Celestial Tree, shown once the Sunless Sea has been reached. */
function ascensionSection(s: GameState, d: Derived) {
  const m = s.meta;
  if (!ascendOpen(s)) {
    return m.prestiges >= 5 ? `<h3>✨ Ascension</h3><div class="sub">🔒 Something greater than Favor stirs far below. Reach the Sunless Sea (depth ${ASCEND.depth}) to find out what.</div>` : '';
  }
  const pend = pendingSparks(s, d);
  const tree = CELESTIAL.map((x) => {
    const lvl = cel(s, x.id);
    const maxed = x.max !== undefined && lvl >= x.max;
    const cost = celestialCost(s, x.id);
    const mul = celMult(s, x.id);
    const now = x.mult && lvl ? ` Now ×${mul < 100 ? mul.toFixed(2) : fmt(mul)}.` : '';
    const action = x.toggle && lvl ? btn(celOn(s, x.id) ? 'On' : 'Off', 'celToggle', x.id, true, celOn(s, x.id) ? 'on' : '')
      : maxed ? '<span class="tag good">Max</span>' : btn('Kindle', 'celestial', x.id, m.sparks >= cost);
    return `<div class="row"><div class="grow"><b>${x.name}</b> <span class="num">${lvl}${x.max ? '/' + x.max : ''}</span><div class="sub">${x.desc}${now}</div>
      ${maxed ? '' : `<span class="cost ${m.sparks >= cost ? '' : 'short'}">✨${fmt(cost)}</span>`}</div>${action}</div>`;
  }).join('');
  return `
    <h3>✨ Ascension</h3>
    <div class="kv"><span>✨ Godsparks</span><span class="grow"></span><b>${fmt(m.sparks)}</b></div>
    <div class="kv"><span>Earned on Ascension</span><span class="grow"></span><b class="good">+${fmt(pend)}</b></div>
    <div class="sub">From all the Favor you've earned since your last Ascension (${fmt(m.ascFavor)}, plus this run's). Every 4× more Favor doubles your Godsparks.</div>
    <div class="center">${btn('Ascend', 'ascendOpen', '', canAscend(s, d), 'epic big')}</div>
    <p class="sub">Ascending resets this run, your Divine Favor and the whole Divine Tree. You keep Godsparks and the Celestial Tree, skills, achievements, Curios, Heirlooms, races, gods and your prestige count.</p>
    <h3>Celestial Tree</h3>${tree}`;
}

export function ascendModal(s: GameState, d: Derived) {
  const gain = pendingSparks(s, d);
  const lost = Object.values(s.meta.divine).reduce((a, b) => a + b, 0);
  return `<h2>✨ Ascend?</h2>
    <p>You will gain <b class="good">+${fmt(gain)} Godsparks</b>.</p>
    <p>You will lose <b>${fmt(s.meta.favor)} Divine Favor</b>, <b>${lost} Divine Tree levels</b> and this run. Your next run starts with the race and god you have now.</p>
    ${s.meta.ascensions === 0 ? '<p class="sub">Your first Ascension also unlocks a new race: the Star-Touched Moles.</p>' : ''}
    <div class="center">${btn('Cancel', 'closeModal')} ${btn('Ascend!', 'ascend', '', true, 'epic')}</div>`;
}

/** Locked races and gods, with how to unlock them. */
function patronHints(s: GameState) {
  const lockedR = (Object.keys(RACES) as RaceId[]).filter((id) => !s.meta.races.includes(id)).map((id) => `${RACES[id].name} (${RACES[id].unlockText})`);
  const lockedG = (Object.keys(GODS) as GodId[]).filter((id) => !s.meta.gods.includes(id)).map((id) => `${GODS[id].name.split(',')[0]} (${GODS[id].unlockText})`);
  const all = [...lockedR, ...lockedG];
  return all.length ? `<p class="sub">🔒 Still to unlock: ${all.join(' · ')}</p>` : '';
}

export function prestigeModal(s: GameState, d: Derived, ui: UIState) {
  const slots = reliquarySlots(s);
  const relics = s.run.relics.map((id) => {
    const on = ui.keep.includes(id);
    return `<button class="btn relic ${on ? 'on' : ''}" data-act="keep" data-arg="${id}">${icon('i_relic')} ${RELICS[id].name}<span class="sub">${RELICS[id].desc}</span></button>`;
  }).join('') || '<div class="sub">No relics this run.</div>';
  const races = s.meta.races.map((id) => btn(RACES[id].name, 'nextRace', id, true, ui.nextRace === id ? 'on' : '')).join('');
  const gods = s.meta.gods.map((id) => btn(GODS[id].name, 'nextGod', id, true, ui.nextGod === id ? 'on' : '')).join('');
  const r = RACES[ui.nextRace as keyof typeof RACES], g = GODS[ui.nextGod as keyof typeof GODS];
  return `<h2>A New Expedition</h2>
    <p>You will gain <b class="good">+${fmt(pendingFavor(s, d))} Divine Favor</b>. Relics you don't keep become bonus Favor.</p>
    <h3>Reliquary <span class="sub">keep ${ui.keep.length} / ${slots}</span></h3><div class="col">${relics}</div>
    <h3>Race</h3><div class="wrap">${races}</div><div class="sub">${r?.desc ?? ''}</div>
    <h3>God</h3><div class="wrap">${gods}</div><div class="sub">${g?.desc ?? ''}</div>
    ${patronHints(s)}
    <h3>Skill trees</h3>
    <div class="row"><div class="grow"><b>Reset my skill trees</b><div class="sub">Prestige is the only time major trees can be respecced. Skill levels are always kept.</div></div>
      ${btn(ui.respec ? 'Yes' : 'No', 'respecToggle', '', Object.keys(s.meta.alloc).length > 0, ui.respec ? 'on' : '')}</div>
    <div class="center">${btn('Cancel', 'closeModal')} ${btn('Prestige!', 'prestige', '', true, 'epic')}</div>`;
}

// ---------------------------------------------------------------- book
export function bookPanel(s: GameState, d: Derived, ui: UIState) {
  const tabs = [['ach', 'Achievements'], ['res', 'Resources'], ['items', 'Items'], ['relics', 'Relics'], ...(gamesTabOpen(s) ? [['curios', 'Curios']] : []), ...(dungeonsOpen(s) ? [['heirlooms', 'Heirlooms']] : []), ['beasts', 'Bestiary'], ['stats', 'Stats']]
    .map(([id, name]) => btn(name, 'bookTab', id, true, ui.bookTab === id ? 'on small' : 'small')).join('');
  const m = s.meta;
  let body = '';
  if (ui.bookTab === 'ach') {
    body = `<div class="sub">${m.achievements.length} / ${ACHIEVEMENTS.length} · +${Math.round(m.achievements.length * ACH_BONUS * 100)}% to everything</div>` +
      ACHIEVEMENTS.map((a) => {
        const got = m.achievements.includes(a.id);
        return `<div class="row ${got ? '' : 'locked'}"><div class="grow"><b>${got ? '🏆 ' : ''}${a.name}</b><div class="sub">${a.desc}</div></div></div>`;
      }).join('');
  } else if (ui.bookTab === 'res') {
    body = RES_IDS.map((k) => `<div class="kv">${icon(RESOURCES[k].icon)}<span>${RESOURCES[k].name}</span><span class="grow"></span>
      <span class="sub">have</span> <b>${fmt(s.run.res[k])}</b> <span class="sub">total</span> <b>${fmt(m.lifetime['res.' + k] ?? 0)}</b></div>`).join('');
  } else if (ui.bookTab === 'items') {
    body = Object.entries(ITEMS).map(([id, it]) => {
      const total = m.collection[id] ?? 0;
      return total ? `<div class="row">${icon('i_item')}<div class="grow"><b>${it.name}</b><div class="sub">${it.desc}</div></div><div class="right"><b>${fmt(s.run.items[id] ?? 0)}</b><div class="sub">total ${fmt(total)}</div></div></div>`
        : `<div class="row locked"><div class="grow"><b>???</b><div class="sub">Not found yet.</div></div></div>`;
    }).join('');
  } else if (ui.bookTab === 'relics') {
    body = `<div class="sub">Reliquary: ${m.reliquary.length} kept / ${reliquarySlots(s)} slots</div>` + Object.entries(RELICS).map(([id, rl]) => {
      const found = m.relicsFound.includes(id);
      const have = s.run.relics.includes(id);
      return found ? `<div class="row">${icon('i_relic')}<div class="grow"><b>${rl.name}</b> ${have ? '<span class="tag good">Active</span>' : ''}${m.reliquary.includes(id) ? '<span class="tag">Kept</span>' : ''}<div class="sub">${rl.desc}</div></div></div>`
        : `<div class="row locked"><div class="grow"><b>???</b><div class="sub">${rl.rare ? 'Guarded by something big.' : 'Zone bosses sometimes drop these.'}</div></div></div>`;
    }).join('');
  } else if (ui.bookTab === 'curios') {
    body = curioList(s);
  } else if (ui.bookTab === 'heirlooms') {
    body = curioList(s, true);
  } else if (ui.bookTab === 'beasts') {
    const entries = Object.entries(ENEMIES).map(([id, e]) => [id, e.name, e.sprite, e.pal] as const)
      .concat(GUARDIANS.map((g, i) => ['g' + i, g.name, g.sprite, g.pal] as const));
    body = entries.map(([id, name, spr, pal]) => {
      const k = m.bestiary[id] ?? 0;
      return k ? `<div class="row">${icon(spr, pal)}<div class="grow"><b>${name}</b></div><div class="right"><b>${fmt(k)}</b><div class="sub">defeated</div></div></div>`
        : `<div class="row locked"><div class="grow"><b>???</b></div></div>`;
    }).join('');
  } else {
    const st = (label: string, v: string) => `<div class="kv"><span>${label}</span><span class="grow"></span><b>${v}</b></div>`;
    body = st('Time played', fmtTime(m.time)) + st('This run', fmtTime(s.run.time)) + st('Prestiges', String(m.prestiges)) +
      st('Best depth', String(m.bestDepth)) + st('Best zone', String(m.bestZone)) + st('Levels dug', fmt(m.lifetime.levels ?? 0)) +
      st('Monsters defeated', fmt(m.lifetime.kills ?? 0)) + st('Squads bonked', fmt(m.lifetime.wipes ?? 0)) +
      (gamesTabOpen(s) ? st('Dice rolls', fmt(m.lifetime['dice.rolls'] ?? 0)) + st('Dice gold won', fmt(m.lifetime['dice.won'] ?? 0)) + st('Best dice streak', fmt(m.lifetime['dice.bestStreak'] ?? 0)) + st('Curios found', fmt(m.lifetime.curios ?? 0)) : '') +
      st('Dig taps', fmt(m.lifetime.taps ?? 0)) + st('Best tap combo', fmt(m.lifetime.bestCombo ?? 0)) + st('Total Favor earned', fmt(m.totalFavor));
  }
  return `<div class="wrap subtabs">${tabs}</div>${body}`;
}

// ---------------------------------------------------------------- settings / saves / dev
export function settingsPanel(s: GameState, d: Derived, ui: UIState) {
  const slots = listSlots().map((x) => {
    const active = x.id === store.slot;
    const when = x.savedAt ? new Date(x.savedAt).toLocaleString() : '';
    const actions = active ? '<span class="tag good">Playing</span>' + btn('Rename', 'renameSlot', x.id, true, 'small')
      : x.exists ? btn('Load', 'loadSlot', x.id, true, 'small') + btn('Rename', 'renameSlot', x.id, true, 'small') + btn('Delete', 'deleteSlot', x.id, true, 'small danger')
        : btn('New game', 'loadSlot', x.id, true, 'small');
    return `<div class="row ${active ? 'active' : ''}"><div class="grow"><b>${esc(x.name)}</b><div class="sub">${x.summary}${when ? ' · ' + when : ''}</div></div><div class="wrap">${actions}</div></div>`;
  }).join('');

  const dev = !store.dev ? '' : `<h3>Developer</h3>
    <div class="wrap">${[1, 10, 100, 1000].map((n) => btn('×' + n, 'speed', n, true, store.speed === n ? 'on small' : 'small')).join('')}</div>
    <div class="wrap">${btn('+1K resources', 'dev', 'res', true, 'small')}${btn('+10 colonists', 'dev', 'pop', true, 'small')}${btn('+5 depth', 'dev', 'depth', true, 'small')}
      ${btn('Beat guardian', 'dev', 'guardian', true, 'small')}${btn('+5 zones', 'dev', 'zones', true, 'small')}${btn('+50 Favor', 'dev', 'favor', true, 'small')}${btn('+5 Godsparks', 'dev', 'sparks', true, 'small')}${btn('+1 prestige count', 'dev', 'prestigeCount', true, 'small')}
      ${btn('All research', 'dev', 'research', true, 'small')}${btn('Simulate 1h away', 'dev', 'away', true, 'small')}</div>
    <h3>Developer: skills</h3>
    ${SKILL_IDS.map((id) => `<div class="row"><div class="grow"><b>${SKILLS[id].icon} ${SKILLS[id].name}</b> <span class="num">Lv ${skillLevel(s, id)}</span>
      <div class="sub">${treePoints(s, id)} of ${TREE_MAX[id]} points</div></div>
      <div class="wrap">${['-5', '+1', '+5', '+10', '99', '1'].map((v) => btn(v === '99' ? 'Max' : v === '1' ? 'Reset' : v, 'devSkill', `${id}:${v}`, true, 'small')).join('')}</div></div>`).join('')}
    <div class="wrap">${btn('Free tree respec', 'dev', 'respec', true, 'small')}${btn('+5 run perk points', 'dev', 'perks', true, 'small')}${btn('All skills 99', 'dev', 'allSkills', true, 'small')}</div>`;

  return `<h3>Save Slots</h3>${slots}
    <div class="wrap">${btn('Save now', 'saveNow')}${btn('Export save', 'export')}${btn('Import save', 'import')}${hasBackup(store.slot) ? btn(`Restore backup${backupTime(store.slot) ? ` (${fmtTime((Date.now() - backupTime(store.slot)) / 1000)} old)` : ''}`, 'restoreBackup', '', true, 'small') : ''}</div>
    <p class="sub">The game autosaves every 10 seconds and whenever you leave the app, and keeps a backup that's refreshed every 10 minutes. Export your save now and then to keep a copy somewhere safe.</p>
    ${ui.exportText ? `<textarea readonly class="code" data-keep="1">${ui.exportText}</textarea><div class="wrap">${btn('Copy', 'copyExport')}${btn('Download file', 'downloadExport')}${btn('Hide', 'hideExport', '', true, 'small')}</div>` : ''}
    <h3>Updates</h3>
    <div class="row"><div class="grow"><b>Version ${__APP_VERSION__}</b><div class="sub">Build ${__BUILD_ID__}. The game checks automatically whenever you open it.</div></div>${btn('Check for updates', 'checkUpdate')}</div>
    <h3>Install on your phone</h3>
    <p class="sub">In Chrome, tap ⋮ → <b>Add to Home screen</b> (or <b>Install app</b>). Delve then opens full-screen and works offline.</p>
    <h3>Options</h3>
    <div class="row"><div class="grow"><b>Screen layout</b><div class="sub">Auto uses the wide layout on big screens (mine, battle and panels side by side) and the phone layout on small ones.</div></div>
      <div class="wrap">${(['auto', 'phone', 'wide'] as const).map((l) => btn(l[0].toUpperCase() + l.slice(1), 'layout', l, true, prefs.layout === l ? 'on small' : 'small')).join('')}</div></div>
    <div class="row"><div class="grow"><b>Sound effects</b><div class="sub">Little bleeps and bloops, made on the spot.</div></div>${btn(prefs.sound ? 'On' : 'Off', 'sound', '', true, prefs.sound ? 'on' : '')}</div>
    ${prefs.sound ? `<div class="row"><div class="grow"><b>Volume</b></div><div class="wrap">${[['Quiet', 0.35], ['Normal', 0.7], ['Loud', 1]].map(([n, v]) => btn(n as string, 'volume', v, true, prefs.volume === v ? 'on small' : 'small')).join('')}</div></div>` : ''}
    <div class="row"><div class="grow"><b>Vibrate on tap</b><div class="sub">A tiny buzz each time you tap to dig.</div></div>${btn(prefs.vibrate ? 'On' : 'Off', 'vibrate', '', true, prefs.vibrate ? 'on' : '')}</div>
    <div class="row"><div class="grow"><b>Developer mode</b><div class="sub">Speed controls and cheats for testing.</div></div>${btn(store.dev ? 'On' : 'Off', 'devToggle', '', true, store.dev ? 'on' : '')}</div>
    ${dev}
    <h3>Danger zone</h3>
    <div class="row"><div class="grow"><b>Wipe this slot</b><div class="sub">Starts this slot completely fresh.</div></div>${btn('Wipe', 'wipeSlot', '', true, 'danger')}</div>
    <p class="sub center">Delve v${__APP_VERSION__} · build ${__BUILD_ID__}</p>`;
}

export function importModal() {
  return `<h2>Import a save</h2>
    <p class="sub">Paste a save code, or pick a save file. This replaces the save in the current slot (a backup is kept).</p>
    <textarea id="importText" class="code" data-keep="1" placeholder="DELVE1:..."></textarea>
    <input type="file" id="importFile" accept=".txt,.json,text/plain">
    <div class="center">${btn('Cancel', 'closeModal')} ${btn('Import', 'doImport', '', true, 'epic')}</div>`;
}
