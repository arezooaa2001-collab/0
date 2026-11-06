import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL, isConfigured } from './config';

/** Persistent session: the learner stays logged in after closing the app or restarting the device. */
export const supabase: SupabaseClient | null = isConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'echowords-auth' },
    })
  : null;

export function sb(): SupabaseClient {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}
