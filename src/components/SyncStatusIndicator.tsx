import { useSyncStatus } from '@/contexts/SyncStatusContext';
import { WifiOff, Upload, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { syncWithServer } from '@/lib/syncManager';
import { useState } from 'react';

interface SyncStatusIndicatorProps {
  className?: string;
  showDetails?: boolean;
}

export const SyncStatusIndicator = ({ className, showDetails = true }: SyncStatusIndicatorProps) => {
  const { status, clearSyncError, refreshStatus } = useSyncStatus();
  const [isManualSyncing, setIsManualSyncing] = useState(false);

  const handleManualSync = async () => {
    setIsManualSyncing(true);
    try {
      await syncWithServer();
      await refreshStatus();
    } catch (error) {
      console.error('Manual sync failed:', error);
    } finally {
      setIsManualSyncing(false);
    }
  };

  if (status.isOnline && status.totalItemsQueued === 0 && !status.lastSyncError) {
    return null; // Nothing to show when everything is good
  }

  return (
    <div className={cn('flex items-center gap-2 px-3 py-2 rounded-lg', className)}>
      {/* Offline indicator */}
      {!status.isOnline && (
        <div className="flex items-center gap-2 bg-warning/10 border border-warning/30 px-3 py-2 rounded-lg">
          <WifiOff className="w-4 h-4 text-warning animate-pulse" />
          <span className="text-xs font-medium text-warning">Offline</span>
          {showDetails && status.totalItemsQueued > 0 && (
            <span className="text-xs text-warning/70 ml-1">({status.totalItemsQueued} queued)</span>
          )}
        </div>
      )}

      {/* Sync in progress */}
      {status.isSyncing && (
        <div className="flex items-center gap-2 bg-info/10 border border-info/30 px-3 py-2 rounded-lg">
          <Upload className="w-4 h-4 text-info animate-spin" />
          <span className="text-xs font-medium text-info">Syncing...</span>
        </div>
      )}

      {/* Items queued */}
      {status.isOnline && status.totalItemsQueued > 0 && (
        <div className="flex items-center gap-2 bg-primary/10 border border-primary/30 px-3 py-2 rounded-lg">
          <Upload className="w-4 h-4 text-primary" />
          <span className="text-xs font-medium text-primary">{status.totalItemsQueued} queued</span>
          <Button
            size="sm"
            variant="ghost"
            className="h-5 px-2 text-xs ml-1"
            onClick={handleManualSync}
            disabled={isManualSyncing}
          >
            {isManualSyncing ? 'Syncing...' : 'Sync now'}
          </Button>
        </div>
      )}

      {/* Sync error */}
      {status.lastSyncError && (
        <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 px-3 py-2 rounded-lg">
          <AlertCircle className="w-4 h-4 text-destructive" />
          <span className="text-xs font-medium text-destructive">{status.lastSyncError}</span>
          <Button
            size="sm"
            variant="ghost"
            className="h-5 px-2 text-xs ml-1"
            onClick={clearSyncError}
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Last sync time */}
      {status.isOnline && status.lastSyncTime && status.totalItemsQueued === 0 && !status.lastSyncError && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CheckCircle className="w-4 h-4 text-success" />
          <span>Synced {formatTime(status.lastSyncTime)}</span>
        </div>
      )}
    </div>
  );
};

// Compact version for headers (safe with error boundary)
const SyncStatusBadgeContent = () => {
  const { status } = useSyncStatus();

  if (status.isOnline && status.totalItemsQueued === 0 && !status.lastSyncError) {
    return null;
  }

  return (
    <div className="flex items-center gap-1">
      {!status.isOnline && (
        <div className="w-2 h-2 rounded-full bg-warning animate-pulse" title="Offline" />
      )}
      {status.isSyncing && (
        <div className="w-2 h-2 rounded-full bg-info animate-spin" title="Syncing" />
      )}
      {status.totalItemsQueued > 0 && (
        <span className="text-xs font-semibold bg-primary/20 text-primary px-1.5 py-0.5 rounded">
          {status.totalItemsQueued}
        </span>
      )}
      {status.lastSyncError && (
        <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" title={status.lastSyncError} />
      )}
    </div>
  );
};

// Wrapper with error handling for safe usage outside provider
export const SyncStatusBadge = () => {
  try {
    return <SyncStatusBadgeContent />;
  } catch (error) {
    // Gracefully return null if context is not available
    if (error instanceof Error && error.message.includes('SyncStatusProvider')) {
      return null;
    }
    throw error;
  }
};

// Helper to format relative time
function formatTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return new Date(timestamp).toLocaleDateString();
}
