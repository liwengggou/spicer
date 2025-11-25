-- Disable the pg_cron-based scheduler in favor of the Edge Function scheduler
DO $$
BEGIN
  -- Unschedule if it exists
  IF EXISTS (
    SELECT 1 FROM extensions.cron.job WHERE jobname = 'schedule-challenges-every-minute'
  ) THEN
    PERFORM extensions.cron.unschedule('schedule-challenges-every-minute');
  END IF;
EXCEPTION WHEN undefined_table THEN
  -- pg_cron may not be installed in all environments; ignore
  NULL;
END $$;

-- Optional: keep the helper function around for manual invocation; do not re-schedule it.
