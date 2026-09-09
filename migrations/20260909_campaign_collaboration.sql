-- Creator Cash Flow: consent-scoped campaign collaboration foundation
-- Run with the Supabase SQL editor before enabling agency/brand workspaces.
begin;

alter table public.users add column if not exists phyllo_user_id text;

create table if not exists public.organizations (
  id text primary key,
  name text not null check (char_length(name) between 2 and 120),
  type text not null check (type in ('agency','brand')),
  created_by text not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id text not null references public.organizations(id) on delete cascade,
  user_id text not null references public.users(id) on delete cascade,
  role text not null check (role in ('owner','manager','analyst','creator','brand_viewer')),
  status text not null default 'active' check (status in ('active','suspended')),
  created_at timestamptz not null default now(),
  primary key (organization_id,user_id)
);

create table if not exists public.organization_invitations (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null check (role in ('manager','analyst','creator','brand_viewer')),
  invited_by text not null references public.users(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  expires_at timestamptz not null,
  accepted_by text references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.campaigns (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  brand_organization_id text references public.organizations(id) on delete set null,
  name text not null check (char_length(name) between 2 and 160),
  brief text not null default '',
  status text not null default 'draft' check (status in ('draft','inviting','active','review','complete','cancelled')),
  starts_on date,
  ends_on date,
  currency text not null default 'ZAR',
  fixed_fee numeric(12,2) not null default 0 check (fixed_fee >= 0),
  created_by text not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.campaign_creators (
  campaign_id text not null references public.campaigns(id) on delete cascade,
  creator_user_id text not null references public.users(id) on delete cascade,
  assigned_by text not null references public.users(id) on delete restrict,
  consent_status text not null default 'invited' check (consent_status in ('invited','accepted','declined','revoked')),
  consented_at timestamptz,
  data_scope jsonb not null default '{"identity":true,"engagement":true,"audience":false,"income":false}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (campaign_id,creator_user_id)
);

create table if not exists public.campaign_deliverables (
  id text primary key,
  campaign_id text not null references public.campaigns(id) on delete cascade,
  creator_user_id text not null references public.users(id) on delete cascade,
  title text not null,
  platform text not null,
  external_content_id text,
  content_url text,
  status text not null default 'planned' check (status in ('planned','submitted','revision','approved','published')),
  due_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.campaign_metric_snapshots (
  id text primary key,
  campaign_id text not null references public.campaigns(id) on delete cascade,
  deliverable_id text references public.campaign_deliverables(id) on delete cascade,
  creator_user_id text not null references public.users(id) on delete cascade,
  provider text not null default 'phyllo',
  metric_name text not null,
  metric_value numeric(18,4) not null check (metric_value >= 0),
  captured_at timestamptz not null,
  source_updated_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.campaign_access_grants (
  id text primary key,
  campaign_id text not null references public.campaigns(id) on delete cascade,
  grantee_organization_id text references public.organizations(id) on delete cascade,
  grantee_user_id text references public.users(id) on delete cascade,
  granted_by text not null references public.users(id) on delete restrict,
  scope jsonb not null default '{"deliverables":true,"engagement":true,"audience":false,"income":false}'::jsonb,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (grantee_organization_id is not null or grantee_user_id is not null)
);

create table if not exists public.campaign_milestones (
  id text primary key,
  campaign_id text not null references public.campaigns(id) on delete cascade,
  name text not null,
  metric_name text not null,
  target_value numeric(18,4) not null check (target_value > 0),
  bonus_amount numeric(12,2) not null default 0 check (bonus_amount >= 0),
  status text not null default 'tracking' check (status in ('tracking','verification','eligible','approved','disputed','paid')),
  reached_at timestamptz,
  verification_ends_at timestamptz,
  approved_by text references public.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_org_members_user on public.organization_members(user_id);
create index if not exists idx_org_invites_email on public.organization_invitations(lower(email),status);
create index if not exists idx_campaigns_org on public.campaigns(organization_id,created_at desc);
create index if not exists idx_campaign_creators_user on public.campaign_creators(creator_user_id,consent_status);
create index if not exists idx_deliverables_campaign on public.campaign_deliverables(campaign_id);
create index if not exists idx_metrics_campaign_latest on public.campaign_metric_snapshots(campaign_id,captured_at desc);
create index if not exists idx_access_campaign on public.campaign_access_grants(campaign_id);
create index if not exists idx_milestones_campaign on public.campaign_milestones(campaign_id,status);

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_invitations enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_creators enable row level security;
alter table public.campaign_deliverables enable row level security;
alter table public.campaign_metric_snapshots enable row level security;
alter table public.campaign_access_grants enable row level security;
alter table public.campaign_milestones enable row level security;

revoke all privileges on table public.organizations, public.organization_members,
  public.organization_invitations, public.campaigns, public.campaign_creators,
  public.campaign_deliverables, public.campaign_metric_snapshots,
  public.campaign_access_grants, public.campaign_milestones from anon, authenticated;

grant select,insert,update,delete on table public.organizations, public.organization_members,
  public.organization_invitations, public.campaigns, public.campaign_creators,
  public.campaign_deliverables, public.campaign_metric_snapshots,
  public.campaign_access_grants, public.campaign_milestones to service_role;

commit;
