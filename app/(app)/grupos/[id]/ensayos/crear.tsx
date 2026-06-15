import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { EnsayoForm } from '@/features/ensayos/components/EnsayoForm';

/**
 * Pantalla para crear un ensayo nuevo (RF-070).
 *
 * Solo accesible para admin del grupo. Usa el componente compartido
 * `EnsayoForm` en modo `create`.
 */
export default function CrearEnsayoScreen() {
  const router = useRouter();
  const { id: grupoId } = useLocalSearchParams<{ id: string }>();

  return (
    <>
      <Stack.Screen options={{ title: 'Nuevo ensayo', headerBackTitle: 'Atrás' }} />
      <EnsayoForm
        mode="create"
        grupoId={grupoId ?? ''}
        onGuardado={() => router.replace(`/(app)/grupos/${grupoId}/ensayos`)}
        onCancelar={() => router.back()}
      />
    </>
  );
}
