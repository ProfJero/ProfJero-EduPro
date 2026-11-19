import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Card, CardBody, Field, Input, LoadingBlock, PageHeader, Select, Textarea, useToast } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { FileUploadButton } from '@/features/media/FileUploadButton';
import { TIMEZONES } from '@/features/profiles/geo';
import { useSchool } from './queries';

export function SchoolSettings() {
  const { schoolId } = useParams();
  const qc = useQueryClient();
  const toast = useToast();
  const { data, isLoading } = useSchool(schoolId);
  const [f, setF] = useState({ name: '', motto: '', region: '', city: '', address: '', contact_email: '', contact_phone: '', website: '', timezone: 'Africa/Accra', logo_url: '' });
  useEffect(() => { if (data) setF({ name: data.name, motto: data.motto ?? '', region: data.region ?? '', city: data.city ?? '', address: data.address ?? '', contact_email: data.contact_email, contact_phone: data.contact_phone ?? '', website: data.website ?? '', timezone: data.timezone, logo_url: data.logo_url ?? '' }); }, [data]);
  if (isLoading || !data) return <LoadingBlock />;
  const s = (k: keyof typeof f) => ({ value: f[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value }) });
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="School settings" description="Your institution's public profile and contact details." />
      <Card><CardBody className="space-y-5">
        <div className="flex items-center gap-4">{f.logo_url && <img src={f.logo_url} alt="" className="h-16 w-16 rounded-xl object-contain" />}<FileUploadButton purpose="avatar" label="Upload logo" onUploaded={(r) => setF({ ...f, logo_url: r.secure_url })} /></div>
        <Field label="School name"><Input {...s('name')} /></Field>
        <Field label="Motto"><Input {...s('motto')} /></Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Region"><Input {...s('region')} /></Field><Field label="City"><Input {...s('city')} /></Field>
          <Field label="Contact email"><Input type="email" {...s('contact_email')} /></Field><Field label="Phone"><Input {...s('contact_phone')} /></Field>
          <Field label="Website"><Input {...s('website')} placeholder="https://" /></Field>
          <Field label="Time zone"><Select value={f.timezone} onChange={(e) => setF({ ...f, timezone: e.target.value })}>{TIMEZONES.map((t) => <option key={t}>{t}</option>)}</Select></Field>
        </div>
        <Field label="Address"><Textarea rows={2} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>
        <Button onClick={async () => {
          const { error } = await supabase.from('schools').update({ ...f, motto: f.motto || null, region: f.region || null, city: f.city || null, address: f.address || null, contact_phone: f.contact_phone || null, website: f.website || null, logo_url: f.logo_url || null }).eq('id', schoolId!);
          if (error) toast.error('Could not save', error.message); else { toast.success('School profile saved'); void qc.invalidateQueries({ queryKey: ['school', schoolId] }); }
        }}>Save</Button>
      </CardBody></Card>
    </div>
  );
}
