import { useState, useEffect } from "react";
import { ArrowLeft, Gamepad2, WifiOff, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import GameSelector from "@/components/games/GameSelector";
import BibleTrivia from "@/components/games/BibleTrivia";
import GuessCharacter from "@/components/games/GuessCharacter";
import DailyChallenge from "@/components/games/DailyChallenge";
import FillInTheBlank from "@/components/games/FillInTheBlank";
import MemoryVerse from "@/components/games/MemoryVerse";
import TestamentChallenge from "@/components/games/TestamentChallenge";
import ChooseYourPath from "@/components/games/ChooseYourPath";
import JourneyToJerusalem from "@/components/games/JourneyToJerusalem";
import CharacterMissions from "@/components/games/CharacterMissions";
import FloatingLeaderboard from "@/components/games/FloatingLeaderboard";
import MultiplayerMode from "@/components/games/multiplayer/MultiplayerMode";
import { useOffline } from "@/contexts/OfflineContext";
import { useNewQuestionsCount } from "@/hooks/useNewQuestionsCount";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

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

const GamesPage = () => {
  const [selectedGame, setSelectedGame] = useState<GameType | null>(null);
  const [storyModesUnlocked, setStoryModesUnlocked] = useState(false);
  const { isOnline } = useOffline();
  const navigate = useNavigate();
  const { markAsSeen } = useNewQuestionsCount();
  const migrationLockedGames: GameType[] = [
    "choose_path",
    "journey_jerusalem",
    "character_missions",
    "old_testament",
    "new_testament",
  ];

  // Mark questions as seen when visiting the games page
  useEffect(() => {
    markAsSeen();
  }, [markAsSeen]);

  useEffect(() => {
    let active = true;
    const checkCapabilities = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("get-game-capabilities");
        if (error) {
          console.warn("[Games] Capability check failed:", error.message);
          return;
        }

        if (active && data?.story_games_unlocked) {
          setStoryModesUnlocked(true);
        }
      } catch (error) {
        console.warn("[Games] Capability check error:", error);
      }
    };

    void checkCapabilities();
    return () => {
      active = false;
    };
  }, []);

  const handleSelectGame = (gameType: GameType) => {
    if (!storyModesUnlocked && migrationLockedGames.includes(gameType)) {
      toast({
        title: "Game locked",
        description: "This game unlocks after database migrations are applied.",
        variant: "destructive",
      });
      return;
    }
    setSelectedGame(gameType);
  };

  const handleBack = () => {
    if (selectedGame) {
      setSelectedGame(null);
    } else {
      navigate('/');
    }
  };

  const renderGame = () => {
    switch (selectedGame) {
      case 'trivia':
        return <BibleTrivia onGameEnd={() => {}} />;
      case 'guess_character':
        return <GuessCharacter onGameEnd={() => {}} />;
      case 'daily_challenge':
        return <DailyChallenge onGameEnd={() => {}} />;
      case 'fill_blank':
        return <FillInTheBlank onGameEnd={() => {}} />;
      case 'memory_verse':
        return <MemoryVerse onGameEnd={() => {}} />;
      case 'choose_path':
        return <ChooseYourPath />;
      case 'journey_jerusalem':
        return <JourneyToJerusalem />;
      case 'character_missions':
        return <CharacterMissions />;
      case 'old_testament':
        return (
          <TestamentChallenge
            testament="old"
            scoreKey="old_testament"
            title="Old Testament Challenge"
            emptyMessage="No Old Testament questions are available yet."
          />
        );
      case 'new_testament':
        return (
          <TestamentChallenge
            testament="new"
            scoreKey="new_testament"
            title="New Testament Challenge"
            emptyMessage="No New Testament questions are available yet."
          />
        );
      case 'multiplayer':
        return <MultiplayerMode onBack={() => setSelectedGame(null)} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Section */}
      <div className="relative h-32 bg-gradient-to-br from-primary/20 via-primary/10 to-background overflow-hidden">
        <div className="absolute inset-0">
          {[...Array(15)].map((_, i) => (
            <div
              key={i}
              className="absolute text-2xl opacity-20 animate-pulse"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
              }}
            >
              {['📖', '✝️', '🕊️', '⭐', '🎮'][i % 5]}
            </div>
          ))}
        </div>
        <div className="relative z-10 flex flex-col items-center justify-center h-full text-center px-4">
          <Gamepad2 className="w-10 h-10 text-primary mb-2" />
          <h1 className="text-2xl font-bold">Bible Games</h1>
          <p className="text-sm text-muted-foreground">Learn Scripture through fun!</p>
        </div>
      </div>

      {/* Offline indicator */}
      {!isOnline && (
        <div className="mx-4 mt-4 flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <WifiOff className="w-4 h-4 text-yellow-500" />
          <span className="text-sm text-yellow-500">
            Playing offline • Scores sync when online
          </span>
        </div>
      )}

      <main className="px-4 py-4 pb-32">
        {/* Back button when in a game */}
        {selectedGame && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="mb-4 gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Games
          </Button>
        )}

        {/* Game selector or active game */}
        {!selectedGame ? (
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🎮</span>
              <h2 className="font-heading text-lg font-semibold">Choose a Game</h2>
            </div>
            <GameSelector
              onSelectGame={handleSelectGame}
              selectedGame={selectedGame}
              storyModesUnlocked={storyModesUnlocked}
            />
            
            {/* Coming soon message */}
            <div className="mt-8 p-4 bg-card border border-border rounded-xl text-center">
              <p className="text-muted-foreground text-sm">
                More games coming soon! 🚀
              </p>
            </div>
          </div>
        ) : (
          renderGame()
        )}
      </main>

      {/* Floating Leaderboard - hide when in local multiplayer (MultiplayerMode renders its own session leaderboard) */}
      {selectedGame !== 'multiplayer' && (
        <FloatingLeaderboard gameType={selectedGame || undefined} />
      )}
    </div>
  );
};

export default GamesPage;
