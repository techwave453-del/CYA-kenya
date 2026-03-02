import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { User, Church } from "lucide-react";

interface OnlineUser {
  user_id: string;
  username: string;
  avatar_url: string | null;
  local_church: string | null;
}

interface OnlineUsersRibbonProps {
  onlineUserIds: string[];
  currentUserId: string;
}

const OnlineUsersRibbon = ({ onlineUserIds, currentUserId }: OnlineUsersRibbonProps) => {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchOnlineUsersProfiles = async () => {
      if (onlineUserIds.length === 0) {
        setOnlineUsers([]);
        return;
      }

      // Filter out current user
      const otherUserIds = onlineUserIds.filter(id => id !== currentUserId);
      
      if (otherUserIds.length === 0) {
        setOnlineUsers([]);
        return;
      }

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("user_id, username, avatar_url, local_church")
          .in("user_id", otherUserIds);

        if (error) throw error;
        setOnlineUsers(data || []);
      } catch (error) {
        console.error("Error fetching online users:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchOnlineUsersProfiles();
  }, [onlineUserIds, currentUserId]);

  if (onlineUsers.length === 0 && !loading) {
    return null;
  }

  return (
    <div className="border-b border-border bg-muted/30">
      <div className="px-4 py-2">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-xs font-medium text-muted-foreground">
            Online Now ({onlineUsers.length})
          </span>
        </div>
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-3 pb-2">
            {onlineUsers.map((user) => (
              <button
                key={user.user_id}
                onClick={() => navigate(`/profile/${user.user_id}`)}
                className="flex flex-col items-center gap-1 min-w-[72px] p-2 rounded-lg hover:bg-muted transition-colors group"
              >
                <div className="relative">
                  <Avatar className="h-12 w-12 ring-2 ring-green-500 ring-offset-2 ring-offset-background">
                    <AvatarImage src={user.avatar_url || undefined} />
                    <AvatarFallback className="bg-secondary text-sm">
                      {user.username?.charAt(0).toUpperCase() || <User className="h-5 w-5" />}
                    </AvatarFallback>
                  </Avatar>
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-background rounded-full" />
                </div>
                <span className="text-xs font-medium text-foreground truncate max-w-[68px] group-hover:text-primary transition-colors">
                  {user.username}
                </span>
                {user.local_church ? (
                  <span className="text-[10px] text-muted-foreground truncate max-w-[68px] flex items-center gap-0.5">
                    <Church className="h-2.5 w-2.5" />
                    {user.local_church}
                  </span>
                ) : (
                  <span className="text-[10px] text-muted-foreground/50 italic">
                    No church
                  </span>
                )}
              </button>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
    </div>
  );
};

export default OnlineUsersRibbon;