import { useState } from 'react';
import Papa from 'papaparse';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookMarked, CheckCircle2, ExternalLink, Upload } from 'lucide-react';
import { Alert, Badge, Button, Card, CardBody, CardHeader, Checkbox, Field, PageHeader, Select, Textarea, useToast } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { errorMessage, safeExternalUrl } from '@/lib/utils';

const KINDS = ['subject', 'strand', 'sub_strand', 'content_standard', 'indicator', 'exemplar', 'core_competency'];
const SAMPLE = `ref,parent_ref,kind,code,title,description,grade_level
s1,,strand,B7.1,Number,,Basic 7
s1.1,s1,sub_strand,B7.1.1,Number and Numeration Systems,,Basic 7`;

/** Import and approve curriculum frameworks so the AI Companion can ground answers in them. */
export function AdminCurriculum() {
  const qc = useQueryClient();
  const toast = useToast();
  const frameworks = useQuery({ queryKey: ['admin-frameworks'], queryFn: async () => unwrap(await supabase.from('curriculum_frameworks').select('id, code, name, authority, level_band, source_url, status').order('created_at')) });
  const [fw, setFw] = useState('');
  const counts = useQuery({
    queryKey: ['admin-fw-counts', fw], enabled: Boolean(fw),
    queryFn: async () => {
      const [all, approved] = await Promise.all([
        supabase.from('curriculum_items').select('id', { count: 'exact', head: true }).eq('framework_id', fw),
        supabase.from('curriculum_items').select('id', { count: 'exact', head: true }).eq('framework_id', fw).eq('status', 'approved'),
      ]);
      return { all: all.count ?? 0, approved: approved.count ?? 0 };
    },
  });
  const [csv, setCsv] = useState('');
  const [approve, setApprove] = useState(false);
  const parsed = csv.trim() ? Papa.parse<Record<string, string>>(csv.trim(), { header: true, skipEmptyLines: true }) : null;
  const rows = (parsed?.data ?? []).map((r): Record<string, string> => ({ ...r, kind: (r.kind ?? '').trim() })).filter((r) => r.title?.trim());
  const bad = rows.filter((r) => !KINDS.includes(r.kind));
  const importM = useMutation({
    mutationFn: async () => unwrap(await supabase.rpc('admin_import_curriculum', { p_framework: fw, p_items: rows as never, p_approve: approve })),
    onSuccess: (n) => { toast.success(`Imported ${n} items`); setCsv(''); void qc.invalidateQueries({ queryKey: ['admin-fw-counts'] }); },
    onError: (e) => toast.error('Import failed', errorMessage(e)),
  });
  const approveAll = useMutation({
    mutationFn: async () => {
      unwrap(await supabase.from('curriculum_items').update({ status: 'approved' }).eq('framework_id', fw).eq('status', 'draft'));
      unwrap(await supabase.from('curriculum_frameworks').update({ status: 'approved' }).eq('id', fw));
    },
    onSuccess: () => { toast.success('Framework approved', 'The AI Companion will now use it.'); void qc.invalidateQueries({ queryKey: ['admin-fw-counts'] }); void qc.invalidateQueries({ queryKey: ['admin-frameworks'] }); },
    onError: (e) => toast.error('Could not approve', errorMessage(e)),
  });
  const current = frameworks.data?.find((f) => f.id === fw);
  return (
    <div className="space-y-6">
      <PageHeader title="Curriculum" description="The AI Companion and Resource Studio prioritise approved curriculum items. Import strands, sub-strands, content standards and indicators from the official NaCCA/GES documents, review them, then approve." />
      <Alert tone="info" title="Use official sources only">Copy items exactly from the official curriculum published by NaCCA (nacca.gov.gh) or GES. Nothing here is generated — only items you import and approve are used to ground AI answers.</Alert>
      <Card><CardBody className="space-y-4">
        <Field label="Framework"><Select value={fw} onChange={(e) => setFw(e.target.value)}><option value="">Choose…</option>{frameworks.data?.map((f) => <option key={f.id} value={f.id}>{f.name} ({f.status})</option>)}</Select></Field>
        {current && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-ink-50 p-3 text-sm">
            <Badge tone={current.status === 'approved' ? 'green' : 'amber'}>{current.status}</Badge>
            <span>{current.authority} · {current.level_band}</span>
            <span className="font-semibold">{counts.data?.approved ?? 0} approved / {counts.data?.all ?? 0} items</span>
            {safeExternalUrl(current.source_url) && <a href={safeExternalUrl(current.source_url)!} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-brand-700">Source<ExternalLink className="h-3.5 w-3.5" /></a>}
            <Button size="sm" className="ml-auto" variant="secondary" leftIcon={<CheckCircle2 className="h-4 w-4" />} loading={approveAll.isPending} onClick={() => approveAll.mutate()}>Approve framework & all drafts</Button>
          </div>
        )}
      </CardBody></Card>
      {fw && (
        <Card>
          <CardHeader title={<span className="inline-flex items-center gap-2"><Upload className="h-5 w-5" />Import items (CSV)</span>} description="Columns: ref, parent_ref, kind, code, title, description, grade_level. Use ref/parent_ref to nest sub-strands under strands, and so on. Re-importing the same code updates it." />
          <CardBody className="space-y-3">
            <Textarea rows={10} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={SAMPLE} className="font-mono text-xs" aria-label="CSV data" />
            <input type="file" accept=".csv,text/csv" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setCsv(await f.text()); }} className="text-sm" aria-label="Upload CSV file" />
            {rows.length > 0 && <p className="text-sm">{rows.length} rows ready{bad.length ? <span className="text-red-700"> · {bad.length} with an invalid kind (use {KINDS.join(', ')})</span> : ''}.</p>}
            <Checkbox label="Approve immediately" description="Only tick this if you have checked the items against the official document." checked={approve} onChange={(e) => setApprove(e.target.checked)} />
            <Button leftIcon={<BookMarked className="h-4 w-4" />} disabled={!rows.length || bad.length > 0} loading={importM.isPending} onClick={() => importM.mutate()}>Import {rows.length || ''} items</Button>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
