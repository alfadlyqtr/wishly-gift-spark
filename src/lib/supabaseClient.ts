// src/lib/supabaseClient.ts

// Centralized Supabase client for the Wishly front end.
// - Uses existing Vite env vars (do not modify .env)
// - Exports a single, shared client instance
// - Includes a minimal Database type scaffold for type-safety and future expansion

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Minimal Database type scaffold.
 * Replace or extend with generated types later for full type safety:
 *   - supabase gen types typescript --project-id <id> --schema public > src/lib/database.types.ts
 *   - Then: import type { Database } from "./database.types"
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      // Define tables as needed, e.g.:
      // profiles: {
      //   Row: { id: string; email: string | null; created_at: string };
      //   Insert: { id: string; email?: string | null };
      //   Update: { id?: string; email?: string | null };
      //   Relationships: [];
      // };
    };
    Views: {
      // e.g. user_stats: { Row: { ... } };
    };
    Functions: {
      // e.g. search_gifts: { Args: { q: string }, Returns: Array<{ id: string; name: string }> };
    };
    Enums: {
      // e.g. gift_status: "draft" | "active" | "archived";
    };
    CompositeTypes: {
      // e.g. address_type: { street: string; city: string };
    };
  };
}

/**
 * Read Vite environment variables (already available at build/run time).
 * Note: Keep the VITE_ prefix to expose to the client in Vite.
 */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Fail fast in development if env vars are missing to avoid silent misconfigurations.
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Throwing helps surface the issue during local dev or CI preview builds.
  // In production, ensure these env vars are set in your hosting platform.
  throw new Error(
    "Missing Supabase credentials: VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY are not defined."
  );
}

/**
 * Create a single Supabase client instance.
 * SupabaseClient is safe to reuse across the app (singleton per bundle).
 */
const supabase: SupabaseClient<Database> = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    // Persist auth session in browser storage and auto-refresh tokens.
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    // Add any global headers if needed:
    // global: { headers: { "x-project": "wishly" } },
  }
);

export default supabase;
export { supabase };
