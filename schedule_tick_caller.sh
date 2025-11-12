#!/bin/bash
PROJECT_URL="https://cplulpmxegmjpfywuizz.supabase.co"
SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwbHVscG14ZWdtanBmeXd1aXp6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjkzNzI3OSwiZXhwIjoyMDc4NTEzMjc5fQ.yrnWEPwei2axMcYfCcZYQaTO6bkj3ITsOscKyPcksZs"

# Call the schedule_tick Edge Function
curl -X POST "${PROJECT_URL}/functions/v1/schedule_tick" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{}' \
  -s -o /dev/null -w "%{http_code}\n" >> /tmp/schedule_tick.log 2>&1

echo "$(date): Called schedule_tick function" >> /tmp/schedule_tick.log
