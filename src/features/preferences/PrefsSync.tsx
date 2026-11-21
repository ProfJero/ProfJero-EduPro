import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/authentication/AuthProvider';
import { usePrefs, type Prefs } from './PreferencesProvider';

/** Keeps appearance preferences in the user's profile so they follow them across devices. */
export function PrefsSync() {
  const { profile } = useAuth();
  const { prefs, replacePrefs } = usePrefs();
  const loadedFor = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!profile || loadedFor.current === profile.id) return;
    loadedFor.current = profile.id;
    const saved = (profile.preferences ?? {}) as Partial<Prefs>;
    if (Object.keys(saved).length) replacePrefs(saved);
  }, [profile, replacePrefs]);

  useEffect(() => {
    if (!profile || loadedFor.current !== profile.id) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void supabase.from('profiles').update({ preferences: prefs as never }).eq('id', profile.id);
    }, 1500);
    return () => clearTimeout(timer.current);
  }, [prefs, profile]);
  return null;
}
