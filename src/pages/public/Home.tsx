import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight, Award, BarChart3, BookOpenCheck, Building2, CalendarClock, CheckCircle2, ClipboardCheck, Crown, Hand, MessagesSquare,
  PenLine, Presentation, Sparkles, Users, Video, WifiOff, Quote,
} from 'lucide-react';
import { ButtonLink, Badge, Avatar } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { CourseCard } from '@/features/courses/CourseCard';
import { CategoryIcon } from '@/features/courses/CategoryIcon';
import { COURSE_CARD_SELECT, useCategories, useInstructorCards, type CourseCardData } from '@/features/courses/catalog';
import { usePublicSettings } from '@/features/administration/settings';

export function Home() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <Categories />
      <FeaturedCourses />
      <Classroom />
      <Audiences />
      <EduPro />
      <Testimonials />
      <FinalCta />
    </>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-brand-50/70 via-surface to-surface">
      <div className="pointer-events-none absolute -right-40 -top-40 h-[32rem] w-[32rem] rounded-full bg-brand-200/40 blur-3xl" />
      <div className="container-page relative grid items-center gap-12 py-14 lg:grid-cols-[1.1fr_1fr] lg:py-24">
        <div>
          <Badge tone="green" icon={<Sparkles className="h-3.5 w-3.5" />}>Unveiling the Extraordinary</Badge>
          <h1 className="mt-5 text-4xl font-extrabold leading-[1.08] sm:text-5xl lg:text-[3.4rem]">
            A real classroom experience, <span className="text-brand-600">wherever you learn.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-600">
            ProfJero Edu connects learners, teachers and schools in one living learning space — structured courses, live classes,
            class discussions, practical activities, real feedback and certificates that can be verified.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink to="/register" size="lg">Create your free account <ArrowRight className="h-4 w-4" /></ButtonLink>
            <ButtonLink to="/courses" size="lg" variant="outline">Explore courses</ButtonLink>
          </div>
          <ul className="mt-8 grid gap-2 text-sm text-ink-600 sm:grid-cols-2">
            {['Free to start — no card needed', 'Works on any phone, even on slow data', 'For SHS, university & lifelong learners', 'Built for schools and independent teachers'].map((t) => (
              <li key={t} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-growth-600" />{t}</li>
            ))}
          </ul>
        </div>
        <ClassroomIllustration />
      </div>
    </section>
  );
}

