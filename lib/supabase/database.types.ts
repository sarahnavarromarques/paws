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
  public: {
    Tables: {
      breeds: {
        Row: {
          description: string | null
          energy_level: number | null
          id: number
          image_url: string | null
          life_expectancy: string | null
          name: string
          size: string | null
          species_id: number
        }
        Insert: {
          description?: string | null
          energy_level?: number | null
          id?: never
          image_url?: string | null
          life_expectancy?: string | null
          name: string
          size?: string | null
          species_id: number
        }
        Update: {
          description?: string | null
          energy_level?: number | null
          id?: never
          image_url?: string | null
          life_expectancy?: string | null
          name?: string
          size?: string | null
          species_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "breeds_species_id_fkey"
            columns: ["species_id"]
            isOneToOne: false
            referencedRelation: "species"
            referencedColumns: ["id"]
          },
        ]
      }
      pet_skills: {
        Row: {
          auto_progress: number | null
          id: number
          is_goal: boolean
          manual_progress: number | null
          pet_id: number
          skill_id: number
          updated_at: string | null
        }
        Insert: {
          auto_progress?: number | null
          id?: never
          is_goal?: boolean
          manual_progress?: number | null
          pet_id: number
          skill_id: number
          updated_at?: string | null
        }
        Update: {
          auto_progress?: number | null
          id?: never
          is_goal?: boolean
          manual_progress?: number | null
          pet_id?: number
          skill_id?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pet_skills_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      pets: {
        Row: {
          age: string | null
          birth_date: string | null
          breed: string | null
          color: string | null
          id: number
          last_training: string | null
          level: string | null
          name: string
          objective: string | null
          photo: string | null
          sex: string | null
          updated_at: string | null
          user_id: string | null
          weight: string | null
        }
        Insert: {
          age?: string | null
          birth_date?: string | null
          breed?: string | null
          color?: string | null
          id?: number
          last_training?: string | null
          level?: string | null
          name: string
          objective?: string | null
          photo?: string | null
          sex?: string | null
          updated_at?: string | null
          user_id?: string | null
          weight?: string | null
        }
        Update: {
          age?: string | null
          birth_date?: string | null
          breed?: string | null
          color?: string | null
          id?: number
          last_training?: string | null
          level?: string | null
          name?: string
          objective?: string | null
          photo?: string | null
          sex?: string | null
          updated_at?: string | null
          user_id?: string | null
          weight?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          language: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          language?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          language?: string
          updated_at?: string
        }
        Relationships: []
      }
      skill_group_items: {
        Row: {
          group_id: number
          id: number
          skill_id: number
        }
        Insert: {
          group_id: number
          id?: never
          skill_id: number
        }
        Update: {
          group_id?: number
          id?: never
          skill_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "skill_group_items_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "skill_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_group_items_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_groups: {
        Row: {
          created_at: string
          id: number
          name: string
          pet_id: number
          signature: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          name: string
          pet_id: number
          signature: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: never
          name?: string
          pet_id?: number
          signature?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_groups_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      skills: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          difficulty: string | null
          id: number
          mistakes_image: string | null
          name: string
          name_en: string | null
          steps_image: string | null
          user_id: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          difficulty?: string | null
          id?: never
          mistakes_image?: string | null
          name: string
          name_en?: string | null
          steps_image?: string | null
          user_id?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          difficulty?: string | null
          id?: never
          mistakes_image?: string | null
          name?: string
          name_en?: string | null
          steps_image?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      species: {
        Row: {
          icon: string | null
          id: number
          name: string
        }
        Insert: {
          icon?: string | null
          id?: never
          name: string
        }
        Update: {
          icon?: string | null
          id?: never
          name?: string
        }
        Relationships: []
      }
      training_sessions: {
        Row: {
          date: string | null
          difficulties: string | null
          duration: string | null
          id: number
          intensity: number | null
          mood: string | null
          notes: string | null
          objective: string | null
          pet_id: number
          rating: number | null
          skill_id: number | null
          successes: string | null
          title: string | null
          training_type: string | null
          updated_at: string | null
        }
        Insert: {
          date?: string | null
          difficulties?: string | null
          duration?: string | null
          id?: number
          intensity?: number | null
          mood?: string | null
          notes?: string | null
          objective?: string | null
          pet_id: number
          rating?: number | null
          skill_id?: number | null
          successes?: string | null
          title?: string | null
          training_type?: string | null
          updated_at?: string | null
        }
        Update: {
          date?: string | null
          difficulties?: string | null
          duration?: string | null
          id?: number
          intensity?: number | null
          mood?: string | null
          notes?: string | null
          objective?: string | null
          pet_id?: number
          rating?: number | null
          skill_id?: number | null
          successes?: string | null
          title?: string | null
          training_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "training_sessions_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_sessions_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      trainings: {
        Row: {
          created_at: string | null
          date: string
          duration: number | null
          id: number
          notes: string | null
          pet_id: number
          skill_group_id: number | null
          skill_id: number | null
          status: string
          time: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date: string
          duration?: number | null
          id?: number
          notes?: string | null
          pet_id: number
          skill_group_id?: number | null
          skill_id?: number | null
          status?: string
          time?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          duration?: number | null
          id?: number
          notes?: string | null
          pet_id?: number
          skill_group_id?: number | null
          skill_id?: number | null
          status?: string
          time?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainings_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainings_skill_group_id_fkey"
            columns: ["skill_group_id"]
            isOneToOne: false
            referencedRelation: "skill_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainings_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
