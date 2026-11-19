import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BadgeCheck, ShieldX, Search } from 'lucide-react';
import { Alert, Button, Input, LoadingBlock } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { fmtDate } from '@/lib/dates';

type Cert = { serial: string; learner_name: string; course_title: string; issuer_name: string; completed_on: string; issued_at: string; status: string; course_slug: string };

export function Verify() {
  const { serial } = useParams();
  const nav = useNavigate();
  const [value, setValue] = useState(serial ?? '');
  const { data, isLoading } = useQuery({
    queryKey: ['verify', serial],
    enabled: Boolean(serial),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('verify_certificate', { p_serial: serial! });
      if (error) throw error;
      return data as Cert | null;
    },
  });
  return (
    <div className="container-page max-w-2xl py-14">
      <h1 className="text-3xl font-extrabold">Verify a certificate</h1>
      <p className="mt-2 text-ink-600">Enter the certificate reference printed on a ProfJero Edu certificate (for example <code className="rounded bg-ink-100 px-1">PJE-2026-1A2B3C4D5E</code>).</p>
      <form className="mt-6 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (value.trim()) nav(`/verify/${encodeURIComponent(value.trim().toUpperCase())}`); }}>
        <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Certificate reference" aria-label="Certificate reference" />
        <Button type="submit" leftIcon={<Search className="h-4 w-4" />}>Verify</Button>
      </form>
      <div className="mt-8">
        {isLoading && <LoadingBlock rows={2} />}
        {serial && !isLoading && !data && <Alert tone="error" title="No certificate found">We could not find a certificate with reference {serial}. Check the reference and try again.</Alert>}
        {data && (
          <div className={`card p-6 ${data.status === 'valid' ? 'ring-2 ring-growth-500/40' : 'ring-2 ring-red-300'}`}>
            <div className="flex items-center gap-3">
              {data.status === 'valid' ? <BadgeCheck className="h-8 w-8 text-growth-600" /> : <ShieldX className="h-8 w-8 text-red-600" />}
              <div><p className="text-lg font-extrabold">{data.status === 'valid' ? 'Valid certificate' : 'This certificate has been revoked'}</p><p className="text-sm text-ink-500">Reference {data.serial}</p></div>
            </div>
            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              <div><dt className="text-xs font-semibold uppercase text-ink-400">Awarded to</dt><dd className="font-bold text-ink-900">{data.learner_name}</dd></div>
              <div><dt className="text-xs font-semibold uppercase text-ink-400">Course</dt><dd className="font-bold text-ink-900"><Link to={`/courses/${data.course_slug}`} className="hover:underline">{data.course_title}</Link></dd></div>
              <div><dt className="text-xs font-semibold uppercase text-ink-400">Issued by</dt><dd>{data.issuer_name}</dd></div>
              <div><dt className="text-xs font-semibold uppercase text-ink-400">Completed on</dt><dd>{fmtDate(data.completed_on)}</dd></div>
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}
