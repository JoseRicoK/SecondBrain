-- Crear tabla de personas para almacenar información extraída de las entradas del diario

-- Crear tabla people
create table public.people (
  id uuid default uuid_generate_v4() primary key,
  user_id text not null references auth.users(id),
  name text not null,
  details jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- Índices para mejorar el rendimiento
create index people_user_id_idx on public.people(user_id);
create index people_name_idx on public.people(name);

-- Añadir restricción única para evitar duplicados (por usuario y nombre)
alter table public.people 
add constraint people_user_id_name_unique 
unique (user_id, name);

-- Políticas de seguridad RLS (Row Level Security)
alter table public.people enable row level security;

-- Política para seleccionar (ver) personas
create policy "Users can view their own people" 
  on public.people for select using (auth.uid() = user_id);

-- Política para insertar nuevas personas
create policy "Users can insert their own people" 
  on public.people for insert with check (auth.uid() = user_id);

-- Política para actualizar personas existentes
create policy "Users can update their own people" 
  on public.people for update using (auth.uid() = user_id);

-- Política para eliminar personas
create policy "Users can delete their own people" 
  on public.people for delete using (auth.uid() = user_id);

-- Función para actualizar el timestamp cuando se modifica un registro
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger para actualizar el campo updated_at automáticamente
create trigger people_updated_at
  before update on public.people
  for each row
  execute procedure public.handle_updated_at();

-- Comentarios para documentar la tabla
comment on table public.people is 'Almacena información sobre personas mencionadas en las entradas del diario';
comment on column public.people.details is 'Información estructurada sobre la persona en formato JSON';
