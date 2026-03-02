import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type GameType =
  | "trivia"
  | "guess_character"
  | "fill_blank"
  | "memory_verse"
  | "choose_path"
  | "journey_jerusalem"
  | "character_missions";

type Difficulty = "easy" | "medium" | "hard";

interface GenerateResult {
  success: boolean;
  generated: number;
  questions?: Array<{
    id: string;
    question: string;
    correct_answer: string;
  }>;
}

export const useQuestionGenerator = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastGenerated, setLastGenerated] = useState<string | null>(null);

  const generateQuestions = useCallback(async (
    gameType: GameType, 
    count: number = 3,
    options?: { bible_story?: string | null; testament?: 'old' | 'new' | null; difficulty?: Difficulty | null }
  ): Promise<GenerateResult | null> => {
    // Prevent duplicate generations within 30 seconds
    const now = Date.now();
    const lastKey = `${gameType}_${count}`;
    const lastTime = localStorage.getItem(`generate_${lastKey}`);
    
    if (lastTime && now - parseInt(lastTime) < 30000) {
      console.log("Skipping generation - recently generated");
      return null;
    }

    setIsGenerating(true);
    
    try {
      console.log(`Generating ${count} ${gameType} questions...`);
      
      const body: any = { game_type: gameType, count };
      if (options?.bible_story) body.bible_story = options.bible_story;
      if (options?.testament) body.testament = options.testament;
      if (options?.difficulty) body.difficulty = options.difficulty;
      
      const { data, error } = await supabase.functions.invoke("generate-game-questions", {
        body,
      });

      if (error) {
        console.error("Function error:", error);
        let detailedMessage = error.message || "Failed to generate questions";
        const context = (error as { context?: { json?: () => Promise<{ error?: string }> } }).context;
        if (context?.json) {
          try {
            const payload = await context.json();
            if (payload?.error) {
              detailedMessage = payload.error;
            }
          } catch {
            // Keep fallback message if payload parsing fails
          }
        }
        throw new Error(detailedMessage);
      }

      if (data?.error) {
        // Handle specific errors
        if (data.error.includes("Rate limit")) {
          toast({
            title: "Please wait",
            description: "Too many requests. New questions will be generated shortly.",
            variant: "default",
          });
        } else if (data.error.includes("credits")) {
          toast({
            title: "AI Credits",
            description: "AI generation is temporarily unavailable.",
            variant: "destructive",
          });
        } else {
          throw new Error(data.error);
        }
        return null;
      }

      // Store generation time to prevent duplicates
      localStorage.setItem(`generate_${lastKey}`, now.toString());
      setLastGenerated(gameType);

      console.log(`Successfully generated ${data.generated} questions`);
      
      const gameTypeLabels: Record<GameType, string> = {
        trivia: "trivia",
        guess_character: "character",
        fill_blank: "fill in the blank",
        memory_verse: "memory verse",
        choose_path: "choose your path",
        journey_jerusalem: "journey to Jerusalem",
        character_missions: "character mission"
      };
      
      toast({
        title: "New Questions Added! 📚",
        description: `${data.generated} new ${gameTypeLabels[gameType]} questions have been added.`,
      });

      return data as GenerateResult;
    } catch (error) {
      console.error("Error generating questions:", error);
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "Could not generate new questions.",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const shouldGenerate = useCallback((gameType: GameType): boolean => {
    // Check if we've generated recently
    const lastKey = `generate_${gameType}_3`;
    const lastTime = localStorage.getItem(lastKey);
    
    if (!lastTime) return true;
    
    const elapsed = Date.now() - parseInt(lastTime);
    // Allow generation every 5 minutes per game type
    return elapsed > 5 * 60 * 1000;
  }, []);

  return {
    generateQuestions,
    isGenerating,
    lastGenerated,
    shouldGenerate,
  };
};
