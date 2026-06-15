import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { Button } from '@/components/Button';
import { useGestionSolicitudes, useSolicitud } from '@/features/solicitudes/hooks';
import { formatearDiaCorto, formatearHora } from '@/features/asignaciones/types';
import { notificarPush } from '@/lib/pushApi';
import { useAuthStore } from '@/stores/auth';

/**
 * Pantalla de detalle de una solicitud de ingreso (RF-021, RF-022, RF-023).
 *
 * Muestra la info del solicitante, su mensaje si lo dejó, y CTAs
 * para aprobar o rechazar. Solo accesible para el admin del grupo
 * destino (la RLS lo enforcea; si no sos admin, el select no
 * devuelve la solicitud).
 *
 * Al aprobar:
 * - Llama a la SECURITY DEFINER function `aprobar_solicitud(uuid)`
 *   que crea el `usuarios_grupos` con estado='activo' y marca la
 *   solicitud aprobada, todo en una transacción.
 * - Dispara `notificarPush('solicitud_aprobada')` al solicitante
 *   (RF-066).
 *
 * Al rechazar:
 * - UPDATE directo: la RLS permite a admin UPDATE la solicitud.
 * - Dispara `notificarPush('solicitud_rechazada')` al solicitante
 *   (RF-066).
 */
export default function DetalleSolicitudScreen() {
  const router = useRouter();
  const { solicitudId } = useLocalSearchParams<{ solicitudId: string }>();
  const user = useAuthStore((s) => s.user);

  const { solicitud, loading, refetch } = useSolicitud(solicitudId ?? '');
  const { aprobar, rechazar, loading: mutando, error } = useGestionSolicitudes();

  const [esAdmin, setEsAdmin] = useState(false);
  const [cargandoPermiso, setCargandoPermiso] = useState(true);

  useEffect(() => {
    if (!solicitud || !user) return;
    // El admin del grupo es el `usuarios_grupos` con rol='admin'.
    // El hook `useSolicitud` solo trae la solicitud si la RLS lo
    // permite; si llegamos acá, podemos chequear si el usuario actual
    // ES admin del grupo destino a través de la sesión del store.
    // Para MVP usamos el `grupoActivo` del store como proxy.
    setEsAdmin(true); // Simplificación: la RLS ya filtró; si llegamos, podés operar
    setCargandoPermiso(false);
  }, [solicitud, user]);

  const onAprobar = useCallback(() => {
    if (!solicitud) return;
    Alert.alert('Aprobar solicitud', `¿Aceptar a ${solicitud.solicitante.nombre} en el grupo?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Aprobar',
        onPress: async () => {
          const ok = await aprobar(solicitud.id);
          if (ok) {
            await notificarPush('solicitud_aprobada', {
              grupo_id: solicitud.grupo_id,
              solicitud_id: solicitud.id,
              usuario_id: solicitud.usuario_id,
            });
            await refetch();
            Alert.alert('Solicitud aprobada', '', [
              { text: 'OK', onPress: () => router.back() },
            ]);
          }
        },
      },
    ]);
  }, [solicitud, aprobar, refetch, router]);

  const onRechazar = useCallback(() => {
    if (!solicitud) return;
    Alert.alert(
      'Rechazar solicitud',
      `${solicitud.solicitante.nombre} será notificado del rechazo.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Rechazar',
          style: 'destructive',
          onPress: async () => {
            const ok = await rechazar(solicitud.id);
            if (ok) {
              await notificarPush('solicitud_rechazada', {
                grupo_id: solicitud.grupo_id,
                solicitud_id: solicitud.id,
                usuario_id: solicitud.usuario_id,
              });
              await refetch();
              Alert.alert('Solicitud rechazada', '', [
                { text: 'OK', onPress: () => router.back() },
              ]);
            }
          },
        },
      ],
    );
  }, [solicitud, rechazar, refetch, router]);

  if (loading || cargandoPermiso) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  if (!solicitud) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 p-6">
        <Text className="text-base text-slate-700">Solicitud no encontrada</Text>
      </View>
    );
  }

  const yaRespondida = solicitud.estado !== 'pendiente';

  return (
    <>
      <Stack.Screen options={{ title: 'Solicitud', headerBackTitle: 'Atrás' }} />

      <ScrollView className="flex-1 bg-slate-50" contentContainerClassName="pb-10">
        <View className="m-4 rounded-lg border border-slate-200 bg-white p-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-lg font-semibold text-slate-900">
                {solicitud.solicitante.nombre} {solicitud.solicitante.apellido}
              </Text>
              <Text className="text-sm text-slate-500">{solicitud.solicitante.email}</Text>
            </View>
            <View
              className={`rounded-full px-2.5 py-0.5 ${
                solicitud.estado === 'pendiente'
                  ? 'bg-amber-100'
                  : solicitud.estado === 'aprobada'
                    ? 'bg-emerald-100'
                    : 'bg-red-100'
              }`}
            >
              <Text
                className={`text-xs font-medium ${
                  solicitud.estado === 'pendiente'
                    ? 'text-amber-700'
                    : solicitud.estado === 'aprobada'
                      ? 'text-emerald-700'
                      : 'text-red-700'
                }`}
              >
                {solicitud.estado === 'pendiente'
                  ? 'Pendiente'
                  : solicitud.estado === 'aprobada'
                    ? 'Aprobada'
                    : 'Rechazada'}
              </Text>
            </View>
          </View>

          <Text className="mt-3 text-xs text-slate-400">
            Solicitó el {formatearDiaCorto(new Date(solicitud.created_at))} a las{' '}
            {formatearHora(solicitud.created_at)} · Grupo: {solicitud.grupo.nombre}
          </Text>
        </View>

        <View className="mx-4 mb-3 rounded-lg border border-slate-200 bg-white p-4">
          <Text className="text-sm font-semibold text-slate-900">Mensaje</Text>
          {solicitud.mensaje ? (
            <Text className="mt-2 text-sm italic text-slate-700">
              "{solicitud.mensaje}"
            </Text>
          ) : (
            <Text className="mt-2 text-sm text-slate-400">
              El solicitante no dejó un mensaje.
            </Text>
          )}
        </View>

        {solicitud.respondida_por_nombre && solicitud.respondida_at ? (
          <View className="mx-4 mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <Text className="text-xs text-slate-600">
              {solicitud.estado === 'aprobada' ? 'Aprobada' : 'Rechazada'} por{' '}
              {solicitud.respondida_por_nombre} el{' '}
              {formatearDiaCorto(new Date(solicitud.respondida_at))}
            </Text>
          </View>
        ) : null}

        {error ? (
          <View className="mx-4 mb-3 rounded-lg border border-red-200 bg-red-50 p-3">
            <Text className="text-sm text-red-700">{error}</Text>
          </View>
        ) : null}

        {/* Acciones admin (solo si está pendiente) */}
        {esAdmin && !yaRespondida ? (
          <View className="mx-4 mt-2 gap-2">
            <Button title="Aprobar" onPress={onAprobar} loading={mutando} />
            <Button title="Rechazar" variant="danger" onPress={onRechazar} loading={mutando} />
          </View>
        ) : null}
      </ScrollView>
    </>
  );
}
