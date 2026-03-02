import { useState, useEffect } from "react";
import { Users, User, Plus, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Profile {
  user_id: string;
  username: string;
  avatar_url: string | null;
}

interface NewConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: string;
  onConversationCreated: (conversationId: string) => void;
}

const NewConversationDialog = ({
  open,
  onOpenChange,
  currentUserId,
  onConversationCreated,
}: NewConversationDialogProps) => {
  const [users, setUsers] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [groupName, setGroupName] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchUsers();
    }
  }, [open]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, username, avatar_url")
        .neq("user_id", currentUserId)
        .order("username");

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter((user) =>
    user.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleUserToggle = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleCreateDM = async (userId: string) => {
    setCreating(true);
    try {
      // Check if DM already exists
      const { data: existingParticipants } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", currentUserId);

      if (existingParticipants && existingParticipants.length > 0) {
        const conversationIds = existingParticipants.map((p) => p.conversation_id);
        
        const { data: otherParticipants } = await supabase
          .from("conversation_participants")
          .select("conversation_id")
          .in("conversation_id", conversationIds)
          .eq("user_id", userId);

        if (otherParticipants && otherParticipants.length > 0) {
          // Check if it's a DM (not a group)
          for (const p of otherParticipants) {
            const { data: conv } = await supabase
              .from("conversations")
              .select("id, is_group")
              .eq("id", p.conversation_id)
              .eq("is_group", false)
              .maybeSingle();

            if (conv) {
              onConversationCreated(conv.id);
              onOpenChange(false);
              resetState();
              return;
            }
          }
        }
      }

      // Create new DM
      const { data: conversation, error: convError } = await supabase
        .from("conversations")
        .insert({
          is_group: false,
          created_by: currentUserId,
        })
        .select()
        .single();

      if (convError) throw convError;

      // Add participants
      const { error: partError } = await supabase
        .from("conversation_participants")
        .insert([
          { conversation_id: conversation.id, user_id: currentUserId },
          { conversation_id: conversation.id, user_id: userId },
        ]);

      if (partError) throw partError;

      toast({ title: "Conversation created!" });
      onConversationCreated(conversation.id);
      onOpenChange(false);
      resetState();
    } catch (error) {
      console.error("Error creating DM:", error);
      toast({
        title: "Error",
        description: "Failed to create conversation",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleCreateGroup = async () => {
    if (selectedUsers.length < 2 || !groupName.trim()) {
      toast({
        title: "Invalid group",
        description: "Please enter a group name and select at least 2 members",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);
    try {
      const { data: conversation, error: convError } = await supabase
        .from("conversations")
        .insert({
          name: groupName.trim(),
          is_group: true,
          created_by: currentUserId,
        })
        .select()
        .single();

      if (convError) throw convError;

      // Add all participants including current user
      const participants = [currentUserId, ...selectedUsers].map((userId) => ({
        conversation_id: conversation.id,
        user_id: userId,
      }));

      const { error: partError } = await supabase
        .from("conversation_participants")
        .insert(participants);

      if (partError) throw partError;

      toast({ title: "Group created!" });
      onConversationCreated(conversation.id);
      onOpenChange(false);
      resetState();
    } catch (error) {
      console.error("Error creating group:", error);
      toast({
        title: "Error",
        description: "Failed to create group",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const resetState = () => {
    setSelectedUsers([]);
    setGroupName("");
    setSearchQuery("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">New Conversation</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="dm" className="w-full">
          <TabsList className="w-full bg-muted">
            <TabsTrigger value="dm" className="flex-1">
              <User className="h-4 w-4 mr-2" />
              Direct Message
            </TabsTrigger>
            <TabsTrigger value="group" className="flex-1">
              <Users className="h-4 w-4 mr-2" />
              Group Chat
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dm" className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search users..."
                className="pl-10 bg-muted border-border"
              />
            </div>

            <ScrollArea className="h-[300px]">
              {loading ? (
                <p className="text-center text-muted-foreground py-4">Loading...</p>
              ) : filteredUsers.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No users found</p>
              ) : (
                <div className="space-y-1">
                  {filteredUsers.map((user) => (
                    <button
                      key={user.user_id}
                      onClick={() => handleCreateDM(user.user_id)}
                      disabled={creating}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={user.avatar_url || undefined} />
                        <AvatarFallback className="bg-secondary">
                          {user.username.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-foreground">{user.username}</span>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="group" className="space-y-4">
            <div>
              <Label htmlFor="groupName" className="text-foreground">Group Name</Label>
              <Input
                id="groupName"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Enter group name..."
                className="mt-1 bg-muted border-border"
              />
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search users..."
                className="pl-10 bg-muted border-border"
              />
            </div>

            <ScrollArea className="h-[200px]">
              {loading ? (
                <p className="text-center text-muted-foreground py-4">Loading...</p>
              ) : filteredUsers.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No users found</p>
              ) : (
                <div className="space-y-1">
                  {filteredUsers.map((user) => (
                    <label
                      key={user.user_id}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                    >
                      <Checkbox
                        checked={selectedUsers.includes(user.user_id)}
                        onCheckedChange={() => handleUserToggle(user.user_id)}
                      />
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.avatar_url || undefined} />
                        <AvatarFallback className="bg-secondary text-sm">
                          {user.username.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-foreground">{user.username}</span>
                    </label>
                  ))}
                </div>
              )}
            </ScrollArea>

            {selectedUsers.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {selectedUsers.length} member{selectedUsers.length !== 1 ? "s" : ""} selected
              </p>
            )}

            <Button
              onClick={handleCreateGroup}
              disabled={creating || selectedUsers.length < 2 || !groupName.trim()}
              className="w-full bg-primary hover:bg-primary/90"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Group
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default NewConversationDialog;
