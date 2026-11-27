import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Card, CardBody, CardHeader, Checkbox, Field, Input, LoadingBlock, useToast } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { cn, errorMessage } from '@/lib/utils';
import { FileUploadButton } from '@/features/media/FileUploadButton';
import { CertificateArt, TEMPLATE_SELECT, type CertTemplate } from './CertificateArt';

const KEYS = ['certificates.enabled', 'certificates.public_verification', 'certificates.issuer_name'] as const;
const STYLES: { v: NonNullable<CertTemplate['style']>; label: string; hint: string }[] = [
  { v: 'classic', label: 'Classic', hint: 'Bold coloured frame' }, { v: 'modern', label: 'Modern', hint: 'Side band and soft shapes' },
  { v: 'kente', label: 'Kente', hint: 'Ghana kente border' }, { v: 'minimal', label: 'Minimal', hint: 'Clean, lots of space' },
];

/** Owner console: certificate rules and the default certificate design. */
export function CertificateSettings() {
  const qc = useQueryClient();
  const toast = useToast();
  const settings = useQuery({ queryKey: ['cert-settings'], queryFn: async () => Object.fromEntries(unwrap(await supabase.from('platform_settings').select('key, value').in('key', KEYS as unknown as string[])).map((r) => [r.key, r.value])) as Record<string, unknown> });
  const template = useQuery({ queryKey: ['cert-default-template'], queryFn: async () => unwrap(await supabase.from('certificate_templates').select(TEMPLATE_SELECT).eq('is_default', true).maybeSingle()) as CertTemplate | null });
  const [rules, setRules] = useState({ enabled: true, verify: true, issuer: '' });
  const [t, setT] = useState<CertTemplate | null>(null);
  useEffect(() => { if (settings.data) setRules({ enabled: settings.data['certificates.enabled'] !== false, verify: settings.data['certificates.public_verification'] !== false, issuer: String(settings.data['certificates.issuer_name'] ?? '') }); }, [settings.data]);
  useEffect(() => { if (template.data !== undefined) setT(template.data ?? { accent_color: '#1554D6', signatory_name: null, signatory_title: null, footer_text: null, style: 'classic', title_text: 'Certificate of completion', intro_text: 'This certifies that', body_text: 'has successfully completed the course', name: 'ProfJero Edu default' }); }, [template.data]);
  const saveRules = useMutation({
    mutationFn: async () => unwrap(await supabase.from('platform_settings').upsert([
      { key: 'certificates.enabled', value: rules.enabled as never, is_public: true, description: 'Issue certificates automatically when learners complete a course' },
      { key: 'certificates.public_verification', value: rules.verify as never, is_public: true, description: 'Anyone with the reference can verify a certificate online' },
      { key: 'certificates.issuer_name', value: rules.issuer.trim() as never, is_public: true, description: 'Issuer shown on certificates from independent courses' },
    ])),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['cert-settings'] }); toast.success('Certificate rules saved'); },
    onError: (e) => toast.error('Not saved', errorMessage(e)),
  });
  const saveTemplate = useMutation({
    mutationFn: async () => {
      const row = { name: t!.name || 'ProfJero Edu default', accent_color: t!.accent_color, signatory_name: t!.signatory_name || null, signatory_title: t!.signatory_title || null, footer_text: t!.footer_text || null,
        style: t!.style ?? 'classic', title_text: t!.title_text || 'Certificate of completion', intro_text: t!.intro_text || 'This certifies that', body_text: t!.body_text || 'has successfully completed the course',
        logo_url: t!.logo_url || null, signature_url: t!.signature_url || null, seal_text: t!.seal_text || null, updated_at: new Date().toISOString() };
      return t!.id ? unwrap(await supabase.from('certificate_templates').update(row).eq('id', t!.id)) : unwrap(await supabase.from('certificate_templates').insert({ ...row, is_default: true }));
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['cert-default-template'] }); toast.success('Certificate design saved', 'All certificates use it, including ones already issued.'); },
    onError: (e) => toast.error('Not saved', errorMessage(e)),
  });
  if (settings.isLoading || !t) return <LoadingBlock />;
  const set = (p: Partial<CertTemplate>) => setT({ ...t, ...p });
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="Certificate rules" description="Courses still decide their own completion requirements (lessons and assessments)." />
        <CardBody className="space-y-4">
          <Checkbox label="Issue certificates automatically" description="When off, learners can still complete courses but no new certificates are created." checked={rules.enabled} onChange={(e) => setRules({ ...rules, enabled: e.target.checked })} />
          <Checkbox label="Public verification page" description="Employers and schools can check a certificate with its reference at /verify." checked={rules.verify} onChange={(e) => setRules({ ...rules, verify: e.target.checked })} />
          <Field label="Issuer name for independent courses" hint="Courses run by a school always show the school’s name."><Input value={rules.issuer} onChange={(e) => setRules({ ...rules, issuer: e.target.value })} maxLength={120} placeholder="ProfJero Edu · ProfJero Digital Studio" /></Field>
          <p className="text-sm text-ink-500">Certificates use each learner’s <b>official full name</b>. You can correct a name from the Issued tab.</p>
          <Button loading={saveRules.isPending} onClick={() => saveRules.mutate()}>Save rules</Button>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Certificate design" description="Changes apply to every certificate, including ones already issued." />
        <CardBody className="grid gap-6 xl:grid-cols-[22rem_1fr]">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Style">{STYLES.map((s) => (
              <button key={s.v} role="radio" aria-checked={(t.style ?? 'classic') === s.v} onClick={() => set({ style: s.v })} className={cn('rounded-xl border p-2.5 text-left text-sm', (t.style ?? 'classic') === s.v ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-200' : 'border-ink-200')}>
                <p className="font-bold">{s.label}</p><p className="text-xs text-ink-500">{s.hint}</p></button>
            ))}</div>
            <Field label="Colour"><div className="flex gap-2"><input type="color" value={t.accent_color} onChange={(e) => set({ accent_color: e.target.value.toUpperCase() })} className="h-11 w-14 cursor-pointer rounded-lg border border-ink-200" aria-label="Pick colour" /><Input value={t.accent_color} onChange={(e) => /^#[0-9a-f]{0,6}$/i.test(e.target.value) && set({ accent_color: e.target.value.toUpperCase() })} className="font-mono" /></div></Field>
            <Field label="Heading"><Input value={t.title_text ?? ''} onChange={(e) => set({ title_text: e.target.value })} maxLength={80} /></Field>
            <div className="grid grid-cols-2 gap-2"><Field label="Before the name"><Input value={t.intro_text ?? ''} onChange={(e) => set({ intro_text: e.target.value })} maxLength={120} /></Field>
              <Field label="After the name"><Input value={t.body_text ?? ''} onChange={(e) => set({ body_text: e.target.value })} maxLength={200} /></Field></div>
            <div className="grid grid-cols-2 gap-2"><Field label="Signed by"><Input value={t.signatory_name ?? ''} onChange={(e) => set({ signatory_name: e.target.value })} maxLength={80} placeholder="Name" /></Field>
              <Field label="Their title"><Input value={t.signatory_title ?? ''} onChange={(e) => set({ signatory_title: e.target.value })} maxLength={80} placeholder="Programme Director" /></Field></div>
            <Field label="Seal text (optional)"><Input value={t.seal_text ?? ''} onChange={(e) => set({ seal_text: e.target.value })} maxLength={40} placeholder="Verified · ProfJero Edu" /></Field>
            <Field label="Footer note (optional)"><Input value={t.footer_text ?? ''} onChange={(e) => set({ footer_text: e.target.value })} maxLength={160} /></Field>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-ink-800">Signature and logo images</p>
              <div className="flex flex-wrap gap-2">
                <FileUploadButton purpose="avatar" accept="image/png,image/jpeg,image/webp" label={t.signature_url ? 'Replace signature' : 'Upload signature'} onUploaded={(u) => set({ signature_url: u.secure_url })} />
                <FileUploadButton purpose="avatar" accept="image/png,image/jpeg,image/webp,image/svg+xml" label={t.logo_url ? 'Replace logo' : 'Upload logo'} onUploaded={(u) => set({ logo_url: u.secure_url })} />
                {(t.signature_url || t.logo_url) && <Button size="sm" variant="ghost" onClick={() => set({ signature_url: null, logo_url: null })}>Remove images</Button>}
              </div>
              <p className="text-xs text-ink-500">Use a PNG with a transparent background for the signature. Uploads need Cloudinary to be connected in Integrations.</p>
            </div>
            <Button loading={saveTemplate.isPending} onClick={() => saveTemplate.mutate()} className="w-full">Save design</Button>
          </div>
          <div className="space-y-2"><p className="text-sm font-semibold text-ink-600">Preview</p>
            <div className="rounded-2xl bg-ink-100 p-3 sm:p-6"><CertificateArt t={t} learner="Kofi Mensah Appiah" course="SHS Core Mathematics — Algebra" issuer={rules.issuer || 'ProfJero Edu · ProfJero Digital Studio'} completed={new Date().toISOString()} serial="PJE-2026-1A2B3C4D5E" verifyUrl={`${location.origin}/verify/PJE-2026-…`} /></div>
            {!rules.enabled && <Alert tone="warning">Automatic certificates are switched off.</Alert>}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
