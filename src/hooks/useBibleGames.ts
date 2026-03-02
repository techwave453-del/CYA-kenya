import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAll, putAll, getById, put } from "@/lib/offlineDb";
import { useAuth } from "./useAuth";

export interface BibleGame {
  id: string;
  game_type:
    | 'trivia'
    | 'guess_character'
    | 'fill_blank'
    | 'memory_verse'
    | 'choose_path'
    | 'journey_jerusalem'
    | 'character_missions'
    | 'old_testament'
    | 'new_testament';
  question: string;
  options: string[] | null;
  correct_answer: string;
  hint: string | null;
  difficulty: 'easy' | 'medium' | 'hard';
  bible_reference: string | null;
  points: number;
  is_active: boolean;
  bible_story: string | null;
  testament: 'old' | 'new' | null;
  created_at: string;
  updated_at: string;
}

export interface GameScore {
  id: string;
  user_id: string;
  game_type: string;
  score: number;
  games_played: number;
  highest_streak: number;
  created_at: string;
  updated_at: string;
  profiles?: {
    username: string;
    avatar_url: string | null;
  };
}

export interface LocalGameProgress {
  id: string;
  game_type: string;
  score: number;
  games_played: number;
  highest_streak: number;
  current_streak: number;
}

const GAMES_STORE = 'bible_games';
const PROGRESS_STORE = 'game_progress';

export const useBibleGames = (gameType?: string) => {
  const [games, setGames] = useState<BibleGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const { user } = useAuth();

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

  const fetchGames = useCallback(async () => {
    setLoading(true);
    try {
      if (isOnline) {
        let query = supabase
          .from('bible_games')
          .select('*')
          .eq('is_active', true);
        
        if (gameType) {
          query = query.eq('game_type', gameType);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        if (data) {
          const typedGames = data.map(game => ({
            ...game,
            options: game.options as string[] | null,
            game_type: game.game_type as BibleGame['game_type'],
            difficulty: game.difficulty as BibleGame['difficulty'],
            bible_story: (game as any).bible_story || null,
            testament: (game as any).testament || null,
          }));
          setGames(typedGames);
          // Cache for offline use
          await putAll(GAMES_STORE, typedGames);
        }
      } else {
        // Load from cache
        const cached = await getAll<BibleGame>(GAMES_STORE);
        if (gameType) {
          setGames(cached.filter(g => g.game_type === gameType));
        } else {
          setGames(cached);
        }
      }
    } catch (error) {
      console.error('Error fetching games:', error);
      // Fallback to cache on error
      const cached = await getAll<BibleGame>(GAMES_STORE);
      if (gameType) {
        setGames(cached.filter(g => g.game_type === gameType));
      } else {
        setGames(cached);
      }
    } finally {
      setLoading(false);
    }
  }, [gameType, isOnline]);

  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  // Get local progress
  const getLocalProgress = async (type: string): Promise<LocalGameProgress | null> => {
    try {
      const progress = await getById<LocalGameProgress>(PROGRESS_STORE, type);
      return progress || null;
    } catch {
      return null;
    }
  };

  // Save local progress
  const saveLocalProgress = async (progress: LocalGameProgress) => {
    try {
      await put(PROGRESS_STORE, { ...progress, id: progress.game_type });
    } catch (error) {
      console.error('Error saving local progress:', error);
    }
  };

  // Sync score to server
  const syncScore = async (gameType: string, points: number, streak: number) => {
    if (!user || !isOnline) return;

    try {
      // Get existing score
      const { data: existing } = await supabase
        .from('game_scores')
        .select('*')
        .eq('user_id', user.id)
        .eq('game_type', gameType)
        .single();

      if (existing) {
        // Update existing
        await supabase
          .from('game_scores')
          .update({
            score: existing.score + points,
            games_played: existing.games_played + 1,
            highest_streak: Math.max(existing.highest_streak, streak)
          })
          .eq('id', existing.id);
      } else {
        // Insert new
        await supabase
          .from('game_scores')
          .insert({
            user_id: user.id,
            game_type: gameType,
            score: points,
            games_played: 1,
            highest_streak: streak
          });
      }
    } catch (error) {
      console.error('Error syncing score:', error);
    }
  };

  return {
    games,
    loading,
    isOnline,
    refetch: fetchGames,
    getLocalProgress,
    saveLocalProgress,
    syncScore
  };
};

export interface AggregatedScore {
  user_id: string;
  total_score: number;
  total_games_played: number;
  highest_streak: number;
  games: { game_type: string; score: number; games_played: number }[];
  profiles?: {
    username: string;
    avatar_url: string | null;
  };
}

export const useLeaderboard = (gameType?: string) => {
  const [scores, setScores] = useState<AggregatedScore[]>([]);
  const [loading, setLoading] = useState(true);
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

  const fetchScores = useCallback(async () => {
    if (!isOnline) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      let query = supabase
        .from('game_scores')
        .select('*')
        .order('score', { ascending: false });
      
      if (gameType) {
        query = query.eq('game_type', gameType);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      
      if (data) {
        // Aggregate scores by user
        const userScoresMap = new Map<string, {
          user_id: string;
          total_score: number;
          total_games_played: number;
          highest_streak: number;
          games: { game_type: string; score: number; games_played: number }[];
        }>();

        data.forEach((score) => {
          const existing = userScoresMap.get(score.user_id);
          if (existing) {
            existing.total_score += score.score;
            existing.total_games_played += score.games_played;
            existing.highest_streak = Math.max(existing.highest_streak, score.highest_streak);
            existing.games.push({
              game_type: score.game_type,
              score: score.score,
              games_played: score.games_played,
            });
          } else {
            userScoresMap.set(score.user_id, {
              user_id: score.user_id,
              total_score: score.score,
              total_games_played: score.games_played,
              highest_streak: score.highest_streak,
              games: [{
                game_type: score.game_type,
                score: score.score,
                games_played: score.games_played,
              }],
            });
          }
        });

        // Convert to array and sort by total score
        const aggregatedScores = Array.from(userScoresMap.values())
          .sort((a, b) => b.total_score - a.total_score)
          .slice(0, 10);

        // Fetch profiles
        const userIds = aggregatedScores.map(s => s.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, username, avatar_url')
          .in('user_id', userIds);
        
        const scoresWithProfiles: AggregatedScore[] = aggregatedScores.map(score => ({
          ...score,
          profiles: profiles?.find(p => p.user_id === score.user_id) || undefined
        }));
        
        setScores(scoresWithProfiles);
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
    }
  }, [gameType, isOnline]);

  useEffect(() => {
    fetchScores();
  }, [fetchScores]);

  return { scores, loading, isOnline, refetch: fetchScores };
};
