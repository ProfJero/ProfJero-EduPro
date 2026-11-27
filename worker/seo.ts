/**
 * SEO for ProfJero Edu (Google Search Console, WhatsApp/Facebook link previews):
 *  - /robots.txt and a live /sitemap.xml (public pages + published public courses)
 *  - server-side <title>, description, canonical, Open Graph and Twitter tags per page,
 *    so crawlers and chat apps see the right preview without running JavaScript
 *  - noindex on private (signed-in) pages
 */
type SeoEnv = { SUPABASE_URL?: string; SUPABASE_ANON_KEY?: string; GOOGLE_SITE_VERIFICATION?: string };
declare const HTMLRewriter: {
  new (): {
    on(selector: string, handler: { element?(el: { setAttribute(n: string, v: string): void; setInnerContent(c: string): void; append(c: string, o?: { html: boolean }): void; remove(): void }): void }): InstanceType<typeof HTMLRewriter>;
    transform(r: Response): Response;
  };
};

const SITE = 'ProfJero Edu';
const DEFAULT_DESC = 'ProfJero Edu is a Ghanaian digital learning platform for SHS learners, teachers and schools — classes, lessons, live classes, virtual labs, an AI study companion and verifiable certificates.';

const PAGES: Record<string, { title: string; description: string }> = {
  '/': { title: 'ProfJero Edu — Learn, teach and grow together', description: DEFAULT_DESC },
  '/courses': { title: 'Courses — ProfJero Edu', description: 'Explore free and premium courses for SHS, university and lifelong learners — aligned to the GES/NaCCA curriculum.' },
  '/about': { title: 'About ProfJero Edu', description: 'ProfJero Edu by ProfJero Digital Studio: accessible, practical and interactive education for learners, educators and institutions.' },
  '/for-schools': { title: 'For schools — ProfJero Edu', description: 'Run classes, registers, assessments, live lessons and reports for your whole school on one platform.' },
  '/for-educators': { title: 'For teachers — ProfJero Edu', description: 'Create your own class, share lessons, take the register, enter scores, run live classes and engage learners.' },
  '/pricing': { title: 'Edu & EduPro plans — ProfJero Edu', description: 'Start free with ProfJero Edu. Upgrade to EduPro for more AI help, labs and premium courses.' },
  '/contact': { title: 'Contact ProfJero Edu', description: 'Get in touch with the ProfJero Edu team.' },
  '/verify': { title: 'Verify a certificate — ProfJero Edu', description: 'Check that a ProfJero Edu certificate is genuine using its reference.' },
  '/privacy': { title: 'Privacy policy — ProfJero Edu', description: 'How ProfJero Edu protects your data.' },
  '/terms': { title: 'Terms of use — ProfJero Edu', description: 'The terms for using ProfJero Edu.' },
  '/accessibility': { title: 'Accessibility — ProfJero Edu', description: 'Our commitment to an accessible learning platform.' },
  '/login': { title: 'Log in — ProfJero Edu', description: 'Log in to your ProfJero Edu account.' },
  '/register': { title: 'Create your free account — ProfJero Edu', description: 'Join ProfJero Edu free — for learners, teachers and schools.' },
};
const INDEXABLE = Object.keys(PAGES).filter((p) => !['/login'].includes(p));
const PRIVATE = /^\/(dashboard|learn|teach|school|admin|settings|notifications|support|onboarding|certificates|connect|discussions|calendar|ai|arena|lab|curriculum|feedback|invitations|schools\/apply|teach\/apply|auth|check-email|forgot-password|reset-password|suspended|join)(\/|$)/;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

async function publicCourses(env: SeoEnv, limit = 2000) {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return [] as { slug: string; updated_at: string }[];
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/courses?select=slug,updated_at&status=eq.published&visibility=eq.public&order=updated_at.desc&limit=${limit}`,
    { headers: { apikey: env.SUPABASE_ANON_KEY, authorization: `Bearer ${env.SUPABASE_ANON_KEY}` }, cf: { cacheTtl: 3600, cacheEverything: true } } as RequestInit);
  return r.ok ? ((await r.json()) as { slug: string; updated_at: string }[]) : [];
}
async function course(env: SeoEnv, slug: string) {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !/^[a-z0-9-]{1,120}$/.test(slug)) return null;
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/courses?select=title,short_description,cover_url,level,subject&slug=eq.${slug}&status=eq.published&visibility=eq.public&limit=1`,
    { headers: { apikey: env.SUPABASE_ANON_KEY, authorization: `Bearer ${env.SUPABASE_ANON_KEY}` }, cf: { cacheTtl: 600, cacheEverything: true } } as RequestInit);
  if (!r.ok) return null;
  const [c] = (await r.json()) as { title: string; short_description: string | null; cover_url: string | null; level: string | null; subject: string | null }[];
  return c ?? null;
}

