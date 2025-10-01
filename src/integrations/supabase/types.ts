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
      biometric_readings: {
        Row: {
          created_at: string | null
          device_id: number | null
          distance: number | null
          heart_rate: number | null
          hydration: number | null
          id: string
          lactic_acid: number | null
          muscle_fatigue: number | null
          player_id: string | null
          speed: number | null
          steps: number | null
          temperature: number | null
          timestamp: string | null
          vo2_max: number | null
        }
        Insert: {
          created_at?: string | null
          device_id?: number | null
          distance?: number | null
          heart_rate?: number | null
          hydration?: number | null
          id?: string
          lactic_acid?: number | null
          muscle_fatigue?: number | null
          player_id?: string | null
          speed?: number | null
          steps?: number | null
          temperature?: number | null
          timestamp?: string | null
          vo2_max?: number | null
        }
        Update: {
          created_at?: string | null
          device_id?: number | null
          distance?: number | null
          heart_rate?: number | null
          hydration?: number | null
          id?: string
          lactic_acid?: number | null
          muscle_fatigue?: number | null
          player_id?: string | null
          speed?: number | null
          steps?: number | null
          temperature?: number | null
          timestamp?: string | null
          vo2_max?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "biometric_readings_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biometric_readings_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          created_at: string | null
          external_id: string
          id: string
          name: string
          synced_at: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          external_id: string
          id?: string
          name: string
          synced_at?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          external_id?: string
          id?: string
          name?: string
          synced_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      devices: {
        Row: {
          assigned_player_id: string | null
          bluetooth_id: string | null
          connection_type: string | null
          created_at: string | null
          device_id: string | null
          device_name: string
          device_type: string | null
          id: number
          last_connected: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_player_id?: string | null
          bluetooth_id?: string | null
          connection_type?: string | null
          created_at?: string | null
          device_id?: string | null
          device_name: string
          device_type?: string | null
          id?: number
          last_connected?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_player_id?: string | null
          bluetooth_id?: string | null
          connection_type?: string | null
          created_at?: string | null
          device_id?: string | null
          device_name?: string
          device_type?: string | null
          id?: number
          last_connected?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "devices_assigned_player_id_fkey"
            columns: ["assigned_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      gps_tracking: {
        Row: {
          accuracy: number | null
          altitude: number | null
          created_at: string
          device_id: number | null
          heading: number | null
          id: string
          latitude: number
          longitude: number
          player_id: string | null
          session_id: string | null
          speed: number | null
          timestamp: string
        }
        Insert: {
          accuracy?: number | null
          altitude?: number | null
          created_at?: string
          device_id?: number | null
          heading?: number | null
          id?: string
          latitude: number
          longitude: number
          player_id?: string | null
          session_id?: string | null
          speed?: number | null
          timestamp: string
        }
        Update: {
          accuracy?: number | null
          altitude?: number | null
          created_at?: string
          device_id?: number | null
          heading?: number | null
          id?: string
          latitude?: number
          longitude?: number
          player_id?: string | null
          session_id?: string | null
          speed?: number | null
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "gps_tracking_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gps_tracking_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gps_tracking_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ml_models: {
        Row: {
          accuracy: number | null
          created_at: string | null
          id: string
          model_data: Json | null
          name: string
          updated_at: string | null
          version: string
        }
        Insert: {
          accuracy?: number | null
          created_at?: string | null
          id?: string
          model_data?: Json | null
          name: string
          updated_at?: string | null
          version: string
        }
        Update: {
          accuracy?: number | null
          created_at?: string | null
          id?: string
          model_data?: Json | null
          name?: string
          updated_at?: string | null
          version?: string
        }
        Relationships: []
      }
      ml_training_sessions: {
        Row: {
          activity_type: string
          created_at: string | null
          device_id: number | null
          duration: number | null
          end_time: string | null
          id: string
          parameters: Json | null
          player_id: string | null
          start_time: string | null
          updated_at: string | null
          video_id: string | null
          video_timestamp: number | null
        }
        Insert: {
          activity_type: string
          created_at?: string | null
          device_id?: number | null
          duration?: number | null
          end_time?: string | null
          id?: string
          parameters?: Json | null
          player_id?: string | null
          start_time?: string | null
          updated_at?: string | null
          video_id?: string | null
          video_timestamp?: number | null
        }
        Update: {
          activity_type?: string
          created_at?: string | null
          device_id?: number | null
          duration?: number | null
          end_time?: string | null
          id?: string
          parameters?: Json | null
          player_id?: string | null
          start_time?: string | null
          updated_at?: string | null
          video_id?: string | null
          video_timestamp?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ml_training_sessions_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ml_training_sessions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      model_versions: {
        Row: {
          accuracy: number | null
          created_at: string | null
          id: string
          model_file_path: string | null
          parameters: Json | null
          training_date: string | null
          updated_at: string | null
          version: string
        }
        Insert: {
          accuracy?: number | null
          created_at?: string | null
          id?: string
          model_file_path?: string | null
          parameters?: Json | null
          training_date?: string | null
          updated_at?: string | null
          version: string
        }
        Update: {
          accuracy?: number | null
          created_at?: string | null
          id?: string
          model_file_path?: string | null
          parameters?: Json | null
          training_date?: string | null
          updated_at?: string | null
          version?: string
        }
        Relationships: []
      }
      movement_analytics: {
        Row: {
          avg_speed: number | null
          created_at: string
          id: string
          player_id: string | null
          session_id: string | null
          sprint_count: number | null
          time_in_attacking_third: number | null
          time_in_defensive_third: number | null
          time_in_middle_third: number | null
          timestamp: string
          top_speed: number | null
          total_distance: number | null
        }
        Insert: {
          avg_speed?: number | null
          created_at?: string
          id?: string
          player_id?: string | null
          session_id?: string | null
          sprint_count?: number | null
          time_in_attacking_third?: number | null
          time_in_defensive_third?: number | null
          time_in_middle_third?: number | null
          timestamp: string
          top_speed?: number | null
          total_distance?: number | null
        }
        Update: {
          avg_speed?: number | null
          created_at?: string
          id?: string
          player_id?: string | null
          session_id?: string | null
          sprint_count?: number | null
          time_in_attacking_third?: number | null
          time_in_defensive_third?: number | null
          time_in_middle_third?: number | null
          timestamp?: string
          top_speed?: number | null
          total_distance?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "movement_analytics_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movement_analytics_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      object_detections: {
        Row: {
          confidence: number | null
          created_at: string | null
          frame_time: number | null
          height: number | null
          id: string
          object_class: string | null
          video_id: string | null
          width: number | null
          x_coord: number | null
          y_coord: number | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          frame_time?: number | null
          height?: number | null
          id?: string
          object_class?: string | null
          video_id?: string | null
          width?: number | null
          x_coord?: number | null
          y_coord?: number | null
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          frame_time?: number | null
          height?: number | null
          id?: string
          object_class?: string | null
          video_id?: string | null
          width?: number | null
          x_coord?: number | null
          y_coord?: number | null
        }
        Relationships: []
      }
      pass_analysis: {
        Row: {
          created_at: string | null
          end_x: number | null
          end_y: number | null
          id: string
          is_successful: boolean | null
          player_id: string | null
          start_x: number | null
          start_y: number | null
          timestamp: string | null
        }
        Insert: {
          created_at?: string | null
          end_x?: number | null
          end_y?: number | null
          id?: string
          is_successful?: boolean | null
          player_id?: string | null
          start_x?: number | null
          start_y?: number | null
          timestamp?: string | null
        }
        Update: {
          created_at?: string | null
          end_x?: number | null
          end_y?: number | null
          id?: string
          is_successful?: boolean | null
          player_id?: string | null
          start_x?: number | null
          start_y?: number | null
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pass_analysis_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      pitch_calibration: {
        Row: {
          corner_ne_lat: number
          corner_ne_lon: number
          corner_nw_lat: number
          corner_nw_lon: number
          corner_se_lat: number
          corner_se_lon: number
          corner_sw_lat: number
          corner_sw_lon: number
          created_at: string
          id: string
          is_active: boolean | null
          name: string
          pitch_length: number
          pitch_width: number
          updated_at: string
        }
        Insert: {
          corner_ne_lat: number
          corner_ne_lon: number
          corner_nw_lat: number
          corner_nw_lon: number
          corner_se_lat: number
          corner_se_lon: number
          corner_sw_lat: number
          corner_sw_lon: number
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
          pitch_length: number
          pitch_width: number
          updated_at?: string
        }
        Update: {
          corner_ne_lat?: number
          corner_ne_lon?: number
          corner_nw_lat?: number
          corner_nw_lon?: number
          corner_se_lat?: number
          corner_se_lon?: number
          corner_sw_lat?: number
          corner_sw_lon?: number
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
          pitch_length?: number
          pitch_width?: number
          updated_at?: string
        }
        Relationships: []
      }
      player_physical_data: {
        Row: {
          body_fat_percentage: number | null
          created_at: string | null
          height: number | null
          id: string
          max_heart_rate: number | null
          player_id: string | null
          resting_heart_rate: number | null
          updated_at: string | null
          weight: number | null
        }
        Insert: {
          body_fat_percentage?: number | null
          created_at?: string | null
          height?: number | null
          id?: string
          max_heart_rate?: number | null
          player_id?: string | null
          resting_heart_rate?: number | null
          updated_at?: string | null
          weight?: number | null
        }
        Update: {
          body_fat_percentage?: number | null
          created_at?: string | null
          height?: number | null
          id?: string
          max_heart_rate?: number | null
          player_id?: string | null
          resting_heart_rate?: number | null
          updated_at?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "player_physical_data_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      player_tracking: {
        Row: {
          confidence: number | null
          created_at: string | null
          frame_number: number | null
          id: string
          player_id: string | null
          timestamp: string | null
          video_id: string | null
          x_coord: number | null
          y_coord: number | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          frame_number?: number | null
          id?: string
          player_id?: string | null
          timestamp?: string | null
          video_id?: string | null
          x_coord?: number | null
          y_coord?: number | null
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          frame_number?: number | null
          id?: string
          player_id?: string | null
          timestamp?: string | null
          video_id?: string | null
          x_coord?: number | null
          y_coord?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "player_tracking_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          club_id: string | null
          created_at: string | null
          external_id: string | null
          id: string
          name: string
          player_type: string | null
          position: string | null
          squad_number: number | null
          synced_at: string | null
          team_id: string | null
          updated_at: string | null
        }
        Insert: {
          club_id?: string | null
          created_at?: string | null
          external_id?: string | null
          id?: string
          name: string
          player_type?: string | null
          position?: string | null
          squad_number?: number | null
          synced_at?: string | null
          team_id?: string | null
          updated_at?: string | null
        }
        Update: {
          club_id?: string | null
          created_at?: string | null
          external_id?: string | null
          id?: string
          name?: string
          player_type?: string | null
          position?: string | null
          squad_number?: number | null
          synced_at?: string | null
          team_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "players_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      sensor_recordings: {
        Row: {
          created_at: string | null
          device_id: number | null
          id: string
          player_id: string | null
          sensor_type: string | null
          timestamp: string | null
          training_session_id: string | null
          x: number | null
          y: number | null
          z: number | null
        }
        Insert: {
          created_at?: string | null
          device_id?: number | null
          id?: string
          player_id?: string | null
          sensor_type?: string | null
          timestamp?: string | null
          training_session_id?: string | null
          x?: number | null
          y?: number | null
          z?: number | null
        }
        Update: {
          created_at?: string | null
          device_id?: number | null
          id?: string
          player_id?: string | null
          sensor_type?: string | null
          timestamp?: string | null
          training_session_id?: string | null
          x?: number | null
          y?: number | null
          z?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sensor_recordings_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sensor_recordings_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sensor_recordings_training_session_id_fkey"
            columns: ["training_session_id"]
            isOneToOne: false
            referencedRelation: "ml_training_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          created_at: string | null
          end_time: string | null
          id: string
          notes: string | null
          session_type: string | null
          start_time: string | null
        }
        Insert: {
          created_at?: string | null
          end_time?: string | null
          id?: string
          notes?: string | null
          session_type?: string | null
          start_time?: string | null
        }
        Update: {
          created_at?: string | null
          end_time?: string | null
          id?: string
          notes?: string | null
          session_type?: string | null
          start_time?: string | null
        }
        Relationships: []
      }
      shot_analysis: {
        Row: {
          created_at: string | null
          id: string
          is_goal: boolean | null
          location_x: number | null
          location_y: number | null
          player_id: string | null
          timestamp: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_goal?: boolean | null
          location_x?: number | null
          location_y?: number | null
          player_id?: string | null
          timestamp?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_goal?: boolean | null
          location_x?: number | null
          location_y?: number | null
          player_id?: string | null
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shot_analysis_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          club_id: string | null
          created_at: string | null
          external_id: string
          id: string
          name: string
          synced_at: string | null
          updated_at: string | null
        }
        Insert: {
          club_id?: string | null
          created_at?: string | null
          external_id: string
          id?: string
          name: string
          synced_at?: string | null
          updated_at?: string | null
        }
        Update: {
          club_id?: string | null
          created_at?: string | null
          external_id?: string
          id?: string
          name?: string
          synced_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
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
    Enums: {},
  },
} as const
