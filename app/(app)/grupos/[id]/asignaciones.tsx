import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { useServiciosSemana } from '@/features/asignaciones/hooks';
import {
  agregarDias,
  DIAS_SEMANA_LABELS,
  formatearDiaCorto,
  formatearHora,
  getDiasSemana,
  getLunesSemana,
  ROLES_EMOJI,
  ROLES_LABELS,
  ServicioConAsignaciones,
} from '@/features/asignaciones/types';
import { GrupoConRol, listarMisGrupos } from '@/features/grupos/api';
import { useAuthStore } from '@/stores/auth';

/**
 * Vista semanal de servicios con asignaciones (RF-050).
 *
 * Estructura:
 * - Header con nombre del grupo + chips de navegación de semana (←, "Hoy", →)
 * - 7 cards (lunes → domingo). Cada card muestra la fecha y, si hay
 *   servicios, una sub-card por servicio con hora + lista de asignaciones
 *   agrupadas por miembro con sus roles (chips de colores).
 * - Si el usuario es admin, cada servicio tiene un botón "Asignar" que
 *   navega a la pantalla de detalle para agregar/quitar asignaciones.
 * - Si no es admin (miembro), solo lectura — los nombres asignados se
 *   ven igual, pero no se puede editar.
 *
 * Decisiones:
 * - Los servicios cancelados aparecen tachados al final de su día.
 * - Si el grupo no tiene patrón configurado (no hay servicios generados),
 *   mostramos un CTA que lleva a configurar el patrón.
 */
