import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { supabase } from '@/lib/supabase';

type ConnectionState = 'checking' | 'ok' | 'error';

export default function Home() {
 const [state, setState] = useState<ConnectionState>('checking');
 const [errorMsg, setErrorMsg] = useState<string | null>(null);

 useEffect(() => {
 let cancelled = false;

 async function checkConnection() {
 // Ping liviano: consulta una tabla inexistente y verificamos
 // que Supabase responde (no el contenido). Si RLS/auth/red
 // están bien configurados, llega un error de "tabla no existe"
 // o "no permission" — eso significa que la conexión funciona.
 const { error } = await supabase.from('_healthcheck').select('*').limit(0);

 if (cancelled) return;

 // PGRST116 = table not found,42501 = insufficient privilege.
 // Ambos confirman que llegamos al backend de Supabase.
 if (!error || error.code === 'PGRST116' || error.code === '42501') {
 setState('ok');
 } else {
 setState('error');
 setErrorMsg(error.message);
 }
 }

 void checkConnection();
 return () => {
 cancelled = true;
 };
 }, []);

 return (
 <View className="flex-1 items-center justify-center bg-white p-6">
 <Text className="text-2xl font-bold text-primary-600">Coro Administración</Text>
 <Text className="mt-2 text-base text-slate-500">Bootstrap inicial.</Text>

 <View className="mt-8 w-full rounded-lg border border-slate-200 bg-slate-50 p-4">
 <Text className="text-sm font-semibold text-slate-700">
 Estado de conexión con Supabase
 </Text>
 {state === 'checking' && (
 <View className="mt-3 flex-row items-center">
 <ActivityIndicator size="small" />
 <Text className="ml-2 text-sm text-slate-600">Verificando…</Text>
 </View>
 )}
 {state === 'ok' && (
 <Text className="mt-3 text-sm text-emerald-600">
 ✓ Conectado a {process.env.EXPO_PUBLIC_SUPABASE_URL}
 </Text>
 )}
 {state === 'error' && (
 <Text className="mt-3 text-sm text-red-600">✗ Error: {errorMsg}</Text>
 )}
 </View>

 <Text className="mt-6 text-center text-xs text-slate-400">
 Próximos pasos: auth, grupos, servicios.
 </Text>
 </View>
 );
}
