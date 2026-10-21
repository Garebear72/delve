// Tracks the player's last interaction, for "while you leave the colony alone" bonuses and cloud sync
// (only real play marks a save as changed; idle progress alone doesn't).
import { IDLE_AFTER } from '../data/skills';
import { isOffline } from './skills';

let lastInput = typeof performance !== 'undefined' ? performance.now() : 0;
const listeners: (() => void)[] = [];
export function onInput(fn: () => void) { listeners.push(fn); }
export function markInput() {
  lastInput = performance.now();
  for (const fn of listeners) fn();
}
/** True offline, or after IDLE_AFTER ms without input. */
export const leftAlone = () => isOffline() || performance.now() - lastInput > IDLE_AFTER;
