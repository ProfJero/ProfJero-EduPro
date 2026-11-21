import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/authentication/AuthProvider';
import { dequeue, readQueue } from '@/lib/offline/store';

/** Replays lesson completions recorded while offline (idempotent RPC). */
export function useOfflineSync() {
  const { user } = useAuth();
  const qc = useQueryClient();
  useEffect(() => {
    if (!user) return;
    const uid = user.id;
    const flush = async () => {
      if (!navigator.onLine) return;
      const q = readQueue(uid);
      let changed = false;
      for (const lessonId of q) {
        const { error } = await supabase.rpc('complete_lesson', { p_lesson: lessonId });
        // Remove on success, or on a permanent rule error (it will never succeed offline-queued).
        if (!error || !/fetch|network/i.test(error.message)) {
          dequeue(uid, lessonId);
          changed = true;
        }
      }
      if (changed) {
        void qc.invalidateQueries({ queryKey: ['progress'] });
        void qc.invalidateQueries({ queryKey: ['my-courses'] });
      }
    };
    void flush();
    window.addEventListener('online', flush);
    return () => window.removeEventListener('online', flush);
  }, [user, qc]);
}
