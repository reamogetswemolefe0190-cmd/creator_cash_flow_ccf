-- Private direct-Meta pilot storage. Apply using the Supabase SQL editor.
begin;
create table if not exists public.instagram_connections (
  user_id text not null references public.users(id) on delete cascade,
  instagram_id text not null,
  page_id text not null,
  meta_user_id text not null,
  username text not null,
  token_ciphertext text not null,
  expires_at timestamptz not null,
  connected_at timestamptz not null default now(),
  primary key (user_id, instagram_id)
);
create table if not exists public.instagram_oauth_attempts (
  state_hash text primary key,
  cookie_hash text not null,
  user_id text not null references public.users(id) on delete cascade,
  status text not null check (status in ('pending','processing','complete','failed')),
  result_code text,
  expires_at timestamptz not null
);
create index if not exists instagram_attempts_user_expiry on public.instagram_oauth_attempts(user_id, expires_at);
-- Receipts contain no Meta ID, CCF user ID or provider token.
create table if not exists public.instagram_deletion_receipts (
  code text primary key,
  completed_at timestamptz not null default now()
);
alter table public.instagram_connections enable row level security;
alter table public.instagram_oauth_attempts enable row level security;
alter table public.instagram_deletion_receipts enable row level security;
revoke all on public.instagram_connections, public.instagram_oauth_attempts, public.instagram_deletion_receipts from public, anon, authenticated;
grant select, insert, update, delete on public.instagram_connections, public.instagram_oauth_attempts, public.instagram_deletion_receipts to service_role;
commit;