export default function AsignacionesScreen() {
  const router = useRouter();
  const { id: grupoIdParam } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);

  const [lunes, setLunes] = useState<Date>(() => getLunesSemana(new Date()));
  const [rol, setRol] = useState<'admin' | 'miembro' | null>(null);
  const [nombreGrupo, setNombreGrupo] = useState<string | null>(null);
  const [cargandoGrupo, setCargandoGrupo] = useState(true);

  // Cargar info del grupo (nombre + rol del usuario actual en este grupo).
  // Lo hacemos en el screen para no tocar la feature `grupos/` por algo
  // puntual. En v0.2.0 esto se centraliza en un `useGrupo(id)`.
  useEffect(() => {
    if (!grupoIdParam || !user) return;
    let cancelado = false;
    (async () => {
      const result = await listarMisGrupos();
      if (cancelado) return;
      if (result.ok) {
        const g = (result.data as GrupoConRol[]).find((x) => x.id === grupoIdParam);
        if (g) {
          setNombreGrupo(g.nombre);
          setRol(g.rol);
        }
      }
      setCargandoGrupo(false);
    })();
    return () => {
      cancelado = true;
    };
  }, [grupoIdParam, user]);

  const { servicios, loading, error, refetch } = useServiciosSemana(grupoIdParam ?? '', lunes);

  const onPrev = useCallback(() => {
    setLunes((prev) => agregarDias(prev, -7));
  }, []);
  const onNext = useCallback(() => {
    setLunes((prev) => agregarDias(prev, 7));
  }, []);
  const onHoy = useCallback(() => {
    setLunes(getLunesSemana(new Date()));
  }, []);

  const esEstaSemana = useMemo(() => {
    const hoy = getLunesSemana(new Date()).getTime();
    return lunes.getTime() === hoy;
  }, [lunes]);

  const dias = useMemo(() => getDiasSemana(lunes), [lunes]);
  const serviciosPorDia = useMemo(() => {
    const map = new Map<string, ServicioConAsignaciones[]>();
    for (const s of servicios) {
      const key = new Date(s.fecha_inicio).toDateString();
      const arr = map.get(key) ?? [];
      arr.push(s);
      map.set(key, arr);
    }
    return map;
  }, [servicios]);

  return (
    <>
      <Stack.Screen
        options={{
          title: nombreGrupo ? `Asignaciones — ${nombreGrupo}` : 'Asignaciones',
          headerBackTitle: 'Atrás',
        }}
      />

      {/* Header de navegación de semana */}
      <View className="flex-row items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <Pressable
          onPress={onPrev}
          hitSlop={8}
          className="h-10 w-10 items-center justify-center rounded-md border border-slate-300 active:bg-slate-50"
        >
          <Text className="text-lg text-slate-700">‹</Text>
        </Pressable>
        <Pressable onPress={onHoy} disabled={esEstaSemana} className="flex-1 px-3">
          <Text
            className={`text-center text-base font-semibold ${
              esEstaSemana ? 'text-slate-900' : 'text-primary-600'
            }`}
          >
            {esEstaSemana ? 'Esta semana' : `${formatearDiaCorto(lunes)} →`}
          </Text>
          <Text className="text-center text-xs text-slate-500">
            {formatearDiaCorto(lunes)} — {formatearDiaCorto(agregarDias(lunes, 6))}
          </Text>
        </Pressable>
        <Pressable
          onPress={onNext}
          hitSlop={8}
          className="h-10 w-10 items-center justify-center rounded-md border border-slate-300 active:bg-slate-50"
        >
          <Text className="text-lg text-slate-700">›</Text>
        </Pressable>
      </View>

      {cargandoGrupo && loading ? (
        <View className="flex-1 items-center justify-center bg-slate-50">
          <ActivityIndicator size="large" color="#4f46e5" />
        </View>
      ) : (
        <ScrollView
          className="flex-1 bg-slate-50"
          contentContainerClassName="pb-10"
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} />}
        >
          {error ? (
            <View className="border-b border-red-200 bg-red-50 px-4 py-3">
              <Text className="text-sm text-red-700">{error}</Text>
            </View>
          ) : null}

          {/* Estado vacío: no hay servicios generados en esta semana */}
          {servicios.length === 0 && !loading ? (
            <View className="m-4 rounded-lg border border-slate-200 bg-white p-6">
              <Text className="text-base font-semibold text-slate-900">
                No hay servicios esta semana
              </Text>
              <Text className="mt-2 text-sm text-slate-600">
                Esto puede pasar porque aún no configuraste el patrón recurrente del grupo, o
                porque el patrón no tiene servicios en estos días.
              </Text>
              {rol === 'admin' ? (
                <Pressable
                  onPress={() => router.push(`/(app)/grupos/${grupoIdParam}/patron`)}
                  className="mt-4 h-11 items-center justify-center rounded-lg bg-primary-600 active:bg-primary-700"
                >
                  <Text className="text-sm font-semibold text-white">Configurar patrón</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {/* Una card por día */}
          {dias.map((dia, idx) => {
            const key = dia.toDateString();
            const items = (serviciosPorDia.get(key) ?? []).filter((s) => s.estado !== 'cancelado');
            const cancelados = (serviciosPorDia.get(key) ?? []).filter((s) => s.estado === 'cancelado');
            return (
              <View key={key} className="mx-4 mb-3">
                <View className="mb-2 flex-row items-baseline">
                  <Text className="text-sm font-semibold text-slate-500">
                    {DIAS_SEMANA_LABELS[idx]}
                  </Text>
                  <Text className="ml-2 text-base font-semibold text-slate-900">
                    {formatearDiaCorto(dia)}
                  </Text>
                </View>
                {items.length === 0 && cancelados.length === 0 ? (
                  <View className="rounded-lg border border-dashed border-slate-200 bg-white p-3">
                    <Text className="text-sm text-slate-400">Sin servicios</Text>
                  </View>
                ) : (
                  <>
                    {items.map((s) => (
                      <ServicioCard
                        key={s.id}
                        servicio={s}
                        esAdmin={rol === 'admin'}
                        onAsignar={() =>
                          router.push(`/(app)/grupos/${grupoIdParam}/asignaciones/${s.id}`)
                        }
                        onCerrar={() =>
                          router.push(`/(app)/grupos/${grupoIdParam}/servicios/${s.id}/cierre`)
                        }
                      />
                    ))}
                    {cancelados.map((s) => (
                      <ServicioCard
                        key={s.id}
                        servicio={s}
                        esAdmin={rol === 'admin'}
                        cancelado
                        onAsignar={() =>
                          router.push(`/(app)/grupos/${grupoIdParam}/asignaciones/${s.id}`)
                        }
                        onCerrar={() =>
                          router.push(`/(app)/grupos/${grupoIdParam}/servicios/${s.id}/cierre`)
                        }
                      />
                    ))}
                  </>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </>
  );
}

interface ServicioCardProps {
  servicio: ServicioConAsignaciones;
  esAdmin: boolean;
  cancelado?: boolean;
  onAsignar: () => void;
  onCerrar: () => void;
}

function ServicioCard({ servicio, esAdmin, cancelado, onAsignar, onCerrar }: ServicioCardProps) {
  // Agrupar asignaciones por miembro para mostrar "Juan — Cantante, Limpieza"
  const porMiembro = new Map<
    string,
    { nombre: string; apellido: string; roles: string[] }
  >();
  for (const a of servicio.asignaciones) {
    const key = a.miembro.usuario_grupo_id;
    const existing = porMiembro.get(key);
    if (existing) {
      existing.roles.push(a.rol_servicio);
    } else {
      porMiembro.set(key, {
        nombre: a.miembro.nombre,
        apellido: a.miembro.apellido,
        roles: [a.rol_servicio],
      });
    }
  }
  const miembros = Array.from(porMiembro.values());

  return (
    <View
      className={`mb-2 rounded-lg border bg-white p-3 ${
        cancelado ? 'border-slate-200 opacity-60' : 'border-slate-200'
      }`}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-1 flex-row items-baseline">
          <Text className={`text-lg font-semibold ${cancelado ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
            {formatearHora(servicio.fecha_inicio)}
          </Text>
          {servicio.titulo ? (
            <Text
              className={`ml-2 text-sm ${cancelado ? 'text-slate-400 line-through' : 'text-slate-600'}`}
              numberOfLines={1}
            >
              {servicio.titulo}
            </Text>
          ) : null}
          {cancelado ? (
            <View className="ml-2 rounded-full bg-slate-200 px-2 py-0.5">
              <Text className="text-xs font-medium text-slate-600">Cancelado</Text>
            </View>
          ) : null}
        </View>
        {esAdmin && !cancelado ? (
          <View className="flex-row gap-2">
            {esCerrable(servicio) ? (
              <Pressable
                onPress={onCerrar}
                className="rounded-md border border-emerald-600 px-3 py-1.5 active:bg-emerald-50"
              >
                <Text className="text-sm font-semibold text-emerald-700">Cerrar</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={onAsignar}
              className="rounded-md border border-primary-600 px-3 py-1.5 active:bg-primary-50"
            >
              <Text className="text-sm font-semibold text-primary-600">
                {servicio.asignaciones.length > 0 ? 'Editar' : 'Asignar'}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {miembros.length > 0 ? (
        <View className="mt-3">
          {miembros.map((m, i) => (
            <View
              key={`${m.apellido}-${m.nombre}-${i}`}
              className={`flex-row flex-wrap items-center ${i > 0 ? 'mt-1.5' : ''}`}
            >
              <Text className="text-sm text-slate-700">
                {m.nombre} {m.apellido}
              </Text>
              <Text className="mx-1.5 text-sm text-slate-400">—</Text>
              {m.roles.map((r, j) => (
                <View
                  key={j}
                  className="mr-1.5 mb-1 flex-row items-center rounded-full bg-primary-100 px-2 py-0.5"
                >
                  <Text className="mr-1 text-xs">{ROLES_EMOJI[r as keyof typeof ROLES_EMOJI]}</Text>
                  <Text className="text-xs font-medium text-primary-700">
                    {ROLES_LABELS[r as keyof typeof ROLES_LABELS]}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      ) : (
        <Text className="mt-2 text-xs italic text-slate-400">Sin asignaciones todavía</Text>
      )}
    </View>
  );
}

/**
 * Un servicio es "cerrable" si ya pasó o está en curso (fecha_inicio <= ahora)
 * y tiene al menos una asignación. El botón "Cerrar" solo aparece para
 * admin en estos casos; el responsable del servicio también podría
 * cerrarlo (la RLS lo valida), pero la UI solo expone el CTA al admin
 * desde la vista semanal.
 */
function esCerrable(servicio: ServicioConAsignaciones): boolean {
  if (servicio.estado !== 'programado') return false;
  if (servicio.asignaciones.length === 0) return false;
  const fechaInicio = new Date(servicio.fecha_inicio).getTime();
  return fechaInicio <= Date.now();
}
