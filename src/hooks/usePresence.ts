import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook to track user presence - updates last_active_at in user_profiles
 * Optimized to only update every 2 minutes to reduce network requests
 */
export const usePresence = (userId: string | undefined) => {
  const lastUpdateRef = useRef<number>(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!userId || !supabase) return;

    const updatePresence = async () => {
      const now = Date.now();
      // Only update if 2 minutes have passed since last update
      if (now - lastUpdateRef.current < 2 * 60 * 1000) return;
      
      try {
        await (supabase as any)
          .from("user_profiles")
          .update({ last_active_at: new Date().toISOString() })
          .eq("id", userId);
        
        lastUpdateRef.current = now;
      } catch (err) {
        // Silently fail - don't spam console
      }
    };

    // Update immediately on mount
    updatePresence();

    // Then update every 2 minutes while active
    intervalRef.current = setInterval(updatePresence, 2 * 60 * 1000);

    // Also update on user activity (throttled)
    const handleActivity = () => {
      const now = Date.now();
      if (now - lastUpdateRef.current >= 2 * 60 * 1000) {
        updatePresence();
      }
    };

    // Listen for user activity
    window.addEventListener("mousemove", handleActivity, { passive: true });
    window.addEventListener("keydown", handleActivity, { passive: true });
    window.addEventListener("click", handleActivity, { passive: true });
    window.addEventListener("scroll", handleActivity, { passive: true });

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("click", handleActivity);
      window.removeEventListener("scroll", handleActivity);
    };
  }, [userId]);
};
