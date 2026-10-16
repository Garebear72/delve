// The app shell: top bar, tabs, slide-up sheet, toasts, modals and button handling.
import morphdom from 'morphdom';
import { AbilityId, ClassId, JobId, FloorId, RESEARCH, RESOURCES, RES_IDS, RaceId, GodId } from '../data/defs';
import * as A from '../game/actions';
import { canPrestige } from '../game/calc';
import { on } from '../game/events';
import { deleteSlot, exportString, importString, loadBackup, renameSlot, saveSlot } from '../game/save';
import { applyOffline, OfflineReport, openSlot, replaceState, saveNow } from '../game/session';
import { startGuardian, useAbility, digCheck, add } from '../game/sim';
import { newGame } from '../game/state';
import { applyUpdate, checkForUpdate, updateReady } from '../game/update';
import { refresh, store } from '../game/store';
import { MineView } from '../render/mine';
import { icon } from '../render/sprites';
import { fmt, fmtRate, fmtTime } from './format';
import { prefs, savePrefs } from './prefs';
import { skillsPanel, unspentPoints } from './skillsPanel';
import type { SkillId } from '../data/skills';
import { buyPerk, learn, respecPerks, toggleEquip } from '../game/skills';
import {
  battlePanel, bookPanel, buildPanel, colonyPanel, divinePanel, floorPanel, importModal, prestigeModal, settingsPanel, UIState,
} from './panels';

export const ui: UIState = {
  tab: null, slot: 0, bookTab: 'ach', bulk: 1, armDemolish: -1, keep: [], nextRace: 'dwarf', nextGod: 'forge',
  pip: true, exportText: '', skillTree: 'combat', skillNode: '', respec: false,
};
let modal: string | null = null;

const $ = (id: string) => document.getElementById(id)!;

export function buildShell() {
  $('app').innerHTML = `
    <canvas id="mine"></canvas>
    <div id="topbar"></div>
    <div id="hint"></div>
    <button id="jump" class="btn">⬇ Dig front</button>
    <button id="update" class="btn epic" data-act="applyUpdate">✨ Update available! Tap to update</button>
    <canvas id="pip"></canvas>
    <div id="sheet"><div id="handle"><span></span></div><div id="sheetBody"><div id="panel"></div></div></div>
    <nav id="tabs"></nav>
    <div id="toasts"></div>
    <div id="modal" class="hidden"><div id="modalBox"></div></div>`;

  document.addEventListener('click', onClick);
  $('jump').addEventListener('click', () => mine.jumpToFront());
  $('pip').addEventListener('click', () => openTab('battle'));
  $('topbar').addEventListener('click', closeSheet);
  $('modal').addEventListener('click', (e) => { if (e.target === $('modal')) closeModal(); });
  bindSheetGestures();

  // Android back button/gesture closes a popup or panel instead of leaving the app.
  addEventListener('popstate', () => {
    if (ignorePops > 0) { ignorePops--; return; }
    if (modal) closeModal(true);
    else if (ui.tab) openTab(null, true);
  });

  on('toast', ({ text, kind }) => toast(text, kind));
  on('achievement', (a) => toast(`🏆 ${a.name}: ${a.desc} (+2% to everything)`, 'epic'));
  on('loot', (id) => { if ((store.state.meta.collection[id] ?? 0) === 1) toast('New item for your collection!', 'good'); });
}

export let mine: MineView;
export function createMine() {
  mine = new MineView(
    $('mine') as HTMLCanvasElement,
    // Tapping anywhere in the mine digs (or just closes an open panel).
    () => {
      if (ui.tab) { closeSheet(); return; }
      A.tapDig(store.state);
      if (prefs.vibrate) navigator.vibrate?.(8);
      refresh();
    },
    // The button on each row builds or manages that floor.
    (level) => {
      ui.slot = level;
      ui.armDemolish = -1;
      openTab(store.state.run.floors[level] ? 'floor' : 'build');
    },
  );
}

