import { forwardRef, useCallback, useMemo, useRef, useState, type KeyboardEvent, type TextareaHTMLAttributes } from 'react';
import { AtSign } from 'lucide-react';
import { Avatar, Textarea } from '@/components/ui';
import { cn } from '@/lib/utils';

export type Mentionable = { user_id: string; name: string; avatar_url?: string | null };

const TOKEN = /@\[([^\]]{1,80})\]\(([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)/g;
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Converts "@Ama Mensah" (picked from the list) into the stored token @[Ama Mensah](uuid). */
export function encodeMentions(text: string, picked: Map<string, string>) {
  let out = text;
  [...picked.entries()].sort((a, b) => b[0].length - a[0].length).forEach(([name, id]) => {
    out = out.replace(new RegExp(`(^|[^\\[])@${esc(name)}(?![\\w\\]])`, 'g'), `$1@[${name.replace(/[[\]]/g, '')}](${id})`);
  });
  return out;
}
/** Readable text: @[Name](id) → @Name */
export function plainMentions(text: string) {
  return text.replace(TOKEN, '@$1');
}

/** Message text with highlighted @mentions and clickable links. */
export function RichText({ text, me, className }: { text: string; me?: string; className?: string }) {
  const parts = useMemo(() => {
    const out: { t: 'text' | 'mention' | 'link'; v: string; id?: string }[] = [];
    const re = new RegExp(`${TOKEN.source}|(https?:\\/\\/[^\\s<]+[^\\s<.,;:!?)\\]'"])`, 'g');
    let last = 0;
    for (const m of text.matchAll(re)) {
      if (m.index! > last) out.push({ t: 'text', v: text.slice(last, m.index) });
      if (m[1]) out.push({ t: 'mention', v: m[1], id: m[2] }); else out.push({ t: 'link', v: m[3] });
      last = m.index! + m[0].length;
    }
    if (last < text.length) out.push({ t: 'text', v: text.slice(last) });
    return out;
  }, [text]);
  return (
    <p className={cn('whitespace-pre-wrap break-words', className)}>
      {parts.map((p, i) => p.t === 'mention'
        ? <span key={i} className={cn('rounded-md px-1 font-semibold', p.id === me ? 'bg-sun-100 text-sun-800' : 'bg-brand-50 text-brand-700')}>@{p.v}</span>
        : p.t === 'link' ? <a key={i} href={p.v} target="_blank" rel="noopener noreferrer nofollow" className="font-medium text-brand-700 underline">{p.v}</a>
        : <span key={i}>{p.v}</span>)}
    </p>
  );
}

/** State for a text box that supports @mentions. */
export function useMentionInput(initial = '') {
  const [value, setValue] = useState(initial);
  const picked = useRef(new Map<string, string>());
  const encoded = useCallback(() => encodeMentions(value, picked.current), [value]);
  const reset = useCallback(() => { setValue(''); picked.current = new Map(); }, []);
  const onPick = useCallback((m: Mentionable) => { picked.current.set(m.name, m.user_id); }, []);
  return { value, setValue, encoded, reset, onPick };
}

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & {
  value: string; onValueChange: (v: string) => void; members: Mentionable[]; onPick: (m: Mentionable) => void; me?: string;
};

/** Textarea with an @-mention picker (keyboard and touch friendly). */
export const MentionTextarea = forwardRef<HTMLTextAreaElement, Props>(function MentionTextarea({ value, onValueChange, members, onPick, me, onKeyDown, className, ...rest }, fwd) {
  const local = useRef<HTMLTextAreaElement | null>(null);
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const options = useMemo(() => {
    if (query == null) return [];
    const q = query.toLowerCase();
    return members.filter((m) => m.user_id !== me && m.name.toLowerCase().includes(q)).sort((a, b) => Number(!a.name.toLowerCase().startsWith(q)) - Number(!b.name.toLowerCase().startsWith(q))).slice(0, 6);
  }, [members, query, me]);

  const detect = (el: HTMLTextAreaElement) => {
    const before = el.value.slice(0, el.selectionStart ?? el.value.length);
    const m = before.match(/(?:^|\s)@([\p{L}\p{N}_.'-]*(?: [\p{L}\p{N}_.'-]*){0,2})$/u);
    setQuery(m ? m[1] : null);
    setActive(0);
  };
  const pick = (m: Mentionable) => {
    const el = local.current;
    if (!el) return;
    const caret = el.selectionStart ?? value.length;
    const before = value.slice(0, caret).replace(/@([\p{L}\p{N}_.'-]*(?: [\p{L}\p{N}_.'-]*){0,2})$/u, `@${m.name} `);
    const next = before + value.slice(caret);
    onValueChange(next);
    onPick(m);
    setQuery(null);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(before.length, before.length); });
  };
  const keys = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (options.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % options.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a - 1 + options.length) % options.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pick(options[active]); return; }
      if (e.key === 'Escape') { e.preventDefault(); setQuery(null); return; }
    }
    onKeyDown?.(e);
  };
  return (
    <div className="relative">
      <Textarea {...rest} ref={(el) => { local.current = el; if (typeof fwd === 'function') fwd(el); else if (fwd) fwd.current = el; }}
        value={value} className={className}
        onChange={(e) => { onValueChange(e.target.value); detect(e.target); }}
        onKeyDown={keys} onClick={(e) => detect(e.currentTarget)} onBlur={() => setTimeout(() => setQuery(null), 150)}
        aria-autocomplete="list" aria-expanded={options.length > 0} />
      {options.length > 0 && (
        <ul role="listbox" aria-label="Mention someone" className="absolute left-0 right-0 top-full z-30 mt-1 max-h-60 overflow-y-auto rounded-xl border border-ink-200 bg-surface p-1 shadow-lift">
          <li className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-ink-400"><AtSign className="h-3 w-3" />Mention someone — they’ll be notified</li>
          {options.map((m, i) => (
            <li key={m.user_id} role="option" aria-selected={i === active}>
              <button type="button" onMouseDown={(e) => { e.preventDefault(); pick(m); }} className={cn('flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm', i === active ? 'bg-brand-50 text-brand-800' : 'hover:bg-ink-50')}>
                <Avatar name={m.name} src={m.avatar_url} size={24} /><span className="truncate font-medium">{m.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});
