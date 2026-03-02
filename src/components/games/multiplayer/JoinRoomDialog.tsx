import { useState } from 'react';
import { Gamepad2, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface JoinRoomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJoin: (roomCode: string, passcode: string) => Promise<boolean>;
}

const JoinRoomDialog = ({ open, onOpenChange, onJoin }: JoinRoomDialogProps) => {
  const [roomCode, setRoomCode] = useState('');
  const [passcode, setPasscode] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const handleJoin = async () => {
    if (!roomCode.trim() || roomCode.length < 6 || !passcode.trim() || passcode.length !== 4) return;
    
    setIsJoining(true);
    const success = await onJoin(roomCode.toUpperCase(), passcode);
    setIsJoining(false);
    
    if (success) {
      onOpenChange(false);
      setRoomCode('');
      setPasscode('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gamepad2 className="w-5 h-5 text-primary" />
            Join Game Room
          </DialogTitle>
          <DialogDescription>
            Enter the room code and passcode shared by the host
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="roomCode">Room Code</Label>
            <Input
              id="roomCode"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase().slice(0, 6))}
              placeholder="ABC123"
              className="text-center text-2xl font-mono tracking-widest"
              maxLength={6}
              disabled={isJoining}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="passcode">Passcode</Label>
            <Input
              id="passcode"
              type="text"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="0000"
              className="text-center text-2xl font-mono tracking-widest"
              maxLength={4}
              disabled={isJoining}
            />
          </div>

          <Button
            onClick={handleJoin}
            disabled={roomCode.length < 6 || passcode.length !== 4 || isJoining}
            className="w-full gap-2"
          >
            {isJoining ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Gamepad2 className="w-4 h-4" />
                Join Game
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default JoinRoomDialog;
