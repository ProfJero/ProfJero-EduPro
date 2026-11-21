import { Navigate } from 'react-router-dom';
import { useAuth } from '@/features/authentication/AuthProvider';

export function DashboardRedirect() {
  const { workspaces } = useAuth();
  let key: string | null = null;
  try {
    key = localStorage.getItem('pje:ws');
  } catch {
    /* ignore */
  }
  const ws = workspaces.find((w) => w.key === key) ?? workspaces[0];
  return <Navigate to={ws.home} replace />;
}
