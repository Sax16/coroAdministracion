import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { Button } from '@/components/Button';
import { useGestionAsignaciones, useMiembrosGrupo, useServiciosSemana } from '@/features/asignaciones/hooks';
import {
  formatearDiaLargo,
  formatearHora,
  getDiasSemana,
  getLunesSemana,
  MiembroGrupo,
  ROLES_EMOJI,
  ROLES_LABELS,
  ROLES_SERVICIO,
  RolServicio,
  ServicioConAsignaciones,
} from '@/features/asignaciones/types';

/**
 * Pantalla para asignar / editar asignaciones de UN servicio concreto
 * (RF-051, RF-052, RF-053).
 *
 * Layout:
 * - Header: hora del servicio + título + cantidad de asignados
 * - Sección "Asignados": lista de miembros ya asignados, agrupados por
 *   persona, con un botón "Quitar" al lado de cada uno.
 * - Sección "Agregar asignación": picker de miembro (searchable) +
 *   chips de roles (multi-select). El botón "Asignar" se habilita
 *   cuando hay un miembro seleccionado y al menos un rol.
 *
 * Decisiones:
 * - Solo admin puede asignar. La RLS valida de vuelta en el INSERT.
 * - Un mismo miembro puede tener varios roles (RF-052) en este servicio:
 *   el chip se muestra en su card, y se pueden agregar más roles
 *   tocándolo de nuevo (toggle on/off).
 * - RF-053 (editar): la edición se hace toda desde acá — agregar rol,
 *   quitar rol individual, o quitar al miembro completo del servicio.
 *   No hay UPDATE: agregar es INSERT, quitar es DELETE.
 */
