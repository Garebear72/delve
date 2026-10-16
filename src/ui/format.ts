const SUFFIX = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

export function fmt(n: number): string {
  if (!isFinite(n)) return '∞';
  if (n < 0) return '-' + fmt(-n);
  if (n < 10) return (Math.floor(n * 10) / 10).toString();
  if (n < 1000) return Math.floor(n).toString();
  const e = Math.floor(Math.log10(n) / 3);
  if (e < SUFFIX.length) {
    const v = n / Math.pow(10, e * 3);
    return (Math.floor(v * (v < 10 ? 100 : v < 100 ? 10 : 1)) / (v < 10 ? 100 : v < 100 ? 10 : 1)) + SUFFIX[e];
  }
  return n.toExponential(2).replace('+', '');
}

export function fmtRate(n: number): string {
  if (Math.abs(n) < 0.05) return '';
  return (n > 0 ? '+' : '') + fmt(n) + '/s';
}

export function fmtTime(sec: number): string {
  sec = Math.floor(sec);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s}s`;
  return `${s}s`;
}

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
