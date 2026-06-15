import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { Button } from '@/components/Button';
import { useGestionCierre, useResumenCierre } from '@/features/asistencia/hooks';
import { AsignacionConEstado, EstadoAsistencia, ESTADO_COLORS, ESTADO_LABELS, ResumenCierre } from '@/features/asistencia/types';
import { GrupoConRol, listarMisGrupos } from '@/features/grupos/api';
import { ROLES_EMOJI, ROLES_LABELS } from '@/features/asignaciones/types';
import { formatearDiaLargo, formatearHora } from '@/features/asignaciones/types';
import { useAuthStore } from '@/stores/auth';

/**
 * Pantalla de cierre de asistencia de un servicio (RF-090 a 095).
 *
 * Acceso: el responsable del servicio o el admin del grupo. La RLS
 * valida de vuelta cualquier UPDATE.
 *
 * Layout:
 * - Header con info del servicio + badge de estado de cierre
 * - Card "Encargado": quién es, y si soy admin, CTA para cambiarlo
 * - Lista de miembros asignados con su estado actual (chips) y
 *   botones para cambiar entre "Asistió" / "No asistió"
 * - Si la asistencia está marcada como "no_asistio" y hay
 *   justificación, mostrarla abajo del nombre
 * - Botón "Cerrar asistencia" abajo (oculto si ya está cerrado)
 * - Si está cerrado: badge "Cerrado por X" + CTA "Reabrir" (solo admin)
 *
 * Push: al cerrar, NO mandamos push a los miembros — la justificación
 * es personal y el estado es solo informativo. En v0.2.0 con la
 * pantalla de historial de notificaciones, se podría mandar un push
 * de "se cerró la asistencia del servicio X" si se considera útil.
 */
export default function CierreAsistenciaScreen() {
  const { id: grupoId, servicioId } = useLocalSearchParams<{
    id: string;
    servicioId: string;
  }>();
  const user = useAuthStore((s) => s.user);

  const { resumen, loading, refetch } = useResumenCierre(servicioId ?? '');
  const { cambiarEstado, cerrar, reabrir, loading: mutando, error } = useGestionCierre();

  const [esAdmin, setEsAdmin] = useState(false);
  const [cargandoGrupo, setCargandoGrupo] = useState(true);

  useEffect(() => {
    if (!grupoId || !user) return;
    let cancelado = false;
    (async () => {
      const r = await listarMisGrupos();
      if (cancelado) return;
      if (r.ok) {
        const g = (r.data as GrupoConRol[]).find((x) => x.id === grupoId);
        if (g) setEsAdmin(g.rol === 'admin');
      }
      setCargandoGrupo(false);
    })();
    return () => {
      cancelado = true;
    };
  }, [grupoId, user]);

  // El usuario actual es responsable del servicio?
  const esResponsable = useMemo(() => {
    if (!resumen || !user) return false;
    return resumen.responsable?.usuario_id === user.id;
  }, [resumen, user]);

  const puedeEditar = useMemo(() => {
    if (!resumen) return false;
    if (resumen.servicio.asistencia_cerrada) return false;
    return esAdmin || esResponsable;
  }, [resumen, esAdmin, esResponsable]);

  const onCambiarEstado = useCallback(
    async (estadoId: string, nuevo: EstadoAsistencia) => {
      if (!puedeEditar) return;
      const ok = await cambiarEstado(estadoId, nuevo);
      if (ok) await refetch();
    },
    [puedeEditar, cambiarEstado, refetch],
  );

  const onCerrar = useCallback(() => {
    if (!resumen) return;
    Alert.alert(
      'Cerrar asistencia',
      'Una vez cerrada, los estados quedan definitivos. Solo un admin puede reabrir después.',
      [
        { text: 'Volver', style: 'cancel' },
        {
          text: 'Cerrar',
          onPress: async () => {
            const ok = await cerrar(resumen.servicio.id);
            if (ok) await refetch();
          },
        },
      ],
    );
  }, [resumen, cerrar, refetch]);

  const onReabrir = useCallback(() => {
    if (!resumen) return;
    Alert.alert('Reabrir asistencia', '¿Seguro? Los estados vuelven a ser editables.', [
      { text: 'Volver', style: 'cancel' },
      {
        text: 'Reabrir',
        onPress: async () => {
          const ok = await reabrir(resumen.servicio.id);
          if (ok) await refetch();
        },
      },
    ]);
  }, [resumen, reabrir, refetch]);

  if (loading || cargandoGrupo) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  if (!resumen) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 p-6">
        <Text className="text-base text-slate-700">Servicio no encontrado</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Cierre de asistencia',
          headerBackTitle: 'Atrás',
        }}
      />

      <ScrollView className="flex-1 bg-slate-50" contentContainerClassName="pb-10">
        {/* Header del servicio */}
        <View className="m-4 rounded-lg border border-slate-200 bg-white p-4">
          <Text className="text-sm text-slate-500">
            {formatearDiaLargo(new Date(resumen.servicio.fecha_inicio))}
          </Text>
          <Text className="mt-1 text-3xl font-bold text-slate-900">
            {formatearHora(resumen.servicio.fecha_inicio)}
          </Text>
          {resumen.servicio.titulo ? (
            <Text className="text-base text-slate-700">{resumen.servicio.titulo}</Text>
          ) : null}
          {resumen.servicio.lugar ? (
            <Text className="mt-1 text-xs text-slate-500">📍 {resumen.servicio.lugar}</Text>
          ) : null}
          <View className="mt-3">
            <CerradoBadge resumen={resumen} />
          </View>
        </View>

        {/* Encargado */}
        <View className="mx-4 mb-3 rounded-lg border border-slate-200 bg-white p-4">
          <Text className="text-sm font-semibold text-slate-500">Encargado del cierre</Text>
          {resumen.responsable ? (
            <Text className="mt-1 text-base text-slate-900">
              {resumen.responsable.nombre} {resumen.responsable.apellido}
            </Text>
          ) : (
            <Text className="mt-1 text-sm italic text-slate-400">
              Sin asignar. Si sos admin, podés designar uno al editar el servicio (v0.2.0).
            </Text>
          )}
        </View>

        {error ? (
          <View className="mx-4 mb-3 rounded-lg border border-red-200 bg-red-50 p-3">
            <Text className="text-sm text-red-700">{error}</Text>
          </View>
        ) : null}

        {/* Lista de miembros asignados */}
        <View className="mx-4 mb-3">
          <Text className="mb-2 text-sm font-semibold text-slate-500">
            Miembros asignados ({resumen.asignaciones.length})
          </Text>
          {resumen.asignaciones.length === 0 ? (
            <View className="rounded-lg border border-dashed border-slate-200 bg-white p-4">
              <Text className="text-sm text-slate-500">
                No hay miembros asignados a este servicio.
              </Text>
            </View>
          ) : (
            resumen.asignaciones.map((a) => (
              <MiembroAsistenciaCard
                key={a.asignacion_id}
                asignacion={a}
                puedeEditar={puedeEditar}
                onCambiarEstado={(nuevo) => onCambiarEstado(a.estado_id, nuevo)}
                mutando={mutando}
              />
            ))
          )}
        </View>

        {/* Acciones */}
        <View className="mx-4 mt-2 gap-2">
          {!resumen.servicio.asistencia_cerrada ? (
            puedeEditar ? (
              <Button title="Cerrar asistencia" variant="primary" onPress={onCerrar} />
            ) : (
              <View className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <Text className="text-sm text-amber-800">
                  Solo el encargado o un admin del grupo puede cerrar la asistencia.
                </Text>
              </View>
            )
          ) : esAdmin ? (
            <Button title="Reabrir asistencia" variant="secondary" onPress={onReabrir} />
          ) : (
            <View className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <Text className="text-sm text-slate-600">
                Asistencia cerrada. Solo un admin del grupo puede reabrir.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </>
  );
}

