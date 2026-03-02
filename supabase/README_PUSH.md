# Push Notifications - Deployment & Testing

This document explains how to deploy and test the Supabase Edge Functions and Service Worker used for web push notifications in this repository.

Files involved
- `supabase/functions/send-push-notification/index.ts` - sends web push to saved subscriptions using VAPID keys.
- `supabase/functions/notify-new-message/index.ts` - helper function that triggers `send-push-notification` for conversation participants.
- `supabase/functions/send-daily-verse/index.ts` - (added) scheduled function that sends the daily memory verse to subscribed users.
- `public/sw-push.js` - service worker that shows notifications and handles click actions.
- `src/hooks/usePushNotifications.ts` and `src/components/NotificationSettings.tsx` - client-side subscription flow.

Prerequisites
- Install Supabase CLI: https://supabase.com/docs/guides/cli
- Ensure you have a Supabase project and the Service Role Key available.
- VAPID keypair (public + private). You can generate these with `web-push` or other tools.

Environment variables (required on Supabase functions)
- `SUPABASE_URL` - your project URL (e.g. https://xyzcompany.supabase.co)
- `SUPABASE_SERVICE_ROLE_KEY` - service role key (keep secret)
- `VAPID_PUBLIC_KEY` - VAPID public key (base64 url-safe)
- `VAPID_PRIVATE_KEY` - VAPID private key (base64 url-safe)

Deployment (Supabase CLI)
1. Authenticate with the Supabase CLI and select your project.

2. Set required secrets in the project (one-off):

```bash
supabase secrets set VAPID_PUBLIC_KEY="<your_public>" VAPID_PRIVATE_KEY="<your_private>" SUPABASE_SERVICE_ROLE_KEY="<service_role>" SUPABASE_URL="<your_url>"
```

3. Deploy functions:

```bash
# From repo root
supabase functions deploy send-push-notification --project-ref <project-ref>
supabase functions deploy notify-new-message --project-ref <project-ref>
supabase functions deploy send-daily-verse --project-ref <project-ref>
```

Notes:
- If you use a CI/CD pipeline, store secrets in your CI and run the `supabase secrets set` there.
- The `send-daily-verse` function is designed to be scheduled (run once per day). Supabase scheduled functions or an external cron job can invoke it.

Testing locally (before deploying)

1. Serve functions locally (requires Supabase CLI):

```bash
supabase functions serve send-push-notification --no-verify-jwt --project-ref <project-ref>
# or serve all functions from supabase/functions (see CLI docs)
```

2. Test `send-push-notification` with curl (replace values):

```bash
curl -X POST http://localhost:54321/functions/v1/send-push-notification \
  -H "Content-Type: application/json" \
  -d '{
    "recipientUserId": "<user-id>",
    "title": "Test Push",
    "body": "Hello from local test",
    "data": { "type": "message", "conversationId": "abc123" }
  }'
```

3. Test `notify-new-message` (simulate new message) to notify participants:

```bash
curl -X POST http://localhost:54321/functions/v1/notify-new-message \
  -H "Content-Type: application/json" \
  -d '{
    "messageId": "msg-1",
    "conversationId": "conv-1",
    "senderId": "user-1",
    "content": "This is a test message"
  }'
```

4. Test `send-daily-verse` locally:

```bash
curl -X POST http://localhost:54321/functions/v1/send-daily-verse
```

Browser / client testing
1. Register service worker and subscribe from the app UI (open `NotificationSettings` in the app and click "Enable").
2. Use the app's Test button (in `NotificationSettings`) to use `registration.showNotification` locally.
3. Use the server functions to send a notification to a subscribed user (see curl examples above). The `send-push-notification` endpoint will forward to each saved push subscription for the specified user.
4. Observe the device notification tray/area. Clicking the notification should open the app and navigate to the URL encoded in the notification `data.url`.

Best practices & troubleshooting
- Ensure `serviceWorker` is actually registered in the client (VitePWA or manual registration). The hook `usePushNotifications` depends on `navigator.serviceWorker.ready`.
- On iOS Safari, Web Push is limited; prefer testing on Android/Chrome or desktop Chrome/Firefox.
- If notifications don't appear:
  - Verify the browser permissions (Settings → Site permissions → Notifications).
  - Inspect the service worker console logs (DevTools → Application → Service Workers).
  - Check the function logs in Supabase for errors when sending push (expired endpoints, invalid keys will produce errors).
- If subscriptions are failing, inspect the rows in `push_subscriptions` table and check fields `endpoint`, `p256dh`, and `auth`.

Example payloads
- Message notification payload (used by `notify-new-message`):

```json
{
  "title": "💬 John", 
  "body": "Hey, check this out",
  "data": { "type": "message", "conversationId": "conv-1", "messageId": "m1" }
}
```

- Daily verse payload (used by `send-daily-verse`):

```json
{
  "title": "Daily Memory Verse",
  "body": "John 3:16 — For God so loved the world...",
  "data": { "type": "daily_verse", "verseId": "<id>", "reference": "John 3:16" }
}
```

If you want, I can:
- Provide the exact `supabase` CLI commands to deploy to your project if you give the `project-ref`.
- Attempt to run `supabase functions deploy` from this environment if you provide access (I can't access your Supabase project without credentials).

