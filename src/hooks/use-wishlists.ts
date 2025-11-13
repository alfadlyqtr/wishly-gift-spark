import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type WishlistRow = Database["public"]["Tables"]["wishlists"]["Row"];

export function useWishlists() {
  return useQuery({
    queryKey: ["wishlists"],
    queryFn: async (): Promise<WishlistRow[]> => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) return [];

      const { data, error } = await supabase
        .from("wishlists")
        .select("id, title, description, created_at, privacy_level, user_id, event_date, event_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    staleTime: 10_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
}
