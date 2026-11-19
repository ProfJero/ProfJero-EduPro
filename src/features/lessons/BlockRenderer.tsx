import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Download, ExternalLink, Info, Lightbulb, Star, Wrench, XCircle, Copy, Check } from 'lucide-react';
import { cldSrcSet, cldUrl, videoEmbedUrl } from '@/lib/media';
import { cn, safeExternalUrl } from '@/lib/utils';
import { isAllowedEmbed, type LessonBlock } from './blocks';

type C = Record<string, unknown>;
const s = (v: unknown) => (typeof v === 'string' ? v : '');

export function BlockRenderer({ blocks }: { blocks: Pick<LessonBlock, 'type' | 'content'>[] }) {
  return (
    <div className="prose-lesson space-y-6">
      {blocks.map((b, i) => <Block key={i} type={b.type} c={b.content as C} />)}
    </div>
  );
}

function Block({ type, c }: { type: string; c: C }) {
  switch (type) {
    case 'heading':
      return c.level === 3 ? <h3 className="pt-2 text-xl font-bold">{s(c.text)}</h3> : <h2 className="pt-3 text-2xl font-extrabold">{s(c.text)}</h2>;
    case 'paragraph':
      return <Paragraph text={s(c.text)} />;
    case 'image':
      return s(c.url) ? (
        <figure>
          <img src={cldUrl(s(c.url), { w: 1200 })} srcSet={cldSrcSet(s(c.url))} sizes="(min-width: 1024px) 760px, 100vw" alt={s(c.alt)} loading="lazy" className="w-full rounded-xl border border-ink-100" />
          {s(c.caption) && <figcaption className="mt-2 text-center text-sm text-ink-500">{s(c.caption)}</figcaption>}
        </figure>
      ) : null;
    case 'video':
      return <Video c={c} />;
    case 'audio':
      return s(c.url) ? (
        <figure className="rounded-xl border border-ink-200 bg-white p-4">
          <audio controls preload="none" src={s(c.url)} className="w-full">Your browser does not support audio.</audio>
          {s(c.caption) && <figcaption className="mt-2 text-sm text-ink-500">{s(c.caption)}</figcaption>}
          <Transcript text={s(c.transcript)} />
        </figure>
      ) : null;
    case 'code':
      return <CodeBlock code={s(c.code)} language={s(c.language)} output={s(c.output)} />;
    case 'callout':
      return <Callout tone={s(c.tone)} title={s(c.title)} text={s(c.text)} />;
    case 'activity':
      return (
        <section className="rounded-2xl border-2 border-dashed border-growth-500/40 bg-growth-50/60 p-5">
          <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-growth-700"><Wrench className="h-4 w-4" />Practical activity</div>
          <h3 className="mt-1 text-lg font-bold text-ink-900">{s(c.title)}</h3>
          <Paragraph text={s(c.instructions)} />
          {s(c.expected) && <details className="mt-3 rounded-lg bg-white p-3 text-sm"><summary className="cursor-pointer font-semibold text-growth-700">What you should end up with</summary><p className="mt-2 whitespace-pre-wrap text-ink-600">{s(c.expected)}</p></details>}
        </section>
      );
    case 'quiz':
      return <KnowledgeCheck c={c} />;
    case 'resource':
    case 'link': {
      const url = safeExternalUrl(s(c.url));
      if (!url) return null;
      const Icon = type === 'resource' ? Download : ExternalLink;
      return (
        <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 rounded-xl border border-ink-200 bg-white p-4 no-underline transition hover:border-brand-300 hover:bg-brand-50/40">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><Icon className="h-5 w-5" /></span>
          <span className="min-w-0">
            <span className="block font-semibold text-ink-900">{s(c.title) || url}</span>
            {s(c.description) && <span className="block text-sm text-ink-500">{s(c.description)}</span>}
          </span>
        </a>
      );
    }
    case 'table': {
      const headers = (c.headers as string[]) ?? [];
      const rows = (c.rows as string[][]) ?? [];
      return (
        <div className="overflow-x-auto rounded-xl border border-ink-200">
          <table className="w-full text-left text-sm">
            {s(c.caption) && <caption className="bg-ink-50 px-4 py-2 text-left text-sm font-semibold text-ink-700">{s(c.caption)}</caption>}
            <thead className="bg-ink-50"><tr>{headers.map((h, i) => <th key={i} scope="col" className="px-4 py-2.5 font-semibold text-ink-800">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-ink-100 bg-white">{rows.map((r, i) => <tr key={i}>{r.map((cell, j) => <td key={j} className="px-4 py-2.5 text-ink-700">{cell}</td>)}</tr>)}</tbody>
          </table>
        </div>
      );
    }
    case 'steps':
      return (
        <section>
          {s(c.title) && <h3 className="mb-3 text-lg font-bold">{s(c.title)}</h3>}
          <ol className="space-y-3">
            {((c.steps as string[]) ?? []).map((st, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">{i + 1}</span>
                <span className="pt-0.5 whitespace-pre-wrap">{st}</span>
              </li>
            ))}
          </ol>
        </section>
      );
    case 'embed': {
      const url = s(c.url);
      if (!isAllowedEmbed(url)) return <p className="rounded-xl bg-ink-50 p-4 text-sm text-ink-500">This embedded content is not from an approved provider.</p>;
      return (
        <div className="overflow-hidden rounded-xl border border-ink-200">
          <iframe src={url} title={s(c.title)} loading="lazy" className="w-full" style={{ height: Number(c.height) || 480 }} sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation" allow="fullscreen" referrerPolicy="no-referrer" />
        </div>
      );
    }
    case 'divider':
      return <hr className="border-ink-200" />;
    default:
      return null;
  }
}

function Paragraph({ text }: { text: string }) {
  // Lightweight formatting: blank line = new paragraph, **bold**, `code`.
  return (
    <div className="space-y-4">
      {text.split(/\n{2,}/).map((p, i) => (
        <p key={i} className="whitespace-pre-wrap">
          {p.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, j) =>
            part.startsWith('**') && part.endsWith('**') ? <strong key={j} className="font-semibold text-ink-900">{part.slice(2, -2)}</strong>
              : part.startsWith('`') && part.endsWith('`') ? <code key={j} className="rounded bg-ink-100 px-1.5 py-0.5 font-mono text-[0.9em] text-ink-900">{part.slice(1, -1)}</code>
              : part,
          )}
        </p>
      ))}
    </div>
  );
}

