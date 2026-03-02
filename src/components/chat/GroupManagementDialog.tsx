import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Users, UserPlus, UserMinus, Shield, ShieldCheck, Search, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Conversation } from "@/hooks/useConversations";

interface Profile {
  user_id: string;
  username: string;
  avatar_url: string | null;
}

interface GroupManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: Conversation;
  currentUserId: string;
  onUpdate: () => void;
}

const GroupManagementDialog = ({
  open,
  onOpenChange,
  conversation,
  currentUserId,
  onUpdate,
}: GroupManagementDialogProps) => {
  const [allUsers, setAllUsers] = useState<Profile[]>([]);
  const [groupAdmins, setGroupAdmins] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [deleteGroupOpen, setDeleteGroupOpen] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const isCreator = conversation.created_by === currentUserId;
  const isAdmin = groupAdmins.includes(currentUserId) || isCreator;

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch all users
      const { data: users, error: usersError } = await supabase
        .from("profiles")
        .select("user_id, username, avatar_url")
        .order("username");

      if (usersError) throw usersError;
      setAllUsers(users || []);

      // Fetch group admins
      const { data: admins, error: adminsError } = await supabase
        .from("group_admins")
        .select("user_id")
        .eq("conversation_id", conversation.id);

      if (adminsError) throw adminsError;
      setGroupAdmins(admins?.map((a) => a.user_id) || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const participantIds = conversation.participants.map((p) => p.user_id);
  const nonParticipants = allUsers.filter(
    (u) => !participantIds.includes(u.user_id)
  );
  const filteredNonParticipants = nonParticipants.filter((user) =>
    user.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddMember = async (userId: string) => {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("conversation_participants")
        .insert({
          conversation_id: conversation.id,
          user_id: userId,
        });

      if (error) throw error;
      toast({ title: "Member added!" });
      onUpdate();
    } catch (error) {
      console.error("Error adding member:", error);
      toast({
        title: "Error",
        description: "Failed to add member",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("conversation_participants")
        .delete()
        .eq("conversation_id", conversation.id)
        .eq("user_id", userId);

      if (error) throw error;
      
      // Also remove from admins if they were an admin
      await supabase
        .from("group_admins")
        .delete()
        .eq("conversation_id", conversation.id)
        .eq("user_id", userId);
      
      toast({ title: "Member removed" });
      onUpdate();
      fetchData();
    } catch (error) {
      console.error("Error removing member:", error);
      toast({
        title: "Error",
        description: "Failed to remove member",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleAdmin = async (userId: string) => {
    setActionLoading(true);
    try {
      const isCurrentlyAdmin = groupAdmins.includes(userId);
      
      if (isCurrentlyAdmin) {
        const { error } = await supabase
          .from("group_admins")
          .delete()
          .eq("conversation_id", conversation.id)
          .eq("user_id", userId);
        
        if (error) throw error;
        toast({ title: "Admin removed" });
      } else {
        const { error } = await supabase
          .from("group_admins")
          .insert({
            conversation_id: conversation.id,
            user_id: userId,
          });
        
        if (error) throw error;
        toast({ title: "Admin added!" });
      }
      
      fetchData();
    } catch (error) {
      console.error("Error toggling admin:", error);
      toast({
        title: "Error",
        description: "Failed to update admin status",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteGroup = async () => {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("conversations")
        .delete()
        .eq("id", conversation.id);

      if (error) throw error;
      toast({ title: "Group deleted" });
      onOpenChange(false);
      onUpdate();
    } catch (error) {
      console.error("Error deleting group:", error);
      toast({
        title: "Error",
        description: "Failed to delete group",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
      setDeleteGroupOpen(false);
    }
  };

  const goToProfile = (userId: string) => {
    onOpenChange(false);
    navigate(`/profile/${userId}`);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Users className="h-5 w-5" />
              Manage Group
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="members" className="w-full">
            <TabsList className="w-full bg-muted">
              <TabsTrigger value="members" className="flex-1">
                Members
              </TabsTrigger>
              {isAdmin && (
                <TabsTrigger value="add" className="flex-1">
                  Add Members
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="members" className="space-y-4">
              <ScrollArea className="h-[300px]">
                {loading ? (
                  <p className="text-center text-muted-foreground py-4">Loading...</p>
                ) : (
                  <div className="space-y-1">
                    {conversation.participants.map((participant) => {
                      const isParticipantAdmin = groupAdmins.includes(participant.user_id) || 
                        conversation.created_by === participant.user_id;
                      const isParticipantCreator = conversation.created_by === participant.user_id;
                      const canManage = isAdmin && 
                        participant.user_id !== currentUserId && 
                        !isParticipantCreator;

                      return (
                        <div
                          key={participant.user_id}
                          className="flex items-center justify-between p-3 rounded-lg hover:bg-muted"
                        >
                          <button
                            onClick={() => goToProfile(participant.user_id)}
                            className="flex items-center gap-3 text-left"
                          >
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={participant.avatar_url || undefined} />
                              <AvatarFallback className="bg-secondary">
                                {participant.username.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <span className="font-medium text-foreground">
                                {participant.username}
                              </span>
                              {isParticipantCreator && (
                                <span className="text-xs text-primary ml-2">Creator</span>
                              )}
                              {isParticipantAdmin && !isParticipantCreator && (
                                <span className="text-xs text-muted-foreground ml-2">Admin</span>
                              )}
                            </div>
                          </button>
                          
                          {canManage && (
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleToggleAdmin(participant.user_id)}
                                disabled={actionLoading}
                                title={isParticipantAdmin ? "Remove admin" : "Make admin"}
                              >
                                {isParticipantAdmin ? (
                                  <ShieldCheck className="h-4 w-4 text-primary" />
                                ) : (
                                  <Shield className="h-4 w-4 text-muted-foreground" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveMember(participant.user_id)}
                                disabled={actionLoading}
                                className="text-destructive hover:text-destructive"
                                title="Remove from group"
                              >
                                <UserMinus className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>

              {isCreator && (
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => setDeleteGroupOpen(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Group
                </Button>
              )}
            </TabsContent>

            {isAdmin && (
              <TabsContent value="add" className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search users..."
                    className="pl-10 bg-muted border-border"
                  />
                </div>

                <ScrollArea className="h-[250px]">
                  {loading ? (
                    <p className="text-center text-muted-foreground py-4">Loading...</p>
                  ) : filteredNonParticipants.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">
                      No users to add
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {filteredNonParticipants.map((user) => (
                        <div
                          key={user.user_id}
                          className="flex items-center justify-between p-3 rounded-lg hover:bg-muted"
                        >
                          <button
                            onClick={() => goToProfile(user.user_id)}
                            className="flex items-center gap-3"
                          >
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={user.avatar_url || undefined} />
                              <AvatarFallback className="bg-secondary">
                                {user.username.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium text-foreground">
                              {user.username}
                            </span>
                          </button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleAddMember(user.user_id)}
                            disabled={actionLoading}
                            className="text-primary hover:text-primary"
                          >
                            <UserPlus className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            )}
          </Tabs>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteGroupOpen} onOpenChange={setDeleteGroupOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Group</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{conversation.name}"? This will remove all messages and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteGroup}
              disabled={actionLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionLoading ? "Deleting..." : "Delete Group"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default GroupManagementDialog;