import { Fragment, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/* A small, dependency-free Markdown renderer that builds React elements
   (never HTML strings), so model output can't inject markup. Supports
   headings, paragraphs, lists, tables, block quotes, code and inline styles. */

function inline(text: string, key = 'i'): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*)|(\[[^\]]+\]\((https?:\/\/[^)\s]+)\))/g;
  let last = 0; let m: RegExpExecArray | null; let n = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    if (m[1]) out.push(<code key={`${key}-${n++}`} className="rounded bg-ink-100 px-1 py-0.5 font-mono text-[0.9em]">{t.slice(1, -1)}</code>);
    else if (m[2]) out.push(<strong key={`${key}-${n++}`}>{inline(t.slice(2, -2), `${key}-${n}`)}</strong>);
    else if (m[3]) out.push(<em key={`${key}-${n++}`}>{t.slice(1, -1)}</em>);
    else if (m[4]) out.push(<a key={`${key}-${n++}`} href={m[5]} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-700 underline">{t.slice(1, t.indexOf(']'))}</a>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text, className }: { text: string; className?: string }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0; let k = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (line.startsWith('```')) {
      const buf: string[] = []; i++;
      while (i < lines.length && !lines[i].startsWith('```')) buf.push(lines[i++]);
      i++;
      blocks.push(<pre key={k++} className="overflow-x-auto rounded-xl bg-ink-950 p-3 font-mono text-sm text-ink-50"><code>{buf.join('\n')}</code></pre>);
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      const lvl = h[1].length;
      const cls = ['text-2xl font-extrabold', 'mt-2 text-xl font-bold', 'mt-1 text-lg font-bold', 'font-bold'][lvl - 1];
      const Tag = (['h2', 'h3', 'h4', 'h5'] as const)[lvl - 1];
      blocks.push(<Tag key={k++} className={cls}>{inline(h[2], `h${k}`)}</Tag>);
      i++; continue;
    }
    if (/^\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const row = (l: string) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const head = row(line); i += 2;
      const body: string[][] = [];
      while (i < lines.length && /^\|.*\|\s*$/.test(lines[i])) body.push(row(lines[i++]));
      blocks.push(
        <div key={k++} className="overflow-x-auto"><table className="w-full border-collapse text-sm">
          <thead><tr>{head.map((c, j) => <th key={j} className="border border-ink-200 bg-ink-50 px-2 py-1.5 text-left font-semibold">{inline(c, `th${j}`)}</th>)}</tr></thead>
          <tbody>{body.map((r, ri) => <tr key={ri}>{r.map((c, j) => <td key={j} className="border border-ink-200 px-2 py-1.5 align-top">{inline(c, `td${ri}-${j}`)}</td>)}</tr>)}</tbody>
        </table></div>,
      );
      continue;
    }
    if (/^\s*([-*]|\d+[.)])\s+/.test(line)) {
      const ordered = /^\s*\d/.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*]|\d+[.)])\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*([-*]|\d+[.)])\s+/, ''));
      const L = ordered ? 'ol' : 'ul';
      blocks.push(<L key={k++} className={cn('space-y-1 pl-5', ordered ? 'list-decimal' : 'list-disc')}>{items.map((it, j) => <li key={j}>{inline(it, `li${j}`)}</li>)}</L>);
      continue;
    }
    if (line.startsWith('>')) {
      const buf: string[] = [];
      while (i < lines.length && lines[i].startsWith('>')) buf.push(lines[i++].replace(/^>\s?/, ''));
      blocks.push(<blockquote key={k++} className="border-l-4 border-brand-300 bg-brand-50/50 px-3 py-2 text-ink-700">{inline(buf.join(' '), `q${k}`)}</blockquote>);
      continue;
    }
    if (/^-{3,}$/.test(line.trim())) { blocks.push(<hr key={k++} className="border-ink-200" />); i++; continue; }
    const buf: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|```|>|\s*([-*]|\d+[.)])\s+|\|)/.test(lines[i])) buf.push(lines[i++]);
    if (!buf.length) { buf.push(lines[i++]); }
    blocks.push(<p key={k++}>{buf.map((b, j) => <Fragment key={j}>{j > 0 && <br />}{inline(b, `p${k}-${j}`)}</Fragment>)}</p>);
  }
  return <div className={cn('space-y-3 leading-relaxed text-ink-800', className)}>{blocks}</div>;
}
