import { forwardRef, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, Eye, EyeOff, GraduationCap, MailCheck, Presentation, ShieldOff } from 'lucide-react';
import { Alert, Button, ButtonLink, Checkbox, Field, Input, Select, Spinner } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { WelcomeBack } from '@/components/app/ReturningUser';
import { useAuth } from './AuthProvider';
import { usePublicSettings } from '@/features/administration/settings';

const passwordRule = z.string().min(8, 'Use at least 8 characters').max(72).regex(/[A-Za-z]/, 'Include a letter').regex(/[0-9]/, 'Include a number');
const safeNext = (n: string | null) => (n && n.startsWith('/') && !n.startsWith('//') ? n : '/dashboard');

const PasswordInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function PasswordInput(props, ref) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input ref={ref} type={show ? 'text' : 'password'} {...props} className="pr-11" />
      <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-ink-400 hover:text-ink-700" aria-label={show ? 'Hide password' : 'Show password'}>
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
});

// ---------------------------------------------------------------------------
const loginSchema = z.object({ email: z.string().trim().email('Enter a valid email'), password: z.string().min(1, 'Enter your password') });
export function Login() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { session } = useAuth();
  const [err, setErr] = useState<string | null>(null);
  const [unverified, setUnverified] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema) });
  const next = safeNext(params.get('next'));
  useEffect(() => { if (session) nav(next, { replace: true }); }, [session, nav, next]);

  const onSubmit = async (v: z.infer<typeof loginSchema>) => {
    setErr(null);
    setUnverified(null);
    const { error } = await supabase.auth.signInWithPassword({ email: v.email, password: v.password });
    if (error) {
      if (/confirm/i.test(error.message)) setUnverified(v.email);
      else setErr(/invalid/i.test(error.message) ? 'Incorrect email or password.' : error.message);
      return;
    }
    nav(next, { replace: true });
  };
  return (
    <div>
      <h1 className="text-3xl font-extrabold">Welcome back</h1>
      <p className="mt-2 text-ink-500">Log in to continue learning.</p>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5" noValidate>
        {err && <Alert tone="error">{err}</Alert>}
        {unverified && <Alert tone="warning" title="Verify your email first">Check your inbox for the verification link. <ResendLink email={unverified} /></Alert>}
        <Field label="Email" error={errors.email?.message}><Input type="email" autoComplete="email" {...register('email')} /></Field>
        <Field label="Password" error={errors.password?.message}><PasswordInput autoComplete="current-password" {...register('password')} /></Field>
        <div className="flex justify-end"><Link to="/forgot-password" className="text-sm font-semibold text-brand-700 hover:underline">Forgot password?</Link></div>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Log in</Button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-600">New to ProfJero Edu? <Link to={`/register${params.get('next') ? `?next=${encodeURIComponent(params.get('next')!)}` : ''}`} className="font-semibold text-brand-700 hover:underline">Create a free account</Link></p>
    </div>
  );
}

function ResendLink({ email }: { email: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  return (
    <button type="button" className="font-semibold underline" disabled={state === 'sending'} onClick={async () => {
      setState('sending');
      const { error } = await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: `${location.origin}/auth/callback` } });
      setState(error ? 'error' : 'sent');
    }}>{state === 'sent' ? 'Sent — check your inbox.' : state === 'error' ? 'Could not resend; try again shortly.' : 'Resend link'}</button>
  );
}

// ---------------------------------------------------------------------------
const registerSchema = z.object({
  full_name: z.string().trim().min(2, 'Enter your full name').max(120),
  email: z.string().trim().email('Enter a valid email'),
  password: passwordRule,
  intended_role: z.enum(['learner', 'educator', 'institution']),
  learner_stage: z.enum(['shs', 'university', 'professional', 'other']).optional(),
  accept: z.literal(true, { message: 'Please accept the terms to continue' }),
});
type RegisterForm = z.infer<typeof registerSchema>;

