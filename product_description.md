Overview
- Web app for 2-person “spice challenge” groups; a user can join multiple groups.
- Authentication is Google-only via Supabase.
- Group creation generates a single-use invite link with no expiry; invitee joins upon registration via the link.
- Notifications and History are included from day one.
- Scheduling strictly uses Asia/Tokyo timezone for all events and expiry.
- UI timestamps are displayed strictly in Asia/Tokyo timezone regardless of device timezone.

Challenge Groups
- Exactly 2 participants per group.
- Only the creator owns and can modify the group’s settings.
- Preferences cannot be edited mid-week; changes apply starting the next week.
- Groups cannot be paused; deleting a group deletes its data and history permanently and requires a mandatory UI confirmation step.

Preferences
- Spice Level: 1–5; higher values produce juicier and more erotic challenges.
- Times Per Day: choose 1, 2, or 3; number of challenges on a challenge day.
- Keywords: free-text terms to bias AI generation.
- Long-Distance Relationship Mode: toggle; when enabled, generated challenges are non-physical. Follows the mid-week freeze policy.

AI Challenge Generation
- The system sends group preferences as JSON to an AI and receives JSON containing title and description.
- Generation uses group preferences only (no participant profiles).
- Duplicate avoidance relies on AI using the group’s entire prior challenge history; no system-level similarity threshold is enforced.
- When Long-Distance Relationship Mode is enabled, generation must produce non-physical challenges only.
  - Non-physical tasks include video/voice calls and digital-only activities.
 - The AI request includes all prior challenges from the group history (title and description) to provide context and avoid duplicates.

Example AI JSON Contracts
- Request example:
```
{
  "spiceLevel": 3,
  "timesPerDay": 2,
  "keywords": ["art", "food", "outdoors"],
  "longDistanceMode": true,
  "priorChallenges": [
    {
      "title": "Photo Scavenger Hunt",
      "description": "Each of you finds three objects that match prompts and shares photos on a call."
    },
    {
      "title": "Compliment Relay",
      "description": "Alternate giving thoughtful compliments over a 10-minute voice chat."
    }
  ]
}
```
- Response example:
```
{
  "title": "Virtual Street Food Roulette",
  "description": "Start a video call and each of you orders a random dish from different vendors. Share your choices and rate them together."
}
```

Scheduling
- On each challenge day, challenges occur at fixed times in the group timezone (Tokyo):
  - 1/day: 08:00
  - 2/day: 08:00 and 20:00
  - 3/day: 08:00, 16:00, and 20:00
- Challenges occur every day (no day-of-week selection).
- Expiry behavior (Tokyo time):
  - 1/day: the 08:00 challenge expires at the next day’s 08:00 if not both complete.
  - 2/day: the 08:00 challenge expires at 20:00 the same day; the 20:00 challenge expires at the next day’s 08:00 if not both complete.
  - 3/day: the 08:00 challenge expires at 16:00 the same day; the 16:00 challenge expires at 20:00 the same day; the 20:00 challenge expires at the next day’s 08:00 if not both complete.

Notifications
- In scope from day one; includes events for challenge scheduled/appears daily at fixed times (08:00/16:00/20:00), one participant marks complete, and both complete.
- Optional reminders before expiry based on times per day.
- Expiry alerts are optional.

Completion & Status
- Only two states: Incomplete and Complete.
- Completion requires both participants to mark complete asynchronously.
- Expired challenges remain Incomplete permanently (no separate Expired state).
- Completion is inclusive up to and including the expiry boundary.

History & Roadmap
- Each group’s History tab lists all generated challenges.
- Per-challenge fields: title, description, scheduled time, status, long-distance indicator.
- History is immutable.
- Roadmap is a chronological lane view by week; see roadview.png for reference.

Invites & Access
- Invite link is single-use and does not expire.
- Single-use invites can only be used once.
- The invite deep-link does not carry group preferences.
- No acceptance step; joining occurs upon registration via the link.

Accounts & Auth
- Google-only authentication via Supabase.

Logging & Observability (Implementation Requirement)
- Add detailed console logging across key flows to assist debugging:
  - Group creation and invite generation/consumption
  - Preference persistence and weekly lock/rollover
  - Scheduling decisions and fixed-time triggers (08:00/16:00/20:00)
  - AI request payload/response (sanitized)
 - AI request includes priorChallenges count and representative titles (full group history included)
  - Long-Distance mode toggles and enforcement of non-physical generation
  - Notification dispatch triggers
  - Participant completion events and status transitions
  - History retrieval and roadmap rendering
  - Multiple group overlaps are acceptable; log concurrent schedules if applicable.

Acceptance Criteria
- Users can create/join multiple 2-person groups via single-use links.
- Preferences include spice level (1–5), times per day (1/2/3), and keywords; preferences freeze mid-week.
- Long-Distance Relationship Mode is a preference toggle; when enabled, generated challenges are non-physical and the preference follows mid-week freeze.
- Challenges occur every day at fixed Tokyo times based on times per day (08:00; 08:00 & 20:00; 08:00, 16:00 & 20:00).
- Expiry behavior follows the fixed schedule (1/day → next 08:00; 2/day → 08:00→20:00, 20:00→next 08:00; 3/day → 08:00→16:00, 16:00→20:00, 20:00→next 08:00) and starts when the challenge appears.
- AI returns title and description only. Duplicate avoidance is handled by the AI using the full group history; no system-level similarity threshold is enforced.
 - The AI request includes the group’s entire prior challenge history (title and description).
- Notifications and history function from day one; history shows title/description/time/status and long-distance indicator in weekly roadmap.
- Multiple groups may overlap at fixed times; overlaps are acceptable.
- Backend may paginate/chunk prior challenges as long as the AI receives complete history.
- Only two states exist; expired challenges remain Incomplete permanently unless both marked Complete before expiry.
