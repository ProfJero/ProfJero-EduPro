import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Award, Calculator, Check, Code2, Flame, Keyboard, Lock, Puzzle, Sparkles, Trophy, Zap } from 'lucide-react';
import { Avatar, Badge, Card, CardBody, EmptyState, ErrorState, LoadingBlock, PageHeader, Select, StatCard } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { cn } from '@/lib/utils';

export const GAME_META: Record<string, { name: string; icon: typeof Zap; color: string; blurb: string }> = {
  math_sprint: { name: 'Math Sprint', icon: Calculator, color: 'from-brand-600 to-brand-deep', blurb: 'Quick-fire arithmetic against the clock.' },
  quiz_rush: { name: 'Quiz Rush', icon: Zap, color: 'from-violet-600 to-deep-indigo', blurb: 'Answer subject questions before time runs out.' },
  word_builder: { name: 'Word Builder', icon: Puzzle, color: 'from-growth-600 to-deep-teal', blurb: 'Unscramble the letters using the clue.' },
  typing_race: { name: 'Typing Race', icon: Keyboard, color: 'from-sun-500 to-deep-orange', blurb: 'Type the passage fast and accurately.' },
  code_quest: { name: 'Code Quest', icon: Code2, color: 'from-teal-600 to-ink-950', blurb: 'Write a function that passes all the tests.' },
};

export type Summary = {
  progress: { xp: number; level: number; current_streak: number; longest_streak: number } | null;
  badges: { code: string; name: string; description: string; icon: string; tier: string; awarded_at: string }[];
  best: Record<string, { score: number; max: number; cleared: boolean }>;
  global_rank: number | null;
};

export function useArenaSummary() {
  return useQuery({ queryKey: ['arena-summary'], queryFn: async () => unwrap(await supabase.rpc('my_arena_summary')) as unknown as Summary });
}