/** Product illustration of the classroom view (not live data). */
function ClassroomIllustration() {
  const seats = ['Ama', 'Kofi', 'Efua', 'Yaw', 'Akos', 'Kojo', 'Esi', 'Kwesi'];
  return (
    <figure className="relative mx-auto w-full max-w-lg" aria-label="Illustration of the ProfJero Edu classroom view">
      <div className="card overflow-hidden shadow-[var(--shadow-lift)]">
        <div className="board-surface p-5 text-white">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-growth-100">
              <span className="live-dot h-2 w-2 rounded-full bg-growth-500" /> Class in session
            </span>
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs">SHS 2 · ICT</span>
          </div>
          <p className="mt-4 text-sm text-white/70">Today on the board</p>
          <p className="mt-1 text-xl font-bold">Loops: repeating instructions with <code className="rounded bg-white/10 px-1.5">for</code></p>
          <div className="mt-4 flex gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-surface px-3 py-1.5 text-xs font-bold text-board-900"><Video className="h-3.5 w-3.5" /> Join live class</span>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold"><Hand className="h-3.5 w-3.5" /> Raise hand</span>
          </div>
        </div>
        <div className="p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-400">In class now</p>
          <div className="mt-3 grid grid-cols-4 gap-3">
            {seats.map((s, i) => (
              <div key={s} className="flex flex-col items-center gap-1">
                <Avatar name={s} size={40} ring={i === 2 ? 'hand' : 'online'} />
                <span className="text-[0.7rem] font-medium text-ink-600">{s}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl bg-ink-50 p-3 text-sm">
            <p className="font-semibold text-ink-800">Efua <span className="font-normal text-ink-500">asked</span></p>
            <p className="text-ink-600">Why does range(5) stop at 4?</p>
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-xs text-ink-400">Illustration of the classroom view</figcaption>
    </figure>
  );
}

function HowItWorks() {
  const steps = [
    { icon: Users, title: 'Join free', text: 'Create one account. Learn, teach or manage a school — switch roles without logging out.' },
    { icon: BookOpenCheck, title: 'Learn by doing', text: 'Structured lessons with explanations, worked examples, practical tasks and quick checks.' },
    { icon: Presentation, title: 'Learn together', text: 'Attend live classes, ask questions on the class board and get feedback from real teachers.' },
    { icon: Award, title: 'Prove your progress', text: 'Track your growth and earn certificates anyone can verify online.' },
  ];
  return (
    <section className="py-16 sm:py-20">
      <div className="container-page">
        <SectionTitle eyebrow="How it works" title="From sign-up to certificate, step by step" />
        <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <li key={s.title} className="card relative p-6">
              <span className="absolute right-5 top-5 text-4xl font-extrabold text-ink-100">{i + 1}</span>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><s.icon className="h-5 w-5" /></div>
              <h3 className="mt-4 text-lg font-bold">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Categories() {
  const { data } = useCategories();
  if (!data?.length) return null;
  return (
    <section className="bg-ink-50 py-16 sm:py-20">
      <div className="container-page">
        <SectionTitle eyebrow="Learning areas" title="Explore subjects that matter" />
        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {data.map((c) => (
            <Link key={c.id} to={`/courses?category=${c.slug}`} className="card flex items-center gap-3 p-4 transition hover:border-brand-300 hover:shadow-[var(--shadow-lift)]">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><CategoryIcon name={c.icon} className="h-5 w-5" /></span>
              <span className="text-sm font-bold text-ink-800">{c.name}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturedCourses() {
  const { data, isLoading } = useQuery({
    queryKey: ['featured-courses'],
    queryFn: async () => {
      const { data, error } = await supabase.from('courses').select(COURSE_CARD_SELECT).eq('status', 'published').eq('visibility', 'public').order('published_at', { ascending: false }).limit(6);
      if (error) throw error;
      return data as unknown as CourseCardData[];
    },
  });
  const { data: inst } = useInstructorCards((data ?? []).map((c) => c.id));
  return (
    <section className="py-16 sm:py-20">
      <div className="container-page">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <SectionTitle eyebrow="Featured courses" title="Start learning today" align="left" />
          <ButtonLink to="/courses" variant="outline">Browse all courses <ArrowRight className="h-4 w-4" /></ButtonLink>
        </div>
        {isLoading ? (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-80 animate-pulse rounded-2xl bg-ink-100" />)}</div>
        ) : data && data.length ? (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((c) => <CourseCard key={c.id} course={c} to={`/courses/${c.slug}`} instructors={inst} />)}
          </div>
        ) : (
          <p className="mt-10 rounded-2xl border border-dashed border-ink-200 p-10 text-center text-ink-500">
            Our first courses are being prepared by ProfJero educators. <Link to="/register" className="font-semibold text-brand-700 underline">Create an account</Link> to be notified when they open.
          </p>
        )}
      </div>
    </section>
  );
}

function Classroom() {
  const items = [
    { icon: Video, title: 'Live classes', text: 'Teachers schedule live sessions on Google Meet, Zoom or Jitsi. One tap to join, attendance recorded.' },
    { icon: Presentation, title: 'The class board', text: 'Teachers pin today’s topic, reminders and key points — just like the board in front of the class.' },
    { icon: Hand, title: 'Raise your hand', text: 'See who is in class right now and raise your hand to ask a question in real time.' },
    { icon: MessagesSquare, title: 'Class discussion & Q&A', text: 'Ask questions, help classmates and get answers from your teacher in a safe class space.' },
    { icon: CalendarClock, title: 'A real timetable', text: 'Your day at a glance: live classes, deadlines and tests — with reminders before they start.' },
    { icon: PenLine, title: 'Marked work & feedback', text: 'Submit assignments, get marks against clear rubrics and personal feedback from your teacher.' },
  ];
  return (
    <section className="board-surface py-16 text-white sm:py-24">
      <div className="container-page">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-growth-500">Face-to-face, online</p>
          <h2 className="mt-3 text-3xl font-extrabold text-white sm:text-4xl">It feels like being in class — because you are.</h2>
          <p className="mt-4 text-white/75">ProfJero Edu is designed around the rhythm of a real classroom: a teacher, a board, classmates beside you, a timetable and feedback on your work.</p>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((i) => (
            <div key={i.title} className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <i.icon className="h-6 w-6 text-growth-500" />
              <h3 className="mt-4 text-lg font-bold text-white">{i.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-white/70">{i.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Audiences() {
  const groups = [
    { icon: Users, title: 'For learners', color: 'bg-brand-600', to: '/register', cta: 'Start learning', points: ['Self-paced and teacher-led courses', 'Practical lessons, quizzes and projects', 'Progress tracking and verifiable certificates', 'Save lessons for offline study'] },
    { icon: Presentation, title: 'For teachers', color: 'bg-growth-600', to: '/for-educators', cta: 'Teach on ProfJero Edu', points: ['Block-based lesson builder with autosave', 'Question banks, auto-graded quizzes & rubrics', 'Live class scheduling with any meeting tool', 'See who is falling behind — early'] },
    { icon: Building2, title: 'For schools', color: 'bg-sun-500', to: '/for-schools', cta: 'Register your school', points: ['Private, isolated school workspace', 'Academic years, terms, classes and streams', 'Bulk student import and teacher invites', 'Attendance, performance and completion reports'] },
  ];
  return (
    <section className="py-16 sm:py-20">
      <div className="container-page">
        <SectionTitle eyebrow="One platform, every role" title="Built for everyone in the learning journey" />
        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {groups.map((g) => (
            <div key={g.title} className="card flex flex-col p-6">
              <span className={`flex h-12 w-12 items-center justify-center rounded-2xl text-white ${g.color}`}><g.icon className="h-6 w-6" /></span>
              <h3 className="mt-5 text-xl font-extrabold">{g.title}</h3>
              <ul className="mt-4 flex-1 space-y-2.5">
                {g.points.map((p) => <li key={p} className="flex gap-2.5 text-sm text-ink-600"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-growth-600" />{p}</li>)}
              </ul>
              <ButtonLink to={g.to} variant="outline" className="mt-6">{g.cta}</ButtonLink>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function EduPro() {
  return (
    <section className="bg-ink-50 py-16 sm:py-20">
      <div className="container-page grid items-center gap-10 lg:grid-cols-2">
        <div>
          <SectionTitle eyebrow="Edu & EduPro" title="Free for everyone. Pro when you are ready." align="left" />
          <p className="mt-4 text-ink-600">
            <strong>ProfJero Edu</strong> is free and genuinely useful: courses, live classes, assessments, assignments, offline lessons and certificates.
            <strong> ProfJero EduPro</strong> is the premium offering inside the same platform — premium courses, unlimited teaching tools,
            advanced analytics and priority support for individuals, teachers and whole schools.
          </p>
          <ButtonLink to="/pricing" className="mt-6" variant="secondary">Compare Edu and EduPro <ArrowRight className="h-4 w-4" /></ButtonLink>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="card p-6">
            <Badge tone="brand">ProfJero Edu</Badge>
            <p className="mt-3 text-2xl font-extrabold">Free</p>
            <ul className="mt-4 space-y-2 text-sm text-ink-600">
              {['Courses & live classes', 'Quizzes, assignments & feedback', 'Offline lessons', 'Verifiable certificates'].map((x) => <li key={x} className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-growth-600" />{x}</li>)}
            </ul>
          </div>
          <div className="card border-sun-400/60 p-6 ring-1 ring-sun-400/40">
            <Badge tone="amber" icon={<Crown className="h-3 w-3" />}>ProfJero EduPro</Badge>
            <p className="mt-3 text-2xl font-extrabold">Premium</p>
            <ul className="mt-4 space-y-2 text-sm text-ink-600">
              {['Premium courses', 'Unlimited teaching tools', 'Advanced analytics', 'Priority support'].map((x) => <li key={x} className="flex gap-2"><Crown className="h-4 w-4 text-sun-500" />{x}</li>)}
            </ul>
            <p className="mt-4 text-xs text-ink-500">Currently available through pilots. Pricing will be announced.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

type Testimonial = { quote: string; name: string; role?: string };
function Testimonials() {
  const { data } = usePublicSettings();
  const items = (data?.['home.testimonials'] as Testimonial[] | undefined) ?? [];
  if (!items.length) return null; // only genuine, admin-published testimonials are shown
  return (
    <section className="py-16 sm:py-20">
      <div className="container-page">
        <SectionTitle eyebrow="Voices" title="What our community says" />
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {items.slice(0, 6).map((t, i) => (
            <figure key={i} className="card p-6">
              <Quote className="h-6 w-6 text-brand-300" />
              <blockquote className="mt-3 text-ink-700">{t.quote}</blockquote>
              <figcaption className="mt-4 text-sm font-semibold text-ink-900">{t.name}{t.role && <span className="font-normal text-ink-500"> · {t.role}</span>}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="py-16 sm:py-20">
      <div className="container-page">
        <div className="relative overflow-hidden rounded-3xl bg-brand-600 px-6 py-12 text-center text-white sm:px-12">
          <div className="pointer-events-none absolute -left-10 -top-10 h-48 w-48 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-16 -right-10 h-64 w-64 rounded-full bg-ink-900/20" />
          <h2 className="relative text-3xl font-extrabold text-white sm:text-4xl">Your next class starts here.</h2>
          <p className="relative mx-auto mt-3 max-w-xl text-white/85">Join ProfJero Edu as a learner, teacher or school — it takes less than two minutes.</p>
          <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <ButtonLink to="/register" size="lg" className="bg-surface text-brand-700 hover:bg-brand-50">Create free account</ButtonLink>
            <ButtonLink to="/for-schools" size="lg" variant="board"><ClipboardCheck className="h-4 w-4" /> Bring your school</ButtonLink>
          </div>
          <p className="relative mt-6 inline-flex items-center gap-2 text-sm text-white/75"><WifiOff className="h-4 w-4" /> Install it on your phone and keep learning offline. <BarChart3 className="hidden" /></p>
        </div>
      </div>
    </section>
  );
}

export function SectionTitle({ eyebrow, title, align = 'center' }: { eyebrow: string; title: string; align?: 'center' | 'left' }) {
  return (
    <div className={align === 'center' ? 'mx-auto max-w-2xl text-center' : ''}>
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand-600">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-extrabold sm:text-4xl">{title}</h2>
    </div>
  );
}
