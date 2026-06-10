/**
 * Cliente singleton de Supabase.
 *
 * Las claves se exponen con el prefijo EXPO_PUBLIC_ (práctica estándar
 * en Expo cuando las RLS están bien configuradas). Ver
 * docs/06-convenciones-desarrollo.md §7.
 *
 * TODO (post-bootstrap):
 * - Reemplazar las URLs/claves placeholder con las reales del proyecto Supabase `dev`.
 * - Configurar persistencia de sesión con AsyncStorage (Supabase Auth
 *   en RN requiere esto manualmente; el cliente web lo hace solo).
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Persistencia de sesión se configurará cuando se integre AsyncStorage
    autoRefreshToken: true,
    persistSession: false,
    detectSessionInUrl: false,
  },
});
