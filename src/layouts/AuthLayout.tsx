import { Outlet } from 'react-router-dom';
import { Logo } from '@/components/brand/Logo';
import { CheckCircle2 } from 'lucide-react';

export function AuthLayout() {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.05fr]">
      <a href="#main" className="skip-link">Skip to content</a>
      <aside className="relative hidden overflow-hidden bg-ink-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand-600/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-growth-500/20 blur-3xl" />
        <Logo light />
        <div className="relative">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-growth-500">Unveiling the Extraordinary</p>
          <h2 className="mt-3 max-w-md text-4xl font-extrabold leading-tight text-white">Your classroom, wherever you are.</h2>
          <ul className="mt-8 space-y-3 text-ink-200">
            {['Structured courses with practical, hands-on lessons', 'Live classes, class discussions and real teacher feedback', 'Track progress and earn verifiable certificates'].map((t) => (
              <li key={t} className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-growth-500" />{t}</li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-ink-400">ProfJero Edu is a product of ProfJero Digital Studio.</p>
      </aside>
      <main id="main" className="flex flex-col bg-white">
        <div className="p-5 lg:hidden"><Logo /></div>
        <div className="flex flex-1 items-center justify-center px-5 py-10">
          <div className="w-full max-w-md"><Outlet /></div>
        </div>
      </main>
    </div>
  );
}
