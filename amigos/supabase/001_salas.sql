-- CUARENTA · Amigos — base de datos de las salas (proyecto Supabase «cuarenta-amigos»).
-- Modelo de confianza entre amigos: no hay cuentas; quien tiene el código de la sala puede entrar. El celular anfitrión reparte y
-- valida las jugadas: los demás envían sus jugadas como «acciones» y el anfitrión escribe el estado nuevo de la sala.
-- Las cartas de todos viajan dentro del estado (un jugador con conocimientos técnicos podría verlas). Para endurecerlo más adelante
-- el reparto pasaría a una función del servidor.

create table public.salas (
  codigo        text primary key
                check (codigo ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{3}$'),      -- 3 caracteres sin I, O, 0 ni 1
  fase          text not null default 'espera' check (fase in ('espera', 'jugando', 'fin')),
  maximo        smallint not null default 2 check (maximo in (2, 4)),            -- 1 contra 1 o por parejas
  opciones      jsonb not null default '{}'::jsonb,                              -- 38 que no juegan, 4 de falta
  jugadores     jsonb not null default '[]'::jsonb,                              -- [{id, nombre, asiento}]
  estado        jsonb,                                                           -- estado completo de la partida (reglas.js)
  anfitrion     text not null check (char_length(anfitrion) between 1 and 40),   -- identificador del celular anfitrión
  version       integer not null default 0,                                      -- sube con cada jugada
  ultima_accion bigint not null default 0,                                       -- última acción ya aplicada por el anfitrión
  creada        timestamptz not null default now(),
  actualizada   timestamptz not null default now(),
  constraint salas_tam_estado    check (estado is null or pg_column_size(estado) < 30000),
  constraint salas_tam_jugadores check (pg_column_size(jugadores) < 2000),
  constraint salas_tam_opciones  check (pg_column_size(opciones) < 500)
);

create table public.acciones (
  id      bigint generated always as identity primary key,
  sala    text not null references public.salas (codigo) on delete cascade,
  jugador text not null check (char_length(jugador) between 1 and 40),
  tipo    text not null check (tipo in ('unirse', 'jugar', 'ronda', 'salir')),
  datos   jsonb not null default '{}'::jsonb check (pg_column_size(datos) < 2000),
  creada  timestamptz not null default now()
);
create index acciones_sala_id on public.acciones (sala, id);

-- La fecha de actualización se pone sola.
create function public.salas_tocar() returns trigger language plpgsql set search_path = '' as $$
begin new.actualizada := now(); return new; end $$;
create trigger salas_tocar before update on public.salas for each row execute function public.salas_tocar();

-- Al crear una sala se borran las que llevan más de 24 horas sin actividad (así la tabla no crece y los códigos se reutilizan).
create function public.salas_limpiar() returns trigger language plpgsql security definer set search_path = '' as $$
begin delete from public.salas where actualizada < now() - interval '24 hours'; return new; end $$;
create trigger salas_limpiar before insert on public.salas for each statement execute function public.salas_limpiar();

-- Permisos (sin cuentas: rol anónimo de la página).
alter table public.salas    enable row level security;
alter table public.acciones enable row level security;

create policy salas_ver        on public.salas    for select to anon, authenticated using (true);
create policy salas_crear      on public.salas    for insert to anon, authenticated with check (true);
create policy salas_actualizar on public.salas    for update to anon, authenticated using (true) with check (true);
create policy salas_borrar     on public.salas    for delete to anon, authenticated using (fase = 'fin');

create policy acciones_ver     on public.acciones for select to anon, authenticated using (true);
create policy acciones_crear   on public.acciones for insert to anon, authenticated with check (true);
create policy acciones_borrar  on public.acciones for delete to anon, authenticated using (true);

grant select, insert, update, delete on public.salas to anon, authenticated;
grant select, insert, delete on public.acciones to anon, authenticated;

-- Tiempo real: los celulares reciben los cambios de la sala y las acciones nuevas al instante.
alter publication supabase_realtime add table public.salas, public.acciones;
