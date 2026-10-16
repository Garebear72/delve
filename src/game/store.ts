import { derive, Derived } from './calc';
import { GameState, newGame } from './state';

/** The single live game. Everything reads `store.state`; call `refresh()` after changes. */
export const store = {
  state: newGame() as GameState,
  d: null as unknown as Derived,
  slot: 1,
  speed: 1,
  dev: false,
};
export function refresh() { store.d = derive(store.state); }
refresh();
