/**
 * Store del grupo activo (Zustand).
 *
 * Un usuario puede pertenecer a varios grupos (multi-grupo). Este store
 * guarda el grupo actualmente seleccionado y persiste la elección para
 * que la app abra en el último grupo usado.
 *
 * TODO (post-bootstrap):
 * - Persistir el grupoId con AsyncStorage / expo-secure-store.
 * - Cargar la lista de grupos del usuario al login.
 * - Acción `setGrupoActivo(grupoId)` con validación contra la lista.
 */
import { create } from 'zustand';

interface GrupoActivo {
  id: string;
  nombre: string;
  rol: 'admin' | 'miembro';
}

interface GrupoActivoState {
  grupo: GrupoActivo | null;
  setGrupo: (grupo: GrupoActivo | null) => void;
}

export const useGrupoActivoStore = create<GrupoActivoState>((set) => ({
  grupo: null,
  setGrupo: (grupo) => set({ grupo }),
}));
