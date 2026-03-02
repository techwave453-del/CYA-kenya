import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Participant {
  user_id: string;
  username: string;
  avatar_url: string | null;
}

export interface Conversation {
  id: string;
  name: string | null;
  is_group: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  participants: Participant[];
  lastMessage?: {
    content: string;
    created_at: string;
    sender_id: string;
  };
}

export const useConversations = (userId: string | undefined) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      // Get all conversation IDs where user is a participant
      const { data: participantData, error: participantError } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", userId);

      if (participantError) throw participantError;

      if (!participantData || participantData.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      const conversationIds = participantData.map((p) => p.conversation_id);

      // Get conversations
      const { data: convData, error: convError } = await supabase
        .from("conversations")
        .select("*")
        .in("id", conversationIds)
        .order("updated_at", { ascending: false });

      if (convError) throw convError;

      // Get all participants for these conversations
      const { data: allParticipants, error: allPartError } = await supabase
        .from("conversation_participants")
        .select("conversation_id, user_id")
        .in("conversation_id", conversationIds);

      if (allPartError) throw allPartError;

      // Get profiles for all participants
      const participantUserIds = [...new Set(allParticipants?.map((p) => p.user_id) || [])];
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, username, avatar_url")
        .in("user_id", participantUserIds);

      if (profilesError) throw profilesError;

      // Get last message for each conversation
      const { data: lastMessages, error: messagesError } = await supabase
        .from("messages")
        .select("conversation_id, content, created_at, sender_id")
        .in("conversation_id", conversationIds)
        .order("created_at", { ascending: false });

      if (messagesError) throw messagesError;

      // Build conversation objects
      const conversationsWithDetails: Conversation[] = (convData || []).map((conv) => {
        const convParticipants = allParticipants
          ?.filter((p) => p.conversation_id === conv.id)
          .map((p) => {
            const profile = profiles?.find((pr) => pr.user_id === p.user_id);
            return {
              user_id: p.user_id,
              username: profile?.username || "Unknown",
              avatar_url: profile?.avatar_url || null,
            };
          }) || [];

        const lastMessage = lastMessages?.find((m) => m.conversation_id === conv.id);

        return {
          ...conv,
          participants: convParticipants,
          lastMessage: lastMessage
            ? {
                content: lastMessage.content,
                created_at: lastMessage.created_at,
                sender_id: lastMessage.sender_id,
              }
            : undefined,
        };
      });

      setConversations(conversationsWithDetails);
    } catch (error) {
      console.error("Error fetching conversations:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [userId]);

  // Subscribe to message updates to refresh conversations
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel("conversations-updates")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return { conversations, loading, refetch: fetchConversations };
};
