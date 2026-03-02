import { Menu, LogIn, LogOut, User, MessageCircle, Bell, Shield, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useMessageNotifications } from "@/hooks/useMessageNotifications";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { SyncStatusBadge } from "@/components/SyncStatusIndicator";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const Header = () => {
  const { isAuthenticated, user, profile, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const { unreadCount, clearUnread } = useMessageNotifications(user?.id);
  const { isSupported, isSubscribed, isLoading, subscribe, unsubscribe } = usePushNotifications(user?.id);
  const navigate = useNavigate();
  const location = useLocation();
  
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  // Check if app is installed and listen for install prompt
  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  // Clear unread count when on chat page
  useEffect(() => {
    if (location.pathname === "/chat") {
      clearUnread();
    }
  }, [location.pathname, clearUnread]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      // Fallback to install page for iOS or when prompt isn't available
      navigate("/install");
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="relative flex items-center justify-center w-8 h-8">
            <span className="text-primary text-3xl font-bold leading-none">✚</span>
          </div>
          <span className="font-heading text-xl font-bold text-foreground">CYA</span>
        </Link>
        
        <div className="flex items-center gap-2">
          {isAuthenticated && user ? (
            <>
              <div className="flex items-center gap-1">
                <Link to="/chat" onClick={clearUnread}>
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground relative">
                    <MessageCircle className="h-5 w-5" />
                    {unreadCount > 0 && (
                      <Badge 
                        variant="destructive" 
                        className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                      >
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </Badge>
                    )}
                  </Button>
                </Link>
                <SyncStatusBadge />
              </div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={profile.username}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <User className="h-5 w-5" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-card border-border w-48">
                  <DropdownMenuItem className="text-foreground font-medium">
                    {profile?.username || "User"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-border" />
                  <DropdownMenuItem 
                    onClick={() => navigate(`/profile/${user.id}`)}
                    className="cursor-pointer"
                  >
                    <User className="w-4 h-4 mr-2" />
                    View Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => navigate("/chat")}
                    className="cursor-pointer"
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Messages
                  </DropdownMenuItem>
                  {isSupported && (
                    <DropdownMenuItem 
                      onClick={isSubscribed ? unsubscribe : subscribe}
                      disabled={isLoading}
                      className="cursor-pointer"
                    >
                      <Bell className="w-4 h-4 mr-2" />
                      {isSubscribed ? "Disable Notifications" : "Enable Notifications"}
                    </DropdownMenuItem>
                  )}
                  {isAdmin && (
                    <DropdownMenuItem 
                      onClick={() => navigate("/admin")}
                      className="cursor-pointer text-primary"
                    >
                      <Shield className="w-4 h-4 mr-2" />
                      Admin Panel
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator className="bg-border" />
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive cursor-pointer">
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Link to="/auth">
              <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/10">
                <LogIn className="w-4 h-4 mr-2" />
                Sign In
              </Button>
            </Link>
          )}
          
          {!isInstalled && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-muted-foreground hover:text-foreground"
              onClick={handleInstallClick}
              title="Install App"
            >
              <Download className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
      
      {/* Decorative star background */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-2 left-1/4 w-0.5 h-0.5 bg-foreground/30 rounded-full" />
        <div className="absolute top-4 left-1/2 w-0.5 h-0.5 bg-foreground/20 rounded-full" />
        <div className="absolute top-3 right-1/4 w-0.5 h-0.5 bg-foreground/25 rounded-full" />
        <div className="absolute top-1 right-1/3 w-0.5 h-0.5 bg-foreground/15 rounded-full" />
      </div>
    </header>
  );
};

export default Header;
