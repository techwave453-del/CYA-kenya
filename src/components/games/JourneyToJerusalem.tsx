import { useEffect, useMemo, useState } from "react";
import { CheckCircle, Loader2, MapPin, RotateCcw, Trophy, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { useBibleGames, BibleGame } from "@/hooks/useBibleGames";
import { useQuestionGenerator } from "@/hooks/useQuestionGenerator";

const rankDifficulty = (difficulty: BibleGame["difficulty"]): number => {
  if (difficulty === "hard") return 3;
  if (difficulty === "medium") return 2;
  return 1;
};

const JourneyToJerusalem = () => {
  const { games, loading, isOnline, refetch } = useBibleGames("journey_jerusalem");
  const { generateQuestions, isGenerating, shouldGenerate } = useQuestionGenerator();
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  const pool = useMemo(
    () => [...games].sort((a, b) => rankDifficulty(b.difficulty) - rankDifficulty(a.difficulty)),
    [games]
  );
  const current = pool[index];
  const progress = pool.length > 0 ? ((index + (done ? 1 : 0)) / pool.length) * 100 : 0;

  useEffect(() => {
    if (!loading && games.length === 0 && isOnline && shouldGenerate("journey_jerusalem")) {
      void generateQuestions("journey_jerusalem", 5, { difficulty: "hard" }).then(() => refetch());
    }
  }, [games.length, generateQuestions, isOnline, loading, refetch, shouldGenerate]);

  const onSelect = (option: string) => {
    if (!current || answered) return;
    setSelected(option);
    setAnswered(true);
    const correct = option === current.correct_answer;
    if (correct) {
      setScore((prev) => prev + current.points);
      toast({ title: "Checkpoint cleared", description: `+${current.points} points` });
    } else {
      toast({ title: "Wrong route", description: `Correct: ${current.correct_answer}`, variant: "destructive" });
    }
  };

  const next = () => {
    if (index >= pool.length - 1) {
      setDone(true);
      return;
    }
    setIndex((prev) => prev + 1);
    setSelected(null);
    setAnswered(false);
  };

  const restart = () => {
    setIndex(0);
    setSelected(null);
    setAnswered(false);
    setScore(0);
    setDone(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (!current && !isGenerating) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="py-12 text-center space-y-2">
          <h3 className="text-lg font-semibold">Journey to Jerusalem</h3>
          <p className="text-muted-foreground">No journey checkpoints available yet.</p>
        </CardContent>
      </Card>
    );
  }

  if (done) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="py-12 text-center space-y-3">
          <Trophy className="w-14 h-14 text-primary mx-auto" />
          <h2 className="text-2xl font-bold">Journey Complete</h2>
          <p className="text-muted-foreground">Final score: <span className="font-semibold text-primary">{score}</span></p>
          <Button onClick={restart} className="gap-2">
            <RotateCcw className="w-4 h-4" />
            Restart Journey
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!current) return null;

  return (
    <div className="space-y-4">
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              Journey to Jerusalem
            </CardTitle>
            <span className="text-sm font-semibold">{score} pts</span>
          </div>
          <Progress value={progress} className="h-2" />
        </CardHeader>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-xl">{current.question}</CardTitle>
          <p className="text-xs text-muted-foreground">
            {current.bible_reference || "Scripture checkpoint"} · {current.difficulty}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {current.options?.map((option) => {
            const correct = answered && option === current.correct_answer;
            const wrong = answered && option === selected && option !== current.correct_answer;
            return (
              <button
                key={option}
                onClick={() => onSelect(option)}
                disabled={answered}
                className={cn(
                  "w-full p-3 rounded-lg border text-left transition-all",
                  !answered && "border-border hover:border-primary hover:bg-primary/5",
                  correct && "border-green-500 bg-green-500/10",
                  wrong && "border-red-500 bg-red-500/10",
                  answered && !correct && !wrong && "opacity-60"
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span>{option}</span>
                  {correct && <CheckCircle className="w-4 h-4 text-green-500" />}
                  {wrong && <XCircle className="w-4 h-4 text-red-500" />}
                </span>
              </button>
            );
          })}
          {answered && (
            <Button className="w-full" onClick={next}>
              {index >= pool.length - 1 ? "Finish Journey" : "Continue"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default JourneyToJerusalem;
