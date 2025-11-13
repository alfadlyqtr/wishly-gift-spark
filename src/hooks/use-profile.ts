import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type UserProfile = Pick<
  Database["public"]["Tables"]["user_profiles"]["Row"],
  "username" | "full_name" | "dob" | "avatar_url"
>;

export type GiverStats = Pick<
  Database["public"]["Tables"]["giver_stats"]["Row"],
  "gifts_given_count" | "events_participated_in"
>;

export function useProfileData() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) {
        return {
          profile: null as UserProfile | null,
          stats: null as GiverStats | null,
          wishesCount: 0,
          authEmail: null as string | null,
          country: null as string | null,
        };
      }

      const profilePromise = supabase
        .from("user_profiles")
        .select("username, full_name, dob, avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      const countryPromise = (supabase as any)
        .from("user_profiles")
        .select("country")
        .eq("id", user.id)
        .maybeSingle();

      const statsPromise = supabase
        .from("giver_stats")
        .select("gifts_given_count, events_participated_in")
        .eq("user_id", user.id)
        .maybeSingle();

      const wishlistsPromise = supabase
        .from("wishlists")
        .select("id")
        .eq("user_id", user.id);

      const [
        { data: profileData, error: profileError },
        { data: statsData, error: statsError },
        { data: wishlists, error: wishlistsError },
        { data: countryData }
      ] = await Promise.all([profilePromise, statsPromise, wishlistsPromise, countryPromise]);

      if (profileError) console.error(profileError);
      if (statsError) console.error(statsError);
      if (wishlistsError) console.error(wishlistsError);

      let wishesCount = 0;
      const wishlistIds = (wishlists ?? []).map((w) => w.id);
      if (wishlistIds.length > 0) {
        const { count } = await supabase
          .from("wishlist_items")
          .select("id", { count: "exact", head: true })
          .in("wishlist_id", wishlistIds);
        wishesCount = count ?? 0;
      }

      return {
        profile: (profileData as UserProfile) ?? null,
        stats: (statsData as GiverStats) ?? null,
        wishesCount,
        authEmail: user.email ?? null,
        country: (countryData as any)?.country ?? null,
      } as {
        profile: UserProfile | null;
        stats: GiverStats | null;
        wishesCount: number;
        authEmail: string | null;
        country: string | null;
      };
    },
    staleTime: 60_000,
  });
}