function CerradoBadge({ resumen }: { resumen: ResumenCierre }) {
  if (!resumen.servicio.asistencia_cerrada) {
    return (
      <View className="self-start rounded-full bg-amber-100 px-2.5 py-0.5">
        <Text className="text-xs font-medium text-amber-700">Asistencia abierta</Text>
      </View>
    );
  }
  return (
    <View className="self-start rounded-full bg-emerald-100 px-2.5 py-0.5">
      <Text className="text-xs font-medium text-emerald-700">
        Cerrada{resumen.servicio.asistencia_cerrada_por_nombre
          ? ` por ${resumen.servicio.asistencia_cerrada_por_nombre}`
          : ''}
      </Text>
    </View>
  );
}

function MiembroAsistenciaCard({
  asignacion,
  puedeEditar,
  onCambiarEstado,
  mutando,
}: {
  asignacion: AsignacionConEstado;
  puedeEditar: boolean;
  onCambiarEstado: (nuevo: EstadoAsistencia) => void;
  mutando: boolean;
}) {
  const colors = ESTADO_COLORS[asignacion.estado];
  return (
    <View className="mb-2 rounded-lg border border-slate-200 bg-white p-3">
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          <Text className="text-base font-semibold text-slate-900">
            {asignacion.miembro.nombre} {asignacion.miembro.apellido}
          </Text>
          <View className="mt-1 flex-row items-center gap-1.5">
            <Text className="text-xs text-slate-500">
              {ROLES_EMOJI[asignacion.rol_servicio]} {ROLES_LABELS[asignacion.rol_servicio]}
            </Text>
          </View>
        </View>
        <View className={`self-start rounded-full px-2.5 py-0.5 ${colors.bg}`}>
          <Text className={`text-xs font-medium ${colors.fg}`}>
            {ESTADO_LABELS[asignacion.estado]}
          </Text>
        </View>
      </View>

      {/* Botones para cambiar estado (solo si puede editar) */}
      {puedeEditar ? (
        <View className="mt-3 flex-row gap-2">
          <Pressable
            onPress={() => onCambiarEstado('asistio')}
            disabled={mutando}
            className={`flex-1 items-center rounded-md border px-3 py-2 ${
              asignacion.estado === 'asistio'
                ? 'border-emerald-600 bg-emerald-50'
                : 'border-slate-200 bg-white active:bg-slate-50'
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                asignacion.estado === 'asistio' ? 'text-emerald-700' : 'text-slate-700'
              }`}
            >
              ✓ Asistió
            </Text>
          </Pressable>
          <Pressable
            onPress={() => onCambiarEstado('no_asistio')}
            disabled={mutando}
            className={`flex-1 items-center rounded-md border px-3 py-2 ${
              asignacion.estado === 'no_asistio'
                ? 'border-red-600 bg-red-50'
                : 'border-slate-200 bg-white active:bg-slate-50'
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                asignacion.estado === 'no_asistio' ? 'text-red-700' : 'text-slate-700'
              }`}
            >
              ✗ No asistió
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* Justificación (visible para todos los miembros del grupo, RF-097) */}
      {asignacion.justificacion ? (
        <View className="mt-3 rounded-md bg-slate-50 p-2.5">
          <Text className="text-xs font-medium text-slate-500">Justificación</Text>
          <Text className="mt-1 text-sm italic text-slate-700">
            "{asignacion.justificacion}"
          </Text>
        </View>
      ) : null}
    </View>
  );
}
