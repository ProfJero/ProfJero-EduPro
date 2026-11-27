import { describe, expect, it } from 'vitest';
import { currentOccasion, DEFAULT_CONFIG, easterSunday, nthWeekday, OCCASIONS } from '@/features/occasions/occasions';
import { encodeMentions, plainMentions } from '@/components/app/Mentions';
import { accentScale, contrastOn } from '@/features/preferences/customAccent';

const ymd = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;

describe('occasion calendar', () => {
  it('computes Easter Sunday', () => {
    expect(ymd(easterSunday(2026))).toBe('2026-04-05');
    expect(ymd(easterSunday(2027))).toBe('2027-03-28');
    expect(ymd(easterSunday(2025))).toBe('2025-04-20');
  });
  it('finds Farmers’ Day (first Friday of December) and Mother’s Day', () => {
    expect(ymd(nthWeekday(2026, 12, 5, 1))).toBe('2026-12-04');
    expect(ymd(nthWeekday(2026, 5, 0, 2))).toBe('2026-05-10');
    expect(ymd(nthWeekday(2026, 6, 0, 3))).toBe('2026-06-21');
  });
  it('picks the most specific occasion when windows overlap', () => {
    expect(currentOccasion(DEFAULT_CONFIG, new Date(2026, 11, 4))?.id).toBe('farmers-day');
    expect(currentOccasion(DEFAULT_CONFIG, new Date(2026, 11, 10))?.id).toBe('christmas');
    expect(currentOccasion(DEFAULT_CONFIG, new Date(2026, 2, 6))?.id).toBe('independence');
    expect(currentOccasion(DEFAULT_CONFIG, new Date(2026, 8, 21))?.id).toBe('founders-day');
    expect(currentOccasion(DEFAULT_CONFIG, new Date(2026, 7, 12))).toBeNull();
  });
  it('respects owner choices', () => {
    expect(currentOccasion({ ...DEFAULT_CONFIG, mode: 'off' }, new Date(2026, 11, 25))).toBeNull();
    expect(currentOccasion({ ...DEFAULT_CONFIG, disabled: ['christmas'] }, new Date(2026, 11, 10))).toBeNull();
    expect(currentOccasion({ ...DEFAULT_CONFIG, mode: 'manual', manual: 'exams' }, new Date(2026, 7, 12))?.id).toBe('exams');
    expect(OCCASIONS.every((o) => o.greeting.length > 5)).toBe(true);
  });
});

describe('mentions', () => {
  it('encodes picked names and reads back as plain text', () => {
    const picked = new Map([['Ama Mensah', '00000000-0000-4000-a000-000000000002']]);
    const enc = encodeMentions('Thanks @Ama Mensah! and @Nobody', picked);
    expect(enc).toBe('Thanks @[Ama Mensah](00000000-0000-4000-a000-000000000002)! and @Nobody');
    expect(plainMentions(enc)).toBe('Thanks @Ama Mensah! and @Nobody');
  });
});

describe('custom accent colour', () => {
  it('builds a readable 50–900 scale from any colour', () => {
    const s = accentScale('#ffeb3b'); // very light yellow
    expect(Object.keys(s)).toHaveLength(10);
    expect(contrastOn(s[600], '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(contrastOn(accentScale('#1554d6')[600], '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });
});
