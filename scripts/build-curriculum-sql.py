"""Builds seed migrations from data/curriculum-shs.json and data/curriculum-resources.json."""
import json, re, uuid, hashlib
NS = uuid.UUID('6f2b0e64-0b8e-4a39-9f63-6e8c2d6b1a00')
q = lambda s: "null" if s is None else "'" + str(s).replace("'", "''") + "'"
def nice(t):
    small = {'and', 'of', 'the', 'in', 'for', 'to', 'its', 'a', 'an', 'on', 'with', 'by', 'or', 'as', 'at'}
    if t != t.upper(): return t
    w = t.lower().split()
    return ' '.join(x if (i and x in small) else (x[:1].upper() + x[1:]) for i, x in enumerate(w)).replace('Ict', 'ICT')
slug = lambda s: re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')

subjects = json.load(open('data/curriculum-shs.json'))
seen, rows = {}, []
for s in subjects:
    sig = hashlib.md5(json.dumps(s['items']).encode()).hexdigest()
    name = re.sub(r'^Ghanaian Language – .*$', 'Ghanaian Language', s['subject'])
    name = {'General Science': 'General Science', 'Core Physical Education and Health PEH': 'Physical Education and Health (Core)', 'Elective Physical Education and Health PEH': 'Physical Education and Health (Elective)',
            'Information and Communication Technology ICT': 'ICT', 'Business Studies Business Management': 'Business Management', 'Business Studies Accounting': 'Accounting',
            'Home Economics Management In Living': 'Management in Living', 'Home Economics Food and Nutrition': 'Food and Nutrition', 'Home Economics Clothing and Textiles': 'Clothing and Textiles',
            'Religious Studies Islamic': 'Islamic Religious Studies', 'Religious Studies Christian': 'Christian Religious Studies', 'Literature In English': 'Literature-in-English'}.get(name, name)
    if sig in seen or name in seen.values(): continue
    seen[sig] = name
    sl = slug(name)
    sid = uuid.uuid5(NS, f'subject:{sl}')
    rows.append((sid, None, 'subject', f'SHS-{sl}', name, f'Official SHS curriculum document: {s["source"]}', None, len(rows)))
    nodes = {}
    for key, it in s['items']:
        yr, st, ss = it['year'], it['strand'], it['sub']
        parent = sid
        stt = s['strands'].get(f'{yr}.{st}')
        if stt:
            k = ('st', yr, st)
            if k not in nodes:
                nodes[k] = uuid.uuid5(NS, f'{sl}:st:{yr}.{st}')
                rows.append((nodes[k], sid, 'strand', f'{sl} {yr}.{st}', f'Strand {st}: {nice(stt)}', None, f'SHS {yr}', int(st)))
            parent = nodes[k]
        sst = s['sub_strands'].get(f'{yr}.{st}.{ss}')
        if sst:
            k = ('ss', yr, st, ss)
            if k not in nodes:
                nodes[k] = uuid.uuid5(NS, f'{sl}:ss:{yr}.{st}.{ss}')
                rows.append((nodes[k], parent, 'sub_strand', f'{sl} {yr}.{st}.{ss}', f'Sub-strand {ss}: {nice(sst)}', None, f'SHS {yr}', int(ss)))
            parent = nodes[k]
        kind = 'content_standard' if it['kind'] == 'CS' else 'learning_outcome'
        rows.append((uuid.uuid5(NS, f'{sl}:{key}'), parent, kind, f'{sl} {key}', it['text'][:500], None, f'SHS {yr}', it['n']))

out = ["-- Official SHS curriculum structure (verbatim) extracted from the Ministry of Education curriculum microsite",
       "-- https://curriculumresources.edu.gh by scripts/extract-curriculum.py + scripts/build-curriculum-sql.py.",
       "alter table public.curriculum_items drop constraint if exists curriculum_items_kind_check;",
       "alter table public.curriculum_items add constraint curriculum_items_kind_check check (kind in ('subject', 'strand', 'sub_strand', 'content_standard', 'learning_outcome', 'indicator', 'exemplar', 'core_competency'));",
       "update public.curriculum_frameworks set status = 'approved', source_url = 'https://curriculumresources.edu.gh', description = 'SHS 1–3 subject curricula published by the Ministry of Education / NaCCA. Strands, sub-strands, content standards and learning outcomes as written in the official documents.' where code = 'gh-shs-2024';",
       "insert into public.curriculum_items (id, framework_id, parent_id, kind, code, title, description, grade_level, position, status) values"]
vals = []
for (i, p, kind, code, title, desc, grade, pos) in rows:
    vals.append(f"({q(i)}, (select id from public.curriculum_frameworks where code = 'gh-shs-2024'), {q(p)}, {q(kind)}, {q(code)}, {q(title)}, {q(desc)}, {q(grade)}, {pos}, 'approved')")
out.append(',\n'.join(vals) + "\non conflict (id) do update set title = excluded.title, description = excluded.description, parent_id = excluded.parent_id, status = 'approved';")
open('supabase/migrations/20261121000600_curriculum_shs.sql', 'w').write('\n'.join(out) + '\n')
print(len(rows), 'curriculum items;', len(seen), 'subjects')

res = json.load(open('data/curriculum-resources.json'))['resources']
out = ["-- Catalogue of official teaching and learning materials on https://curriculumresources.edu.gh (links only).",
       "create table if not exists public.curriculum_resources (",
       "  id uuid primary key default gen_random_uuid(),",
       "  level text not null, grade text, subject text, audience text not null default 'learner' check (audience in ('learner', 'teacher', 'all')),",
       "  title text not null, url text not null unique check (url ~ '^https://'), page_url text, source text not null default 'curriculumresources.edu.gh',",
       "  search tsvector generated always as (to_tsvector('english', coalesce(subject, '') || ' ' || title || ' ' || coalesce(grade, ''))) stored,",
       "  created_at timestamptz not null default now());",
       "create index if not exists curriculum_resources_grade_idx on public.curriculum_resources (level, grade, subject);",
       "create index if not exists curriculum_resources_search_idx on public.curriculum_resources using gin (search);",
       "alter table public.curriculum_resources enable row level security;",
       "drop policy if exists cres_read on public.curriculum_resources;",
       "create policy cres_read on public.curriculum_resources for select to anon, authenticated using (true);",
       "drop policy if exists cres_admin on public.curriculum_resources;",
       "create policy cres_admin on public.curriculum_resources for all to authenticated using ((select private.is_platform_admin())) with check ((select private.is_platform_admin()));",
       "grant select on public.curriculum_resources to anon, authenticated;",
       "grant insert, update, delete on public.curriculum_resources to authenticated;",
       "insert into public.curriculum_resources (level, grade, subject, audience, title, url, page_url) values"]
vals, urls = [], set()
for r in res:
    if r['url'] in urls or not r['url'].startswith('https://'): continue
    urls.add(r['url'])
    subj = r['subject'] if r['subject'] and 'Duplicate' not in r['subject'] else r['subject'] and re.sub(r' Duplicate \d+', '', r['subject'])
    vals.append(f"({q(r['level'])}, {q(r['grade'])}, {q(subj)}, {q(r['audience'])}, {q(r['title'][:300])}, {q(r['url'])}, {q(r['page'])})")
out.append(',\n'.join(vals) + "\non conflict (url) do nothing;")
open('supabase/migrations/20261121000700_curriculum_resources.sql', 'w').write('\n'.join(out) + '\n')
print(len(vals), 'resources')
