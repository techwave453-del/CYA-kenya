import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface PresenceState {
  onlineUsers: string[];
  typingUsers: { [conversationId: string]: string[] };
}

export const useChatPresence = (userId: string | undefined, conversationId?: string) => {
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [presenceChannel, setPresenceChannel] = useState<ReturnType<typeof supabase.channel> | null>(null);

  // Track online status globally
  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel('online-users', {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users = Object.keys(state);
        setOnlineUsers(users);
      })
      .on('presence', { event: 'join' }, ({ key }) => {
        setOnlineUsers((prev) => [...new Set([...prev, key])]);
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        setOnlineUsers((prev) => prev.filter((id) => id !== key));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: userId,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Track typing in specific conversation
  useEffect(() => {
    if (!userId || !conversationId) return;

    const channel = supabase.channel(`typing-${conversationId}`, {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const typing: string[] = [];
        Object.entries(state).forEach(([key, presences]) => {
          if (key !== userId && Array.isArray(presences)) {
            const isTyping = presences.some((p: any) => p.typing === true);
            if (isTyping) {
              typing.push(key);
            }
          }
        });
        setTypingUsers(typing);
      })
      .subscribe();

    setPresenceChannel(channel);

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, conversationId]);

  const setTyping = useCallback(async (isTyping: boolean) => {
    if (!presenceChannel || !userId) return;

    try {
      await presenceChannel.track({
        user_id: userId,
        typing: isTyping,
      });
    } catch (error) {
      console.error('Error setting typing status:', error);
    }
  }, [presenceChannel, userId]);

  const isUserOnline = useCallback((checkUserId: string) => {
    return onlineUsers.includes(checkUserId);
  }, [onlineUsers]);

  return {
    onlineUsers,
    typingUsers,
    setTyping,
    isUserOnline,
  };
};
