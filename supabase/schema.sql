-- =====================================================================
-- StudyRoad — Schema v2
-- Everything is a node in a tree. Run this whole file in the
-- Supabase SQL Editor. It WIPES the old v1 tables and is safe to re-run.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 0. WIPE (v1 tables + any previous run of v2)
-- ---------------------------------------------------------------------
drop view  if exists public.roadmap_summaries;

drop table if exists public.activity_events cascade;
drop table if exists public.node_links      cascade;
drop table if exists public.nodes           cascade;

-- v1 leftovers
drop table if exists public.subtopics    cascade;
drop table if exists public.notes        cascade;
drop table if exists public.global_notes cascade;
drop table if exists public.resources    cascade;
drop table if exists public.topics       cascade;
drop table if exists public.roadmaps     cascade;

drop function if exists public.create_roadmap_from_tree(jsonb);
drop function if exists public._insert_node_tree(uuid, uuid, jsonb, int);
drop function if exists public.extend_challenge(uuid, int);
drop function if exists public.tg_set_updated_at();
drop function if exists public.tg_nodes_before_write();
drop function if exists public.tg_nodes_log_done();
drop function if exists public.tg_roadmaps_check_focus();
drop function if exists public.tg_roadmaps_log_focus();


-- ---------------------------------------------------------------------
-- 1. TABLES
-- ---------------------------------------------------------------------

-- A roadmap = one tree (ML/DL, Internship Prep, a project) or one challenge.
create table public.roadmaps (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null default auth.uid()
                          references auth.users(id) on delete cascade,
  title                 text not null check (length(trim(title)) > 0),
  description           text,
  notes                 text not null default '',          -- roadmap-level notepad
  kind                  text not null default 'tree'
                          check (kind in ('tree', 'challenge')),
  focus_node_id         uuid,                               -- ★ focus (FK added below)
  challenge_start_date  date,
  challenge_days        int check (challenge_days is null or challenge_days between 1 and 1000),
  sort_order            double precision not null default 0,
  archived_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint challenge_fields_required check (
    kind <> 'challenge'
    or (challenge_start_date is not null and challenge_days is not null)
  )
);

-- A node = any item at any depth: section, topic, task, or a challenge day.
create table public.nodes (
  id           uuid primary key default gen_random_uuid(),
  roadmap_id   uuid not null references public.roadmaps(id) on delete cascade,
  user_id      uuid not null default auth.uid()
                 references auth.users(id) on delete cascade,
  parent_id    uuid references public.nodes(id) on delete cascade,  -- null = top level
  position     double precision not null default 0,                 -- order among siblings
  title        text not null default '',          -- '' allowed while typing a new row
  description  text,                              -- short one-liner (AI descriptions go here)
  notes        text,                              -- longer markdown notes
  is_done      boolean not null default false,    -- only meaningful on leaf nodes
  done_at      timestamptz,                       -- set automatically by trigger
  due_date     date,
  tags         text[] not null default '{}',
  day_number   int check (day_number is null or day_number > 0),  -- challenge days only
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint unique_day_per_roadmap unique (roadmap_id, day_number)
);

alter table public.roadmaps
  add constraint roadmaps_focus_node_fk
  foreign key (focus_node_id) references public.nodes(id) on delete set null;

-- Resource links attached to ANY node.
create table public.node_links (
  id          uuid primary key default gen_random_uuid(),
  node_id     uuid not null references public.nodes(id) on delete cascade,
  user_id     uuid not null default auth.uid()
                references auth.users(id) on delete cascade,
  title       text not null default '',
  url         text not null check (url ~* '^https?://'),
  created_at  timestamptz not null default now()
);

