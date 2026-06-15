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

import { useEnsayosProximos } from '@/features/ensayos/hooks';
import { useComunicados } from '@/features/comunicados/hooks';
import { useServiciosSemana } from '@/features/asignaciones/hooks';
import { useSolicitudesPendientes } from '@/features/solicitudes/hooks';
import { GrupoConRol, listarMisGrupos } from '@/features/grupos/api';
import { useAuthStore } from '@/stores/auth';
import {
  formatearDiaCorto,
  formatearHora,
  getLunesSemana,
} from '@/features/asignaciones/types';
import { supabase } from '@/lib/supabase';

/**
 * Home del grupo: dashboard con resumen de la semana y accesos rápidos
 * a todas las secciones del grupo activo.
 *
 * Decisiones de diseño:
 * - Es la pantalla principal post-login. Cuando el usuario tiene un
 *   grupo activo, el index global redirige acá. Si toca otro grupo
 *   en el listado de grupos, también viene acá.
 * - Muestra: nombre del grupo, badge admin/miembro, resumen rápido
 *   (próximos servicios, próximos ensayos, último comunicado) y un
 *   grid de accesos a las secciones.
 * - No es "Mi semana" — esa sigue siendo una pantalla accesible desde
 *   el home con más detalle. El home es un launcher.
 * - Es solo-lectura: ningún CTA de edición acá. Los accesos son
 *   para ir a otras pantallas a editar.
 */
