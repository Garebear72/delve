// Detects a newer deployed build by comparing version.json with the running build ID.
import { saveNow } from './session';

export let updateReady = false;

/** Returns true if a newer build is live. Never throws (offline or dev just returns false). */
export async function checkForUpdate(): Promise<boolean> {
  try {
    const res = await fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return false;
    const { build } = await res.json();
    updateReady = !!build && build !== __BUILD_ID__;
  } catch { /* offline: try again later */ }
  return updateReady;
}

export function applyUpdate() {
  saveNow();
  location.reload();
}
