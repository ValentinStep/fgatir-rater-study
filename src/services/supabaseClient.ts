/**
 * Supabase Client
 *
 * Typed Supabase client instance for the FGATIR rater application.
 * Reads credentials from Vite environment variables.
 *
 * IMPORTANT: Never expose service-role keys in browser code.
 * Only the anon/public key is used here.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './supabaseTypes';

// --- Configuration Detection ---

/**
 * Check whether Supabase environment variables are configured.
 * Returns false when env vars are empty/missing (local dev mode).
 */
export function isSupabaseConfigured(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

  return Boolean(
    url &&
      key &&
      url !== 'https://your-project.supabase.co' &&
      key !== 'your-anon-key-here',
  );
}

// --- Client Initialization ---

let supabaseInstance: SupabaseClient<Database> | null = null;

/**
 * Get the Supabase client instance.
 * Throws a descriptive error if environment variables are not configured.
 * Use `isSupabaseConfigured()` before calling this to guard gracefully.
 */
export function getSupabaseClient(): SupabaseClient<Database> {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY ' +
        'environment variables. See .env.example for details.',
    );
  }

  if (url === 'https://your-project.supabase.co' || key === 'your-anon-key-here') {
    throw new Error(
      'Supabase environment variables contain placeholder values. ' +
        'Please update VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY with real credentials.',
    );
  }

  supabaseInstance = createClient<Database>(url, key, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
    },
  });

  return supabaseInstance;
}

/**
 * Reset the singleton (for testing purposes only).
 * @internal
 */
export function _resetSupabaseClient(): void {
  supabaseInstance = null;
}
