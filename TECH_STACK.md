# Spicer Tech Stack (Optimized for Fast Implementation)

## Product-Driven Goals
- 2-person groups; multiple groups per user; Google-only auth via Supabase
- Fixed Tokyo-time scheduling and expiry; no pausing; mid-week preference freeze
- Long-Distance mode enforces non-physical generation
- AI generates title + description using full group history for duplicate avoidance
- Notifications and immutable History from day one

## Architecture Overview
- Frontend: Next.js (React + TypeScript), Tailwind CSS, TanStack Query, Luxon
- Backend: Supabase (Auth, Postgres + RLS, Realtime, Storage as needed)
- Server logic: Supabase Edge Functions (Deno) for AI, invites, scheduling
- Scheduling: pg_cron or Function Scheduler; compute Tokyo boundaries in server
- AI: OpenAI Responses API via server-side function with sanitized logging
- Observability: Structured JSON logs across key flows; client subscribes via Realtime

## Frontend
- Framework: Next.js (App Router) + TypeScript
- Styling: Tailwind CSS; Headless UI/Radix UI for primitives
- Data: TanStack Query for typed server interactions; Supabase client for auth/session
- Routing: File-based routes; deep-link handling for single-use invites
- Timezone: Luxon; render and format strictly in `Asia/Tokyo` regardless device
- Notifications UI: in-app feed and toasts driven by Realtime changes

## Backend (Supabase)
- Auth: Google-only provider via Supabase Auth
- Database: Postgres with RLS; core tables for groups, preferences, challenges, completions, invites, notifications
- Realtime: `postgres_changes` channels on tables for schedule/complete events
- Edge Functions (Deno):
  - `generate_challenge`: builds AI payload from preferences + full group history
  - `consume_invite`: validates single-use token; joins user to group atomically
  - `schedule_tick`: minute-level runner to materialize occurrences at 08:00/16:00/20:00 Tokyo and set expiry
- Scheduling: `pg_cron` or Function Scheduler triggers `schedule_tick` every minute; all times computed in Tokyo then stored as UTC (`TIMESTAMPTZ`)
- AI Provider: OpenAI Responses API called from `generate_challenge`; only `title` and `description` returned

## Data Model (Minimum Viable)
- `profiles`: `user_id`, display fields
- `groups`: `id`, `created_by`, `created_at`
- `group_participants`: `group_id`, `user_id`, `role`
- `preferences_weekly`: `id`, `group_id`, `week_start_tokyo`, `spice_level`, `times_per_day`, `keywords`, `long_distance`
- `invites`: `token`, `group_id`, `created_by`, `created_at`, `used_at`
- `challenges`: `id`, `group_id`, `scheduled_at` (TIMESTAMPTZ UTC), `expires_at` (TIMESTAMPTZ UTC), `title`, `description`, `long_distance`, `status` (enum: Incomplete/Complete)
- `challenge_completion`: `challenge_id`, `user_id`, `completed_at` (TIMESTAMPTZ)
- `notifications`: `id`, `group_id`, `type`, `challenge_id`, `created_at`

## Timezone & Scheduling Strategy
- Storage: Always store as `TIMESTAMPTZ` in UTC
- Computation: Convert Tokyo → UTC via Luxon/SQL; schedule boundaries:
  - 1/day: 08:00; expires next day 08:00
  - 2/day: 08:00→20:00; 20:00→next day 08:00
  - 3/day: 08:00→16:00; 16:00→20:00; 20:00→next day 08:00
- Materialization: `schedule_tick` checks current UTC against Tokyo boundaries for each group; creates challenge rows and expiry

## Notifications
- In-app events via Supabase Realtime on `challenges` and `challenge_completion`
- Types: scheduled/appeared, one participant complete, both complete
- Optional reminders before expiry computed by `schedule_tick` for 2/day and 3/day

## AI Generation
- Request: preferences + `priorChallenges` (full history: title + description)
- Long-Distance mode: enforce non-physical tasks in prompt
- Response: `title`, `description`
- Duplicate avoidance: rely on AI with full history context; backend may paginate/chunk but ensures complete coverage

## Logging & Observability
- Structured JSON logs with correlation IDs (`group_id`, `challenge_id`):
  - Group creation and invite generation/consumption
  - Preference persistence and weekly lock/rollover
  - Scheduling decisions and fixed-time triggers
  - AI payload/response (sanitized); include priorChallenges count + representative titles
  - Long-Distance toggles and enforcement
  - Notification dispatch triggers
  - Completion events and status transitions
  - History retrieval and roadmap rendering
- No secrets in logs; redact tokens and API keys

## Security & Policies
- RLS: Only group members read/write group data; invite consumption idempotent
- Single-use invites: token marked `used_at` in one transaction with join
- Secrets: OpenAI key only in Edge Function env; client never sees it

## Developer Experience
- TypeScript across frontend and Edge Functions
- Zod schemas for API contracts (AI payloads and DB rows)
- Local dev: Supabase CLI; `.env.local` for Next.js; fixtures for Tokyo-time tests
- Testing: timezone unit tests for schedule boundaries and expiry; integration tests for invite consumption and completion

## Acceptance Criteria Mapping
- Multi-group membership with single-use invite deep-link via `consume_invite`
- Preferences (1–5, 1/2/3, keywords, long-distance) with weekly freeze (`preferences_weekly`)
- Fixed Tokyo schedule and expiry; overlaps allowed; materialized rows per occurrence
- AI returns only title/description; full history included; no system similarity threshold
- Notifications + immutable History from day one; Roadmap view renders weekly lane
- Only two states; expired remain Incomplete unless completed before expiry

## Pragmatic Alternatives
- Frontend: SvelteKit instead of Next.js for smaller footprint
- Scheduling: Cloudflare Workers + Cron if pg_cron or Function Scheduler unavailable
- Date/time: `date-fns-tz` if you prefer lighter footprint over Luxon

## Why This Is Easiest
- Supabase consolidates auth, DB, Realtime, and server functions
- Next.js + Tailwind accelerates UI with minimal boilerplate
- Luxon simplifies strict Tokyo rendering and conversions
- Realtime avoids custom messaging service from day one
