-- Tick Analytics database schema.
-- Run this once in Supabase: Dashboard > SQL Editor > New query > paste > Run.
-- It is safe to re-run: every statement is idempotent.
--
-- Security model: Row Level Security is ON for every table with NO policies,
-- so the public "anon" key can read or write nothing. All data access happens
-- on the server with the service role key, after the app checks the user's
-- role (see src/lib/auth.ts).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- enums
do $$ begin
  create type user_role as enum ('admin', 'leader', 'member');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_status as enum ('open', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type recur_frequency as enum ('weekly', 'monthly', 'quarterly', 'half_yearly');
exception when duplicate_object then null; end $$;

-- working_day: Nth working day of the month (or week)
-- calendar_day: fixed date (day N of month, or weekday N for weekly)
-- last_working_day: last working day of the month (or week)
do $$ begin
  create type recur_rule as enum ('working_day', 'calendar_day', 'last_working_day');
exception when duplicate_object then null; end $$;

do $$ begin
  create type request_status as enum ('pending', 'approved', 'rejected', 'cancelled');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------- teams & people
create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text not null,
  role user_role not null default 'member',
  team_id uuid references teams (id) on delete set null,
  active boolean not null default true,
  email_notifications boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- holidays
create table if not exists holidays (
  id uuid primary key default gen_random_uuid(),
  holiday_date date not null unique,
  name text not null,
  -- 'google' = synced from the public Bangladesh holiday calendar, 'manual' = added by an admin
  source text not null default 'manual',
  -- inactive rows are kept (e.g. observances, or a synced day the admin overrode) but are not treated as holidays
  is_active boolean not null default true,
  -- once an admin edits a synced row, the sync leaves it alone
  locked boolean not null default false,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- recurring task definitions
create table if not exists recurring_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  category text not null default 'General',
  assignee_id uuid not null references profiles (id),
  created_by uuid not null references profiles (id),
  frequency recur_frequency not null,
  rule recur_rule not null,
  -- working_day: N (1 = first working day). calendar_day: day of month 1-31, or weekday 0-6 (Sun-Sat) for weekly.
  rule_value int not null default 1,
  -- quarterly: month 1-3 inside the quarter. half_yearly: month 1-6 inside the half. Ignored otherwise.
  period_month int not null default 1,
  -- how many working days before the due date the task appears on the dashboard
  lead_days int not null default 3,
  start_date date not null default current_date,
  end_date date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- tasks (ad hoc + generated occurrences)
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  recurring_id uuid references recurring_tasks (id) on delete set null,
  -- e.g. 2026-11, 2026-Q4, 2026-H2, 2026-W2026-11-22; unique per recurring task so it is never posted twice
  period_key text,
  title text not null,
  description text not null default '',
  category text not null default 'General',
  assignee_id uuid not null references profiles (id),
  created_by uuid not null references profiles (id),
  due_date date not null,
  -- due date as first scheduled; used to measure on-time completion and to re-schedule after holiday changes
  original_due_date date not null,
  visible_from date not null,
  status task_status not null default 'open',
  completed_at timestamptz,
  completed_on date,
  created_at timestamptz not null default now(),
  unique (recurring_id, period_key)
);
create index if not exists tasks_assignee_idx on tasks (assignee_id, status, due_date);
create index if not exists tasks_due_idx on tasks (due_date);

create table if not exists task_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks (id) on delete cascade,
  actor_id uuid references profiles (id),
  -- created | remark | completed | reopened | deadline_requested | deadline_approved | deadline_rejected
  -- | transfer_requested | transfer_accepted | transfer_declined | reassigned | rescheduled
  kind text not null,
  body text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists task_events_task_idx on task_events (task_id, created_at);

create table if not exists deadline_requests (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks (id) on delete cascade,
  requested_by uuid not null references profiles (id),
  current_due date not null,
  proposed_due date not null,
  reason text not null default '',
  status request_status not null default 'pending',
  decided_by uuid references profiles (id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists deadline_requests_one_pending
  on deadline_requests (task_id) where status = 'pending';

create table if not exists transfers (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks (id) on delete cascade,
  from_user uuid not null references profiles (id),
  to_user uuid not null references profiles (id),
  note text not null default '',
  status request_status not null default 'pending',
  responded_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists transfers_one_pending
  on transfers (task_id) where status = 'pending';

-- ---------------------------------------------------------------- notifications
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  title text not null,
  body text not null default '',
  link text not null default '/',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on notifications (user_id, created_at desc);

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- lock everything down
alter table teams enable row level security;
alter table profiles enable row level security;
alter table holidays enable row level security;
alter table recurring_tasks enable row level security;
alter table tasks enable row level security;
alter table task_events enable row level security;
alter table deadline_requests enable row level security;
alter table transfers enable row level security;
alter table notifications enable row level security;
alter table push_subscriptions enable row level security;

insert into teams (name)
select 'Credit Analytics'
where not exists (select 1 from teams);

-- the server (service role) needs full access; anon/authenticated get nothing (RLS has no policies)
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
