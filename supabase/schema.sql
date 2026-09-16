-- Freundes-Bingo: Schema + RLS für Supabase.
-- Im SQL-Editor ausführen. Danach Storage-Bucket `cell-photos` anlegen (private).
-- Auth → Providers: E-Mail aktiv. Für Tests optional "Confirm email" deaktivieren.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  email text not null unique,
  avatar_pixels text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists avatar_pixels text[] not null default '{}';

create table if not exists public.boards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  size int not null check (size between 3 and 6),
  status text not null check (status in ('active', 'revealed', 'archived')) default 'active',
  owner_mode boolean not null default true,
  reveal_enabled boolean not null default true,
  win_logic_enabled boolean not null default true,
  reveal_deadline timestamptz,
  invite_code text not null unique,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.board_members (
  board_id uuid not null references public.boards (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (board_id, user_id)
);

create table if not exists public.cells (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  row int not null,
  col int not null,
  title text not null default '',
  description text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  unique (board_id, row, col)
);

create table if not exists public.cell_progress (
  cell_id uuid not null references public.cells (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  completed boolean not null default false,
  note text not null default '',
  photo_path text,
  updated_at timestamptz not null default now(),
  primary key (cell_id, user_id)
);

create table if not exists public.reveal_votes (
  board_id uuid not null references public.boards (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  voted_at timestamptz not null default now(),
  primary key (board_id, user_id)
);

create table if not exists public.reveal_sessions (
  board_id uuid primary key references public.boards (id) on delete cascade,
  current_index int not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.reveal_downvotes (
  board_id uuid not null references public.boards (id) on delete cascade,
  cell_id uuid not null references public.cells (id) on delete cascade,
  target_user_id uuid not null references public.profiles (id) on delete cascade,
  voter_user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (board_id, cell_id, target_user_id, voter_user_id)
);

create table if not exists public.bingo_events (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  lines text[] not null,
  created_at timestamptz not null default now(),
  unique (board_id, user_id)
);

create table if not exists public.board_notices (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  type text not null check (type in ('bingo', 'revealed', 'joined')),
  actor_user_id uuid not null references public.profiles (id),
  message text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_board_member(p_board_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.board_members
    where board_id = p_board_id and user_id = auth.uid()
  );
$$;

create or replace function public.progress_is_visible(p_cell_id uuid, p_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_owner = auth.uid()
    or exists (
      select 1
      from public.cells c
      join public.boards b on b.id = c.board_id
      where c.id = p_cell_id
        and public.is_board_member(b.id)
        and (
          b.reveal_enabled = false
          or b.status = 'revealed'
        )
    );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, email, avatar_pixels)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), split_part(new.email, '@', 1), 'Bingolover'),
    lower(new.email),
    '{}'
  )
  on conflict (id) do update
    set email = excluded.email,
        display_name = coalesce(nullif(profiles.display_name, ''), excluded.display_name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Beitritt per Code (Board ist vor Mitgliedschaft noch nicht lesbar)
create or replace function public.join_board_by_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_board public.boards%rowtype;
  v_name text;
  v_count int := 0;
begin
  if auth.uid() is null then
    raise exception 'Bitte zuerst anmelden.';
  end if;

  select * into v_board
  from public.boards
  where invite_code = upper(trim(p_code))
    and status <> 'archived';

  if not found then
    raise exception 'Einladungscode unbekannt.';
  end if;

  insert into public.board_members (board_id, user_id, role)
  values (v_board.id, auth.uid(), 'member')
  on conflict (board_id, user_id) do nothing;

  get diagnostics v_count = row_count;
  if v_count > 0 then
    select display_name into v_name from public.profiles where id = auth.uid();
    insert into public.board_notices (board_id, type, actor_user_id, message)
    values (
      v_board.id,
      'joined',
      auth.uid(),
      coalesce(v_name, 'Jemand') || ' ist dem Board beigetreten.'
    );
  end if;

  return v_board.id;
end;
$$;

grant execute on function public.join_board_by_code(text) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.boards enable row level security;
alter table public.board_members enable row level security;
alter table public.cells enable row level security;
alter table public.cell_progress enable row level security;
alter table public.reveal_votes enable row level security;
alter table public.reveal_sessions enable row level security;
alter table public.reveal_downvotes enable row level security;
alter table public.bingo_events enable row level security;
alter table public.board_notices enable row level security;

drop policy if exists "profiles readable by members of shared boards" on public.profiles;
drop policy if exists "own profile upsert" on public.profiles;
drop policy if exists "own profile update" on public.profiles;
drop policy if exists "boards visible to members" on public.boards;
drop policy if exists "authenticated users can create boards" on public.boards;
drop policy if exists "boards updatable by members according to owner_mode" on public.boards;
drop policy if exists "boards deletable by creator or owner" on public.boards;
drop policy if exists "members visible to members" on public.board_members;
drop policy if exists "join via membership insert" on public.board_members;
drop policy if exists "cells visible to members" on public.cells;
drop policy if exists "cells editable by members" on public.cells;
drop policy if exists "cells updatable by members" on public.cells;
drop policy if exists "own progress always visible, others only after reveal or if reveal disabled" on public.cell_progress;
drop policy if exists "only own progress writes" on public.cell_progress;
drop policy if exists "only own progress updates" on public.cell_progress;
drop policy if exists "only own progress deletes" on public.cell_progress;
drop policy if exists "votes visible to members" on public.reveal_votes;
drop policy if exists "own votes" on public.reveal_votes;
drop policy if exists "own votes delete" on public.reveal_votes;
drop policy if exists "bingo events visible to members" on public.bingo_events;
drop policy if exists "bingo events insert by members" on public.bingo_events;
drop policy if exists "notices visible to members" on public.board_notices;
drop policy if exists "notices insert by members" on public.board_notices;
drop policy if exists "reveal sessions visible to members" on public.reveal_sessions;
drop policy if exists "reveal sessions upsert by members" on public.reveal_sessions;
drop policy if exists "reveal sessions update by members" on public.reveal_sessions;
drop policy if exists "reveal downvotes visible to members" on public.reveal_downvotes;
drop policy if exists "reveal downvotes insert by members" on public.reveal_downvotes;
drop policy if exists "reveal downvotes delete own" on public.reveal_downvotes;

create policy "profiles readable by members of shared boards"
  on public.profiles for select
  using (
    id = auth.uid()
    or exists (
      select 1 from public.board_members mine
      join public.board_members theirs on mine.board_id = theirs.board_id
      where mine.user_id = auth.uid() and theirs.user_id = profiles.id
    )
  );

create policy "own profile upsert"
  on public.profiles for insert with check (id = auth.uid());
create policy "own profile update"
  on public.profiles for update using (id = auth.uid());

create policy "boards visible to members"
  on public.boards for select using (public.is_board_member(id) or created_by = auth.uid());
create policy "authenticated users can create boards"
  on public.boards for insert with check (created_by = auth.uid());
create policy "boards updatable by members according to owner_mode"
  on public.boards for update using (public.is_board_member(id));
create policy "boards deletable by creator or owner"
  on public.boards for delete using (created_by = auth.uid() or public.is_board_member(id));

create policy "members visible to members"
  on public.board_members for select using (public.is_board_member(board_id));
create policy "join via membership insert"
  on public.board_members for insert with check (user_id = auth.uid());

create policy "cells visible to members"
  on public.cells for select using (public.is_board_member(board_id));
create policy "cells editable by members"
  on public.cells for insert with check (public.is_board_member(board_id));
create policy "cells updatable by members"
  on public.cells for update using (public.is_board_member(board_id));

create policy "own progress always visible, others only after reveal or if reveal disabled"
  on public.cell_progress for select using (public.progress_is_visible(cell_id, user_id));
create policy "only own progress writes"
  on public.cell_progress for insert with check (user_id = auth.uid());
create policy "only own progress updates"
  on public.cell_progress for update using (user_id = auth.uid());
create policy "only own progress deletes"
  on public.cell_progress for delete using (user_id = auth.uid());

create policy "votes visible to members"
  on public.reveal_votes for select using (public.is_board_member(board_id));
create policy "own votes"
  on public.reveal_votes for insert with check (user_id = auth.uid() and public.is_board_member(board_id));
create policy "own votes delete"
  on public.reveal_votes for delete using (user_id = auth.uid());

create policy "bingo events visible to members"
  on public.bingo_events for select using (public.is_board_member(board_id));
create policy "bingo events insert by members"
  on public.bingo_events for insert with check (public.is_board_member(board_id) and user_id = auth.uid());

create policy "notices visible to members"
  on public.board_notices for select using (public.is_board_member(board_id));
create policy "notices insert by members"
  on public.board_notices for insert with check (public.is_board_member(board_id) and actor_user_id = auth.uid());

create policy "reveal sessions visible to members"
  on public.reveal_sessions for select using (public.is_board_member(board_id));
create policy "reveal sessions upsert by members"
  on public.reveal_sessions for insert with check (public.is_board_member(board_id));
create policy "reveal sessions update by members"
  on public.reveal_sessions for update using (public.is_board_member(board_id));

create policy "reveal downvotes visible to members"
  on public.reveal_downvotes for select using (public.is_board_member(board_id));
create policy "reveal downvotes insert by members"
  on public.reveal_downvotes for insert
  with check (public.is_board_member(board_id) and voter_user_id = auth.uid() and voter_user_id <> target_user_id);
create policy "reveal downvotes delete own"
  on public.reveal_downvotes for delete using (voter_user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Storage bucket + policies
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('cell-photos', 'cell-photos', false)
on conflict (id) do nothing;

drop policy if exists "cell photos read for members" on storage.objects;
drop policy if exists "cell photos upload own" on storage.objects;
drop policy if exists "cell photos update own" on storage.objects;
drop policy if exists "cell photos delete own" on storage.objects;

create policy "cell photos read for members"
  on storage.objects for select
  using (
    bucket_id = 'cell-photos'
    and public.is_board_member((storage.foldername(name))[1]::uuid)
  );

create policy "cell photos upload own"
  on storage.objects for insert
  with check (
    bucket_id = 'cell-photos'
    and auth.uid()::text = (storage.foldername(name))[2]
    and public.is_board_member((storage.foldername(name))[1]::uuid)
  );

create policy "cell photos update own"
  on storage.objects for update
  using (
    bucket_id = 'cell-photos'
    and auth.uid()::text = (storage.foldername(name))[2]
  );

create policy "cell photos delete own"
  on storage.objects for delete
  using (
    bucket_id = 'cell-photos'
    and auth.uid()::text = (storage.foldername(name))[2]
  );
