import { useEffect, useCallback } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

const UPDATE_CHECK_INTERVAL = 60 * 1000; // Check every minute

export const usePwaUpdates = () => {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(registration) {
      console.log("[PWA] Service worker registered");
      
      // Set up periodic update checks
      if (registration) {
        setInterval(() => {
          console.log("[PWA] Checking for updates...");
          registration.update();
        }, UPDATE_CHECK_INTERVAL);
      }
    },
    onRegisterError(error) {
      console.error("[PWA] Service worker registration error:", error);
    },
    onNeedRefresh() {
      console.log("[PWA] New content available, auto-updating...");
    },
    onOfflineReady() {
      console.log("[PWA] App ready to work offline");
    },
  });

  // Auto-update when new content is available
  const performUpdate = useCallback(async () => {
    if (needRefresh) {
      console.log("[PWA] Applying update silently...");
      await updateServiceWorker(true);
    }
  }, [needRefresh, updateServiceWorker]);

  // Trigger auto-update when needRefresh becomes true
  useEffect(() => {
    if (needRefresh) {
      performUpdate();
    }
  }, [needRefresh, performUpdate]);

  return {
    needRefresh,
    updateNow: performUpdate,
  };
};
