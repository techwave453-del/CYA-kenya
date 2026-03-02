import { useState, useEffect, useCallback } from "react";
import { CheckCircle, XCircle, Loader2, BookOpen, Zap, RotateCcw, Trophy, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useBibleGames, BibleGame } from "@/hooks/useBibleGames";
import { useQuestionGenerator } from "@/hooks/useQuestionGenerator";
import { useAnsweredQuestions } from "@/hooks/useAnsweredQuestions";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface BibleTriviaProps {
  onGameEnd?: (score: number, streak: number) => void;
}

const BibleTrivia = ({ onGameEnd }: BibleTriviaProps) => {
  const { games, loading, isOnline, syncScore, getLocalProgress, saveLocalProgress, refetch } = useBibleGames('trivia');
  const { generateQuestions, isGenerating, shouldGenerate } = useQuestionGenerator();
  const { answeredIds, answeredCount, markAsAnswered, getUnansweredFirst, loading: answeredLoading } = useAnsweredQuestions('trivia');
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [highestStreak, setHighestStreak] = useState(0);
  const [gameEnded, setGameEnded] = useState(false);
  const [shuffledGames, setShuffledGames] = useState<BibleGame[]>([]);

  // Prioritize unanswered questions
  useEffect(() => {
    // Initialize shuffledGames once when games load (or when answeredLoading finishes),
    // but do NOT re-run whenever answeredIds changes to avoid reshuffling mid-game.
    if (games.length > 0 && !answeredLoading) {
      const prioritized = getUnansweredFirst(games);
      setShuffledGames(prioritized);
    }
    // intentionally omit getUnansweredFirst from deps to prevent reshuffle when answeredIds updates
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [games, answeredLoading]);

  // Load local progress
  useEffect(() => {
    const loadProgress = async () => {
      const progress = await getLocalProgress('trivia');
      if (progress) {
        setHighestStreak(progress.highest_streak);
      }
    };
    loadProgress();
  }, [getLocalProgress]);

  const currentGame = shuffledGames[currentIndex];
  const progress = shuffledGames.length > 0 ? ((currentIndex + 1) / shuffledGames.length) * 100 : 0;

  const handleSelectAnswer = async (answer: string) => {
    if (isAnswered) return;
    
    setSelectedAnswer(answer);
    setIsAnswered(true);
    
    const isCorrect = answer === currentGame.correct_answer;
    
    // Track this question as answered
    await markAsAnswered(currentGame.id, isCorrect);
    
    if (isCorrect) {
      setScore(prev => prev + currentGame.points);
      setStreak(prev => {
        const newStreak = prev + 1;
        if (newStreak > highestStreak) {
          setHighestStreak(newStreak);
        }
        return newStreak;
      });
      toast({
        title: "🎉 Correct!",
        description: `+${currentGame.points} points`,
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
        id: 'trivia',
        game_type: 'trivia',
        score,
        games_played: 1,
        highest_streak: highestStreak,
        current_streak: streak
      });
      
      // Sync to server if online
      await syncScore('trivia', score, highestStreak);
      
      // Generate new questions if online and eligible
      if (isOnline && shouldGenerate('trivia')) {
        generateQuestions('trivia', 3).then(() => refetch());
      }
      
      onGameEnd?.(score, highestStreak);
    } else {
      setCurrentIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setIsAnswered(false);
    }
  }, [currentIndex, shuffledGames.length, score, highestStreak, streak, syncScore, saveLocalProgress, onGameEnd, isOnline, shouldGenerate, generateQuestions, refetch]);

  const handleRestart = () => {
    const prioritized = getUnansweredFirst(games);
    setShuffledGames(prioritized);
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setIsAnswered(false);
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
          <BookOpen className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Trivia Questions Yet</h3>
          <p className="text-muted-foreground">
            Check back soon for new Bible trivia!
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
              Best Streak: <span className="font-semibold text-primary">{highestStreak}</span> correct answers
            </p>
            <p className="text-sm text-muted-foreground">
159:               Questions answered: {shuffledGames.length}
160:             </p>
161:             <p className="text-xs text-muted-foreground">
162:               Total progress: {answeredCount}/{games.length} questions completed
163:             </p>
          </div>
          {isGenerating && (
            <div className="flex items-center gap-2 text-primary mb-4">
              <Sparkles className="w-4 h-4 animate-pulse" />
              <span className="text-sm">Generating new questions...</span>
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
            Question {currentIndex + 1} of {shuffledGames.length}
          </span>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1 text-primary">
              <Zap className="w-4 h-4" />
              {streak} streak
            </span>
            <span className="font-bold">{score} pts</span>
          </div>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Question Card */}
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
              +{currentGame.points} pts
            </span>
          </div>
          <CardTitle className="text-lg leading-relaxed">
            {currentGame.question}
          </CardTitle>
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

          {/* Bible Reference */}
          {isAnswered && currentGame.bible_reference && (
            <p className="text-sm text-center text-muted-foreground mt-4 pt-4 border-t border-border">
              📖 {currentGame.bible_reference}
            </p>
          )}

          {/* Next Button */}
          {isAnswered && (
            <Button onClick={handleNext} className="w-full mt-4">
              {currentIndex >= shuffledGames.length - 1 ? "See Results" : "Next Question"}
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

export default BibleTrivia;
