/**
 * Cliente singleton de Supabase.
 *
 * Configuración:
 * - Auth: persistencia de sesión con AsyncStorage (RN no tiene localStorage nativo).
 * - Las keys se exponen con prefijo `EXPO_PUBLIC_` (Expo las inyecta en el bundle
 * del cliente). Es seguro SI las RLS están bien configuradas — el cliente
 * solo puede leer/escribir lo que las policies permitan.
 * - `detectSessionInUrl: false` → en mobile no hay URL callback.
 *
 * Variables de entorno esperadas (definidas en .env, que está en .gitignore):
 * - EXPO_PUBLIC_SUPABASE_URL
 * - EXPO_PUBLIC_SUPABASE_ANON_KEY
 *
 * Ver docs/06-convenciones-desarrollo.md §7 para la política de secrets.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
 throw new Error(
 'Faltan variables de entorno de Supabase. ' +
 'Asegurate de tener un .env en la raíz con EXPO_PUBLIC_SUPABASE_URL y ' +
 'EXPO_PUBLIC_SUPABASE_ANON_KEY. Ver docs/06-convenciones-desarrollo.md §7.',
 );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
 auth: {
 storage: AsyncStorage,
 autoRefreshToken: true,
 persistSession: true,
 detectSessionInUrl: false,
 },
});
