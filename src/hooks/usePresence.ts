/**
 * Hook to track user presence - DISABLED to reduce network requests
 * The presence tracking was causing too many PATCH requests and 400 errors
 */
export const usePresence = (_userId: string | undefined) => {
  // Disabled - no presence tracking
};