-- Append-only activity log (written ONLY by triggers). Powers streaks /
-- heatmap / velocity later.
create table public.activity_events (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  roadmap_id  uuid not null references public.roadmaps(id) on delete cascade,
  node_id     uuid references public.nodes(id) on delete set null,
  type        text not null check (type in ('done', 'undone', 'focus')),
  created_at  timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- 2. INDEXES
-- ---------------------------------------------------------------------
create index roadmaps_user_idx         on public.roadmaps (user_id, sort_order);
create index nodes_roadmap_idx         on public.nodes (roadmap_id);
create index nodes_parent_idx          on public.nodes (parent_id, position);
create index nodes_user_idx            on public.nodes (user_id);
create index node_links_node_idx       on public.node_links (node_id);
create index node_links_user_idx       on public.node_links (user_id);
create index activity_user_time_idx   on public.activity_events (user_id, created_at desc);
create index activity_roadmap_idx      on public.activity_events (roadmap_id, created_at desc);


-- ---------------------------------------------------------------------
-- 3. TRIGGERS
-- ---------------------------------------------------------------------

-- 3a. updated_at
create function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger roadmaps_updated_at before update on public.roadmaps
  for each row execute function public.tg_set_updated_at();
create trigger nodes_updated_at before update on public.nodes
  for each row execute function public.tg_set_updated_at();


-- 3b. Node integrity + done_at
--   * node can't move to another roadmap
--   * parent must be in the same roadmap
--   * no cycles (can't drag a node under its own child)
--   * done_at follows is_done
create function public.tg_nodes_before_write()
returns trigger language plpgsql as $$
declare
  parent_roadmap uuid;
begin
  if tg_op = 'UPDATE' and new.roadmap_id <> old.roadmap_id then
    raise exception 'A node cannot be moved to a different roadmap';
  end if;

  if new.parent_id is not null
     and (tg_op = 'INSERT' or new.parent_id is distinct from old.parent_id) then

    if new.parent_id = new.id then
      raise exception 'A node cannot be its own parent';
    end if;

    select roadmap_id into parent_roadmap from public.nodes where id = new.parent_id;
    if parent_roadmap is null then
      raise exception 'Parent node % does not exist', new.parent_id;
    end if;
    if parent_roadmap <> new.roadmap_id then
      raise exception 'Parent node belongs to a different roadmap';
    end if;

    if tg_op = 'UPDATE' and exists (
      with recursive ancestors as (
        select id, parent_id from public.nodes where id = new.parent_id
        union
        select n.id, n.parent_id
        from public.nodes n join ancestors a on n.id = a.parent_id
      )
      select 1 from ancestors where id = new.id
    ) then
      raise exception 'Cannot move a node inside its own subtree';
    end if;
  end if;

  if tg_op = 'INSERT' then
    new.done_at := case when new.is_done then coalesce(new.done_at, now()) else null end;
  elsif new.is_done is distinct from old.is_done then
    new.done_at := case when new.is_done then now() else null end;
  end if;

  return new;
end $$;

create trigger nodes_before_write before insert or update on public.nodes
  for each row execute function public.tg_nodes_before_write();


-- 3c. Log done / undone  (security definer: clients can't write events directly)
create function public.tg_nodes_log_done()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.is_done then
      insert into public.activity_events (user_id, roadmap_id, node_id, type)
      values (new.user_id, new.roadmap_id, new.id, 'done');
    end if;
  elsif new.is_done is distinct from old.is_done then
    insert into public.activity_events (user_id, roadmap_id, node_id, type)
    values (new.user_id, new.roadmap_id, new.id,
            case when new.is_done then 'done' else 'undone' end);
  end if;
  return null;
end $$;

create trigger nodes_log_done after insert or update of is_done on public.nodes
  for each row execute function public.tg_nodes_log_done();


-- 3d. Focus node must belong to the same roadmap
create function public.tg_roadmaps_check_focus()
returns trigger language plpgsql as $$
begin
  if new.focus_node_id is not null and not exists (
    select 1 from public.nodes
    where id = new.focus_node_id and roadmap_id = new.id
  ) then
    raise exception 'Focus node must belong to this roadmap';
  end if;
  return new;
end $$;

create trigger roadmaps_check_focus
  before update of focus_node_id on public.roadmaps
  for each row execute function public.tg_roadmaps_check_focus();


-- 3e. Log focus changes
create function public.tg_roadmaps_log_focus()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.focus_node_id is not null
     and new.focus_node_id is distinct from old.focus_node_id then
    insert into public.activity_events (user_id, roadmap_id, node_id, type)
    values (new.user_id, new.id, new.focus_node_id, 'focus');
  end if;
  return null;
end $$;

create trigger roadmaps_log_focus
  after update of focus_node_id on public.roadmaps
  for each row execute function public.tg_roadmaps_log_focus();


-- ---------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
alter table public.roadmaps        enable row level security;
alter table public.nodes           enable row level security;
alter table public.node_links      enable row level security;
alter table public.activity_events enable row level security;

create policy "own roadmaps" on public.roadmaps
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "own nodes" on public.nodes
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.roadmaps r
                where r.id = roadmap_id and r.user_id = auth.uid())
  );

create policy "own links" on public.node_links
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.nodes n
                where n.id = node_id and n.user_id = auth.uid())
  );

-- read-only for clients; only triggers insert
create policy "read own activity" on public.activity_events
  for select to authenticated
  using (user_id = auth.uid());


