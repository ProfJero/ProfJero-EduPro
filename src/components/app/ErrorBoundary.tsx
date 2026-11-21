import { Component, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { supabase } from '@/lib/supabase';

let sent = 0;
/** Sends a de-duplicated crash report to the owner console (max 5 per page load). */
export function reportError(err: unknown, path = typeof location !== 'undefined' ? location.pathname : '') {
  if (sent >= 5) return;
  sent++;
  const e = err instanceof Error ? err : new Error(String(err));
  void supabase.rpc('report_client_error', { p_message: `${e.name}: ${e.message}`.slice(0, 500), p_stack: (e.stack ?? '').slice(0, 4000), p_path: path.slice(0, 300), p_release: import.meta.env.VITE_RELEASE ?? null });
}
if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => { if (e.error) reportError(e.error); });
  window.addEventListener('unhandledrejection', (e) => { const r = e.reason as unknown; if (r instanceof Error && !/Failed to fetch|NetworkError|AbortError|Load failed/i.test(r.message)) reportError(r); });
}

/** Catches render errors so one broken page never blanks the whole app. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) { reportError(error); }
  componentDidUpdate(prev: { resetKey?: string }) { if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null }); }
  render() {
    if (!this.state.error) return this.props.children;
    const chunk = /Loading chunk|dynamically imported module|Importing a module script failed/i.test(this.state.error.message);
    return (
      <div role="alert" className="mx-auto my-10 max-w-md rounded-3xl border border-ink-200 bg-surface p-6 text-center shadow-[var(--shadow-card)]">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-sun-50 text-sun-700"><AlertTriangle className="h-7 w-7" /></span>
        <h2 className="mt-4 text-xl font-extrabold">{chunk ? 'A new version is ready' : 'This page hit a snag'}</h2>
        <p className="mt-1 text-ink-600">{chunk ? 'Reload to get the latest ProfJero Edu.' : 'The problem was reported automatically. Try again — the rest of the app still works.'}</p>
        <div className="mt-5 flex justify-center gap-2">
          <button onClick={() => (chunk ? location.reload() : this.setState({ error: null }))} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 font-semibold text-white hover:bg-brand-500"><RotateCcw className="h-4 w-4" />{chunk ? 'Reload' : 'Try again'}</button>
          <a href="/dashboard" className="rounded-xl border border-ink-200 px-4 py-2 font-semibold text-ink-700 hover:bg-ink-50">Go home</a>
        </div>
      </div>
    );
  }
}
