// supabase/migrations 의 스키마와 같은 모양으로 유지한다.
// Supabase CLI를 쓸 수 있다면 `supabase gen types typescript` 결과로 바꿔도 된다.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "12";
  };
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          name: string;
          role: Database["public"]["Enums"]["user_role"];
          instrument: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          name?: string;
          role?: Database["public"]["Enums"]["user_role"];
          instrument?: string | null;
          created_at?: string;
        };
        Update: {
          name?: string;
          role?: Database["public"]["Enums"]["user_role"];
          instrument?: string | null;
        };
        Relationships: [];
      };
      services: {
        Row: {
          id: string;
          service_date: string;
          title: string;
          status: Database["public"]["Enums"]["service_status"];
          published_at: string | null;
          notified_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          service_date: string;
          title?: string;
          status?: Database["public"]["Enums"]["service_status"];
          published_at?: string | null;
          notified_at?: string | null;
          created_by?: string | null;
        };
        Update: {
          service_date?: string;
          title?: string;
          status?: Database["public"]["Enums"]["service_status"];
          published_at?: string | null;
          notified_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "services_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      songs: {
        Row: {
          id: string;
          title: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          created_by?: string | null;
        };
        Update: {
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "songs_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      sheets: {
        Row: {
          id: string;
          song_id: string;
          name: string;
          current_version: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          song_id: string;
          name?: string;
          created_by?: string | null;
        };
        Update: {
          name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sheets_song_id_fkey";
            columns: ["song_id"];
            isOneToOne: false;
            referencedRelation: "songs";
            referencedColumns: ["id"];
          },
        ];
      };
      sheet_versions: {
        Row: {
          sheet_id: string;
          version: number;
          file_path: string;
          file_size: number | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          sheet_id: string;
          // 서버 트리거가 번호를 매긴다.
          version?: number;
          file_path: string;
          file_size?: number | null;
          created_by?: string | null;
        };
        Update: Record<string, never>;
        Relationships: [
          {
            foreignKeyName: "sheet_versions_sheet_id_fkey";
            columns: ["sheet_id"];
            isOneToOne: false;
            referencedRelation: "sheets";
            referencedColumns: ["id"];
          },
        ];
      };
      service_songs: {
        Row: {
          id: string;
          service_id: string;
          song_id: string;
          sheet_id: string | null;
          sheet_version: number | null;
          position: number;
          song_key: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          service_id: string;
          song_id: string;
          sheet_id?: string | null;
          sheet_version?: number | null;
          position?: number;
          song_key?: string | null;
        };
        Update: {
          sheet_id?: string | null;
          sheet_version?: number | null;
          position?: number;
          song_key?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "service_songs_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_songs_song_id_fkey";
            columns: ["song_id"];
            isOneToOne: false;
            referencedRelation: "songs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_songs_sheet_id_sheet_version_fkey";
            columns: ["sheet_id", "sheet_version"];
            isOneToOne: false;
            referencedRelation: "sheet_versions";
            referencedColumns: ["sheet_id", "version"];
          },
        ];
      };
      annotations: {
        Row: {
          id: string;
          sheet_id: string;
          sheet_version: number;
          user_id: string;
          page: number;
          type: Database["public"]["Enums"]["annotation_type"];
          data: Json;
          scope: Database["public"]["Enums"]["annotation_scope"];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          sheet_id: string;
          sheet_version: number;
          user_id?: string;
          page: number;
          type: Database["public"]["Enums"]["annotation_type"];
          data: Json;
          scope?: Database["public"]["Enums"]["annotation_scope"];
        };
        Update: {
          page?: number;
          data?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "annotations_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "annotations_sheet_id_sheet_version_fkey";
            columns: ["sheet_id", "sheet_version"];
            isOneToOne: false;
            referencedRelation: "sheet_versions";
            referencedColumns: ["sheet_id", "version"];
          },
        ];
      };
      push_subscriptions: {
        Row: {
          id: string;
          device_id: string;
          endpoint: string;
          subscription: Json;
          device: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          device_id: string;
          endpoint: string;
          subscription: Json;
          device?: string | null;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      app_settings: {
        Row: { key: string; value: Json; updated_at: string };
        Insert: { key: string; value: Json; updated_at?: string };
        Update: { value?: Json; updated_at?: string };
        Relationships: [];
      };
      visitors: {
        Row: {
          id: string;
          name: string | null;
          device: string | null;
          first_seen: string;
          last_seen: string;
        };
        Insert: {
          id: string;
          name?: string | null;
          device?: string | null;
          first_seen?: string;
          last_seen?: string;
        };
        Update: { name?: string | null; device?: string | null; last_seen?: string };
        Relationships: [];
      };
      visit_sessions: {
        Row: {
          id: string;
          visitor_id: string;
          started_at: string;
          last_seen_at: string;
          mode: "visitor" | "leader" | "admin";
          city: string | null;
          region: string | null;
          country: string | null;
        };
        Insert: {
          id?: string;
          visitor_id: string;
          started_at?: string;
          last_seen_at?: string;
          mode?: "visitor" | "leader" | "admin";
          city?: string | null;
          region?: string | null;
          country?: string | null;
        };
        Update: { last_seen_at?: string; mode?: "visitor" | "leader" | "admin" };
        Relationships: [
          {
            foreignKeyName: "visit_sessions_visitor_id_fkey";
            columns: ["visitor_id"];
            isOneToOne: false;
            referencedRelation: "visitors";
            referencedColumns: ["id"];
          },
        ];
      };
      page_views: {
        Row: {
          id: string;
          session_id: string;
          path: string;
          label: string;
          started_at: string;
          last_seen_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          path: string;
          label: string;
          started_at?: string;
          last_seen_at?: string;
        };
        Update: { last_seen_at?: string };
        Relationships: [
          {
            foreignKeyName: "page_views_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "visit_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      access_events: {
        Row: {
          id: string;
          created_at: string;
          kind: string;
          detail: string | null;
          visitor_id: string | null;
          ip_hash: string | null;
          city: string | null;
          region: string | null;
          country: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          kind: string;
          detail?: string | null;
          visitor_id?: string | null;
          ip_hash?: string | null;
          city?: string | null;
          region?: string | null;
          country?: string | null;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      app_role: {
        Args: never;
        Returns: Database["public"]["Enums"]["user_role"];
      };
      is_leader: { Args: never; Returns: boolean };
      is_admin: { Args: never; Returns: boolean };
      reorder_service_songs: {
        Args: { p_service_id: string; p_ids: string[] };
        Returns: undefined;
      };
    };
    Enums: {
      user_role: "pending" | "member" | "leader" | "admin";
      service_status: "draft" | "published";
      annotation_scope: "personal" | "global";
      annotation_type: "pen" | "highlighter" | "text";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];
export type Enums<T extends keyof PublicSchema["Enums"]> =
  PublicSchema["Enums"][T];
