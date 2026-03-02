import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Plus, MessageCircle, ArrowLeft, Home } from "lucide-react";
import Header from "@/components/Header";
import BibleAIChat from '@/components/BibleAIChat';
import { Button } from "@/components/ui/button";
import ConversationList from "@/components/chat/ConversationList";
import ChatView from "@/components/chat/ChatView";
import NewConversationDialog from "@/components/chat/NewConversationDialog";
import OnlineUsersRibbon from "@/components/chat/OnlineUsersRibbon";
import ProfileCompletionBanner from "@/components/ProfileCompletionBanner";
import { useAuth } from "@/hooks/useAuth";
import { useConversations, Conversation } from "@/hooks/useConversations";
import { useChatPresence } from "@/hooks/useChatPresence";
import { useIsMobile } from "@/hooks/use-mobile";

const ChatPage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const { conversations, loading: convsLoading, refetch } = useConversations(user?.id);
  const { onlineUsers } = useChatPresence(user?.id);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const location = useLocation();
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/auth");
    }
  }, [authLoading, isAuthenticated, navigate]);

  // If navigated with state to open AI, select the AI conversation
  useEffect(() => {
    if (location?.state && (location as any).state.openAI) {
      setSelectedConversation({
        id: 'ai-scripture-guide',
        name: 'Scripture Guide',
        is_group: false,
        created_by: 'system',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        participants: [],
      });
      // clear history state to avoid reopening repeatedly
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  const handleConversationCreated = async (conversationId: string) => {
    await refetch();
    const newConv = conversations.find((c) => c.id === conversationId);
    if (newConv) {
      setSelectedConversation(newConv);
    }
  };

  const handleBack = () => {
    setSelectedConversation(null);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!user) return null;

  // Mobile view - show either list or chat
  if (isMobile) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <ProfileCompletionBanner userId={user.id} />
        
        {selectedConversation ? (
          <div className="flex-1 flex flex-col">
            <div className="p-2 border-b border-border flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                className="text-muted-foreground"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </div>
            <div className="flex-1">
              <ChatView
                conversation={selectedConversation}
                currentUserId={user.id}
                onConversationUpdate={refetch}
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col">
            <OnlineUsersRibbon onlineUserIds={onlineUsers} currentUserId={user.id} />
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate("/")}
                  className="text-muted-foreground"
                >
                  <Home className="h-4 w-4" />
                </Button>
                <h1 className="text-xl font-bold text-foreground">Messages</h1>
              </div>
              <Button
                onClick={() => setNewConversationOpen(true)}
                size="icon"
                className="bg-primary hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="flex-1">
              {convsLoading ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Loading conversations...
                </div>
              ) : (
                <ConversationList
                  conversations={conversations}
                  selectedId={undefined}
                  onSelect={setSelectedConversation}
                  currentUserId={user.id}
                  onConversationDeleted={refetch}
                />
              )}
            </div>
          </div>
        )}

        <NewConversationDialog
          open={newConversationOpen}
          onOpenChange={setNewConversationOpen}
          currentUserId={user.id}
          onConversationCreated={handleConversationCreated}
        />
      </div>
    );
  }

  // Desktop view - side by side
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <ProfileCompletionBanner userId={user.id} />
      
      <div className="flex-1 flex">
        {/* Sidebar */}
        <div className="w-80 border-r border-border flex flex-col">
          <OnlineUsersRibbon onlineUserIds={onlineUsers} currentUserId={user.id} />
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/")}
                className="text-muted-foreground"
              >
                <Home className="h-4 w-4" />
              </Button>
              <h1 className="text-xl font-bold text-foreground">Messages</h1>
            </div>
            <Button
              onClick={() => setNewConversationOpen(true)}
              size="icon"
              variant="ghost"
              className="text-primary hover:bg-primary/10"
            >
              <Plus className="h-5 w-5" />
            </Button>
          </div>
          
          <div className="flex-1">
            {convsLoading ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Loading...
              </div>
            ) : (
              <ConversationList
                conversations={conversations}
                selectedId={selectedConversation?.id}
                onSelect={setSelectedConversation}
                currentUserId={user.id}
                onConversationDeleted={refetch}
              />
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1">
          {selectedConversation ? (
            // If the special AI conversation is selected, open the AI chat panel
            selectedConversation.id === 'ai-scripture-guide' ? (
              <>
                <BibleAIChat isOpen={true} onClose={() => setSelectedConversation(null)} />
              </>
            ) : (
              <ChatView
                conversation={selectedConversation}
                currentUserId={user.id}
                onConversationUpdate={refetch}
              />
            )
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <MessageCircle className="h-16 w-16 mb-4 opacity-50" />
              <p className="text-lg">Select a conversation</p>
              <p className="text-sm">or start a new one</p>
            </div>
          )}
        </div>
      </div>

      <NewConversationDialog
        open={newConversationOpen}
        onOpenChange={setNewConversationOpen}
        currentUserId={user.id}
        onConversationCreated={handleConversationCreated}
      />
    </div>
  );
};

export default ChatPage;