export default function GrupoHomeScreen() {
  const router = useRouter();
  const { id: grupoId } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);

  const lunes = useMemo(() => getLunesSemana(new Date()), []);

  const [nombreGrupo, setNombreGrupo] = useState<string | null>(null);
  const [descripcionGrupo, setDescripcionGrupo] = useState<string | null>(null);
  const [esAdmin, setEsAdmin] = useState(false);
  const [cargandoGrupo, setCargandoGrupo] = useState(true);
  const [patronConfigurado, setPatronConfigurado] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!grupoId || !user) return;
    let cancelado = false;
    (async () => {
      // 1. Info del grupo + rol del usuario
      const r = await listarMisGrupos();
      if (cancelado) return;
      if (r.ok) {
        const g = (r.data as GrupoConRol[]).find((x) => x.id === grupoId);
        if (g) {
          setNombreGrupo(g.nombre);
          setDescripcionGrupo(g.descripcion);
          setEsAdmin(g.rol === 'admin');
        }
      }

      // 2. ¿Hay patrón configurado? (para mostrar CTA si no)
      const { data: patron } = await supabase
        .from('patrones_recurrentes')
        .select('grupo_id')
        .eq('grupo_id', grupoId)
        .maybeSingle();
      if (!cancelado) setPatronConfigurado(!!patron);

      if (!cancelado) setCargandoGrupo(false);
    })();
    return () => {
      cancelado = true;
    };
  }, [grupoId, user]);

  // Servicios de esta semana
  const {
    servicios,
    loading: loadingServicios,
    refetch: refetchServ,
  } = useServiciosSemana(grupoId ?? '', lunes);

  const {
    ensayos,
    loading: loadingEnsayos,
    refetch: refetchEns,
  } = useEnsayosProximos(grupoId ?? '');

  const {
    comunicados,
    loading: loadingCom,
    refetch: refetchCom,
  } = useComunicados(grupoId ?? '');

  // Solicitudes pendientes (solo admins, RF-021)
  const { solicitudes: solicitudesPendientes } = useSolicitudesPendientes(grupoId ?? '');

  const proximosServicios = useMemo(
    () => servicios.filter((s) => s.estado !== 'cancelado').slice(0, 3),
    [servicios],
  );
  const proximosEnsayos = useMemo(() => ensayos.slice(0, 3), [ensayos]);
  const ultimoComunicado = useMemo(
    () => comunicados[0] ?? null,
    [comunicados],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchServ(), refetchEns(), refetchCom()]);
    setRefreshing(false);
  }, [refetchServ, refetchEns, refetchCom]);

  const loading =
    loadingServicios || loadingEnsayos || loadingCom || cargandoGrupo;

  if (cargandoGrupo) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: nombreGrupo ?? 'Grupo',
          headerBackTitle: 'Grupos',
        }}
      />

      <ScrollView
        className="flex-1 bg-slate-50"
        contentContainerClassName="pb-10"
        refreshControl={
          <RefreshControl refreshing={refreshing || loading} onRefresh={onRefresh} />
        }
      >
        {/* Header del grupo */}
        <View className="m-4 rounded-lg border border-slate-200 bg-white p-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-2xl font-bold text-slate-900">
                {nombreGrupo ?? 'Grupo'}
              </Text>
              {descripcionGrupo ? (
                <Text className="mt-1 text-sm text-slate-600">{descripcionGrupo}</Text>
              ) : null}
            </View>
            <View
              className={`self-start rounded-full px-2.5 py-0.5 ${
                esAdmin ? 'bg-primary-100' : 'bg-slate-100'
              }`}
            >
              <Text
                className={`text-xs font-medium ${
                  esAdmin ? 'text-primary-700' : 'text-slate-600'
                }`}
              >
                {esAdmin ? 'Admin' : 'Miembro'}
              </Text>
            </View>
          </View>
        </View>

        {/* Accesos rápidos */}
        <View className="mx-4 mb-3">
          <Text className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Accesos rápidos
          </Text>
          <View className="flex-row flex-wrap gap-3">
            <AccesoCard
              titulo="Mi semana"
              subtitulo="Tus servicios y ensayos"
              emoji="📅"
              color="indigo"
              onPress={() => router.push(`/(app)/grupos/${grupoId}/mi-semana`)}
            />
            <AccesoCard
              titulo="Ensayos"
              subtitulo="Próximos ensayos del grupo"
              emoji="🎵"
              color="amber"
              onPress={() => router.push(`/(app)/grupos/${grupoId}/ensayos`)}
            />
            <AccesoCard
              titulo="Comunicados"
              subtitulo="Avisos y novedades"
              emoji="📢"
              color="emerald"
              onPress={() => router.push(`/(app)/grupos/${grupoId}/comunicados`)}
            />
            {esAdmin ? (
              <AccesoCard
                titulo="Asignaciones"
                subtitulo="Asignar miembros a servicios"
                emoji="👥"
                color="slate"
                onPress={() => router.push(`/(app)/grupos/${grupoId}/asignaciones`)}
              />
            ) : null}
            {esAdmin ? (
              <AccesoCard
                titulo={
                  solicitudesPendientes.length > 0
                    ? `Solicitudes (${solicitudesPendientes.length})`
                    : 'Solicitudes'
                }
                subtitulo="Inbox de ingresos pendientes"
                emoji="📨"
                color="rose"
                onPress={() => router.push('/(app)/solicitudes')}
              />
            ) : null}
            {esAdmin ? (
              <AccesoCard
                titulo="Patrón"
                subtitulo="Configurar días y horarios"
                emoji="⚙️"
                color="slate"
                onPress={() => router.push(`/(app)/grupos/${grupoId}/patron`)}
              />
            ) : null}
          </View>
        </View>

        {/* Resumen de la semana */}
        <View className="mx-4 mb-3">
          <Text className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Esta semana
          </Text>

          {!patronConfigurado && esAdmin ? (
            <View className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <Text className="text-sm font-medium text-amber-900">
                Aún no configuraste el patrón recurrente
              </Text>
              <Text className="mt-1 text-xs text-amber-800">
                Sin patrón, no se generan servicios automáticos. Configurá los días y horarios de los servicios del grupo.
              </Text>
              <Pressable
                onPress={() => router.push(`/(app)/grupos/${grupoId}/patron`)}
                className="mt-2 h-10 items-center justify-center rounded-md bg-amber-600 active:bg-amber-700"
              >
                <Text className="text-sm font-semibold text-white">Configurar patrón</Text>
              </Pressable>
            </View>
          ) : null}

          {/* Servicios próximos */}
          <ResumenSeccion
            titulo="Servicios próximos"
            vacio="No hay servicios programados para esta semana"
            cargando={loadingServicios}
          >
            {proximosServicios.map((s) => (
              <ItemResumen
                key={s.id}
                titulo={s.titulo ?? 'Servicio'}
                subtitulo={`${formatearDiaCorto(new Date(s.fecha_inicio))} · ${formatearHora(s.fecha_inicio)}`}
                onPress={() => router.push(`/(app)/grupos/${grupoId}/asignaciones`)}
              />
            ))}
          </ResumenSeccion>

          {/* Ensayos próximos */}
          <ResumenSeccion
            titulo="Ensayos próximos"
            vacio="No hay ensayos programados"
            cargando={loadingEnsayos}
          >
            {proximosEnsayos.map((e) => (
              <ItemResumen
                key={e.id}
                titulo={e.titulo}
                subtitulo={`${formatearDiaCorto(new Date(e.fecha_inicio))} · ${formatearHora(e.fecha_inicio)}${e.lugar ? ` · 📍 ${e.lugar}` : ''}`}
                onPress={() => router.push(`/(app)/grupos/${grupoId}/ensayos/${e.id}`)}
              />
            ))}
          </ResumenSeccion>

          {/* Comunicado reciente */}
          <ResumenSeccion
            titulo="Último comunicado"
            vacio="No hay comunicados publicados"
            cargando={loadingCom}
          >
            {ultimoComunicado ? (
              <ItemResumen
                titulo={ultimoComunicado.titulo}
                subtitulo={`${formatearDiaCorto(new Date(ultimoComunicado.created_at))}${ultimoComunicado.fecha_inicio ? ` · evento ${formatearDiaCorto(new Date(ultimoComunicado.fecha_inicio))}` : ''}`}
                onPress={() =>
                  router.push(`/(app)/grupos/${grupoId}/comunicados/${ultimoComunicado.id}`)
                }
              />
            ) : null}
          </ResumenSeccion>
        </View>
      </ScrollView>
    </>
  );
}