export function robots(origin: string) {
  const body = ['User-agent: *', 'Allow: /', 'Disallow: /api/',
    ...['/dashboard', '/learn', '/teach', '/school', '/admin', '/settings', '/notifications', '/support', '/onboarding', '/auth', '/join', '/feedback'].map((p) => `Disallow: ${p}`),
    '', `Sitemap: ${origin}/sitemap.xml`, ''].join('\n');
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}

export async function sitemap(env: SeoEnv, origin: string) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    ...INDEXABLE.map((p) => ({ loc: `${origin}${p === '/' ? '/' : p}`, lastmod: today, priority: p === '/' ? '1.0' : p === '/courses' ? '0.9' : '0.6' })),
    ...(await publicCourses(env)).map((c) => ({ loc: `${origin}/courses/${c.slug}`, lastmod: c.updated_at.slice(0, 10), priority: '0.8' })),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${esc(u.loc)}</loc><lastmod>${u.lastmod}</lastmod><priority>${u.priority}</priority></url>`).join('\n')}\n</urlset>\n`;
  return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}

/** Rewrites the SPA shell's head for the requested page. */
export async function withSeo(res: Response, url: URL, env: SeoEnv): Promise<Response> {
  const path = url.pathname.replace(/\/+$/, '') || '/';
  let meta = PAGES[path] ? { ...PAGES[path], image: `${url.origin}/og-image.jpg`, type: 'website' } : null;
  let noindex = PRIVATE.test(path);
  const m = path.match(/^\/courses\/([a-z0-9-]+)$/);
  if (m) {
    const c = await course(env, m[1]).catch(() => null);
    if (c) meta = { title: `${c.title} — ${SITE}`, description: (c.short_description || `Learn ${c.title} on ProfJero Edu.`).slice(0, 200), image: c.cover_url?.startsWith('https://') ? c.cover_url : `${url.origin}/og-image.jpg`, type: 'article' };
    else noindex = true;
  }
  if (!meta && !noindex) noindex = !INDEXABLE.includes(path);
  const canonical = `${url.origin}${path === '/' ? '/' : path}`;
  const m2 = meta ?? { title: `${SITE}`, description: DEFAULT_DESC, image: `${url.origin}/og-image.jpg`, type: 'website' };
  const tags = [
    `<link rel="canonical" href="${esc(canonical)}" />`,
    `<meta property="og:site_name" content="${SITE}" />`, `<meta property="og:locale" content="en_GH" />`,
    `<meta property="og:type" content="${m2.type}" />`, `<meta property="og:url" content="${esc(canonical)}" />`,
    `<meta property="og:title" content="${esc(m2.title)}" />`, `<meta property="og:description" content="${esc(m2.description)}" />`,
    `<meta property="og:image" content="${esc(m2.image)}" />`, `<meta property="og:image:width" content="1200" />`, `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${esc(SITE)} — learning without limits" />`,
    `<meta name="twitter:card" content="summary_large_image" />`, `<meta name="twitter:title" content="${esc(m2.title)}" />`,
    `<meta name="twitter:description" content="${esc(m2.description)}" />`, `<meta name="twitter:image" content="${esc(m2.image)}" />`,
    ...(noindex ? ['<meta name="robots" content="noindex, nofollow" />'] : []),
    ...(env.GOOGLE_SITE_VERIFICATION && /^[\w-]{10,100}$/.test(env.GOOGLE_SITE_VERIFICATION) ? [`<meta name="google-site-verification" content="${env.GOOGLE_SITE_VERIFICATION}" />`] : []),
    ...(path === '/' ? [`<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': [
      { '@type': 'EducationalOrganization', name: SITE, url: `${url.origin}/`, logo: `${url.origin}/icons/icon-512.png`, parentOrganization: { '@type': 'Organization', name: 'ProfJero Digital Studio' }, areaServed: 'GH', description: DEFAULT_DESC },
      { '@type': 'WebSite', name: SITE, url: `${url.origin}/`, inLanguage: 'en-GH', potentialAction: { '@type': 'SearchAction', target: `${url.origin}/courses?q={search_term_string}`, 'query-input': 'required name=search_term_string' } },
    ] }).replace(/</g, '\\u003c')}</script>`] : []),
  ].join('');
  return new HTMLRewriter()
    .on('title', { element: (el) => el.setInnerContent(m2.title) })
    .on('meta[name="description"]', { element: (el) => el.setAttribute('content', m2.description) })
    .on('meta[property^="og:"]', { element: (el) => el.remove() })
    .on('head', { element: (el) => el.append(tags, { html: true }) })
    .transform(res);
}
