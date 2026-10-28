-- Migración inicial para la práctica Star Wars: tablas planets y characters con RLS e índices

-- Tabla de planetas obtenidos desde SWAPI
create table if not exists public.planets (
  id integer primary key,
  name text not null,
  source_url text unique not null
);

-- Tabla de personajes obtenidos desde SWAPI
-- Nota: campos como height, mass y birth_year se almacenan como text debido a valores 'unknown', 'n/a' y sufijos 'BBY/ABY'
create table if not exists public.characters (
  id integer primary key,
  name text not null,
  gender text,
  birth_year text,
  height text,
  mass text,
  eye_color text,
  hair_color text,
  planet_id integer references public.planets(id) on delete set null,
  source_url text unique not null,
  imported_at timestamptz default now() not null
);

-- Índices para optimizar listado, ordenamiento, búsqueda por nombre y relación con planetas
create index if not exists idx_characters_name on public.characters (name);
create index if not exists idx_characters_planet_id on public.characters (planet_id);

-- Habilitar Row Level Security (RLS)
alter table public.planets enable row level security;
alter table public.characters enable row level security;

-- Políticas de lectura exclusiva para usuarios autenticados
create policy "Permitir lectura de planetas a usuarios autenticados"
  on public.planets
  for select
  to authenticated
  using (true);

create policy "Permitir lectura de personajes a usuarios autenticados"
  on public.characters
  for select
  to authenticated
  using (true);

-- Otorgar permisos mínimos
grant select on table public.planets to authenticated;
grant select on table public.characters to authenticated;

-- Otorgar acceso completo al service_role para las tareas de importación
grant all on table public.planets to service_role;
grant all on table public.characters to service_role;
