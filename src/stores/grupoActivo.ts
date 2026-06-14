/**
 * Store del grupo activo (Zustand).
 *
 * Un usuario puede pertenecer a varios grupos (multi-grupo). Este store
 * guarda el grupo actualmente seleccionado y lo persiste en AsyncStorage
 * para que la app abra en el último grupo usado.
 *
 * La persistencia se hace de forma manual (no usamos middleware de
 * Zustand) para tener control explícito y poder limpiarla en signOut.
 *
 * Ver docs/01-vision-y-alcance.md §3.3 y RF-015.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const STORAGE_KEY = '@coro-administracion:grupo-activo';

export interface GrupoActivo {
  id: string;
  nombre: string;
  rol: 'admin' | 'miembro';
}

interface GrupoActivoState {
  grupo: GrupoActivo | null;
  hydrated: boolean;
  setGrupo: (grupo: GrupoActivo | null) => void;
  /**
   * Lee el grupo persistido de AsyncStorage. Se llama UNA vez al
   * montar la app post-auth.
   */
  hydrate: () => Promise<void>;
  /**
   * Limpia el store y borra la persistencia. Se llama en signOut.
   */
  clear: () => Promise<void>;
}

export const useGrupoActivoStore = create<GrupoActivoState>((set) => ({
  grupo: null,
  hydrated: false,

  setGrupo: (grupo) => {
    set({ grupo });
    if (grupo) {
      // Fire and forget: no bloqueamos el set por el I/O.
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(grupo));
    } else {
      void AsyncStorage.removeItem(STORAGE_KEY);
    }
  },

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as GrupoActivo;
        set({ grupo: parsed, hydrated: true });
        return;
      }
    } catch (e) {
      console.warn('[grupoActivo] hydrate error:', e);
    }
    set({ hydrated: true });
  },

  clear: async () => {
    set({ grupo: null, hydrated: false });
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
  },
}));
