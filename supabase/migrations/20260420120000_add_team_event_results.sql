-- team_event_player_stats: synced from Origin Sports event_player_stats
-- stores who played in each event: position, minutes, captain/sub status
create table if not exists team_event_player_stats (
  id uuid primary key default gen_random_uuid(),
  external_id text unique not null,
  event_id uuid references team_events(id) on delete cascade,
  player_id uuid references players(id) on delete set null,
  period_number integer not null default 1,
  team_number integer not null default 1,
  position text,
  minutes_played integer not null default 0,
  is_captain boolean not null default false,
  is_substitute boolean not null default false,
  substitution_time integer,
  synced_at timestamptz,
  created_at timestamptz default now()
);

alter table team_event_player_stats enable row level security;

create policy "Authenticated users can read team event player stats"
  on team_event_player_stats for select
  to authenticated
  using (
    event_id in (
      select te.id from team_events te
      join user_team_access uta on uta.team_id = te.team_id
      where uta.user_id = auth.uid()
    )
  );

-- team_match_events: synced from Origin Sports match_events
-- stores the match timeline: goals, cards, substitutions per minute
create table if not exists team_match_events (
  id uuid primary key default gen_random_uuid(),
  external_id text unique not null,
  event_id uuid references team_events(id) on delete cascade,
  player_id uuid references players(id) on delete set null,
  event_type text not null,
  minute integer,
  period_number integer,
  notes text,
  synced_at timestamptz,
  created_at timestamptz default now()
);

alter table team_match_events enable row level security;

create policy "Authenticated users can read team match events"
  on team_match_events for select
  to authenticated
  using (
    event_id in (
      select te.id from team_events te
      join user_team_access uta on uta.team_id = te.team_id
      where uta.user_id = auth.uid()
    )
  );
