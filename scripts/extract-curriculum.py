"""Extracts strands, sub-strands, content standards and learning outcomes
(verbatim, with their official codes) from the SHS subject curriculum PDFs
listed in data/curriculum-resources.json. Output: data/curriculum-shs.json.
Requires pdftotext (poppler). Usage: python3 scripts/extract-curriculum.py <pdf-cache-dir>"""
import json, os, re, subprocess, sys, urllib.request, hashlib

CACHE = sys.argv[1] if len(sys.argv) > 1 else '/tmp/curriculum-pdfs'
os.makedirs(CACHE, exist_ok=True)
res = json.load(open('data/curriculum-resources.json'))['resources']
docs = {}
for r in res:
    if r['level'] == 'SHS' and r['url'].lower().endswith('.pdf') and re.search(r'curriculum', r['title'], re.I) and r['subject']:
        docs.setdefault(r['url'], r)

CODE = re.compile(r'^\s*(\d)\.(\d+)\.(\d+)\.(CS|LO)\.(\d+)\s*(.*)$')
ANY_CODE = re.compile(r'^\s*\d\.\d+\.\d+\.(CS|LO|LI|AS)\.\d+')
STOP = re.compile(r'^(Learning (Outcomes|Indicators)|Content Standards?|21st|GESI|Subject|Strand \d|Sub-Strand \d|Teacher|Key Assessment|Pedagogical|Assessment|Hint|Learning Indicator|.*\| [A-Z &]+$|\d+$|[A-Z &]+ \| \d+$)', re.I)
YEAR = {'1': 'SHS 1', '2': 'SHS 2', '3': 'SHS 3'}

def clean(t):
    # Drop control/format characters and PDF bullet glyphs, then collapse whitespace.
    t = ''.join(ch for ch in t if ch in '\t\n' or (ord(ch) >= 32 and ch not in '\u00ad\u200b\u200c\u200d\u2060\ufeff\ufffd\u0209'))
    return re.sub(r'\s+', ' ', t).strip()

def subj_code(subject):
    words = re.sub(r'[^A-Za-z ]', ' ', subject).split()
    return (''.join(w[0] for w in words) if len(words) > 1 else subject[:4]).upper()[:6]

out = []
for url, r in docs.items():
    fn = os.path.join(CACHE, hashlib.sha1(url.encode()).hexdigest()[:16] + '.pdf')
    if not os.path.exists(fn):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'ProfJeroEdu-curriculum-catalogue/1.0'})
            with urllib.request.urlopen(req, timeout=180) as resp, open(fn, 'wb') as f: f.write(resp.read())
        except Exception as e:
            print('download failed', r['subject'], e, file=sys.stderr); continue
    txt = subprocess.run(['pdftotext', fn, '-'], capture_output=True, text=True).stdout
    lines = [l.rstrip() for l in txt.split('\n')]
    strand_titles, sub_titles = {}, {}
    cur_strand, cur_sub = None, None
    items = {}
    i = 0
    def next_text(j):
        while j < len(lines) and not lines[j].strip(): j += 1
        return (clean(lines[j]) if j < len(lines) else ''), j
    while i < len(lines):
        l = lines[i].strip()
        m = re.match(r'^Strand\s+(\d+)\.?\s*(.*)$', l, re.I)
        s = re.match(r'^Sub-?Strand\s+(\d+)\.?\s*(.*)$', l, re.I)
        if m and not s:
            title = clean(m.group(2)) or next_text(i + 1)[0]
            cur_strand = (m.group(1), title)
        elif s:
            title = clean(s.group(2)) or next_text(i + 1)[0]
            cur_sub = (s.group(1), title)
        c = CODE.match(l)
        if c:
            yr, st, ss, kind, n, rest = c.groups()
            key = f'{yr}.{st}.{ss}.{kind}.{n}'
            body, j = [rest] if rest else [], i + 1
            while j < len(lines) and len(' '.join(body)) < 600:
                t = lines[j].strip()
                if ANY_CODE.match(t) or (t and STOP.match(t)) or (not t and body and len(' '.join(body)) > 40): break
                if t: body.append(t)
                j += 1
            text = clean(' '.join(body))
            if key not in items and len(text) >= 15 and not re.match(r'^\d', text):
                if cur_strand and cur_strand[0] == st: strand_titles.setdefault((yr, st), cur_strand[1])
                if cur_sub and cur_sub[0] == ss: sub_titles.setdefault((yr, st, ss), cur_sub[1])
                items[key] = {'year': yr, 'strand': st, 'sub': ss, 'kind': kind, 'n': int(n), 'text': text[:500]}
            i = j; continue
        i += 1
    if not items:
        print('no codes found', r['subject'], file=sys.stderr); continue
    sc = subj_code(r['subject'])
    out.append({'subject': r['subject'], 'code': sc, 'source': url, 'strands': {f'{k[0]}.{k[1]}': v for k, v in strand_titles.items()},
                'sub_strands': {f'{k[0]}.{k[1]}.{k[2]}': v for k, v in sub_titles.items()}, 'items': sorted(items.items())})
    print(f"{r['subject']}: {len(items)} items, {len(strand_titles)} strands, {len(sub_titles)} sub-strands", file=sys.stderr)
json.dump(out, open('data/curriculum-shs.json', 'w'), indent=1, ensure_ascii=False)
print(f'{len(out)} subjects extracted')
