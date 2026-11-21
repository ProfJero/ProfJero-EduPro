import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { LifeBuoy, Mail } from 'lucide-react';
import { Alert, Button, ButtonLink, Field, Input, Select, Textarea } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/authentication/AuthProvider';

const schema = z.object({
  name: z.string().trim().min(2, 'Enter your name').max(120),
  email: z.string().trim().email('Enter a valid email address'),
  topic: z.enum(['general', 'schools', 'educators', 'partnership', 'press', 'other']),
  message: z.string().trim().min(10, 'Tell us a little more (at least 10 characters)').max(5000),
  website: z.string().max(0).optional(), // honeypot
});
type Form = z.infer<typeof schema>;

export function Contact() {
  const [params] = useSearchParams();
  const { session } = useAuth();
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const topic = (params.get('topic') ?? 'general') as Form['topic'];
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { topic, email: session?.user.email ?? '' } });
  const onSubmit = async (v: Form) => {
    setErr(null);
    if (v.website) return setSent(true);
    const { error } = await supabase.from('contact_messages').insert({ name: v.name, email: v.email, topic: v.topic, message: v.message });
    if (error) setErr(error.message); else setSent(true);
  };
  return (
    <div className="container-page grid gap-10 py-14 lg:grid-cols-[1fr_1.2fr]">
      <div>
        <h1 className="text-4xl font-extrabold">Contact & support</h1>
        <p className="mt-4 text-ink-600">Questions about ProfJero Edu, bringing your school on board, teaching with us or an EduPro pilot? Send us a message and the team will respond.</p>
        <div className="mt-8 space-y-4">
          <div className="card flex gap-4 p-5"><LifeBuoy className="h-6 w-6 shrink-0 text-brand-600" /><div><h2 className="font-bold">Already have an account?</h2><p className="mt-1 text-sm text-ink-600">Open a support ticket from your dashboard to track the conversation.</p><ButtonLink to="/support" variant="secondary" size="sm" className="mt-3">Open support</ButtonLink></div></div>
          <div className="card flex gap-4 p-5"><Mail className="h-6 w-6 shrink-0 text-growth-600" /><div><h2 className="font-bold">Schools & partnerships</h2><p className="mt-1 text-sm text-ink-600">Choose “Schools” or “Partnership” as the topic so the right person picks it up.</p></div></div>
        </div>
      </div>
      <div className="card p-6 sm:p-8">
        {sent ? (
          <Alert tone="success" title="Message received">Thank you — we have your message and will get back to you by email.</Alert>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            {err && <Alert tone="error">{err}</Alert>}
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Your name" required error={errors.name?.message}><Input autoComplete="name" {...register('name')} /></Field>
              <Field label="Email" required error={errors.email?.message}><Input type="email" autoComplete="email" {...register('email')} /></Field>
            </div>
            <Field label="Topic"><Select {...register('topic')}>
              <option value="general">General question</option><option value="schools">Schools</option><option value="educators">Teaching on ProfJero Edu</option>
              <option value="partnership">Partnership / EduPro pilot</option><option value="press">Press</option><option value="other">Other</option>
            </Select></Field>
            <Field label="Message" required error={errors.message?.message}><Textarea rows={6} {...register('message')} /></Field>
            <input type="text" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden {...register('website')} />
            <p className="text-xs text-ink-500">We use your details only to reply to this message. See our <a href="/privacy" className="underline">privacy policy</a>.</p>
            <Button type="submit" size="lg" loading={isSubmitting} className="w-full sm:w-auto">Send message</Button>
          </form>
        )}
      </div>
    </div>
  );
}
