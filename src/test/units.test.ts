import { describe, expect, it } from 'vitest';
import { slugify, pct, initials, safeExternalUrl, plural } from '@/lib/utils';
import { cldUrl, videoEmbedUrl } from '@/lib/media';
import { deriveWorkspaces, hasFeature, type MyContext } from '@/features/authentication/types';
import { validateBlocks, newBlock, isAllowedEmbed } from '@/features/lessons/blocks';
import { validateMeetingLink, PROVIDERS } from '@/features/live/providers';
import { sessionPhase } from '@/features/learning/queries';
import { assessmentWindow } from '@/features/assessments/queries';
import { isAnswered, type AttemptQuestion } from '@/features/assessments/AttemptPage';
import { signParams, sha1Hex } from '../../worker/cloudinary';

const ctx = (over: Partial<MyContext>): MyContext => ({ user_id: 'u', roles: ['learner'], schools: [], school_applications: [], teaches_classes: false, pending_invitations: 0, entitlements: {}, is_edupro: false, ...over });

describe('utils', () => {
  it('slugifies titles', () => {
    expect(slugify('  Python Foundations: Loops & Lists! ')).toBe('python-foundations-loops-lists');
    expect(slugify('Écoles du Ghana')).toBe('ecoles-du-ghana');
  });
  it('clamps percentages', () => {
    expect(pct('33.33')).toBe(33);
    expect(pct(150)).toBe(100);
    expect(pct(null)).toBe(0);
    expect(pct('nope')).toBe(0);
  });
  it('builds initials and plurals', () => {
    expect(initials('Kwame Owusu Mensah')).toBe('KM');
    expect(initials('')).toBe('?');
    expect(plural(1, 'lesson')).toBe('1 lesson');
    expect(plural(3, 'lesson')).toBe('3 lessons');
  });
  it('only allows http(s) external links', () => {
    expect(safeExternalUrl('javascript:alert(1)')).toBeNull();
    expect(safeExternalUrl('https://example.com/a')).toBe('https://example.com/a');
    expect(safeExternalUrl('not a url')).toBeNull();
  });
});

describe('media', () => {
  it('adds bandwidth-friendly transformations to Cloudinary URLs only', () => {
    expect(cldUrl('https://res.cloudinary.com/demo/image/upload/v1/x.jpg', { w: 320 })).toContain('/upload/f_auto,q_auto,w_320,c_limit,dpr_1.0/');
    expect(cldUrl('https://example.com/x.jpg', { w: 320 })).toBe('https://example.com/x.jpg');
  });
  it('converts video links to privacy-friendly embeds', () => {
    expect(videoEmbedUrl('https://www.youtube.com/watch?v=abc123')).toBe('https://www.youtube-nocookie.com/embed/abc123');
    expect(videoEmbedUrl('https://youtu.be/abc123')).toBe('https://www.youtube-nocookie.com/embed/abc123');
    expect(videoEmbedUrl('https://vimeo.com/12345')).toBe('https://player.vimeo.com/video/12345');
    expect(videoEmbedUrl('https://example.com/video.mp4')).toBeNull();
  });
});

describe('workspaces & entitlements (UX only — the database enforces permissions)', () => {
  it('every user gets the learner workspace', () => {
    expect(deriveWorkspaces(ctx({})).map((w) => w.kind)).toEqual(['learner']);
  });
  it('teachers, school admins and admins get their workspaces', () => {
    const ws = deriveWorkspaces(ctx({ roles: ['learner', 'teacher', 'platform_admin'], schools: [{ school_id: 's1', name: 'Dev SHS', slug: 'dev', status: 'approved', logo_url: null, roles: ['school_admin'] }] }));
    expect(ws.map((w) => w.kind)).toEqual(['learner', 'teacher', 'school', 'admin']);
  });
  it('school students do not get a school admin workspace', () => {
    const ws = deriveWorkspaces(ctx({ schools: [{ school_id: 's1', name: 'Dev SHS', slug: 'dev', status: 'approved', logo_url: null, roles: ['student'] }] }));
    expect(ws.some((w) => w.kind === 'school')).toBe(false);
  });
  it('reads feature entitlements', () => {
    const c = ctx({ entitlements: { premium_courses: { enabled: true, limit: null, plans: ['edupro_individual'] }, certificates: { enabled: false, limit: null, plans: [] } } });
    expect(hasFeature(c, 'premium_courses')).toBe(true);
    expect(hasFeature(c, 'certificates')).toBe(false);
    expect(hasFeature(null, 'premium_courses')).toBe(false);
  });
});

