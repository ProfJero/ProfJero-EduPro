import { useEffect } from 'react';

/**
 * ContrastGuard — keeps text readable in every theme.
 * After each render (idle, debounced) it measures each text element's colour
 * against the real background behind it. If the WCAG contrast ratio is below
 * 4.5:1 (3:1 for large text) it nudges that element's colour toward white or
 * black just enough to pass. This also fixes colours pasted into lesson content.
 * Opt out with data-no-contrast (e.g. code editors, previews).
 */
type RGBA = [number, number, number, number];
const cache = new Map<string, RGBA>();
let ctx: CanvasRenderingContext2D | null = null;

function parse(color: string): RGBA | null {
  const hit = cache.get(color);
  if (hit) return hit;
  const m = /^rgba?\(([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:[ ,/]+([\d.]+%?))?\)$/.exec(color);
  let out: RGBA | null = null;
  if (m) out = [+m[1], +m[2], +m[3], m[4] == null ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : +m[4]];
  else {
    // oklab()/color()/color-mix() results: let the browser resolve it.
    ctx ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#000';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    out = [d[0], d[1], d[2], d[3] / 255];
  }
  if (cache.size > 500) cache.clear();
  cache.set(color, out);
  return out;
}
const lum = ([r, g, b]: RGBA) => {
  const f = (c: number) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a: RGBA, b: RGBA) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const over = (top: RGBA, bottom: RGBA): RGBA => {
  const a = top[3];
  return [top[0] * a + bottom[0] * (1 - a), top[1] * a + bottom[1] * (1 - a), top[2] * a + bottom[2] * (1 - a), 1];
};

/** Effective solid background behind an element; null if an image/gradient is in the way. */
function backgroundOf(el: Element | null): RGBA | null {
  const layers: RGBA[] = [];
  for (let n = el; n; n = n.parentElement) {
    const cs = getComputedStyle(n);
    if (cs.backgroundImage && cs.backgroundImage !== 'none') return null;
    const c = parse(cs.backgroundColor);
    if (c && c[3] > 0) { layers.push(c); if (c[3] >= 0.99) break; }
  }
  let bg: RGBA = parse(getComputedStyle(document.body).backgroundColor) ?? [255, 255, 255, 1];
  if (bg[3] < 1) bg = over(bg, [255, 255, 255, 1]);
  for (let i = layers.length - 1; i >= 0; i--) bg = over(layers[i], bg);
  return bg;
}

const ownText = (el: Element) => { for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent && n.textContent.trim()) return true; return false; };

function fixAll(root: ParentNode) {
  const els = root.querySelectorAll<HTMLElement>('body *:not(script):not(style):not(svg *):not(canvas):not(iframe)');
  let checked = 0;
  for (const el of els) {
    if (checked > 2500) break;
    if (!ownText(el) || el.closest('[data-no-contrast]')) continue;
    checked++;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.opacity === '0') continue;
    const sig = `${cs.color}`;
    if (el.dataset.cg === sig) continue;
    const fg = parse(cs.color);
    const bg = backgroundOf(el);
    if (!fg || !bg) continue;
    const size = parseFloat(cs.fontSize);
    const large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700);
    const need = large ? 3 : 4.5;
    let solid = over(fg, bg);
    if (ratio(solid, bg) >= need) { el.dataset.cg = sig; continue; }
    const toward: RGBA = lum(bg) < 0.4 ? [255, 255, 255, 1] : [0, 0, 0, 1];
    for (let t = 0.1; t <= 1.001 && ratio(solid, bg) < need; t += 0.1) {
      const base = over(fg, bg);
      solid = [base[0] + (toward[0] - base[0]) * t, base[1] + (toward[1] - base[1]) * t, base[2] + (toward[2] - base[2]) * t, 1];
    }
    if (el.dataset.cgOrig === undefined) el.dataset.cgOrig = el.style.color || '';
    el.style.color = `rgb(${solid.slice(0, 3).map((v) => Math.round(v)).join(' ')})`;
    el.dataset.cg = el.style.color.replace(/\s/g, '') === '' ? sig : getComputedStyle(el).color;
  }
}

function reset() {
  document.querySelectorAll<HTMLElement>('[data-cg-orig]').forEach((el) => { el.style.color = el.dataset.cgOrig ?? ''; delete el.dataset.cgOrig; });
  document.querySelectorAll<HTMLElement>('[data-cg]').forEach((el) => delete el.dataset.cg);
}

export function ContrastGuard() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const idle = (cb: () => void) => ((window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback ?? ((f: () => void) => setTimeout(f, 50)))(cb, { timeout: 1500 });
    const schedule = () => { if (timer) clearTimeout(timer); timer = setTimeout(() => idle(() => fixAll(document)), 350); };
    const mo = new MutationObserver((muts) => {
      if (muts.some((m) => m.type === 'attributes' && m.target === document.documentElement)) reset();
      schedule();
    });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-accent'] });
    schedule();
    return () => { mo.disconnect(); if (timer) clearTimeout(timer); };
  }, []);
  return null;
}
