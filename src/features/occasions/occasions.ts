/**
 * Festive occasions for ProfJero Edu — Ghanaian public holidays and commemorative
 * days (Public Holidays and Commemorative Days (Amendment) Act, 2025) plus popular
 * celebrations. Each has a date window, a light decoration and a greeting.
 *
 * Design rule (Nielsen Norman Group, "Celebrating holidays on websites"): small,
 * tasteful touches that keep the brand intact — an ornament on the logo, a garland,
 * a short greeting — never anything that gets in the way of learning.
 */
export type Decoration = 'lights' | 'flags' | 'hearts' | 'flowers' | 'eggs' | 'harvest' | 'stars' | 'confetti' | 'apples' | 'none';
export type Particles = 'snow' | 'confetti' | 'hearts' | 'petals' | 'leaves' | 'stars' | null;
export type Hat = 'santa' | 'party' | 'flag' | 'bunny' | 'crescent' | 'apple' | 'flower' | null;

export type Occasion = {
  id: string; name: string; emoji: string; greeting: string;
  decoration: Decoration; particles: Particles; hat: Hat;
  colors: string[]; // garland / confetti palette
  /** Inclusive [start, end] window (local dates) for a given year, or null when it can’t be computed. */
  window: (year: number) => [Date, Date] | null;
  /** Higher wins when windows overlap. */
  priority: number;
  /** Day to count down to in the greeting (e.g. Christmas Day). */
  countdownTo?: (year: number) => Date;
  /** Only shown when the owner turns it on (no fixed date). */
  manualOnly?: boolean;
  note?: string;
};

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);
const addDays = (x: Date, n: number) => new Date(x.getFullYear(), x.getMonth(), x.getDate() + n);
const around = (x: Date, before: number, after = 0): [Date, Date] => [addDays(x, -before), addDays(x, after)];

/** Western (Gregorian) Easter Sunday — Anonymous Gregorian algorithm. */
export function easterSunday(y: number): Date {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, dd = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - dd - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return d(y, month, day);
}
/** The nth (1-based) weekday (0 = Sunday) of a month. */
export function nthWeekday(y: number, month: number, weekday: number, n: number): Date {
  const first = d(y, month, 1);
  return d(y, month, 1 + ((weekday - first.getDay() + 7) % 7) + (n - 1) * 7);
}

/** Eid dates depend on the sighting of the moon; these are the expected dates and the owner can switch either off. */
const EID: Record<number, { fitr: [number, number]; adha: [number, number] }> = {
  2026: { fitr: [3, 20], adha: [5, 27] }, 2027: { fitr: [3, 10], adha: [5, 17] }, 2028: { fitr: [2, 27], adha: [5, 5] },
  2029: { fitr: [2, 15], adha: [4, 24] }, 2030: { fitr: [2, 5], adha: [4, 13] }, 2031: { fitr: [1, 25], adha: [4, 3] },
};
const GH = ['#ce1126', '#fcd116', '#006b3f', '#111111'];

