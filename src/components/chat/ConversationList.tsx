import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Users, User, MessageCircle, Trash2, MoreVertical, BookOpen } from "lucide-react";
import { Conversation } from "@/hooks/useConversations";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useChatPresence } from "@/hooks/useChatPresence";

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | undefined;
  onSelect: (conversation: Conversation) => void;
  currentUserId: string;
  onConversationDeleted?: () => void;
}

const ConversationList = ({
  conversations,
  selectedId,
  onSelect,
  currentUserId,
  onConversationDeleted,
}: ConversationListProps) => {
  const [conversationToDelete, setConversationToDelete] = useState<Conversation | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();
  const { isUserOnline } = useChatPresence(currentUserId);

  const getDisplayName = (conversation: Conversation) => {
    if (conversation.is_group && conversation.name) {
      return conversation.name;
    }
    
    // For DMs, show the other person's name
    const otherParticipant = conversation.participants.find(
      (p) => p.user_id !== currentUserId
    );
    return otherParticipant?.username || "Unknown";
  };

  const getAvatarUrl = (conversation: Conversation) => {
    if (conversation.is_group) return null;
    
    const otherParticipant = conversation.participants.find(
      (p) => p.user_id !== currentUserId
    );
    return otherParticipant?.avatar_url;
  };

  const getOtherUserId = (conversation: Conversation) => {
    const otherParticipant = conversation.participants.find(
      (p) => p.user_id !== currentUserId
    );
    return otherParticipant?.user_id;
  };

  const handleDeleteConversation = async () => {
    if (!conversationToDelete) return;

    setDeleting(true);
    try {
      // Delete messages first
      await supabase
        .from("messages")
        .delete()
        .eq("conversation_id", conversationToDelete.id);

      // Delete participants
      await supabase
        .from("conversation_participants")
        .delete()
        .eq("conversation_id", conversationToDelete.id);

      // Delete group admins if group
      if (conversationToDelete.is_group) {
        await supabase
          .from("group_admins")
          .delete()
          .eq("conversation_id", conversationToDelete.id);
      }

      // Delete conversation
      const { error } = await supabase
        .from("conversations")
        .delete()
        .eq("id", conversationToDelete.id);

      if (error) throw error;

      toast({ title: "Conversation deleted" });
      onConversationDeleted?.();
    } catch (error) {
      console.error("Error deleting conversation:", error);
      toast({
        title: "Error",
        description: "Failed to delete conversation",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
      setConversationToDelete(null);
    }
  };

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
        <MessageCircle className="h-12 w-12 mb-2 opacity-50" />
        <p className="text-sm text-center">No conversations yet</p>
        <p className="text-xs text-center mt-1">Start a new chat!</p>
      </div>
    );
  }

  return (
    <>
      <ScrollArea className="h-full">
        <div className="space-y-1 p-2">
          {/* Special AI Assistant entry */}
          <div
            className={`group flex items-center gap-2 rounded-lg transition-colors hover:bg-muted`}
          >
            <button
              onClick={() => onSelect({
                id: 'ai-scripture-guide',
                name: 'Scripture Guide',
                is_group: false,
                created_by: 'system',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                participants: [],
              })}
              className="flex-1 flex items-center gap-3 p-3 text-left"
            >
              <div className="relative">
                <Avatar className="h-10 w-10 flex-shrink-0">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    <BookOpen className="h-5 w-5" />
                  </AvatarFallback>
                </Avatar>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-foreground truncate">Scripture Guide</span>
                  <span className="text-xs text-muted-foreground">AI</span>
                </div>
                <p className="text-sm text-muted-foreground truncate">Ask the Bible AI assistant</p>
              </div>
            </button>
          </div>
          {conversations.map((conversation) => {
            const otherUserId = getOtherUserId(conversation);
            const isOnline = otherUserId ? isUserOnline(otherUserId) : false;

            return (
              <div
                key={conversation.id}
                className={`group flex items-center gap-2 rounded-lg transition-colors ${
                  selectedId === conversation.id
                    ? "bg-primary/10 border border-primary/30"
                    : "hover:bg-muted"
                }`}
              >
                <button
                  onClick={() => onSelect(conversation)}
                  className="flex-1 flex items-center gap-3 p-3 text-left"
                >
                  <div className="relative">
                    <Avatar className="h-10 w-10 flex-shrink-0">
                      <AvatarImage src={getAvatarUrl(conversation) || undefined} />
                      <AvatarFallback className="bg-secondary">
                        {conversation.is_group ? (
                          <Users className="h-5 w-5" />
                        ) : (
                          <User className="h-5 w-5" />
                        )}
                      </AvatarFallback>
                    </Avatar>
                    {!conversation.is_group && isOnline && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-background rounded-full" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-foreground truncate">
                        {getDisplayName(conversation)}
                      </span>
                      {conversation.lastMessage && (
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {formatDistanceToNow(new Date(conversation.lastMessage.created_at), {
                            addSuffix: false,
                          })}
                        </span>
                      )}
                    </div>
                    
                    {conversation.lastMessage && (
                      <p className="text-sm text-muted-foreground truncate">
                        {conversation.lastMessage.content}
                      </p>
                    )}
                    
                    {conversation.is_group && (
                      <p className="text-xs text-muted-foreground">
                        {conversation.participants.length} members
                      </p>
                    )}
                  </div>
                </button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity mr-2"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConversationToDelete(conversation);
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Chat
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <AlertDialog
        open={!!conversationToDelete}
        onOpenChange={(open) => !open && setConversationToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Conversation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this conversation? All messages will be permanently deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConversation}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ConversationList;
