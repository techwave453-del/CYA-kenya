import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { User } from '@supabase/supabase-js';

export interface SavedChat {
  id: string;
  title: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  created_at: string;
  updated_at: string;
}

export const useSavedChats = (user: User | null) => {
  const [savedChats, setSavedChats] = useState<SavedChat[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSavedChats = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('saved_bible_chats')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      
      setSavedChats(data?.map(chat => ({
        ...chat,
        messages: chat.messages as SavedChat['messages']
      })) || []);
    } catch (error) {
      console.error('Error fetching saved chats:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSavedChats();
  }, [fetchSavedChats]);

  const saveChat = async (title: string, messages: SavedChat['messages']) => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to save conversations",
        variant: "destructive"
      });
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('saved_bible_chats')
        .insert({
          user_id: user.id,
          title,
          messages
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Saved! 📖",
        description: "Conversation saved successfully"
      });

      fetchSavedChats();
      return data;
    } catch (error) {
      console.error('Error saving chat:', error);
      toast({
        title: "Error",
        description: "Failed to save conversation",
        variant: "destructive"
      });
      return null;
    }
  };

  const deleteChat = async (id: string) => {
    try {
      const { error } = await supabase
        .from('saved_bible_chats')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Deleted",
        description: "Conversation removed"
      });

      setSavedChats(prev => prev.filter(chat => chat.id !== id));
    } catch (error) {
      console.error('Error deleting chat:', error);
      toast({
        title: "Error",
        description: "Failed to delete conversation",
        variant: "destructive"
      });
    }
  };

  return {
    savedChats,
    loading,
    saveChat,
    deleteChat,
    refetch: fetchSavedChats
  };
};