let ignorePops = 0;

export function openTab(tab: string | null, fromHistory = false) {
  const wasOpen = !!ui.tab;
  ui.tab = ui.tab === tab ? null : tab;
  if (tab === 'build' || tab === 'floor') ui.tab = tab;
  if (!fromHistory) {
    if (!wasOpen && ui.tab) history.pushState({ delve: 'sheet' }, '');
    else if (wasOpen && !ui.tab && history.state?.delve === 'sheet') { ignorePops++; history.back(); }
  }
  $('sheet').classList.toggle('open', !!ui.tab);
  $('sheet').classList.toggle('tall', ui.tab === 'battle' || ui.tab === 'skills');
  if (ui.tab) $('sheetBody').scrollTop = 0;
  render();
}

// ---------------------------------------------------------------- toasts & modals
function toast(text: string, kind = 'info') {
  const box = $('toasts');
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = text;
  box.appendChild(el);
  while (box.children.length > 4) box.firstChild!.remove();
  setTimeout(() => el.classList.add('out'), 3600);
  setTimeout(() => el.remove(), 4000);
}

export function closeSheet() { if (ui.tab) openTab(null); }

/** Swipe down on a panel's top (or on its content when scrolled to the top) to close it. */
function bindSheetGestures() {
  const sheet = $('sheet'), handle = $('handle'), body = $('sheetBody');
  let startY = -1, dy = 0;
  handle.addEventListener('pointerdown', (e) => {
    startY = e.clientY; dy = 0;
    handle.setPointerCapture(e.pointerId);
    sheet.style.transition = 'none';
  });
  handle.addEventListener('pointermove', (e) => {
    if (startY < 0) return;
    dy = Math.max(0, e.clientY - startY);
    sheet.style.transform = `translateY(${dy}px)`;
  });
  const end = () => {
    if (startY < 0) return;
    startY = -1;
    sheet.style.transition = ''; sheet.style.transform = '';
    if (dy > 50 || dy < 6) closeSheet(); // a swipe down, or a plain tap on the handle
  };
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);

  let touchY = -1;
  body.addEventListener('touchstart', (e) => { touchY = body.scrollTop <= 0 ? e.touches[0].clientY : -1; }, { passive: true });
  body.addEventListener('touchend', (e) => {
    if (touchY >= 0 && e.changedTouches[0].clientY - touchY > 90 && body.scrollTop <= 0) closeSheet();
    touchY = -1;
  }, { passive: true });
}

function showModal(kind: string, html: string) {
  if (!modal) history.pushState({ delve: 'modal' }, '');
  modal = kind;
  $('modalBox').innerHTML = html;
  $('modal').classList.remove('hidden');
}
function closeModal(fromHistory = false) {
  if (!modal) return;
  modal = null;
  $('modal').classList.add('hidden');
  if (!fromHistory && history.state?.delve === 'modal') { ignorePops++; history.back(); }
}

export function showOffline(rep: OfflineReport) {
  if (rep.away < 60) return;
  const lines = Object.entries(rep.res).map(([k, v]) =>
    `<div class="kv">${icon(RESOURCES[k as keyof typeof RESOURCES].icon)}<span>${RESOURCES[k as keyof typeof RESOURCES].name}</span><span class="grow"></span><b class="${v! < 0 ? 'neg' : 'good'}">${v! > 0 ? '+' : ''}${fmt(v!)}</b></div>`).join('');
  const extra = [
    rep.depth ? `<div class="kv"><span>Levels dug</span><span class="grow"></span><b class="good">+${rep.depth}</b></div>` : '',
    rep.zones ? `<div class="kv"><span>Zones cleared</span><span class="grow"></span><b class="good">+${rep.zones}</b></div>` : '',
    rep.kills ? `<div class="kv"><span>Monsters defeated</span><span class="grow"></span><b>${fmt(rep.kills)}</b></div>` : '',
    rep.pop >= 1 ? `<div class="kv"><span>New colonists</span><span class="grow"></span><b class="good">+${Math.floor(rep.pop)}</b></div>` : '',
  ].join('');
  const capped = rep.simulated < rep.away ? `<p class="sub">Only ${fmtTime(rep.simulated)} counted (offline limit). The Long Memory blessing raises it.</p>` : '';
  showModal('offline', `<h2>Welcome back, Digging God!</h2><p>You were away for <b>${fmtTime(rep.away)}</b>. Your colony kept busy:</p>${lines}${extra}${capped}
    <div class="center"><button class="btn epic" data-act="closeModal">Lovely</button></div>`);
}