interface AccesoCardProps {
  titulo: string;
  subtitulo: string;
  emoji: string;
  color: 'indigo' | 'amber' | 'emerald' | 'slate' | 'rose';
  onPress: () => void;
}

function AccesoCard({ titulo, subtitulo, emoji, color, onPress }: AccesoCardProps) {
  const colorMap = {
    indigo: 'border-indigo-200 bg-indigo-50',
    amber: 'border-amber-200 bg-amber-50',
    emerald: 'border-emerald-200 bg-emerald-50',
    slate: 'border-slate-200 bg-slate-50',
    rose: 'border-rose-200 bg-rose-50',
  } as const;
  const textMap = {
    indigo: 'text-indigo-700',
    amber: 'text-amber-700',
    emerald: 'text-emerald-700',
    slate: 'text-slate-700',
    rose: 'text-rose-700',
  } as const;

  return (
    <Pressable
      onPress={onPress}
      className={`flex-1 min-w-[45%] rounded-lg border p-3 active:opacity-70 ${colorMap[color]}`}
    >
      <Text className="text-2xl">{emoji}</Text>
      <Text className={`mt-1.5 text-sm font-semibold ${textMap[color]}`}>{titulo}</Text>
      <Text className="mt-0.5 text-xs text-slate-600">{subtitulo}</Text>
    </Pressable>
  );
}

interface ResumenSeccionProps {
  titulo: string;
  vacio: string;
  cargando: boolean;
  children: React.ReactNode;
}

function ResumenSeccion({ titulo, vacio, cargando, children }: ResumenSeccionProps) {
  // Children puede ser array (lista de ItemResumen) o un único nodo.
  const items = Array.isArray(children) ? children : [children];
  const tieneItems = items.some(Boolean);

  return (
    <View className="mb-3 rounded-lg border border-slate-200 bg-white p-3">
      <Text className="mb-2 text-sm font-semibold text-slate-700">{titulo}</Text>
      {cargando && !tieneItems ? (
        <Text className="text-sm text-slate-400">Cargando…</Text>
      ) : tieneItems ? (
        <View className="gap-1.5">{items}</View>
      ) : (
        <Text className="text-sm text-slate-400">{vacio}</Text>
      )}
    </View>
  );
}

function ItemResumen({
  titulo,
  subtitulo,
  onPress,
}: {
  titulo: string;
  subtitulo: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 active:bg-slate-100"
    >
      <Text className="text-sm font-medium text-slate-900" numberOfLines={1}>
        {titulo}
      </Text>
      <Text className="text-xs text-slate-500" numberOfLines={1}>
        {subtitulo}
      </Text>
    </Pressable>
  );
}
