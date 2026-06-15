import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { EnsayoForm } from '@/features/ensayos/components/EnsayoForm';
import { useEnsayo } from '@/features/ensayos/hooks';
import { ActivityIndicator, Text, View } from 'react-native';

/**
 * Pantalla para editar un ensayo (RF-072).
 *
 * Solo accesible para admin. Reutiliza el componente `EnsayoForm` en
 * modo `edit`. Al guardar, vuelve al detalle.
 */
export default function EditarEnsayoScreen() {
  const router = useRouter();
  const { id: grupoId, ensayoId } = useLocalSearchParams<{
    id: string;
    ensayoId: string;
  }>();

  const { ensayo, loading, error } = useEnsayo(ensayoId ?? '');

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  if (error || !ensayo) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 p-6">
        <Stack.Screen options={{ title: 'Editar ensayo' }} />
        <Text className="text-center text-base font-semibold text-slate-700">
          No se pudo cargar el ensayo
        </Text>
        <Text className="mt-2 text-center text-sm text-slate-500">{error}</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Editar ensayo', headerBackTitle: 'Atrás' }} />
      <EnsayoForm
        mode="edit"
        grupoId={grupoId ?? ''}
        ensayo={ensayo}
        onGuardado={() =>
          router.replace(`/(app)/grupos/${grupoId}/ensayos/${ensayoId}`)
        }
        onCancelar={() => router.back()}
      />
    </>
  );
}
