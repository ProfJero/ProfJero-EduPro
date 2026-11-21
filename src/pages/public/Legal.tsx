import type { ReactNode } from 'react';
import { Alert } from '@/components/ui';

function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <article className="container-page max-w-3xl py-14">
      <h1 className="text-4xl font-extrabold">{title}</h1>
      <p className="mt-2 text-sm text-ink-500">Draft version · last updated {updated}</p>
      <Alert tone="warning" title="Draft — pending legal review" className="mt-6">
        This document is a working draft prepared for product development. It has not yet been reviewed by a qualified legal practitioner and must be reviewed before production use. It does not claim compliance with any specific law.
      </Alert>
      <div className="mt-8 space-y-6 leading-relaxed text-ink-700 [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-ink-900 [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">{children}</div>
    </article>
  );
}

export function Privacy() {
  return (
    <LegalPage title="Privacy Policy" updated="19 November 2026">
      <p>ProfJero Edu (including ProfJero EduPro) is operated by ProfJero Digital Studio. This policy explains what personal information we collect, why, and the choices you have.</p>
      <h2>Information we collect</h2>
      <ul>
        <li><strong>Account details:</strong> your name, email address and password (stored securely as a hash by our authentication provider).</li>
        <li><strong>Profile details you choose to add:</strong> display name, photo, headline, bio, country and time zone.</li>
        <li><strong>Learning records:</strong> enrolments, lesson progress, assessment attempts and results, assignment submissions, feedback, attendance, certificates and messages you post in class discussions.</li>
        <li><strong>School records:</strong> if your school uses ProfJero Edu, the school may add your class membership and student number.</li>
        <li><strong>Support and contact messages</strong> you send us.</li>
      </ul>
      <p>We do not ask for dates of birth, national ID numbers or precise location, and we do not track how many seconds you spend on a page.</p>
      <h2>How we use information</h2>
      <ul>
        <li>To provide learning, teaching and school-management features you use.</li>
        <li>To show your progress to you and to the teachers and school administrators responsible for your learning.</li>
        <li>To issue and verify certificates (a certificate's verification page shows your name, the course, issuer and date).</li>
        <li>To keep the platform secure, including audit logs of administrative actions.</li>
      </ul>
      <h2>Who can see your information</h2>
      <p>Access is restricted by role and enforced in our database. Teachers see learners in their own courses and classes; school administrators see their own school only; platform administrators can access records to operate and support the service.</p>
      <h2>Young learners</h2>
      <p>Some learners may be minors. We minimise the data we collect, keep school data isolated, and expect schools to obtain any consent required from parents or guardians before registering students.</p>
      <h2>Service providers</h2>
      <p>We use Supabase (database and authentication), Cloudflare (hosting) and Cloudinary (media storage). Live classes take place on third-party providers (such as Google Meet, Zoom or Jitsi) whose own privacy policies apply when you join.</p>
      <h2>Offline data on shared devices</h2>
      <p>Lessons you save for offline use are stored on your device under your account and removed when you sign out.</p>
      <h2>Your choices</h2>
      <p>You can update your profile at any time and request access to, correction of, or deletion of your data by contacting support. Data protection law relevant to Ghana includes the Data Protection Act, 2012 (Act 843); our approach to it is subject to the legal review noted above.</p>
      <h2>Contact</h2>
      <p>Use the contact page or open a support ticket from your account.</p>
    </LegalPage>
  );
}

export function Terms() {
  return (
    <LegalPage title="Terms of Service" updated="19 November 2026">
      <p>These terms govern your use of ProfJero Edu and ProfJero EduPro (“the platform”), provided by ProfJero Digital Studio.</p>
      <h2>Accounts</h2>
      <ul><li>Provide accurate information and keep your password safe.</li><li>One person, one account. Roles (learner, teacher, school administrator) are attached to your single account.</li><li>Privileged roles are granted only through authorised processes.</li></ul>
      <h2>Acceptable use</h2>
      <ul><li>Be respectful in class discussions. No harassment, hate, or sharing of others' personal information.</li><li>Do not attempt to access data you are not authorised to see, or to interfere with assessments.</li><li>Submit your own work. Academic dishonesty may be reported to your teacher or school.</li></ul>
      <h2>Content</h2>
      <p>Instructors and schools are responsible for the content they publish and must have the rights to use it. We may review, unpublish or remove content that breaches these terms.</p>
      <h2>ProfJero EduPro</h2>
      <p>EduPro features are currently offered through pilots at no charge. If paid plans are introduced, their prices and terms will be presented before any purchase.</p>
      <h2>Certificates</h2>
      <p>Certificates confirm completion of a course's configured requirements on the platform. They are not accredited qualifications unless the issuing institution states otherwise.</p>
      <h2>Live classes</h2>
      <p>Live sessions are hosted on third-party meeting providers. We are not responsible for those services' availability. Proctoring is not provided.</p>
      <h2>Availability and changes</h2>
      <p>We work to keep the platform available but cannot guarantee uninterrupted service. We may update these terms and will notify users of material changes.</p>
      <h2>Suspension</h2>
      <p>We may suspend accounts that breach these terms or put other users at risk.</p>
    </LegalPage>
  );
}

export function AccessibilityPage() {
  return (
    <article className="container-page max-w-3xl py-14 leading-relaxed text-ink-700">
      <h1 className="text-4xl font-extrabold text-ink-900">Accessibility</h1>
      <p className="mt-4">We want everyone to be able to learn and teach on ProfJero Edu. We design and test towards the Web Content Accessibility Guidelines (WCAG) 2.2 level AA.</p>
      <h2 className="mt-8 text-xl font-bold text-ink-900">What we do</h2>
      <ul className="mt-3 list-disc space-y-1.5 pl-5">
        <li>Keyboard navigation throughout, with visible focus indicators and a “skip to content” link.</li>
        <li>Semantic headings, labelled form fields and validation messages announced to screen readers.</li>
        <li>Colour contrast checked against AA thresholds; information is never conveyed by colour alone.</li>
        <li>Mobile-first layouts that reflow without horizontal scrolling, and support for reduced-motion preferences.</li>
        <li>Teachers can add alternative text to images and transcripts to video and audio lessons.</li>
        <li>Lightweight pages and offline lessons for learners with limited connectivity.</li>
      </ul>
      <h2 className="mt-8 text-xl font-bold text-ink-900">Known limitations</h2>
      <p className="mt-3">Third-party content embedded by teachers (videos, simulations, meeting providers) may not meet the same standard. We have not yet completed an independent accessibility audit.</p>
      <h2 className="mt-8 text-xl font-bold text-ink-900">Feedback</h2>
      <p className="mt-3">If something is hard to use, please tell us through the <a href="/contact" className="font-semibold text-brand-700 underline">contact page</a>.</p>
    </article>
  );
}
