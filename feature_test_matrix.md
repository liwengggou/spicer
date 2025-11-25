# Feature Test Matrix

- Scope derived from `product_description.md`; each item states the feature to test and the ideal visible/logged output or behavior that proves it works.

## Auth & Accounts
- Google-only auth shows a Google OAuth prompt, rejects other providers, and leaves a valid Supabase session; sign-out fully clears it.
- Session persists across reloads; reloading lands the user in an authenticated state without re-prompt.
- One user can belong to multiple groups without cross-group data leakage.

## Group Creation & Invites
- Creating a group succeeds with exactly two seats; creator is owner and sees owner-only controls enabled.
- Creating a group generates a single-use invite URL that never expires; following it after auth adds the registrant immediately with no extra acceptance step.
- Reusing an invite after consumption shows a clear “already used” style error and does not add a member.
- Invite deep-link contains no preferences and lands the user inside the correct group post-auth.
- Non-owners see settings as disabled/hidden; owner sees them active.

## Preferences & Long-Distance Mode
- Preferences save spice level 1–5, times/day 1|2|3, keywords, and long-distance toggle; save success is confirmed in UI.
- Mid-week edits are blocked in the current week; UI explains “changes apply next week,” and deferred values activate automatically on rollover.
- Long-distance toggle follows the same freeze rule and stays stored; toggling shows correct pending/active state.
- Server rejects mid-week writes; UI surfaces the rejection and retains pending changes for next week.

## AI Challenge Generation
- Outgoing AI request JSON includes spiceLevel, timesPerDay, keywords array, longDistanceMode flag, and the full priorChallenges list (title + description), possibly chunked but complete.
- With long-distance enabled, returned challenges are non-physical only; disabling allows physical ones. Violations are blocked or flagged.
- Response JSON contains only title and description; UI renders both and persists them verbatim.
- Logs show priorChallenges count and representative titles sent for duplicate avoidance context.

## Scheduling & Expiry (Asia/Tokyo)
- Challenges appear daily in Tokyo time at: 08:00 (1/day); 08:00 & 20:00 (2/day); 08:00, 16:00, 20:00 (3/day) regardless of device timezone.
- Expiry windows: 1/day → next-day 08:00; 2/day → 08:00 expires 20:00 same day, 20:00 expires next-day 08:00; 3/day → 08:00→16:00, 16:00→20:00, 20:00→next-day 08:00; inclusive until the boundary.
- Overlapping schedules for multiple groups run in parallel without skipping or rescheduling.

## Completion & Status
- Only two states show: Incomplete or Complete; no “Expired” label exists.
- Each participant can mark complete independently; status flips to Complete only when both are done.
- After expiry, challenge remains Incomplete and blocks late completions.
- Status timestamps and cues use Tokyo time.

## Notifications
- Notifications fire when a challenge appears, when the first participant completes, and when both complete; content references the correct group/challenge.
- Optional pre-expiry reminders follow the times/day cadence; optional expiry alerts fire exactly at boundary.
- Notifications are timezone-correct (Tokyo) and never duplicate for a single event.
- Concurrent events across groups deliver independently to the right recipients.

## History & Roadmap
- History tab lists immutable entries with title, description, scheduled time, status, and long-distance indicator for every generated challenge.
- Entries remain after expiry or deletion of active challenges; no edits allowed.
- Roadmap renders a chronological weekly lane (per `roadview.png`), with correct timestamps and statuses in order.
- Pagination/scroll preserves ordering and completeness.

## Deletion & Irreversibility
- Deleting a group requires a confirmation step; after confirmation, the group disappears and all data/history is permanently gone.
- Invites for deleted groups become unusable and return a clear error.

## Timezone Enforcement
- All UI timestamps (including notifications and history) display in Asia/Tokyo regardless of device locale or changes mid-use.
- Stored/scheduled times remain consistent if the device timezone changes.

## Logging & Observability
- Logs cover: group creation; invite generation/consumption; preference save and weekly rollover; scheduling triggers at 08/16/20; AI request/response (sanitized); long-distance enforcement; notification dispatch; participant completion; history retrieval; roadmap render.
- AI logs include priorChallenges count and sample titles (not full PII) and indicate long-distance state.
- Overlapping schedules across multiple groups log independently without errors.
