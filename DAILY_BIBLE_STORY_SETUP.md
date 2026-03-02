# Daily Bible Story Feature - Setup & Configuration Guide

## Overview
This guide explains how to set up and deploy the automated Daily Bible Story feature that generates AI-powered Bible stories with images daily.

## Architecture

**Components:**
- **Supabase Function**: `generate-daily-story` - Generates stories and posts them
- **Frontend Component**: `DailyBibleStory.tsx` - Displays the daily story in the feed
- **Frontend Hook**: `useDailyStory.ts` - Fetches and caches daily stories
- **External Scheduler**: GitHub Actions, Vercel Cron, or other HTTP scheduler

## Prerequisites

1. **Supabase Account** with an active project
2. **Replicate Account** - Free tier available at https://replicate.com
   - You'll need a Replicate API token
3. **Lovable AI API Key** - Already configured in your project

## Step-by-Step Setup

### 1. Configure Environment Variables

Set these in your Supabase project's Edge Functions settings:

**Supabase Dashboard:**
1. Go to Project Settings → Edge Functions → Secrets
2. Add these environment variable:

| Variable | Value | Where to Get |
|----------|-------|--------------|
| `LOVABLE_API_KEY` | Your Lovable API key | Project settings (already configured) |
| `REPLICATE_API_TOKEN` | Your Replicate API token | https://replicate.com/account/api-tokens |

**Example command if using Supabase CLI:**
```bash
supabase secrets set REPLICATE_API_TOKEN="your_token_here" --project-id your_project_id
```

### 2. Deploy the Function

```bash
# Deploy the generate-daily-story function
supabase functions deploy generate-daily-story

# Test locally first:
supabase functions invoke generate-daily-story --local
```

### 3. Set Up External Scheduler

Choose ONE of these approaches:

#### Option A: GitHub Actions (Recommended)

Create `.github/workflows/daily-story.yml`:

```yaml
name: Generate Daily Bible Story
on:
  schedule:
    - cron: '0 0 * * *'  # Every day at midnight UTC
    
  # Allow manual triggering
  workflow_dispatch:

jobs:
  generate-story:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger daily story generation
        run: |
          curl -X POST \
            ${{ secrets.SUPABASE_URL }}/functions/v1/generate-daily-story \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{}'
```

Set these **GitHub Repository Secrets:**
- `SUPABASE_URL`: Your Supabase project URL (e.g., `https://xxxxx.supabase.co`)
- `SUPABASE_SERVICE_ROLE_KEY`: From Supabase Dashboard → Project Settings → API

```json
{
  "crons": [
    {
      "path": "/api/cron/daily-story",
      "schedule": "0 0 * * *"
    }
  ]
}
```

Create `pages/api/cron/daily-story.ts`:

```typescript
export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).end('Unauthorized');
  }

  try {
    const response = await fetch(
      `${process.env.SUPABASE_URL}/functions/v1/generate-daily-story`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: '{}',
      }
    );
    return res.status(response.status).json(await response.json());
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
```

#### Option C: External Cron Service

Use EasyCron, cron-job.org, or similar:

1. Go to service's dashboard
2. Create new cron job
3. Set schedule: `0 0 * * *` (daily at midnight UTC)
4. URL: `https://your-supabase-url/functions/v1/generate-daily-story`
5. Method: POST
6. Headers:
   ```
   Authorization: Bearer YOUR_SERVICE_ROLE_KEY
   Content-Type: application/json
   ```
7. Body: `{}`

### 5. Test the Setup

**Manual test:**
```bash
# Invoke function locally
supabase functions invoke generate-daily-story --local

# Or trigger via HTTP (requires service role key)
curl -X POST https://YOUR_SUPABASE_URL/functions/v1/generate-daily-story \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Verify results:**
1. Check Supabase Storage → `post-images` bucket for generated images
2. Check `posts` table for new entry with `hashtag = '#DailyBibleStory'` and `username = 'Scripture Guide'`
3. View in app: Refresh the posts feed, should see Daily Story below Daily Memory Verse

### 6. Monitor & Debug

**Supabase Function Logs:**
- Dashboard → Functions → generate-daily-story → Logs tab
- Look for errors related to API keys, image generation, or storage uploads

**Common Issues:**

| Issue | Solution |
|-------|----------|
| "LOVABLE_API_KEY is not configured" | Check environment variables are set in Supabase |
| "REPLICATE_API_TOKEN not configured" | Add Replicate token to secrets |
| Image generation timeouts | Increase timeout in function or use lower-quality model |
| Posts not appearing | Verify posts table has entries with hashtag `#DailyBibleStory` |
| "Rate limits exceeded" | Wait a moment and retry; check Lovable/Replicate quotas |

