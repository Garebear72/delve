// The app shell: top bar, tabs, slide-up sheet, toasts, modals and button handling.
import morphdom from 'morphdom';
import { AbilityId, BIOMES, ClassId, JobId, FloorId, GUARDIANS, RESEARCH, RESOURCES, RES_IDS, RaceId, GodId } from '../data/defs';
import * as A from '../game/actions';
import { canAscend, canPrestige, Derived } from '../game/calc';
import type { GameState } from '../game/state';
import { on } from '../game/events';
import { deleteSlot, exportString, importString, loadBackup, renameSlot, saveSlot } from '../game/save';
import { applyOffline, OfflineReport, openSlot, replaceState, saveNow } from '../game/session';
import { startGuardian, retryZoneBoss, useAbility, digCheck, add } from '../game/sim';
import { newGame } from '../game/state';
import { applyUpdate, checkForUpdate, updateReady } from '../game/update';
import { refresh, store } from '../game/store';
import { MineView } from '../render/mine';
import { icon } from '../render/sprites';
import { fmt, fmtRate, fmtTime } from './format';
import { prefs, savePrefs } from './prefs';
import { applyLayout, docked, layout } from './layout';
import { cloud, cloudBackend, CloudUI } from '../cloud';
import { validUsername } from '../cloud/backend';
import { cloudChip, cloudSection, conflictModal } from './cloudPanel';
import { skillsPanel, unspentPoints } from './skillsPanel';
import type { SkillId } from '../data/skills';
import { buyPerk, learn, reconcileTrees, respecPerks, respecTrees, skillLevel, toggleEquip, xpForLevel } from '../game/skills';
import { SKILLS, SKILL_IDS } from '../data/skills';
import { markInput } from '../game/input';
import { cartCashOut, cartFork, cartStart, diceCashOut, diceRoll, gamesTabOpen, gameUnlocked, plinkoDrop, wheelSpin } from '../game/minigames';
import { ArcadeView } from '../render/arcade';
import { setVolume, sfx, unlockAudio } from '../audio/sfx';
import { chooseDoor, enterCavern, leaveDungeon } from '../game/dungeons';
import type { GameId } from '../data/minigames';
import { arcadeView, gamesPanel } from './gamesPanel';
import {
  ascendModal, battlePanel, bookPanel, buildPanel, colonyPanel, divinePanel, floorPanel, importModal, prestigeModal, settingsPanel, UIState,
} from './panels';

export const ui: UIState = {
  tab: null, slot: 0, bookTab: 'ach', bulk: 1, armDemolish: -1, keep: [], nextRace: 'dwarf', nextGod: 'forge',
  pip: true, exportText: '', skillTree: 'combat', skillNode: '', showBonuses: false, respec: false, game: null,
};
let modal: string | null = null;

const $ = (id: string) => document.getElementById(id)!;

