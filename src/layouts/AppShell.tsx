import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { Link, NavLink, Outlet, matchPath, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Dlg from '@radix-ui/react-dialog';
import {
  Award, BarChart3, Bell, BookMarked, BookOpen, Bot, Building2, CalendarDays, Check, ChevronsLeft, ChevronsRight, ChevronsUpDown, ClipboardCheck,
  ClipboardList, Code2, Compass, CreditCard, FileStack, FlaskConical, FolderOpen, Gauge, GraduationCap, Home, Inbox, LayoutDashboard, Library,
  LifeBuoy, LogOut, Megaphone, Menu as MenuIcon, MessagesSquare, Moon, Presentation, ScrollText, Search, Settings, ShieldCheck, Sigma, Sparkles,
  Sun, Swords, Table2, Tags, TrendingUp, UserCog, Users, UsersRound, Video, Wand2, WifiLow, X, CalendarCheck, BookText, Plug,
} from 'lucide-react';
import { Logo, LogoMark } from '@/components/brand/Logo';
import { Avatar, Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from '@/components/ui';
import { ConnectionBanner } from '@/components/app/ConnectionBanner';
import { useAuth } from '@/features/authentication/AuthProvider';
import type { Workspace } from '@/features/authentication/types';
import { usePrefs } from '@/features/preferences/PreferencesProvider';
import { PushPill, PushProvider } from '@/features/notifications/PushPrompt';
import { ContrastGuard } from '@/components/app/ContrastGuard';
import { ErrorBoundary } from '@/components/app/ErrorBoundary';
import { usePublicSettings } from '@/features/administration/settings';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { useOfflineSync } from '@/features/learning/useOfflineSync';

type Icon = ComponentType<{ className?: string }>;
type NavItem = { to: string; label: string; icon: Icon; end?: boolean; mobile?: boolean; badge?: string };
type NavGroup = { label?: string; tone?: 'lab' | 'connect' | 'intel' | 'arena'; items: NavItem[] };

const toneDot: Record<NonNullable<NavGroup['tone']>, string> = { lab: 'bg-teal-500', connect: 'bg-sun-500', intel: 'bg-violet-500', arena: 'bg-rose-500' };

function navFor(ws: Workspace): NavGroup[] {
  switch (ws.kind) {
    case 'learner':
      return [
        { items: [
          { to: '/learn', label: 'Home', icon: Home, end: true, mobile: true },
          { to: '/calendar', label: 'Calendar', icon: CalendarDays },
        ] },
        { label: 'Learn', items: [
          { to: '/learn/courses', label: 'My Learning', icon: BookOpen, mobile: true },
          { to: '/learn/explore', label: 'Explore Courses', icon: Compass },
          { to: '/learn/classes', label: 'Classes', icon: Presentation, mobile: true },
          { to: '/learn/assessments', label: 'Assessments', icon: ClipboardCheck },
          { to: '/learn/assignments', label: 'Assignments', icon: ClipboardList },
          { to: '/learn/grades', label: 'Grades', icon: Table2 },
          { to: '/learn/resources', label: 'Resources & Offline', icon: BookMarked },
          { to: '/curriculum', label: 'Curriculum Library', icon: Library },
          { to: '/learn/certificates', label: 'Certificates', icon: Award },
        ] },
        { label: 'EduLab', tone: 'lab', items: [
          { to: '/lab', label: 'Lab Home', icon: FlaskConical, end: true },
          { to: '/lab/code', label: 'Code Lab', icon: Code2 },
          { to: '/lab/science', label: 'Science Lab', icon: FlaskConical },
          { to: '/lab/math', label: 'Math Lab', icon: Sigma },
        ] },
        { label: 'EduConnect', tone: 'connect', items: [
          { to: '/connect', label: 'Study Groups', icon: UsersRound, end: true },
          { to: '/discussions', label: 'Discussions', icon: MessagesSquare },
        ] },
        { label: 'EduIntelligence', tone: 'intel', items: [
          { to: '/ai', label: 'AI Companion', icon: Bot, mobile: true },
          { to: '/learn/progress', label: 'Insights & Progress', icon: TrendingUp },
        ] },
        { label: 'Arena', tone: 'arena', items: [{ to: '/arena', label: 'Challenge Arena', icon: Swords }] },
      ];
    case 'teacher':
      return [
        { items: [
          { to: '/teach', label: 'Overview', icon: LayoutDashboard, end: true, mobile: true },
          { to: '/calendar', label: 'Calendar', icon: CalendarDays },
        ] },
        { label: 'Teach', items: [
          { to: '/teach/courses', label: 'My Courses', icon: BookOpen, mobile: true },
          { to: '/teach/classes', label: 'My Classes', icon: Presentation, mobile: true },
          { to: '/teach/lessons', label: 'Lessons', icon: FileStack },
          { to: '/teach/assessments', label: 'Assessments', icon: ClipboardCheck },
          { to: '/teach/banks', label: 'Question Banks', icon: Library },
          { to: '/teach/assignments', label: 'Assignments', icon: ClipboardList },
          { to: '/teach/gradebook', label: 'Gradebook', icon: Table2 },
          { to: '/teach/live', label: 'Live Classes', icon: Video },
        ] },
        { label: 'People', items: [
          { to: '/teach/students', label: 'Students', icon: Users },
          { to: '/teach/announcements', label: 'Announcements', icon: Megaphone },
          { to: '/teach/resources', label: 'Course Resources', icon: FolderOpen },
          { to: '/curriculum', label: 'Curriculum Library', icon: BookText },
        ] },
        { label: 'EduIntelligence', tone: 'intel', items: [
          { to: '/studio', label: 'Resource Studio', icon: Wand2, mobile: true },
          { to: '/teach/pulse', label: 'Class Pulse', icon: Gauge },
          { to: '/teach/reports', label: 'Reports & Insights', icon: BarChart3 },
        ] },
        { label: 'EduLab & Arena', tone: 'lab', items: [
          { to: '/lab', label: 'Labs & Activities', icon: FlaskConical },
          { to: '/teach/challenges', label: 'Challenge Studio', icon: Swords },
        ] },
      ];
    case 'school': {
      const b = `/school/${ws.schoolId}`;
      return [
        { items: [{ to: b, label: 'Overview', icon: LayoutDashboard, end: true, mobile: true }] },
        { label: 'People', items: [
          { to: `${b}/students`, label: 'Students', icon: GraduationCap, mobile: true },
          { to: `${b}/teachers`, label: 'Teachers', icon: Users, mobile: true },
        ] },
        { label: 'Academics', items: [
          { to: `${b}/classes`, label: 'Classes', icon: Presentation, mobile: true },
          { to: `${b}/academic`, label: 'Academic Structure', icon: CalendarDays },
          { to: `${b}/courses`, label: 'Courses', icon: BookOpen },
          { to: `${b}/attendance`, label: 'Attendance', icon: CalendarCheck },
        ] },
        { label: 'Communicate & Report', items: [
          { to: `${b}/announcements`, label: 'Announcements', icon: Megaphone },
          { to: `${b}/reports`, label: 'Reports', icon: BarChart3 },
          { to: `${b}/settings`, label: 'School Settings', icon: Settings },
        ] },
      ];
    }
    case 'admin':
      return [
        { items: [
          { to: '/admin', label: 'Owner dashboard', icon: LayoutDashboard, end: true, mobile: true },
          { to: '/admin/monitor', label: 'System monitor', icon: Gauge, mobile: true },
        ] },
        { label: 'Business', items: [
          { to: '/admin/subscriptions', label: 'Plans, prices & subscriptions', icon: CreditCard, mobile: true },
          { to: '/admin/users', label: 'Users & roles', icon: UserCog, mobile: true },
          { to: '/admin/schools', label: 'Schools', icon: Building2 },
          { to: '/admin/teachers', label: 'Teacher approvals', icon: Presentation },
        ] },
        { label: 'Content & safety', items: [
          { to: '/admin/courses', label: 'Course reviews', icon: BookOpen },
          { to: '/admin/curriculum', label: 'Curriculum (GES)', icon: BookText },
          { to: '/admin/arena', label: 'Arena challenges', icon: Swords },
          { to: '/admin/categories', label: 'Categories', icon: Tags },
          { to: '/admin/certificates', label: 'Certificates', icon: Award },
        ] },
        { label: 'System', items: [
          { to: '/admin/settings', label: 'System controls', icon: Settings },
          { to: '/admin/integrations', label: 'Integrations & keys', icon: Plug },
          { to: '/admin/announcements', label: 'Announcements', icon: Megaphone },
          { to: '/admin/audit', label: 'Audit log', icon: ScrollText },
        ] },
        { label: 'Support', items: [
          { to: '/admin/support', label: 'Support tickets', icon: LifeBuoy },
          { to: '/admin/inbox', label: 'Contact inbox', icon: Inbox },
        ] },
      ];
  }
}

function lsGet(k: string) {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}

function activeWorkspace(path: string, workspaces: Workspace[]): Workspace {
  if (path.startsWith('/teach') || path.startsWith('/studio')) return workspaces.find((w) => w.kind === 'teacher') ?? workspaces[0];
  if (path.startsWith('/admin')) return workspaces.find((w) => w.kind === 'admin') ?? workspaces[0];
  if (path.startsWith('/school/')) {
    const id = path.split('/')[2];
    return workspaces.find((w) => w.kind === 'school' && w.schoolId === id) ?? { kind: 'school', key: `school:${id}`, label: 'School', home: `/school/${id}`, schoolId: id };
  }
  if (path.startsWith('/learn')) return workspaces[0];
  const remembered = lsGet('pje:ws');
  return workspaces.find((w) => w.key === remembered) ?? workspaces[0];
}

const wsIcon: Record<Workspace['kind'], Icon> = { learner: GraduationCap, teacher: Presentation, school: Building2, admin: ShieldCheck };
const wsAccent: Record<Workspace['kind'], string> = { learner: 'bg-brand-600', teacher: 'bg-growth-600', school: 'bg-sun-500', admin: 'bg-ink-950' };

export function AppShell() {
  const { workspaces, context, profile } = useAuth();
  const { prefs, setPref } = usePrefs();
  const loc = useLocation();
  const ws = useMemo(() => activeWorkspace(loc.pathname, workspaces), [loc.pathname, workspaces]);
  const settings = usePublicSettings();
  const groups = navFor(ws).map((g) => ({ ...g, items: g.items.filter((i) => !(settings.data?.['arena.enabled'] === false && i.to === '/arena')) })).filter((g) => g.items.length);
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);
  const collapsed = prefs.sidebarCollapsed;
  useOfflineSync();

  useEffect(() => {
    try {
      localStorage.setItem('pje:ws', ws.key);
    } catch {
      /* ignore */
    }
  }, [ws.key]);
  useEffect(() => { setDrawer(false); }, [loc.pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const isPro = Boolean(context?.is_edupro);
  return (
    <PushProvider enabled={Boolean(profile && !profile.is_guest)}>
    <div className="min-h-screen bg-ink-50">
      <a href="#main" className="skip-link">Skip to content</a>
      <aside className={cn('nav-surface fixed inset-y-0 left-0 z-30 hidden transition-[width] duration-200 lg:block', collapsed ? 'w-[4.75rem]' : 'w-[17.5rem]')} aria-label="Workspace navigation">
        <Sidebar ws={ws} groups={groups} isPro={isPro} collapsed={collapsed} onToggle={() => setPref('sidebarCollapsed', !collapsed)} onSearch={() => setPalette(true)} />
      </aside>
      <Dlg.Root open={drawer} onOpenChange={setDrawer}>
        <Dlg.Portal>
          <Dlg.Overlay className="fixed inset-0 z-50 bg-ink-950/50 lg:hidden" />
          <Dlg.Content className="nav-surface fixed inset-y-0 left-0 z-50 w-[86%] max-w-[19rem] shadow-2xl data-[state=open]:animate-[drawer-in_.28s_cubic-bezier(.2,.9,.3,1)] lg:hidden" aria-label="Navigation">
            <Dlg.Title className="sr-only">Navigation</Dlg.Title>
            <Dlg.Description className="sr-only">Workspace navigation menu</Dlg.Description>
            <Dlg.Close className="absolute right-3 top-4 z-10 rounded-lg p-1.5 text-white/70 hover:bg-white/10" aria-label="Close menu"><X className="h-5 w-5" /></Dlg.Close>
            <Sidebar ws={ws} groups={groups} isPro={isPro} collapsed={false} onSearch={() => { setDrawer(false); setPalette(true); }} />
          </Dlg.Content>
        </Dlg.Portal>
      </Dlg.Root>

      <div className={cn('transition-[padding] duration-200', collapsed ? 'lg:pl-[4.75rem]' : 'lg:pl-[17.5rem]')}>
        <ConnectionBanner />
        <TopBar onMenu={() => setDrawer(true)} onSearch={() => setPalette(true)} />
        <main id="main" className="container-page pb-28 pt-6 lg:pb-12">
          <MaintenanceBanner />
          <div key={loc.pathname} className="motion-safe:animate-[page-in_.28s_ease-out]"><ErrorBoundary resetKey={loc.pathname}><Outlet /></ErrorBoundary></div>
        </main>
      </div>
      <MobileNav items={groups.flatMap((g) => g.items).filter((i) => i.mobile).slice(0, 4)} onMore={() => setDrawer(true)} />
      <CommandPalette open={palette} onOpenChange={setPalette} groups={groups} />
      <ContrastGuard />
    </div>
    </PushProvider>
  );
}

function Sidebar({ ws, groups, isPro, collapsed, onToggle, onSearch }: { ws: Workspace; groups: NavGroup[]; isPro: boolean; collapsed: boolean; onToggle?: () => void; onSearch: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className={cn('flex h-16 shrink-0 items-center', collapsed ? 'justify-center px-2' : 'px-4')}>
        {collapsed ? <Link to="/dashboard" aria-label="Home"><LogoMark className="h-10 w-10" onDark /></Link> : <Logo to="/dashboard" pro={isPro} light />}
      </div>
      <div className={cn('shrink-0 pb-2', collapsed ? 'px-2' : 'px-3')}>
        <WorkspaceSwitcher current={ws} collapsed={collapsed} />
        <button onClick={onSearch} className={cn('mt-2 flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/5 text-sm text-white/60 transition hover:border-white/20 hover:text-white', collapsed ? 'h-10 justify-center' : 'h-9 px-3')} aria-label="Search and jump (Ctrl K)">
          <Search className="h-4 w-4" />
          {!collapsed && <><span className="flex-1 text-left">Search & jump…</span><kbd className="rounded border border-white/15 px-1.5 text-[0.65rem] font-semibold">Ctrl K</kbd></>}
        </button>
      </div>
      <nav className={cn('scrollbar-thin flex-1 overflow-y-auto pb-4', collapsed ? 'px-2' : 'px-3')} aria-label={`${ws.label} menu`}>
        {groups.map((g, gi) => (
          <div key={gi} className={cn(gi > 0 && 'mt-4')}>
            {g.label && (collapsed
              ? <div className="mx-auto my-2 h-px w-8 bg-white/10" aria-hidden />
              : <p className="mb-1 flex items-center gap-2 px-3 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-white/40">{g.tone && <span className={cn('h-1.5 w-1.5 rounded-full', toneDot[g.tone])} />}{g.label}</p>)}
            <ul className="space-y-0.5">
              {g.items.map((i) => (
                <li key={i.to}>
                  <NavLink to={i.to} end={i.end} title={collapsed ? i.label : undefined}
                    className={({ isActive }) => cn('group relative flex items-center rounded-xl text-sm font-semibold transition',
                      collapsed ? 'h-10 justify-center' : 'gap-3 px-3 py-2',
                      isActive ? 'bg-white/[0.13] text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08)]' : 'text-white/70 hover:bg-white/[0.07] hover:text-white')}>
                    {({ isActive }) => (<>
                      {isActive && <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand-400 shadow-[0_0_12px_var(--color-brand-400)]" aria-hidden />}
                      <i.icon className={cn('h-[1.15rem] w-[1.15rem] shrink-0 transition-transform group-hover:scale-110', isActive && 'text-brand-300')} />
                      {!collapsed && <span className="truncate">{i.label}</span>}
                      {collapsed && <span className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-lg bg-ink-950 px-2.5 py-1.5 text-xs font-semibold text-white opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-visible:opacity-100">{i.label}</span>}
                    </>)}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div className="my-4 border-t border-white/10" />
        <ul className="space-y-0.5">
          {[{ to: '/notifications', label: 'Notifications', icon: Bell }, { to: '/support', label: 'Help & Support', icon: LifeBuoy }, { to: '/settings', label: 'Settings & Appearance', icon: Settings }].map((i) => (
            <li key={i.to}>
              <NavLink to={i.to} title={collapsed ? i.label : undefined} className={({ isActive }) => cn('flex items-center rounded-xl text-sm font-medium transition', collapsed ? 'h-10 justify-center' : 'gap-3 px-3 py-2', isActive ? 'bg-white/[0.13] text-white' : 'text-white/55 hover:bg-white/[0.07] hover:text-white')}>
                <i.icon className="h-4 w-4" />{!collapsed && i.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      {onToggle && (
        <div className="shrink-0 border-t border-white/10 p-2">
          <button onClick={onToggle} className={cn('flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-white/55 hover:bg-white/[0.07] hover:text-white', collapsed && 'justify-center px-0')} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed}>
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <><ChevronsLeft className="h-4 w-4" />Collapse</>}
          </button>
        </div>
      )}
    </div>
  );
}

function WorkspaceSwitcher({ current, collapsed }: { current: Workspace; collapsed: boolean }) {
  const { workspaces } = useAuth();
  const nav = useNavigate();
  const Icon = wsIcon[current.kind];
  return (
    <Menu>
      <MenuTrigger className={cn('flex w-full items-center rounded-xl border border-white/10 bg-white/[0.06] text-left transition hover:border-white/20 hover:bg-white/10', collapsed ? 'h-10 justify-center' : 'gap-3 px-3 py-2.5')} aria-label={`Workspace: ${current.label}. Switch workspace`}>
        <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white', wsAccent[current.kind])}><Icon className="h-4 w-4" /></span>
        {!collapsed && <>
          <span className="min-w-0 flex-1"><span className="block text-[0.65rem] font-bold uppercase tracking-wider text-white/45">Workspace</span><span className="block truncate text-sm font-bold text-white">{current.label}</span></span>
          <ChevronsUpDown className="h-4 w-4 text-white/45" />
        </>}
      </MenuTrigger>
      <MenuContent align="start" className="w-64">
        <MenuLabel>Switch workspace</MenuLabel>
        {workspaces.map((w) => {
          const I = wsIcon[w.kind];
          return (
            <MenuItem key={w.key} onSelect={() => nav(w.home)} icon={<span className={cn('flex h-6 w-6 items-center justify-center rounded-md text-white', wsAccent[w.kind])}><I className="h-3.5 w-3.5" /></span>}>
              <span className="flex-1 truncate">{w.label}</span>{w.key === current.key && <Check className="h-4 w-4 text-brand-600" />}
            </MenuItem>
          );
        })}
        <MenuSeparator />
        <MenuItem onSelect={() => nav('/teach/classes?new=1')} icon={<Presentation className="h-4 w-4" />}>Create my own class</MenuItem>
        <MenuItem onSelect={() => nav('/join')} icon={<Users className="h-4 w-4" />}>Join a class with a code</MenuItem>
        <MenuItem onSelect={() => nav('/schools/apply')} icon={<Building2 className="h-4 w-4" />}>Register a school</MenuItem>
      </MenuContent>
    </Menu>
  );
}

function TopBar({ onMenu, onSearch }: { onMenu: () => void; onSearch: () => void }) {
  const { profile, user, signOut } = useAuth();
  const { isDark, setPref, lowData } = usePrefs();
  const nav = useNavigate();
  return (
    <header className="sticky top-0 z-20 border-b border-ink-200/70 bg-surface/85 backdrop-blur">
      <div className="container-page flex h-16 items-center gap-2">
        <button onClick={onMenu} className="-ml-2 rounded-lg p-2 text-ink-700 hover:bg-ink-100 lg:hidden" aria-label="Open menu"><MenuIcon className="h-6 w-6" /></button>
        <div className="lg:hidden"><Logo to="/dashboard" compact /></div>
        <button onClick={onSearch} className="hidden h-9 max-w-xs flex-1 items-center gap-2 rounded-xl border border-ink-200 bg-ink-50 px-3 text-sm text-ink-500 hover:border-ink-300 md:flex lg:hidden"><Search className="h-4 w-4" />Search & jump…</button>
        <div className="flex-1" />
        {profile?.is_guest && <Link to="/settings?tab=account" className="hidden rounded-full bg-sun-50 px-3 py-1 text-xs font-bold text-sun-700 sm:inline">Guest · save your progress</Link>}
        {lowData && <Link to="/settings?tab=appearance" className="rounded-full bg-ink-100 p-2 text-ink-600" title="Low-data mode is on" aria-label="Low-data mode is on"><WifiLow className="h-4 w-4" /></Link>}
        <button onClick={onSearch} className="rounded-full p-2 text-ink-600 hover:bg-ink-100 md:hidden" aria-label="Search"><Search className="h-5 w-5" /></button>
        <Link to="/ai" className="hidden items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1.5 text-sm font-semibold text-violet-700 hover:bg-violet-100 sm:inline-flex"><Sparkles className="h-4 w-4" />Ask AI</Link>
        <button onClick={() => setPref('theme', isDark ? 'light' : 'dark')} className="rounded-full p-2 text-ink-600 hover:bg-ink-100" aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
          {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
        <PushPill />
        <NotificationBell />
        <Menu>
          <MenuTrigger className="flex items-center gap-2 rounded-full p-0.5 hover:bg-ink-100" aria-label="Account menu">
            <Avatar name={profile?.full_name || user?.email} src={profile?.avatar_url} size={36} />
          </MenuTrigger>
          <MenuContent>
            <div className="px-2.5 py-2">
              <p className="truncate text-sm font-bold text-ink-900">{profile?.full_name || 'Your account'}</p>
              <p className="truncate text-xs text-ink-500">{profile?.is_guest ? 'Guest account' : user?.email}</p>
            </div>
            <MenuSeparator />
            <MenuItem icon={<Settings className="h-4 w-4" />} onSelect={() => nav('/settings')}>Profile & settings</MenuItem>
            <MenuItem icon={<Sun className="h-4 w-4" />} onSelect={() => nav('/settings?tab=appearance')}>Appearance & data</MenuItem>
            <MenuItem icon={<LifeBuoy className="h-4 w-4" />} onSelect={() => nav('/support')}>Help & support</MenuItem>
            <MenuItem icon={<Home className="h-4 w-4" />} onSelect={() => nav('/')}>Public website</MenuItem>
            <MenuSeparator />
            <MenuItem danger icon={<LogOut className="h-4 w-4" />} onSelect={async () => { await signOut(); nav('/login'); }}>Sign out</MenuItem>
          </MenuContent>
        </Menu>
      </div>
    </header>
  );
}

function NotificationBell() {
  const { user } = useAuth();
  const { lowData } = usePrefs();
  const qc = useQueryClient();
  const uid = user?.id;
  const { data: count = 0 } = useQuery({
    queryKey: ['notifications', 'unread', uid],
    enabled: Boolean(uid),
    queryFn: async () => {
      const { count } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
      return count ?? 0;
    },
    refetchInterval: lowData ? false : 120_000,
  });
  useEffect(() => {
    if (!uid || lowData) return;
    const ch = supabase.channel(`notif-${uid}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` }, () => void qc.invalidateQueries({ queryKey: ['notifications'] }))
      .subscribe();
    return () => void supabase.removeChannel(ch);
  }, [uid, qc, lowData]);
  return (
    <Link to="/notifications" className="relative rounded-full p-2 text-ink-600 hover:bg-ink-100" aria-label={`Notifications${count ? `, ${count} unread` : ''}`}>
      <Bell className="h-5 w-5" />
      {count > 0 && <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[0.65rem] font-bold text-white">{count > 99 ? '99+' : count}</span>}
    </Link>
  );
}

function MobileNav({ items, onMore }: { items: NavItem[]; onMore: () => void }) {
  const loc = useLocation();
  const active = items.findIndex((i) => matchPath({ path: i.to, end: Boolean(i.end) }, loc.pathname));
  const n = items.length + 1;
  return (
    <nav aria-label="Quick navigation" className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 lg:hidden">
      <div className="relative grid rounded-[1.4rem] border border-ink-200/70 bg-surface/90 p-1.5 shadow-[0_12px_32px_-10px_rgb(7_20_51/0.45)] backdrop-blur-xl" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {active >= 0 && (
          <span aria-hidden className="absolute inset-y-1.5 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-deep shadow-[0_6px_16px_-6px_var(--color-brand-500)] transition-[left] duration-300 ease-[cubic-bezier(.2,.9,.3,1.25)]"
            style={{ left: `calc(0.375rem + ${active} * ((100% - 0.75rem) / ${n}))`, width: `calc((100% - 0.75rem) / ${n})` }} />
        )}
        {items.map((i, k) => (
          <NavLink key={i.to} to={i.to} end={i.end} className="relative z-10 flex flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[0.66rem] font-bold transition active:scale-90">
            <i.icon className={cn('h-5 w-5 transition-all duration-300', k === active ? '-translate-y-0.5 scale-110 text-white' : 'text-ink-500')} />
            <span className={cn('max-w-full truncate px-1 transition-colors', k === active ? 'text-white' : 'text-ink-500')}>{i.label.replace('My ', '')}</span>
          </NavLink>
        ))}
        <button onClick={onMore} className="relative z-10 flex flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[0.66rem] font-bold text-ink-500 transition active:scale-90"><MenuIcon className="h-5 w-5" />More</button>
      </div>
    </nav>
  );
}

/** Ctrl/⌘ + K: jump to any page in the current workspace or run a quick action. */
function CommandPalette({ open, onOpenChange, groups }: { open: boolean; onOpenChange: (o: boolean) => void; groups: NavGroup[] }) {
  const nav = useNavigate();
  const { workspaces } = useAuth();
  const { setPref, isDark, prefs } = usePrefs();
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const actions = useMemo(() => {
    const pages = groups.flatMap((g) => g.items.map((i) => ({ id: i.to, label: i.label, hint: g.label ?? 'Go to', icon: i.icon, run: () => nav(i.to) })));
    const extra = [
      ...workspaces.map((w) => ({ id: `ws:${w.key}`, label: `Switch to ${w.label}`, hint: 'Workspace', icon: wsIcon[w.kind], run: () => nav(w.home) })),
      { id: 'theme', label: isDark ? 'Switch to light mode' : 'Switch to dark mode', hint: 'Appearance', icon: isDark ? Sun : Moon, run: () => setPref('theme', isDark ? 'light' : 'dark') },
      { id: 'lowdata', label: prefs.lowData === 'on' ? 'Turn off low-data mode' : 'Turn on low-data mode', hint: 'Data', icon: WifiLow, run: () => setPref('lowData', prefs.lowData === 'on' ? 'auto' : 'on') },
      { id: 'join', label: 'Join a class with a code', hint: 'Action', icon: Users, run: () => nav('/join') },
      { id: 'ai', label: 'Ask the AI Companion', hint: 'EduIntelligence', icon: Bot, run: () => nav('/ai') },
      { id: 'arena', label: 'Open the Challenge Arena', hint: 'Arena', icon: Swords, run: () => nav('/arena') },
      { id: 'code', label: 'Open Code Lab', hint: 'EduLab', icon: Code2, run: () => nav('/lab/code') },
    ];
    const all = [...pages, ...extra];
    const seen = new Set<string>();
    return all.filter((a) => (seen.has(a.label) ? false : (seen.add(a.label), true))).filter((a) => !q || `${a.label} ${a.hint}`.toLowerCase().includes(q.toLowerCase())).slice(0, 12);
  }, [groups, workspaces, nav, isDark, setPref, prefs.lowData, q]);
  useEffect(() => { setIdx(0); }, [q, open]);
  const run = (i: number) => { const a = actions[i]; if (!a) return; onOpenChange(false); setQ(''); a.run(); };
  return (
    <Dlg.Root open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setQ(''); }}>
      <Dlg.Portal>
        <Dlg.Overlay className="fixed inset-0 z-[60] bg-ink-950/50" />
        <Dlg.Content className="fixed left-1/2 top-[12vh] z-[60] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border border-ink-200 bg-surface shadow-2xl" aria-label="Command palette">
          <Dlg.Title className="sr-only">Search and jump</Dlg.Title>
          <Dlg.Description className="sr-only">Type to search pages and actions</Dlg.Description>
          <div className="flex items-center gap-3 border-b border-ink-100 px-4">
            <Search className="h-5 w-5 text-ink-400" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search pages and actions…" aria-label="Search pages and actions" className="h-14 flex-1 bg-transparent text-base text-ink-900 outline-none placeholder:text-ink-400"
              onKeyDown={(e) => { if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(i + 1, actions.length - 1)); } else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); } else if (e.key === 'Enter') { e.preventDefault(); run(idx); } }} />
            <kbd className="rounded border border-ink-200 px-1.5 text-xs text-ink-400">Esc</kbd>
          </div>
          <ul className="max-h-[50vh] overflow-y-auto p-2" role="listbox">
            {actions.map((a, i) => (
              <li key={a.id} role="option" aria-selected={i === idx}>
                <button onMouseEnter={() => setIdx(i)} onClick={() => run(i)} className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm', i === idx ? 'bg-brand-50 text-brand-800' : 'text-ink-700')}>
                  <a.icon className="h-4 w-4 shrink-0" /><span className="flex-1 font-medium">{a.label}</span><span className="text-xs text-ink-400">{a.hint}</span>
                </button>
              </li>
            ))}
            {!actions.length && <li className="px-3 py-6 text-center text-sm text-ink-500">No matches</li>}
          </ul>
        </Dlg.Content>
      </Dlg.Portal>
    </Dlg.Root>
  );
}

function MaintenanceBanner() {
  const { data } = usePublicSettings();
  const msg = typeof data?.['maintenance.banner'] === 'string' ? (data['maintenance.banner'] as string) : '';
  if (!msg.trim()) return null;
  return <div role="status" className="mb-5 rounded-2xl border border-sun-400/40 bg-sun-50 px-4 py-3 text-sm font-semibold text-sun-700">📢 {msg}</div>;
}
