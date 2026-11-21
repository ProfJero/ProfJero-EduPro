import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, unwrap } from '@/lib/supabase';
import { setUserTimezone } from '@/lib/dates';
import { clearOfflineDataForUser } from '@/lib/offline/store';
import { deriveWorkspaces, type MyContext, type Profile, type Workspace } from './types';

type AuthState = {
  session: Session | null;
  user: User | null;
  initialising: boolean;
  profile: Profile | null | undefined;
  context: MyContext | null | undefined;
  workspaces: Workspace[];
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
};
const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [initialising, setInitialising] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setInitialising(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'SIGNED_OUT') qc.clear();
    });
    return () => sub.subscription.unsubscribe();
  }, [qc]);

  const uid = session?.user.id;
  const profileQ = useQuery({
    queryKey: ['profile', uid],
    enabled: Boolean(uid),
    queryFn: async () => unwrap(await supabase.from('profiles').select('*').eq('id', uid!).maybeSingle()),
  });
  const contextQ = useQuery({
    queryKey: ['my-context', uid],
    enabled: Boolean(uid),
    queryFn: async () => unwrap(await supabase.rpc('my_context')) as unknown as MyContext,
    staleTime: 60_000,
  });

  useEffect(() => setUserTimezone(profileQ.data?.timezone), [profileQ.data?.timezone]);

  // Lightweight presence of "last seen" for teacher dashboards (once per session).
  useEffect(() => {
    if (uid) void supabase.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', uid);
  }, [uid]);

  const refresh = useCallback(async () => {
    await Promise.all([qc.invalidateQueries({ queryKey: ['profile'] }), qc.invalidateQueries({ queryKey: ['my-context'] })]);
  }, [qc]);

  const signOut = useCallback(async () => {
    if (uid) await clearOfflineDataForUser(uid);
    await supabase.auth.signOut();
    qc.clear();
    try {
      Object.keys(localStorage).filter((k) => k.startsWith('pje:')).forEach((k) => localStorage.removeItem(k));
    } catch {
      /* storage unavailable */
    }
  }, [qc, uid]);

  const value = useMemo<AuthState>(() => {
    const ctx = contextQ.data;
    const roles = new Set(ctx?.roles ?? []);
    return {
      session,
      user: session?.user ?? null,
      initialising: initialising || (Boolean(uid) && (profileQ.isLoading || contextQ.isLoading)),
      profile: profileQ.data,
      context: ctx,
      workspaces: deriveWorkspaces(ctx),
      refresh,
      signOut,
      isAdmin: roles.has('platform_admin') || roles.has('owner'),
    };
  }, [session, initialising, uid, profileQ.data, profileQ.isLoading, contextQ.data, contextQ.isLoading, refresh, signOut]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth outside AuthProvider');
  return c;
}
