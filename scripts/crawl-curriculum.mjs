// Catalogues the Ministry of Education curriculum microsite
// (https://curriculumresources.edu.gh) — level, class, subject, document title
// and URL — into data/curriculum-resources.json. Documents are linked, never copied.
// Usage: node scripts/crawl-curriculum.mjs
import { writeFile, mkdir } from 'node:fs/promises';

const BASE = 'https://curriculumresources.edu.gh';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const decode = (s) => s.replace(/&#8211;|&#8212;/g, '–').replace(/&#8217;|&#8216;/g, '’').replace(/&amp;/g, '&').replace(/&#038;/g, '&').replace(/&nbsp;|&#160;/g, ' ').replace(/&#8220;|&#8221;/g, '"').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

async function get(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': 'ProfJeroEdu-curriculum-catalogue/1.0' } });
      if (r.ok) return await r.text();
      if (r.status === 404) return null;
    } catch { /* retry */ }
    await sleep(1500);
  }
  return null;
}
const links = (html) => [...html.matchAll(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)].map((m) => ({ href: m[1].replace(/&#038;|&amp;/g, '&'), text: decode(m[2]) }));
const isDoc = (h) => /\.(pdf|docx?|pptx?|xlsx?|mp4|zip)(\?|$)/i.test(h) || /drive\.google\.com|docs\.google\.com|youtube\.com|youtu\.be/.test(h);
const pageTitle = (html) => decode((/<title>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? '').split(' - ')[0]);

function classify(url) {
  const p = url.replace(BASE, '').replace(/\/$/, '');
  const slug = p.split('/').pop() ?? '';
  if (p === '/tvet') return { level: 'TVET', grade: null, subject: null, audience: 'learner' };
  if (p === '/general-library-supplementary-materials') return { level: 'General', grade: null, subject: null, audience: 'all' };
  if (p === '/professional-development') return { level: 'General', grade: null, subject: null, audience: 'teacher' };
  const m = /^(trs_)?(year|jhs|basic_kg|basic|kg|b)([1-6])(?:_(.+))?$/.exec(slug);
  if (!m) return null;
  const [, trs, kind, n, subject] = m;
  const level = kind === 'year' ? 'SHS' : kind === 'jhs' ? 'JHS' : 'Basic';
  const grade = kind === 'year' ? `SHS ${n}` : kind === 'jhs' ? `JHS ${n}` : kind === 'kg' || kind === 'basic_kg' ? `KG ${n}` : `Basic ${n}`;
  // A JHS teacher page may link SHS-style slugs; keep the folder's level.
  if (p.startsWith('/jhs/') && kind === 'year') return { level: 'JHS', grade: `JHS ${n}`, subject: subject ?? null, audience: trs ? 'teacher' : 'learner' };
  return { level, grade, subject: subject ?? null, audience: trs ? 'teacher' : 'learner' };
}

const titleCase = (slug) => slug.replace(/_/g, ' – ').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bIct\b/, 'ICT').replace(/\bPeh\b/, 'PEH').replace(/\bAnd\b/g, 'and');

const seeds = ['/year1/', '/year2/', '/year3/', '/jhs/', '/basic/', '/tvet/', '/general-library-supplementary-materials/', '/professional-development/', '/trs_year1/', '/trs_year2/', '/trs_year3/'];
const queue = new Set();
let frontier = seeds.map((s) => BASE + s.replace(/\/$/, ''));
for (let depth = 0; depth < 3 && frontier.length; depth++) {
  const next = [];
  for (const u of frontier) {
    if (queue.has(u)) continue;
    queue.add(u);
    const html = await get(u + '/');
    await sleep(300);
    if (!html) continue;
    for (const l of links(html)) {
      const v = l.href.split('#')[0].split('?')[0].replace(/\/$/, '');
      if (v.startsWith(BASE) && !v.includes('/wp-') && classify(v) && !queue.has(v)) next.push(v);
    }
  }
  frontier = [...new Set(next)];
}
const out = [];
const seen = new Set();
for (const page of queue) {
  const meta = classify(page);
  const html = await get(page + '/');
  await sleep(400);
  if (!html || !meta) continue;
  const start = html.search(/<main[\s>]/i);
  const end = html.search(/<footer[\s>]/i);
  const main = html.slice(start >= 0 ? start : 0, end > start ? end : undefined);
  let heading = null;
  for (const block of main.split(/(?=<h[1-6][\s>])/i)) {
    const h = /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i.exec(block);
    if (h) heading = decode(h[1]) || heading;
    for (const l of links(block)) {
      if (!isDoc(l.href) || /youtube\.com\/channel/.test(l.href) || /Guidelines-on-the-Use-of-Tablets|LMS-Ghana-Platform-User-Guide/i.test(l.href)) continue;
      const key = `${meta.grade}|${l.href}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const file = decodeURIComponent(l.href.split('/').pop() ?? '').replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ');
      out.push({
        level: meta.level, grade: meta.grade,
        subject: meta.subject ? titleCase(meta.subject) : (heading && heading.length < 80 ? heading : null),
        audience: meta.audience,
        title: (l.text && l.text.length > 2 && !/^(download|view|click here|here|pdf)$/i.test(l.text) ? l.text : file).slice(0, 300),
        url: l.href, page: page + '/', page_title: pageTitle(html),
      });
    }
  }
  process.stdout.write(`.${out.length}`);
}
await mkdir('data', { recursive: true });
await writeFile('data/curriculum-resources.json', JSON.stringify({ source: BASE, fetched_at: new Date().toISOString(), resources: out }, null, 1));
console.log(`\n${out.length} resources from ${queue.size} pages`);
