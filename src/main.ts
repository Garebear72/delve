import '@fontsource/pixelify-sans/700.css';
import '@fontsource/nunito/400.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import './style.css';
import { activeSlot, requestPersistence } from './game/save';
import { applyOffline, openSlot, saveNow } from './game/session';
import { advance } from './game/sim';
import { checkForUpdate } from './game/update';
import { refresh, store } from './game/store';
import { CombatView } from './render/combat';
import { bindSounds } from './audio/hooks';
import { startCloud } from './cloud';
import { startVisitLog } from './cloud/visits';
import { arcade, arcadeCanvas, cloudUI, battleCanvas, buildShell, createMine, frameUI, mine, pipCanvas, render, showOffline, ui } from './ui/ui';

if (import.meta.env.DEV) (window as any).delve = store; // debugging handle in dev only

buildShell();
createMine();
const report = openSlot(activeSlot());
requestPersistence();
render();
if (report) showOffline(report);
startCloud(cloudUI).catch(() => { /* offline or not configured: the game plays on locally */ });
startVisitLog();

const combat = new CombatView();
bindSounds(() => ui.tab === 'battle');
let last = performance.now();
let uiTimer = 0;
let saveTimer = 0;

function frame(now: number) {
  const dt = Math.min(0.25, Math.max(0, (now - last) / 1000));
  last = now;
  advance(store.state, dt * store.speed);
  refresh();

  const t = now / 1000;
  mine.render(store.state, store.d, t, dt);
  const canvas = battleCanvas() ?? pipCanvas();
  if (canvas && store.state.run.combatUnlocked) combat.draw(canvas, store.state, store.d, t, dt, canvas.id === 'pip');
  const ac = arcadeCanvas();
  if (ac && ui.game) arcade.draw(ac, ui.game, store.state, t, dt);

  uiTimer += dt;
  if (uiTimer > 0.25) { uiTimer = 0; render(); }
  frameUI();

  saveTimer += dt;
  if (saveTimer > 10) { saveTimer = 0; saveNow(); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Save when leaving; catch up on time spent away when returning.
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    saveNow();
    hiddenAt = Date.now();
  } else if (hiddenAt) {
    const away = (Date.now() - hiddenAt) / 1000;
    hiddenAt = 0;
    if (away > 5) {
      showOffline(applyOffline(away));
      render();
    }
    last = performance.now();
    checkForUpdate();
  }
});

// Look for a newer deployed version now, on every return (above) and every 5 minutes.
if (import.meta.env.PROD) {
  checkForUpdate();
  setInterval(checkForUpdate, 5 * 60 * 1000);
}
addEventListener('pagehide', () => saveNow());

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('./sw.js').catch(() => { /* offline support is optional */ });
}
