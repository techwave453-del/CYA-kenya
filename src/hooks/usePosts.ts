import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAll, putAll, put, remove as removeFromDb, addToSyncQueue } from "@/lib/offlineDb";

export interface Post {
  id: string;
  user_id: string;
  username: string;
  hashtag: string;
  description: string | null;
  image_url: string | null;
  title: string | null;
  likes_count: number;
  comments_count: number;
  created_at: string;
}

const STORE_NAME = 'posts';
const CACHE_LIMIT = 50;
const DAILY_STORY_HASHTAG = '#DailyBibleStory';

const excludeDailyBibleStories = (items: Post[]): Post[] =>
  items.filter((post) => post.hashtag !== DAILY_STORY_HASHTAG);

export const usePosts = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

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

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (isOnline) {
        // Fetch from server
        const { data, error: fetchError } = await supabase
          .from("posts")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(CACHE_LIMIT);

        if (fetchError) {
          throw fetchError;
        }

        const serverPosts = data || [];
        const filteredPosts = excludeDailyBibleStories(serverPosts);
        setPosts(filteredPosts);
        
        // Cache to IndexedDB
        await putAll(STORE_NAME, filteredPosts);
      } else {
        // Load from cache
        const cachedPosts = await getAll<Post>(STORE_NAME);
        const filteredCachedPosts = excludeDailyBibleStories(cachedPosts).sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setPosts(filteredCachedPosts);
      }
    } catch (err) {
      console.error("Error fetching posts:", err);
      // Fallback to cache on error
      try {
        const cachedPosts = await getAll<Post>(STORE_NAME);
        const filteredCachedPosts = excludeDailyBibleStories(cachedPosts).sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setPosts(filteredCachedPosts);
      } catch {
        setError(err instanceof Error ? err.message : 'Failed to fetch posts');
      }
    }

    setLoading(false);
  }, [isOnline]);

  const deletePost = async (postId: string) => {
    // Update local state immediately
    setPosts(prev => prev.filter(p => p.id !== postId));
    await removeFromDb(STORE_NAME, postId);

    if (isOnline) {
      const { error } = await supabase
        .from("posts")
        .delete()
        .eq("id", postId);

      if (error) {
        throw error;
      }
    } else {
      // Queue for sync
      await addToSyncQueue({
        table: 'posts',
        action: 'delete',
        data: { id: postId }
      });
    }
  };

  const updatePost = async (
    postId: string,
    updates: { title?: string; description?: string; hashtag?: string }
  ) => {
    // Update local state immediately
    setPosts(prev => prev.map(p => 
      p.id === postId ? { ...p, ...updates } : p
    ));
    
    const existingPost = posts.find(p => p.id === postId);
    if (existingPost) {
      await put(STORE_NAME, { ...existingPost, ...updates });
    }

    if (isOnline) {
      const { error } = await supabase
        .from("posts")
        .update(updates)
        .eq("id", postId);

      if (error) {
        throw error;
      }
    } else {
      // Queue for sync
      await addToSyncQueue({
        table: 'posts',
        action: 'update',
        data: { id: postId, ...updates }
      });
    }
  };

  useEffect(() => {
    fetchPosts();

    // Subscribe to realtime updates only when online
    if (isOnline) {
      const channel = supabase
        .channel("posts-changes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "posts",
          },
          () => {
            fetchPosts();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [fetchPosts, isOnline]);

  // Listen for sync complete to refresh
  useEffect(() => {
    const handleSyncComplete = () => {
      if (isOnline) {
        fetchPosts();
      }
    };

    window.addEventListener('sync-complete', handleSyncComplete);
    return () => window.removeEventListener('sync-complete', handleSyncComplete);
  }, [fetchPosts, isOnline]);

  const createPost = async (post: Omit<Post, 'id' | 'created_at' | 'likes_count' | 'comments_count'>) => {
    const newPost: Post = {
      ...post,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      likes_count: 0,
      comments_count: 0,
    };

    // Update local state immediately
    setPosts(prev => [newPost, ...prev]);
    await put(STORE_NAME, newPost);

    if (isOnline) {
      const { error } = await supabase
        .from("posts")
        .insert({
          user_id: post.user_id,
          username: post.username,
          hashtag: post.hashtag,
          description: post.description,
          title: post.title,
          image_url: post.image_url,
        });

      if (error) {
        throw error;
      }
      // Refetch to get server-generated ID
      await fetchPosts();
    } else {
      // Queue for sync
      await addToSyncQueue({
        table: 'posts',
        action: 'insert',
        data: newPost
      });
    }
  };

  return { posts, loading, error, refetch: fetchPosts, deletePost, updatePost, createPost, isOnline };
};
