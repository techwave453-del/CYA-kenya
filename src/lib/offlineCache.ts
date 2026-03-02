/**
 * Offline data caching for posts, tasks, activities, Bible verses, etc.
 * Allows read-only access when offline
 */

import { clearStore, getAll, getById, getMetadata, put, putAll, remove, setMetadata } from './offlineDb';

interface CacheMetadata {
  table: string;
  count: number;
  lastCached: number;
  cacheAge: number; // milliseconds
}

const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours
const MAX_ITEMS_PER_TABLE = 500;

const cacheLastCachedKey = (table: string) => `cache:lastCached:${table}`;

const touchCache = async (table: string): Promise<void> => {
  try {
    await setMetadata(cacheLastCachedKey(table), Date.now());
  } catch (error) {
    console.error(`[offlineCache] Error updating cache metadata for ${table}:`, error);
  }
};

const parseItemTimeMs = (raw: unknown): number | null => {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const parsed = Date.parse(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const getItemTimeMs = (item: any): number | null => {
  return (
    parseItemTimeMs(item?.updated_at) ??
    parseItemTimeMs(item?.created_at) ??
    parseItemTimeMs(item?.timestamp) ??
    parseItemTimeMs(item?.updatedAt) ??
    parseItemTimeMs(item?.createdAt)
  );
};

/**
 * Cache a single item (insert/update)
 */
export const cacheItem = async <T extends { id: string }>(
  table: string,
  item: T
): Promise<void> => {
  try {
    await put(table, item);
    await touchCache(table);
    console.log(`[offlineCache] Cached ${table}/${item.id}`);
  } catch (error) {
    console.error(`[offlineCache] Error caching ${table}/${item.id}:`, error);
  }
};

/**
 * Cache multiple items (batch update)
 */
export const cacheItems = async <T extends { id: string }>(
  table: string,
  items: T[]
): Promise<{ cached: number; skipped: number }> => {
  try {
    // Check cache size before adding
    const existing = await getAll<T>(table);
    const available = Math.max(0, MAX_ITEMS_PER_TABLE - existing.length);
    const toCache = items.slice(0, available);
    const skipped = items.length - toCache.length;

    if (toCache.length > 0) {
      await putAll(table, toCache);
      await touchCache(table);
      console.log(`[offlineCache] Cached ${toCache.length} items in ${table} (${skipped} skipped)`);
    }

    return { cached: toCache.length, skipped };
  } catch (error) {
    console.error(`[offlineCache] Error caching items in ${table}:`, error);
    return { cached: 0, skipped: items.length };
  }
};

/**
 * Get cached items for a table
 */
export const getCachedItems = async <T>(table: string): Promise<T[]> => {
  try {
    const items = await getAll<T>(table);
    console.log(`[offlineCache] Retrieved ${items.length} cached items from ${table}`);
    return items;
  } catch (error) {
    console.error(`[offlineCache] Error retrieving ${table}:`, error);
    return [];
  }
};

/**
 * Get single cached item by ID
 */
export const getCachedItem = async <T extends { id: string }>(
  table: string,
  id: string
): Promise<T | undefined> => {
  try {
    return await getById<T>(table, id);
  } catch (error) {
    console.error(`[offlineCache] Error retrieving ${table}/${id}:`, error);
    return undefined;
  }
};

/**
 * Remove cached item
 */
export const removeCachedItem = async (table: string, id: string): Promise<void> => {
  try {
    await remove(table, id);
    console.log(`[offlineCache] Removed cached ${table}/${id}`);
  } catch (error) {
    console.error(`[offlineCache] Error removing ${table}/${id}:`, error);
  }
};

/**
 * Clear all cached items for a table
 */
export const clearCache = async (table: string): Promise<void> => {
  try {
    await clearStore(table);
    console.log(`[offlineCache] Cleared cache for ${table}`);
  } catch (error) {
    console.error(`[offlineCache] Error clearing ${table}:`, error);
  }
};

/**
 * Search cached items (simple text search)
 */
export const searchCachedItems = async <T extends Record<string, any>>(
  table: string,
  searchText: string,
  searchFields: (keyof T)[] = []
): Promise<T[]> => {
  try {
    const items = await getAll<T>(table);
    const query = searchText.toLowerCase();

    if (searchFields.length === 0) {
      return items;
    }

    return items.filter(item =>
      searchFields.some(field => {
        const val = item[field];
        return val && String(val).toLowerCase().includes(query);
      })
    );
  } catch (error) {
    console.error(`[offlineCache] Error searching ${table}:`, error);
    return [];
  }
};

/**
 * Get cache statistics
 */
export const getCacheStats = async (tables: string[]): Promise<CacheMetadata[]> => {
  const stats: CacheMetadata[] = [];

  for (const table of tables) {
    try {
      const items = await getAll(table);
      const lastCachedRaw = await getMetadata(cacheLastCachedKey(table));
      const lastCached = typeof lastCachedRaw === 'number' ? lastCachedRaw : 0;
      const cacheAge = lastCached > 0 ? Date.now() - lastCached : 0;
      stats.push({
        table,
        count: items.length,
        lastCached,
        cacheAge
      });
    } catch (error) {
      console.error(`[offlineCache] Error getting stats for ${table}:`, error);
    }
  }

  return stats;
};

/**
 * Prune old cache entries per table
 */
export const pruneCacheTable = async (
  table: string,
  maxAge: number = CACHE_EXPIRY
): Promise<{ removed: number }> => {
  try {
    const items = await getAll<any>(table);
    let removed = 0;
    const now = Date.now();

    for (const item of items) {
      const itemTimeMs = getItemTimeMs(item);
      if (!itemTimeMs) continue;

      if (now - itemTimeMs > maxAge) {
        await remove(table, item.id);
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`[offlineCache] Pruned ${removed} old items from ${table}`);
    }

    return { removed };
  } catch (error) {
    console.error(`[offlineCache] Error pruning ${table}:`, error);
    return { removed: 0 };
  }
};

/**
 * Warm cache by pre-loading data (call before going offline)
 */
export const warmCache = async (
  tables: string[],
  dataFetchers: { [key: string]: () => Promise<any[]> }
): Promise<{ table: string; cached: number; error?: string }[]> => {
  const results = [];

  for (const table of tables) {
    try {
      const fetcher = dataFetchers[table];
      if (!fetcher) {
        results.push({ table, cached: 0, error: 'No fetcher defined' });
        continue;
      }

      const data = await fetcher();
      const result = await cacheItems(table, data);
      results.push({ table, cached: result.cached, error: result.skipped > 0 ? `${result.skipped} items skipped` : undefined });
    } catch (error) {
      results.push({ table, cached: 0, error: String(error) });
    }
  }

  return results;
};
