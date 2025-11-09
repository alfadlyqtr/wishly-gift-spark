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
      activities: {
        Row: {
          activity_type: string
          created_at: string | null
          id: string
          target_id: string | null
          user_id: string
        }
        Insert: {
          activity_type: string
          created_at?: string | null
          id?: string
          target_id?: string | null
          user_id: string
        }
        Update: {
          activity_type?: string
          created_at?: string | null
          id?: string
          target_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_logs: {
        Row: {
          created_at: string | null
          function_name: string | null
          id: string
          prompt: string | null
          response: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          function_name?: string | null
          id?: string
          prompt?: string | null
          response?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          function_name?: string | null
          id?: string
          prompt?: string | null
          response?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_recommendations: {
        Row: {
          budget_max: number | null
          created_at: string | null
          id: string
          keywords: string | null
          recommendation_data: Json | null
          user_id: string | null
        }
        Insert: {
          budget_max?: number | null
          created_at?: string | null
          id?: string
          keywords?: string | null
          recommendation_data?: Json | null
          user_id?: string | null
        }
        Update: {
          budget_max?: number | null
          created_at?: string | null
          id?: string
          keywords?: string | null
          recommendation_data?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_recommendations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          created_at: string | null
          description: string | null
          end_date: string | null
          id: string
          start_date: string | null
          store_id: string
          title: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          start_date?: string | null
          store_id: string
          title: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          start_date?: string | null
          store_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          content: string
          created_at: string | null
          id: string
          target_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          target_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          target_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string | null
          event_date: string
          id: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          event_date: string
          id?: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          event_date?: string
          id?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      followers: {
        Row: {
          created_at: string | null
          following_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          following_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          following_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "followers_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_circle_members: {
        Row: {
          circle_id: string
          id: string
          joined_at: string | null
          user_id: string
        }
        Insert: {
          circle_id: string
          id?: string
          joined_at?: string | null
          user_id: string
        }
        Update: {
          circle_id?: string
          id?: string
          joined_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gift_circle_members_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "gift_circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_circle_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_circle_wishlists: {
        Row: {
          added_at: string | null
          circle_id: string
          id: string
          wishlist_id: string
        }
        Insert: {
          added_at?: string | null
          circle_id: string
          id?: string
          wishlist_id: string
        }
        Update: {
          added_at?: string | null
          circle_id?: string
          id?: string
          wishlist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gift_circle_wishlists_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "gift_circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_circle_wishlists_wishlist_id_fkey"
            columns: ["wishlist_id"]
            isOneToOne: false
            referencedRelation: "wishlists"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_circles: {
        Row: {
          created_at: string | null
          created_by: string
          id: string
          title: string
        }
        Insert: {
          created_at?: string | null
          created_by: string
          id?: string
          title: string
        }
        Update: {
          created_at?: string | null
          created_by?: string
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "gift_circles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_exchange_participants: {
        Row: {
          assigned_giftee_id: string | null
          exchange_id: string
          id: string
          joined_at: string | null
          user_id: string
        }
        Insert: {
          assigned_giftee_id?: string | null
          exchange_id: string
          id?: string
          joined_at?: string | null
          user_id: string
        }
        Update: {
          assigned_giftee_id?: string | null
          exchange_id?: string
          id?: string
          joined_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gift_exchange_participants_assigned_giftee_id_fkey"
            columns: ["assigned_giftee_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_exchange_participants_exchange_id_fkey"
            columns: ["exchange_id"]
            isOneToOne: false
            referencedRelation: "gift_exchanges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_exchange_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_exchanges: {
        Row: {
          created_at: string | null
          created_by: string
          event_date: string | null
          id: string
          spend_limit: number | null
          status: string | null
          title: string
        }
        Insert: {
          created_at?: string | null
          created_by: string
          event_date?: string | null
          id?: string
          spend_limit?: number | null
          status?: string | null
          title: string
        }
        Update: {
          created_at?: string | null
          created_by?: string
          event_date?: string | null
          id?: string
          spend_limit?: number | null
          status?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "gift_exchanges_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_ratings: {
        Row: {
          comment: string | null
          created_at: string | null
          id: string
          item_id: string
          rating: number
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          id?: string
          item_id: string
          rating: number
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          id?: string
          item_id?: string
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gift_ratings_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "wishlist_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_ratings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_registry_log: {
        Row: {
          created_at: string | null
          event_date: string | null
          id: string
          item_description: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          event_date?: string | null
          id?: string
          item_description: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          event_date?: string | null
          id?: string
          item_description?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gift_registry_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      giver_stats: {
        Row: {
          events_participated_in: number | null
          gifts_given_count: number | null
          last_gift_given_at: string | null
          user_id: string
        }
        Insert: {
          events_participated_in?: number | null
          gifts_given_count?: number | null
          last_gift_given_at?: string | null
          user_id: string
        }
        Update: {
          events_participated_in?: number | null
          gifts_given_count?: number | null
          last_gift_given_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "giver_stats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          created_at: string | null
          id: string
          invite_code: string
          invited_email: string | null
          invited_user_id: string | null
          inviting_user_id: string
          status: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          invite_code: string
          invited_email?: string | null
          invited_user_id?: string | null
          inviting_user_id: string
          status?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          invite_code?: string
          invited_email?: string | null
          invited_user_id?: string | null
          inviting_user_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invitations_invited_user_id_fkey"
            columns: ["invited_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_inviting_user_id_fkey"
            columns: ["inviting_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboards: {
        Row: {
          id: string
          metric: string
          period: string
          score: number
          user_id: string
        }
        Insert: {
          id?: string
          metric: string
          period: string
          score: number
          user_id: string
        }
        Update: {
          id?: string
          metric?: string
          period?: string
          score?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leaderboards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      memory_board: {
        Row: {
          giver_id: string | null
          id: string
          item_id: string | null
          item_image_url: string | null
          item_title: string
          received_at: string | null
          user_id: string
        }
        Insert: {
          giver_id?: string | null
          id?: string
          item_id?: string | null
          item_image_url?: string | null
          item_title: string
          received_at?: string | null
          user_id: string
        }
        Update: {
          giver_id?: string | null
          id?: string
          item_id?: string | null
          item_image_url?: string | null
          item_title?: string
          received_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memory_board_giver_id_fkey"
            columns: ["giver_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memory_board_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "wishlist_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memory_board_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          thread_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          thread_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reactions: {
        Row: {
          created_at: string | null
          id: string
          reaction_type: string
          target_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          reaction_type: string
          target_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          reaction_type?: string
          target_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      store_analytics: {
        Row: {
          count: number | null
          id: string
          logged_at: string | null
          metric_type: string
          store_id: string
        }
        Insert: {
          count?: number | null
          id?: string
          logged_at?: string | null
          metric_type: string
          store_id: string
        }
        Update: {
          count?: number | null
          id?: string
          logged_at?: string | null
          metric_type?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_analytics_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_items: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          price: number | null
          store_id: string
          store_url: string | null
          tags: string[] | null
          title: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          price?: number | null
          store_id: string
          store_url?: string | null
          tags?: string[] | null
          title: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          price?: number | null
          store_id?: string
          store_url?: string | null
          tags?: string[] | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_verified: boolean | null
          logo_url: string | null
          owner_id: string
          store_name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_verified?: boolean | null
          logo_url?: string | null
          owner_id: string
          store_name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_verified?: boolean | null
          logo_url?: string | null
          owner_id?: string
          store_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "stores_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      thank_you_cards: {
        Row: {
          created_at: string | null
          id: string
          memory_board_id: string
          thank_you_note: string | null
          thank_you_video_url: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          memory_board_id: string
          thank_you_note?: string | null
          thank_you_video_url?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          memory_board_id?: string
          thank_you_note?: string | null
          thank_you_video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "thank_you_cards_memory_board_id_fkey"
            columns: ["memory_board_id"]
            isOneToOne: false
            referencedRelation: "memory_board"
            referencedColumns: ["id"]
          },
        ]
      }
      thread_participants: {
        Row: {
          id: string
          joined_at: string | null
          thread_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string | null
          thread_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string | null
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "thread_participants_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thread_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      threads: {
        Row: {
          created_at: string | null
          id: string
          title: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          title?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          title?: string | null
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          dob: string | null
          full_name: string | null
          id: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          dob?: string | null
          full_name?: string | null
          id: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          dob?: string | null
          full_name?: string | null
          id?: string
          username?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wishlist_items: {
        Row: {
          added_at: string | null
          description: string | null
          id: string
          image_url: string | null
          item_url: string | null
          price: number | null
          status: string | null
          title: string
          wishlist_id: string
        }
        Insert: {
          added_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          item_url?: string | null
          price?: number | null
          status?: string | null
          title: string
          wishlist_id: string
        }
        Update: {
          added_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          item_url?: string | null
          price?: number | null
          status?: string | null
          title?: string
          wishlist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_items_wishlist_id_fkey"
            columns: ["wishlist_id"]
            isOneToOne: false
            referencedRelation: "wishlists"
            referencedColumns: ["id"]
          },
        ]
      }
      wishlist_reservations: {
        Row: {
          created_at: string | null
          id: string
          item_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          item_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_reservations_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: true
            referencedRelation: "wishlist_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlist_reservations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wishlists: {
        Row: {
          created_at: string | null
          description: string | null
          event_date: string | null
          event_id: string | null
          id: string
          privacy_level: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          event_date?: string | null
          event_id?: string | null
          id?: string
          privacy_level?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          event_date?: string | null
          event_id?: string | null
          id?: string
          privacy_level?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlists_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlists_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "user" | "brand"
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
      app_role: ["user", "brand"],
    },
  },
} as const
