import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { getAll, put } from "@/lib/offlineDb";

export interface DailyStory {
  id: string;
  user_id: string;
  username: string;
  hashtag: string;
  title?: string;
  description?: string;
  image_url?: string;
  image_urls?: string[];
  likes_count: number;
  comments_count: number;
  created_at: string;
  updated_at: string;
}

const STORE_NAME = 'daily_story';
const DAILY_STORY_HASHTAG = '#DailyBibleStory';
const FEATURED_DAILY_STORY_KEY = 'featured_daily_story';

interface DailyStoryImageConfig {
  images?: string[];
}

interface FeaturedDailyStoryConfig {
  postId?: string | null;
}

const storyImageSettingKey = (storyId: string) => `daily_story_images:${storyId}`;

const uniqueUrls = (urls: string[]): string[] =>
  Array.from(new Set(urls.map((url) => url.trim()).filter(Boolean)));

const parseStoryImages = (value: Json): string[] => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [];
  }

  const images = (value as DailyStoryImageConfig).images;
  if (!Array.isArray(images)) {
    return [];
  }

  return uniqueUrls(images.filter((item): item is string => typeof item === 'string'));
};

const mergeStoryImages = (story: DailyStory, customImages: string[]): DailyStory => {
  const mergedImages = uniqueUrls([story.image_url || '', ...customImages]);
  return { ...story, image_urls: mergedImages };
};

const parseFeaturedStoryId = (value: Json): string | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const postId = (value as FeaturedDailyStoryConfig).postId;
  return typeof postId === 'string' && postId.length > 0 ? postId : null;
};

export const useDailyStory = () => {
  const [story, setStory] = useState<DailyStory | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Helper to get cached story
  const getStoryFromCache = useCallback(async (): Promise<DailyStory | null> => {
    try {
      const cachedStories = await getAll<DailyStory>(STORE_NAME);
      if (cachedStories.length > 0) {
        // Get the most recent cached story.
        const sortedStories = [...cachedStories].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        return sortedStories[0];
      }
    } catch (e) {
      console.log("Cache read failed:", e);
    }
    return null;
  }, []);

  // Fetch story from database
  const fetchStory = useCallback(async () => {
    setLoading(true);
    try {
      if (isOnline) {
        // Query for today's story (use UTC boundaries to match server)
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);

        const tomorrow = new Date(today);
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

        const { data: featuredSetting } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', FEATURED_DAILY_STORY_KEY)
          .maybeSingle();

        const featuredStoryId = featuredSetting?.value ? parseFeaturedStoryId(featuredSetting.value) : null;

        let dailyStory: DailyStory | null = null;

        if (featuredStoryId) {
          const { data: featuredStory, error: featuredError } = await supabase
            .from('posts')
            .select('*')
            .eq('id', featuredStoryId)
            .eq('hashtag', DAILY_STORY_HASHTAG)
            .maybeSingle();

          if (!featuredError && featuredStory) {
            dailyStory = featuredStory as DailyStory;
          }
        }

        if (!dailyStory) {
          const { data: stories, error } = await supabase
            .from('posts')
            .select('*')
            .eq('hashtag', DAILY_STORY_HASHTAG)
            .gte('created_at', today.toISOString())
            .lt('created_at', tomorrow.toISOString())
            .order('created_at', { ascending: false })
            .limit(1);

          if (!error && stories && stories.length > 0) {
            dailyStory = stories[0] as DailyStory;
          }
        }

        if (dailyStory) {
          const { data: imageConfigData } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', storyImageSettingKey(dailyStory.id))
            .maybeSingle();

          const customImages = imageConfigData?.value ? parseStoryImages(imageConfigData.value) : [];
          const storyWithImages = mergeStoryImages(dailyStory, customImages);

          // Cache it
          try {
            await put(STORE_NAME, storyWithImages);
          } catch (cacheError) {
            console.log("Cache write failed:", cacheError);
          }
          setStory(storyWithImages);
          setLoading(false);
          return;
        }
      }

      // Try cache if offline or no story found
      const cachedStory = await getStoryFromCache();
      if (cachedStory) {
        setStory(cachedStory);
        setLoading(false);
        return;
      }

      // No story found
      setStory(null);
    } catch (err) {
      console.error("Error fetching story:", err);
      // Try cache as fallback
      const cachedStory = await getStoryFromCache();
      setStory(cachedStory);
    } finally {
      setLoading(false);
    }
  }, [isOnline, getStoryFromCache]);

  // Fetch story on mount and when online status changes
  useEffect(() => {
    fetchStory();
  }, [fetchStory]);

  // Refresh when daily story post or its image settings change in realtime.
  useEffect(() => {
    if (!isOnline) return;

    const channel = supabase
      .channel('daily-story-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'posts' },
        (payload: any) => {
          const nextHashtag = payload?.new?.hashtag;
          const prevHashtag = payload?.old?.hashtag;
          if (nextHashtag === DAILY_STORY_HASHTAG || prevHashtag === DAILY_STORY_HASHTAG) {
            fetchStory();
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_settings' },
        (payload: any) => {
          const nextKey = payload?.new?.key;
          const prevKey = payload?.old?.key;
          if (
            nextKey === FEATURED_DAILY_STORY_KEY ||
            prevKey === FEATURED_DAILY_STORY_KEY ||
            (typeof nextKey === 'string' && nextKey.startsWith('daily_story_images:')) ||
            (typeof prevKey === 'string' && prevKey.startsWith('daily_story_images:'))
          ) {
            fetchStory();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchStory, isOnline]);

  // Set up auto-refresh at midnight
  useEffect(() => {
    const setupMidnightRefresh = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const timeUntilMidnight = tomorrow.getTime() - now.getTime();

      const timeoutId = setTimeout(() => {
        fetchStory();
        // Recursively set up the next midnight refresh
        setupMidnightRefresh();
      }, timeUntilMidnight);

      return () => clearTimeout(timeoutId);
    };

    return setupMidnightRefresh();
  }, [fetchStory]);

  return { story, loading, isOnline };
};
