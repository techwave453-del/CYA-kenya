import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase configuration missing");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Probe DB support for new game types by attempting an insert + cleanup.
    // If the CHECK constraint is not migrated, insert will fail.
    const probeQuestion = `__migration_probe__${Date.now()}`;
    const probePayload = {
      game_type: "choose_path",
      question: probeQuestion,
      options: ["A", "B", "C", "D"],
      correct_answer: "A",
      hint: "probe",
      difficulty: "easy",
      bible_reference: "Genesis 1:1",
      points: 1,
      is_active: false,
      bible_story: null,
      testament: "old",
    };

    const { data, error } = await supabase
      .from("bible_games")
      .insert(probePayload)
      .select("id")
      .single();

    if (error) {
      const notMigrated = error.message.includes("bible_games_game_type_check");
      return new Response(
        JSON.stringify({
          story_games_unlocked: false,
          reason: notMigrated
            ? "Database migration for new game types is not applied."
            : error.message,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (data?.id) {
      await supabase.from("bible_games").delete().eq("id", data.id);
    }

    return new Response(
      JSON.stringify({
        story_games_unlocked: true,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        story_games_unlocked: false,
        reason: error instanceof Error ? error.message : "Capability check failed",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
