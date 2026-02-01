create table if not exists public.tunnel_projects (
  project_id uuid primary key,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.tunnel_alignments (
  alignment_id uuid primary key,
  project_id uuid not null references public.tunnel_projects(project_id) on delete cascade,
  name text not null,
  geojson jsonb,
  srid int not null default 4326,
  created_at timestamptz not null default now()
);

create index if not exists idx_tunnel_alignments_project_id on public.tunnel_alignments(project_id);

create table if not exists public.tunnel_point_mappings (
  mapping_id uuid primary key,
  project_id uuid not null references public.tunnel_projects(project_id) on delete cascade,
  point_id text not null,
  alignment_id uuid references public.tunnel_alignments(alignment_id) on delete set null,
  chainage_m double precision,
  offset_m double precision,
  side text,
  section_name text,
  structure_part text,
  ring_no int,
  remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, point_id)
);

create index if not exists idx_tunnel_point_mappings_project_id on public.tunnel_point_mappings(project_id);
create index if not exists idx_tunnel_point_mappings_alignment_id on public.tunnel_point_mappings(alignment_id);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_tunnel_point_mappings_updated_at on public.tunnel_point_mappings;
create trigger trg_tunnel_point_mappings_updated_at
before update on public.tunnel_point_mappings
for each row execute function public.set_updated_at();

