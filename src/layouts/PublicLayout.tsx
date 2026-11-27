import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { LogIn, Menu as MenuIcon, X } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { ButtonLink } from '@/components/ui';
import { useAuth } from '@/features/authentication/AuthProvider';
import { ConnectionBanner } from '@/components/app/ConnectionBanner';
import { cn } from '@/lib/utils';
import { InstallAppButton } from '@/components/app/InstallApp';
import { OccasionGreeting, OccasionLayer } from '@/features/occasions/OccasionLayer';

const nav = [
  { to: '/courses', label: 'Courses' },
  { to: '/for-schools', label: 'For Schools' },
  { to: '/for-educators', label: 'For Educators' },
  { to: '/pricing', label: 'Edu & EduPro' },
  { to: '/about', label: 'About' },
];

export function PublicLayout() {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <a href="#main" className="skip-link">Skip to content</a>
      <ConnectionBanner />
      <header className="sticky top-0 z-40 border-b border-ink-100 bg-surface/90 backdrop-blur">
        <div className="container-page flex h-16 items-center justify-between gap-4">
          <Logo />
          <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} className={({ isActive }) => cn('rounded-lg px-3 py-2 text-sm font-semibold text-ink-600 hover:bg-ink-50 hover:text-ink-900', isActive && 'text-brand-700')}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="hidden items-center gap-2 lg:flex">
            {session ? (
              <ButtonLink to="/dashboard">Go to dashboard</ButtonLink>
            ) : (
              <>
                <InstallAppButton variant="ghost" />
                <ButtonLink to="/login" variant="outline" leftIcon={<LogIn className="h-4 w-4" />}>Log in</ButtonLink>
                <ButtonLink to="/register">Create free account</ButtonLink>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 lg:hidden">
            {session ? <ButtonLink to="/dashboard" size="sm">Dashboard</ButtonLink>
              : <ButtonLink to="/login" size="sm" leftIcon={<LogIn className="h-4 w-4" />} data-testid="header-login">Log in</ButtonLink>}
            <button className="rounded-lg p-2 text-ink-700 hover:bg-ink-100" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="mobile-nav" aria-label="Menu">
              {open ? <X className="h-6 w-6" /> : <MenuIcon className="h-6 w-6" />}
            </button>
          </div>
        </div>
        {open && (
          <nav id="mobile-nav" aria-label="Mobile" className="border-t border-ink-100 bg-surface lg:hidden">
            <div className="container-page flex flex-col gap-1 py-3">
              {nav.map((n) => (
                <NavLink key={n.to} to={n.to} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 font-semibold text-ink-700 hover:bg-ink-50">{n.label}</NavLink>
              ))}
              <div className="mt-2 grid grid-cols-2 gap-2">
                {session ? <ButtonLink to="/dashboard" className="col-span-2">Go to dashboard</ButtonLink> : <>
                  <ButtonLink to="/login" variant="outline" leftIcon={<LogIn className="h-4 w-4" />}>Log in</ButtonLink>
                  <ButtonLink to="/register">Sign up free</ButtonLink>
                </>}
                <InstallAppButton className="col-span-2" />
              </div>
            </div>
          </nav>
        )}
      </header>
      <OccasionLayer />
      <main id="main" className="flex-1">
        <OccasionGreeting outer="container-page pt-4" className="mb-0" />
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

function Footer() {
  const cols = [
    { title: 'Learn', links: [['/courses', 'Explore courses'], ['/register', 'Create an account'], ['/verify', 'Verify a certificate']] },
    { title: 'Teach & lead', links: [['/for-educators', 'For educators'], ['/for-schools', 'For schools'], ['/pricing', 'Edu & EduPro']] },
    { title: 'Company', links: [['/about', 'About ProfJero Edu'], ['/contact', 'Contact & support'], ['/accessibility', 'Accessibility']] },
    { title: 'Legal', links: [['/privacy', 'Privacy policy'], ['/terms', 'Terms of service']] },
  ];
  return (
    <footer className="border-t border-ink-100 bg-ink-950 text-ink-300">
      <div className="container-page grid gap-10 py-12 md:grid-cols-[1.4fr_repeat(4,1fr)]">
        <div>
          <Logo light />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-400">
            A digital learning ecosystem that empowers learners, educators and institutions through accessible education, practical experiences and intelligent learning tools.
          </p>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-growth-500">Building solutions · Empowering lives</p>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <h2 className="text-sm font-bold text-white">{c.title}</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {c.links.map(([to, label]) => <li key={to}><Link to={to} className="hover:text-white">{label}</Link></li>)}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-2 py-5 text-xs text-ink-400 sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} ProfJero Digital Studio. All rights reserved.</p>
          <p>ProfJero Edu · ProfJero EduPro — Unveiling the Extraordinary</p>
        </div>
      </div>
    </footer>
  );
}
