import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export const usePostLikes = (postId: string, userId?: string) => {
  const [isLiked, setIsLiked] = useState(false);
  const [loading, setLoading] = useState(false);

  const checkIfLiked = useCallback(async () => {
    if (!userId) {
      setIsLiked(false);
      return;
    }

    const { data } = await supabase
      .from("post_likes")
      .select("id")
      .eq("post_id", postId)
      .eq("user_id", userId)
      .maybeSingle();

    setIsLiked(!!data);
  }, [postId, userId]);

  useEffect(() => {
    checkIfLiked();
  }, [checkIfLiked]);

  const toggleLike = async () => {
    if (!userId || loading) return;

    setLoading(true);
    try {
      if (isLiked) {
        await supabase
          .from("post_likes")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", userId);
        setIsLiked(false);
      } else {
        await supabase
          .from("post_likes")
          .insert({ post_id: postId, user_id: userId });
        setIsLiked(true);
      }
    } catch (error) {
      console.error("Error toggling like:", error);
    } finally {
      setLoading(false);
    }
  };

  return { isLiked, loading, toggleLike };
};
