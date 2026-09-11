-- Creator Cash Flow: Campaign Messages
-- Run with the Supabase SQL editor to create the real-time campaign chat table.
begin;

create table if not exists public.campaign_messages (
  id text primary key,
  campaign_id text not null references public.campaigns(id) on delete cascade,
  sender_user_id text not null references public.users(id) on delete cascade,
  content text not null check (char_length(content) > 0 and char_length(content) <= 2000),
  created_at timestamptz not null default now()
);

create index if not exists idx_messages_campaign on public.campaign_messages(campaign_id, created_at asc);

alter table public.campaign_messages enable row level security;
revoke all privileges on table public.campaign_messages from anon, authenticated;
grant select,insert,update,delete on table public.campaign_messages to service_role;

commit;
