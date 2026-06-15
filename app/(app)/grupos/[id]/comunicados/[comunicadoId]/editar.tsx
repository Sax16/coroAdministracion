import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';

import { ComunicadoForm } from '@/features/comunicados/components/ComunicadoForm';
import { useComunicado } from '@/features/comunicados/hooks';

/**
 * Pantalla para editar un comunicado (RF-081).
 *
 * Solo accesible para admin del grupo (la RLS lo enforcea).
 * Reutiliza el componente `ComunicadoForm` en modo `edit`.
 */
export default function EditarComunicadoScreen() {
  const router = useRouter();
  const { id: grupoId, comunicadoId } = useLocalSearchParams<{
    id: string;
    comunicadoId: string;
  }>();

  const { comunicado, loading, error } = useComunicado(comunicadoId ?? '');

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  if (error || !comunicado) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 p-6">
        <Stack.Screen options={{ title: 'Editar comunicado' }} />
        <Text className="text-center text-base font-semibold text-slate-700">
          No se pudo cargar el comunicado
        </Text>
        <Text className="mt-2 text-center text-sm text-slate-500">{error}</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Editar comunicado', headerBackTitle: 'Atrás' }} />
      <ComunicadoForm
        mode="edit"
        grupoId={grupoId ?? ''}
        comunicado={comunicado}
        onGuardado={() =>
          router.replace(`/(app)/grupos/${grupoId}/comunicados/${comunicadoId}`)
        }
        onCancelar={() => router.back()}
      />
    </>
  );
}
