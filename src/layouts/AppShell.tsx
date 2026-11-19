import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Dlg from '@radix-ui/react-dialog';
import {
  Award, BarChart3, Bell, BookMarked, BookOpen, Building2, CalendarDays, Check, ChevronsUpDown, ClipboardCheck, ClipboardList, Compass,
  CreditCard, FileStack, FolderOpen, GraduationCap, Home, LayoutDashboard, LifeBuoy, LogOut, Megaphone, Menu as MenuIcon, MessagesSquare,
  Presentation, ScrollText, Settings, ShieldCheck, Tags, TrendingUp, UserCog, Users, Video, X, Library, Inbox, CalendarCheck,
} from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { Avatar, Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from '@/components/ui';
import { ConnectionBanner } from '@/components/app/ConnectionBanner';
import { useAuth } from '@/features/authentication/AuthProvider';
import type { Workspace } from '@/features/authentication/types';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { useOfflineSync } from '@/features/learning/useOfflineSync';

type NavItem = { to: string; label: string; icon: ComponentType<{ className?: string }>; end?: boolean; mobile?: boolean };

function navFor(ws: Workspace): NavItem[] {
  switch (ws.kind) {
    case 'learner':
      return [
        { to: '/learn', label: 'Overview', icon: Home, end: true, mobile: true },
        { to: '/learn/courses', label: 'My Learning', icon: BookOpen, mobile: true },
        { to: '/learn/explore', label: 'Explore Courses', icon: Compass },
        { to: '/learn/classes', label: 'Classes', icon: Presentation, mobile: true },
        { to: '/learn/assessments', label: 'Assessments', icon: ClipboardCheck },
        { to: '/learn/assignments', label: 'Assignments', icon: ClipboardList, mobile: true },
        { to: '/learn/resources', label: 'Resources', icon: BookMarked },
        { to: '/learn/progress', label: 'Progress', icon: TrendingUp },
        { to: '/learn/certificates', label: 'Certificates', icon: Award },
      ];
    case 'teacher':
      return [
        { to: '/teach', label: 'Overview', icon: LayoutDashboard, end: true, mobile: true },
        { to: '/teach/courses', label: 'My Courses', icon: BookOpen, mobile: true },
        { to: '/teach/classes', label: 'My Classes', icon: Presentation, mobile: true },
        { to: '/teach/lessons', label: 'Lessons', icon: FileStack },
        { to: '/teach/assessments', label: 'Assessments', icon: ClipboardCheck },
        { to: '/teach/banks', label: 'Question Banks', icon: Library },
        { to: '/teach/assignments', label: 'Assignments', icon: ClipboardList, mobile: true },
        { to: '/teach/live', label: 'Live Classes', icon: Video },
        { to: '/teach/students', label: 'Students', icon: Users },
        { to: '/teach/resources', label: 'Resources', icon: FolderOpen },
        { to: '/teach/announcements', label: 'Announcements', icon: Megaphone },
        { to: '/teach/reports', label: 'Reports', icon: BarChart3 },
      ];
    case 'school': {
      const b = `/school/${ws.schoolId}`;
      return [
        { to: b, label: 'Overview', icon: LayoutDashboard, end: true, mobile: true },
        { to: `${b}/students`, label: 'Students', icon: GraduationCap, mobile: true },
        { to: `${b}/teachers`, label: 'Teachers', icon: Users, mobile: true },
        { to: `${b}/classes`, label: 'Classes', icon: Presentation, mobile: true },
        { to: `${b}/academic`, label: 'Academic Structure', icon: CalendarDays },
        { to: `${b}/courses`, label: 'Courses', icon: BookOpen },
        { to: `${b}/attendance`, label: 'Attendance', icon: CalendarCheck },
        { to: `${b}/announcements`, label: 'Announcements', icon: Megaphone },
        { to: `${b}/reports`, label: 'Reports', icon: BarChart3 },
        { to: `${b}/settings`, label: 'School Settings', icon: Settings },
      ];
    }
    case 'admin':
      return [
        { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true, mobile: true },
        { to: '/admin/users', label: 'Users', icon: UserCog, mobile: true },
        { to: '/admin/schools', label: 'Schools', icon: Building2, mobile: true },
        { to: '/admin/teachers', label: 'Teachers', icon: Presentation },
        { to: '/admin/courses', label: 'Courses & Content', icon: BookOpen, mobile: true },
        { to: '/admin/categories', label: 'Categories', icon: Tags },
        { to: '/admin/assessments', label: 'Assessments & Assignments', icon: ClipboardCheck },
        { to: '/admin/certificates', label: 'Certificates', icon: Award },
        { to: '/admin/live', label: 'Live Classes', icon: Video },
        { to: '/admin/subscriptions', label: 'Edu / EduPro Plans', icon: CreditCard },
        { to: '/admin/announcements', label: 'Announcements', icon: Megaphone },
        { to: '/admin/support', label: 'Support', icon: LifeBuoy },
        { to: '/admin/inbox', label: 'Contact Inbox', icon: Inbox },
        { to: '/admin/audit', label: 'Audit Logs', icon: ScrollText },
        { to: '/admin/settings', label: 'Settings', icon: Settings },
      ];
  }
}

function activeWorkspace(path: string, workspaces: Workspace[]): Workspace {
  if (path.startsWith('/teach')) return workspaces.find((w) => w.kind === 'teacher') ?? workspaces[0];
  if (path.startsWith('/admin')) return workspaces.find((w) => w.kind === 'admin') ?? workspaces[0];
  if (path.startsWith('/school/')) {
    const id = path.split('/')[2];
    return workspaces.find((w) => w.kind === 'school' && w.schoolId === id)
      ?? { kind: 'school', key: `school:${id}`, label: 'School', home: `/school/${id}`, schoolId: id };
  }
  const remembered = localStorageGet('pje:ws');
  if (!path.startsWith('/learn') && remembered) return workspaces.find((w) => w.key === remembered) ?? workspaces[0];
  return workspaces[0];
}
function localStorageGet(k: string) {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}

const wsIcon: Record<Workspace['kind'], ComponentType<{ className?: string }>> = { learner: GraduationCap, teacher: Presentation, school: Building2, admin: ShieldCheck };
const wsAccent: Record<Workspace['kind'], string> = { learner: 'bg-brand-600', teacher: 'bg-growth-600', school: 'bg-sun-500', admin: 'bg-ink-900' };

export function AppShell() {
  const { workspaces, context } = useAuth();
  const loc = useLocation();
  const ws = useMemo(() => activeWorkspace(loc.pathname, workspaces), [loc.pathname, workspaces]);
  const items = navFor(ws);
  const [drawer, setDrawer] = useState(false);
  useOfflineSync();

  useEffect(() => {
    try {
      localStorage.setItem('pje:ws', ws.key);
    } catch {
      /* ignore */
    }
  }, [ws.key]);
  useEffect(() => setDrawer(false), [loc.pathname]);

  const sidebar = <Sidebar ws={ws} items={items} isPro={Boolean(context?.is_edupro)} />;
  return (
    <div className="min-h-screen bg-ink-50">
      <a href="#main" className="skip-link">Skip to content</a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[17rem] border-r border-ink-200 bg-white lg:block" aria-label="Workspace navigation">{sidebar}</aside>
      <Dlg.Root open={drawer} onOpenChange={setDrawer}>
        <Dlg.Portal>
          <Dlg.Overlay className="fixed inset-0 z-50 bg-ink-950/40 lg:hidden" />
          <Dlg.Content className="fixed inset-y-0 left-0 z-50 w-[85%] max-w-xs bg-white shadow-2xl lg:hidden" aria-label="Navigation">
            <Dlg.Title className="sr-only">Navigation</Dlg.Title>
            <Dlg.Description className="sr-only">Workspace navigation menu</Dlg.Description>
            <Dlg.Close className="absolute right-3 top-4 rounded-lg p-1.5 text-ink-500 hover:bg-ink-100" aria-label="Close menu"><X className="h-5 w-5" /></Dlg.Close>
            {sidebar}
          </Dlg.Content>
        </Dlg.Portal>
      </Dlg.Root>

      <div className="lg:pl-[17rem]">
        <ConnectionBanner />
        <TopBar onMenu={() => setDrawer(true)} />
        <main id="main" className="container-page pb-28 pt-6 lg:pb-12">
          <Outlet />
        </main>
      </div>
      <MobileNav items={items.filter((i) => i.mobile).slice(0, 4)} onMore={() => setDrawer(true)} />
    </div>
  );
}

function Sidebar({ ws, items, isPro }: { ws: Workspace; items: NavItem[]; isPro: boolean }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-5"><Logo to="/dashboard" pro={isPro} /></div>
      <div className="px-3 pb-3"><WorkspaceSwitcher current={ws} /></div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4" aria-label={`${ws.label} menu`}>
        {items.map((i) => (
          <NavLink key={i.to} to={i.to} end={i.end}
            className={({ isActive }) => cn('group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition', isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900')}>
            <i.icon className="h-[1.15rem] w-[1.15rem] shrink-0" />
            {i.label}
          </NavLink>
        ))}
        <div className="my-3 border-t border-ink-100" />
        {[
          { to: '/notifications', label: 'Notifications', icon: Bell },
          { to: '/discussions', label: 'Discussions', icon: MessagesSquare },
          { to: '/support', label: 'Help & Support', icon: LifeBuoy },
          { to: '/settings', label: 'Profile & Settings', icon: Settings },
        ].map((i) => (
          <NavLink key={i.to} to={i.to} className={({ isActive }) => cn('flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium', isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-500 hover:bg-ink-50 hover:text-ink-800')}>
            <i.icon className="h-4 w-4" />{i.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function WorkspaceSwitcher({ current }: { current: Workspace }) {
  const { workspaces } = useAuth();
  const nav = useNavigate();
  const Icon = wsIcon[current.kind];
  return (
    <Menu>
      <MenuTrigger className="flex w-full items-center gap-3 rounded-xl border border-ink-200 bg-ink-50/60 px-3 py-2.5 text-left hover:border-ink-300" aria-label="Switch workspace">
        <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white', wsAccent[current.kind])}><Icon className="h-4 w-4" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[0.65rem] font-bold uppercase tracking-wider text-ink-400">Workspace</span>
          <span className="block truncate text-sm font-bold text-ink-900">{current.label}</span>
        </span>
        <ChevronsUpDown className="h-4 w-4 text-ink-400" />
      </MenuTrigger>
      <MenuContent align="start" className="w-64">
        <MenuLabel>Switch workspace</MenuLabel>
        {workspaces.map((w) => {
          const I = wsIcon[w.kind];
          return (
            <MenuItem key={w.key} onSelect={() => nav(w.home)} icon={<span className={cn('flex h-6 w-6 items-center justify-center rounded-md text-white', wsAccent[w.kind])}><I className="h-3.5 w-3.5" /></span>}>
              <span className="flex-1 truncate">{w.label}</span>
              {w.key === current.key && <Check className="h-4 w-4 text-brand-600" />}
            </MenuItem>
          );
        })}
        <MenuSeparator />
        <MenuItem onSelect={() => nav('/schools/apply')} icon={<Building2 className="h-4 w-4" />}>Register a school</MenuItem>
      </MenuContent>
    </Menu>
  );
}

function TopBar({ onMenu }: { onMenu: () => void }) {
  const { profile, user, signOut } = useAuth();
  const nav = useNavigate();
  return (
    <header className="sticky top-0 z-20 border-b border-ink-200/70 bg-white/85 backdrop-blur">
      <div className="container-page flex h-16 items-center gap-3">
        <button onClick={onMenu} className="-ml-2 rounded-lg p-2 text-ink-700 hover:bg-ink-100 lg:hidden" aria-label="Open menu"><MenuIcon className="h-6 w-6" /></button>
        <div className="lg:hidden"><Logo to="/dashboard" compact /></div>
        <div className="flex-1" />
        <NotificationBell />
        <Menu>
          <MenuTrigger className="flex items-center gap-2 rounded-full p-0.5 hover:bg-ink-100" aria-label="Account menu">
            <Avatar name={profile?.full_name || user?.email} src={profile?.avatar_url} size={36} />
          </MenuTrigger>
          <MenuContent>
            <div className="px-2.5 py-2">
              <p className="truncate text-sm font-bold text-ink-900">{profile?.full_name || 'Your account'}</p>
              <p className="truncate text-xs text-ink-500">{user?.email}</p>
            </div>
            <MenuSeparator />
            <MenuItem icon={<Settings className="h-4 w-4" />} onSelect={() => nav('/settings')}>Profile & settings</MenuItem>
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
  const qc = useQueryClient();
  const uid = user?.id;
  const { data: count = 0 } = useQuery({
    queryKey: ['notifications', 'unread', uid],
    enabled: Boolean(uid),
    queryFn: async () => {
      const { count } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
      return count ?? 0;
    },
    refetchInterval: 120_000,
  });
  useEffect(() => {
    if (!uid) return;
    const ch = supabase
      .channel(`notif-${uid}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` }, () => {
        void qc.invalidateQueries({ queryKey: ['notifications'] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [uid, qc]);
  return (
    <Link to="/notifications" className="relative rounded-full p-2 text-ink-600 hover:bg-ink-100" aria-label={`Notifications${count ? `, ${count} unread` : ''}`}>
      <Bell className="h-5 w-5" />
      {count > 0 && <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[0.65rem] font-bold text-white">{count > 99 ? '99+' : count}</span>}
    </Link>
  );
}

function MobileNav({ items, onMore }: { items: NavItem[]; onMore: () => void }) {
  return (
    <nav aria-label="Quick navigation" className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <div className="grid grid-cols-5">
        {items.map((i) => (
          <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => cn('flex flex-col items-center gap-0.5 py-2 text-[0.68rem] font-semibold', isActive ? 'text-brand-700' : 'text-ink-500')}>
            <i.icon className="h-5 w-5" />
            <span className="truncate px-1">{i.label}</span>
          </NavLink>
        ))}
        <button onClick={onMore} className="flex flex-col items-center gap-0.5 py-2 text-[0.68rem] font-semibold text-ink-500">
          <MenuIcon className="h-5 w-5" />More
        </button>
      </div>
    </nav>
  );
}
