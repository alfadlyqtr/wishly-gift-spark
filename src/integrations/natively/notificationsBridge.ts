/**
 * Natively OneSignal Notifications Bridge
 * Bridges the web app with the native OneSignal SDK via Natively wrapper
 */

const DEBUG_NOTIFICATIONS = false;

function debugLog(...args: unknown[]) {
  if (DEBUG_NOTIFICATIONS) {
    console.log('[NotificationsBridge]', ...args);
  }
}

function getNativelyRuntime(): any {
  return (window as any).natively || (window as any).Natively;
}

function getNotifications(): any {
  const runtime = getNativelyRuntime();
  return runtime?.notifications;
}

/**
 * Check if running in native app context
 */
export function isNativeApp(): boolean {
  const runtime = getNativelyRuntime();
  const browserInfo = runtime?.browserInfo?.();
  return browserInfo?.isIOSApp === true || browserInfo?.isAndroidApp === true;
}

/**
 * Get current platform
 */
export function getPlatform(): 'ios' | 'android' | 'web' {
  const runtime = getNativelyRuntime();
  const browserInfo = runtime?.browserInfo?.();
  if (browserInfo?.isIOSApp) return 'ios';
  if (browserInfo?.isAndroidApp) return 'android';
  return 'web';
}

/**
 * Links device to logged-in user for targeted pushes
 * Sets the OneSignal External ID to the Supabase user ID
 */
export function setNotificationUser(userId: string): void {
  if (!isNativeApp()) {
    debugLog('Not in native app, skipping setNotificationUser');
    return;
  }

  const notifications = getNotifications();
  if (!notifications) {
    debugLog('Notifications object not available');
    return;
  }

  debugLog('Setting notification user:', userId);

  // Set External ID using Natively's method
  if (notifications.setExternalId) {
    notifications.setExternalId({ externalId: userId }, (response: any) => {
      if (response?.externalId) {
        debugLog('External ID set successfully:', response.externalId);
        console.log('[Push] External ID linked:', response.externalId);
      } else {
        console.error('[Push] Failed to set external ID:', response);
      }
    });
  } else if (notifications.setExternalUserId) {
    // Fallback for older Natively versions
    notifications.setExternalUserId(userId, (success: boolean) => {
      if (success) {
        debugLog('External User ID set successfully');
        console.log('[Push] External User ID linked:', userId);
      } else {
        console.error('[Push] Failed to set external user ID');
      }
    });
  } else {
    console.warn('[Push] No setExternalId method available');
  }
}

/**
 * Removes user link (logout)
 * Clears the OneSignal External ID
 */
export function removeNotificationUser(): void {
  if (!isNativeApp()) {
    debugLog('Not in native app, skipping removeNotificationUser');
    return;
  }

  const notifications = getNotifications();
  if (!notifications) {
    debugLog('Notifications object not available');
    return;
  }

  debugLog('Removing notification user');

  if (notifications.removeExternalId) {
    notifications.removeExternalId((response: any) => {
      debugLog('External ID removed:', response);
      console.log('[Push] External ID unlinked');
    });
  } else if (notifications.removeExternalUserId) {
    notifications.removeExternalUserId((success: boolean) => {
      debugLog('External User ID removed:', success);
      console.log('[Push] External User ID unlinked');
    });
  }
}

/**
 * Requests iOS/Android notification permission
 */
export function requestNotificationPermission(fallbackToSettings = false): Promise<boolean> {
  return new Promise((resolve) => {
    if (!isNativeApp()) {
      debugLog('Not in native app, skipping permission request');
      resolve(false);
      return;
    }

    const notifications = getNotifications();
    if (!notifications) {
      debugLog('Notifications object not available');
      resolve(false);
      return;
    }

    debugLog('Requesting notification permission');

    // iOS permission request
    if (notifications.requestPermissionIOS) {
      notifications.requestPermissionIOS((granted: boolean) => {
        debugLog('iOS permission result:', granted);
        console.log('[Push] iOS permission:', granted ? 'granted' : 'denied');
        
        if (!granted && fallbackToSettings) {
          // Open settings if permission denied
          notifications.openSettings?.();
        }
        
        resolve(granted);
      });
    } else if (notifications.requestPermission) {
      notifications.requestPermission((granted: boolean) => {
        debugLog('Permission result:', granted);
        console.log('[Push] Permission:', granted ? 'granted' : 'denied');
        resolve(granted);
      });
    } else {
      // Try calling without callback (some versions)
      try {
        notifications.requestPermissionIOS?.();
        console.log('[Push] Permission requested (no callback)');
        resolve(true);
      } catch (e) {
        console.error('[Push] Permission request failed:', e);
        resolve(false);
      }
    }
  });
}

