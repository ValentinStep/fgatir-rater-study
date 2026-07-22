/**
 * Supabase Database Types
 *
 * Typed schema for the FGATIR rater study database.
 * These types correspond to the tables defined in supabase/migrations/.
 *
 * NOTE: In production, these can be auto-generated via `supabase gen types`.
 * This manual definition provides type safety without requiring the Supabase CLI.
 */

export interface Database {
  public: {
    Tables: {
      studies: {
        Row: {
          id: string;
          name: string;
          randomization_seed: string;
          config_json: Record<string, unknown>;
          created_at: string;
          active: boolean;
        };
        Insert: {
          id?: string;
          name: string;
          randomization_seed: string;
          config_json?: Record<string, unknown>;
          created_at?: string;
          active?: boolean;
        };
        Update: {
          id?: string;
          name?: string;
          randomization_seed?: string;
          config_json?: Record<string, unknown>;
          created_at?: string;
          active?: boolean;
        };
      };
      raters: {
        Row: {
          id: string;
          study_id: string;
          auth_user_id: string | null;
          display_code: string;
          created_at: string;
          active: boolean;
        };
        Insert: {
          id?: string;
          study_id: string;
          auth_user_id?: string | null;
          display_code: string;
          created_at?: string;
          active?: boolean;
        };
        Update: {
          id?: string;
          study_id?: string;
          auth_user_id?: string | null;
          display_code?: string;
          created_at?: string;
          active?: boolean;
        };
      };
      cases: {
        Row: {
          id: string;
          study_id: string;
          neutral_subject_code: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          study_id: string;
          neutral_subject_code: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          study_id?: string;
          neutral_subject_code?: string;
          created_at?: string;
        };
      };
      image_series: {
        Row: {
          id: string;
          case_id: string;
          blinded_series_code: string;
          storage_prefix: string;
          slice_count: number;
          geometry_hash: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          case_id: string;
          blinded_series_code: string;
          storage_prefix: string;
          slice_count: number;
          geometry_hash?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          case_id?: string;
          blinded_series_code?: string;
          storage_prefix?: string;
          slice_count?: number;
          geometry_hash?: string | null;
          created_at?: string;
        };
      };
      assignments: {
        Row: {
          id: string;
          rater_id: string;
          series_id: string;
          presentation_order: number;
          status: 'pending' | 'in_progress' | 'completed';
          started_at: string | null;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          rater_id: string;
          series_id: string;
          presentation_order: number;
          status?: 'pending' | 'in_progress' | 'completed';
          started_at?: string | null;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          rater_id?: string;
          series_id?: string;
          presentation_order?: number;
          status?: 'pending' | 'in_progress' | 'completed';
          started_at?: string | null;
          completed_at?: string | null;
        };
      };
      ratings: {
        Row: {
          id: string;
          assignment_id: string;
          rater_id: string;
          series_id: string;
          responses_json: Record<string, unknown>;
          comments: string | null;
          started_at: string | null;
          submitted_at: string;
          duration_seconds: number | null;
          viewer_state_json: Record<string, unknown> | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          assignment_id: string;
          rater_id: string;
          series_id: string;
          responses_json: Record<string, unknown>;
          comments?: string | null;
          started_at?: string | null;
          submitted_at?: string;
          duration_seconds?: number | null;
          viewer_state_json?: Record<string, unknown> | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          assignment_id?: string;
          rater_id?: string;
          series_id?: string;
          responses_json?: Record<string, unknown>;
          comments?: string | null;
          started_at?: string | null;
          submitted_at?: string;
          duration_seconds?: number | null;
          viewer_state_json?: Record<string, unknown> | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      unblinding: {
        Row: {
          id: string;
          series_id: string;
          condition: 'original' | 'denoised';
          source_description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          series_id: string;
          condition: 'original' | 'denoised';
          source_description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          series_id?: string;
          condition?: 'original' | 'denoised';
          source_description?: string | null;
          created_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
