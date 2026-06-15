import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useEliminarCuenta } from '@/features/auth/hooks';
import { GrupoConRol } from '@/features/grupos/api';
import { useAccionesGrupo, useGruposAdminActivos } from '@/features/grupos/hooks';

/**
 * Flujo destructivo "Eliminar mi cuenta" (RF-006).
 *
 * **Doble barrera**, como pide RNF-014:
 *
 * 1. **Pre-check en UI:** al entrar, listamos los grupos donde el
 *    usuario es admin. La DB function `eliminar_cuenta()` rechaza el
 *    borrado si quedan grupos activos con `admin_id = uid`. En vez de
 *    dejar que la DB falle al final, mostramos el bloqueo acá y damos
 *    CTAs inline: "Transferir admin" o "Eliminar grupo" para cada uno.
 *    El botón "Eliminar cuenta" queda deshabilitado hasta que la lista
 *    quede vacía.
 *
 * 2. **Confirmación explícita:** una vez desbloqueado, el usuario tiene
 *    que tipear exactamente "ELIMINAR" en un input. Esto es el patrón
 *    clásico de "typed confirmation" para acciones destructivas
 *    irreversibles. Sin este tipeo, el botón no se activa.
 *
 * Decisiones de UX:
 * - Toda la pantalla es scrollable porque el listado de grupos puede
 *   ser largo.
 * - Después de borrar, el hook limpia los stores y el `_layout` de
 *   `(app)` redirige a login. No necesitamos navegar manualmente.
 */