export const OCCASIONS: Occasion[] = [
  { id: 'christmas', name: 'Christmas season', emoji: '🎄', greeting: 'Merry Christmas from all of us at ProfJero Edu!', decoration: 'lights', particles: 'snow', hat: 'santa',
    colors: ['#e11d48', '#facc15', '#22c55e', '#38bdf8', '#f97316'], window: (y) => [d(y, 12, 1), d(y, 12, 30)], priority: 1, countdownTo: (y) => d(y, 12, 25) },
  { id: 'new-year', name: 'New Year', emoji: '🎆', greeting: 'Happy New Year! New goals, new lessons, new wins.', decoration: 'lights', particles: 'confetti', hat: 'party',
    colors: ['#facc15', '#f59e0b', '#ffffff', '#a78bfa', '#38bdf8'], window: (y) => [d(y, 1, 1), d(y, 1, 3)], priority: 5 },
  { id: 'new-year-eve', name: 'New Year’s Eve', emoji: '🥂', greeting: 'Here’s to a brilliant new year of learning!', decoration: 'lights', particles: 'confetti', hat: 'party',
    colors: ['#facc15', '#f59e0b', '#ffffff', '#a78bfa'], window: (y) => [d(y, 12, 31), d(y, 12, 31)], priority: 5, countdownTo: (y) => d(y + 1, 1, 1) },
  { id: 'constitution-day', name: 'Constitution Day', emoji: '🇬🇭', greeting: 'Happy Constitution Day, Ghana! 🇬🇭', decoration: 'flags', particles: null, hat: 'flag',
    colors: GH, window: (y) => around(d(y, 1, 7), 0), priority: 6 },
  { id: 'valentine', name: 'Valentine’s & National Chocolate Day', emoji: '🍫', greeting: 'Happy National Chocolate Day — spread love and kindness! 🍫❤️', decoration: 'hearts', particles: 'hearts', hat: null,
    colors: ['#e11d48', '#fb7185', '#7c2d12', '#fda4af'], window: (y) => around(d(y, 2, 14), 1), priority: 4 },
  { id: 'independence', name: 'Independence Day', emoji: '🇬🇭', greeting: 'Happy Independence Day, Ghana! Freedom and justice. 🇬🇭', decoration: 'flags', particles: 'confetti', hat: 'flag',
    colors: GH, window: (y) => around(d(y, 3, 6), 2), priority: 8, countdownTo: (y) => d(y, 3, 6) },
  { id: 'eid-al-fitr', name: 'Eid al-Fitr', emoji: '🌙', greeting: 'Eid Mubarak to everyone celebrating! 🌙', decoration: 'stars', particles: 'stars', hat: 'crescent',
    colors: ['#facc15', '#22c55e', '#ffffff', '#a78bfa'], window: (y) => (EID[y] ? around(d(y, ...EID[y].fitr), 1, 1) : null), priority: 7, note: 'Date depends on the moon sighting.' },
  { id: 'easter', name: 'Easter', emoji: '🐣', greeting: 'Happy Easter! Rest well and keep shining. 🐣', decoration: 'eggs', particles: 'petals', hat: 'bunny',
    colors: ['#f9a8d4', '#c4b5fd', '#fde68a', '#86efac', '#7dd3fc'], window: (y) => [addDays(easterSunday(y), -2), addDays(easterSunday(y), 1)], priority: 7, countdownTo: (y) => easterSunday(y) },
  { id: 'may-day', name: 'May Day', emoji: '🛠️', greeting: 'Happy May Day to every hard-working Ghanaian!', decoration: 'none', particles: null, hat: null,
    colors: GH, window: (y) => around(d(y, 5, 1), 0), priority: 3 },
  { id: 'mothers-day', name: 'Mother’s Day', emoji: '💐', greeting: 'Happy Mother’s Day to every mum, auntie and grandma! 💐', decoration: 'flowers', particles: 'petals', hat: 'flower',
    colors: ['#f472b6', '#fb7185', '#facc15', '#a78bfa'], window: (y) => around(nthWeekday(y, 5, 0, 2), 2), priority: 6, countdownTo: (y) => nthWeekday(y, 5, 0, 2) },
  { id: 'eid-al-adha', name: 'Eid al-Adha', emoji: '🌙', greeting: 'Eid al-Adha Mubarak! 🌙', decoration: 'stars', particles: 'stars', hat: 'crescent',
    colors: ['#facc15', '#22c55e', '#ffffff'], window: (y) => (EID[y] ? around(d(y, ...EID[y].adha), 1, 1) : null), priority: 7, note: 'Date depends on the moon sighting.' },
  { id: 'fathers-day', name: 'Father’s Day', emoji: '👔', greeting: 'Happy Father’s Day to every dad and father figure! 👔', decoration: 'stars', particles: null, hat: null,
    colors: ['#1554d6', '#38bdf8', '#facc15'], window: (y) => around(nthWeekday(y, 6, 0, 3), 2), priority: 6, countdownTo: (y) => nthWeekday(y, 6, 0, 3) },
  { id: 'republic-day', name: 'Republic Day', emoji: '🇬🇭', greeting: 'Happy Republic Day, Ghana! 🇬🇭', decoration: 'flags', particles: null, hat: 'flag',
    colors: GH, window: (y) => around(d(y, 7, 1), 1), priority: 6 },
  { id: 'founders-day', name: 'Founders’ Day', emoji: '⭐', greeting: 'Happy Founders’ Day — honouring Dr Kwame Nkrumah. ⭐', decoration: 'flags', particles: 'stars', hat: 'flag',
    colors: GH, window: (y) => around(d(y, 9, 21), 1), priority: 6 },
  { id: 'teachers-day', name: 'World Teachers’ Day', emoji: '🍎', greeting: 'Happy Teachers’ Day — thank you, teachers! 🍎', decoration: 'apples', particles: 'stars', hat: 'apple',
    colors: ['#ef4444', '#22c55e', '#facc15', '#1554d6'], window: (y) => around(d(y, 10, 5), 1), priority: 6 },
  { id: 'farmers-day', name: 'National Farmers’ Day', emoji: '🌽', greeting: 'Happy Farmers’ Day! Thank you to every farmer who feeds Ghana. 🌽', decoration: 'harvest', particles: 'leaves', hat: null,
    colors: ['#65a30d', '#facc15', '#a16207', '#16a34a'], window: (y) => around(nthWeekday(y, 12, 5, 1), 2), priority: 6 },
  { id: 'exams', name: 'Exam season (good luck)', emoji: '🍀', greeting: 'Good luck in your exams! You’ve got this. 🍀', decoration: 'stars', particles: null, hat: null,
    colors: ['#22c55e', '#facc15', '#1554d6'], window: () => null, priority: 2, manualOnly: true },
  { id: 'celebration', name: 'Celebration / graduation', emoji: '🎓', greeting: 'Congratulations, graduates! 🎓', decoration: 'confetti', particles: 'confetti', hat: 'party',
    colors: ['#1554d6', '#facc15', '#22c55e', '#e11d48', '#a78bfa'], window: () => null, priority: 2, manualOnly: true },
];

