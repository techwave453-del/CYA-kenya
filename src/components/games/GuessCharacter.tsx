import { useState, useEffect, useCallback } from "react";
import { CheckCircle, XCircle, Loader2, User, Eye, Lightbulb, RotateCcw, Trophy, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useBibleGames, BibleGame } from "@/hooks/useBibleGames";
import { useQuestionGenerator } from "@/hooks/useQuestionGenerator";
import { useAnsweredQuestions } from "@/hooks/useAnsweredQuestions";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface GuessCharacterProps {
  onGameEnd?: (score: number, streak: number) => void;
}

const GuessCharacter = ({ onGameEnd }: GuessCharacterProps) => {
  const { games, loading, isOnline, syncScore, getLocalProgress, saveLocalProgress, refetch } = useBibleGames('guess_character');
  const { generateQuestions, isGenerating, shouldGenerate } = useQuestionGenerator();
  const { answeredIds, answeredCount, markAsAnswered, getUnansweredFirst, loading: answeredLoading } = useAnsweredQuestions('guess_character');
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealedClues, setRevealedClues] = useState(1);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [highestStreak, setHighestStreak] = useState(0);
  const [gameEnded, setGameEnded] = useState(false);
  const [shuffledGames, setShuffledGames] = useState<BibleGame[]>([]);
  const [showHint, setShowHint] = useState(false);

  // Prioritize unanswered questions
  useEffect(() => {
    if (games.length > 0 && !answeredLoading) {
      const prioritized = getUnansweredFirst(games);
      setShuffledGames(prioritized);
    }
  }, [games, answeredLoading, getUnansweredFirst]);

  // Load local progress
  useEffect(() => {
    const loadProgress = async () => {
      const progress = await getLocalProgress('guess_character');
      if (progress) {
        setHighestStreak(progress.highest_streak);
      }
    };
    loadProgress();
  }, [getLocalProgress]);

  const currentGame = shuffledGames[currentIndex];
  const progress = shuffledGames.length > 0 ? ((currentIndex + 1) / shuffledGames.length) * 100 : 0;

  // Parse clues from the question text
  const parseClues = (question: string): string[] => {
    return question.split('\n').filter(line => line.trim().startsWith('Clue'));
  };

  const clues = currentGame ? parseClues(currentGame.question) : [];
  const totalClues = clues.length;

  // Calculate points based on how many clues were revealed (fewer clues = more points)
  const calculatePoints = () => {
    const basePoints = currentGame?.points || 10;
    const multiplier = Math.max(1, totalClues - revealedClues + 1);
    return basePoints * multiplier;
  };

  const handleRevealClue = () => {
    if (revealedClues < totalClues) {
      setRevealedClues(prev => prev + 1);
    }
  };

  const handleSelectAnswer = async (answer: string) => {
    if (isAnswered) return;
    
    setSelectedAnswer(answer);
    setIsAnswered(true);
    
    const isCorrect = answer === currentGame.correct_answer;
    const earnedPoints = calculatePoints();
    
    // Track this question as answered
    await markAsAnswered(currentGame.id, isCorrect);
    
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
        title: `🎉 Correct! It's ${currentGame.correct_answer}!`,
        description: `+${earnedPoints} points (${totalClues - revealedClues + 1}x bonus for using ${revealedClues} clue${revealedClues > 1 ? 's' : ''})`,
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
    if (currentIndex >= shuffledGames.length - 1) {
      setGameEnded(true);
      
      // Save progress locally
      await saveLocalProgress({
        id: 'guess_character',
        game_type: 'guess_character',
        score,
        games_played: 1,
        highest_streak: highestStreak,
        current_streak: streak
      });
      
      // Sync to server if online
      await syncScore('guess_character', score, highestStreak);
      
      // Generate new questions if online and eligible
      if (isOnline && shouldGenerate('guess_character')) {
        generateQuestions('guess_character', 3).then(() => refetch());
      }
      
      onGameEnd?.(score, highestStreak);
    } else {
      setCurrentIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setIsAnswered(false);
      setRevealedClues(1);
      setShowHint(false);
    }
  }, [currentIndex, shuffledGames.length, score, highestStreak, streak, syncScore, saveLocalProgress, onGameEnd, isOnline, shouldGenerate, generateQuestions, refetch]);

  const handleRestart = () => {
    const prioritized = getUnansweredFirst(games);
    setShuffledGames(prioritized);
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setIsAnswered(false);
    setRevealedClues(1);
    setShowHint(false);
    setScore(0);
    setStreak(0);
    setGameEnded(false);
  };

  if (loading || answeredLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (shuffledGames.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <User className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Character Questions Yet</h3>
          <p className="text-muted-foreground">
            Check back soon for Guess the Character!
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
          <h2 className="text-2xl font-bold mb-2">Game Complete! 🎉</h2>
          <div className="space-y-2 mb-6">
            <p className="text-xl">
              Final Score: <span className="font-bold text-primary">{score}</span> points
            </p>
            <p className="text-muted-foreground">
              Best Streak: <span className="font-semibold text-primary">{highestStreak}</span> correct guesses
            </p>
            <p className="text-sm text-muted-foreground">
              Characters guessed: {shuffledGames.length}
            </p>
            <p className="text-xs text-muted-foreground">
              Total progress: {answeredCount}/{games.length} characters completed
            </p>
          </div>
          {isGenerating && (
            <div className="flex items-center gap-2 text-primary mb-4">
              <Sparkles className="w-4 h-4 animate-pulse" />
              <span className="text-sm">Generating new characters...</span>
            </div>
          )}
          <Button onClick={handleRestart} className="gap-2" disabled={isGenerating}>
            <RotateCcw className="w-4 h-4" />
            Play Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            Character {currentIndex + 1} of {shuffledGames.length}
          </span>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1 text-purple-500">
              <User className="w-4 h-4" />
              {streak} streak
            </span>
            <span className="font-bold">{score} pts</span>
          </div>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Character Card */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between mb-2">
            <span className={cn(
              "px-2 py-1 rounded-full text-xs font-medium",
              currentGame.difficulty === 'easy' && "bg-green-500/20 text-green-500",
              currentGame.difficulty === 'medium' && "bg-yellow-500/20 text-yellow-500",
              currentGame.difficulty === 'hard' && "bg-red-500/20 text-red-500"
            )}>
              {currentGame.difficulty}
            </span>
            <span className="text-xs text-muted-foreground">
              +{calculatePoints()} pts potential
            </span>
          </div>
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="w-5 h-5 text-purple-500" />
            Who Am I?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Clues */}
          <div className="space-y-2">
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
          </div>

          {/* Reveal Clue Button */}
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

          {/* Hint Button */}
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

          {/* Hint Display */}
          {showHint && currentGame.hint && (
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <p className="text-sm text-yellow-600 dark:text-yellow-400 flex items-center gap-2">
                <Lightbulb className="w-4 h-4" />
                {currentGame.hint}
              </p>
            </div>
          )}

          {/* Answer Options */}
          <div className="space-y-2 pt-2">
            <p className="text-sm font-medium text-muted-foreground">Who is this character?</p>
            {currentGame.options?.map((option, index) => (
              <button
                key={index}
                onClick={() => handleSelectAnswer(option)}
                disabled={isAnswered}
                className={cn(
                  "w-full p-4 rounded-xl text-left transition-all duration-200 border-2",
                  !isAnswered && "hover:border-purple-500 hover:bg-purple-500/5 border-border",
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
          </div>

          {/* Bible Reference */}
          {isAnswered && currentGame.bible_reference && (
            <p className="text-sm text-center text-muted-foreground mt-4 pt-4 border-t border-border">
              📖 {currentGame.bible_reference}
            </p>
          )}

          {/* Next Button */}
          {isAnswered && (
            <Button onClick={handleNext} className="w-full mt-4">
              {currentIndex >= shuffledGames.length - 1 ? "See Results" : "Next Character"}
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

export default GuessCharacter;