// ---------------------------------------------------------------- button handling
function onClick(e: MouseEvent) {
  const el = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
  if (el) { if ((el as HTMLButtonElement).disabled) return; act(el.dataset.act!, el.dataset.arg ?? ''); return; }
  const tab = (e.target as HTMLElement).closest('[data-tab]') as HTMLElement | null;
  if (tab) openTab(tab.dataset.tab === 'mine' ? null : tab.dataset.tab!);
}

function act(name: string, arg: string) {
  const s = store.state;
  const [a, sign] = arg.split(':');
  const n = ui.bulk || 1e9;
  switch (name) {
    case 'bulk': ui.bulk = Number(arg); break;
    case 'job': A.assignJob(s, a as JobId, sign === '+' ? n : -n); break;
    case 'research': A.buyResearch(s, arg); break;
    case 'build': if (A.buildFloor(s, ui.slot, arg as FloorId)) openTab('floor'); break;
    case 'upgrade': A.upgradeFloor(s, Number(arg)); break;
    case 'demolish':
      if (ui.armDemolish === Number(arg)) { A.demolishFloor(s, Number(arg)); ui.armDemolish = -1; openTab('build'); }
      else ui.armDemolish = Number(arg);
      break;
    case 'plan': A.setPlan(s, a as ClassId, sign === '+' ? (ui.bulk || 1e9) : -(ui.bulk || 1e9)); break;
    case 'ability': useAbility(s, arg as AbilityId); break;
    case 'autocast': s.run.combat.autoCast = !s.run.combat.autoCast; break;
    case 'guardian': startGuardian(s); break;
    case 'farm': s.run.combat.farm = !s.run.combat.farm; break;
    case 'gear': A.buyGearLevel(s, arg as 'w' | 'a'); break;
    case 'tier': A.buyGearTier(s, arg as 'w' | 'a'); break;
    case 'pip': ui.pip = !ui.pip; break;
    case 'divine': A.buyDivine(s, arg); break;
    case 'prestigeOpen':
      ui.keep = s.run.relics.filter((id) => s.meta.reliquary.includes(id)).slice(0, A.reliquarySlots(s));
      ui.nextRace = s.run.race; ui.nextGod = s.run.god;
      showModal('prestige', prestigeModal(s, store.d, ui));
      return;
    case 'keep':
      if (ui.keep.includes(arg)) ui.keep = ui.keep.filter((x) => x !== arg);
      else if (ui.keep.length < A.reliquarySlots(s)) ui.keep.push(arg);
      showModal('prestige', prestigeModal(s, store.d, ui));
      return;
    case 'nextRace': ui.nextRace = arg; showModal('prestige', prestigeModal(s, store.d, ui)); return;
    case 'nextGod': ui.nextGod = arg; showModal('prestige', prestigeModal(s, store.d, ui)); return;
    case 'prestige':
      if (canPrestige(s, store.d) && A.prestige(s, ui.keep, ui.nextRace as RaceId, ui.nextGod as GodId, ui.respec)) {
        ui.respec = false;
        closeModal(); refresh(); saveNow(); openTab(null); mine.jumpToFront();
      }
      return;
    case 'closeModal': closeModal(); break;
    case 'bookTab': ui.bookTab = arg; break;
    // saves
    case 'saveNow': if (saveNow()) toast('Saved!', 'good'); break;
    case 'loadSlot': {
      saveNow();
      const rep = openSlot(Number(arg));
      toast(`Now playing: slot ${arg}`, 'good');
      ui.exportText = '';
      mine.jumpToFront();
      if (rep) showOffline(rep);
      break;
    }
    case 'renameSlot': {
      const name = prompt('Name this save:');
      if (name) renameSlot(Number(arg), name);
      break;
    }
    case 'deleteSlot': if (confirm('Delete this save slot? This cannot be undone.')) deleteSlot(Number(arg)); break;
    case 'wipeSlot':
      if (confirm('Wipe this slot and start completely fresh? Export first if you want a copy.')) {
        replaceState(newGame()); mine.jumpToFront(); toast('Fresh start!', 'good');
      }
      break;
    case 'restoreBackup': {
      const b = loadBackup(store.slot);
      if (b && confirm('Restore the previous autosave of this slot?')) { store.state = b; refresh(); saveSlot(store.slot, b); toast('Backup restored.', 'good'); }
      break;
    }
    case 'export': saveNow(); ui.exportText = exportString(s); break;
    case 'hideExport': ui.exportText = ''; break;
    case 'copyExport':
      navigator.clipboard?.writeText(ui.exportText).then(() => toast('Save code copied!', 'good'), () => toast('Copy failed. Select the text and copy it manually.', 'bad'));
      break;
    case 'downloadExport': {
      const blob = new Blob([ui.exportText], { type: 'text/plain' });
      const a2 = document.createElement('a');
      a2.href = URL.createObjectURL(blob);
      a2.download = `delve-save-${new Date().toISOString().slice(0, 10)}.txt`;
      a2.click();
      setTimeout(() => URL.revokeObjectURL(a2.href), 1000);
      break;
    }
    case 'import': showModal('import', importModal()); bindImportFile(); return;
    case 'doImport': {
      const text = ($('importText') as HTMLTextAreaElement).value;
      try {
        const st = importString(text);
        saveNow();
        replaceState(st);
        closeModal();
        mine.jumpToFront();
        toast('Save imported!', 'good');
      } catch { toast("That doesn't look like a Delve save code.", 'bad'); }
      return;
    }
    case 'vibrate': prefs.vibrate = !prefs.vibrate; savePrefs(); if (prefs.vibrate) navigator.vibrate?.(20); break;
    // skills
    case 'skillTree': ui.skillTree = arg as SkillId | 'run'; ui.skillNode = ''; break;
    case 'skillNode': ui.skillNode = ui.skillNode === arg ? '' : arg; break;
    case 'learn': learn(s, arg); break;
    case 'perk': buyPerk(s, arg); break;
    case 'perkRespec': respecPerks(s); break;
    case 'equip': toggleEquip(s, arg as AbilityId); break;
    case 'respecToggle': ui.respec = !ui.respec; showModal('prestige', prestigeModal(s, store.d, ui)); return;
    case 'applyUpdate': applyUpdate(); return;
    case 'checkUpdate':
      toast('Checking for updates…');
      checkForUpdate().then((found) => toast(found ? 'A new version is ready! Tap the purple banner to update.' : "You're on the latest version.", found ? 'epic' : 'good'));
      return;
    // developer
    case 'devToggle': store.dev = !store.dev; if (!store.dev) store.speed = 1; break;
    case 'speed': store.speed = Number(arg); break;
    case 'dev': devAction(arg); break;
  }
  refresh();
  render();
}

