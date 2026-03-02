import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const LAST_SEEN_KEY = 'games_last_seen_timestamp';

export const useNewQuestionsCount = () => {
  const [newCount, setNewCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const getLastSeenTimestamp = (): string => {
    const stored = localStorage.getItem(LAST_SEEN_KEY);
    if (stored) return stored;
    // Default to 24 hours ago if never set
    const defaultTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    return defaultTime;
  };

  const markAsSeen = useCallback(() => {
    localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString());
    setNewCount(0);
  }, []);

  const checkNewQuestions = useCallback(async () => {
    try {
      const lastSeen = getLastSeenTimestamp();
      
      const { count, error } = await supabase
        .from('bible_games')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
        .gt('created_at', lastSeen);

      if (error) throw error;
      setNewCount(count || 0);
    } catch (error) {
      console.error('Error checking new questions:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkNewQuestions();

    // Subscribe to new questions
    const channel = supabase
      .channel('new-questions')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bible_games',
        },
        () => {
          setNewCount(prev => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [checkNewQuestions]);

  return { newCount, loading, markAsSeen, refresh: checkNewQuestions };
};
