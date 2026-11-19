import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Award, Copy, ExternalLink, Printer } from 'lucide-react';
import { Badge, Button, ButtonLink, EmptyState, LoadingBlock, PageHeader, useToast } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { fmtDate } from '@/lib/dates';
import { useAuth } from '@/features/authentication/AuthProvider';

type Cert = { id: string; serial: string; learner_name: string; course_title: string; issuer_name: string; completed_on: string; issued_at: string; status: string; template: { accent_color: string; signatory_name: string | null; signatory_title: string | null; footer_text: string | null } | null };
const SELECT = 'id, serial, learner_name, course_title, issuer_name, completed_on, issued_at, status, template:certificate_templates(accent_color, signatory_name, signatory_title, footer_text)';

export function CertificatesPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { data, isLoading } = useQuery({
    queryKey: ['certificates', user?.id], enabled: Boolean(user),
    queryFn: async () => unwrap(await supabase.from('certificates').select(SELECT).eq('user_id', user!.id).order('issued_at', { ascending: false })) as unknown as Cert[],
  });
  if (isLoading) return <LoadingBlock />;
  return (
    <div>
      <PageHeader title="Certificates" description="Certificates are issued automatically when you meet a course's completion requirements. Anyone can verify them online." />
      {data?.length ? (
        <div className="grid gap-5 md:grid-cols-2">
          {data.map((c) => (
            <article key={c.id} className="card overflow-hidden">
              <div className="flex items-center gap-4 border-b-4 p-5" style={{ borderColor: c.template?.accent_color ?? '#1554D6' }}>
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sun-50 text-sun-500"><Award className="h-6 w-6" /></span>
                <div className="min-w-0"><h2 className="truncate font-extrabold">{c.course_title}</h2><p className="text-sm text-ink-500">Completed {fmtDate(c.completed_on)} · {c.issuer_name}</p></div>
                {c.status !== 'valid' && <Badge tone="red" className="ml-auto">Revoked</Badge>}
              </div>
              <div className="flex flex-wrap items-center gap-2 p-4">
                <code className="rounded bg-ink-100 px-2 py-1 text-xs">{c.serial}</code>
                <Button size="sm" variant="ghost" leftIcon={<Copy className="h-3.5 w-3.5" />} onClick={() => { void navigator.clipboard?.writeText(`${location.origin}/verify/${c.serial}`); toast.success('Verification link copied'); }}>Copy link</Button>
                <ButtonLink size="sm" variant="ghost" to={`/verify/${c.serial}`} leftIcon={<ExternalLink className="h-3.5 w-3.5" />}>Verify</ButtonLink>
                <ButtonLink size="sm" to={`/certificates/${c.serial}/print`} leftIcon={<Printer className="h-3.5 w-3.5" />} className="ml-auto">View & print</ButtonLink>
              </div>
            </article>
          ))}
        </div>
      ) : <EmptyState icon={<Award className="h-7 w-7" />} title="No certificates yet" description="Complete a course to earn your first certificate." action={<ButtonLink to="/learn/courses">Continue learning</ButtonLink>} />}
    </div>
  );
}

/** Printable certificate (A4 landscape). */
export function CertificateView() {
  const { serial } = useParams();
  const { data: c, isLoading } = useQuery({
    queryKey: ['certificate', serial],
    queryFn: async () => unwrap(await supabase.from('certificates').select(SELECT).eq('serial', serial!).maybeSingle()) as unknown as Cert | null,
  });
  if (isLoading) return <LoadingBlock />;
  if (!c) return <div className="p-10"><EmptyState title="Certificate not found" action={<ButtonLink to="/learn/certificates">My certificates</ButtonLink>} /></div>;
  const accent = c.template?.accent_color ?? '#1554D6';
  const verifyUrl = `${location.origin}/verify/${c.serial}`;
  return (
    <div className="min-h-screen bg-ink-100 py-6 print:bg-white print:py-0">
      <style>{`@page { size: A4 landscape; margin: 0 } @media print { .no-print { display: none !important } }`}</style>
      <div className="no-print mx-auto mb-4 flex max-w-[297mm] justify-between px-4">
        <Link to="/learn/certificates" className="text-sm font-semibold text-ink-600">← Back</Link>
        <Button onClick={() => window.print()} leftIcon={<Printer className="h-4 w-4" />}>Print / save as PDF</Button>
      </div>
      <div className="mx-auto aspect-[297/210] w-full max-w-[297mm] bg-white p-[5%] shadow-xl print:shadow-none" style={{ border: `10px solid ${accent}` }}>
        <div className="flex h-full flex-col items-center justify-between border-2 border-ink-200 p-[4%] text-center">
          <div className="flex items-center gap-3"><img src="/brand/profjero-mark.webp" alt="" className="h-12 w-12" /><span className="text-xl font-extrabold text-ink-900">Prof<span style={{ color: accent }}>Jero</span> Edu</span></div>
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.35em] text-ink-500">Certificate of completion</p>
            <p className="mt-6 text-base text-ink-600">This certifies that</p>
            <p className="mt-2 text-4xl font-extrabold text-ink-900 sm:text-5xl">{c.learner_name}</p>
            <p className="mt-5 text-base text-ink-600">has successfully completed the course</p>
            <p className="mt-2 text-2xl font-bold" style={{ color: accent }}>{c.course_title}</p>
            <p className="mt-4 text-sm text-ink-600">on {fmtDate(c.completed_on, 'd MMMM yyyy')}</p>
          </div>
          <div className="grid w-full grid-cols-2 items-end gap-6 text-left text-xs text-ink-600">
            <div><p className="border-t border-ink-300 pt-2 font-semibold text-ink-900">{c.issuer_name}</p>{c.template?.signatory_name && <p>{c.template.signatory_name}</p>}{c.template?.signatory_title && <p>{c.template.signatory_title}</p>}</div>
            <div className="text-right"><p>Certificate reference <strong className="text-ink-900">{c.serial}</strong></p><p>Verify at {verifyUrl}</p>{c.status !== 'valid' && <p className="font-bold text-red-600">REVOKED</p>}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