export function buildShell() {
  $('app').innerHTML = `
    <canvas id="mine"></canvas>
    <div id="topbar"></div>
    <div id="hint"></div>
    <div id="arcadeBack" class="hidden"></div>
    <div id="arcade" class="hidden"></div>
    <canvas id="strip"></canvas>
    <div id="battleCol"><div id="battlePanel"></div></div>
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
  // (The cloud "which save?" question can't be dismissed by tapping outside: it needs an answer.)
  $('modal').addEventListener('click', (e) => { if (e.target === $('modal') && modal !== 'cloud') closeModal(); });
  // On big screens mini-games float in a window: clicking outside it steps back out.
  $('arcadeBack').addEventListener('click', () => openGame(null));
  $('strip').addEventListener('click', () => openTab('battle'));
  bindKeys();
  addEventListener('resize', () => { if (applyLayout()) onLayoutChange(); });
  applyLayout();
  onLayoutChange();
  bindSheetGestures();
  // Plinko: tap the board to drop a ball in that column.
  $('arcade').addEventListener('pointerdown', (e) => {
    const el = e.target as HTMLElement;
    if (el.id !== 'arcadeCanvas' || ui.game !== 'plinko') return;
    markInput();
    const r = el.getBoundingClientRect();
    if (!plinkoDrop(store.state, arcade.columnAt(e.clientX - r.left))) toast('Not enough stone.', 'bad');
    else if (prefs.vibrate) navigator.vibrate?.(6);
    refresh(); render();
  });

  // Android back button/gesture closes a popup or panel instead of leaving the app.
  addEventListener('popstate', () => {
    if (ignorePops > 0) { ignorePops--; return; }
    if (modal) closeModal(true);
    else if (ui.game) openGame(null, true);
    else if (ui.tab && !docked()) openTab(null, true);
  });

  on('toast', ({ text, kind }) => toast(text, kind));
  on('achievement', (a) => toast(`🏆 ${a.name}: ${a.desc} (+2% to everything)`, 'epic'));
  on('loot', (id) => { if ((store.state.meta.collection[id] ?? 0) === 1) toast('New item for your collection!', 'good'); });
}

export let mine: MineView;
/** Animations for the full-screen mini-games (drawn from main.ts every frame). */
export const arcade = new ArcadeView();
export const arcadeCanvas = () => (ui.game ? (document.getElementById('arcadeCanvas') as HTMLCanvasElement | null) : null);
export function createMine() {
  mine = new MineView(
    $('mine') as HTMLCanvasElement,
    // Tapping anywhere in the mine digs (or just closes an open panel).
    () => {
      if (ui.tab && !docked()) { closeSheet(); return; }
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
    // Tapping a Hidden Cavern's entrance explores it.
    (depth) => {
      const s = store.state;
      if (s.run.dungeon) { openGame('dungeon'); return; }
      if (!enterCavern(s, s.run.caverns.indexOf(depth))) { toast('Plan a squad in the Battle tab first: it becomes your party.', 'bad'); return; }
      refresh(); openGame('dungeon');
    },
  );
}

let ignorePops = 0;

export function openTab(tab: string | null, fromHistory = false) {
  if (docked()) {
    // The panel is always showing beside the mine: tabs just switch it (no closing, no history entries).
    if (tab && tab !== 'mine' && !(layout === 'xwide' && tab === 'battle')) ui.tab = tab;
    if (!ui.tab) ui.tab = 'colony';
    $('sheetBody').scrollTop = 0;
    render();
    return;
  }
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

/** Mini-games play in their own full-screen view on top of everything (except toasts and popups). */
export function openGame(id: string | null, fromHistory = false) {
  if (id && (id === 'dungeon' ? !store.state.run.dungeon : !gameUnlocked(store.state, id as GameId))) return;
  const was = ui.game;
  ui.game = id;
  if (!fromHistory) {
    if (!was && id) history.pushState({ delve: 'game' }, '');
    else if (was && !id && history.state?.delve === 'game') { ignorePops++; history.back(); }
  }
  $('arcade').classList.toggle('hidden', !id);
  $('arcadeBack').classList.toggle('hidden', !id);
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

export function closeSheet() { if (ui.tab && !docked()) openTab(null); }

/** Re-arrange for a new layout (window resized, or the Layout setting changed). */
function onLayoutChange() {
  if (docked()) {
    if (!ui.tab || ui.tab === 'mine' || (layout === 'xwide' && ui.tab === 'battle')) ui.tab = 'colony';
    $('sheet').classList.add('open');
  } else {
    $('sheet').classList.toggle('open', !!ui.tab);
  }
  mine?.resize();
  if (store.state) render();
}

/** PC keyboard: Space digs, 1–9 pick a tab, Esc steps back, arrows/PageUp/PageDown scroll the mine, Home jumps to the dig front. */
function bindKeys() {
  addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Escape') {
      if (modal) closeModal();
      else if (ui.game) openGame(null);
      else closeSheet();
      return;
    }
    if (modal || ui.game) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (e.repeat) return;
      unlockAudio();
      A.tapDig(store.state);
      refresh();
      return;
    }
    if (/^[1-9]$/.test(e.key)) {
      const tabs = [...document.querySelectorAll<HTMLElement>('#tabs .tab')].filter((b) => b.offsetParent !== null);
      tabs[Number(e.key) - 1]?.click();
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); mine.scrollBy(e.key === 'PageDown' ? 400 : 80); }
    if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); mine.scrollBy(e.key === 'PageUp' ? -400 : -80); }
    if (e.key === 'Home') mine.jumpToFront();
  });
}

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
  const end = (e: PointerEvent) => {
    if (startY < 0) return;
    startY = -1;
    sheet.style.transition = ''; sheet.style.transform = '';
    // A swipe down or a plain tap closes; an interrupted touch (pointercancel) just snaps back.
    if (e.type === 'pointerup' && (dy > 50 || dy < 6)) closeSheet();
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
  // Closing the cloud question without answering changes nothing; sync asks again later.
  if (modal === 'cloud' && pendingAsk) { pendingAsk.reject(new Error('not answered')); pendingAsk = null; }
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
    rep.guardians ? `<div class="kv"><span>Guardians defeated</span><span class="grow"></span><b class="good">+${rep.guardians}</b></div>` : '',
    rep.caverns ? `<div class="kv"><span>🕳️ Hidden Caverns found</span><span class="grow"></span><b class="good">+${rep.caverns}</b></div>` : '',
  ].join('');
  const skills = rep.skills.map((x) => `<div class="kv"><span>${SKILLS[x.id].icon} ${SKILLS[x.id].name}</span><span class="grow"></span>
    <span class="sub">+${fmt(x.xp)} XP</span>${x.to > x.from ? ` <b class="good">Lv ${x.from} → ${x.to}</b>` : ''}</div>`).join('');
  const capped = rep.simulated < rep.away ? `<p class="sub">Only ${fmtTime(rep.simulated)} counted (offline limit). The Long Memory blessing raises it.</p>` : '';
  showModal('offline', `<h2>Welcome back, Digging God!</h2><p>You were away for <b>${fmtTime(rep.away)}</b>. Your colony kept busy:</p>${lines}${extra}${skills ? `<h3>Skills</h3>${skills}` : ''}${capped}
    <div class="center"><button class="btn epic" data-act="closeModal">Lovely</button></div>`);
}

// ---------------------------------------------------------------- cloud saves
let cloudBusy = false;
let cloudError = '';
let pendingAsk: { resolve: (v: 'local' | 'cloud') => void; reject: (e: Error) => void } | null = null;

/** What the cloud module needs from the UI: ask which save to keep, and say when a cloud save was loaded. */
export const cloudUI: CloudUI = {
  ask(local, c) {
    return new Promise((resolve, reject) => {
      pendingAsk = { resolve, reject };
      showModal('cloud', conflictModal(local, c));
    });
  },
  loaded(c, report) {
    mine.jumpToFront();
    toast(`☁️ Loaded your newer save from ${c.device || 'the cloud'}.`, 'good');
    if (report) showOffline(report);
    render();
  },
};

function cloudAnswer(choice: 'local' | 'cloud') {
  const p = pendingAsk;
  pendingAsk = null;
  modal = 'answered'; // so closeModal doesn't treat this as a dismissal
  closeModal();
  p?.resolve(choice);
}

function cloudSignIn(create: boolean) {
  if (!cloud) return;
  const user = ($('cloudUser') as HTMLInputElement | null)?.value.trim() ?? '';
  const pass = ($('cloudPass') as HTMLInputElement | null)?.value ?? '';
  if (!validUsername(user)) { cloudError = 'Usernames are 3–20 letters, numbers or underscores.'; return; }
  if (pass.length < 6) { cloudError = 'Passwords need at least 6 characters.'; return; }
  cloudBusy = true; cloudError = '';
  saveNow();
  cloud.signIn(user, pass, create)
    .then(() => { toast(create ? `☁️ Account created. Welcome, ${user}!` : `☁️ Signed in as ${user}.`, 'good'); return cloud!.sync(store.slot); })
    .catch((e: Error) => { cloudError = e.message || 'Could not reach the cloud. Check your connection.'; })
    .finally(() => { cloudBusy = false; render(); });
}

// ---------------------------------------------------------------- button handling
function onClick(e: MouseEvent) {
  markInput();
  const el = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
  if (el) {
    if ((el as HTMLButtonElement).disabled) return;
    sfx('click');
    (el as HTMLElement).blur?.(); // so Space (dig) doesn't press the same button again on PC
    act(el.dataset.act!, el.dataset.arg ?? '');
    return;
  }
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
    case 'zoneBoss': retryZoneBoss(s); break;
    case 'diceRoll':
      if (!diceRoll(s) && s.run.dice.pot <= 0) toast('Not enough gold for the bet.', 'bad');
      else if (prefs.vibrate) navigator.vibrate?.(s.run.dice.result === 'lose' ? [30, 40, 30] : 15);
      break;
    case 'diceCash': diceCashOut(s); break;
    case 'plinkoDrop': if (!plinkoDrop(s, Number(arg))) toast('Not enough stone.', 'bad'); break;
    case 'cartStart': cartStart(s); break;
    case 'cartFork': cartFork(s, arg as 'sturdy' | 'rickety'); break;
    case 'cartCash': cartCashOut(s); break;
    case 'wheelSpin': if (!arcade.spinning) wheelSpin(s); break;
    case 'explore': if (enterCavern(s, Number(arg))) { openGame('dungeon'); return; } break;
    case 'dungeonDoor': chooseDoor(s, Number(arg)); break;
    case 'dungeonLeave': leaveDungeon(s); openGame(null); return;
    case 'openGame': openGame(arg); return;
    case 'closeGame': openGame(null); return;
    case 'gear': A.buyGearLevel(s, arg as 'w' | 'a'); break;
    case 'tier': A.buyGearTier(s, arg as 'w' | 'a'); break;
    case 'pip': ui.pip = !ui.pip; break;
    case 'divine': A.buyDivine(s, arg); break;
    case 'celestial': A.buyCelestial(s, arg); break;
    case 'celToggle': A.toggleCelestial(s, arg); break;
    case 'ascendOpen': showModal('prestige', ascendModal(s, store.d)); return;
    case 'ascend':
      if (A.ascend(s)) {
        const entries = (history.state?.delve === 'modal' ? 1 : 0) + (ui.tab ? 1 : 0) + (ui.game ? 1 : 0);
        ui.game = null; $('arcade').classList.add('hidden');
        closeModal(true);
        openTab(null, true);
        if (entries) { ignorePops++; history.go(-entries); }
        refresh(); saveNow(); mine.jumpToFront();
      }
      return;
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
        // Close the dialog and the panel together, popping both history entries in one step
        // (two separate history.back() calls race and leave a stray entry).
        const entries = (history.state?.delve === 'modal' ? 1 : 0) + (ui.tab ? 1 : 0) + (ui.game ? 1 : 0);
        ui.game = null; $('arcade').classList.add('hidden');
        closeModal(true);
        openTab(null, true);
        if (entries) { ignorePops++; history.go(-entries); }
        refresh(); saveNow(); mine.jumpToFront();
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
      cloud?.sync(store.slot);
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
    case 'layout': prefs.layout = arg as 'auto' | 'phone' | 'wide'; savePrefs(); applyLayout(); onLayoutChange(); toast(`Layout: ${arg}`, 'good'); break;
    case 'cloudLogin': cloudSignIn(false); break;
    case 'cloudSignup': cloudSignIn(true); break;
    case 'cloudSync': cloud?.sync(store.slot).then(() => render()); break;
    case 'cloudLatest': if (cloud) cloud.alwaysLatest = !cloud.alwaysLatest; break;
    case 'cloudUse': cloudAnswer('cloud'); return;
    case 'cloudKeep': cloudAnswer('local'); return;
    case 'cloudLogout':
      if (cloud && confirm('Log out of cloud saves on this device? Your save stays here and in the cloud.')) {
        cloud.signOut().then(() => { toast('Logged out of cloud saves.', 'good'); render(); });
      }
      break;
    case 'cloudPassword': {
      const pass = prompt('New password (6+ characters):');
      if (pass && pass.length >= 6 && cloudBackend) cloudBackend.changePassword(pass).then(() => toast('Password changed.', 'good'), (e: Error) => toast(e.message, 'bad'));
      else if (pass) toast('Passwords need at least 6 characters.', 'bad');
      break;
    }
    case 'vibrate': prefs.vibrate = !prefs.vibrate; savePrefs(); if (prefs.vibrate) navigator.vibrate?.(20); break;
    case 'sound': prefs.sound = !prefs.sound; savePrefs(); unlockAudio(); sfx('good'); break;
    case 'volume': prefs.volume = Number(arg); savePrefs(); setVolume(prefs.volume); sfx('coin'); break;
    // skills
    case 'skillTree': ui.skillTree = arg as SkillId | 'run'; ui.skillNode = ''; break;
    case 'skillNode': ui.skillNode = ui.skillNode === arg ? '' : arg; break;
    case 'learn': learn(s, arg); break;
    case 'toggleBonuses': ui.showBonuses = !ui.showBonuses; break;
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
    case 'devSkill': {
      // "combat:+5" adjusts by levels; "combat:99" / "combat:1" sets the level.
      const [skill, v] = arg.split(':') as [SkillId, string];
      const cur = skillLevel(s, skill);
      const next = Math.max(1, Math.min(99, v.startsWith('+') || v.startsWith('-') ? cur + Number(v) : Number(v)));
      s.meta.skills[skill] = xpForLevel(next);
      reconcileTrees(s);
      toast(`${SKILLS[skill].name} set to level ${next}`, 'good');
      break;
    }
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
  if (what === 'sparks') { s.meta.sparks += 5; s.meta.totalSparks += 5; }
  if (what === 'prestigeCount') { s.meta.prestiges++; toast(`Prestige count is now ${s.meta.prestiges} (unlocks only, no reset).`, 'good'); }
  if (what === 'research') { for (const x of RESEARCH) if (!r.research.includes(x.id)) r.research.push(x.id); }
  if (what === 'away') { showOffline(applyOffline(3600)); }
  if (what === 'respec') { respecTrees(s); toast('Skill trees refunded.', 'good'); }
  if (what === 'perks') { r.perkPoints += 5; }
  if (what === 'allSkills') { for (const k of SKILL_IDS) s.meta.skills[k] = xpForLevel(99); }
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
    case 'games': html = gamesPanel(s); break;
    case 'settings': html = cloudSection(cloudBusy, cloudError) + settingsPanel(s, d, ui); break;
    case 'build': html = buildPanel(s, d, ui); break;
    case 'floor': html = floorPanel(s, d, ui); break;
  }
  if (layout === 'xwide') {
    const bp = s.run.combatUnlocked ? battlePanel(s, d, ui) : lockedPanel('battle');
    morphdom($('battlePanel'), `<div id="battlePanel">${bp}</div>`, { onBeforeElUpdated: (from) => from.tagName !== 'CANVAS' });
  }
  if (ui.game) morphdom($('arcade'), `<div id="arcade">${arcadeView(s, ui.game as GameId | 'dungeon', arcade)}</div>`, { onBeforeElUpdated: (from) => from.tagName !== 'CANVAS' });
  morphdom(panel, `<div id="panel">${html}</div>`, {
    // Canvases draw themselves; text inputs keep what the player typed.
    onBeforeElUpdated: (from) => !(from.tagName === 'CANVAS' || (from as HTMLElement).dataset?.keep === '1'),
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
  if (s.meta.totalSparks > 0) chips.push(`<div class="chip">✨<b>${fmt(s.meta.sparks)}</b></div>`);
  if (store.speed !== 1) chips.push(`<div class="chip dev">×${store.speed}</div>`);
  const cc = cloudChip();
  if (cc) chips.push(cc);
  morphdom($('topbar'), `<div id="topbar">${chips.join('')}</div>`);
}

function tabLocked(id: string) {
  const s = store.state;
  if (id === 'battle') return !s.run.combatUnlocked;
  // Opens once the first guardian has ever been beaten (and stays open after your first prestige).
  if (id === 'divine') return !s.run.guardians.includes(0) && s.meta.prestiges === 0;
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
    : `<p>The gods only take notice of colonies that prove themselves. The Divine tab opens once you <b>defeat ${GUARDIANS[0].name}</b>,
         the guardian sealing the way into the ${BIOMES[1].name} (depth ${BIOMES[1].from}).</p>
       <p>${r.depth >= BIOMES[1].from ? 'You\'ve reached it! Challenge it in the <b>Battle</b> tab.' : `You're at depth <b>${r.depth}</b>. Keep digging!`}</p>
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
    ...(gamesTabOpen(s) ? [['games', 'Games', '<span class="emo">🎲</span>'] as [string, string, string]] : []),
    ['book', 'Book', icon('i_know')],
    ['settings', 'Menu', '☰'],
  ];
  const active = ui.tab ?? 'mine';
  const shown = tabs.filter(([id]) => !(docked() && id === 'mine') && !(layout === 'xwide' && id === 'battle'));
  const html = shown.map(([id, name, ic], i) => {
    const locked = tabLocked(id);
    const cls = (active === id || (id === 'mine' && (active === 'build' || active === 'floor')) ? 'on' : '') + (locked ? ' locked' : '');
    const dot = id === 'skills' && unspentPoints(s) > 0 ? `<i class="dot">${unspentPoints(s)}</i>` : '';
    return `<button id="tab-${id}" class="tab ${cls}" data-tab="${id}" title="${name} (${i + 1})">${locked ? '<i class="lock">🔒</i>' : ''}${dot}${ic}<span>${name}</span></button>`;
  }).join('');
  morphdom($('tabs'), `<nav id="tabs">${html}</nav>`);
}

