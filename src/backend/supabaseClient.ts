import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { config } from '@/config';

let client: SupabaseClient | null = null;

/** Supabase client with the session persisted in AsyncStorage. */
export function getSupabase(): SupabaseClient {
  if (client) return client;
  const instance = createClient(config.supabaseUrl, config.supabaseKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  if (Platform.OS !== 'web') {
    // Refresh the session only while the app is in the foreground.
    AppState.addEventListener('change', (state) => {
      if (state === 'active') instance.auth.startAutoRefresh();
      else instance.auth.stopAutoRefresh();
    });
  }
  client = instance;
  return instance;
}
