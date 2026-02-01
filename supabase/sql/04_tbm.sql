create table if not exists public.tbm_telemetry (
  record_id uuid primary key,
  project_id uuid not null references public.tunnel_projects(project_id) on delete cascade,
  machine_id text not null,
  ts timestamptz not null,
  chainage_m double precision,
  ring_no int,
  thrust_kN double precision,
  torque_kNm double precision,
  face_pressure_kPa double precision,
  slurry_pressure_kPa double precision,
  advance_rate_mm_min double precision,
  cutterhead_rpm double precision,
  pitch_deg double precision,
  roll_deg double precision,
  yaw_deg double precision,
  grout_volume_L double precision,
  grout_pressure_kPa double precision,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, machine_id, ts)
);

create index if not exists idx_tbm_telemetry_project_id on public.tbm_telemetry(project_id);
create index if not exists idx_tbm_telemetry_machine_id on public.tbm_telemetry(machine_id);
create index if not exists idx_tbm_telemetry_ts on public.tbm_telemetry(ts);

drop trigger if exists trg_tbm_telemetry_updated_at on public.tbm_telemetry;
create trigger trg_tbm_telemetry_updated_at
before update on public.tbm_telemetry
for each row execute function public.set_updated_at();

