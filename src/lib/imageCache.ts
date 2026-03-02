/**
 * Image caching and optimization for offline support
 * Makes images available offline with size optimization
 */

const IMAGE_CACHE_NAME = 'cya-images-v1';
const MAX_IMAGES = 100;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB per image
const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50MB total

interface ImageCacheEntry {
  url: string;
  timestamp: number;
  size: number;
  width?: number;
  height?: number;
  mimeType?: string;
}

/**
 * Get cached image from Cache API
 */
export const getCachedImage = async (url: string): Promise<Blob | null> => {
  try {
    if (!('caches' in window)) return null;

    const cache = await caches.open(IMAGE_CACHE_NAME);
    const response = await cache.match(url);

    if (response) {
      console.log(`[imageCache] Retrieved cached image: ${url}`);
      return await response.blob();
    }
    return null;
  } catch (error) {
    console.error('[imageCache] Error retrieving cached image:', error);
    return null;
  }
};

/**
 * Cache an image from URL
 */
export const cacheImage = async (url: string): Promise<{ success: boolean; size?: number; error?: string }> => {
  try {
    if (!('caches' in window)) {
      return { success: false, error: 'Cache API not available' };
    }

    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const blob = await response.blob();
    const size = blob.size;

    // Check size limits
    if (size > MAX_IMAGE_SIZE) {
      return { success: false, error: `Image too large: ${size} > ${MAX_IMAGE_SIZE}` };
    }

    // Check if we need to prune
    const stats = await getImageCacheStats();
    if (stats.totalSize + size > MAX_TOTAL_SIZE) {
      await pruneOldestImages(stats);
    }

    const cache = await caches.open(IMAGE_CACHE_NAME);
    const newResponse = new Response(blob, {
      headers: {
        'Content-Type': blob.type,
        'X-Cached-At': String(Date.now())
      }
    });
    await cache.put(url, newResponse);

    console.log(`[imageCache] Cached image: ${url} (${size} bytes)`);
    return { success: true, size };
  } catch (error) {
    console.error('[imageCache] Error caching image:', error);
    return { success: false, error: String(error) };
  }
};

/**
 * Batch cache multiple images
 */
export const cacheImages = async (urls: string[]): Promise<{ cached: number; failed: number }> => {
  let cached = 0;
  let failed = 0;

  for (const url of urls) {
    const result = await cacheImage(url);
    if (result.success) {
      cached++;
    } else {
      failed++;
    }
  }

  console.log(`[imageCache] Batch cache complete: ${cached} cached, ${failed} failed`);
  return { cached, failed };
};

/**
 * Get image cache statistics
 */
export const getImageCacheStats = async (): Promise<{
  count: number;
  totalSize: number;
  images: ImageCacheEntry[];
}> => {
  try {
    if (!('caches' in window)) {
      return { count: 0, totalSize: 0, images: [] };
    }

    const cache = await caches.open(IMAGE_CACHE_NAME);
    const keys = await cache.keys();
    const images: ImageCacheEntry[] = [];
    let totalSize = 0;

    for (const request of keys) {
      const response = await cache.match(request);
      if (response) {
        const blob = await response.blob();
        const size = blob.size;
        totalSize += size;

        images.push({
          url: request.url,
          timestamp: parseInt(response.headers.get('X-Cached-At') || '0'),
          size,
          mimeType: blob.type
        });
      }
    }

    // Sort by timestamp (newest first)
    images.sort((a, b) => b.timestamp - a.timestamp);

    return { count: images.length, totalSize, images };
  } catch (error) {
    console.error('[imageCache] Error getting statistics:', error);
    return { count: 0, totalSize: 0, images: [] };
  }
};

/**
 * Prune oldest images to free space
 */
export const pruneOldestImages = async (stats?: { count: number; totalSize: number; images: ImageCacheEntry[] }): Promise<{ removed: number; freedSpace: number }> => {
  try {
    if (!('caches' in window)) {
      return { removed: 0, freedSpace: 0 };
    }

    const cacheStats = stats || await getImageCacheStats();
    const cache = await caches.open(IMAGE_CACHE_NAME);
    let removed = 0;
    let freedSpace = 0;

    // Remove oldest 20% of images or until under limit
    const toRemove = Math.max(1, Math.ceil(cacheStats.images.length * 0.2));

    for (let i = 0; i < toRemove; i++) {
      const img = cacheStats.images[i];
      if (img) {
        await cache.delete(img.url);
        removed++;
        freedSpace += img.size;
      }
    }

    console.log(`[imageCache] Pruned ${removed} images, freed ${freedSpace} bytes`);
    return { removed, freedSpace };
  } catch (error) {
    console.error('[imageCache] Error pruning images:', error);
    return { removed: 0, freedSpace: 0 };
  }
};

/**
 * Clear all cached images
 */
export const clearImageCache = async (): Promise<void> => {
  try {
    if ('caches' in window) {
      await caches.delete(IMAGE_CACHE_NAME);
      console.log('[imageCache] Cleared all cached images');
    }
  } catch (error) {
    console.error('[imageCache] Error clearing cache:', error);
  }
};

/**
 * Pre-cache story images (call before going offline)
 */
export const precacheStoryImages = async (storyImages: { title: string; image?: string }[]): Promise<{ cached: number; failed: number }> => {
  const urls = storyImages
    .filter(s => s.image && s.image.startsWith('http'))
    .map(s => s.image!);

  return cacheImages(urls);
};

/**
 * Create blob URL from cached image or live URL
 */
export const getImageUrl = async (url: string): Promise<string> => {
  try {
    // First try cache
    const cached = await getCachedImage(url);
    if (cached) {
      return URL.createObjectURL(cached);
    }
    // If not cached, return original URL (will load from network if online)
    return url;
  } catch (error) {
    console.error('[imageCache] Error getting image URL:', error);
    return url;
  }
};

/**
 * Progressive image loading: try cache first, then network
 */
export const loadImageProgressive = async (
  url: string,
  onCached?: () => void,
  onLoaded?: () => void
): Promise<string> => {
  try {
    // Try cache first
    const cached = await getCachedImage(url);
    if (cached) {
      onCached?.();
      return URL.createObjectURL(cached);
    }

    // If online, cache for future
    if (navigator.onLine) {
      cacheImage(url).catch(() => {
        /* ignore */
      });
    }

    onLoaded?.();
    return url;
  } catch (error) {
    console.error('[imageCache] Error in progressive load:', error);
    return url;
  }
};
