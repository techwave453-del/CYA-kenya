import { useState, useEffect, useCallback } from "react";
import { CheckCircle, XCircle, Loader2, PenTool, Zap, RotateCcw, Trophy, Sparkles, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useBibleGames, BibleGame } from "@/hooks/useBibleGames";
import { useQuestionGenerator } from "@/hooks/useQuestionGenerator";
import { useAnsweredQuestions } from "@/hooks/useAnsweredQuestions";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface FillInTheBlankProps {
  onGameEnd?: (score: number, streak: number) => void;
}

const FillInTheBlank = ({ onGameEnd }: FillInTheBlankProps) => {
  const { games, loading, isOnline, syncScore, getLocalProgress, saveLocalProgress, refetch } = useBibleGames('fill_blank');
  const { generateQuestions, isGenerating, shouldGenerate } = useQuestionGenerator();
  const { answeredIds, answeredCount, markAsAnswered, getUnansweredFirst, loading: answeredLoading } = useAnsweredQuestions('fill_blank');
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [isAnswered, setIsAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
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
      const progress = await getLocalProgress('fill_blank');
      if (progress) {
        setHighestStreak(progress.highest_streak);
      }
    };
    loadProgress();
  }, [getLocalProgress]);

  const currentGame = shuffledGames[currentIndex];
  const progress = shuffledGames.length > 0 ? ((currentIndex + 1) / shuffledGames.length) * 100 : 0;

  // Parse the question to show the verse with blank
  const parseQuestion = (question: string) => {
    // The question format is: "Complete the verse: 'For God so loved the _____, that he gave his only begotten Son...'"
    return question;
  };

  const normalizeAnswer = (answer: string) => {
    return answer.toLowerCase().trim().replace(/[.,;:!?'"]/g, '');
  };

  const handleSubmitAnswer = async () => {
    if (isAnswered || !userAnswer.trim()) return;
    
    setIsAnswered(true);
    
    const normalizedUser = normalizeAnswer(userAnswer);
    const normalizedCorrect = normalizeAnswer(currentGame.correct_answer);
    const correct = normalizedUser === normalizedCorrect;
    
    setIsCorrect(correct);
    
    // Track this question as answered
    await markAsAnswered(currentGame.id, correct);
    
    if (correct) {
      // Award bonus points for not using hint
      const bonusPoints = showHint ? 0 : 5;
      const totalPoints = currentGame.points + bonusPoints;
      
      setScore(prev => prev + totalPoints);
      setStreak(prev => {
        const newStreak = prev + 1;
        if (newStreak > highestStreak) {
          setHighestStreak(newStreak);
        }
        return newStreak;
      });
      toast({
        title: "🎉 Correct!",
        description: `+${totalPoints} points${bonusPoints > 0 ? ' (includes no-hint bonus!)' : ''}`,
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
        id: 'fill_blank',
        game_type: 'fill_blank',
        score,
        games_played: 1,
        highest_streak: highestStreak,
        current_streak: streak
      });
      
      // Sync to server if online
      await syncScore('fill_blank', score, highestStreak);
      
      // Generate new questions if online and eligible
      if (isOnline && shouldGenerate('fill_blank')) {
        generateQuestions('fill_blank', 3).then(() => refetch());
      }
      
      onGameEnd?.(score, highestStreak);
    } else {
      setCurrentIndex(prev => prev + 1);
      setUserAnswer("");
      setIsAnswered(false);
      setIsCorrect(false);
      setShowHint(false);
    }
  }, [currentIndex, shuffledGames.length, score, highestStreak, streak, syncScore, saveLocalProgress, onGameEnd, isOnline, shouldGenerate, generateQuestions, refetch]);

  const handleRestart = () => {
    const prioritized = getUnansweredFirst(games);
    setShuffledGames(prioritized);
    setCurrentIndex(0);
    setUserAnswer("");
    setIsAnswered(false);
    setIsCorrect(false);
    setScore(0);
    setStreak(0);
    setGameEnded(false);
    setShowHint(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isAnswered) {
      handleSubmitAnswer();
    }
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
          <PenTool className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Fill in the Blank Questions Yet</h3>
          <p className="text-muted-foreground">
            Check back soon for new verse completion challenges!
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
              Questions answered: {shuffledGames.length}
            </p>
            <p className="text-xs text-muted-foreground">
              Total progress: {answeredCount}/{games.length} questions completed
            </p>
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
              +{currentGame.points} pts {!showHint && "(+5 bonus no hint)"}
            </span>
          </div>
          <CardTitle className="text-lg leading-relaxed">
            {parseQuestion(currentGame.question)}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Answer Input */}
          <div className="space-y-2">
            <Input
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type the missing word(s)..."
              disabled={isAnswered}
              className={cn(
                "text-center text-lg",
                isAnswered && isCorrect && "border-green-500 bg-green-500/10",
                isAnswered && !isCorrect && "border-red-500 bg-red-500/10"
              )}
            />
            {isAnswered && (
              <div className="flex items-center justify-center gap-2">
                {isCorrect ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-red-500" />
                    <span className="text-sm text-muted-foreground">
                      Correct answer: <span className="font-semibold text-foreground">{currentGame.correct_answer}</span>
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Hint Button */}
          {!isAnswered && currentGame.hint && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHint(true)}
              disabled={showHint}
              className="gap-2"
            >
              <Lightbulb className="w-4 h-4" />
              {showHint ? "Hint shown" : "Show Hint (-5 pts)"}
            </Button>
          )}

          {/* Hint Display */}
          {showHint && currentGame.hint && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-sm">
              💡 <span className="text-amber-500">{currentGame.hint}</span>
            </div>
          )}

          {/* Submit Button */}
          {!isAnswered && (
            <Button 
              onClick={handleSubmitAnswer} 
              className="w-full"
              disabled={!userAnswer.trim()}
            >
              Submit Answer
            </Button>
          )}

          {/* Bible Reference */}
          {isAnswered && currentGame.bible_reference && (
            <p className="text-sm text-center text-muted-foreground pt-4 border-t border-border">
              📖 {currentGame.bible_reference}
            </p>
          )}

          {/* Next Button */}
          {isAnswered && (
            <Button onClick={handleNext} className="w-full">
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

export default FillInTheBlank;