export type OccasionConfig = { mode: 'auto' | 'manual' | 'off'; manual: string | null; disabled: string[]; messages: Record<string, string>; effects: boolean };
export const DEFAULT_CONFIG: OccasionConfig = { mode: 'auto', manual: null, disabled: [], messages: {}, effects: true };

export function readConfig(v: unknown): OccasionConfig {
  const c = (v && typeof v === 'object' ? v : {}) as Partial<OccasionConfig>;
  return { ...DEFAULT_CONFIG, ...c, disabled: Array.isArray(c.disabled) ? c.disabled : [], messages: c.messages && typeof c.messages === 'object' ? c.messages : {} };
}

const dayKey = (x: Date) => x.getFullYear() * 10000 + (x.getMonth() + 1) * 100 + x.getDate();
export function isActive(o: Occasion, now: Date) {
  const w = o.window(now.getFullYear());
  if (!w) return false;
  const k = dayKey(now);
  return k >= dayKey(w[0]) && k <= dayKey(w[1]);
}

/** The occasion to show right now (or null). */
export function currentOccasion(cfg: OccasionConfig, now = new Date()): Occasion | null {
  if (cfg.mode === 'off') return null;
  if (cfg.mode === 'manual') return OCCASIONS.find((o) => o.id === cfg.manual) ?? null;
  return OCCASIONS.filter((o) => !o.manualOnly && !cfg.disabled.includes(o.id) && isActive(o, now)).sort((a, b) => b.priority - a.priority)[0] ?? null;
}

export function daysUntil(target: Date, now = new Date()) {
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((target.getTime() - a) / 86_400_000);
}

/** The next time this occasion starts (for the owner’s overview). */
export function nextWindow(o: Occasion, now = new Date()): [Date, Date] | null {
  for (const y of [now.getFullYear(), now.getFullYear() + 1]) {
    const w = o.window(y);
    if (w && dayKey(w[1]) >= dayKey(now)) return w;
  }
  return null;
}
