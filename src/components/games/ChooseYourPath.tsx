import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle, Loader2, RotateCcw, Shield, XCircle } from "lucide-react";
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

const shuffle = <T,>(items: T[]): T[] => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const ChooseYourPath = () => {
  const { games, loading, isOnline, refetch } = useBibleGames("choose_path");
  const { generateQuestions, isGenerating, shouldGenerate } = useQuestionGenerator();
  const [pool, setPool] = useState<BibleGame[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [wisdomScore, setWisdomScore] = useState(0);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    const hardFirst = [...games].sort((a, b) => rankDifficulty(b.difficulty) - rankDifficulty(a.difficulty));
    setPool(shuffle(hardFirst));
  }, [games]);

  useEffect(() => {
    if (!loading && games.length === 0 && isOnline && shouldGenerate("choose_path")) {
      void generateQuestions("choose_path", 5, { difficulty: "hard" }).then(() => refetch());
    }
  }, [games.length, generateQuestions, isOnline, loading, refetch, shouldGenerate]);

  const current = useMemo(() => pool[index], [pool, index]);
  const progress = pool.length > 0 ? ((index + (finished ? 1 : 0)) / pool.length) * 100 : 0;

  const onSelect = (option: string) => {
    if (!current || answered) return;
    setSelected(option);
    setAnswered(true);
    const correct = option === current.correct_answer;
    if (correct) {
      setWisdomScore((prev) => prev + current.points);
      toast({ title: "Wise choice", description: `+${current.points} wisdom` });
    } else {
      toast({ title: "Not the best path", description: `Correct: ${current.correct_answer}`, variant: "destructive" });
    }
  };

  const onNext = () => {
    if (index >= pool.length - 1) {
      setFinished(true);
      return;
    }
    setIndex((prev) => prev + 1);
    setSelected(null);
    setAnswered(false);
  };

  const onRestart = () => {
    setPool((prev) => shuffle(prev));
    setIndex(0);
    setSelected(null);
    setAnswered(false);
    setWisdomScore(0);
    setFinished(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if ((games.length === 0 && !isGenerating) || !current) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="py-12 text-center space-y-2">
          <h3 className="text-lg font-semibold">Choose Your Path</h3>
          <p className="text-muted-foreground">No path challenges available yet.</p>
          {isGenerating && <p className="text-xs text-primary">Generating hard challenges...</p>}
        </CardContent>
      </Card>
    );
  }

  if (finished) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="py-12 text-center space-y-3">
          <Shield className="w-14 h-14 text-primary mx-auto" />
          <h2 className="text-2xl font-bold">Path Complete</h2>
          <p className="text-muted-foreground">Final wisdom score: <span className="font-semibold text-primary">{wisdomScore}</span></p>
          <Button onClick={onRestart} className="gap-2">
            <RotateCcw className="w-4 h-4" />
            Restart Path
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Choose Your Path</CardTitle>
            <span className="text-sm font-semibold">Wisdom {wisdomScore}</span>
          </div>
          <Progress value={progress} className="h-2" />
        </CardHeader>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-xl">{current.question}</CardTitle>
          <p className="text-xs text-muted-foreground">Difficulty: {current.difficulty}</p>
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
                  {!answered && <ArrowRight className="w-4 h-4 text-muted-foreground" />}
                </span>
              </button>
            );
          })}
          {answered && (
            <Button className="w-full" onClick={onNext}>
              {index >= pool.length - 1 ? "Finish Path" : "Next Decision"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ChooseYourPath;
