create table if not exists profiles (
  user_id uuid primary key,
  display_name text,
  created_at timestamptz default now()
);

create table if not exists groups (
  id uuid default gen_random_uuid() primary key,
  created_by uuid not null,
  created_at timestamptz default now()
);

create table if not exists group_participants (
  group_id uuid not null,
  user_id uuid not null,
  role text not null,
  primary key (group_id, user_id)
);

create table if not exists preferences_weekly (
  id uuid default gen_random_uuid() primary key,
  group_id uuid not null,
  week_start_tokyo timestamptz not null,
  spice_level int not null,
  times_per_day int not null,
  keywords text,
  long_distance boolean not null default false
);

create table if not exists invites (
  token text primary key,
  group_id uuid not null,
  created_by uuid not null,
  created_at timestamptz default now(),
  used_at timestamptz
);

create type challenge_status as enum ('Incomplete','Complete');

create table if not exists challenges (
  id uuid default gen_random_uuid() primary key,
  group_id uuid not null,
  scheduled_at timestamptz not null,
  expires_at timestamptz not null,
  title text not null,
  description text not null,
  long_distance boolean not null default false,
  status challenge_status not null default 'Incomplete'
);

create table if not exists challenge_completion (
  challenge_id uuid not null,
  user_id uuid not null,
  completed_at timestamptz not null,
  primary key (challenge_id, user_id)
);

create table if not exists notifications (
  id uuid default gen_random_uuid() primary key,
  group_id uuid not null,
  type text not null,
  challenge_id uuid,
  created_at timestamptz default now()
);

alter table group_participants add foreign key (group_id) references groups (id) on delete cascade;
alter table preferences_weekly add foreign key (group_id) references groups (id) on delete cascade;
alter table invites add foreign key (group_id) references groups (id) on delete cascade;
alter table challenges add foreign key (group_id) references groups (id) on delete cascade;
alter table challenge_completion add foreign key (challenge_id) references challenges (id) on delete cascade;

alter publication supabase_realtime add table challenges;
alter publication supabase_realtime add table challenge_completion;
alter publication supabase_realtime add table notifications;

-- RLS
alter table groups enable row level security;
alter table group_participants enable row level security;
alter table preferences_weekly enable row level security;
alter table invites enable row level security;
alter table challenges enable row level security;
alter table challenge_completion enable row level security;
alter table notifications enable row level security;

create policy "members can read group data" on groups for select using ( exists(select 1 from group_participants gp where gp.group_id = id and gp.user_id = auth.uid()) );
create policy "creator can insert groups" on groups for insert with check ( auth.uid() = created_by );

create policy "members read/write participants" on group_participants for all using ( user_id = auth.uid() ) with check ( user_id = auth.uid() );

create policy "members read preferences" on preferences_weekly for select using ( exists(select 1 from group_participants gp where gp.group_id = preferences_weekly.group_id and gp.user_id = auth.uid()) );
create policy "creator write preferences" on preferences_weekly for insert with check ( exists(select 1 from groups g where g.id = preferences_weekly.group_id and g.created_by = auth.uid()) );
create policy "creator update preferences" on preferences_weekly for update using ( exists(select 1 from groups g where g.id = preferences_weekly.group_id and g.created_by = auth.uid()) );

create policy "members read invites" on invites for select using ( exists(select 1 from groups g join group_participants gp on gp.group_id = g.id where invites.group_id = g.id and gp.user_id = auth.uid()) );

create policy "members read challenges" on challenges for select using ( exists(select 1 from group_participants gp where gp.group_id = challenges.group_id and gp.user_id = auth.uid()) );
create policy "members update status" on challenges for update using ( exists(select 1 from group_participants gp where gp.group_id = challenges.group_id and gp.user_id = auth.uid()) );

create policy "members read/write completion" on challenge_completion for all using ( user_id = auth.uid() ) with check ( user_id = auth.uid() );

create policy "members read notifications" on notifications for select using ( exists(select 1 from group_participants gp where gp.group_id = notifications.group_id and gp.user_id = auth.uid()) );
