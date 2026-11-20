import { ArrowRight, BarChart3, BookOpenCheck, Building2, CalendarDays, CheckCircle2, ClipboardCheck, FileSpreadsheet, Globe2, HeartHandshake, Layers, Lock, Presentation, ShieldCheck, Sparkles, Users, Video, Wifi } from 'lucide-react';
import { ButtonLink } from '@/components/ui';
import { SectionTitle } from './Home';

function Hero({ eyebrow, title, text, ctas }: { eyebrow: string; title: string; text: string; ctas: React.ReactNode }) {
  return (
    <section className="bg-gradient-to-b from-brand-50/70 to-surface">
      <div className="container-page py-14 sm:py-20">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand-600">{eyebrow}</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-extrabold leading-tight sm:text-5xl">{title}</h1>
        <p className="mt-5 max-w-2xl text-lg text-ink-600">{text}</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">{ctas}</div>
      </div>
    </section>
  );
}
function FeatureGrid({ items }: { items: { icon: React.ComponentType<{ className?: string }>; title: string; text: string }[] }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((i) => (
        <div key={i.title} className="card p-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><i.icon className="h-5 w-5" /></div>
          <h3 className="mt-4 text-lg font-bold">{i.title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{i.text}</p>
        </div>
      ))}
    </div>
  );
}

export function About() {
  return (
    <>
      <Hero eyebrow="About ProfJero Edu" title="Learning that is accessible, practical and alive."
        text="ProfJero Edu is a digital learning ecosystem that empowers learners, educators and institutions through accessible education, practical experiences and intelligent learning tools."
        ctas={<><ButtonLink to="/register" size="lg">Join ProfJero Edu</ButtonLink><ButtonLink to="/contact" size="lg" variant="outline">Talk to us</ButtonLink></>} />
      <section className="py-16">
        <div className="container-page grid gap-12 lg:grid-cols-2">
          <div className="space-y-4 text-ink-700">
            <h2 className="text-2xl font-extrabold">Why we built it</h2>
            <p>Too many “online learning” platforms are filing cabinets: teachers upload PDFs and students download them. Real learning needs structure, practice, feedback and people.</p>
            <p>ProfJero Edu brings the classroom online — a teacher, a board, a timetable, classmates, practical activities, assessments and honest feedback — and makes it work on the phones and data plans learners actually have.</p>
            <p>We start with learners and institutions in Ghana, and we build for the world: multiple countries, time zones and institutions on one platform.</p>
          </div>
          <div className="card p-6">
            <img src="/brand/logo-edu.webp" alt="ProfJero Edu" width={710} height={170} className="mx-auto w-full max-w-sm" loading="lazy" />
            <p className="mt-4 text-center text-sm text-ink-500">ProfJero Edu and ProfJero EduPro are products of <strong>ProfJero Digital Studio</strong>.</p>
          </div>
        </div>
      </section>
      <section className="bg-ink-50 py-16">
        <div className="container-page">
          <SectionTitle eyebrow="Our principles" title="What we will always stand for" />
          <div className="mt-10"><FeatureGrid items={[
            { icon: HeartHandshake, title: 'Free must mean useful', text: 'The free ProfJero Edu experience includes the full learning journey. EduPro adds premium value — it never holds learning hostage.' },
            { icon: Wifi, title: 'Built for low bandwidth', text: 'Lightweight pages, compressed media, an installable app and offline lessons for learners on limited data.' },
            { icon: ShieldCheck, title: 'Privacy by default', text: 'We collect only what we need, isolate school data and treat the records of young learners with special care.' },
            { icon: BookOpenCheck, title: 'Practical over passive', text: 'Every course is designed around doing: worked examples, activities, checks for understanding and real projects.' },
            { icon: Users, title: 'People at the centre', text: 'Teachers remain the heart of learning. Technology should give them time back, not replace them.' },
            { icon: Globe2, title: 'Local roots, global reach', text: 'Designed with Ghanaian classrooms in mind, ready for learners and institutions everywhere.' },
          ]} /></div>
        </div>
      </section>
    </>
  );
}