function bindImportFile() {
  const input = $('importFile') as HTMLInputElement;
  input.addEventListener('change', async () => {
    const f = input.files?.[0];
    if (f) ($('importText') as HTMLTextAreaElement).value = await f.text();
  });
}

function devAction(what: string) {
  const s = store.state, r = s.run, d = store.d;
  if (what === 'res') for (const k of RES_IDS) r.res[k] = Math.min(isFinite(d.caps[k]) ? d.caps[k] : Infinity, r.res[k] + 1000);
  if (what === 'pop') r.pop = Math.min(d.maxPop + 10, r.pop + 10);
  if (what === 'depth') { for (let i = 0; i < 5; i++) { r.dig += 1e12; digCheck(s); } r.dig = 0; }
  if (what === 'guardian' && d.blocked >= 0) { r.guardians.push(d.blocked); }
  if (what === 'zones') { r.combat.zone += 5; r.maxZone = Math.max(r.maxZone, r.combat.zone - 1); r.combat.cell = 0; r.combat.enemyHp = 0; }
  if (what === 'favor') { s.meta.favor += 50; }
  if (what === 'research') { for (const x of RESEARCH) if (!r.research.includes(x.id)) r.research.push(x.id); }
  if (what === 'away') { showOffline(applyOffline(3600)); }
  add(s, 'devUsed', 1);
}