export default function EliminarCuentaScreen() {
  const router = useRouter();
  const { eliminar, loading: deleting, error: deleteError } =
    useEliminarCuenta();
  const { eliminar: eliminarGrupo } = useAccionesGrupo();
  const {
    grupos: gruposAdmin,
    loading: loadingGrupos,
    refetch: refetchGrupos,
  } = useGruposAdminActivos();

  const [confirmText, setConfirmText] = useState('');
  const [eliminandoGrupoId, setEliminandoGrupoId] = useState<string | null>(
    null,
  );

  const gruposBloqueantes = gruposAdmin;
  const bloqueadoPorGrupo = gruposBloqueantes.length > 0;
  const puedeConfirmar =
    !bloqueadoPorGrupo && confirmText.trim().toUpperCase() === 'ELIMINAR';
  const submitting = deleting || eliminandoGrupoId !== null;

  const onPressEliminar = useCallback(() => {
    if (!puedeConfirmar) return;
    Alert.alert(
      'Última confirmación',
      'Vas a eliminar tu cuenta de forma permanente. Esta acción no se puede deshacer.\n\n¿Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, eliminar',
          style: 'destructive',
          onPress: async () => {
            const ok = await eliminar();
            if (ok) {
              // El _layout de (app) va a detectar user=null y redirigir.
              // No necesitamos hacer navigate manual.
            }
          },
        },
      ],
    );
  }, [puedeConfirmar, eliminar]);

  const onEliminarGrupo = useCallback(
    (g: GrupoConRol) => {
      Alert.alert(
        `Eliminar "${g.nombre}"`,
        'Esta acción es destructiva:\n\n' +
          '• Se borra el grupo para todos los miembros (soft delete).\n' +
          '• Los servicios, ensayos y comunicados históricos se conservan, ' +
          'pero el grupo deja de ser visible.\n' +
          '• Los miembros quedan inactivos en este grupo.\n\n' +
          '¿Continuar?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Eliminar grupo',
            style: 'destructive',
            onPress: async () => {
              setEliminandoGrupoId(g.id);
              const ok = await eliminarGrupo(g.id);
              setEliminandoGrupoId(null);
              if (ok) {
                await refetchGrupos();
              }
            },
          },
        ],
      );
    },
    [eliminarGrupo, refetchGrupos],
  );

  // Si la DB rechaza con el mensaje "Debes transferir o eliminar el
  // grupo …" porque el pre-check se desactualizó, lo traducimos a una
  // alerta explicativa y re-fetcheamos la lista.
  useEffect(() => {
    if (deleteError && /transferir o eliminar el grupo/i.test(deleteError)) {
      Alert.alert(
        'Antes de continuar',
        'La base de datos detectó que seguís siendo admin de al menos un grupo. ' +
          'Transferí el rol o eliminá el grupo y volvé a intentar.',
        [{ text: 'Entendido' }],
      );
      void refetchGrupos();
    }
  }, [deleteError, refetchGrupos]);

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['bottom']}>
      <Stack.Screen
        options={{
          title: 'Eliminar cuenta',
          headerBackTitle: 'Perfil',
        }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerClassName="p-4 pb-12"
          keyboardShouldPersistTaps="handled"
        >
          {/* Encabezado */}
          <View className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
            <Text className="text-base font-bold text-red-900">
              ¿Qué pasa si elimino mi cuenta?
            </Text>
            <View className="mt-2 gap-1.5">
              <BulletItem texto="Se borra tu perfil y tu acceso a la plataforma." />
              <BulletItem texto="Tus membresías a grupos pasan a estado inactivo (no se borra tu historial de participación)." />
              <BulletItem texto="No se eliminan los servicios, ensayos, comunicados ni asignaciones que generaste — quedan en el historial del grupo." />
              <BulletItem texto="Si sos admin de un grupo, tenés que transferir el rol o eliminarlo antes." />
            </View>
          </View>

          {/* Bloque 1: grupos donde soy admin */}
          <View className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
            <Text className="text-sm font-semibold text-slate-900">
              Grupos donde sos admin
            </Text>
            <Text className="mt-1 text-xs text-slate-500">
              Estos grupos quedarían sin admin. Para cada uno, transferí
              el rol a otro miembro o eliminalo.
            </Text>

            {loadingGrupos ? (
              <View className="mt-3 items-center py-2">
                <ActivityIndicator color="#4f46e5" />
              </View>
            ) : gruposBloqueantes.length === 0 ? (
              <View className="mt-3 flex-row items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
                <Text className="text-base">✅</Text>
                <Text className="flex-1 text-sm text-emerald-800">
                  No sos admin de ningún grupo activo. Podés continuar.
                </Text>
              </View>
            ) : (
              <View className="mt-3 gap-2">
                {gruposBloqueantes.map((g) => (
                  <GrupoAdminRow
                    key={g.id}
                    grupo={g}
                    eliminando={eliminandoGrupoId === g.id}
                    onTransferir={() =>
                      router.push(
                        `/(app)/grupos/${g.id}/transferir-admin?origen=eliminar-cuenta`,
                      )
                    }
                    onEliminar={() => onEliminarGrupo(g)}
                  />
                ))}
              </View>
            )}
          </View>

          {/* Bloque 2: confirmación tipeada */}
          <View
            className={`mb-4 rounded-lg border p-4 ${
              bloqueadoPorGrupo
                ? 'border-slate-200 bg-slate-50'
                : 'border-slate-200 bg-white'
            }`}
          >
            <Text className="text-sm font-semibold text-slate-900">
              Confirmación
            </Text>
            <Text className="mt-1 text-xs text-slate-500">
              Para confirmar, escribí exactamente{' '}
              <Text className="font-mono font-semibold text-slate-900">
                ELIMINAR
              </Text>{' '}
              en el campo de abajo.
            </Text>

            <TextInput
              value={confirmText}
              onChangeText={setConfirmText}
              editable={!bloqueadoPorGrupo && !submitting}
              placeholder="ELIMINAR"
              placeholderTextColor="#94a3b8"
              autoCapitalize="characters"
              autoCorrect={false}
              className="mt-3 h-12 rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900"
            />

            {deleteError && !/transferir o eliminar el grupo/i.test(deleteError) ? (
              <Text className="mt-2 text-sm text-red-600">{deleteError}</Text>
            ) : null}
          </View>

          {/* Acciones */}
          <Pressable
            onPress={onPressEliminar}
            disabled={!puedeConfirmar || submitting}
            className={`h-12 items-center justify-center rounded-lg ${
              puedeConfirmar && !submitting
                ? 'bg-red-600 active:bg-red-700'
                : 'bg-slate-300'
            }`}
          >
            {deleting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text
                className={`text-base font-semibold ${
                  puedeConfirmar ? 'text-white' : 'text-slate-500'
                }`}
              >
                {bloqueadoPorGrupo
                  ? 'Resolvé los grupos de arriba primero'
                  : 'Eliminar mi cuenta'}
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => router.back()}
            disabled={submitting}
            className="mt-3 h-11 items-center justify-center rounded-lg border border-slate-300 bg-white active:bg-slate-50"
          >
            <Text className="text-sm font-semibold text-slate-700">
              Cancelar
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function BulletItem({ texto }: { texto: string }) {
  return (
    <View className="flex-row gap-2">
      <Text className="text-red-700">•</Text>
      <Text className="flex-1 text-xs text-red-800">{texto}</Text>
    </View>
  );
}

interface GrupoAdminRowProps {
  grupo: GrupoConRol;
  eliminando: boolean;
  onTransferir: () => void;
  onEliminar: () => void;
}

function GrupoAdminRow({
  grupo,
  eliminando,
  onTransferir,
  onEliminar,
}: GrupoAdminRowProps) {
  return (
    <View className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <Text
            className="text-sm font-semibold text-slate-900"
            numberOfLines={1}
          >
            {grupo.nombre}
          </Text>
          {grupo.descripcion ? (
            <Text
              className="mt-0.5 text-xs text-slate-500"
              numberOfLines={2}
            >
              {grupo.descripcion}
            </Text>
          ) : null}
        </View>
        <View className="rounded-full bg-primary-100 px-2 py-0.5">
          <Text className="text-[10px] font-semibold text-primary-700">
            ADMIN
          </Text>
        </View>
      </View>
      <View className="mt-2 flex-row gap-2">
        <Pressable
          onPress={onTransferir}
          disabled={eliminando}
          className="flex-1 h-9 items-center justify-center rounded-md border border-primary-600 bg-white active:bg-primary-50"
        >
          <Text className="text-xs font-semibold text-primary-600">
            Transferir admin
          </Text>
        </Pressable>
        <Pressable
          onPress={onEliminar}
          disabled={eliminando}
          className="flex-1 h-9 items-center justify-center rounded-md border border-red-300 bg-white active:bg-red-50"
        >
          {eliminando ? (
            <ActivityIndicator color="#dc2626" />
          ) : (
            <Text className="text-xs font-semibold text-red-600">
              Eliminar grupo
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
