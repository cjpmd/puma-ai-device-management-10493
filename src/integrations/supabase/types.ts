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
          logo_url: string | null
          name: string
          synced_at: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          external_id: string
          id?: string
          logo_url?: string | null
          name: string
          synced_at?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          external_id?: string
          id?: string
          logo_url?: string | null
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
