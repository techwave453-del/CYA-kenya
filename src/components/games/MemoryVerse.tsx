import { useState, useEffect, useCallback } from "react";
import { CheckCircle, XCircle, Loader2, Brain, Zap, RotateCcw, Trophy, Sparkles, Eye, EyeOff, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useBibleGames, BibleGame } from "@/hooks/useBibleGames";
import { useQuestionGenerator } from "@/hooks/useQuestionGenerator";
import { useAnsweredQuestions } from "@/hooks/useAnsweredQuestions";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface MemoryVerseProps {
  onGameEnd?: (score: number, streak: number) => void;
}

const MemoryVerse = ({ onGameEnd }: MemoryVerseProps) => {
  const { games, loading, isOnline, syncScore, getLocalProgress, saveLocalProgress, refetch } = useBibleGames('memory_verse');
  const { generateQuestions, isGenerating, shouldGenerate } = useQuestionGenerator();
  const { answeredIds, answeredCount, markAsAnswered, getUnansweredFirst, loading: answeredLoading } = useAnsweredQuestions('memory_verse');
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<'memorize' | 'arrange' | 'result'>('memorize');
  const [showVerse, setShowVerse] = useState(true);
  const [selectedWords, setSelectedWords] = useState<string[]>([]);
  const [availableWords, setAvailableWords] = useState<string[]>([]);
  const [isCorrect, setIsCorrect] = useState(false);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [highestStreak, setHighestStreak] = useState(0);
  const [gameEnded, setGameEnded] = useState(false);
  const [shuffledGames, setShuffledGames] = useState<BibleGame[]>([]);
  const [memorizeTime, setMemorizeTime] = useState(15);

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
      const progress = await getLocalProgress('memory_verse');
      if (progress) {
        setHighestStreak(progress.highest_streak);
      }
    };
    loadProgress();
  }, [getLocalProgress]);

  const currentGame = shuffledGames[currentIndex];
  const progress = shuffledGames.length > 0 ? ((currentIndex + 1) / shuffledGames.length) * 100 : 0;

  // Countdown timer for memorization phase
  useEffect(() => {
    if (phase === 'memorize' && memorizeTime > 0 && showVerse) {
      const timer = setTimeout(() => setMemorizeTime(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [phase, memorizeTime, showVerse]);

  // Get verse words
  const getVerseWords = useCallback(() => {
    if (!currentGame) return [];
    // The correct_answer contains the full verse text
    return currentGame.correct_answer.split(/\s+/).filter(word => word.length > 0);
  }, [currentGame]);

  // Shuffle words for the arrange phase
  const shuffleWords = useCallback(() => {
    const words = getVerseWords();
    const shuffled = [...words].sort(() => Math.random() - 0.5);
    setAvailableWords(shuffled);
    setSelectedWords([]);
  }, [getVerseWords]);

  // Start arrange phase
  const handleStartArranging = () => {
    setPhase('arrange');
    setShowVerse(false);
    shuffleWords();
  };

  // Select a word
  const handleSelectWord = (word: string, index: number) => {
    setSelectedWords(prev => [...prev, word]);
    setAvailableWords(prev => prev.filter((_, i) => i !== index));
  };

  // Unselect a word
  const handleUnselectWord = (word: string, index: number) => {
    setAvailableWords(prev => [...prev, word]);
    setSelectedWords(prev => prev.filter((_, i) => i !== index));
  };

  // Check the answer
  const handleCheckAnswer = async () => {
    const correctWords = getVerseWords();
    const correct = selectedWords.join(' ') === correctWords.join(' ');
    
    setIsCorrect(correct);
    setPhase('result');
    
    // Track this question as answered
    await markAsAnswered(currentGame.id, correct);
    
    if (correct) {
      // Award bonus points based on remaining time
      const timeBonus = Math.floor(memorizeTime / 3) * 5;
      const totalPoints = currentGame.points + timeBonus;
      
      setScore(prev => prev + totalPoints);
      setStreak(prev => {
        const newStreak = prev + 1;
        if (newStreak > highestStreak) {
          setHighestStreak(newStreak);
        }
        return newStreak;
      });
      toast({
        title: "🎉 Perfect!",
        description: `+${totalPoints} points${timeBonus > 0 ? ` (includes ${timeBonus} time bonus!)` : ''}`,
      });
    } else {
      setStreak(0);
      toast({
        title: "❌ Not quite right",
        description: "Keep practicing this verse!",
        variant: "destructive",
      });
    }
  };

  const handleNext = useCallback(async () => {
    if (currentIndex >= shuffledGames.length - 1) {
      setGameEnded(true);
      
      // Save progress locally
      await saveLocalProgress({
        id: 'memory_verse',
        game_type: 'memory_verse',
        score,
        games_played: 1,
        highest_streak: highestStreak,
        current_streak: streak
      });
      
      // Sync to server if online
      await syncScore('memory_verse', score, highestStreak);
      
      // Generate new questions if online and eligible
      if (isOnline && shouldGenerate('memory_verse')) {
        generateQuestions('memory_verse', 3).then(() => refetch());
      }
      
      onGameEnd?.(score, highestStreak);
    } else {
      setCurrentIndex(prev => prev + 1);
      setPhase('memorize');
      setShowVerse(true);
      setMemorizeTime(15);
      setSelectedWords([]);
      setAvailableWords([]);
      setIsCorrect(false);
    }
  }, [currentIndex, shuffledGames.length, score, highestStreak, streak, syncScore, saveLocalProgress, onGameEnd, isOnline, shouldGenerate, generateQuestions, refetch]);

  const handleRestart = () => {
    const prioritized = getUnansweredFirst(games);
    setShuffledGames(prioritized);
    setCurrentIndex(0);
    setPhase('memorize');
    setShowVerse(true);
    setMemorizeTime(15);
    setSelectedWords([]);
    setAvailableWords([]);
    setScore(0);
    setStreak(0);
    setGameEnded(false);
    setIsCorrect(false);
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
          <Brain className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Memory Verses Yet</h3>
          <p className="text-muted-foreground">
            Check back soon for Scripture memorization challenges!
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
              Verses memorized: {shuffledGames.length}
            </p>
            <p className="text-xs text-muted-foreground">
              Total progress: {answeredCount}/{games.length} verses completed
            </p>
          </div>
          {isGenerating && (
            <div className="flex items-center gap-2 text-primary mb-4">
              <Sparkles className="w-4 h-4 animate-pulse" />
              <span className="text-sm">Generating new verses...</span>
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
            Verse {currentIndex + 1} of {shuffledGames.length}
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

      {/* Game Card */}
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
          <CardTitle className="text-lg">
            {phase === 'memorize' && "📖 Memorize this verse"}
            {phase === 'arrange' && "🧩 Arrange the words in order"}
            {phase === 'result' && (isCorrect ? "✅ Perfect!" : "❌ Not quite right")}
          </CardTitle>
          {currentGame.bible_reference && (
            <p className="text-sm text-muted-foreground">{currentGame.bible_reference}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Memorize Phase */}
          {phase === 'memorize' && (
            <>
              <div className="relative">
                {showVerse ? (
                  <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                    <p className="text-lg leading-relaxed text-center italic">
                      "{currentGame.correct_answer}"
                    </p>
                  </div>
                ) : (
                  <div className="p-4 bg-muted/50 border border-border rounded-lg text-center">
                    <EyeOff className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">Verse hidden</p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowVerse(!showVerse)}
                  className="gap-2"
                >
                  {showVerse ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  {showVerse ? "Hide" : "Show"}
                </Button>
                <span className={cn(
                  "text-sm font-medium",
                  memorizeTime <= 5 && "text-red-500 animate-pulse"
                )}>
                  ⏱️ {memorizeTime}s
                </span>
              </div>

              <Button onClick={handleStartArranging} className="w-full">
                I'm Ready to Arrange!
              </Button>
            </>
          )}

          {/* Arrange Phase */}
          {phase === 'arrange' && (
            <>
              {/* Selected words area */}
              <div className="min-h-24 p-3 bg-primary/5 border-2 border-dashed border-primary/30 rounded-lg">
                <p className="text-xs text-muted-foreground mb-2">Your arrangement:</p>
                <div className="flex flex-wrap gap-2">
                  {selectedWords.map((word, index) => (
                    <button
                      key={`selected-${index}`}
                      onClick={() => handleUnselectWord(word, index)}
                      className="px-3 py-1.5 bg-primary text-primary-foreground rounded-full text-sm font-medium hover:bg-primary/80 transition-colors"
                    >
                      {word}
                    </button>
                  ))}
                  {selectedWords.length === 0 && (
                    <span className="text-muted-foreground text-sm italic">
                      Tap words below to arrange them...
                    </span>
                  )}
                </div>
              </div>

              {/* Available words */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Available words:</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={shuffleWords}
                    className="gap-1 h-7 text-xs"
                  >
                    <Shuffle className="w-3 h-3" />
                    Shuffle
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {availableWords.map((word, index) => (
                    <button
                      key={`available-${index}`}
                      onClick={() => handleSelectWord(word, index)}
                      className="px-3 py-1.5 bg-secondary text-secondary-foreground rounded-full text-sm font-medium hover:bg-secondary/80 transition-colors"
                    >
                      {word}
                    </button>
                  ))}
                </div>
              </div>

              <Button 
                onClick={handleCheckAnswer} 
                className="w-full"
                disabled={availableWords.length > 0}
              >
                {availableWords.length > 0 ? `${availableWords.length} words remaining` : "Check My Answer"}
              </Button>
            </>
          )}

          {/* Result Phase */}
          {phase === 'result' && (
            <>
              <div className={cn(
                "p-4 rounded-lg border-2",
                isCorrect ? "bg-green-500/10 border-green-500/30" : "bg-red-500/10 border-red-500/30"
              )}>
                <div className="flex items-center gap-2 mb-3">
                  {isCorrect ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500" />
                  )}
                  <span className={cn(
                    "font-semibold",
                    isCorrect ? "text-green-500" : "text-red-500"
                  )}>
                    {isCorrect ? "Perfect arrangement!" : "Keep practicing!"}
                  </span>
                </div>
                
                {!isCorrect && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Correct verse:</p>
                    <p className="text-sm italic">"{currentGame.correct_answer}"</p>
                  </div>
                )}
              </div>

              <Button onClick={handleNext} className="w-full">
                {currentIndex >= shuffledGames.length - 1 ? "See Results" : "Next Verse"}
              </Button>
            </>
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

export default MemoryVerse;
