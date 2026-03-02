import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender?: {
    username: string;
    avatar_url: string | null;
  };
}

export const useMessages = (conversationId: string | undefined) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMessages = async () => {
    if (!conversationId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Get sender profiles
      const senderIds = [...new Set(data?.map((m) => m.sender_id) || [])];
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, username, avatar_url")
        .in("user_id", senderIds);

      if (profilesError) throw profilesError;

      const messagesWithSenders: Message[] = (data || []).map((msg) => {
        const profile = profiles?.find((p) => p.user_id === msg.sender_id);
        return {
          ...msg,
          sender: profile
            ? { username: profile.username, avatar_url: profile.avatar_url }
            : undefined,
        };
      });

      setMessages(messagesWithSenders);
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [conversationId]);

  // Subscribe to real-time messages (INSERT and DELETE)
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const newMessage = payload.new as Message;
          
          // Get sender profile
          const { data: profile } = await supabase
            .from("profiles")
            .select("user_id, username, avatar_url")
            .eq("user_id", newMessage.sender_id)
            .maybeSingle();

          const messageWithSender: Message = {
            ...newMessage,
            sender: profile
              ? { username: profile.username, avatar_url: profile.avatar_url }
              : undefined,
          };

          setMessages((prev) => [...prev, messageWithSender]);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const deletedMessage = payload.old as { id: string };
          setMessages((prev) => prev.filter((m) => m.id !== deletedMessage.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  const sendMessage = async (content: string, senderId: string) => {
    if (!conversationId || !content.trim()) return;

    const { data, error } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content: content.trim(),
    }).select().single();

    if (error) {
      console.error("Error sending message:", error);
      throw error;
    }

    // Update conversation updated_at
    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);

    // Trigger push notification for other participants
    if (data) {
      supabase.functions.invoke('notify-new-message', {
        body: {
          messageId: data.id,
          conversationId: conversationId,
          senderId: senderId,
          content: content.trim(),
        },
      }).catch((err) => {
        console.error('Error triggering push notification:', err);
      });
    }
  };

  return { messages, loading, sendMessage, refetch: fetchMessages };
};
