import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { initSyncListener, syncWithServer, getLastSyncTime } from "@/lib/syncManager";
import { getSyncQueue } from "@/lib/offlineDb";

interface OfflineContextType {
  isOnline: boolean;
  pendingSyncCount: number;
  lastSyncTime: number | null;
  triggerSync: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

export const OfflineProvider = ({ children }: { children: ReactNode }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);

  useEffect(() => {
    // Initialize sync listener
    initSyncListener();

    // Set up online/offline listeners
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen for sync completion
    const handleSyncComplete = async () => {
      const queue = await getSyncQueue();
      setPendingSyncCount(queue.length);
      const time = await getLastSyncTime();
      setLastSyncTime(time);
    };

    window.addEventListener('sync-complete', handleSyncComplete);

    // Initial check
    handleSyncComplete();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('sync-complete', handleSyncComplete);
    };
  }, []);

  // Update pending count when offline changes are made
  useEffect(() => {
    const checkPendingSync = async () => {
      const queue = await getSyncQueue();
      setPendingSyncCount(queue.length);
    };

    // Check periodically
    const interval = setInterval(checkPendingSync, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const triggerSync = async () => {
    if (isOnline) {
      await syncWithServer();
      const queue = await getSyncQueue();
      setPendingSyncCount(queue.length);
      const time = await getLastSyncTime();
      setLastSyncTime(time);
    }
  };

  return (
    <OfflineContext.Provider value={{ isOnline, pendingSyncCount, lastSyncTime, triggerSync }}>
      {children}
    </OfflineContext.Provider>
  );
};

export const useOffline = () => {
  const context = useContext(OfflineContext);
  if (context === undefined) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
};
