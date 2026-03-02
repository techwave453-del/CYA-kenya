import { supabase } from "@/integrations/supabase/client";
import { getSyncQueue, removeSyncQueueItem, setMetadata, getMetadata, pruneSyncQueue, markSyncQueueItemFailed } from "./offlineDb";

type TableName = 'posts' | 'post_comments' | 'post_likes' | 'tasks' | 'activities';
const MAX_RETRIES = 5;
const RETRY_DELAY = 1000; // 1 second

let isSyncing = false;
const SYNC_CONFIG_KEY = 'sync:config';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const retryWithBackoff = async <T,>(
  fn: () => Promise<T>,
  retries: number = MAX_RETRIES
): Promise<T> => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      // Exponential backoff: 1s, 2s, 4s, etc.
      const delay = RETRY_DELAY * Math.pow(2, i);
      console.log(`[syncManager] Retry ${i + 1}/${retries} after ${delay}ms`);
      await sleep(delay);
    }
  }
  throw new Error('Max retries exceeded');
};

export const syncWithServer = async (): Promise<{ success: boolean; synced: number; errors: number; message?: string }> => {
  if (isSyncing || !navigator.onLine) {
    return { success: false, synced: 0, errors: 0, message: 'Already syncing or offline' };
  }

  isSyncing = true;
  let synced = 0;
  let errors = 0;

  try {
    const queue = await getSyncQueue();
    
    if (queue.length === 0) {
      await setMetadata('lastSync', Date.now());
      return { success: true, synced: 0, errors: 0, message: 'Queue is empty' };
    }

    console.log(`[syncManager] Syncing ${queue.length} items`);
    
    for (const item of queue) {
      if ((item.retryCount || 0) >= MAX_RETRIES) {
        await removeSyncQueueItem(item.id);
        continue;
      }

      try {
        const tableName = item.table as TableName;
        const itemData = item.data as { id?: string };
        const itemId = itemData.id || '';
        
        // Use retry logic for each sync operation
        await retryWithBackoff(async () => {
          let result:
            | { error: { message?: string } | null }
            | undefined;

          switch (item.action) {
            case 'insert':
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              result = await supabase.from(tableName).insert(item.data as any);
              break;
            case 'update':
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              result = await supabase.from(tableName).update(item.data as any).eq('id', itemId);
              break;
            case 'delete':
              result = await supabase.from(tableName).delete().eq('id', itemId);
              break;
          }

          if (result?.error) {
            throw new Error(result.error.message || 'Supabase sync failed');
          }
        });
        
        await removeSyncQueueItem(item.id);
        synced++;
      } catch (error) {
        console.error(`[syncManager] Failed to sync item ${item.id}:`, error);
        const retryCount = await markSyncQueueItemFailed(item.id, error);
        if (retryCount >= MAX_RETRIES) {
          await removeSyncQueueItem(item.id);
          console.warn(`[syncManager] Dropped item ${item.id} after ${retryCount} failed attempts`);
        }
        errors++;
      }
    }

    await setMetadata('lastSync', Date.now());
    
    return { success: true, synced, errors, message: `Synced ${synced} items with ${errors} errors` };
  } finally {
    isSyncing = false;

    // Prune old items from queue
    try {
      const pruneResult = await pruneSyncQueue();
      if (pruneResult.removed > 0) {
        console.log(`[syncManager] Pruned ${pruneResult.removed} old items from queue`);
      }
    } catch (error) {
      console.error('[syncManager] Error pruning sync queue:', error);
    }
  }
};

export const getLastSyncTime = async (): Promise<number | null> => {
  const lastSync = await getMetadata('lastSync');
  return lastSync as number | null;
};

// Listen for online status and trigger sync
export const initSyncListener = () => {
  void setMetadata(SYNC_CONFIG_KEY, {
    url: import.meta.env.VITE_SUPABASE_URL,
    key: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  });

  window.addEventListener('online', async () => {
    console.log('[SyncManager] Online - triggering sync');
    const result = await syncWithServer();
    if (result.synced > 0 || result.errors > 0) {
      console.log(`[SyncManager] Sync complete:`, result.message);
      // Dispatch custom event for UI updates
      window.dispatchEvent(new CustomEvent('sync-complete', { detail: result }));
    }
  });

  // Attempt to register Background Sync
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(async (registration) => {
      const syncRegistration = registration as ServiceWorkerRegistration & {
        sync?: { register: (tag: string) => Promise<void> };
      };

      if (!syncRegistration.sync) return;

      try {
        await syncRegistration.sync.register('cya-sync');
        console.log('[SyncManager] Background Sync registered');
      } catch (error) {
        console.error('[SyncManager] Background Sync registration failed:', error);
      }
    });
  }
};
