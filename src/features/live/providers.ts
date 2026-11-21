/**
 * Live-class provider registry (adapter pattern).
 * The platform never hosts video. Each provider describes how a meeting link
 * is obtained. "link" adapters work today with no credentials; "oauth"
 * adapters (Google Meet API, Zoom Meetings API) create meetings server-side
 * once the platform owner configures credentials — see docs/INTEGRATIONS.md.
 */
export type ProviderId = 'manual' | 'google_meet' | 'zoom' | 'jitsi' | 'teams' | 'other';
export type ProviderAdapter = {
  id: ProviderId; name: string; mode: 'link' | 'oauth+link'; color: string;
  hostPattern?: RegExp; placeholder: string; help: string;
  generateLink?: (title: string) => string;
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

export const PROVIDERS: Record<ProviderId, ProviderAdapter> = {
  google_meet: { id: 'google_meet', name: 'Google Meet', mode: 'oauth+link', color: 'bg-growth-600', hostPattern: /^meet\.google\.com$/, placeholder: 'https://meet.google.com/abc-defg-hij', help: 'Create a meeting in Google Calendar or Meet and paste its link. Automatic creation via your Google account requires the owner to configure Google OAuth.' },
  zoom: { id: 'zoom', name: 'Zoom', mode: 'oauth+link', color: 'bg-brand-600', hostPattern: /(^|\.)zoom\.us$/, placeholder: 'https://us05web.zoom.us/j/1234567890?pwd=…', help: 'Schedule the meeting in Zoom and paste the invite link. Automatic creation requires the owner to configure the Zoom Meetings API.' },
  jitsi: {
    id: 'jitsi', name: 'Jitsi Meet', mode: 'link', color: 'bg-violet-600', placeholder: 'https://meet.jit.si/ProfJeroEdu-…',
    help: 'We generate a hard-to-guess room name. Tick “Hold the class inside ProfJero Edu” to run the video right on the class page. Long classes need Jitsi as a Service (JaaS) configured by the administrator; the free public server is for short tests.',
    generateLink: (title) => `https://meet.jit.si/ProfJeroEdu-${slug(title) || 'class'}-${crypto.randomUUID().slice(0, 8)}`,
  },
  teams: { id: 'teams', name: 'Microsoft Teams', mode: 'link', color: 'bg-indigo-600', hostPattern: /(^|\.)teams\.(microsoft|live)\.com$/, placeholder: 'https://teams.microsoft.com/l/meetup-join/…', help: 'Paste a Teams meeting link.' },
  manual: { id: 'manual', name: 'Other meeting link', mode: 'link', color: 'bg-ink-700', placeholder: 'https://…', help: 'Any secure https meeting link.' },
  other: { id: 'other', name: 'Other', mode: 'link', color: 'bg-ink-700', placeholder: 'https://…', help: 'Any secure https meeting link.' },
};
export const PROVIDER_CHOICES: ProviderId[] = ['google_meet', 'zoom', 'jitsi', 'teams', 'manual'];

export function validateMeetingLink(provider: ProviderId, url: string): string | null {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return 'Enter a full meeting link starting with https://';
  }
  if (u.protocol !== 'https:') return 'Meeting links must use https://';
  const p = PROVIDERS[provider];
  if (p.hostPattern && !p.hostPattern.test(u.hostname)) return `That doesn't look like a ${p.name} link.`;
  return null;
}

export function providerName(id: string) {
  return PROVIDERS[id as ProviderId]?.name ?? 'Meeting';
}
