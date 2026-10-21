// Connects game events to sound effects. Combat sounds only play while the Battle tab is open.
import { BIOMES } from '../data/defs';
import { on } from '../game/events';
import { sfx, unlockAudio } from './sfx';

export function bindSounds(battleVisible: () => boolean) {
  // Audio can only start inside a user gesture. On Android touch screens that's the finger lifting
  // (pointerup / touchend / click), not pointerdown, so listen to all of them; each also resumes audio
  // if the phone suspended it.
  for (const ev of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) addEventListener(ev, unlockAudio, { capture: true, passive: true });

  on('tap', (e: { combo: number; crit: boolean }) => sfx(e.crit ? 'crit' : 'tap', e.combo));
  on('tapBlocked', () => sfx('blocked'));
  on('dug', (depth: number) => sfx(BIOMES.some((b) => b.from === depth) ? 'biome' : 'dug'));
  on('built', () => sfx('build'));
  on('hit', (h: { crit: boolean }) => { if (battleVisible()) sfx(h.crit ? 'hitCrit' : 'hit'); });
  on('hurt', () => { if (battleVisible()) sfx('hurt'); });
  on('kill', () => { if (battleVisible()) sfx('kill'); });
  on('wipe', () => { if (battleVisible()) sfx('wipe'); });
  on('loot', () => sfx('loot'));
  on('achievement', () => sfx('epic'));
  on('toast', (t: { kind: string }) => { if (t.kind === 'epic') sfx('epic'); else if (t.kind === 'bad') sfx('bad'); });
  on('curio', () => sfx('curio'));
  on('dice', (r: string) => { sfx('dice'); setTimeout(() => sfx(r === 'lose' ? 'lose' : 'win'), 260); });
  on('cart', (w: string) => sfx(w === 'crash' ? 'crash' : 'cart'));
  on('dungeon', (w: string) => sfx(w === 'won' ? 'win' : w === 'fled' ? 'lose' : 'door'));
}
