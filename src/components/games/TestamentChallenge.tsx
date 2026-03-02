import { useEffect, useMemo, useState } from "react";
import { CheckCircle, Loader2, RotateCcw, Trophy, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useBibleGames, BibleGame } from "@/hooks/useBibleGames";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface TestamentChallengeProps {
  testament: "old" | "new";
  scoreKey: "old_testament" | "new_testament";
  title: string;
  emptyMessage: string;
  onGameEnd?: (score: number, streak: number) => void;
}

const shuffle = <T,>(items: T[]): T[] => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const TestamentChallenge = ({
  testament,
  scoreKey,
  title,
  emptyMessage,
  onGameEnd,
}: TestamentChallengeProps) => {
  const { games, loading, isOnline, syncScore, getLocalProgress, saveLocalProgress } = useBibleGames();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [highestStreak, setHighestStreak] = useState(0);
  const [gameEnded, setGameEnded] = useState(false);

  const filteredGames = useMemo(() => {
    const valid = games.filter(
      (game) =>
        game.testament === testament &&
        Array.isArray(game.options) &&
        game.options.length > 1
    );
    return shuffle(valid);
  }, [games, testament]);

  useEffect(() => {
    void (async () => {
      const progress = await getLocalProgress(scoreKey);
      if (progress) {
        setHighestStreak(progress.highest_streak);
      }
    })();
  }, [getLocalProgress, scoreKey]);

  const currentGame: BibleGame | undefined = filteredGames[currentIndex];
  const progress = filteredGames.length > 0 ? ((currentIndex + 1) / filteredGames.length) * 100 : 0;

  const handleSelectAnswer = (answer: string) => {
    if (!currentGame || isAnswered) return;

    setSelectedAnswer(answer);
    setIsAnswered(true);
    const isCorrect = answer === currentGame.correct_answer;

    if (isCorrect) {
      setScore((prev) => prev + currentGame.points);
      setStreak((prev) => {
        const next = prev + 1;
        if (next > highestStreak) setHighestStreak(next);
        return next;
      });
      toast({ title: "Correct answer", description: `+${currentGame.points} points` });
    } else {
      setStreak(0);
      toast({
        title: "Incorrect answer",
        description: `Correct answer: ${currentGame.correct_answer}`,
        variant: "destructive",
      });
    }
  };

  const handleNext = async () => {
    if (!currentGame) return;

    if (currentIndex >= filteredGames.length - 1) {
      setGameEnded(true);
      await saveLocalProgress({
        id: scoreKey,
        game_type: scoreKey,
        score,
        games_played: 1,
        highest_streak: highestStreak,
        current_streak: streak,
      });
      await syncScore(scoreKey, score, highestStreak);
      onGameEnd?.(score, highestStreak);
      return;
    }

    setCurrentIndex((prev) => prev + 1);
    setSelectedAnswer(null);
    setIsAnswered(false);
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setIsAnswered(false);
    setScore(0);
    setStreak(0);
    setGameEnded(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (filteredGames.length === 0 || !currentGame) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <h3 className="text-lg font-semibold mb-2">{title}</h3>
          <p className="text-muted-foreground">{emptyMessage}</p>
        </CardContent>
      </Card>
    );
  }

  if (gameEnded) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Trophy className="w-14 h-14 text-primary mb-4" />
          <h2 className="text-2xl font-bold mb-2">{title} Complete</h2>
          <p className="text-lg mb-1">
            Score: <span className="font-bold text-primary">{score}</span>
          </p>
          <p className="text-muted-foreground mb-6">
            Best streak: <span className="font-semibold text-primary">{highestStreak}</span>
          </p>
          <Button onClick={handleRestart} className="gap-2">
            <RotateCcw className="w-4 h-4" />
            Play Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            {title}: {currentIndex + 1}/{filteredGames.length}
          </span>
          <span className="font-semibold">{score} pts</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between mb-2">
            <span className={cn(
              "px-2 py-1 rounded-full text-xs font-medium",
              currentGame.difficulty === "easy" && "bg-green-500/20 text-green-500",
              currentGame.difficulty === "medium" && "bg-yellow-500/20 text-yellow-500",
              currentGame.difficulty === "hard" && "bg-red-500/20 text-red-500"
            )}>
              {currentGame.difficulty}
            </span>
            <span className="text-xs text-muted-foreground">+{currentGame.points} pts</span>
          </div>
          <CardTitle className="text-lg leading-relaxed">{currentGame.question}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
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

          {isAnswered && (
            <Button onClick={handleNext} className="w-full mt-4">
              {currentIndex >= filteredGames.length - 1 ? "See Results" : "Next Question"}
            </Button>
          )}
        </CardContent>
      </Card>

      {!isOnline && (
        <p className="text-xs text-center text-muted-foreground">
          Offline mode active, scores sync when online
        </p>
      )}
    </div>
  );
};

export default TestamentChallenge;