export function Register() {
  const [params] = useSearchParams();
  const settings = usePublicSettings();
  const nav = useNavigate();
  const [err, setErr] = useState<string | null>(null);
  const initialRole = params.get('role') === 'educator' ? 'educator' : params.get('role') === 'institution' ? 'institution' : 'learner';
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema), defaultValues: { intended_role: initialRole } });
  const role = watch('intended_role');
  const onSubmit = async (v: RegisterForm) => {
    setErr(null);
    const next = safeNext(params.get('next'));
    const { data, error } = await supabase.auth.signUp({
      email: v.email,
      password: v.password,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next === '/dashboard' ? '/onboarding' : next)}`,
        data: { full_name: v.full_name, intended_role: v.intended_role, learner_stage: v.learner_stage ?? null },
      },
    });
    if (error) return setErr(/already registered/i.test(error.message) ? 'An account with this email already exists. Log in instead.' : error.message);
    const dest = next === '/dashboard' ? '/onboarding' : next;
    if (data.session) return nav(dest, { replace: true });
    // Email confirmation is off on ProfJero Edu: sign straight in. If the
    // project still requires confirmation, fall back to the check-email page.
    const { data: signedIn } = await supabase.auth.signInWithPassword({ email: v.email, password: v.password });
    if (signedIn.session) nav(dest, { replace: true });
    else nav(`/check-email?email=${encodeURIComponent(v.email)}`, { replace: true });
  };
  const roles = [
    { v: 'learner', label: 'Learner', icon: GraduationCap, text: 'Study courses and join classes' },
    { v: 'educator', label: 'Educator', icon: Presentation, text: 'Teach courses or classes' },
    { v: 'institution', label: 'School', icon: Building2, text: 'Represent an institution' },
  ] as const;
  if (settings.data?.['signups.enabled'] === false) return (
    <div><h1 className="text-3xl font-extrabold">Sign-ups are paused</h1><p className="mt-2 text-ink-600">New registrations are closed for a short while. Already have an account? <Link to="/login" className="font-semibold text-brand-700">Log in</Link>.</p></div>
  );
  return (
    <div>
      <WelcomeBack className="mb-6" compact />
      <h1 className="text-3xl font-extrabold">Create your free account</h1>
      <p className="mt-2 text-ink-500">One account for learning, teaching and managing your school.</p>
      <p className="mt-3 rounded-xl bg-sun-50 px-3 py-2 text-sm text-ink-700">Already have an account? <Link to="/login" className="font-bold text-brand-700 underline">Log in instead</Link> — please don’t create a second account.</p>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5" noValidate>
        {err && <Alert tone="error">{err}</Alert>}
        <fieldset>
          <legend className="text-sm font-semibold text-ink-800">I am joining as</legend>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {roles.map((r) => (
              <label key={r.v} className={cn('flex cursor-pointer flex-col items-center gap-1 rounded-xl border p-3 text-center transition', role === r.v ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-100' : 'border-ink-200 hover:border-ink-300')}>
                <input type="radio" value={r.v} className="sr-only" {...register('intended_role')} onChange={() => setValue('intended_role', r.v)} checked={role === r.v} />
                <r.icon className={cn('h-5 w-5', role === r.v ? 'text-brand-600' : 'text-ink-400')} />
                <span className="text-sm font-bold text-ink-900">{r.label}</span>
                <span className="hidden text-[0.7rem] leading-tight text-ink-500 sm:block">{r.text}</span>
              </label>
            ))}
          </div>
          {role !== 'learner' && <p className="mt-2 text-xs text-ink-500">Teaching and school roles are granted after verification — you can start learning immediately.</p>}
        </fieldset>
        <Field label="Full name (your official name)" required hint="As in your school records — your teachers see this. You can add a nickname later." error={errors.full_name?.message}><Input autoComplete="name" {...register('full_name')} /></Field>
        <Field label="Email" required error={errors.email?.message}><Input type="email" autoComplete="email" {...register('email')} /></Field>
        <Field label="Password" required hint="At least 8 characters with a letter and a number" error={errors.password?.message}><PasswordInput autoComplete="new-password" {...register('password')} /></Field>
        {role === 'learner' && (
          <Field label="Where are you in your learning?" hint="Optional — helps us recommend courses">
            <Select {...register('learner_stage', { setValueAs: (v) => v || undefined })}>
              <option value="">Prefer not to say</option><option value="shs">Senior High School</option><option value="university">University / tertiary</option>
              <option value="professional">Working professional</option><option value="other">Other</option>
            </Select>
          </Field>
        )}
        <div>
          <Checkbox label={<>I agree to the <Link to="/terms" className="text-brand-700 underline">Terms</Link> and <Link to="/privacy" className="text-brand-700 underline">Privacy Policy</Link></>}
            description="If you are under 18, please make sure a parent, guardian or your school is aware you are joining." {...register('accept')} />
          {errors.accept && <p role="alert" className="mt-1 text-xs font-medium text-red-600">{errors.accept.message}</p>}
        </div>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Create account</Button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-600">Already have an account? <Link to={`/login${params.get('next') ? `?next=${encodeURIComponent(params.get('next')!)}` : ''}`} className="font-semibold text-brand-700 hover:underline">Log in</Link></p>
    </div>
  );
}

export function CheckEmail() {
  const [params] = useSearchParams();
  const email = params.get('email') ?? '';
  return (
    <div className="text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-growth-50 text-growth-600"><MailCheck className="h-8 w-8" /></div>
      <h1 className="mt-6 text-3xl font-extrabold">Check your email</h1>
      <p className="mt-3 text-ink-600">We sent a verification link to <strong>{email || 'your inbox'}</strong>. Open it to activate your account.</p>
      <p className="mt-2 text-sm text-ink-500">Can't find it? Check spam or promotions. {email && <ResendLink email={email} />}</p>
      <ButtonLink to="/login" variant="outline" className="mt-8">Back to log in</ButtonLink>
    </div>
  );
}

export function ForgotPassword() {
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ email: string }>({ resolver: zodResolver(z.object({ email: z.string().trim().email('Enter a valid email') })) });
  const [err, setErr] = useState<string | null>(null);
  return (
    <div>
      <h1 className="text-3xl font-extrabold">Reset your password</h1>
      <p className="mt-2 text-ink-500">We will email you a secure link to choose a new password.</p>
      {sent ? <Alert tone="success" className="mt-8" title="Check your email">If an account exists for that address, a reset link is on its way.</Alert> : (
        <form className="mt-8 space-y-5" noValidate onSubmit={handleSubmit(async ({ email }) => {
          setErr(null);
          const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/reset-password` });
          if (error && !/rate/i.test(error.message)) setErr(error.message); else setSent(true);
        })}>
          {err && <Alert tone="error">{err}</Alert>}
          <Field label="Email" error={errors.email?.message}><Input type="email" autoComplete="email" {...register('email')} /></Field>
          <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Send reset link</Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm"><Link to="/login" className="font-semibold text-brand-700 hover:underline">Back to log in</Link></p>
    </div>
  );
}