export function ArenaHome() {
  const summary = useArenaSummary();
  const challenges = useQuery({
    queryKey: ['arena-challenges'],
    queryFn: async () => unwrap(await supabase.from('arena_challenges').select('id, slug, game, track, title, description, subject, level, difficulty, time_limit_seconds, xp_reward').eq('status', 'published').order('track').order('level')),
  });
  const [period, setPeriod] = useState('week');
  const board = useQuery({ queryKey: ['arena-board', period], queryFn: async () => unwrap(await supabase.rpc('arena_leaderboard', { p_period: period, p_limit: 10 })) });
  if (challenges.isLoading) return <LoadingBlock />;
  if (challenges.error) return <ErrorState error={challenges.error} onRetry={() => challenges.refetch()} />;
  const s = summary.data;
  const tracks = new Map<string, NonNullable<typeof challenges.data>>();
  for (const c of challenges.data ?? []) tracks.set(c.track, [...(tracks.get(c.track) ?? []), c]);
  const isUnlocked = (list: NonNullable<typeof challenges.data>, idx: number) => idx === 0 || Boolean(s?.best[list[idx - 1].id]?.cleared);
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Challenge Arena" title="Learn, play and level up" description="Optional learning games in levels. Score 60% or more to unlock the next level. Your XP counts towards the leaderboard — you can hide your name in Settings." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Level" value={s?.progress?.level ?? 1} icon={<Sparkles className="h-5 w-5" />} hint={`${s?.progress?.xp ?? 0} XP`} />
        <StatCard label="Streak" value={`${s?.progress?.current_streak ?? 0} days`} icon={<Flame className="h-5 w-5" />} tone="amber" hint={`Best ${s?.progress?.longest_streak ?? 0}`} />
        <StatCard label="Badges" value={s?.badges.length ?? 0} icon={<Award className="h-5 w-5" />} tone="violet" />
        <StatCard label="Global rank" value={s?.global_rank ? `#${s.global_rank}` : '—'} icon={<Trophy className="h-5 w-5" />} tone="green" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          {[...tracks.entries()].map(([track, list]) => {
            const meta = GAME_META[list[0].game];
            const cleared = list.filter((c) => s?.best[c.id]?.cleared).length;
            return (
              <section key={track} className="card overflow-hidden">
                <div className={cn('flex items-center gap-4 bg-gradient-to-r p-4 text-white', meta.color)}>
                  <meta.icon className="h-8 w-8 shrink-0" />
                  <div className="min-w-0 flex-1"><h2 className="font-extrabold">{list[0].title.split('·')[0].trim()}</h2><p className="text-sm text-white/80">{meta.blurb}</p></div>
                  <span className="rounded-full bg-white/20 px-3 py-1 text-sm font-bold">{cleared}/{list.length}</span>
                </div>
                <div className="scrollbar-thin flex gap-2 overflow-x-auto p-4">
                  {list.map((c, i) => {
                    const open = isUnlocked(list, i);
                    const best = s?.best[c.id];
                    return open ? (
                      <Link key={c.id} to={`/arena/play/${c.slug}`} title={c.description}
                        className={cn('grid h-16 w-16 shrink-0 place-items-center rounded-2xl border-2 text-lg font-extrabold transition hover:-translate-y-0.5', best?.cleared ? 'border-growth-500 bg-growth-50 text-growth-700' : 'border-brand-400 bg-brand-50 text-brand-700')}>
                        <span className="text-center leading-none">{c.level}{best?.cleared ? <Check className="mx-auto mt-0.5 h-3.5 w-3.5" /> : <span className="block text-[0.6rem] font-semibold">{c.xp_reward} XP</span>}</span>
                      </Link>
                    ) : (
                      <span key={c.id} className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border-2 border-dashed border-ink-200 text-ink-300" title="Clear the previous level to unlock"><Lock className="h-5 w-5" /></span>
                    );
                  })}
                </div>
              </section>
            );
          })}
          {!tracks.size && <EmptyState icon={<Trophy className="h-8 w-8" />} title="No challenges yet" description="An administrator can publish challenges from Admin → Arena." />}
        </div>
        <aside className="space-y-6">
          <Card><CardBody>
            <div className="flex items-center justify-between"><h2 className="font-bold">Leaderboard</h2><Select value={period} onChange={(e) => setPeriod(e.target.value)} className="w-auto py-1 text-sm" aria-label="Period"><option value="week">This week</option><option value="month">This month</option><option value="all">All time</option></Select></div>
            <ol className="mt-3 space-y-1.5">
              {(board.data ?? []).map((r) => (
                <li key={`${r.rank}-${r.name}`} className={cn('flex items-center gap-3 rounded-xl px-2 py-1.5', r.is_me && 'bg-brand-50 ring-1 ring-brand-200')}>
                  <span className={cn('w-6 text-center text-sm font-extrabold', r.rank === 1 ? 'text-sun-500' : r.rank <= 3 ? 'text-ink-500' : 'text-ink-400')}>{r.rank}</span>
                  <Avatar name={r.name} src={r.avatar_url} size={28} />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{r.name}{r.is_me && ' (you)'}</span>
                  <span className="text-sm font-bold tabular-nums">{Math.round(Number(r.score))} XP</span>
                </li>
              ))}
              {!board.data?.length && <p className="text-sm text-ink-500">Be the first on the board this {period === 'all' ? 'season' : period}!</p>}
            </ol>
          </CardBody></Card>
          <Card><CardBody>
            <h2 className="font-bold">Your badges</h2>
            {s?.badges.length ? (
              <div className="mt-3 flex flex-wrap gap-2">{s.badges.map((b) => <Badge key={b.code} tone={b.tier === 'gold' ? 'amber' : b.tier === 'silver' ? 'neutral' : 'brand'} icon={<Award className="h-3.5 w-3.5" />}><span title={b.description}>{b.name}</span></Badge>)}</div>
            ) : <p className="mt-2 text-sm text-ink-500">Complete challenges, keep a streak and help classmates to earn badges.</p>}
          </CardBody></Card>
        </aside>
      </div>
    </div>
  );
}
