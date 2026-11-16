create table if not exists public.workspace_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  snapshot jsonb not null,
  revision bigint not null default 1,
  updated_at timestamptz not null default now(),
  constraint workspace_snapshots_snapshot_object check (jsonb_typeof(snapshot) = 'object')
);

alter table public.workspace_snapshots enable row level security;

drop policy if exists "Users can read their own workspace snapshot" on public.workspace_snapshots;
create policy "Users can read their own workspace snapshot"
  on public.workspace_snapshots for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own workspace snapshot" on public.workspace_snapshots;
create policy "Users can insert their own workspace snapshot"
  on public.workspace_snapshots for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own workspace snapshot" on public.workspace_snapshots;
create policy "Users can update their own workspace snapshot"
  on public.workspace_snapshots for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update on public.workspace_snapshots to authenticated;
