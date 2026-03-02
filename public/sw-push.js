const OFFLINE_DB_NAME = 'cya-offline-db';
const OFFLINE_DB_VERSION = 5;
const MAX_SYNC_RETRIES = 5;

const openOfflineDB = () =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });

const getStoreAll = async (storeName) => {
  const database = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
};

const getMetadataValue = async (key) => {
  const database = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('metadata', 'readonly');
    const store = tx.objectStore('metadata');
    const request = store.get(key);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result ? request.result.value : undefined);
  });
};

const deleteSyncQueueItem = async (id) => {
  const database = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('sync_queue', 'readwrite');
    const store = tx.objectStore('sync_queue');
    const request = store.delete(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

const markSyncQueueItemFailed = async (item, errorMessage) => {
  const database = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('sync_queue', 'readwrite');
    const store = tx.objectStore('sync_queue');
    const request = store.get(item.id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const current = request.result;
      if (!current) {
        resolve(0);
        return;
      }
      const retryCount = (current.retryCount || 0) + 1;
      store.put({
        ...current,
        retryCount,
        lastError: String(errorMessage || 'Sync failed'),
        lastErrorAt: Date.now(),
      });
      resolve(retryCount);
    };
  });
};

const applySyncItemToSupabase = async (config, item) => {
  const table = item.table;
  const record = item.data || {};
  const id = record.id;

  if ((item.action === 'update' || item.action === 'delete') && !id) {
    throw new Error(`Sync item missing id for ${item.action}`);
  }

  let url = `${config.url}/rest/v1/${table}`;
  let method = 'POST';
  let body;

  if (item.action === 'insert') {
    method = 'POST';
    body = JSON.stringify(record);
  } else if (item.action === 'update') {
    method = 'PATCH';
    url = `${url}?id=eq.${encodeURIComponent(id)}`;
    body = JSON.stringify(record);
  } else if (item.action === 'delete') {
    method = 'DELETE';
    url = `${url}?id=eq.${encodeURIComponent(id)}`;
  }

  const response = await fetch(url, {
    method,
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase ${response.status}: ${text || response.statusText}`);
  }
};

const processSyncQueue = async () => {
  const config = await getMetadataValue('sync:config');
  if (!config || !config.url || !config.key) {
    console.warn('[Service Worker] Missing sync config in metadata');
    return { synced: 0, errors: 0 };
  }

  const queue = await getStoreAll('sync_queue');
  queue.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  let synced = 0;
  let errors = 0;

  for (const item of queue) {
    try {
      if ((item.retryCount || 0) >= MAX_SYNC_RETRIES) {
        await deleteSyncQueueItem(item.id);
        continue;
      }

      await applySyncItemToSupabase(config, item);
      await deleteSyncQueueItem(item.id);
      synced++;
    } catch (error) {
      errors++;
      const retryCount = await markSyncQueueItemFailed(item, error);
      if (retryCount >= MAX_SYNC_RETRIES) {
        await deleteSyncQueueItem(item.id);
      }
      console.error('[Service Worker] Sync item failed:', item.id, error);
    }
  }

  return { synced, errors };
};

self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Sync event:', event.tag);

  if (event.tag !== 'cya-sync') return;

  event.waitUntil(
    processSyncQueue().then((result) => {
      return self.clients.matchAll({ includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
          client.postMessage({ type: 'cya-sync', detail: result });
        }
      });
    })
  );
});

self.addEventListener('push', function(event) {
  console.log('[Service Worker] Push received:', event);

  // Default notification data
  let data = {
    title: 'CYA Kenya',
    body: 'You have a new notification',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: 'default',
    data: { url: '/' }
  };

  // Parse push payload if available
  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
      console.log('[Service Worker] Push payload:', payload);
    } catch (e) {
      console.error('[Service Worker] Error parsing push data:', e);
      // Try text format as fallback
      try {
        data.body = event.data.text();
      } catch (textError) {
        console.error('[Service Worker] Error reading push as text:', textError);
      }
    }
  }

  // Determine target URL based on payload type
  let targetUrl = '/';
  if (data.data) {
    if (data.data.type === 'message' && data.data.conversationId) {
      targetUrl = `/chat?conversation=${data.data.conversationId}`;
    } else if (data.data.type === 'daily_verse' && data.data.verseId) {
      targetUrl = `/daily-verse?verse=${encodeURIComponent(data.data.verseId)}`;
    } else if (data.data.url) {
      targetUrl = data.data.url;
    }
  }

  // Notification options for maximum visibility
  const options = {
    body: data.body,
    icon: data.icon || '/pwa-192x192.png',
    badge: data.badge || '/pwa-192x192.png',
    image: data.image, // Optional large image
    tag: data.tag || `notification-${Date.now()}`, // Prevents duplicate notifications
    renotify: true, // Always notify even if same tag
    requireInteraction: data.requireInteraction !== undefined ? !!data.requireInteraction : true, // Keep notification visible until user interacts
    silent: !!data.silent || false, // Play notification sound when false
    vibrate: data.vibrate || [200, 100, 200], // Vibration pattern
    data: {
      url: targetUrl,
      ...data.data
    },
    actions: data.actions || [
      { action: 'open', title: 'View', icon: '/pwa-192x192.png' },
      { action: 'dismiss', title: 'Dismiss' }
    ],
    // Timestamp for ordering
    timestamp: data.timestamp || Date.now()
  };

  console.log('[Service Worker] Showing notification:', data.title, options);

  event.waitUntil(
    self.registration.showNotification(data.title, options)
      .then(() => {
        console.log('[Service Worker] Notification shown successfully');
      })
      .catch((error) => {
        console.error('[Service Worker] Error showing notification:', error);
      })
  );
});

// Handle notification click
self.addEventListener('notificationclick', function(event) {
  console.log('[Service Worker] Notification click:', event.action);
  
  event.notification.close();

  // Handle dismiss action
  if (event.action === 'dismiss') {
    return;
  }

  // Get URL to open
  const urlToOpen = event.notification.data?.url || '/';
  const fullUrl = new URL(urlToOpen, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ 
      type: 'window', 
      includeUncontrolled: true 
    }).then(function(clientList) {
      // Check if there's already a window/tab open with our app
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          // Navigate existing window to the target URL
          return client.navigate(fullUrl).then(() => client.focus());
        }
      }
      // If no window/tab is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(fullUrl);
      }
    })
  );
});

// Handle notification close (for analytics)
self.addEventListener('notificationclose', function(event) {
  console.log('[Service Worker] Notification closed:', event.notification.tag);
});

// Ensure service worker activates immediately
self.addEventListener('activate', function(event) {
  console.log('[Service Worker] Activating...');
  event.waitUntil(clients.claim());
});