// ---------------------------------------------------------------- rendering
export function render() {
  const s = store.state, d = store.d;
  renderTop();
  renderTabs();
  renderHint();
  const panel = $('panel');
  let html = '';
  switch (ui.tab && tabLocked(ui.tab) ? 'locked' : ui.tab) {
    case 'locked': html = lockedPanel(ui.tab!); break;
    case 'colony': html = colonyPanel(s, d, ui); break;
    case 'skills': html = skillsPanel(s, ui); break;
    case 'battle': html = battlePanel(s, d, ui); break;
    case 'divine': html = divinePanel(s, d); break;
    case 'book': html = bookPanel(s, d, ui); break;
    case 'settings': html = settingsPanel(s, d, ui); break;
    case 'build': html = buildPanel(s, d, ui); break;
    case 'floor': html = floorPanel(s, d, ui); break;
  }
  morphdom(panel, `<div id="panel">${html}</div>`, {
    onBeforeElUpdated: (from) => !(from.tagName === 'CANVAS' || (from as HTMLElement).dataset?.keep === '1' && from === document.activeElement),
  });
}

function renderTop() {
  const s = store.state, d = store.d, r = s.run;
  const shown = RES_IDS.filter((k) => {
    if (k === 'food' || k === 'stone') return true;
    if (k === 'gold') return r.combatUnlocked || r.res.gold > 0;
    return r.res[k] > 0 || d.rates[k] > 0;
  });
  const chips = shown.map((k) => {
    const full = isFinite(d.caps[k]) && r.res[k] >= d.caps[k] - 0.01;
    return `<div class="chip ${full ? 'full' : ''}">${icon(RESOURCES[k].icon)}<b>${fmt(r.res[k])}</b><small class="${d.rates[k] < 0 ? 'neg' : ''}">${fmtRate(d.rates[k])}</small></div>`;
  });
  chips.push(`<div class="chip">${icon('i_pop')}<b>${Math.floor(r.pop)}/${d.maxPop}</b><small>${d.idle} idle</small></div>`);
  chips.push(`<div class="chip">⛏<b>${r.depth}</b><small>depth</small></div>`);
  if (s.meta.favor > 0 || s.meta.prestiges > 0) chips.push(`<div class="chip">${icon('i_favor')}<b>${fmt(s.meta.favor)}</b></div>`);
  if (store.speed !== 1) chips.push(`<div class="chip dev">×${store.speed}</div>`);
  morphdom($('topbar'), `<div id="topbar">${chips.join('')}</div>`);
}

function tabLocked(id: string) {
  const s = store.state;
  if (id === 'battle') return !s.run.combatUnlocked;
  if (id === 'divine') return s.run.depth < 8 && s.meta.prestiges === 0;
  return false;
}

