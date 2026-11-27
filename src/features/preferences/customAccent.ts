/** Builds a full brand colour scale (50–900) from one colour the user picks, keeping
 *  buttons readable: shade 600 (used behind white text) always reaches 4.5:1 contrast. */
type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB | null {
  const m = hex.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
const toHex = (c: RGB) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const lum = (c: RGB) => {
  const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
};
export function contrastOn(a: string, b: string) {
  const x = hexToRgb(a), y = hexToRgb(b);
  if (!x || !y) return 1;
  const [l1, l2] = [lum(x), lum(y)].sort((p, q) => q - p);
  return (l1 + 0.05) / (l2 + 0.05);
}

const WHITE: RGB = [255, 255, 255];
const BLACK: RGB = [10, 14, 28];

export type Scale = Record<50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900, string>;

export function accentScale(hex: string): Scale {
  const base = hexToRgb(hex) ?? [21, 84, 214];
  // Darken until white text on it is comfortably readable.
  let strong = base;
  for (let t = 0; t <= 1 && contrastOn(toHex(strong), '#ffffff') < 4.6; t += 0.04) strong = mix(base, BLACK, t);
  return {
    50: toHex(mix(base, WHITE, 0.92)), 100: toHex(mix(base, WHITE, 0.84)), 200: toHex(mix(base, WHITE, 0.68)),
    300: toHex(mix(base, WHITE, 0.46)), 400: toHex(mix(base, WHITE, 0.22)), 500: toHex(base),
    600: toHex(strong), 700: toHex(mix(strong, BLACK, 0.18)), 800: toHex(mix(strong, BLACK, 0.34)), 900: toHex(mix(strong, BLACK, 0.5)),
  };
}

const STYLE_ID = 'pje-custom-accent';
/** Injects the scale for [data-accent='custom']; dark mode keeps deriving its own tints. */
export function applyCustomAccent(hex: string | null | undefined) {
  const el = document.getElementById(STYLE_ID);
  if (!hex || !hexToRgb(hex)) { el?.remove(); return; }
  const s = accentScale(hex);
  const all = ([300, 400, 500, 600, 900] as const).map((k) => `--color-brand-${k}: ${s[k]};`).join(' ');
  const light = ([50, 100, 200, 700, 800] as const).map((k) => `--color-brand-${k}: ${s[k]};`).join(' ');
  const css = `:root[data-accent='custom'] { ${all} } :root[data-accent='custom']:not(.dark) { ${light} }`;
  const tag = el ?? Object.assign(document.createElement('style'), { id: STYLE_ID });
  tag.textContent = css;
  if (!el) document.head.appendChild(tag);
}

export const SUGGESTED = ['#1554d6', '#0f766e', '#7c3aed', '#db2777', '#ea580c', '#16a34a', '#0891b2', '#b45309', '#4338ca', '#be123c', '#0d9488', '#6d28d9'];
