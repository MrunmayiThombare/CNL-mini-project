-- GeoTrace schema: stores every traceroute run and its individual hops.

create table if not exists public.traces (
  id uuid primary key default gen_random_uuid(),
  domain text not null,
  resolved_ip text,
  dns_duration_ms integer,
  trace_source text not null default 'simulated', -- 'system' | 'simulated'
  hop_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.trace_hops (
  id uuid primary key default gen_random_uuid(),
  trace_id uuid not null references public.traces (id) on delete cascade,
  ttl integer not null,
  ip text,
  latency_ms numeric,
  status text not null, -- 'RESPONDED' | 'TIMEOUT' | 'DESTINATION_REACHED'
  is_private boolean not null default false,
  lat double precision,
  lon double precision,
  city text,
  region text,
  country text,
  isp text,
  org text
);

create index if not exists trace_hops_trace_id_idx on public.trace_hops (trace_id);
create index if not exists traces_created_at_idx on public.traces (created_at desc);
create index if not exists traces_domain_idx on public.traces (domain);

-- Row Level Security: this demo app has no auth, so we allow anonymous
-- read/insert via the public "anon" role, scoped through the Edge Functions
-- (which use the service role key server-side). Anonymous clients reading
-- history directly via supabase-js only get SELECT.
alter table public.traces enable row level security;
alter table public.trace_hops enable row level security;

create policy "Public read access to traces"
  on public.traces for select
  using (true);

create policy "Public read access to trace_hops"
  on public.trace_hops for select
  using (true);

-- Inserts/updates are performed only by Edge Functions using the service
-- role key, which bypasses RLS by design — no anon insert policy is created,
-- so browsers cannot write directly to these tables.
