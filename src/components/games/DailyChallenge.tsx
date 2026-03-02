import { useState, useEffect, useCallback } from "react";
import { CheckCircle, XCircle, Loader2, Calendar, Eye, Lightbulb, RotateCcw, Trophy, Zap, User, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useBibleGames, BibleGame } from "@/hooks/useBibleGames";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface DailyChallengeProps {
  onGameEnd?: (score: number, streak: number) => void;
}

// Get a consistent daily seed based on date
const getDailySeed = () => {
  const today = new Date();
  return `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
};

// Seeded random for consistent daily selection
const seededRandom = (seed: string, index: number) => {
  const hash = seed.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  return Math.abs(Math.sin(hash + index)) % 1;
};

const DailyChallenge = ({ onGameEnd }: DailyChallengeProps) => {
  const { games, loading, isOnline, syncScore, getLocalProgress, saveLocalProgress } = useBibleGames();
  
  const [challengeGames, setChallengeGames] = useState<BibleGame[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [highestStreak, setHighestStreak] = useState(0);
  const [gameEnded, setGameEnded] = useState(false);
  const [revealedClues, setRevealedClues] = useState(1);
  const [showHint, setShowHint] = useState(false);
  const [hasPlayedToday, setHasPlayedToday] = useState(false);
  const [todayScore, setTodayScore] = useState<number | null>(null);

  // Check if already played today
  useEffect(() => {
    const lastPlayed = localStorage.getItem('daily_challenge_date');
    const savedScore = localStorage.getItem('daily_challenge_score');
    const today = getDailySeed();
    
    if (lastPlayed === today && savedScore) {
      setHasPlayedToday(true);
      setTodayScore(parseInt(savedScore, 10));
    }
  }, []);

  // Select one question from each game type using daily seed
  useEffect(() => {
    if (games.length > 0 && !hasPlayedToday) {
      const seed = getDailySeed();
      const gameTypes = ['trivia', 'guess_character'];
      const selected: BibleGame[] = [];
      
      gameTypes.forEach((type, typeIndex) => {
        const typeGames = games.filter(g => g.game_type === type);
        if (typeGames.length > 0) {
          const randomIndex = Math.floor(seededRandom(seed, typeIndex) * typeGames.length);
          selected.push(typeGames[randomIndex]);
        }
      });
      
      setChallengeGames(selected);
    }
  }, [games, hasPlayedToday]);

  // Load local progress
  useEffect(() => {
    const loadProgress = async () => {
      const progress = await getLocalProgress('daily_challenge');
      if (progress) {
        setHighestStreak(progress.highest_streak);
      }
    };
    loadProgress();
  }, [getLocalProgress]);

  const currentGame = challengeGames[currentIndex];
  const progress = challengeGames.length > 0 ? ((currentIndex + 1) / challengeGames.length) * 100 : 0;

  // Parse clues for guess_character type
  const parseClues = (question: string): string[] => {
    return question.split('\n').filter(line => line.trim().startsWith('Clue'));
  };

  const isGuessCharacter = currentGame?.game_type === 'guess_character';
  const clues = currentGame && isGuessCharacter ? parseClues(currentGame.question) : [];
  const totalClues = clues.length;

  // Calculate points based on game type and clues revealed
  const calculatePoints = () => {
    if (!currentGame) return 0;
    const basePoints = currentGame.points;
    if (isGuessCharacter && totalClues > 0) {
      const multiplier = Math.max(1, totalClues - revealedClues + 1);
      return basePoints * multiplier;
    }
    return basePoints;
  };

  const handleRevealClue = () => {
    if (revealedClues < totalClues) {
      setRevealedClues(prev => prev + 1);
    }
  };

  const handleSelectAnswer = (answer: string) => {
    if (isAnswered) return;
    
    setSelectedAnswer(answer);
    setIsAnswered(true);
    
    const isCorrect = answer === currentGame.correct_answer;
    const earnedPoints = calculatePoints();
    
    if (isCorrect) {
      setScore(prev => prev + earnedPoints);
      setStreak(prev => {
        const newStreak = prev + 1;
        if (newStreak > highestStreak) {
          setHighestStreak(newStreak);
        }
        return newStreak;
      });
      toast({
        title: "🎉 Correct!",
        description: `+${earnedPoints} points`,
      });
    } else {
      setStreak(0);
      toast({
        title: "❌ Incorrect",
        description: `The answer was: ${currentGame.correct_answer}`,
        variant: "destructive",
      });
    }
  };

  const handleNext = useCallback(async () => {
    if (currentIndex >= challengeGames.length - 1) {
      setGameEnded(true);
      
      // Save that we played today
      localStorage.setItem('daily_challenge_date', getDailySeed());
      localStorage.setItem('daily_challenge_score', score.toString());
      
      // Save progress locally
      await saveLocalProgress({
        id: 'daily_challenge',
        game_type: 'daily_challenge',
        score,
        games_played: 1,
        highest_streak: highestStreak,
        current_streak: streak
      });
      
      // Sync to server if online
      await syncScore('daily_challenge', score, highestStreak);
      
      onGameEnd?.(score, highestStreak);
    } else {
      setCurrentIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setIsAnswered(false);
      setRevealedClues(1);
      setShowHint(false);
    }
  }, [currentIndex, challengeGames.length, score, highestStreak, streak, syncScore, saveLocalProgress, onGameEnd]);

  const getGameTypeIcon = (type: string) => {
    switch (type) {
      case 'trivia':
        return <BookOpen className="w-4 h-4" />;
      case 'guess_character':
        return <User className="w-4 h-4" />;
      default:
        return <Zap className="w-4 h-4" />;
    }
  };

  const getGameTypeName = (type: string) => {
    switch (type) {
      case 'trivia':
        return 'Bible Trivia';
      case 'guess_character':
        return 'Guess the Character';
      default:
        return 'Challenge';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Already played today
  if (hasPlayedToday) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Calendar className="w-16 h-16 text-primary mb-4" />
          <h2 className="text-2xl font-bold mb-2">Challenge Complete!</h2>
          <p className="text-muted-foreground mb-4">
            You've already completed today's challenge
          </p>
          {todayScore !== null && (
            <p className="text-xl mb-6">
              Today's Score: <span className="font-bold text-primary">{todayScore}</span> points
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            Come back tomorrow for a new challenge! 🌅
          </p>
        </CardContent>
      </Card>
    );
  }

  if (challengeGames.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Calendar className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Challenge Available</h3>
          <p className="text-muted-foreground">
            Check back soon for daily challenges!
          </p>
        </CardContent>
      </Card>
    );
  }

  if (gameEnded) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Trophy className="w-16 h-16 text-primary mb-4 animate-bounce" />
          <h2 className="text-2xl font-bold mb-2">Daily Challenge Complete! 🎉</h2>
          <div className="space-y-2 mb-6">
            <p className="text-xl">
              Final Score: <span className="font-bold text-primary">{score}</span> points
            </p>
            <p className="text-muted-foreground">
              Streak: <span className="font-semibold text-primary">{highestStreak}</span> correct
            </p>
            <p className="text-sm text-muted-foreground">
              Questions: {challengeGames.length} from {challengeGames.length} game types
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            Come back tomorrow for a new challenge! 🌅
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground flex items-center gap-2">
            {getGameTypeIcon(currentGame.game_type)}
            {getGameTypeName(currentGame.game_type)}
          </span>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1 text-amber-500">
              <Zap className="w-4 h-4" />
              {streak} streak
            </span>
            <span className="font-bold">{score} pts</span>
          </div>
        </div>
        <Progress value={progress} className="h-2" />
        <p className="text-xs text-center text-muted-foreground">
          Challenge {currentIndex + 1} of {challengeGames.length}
        </p>
      </div>

      {/* Question Card */}
      <Card className="bg-card border-border border-2 border-amber-500/30">
        <CardHeader>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-500 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Daily Challenge
              </span>
              <span className={cn(
                "px-2 py-1 rounded-full text-xs font-medium",
                currentGame.difficulty === 'easy' && "bg-green-500/20 text-green-500",
                currentGame.difficulty === 'medium' && "bg-yellow-500/20 text-yellow-500",
                currentGame.difficulty === 'hard' && "bg-red-500/20 text-red-500"
              )}>
                {currentGame.difficulty}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              +{calculatePoints()} pts
            </span>
          </div>
          <CardTitle className="text-lg leading-relaxed">
            {isGuessCharacter ? (
              <span className="flex items-center gap-2">
                <User className="w-5 h-5 text-purple-500" />
                Who Am I?
              </span>
            ) : (
              currentGame.question
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Clues for Guess Character */}
          {isGuessCharacter && (
            <div className="space-y-2 mb-4">
              {clues.map((clue, index) => (
                <div
                  key={index}
                  className={cn(
                    "p-3 rounded-lg border-2 transition-all duration-300",
                    index < revealedClues 
                      ? "bg-primary/5 border-primary/30 opacity-100" 
                      : "bg-muted/50 border-border opacity-40 blur-sm"
                  )}
                >
                  {index < revealedClues ? (
                    <p className="text-sm">{clue}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">🔒 Clue {index + 1} hidden</p>
                  )}
                </div>
              ))}
              
              {!isAnswered && revealedClues < totalClues && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleRevealClue}
                  className="w-full gap-2"
                >
                  <Eye className="w-4 h-4" />
                  Reveal Next Clue ({revealedClues}/{totalClues})
                </Button>
              )}
            </div>
          )}

          {/* Hint */}
          {!isAnswered && currentGame.hint && !showHint && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowHint(true)}
              className="w-full gap-2 text-muted-foreground"
            >
              <Lightbulb className="w-4 h-4" />
              Show Hint
            </Button>
          )}

          {showHint && currentGame.hint && (
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <p className="text-sm text-yellow-600 dark:text-yellow-400 flex items-center gap-2">
                <Lightbulb className="w-4 h-4" />
                {currentGame.hint}
              </p>
            </div>
          )}

          {/* Answer Options */}
          {currentGame.options?.map((option, index) => (
            <button
              key={index}
              onClick={() => handleSelectAnswer(option)}
              disabled={isAnswered}
              className={cn(
                "w-full p-4 rounded-xl text-left transition-all duration-200 border-2",
                !isAnswered && "hover:border-primary hover:bg-primary/5 border-border",
                isAnswered && option === currentGame.correct_answer && "border-green-500 bg-green-500/10",
                isAnswered && option === selectedAnswer && option !== currentGame.correct_answer && "border-red-500 bg-red-500/10",
                isAnswered && option !== selectedAnswer && option !== currentGame.correct_answer && "border-border opacity-50"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{option}</span>
                {isAnswered && option === currentGame.correct_answer && (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                )}
                {isAnswered && option === selectedAnswer && option !== currentGame.correct_answer && (
                  <XCircle className="w-5 h-5 text-red-500" />
                )}
              </div>
            </button>
          ))}

          {/* Bible Reference */}
          {isAnswered && currentGame.bible_reference && (
            <p className="text-sm text-center text-muted-foreground mt-4 pt-4 border-t border-border">
              📖 {currentGame.bible_reference}
            </p>
          )}

          {/* Next Button */}
          {isAnswered && (
            <Button onClick={handleNext} className="w-full mt-4">
              {currentIndex >= challengeGames.length - 1 ? "See Results" : "Next Challenge"}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Online Status */}
      {!isOnline && (
        <p className="text-xs text-center text-muted-foreground">
          Playing offline • Scores will sync when online
        </p>
      )}
    </div>
  );
};

export default DailyChallenge;