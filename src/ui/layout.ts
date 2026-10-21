// Screen layouts. "phone" is the original single column with a slide-up sheet. On big screens the panel is
// docked on the right ("wide"), and on very wide screens the Battle screen gets its own column too ("xwide").
import { prefs } from './prefs';

export type Layout = 'phone' | 'wide' | 'xwide';
export type LayoutPref = 'auto' | 'phone' | 'wide';

export const WIDE_MIN = 980; // window width (px) where Auto switches to the wide layout
export const XWIDE_MIN = 1440; // ...and to three columns
const WIDE_FLOOR = 760; // below this even a forced "Wide" falls back to phone (it wouldn't fit)

export let layout: Layout = 'phone';
/** Panel docked beside the mine (wide or xwide) rather than sliding up over it. */
export const docked = () => layout !== 'phone';

function compute(): Layout {
  const w = innerWidth, h = innerHeight;
  const pref = prefs.layout as LayoutPref;
  if (pref === 'phone') return 'phone';
  if (pref === 'wide') return w < WIDE_FLOOR ? 'phone' : w >= XWIDE_MIN ? 'xwide' : 'wide';
  if (w < WIDE_MIN || h < 520) return 'phone';
  return w >= XWIDE_MIN ? 'xwide' : 'wide';
}

/** Recompute the layout and tag <body>; returns true if it changed. */
export function applyLayout(): boolean {
  const next = compute();
  const changed = next !== layout;
  layout = next;
  const b = document.body.classList;
  b.toggle('docked', next !== 'phone');
  b.toggle('xwide', next === 'xwide');
  // Phone layout on a big screen: a centred phone-width column instead of a stretched mine.
  b.toggle('phone-col', next === 'phone' && innerWidth > 640);
  return changed;
}
