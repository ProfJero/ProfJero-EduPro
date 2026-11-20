import { useNavigate } from 'react-router-dom';
import { Code2, FlaskConical, Sigma } from 'lucide-react';
import { Button } from '@/components/ui';
import { LAB_TOOLS } from './catalog';

/** Lesson block that launches a lab activity (Code, Science or Math Lab). */
export function LabBlock({ c }: { c: Record<string, unknown> }) {
  const nav = useNavigate();
  const lab = (c.lab as string) || 'code';
  const tool = (c.tool as string) || 'python';
  const meta = LAB_TOOLS.find((t) => t.id === tool);
  const Icon = lab === 'code' ? Code2 : lab === 'science' ? FlaskConical : Sigma;
  const open = () => {
    if (lab === 'code') {
      try {
        if (c.starter) sessionStorage.setItem('pje:lab-prefill', JSON.stringify({ lang: tool, code: c.starter }));
      } catch { /* ignore */ }
      nav(`/lab/code?lang=${tool}${c.starter ? '&from=lesson' : ''}`);
    } else nav(`/lab/${lab}/${tool}`);
  };
  return (
    <section className="rounded-2xl border-2 border-teal-500/30 bg-teal-50/60 p-5 dark:bg-teal-100/40">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-700"><Icon className="h-4 w-4" />EduLab · {meta?.name ?? tool}</p>
      <h3 className="mt-1 text-lg font-bold text-ink-900">{(c.title as string) || 'Try it in the lab'}</h3>
      {Boolean(c.instructions) && <p className="mt-1 whitespace-pre-wrap text-ink-700">{c.instructions as string}</p>}
      <Button className="mt-3" onClick={open} leftIcon={<Icon className="h-4 w-4" />}>Open in {lab === 'code' ? 'Code Lab' : lab === 'science' ? 'Science Lab' : 'Math Lab'}</Button>
    </section>
  );
}