export function ResetPassword() {
  const nav = useNavigate();
  const { session, initialising } = useAuth();
  const [err, setErr] = useState<string | null>(null);
  const schema = z.object({ password: passwordRule, confirm: z.string() }).refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  if (initialising) return <Spinner />;
  if (!session) return <Alert tone="warning" title="Link expired or invalid">Request a new password reset link. <Link to="/forgot-password" className="font-semibold underline">Reset password</Link></Alert>;
  return (
    <div>
      <h1 className="text-3xl font-extrabold">Choose a new password</h1>
      <form className="mt-8 space-y-5" noValidate onSubmit={handleSubmit(async (v) => {
        setErr(null);
        const { error } = await supabase.auth.updateUser({ password: v.password });
        if (error) setErr(error.message); else nav('/dashboard', { replace: true });
      })}>
        {err && <Alert tone="error">{err}</Alert>}
        <Field label="New password" hint="At least 8 characters with a letter and a number" error={errors.password?.message}><PasswordInput autoComplete="new-password" {...register('password')} /></Field>
        <Field label="Confirm password" error={errors.confirm?.message}><PasswordInput autoComplete="new-password" {...register('confirm')} /></Field>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Update password</Button>
      </form>
    </div>
  );
}

/** Landing page for email verification links (PKCE code is exchanged automatically). */
export function AuthCallback() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { session, initialising } = useAuth();
  const [err, setErr] = useState<string | null>(params.get('error_description'));
  useEffect(() => {
    if (session) nav(safeNext(params.get('next')), { replace: true });
  }, [session, nav, params]);
  useEffect(() => {
    if (initialising || session || err) return;
    const t = setTimeout(() => setErr('This verification link is invalid or has expired. Log in to request a new one.'), 6000);
    return () => clearTimeout(t);
  }, [initialising, session, err]);
  return err ? (
    <Alert tone="error" title="We couldn't verify that link">{err} <Link to="/login" className="font-semibold underline">Go to log in</Link></Alert>
  ) : (
    <div className="flex flex-col items-center gap-3 text-ink-600"><Spinner className="h-8 w-8" />Verifying your account…</div>
  );
}

export function Suspended() {
  const { signOut } = useAuth();
  return (
    <div className="container-page max-w-lg py-20 text-center">
      <ShieldOff className="mx-auto h-12 w-12 text-red-600" />
      <h1 className="mt-4 text-2xl font-extrabold">Your account is suspended</h1>
      <p className="mt-2 text-ink-600">Access has been paused by a platform administrator. If you think this is a mistake, contact support.</p>
      <div className="mt-6 flex justify-center gap-2"><ButtonLink to="/contact">Contact support</ButtonLink><Button variant="outline" onClick={() => void signOut()}>Sign out</Button></div>
    </div>
  );
}
