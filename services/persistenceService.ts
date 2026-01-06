
import { getSupabase } from './supabaseClient';

let isOffline = false;

export const persistenceService = {
  async save(key: string, data: any) {
    if (isOffline) return;
    const supabase = getSupabase();
    if (!supabase) return;
    
    try {
        const { error } = await supabase
          .from('nexus_store')
          .upsert({ id: key, data, updated_at: new Date() }, { onConflict: 'id' });
          
        if (error) {
            // Check for missing table error
            if (error.message?.includes('Could not find the table') || error.code === '42P01') {
                console.warn(`[Supabase] Table 'nexus_store' not found. Disabling cloud sync for this session.`);
                isOffline = true;
                return;
            }
            console.error(`Supabase Save Error for key ${key}:`, error.message);
        } else {
            console.log(`[Supabase] Synced ${key}`);
        }
    } catch (e: any) {
        console.error(`Supabase Save Exception: ${e.message}`);
    }
  },
  
  async load(key: string) {
    if (isOffline) return null;
    const supabase = getSupabase();
    if (!supabase) return null;
    
    try {
        const { data, error } = await supabase
          .from('nexus_store')
          .select('data')
          .eq('id', key)
          .single();
          
        if (error) {
            // Ignore 406/Not Found errors cleanly (PGRST116)
            if (error.code === 'PGRST116') {
                return null;
            }
            
            // Check for missing table error
            if (error.message?.includes('Could not find the table') || error.code === '42P01') {
                console.warn(`[Supabase] Table 'nexus_store' not found. Disabling cloud sync for this session.`);
                isOffline = true;
                return null;
            }

            console.error(`Supabase Load Error for key ${key}:`, error.message);
            return null;
        }
        return data?.data;
    } catch (e: any) {
        console.error(`Supabase Load Exception: ${e.message}`);
        return null;
    }
  }
}
