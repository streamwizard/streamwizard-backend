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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      broadcaster_live_status: {
        Row: {
          broadcaster_id: string
          broadcaster_name: string
          category_id: string | null
          category_name: string | null
          created_at: string
          id: string
          is_live: boolean
          stream_ended_at: string | null
          stream_id: string | null
          stream_started_at: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          broadcaster_id: string
          broadcaster_name: string
          category_id?: string | null
          category_name?: string | null
          created_at?: string
          id?: string
          is_live?: boolean
          stream_ended_at?: string | null
          stream_id?: string | null
          stream_started_at?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          broadcaster_id?: string
          broadcaster_name?: string
          category_id?: string | null
          category_name?: string | null
          created_at?: string
          id?: string
          is_live?: boolean
          stream_ended_at?: string | null
          stream_id?: string | null
          stream_started_at?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "broadcaster_live_status_broadcaster_id_fkey"
            columns: ["broadcaster_id"]
            isOneToOne: true
            referencedRelation: "integrations_twitch"
            referencedColumns: ["twitch_user_id"]
          },
        ]
      }
      clip_folder_junction: {
        Row: {
          clip_id: string
          created_at: string | null
          folder_id: number | null
          id: number
          user_id: string | null
        }
        Insert: {
          clip_id: string
          created_at?: string | null
          folder_id?: number | null
          id?: number
          user_id?: string | null
        }
        Update: {
          clip_id?: string
          created_at?: string | null
          folder_id?: number | null
          id?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clip_folder_junction_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "clip_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      clip_folders: {
        Row: {
          created_at: string | null
          href: string
          id: number
          name: string
          parent_folder_id: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          href: string
          id?: number
          name: string
          parent_folder_id?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          href?: string
          id?: number
          name?: string
          parent_folder_id?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clip_folders_parent_folder_id_fkey"
            columns: ["parent_folder_id"]
            isOneToOne: false
            referencedRelation: "clip_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      clips: {
        Row: {
          broadcaster_id: string
          broadcaster_name: string
          created_at: string
          created_at_twitch: string
          creator_id: string
          creator_name: string
          duration: number | null
          embed_url: string | null
          game_id: string | null
          game_name: string | null
          id: number
          is_featured: boolean
          language: string | null
          thumbnail_url: string | null
          title: string
          twitch_clip_id: string
          url: string
          user_id: string
          video_id: string | null
          view_count: number | null
          vod_offset: number | null
        }
        Insert: {
          broadcaster_id: string
          broadcaster_name: string
          created_at?: string
          created_at_twitch: string
          creator_id: string
          creator_name: string
          duration?: number | null
          embed_url?: string | null
          game_id?: string | null
          game_name?: string | null
          id?: number
          is_featured?: boolean
          language?: string | null
          thumbnail_url?: string | null
          title: string
          twitch_clip_id: string
          url: string
          user_id: string
          video_id?: string | null
          view_count?: number | null
          vod_offset?: number | null
        }
        Update: {
          broadcaster_id?: string
          broadcaster_name?: string
          created_at?: string
          created_at_twitch?: string
          creator_id?: string
          creator_name?: string
          duration?: number | null
          embed_url?: string | null
          game_id?: string | null
          game_name?: string | null
          id?: number
          is_featured?: boolean
          language?: string | null
          thumbnail_url?: string | null
          title?: string
          twitch_clip_id?: string
          url?: string
          user_id?: string
          video_id?: string | null
          view_count?: number | null
          vod_offset?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "clips_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      commands: {
        Row: {
          channel_id: string
          created_at: string
          custom_command_id: string | null
          default_command_id: string | null
          enabled: boolean
          id: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          custom_command_id?: string | null
          default_command_id?: string | null
          enabled?: boolean
          id?: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          custom_command_id?: string | null
          default_command_id?: string | null
          enabled?: boolean
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commands_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "integrations_twitch"
            referencedColumns: ["twitch_user_id"]
          },
          {
            foreignKeyName: "commands_custom_command_id_fkey"
            columns: ["custom_command_id"]
            isOneToOne: false
            referencedRelation: "custom_commands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commands_default_command_id_fkey"
            columns: ["default_command_id"]
            isOneToOne: false
            referencedRelation: "default_chat_commands"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_commands: {
        Row: {
          action: string | null
          command: string
          context: Json | null
          created_at: string
          id: string
          message: string | null
        }
        Insert: {
          action?: string | null
          command: string
          context?: Json | null
          created_at?: string
          id?: string
          message?: string | null
        }
        Update: {
          action?: string | null
          command?: string
          context?: Json | null
          created_at?: string
          id?: string
          message?: string | null
        }
        Relationships: []
      }
      default_chat_commands: {
        Row: {
          action: string | null
          command: string
          context: Json | null
          created_at: string
          id: string
          message: string
        }
        Insert: {
          action?: string | null
          command: string
          context?: Json | null
          created_at?: string
          id?: string
          message: string
        }
        Update: {
          action?: string | null
          command?: string
          context?: Json | null
          created_at?: string
          id?: string
          message?: string
        }
        Relationships: []
      }
      integrations: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          type: Database["public"]["Enums"]["provider_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          type: Database["public"]["Enums"]["provider_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          type?: Database["public"]["Enums"]["provider_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations_twitch: {
        Row: {
          access_token: string | null
          broadcaster_type: string | null
          created_at: string
          description: string | null
          email: string | null
          id: string
          profile_image_url: string | null
          refresh_token: string | null
          token_expires_at: string | null
          twitch_user_id: string
          twitch_username: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          broadcaster_type?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          id: string
          profile_image_url?: string | null
          refresh_token?: string | null
          token_expires_at?: string | null
          twitch_user_id: string
          twitch_username: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          broadcaster_type?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          profile_image_url?: string | null
          refresh_token?: string | null
          token_expires_at?: string | null
          twitch_user_id?: string
          twitch_username?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_twitch_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integrations_twitch_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      smp_actions: {
        Row: {
          action: string
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
          name: string
        }
        Insert: {
          action: string
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          name: string
        }
        Update: {
          action?: string
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          name?: string
        }
        Relationships: []
      }
      smp_channelpoints_templates: {
        Row: {
          action: string | null
          background_color: string | null
          cost: number
          created_at: string
          global_cooldown_seconds: number | null
          id: string
          is_enabled: boolean | null
          is_global_cooldown_enabled: boolean | null
          is_max_per_stream_enabled: boolean | null
          is_max_per_user_per_stream_enabled: boolean | null
          is_user_input_required: boolean | null
          max_per_stream: number | null
          max_per_user_per_stream: number | null
          prompt: string | null
          should_redemptions_skip_request_queue: boolean | null
          title: string
        }
        Insert: {
          action?: string | null
          background_color?: string | null
          cost: number
          created_at?: string
          global_cooldown_seconds?: number | null
          id?: string
          is_enabled?: boolean | null
          is_global_cooldown_enabled?: boolean | null
          is_max_per_stream_enabled?: boolean | null
          is_max_per_user_per_stream_enabled?: boolean | null
          is_user_input_required?: boolean | null
          max_per_stream?: number | null
          max_per_user_per_stream?: number | null
          prompt?: string | null
          should_redemptions_skip_request_queue?: boolean | null
          title: string
        }
        Update: {
          action?: string | null
          background_color?: string | null
          cost?: number
          created_at?: string
          global_cooldown_seconds?: number | null
          id?: string
          is_enabled?: boolean | null
          is_global_cooldown_enabled?: boolean | null
          is_max_per_stream_enabled?: boolean | null
          is_max_per_user_per_stream_enabled?: boolean | null
          is_user_input_required?: boolean | null
          max_per_stream?: number | null
          max_per_user_per_stream?: number | null
          prompt?: string | null
          should_redemptions_skip_request_queue?: boolean | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "smp_channelpoints_templates_action_fkey"
            columns: ["action"]
            isOneToOne: false
            referencedRelation: "smp_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      smp_triggers: {
        Row: {
          action_id: string | null
          conditions: Json
          created_at: string
          event_type: string
          id: string
        }
        Insert: {
          action_id?: string | null
          conditions?: Json
          created_at?: string
          event_type: string
          id?: string
        }
        Update: {
          action_id?: string | null
          conditions?: Json
          created_at?: string
          event_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "smp_triggers_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "smp_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      stream_events: {
        Row: {
          broadcaster_id: string
          created_at: string
          event_data: Json
          event_type: string
          id: string
          metadata: Json | null
          offset_seconds: number
          provider: string
          status: string
          stream_id: string
          updated_at: string
        }
        Insert: {
          broadcaster_id: string
          created_at?: string
          event_data?: Json
          event_type: string
          id?: string
          metadata?: Json | null
          offset_seconds?: number
          provider: string
          status?: string
          stream_id: string
          updated_at?: string
        }
        Update: {
          broadcaster_id?: string
          created_at?: string
          event_data?: Json
          event_type?: string
          id?: string
          metadata?: Json | null
          offset_seconds?: number
          provider?: string
          status?: string
          stream_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stream_events_broadcaster_id_fkey"
            columns: ["broadcaster_id"]
            isOneToOne: false
            referencedRelation: "integrations_twitch"
            referencedColumns: ["twitch_user_id"]
          },
        ]
      }
      system_events: {
        Row: {
          broadcaster_id: string | null
          created_at: string
          error_message: string | null
          event_data: Json
          event_type: string
          id: string
          metadata: Json | null
          provider: string
          status: string
          updated_at: string
        }
        Insert: {
          broadcaster_id?: string | null
          created_at?: string
          error_message?: string | null
          event_data?: Json
          event_type: string
          id?: string
          metadata?: Json | null
          provider: string
          status?: string
          updated_at?: string
        }
        Update: {
          broadcaster_id?: string | null
          created_at?: string
          error_message?: string | null
          event_data?: Json
          event_type?: string
          id?: string
          metadata?: Json | null
          provider?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      twitch_app_token: {
        Row: {
          access_token: string
          created_at: string
          expires_in: number
          id: string
          token_type: string
          updated_at: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_in: number
          id?: string
          token_type: string
          updated_at?: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_in?: number
          id?: string
          token_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      twitch_clip_syncs: {
        Row: {
          clip_count: number
          created_at: string | null
          id: number
          last_sync: string
          sync_status: Database["public"]["Enums"]["clip_sync_status"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          clip_count: number
          created_at?: string | null
          id?: number
          last_sync: string
          sync_status: Database["public"]["Enums"]["clip_sync_status"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          clip_count?: number
          created_at?: string | null
          id?: number
          last_sync?: string
          sync_status?: Database["public"]["Enums"]["clip_sync_status"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string | null
          id: string
          sync_clips_on_end: boolean
          theme: Database["public"]["Enums"]["theme_type"] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          sync_clips_on_end?: boolean
          theme?: Database["public"]["Enums"]["theme_type"] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          sync_clips_on_end?: boolean
          theme?: Database["public"]["Enums"]["theme_type"] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          name: string
          role: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          id: string
          name: string
          role?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_clip_to_folder: {
        Args: { p_clip_id: string; p_folder_id: string }
        Returns: undefined
      }
      check_user_role: {
        Args: { p_role: string; p_user_id: string }
        Returns: boolean
      }
      get_all_clips_with_folders: {
        Args: never
        Returns: {
          broadcaster_id: string
          broadcaster_name: string
          created_at: string
          created_at_twitch: string
          creator_id: string
          creator_name: string
          duration: number
          embed_url: string
          folders: Json
          game_id: string
          game_name: string
          id: number
          is_featured: boolean
          language: string
          thumbnail_url: string
          title: string
          twitch_clip_id: string
          url: string
          user_id: string
          video_id: string
          view_count: number
          vod_offset: number
        }[]
      }
      get_clips_by_folder: {
        Args: { folder_href: string }
        Returns: {
          broadcaster_id: string
          broadcaster_name: string
          created_at: string
          created_at_twitch: string
          creator_id: string
          creator_name: string
          duration: number
          embed_url: string
          folders: Json
          game_id: string
          game_name: string
          id: number
          is_featured: boolean
          language: string
          thumbnail_url: string
          title: string
          twitch_clip_id: string
          url: string
          user_id: string
          video_id: string
          view_count: number
          vod_offset: number
        }[]
      }
      get_user_twitch_ids: { Args: never; Returns: string[] }
      insert_discord_integration: {
        Args: { integration_id: string; provider_data: Json; user_id: string }
        Returns: undefined
      }
      insert_integration: {
        Args: {
          p_provider_type: Database["public"]["Enums"]["provider_type"]
          p_user_id: string
        }
        Returns: string
      }
      insert_twitch_integration: {
        Args: { integration_id: string; provider_data: Json; user_id: string }
        Returns: undefined
      }
      remove_clip_from_folder: {
        Args: { p_clip_id: string; p_folder_id: string }
        Returns: undefined
      }
      sync_all_default_commands: {
        Args: never
        Returns: {
          total_channels: number
          total_commands_added: number
        }[]
      }
      sync_default_commands_for_channels: {
        Args: { target_channel_id?: string }
        Returns: {
          commands_added: number
          returned_channel_id: string
        }[]
      }
      user_owns_channel: { Args: { channel_id: string }; Returns: boolean }
    }
    Enums: {
      actions:
        | "spotify.song_request"
        | "spotify.add_banned_song"
        | "spotify.remove_banned_song"
        | "spotify.add_banned_chatter"
        | "spotify.remove_banned_chatter"
        | "spotify.skip"
        | "none"
      clip_sync_status: "completed" | "failed" | "syncing"
      provider_type: "twitch" | "discord"
      roles: "user" | "beta" | "admin"
      theme_type: "dark" | "light" | "system"
      userlevel:
        | "everyone"
        | "follower"
        | "vip"
        | "subscriber"
        | "moderator"
        | "super_moderator"
        | "broadcaster"
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
  public: {
    Enums: {
      actions: [
        "spotify.song_request",
        "spotify.add_banned_song",
        "spotify.remove_banned_song",
        "spotify.add_banned_chatter",
        "spotify.remove_banned_chatter",
        "spotify.skip",
        "none",
      ],
      clip_sync_status: ["completed", "failed", "syncing"],
      provider_type: ["twitch", "discord"],
      roles: ["user", "beta", "admin"],
      theme_type: ["dark", "light", "system"],
      userlevel: [
        "everyone",
        "follower",
        "vip",
        "subscriber",
        "moderator",
        "super_moderator",
        "broadcaster",
      ],
    },
  },
} as const