export function ForSchools() {
  return (
    <>
      <Hero eyebrow="For schools & institutions" title="A private digital campus for your school."
        text="Give every class a living online classroom: courses, live lessons, assignments, assessments, attendance and reports — in a workspace only your school can see."
        ctas={<><ButtonLink to="/schools/apply" size="lg">Register your school <ArrowRight className="h-4 w-4" /></ButtonLink><ButtonLink to="/contact?topic=schools" size="lg" variant="outline">Request a walkthrough</ButtonLink></>} />
      <section className="py-16">
        <div className="container-page">
          <FeatureGrid items={[
            { icon: Lock, title: 'Isolated school workspace', text: 'Your students, teachers, classes and results are private to your institution — enforced in the database, not just the interface.' },
            { icon: CalendarDays, title: 'Your academic structure', text: 'Academic years, terms or semesters, classes, streams and groups, with class teachers and subject teachers.' },
            { icon: FileSpreadsheet, title: 'Fast onboarding', text: 'Import students from a CSV with a clear error report, invite teachers by email and avoid duplicate accounts.' },
            { icon: Layers, title: 'Assign courses to classes', text: 'Assign any course to a class and every student in it is enrolled automatically — new students too.' },
            { icon: Video, title: 'Live lessons, any provider', text: 'Teachers schedule live classes on Google Meet, Zoom or Jitsi. Students join from their timetable; attendance is recorded.' },
            { icon: BarChart3, title: 'Reports that matter', text: 'Participation, completion, assessment performance, submissions, attendance and teacher activity — exportable as CSV.' },
          ]} />
          <div className="mt-12 card p-6 sm:p-8">
            <h2 className="text-xl font-extrabold">How school registration works</h2>
            <ol className="mt-5 grid gap-5 md:grid-cols-4">
              {['Create a free personal account', 'Submit your school registration', 'The ProfJero team verifies and approves it', 'Set up classes, invite teachers and add students'].map((t, i) => (
                <li key={t} className="flex gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">{i + 1}</span><span className="pt-1 text-sm text-ink-700">{t}</span></li>
              ))}
            </ol>
            <p className="mt-5 text-sm text-ink-500">Verification protects learners: institutional privileges are only granted after review.</p>
          </div>
        </div>
      </section>
    </>
  );
}

export function ForEducators() {
  return (
    <>
      <Hero eyebrow="For teachers & creators" title="Teach the way you teach best — to more learners."
        text="Build interactive courses without a developer, run live classes with the tools you already use, and know exactly who needs help."
        ctas={<><ButtonLink to="/register?role=educator" size="lg">Start teaching</ButtonLink><ButtonLink to="/teach/apply" size="lg" variant="outline">Apply as an independent instructor</ButtonLink></>} />
      <section className="py-16">
        <div className="container-page">
          <FeatureGrid items={[
            { icon: Sparkles, title: 'Block-based lesson builder', text: 'Text, images, video, code with output, practical activities, knowledge checks, tables, steps and embeds — with autosave and revision history.' },
            { icon: ClipboardCheck, title: 'Assessments that grade themselves', text: 'Nine question types, reusable question banks, randomisation, time limits and server-side grading. Essays go to your marking queue.' },
            { icon: Presentation, title: 'Your class, online', text: 'A class board, live discussion, raise-hand, roll call and announcements give your class the feel of a real room.' },
            { icon: Video, title: 'Live classes, your way', text: 'Paste a Google Meet, Zoom or Jitsi link — students see it in their timetable, get reminded, and join with one tap.' },
            { icon: BookOpenCheck, title: 'Assignments & rubrics', text: 'Text, link or file submissions, late tracking, rubrics, written feedback and return-for-correction.' },
            { icon: BarChart3, title: 'Insight, not surveillance', text: 'See progress, submission rates, averages and learners falling behind — without intrusive tracking.' },
          ]} />
          <div className="mt-12 grid gap-5 md:grid-cols-2">
            <div className="card p-6"><Building2 className="h-6 w-6 text-sun-500" /><h3 className="mt-3 text-lg font-bold">Teaching at a school?</h3><p className="mt-1 text-sm text-ink-600">Your school administrator invites you. You will see only the classes and courses you are assigned to — across as many schools as you work with.</p></div>
            <div className="card p-6"><Users className="h-6 w-6 text-growth-600" /><h3 className="mt-3 text-lg font-bold">Independent instructor?</h3><p className="mt-1 text-sm text-ink-600">Apply from your account. Once approved you can create courses and submit them for review before they are published.</p>
              <ul className="mt-3 space-y-1.5 text-sm text-ink-600">{['Free instructor tools on ProfJero Edu', 'EduPro for Teachers unlocks unlimited courses & analytics'].map((x) => <li key={x} className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-growth-600" />{x}</li>)}</ul></div>
          </div>
        </div>
      </section>
    </>
  );
}
