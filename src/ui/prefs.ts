// Per-device preferences (not part of the save, so they don't travel with exports).
export const prefs = { vibrate: true, sound: true, volume: 0.7 };
try { Object.assign(prefs, JSON.parse(localStorage.getItem('delve.prefs') ?? '{}')); } catch { /* defaults */ }

export function savePrefs() {
  try { localStorage.setItem('delve.prefs', JSON.stringify(prefs)); } catch { /* ignore */ }
}
