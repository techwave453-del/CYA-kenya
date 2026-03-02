import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// System prompt to generate full Bible stories with image-friendly descriptions
const STORY_GENERATION_PROMPT = `You are a compelling Bible story narrator. Your task is to:

1. Generate a random, complete Bible story in full narrative format
2. Create the heading using the real, commonly recognized title of that Bible story (max 8 words)
3. Write the story in an engaging, accessible way (4-6 rich paragraphs)
4. Include character development, dialogue, and vivid details
5. Weave in 3-4 relevant scripture references naturally
6. End with 2-3 sentences describing key visual scenes perfect for AI image generation. Be specific about settings, actions, emotions, lighting, and mystical elements.

Return your response using EXACTLY this format:
[HEADING]: <short heading>
[STORY]:
<story text>
[VISUAL_DESCRIPTION]:
<visual description text>

Heading requirements:
- Use a canonical Bible story title (examples: "David and Goliath", "Daniel in the Lions' Den", "The Prodigal Son")
- Do NOT invent poetic, modernized, or clickbait titles
- Do NOT include verse references in the heading

Example [VISUAL_DESCRIPTION]:
"A young shepherd boy stands on a hillside at sunset, with golden light behind him. He holds a simple stone in one hand, eyes focused with determination. Far below, a massive armored giant looms against the horizon, sunlight glinting off his bronze armor."

Generate a compelling, lesser-known Bible story now. Ensure the visual description is vivid and ready for image generation.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase credentials");
    }

    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Starting daily story generation...");

    // Check if a story already exists for today (UTC)
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);

    const { data: existingStories } = await supabase
      .from('posts')
      .select('id')
      .eq('hashtag', '#DailyBibleStory')
      .gte('created_at', todayStart.toISOString())
      .lt('created_at', tomorrowStart.toISOString())
      .limit(1);

    if (existingStories && existingStories.length > 0) {
      console.log("Story already exists for today:", existingStories[0].id);

      // Keep only today's current daily story post to avoid duplicates in the posts table.
      const { error: cleanupError } = await supabase
        .from("posts")
        .delete()
        .eq("hashtag", "#DailyBibleStory")
        .neq("id", existingStories[0].id);

      if (cleanupError) {
        console.error("Daily story cleanup error:", cleanupError);
      }

      return new Response(
        JSON.stringify({ success: true, postId: existingStories[0].id, alreadyExists: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 1: Generate story using bible-chat API
    console.log("Generating Bible story...");
    const storyResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "user",
            content: STORY_GENERATION_PROMPT,
          },
        ],
        temperature: 1, // Allow more creativity for story generation
      }),
    });

    if (!storyResponse.ok) {
      const errorText = await storyResponse.text();
      console.error("Story generation error:", storyResponse.status, errorText);
      throw new Error(`Story generation failed: ${storyResponse.status}`);
    }

    const storyData = await storyResponse.json();
    const fullStory = storyData.choices[0].message.content;

    console.log("Story generated, length:", fullStory.length);

    // Step 2: Extract heading, story text, and visual description
    const headingMatch = fullStory.match(/\[HEADING\]:\s*(.+)/i);
    const storyMatch = fullStory.match(/\[STORY\]:\s*([\s\S]*?)\[VISUAL_DESCRIPTION\]:/i);
    const visualMatch = fullStory.match(/\[VISUAL_DESCRIPTION\]:\s*([\s\S]*?)$/i);

    const aiHeading = headingMatch
      ? headingMatch[1].trim().replace(/^["'`]+|["'`]+$/g, "")
      : "";

    const visualDescription = visualMatch ? visualMatch[1].trim() : "";
    const storyText = storyMatch
      ? storyMatch[1].trim()
      : visualMatch
      ? fullStory
          .substring(0, visualMatch.index)
          .replace(/\[HEADING\]:\s*.*$/im, "")
          .replace(/\[STORY\]:\s*/i, "")
          .trim()
      : fullStory
          .replace(/\[HEADING\]:\s*.*$/im, "")
          .replace(/\[STORY\]:\s*/i, "")
          .trim();

    if (!visualDescription) {
      console.warn("No visual description found, will use default");
    }

    console.log("Visual description:", visualDescription.substring(0, 100) + "...");

    // Step 3: Generate image using Lovable AI
    let imageUrl: string | null = null;

    try {
      console.log("Generating image with Lovable AI...");

      const imagePrompt = `A beautiful, biblical illustration. ${visualDescription} Style: painting, warm lighting, spiritual and reverent atmosphere, high quality, 16:9 aspect ratio`;

      const imageResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-pro-image-preview",
          messages: [
            {
              role: "user",
              content: `Generate a beautiful biblical illustration image: ${imagePrompt}`,
            },
          ],
        }),
      });

      if (!imageResponse.ok) {
        const error = await imageResponse.text();
        console.error("Image generation error:", imageResponse.status, error);
      } else {
        const imageData = await imageResponse.json();
        const content = imageData.choices?.[0]?.message?.content;
        
        // Check if the response contains an image URL or base64 data
        if (content) {
          // Try to extract image URL from markdown or direct URL
          const urlMatch = content.match(/https?:\/\/[^\s\)]+\.(jpg|jpeg|png|webp)/i);
          if (urlMatch) {
            imageUrl = urlMatch[0];
            console.log("Image generated:", imageUrl?.substring(0, 50) + "...");
          } else {
            console.log("Image response received but no URL found, content length:", content.length);
          }
        }
      }
    } catch (error) {
      console.error("Image generation error:", error);
      // Continue anyway - we'll create post without image
    }

    // Step 4: Upload image to Supabase Storage if generated
    let storedImageUrl: string | null = null;

    if (imageUrl) {
      try {
        console.log("Downloading and uploading image to Supabase Storage...");

        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) throw new Error("Failed to fetch generated image");

        const imageBuffer = await imageResponse.arrayBuffer();
        const timestamp = new Date().getTime();
        const fileName = `daily-story-${timestamp}.jpg`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("post-images")
          .upload(fileName, imageBuffer, {
            contentType: "image/jpeg",
            upsert: false,
          });

        if (uploadError) {
          console.error("Storage upload error:", uploadError);
        } else {
          const { data: publicUrlData } = supabase.storage
            .from("post-images")
            .getPublicUrl(fileName);

          storedImageUrl = publicUrlData.publicUrl;
          console.log("Image uploaded successfully:", storedImageUrl);
        }
      } catch (error) {
        console.error("Error handling generated image:", error);
      }
    }

    // Step 5: Use AI heading when provided; fallback to first sentence
    const titleMatch = storyText.match(/^[^.!?\n]+[.!?]/);
    const fallbackStoryTitle = titleMatch
      ? titleMatch[0].substring(0, 70) // Website card title limit
      : "Daily Bible Story";
    const storyTitle = aiHeading ? aiHeading.substring(0, 70) : fallbackStoryTitle;

    // Step 6: Create post in database
    console.log("Creating post in database...");

    // Use system UUID (00000000...) for automated posts, bypasses need for admin user
    const systemUserId = "00000000-0000-0000-0000-000000000000";
    const systemUsername = "Scripture Guide";

    const { data: post, error: postError } = await supabase
      .from("posts")
      .insert({
        user_id: systemUserId,
        username: systemUsername,
        hashtag: "#DailyBibleStory",
        title: storyTitle,
        description: storyText,
        image_url: storedImageUrl,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (postError) {
      console.error("Post creation error:", postError);
      throw postError;
    }

    // Keep only the newest daily story post.
    const { error: cleanupError } = await supabase
      .from("posts")
      .delete()
      .eq("hashtag", "#DailyBibleStory")
      .neq("id", post.id);

    if (cleanupError) {
      console.error("Daily story cleanup error:", cleanupError);
    }

    console.log("Post created successfully:", post.id);

    return new Response(
      JSON.stringify({
        success: true,
        postId: post.id,
        imageGenerated: !!imageUrl,
        imagePath: !!storedImageUrl,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in generate-daily-story:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
