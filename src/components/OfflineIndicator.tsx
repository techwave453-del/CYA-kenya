import { useOffline } from "@/contexts/OfflineContext";
import { Wifi, WifiOff, RefreshCw, Cloud, CloudOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";

const OfflineIndicator = () => {
  const { isOnline, pendingSyncCount, triggerSync } = useOffline();
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    if (!isOnline) {
      toast.error("Cannot sync while offline");
      return;
    }
    
    setIsSyncing(true);
    try {
      await triggerSync();
      toast.success("Sync complete!");
    } catch (error) {
      toast.error("Sync failed");
    } finally {
      setIsSyncing(false);
    }
  };

  if (isOnline && pendingSyncCount === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-20 left-4 z-50 flex items-center gap-2">
      <Badge 
        variant={isOnline ? "secondary" : "destructive"} 
        className="flex items-center gap-1.5 px-3 py-1.5 shadow-lg"
      >
        {isOnline ? (
          <>
            <Cloud className="h-3.5 w-3.5" />
            <span className="text-xs">
              {pendingSyncCount > 0 ? `${pendingSyncCount} pending` : "Online"}
            </span>
          </>
        ) : (
          <>
            <CloudOff className="h-3.5 w-3.5" />
            <span className="text-xs">Offline</span>
          </>
        )}
      </Badge>

      {isOnline && pendingSyncCount > 0 && (
        <Button 
          size="sm" 
          variant="secondary"
          onClick={handleSync}
          disabled={isSyncing}
          className="h-7 px-2 shadow-lg"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
        </Button>
      )}
    </div>
  );
};

export default OfflineIndicator;