export default function AsignarServicioScreen() {
  const router = useRouter();
  const { id: grupoId, servicioId } = useLocalSearchParams<{
    id: string;
    servicioId: string;
  }>();

  // Para encontrar el servicio, recargamos la semana que lo contiene.
  // Truco barato: pedimos la semana actual y, si no está, vamos para
  // atrás/adelante. Para v0.1.0 alcanza — los servicios generados por
  // el patrón siempre están en las próximas N semanas. Si no aparece,
  // mostramos error.
  const lunes = useMemo(() => getLunesSemana(new Date()), []);
  const { servicios, loading: loadingServicios, refetch } = useServiciosSemana(
    grupoId ?? '',
    lunes,
  );

  const servicio = useMemo(
    () => servicios.find((s) => s.id === servicioId),
    [servicios, servicioId],
  );

  // Si el servicio no está en esta semana, probar la próxima.
  useEffect(() => {
    if (!loadingServicios && !servicio) {
      // Por ahora solo soportamos esta semana. En v0.2.0 se mejora.
    }
  }, [loadingServicios, servicio]);

  const { miembros, loading: loadingMiembros } = useMiembrosGrupo(grupoId ?? '');
  const { crear, crearVarios, eliminar, eliminarDeMiembro, loading: guardando, error, clearError } =
    useGestionAsignaciones();

  const [miembroSeleccionado, setMiembroSeleccionado] = useState<MiembroGrupo | null>(null);
  const [rolesSeleccionados, setRolesSeleccionados] = useState<Set<RolServicio>>(new Set());

  // Asignaciones agrupadas por miembro para la sección "Asignados"
  const porMiembro = useMemo(() => {
    const map = new Map<
      string,
      { miembro: MiembroGrupo | null; items: ServicioConAsignaciones['asignaciones'] }
    >();
    if (!servicio) return map;
    for (const a of servicio.asignaciones) {
      const key = a.miembro.usuario_grupo_id;
      const existing = map.get(key);
      if (existing) {
        existing.items.push(a);
      } else {
        const m =
          miembros.find((x) => x.usuario_grupo_id === a.miembro.usuario_grupo_id) ?? null;
        map.set(key, {
          miembro: m ?? {
            usuario_grupo_id: a.miembro.usuario_grupo_id,
            usuario_id: a.miembro.usuario_id,
            nombre: a.miembro.nombre,
            apellido: a.miembro.apellido,
            rol: 'miembro',
          },
          items: [a],
        });
      }
    }
    return map;
  }, [servicio, miembros]);

  // Quitar del selector cuando ya está asignado con esos mismos roles
  const miembrosAsignadosSet = useMemo(() => {
    const set = new Set<string>();
    for (const a of servicio?.asignaciones ?? []) {
      set.add(a.miembro.usuario_grupo_id);
    }
    return set;
  }, [servicio]);

  const onToggleRol = useCallback((rol: RolServicio) => {
    setRolesSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(rol)) next.delete(rol);
      else next.add(rol);
      return next;
    });
  }, []);

  const onAsignar = useCallback(async () => {
    if (!servicio || !miembroSeleccionado || rolesSeleccionados.size === 0) return;
    clearError();
    const items = Array.from(rolesSeleccionados).map((r) => ({
      servicio_id: servicio.id,
      usuario_grupo_id: miembroSeleccionado.usuario_grupo_id,
      rol_servicio: r,
    }));
    const ok =
      items.length === 1 ? await crear(items[0]) : await crearVarios(items);
    if (ok) {
      setMiembroSeleccionado(null);
      setRolesSeleccionados(new Set());
      await refetch();
    }
  }, [servicio, miembroSeleccionado, rolesSeleccionados, crear, crearVarios, refetch, clearError]);

  const onQuitarMiembro = useCallback(
    (usuarioGrupoId: string) => {
      if (!servicio) return;
      Alert.alert(
        'Quitar miembro',
        '¿Sacar a este miembro de este servicio? Se quitan todos sus roles.',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Quitar',
            style: 'destructive',
            onPress: async () => {
              const ok = await eliminarDeMiembro(servicio.id, usuarioGrupoId);
              if (ok) await refetch();
            },
          },
        ],
      );
    },
    [servicio, eliminarDeMiembro, refetch],
  );

  const onQuitarRol = useCallback(
    async (asignacionId: string) => {
      const ok = await eliminar(asignacionId);
      if (ok) await refetch();
    },
    [eliminar, refetch],
  );

  if (loadingServicios || loadingMiembros) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  if (!servicio) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 p-6">
        <Stack.Screen options={{ title: 'Servicio' }} />
        <Text className="text-center text-base font-semibold text-slate-700">
          No se encontró el servicio
        </Text>
        <Text className="mt-2 text-center text-sm text-slate-500">
          Es posible que ya haya pasado. Volvé a la vista semanal y elegí uno de esta semana.
        </Text>
        <Pressable
          onPress={() => router.back()}
          className="mt-6 h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-6 active:bg-slate-50"
        >
          <Text className="text-sm font-semibold text-slate-700">Volver</Text>
        </Pressable>
      </View>
    );
  }

  const fecha = new Date(servicio.fecha_inicio);
  const diaSemana = getDiasSemana(getLunesSemana(fecha))[(fecha.getDay() + 6) % 7];

  return (
    <>
      <Stack.Screen
        options={{
          title: `${formatearHora(servicio.fecha_inicio)} · ${servicio.titulo ?? 'Servicio'}`,
          headerBackTitle: 'Atrás',
        }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 bg-slate-50"
      >
        <ScrollView contentContainerClassName="pb-10" keyboardShouldPersistTaps="handled">
          {/* Encabezado del servicio */}
          <View className="m-4 rounded-lg border border-slate-200 bg-white p-4">
            <Text className="text-sm text-slate-500">{formatearDiaLargo(diaSemana)}</Text>
            <Text className="mt-1 text-3xl font-bold text-slate-900">
              {formatearHora(servicio.fecha_inicio)}
            </Text>
            {servicio.titulo ? (
              <Text className="mt-1 text-base text-slate-700">{servicio.titulo}</Text>
            ) : null}
            <Text className="mt-3 text-sm text-slate-600">
              {servicio.asignaciones.length === 0
                ? 'Aún no hay asignaciones para este servicio.'
                : `${servicio.asignaciones.length} asignación${servicio.asignaciones.length === 1 ? '' : 'es'} · ${porMiembro.size} miembro${porMiembro.size === 1 ? '' : 's'}`}
            </Text>
          </View>

          {error ? (
            <View className="mx-4 mb-3 rounded-lg border border-red-200 bg-red-50 p-3">
              <Text className="text-sm text-red-700">{error}</Text>
            </View>
          ) : null}

          {/* Asignados actuales */}
          {porMiembro.size > 0 ? (
            <View className="mx-4 mb-3">
              <Text className="mb-2 text-sm font-semibold text-slate-500">Asignados</Text>
              {Array.from(porMiembro.entries()).map(([ugId, { miembro, items }]) => (
                <View
                  key={ugId}
                  className="mb-2 rounded-lg border border-slate-200 bg-white p-3"
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1">
                      <Text className="text-base font-semibold text-slate-900">
                        {miembro?.nombre} {miembro?.apellido}
                      </Text>
                      {miembro?.rol === 'admin' ? (
                        <Text className="text-xs text-primary-600">Admin del grupo</Text>
                      ) : null}
                    </View>
                    <Pressable
                      onPress={() => onQuitarMiembro(ugId)}
                      hitSlop={8}
                      className="rounded-md border border-red-200 px-2.5 py-1 active:bg-red-50"
                    >
                      <Text className="text-xs font-medium text-red-600">Quitar</Text>
                    </Pressable>
                  </View>
                  <View className="mt-2 flex-row flex-wrap gap-1.5">
                    {items.map((a) => (
                      <Pressable
                        key={a.id}
                        onPress={() => onQuitarRol(a.id)}
                        className="flex-row items-center rounded-full bg-primary-100 pl-2.5 pr-1.5 py-1 active:bg-primary-200"
                      >
                        <Text className="mr-1 text-xs">
                          {ROLES_EMOJI[a.rol_servicio]}
                        </Text>
                        <Text className="text-xs font-medium text-primary-700">
                          {ROLES_LABELS[a.rol_servicio]}
                        </Text>
                        <Text className="ml-1.5 text-xs font-bold text-primary-700">×</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {/* Agregar nueva asignación */}
          <View className="mx-4 mb-3 rounded-lg border border-slate-200 bg-white p-4">
            <Text className="text-base font-semibold text-slate-900">Agregar asignación</Text>
            <Text className="mt-1 text-xs text-slate-500">
              Elegí un miembro y uno o varios roles (RF-052: podés asignar varios roles a la vez).
            </Text>

            {/* Selector de miembro */}
            <View className="mt-3">
              <Text className="mb-1.5 text-sm font-medium text-slate-700">Miembro</Text>
              {miembros.length === 0 ? (
                <Text className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-500">
                  No hay miembros activos en este grupo.
                </Text>
              ) : (
                <View className="gap-1.5">
                  {miembros.map((m) => {
                    const selected = miembroSeleccionado?.usuario_grupo_id === m.usuario_grupo_id;
                    return (
                      <Pressable
                        key={m.usuario_grupo_id}
                        onPress={() => setMiembroSeleccionado(selected ? null : m)}
                        className={`flex-row items-center justify-between rounded-md border px-3 py-2.5 ${
                          selected
                            ? 'border-primary-600 bg-primary-50'
                            : 'border-slate-200 bg-white active:bg-slate-50'
                        }`}
                      >
                        <View className="flex-1">
                          <Text className="text-sm font-medium text-slate-900">
                            {m.nombre} {m.apellido}
                          </Text>
                          {m.rol === 'admin' ? (
                            <Text className="text-xs text-primary-600">Admin del grupo</Text>
                          ) : null}
                        </View>
                        {miembrosAsignadosSet.has(m.usuario_grupo_id) ? (
                          <Text className="text-xs italic text-slate-400">Ya asignado</Text>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Selector de roles (chips multi-select) */}
            <View className="mt-4">
              <Text className="mb-1.5 text-sm font-medium text-slate-700">Roles</Text>
              <View className="flex-row flex-wrap gap-2">
                {ROLES_SERVICIO.map((r) => {
                  const selected = rolesSeleccionados.has(r);
                  return (
                    <Pressable
                      key={r}
                      onPress={() => onToggleRol(r)}
                      className={`flex-row items-center rounded-full border px-3 py-1.5 ${
                        selected
                          ? 'border-primary-600 bg-primary-600'
                          : 'border-slate-300 bg-white active:bg-slate-50'
                      }`}
                    >
                      <Text className="mr-1.5 text-sm">{ROLES_EMOJI[r]}</Text>
                      <Text
                        className={`text-sm font-medium ${
                          selected ? 'text-white' : 'text-slate-700'
                        }`}
                      >
                        {ROLES_LABELS[r]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View className="mt-5">
              <Button
                title="Asignar"
                onPress={onAsignar}
                loading={guardando}
                disabled={!miembroSeleccionado || rolesSeleccionados.size === 0}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
