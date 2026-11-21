import { useQuery } from '@tanstack/react-query';
import { supabase, unwrap } from '@/lib/supabase';

export function usePublicSettings() {
  return useQuery({
    queryKey: ['public-settings'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const rows = unwrap(await supabase.from('platform_settings').select('key, value').eq('is_public', true));
      return Object.fromEntries(rows.map((r) => [r.key, r.value])) as Record<string, unknown>;
    },
  });
}
