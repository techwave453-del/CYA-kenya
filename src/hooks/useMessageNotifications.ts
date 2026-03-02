import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface NewMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export const useMessageNotifications = (userId: string | undefined) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    if (!userId) return;

    // Get user's conversation IDs first
    const setupNotifications = async () => {
      const { data: participantData } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", userId);

      if (!participantData || participantData.length === 0) return;

      const conversationIds = participantData.map((p) => p.conversation_id);

      // Subscribe to new messages in user's conversations
      const channel = supabase
        .channel("global-messages")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
          },
          async (payload) => {
            const newMessage = payload.new as NewMessage;

            // Only notify if message is in user's conversations and not from them
            if (
              conversationIds.includes(newMessage.conversation_id) &&
              newMessage.sender_id !== userId
            ) {
              // Increment unread count
              setUnreadCount((prev) => prev + 1);

              // Get sender profile for notification
              const { data: profile } = await supabase
                .from("profiles")
                .select("username")
                .eq("user_id", newMessage.sender_id)
                .maybeSingle();

              // Show toast notification
              toast({
                title: `New message from ${profile?.username || "Someone"}`,
                description:
                  newMessage.content.length > 50
                    ? newMessage.content.substring(0, 50) + "..."
                    : newMessage.content,
              });
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    const cleanup = setupNotifications();

    return () => {
      cleanup.then((cleanupFn) => cleanupFn?.());
    };
  }, [userId, toast]);

  const clearUnread = () => setUnreadCount(0);

  return { unreadCount, clearUnread };
};
