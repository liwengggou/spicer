-- Enable the pg_cron extension for scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron SCHEMA extensions;

-- Create a function to directly schedule challenges (alternative to Edge Function)
CREATE OR REPLACE FUNCTION schedule_challenges_for_current_time()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    now_tokyo timestamp with time zone;
    current_hour integer;
    today_start timestamp with time zone;
    prefs_record record;
    entries_count integer := 0;
BEGIN
    -- Get current time in Tokyo timezone
    now_tokyo := timezone('Asia/Tokyo', now());
    current_hour := extract(hour from now_tokyo);
    today_start := date_trunc('day', now_tokyo);
    
    -- Only proceed if we're at one of the target hours (8, 16, 20)
    IF current_hour NOT IN (8, 16, 20) THEN
        RETURN;
    END IF;
    
    -- Process each group's preferences
    FOR prefs_record IN
        SELECT group_id, times_per_day, long_distance, spice_level, keywords
        FROM preferences_weekly
        ORDER BY week_start_tokyo DESC
    LOOP
        -- Determine if this group should get a challenge at this hour
        IF (prefs_record.times_per_day = 1 AND current_hour = 8) OR
           (prefs_record.times_per_day = 2 AND current_hour IN (8, 20)) OR
           (prefs_record.times_per_day = 3 AND current_hour IN (8, 16, 20)) THEN
            
            -- Calculate scheduled and expiry times
            INSERT INTO challenges (
                group_id, 
                scheduled_at, 
                expires_at, 
                status, 
                long_distance, 
                title, 
                description
            ) VALUES (
                prefs_record.group_id,
                timezone('UTC', today_start + interval '1 hour' * current_hour),
                CASE 
                    WHEN prefs_record.times_per_day = 1 THEN timezone('UTC', today_start + interval '1 day' + interval '8 hours')
                    WHEN prefs_record.times_per_day = 2 AND current_hour = 8 THEN timezone('UTC', today_start + interval '20 hours')
                    WHEN prefs_record.times_per_day = 2 AND current_hour = 20 THEN timezone('UTC', today_start + interval '1 day' + interval '8 hours')
                    WHEN prefs_record.times_per_day = 3 AND current_hour = 8 THEN timezone('UTC', today_start + interval '16 hours')
                    WHEN prefs_record.times_per_day = 3 AND current_hour = 16 THEN timezone('UTC', today_start + interval '20 hours')
                    ELSE timezone('UTC', today_start + interval '1 day' + interval '8 hours')
                END,
                'Incomplete',
                COALESCE(prefs_record.long_distance, false),
                'Scheduled Challenge',
                'Automatically scheduled challenge'
            );
            
            -- Add notification
            INSERT INTO notifications (group_id, type, created_at)
            VALUES (prefs_record.group_id, 'scheduled', now());
            
            entries_count := entries_count + 1;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Scheduled % challenges at % Tokyo time', entries_count, now_tokyo;
END;
$$;

-- Schedule the function to run every minute
SELECT extensions.cron.schedule('schedule-challenges-every-minute', '* * * * *', 'SELECT schedule_challenges_for_current_time();');

-- Grant necessary permissions
GRANT USAGE ON SCHEMA extensions TO postgres;
GRANT EXECUTE ON FUNCTION schedule_challenges_for_current_time() TO postgres;