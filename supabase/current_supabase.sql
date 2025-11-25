-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.challenge_completion (
  challenge_id uuid NOT NULL,
  user_id uuid NOT NULL,
  completed_at timestamp with time zone NOT NULL,
  CONSTRAINT challenge_completion_pkey PRIMARY KEY (challenge_id, user_id),
  CONSTRAINT challenge_completion_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES public.challenges(id)
);
CREATE TABLE public.challenges (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL,
  scheduled_at timestamp with time zone NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  long_distance boolean NOT NULL DEFAULT false,
  status USER-DEFINED NOT NULL DEFAULT 'Incomplete'::challenge_status,
  CONSTRAINT challenges_pkey PRIMARY KEY (id),
  CONSTRAINT challenges_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id)
);
CREATE TABLE public.group_participants (
  group_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL,
  CONSTRAINT group_participants_pkey PRIMARY KEY (group_id, user_id),
  CONSTRAINT group_participants_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id)
);
CREATE TABLE public.groups (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT groups_pkey PRIMARY KEY (id)
);
CREATE TABLE public.invites (
  token text NOT NULL,
  group_id uuid NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  used_at timestamp with time zone,
  CONSTRAINT invites_pkey PRIMARY KEY (token),
  CONSTRAINT invites_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id)
);
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL,
  type text NOT NULL,
  challenge_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id)
);
CREATE TABLE public.preferences_weekly (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL,
  week_start_tokyo timestamp with time zone NOT NULL,
  spice_level integer NOT NULL,
  times_per_day integer NOT NULL,
  keywords text,
  long_distance boolean NOT NULL DEFAULT false,
  CONSTRAINT preferences_weekly_pkey PRIMARY KEY (id),
  CONSTRAINT preferences_weekly_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id)
);
CREATE TABLE public.profiles (
  user_id uuid NOT NULL,
  display_name text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (user_id)
);