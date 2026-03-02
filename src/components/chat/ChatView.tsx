import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Send, Users, User, Settings, Trash2, Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { useMessages, Message } from "@/hooks/useMessages";
import { Conversation } from "@/hooks/useConversations";
import { useChatPresence } from "@/hooks/useChatPresence";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import GroupManagementDialog from "./GroupManagementDialog";
import BibleAIChat from "@/components/BibleAIChat";

const EMOJI_LIST = ["😀", "😂", "😍", "🥰", "😊", "🙏", "❤️", "🔥", "👍", "👏", "🎉", "✨", "💯", "🙌", "😇", "🤗"];

interface ChatViewProps {
  conversation: Conversation;
  currentUserId: string;
  onConversationUpdate?: () => void;
}

const ChatView = ({ conversation, currentUserId, onConversationUpdate }: ChatViewProps) => {
  const { messages, loading, sendMessage, refetch } = useMessages(conversation.id);
  const { typingUsers, setTyping, isUserOnline } = useChatPresence(currentUserId, conversation.id);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [groupManagementOpen, setGroupManagementOpen] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<Message | null>(null);
  const [isGroupAdmin, setIsGroupAdmin] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);
  const [aiPrefill, setAiPrefill] = useState<string | undefined>(undefined);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Check if current user is group admin
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!conversation.is_group) {
        setIsGroupAdmin(false);
        return;
      }

      const isCreator = conversation.created_by === currentUserId;
      
      const { data } = await supabase
        .from("group_admins")
        .select("id")
        .eq("conversation_id", conversation.id)
        .eq("user_id", currentUserId)
        .maybeSingle();

      setIsGroupAdmin(isCreator || !!data);
    };

    checkAdminStatus();
  }, [conversation.id, conversation.is_group, conversation.created_by, currentUserId]);

  const handleTyping = useCallback(() => {
    setTyping(true);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      setTyping(false);
    }, 2000);
  }, [setTyping]);

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    setTyping(false);

    // Detect AI tag in message (e.g., @ai or @scripture)
    const aiTagMatch = newMessage.match(/@(?:ai|scripture)\b/i);
    if (aiTagMatch) {
      // Prefill AI chat with the message content sans tag and open AI panel
      const cleaned = newMessage.replace(/@(?:ai|scripture)\b/i, '').trim();
      setAiPrefill(cleaned || undefined);
      setShowAIChat(true);
      return;
    }

    setSending(true);
    try {
      await sendMessage(newMessage, currentUserId);
      setNewMessage("");
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEmojiClick = (emoji: string) => {
    setNewMessage((prev) => prev + emoji);
    setShowEmojiPicker(false);
  };

  const handleDeleteMessage = async () => {
    if (!messageToDelete) return;

    try {
      const { error } = await supabase
        .from("messages")
        .delete()
        .eq("id", messageToDelete.id);

      if (error) throw error;
      toast({ title: "Message deleted" });
      refetch();
    } catch (error) {
      console.error("Error deleting message:", error);
      toast({
        title: "Error",
        description: "Failed to delete message",
        variant: "destructive",
      });
    } finally {
      setMessageToDelete(null);
    }
  };

  const canDeleteMessage = (message: Message) => {
    return message.sender_id === currentUserId || isGroupAdmin;
  };

  const getDisplayName = () => {
    if (conversation.is_group && conversation.name) {
      return conversation.name;
    }
    
    const otherParticipant = conversation.participants.find(
      (p) => p.user_id !== currentUserId
    );
    return otherParticipant?.username || "Unknown";
  };

  const getAvatarUrl = () => {
    if (conversation.is_group) return null;
    
    const otherParticipant = conversation.participants.find(
      (p) => p.user_id !== currentUserId
    );
    return otherParticipant?.avatar_url;
  };

  const getOtherUserId = () => {
    const otherParticipant = conversation.participants.find(
      (p) => p.user_id !== currentUserId
    );
    return otherParticipant?.user_id;
  };

  const handleHeaderClick = () => {
    if (!conversation.is_group) {
      const otherParticipant = conversation.participants.find(
        (p) => p.user_id !== currentUserId
      );
      if (otherParticipant) {
        navigate(`/profile/${otherParticipant.user_id}`);
      }
    }
  };

  // Get typing usernames
  const getTypingUsernames = () => {
    return typingUsers
      .map((userId) => {
        const participant = conversation.participants.find((p) => p.user_id === userId);
        return participant?.username || "Someone";
      })
      .filter(Boolean);
  };

  const typingUsernames = getTypingUsernames();
  const otherUserId = getOtherUserId();
  const isOtherUserOnline = otherUserId ? isUserOnline(otherUserId) : false;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <button 
          onClick={handleHeaderClick}
          className={`flex items-center gap-3 ${!conversation.is_group ? "hover:opacity-80 cursor-pointer" : ""}`}
          disabled={conversation.is_group}
        >
          <div className="relative">
            <Avatar className="h-10 w-10">
              <AvatarImage src={getAvatarUrl() || undefined} />
              <AvatarFallback className="bg-secondary">
                {conversation.is_group ? (
                  <Users className="h-5 w-5" />
                ) : (
                  <User className="h-5 w-5" />
                )}
              </AvatarFallback>
            </Avatar>
            {!conversation.is_group && isOtherUserOnline && (
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-background rounded-full" />
            )}
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-foreground">{getDisplayName()}</h3>
            {conversation.is_group ? (
              <p className="text-xs text-muted-foreground">
                {conversation.participants.length} members
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {isOtherUserOnline ? "Online" : "Offline"}
              </p>
            )}
          </div>
        </button>

        {conversation.is_group && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setGroupManagementOpen(true)}
            className="text-muted-foreground hover:text-foreground"
          >
            <Settings className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Loading messages...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p className="text-center">No messages yet. Say hello!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                isOwn={message.sender_id === currentUserId}
                showSender={conversation.is_group}
                canDelete={canDeleteMessage(message)}
                onDelete={() => setMessageToDelete(message)}
                onUsernameClick={(userId) => navigate(`/profile/${userId}`)}
              />
            ))}
            <div ref={scrollRef} />
          </div>
        )}
      </ScrollArea>

      {/* Typing Indicator */}
      {typingUsernames.length > 0 && (
        <div className="px-4 py-2 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <span className="flex gap-1">
              <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </span>
            {typingUsernames.length === 1
              ? `${typingUsernames[0]} is typing...`
              : `${typingUsernames.join(", ")} are typing...`}
          </span>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-2">
          <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground flex-shrink-0"
              >
                <Smile className="h-5 w-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2" side="top" align="start">
              <div className="grid grid-cols-8 gap-1">
                {EMOJI_LIST.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleEmojiClick(emoji)}
                    className="text-xl p-1 hover:bg-muted rounded transition-colors"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <Input
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value);
              handleTyping();
            }}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1 bg-muted border-border"
            disabled={sending}
          />
          <Button
            onClick={handleSend}
            disabled={!newMessage.trim() || sending}
            size="icon"
            className="bg-primary hover:bg-primary/90"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {/* AI Chat modal for '@ai' tagging */}
      <BibleAIChat isOpen={showAIChat} onClose={() => { setShowAIChat(false); setAiPrefill(undefined); }} initialMessage={aiPrefill} autoSend={true} />

      {/* Group Management Dialog */}
      {conversation.is_group && (
        <GroupManagementDialog
          open={groupManagementOpen}
          onOpenChange={setGroupManagementOpen}
          conversation={conversation}
          currentUserId={currentUserId}
          onUpdate={() => {
            refetch();
            onConversationUpdate?.();
          }}
        />
      )}

      {/* Delete Message Confirmation */}
      <AlertDialog open={!!messageToDelete} onOpenChange={(open) => !open && setMessageToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Message</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this message? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMessage}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  showSender: boolean;
  canDelete: boolean;
  onDelete: () => void;
  onUsernameClick: (userId: string) => void;
}

