import type { ReactNode } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { EmptyState, Spinner, ButtonLink } from '@/components/ui';

export function FullPageSpinner() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Spinner className="h-8 w-8" />
    </div>
  );
}

/** UX guard only — the database enforces every permission independently. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, initialising, profile } = useAuth();
  const loc = useLocation();
  if (initialising) return <FullPageSpinner />;
  if (!session) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  if (profile && profile.status === 'suspended') return <Navigate to="/suspended" replace />;
  if (profile && !profile.onboarding_completed && !loc.pathname.startsWith('/onboarding')) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function NoAccess() {
  return (
    <div className="container-page py-16">
      <EmptyState icon={<ShieldAlert className="h-7 w-7" />} title="You don't have access to this workspace"
        description="If you believe this is a mistake, ask your school administrator or contact support."
        action={<ButtonLink to="/learn">Go to my learning</ButtonLink>} />
    </div>
  );
}

export function RequireWorkspace({ kind, children }: { kind: 'teacher' | 'admin' | 'school'; children: ReactNode }) {
  const { workspaces, initialising } = useAuth();
  const { schoolId } = useParams();
  if (initialising) return <FullPageSpinner />;
  const ok = kind === 'school' ? workspaces.some((w) => w.kind === 'school' && w.schoolId === schoolId) || workspaces.some((w) => w.kind === 'admin') : workspaces.some((w) => w.kind === kind);
  return ok ? <>{children}</> : <NoAccess />;
}
