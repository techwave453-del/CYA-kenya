import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X, Church, AlertCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface ProfileCompletionBannerProps {
  userId: string;
  onComplete?: () => void;
}

const ProfileCompletionBanner = ({ userId, onComplete }: ProfileCompletionBannerProps) => {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkProfileCompletion = async () => {
      // Check if user has dismissed this session
      const dismissedKey = `profile_banner_dismissed_${userId}`;
      if (sessionStorage.getItem(dismissedKey)) {
        setShow(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("local_church")
          .eq("user_id", userId)
          .single();

        if (error) throw error;

        // Show banner if church is not set
        if (!data?.local_church) {
          setShow(true);
        } else {
          setShow(false);
          onComplete?.();
        }
      } catch (error) {
        console.error("Error checking profile:", error);
      }
    };

    checkProfileCompletion();

    // Subscribe to profile changes
    const channel = supabase
      .channel(`profile-completion-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newData = payload.new as { local_church?: string };
          if (newData.local_church) {
            setShow(false);
            onComplete?.();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, onComplete]);

  const handleDismiss = () => {
    const dismissedKey = `profile_banner_dismissed_${userId}`;
    sessionStorage.setItem(dismissedKey, "true");
    setDismissed(true);
    setTimeout(() => setShow(false), 300);
  };

  const handleCompleteProfile = () => {
    navigate(`/profile/${userId}`);
  };

  if (!show) return null;

  return (
    <div
      className={`bg-gradient-to-r from-primary/10 via-primary/5 to-secondary/10 border-b border-primary/20 transition-all duration-300 ${
        dismissed ? "opacity-0 -translate-y-full" : "opacity-100 translate-y-0"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex-shrink-0 p-2 bg-primary/20 rounded-full">
              <Church className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">
                Complete your profile!
              </p>
              <p className="text-xs text-muted-foreground truncate">
                Add your local church to connect with other members
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              size="sm"
              onClick={handleCompleteProfile}
              className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1"
            >
              Complete
              <ArrowRight className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDismiss}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileCompletionBanner;