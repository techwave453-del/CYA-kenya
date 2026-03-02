import { BookOpen, User, PenTool, Brain, Lock, Calendar, Users, ScrollText, Landmark, Route, ShieldCheck, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type GameType =
  | 'trivia'
  | 'guess_character'
  | 'fill_blank'
  | 'memory_verse'
  | 'choose_path'
  | 'journey_jerusalem'
  | 'character_missions'
  | 'old_testament'
  | 'new_testament'
  | 'daily_challenge'
  | 'multiplayer';

interface Game {
  id: GameType;
  title: string;
  description: string;
  icon: React.ReactNode;
  available: boolean;
  requiresMigration?: boolean;
  color: string;
  featured?: boolean;
}

const games: Game[] = [
  {
    id: 'multiplayer',
    title: 'Local Multiplayer',
    description: 'Play with friends on the same WiFi network!',
    icon: <Users className="w-8 h-8" />,
    available: true,
    color: 'from-green-500/20 to-green-600/10',
    featured: true
  },
  {
    id: 'daily_challenge',
    title: 'Daily Challenge',
    description: 'One question from each game - new daily!',
    icon: <Calendar className="w-8 h-8" />,
    available: true,
    color: 'from-amber-500/20 to-amber-600/10'
  },
  {
    id: 'trivia',
    title: 'Bible Trivia',
    description: 'Test your Bible knowledge with fun questions!',
    icon: <BookOpen className="w-8 h-8" />,
    available: true,
    color: 'from-blue-500/20 to-blue-600/10'
  },
  {
    id: 'guess_character',
    title: 'Guess the Character',
    description: 'Identify biblical figures from clues',
    icon: <User className="w-8 h-8" />,
    available: true,
    color: 'from-purple-500/20 to-purple-600/10'
  },
  {
    id: 'fill_blank',
    title: 'Fill in the Blank',
    description: 'Complete famous Bible verses',
    icon: <PenTool className="w-8 h-8" />,
    available: true,
    color: 'from-emerald-500/20 to-emerald-600/10'
  },
  {
    id: 'memory_verse',
    title: 'Memory Verses',
    description: 'Practice and recall key Scripture',
    icon: <Brain className="w-8 h-8" />,
    available: true,
    color: 'from-pink-500/20 to-pink-600/10'
  },
  {
    id: 'choose_path',
    title: 'Choose Your Path',
    description: 'Story decisions through key biblical moments',
    icon: <Route className="w-8 h-8" />,
    available: true,
    requiresMigration: true,
    color: 'from-indigo-500/20 to-indigo-600/10'
  },
  {
    id: 'journey_jerusalem',
    title: 'Journey to Jerusalem',
    description: 'Advance by solving faith and character challenges',
    icon: <MapPin className="w-8 h-8" />,
    available: true,
    requiresMigration: true,
    color: 'from-rose-500/20 to-rose-600/10'
  },
  {
    id: 'character_missions',
    title: 'Character Missions',
    description: 'Complete level-based missions with Bible figures',
    icon: <ShieldCheck className="w-8 h-8" />,
    available: true,
    requiresMigration: true,
    color: 'from-teal-500/20 to-teal-600/10'
  },
  {
    id: 'old_testament',
    title: 'Old Testament Challenge',
    description: 'Questions focused on the Old Testament',
    icon: <ScrollText className="w-8 h-8" />,
    available: true,
    requiresMigration: true,
    color: 'from-orange-500/20 to-orange-600/10'
  },
  {
    id: 'new_testament',
    title: 'New Testament Challenge',
    description: 'Questions focused on the New Testament',
    icon: <Landmark className="w-8 h-8" />,
    available: true,
    requiresMigration: true,
    color: 'from-cyan-500/20 to-cyan-600/10'
  }
];

interface GameSelectorProps {
  onSelectGame: (gameType: GameType) => void;
  selectedGame: GameType | null;
  storyModesUnlocked: boolean;
}

const GameSelector = ({ onSelectGame, selectedGame, storyModesUnlocked }: GameSelectorProps) => {
  return (
    <div className="grid grid-cols-2 gap-3">
      {games.map((game) => {
        const unlockedByMigration = !game.requiresMigration || storyModesUnlocked;
        const isAvailable = game.available && unlockedByMigration;

        return (
          <Card
            key={game.id}
            onClick={() => isAvailable && onSelectGame(game.id)}
            className={cn(
              "relative overflow-hidden transition-all duration-300 cursor-pointer border-2",
              isAvailable
              ? "hover:scale-[1.02] hover:shadow-lg" 
              : "opacity-60 cursor-not-allowed",
              selectedGame === game.id 
              ? "border-primary shadow-lg" 
              : game.featured 
                ? "border-amber-500/50 hover:border-amber-500"
                : "border-border hover:border-primary/50",
              game.featured && "col-span-2"
            )}
          >
            <div className={cn(
              "absolute inset-0 bg-gradient-to-br opacity-50",
              game.color
            )} />
            <CardContent className={cn(
              "relative p-4 flex flex-col items-center text-center",
              game.featured && "flex-row gap-4 text-left"
            )}>
              <div className={cn(
                "mb-2 p-2 rounded-full",
                game.featured && "mb-0",
                selectedGame === game.id ? "text-primary" : game.featured ? "text-amber-500" : "text-muted-foreground"
              )}>
                {game.icon}
              </div>
              <div className={game.featured ? "flex-1" : ""}>
                <h3 className={cn("font-semibold mb-1", game.featured ? "text-base" : "text-sm")}>
                  {game.title}
                  {game.featured && <span className="ml-2 text-xs bg-amber-500/20 text-amber-500 px-2 py-0.5 rounded-full">Featured</span>}
                </h3>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {game.description}
                </p>
                {game.requiresMigration && !storyModesUnlocked && (
                  <p className="text-[11px] text-muted-foreground mt-1">Unlock after DB migration</p>
                )}
              </div>
              {!isAvailable && (
                <div className="absolute top-2 right-2">
                  <Lock className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default GameSelector;
