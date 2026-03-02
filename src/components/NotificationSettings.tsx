import { useState } from "react";
import { Bell, BellOff, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useToast } from "@/hooks/use-toast";

interface NotificationSettingsProps {
  userId: string | undefined;
}

export const NotificationSettings = ({ userId }: NotificationSettingsProps) => {
  const { isSupported, isSubscribed, isLoading, subscribe, unsubscribe } = usePushNotifications(userId);
  const [isTesting, setIsTesting] = useState(false);
  const { toast } = useToast();

  const sendTestNotification = async () => {
    if (!isSubscribed) {
      toast({
        title: "Enable Notifications First",
        description: "Please enable notifications before testing.",
        variant: "destructive",
      });
      return;
    }

    setIsTesting(true);
    try {
      // Show a local notification to test
      const registration = await navigator.serviceWorker.ready;
      
      await registration.showNotification("🔔 Test Notification", {
        body: "Notifications are working! You'll receive messages here.",
        icon: "/pwa-192x192.png",
        badge: "/pwa-192x192.png",
        tag: "test-notification",
        requireInteraction: false,
        data: { url: "/" },
      } as NotificationOptions);

      toast({
        title: "Test Sent!",
        description: "Check your notification bar/tray.",
      });
    } catch (error) {
      console.error("Error sending test notification:", error);
      toast({
        title: "Test Failed",
        description: "Could not send test notification. Check browser permissions.",
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  };

  if (!isSupported) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <BellOff className="h-4 w-4" />
        <span>Push notifications not supported</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant={isSubscribed ? "outline" : "default"}
        size="sm"
        onClick={isSubscribed ? unsubscribe : subscribe}
        disabled={isLoading || !userId}
        className="gap-2"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isSubscribed ? (
          <BellOff className="h-4 w-4" />
        ) : (
          <Bell className="h-4 w-4" />
        )}
        {isSubscribed ? "Disable" : "Enable"}
      </Button>
      
      {isSubscribed && (
        <Button
          variant="ghost"
          size="sm"
          onClick={sendTestNotification}
          disabled={isTesting}
          className="gap-1"
          title="Send test notification"
        >
          {isTesting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Test
        </Button>
      )}
    </div>
  );
};
