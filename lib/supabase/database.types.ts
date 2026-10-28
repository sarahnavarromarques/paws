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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      ai_usage: {
        Row: {
          cost_usd: number
          created_at: string
          feature: string
          id: string
          input_tokens: number
          model: string
          output_tokens: number
          user_id: string
        }
        Insert: {
          cost_usd?: number
          created_at?: string
          feature: string
          id?: string
          input_tokens?: number
          model: string
          output_tokens?: number
          user_id: string
        }
        Update: {
          cost_usd?: number
          created_at?: string
          feature?: string
          id?: string
          input_tokens?: number
          model?: string
          output_tokens?: number
          user_id?: string
        }
        Relationships: []
      }
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
      homework_assignments: {
        Row: {
          active: boolean
          attempts_per_session: number
          created_at: string
          id: string
          instructions: string | null
          pet_id: number
          sessions_per_week: number
          skill_id: number | null
          title: string
          trainer_id: string
        }
        Insert: {
          active?: boolean
          attempts_per_session?: number
          created_at?: string
          id?: string
          instructions?: string | null
          pet_id: number
          sessions_per_week?: number
          skill_id?: number | null
          title: string
          trainer_id: string
        }
        Update: {
          active?: boolean
          attempts_per_session?: number
          created_at?: string
          id?: string
          instructions?: string | null
          pet_id?: number
          sessions_per_week?: number
          skill_id?: number | null
          title?: string
          trainer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "homework_assignments_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_assignments_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      homework_logs: {
        Row: {
          assignment_id: string
          attempts: number
          id: string
          logged_at: string
          pet_id: number
          successes: number
          user_id: string
        }
        Insert: {
          assignment_id: string
          attempts: number
          id?: string
          logged_at?: string
          pet_id: number
          successes: number
          user_id?: string
        }
        Update: {
          assignment_id?: string
          attempts?: number
          id?: string
          logged_at?: string
          pet_id?: number
          successes?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "homework_logs_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "homework_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_logs_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      huesito_transactions: {
        Row: {
          amount: number
          created_at: string
          feature: string | null
          id: number
          kind: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          feature?: string | null
          id?: never
          kind: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          feature?: string | null
          id?: never
          kind?: string
          user_id?: string
        }
        Relationships: []
      }
      huesito_wallets: {
        Row: {
          created_at: string
          purchased_balance: number
          subscription_balance: number
          subscription_expires_at: string | null
          unlimited: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          purchased_balance?: number
          subscription_balance?: number
          subscription_expires_at?: string | null
          unlimited?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          purchased_balance?: number
          subscription_balance?: number
          subscription_expires_at?: string | null
          unlimited?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pet_questionnaires: {
        Row: {
          answers: Json
          created_at: string
          id: number
          pet_id: number
          proposal: Json | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          answers?: Json
          created_at?: string
          id?: never
          pet_id: number
          proposal?: Json | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          answers?: Json
          created_at?: string
          id?: never
          pet_id?: number
          proposal?: Json | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pet_questionnaires_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: true
            referencedRelation: "pets"
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
      pet_trainers: {
        Row: {
          client_name: string | null
          created_at: string
          id: string
          invite_id: string | null
          owner_id: string
          pet_id: number
          trainer_id: string
        }
        Insert: {
          client_name?: string | null
          created_at?: string
          id?: string
          invite_id?: string | null
          owner_id: string
          pet_id: number
          trainer_id: string
        }
        Update: {
          client_name?: string | null
          created_at?: string
          id?: string
          invite_id?: string | null
          owner_id?: string
          pet_id?: number
          trainer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pet_trainers_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "trainer_invites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_trainers_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      pet_vaccinations: {
        Row: {
          batch_number: string | null
          category: string
          created_at: string
          dose_label: string | null
          due_date: string | null
          given_date: string | null
          id: string
          interval_months: number | null
          name: string
          notes: string | null
          pet_id: number
          photo_path: string | null
          product: string | null
          status: string
          updated_at: string
          user_id: string
          vaccine_key: string | null
          vet: string | null
        }
        Insert: {
          batch_number?: string | null
          category?: string
          created_at?: string
          dose_label?: string | null
          due_date?: string | null
          given_date?: string | null
          id?: string
          interval_months?: number | null
          name: string
          notes?: string | null
          pet_id: number
          photo_path?: string | null
          product?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          vaccine_key?: string | null
          vet?: string | null
        }
        Update: {
          batch_number?: string | null
          category?: string
          created_at?: string
          dose_label?: string | null
          due_date?: string | null
          given_date?: string | null
          id?: string
          interval_months?: number | null
          name?: string
          notes?: string | null
          pet_id?: number
          photo_path?: string | null
          product?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          vaccine_key?: string | null
          vet?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pet_vaccinations_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
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
          account_type: string
          avatar_url: string | null
          calendar_token: string
          clicker_settings: Json | null
          created_at: string
          first_name: string | null
          first_steps_dismissed: boolean
          id: string
          language: string
          last_name: string | null
          onboarding_completed: boolean
          tours_seen: string[]
          updated_at: string
          username: string | null
        }
        Insert: {
          account_type?: string
          avatar_url?: string | null
          calendar_token?: string
          clicker_settings?: Json | null
          created_at?: string
          first_name?: string | null
          first_steps_dismissed?: boolean
          id: string
          language?: string
          last_name?: string | null
          onboarding_completed?: boolean
          tours_seen?: string[]
          updated_at?: string
          username?: string | null
        }
        Update: {
          account_type?: string
          avatar_url?: string | null
          calendar_token?: string
          clicker_settings?: Json | null
          created_at?: string
          first_name?: string | null
          first_steps_dismissed?: boolean
          id?: string
          language?: string
          last_name?: string | null
          onboarding_completed?: boolean
          tours_seen?: string[]
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      progress_analyses: {
        Row: {
          created_at: string
          data: Json
          locale: string
          pet_id: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data: Json
          locale?: string
          pet_id: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          locale?: string
          pet_id?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "progress_analyses_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: true
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
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
          category_en: string | null
          created_at: string | null
          description: string | null
          description_en: string | null
          difficulty: string | null
          id: number
          mistakes_image: string | null
          mistakes_image_en: string | null
          name: string
          name_en: string | null
          steps_image: string | null
          steps_image_en: string | null
          user_id: string | null
          video_url: string | null
          video_url_en: string | null
        }
        Insert: {
          category?: string | null
          category_en?: string | null
          created_at?: string | null
          description?: string | null
          description_en?: string | null
          difficulty?: string | null
          id?: never
          mistakes_image?: string | null
          mistakes_image_en?: string | null
          name: string
          name_en?: string | null
          steps_image?: string | null
          steps_image_en?: string | null
          user_id?: string | null
          video_url?: string | null
          video_url_en?: string | null
        }
        Update: {
          category?: string | null
          category_en?: string | null
          created_at?: string | null
          description?: string | null
          description_en?: string | null
          difficulty?: string | null
          id?: never
          mistakes_image?: string | null
          mistakes_image_en?: string | null
          name?: string
          name_en?: string | null
          steps_image?: string | null
          steps_image_en?: string | null
          user_id?: string | null
          video_url?: string | null
          video_url_en?: string | null
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
      trainer_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          client_name: string
          created_at: string
          id: string
          token: string
          trainer_id: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          client_name: string
          created_at?: string
          id?: string
          token?: string
          trainer_id: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          client_name?: string
          created_at?: string
          id?: string
          token?: string
          trainer_id?: string
        }
        Relationships: []
      }
      training_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: number
          role: string
          training_id: number
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: never
          role: string
          training_id: number
          user_id?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: never
          role?: string
          training_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_chat_messages_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "trainings"
            referencedColumns: ["id"]
          },
        ]
      }
      training_guides: {
        Row: {
          created_at: string
          data: Json
          id: number
          locale: string
          training_id: number
          updated_at: string
          used_fallback: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          data: Json
          id?: never
          locale?: string
          training_id: number
          updated_at?: string
          used_fallback?: boolean
          user_id?: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: never
          locale?: string
          training_id?: number
          updated_at?: string
          used_fallback?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_guides_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: true
            referencedRelation: "trainings"
            referencedColumns: ["id"]
          },
        ]
      }
      training_order_recommendations: {
        Row: {
          created_at: string
          data: Json
          id: number
          pet_id: number
          updated_at: string
          used_fallback: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          data: Json
          id?: never
          pet_id: number
          updated_at?: string
          used_fallback?: boolean
          user_id?: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: never
          pet_id?: number
          updated_at?: string
          used_fallback?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_order_recommendations_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: true
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
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
      accept_trainer_invite: {
        Args: { p_pet_ids: number[]; p_token: string }
        Returns: Json
      }
      get_my_trainer_links: {
        Args: never
        Returns: {
          client_name: string
          created_at: string
          link_id: string
          other_name: string
          pet_id: number
          pet_name: string
          pet_photo: string
          role: string
        }[]
      }
      get_trainer_invite: { Args: { p_token: string }; Returns: Json }
      is_trainer_of_pet: { Args: { p_pet_id: number }; Returns: boolean }
      paws_display_name: { Args: { p_user_id: string }; Returns: string }
      spend_huesitos: {
        Args: { p_amount: number; p_feature: string }
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