/** The next milestone to aim for, shown when nothing more urgent needs saying. */
function nextGoal(s: GameState, d: Derived): string {
  const r = s.run;
  if (r.depth < 1) return 'Tap the mine to dig your first level.';
  if (!r.floors.some(Boolean)) return 'Build a floor on an empty level (gold + button).';
  if (r.depth < 5 && !r.combatUnlocked) return `Dig to depth 5 to unlock the Barracks (${r.depth}/5).`;
  if (!r.combatUnlocked) return 'Build a Barracks to open the Battle tab.';
  if (d.blocked >= 0) return `Defeat ${GUARDIANS[d.blocked].name} in the Battle tab.`;
  if (!r.guardians.includes(0)) return `Dig to depth ${BIOMES[1].from}: something big waits there (${r.depth}/${BIOMES[1].from}).`;
  if (s.meta.prestiges === 0) return 'Prestige from the Divine tab when you feel stuck. Push deeper first for more Favor!';
  if (s.meta.ascensions === 0 && canAscend(s, d)) return 'You can Ascend from the Divine tab: trade your Favor and Divine Tree for Godsparks.';
  const next = BIOMES.find((b) => b.from > r.depth);
  if (next) return `Dig to depth ${next.from} to reach the ${next.name} (${r.depth}/${next.from}).`;
  return `Push the Expedition past zone ${r.maxZone}.`;
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
  const goal = hint ? '' : nextGoal(s, d);
  const el = $('hint');
  el.textContent = hint || (goal ? `🎯 ${goal}` : '');
  el.classList.toggle('goal', !hint && !!goal);
  el.classList.toggle('show', !!(hint || goal) && (!ui.tab || docked()));
}

export function frameUI() {
  $('update').classList.toggle('show', updateReady);
  $('jump').classList.toggle('show', !mine.frontVisible() && (!ui.tab || docked()));
  const fighting = store.state.run.combatUnlocked;
  $('pip').classList.toggle('show', !docked() && ui.pip && fighting && ui.tab !== 'battle');
  // Wide layout: a battle strip above the docked panel (unless the Battle tab itself is open).
  const strip = layout === 'wide' && fighting && ui.tab !== 'battle';
  $('strip').classList.toggle('show', strip);
  document.body.classList.toggle('has-strip', strip);
  document.documentElement.style.setProperty('--top-h', $('topbar').offsetHeight + 'px');
}
/** The canvas showing the full battle view: the Battle tab, or the battle column on very wide screens. */
export const battleCanvas = () => (ui.tab === 'battle' || layout === 'xwide' ? (document.getElementById('battle') as HTMLCanvasElement | null) : null);
/** The small battle view: the mini window on phones, the strip in the wide layout. */
export const pipCanvas = () => ($('strip').classList.contains('show') ? ($('strip') as HTMLCanvasElement)
  : $('pip').classList.contains('show') ? ($('pip') as HTMLCanvasElement) : null);
