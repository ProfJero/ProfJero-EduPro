import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const TITLES: [RegExp, string][] = [
  [/^\/$/, 'ProfJero Edu — Learn, teach and grow together'], [/^\/courses$/, 'Courses — ProfJero Edu'], [/^\/about$/, 'About ProfJero Edu'],
  [/^\/for-schools$/, 'For schools — ProfJero Edu'], [/^\/for-educators$/, 'For teachers — ProfJero Edu'], [/^\/pricing$/, 'Edu & EduPro plans — ProfJero Edu'],
  [/^\/contact$/, 'Contact ProfJero Edu'], [/^\/verify/, 'Verify a certificate — ProfJero Edu'], [/^\/login$/, 'Log in — ProfJero Edu'], [/^\/register$/, 'Create your free account — ProfJero Edu'],
  [/^\/(learn|teach|school|admin)\/?$/, 'Dashboard — ProfJero Edu'], [/^\/learn\/classes|^\/teach\/classes/, 'Classes — ProfJero Edu'], [/^\/learn\/scores/, 'My scores — ProfJero Edu'],
  [/^\/notifications/, 'Notifications — ProfJero Edu'], [/^\/settings/, 'Settings — ProfJero Edu'], [/^\/calendar/, 'Calendar — ProfJero Edu'], [/^\/ai/, 'AI Companion — ProfJero Edu'],
  [/^\/lab/, 'EduLab — ProfJero Edu'], [/^\/arena/, 'Challenge Arena — ProfJero Edu'], [/^\/discussions/, 'Discussions — ProfJero Edu'], [/^\/feedback/, 'Feedback — ProfJero Edu'],
];

/** Keeps the browser tab title meaningful as people move around the app. */
export function useRouteTitle() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (/^\/courses\/[^/]+$/.test(pathname)) return; // the course page sets its own title
    document.title = TITLES.find(([re]) => re.test(pathname))?.[1] ?? 'ProfJero Edu';
  }, [pathname]);
}
export function usePageTitle(title?: string | null) {
  useEffect(() => { if (title) document.title = `${title} — ProfJero Edu`; }, [title]);
}