-- ---------------------------------------------------------------------
-- 5. DASHBOARD VIEW
-- Progress counts LEAF nodes only (a parent's % comes from its children).
-- ---------------------------------------------------------------------
create view public.roadmap_summaries
with (security_invoker = true) as
select
  r.id,
  r.title,
  r.description,
  r.kind,
  r.sort_order,
  r.archived_at,
  r.challenge_start_date,
  r.challenge_days,
  r.created_at,
  r.updated_at,
  coalesce(s.total_items, 0)                                   as total_items,
  coalesce(s.done_items, 0)                                    as done_items,
  case when coalesce(s.total_items, 0) = 0 then 0
       else round(100.0 * s.done_items / s.total_items)::int end as percent,
  s.last_done_at,
  r.focus_node_id,
  f.title                                                      as focus_title
from public.roadmaps r
left join lateral (
  select
    count(*)                              as total_items,
    count(*) filter (where n.is_done)     as done_items,
    max(n.done_at)                        as last_done_at
  from public.nodes n
  where n.roadmap_id = r.id
    and not exists (select 1 from public.nodes c where c.parent_id = n.id)
) s on true
left join public.nodes f on f.id = r.focus_node_id;


-- ---------------------------------------------------------------------
-- 6. RPCs
-- ---------------------------------------------------------------------

-- Internal: recursively insert a list of items under a parent.
create function public._insert_node_tree(
  p_roadmap_id uuid,
  p_parent_id  uuid,
  p_items      jsonb,
  p_depth      int
) returns void
language plpgsql as $$
declare
  item    jsonb;
  idx     int := 0;
  new_id  uuid;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    return;
  end if;
  if p_depth > 50 then
    raise exception 'Roadmap is nested too deeply (max 50 levels)';
  end if;

  for item in select * from jsonb_array_elements(p_items) loop
    idx := idx + 1;

    insert into public.nodes (roadmap_id, parent_id, position, title, description,
                              notes, is_done, due_date, tags)
    values (
      p_roadmap_id,
      p_parent_id,
      idx,
      coalesce(trim(item->>'title'), ''),
      nullif(trim(item->>'description'), ''),
      nullif(item->>'notes', ''),
      coalesce((item->>'is_done')::boolean, false),
      nullif(item->>'due_date', '')::date,
      coalesce(
        (select array_agg(t) from jsonb_array_elements_text(item->'tags') t),
        '{}'
      )
    )
    returning id into new_id;

    perform public._insert_node_tree(p_roadmap_id, new_id, item->'children', p_depth + 1);
  end loop;
end $$;

-- Create a whole roadmap in ONE transaction. Used by all 3 entry points.
--
-- Tree payload:
--   { "title": "ML / DL", "description": "...", "kind": "tree",
--     "items": [ { "title": "Math", "description": "...", "is_done": false,
--                  "children": [ { "title": "Linear algebra" } ] } ] }
--
-- Challenge payload:
--   { "title": "100 Days of ML", "kind": "challenge",
--     "challenge_days": 100, "challenge_start_date": "2026-11-05" }
--
-- Returns the new roadmap id. If anything fails, nothing is saved.
create function public.create_roadmap_from_tree(payload jsonb)
returns uuid
language plpgsql as $$
declare
  v_kind        text := coalesce(payload->>'kind', 'tree');
  v_roadmap_id  uuid;
  v_days        int;
  v_next_sort   double precision;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select coalesce(max(sort_order), 0) + 1 into v_next_sort
  from public.roadmaps where user_id = auth.uid();

  if v_kind = 'challenge' then
    v_days := (payload->>'challenge_days')::int;

    insert into public.roadmaps (title, description, kind, challenge_days,
                                 challenge_start_date, sort_order)
    values (
      trim(payload->>'title'),
      nullif(trim(payload->>'description'), ''),
      'challenge',
      v_days,
      coalesce(nullif(payload->>'challenge_start_date', '')::date, current_date),
      v_next_sort
    )
    returning id into v_roadmap_id;

    insert into public.nodes (roadmap_id, position, title, day_number)
    select v_roadmap_id, d, 'Day ' || d, d
    from generate_series(1, v_days) d;

  else
    insert into public.roadmaps (title, description, kind, sort_order)
    values (
      trim(payload->>'title'),
      nullif(trim(payload->>'description'), ''),
      'tree',
      v_next_sort
    )
    returning id into v_roadmap_id;

    perform public._insert_node_tree(v_roadmap_id, null, payload->'items', 1);
  end if;

  return v_roadmap_id;
end $$;

-- Extend a challenge, e.g. 100 -> 150 days. Never removes days.
create function public.extend_challenge(p_roadmap_id uuid, p_new_days int)
returns void
language plpgsql as $$
declare
  v_current int;
begin
  select challenge_days into v_current
  from public.roadmaps
  where id = p_roadmap_id and kind = 'challenge';   -- RLS limits this to own roadmaps

  if v_current is null then
    raise exception 'Challenge roadmap not found';
  end if;
  if p_new_days <= v_current then
    raise exception 'New length must be greater than current (%)', v_current;
  end if;

  update public.roadmaps set challenge_days = p_new_days where id = p_roadmap_id;

  insert into public.nodes (roadmap_id, position, title, day_number)
  select p_roadmap_id, d, 'Day ' || d, d
  from generate_series(v_current + 1, p_new_days) d;
end $$;


-- ---------------------------------------------------------------------
-- 7. PERMISSIONS
-- ---------------------------------------------------------------------
-- helper runs as the calling user, so RLS still applies inside it
revoke all on function public._insert_node_tree(uuid, uuid, jsonb, int) from public, anon;
grant  execute on function public._insert_node_tree(uuid, uuid, jsonb, int) to authenticated;

revoke all on function public.create_roadmap_from_tree(jsonb) from public, anon;
grant  execute on function public.create_roadmap_from_tree(jsonb) to authenticated;

revoke all on function public.extend_challenge(uuid, int) from public, anon;
grant  execute on function public.extend_challenge(uuid, int) to authenticated;

grant select on public.roadmap_summaries to authenticated;
