# Spicer MVP Build Progress and Next Steps

## What’s Done
- App scaffold: Next.js App Router + Tailwind + TypeScript + React Query; dev server runs at `http://localhost:3000/`.
- Auth gate: Google sign-in prompt guarded against missing envs (components/AuthGate.tsx:1). Supabase client reads `supabase_url`/`anon_key` or `NEXT_PUBLIC_*` (lib/supabaseClient.ts:1).
- Tokyo time utilities: Luxon helpers ensure strict `Asia/Tokyo` rendering (lib/time.ts:1).
- Logger + Edge client:
  - Structured JSON logger (lib/logger.ts:1)
  - Edge Function caller deriving URL from project ref (lib/edge.ts:1)
- Frontend routes:
  - Dashboard with links + manual Generate button (app/page.tsx:1, components/GenerateButton.tsx:1)
  - Invite deep-link consumption (app/invite/[token]/page.tsx:1)
  - Preferences form with validation and weekly upsert using Tokyo week start (app/groups/[id]/preferences/page.tsx:1)
  - History list with completion toggle, flips to Complete when both participants finish (app/groups/[id]/history/page.tsx:1, components/ChallengeItem.tsx:1)
  - Realtime notifications feed subscribing to `notifications` inserts (components/NotificationsFeed.tsx:1)
- Edge Functions (Supabase Deno):
  - `consume_invite` single-use join, marks `used_at`, emits notification (supabase/functions/consume_invite/index.ts:1)
  - `generate_challenge` builds JSON from preferences + full history; calls Tencent agent API; returns `{title, description}` (supabase/functions/generate_challenge/index.ts:1)
  - `schedule_tick` materializes Tokyo 08:00/16:00/20:00 occurrences with proper expiry; calls Tencent agent API to fill title/description; inserts notifications (supabase/functions/schedule_tick/index.ts:1)
- Database schema + RLS: SQL file adds tables, FKs, Realtime publications, and member/creator policies (supabase/schema.sql:1)
- Supabase CLI: downloaded locally to `./bin_cli/supabase` (verified v2.58.5). Linking requires an access token.

## Env & Secrets
- `.env` contains: `supabase_url`, `anon_key`, `service_role_key`, `app_key`, `access_token`.
- Client uses `supabase_url` + `anon_key`.
- Edge Functions read `supabase_url`, `service_role_key`, `app_key` (server-side only).

## Scheduler
- Minute-level schedule triggers `schedule_tick` every minute to materialize challenges and notifications in Tokyo time.

## Tencent Agent Integration
- Endpoint: `https://wss.lke.cloud.tencent.com/v1/qbot/chat/sse` (non-streaming via `stream: "disable"`).
- Request fields used: `request_id`, `content` (JSON of preferences + prior challenges), `session_id`=`groupId`, `bot_app_key`=`app_key`, `visitor_biz_id`=`groupId`.
- Response assumed JSON with `{title, description}` per product contract.

## Verification Plan
- Preferences: save and confirm `preferences_weekly` with correct `week_start_tokyo`.
- Invite: insert `invites` row, visit `/invite/[token]`, verify participant join and `used_at`.
- Scheduling: ensure rows appear at Tokyo 08:00/16:00/20:00 with correct expiries; notifications inserted.
- AI: validate generated `{title, description}` present in inserted `challenges`.
- Completion: two accounts mark complete; status flips to Complete; notifications emit.
- Realtime: dashboard feed displays scheduled and completion events.

## Remaining Work to Reach “Fully Working”
- Apply schema in Supabase (run `supabase/schema.sql`).
- Deploy Edge Functions and set secrets from `.env`.
- Create minute-level scheduler (cron `* * * * *`).
- Google OAuth: enable provider and configure redirect URLs in Supabase Auth.
- Invites UI: add group creation + invite generation page; deep-link copy.
- Mid-week freeze enforcement: restrict edits during the active Tokyo week; apply changes starting next week.
- Notifications: optional reminders before expiry for 2/day and 3/day slots.
- Roadmap view: weekly lane UI with immutable history items and indicators.
- Tests: timezone boundary unit tests; integration tests for invite and completion; Realtime smoke tests.
- Observability: broaden structured logs on schedule decisions and AI requests (include prior count + sample titles).

## Immediate Next Commands (CLI Option B)
- Export token and link project:
  - `export SUPABASE_ACCESS_TOKEN="$(grep -E '^access_token=' .env | cut -d= -f2)"`
  - `./bin_cli/supabase link --project-ref cplulpmxegmjpfywuizz`
- Set function secrets from `.env`:
  - `./bin_cli/supabase functions secrets set --env-file .env`
- Deploy functions (no JWT verification):
  - `./bin_cli/supabase functions deploy consume_invite --no-verify-jwt`
  - `./bin_cli/supabase functions deploy generate_challenge --no-verify-jwt`
  - `./bin_cli/supabase functions deploy schedule_tick --no-verify-jwt`
- Create scheduler (every minute):
  - `./bin_cli/supabase functions schedule create schedule_tick_every_minute --function schedule_tick --cron "* * * * *"`

## Acceptance Criteria Mapping
- Multi-group membership via single-use invites: implemented server function + UI hook.
- Preferences (1–5, 1/2/3, keywords, long-distance) with Tokyo mid-week freeze flow: form implemented; server-side freeze enforcement pending.
- Fixed Tokyo schedule and expiry with overlaps allowed: implemented in `schedule_tick`.
- AI returns title/description only; full history included; duplicate avoidance via agent context: implemented.
- Notifications and immutable history: feed present; history UI implemented; policy allows status updates only.
- Only two states; expired remain Incomplete unless both complete before expiry: schedule and completion flow align; expiry windows applied at insert.

---

Once you confirm, I’ll run the link, secrets, deploy, and scheduler commands and perform the verification steps above.