function Video({ c }: { c: C }) {
  const url = s(c.url);
  if (!url) return null;
  const embed = videoEmbedUrl(url);
  return (
    <figure>
      {embed ? (
        <div className="aspect-video overflow-hidden rounded-xl bg-ink-900">
          <iframe src={embed} title={s(c.caption) || 'Lesson video'} loading="lazy" className="h-full w-full" allow="accelerometer; encrypted-media; picture-in-picture; fullscreen" referrerPolicy="strict-origin-when-cross-origin" />
        </div>
      ) : (
        <video controls preload="none" className="w-full rounded-xl bg-ink-900" src={url}>Your browser does not support video.</video>
      )}
      {s(c.caption) && <figcaption className="mt-2 text-sm text-ink-500">{s(c.caption)}</figcaption>}
      <Transcript text={s(c.transcript)} />
    </figure>
  );
}

function Transcript({ text }: { text: string }) {
  if (!text) return null;
  return <details className="mt-2 rounded-lg bg-ink-50 p-3 text-sm"><summary className="cursor-pointer font-semibold text-ink-700">Transcript</summary><p className="mt-2 whitespace-pre-wrap text-ink-600">{text}</p></details>;
}

function CodeBlock({ code, language, output }: { code: string; language: string; output: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="overflow-hidden rounded-xl border border-ink-800 bg-ink-950 text-sm">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-xs text-ink-300">
        <span className="font-semibold uppercase tracking-wide">{language || 'code'}</span>
        <button className="inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-white/10" onClick={() => { void navigator.clipboard?.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); }} aria-label="Copy code">
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono leading-relaxed text-ink-100"><code>{code}</code></pre>
      {output && (
        <div className="border-t border-white/10 bg-black/40 px-4 py-3">
          <p className="text-[0.7rem] font-bold uppercase tracking-wider text-growth-500">Output</p>
          <pre className="mt-1 overflow-x-auto font-mono text-ink-200">{output}</pre>
        </div>
      )}
    </div>
  );
}