const MessageBubble = ({ message, isOwn, showSender, canDelete, onDelete, onUsernameClick }: MessageBubbleProps) => {
  const [showActions, setShowActions] = useState(false);

  return (
    <div 
      className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className={`flex gap-2 max-w-[75%] ${isOwn ? "flex-row-reverse" : ""}`}>
        {!isOwn && (
          <button onClick={() => onUsernameClick(message.sender_id)}>
            <Avatar className="h-8 w-8 flex-shrink-0 hover:opacity-80 transition-opacity">
              <AvatarImage src={message.sender?.avatar_url || undefined} />
              <AvatarFallback className="bg-secondary text-xs">
                {message.sender?.username?.charAt(0).toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
          </button>
        )}
        
        <div className="relative">
          {showSender && !isOwn && message.sender && (
            <button 
              onClick={() => onUsernameClick(message.sender_id)}
              className="text-xs text-muted-foreground mb-1 hover:text-primary transition-colors"
            >
              {message.sender.username}
            </button>
          )}
          
          <div className="flex items-center gap-1">
            {isOwn && showActions && canDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={onDelete}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
            
            <div
              className={`rounded-2xl px-4 py-2 ${
                isOwn
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground"
              }`}
            >
              <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
            </div>

            {!isOwn && showActions && canDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={onDelete}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
          
          <p className={`text-xs text-muted-foreground mt-1 ${isOwn ? "text-right" : ""}`}>
            {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ChatView;