import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, KeyRound, Presentation, ShieldCheck, UserRound, Users } from 'lucide-react';
import { Alert, Button, ButtonLink, Card, CardBody, Field, Input, Spinner } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { errorMessage } from '@/lib/utils';
import { useAuth } from '@/features/authentication/AuthProvider';

type Preview = { class_id: string; name: string; stream: string | null; subject: string | null; description: string | null; color: string; teacher: string; school: string | null; allow_guests: boolean; requires_approval: boolean; join_enabled: boolean; members: number };

/** Public page: join a teacher's class with a code or invite link (/join/ABC1234). */
export function JoinClassPage() {
  const params = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { session, profile, refresh } = useAuth();
  const [code, setCode] = useState(params.code?.toUpperCase() ?? '');
  const [submitted, setSubmitted] = useState(params.code?.toUpperCase() ?? '');
  const [guestName, setGuestName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const preview = useQuery({
    queryKey: ['class-preview', submitted], enabled: submitted.length >= 6, retry: false,
    queryFn: async () => (unwrap(await supabase.rpc('class_preview', { p_code: submitted })) as unknown as Preview | null),
  });
  const join = useMutation({
    mutationFn: async () => unwrap(await supabase.rpc('join_class_by_code', { p_code: submitted })) as unknown as { class_id: string; status: string },
    onSuccess: async (r) => {
      await Promise.all([refresh(), qc.invalidateQueries({ queryKey: ['my-classes'] })]);
      if (r.status === 'active') nav(`/learn/classes/${r.class_id}`, { replace: true });
    },
    onError: (e) => setErr(errorMessage(e)),
  });
  const guest = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signInAnonymously({ options: { data: { full_name: guestName.trim() } } });
      if (error) throw error;
    },
    onSuccess: () => join.mutate(),
    onError: (e) => setErr(/anonymous/i.test(errorMessage(e)) ? 'Guest joining is not available right now. Please create a free account.' : errorMessage(e)),
  });
  useEffect(() => { setErr(null); }, [submitted]);
  const p = preview.data;
  const next = encodeURIComponent(`/join/${submitted}`);
  return (
    <div className="flex flex-col items-center px-4 py-12">
      <Card className="w-full max-w-lg"><CardBody className="space-y-5 p-6 sm:p-8">
        {!p ? (
          <>
            <div className="text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600"><KeyRound className="h-7 w-7" /></span>
              <h1 className="mt-3 text-2xl font-extrabold">Join a class</h1><p className="mt-1 text-ink-500">Enter the class code your teacher gave you.</p></div>
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setSubmitted(code.trim().toUpperCase()); }}>
              <Input value={code} onChange={(e) => setCode(e.target.value.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 10))} placeholder="ABC1234" aria-label="Class code" className="text-center font-mono text-xl font-bold tracking-[0.3em]" autoFocus />
              <Button type="submit" disabled={code.trim().length < 6} loading={preview.isFetching}>Find</Button>
            </form>
            {submitted && !preview.isFetching && preview.isFetched && !p && <Alert tone="error">No class found for <b>{submitted}</b>. Check the code with your teacher.</Alert>}
          </>
        ) : (
          <>
            <div className="board-surface -mx-6 -mt-6 rounded-t-2xl p-6 text-white sm:-mx-8 sm:-mt-8 sm:p-8">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-growth-100"><Presentation className="h-4 w-4" />You’re invited to</p>
              <h1 className="mt-2 text-2xl font-extrabold">{p.name}{p.stream ? ` · ${p.stream}` : ''}</h1>
              <p className="mt-1 text-white/80">{p.subject ? `${p.subject} · ` : ''}with {p.teacher}{p.school ? ` · ${p.school}` : ''}</p>
              <p className="mt-3 flex items-center gap-1.5 text-sm text-white/70"><Users className="h-4 w-4" />{p.members} member{p.members === 1 ? '' : 's'}</p>
            </div>
            {p.description && <p className="text-ink-600">{p.description}</p>}
            {err && <Alert tone="error">{err}</Alert>}
            {!p.join_enabled ? <Alert tone="warning">Joining with a code is switched off for this class. Ask your teacher for an invitation.</Alert>
              : join.data?.status === 'pending' ? <Alert tone="success" title="Request sent">Your teacher will approve your request soon. You’ll get a notification.</Alert>
              : session ? (
                <div className="space-y-2">
                  <p className="text-sm text-ink-500">Signed in as <b>{profile?.full_name || 'you'}</b>{profile?.is_guest ? ' (guest)' : ''}.</p>
                  <Button size="lg" className="w-full" loading={join.isPending} onClick={() => join.mutate()} leftIcon={<ArrowRight className="h-5 w-5" />}>{p.requires_approval ? 'Ask to join' : 'Join class'}</Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <ButtonLink to={`/login?next=${next}`} variant="secondary">Log in</ButtonLink>
                    <ButtonLink to={`/register?next=${next}`}>Create free account</ButtonLink>
                  </div>
                  {p.allow_guests && (
                    <div className="rounded-2xl border border-ink-200 p-4">
                      <p className="flex items-center gap-2 font-semibold"><UserRound className="h-4 w-4 text-brand-600" />Or join as a guest — no account needed</p>
                      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (guestName.trim().length >= 2) guest.mutate(); }}>
                        <Field label="Your name" className="flex-1"><Input value={guestName} onChange={(e) => setGuestName(e.target.value)} maxLength={80} placeholder="First and last name" autoComplete="name" /></Field>
                        <Button type="submit" className="self-end" disabled={guestName.trim().length < 2} loading={guest.isPending || join.isPending}>Join</Button>
                      </form>
                      <p className="mt-2 text-xs text-ink-500">Guest progress is saved on this device. Add an email and password later in Settings to keep it for good.</p>
                    </div>
                  )}
                </div>
              )}
            <p className="flex items-center gap-1.5 text-xs text-ink-400"><ShieldCheck className="h-3.5 w-3.5" />Only class members can see the class discussion and materials.</p>
            <button className="text-sm font-semibold text-brand-700" onClick={() => { setSubmitted(''); setCode(''); }}>Use a different code</button>
          </>
        )}
        {preview.isLoading && submitted && <div className="flex justify-center"><Spinner /></div>}
      </CardBody></Card>
      <Link to="/" className="mt-6 text-sm text-ink-500 hover:text-ink-800">Back to ProfJero Edu</Link>
    </div>
  );
}
