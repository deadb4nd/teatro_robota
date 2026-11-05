create table if not exists public.people (
  id bigint generated always as identity primary key,
  name text not null unique check (length(btrim(name)) > 0),
  created_at timestamptz not null default now()
);

create unique index if not exists people_name_lower_idx
  on public.people (lower(name));

create table if not exists public.availability (
  id bigint generated always as identity primary key,
  person_id bigint not null references public.people(id) on delete cascade,
  date date not null,
  available boolean not null default false,
  preferred_start time,
  updated_at timestamptz not null default now(),
  unique (person_id, date)
);

create table if not exists public.shifts (
  id bigint generated always as identity primary key,
  date date not null,
  role text not null,
  slot integer not null,
  person_id bigint references public.people(id) on delete set null,
  start_time time,
  clock_out time,
  updated_at timestamptz not null default now(),
  unique (date, role, slot),
  check (
    (role = 'BAR' and slot between 0 and 5) or
    (role = 'KEL' and slot between 0 and 3) or
    (role = 'BAK' and slot between 0 and 3) or
    (role = 'PROMO' and slot = 0)
  ),
  check (extract(isodow from date) in (5, 6)),
  check (clock_out is null or start_time is not null)
);

create index if not exists shifts_date_idx on public.shifts (date);
create index if not exists shifts_person_idx on public.shifts (person_id);

alter table public.people enable row level security;
alter table public.availability enable row level security;
alter table public.shifts enable row level security;

drop policy if exists "public people access" on public.people;
create policy "public people access"
  on public.people for all
  to anon, authenticated
  using (true) with check (true);

drop policy if exists "public availability access" on public.availability;
create policy "public availability access"
  on public.availability for all
  to anon, authenticated
  using (true) with check (true);

drop policy if exists "public shifts access" on public.shifts;
create policy "public shifts access"
  on public.shifts for all
  to anon, authenticated
  using (true) with check (true);

grant usage on schema public to anon, authenticated;
grant all on public.people, public.availability, public.shifts to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

-- Przykładowe osoby startowe. Możesz je usunąć/zmienić w zakładce "Osoby".
insert into public.people (name)
values
  ('Mimi'),
  ('Haja'),
  ('Pupka'),
  ('Pupeczka'),
  ('Kupeczka'),
  ('Kupulutka')
on conflict do nothing;
