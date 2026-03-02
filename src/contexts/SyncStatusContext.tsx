import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getSyncQueue, getMetadata } from '@/lib/offlineDb';
import { getAllQueuedMessages } from '@/lib/offlineChat';

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  queueCount: number;
  messageQueueCount: number;
  lastSyncTime: number | null;
  lastSyncError: string | null;
  totalItemsQueued: number;
}

interface SyncStatusContextType {
  status: SyncStatus;
  refreshStatus: () => Promise<void>;
  clearSyncError: () => void;
}

const SyncStatusContext = createContext<SyncStatusContextType | undefined>(undefined);

export const SyncStatusProvider = ({ children }: { children: React.ReactNode }) => {
  const [status, setStatus] = useState<SyncStatus>({
    isOnline: navigator.onLine,
    isSyncing: false,
    queueCount: 0,
    messageQueueCount: 0,
    lastSyncTime: null,
    lastSyncError: null,
    totalItemsQueued: 0
  });

  // Refresh status from IndexedDB
  const refreshStatus = useCallback(async () => {
    try {
      const queue = await getSyncQueue();
      const messages = await getAllQueuedMessages();
      const lastSync = await getMetadata('lastSync');

      setStatus(prev => ({
        ...prev,
        queueCount: queue.length,
        messageQueueCount: messages.length,
        lastSyncTime: lastSync as number | null,
        totalItemsQueued: queue.length + messages.length
      }));
    } catch (error) {
      console.error('[SyncStatusContext] Error refreshing status:', error);
    }
  }, []);

  // Listen to online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setStatus(prev => ({ ...prev, isOnline: true, lastSyncError: null }));
      refreshStatus();
    };

    const handleOffline = () => {
      setStatus(prev => ({ ...prev, isOnline: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [refreshStatus]);

  // Listen to sync-complete event
  useEffect(() => {
    const handleSyncComplete = (event: Event) => {
      const customEvent = event as CustomEvent;
      const result = customEvent.detail;

      setStatus(prev => ({
        ...prev,
        isSyncing: false,
        lastSyncTime: Date.now(),
        lastSyncError: result.errors > 0 ? `${result.errors} sync errors` : null
      }));

      refreshStatus();
    };

    window.addEventListener('sync-complete', handleSyncComplete as EventListener);

    return () => {
      window.removeEventListener('sync-complete', handleSyncComplete as EventListener);
    };
  }, [refreshStatus]);

  // Initial status load
  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const clearSyncError = useCallback(() => {
    setStatus(prev => ({ ...prev, lastSyncError: null }));
  }, []);

  return (
    <SyncStatusContext.Provider value={{ status, refreshStatus, clearSyncError }}>
      {children}
    </SyncStatusContext.Provider>
  );
};

export const useSyncStatus = () => {
  const context = useContext(SyncStatusContext);
  if (!context) {
    throw new Error('useSyncStatus must be used within SyncStatusProvider');
  }
  return context;
};
