import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook to track user presence by updating last_active_at periodically
 * Call this in your main app layout to track when users are online
 */
export const usePresence = (userId: string | undefined) => {
  useEffect(() => {
    if (!userId) return;

    // Update presence immediately
    const updatePresence = async () => {
      try {
        await (supabase as any)
          .from('user_profiles')
          .update({ last_active_at: new Date().toISOString() })
          .eq('id', userId);
      } catch (error) {
        // Silently fail - presence is not critical
        console.debug('Presence update failed:', error);
      }
    };

    // Update immediately on mount
    updatePresence();

    // Update every 30 seconds while the user is active
    const interval = setInterval(updatePresence, 30000);

    // Also update on user activity (mouse move, key press, etc.)
    let activityTimeout: NodeJS.Timeout;
    const handleActivity = () => {
      clearTimeout(activityTimeout);
      activityTimeout = setTimeout(updatePresence, 1000); // Debounce
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('click', handleActivity);
    window.addEventListener('scroll', handleActivity);

    // Update on visibility change (tab becomes active)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updatePresence();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      clearTimeout(activityTimeout);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('scroll', handleActivity);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [userId]);
};
