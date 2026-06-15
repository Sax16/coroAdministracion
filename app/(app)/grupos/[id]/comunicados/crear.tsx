import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ComunicadoForm } from '@/features/comunicados/components/ComunicadoForm';

/**
 * Pantalla para crear un comunicado (RF-080).
 *
 * Solo accesible para admin del grupo (la RLS lo enforcea).
 * Al guardar, dispara `notificarPush('comunicado_publicado')` para
 * que todos los miembros del grupo reciban el push (RF-083).
 */
export default function CrearComunicadoScreen() {
  const router = useRouter();
  const { id: grupoId } = useLocalSearchParams<{ id: string }>();

  return (
    <>
      <Stack.Screen options={{ title: 'Nuevo comunicado', headerBackTitle: 'Atrás' }} />
      <ComunicadoForm
        mode="create"
        grupoId={grupoId ?? ''}
        onGuardado={() => router.replace(`/(app)/grupos/${grupoId}/comunicados`)}
        onCancelar={() => router.back()}
      />
    </>
  );
}
