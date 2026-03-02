import { useState } from 'react';
import { Plus, Users, Swords, HandHeart, BookOpen, User, Gamepad2, PenTool, Brain, Calendar } from 'lucide-react';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { GameMode } from '@/lib/localNetwork';
import { cn } from '@/lib/utils';

interface CreateRoomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (
    gameType: 'trivia' | 'guess_character' | 'fill_blank' | 'memory_verse' | 'daily_challenge' | 'all',
    gameMode: GameMode,
    gameName: string,
    maxPlayers: number
  ) => string | null;
}

const CreateRoomDialog = ({ open, onOpenChange, onCreate }: CreateRoomDialogProps) => {
  const [gameName, setGameName] = useState('');
  const [gameType, setGameType] = useState<'trivia' | 'guess_character' | 'fill_blank' | 'memory_verse' | 'daily_challenge' | 'all'>('all');
  const [gameMode, setGameMode] = useState<GameMode>('competitive');
  const [maxPlayers, setMaxPlayers] = useState(4);

  const handleCreate = () => {
    const name = gameName.trim() || 'Bible Games';
    const roomCode = onCreate(gameType, gameMode, name, maxPlayers);
    if (roomCode) {
      onOpenChange(false);
      setGameName('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" />
            Create Game Room
          </DialogTitle>
          <DialogDescription>
            Set up a local multiplayer game for friends nearby
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Room Name */}
          <div className="space-y-2">
            <Label htmlFor="gameName">Room Name (optional)</Label>
            <Input
              id="gameName"
              value={gameName}
              onChange={(e) => setGameName(e.target.value)}
              placeholder="Bible Games with Friends"
            />
          </div>

          {/* Game Type */}
          <div className="space-y-3">
            <Label>Game Type</Label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'all', label: 'All Games', icon: Gamepad2 },
                { id: 'trivia', label: 'Trivia', icon: BookOpen },
                { id: 'guess_character', label: 'Characters', icon: User },
                { id: 'fill_blank', label: 'Fill Blank', icon: PenTool },
                { id: 'memory_verse', label: 'Memory Verses', icon: Brain },
                { id: 'daily_challenge', label: 'Daily', icon: Calendar }
              ].map((type) => (
                <button
                  key={type.id}
                  onClick={() => setGameType(type.id as any)}
                  className={cn(
                    "flex flex-col items-center p-3 rounded-lg border-2 transition-all",
                    gameType === type.id
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <type.icon className={cn(
                    "w-5 h-5 mb-1",
                    gameType === type.id ? "text-primary" : "text-muted-foreground"
                  )} />
                  <span className="text-xs font-medium">{type.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Game Mode */}
          <div className="space-y-3">
            <Label>Game Mode</Label>
            <RadioGroup value={gameMode} onValueChange={(v) => setGameMode(v as GameMode)}>
              <div className="grid grid-cols-2 gap-2">
                <label
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all",
                    gameMode === 'competitive'
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <RadioGroupItem value="competitive" className="sr-only" />
                  <Swords className={cn(
                    "w-5 h-5",
                    gameMode === 'competitive' ? "text-primary" : "text-muted-foreground"
                  )} />
                  <div>
                    <p className="font-medium text-sm">Competitive</p>
                    <p className="text-xs text-muted-foreground">Race to answer first</p>
                  </div>
                </label>
                <label
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all",
                    gameMode === 'cooperative'
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <RadioGroupItem value="cooperative" className="sr-only" />
                  <HandHeart className={cn(
                    "w-5 h-5",
                    gameMode === 'cooperative' ? "text-primary" : "text-muted-foreground"
                  )} />
                  <div>
                    <p className="font-medium text-sm">Cooperative</p>
                    <p className="text-xs text-muted-foreground">Work as a team</p>
                  </div>
                </label>
              </div>
            </RadioGroup>
          </div>

          {/* Max Players */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Max Players</Label>
              <span className="text-sm font-medium text-primary">{maxPlayers}</span>
            </div>
            <Slider
              value={[maxPlayers]}
              onValueChange={(v) => setMaxPlayers(v[0])}
              min={2}
              max={8}
              step={1}
              className="py-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>2</span>
              <span>8</span>
            </div>
          </div>

          <Button onClick={handleCreate} className="w-full gap-2">
            <Users className="w-4 h-4" />
            Create Room
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateRoomDialog;