function lockedPanel(id: string) {
  const r = store.state.run;
  const barracksOpen = r.depth >= 5;
  const body = id === 'battle'
    ? `<p>Monsters lurk in the side caverns. To open the Expedition, <b>build a Barracks</b> floor.</p>
       <p>${barracksOpen
         ? 'Barracks are unlocked! Go to the Mine, tap the gold <b>+</b> on any empty level and choose <b>Barracks</b>.'
         : `Barracks unlock at <b>depth 5</b>. You're at depth <b>${r.depth}</b>. Keep digging!`}</p>`
    : `<p>The gods take notice of colonies that dig deep. The Divine tab opens at <b>depth 8</b>. You're at depth <b>${r.depth}</b>.</p>
       <p>This is where you prestige: start a new expedition stronger than before.</p>`;
  return `<h2>🔒 ${id === 'battle' ? 'Battle' : 'Divine'}</h2>${body}`;
}

function renderTabs() {
  const s = store.state;
  const tabs: [string, string, string][] = [
    ['mine', 'Mine', icon('i_stone')],
    ['colony', 'Colony', icon('i_pop')],
    ['battle', 'Battle', icon('sword')],
    ['skills', 'Skills', '<span class="emo">🌳</span>'],
    ['divine', 'Divine', icon('i_favor')],
    ['book', 'Book', icon('i_know')],
    ['settings', 'Menu', '☰'],
  ];
  const active = ui.tab ?? 'mine';
  const html = tabs.map(([id, name, ic]) => {
    const locked = tabLocked(id);
    const cls = (active === id || (id === 'mine' && (active === 'build' || active === 'floor')) ? 'on' : '') + (locked ? ' locked' : '');
    const dot = id === 'skills' && unspentPoints(s) > 0 ? `<i class="dot">${unspentPoints(s)}</i>` : '';
    return `<button id="tab-${id}" class="tab ${cls}" data-tab="${id}">${locked ? '<i class="lock">🔒</i>' : ''}${dot}${ic}<span>${name}</span></button>`;
  }).join('');
  morphdom($('tabs'), `<nav id="tabs">${html}</nav>`);
}

function renderHint() {
  const s = store.state, d = store.d, r = s.run;
  let hint = '';
  if (d.hungry) hint = '🍄 Your dwarves are starving! Assign Farmers in Colony.';
  else if (r.inBreak) hint = '☕ Union Break! Production paused.';
  else if (d.blocked >= 0) hint = 'A guardian blocks the way down. Fight it in the Battle tab.';
  else if (r.depth === 0 && r.jobs.miner === 0) hint = 'Tap anywhere in the mine to dig, or assign Miners in Colony.';
  else if (r.jobs.farmer === 0 && d.rates.food < 0) hint = 'Your dwarves need food. Assign a Farmer in Colony.';
  else if (d.idle > 0 && r.jobs.miner + r.jobs.farmer === 0) hint = 'You have idle colonists. Give them jobs in Colony.';
  else if (r.depth >= 1 && !r.floors.some(Boolean)) hint = 'Tap the gold + on an empty level to build a floor.';
  else if (d.rates.food < 0 && r.res.food < 20) hint = 'Mushrooms are running low! Add Farmers.';
  else if (r.depth >= 5 && !r.combatUnlocked) hint = 'Barracks unlocked! Build one on an empty level to open Battle.';
  else if (r.pop >= d.maxPop && !r.floors.some((f) => f?.type === 'bunk')) hint = 'Colony is full. Build a Bunkhouse for more room.';
  const el = $('hint');
  el.textContent = hint;
  el.classList.toggle('show', !!hint && !ui.tab);
}

export function frameUI() {
  $('update').classList.toggle('show', updateReady);
  $('jump').classList.toggle('show', !mine.frontVisible() && !ui.tab);
  const pip = $('pip');
  pip.classList.toggle('show', ui.pip && store.state.run.combatUnlocked && ui.tab !== 'battle');
}
export const battleCanvas = () => (ui.tab === 'battle' ? (document.getElementById('battle') as HTMLCanvasElement | null) : null);
export const pipCanvas = () => ($('pip').classList.contains('show') ? ($('pip') as HTMLCanvasElement) : null);
