
import { createClient } from '@supabase/supabase-js';

export const getSupabase = () => {
  const saved = localStorage.getItem('sdr_api_keys');
  const keys = saved ? JSON.parse(saved) : {};
  if (!keys.supabaseUrl || !keys.supabaseKey) return null;
  
  try {
      return createClient(keys.supabaseUrl, keys.supabaseKey);
  } catch (e) {
      console.error("Failed to init Supabase client", e);
      return null;
  }
}
