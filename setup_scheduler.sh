#!/bin/bash

# Script to set up minute-level scheduler for Spicer challenges
# This creates a cron job that calls the schedule_tick Edge Function every minute

PROJECT_URL="https://cplulpmxegmjpfywuizz.supabase.co"
SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwbHVscG14ZWdtanBmeXd1aXp6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjkzNzI3OSwiZXhwIjoyMDc4NTEzMjc5fQ.yrnWEPwei2axMcYfCcZYQaTO6bkj3ITsOscKyPcksZs"

# Create a script that calls the Edge Function
cat > schedule_tick_caller.sh << 'EOF'
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
EOF

chmod +x schedule_tick_caller.sh

# Add to crontab (this will prompt for confirmation)
echo "Setting up cron job to run every minute..."
(crontab -l 2>/dev/null; echo "* * * * * $(pwd)/schedule_tick_caller.sh") | crontab -

echo "Cron job setup complete!"
echo "The schedule_tick function will be called every minute."
echo "Check /tmp/schedule_tick.log for execution logs."
echo ""
echo "To verify the cron job is running:"
echo "  crontab -l"
echo "  tail -f /tmp/schedule_tick.log"