import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/authentication/AuthProvider';

export type RoomType = 'course' | 'class' | 'session' | 'group' | 'space';
export type PresenceMember = { user_id: string; name: string; avatar_url: string | null; role: 'teacher' | 'learner'; hand: boolean; hand_at?: string; where?: string };

/**
 * Live "who is in class" presence on a PRIVATE realtime channel.
 * Channel access is authorised in Postgres (realtime.messages RLS), so only
 * members of the classroom can join or see who is present.
 */
export function useClassPresence(type: RoomType, roomId: string | undefined, opts: { role: 'teacher' | 'learner'; where?: string; enabled?: boolean }) {
  const { user, profile } = useAuth();
  const [members, setMembers] = useState<PresenceMember[]>([]);
  const [hand, setHandState] = useState(false);
  const [status, setStatus] = useState<'connecting' | 'live' | 'offline'>('connecting');
  const chRef = useRef<RealtimeChannel | null>(null);
  const meRef = useRef<PresenceMember | null>(null);
  const enabled = opts.enabled !== false;

  useEffect(() => {
    if (!user || !roomId || !enabled) return;
    const me: PresenceMember = {
      user_id: user.id, name: profile?.display_name || profile?.full_name || 'Learner', avatar_url: profile?.avatar_url ?? null,
      role: opts.role, hand: false, where: opts.where,
    };
    meRef.current = me;
    const ch = supabase.channel(`room:${type}:${roomId}`, { config: { private: true, presence: { key: user.id } } });
    chRef.current = ch;
    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState<PresenceMember>();
      const list = Object.values(state).map((arr) => arr[arr.length - 1]).filter(Boolean) as PresenceMember[];
      list.sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === 'teacher' ? -1 : 1));
      setMembers(list);
    })
      .on('broadcast', { event: 'lower-hand' }, ({ payload }) => {
        if (payload?.user_id === user.id || payload?.all) {
          setHandState(false);
          if (meRef.current) void ch.track({ ...meRef.current, hand: false });
        }
      })
      .subscribe(async (s) => {
        if (s === 'SUBSCRIBED') {
          setStatus('live');
          await ch.track(me);
        } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') setStatus('offline');
      });
    return () => {
      void supabase.removeChannel(ch);
      chRef.current = null;
    };
  }, [user, roomId, type, enabled, opts.role, opts.where, profile?.display_name, profile?.full_name, profile?.avatar_url]);

  const setHand = useCallback(async (v: boolean) => {
    setHandState(v);
    if (chRef.current && meRef.current) {
      meRef.current = { ...meRef.current, hand: v, hand_at: v ? new Date().toISOString() : undefined };
      await chRef.current.track(meRef.current);
    }
  }, []);

  const lowerHand = useCallback(async (userId?: string) => {
    await chRef.current?.send({ type: 'broadcast', event: 'lower-hand', payload: userId ? { user_id: userId } : { all: true } });
  }, []);

  return { members, hand, setHand, lowerHand, status };
}