describe('lesson blocks', () => {
  it('accepts default blocks and rejects insecure media', () => {
    expect(validateBlocks([newBlock('paragraph'), newBlock('code'), newBlock('steps')])).toEqual({ ok: true });
    const img = { ...newBlock('image'), content: { url: 'http://insecure.example/x.png', alt: '' } };
    const r = validateBlocks([newBlock('heading'), img]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.index).toBe(1);
  });
  it('restricts embeds to approved learning tools', () => {
    expect(isAllowedEmbed('https://phet.colorado.edu/sims/html/x.html')).toBe(true);
    expect(isAllowedEmbed('https://evil.example.com/x')).toBe(false);
    expect(isAllowedEmbed('http://phet.colorado.edu/x')).toBe(false);
  });
});

describe('live-class providers', () => {
  it('validates meeting links per provider', () => {
    expect(validateMeetingLink('google_meet', 'https://meet.google.com/abc-defg-hij')).toBeNull();
    expect(validateMeetingLink('google_meet', 'https://zoom.us/j/1')).toMatch(/Google Meet/);
    expect(validateMeetingLink('zoom', 'https://us05web.zoom.us/j/123')).toBeNull();
    expect(validateMeetingLink('manual', 'http://insecure.example')).toMatch(/https/);
  });
  it('generates hard-to-guess Jitsi rooms', () => {
    const a = PROVIDERS.jitsi.generateLink!('Loops clinic');
    const b = PROVIDERS.jitsi.generateLink!('Loops clinic');
    expect(a).toMatch(/^https:\/\/meet\.jit\.si\/ProfJeroEdu-loops-clinic-[0-9a-f]{8}$/);
    expect(a).not.toBe(b);
  });
  it('computes session phase', () => {
    const now = Date.parse('2026-11-19T10:00:00Z');
    const s = (min: number, status = 'scheduled') => ({ starts_at: new Date(now + min * 60_000).toISOString(), duration_minutes: 60, status });
    expect(sessionPhase(s(30), now)).toBe('upcoming');
    expect(sessionPhase(s(5), now)).toBe('live');
    expect(sessionPhase(s(-30), now)).toBe('live');
    expect(sessionPhase(s(-90), now)).toBe('ended');
    expect(sessionPhase(s(5, 'cancelled'), now)).toBe('cancelled');
  });
});

describe('assessments (client helpers; grading is server-side)', () => {
  it('computes the open window', () => {
    const now = Date.parse('2026-11-19T10:00:00Z');
    expect(assessmentWindow({ opens_at: null, closes_at: null }, now)).toBe('open');
    expect(assessmentWindow({ opens_at: '2026-11-20T00:00:00Z', closes_at: null }, now)).toBe('not_open');
    expect(assessmentWindow({ opens_at: null, closes_at: '2026-11-19T09:00:00Z' }, now)).toBe('closed');
  });
  it('detects answered questions by type', () => {
    const q = (type: string) => ({ type } as AttemptQuestion);
    expect(isAnswered(q('multiple_choice'), { option_id: 'x' })).toBe(true);
    expect(isAnswered(q('multiple_select'), { option_ids: [] })).toBe(false);
    expect(isAnswered(q('essay'), { text: '   ' })).toBe(false);
    expect(isAnswered(q('matching'), { pairs: { a: 'b' } })).toBe(true);
  });
});

describe('Cloudinary signing (server)', () => {
  it('computes SHA-1 and signs sorted params like the Cloudinary spec', async () => {
    expect(await sha1Hex('abc')).toBe('a9993e364706816aba3e25717850c26c9cd0d89d');
    // Example from Cloudinary docs: eager=w_400,h_300,c_pad|w_260,h_200,c_crop&public_id=sample_image&timestamp=1315060510 + abcd
    const sig = await signParams({ timestamp: 1315060510, public_id: 'sample_image', eager: 'w_400,h_300,c_pad|w_260,h_200,c_crop', empty: '' }, 'abcd');
    expect(sig).toBe('bfd09f95f331f558cbd1320e67aa8d488770583e');
  });
});
