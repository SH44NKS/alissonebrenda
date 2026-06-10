create table if not exists public.wedding_members (
  couple_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (couple_id, user_id)
);

create table if not exists public.wedding_state (
  couple_id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.wedding_members enable row level security;
alter table public.wedding_state enable row level security;

drop policy if exists "members can read members" on public.wedding_members;
create policy "members can read members"
on public.wedding_members
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.wedding_members m
    where m.couple_id = wedding_members.couple_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists "members can read state" on public.wedding_state;
create policy "members can read state"
on public.wedding_state
for select
to authenticated
using (
  exists (
    select 1
    from public.wedding_members m
    where m.couple_id = wedding_state.couple_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists "members can create state" on public.wedding_state;
create policy "members can create state"
on public.wedding_state
for insert
to authenticated
with check (
  exists (
    select 1
    from public.wedding_members m
    where m.couple_id = wedding_state.couple_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists "members can update state" on public.wedding_state;
create policy "members can update state"
on public.wedding_state
for update
to authenticated
using (
  exists (
    select 1
    from public.wedding_members m
    where m.couple_id = wedding_state.couple_id
      and m.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.wedding_members m
    where m.couple_id = wedding_state.couple_id
      and m.user_id = auth.uid()
  )
);

create or replace function public.touch_wedding_state_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

drop trigger if exists wedding_state_updated_at on public.wedding_state;
create trigger wedding_state_updated_at
before update on public.wedding_state
for each row
execute function public.touch_wedding_state_updated_at();

do $$
begin
  alter publication supabase_realtime add table public.wedding_state;
exception
  when duplicate_object then null;
  when undefined_object then null;
end;
$$;

-- Depois de criar as contas no app, adicione os dois usuários como membros.
-- Troque os UUIDs pelos IDs em Authentication > Users.
-- insert into public.wedding_members (couple_id, user_id, role)
-- values
--   ('alisson-brenda', 'UUID_DO_ALISSON', 'admin'),
--   ('alisson-brenda', 'UUID_DA_BRENDA', 'admin');
