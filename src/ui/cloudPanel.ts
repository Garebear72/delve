// Cloud save UI: the Menu section (sign in / account), the "which save?" question, and the status chip.
import { cloud, cloudStatus, deviceName } from '../cloud';
import type { CloudSave, LocalSave } from '../cloud/sync';
import { esc, fmtTime } from './format';
import { store } from '../game/store';

const btn = (label: string, act: string, arg: string | number = '', on = true, cls = '') =>
  `<button class="btn ${cls}" data-act="${act}" data-arg="${arg}" ${on ? '' : 'disabled'}>${label}</button>`;
const ago = (t: number) => (t ? `${fmtTime((Date.now() - t) / 1000)} ago` : 'never');

/** Menu section. `busy` disables the buttons while a sign-in is in flight. */
export function cloudSection(busy: boolean, error: string) {
  if (!cloud) {
    return `<h3>☁️ Cloud save</h3><div class="sub">Cloud saves aren't switched on for this copy of the game yet.</div>`;
  }
  const err = error ? `<div class="warn">${esc(error)}</div>` : '';
  if (!cloud.user) {
    return `<h3>☁️ Cloud save</h3>
      <div class="sub">Play on your phone and your PC with the same save. Just a username and password, no email.</div>
      ${err}
      <div class="col cloudform">
        <input id="cloudUser" data-keep="1" autocomplete="username" placeholder="Username (letters, numbers, _)" maxlength="20">
        <input id="cloudPass" data-keep="1" type="password" autocomplete="current-password" placeholder="Password (6+ characters)">
        <div class="wrap">${btn('Log in', 'cloudLogin', '', !busy, 'epic')}${btn('Create account', 'cloudSignup', '', !busy)}</div>
        <div class="sub">There's no email, so there's no password reset: write your password down somewhere safe.</div>
      </div>`;
  }
  const rec = cloud.record(store.slot);
  const dot = cloudStatus.kind === 'error' ? '⚠️' : cloudStatus.kind === 'busy' ? '🔄' : '✅';
  return `<h3>☁️ Cloud save</h3>
    ${err}
    <div class="row"><div class="grow"><b>Signed in as ${esc(cloud.user)}</b><div class="sub">${dot} ${esc(cloudStatus.text)} · last synced ${ago(cloudStatus.lastSync)}${rec.dirty ? ' · unsynced progress' : ''}</div>
      <div class="sub">This device: ${deviceName}. Your save uploads every 30 seconds while you play and when you leave, and checks for newer saves when you come back.</div></div>
      ${btn('Sync now', 'cloudSync', '', !busy, 'small')}</div>
    <div class="row"><div class="grow"><b>Always use the latest save</b><div class="sub">If your phone and PC both changed, keep whichever you played most recently, without asking. Off = ask me every time.</div></div>
      ${btn(cloud.alwaysLatest ? 'On' : 'Off', 'cloudLatest', '', true, cloud.alwaysLatest ? 'on' : '')}</div>
    <div class="wrap">${btn('Change password', 'cloudPassword', '', !busy, 'small')}${btn('Log out', 'cloudLogout', '', !busy, 'small danger')}</div>`;
}

/** Top-bar chip while signed in. */
export function cloudChip() {
  if (!cloud?.user) return '';
  const icon = cloudStatus.kind === 'error' ? '⚠️' : cloudStatus.kind === 'busy' ? '🔄' : '☁️';
  return `<div class="chip cloudchip ${cloudStatus.kind}" title="${esc(cloudStatus.text)}">${icon}</div>`;
}

/** The "both changed" question. */
export function conflictModal(local: LocalSave, c: CloudSave) {
  return `<h2>Two versions of your save</h2>
    <p>Your save changed on <b>${esc(c.device || 'another device')}</b> and on this device (${deviceName}) since they last synced. Which one do you want to keep?</p>
    <div class="col">
      <button class="btn choice" data-act="cloudUse"><b>☁️ ${esc(c.device || 'Cloud')} save</b><span class="sub">${esc(c.summary)} · saved ${ago(c.savedAt)}</span></button>
      <button class="btn choice" data-act="cloudKeep"><b>📱 This ${deviceName.toLowerCase()}'s save</b><span class="sub">${esc(local.summary)} · saved ${ago(local.savedAt)}</span></button>
    </div>
    <p class="sub">The other one is replaced. Tip: Menu → Cloud save → "Always use the latest save" decides for you.</p>`;
}
