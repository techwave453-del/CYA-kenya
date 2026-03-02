import { useEffect, useMemo, useState } from "react";
import { CheckCircle, Loader2, RotateCcw, ShieldCheck, Trophy, XCircle } from "lucide-react";
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

const CharacterMissions = () => {
  const { games, loading, isOnline, refetch } = useBibleGames("character_missions");
  const { generateQuestions, isGenerating, shouldGenerate } = useQuestionGenerator();
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [xp, setXp] = useState(0);
  const [finished, setFinished] = useState(false);

  const missions = useMemo(
    () => [...games].sort((a, b) => rankDifficulty(b.difficulty) - rankDifficulty(a.difficulty)),
    [games]
  );
  const current = missions[index];
  const progress = missions.length > 0 ? ((index + (finished ? 1 : 0)) / missions.length) * 100 : 0;

  useEffect(() => {
    if (!loading && games.length === 0 && isOnline && shouldGenerate("character_missions")) {
      void generateQuestions("character_missions", 5, { difficulty: "hard" }).then(() => refetch());
    }
  }, [games.length, generateQuestions, isOnline, loading, refetch, shouldGenerate]);

  const selectAnswer = (option: string) => {
    if (!current || answered) return;
    setSelected(option);
    setAnswered(true);
    const correct = option === current.correct_answer;
    if (correct) {
      setXp((prev) => prev + current.points);
      toast({ title: "Mission success", description: `+${current.points} XP` });
    } else {
      toast({ title: "Mission failed", description: `Correct: ${current.correct_answer}`, variant: "destructive" });
    }
  };

  const nextMission = () => {
    if (index >= missions.length - 1) {
      setFinished(true);
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
    setXp(0);
    setFinished(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (!current && !isGenerating) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="py-12 text-center space-y-2">
          <h3 className="text-lg font-semibold">Character Missions</h3>
          <p className="text-muted-foreground">No missions available yet.</p>
        </CardContent>
      </Card>
    );
  }

  if (finished) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="py-12 text-center space-y-3">
          <Trophy className="w-14 h-14 text-primary mx-auto" />
          <h2 className="text-2xl font-bold">Missions Complete</h2>
          <p className="font-semibold text-primary">Total XP: {xp}</p>
          <Button onClick={restart} className="gap-2">
            <RotateCcw className="w-4 h-4" />
            Replay Missions
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
              <ShieldCheck className="w-5 h-5 text-primary" />
              Character Missions
            </CardTitle>
            <span className="text-sm font-semibold">{xp} XP</span>
          </div>
          <Progress value={progress} className="h-2" />
        </CardHeader>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-xl">{current.question}</CardTitle>
          <p className="text-xs text-muted-foreground">
            {current.bible_reference || "Mission scripture"} · {current.difficulty}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {current.options?.map((option) => {
            const correct = answered && option === current.correct_answer;
            const wrong = answered && option === selected && option !== current.correct_answer;
            return (
              <button
                key={option}
                onClick={() => selectAnswer(option)}
                disabled={answered}
                className={cn(
                  "w-full p-3 rounded-lg border transition-all text-left",
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
            <div className="space-y-3">
              {current.hint && <p className="text-sm text-foreground/80">{current.hint}</p>}
              <Button className="w-full" onClick={nextMission}>
                {index >= missions.length - 1 ? "Finish Missions" : "Next Mission"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CharacterMissions;