/**
 * Gets OneSignal device identifier (Player ID)
 */
export function getOneSignalId(callback?: (playerId: string | null) => void): void {
  if (!isNativeApp()) {
    debugLog('Not in native app, skipping getOneSignalId');
    callback?.(null);
    return;
  }

  const notifications = getNotifications();
  if (!notifications) {
    debugLog('Notifications object not available');
    callback?.(null);
    return;
  }

  debugLog('Getting OneSignal ID');

  if (notifications.getOneSignalId) {
    notifications.getOneSignalId((response: any) => {
      debugLog('OneSignal ID response:', response);
      
      // Handle different response formats
      const playerId = 
        typeof response === 'string' 
          ? response 
          : response?.playerId || response?.id || null;
      
      console.log('[Push] OneSignal Player ID:', playerId);
      callback?.(playerId);
    });
  } else if (notifications.getPlayerId) {
    notifications.getPlayerId((playerId: string | null) => {
      debugLog('Player ID:', playerId);
      console.log('[Push] Player ID:', playerId);
      callback?.(playerId);
    });
  } else {
    console.warn('[Push] No getOneSignalId method available');
    callback?.(null);
  }
}

/**
 * Handles notification taps -> app navigation
 */
export function setupNotificationClickHandler(
  navigate: (path: string) => void
): void {
  if (!isNativeApp()) {
    debugLog('Not in native app, skipping click handler setup');
    return;
  }

  const notifications = getNotifications();
  if (!notifications) {
    debugLog('Notifications object not available');
    return;
  }

  debugLog('Setting up notification click handler');

  const handleNotificationClick = (data: any) => {
    debugLog('Notification clicked:', data);
    console.log('[Push] Notification clicked:', data);

    // Extract navigation target from notification data
    const deepLink = data?.deep_link || data?.deepLink || data?.additionalData?.deep_link;
    const type = data?.type || data?.additionalData?.type;

    if (deepLink) {
      navigate(deepLink);
      return;
    }

    // Handle specific notification types
    switch (type) {
      case 'message':
      case 'message_sent':
        const threadId = data?.threadId || data?.additionalData?.threadId;
        if (threadId) {
          navigate(`/chat/${threadId}`);
        } else {
          navigate('/messages');
        }
        break;
      
      case 'follow_request':
      case 'follow_accepted':
      case 'new_follower':
        navigate('/followers');
        break;
      
      case 'claim_requested':
      case 'claim_approved':
      case 'claim_declined':
        const itemId = data?.itemId || data?.additionalData?.itemId;
        if (itemId) {
          navigate(`/wishlist-item/${itemId}`);
        } else {
          navigate('/');
        }
        break;
      
      case 'comment':
        const wishlistId = data?.wishlistId || data?.additionalData?.wishlistId;
        if (wishlistId) {
          navigate(`/wishlist/${wishlistId}`);
        } else {
          navigate('/');
        }
        break;
      
      default:
        navigate('/');
    }
  };

  // Set up the click handler
  if (notifications.setNotificationOpenedHandler) {
    notifications.setNotificationOpenedHandler(handleNotificationClick);
  } else if (notifications.onNotificationOpened) {
    notifications.onNotificationOpened(handleNotificationClick);
  }
}

/**
 * Initialize push notifications for a user
 * Call this after user login
 */
export async function initializePushNotifications(userId: string): Promise<void> {
  if (!isNativeApp()) {
    console.log('[Push] Not in native app, skipping initialization');
    return;
  }

  console.log('[Push] Initializing push notifications for user:', userId);

  // Request permission first
  const granted = await requestNotificationPermission(true);
  console.log('[Push] Permission granted:', granted);

  // Wait a moment for OneSignal to initialize
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Link device to user
  setNotificationUser(userId);

  console.log('[Push] Push notifications initialized');
}

/**
 * Cleanup push notifications on logout
 */
export function cleanupPushNotifications(): void {
  if (!isNativeApp()) {
    return;
  }

  console.log('[Push] Cleaning up push notifications');
  removeNotificationUser();
}
