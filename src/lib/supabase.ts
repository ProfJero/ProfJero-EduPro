import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { env } from './env';

export const supabase = createClient<Database>(env.supabaseUrl || 'http://localhost:54321', env.supabaseAnonKey || 'missing-key', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
  realtime: { params: { eventsPerSecond: 5 } },
});

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type Inserts<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type Updates<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T];

/** Throws a readable Error for Supabase responses; returns data otherwise. */
type ResLike = { data: unknown; error: { message: string; code?: string } | null };
type DataOf<R> = R extends { error: null; data: infer D } ? D : never;
export function unwrap<R extends ResLike>(res: R): DataOf<R> {
  if (res.error) throw toAppError(res.error);
  return res.data as DataOf<R>;
}

export class AppError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

export function toAppError(err: { message: string; code?: string }): AppError {
  return new AppError(friendlyMessage(err.message, err.code), err.code);
}

export function friendlyMessage(message: string, code?: string): string {
  if (code === '42501' && /row-level security/i.test(message)) return 'You do not have permission to do that.';
  if (code === '23505') return 'That already exists. Try a different value.';
  if (/JWT expired/i.test(message)) return 'Your session expired. Please sign in again.';
  if (/Failed to fetch|NetworkError/i.test(message)) return 'You appear to be offline. Check your connection and try again.';
  return message;
}