## Optional: Push Notifications

To notify users when a new story is posted daily:

1. Create `notify-daily-story` function (similar pattern to `send-daily-verse`)
2. Call it from `generate-daily-story` function after post creation
3. Send to users who have notifications enabled

## Customization

**Change generation time:**
- Update cron schedule (currently `0 0 * * *` = midnight UTC)
- Format: `MINUTE HOUR DAY MONTH DAY_OF_WEEK`
- Examples: `30 6 * * *` = 6:30 AM UTC daily

**Change image generation model:**
- Edit `FLUX_FLUX_PRO` version in `generate-daily-story/index.ts`
- Other models: search Replicate API docs for alternatives

**Customize story prompt:**
- Edit `STORY_GENERATION_PROMPT` in `generate-daily-story/index.ts`
- Change story themes, length, style, etc.

## Cleanup & Disable

**To temporarily disable stories:**
1. Delete/pause the cron job in GitHub Actions or external scheduler
2. Function will not be triggered

**To remove feature entirely:**
```bash
# Delete function
supabase functions delete generate-daily-story

# Drop migration (if deployed)
supabase db reset  # ⚠️ This resets entire database!

# Remove components (keep for reference)
# - src/components/DailyBibleStory.tsx
# - src/hooks/useDailyStory.ts
# - src/pages/Index.tsx (remove DailyBibleStory import and JSX)
```

## Troubleshooting

### Stories not being created
1. Test function manually: `supabase functions invoke generate-daily-story`
2. Check function logs for errors
3. Verify Replicate token is valid and has credits

### Images not generating
1. Check Replicate token is valid
2. Check Replicate account has remaining credits
3. Try invoking with test prompt in logs

### UI not showing stories
1. Clear browser cache / hard refresh (Ctrl+Shift+R)
2. Check browser console for network errors
3. Verify `useDailyStory` hook is fetching from correct table
4. Manually query posts table: `SELECT * FROM posts WHERE hashtag = '#DailyBibleStory'`

### Offline not working
1. Check IndexedDB in DevTools → Application → IndexedDB
2. Verify `daily_story` object store exists
3. Check sync manager is enabled in app

## Performance Considerations

- **Image generation**: ~30-60 seconds per image (Replicate is async)
- **Story generation**: ~5-10 seconds (Lovable API)
- **Total**: Plan for ~1-2 minutes per daily story generation
- **Storage**: Each image ~200-500 KB, year = ~70-180 MB

## Security Notes

⚠️ **IMPORTANT:**
- **Service Role Key** is highly sensitive; never commit to git
- Use GitHub Secrets for CI/CD workflows
- Rotate keys periodically
- Never expose in client-side code
- Use environment variables in Supabase, not hardcoded

## Advanced: Custom Image Styles

Edit the image prompt in `generate-daily-story/index.ts`:

```typescript
const imagePrompt = `A beautiful, biblical illustration. ${visualDescription} Style: painting, warm lighting, spiritual and reverent atmosphere, high quality, 16:9 aspect ratio`;
```

Examples:
- `Style: watercolor children's book illustration`
- `Style: classical Renaissance painting`
- `Style: modern flat design biblical art`
- `Style: photorealistic`

## Support & Issues

If you encounter issues:
1. Check this guide and troubleshooting section
2. Review function logs in Supabase dashboard
3. Test components independently
4. Verify environment variables are set
5. Check API quotas (Replicate, Lovable)

## Next Steps

- Monitor story quality and adjust prompts as needed
- Gather user feedback on story content
- Consider adding user preferences for story themes
- Implement story archival (keep only last 30/90 days)
- Add analytics to track viewer engagement