const calloutStyles: Record<string, { cls: string; icon: React.ReactNode; label: string }> = {
  info: { cls: 'border-brand-200 bg-brand-50', icon: <Info className="h-5 w-5 text-brand-600" />, label: 'Note' },
  tip: { cls: 'border-growth-100 bg-growth-50', icon: <Lightbulb className="h-5 w-5 text-growth-600" />, label: 'Tip' },
  warning: { cls: 'border-sun-100 bg-sun-50', icon: <AlertTriangle className="h-5 w-5 text-sun-500" />, label: 'Watch out' },
  important: { cls: 'border-violet-200 bg-violet-50', icon: <Star className="h-5 w-5 text-violet-600" />, label: 'Key point' },
};
function Callout({ tone, title, text }: { tone: string; title: string; text: string }) {
  const st = calloutStyles[tone] ?? calloutStyles.info;
  return (
    <aside className={cn('flex gap-3 rounded-xl border p-4', st.cls)}>
      <div className="shrink-0 pt-0.5">{st.icon}</div>
      <div><p className="font-bold text-ink-900">{title || st.label}</p><p className="mt-0.5 whitespace-pre-wrap text-ink-700">{text}</p></div>
    </aside>
  );
}

function KnowledgeCheck({ c }: { c: C }) {
  const options = ((c.options as string[]) ?? []).filter(Boolean);
  const [picked, setPicked] = useState<number | null>(null);
  const answer = Number(c.answer ?? 0);
  if (!s(c.question) && !s(c.assessment_id)) return null;
  return (
    <section className="rounded-2xl border border-brand-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wider text-brand-600">Knowledge check · practice</p>
      {s(c.question) && (
        <>
          <p className="mt-1.5 font-semibold text-ink-900">{s(c.question)}</p>
          <div className="mt-3 space-y-2" role="radiogroup" aria-label={s(c.question)}>
            {options.map((o, i) => {
              const state = picked == null ? 'idle' : i === answer ? 'right' : i === picked ? 'wrong' : 'idle';
              return (
                <button key={i} role="radio" aria-checked={picked === i} disabled={picked != null} onClick={() => setPicked(i)}
                  className={cn('flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-[0.95rem] transition',
                    state === 'right' ? 'border-growth-500 bg-growth-50' : state === 'wrong' ? 'border-red-300 bg-red-50' : 'border-ink-200 hover:border-brand-300 hover:bg-brand-50/50')}>
                  {o}
                  {state === 'right' && <CheckCircle2 className="h-5 w-5 shrink-0 text-growth-600" />}
                  {state === 'wrong' && <XCircle className="h-5 w-5 shrink-0 text-red-500" />}
                </button>
              );
            })}
          </div>
          {picked != null && (
            <div role="status" className="mt-3 text-sm">
              <p className={cn('font-semibold', picked === answer ? 'text-growth-700' : 'text-red-700')}>{picked === answer ? 'Correct — well done!' : 'Not quite.'}</p>
              {s(c.explanation) && <p className="mt-1 text-ink-600">{s(c.explanation)}</p>}
              {picked !== answer && <button className="mt-2 text-sm font-semibold text-brand-700 underline" onClick={() => setPicked(null)}>Try again</button>}
            </div>
          )}
        </>
      )}
      {s(c.assessment_id) && <Link to={`/learn/assessments/${s(c.assessment_id)}`} className="mt-4 inline-flex text-sm font-semibold text-brand-700 underline">Take the graded quiz for this lesson →</Link>}
    </section>
  );
}
