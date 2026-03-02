-- Enable pg_net extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- NOTE: This migration provides setup documentation.
-- Daily story generation is implemented via the generate-daily-story Edge Function.
-- See DAILY_BIBLE_STORY_SETUP.md for complete configuration instructions.
--
-- FEATURES:
-- - No admin user required (uses system-generated posts)
-- - AI-powered Bible story generation (Lovable API)
-- - AI image generation (Replicate API)
-- - Automated scheduling via external cron (GitHub Actions recommended)
-- - Offline-first design with IndexedDB caching
--
-- REQUIREMENTS:
-- - LOVABLE_API_KEY in Supabase secrets (already configured)
-- - REPLICATE_API_TOKEN in Supabase secrets (get from https://replicate.com)
-- - External scheduler (GitHub Actions, Vercel Cron, or other HTTP scheduler)

