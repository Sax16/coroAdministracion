export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      asignaciones_servicio: {
        Row: {
          created_at: string | null
          id: string
          rol_servicio: Database["public"]["Enums"]["rol_servicio_enum"]
          servicio_id: string
          usuario_grupo_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          rol_servicio: Database["public"]["Enums"]["rol_servicio_enum"]
          servicio_id: string
          usuario_grupo_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          rol_servicio?: Database["public"]["Enums"]["rol_servicio_enum"]
          servicio_id?: string
          usuario_grupo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asignaciones_servicio_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "servicios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asignaciones_servicio_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "v_asistencia_servicio"
            referencedColumns: ["servicio_id"]
          },
          {
            foreignKeyName: "asignaciones_servicio_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "v_mi_semana"
            referencedColumns: ["servicio_id"]
          },
          {
            foreignKeyName: "asignaciones_servicio_usuario_grupo_id_fkey"
            columns: ["usuario_grupo_id"]
            isOneToOne: false
            referencedRelation: "usuarios_grupos"
            referencedColumns: ["id"]
          },
        ]
      }
      asistencias_ensayo: {
        Row: {
          estado: Database["public"]["Enums"]["estado_asistencia_ensayo_enum"]
          id: string
          invitacion_id: string
          set_by: string | null
          updated_at: string | null
        }
        Insert: {
          estado: Database["public"]["Enums"]["estado_asistencia_ensayo_enum"]
          id?: string
          invitacion_id: string
          set_by?: string | null
          updated_at?: string | null
        }
        Update: {
          estado?: Database["public"]["Enums"]["estado_asistencia_ensayo_enum"]
          id?: string
          invitacion_id?: string
          set_by?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asistencias_ensayo_invitacion_id_fkey"
            columns: ["invitacion_id"]
            isOneToOne: true
            referencedRelation: "invitados_ensayo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asistencias_ensayo_set_by_fkey"
            columns: ["set_by"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comunicados: {
        Row: {
          created_at: string | null
          descripcion: string
          fecha_inicio: string | null
          grupo_id: string
          id: string
          lugar: string | null
          titulo: string
        }
        Insert: {
          created_at?: string | null
          descripcion: string
          fecha_inicio?: string | null
          grupo_id: string
          id?: string
          lugar?: string | null
          titulo: string
        }
        Update: {
          created_at?: string | null
          descripcion?: string
          fecha_inicio?: string | null
          grupo_id?: string
          id?: string
          lugar?: string | null
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "comunicados_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "grupos"
            referencedColumns: ["id"]
          },
        ]
      }
      dispositivos: {
        Row: {
          app_version: string | null
          created_at: string | null
          expo_push_token: string
          id: string
          last_seen_at: string | null
          plataforma: Database["public"]["Enums"]["plataforma_enum"] | null
          updated_at: string | null
          usuario_id: string
        }
        Insert: {
          app_version?: string | null
          created_at?: string | null
          expo_push_token: string
          id?: string
          last_seen_at?: string | null
          plataforma?: Database["public"]["Enums"]["plataforma_enum"] | null
          updated_at?: string | null
          usuario_id: string
        }
        Update: {
          app_version?: string | null
          created_at?: string | null
          expo_push_token?: string
          id?: string
          last_seen_at?: string | null
          plataforma?: Database["public"]["Enums"]["plataforma_enum"] | null
          updated_at?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispositivos_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ensayos: {
        Row: {
          asistencia_cerrada: boolean
          asistencia_cerrada_at: string | null
          asistencia_cerrada_por: string | null
          created_at: string | null
          descripcion: string | null
          encargado_id: string | null
          estado: Database["public"]["Enums"]["estado_evento_enum"]
          fecha_fin: string | null
          fecha_inicio: string
          grupo_id: string
          id: string
          lugar: string | null
          tema: string | null
          titulo: string
          updated_at: string | null
        }
        Insert: {
          asistencia_cerrada?: boolean
          asistencia_cerrada_at?: string | null
          asistencia_cerrada_por?: string | null
          created_at?: string | null
          descripcion?: string | null
          encargado_id?: string | null
          estado?: Database["public"]["Enums"]["estado_evento_enum"]
          fecha_fin?: string | null
          fecha_inicio: string
          grupo_id: string
          id?: string
          lugar?: string | null
          tema?: string | null
          titulo: string
          updated_at?: string | null
        }
        Update: {
          asistencia_cerrada?: boolean
          asistencia_cerrada_at?: string | null
          asistencia_cerrada_por?: string | null
          created_at?: string | null
          descripcion?: string | null
          encargado_id?: string | null
          estado?: Database["public"]["Enums"]["estado_evento_enum"]
          fecha_fin?: string | null
          fecha_inicio?: string
          grupo_id?: string
          id?: string
          lugar?: string | null
          tema?: string | null
          titulo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ensayos_asistencia_cerrada_por_fkey"
            columns: ["asistencia_cerrada_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ensayos_encargado_id_fkey"
            columns: ["encargado_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ensayos_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "grupos"
            referencedColumns: ["id"]
          },
        ]
      }
      estados_asistencia_servicio: {
        Row: {
          asignacion_id: string
          estado: Database["public"]["Enums"]["estado_asistencia_enum"]
          id: string
          set_by: string | null
          updated_at: string | null
        }
        Insert: {
          asignacion_id: string
          estado?: Database["public"]["Enums"]["estado_asistencia_enum"]
          id?: string
          set_by?: string | null
          updated_at?: string | null
        }
        Update: {
          asignacion_id?: string
          estado?: Database["public"]["Enums"]["estado_asistencia_enum"]
          id?: string
          set_by?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estados_asistencia_servicio_asignacion_id_fkey"
            columns: ["asignacion_id"]
            isOneToOne: true
            referencedRelation: "asignaciones_servicio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estados_asistencia_servicio_set_by_fkey"
            columns: ["set_by"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      grupos: {
        Row: {
          admin_id: string
          created_at: string | null
          deleted_at: string | null
          descripcion: string | null
          id: string
          nombre: string
          updated_at: string | null
          zona_horaria: string
        }
        Insert: {
          admin_id: string
          created_at?: string | null
          deleted_at?: string | null
          descripcion?: string | null
          id?: string
          nombre: string
          updated_at?: string | null
          zona_horaria?: string
        }
        Update: {
          admin_id?: string
          created_at?: string | null
          deleted_at?: string | null
          descripcion?: string | null
          id?: string
          nombre?: string
          updated_at?: string | null
          zona_horaria?: string
        }
        Relationships: [
          {
            foreignKeyName: "grupos_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invitados_ensayo: {
        Row: {
          created_at: string | null
          ensayo_id: string
          id: string
          usuario_grupo_id: string
        }
        Insert: {
          created_at?: string | null
          ensayo_id: string
          id?: string
          usuario_grupo_id: string
        }
        Update: {
          created_at?: string | null
          ensayo_id?: string
          id?: string
          usuario_grupo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitados_ensayo_ensayo_id_fkey"
            columns: ["ensayo_id"]
            isOneToOne: false
            referencedRelation: "ensayos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitados_ensayo_usuario_grupo_id_fkey"
            columns: ["usuario_grupo_id"]
            isOneToOne: false
            referencedRelation: "usuarios_grupos"
            referencedColumns: ["id"]
          },
        ]
      }
      justificaciones_servicio: {
        Row: {
          created_at: string | null
          id: string
          servicio_id: string
          texto: string
          usuario_grupo_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          servicio_id: string
          texto: string
          usuario_grupo_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          servicio_id?: string
          texto?: string
          usuario_grupo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "justificaciones_servicio_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "servicios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "justificaciones_servicio_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "v_asistencia_servicio"
            referencedColumns: ["servicio_id"]
          },
          {
            foreignKeyName: "justificaciones_servicio_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "v_mi_semana"
            referencedColumns: ["servicio_id"]
          },
          {
            foreignKeyName: "justificaciones_servicio_usuario_grupo_id_fkey"
            columns: ["usuario_grupo_id"]
            isOneToOne: false
            referencedRelation: "usuarios_grupos"
            referencedColumns: ["id"]
          },
        ]
      }
      notificaciones: {
        Row: {
          created_at: string
          cuerpo: string
          enviada_at: string
          id: string
          leida: boolean
          leida_at: string | null
          payload: Json
          referencia_id: string | null
          tipo: Database["public"]["Enums"]["tipo_notificacion_enum"]
          titulo: string
          updated_at: string
          usuario_id: string
        }
        Insert: {
          created_at?: string
          cuerpo: string
          enviada_at?: string
          id?: string
          leida?: boolean
          leida_at?: string | null
          payload?: Json
          referencia_id?: string | null
          tipo: Database["public"]["Enums"]["tipo_notificacion_enum"]
          titulo: string
          updated_at?: string
          usuario_id: string
        }
        Update: {
          created_at?: string
          cuerpo?: string
          enviada_at?: string
          id?: string
          leida?: boolean
          leida_at?: string | null
          payload?: Json
          referencia_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_notificacion_enum"]
          titulo?: string
          updated_at?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificaciones_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      patrones_recurrentes: {
        Row: {
          configuracion: Json
          grupo_id: string
          id: string
          offset_alarma_min: number
          semanas_generadas: number
          updated_at: string | null
        }
        Insert: {
          configuracion: Json
          grupo_id: string
          id?: string
          offset_alarma_min?: number
          semanas_generadas?: number
          updated_at?: string | null
        }
        Update: {
          configuracion?: Json
          grupo_id?: string
          id?: string
          offset_alarma_min?: number
          semanas_generadas?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patrones_recurrentes_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: true
            referencedRelation: "grupos"
            referencedColumns: ["id"]
          },
        ]
      }
      perfiles: {
        Row: {
          apellido: string
          created_at: string | null
          email: string
          foto_url: string | null
          id: string
          nombre: string
          telefono: string | null
          updated_at: string | null
        }
        Insert: {
          apellido: string
          created_at?: string | null
          email: string
          foto_url?: string | null
          id: string
          nombre: string
          telefono?: string | null
          updated_at?: string | null
        }
        Update: {
          apellido?: string
          created_at?: string | null
          email?: string
          foto_url?: string | null
          id?: string
          nombre?: string
          telefono?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      servicios: {
        Row: {
          asistencia_cerrada: boolean
          asistencia_cerrada_at: string | null
          asistencia_cerrada_por: string | null
          created_at: string | null
          descripcion: string | null
          estado: Database["public"]["Enums"]["estado_evento_enum"]
          fecha_fin: string | null
          fecha_inicio: string
          grupo_id: string
          id: string
          lugar: string | null
          notas_canciones: string | null
          responsable_id: string | null
          tipo: Database["public"]["Enums"]["tipo_evento_enum"]
          titulo: string | null
          updated_at: string | null
        }
        Insert: {
          asistencia_cerrada?: boolean
          asistencia_cerrada_at?: string | null
          asistencia_cerrada_por?: string | null
          created_at?: string | null
          descripcion?: string | null
          estado?: Database["public"]["Enums"]["estado_evento_enum"]
          fecha_fin?: string | null
          fecha_inicio: string
          grupo_id: string
          id?: string
          lugar?: string | null
          notas_canciones?: string | null
          responsable_id?: string | null
          tipo: Database["public"]["Enums"]["tipo_evento_enum"]
          titulo?: string | null
          updated_at?: string | null
        }
        Update: {
          asistencia_cerrada?: boolean
          asistencia_cerrada_at?: string | null
          asistencia_cerrada_por?: string | null
          created_at?: string | null
          descripcion?: string | null
          estado?: Database["public"]["Enums"]["estado_evento_enum"]
          fecha_fin?: string | null
          fecha_inicio?: string
          grupo_id?: string
          id?: string
          lugar?: string | null
          notas_canciones?: string | null
          responsable_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_evento_enum"]
          titulo?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "servicios_asistencia_cerrada_por_fkey"
            columns: ["asistencia_cerrada_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicios_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "grupos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicios_responsable_id_fkey"
            columns: ["responsable_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitudes_grupo: {
        Row: {
          created_at: string | null
          estado: Database["public"]["Enums"]["estado_solicitud_enum"]
          grupo_id: string
          id: string
          mensaje: string | null
          respondida_at: string | null
          respondida_por: string | null
          usuario_id: string
        }
        Insert: {
          created_at?: string | null
          estado: Database["public"]["Enums"]["estado_solicitud_enum"]
          grupo_id: string
          id?: string
          mensaje?: string | null
          respondida_at?: string | null
          respondida_por?: string | null
          usuario_id: string
        }
        Update: {
          created_at?: string | null
          estado?: Database["public"]["Enums"]["estado_solicitud_enum"]
          grupo_id?: string
          id?: string
          mensaje?: string | null
          respondida_at?: string | null
          respondida_por?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitudes_grupo_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "grupos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitudes_grupo_respondida_por_fkey"
            columns: ["respondida_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitudes_grupo_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios_grupos: {
        Row: {
          created_at: string | null
          estado: Database["public"]["Enums"]["estado_membresia_enum"]
          fecha_ingreso: string
          grupo_id: string
          id: string
          rol: Database["public"]["Enums"]["rol_grupo_enum"]
          updated_at: string | null
          usuario_id: string
        }
        Insert: {
          created_at?: string | null
          estado: Database["public"]["Enums"]["estado_membresia_enum"]
          fecha_ingreso?: string
          grupo_id: string
          id?: string
          rol: Database["public"]["Enums"]["rol_grupo_enum"]
          updated_at?: string | null
          usuario_id: string
        }
        Update: {
          created_at?: string | null
          estado?: Database["public"]["Enums"]["estado_membresia_enum"]
          fecha_ingreso?: string
          grupo_id?: string
          id?: string
          rol?: Database["public"]["Enums"]["rol_grupo_enum"]
          updated_at?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_grupos_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "grupos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuarios_grupos_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_asistencia_servicio: {
        Row: {
          asistencia_cerrada: boolean | null
          q_asistio: number | null
          q_justificado: number | null
          q_no_asistio: number | null
          servicio_id: string | null
        }
        Relationships: []
      }
      v_mi_semana: {
        Row: {
          estado: Database["public"]["Enums"]["estado_evento_enum"] | null
          fecha_fin: string | null
          fecha_inicio: string | null
          grupo_id: string | null
          lugar: string | null
          mis_roles: string[] | null
          servicio_id: string | null
          soy_responsable: boolean | null
          titulo: string | null
        }
        Relationships: [
          {
            foreignKeyName: "servicios_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "grupos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      aprobar_solicitud: {
        Args: { p_solicitud_id: string }
        Returns: undefined
      }
      crear_grupo: {
        Args: { p_descripcion?: string; p_nombre: string }
        Returns: string
      }
      eliminar_cuenta: { Args: never; Returns: undefined }
      eliminar_grupo: { Args: { p_grupo_id: string }; Returns: undefined }
      transferir_admin: {
        Args: { p_grupo_id: string; p_nuevo_admin_usuario_grupo_id: string }
        Returns: undefined
      }
      usuario_es_admin_de: {
        Args: { gid: string; uid: string }
        Returns: boolean
      }
      usuario_grupos_activos: { Args: { uid: string }; Returns: string[] }
      usuario_puede_cerrar_ensayo: {
        Args: { eid: string; uid: string }
        Returns: boolean
      }
      usuario_puede_cerrar_servicio: {
        Args: { sid: string; uid: string }
        Returns: boolean
      }
    }
    Enums: {
      estado_asistencia_ensayo_enum: "asistio" | "no_asistio"
      estado_asistencia_enum: "asistio" | "no_asistio" | "justificado"
      estado_evento_enum: "programado" | "cancelado" | "realizado"
      estado_membresia_enum: "activo" | "inactivo"
      estado_solicitud_enum: "pendiente" | "aprobada" | "rechazada"
      plataforma_enum: "ios" | "android"
      rol_grupo_enum: "admin" | "miembro"
      rol_servicio_enum: "cantante" | "musico" | "limpieza"
      tipo_evento_enum: "servicio" | "ensayo" | "comunicado"
      tipo_notificacion_enum:
        | "servicio_creado"
        | "servicio_modificado"
        | "servicio_cancelado"
        | "ensayo_creado"
        | "ensayo_modificado"
        | "ensayo_cancelado"
        | "comunicado_publicado"
        | "solicitud_recibida"
        | "solicitud_aprobada"
        | "solicitud_rechazada"
        | "asignacion_nueva"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      estado_asistencia_ensayo_enum: ["asistio", "no_asistio"],
      estado_asistencia_enum: ["asistio", "no_asistio", "justificado"],
      estado_evento_enum: ["programado", "cancelado", "realizado"],
      estado_membresia_enum: ["activo", "inactivo"],
      estado_solicitud_enum: ["pendiente", "aprobada", "rechazada"],
      plataforma_enum: ["ios", "android"],
      rol_grupo_enum: ["admin", "miembro"],
      rol_servicio_enum: ["cantante", "musico", "limpieza"],
      tipo_evento_enum: ["servicio", "ensayo", "comunicado"],
      tipo_notificacion_enum: [
        "servicio_creado",
        "servicio_modificado",
        "servicio_cancelado",
        "ensayo_creado",
        "ensayo_modificado",
        "ensayo_cancelado",
        "comunicado_publicado",
        "solicitud_recibida",
        "solicitud_aprobada",
        "solicitud_rechazada",
        "asignacion_nueva",
      ],
    },
  },
} as const
