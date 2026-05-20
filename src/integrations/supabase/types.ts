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
      academies: {
        Row: {
          club_website_url: string | null
          created_at: string
          eppp_category: string | null
          external_id: string | null
          fa_registration_number: string | null
          founded_year: number | null
          head_of_academy_user_id: string | null
          id: string
          logo_url: string | null
          name: string
          synced_at: string | null
          updated_at: string
        }
        Insert: {
          club_website_url?: string | null
          created_at?: string
          eppp_category?: string | null
          external_id?: string | null
          fa_registration_number?: string | null
          founded_year?: number | null
          head_of_academy_user_id?: string | null
          id?: string
          logo_url?: string | null
          name: string
          synced_at?: string | null
          updated_at?: string
        }
        Update: {
          club_website_url?: string | null
          created_at?: string
          eppp_category?: string | null
          external_id?: string | null
          fa_registration_number?: string | null
          founded_year?: number | null
          head_of_academy_user_id?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          synced_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academies_head_of_academy_user_id_fkey"
            columns: ["head_of_academy_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_settings: {
        Row: {
          academy_id: string
          created_at: string
          eppp_category: string | null
          eppp_tier: string | null
          fa_affiliation_number: string | null
          founded_year: number | null
          head_of_academy_user_id: string | null
          id: string
          name: string | null
          prefs: Json
          updated_at: string
        }
        Insert: {
          academy_id: string
          created_at?: string
          eppp_category?: string | null
          eppp_tier?: string | null
          fa_affiliation_number?: string | null
          founded_year?: number | null
          head_of_academy_user_id?: string | null
          id?: string
          name?: string | null
          prefs?: Json
          updated_at?: string
        }
        Update: {
          academy_id?: string
          created_at?: string
          eppp_category?: string | null
          eppp_tier?: string | null
          fa_affiliation_number?: string | null
          founded_year?: number | null
          head_of_academy_user_id?: string | null
          id?: string
          name?: string | null
          prefs?: Json
          updated_at?: string
        }
        Relationships: []
      }
      attribute_definition: {
        Row: {
          category: string
          created_at: string
          descriptors: Json | null
          id: string
          is_active: boolean
          max_value: number
          name: string
          source: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          descriptors?: Json | null
          id?: string
          is_active?: boolean
          max_value?: number
          name: string
          source?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          descriptors?: Json | null
          id?: string
          is_active?: boolean
          max_value?: number
          name?: string
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      attribute_snapshot: {
        Row: {
          created_at: string
          id: string
          is_final: boolean
          notes: string | null
          player_id: string
          scores: Json
          season: string | null
          snapshot_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_final?: boolean
          notes?: string | null
          player_id: string
          scores?: Json
          season?: string | null
          snapshot_date?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_final?: boolean
          notes?: string | null
          player_id?: string
          scores?: Json
          season?: string | null
          snapshot_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          metadata: Json | null
          record_id: string | null
          table_name: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          record_id?: string | null
          table_name?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          record_id?: string | null
          table_name?: string | null
        }
        Relationships: []
      }
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
          academy_id: string | null
          created_at: string | null
          external_id: string
          id: string
          logo_url: string | null
          name: string
          synced_at: string | null
          updated_at: string | null
        }
        Insert: {
          academy_id?: string | null
          created_at?: string | null
          external_id: string
          id?: string
          logo_url?: string | null
          name: string
          synced_at?: string | null
          updated_at?: string | null
        }
        Update: {
          academy_id?: string | null
          created_at?: string | null
          external_id?: string
          id?: string
          logo_url?: string | null
          name?: string
          synced_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clubs_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_observation: {
        Row: {
          author_id: string | null
          body: string | null
          category: string | null
          created_at: string
          id: string
          observed_at: string
          player_id: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body?: string | null
          category?: string | null
          created_at?: string
          id?: string
          observed_at?: string
          player_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body?: string | null
          category?: string | null
          created_at?: string
          id?: string
          observed_at?: string
          player_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      curriculum_outcome: {
        Row: {
          age_group: string | null
          created_at: string
          description: string | null
          id: string
          outcome_description: string | null
          outcome_title: string | null
          season: string | null
          tags: string[] | null
          title: string | null
          updated_at: string
        }
        Insert: {
          age_group?: string | null
          created_at?: string
          description?: string | null
          id?: string
          outcome_description?: string | null
          outcome_title?: string | null
          season?: string | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          age_group?: string | null
          created_at?: string
          description?: string | null
          id?: string
          outcome_description?: string | null
          outcome_title?: string | null
          season?: string | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string
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
      fitness_benchmark: {
        Row: {
          age_group: string | null
          created_at: string
          id: string
          percentile: number | null
          sex: string | null
          test_name: string
          unit: string | null
          updated_at: string
          value: number | null
        }
        Insert: {
          age_group?: string | null
          created_at?: string
          id?: string
          percentile?: number | null
          sex?: string | null
          test_name: string
          unit?: string | null
          updated_at?: string
          value?: number | null
        }
        Update: {
          age_group?: string | null
          created_at?: string
          id?: string
          percentile?: number | null
          sex?: string | null
          test_name?: string
          unit?: string | null
          updated_at?: string
          value?: number | null
        }
        Relationships: []
      }
      fitness_test_result: {
        Row: {
          bio_age: number | null
          created_at: string
          id: string
          notes: string | null
          percentile: number | null
          player_id: string
          test_date: string
          test_name: string
          unit: string | null
          updated_at: string
          value: number | null
        }
        Insert: {
          bio_age?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          percentile?: number | null
          player_id: string
          test_date: string
          test_name: string
          unit?: string | null
          updated_at?: string
          value?: number | null
        }
        Update: {
          bio_age?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          percentile?: number | null
          player_id?: string
          test_date?: string
          test_name?: string
          unit?: string | null
          updated_at?: string
          value?: number | null
        }
        Relationships: []
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
      injury_record: {
        Row: {
          body_part: string | null
          created_at: string
          id: string
          injury_date: string
          is_resolved: boolean
          notes: string | null
          player_id: string
          resolved_at: string | null
          rtp_phase: number
          severity: string | null
          updated_at: string
        }
        Insert: {
          body_part?: string | null
          created_at?: string
          id?: string
          injury_date: string
          is_resolved?: boolean
          notes?: string | null
          player_id: string
          resolved_at?: string | null
          rtp_phase?: number
          severity?: string | null
          updated_at?: string
        }
        Update: {
          body_part?: string | null
          created_at?: string
          id?: string
          injury_date?: string
          is_resolved?: boolean
          notes?: string | null
          player_id?: string
          resolved_at?: string | null
          rtp_phase?: number
          severity?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      match_insights: {
        Row: {
          coaching_focus: Json | null
          created_at: string
          error: string | null
          id: string
          match_id: string
          status: string
          summary: string | null
          team_strengths: Json | null
          team_weaknesses: Json | null
          top_performers: Json | null
          updated_at: string
        }
        Insert: {
          coaching_focus?: Json | null
          created_at?: string
          error?: string | null
          id?: string
          match_id: string
          status?: string
          summary?: string | null
          team_strengths?: Json | null
          team_weaknesses?: Json | null
          top_performers?: Json | null
          updated_at?: string
        }
        Update: {
          coaching_focus?: Json | null
          created_at?: string
          error?: string | null
          id?: string
          match_id?: string
          status?: string
          summary?: string | null
          team_strengths?: Json | null
          team_weaknesses?: Json | null
          top_performers?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_insights_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: true
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      match_shares: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string | null
          file_type: string
          id: string
          match_id: string
          revoked: boolean
          share_token: string
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string | null
          file_type: string
          id?: string
          match_id: string
          revoked?: boolean
          share_token: string
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string | null
          file_type?: string
          id?: string
          match_id?: string
          revoked?: boolean
          share_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_shares_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      match_videos: {
        Row: {
          camera_side: string
          created_at: string
          duration_seconds: number | null
          file_size: number | null
          id: string
          match_id: string
          resolution: string | null
          upload_status: string
          wasabi_path: string | null
        }
        Insert: {
          camera_side: string
          created_at?: string
          duration_seconds?: number | null
          file_size?: number | null
          id?: string
          match_id: string
          resolution?: string | null
          upload_status?: string
          wasabi_path?: string | null
        }
        Update: {
          camera_side?: string
          created_at?: string
          duration_seconds?: number | null
          file_size?: number | null
          id?: string
          match_id?: string
          resolution?: string | null
          upload_status?: string
          wasabi_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_videos_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          age_group: string | null
          away_color: string | null
          away_score: number | null
          away_team: string | null
          club_id: string | null
          created_at: string
          home_color: string | null
          home_score: number | null
          home_team: string | null
          id: string
          is_home: boolean | null
          location: string | null
          match_date: string | null
          match_type: string | null
          status: string
          team_id: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          age_group?: string | null
          away_color?: string | null
          away_score?: number | null
          away_team?: string | null
          club_id?: string | null
          created_at?: string
          home_color?: string | null
          home_score?: number | null
          home_team?: string | null
          id?: string
          is_home?: boolean | null
          location?: string | null
          match_date?: string | null
          match_type?: string | null
          status?: string
          team_id?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          age_group?: string | null
          away_color?: string | null
          away_score?: number | null
          away_team?: string | null
          club_id?: string | null
          created_at?: string
          home_color?: string | null
          home_score?: number | null
          home_team?: string | null
          id?: string
          is_home?: boolean | null
          location?: string | null
          match_date?: string | null
          match_type?: string | null
          status?: string
          team_id?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      maturation_record: {
        Row: {
          bio_age_estimate: number | null
          created_at: string
          height_cm: number | null
          id: string
          method_used: string | null
          player_id: string
          recorded_date: string
          seated_height_cm: number | null
          updated_at: string
          weight_kg: number | null
        }
        Insert: {
          bio_age_estimate?: number | null
          created_at?: string
          height_cm?: number | null
          id?: string
          method_used?: string | null
          player_id: string
          recorded_date: string
          seated_height_cm?: number | null
          updated_at?: string
          weight_kg?: number | null
        }
        Update: {
          bio_age_estimate?: number | null
          created_at?: string
          height_cm?: number | null
          id?: string
          method_used?: string | null
          player_id?: string
          recorded_date?: string
          seated_height_cm?: number | null
          updated_at?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
      milestones: {
        Row: {
          achieved_date: string | null
          category: string | null
          created_at: string
          description: string | null
          id: string
          is_upcoming: boolean
          milestone_date: string | null
          player_id: string
          title: string
          updated_at: string
        }
        Insert: {
          achieved_date?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_upcoming?: boolean
          milestone_date?: string | null
          player_id: string
          title: string
          updated_at?: string
        }
        Update: {
          achieved_date?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_upcoming?: boolean
          milestone_date?: string | null
          player_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
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
      parent_communication: {
        Row: {
          created_at: string
          direction: string | null
          id: string
          message: string | null
          player_id: string
          sent_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          direction?: string | null
          id?: string
          message?: string | null
          player_id: string
          sent_at?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          direction?: string | null
          id?: string
          message?: string | null
          player_id?: string
          sent_at?: string
          updated_at?: string
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
      player_attributes: {
        Row: {
          acceleration: number | null
          aerial_reach: number | null
          aggression: number | null
          agility: number | null
          anticipation: number | null
          balance: number | null
          bravery: number | null
          command_of_area: number | null
          communication: number | null
          composure: number | null
          concentration: number | null
          corners: number | null
          created_at: string
          cross_handling: number | null
          crossing: number | null
          decisions: number | null
          determination: number | null
          distribution: number | null
          dribbling: number | null
          eccentricity: number | null
          external_id: string | null
          finishing: number | null
          first_touch: number | null
          flair: number | null
          footwork: number | null
          free_kicks: number | null
          handling: number | null
          heading: number | null
          id: string
          jumping: number | null
          kicking: number | null
          leadership: number | null
          long_shots: number | null
          long_throws: number | null
          marking: number | null
          natural_fitness: number | null
          off_the_ball: number | null
          one_on_one: number | null
          pace: number | null
          passing: number | null
          penalties: number | null
          player_id: string
          positioning: number | null
          punching: number | null
          reflexes: number | null
          rushing_out: number | null
          shot_stopping: number | null
          stamina: number | null
          strength: number | null
          synced_at: string | null
          tackling: number | null
          teamwork: number | null
          technique: number | null
          throwing: number | null
          updated_at: string
          vision: number | null
          work_rate: number | null
        }
        Insert: {
          acceleration?: number | null
          aerial_reach?: number | null
          aggression?: number | null
          agility?: number | null
          anticipation?: number | null
          balance?: number | null
          bravery?: number | null
          command_of_area?: number | null
          communication?: number | null
          composure?: number | null
          concentration?: number | null
          corners?: number | null
          created_at?: string
          cross_handling?: number | null
          crossing?: number | null
          decisions?: number | null
          determination?: number | null
          distribution?: number | null
          dribbling?: number | null
          eccentricity?: number | null
          external_id?: string | null
          finishing?: number | null
          first_touch?: number | null
          flair?: number | null
          footwork?: number | null
          free_kicks?: number | null
          handling?: number | null
          heading?: number | null
          id?: string
          jumping?: number | null
          kicking?: number | null
          leadership?: number | null
          long_shots?: number | null
          long_throws?: number | null
          marking?: number | null
          natural_fitness?: number | null
          off_the_ball?: number | null
          one_on_one?: number | null
          pace?: number | null
          passing?: number | null
          penalties?: number | null
          player_id: string
          positioning?: number | null
          punching?: number | null
          reflexes?: number | null
          rushing_out?: number | null
          shot_stopping?: number | null
          stamina?: number | null
          strength?: number | null
          synced_at?: string | null
          tackling?: number | null
          teamwork?: number | null
          technique?: number | null
          throwing?: number | null
          updated_at?: string
          vision?: number | null
          work_rate?: number | null
        }
        Update: {
          acceleration?: number | null
          aerial_reach?: number | null
          aggression?: number | null
          agility?: number | null
          anticipation?: number | null
          balance?: number | null
          bravery?: number | null
          command_of_area?: number | null
          communication?: number | null
          composure?: number | null
          concentration?: number | null
          corners?: number | null
          created_at?: string
          cross_handling?: number | null
          crossing?: number | null
          decisions?: number | null
          determination?: number | null
          distribution?: number | null
          dribbling?: number | null
          eccentricity?: number | null
          external_id?: string | null
          finishing?: number | null
          first_touch?: number | null
          flair?: number | null
          footwork?: number | null
          free_kicks?: number | null
          handling?: number | null
          heading?: number | null
          id?: string
          jumping?: number | null
          kicking?: number | null
          leadership?: number | null
          long_shots?: number | null
          long_throws?: number | null
          marking?: number | null
          natural_fitness?: number | null
          off_the_ball?: number | null
          one_on_one?: number | null
          pace?: number | null
          passing?: number | null
          penalties?: number | null
          player_id?: string
          positioning?: number | null
          punching?: number | null
          reflexes?: number | null
          rushing_out?: number | null
          shot_stopping?: number | null
          stamina?: number | null
          strength?: number | null
          synced_at?: string | null
          tackling?: number | null
          teamwork?: number | null
          technique?: number | null
          throwing?: number | null
          updated_at?: string
          vision?: number | null
          work_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "player_attributes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: true
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
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
          availability: string | null
          club_id: string | null
          created_at: string | null
          date_of_birth: string | null
          expected_return_date: string | null
          external_id: string | null
          id: string
          name: string
          photo_url: string | null
          player_type: string | null
          position: string | null
          squad_number: number | null
          synced_at: string | null
          team_id: string | null
          updated_at: string | null
        }
        Insert: {
          availability?: string | null
          club_id?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          expected_return_date?: string | null
          external_id?: string | null
          id?: string
          name: string
          photo_url?: string | null
          player_type?: string | null
          position?: string | null
          squad_number?: number | null
          synced_at?: string | null
          team_id?: string | null
          updated_at?: string | null
        }
        Update: {
          availability?: string | null
          club_id?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          expected_return_date?: string | null
          external_id?: string | null
          id?: string
          name?: string
          photo_url?: string | null
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
      processing_jobs: {
        Row: {
          ball_tracking_data: Json | null
          completed_at: string | null
          created_at: string
          divergence_metrics: Json | null
          event_data: Json | null
          gpu_type: string | null
          heatmaps: Json | null
          id: string
          match_id: string
          output_highlights_path: string | null
          output_metadata_path: string | null
          output_video_path: string | null
          player_metrics: Json | null
          player_tracking_data: Json | null
          processing_logs: string | null
          runpod_job_id: string | null
          started_at: string | null
          status: string
          team_metrics: Json | null
        }
        Insert: {
          ball_tracking_data?: Json | null
          completed_at?: string | null
          created_at?: string
          divergence_metrics?: Json | null
          event_data?: Json | null
          gpu_type?: string | null
          heatmaps?: Json | null
          id?: string
          match_id: string
          output_highlights_path?: string | null
          output_metadata_path?: string | null
          output_video_path?: string | null
          player_metrics?: Json | null
          player_tracking_data?: Json | null
          processing_logs?: string | null
          runpod_job_id?: string | null
          started_at?: string | null
          status?: string
          team_metrics?: Json | null
        }
        Update: {
          ball_tracking_data?: Json | null
          completed_at?: string | null
          created_at?: string
          divergence_metrics?: Json | null
          event_data?: Json | null
          gpu_type?: string | null
          heatmaps?: Json | null
          id?: string
          match_id?: string
          output_highlights_path?: string | null
          output_metadata_path?: string | null
          output_video_path?: string | null
          player_metrics?: Json | null
          player_tracking_data?: Json | null
          processing_logs?: string | null
          runpod_job_id?: string | null
          started_at?: string | null
          status?: string
          team_metrics?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "processing_jobs_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          dbs_expiry: string | null
          email: string | null
          fa_safeguarding_expiry: string | null
          first_aid_expiry: string | null
          full_name: string | null
          id: string
          uefa_licence: string | null
          updated_at: string
          user_group_tier: string
        }
        Insert: {
          created_at?: string
          dbs_expiry?: string | null
          email?: string | null
          fa_safeguarding_expiry?: string | null
          first_aid_expiry?: string | null
          full_name?: string | null
          id: string
          uefa_licence?: string | null
          updated_at?: string
          user_group_tier?: string
        }
        Update: {
          created_at?: string
          dbs_expiry?: string | null
          email?: string | null
          fa_safeguarding_expiry?: string | null
          first_aid_expiry?: string | null
          full_name?: string | null
          id?: string
          uefa_licence?: string | null
          updated_at?: string
          user_group_tier?: string
        }
        Relationships: []
      }
      prospect: {
        Row: {
          academy_id: string
          approach_date: string | null
          competing_interest: string | null
          created_at: string
          current_club: string | null
          dob: string | null
          first_name: string
          id: string
          international_eligibility_confirmed: boolean
          last_name: string
          parent_contact: string | null
          pipeline_stage: string
          position: string | null
          updated_at: string
        }
        Insert: {
          academy_id: string
          approach_date?: string | null
          competing_interest?: string | null
          created_at?: string
          current_club?: string | null
          dob?: string | null
          first_name: string
          id?: string
          international_eligibility_confirmed?: boolean
          last_name: string
          parent_contact?: string | null
          pipeline_stage?: string
          position?: string | null
          updated_at?: string
        }
        Update: {
          academy_id?: string
          approach_date?: string | null
          competing_interest?: string | null
          created_at?: string
          current_club?: string | null
          dob?: string | null
          first_name?: string
          id?: string
          international_eligibility_confirmed?: boolean
          last_name?: string
          parent_contact?: string | null
          pipeline_stage?: string
          position?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      school_attendance: {
        Row: {
          academic_year: string | null
          attendance_pct: number | null
          created_at: string
          id: string
          player_id: string
          term: string | null
          updated_at: string
        }
        Insert: {
          academic_year?: string | null
          attendance_pct?: number | null
          created_at?: string
          id?: string
          player_id: string
          term?: string | null
          updated_at?: string
        }
        Update: {
          academic_year?: string | null
          attendance_pct?: number | null
          created_at?: string
          id?: string
          player_id?: string
          term?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      scout_report: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          prospect_id: string
          rating: number | null
          report_date: string
          scout_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          prospect_id: string
          rating?: number | null
          report_date?: string
          scout_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          prospect_id?: string
          rating?: number | null
          report_date?: string
          scout_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scout_report_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospect"
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
      session_plan: {
        Row: {
          age_group: string | null
          created_at: string
          created_by: string | null
          curriculum_tags: string[] | null
          drills: Json | null
          duration_minutes: number | null
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          age_group?: string | null
          created_at?: string
          created_by?: string | null
          curriculum_tags?: string[] | null
          drills?: Json | null
          duration_minutes?: number | null
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          age_group?: string | null
          created_at?: string
          created_by?: string | null
          curriculum_tags?: string[] | null
          drills?: Json | null
          duration_minutes?: number | null
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
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
      team_event_player_stats: {
        Row: {
          age_group: string | null
          appearances: number | null
          assists: number | null
          created_at: string
          event_id: string
          external_id: string
          goals: number | null
          id: string
          is_captain: boolean | null
          is_substitute: boolean | null
          minutes_played: number | null
          period_number: number | null
          player_id: string | null
          position: string | null
          season_start: number | null
          substitution_time: string | null
          synced_at: string | null
          team_number: number | null
          updated_at: string
        }
        Insert: {
          age_group?: string | null
          appearances?: number | null
          assists?: number | null
          created_at?: string
          event_id: string
          external_id: string
          goals?: number | null
          id?: string
          is_captain?: boolean | null
          is_substitute?: boolean | null
          minutes_played?: number | null
          period_number?: number | null
          player_id?: string | null
          position?: string | null
          season_start?: number | null
          substitution_time?: string | null
          synced_at?: string | null
          team_number?: number | null
          updated_at?: string
        }
        Update: {
          age_group?: string | null
          appearances?: number | null
          assists?: number | null
          created_at?: string
          event_id?: string
          external_id?: string
          goals?: number | null
          id?: string
          is_captain?: boolean | null
          is_substitute?: boolean | null
          minutes_played?: number | null
          period_number?: number | null
          player_id?: string | null
          position?: string | null
          season_start?: number | null
          substitution_time?: string | null
          synced_at?: string | null
          team_number?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      team_events: {
        Row: {
          away_score: number | null
          created_at: string
          date: string
          end_time: string | null
          event_type: string
          external_id: string
          game_duration: number | null
          game_format: string | null
          home_score: number | null
          id: string
          is_home: boolean | null
          location: string | null
          match_id: string | null
          meeting_time: string | null
          notes: string | null
          opponent: string | null
          start_time: string | null
          synced_at: string | null
          team_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          away_score?: number | null
          created_at?: string
          date: string
          end_time?: string | null
          event_type: string
          external_id: string
          game_duration?: number | null
          game_format?: string | null
          home_score?: number | null
          id?: string
          is_home?: boolean | null
          location?: string | null
          match_id?: string | null
          meeting_time?: string | null
          notes?: string | null
          opponent?: string | null
          start_time?: string | null
          synced_at?: string | null
          team_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          away_score?: number | null
          created_at?: string
          date?: string
          end_time?: string | null
          event_type?: string
          external_id?: string
          game_duration?: number | null
          game_format?: string | null
          home_score?: number | null
          id?: string
          is_home?: boolean | null
          location?: string | null
          match_id?: string | null
          meeting_time?: string | null
          notes?: string | null
          opponent?: string | null
          start_time?: string | null
          synced_at?: string | null
          team_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_match_events: {
        Row: {
          created_at: string
          event_id: string
          event_type: string
          external_id: string
          id: string
          minute: number | null
          notes: string | null
          period_number: number | null
          player_id: string | null
          synced_at: string | null
          team_side: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          event_type: string
          external_id: string
          id?: string
          minute?: number | null
          notes?: string | null
          period_number?: number | null
          player_id?: string | null
          synced_at?: string | null
          team_side?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          event_type?: string
          external_id?: string
          id?: string
          minute?: number | null
          notes?: string | null
          period_number?: number | null
          player_id?: string | null
          synced_at?: string | null
          team_side?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_match_events_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "team_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_match_events_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          age_group: string | null
          club_id: string | null
          created_at: string | null
          external_id: string
          game_format: string | null
          id: string
          logo_url: string | null
          name: string
          synced_at: string | null
          updated_at: string | null
        }
        Insert: {
          age_group?: string | null
          club_id?: string | null
          created_at?: string | null
          external_id: string
          game_format?: string | null
          id?: string
          logo_url?: string | null
          name: string
          synced_at?: string | null
          updated_at?: string | null
        }
        Update: {
          age_group?: string | null
          club_id?: string | null
          created_at?: string | null
          external_id?: string
          game_format?: string | null
          id?: string
          logo_url?: string | null
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
      track_player_mapping: {
        Row: {
          created_at: string
          id: string
          match_id: string
          player_id: string | null
          team_label: string | null
          track_id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          match_id: string
          player_id?: string | null
          team_label?: string | null
          track_id: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          match_id?: string
          player_id?: string | null
          team_label?: string | null
          track_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "track_player_mapping_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "track_player_mapping_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      training_load: {
        Row: {
          acwr_at_time: number | null
          created_at: string
          duration: number | null
          id: string
          load_au: number | null
          notes: string | null
          player_id: string
          rpe: number | null
          session_date: string
          session_type: string | null
          updated_at: string
        }
        Insert: {
          acwr_at_time?: number | null
          created_at?: string
          duration?: number | null
          id?: string
          load_au?: number | null
          notes?: string | null
          player_id: string
          rpe?: number | null
          session_date: string
          session_type?: string | null
          updated_at?: string
        }
        Update: {
          acwr_at_time?: number | null
          created_at?: string
          duration?: number | null
          id?: string
          load_au?: number | null
          notes?: string | null
          player_id?: string
          rpe?: number | null
          session_date?: string
          session_type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      travel_accommodation: {
        Row: {
          address: string | null
          booking_reference: string | null
          check_in: string | null
          check_out: string | null
          created_at: string
          hotel_name: string
          id: string
          meal_plan: string | null
          notes: string | null
          phone: string | null
          room_count: number | null
          status: string
          travel_event_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          booking_reference?: string | null
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          hotel_name: string
          id?: string
          meal_plan?: string | null
          notes?: string | null
          phone?: string | null
          room_count?: number | null
          status?: string
          travel_event_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          booking_reference?: string | null
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          hotel_name?: string
          id?: string
          meal_plan?: string | null
          notes?: string | null
          phone?: string | null
          room_count?: number | null
          status?: string
          travel_event_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "travel_accommodation_travel_event_id_fkey"
            columns: ["travel_event_id"]
            isOneToOne: false
            referencedRelation: "travel_event"
            referencedColumns: ["id"]
          },
        ]
      }
      travel_budget_item: {
        Row: {
          actual_amount: number | null
          budgeted_amount: number | null
          category: string
          created_at: string
          description: string | null
          id: string
          paid: boolean
          travel_event_id: string
          updated_at: string
        }
        Insert: {
          actual_amount?: number | null
          budgeted_amount?: number | null
          category: string
          created_at?: string
          description?: string | null
          id?: string
          paid?: boolean
          travel_event_id: string
          updated_at?: string
        }
        Update: {
          actual_amount?: number | null
          budgeted_amount?: number | null
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          paid?: boolean
          travel_event_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "travel_budget_item_travel_event_id_fkey"
            columns: ["travel_event_id"]
            isOneToOne: false
            referencedRelation: "travel_event"
            referencedColumns: ["id"]
          },
        ]
      }
      travel_document: {
        Row: {
          created_at: string
          document_type: string
          file_url: string | null
          id: string
          is_restricted: boolean
          required: boolean
          title: string
          travel_event_id: string
          updated_at: string
          uploaded_at: string | null
        }
        Insert: {
          created_at?: string
          document_type: string
          file_url?: string | null
          id?: string
          is_restricted?: boolean
          required?: boolean
          title: string
          travel_event_id: string
          updated_at?: string
          uploaded_at?: string | null
        }
        Update: {
          created_at?: string
          document_type?: string
          file_url?: string | null
          id?: string
          is_restricted?: boolean
          required?: boolean
          title?: string
          travel_event_id?: string
          updated_at?: string
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "travel_document_travel_event_id_fkey"
            columns: ["travel_event_id"]
            isOneToOne: false
            referencedRelation: "travel_event"
            referencedColumns: ["id"]
          },
        ]
      }
      travel_event: {
        Row: {
          academy_id: string
          created_at: string
          created_by: string | null
          departure_date: string
          destination_city: string
          destination_country: string
          event_type: string
          id: string
          return_date: string
          squads: string[]
          status: string
          title: string
          total_budget: number | null
          updated_at: string
        }
        Insert: {
          academy_id: string
          created_at?: string
          created_by?: string | null
          departure_date: string
          destination_city: string
          destination_country: string
          event_type: string
          id?: string
          return_date: string
          squads?: string[]
          status?: string
          title: string
          total_budget?: number | null
          updated_at?: string
        }
        Update: {
          academy_id?: string
          created_at?: string
          created_by?: string | null
          departure_date?: string
          destination_city?: string
          destination_country?: string
          event_type?: string
          id?: string
          return_date?: string
          squads?: string[]
          status?: string
          title?: string
          total_budget?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      travel_itinerary_item: {
        Row: {
          created_at: string
          day_date: string
          description: string | null
          id: string
          item_time: string | null
          item_type: string
          location: string | null
          sort_order: number
          title: string
          travel_event_id: string
          updated_at: string
          visible_to_parents: boolean
        }
        Insert: {
          created_at?: string
          day_date: string
          description?: string | null
          id?: string
          item_time?: string | null
          item_type: string
          location?: string | null
          sort_order?: number
          title: string
          travel_event_id: string
          updated_at?: string
          visible_to_parents?: boolean
        }
        Update: {
          created_at?: string
          day_date?: string
          description?: string | null
          id?: string
          item_time?: string | null
          item_type?: string
          location?: string | null
          sort_order?: number
          title?: string
          travel_event_id?: string
          updated_at?: string
          visible_to_parents?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "travel_itinerary_item_travel_event_id_fkey"
            columns: ["travel_event_id"]
            isOneToOne: false
            referencedRelation: "travel_event"
            referencedColumns: ["id"]
          },
        ]
      }
      travel_player_consent: {
        Row: {
          created_at: string
          dietary_requirements: string | null
          emergency_contact_confirmed: boolean
          id: string
          medical_declaration_signed: boolean
          passport_expiry: string | null
          passport_submitted: boolean
          photo_consent: boolean
          player_id: string
          signed_at: string | null
          travel_consent_signed: boolean
          travel_event_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dietary_requirements?: string | null
          emergency_contact_confirmed?: boolean
          id?: string
          medical_declaration_signed?: boolean
          passport_expiry?: string | null
          passport_submitted?: boolean
          photo_consent?: boolean
          player_id: string
          signed_at?: string | null
          travel_consent_signed?: boolean
          travel_event_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dietary_requirements?: string | null
          emergency_contact_confirmed?: boolean
          id?: string
          medical_declaration_signed?: boolean
          passport_expiry?: string | null
          passport_submitted?: boolean
          photo_consent?: boolean
          player_id?: string
          signed_at?: string | null
          travel_consent_signed?: boolean
          travel_event_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "travel_player_consent_travel_event_id_fkey"
            columns: ["travel_event_id"]
            isOneToOne: false
            referencedRelation: "travel_event"
            referencedColumns: ["id"]
          },
        ]
      }
      travel_transport_leg: {
        Row: {
          arrival_datetime: string | null
          arrival_location: string | null
          created_at: string
          departure_datetime: string | null
          departure_location: string | null
          id: string
          leg_order: number
          notes: string | null
          provider: string | null
          reference_number: string | null
          status: string
          transport_type: string
          travel_event_id: string
          updated_at: string
        }
        Insert: {
          arrival_datetime?: string | null
          arrival_location?: string | null
          created_at?: string
          departure_datetime?: string | null
          departure_location?: string | null
          id?: string
          leg_order?: number
          notes?: string | null
          provider?: string | null
          reference_number?: string | null
          status?: string
          transport_type: string
          travel_event_id: string
          updated_at?: string
        }
        Update: {
          arrival_datetime?: string | null
          arrival_location?: string | null
          created_at?: string
          departure_datetime?: string | null
          departure_location?: string | null
          id?: string
          leg_order?: number
          notes?: string | null
          provider?: string | null
          reference_number?: string | null
          status?: string
          transport_type?: string
          travel_event_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "travel_transport_leg_travel_event_id_fkey"
            columns: ["travel_event_id"]
            isOneToOne: false
            referencedRelation: "travel_event"
            referencedColumns: ["id"]
          },
        ]
      }
      travel_update: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          posted_at: string
          sent_push: boolean
          target_squads: string[]
          title: string
          travel_event_id: string
          update_type: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          posted_at?: string
          sent_push?: boolean
          target_squads?: string[]
          title: string
          travel_event_id: string
          update_type: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          posted_at?: string
          sent_push?: boolean
          target_squads?: string[]
          title?: string
          travel_event_id?: string
          update_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "travel_update_travel_event_id_fkey"
            columns: ["travel_event_id"]
            isOneToOne: false
            referencedRelation: "travel_event"
            referencedColumns: ["id"]
          },
        ]
      }
      upload_tokens: {
        Row: {
          camera_side: string
          created_at: string
          expires_at: string
          id: string
          match_id: string
          token: string
          used: boolean
        }
        Insert: {
          camera_side: string
          created_at?: string
          expires_at: string
          id?: string
          match_id: string
          token: string
          used?: boolean
        }
        Update: {
          camera_side?: string
          created_at?: string
          expires_at?: string
          id?: string
          match_id?: string
          token?: string
          used?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "upload_tokens_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      user_academies: {
        Row: {
          academy_id: string
          created_at: string
          external_role: string | null
          external_role_synced_at: string | null
          id: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          academy_id: string
          created_at?: string
          external_role?: string | null
          external_role_synced_at?: string | null
          id?: string
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          academy_id?: string
          created_at?: string
          external_role?: string | null
          external_role_synced_at?: string | null
          id?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_academies_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_academies_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_club_access: {
        Row: {
          club_id: string
          created_at: string
          external_club_id: string | null
          external_user_id: string | null
          id: string
          role: string
          synced_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          club_id: string
          created_at?: string
          external_club_id?: string | null
          external_user_id?: string | null
          id?: string
          role?: string
          synced_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          club_id?: string
          created_at?: string
          external_club_id?: string | null
          external_user_id?: string | null
          id?: string
          role?: string
          synced_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_club_access_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_team_access: {
        Row: {
          created_at: string
          external_team_id: string | null
          external_user_id: string | null
          id: string
          role: string
          synced_at: string
          team_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          external_team_id?: string | null
          external_user_id?: string | null
          id?: string
          role?: string
          synced_at?: string
          team_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          external_team_id?: string | null
          external_user_id?: string | null
          id?: string
          role?: string
          synced_at?: string
          team_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_team_access_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      video_clip: {
        Row: {
          clip_date: string | null
          created_at: string
          description: string | null
          external_id: string | null
          id: string
          player_id: string
          source: string
          tags: string[]
          title: string | null
          updated_at: string
          url: string | null
        }
        Insert: {
          clip_date?: string | null
          created_at?: string
          description?: string | null
          external_id?: string | null
          id?: string
          player_id: string
          source: string
          tags?: string[]
          title?: string | null
          updated_at?: string
          url?: string | null
        }
        Update: {
          clip_date?: string | null
          created_at?: string
          description?: string | null
          external_id?: string | null
          id?: string
          player_id?: string
          source?: string
          tags?: string[]
          title?: string | null
          updated_at?: string
          url?: string | null
        }
        Relationships: []
      }
      welfare_log: {
        Row: {
          author_id: string | null
          created_at: string
          id: string
          is_restricted: boolean
          log_date: string
          log_type: string | null
          notes: string | null
          player_id: string
          status: string | null
          tags: string[]
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          created_at?: string
          id?: string
          is_restricted?: boolean
          log_date?: string
          log_type?: string | null
          notes?: string | null
          player_id: string
          status?: string | null
          tags?: string[]
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          created_at?: string
          id?: string
          is_restricted?: boolean
          log_date?: string
          log_type?: string | null
          notes?: string | null
          player_id?: string
          status?: string | null
          tags?: string[]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      user_can_access_player: {
        Args: { _player_id: string; _user_id: string }
        Returns: boolean
      }
      user_has_academy_access: {
        Args: { _academy_id: string; _user_id: string }
        Returns: boolean
      }
      user_has_club_access: {
        Args: { _club_id: string; _user_id: string }
        Returns: boolean
      }
      user_has_team_access: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      user_has_travel_event_access: {
        Args: { _event_id: string; _user_id: string }
        Returns: boolean
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
