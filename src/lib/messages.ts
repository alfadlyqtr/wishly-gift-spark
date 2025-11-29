import { supabase } from "@/integrations/supabase/client";

/**
 * Finds an existing 1:1 thread between the current user and `otherUserId`.
 * If none exists, creates a new thread and adds both participants.
 * Returns the thread id and any error.
 */
export async function openOrCreateDirectThread(otherUserId: string): Promise<{ id: string | null, error: any }> {
  if (!supabase) return { id: null, error: "Supabase client not initialized" };

  const { data, error } = await supabase.rpc('create_direct_thread' as any, {
    other_user_id: otherUserId
  });

  if (error) {
    console.error("Error creating/opening thread:", error);
    return { id: null, error };
  }

  return { id: data, error: null };
}
