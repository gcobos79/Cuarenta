-- CUARENTA — historial de partidas (reemplaza el formulario de Google). Proyecto Supabase «cuarenta-amigos».
-- Cada partida terminada (Solo contra Don Barajón o Amigos en línea) guarda una fila: fecha, hora, jugador 1, jugador 2, puntajes y ganador.
-- Escribir: cualquiera puede AGREGAR una fila (la página no tiene cuentas) pero nadie puede leer, cambiar ni borrar la tabla directamente.
-- Leer y quitar del listado: solo mediante las funciones de abajo, que piden la clave del administrador.

create table public.partidas (
  id       uuid primary key default gen_random_uuid(),            -- lo crea la página: así una partida no se guarda dos veces
  creada   timestamptz not null default now(),
  fecha    date not null,                                          -- fecha y hora locales de quien jugó
  hora     time not null,
  modo     text not null check (modo in ('solo', 'amigos')),
  jugador1 text not null check (char_length(jugador1) between 1 and 40),
  jugador2 text not null check (char_length(jugador2) between 1 and 40),   -- «Don Barajón» en el modo Solo
  puntaje1 smallint not null check (puntaje1 between 0 and 40),
  puntaje2 smallint not null check (puntaje2 between 0 and 40),
  ganador  text not null check (char_length(ganador) between 1 and 40),
  oculta   boolean not null default false                          -- «quitada del listado» por el administrador (no se borra)
);
create index partidas_fecha_hora on public.partidas (fecha desc, hora desc);

alter table public.partidas enable row level security;
revoke all on public.partidas from anon, authenticated;
grant insert (id, fecha, hora, modo, jugador1, jugador2, puntaje1, puntaje2, ganador) on public.partidas to anon, authenticated;
create policy partidas_agregar on public.partidas for insert to anon, authenticated with check (oculta = false and fecha between current_date - 2 and current_date + 2);

-- Verificador del administrador: guarda solo la huella de la clave (la primera vez que el administrador abre el historial).
create table public.admin_clave (
  id          smallint primary key default 1 check (id = 1),
  verificador text not null
);
alter table public.admin_clave enable row level security;
revoke all on public.admin_clave from anon, authenticated;

create function public.historial_es_admin(p_h text, p_crear boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v text; guardado text;
begin
  if p_h is null or p_h !~ '^[0-9a-f]{64}$' then return false; end if;
  v := encode(sha256(convert_to(p_h, 'UTF8')), 'hex');
  select verificador into guardado from public.admin_clave where id = 1;
  if guardado is null then
    if not p_crear then return false; end if;
    insert into public.admin_clave (id, verificador) values (1, v) on conflict do nothing;
    select verificador into guardado from public.admin_clave where id = 1;
  end if;
  return guardado = v;
end $$;
revoke execute on function public.historial_es_admin(text, boolean) from public, anon, authenticated;

-- Lista: primero los juegos actuales (salas en juego) y luego las partidas terminadas, de la más reciente a la más antigua.
-- p_desde = null devuelve todas; si no, solo las de esa fecha en adelante.
create function public.historial_listar(p_h text, p_desde date) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actuales jsonb; terminadas jsonb;
begin
  if not public.historial_es_admin(p_h, true) then raise exception 'acceso denegado' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'codigo', s.codigo,
           'jugador1', coalesce((select j->>'nombre' from jsonb_array_elements(s.jugadores) j where (j->>'asiento')::int = 0), 'Jugador 1'),
           'jugador2', coalesce((select j->>'nombre' from jsonb_array_elements(s.jugadores) j where (j->>'asiento')::int = 1), 'Jugador 2'),
           'puntaje1', coalesce((s.estado->'score'->>0)::int, 0),
           'puntaje2', coalesce((s.estado->'score'->>1)::int, 0),
           'ciclo', s.estado->'cycle', 'seccion', s.estado->'section') order by s.actualizada desc), '[]'::jsonb)
    into actuales
    from public.salas s
   where s.fase = 'jugando' and s.estado is not null and s.actualizada > now() - interval '6 hours';
  select coalesce(jsonb_agg(to_jsonb(t) order by t.fecha desc, t.hora desc), '[]'::jsonb)
    into terminadas
    from (select id, fecha, to_char(hora, 'HH24:MI') as hora, modo, jugador1, jugador2, puntaje1, puntaje2, ganador
            from public.partidas
           where not oculta and (p_desde is null or fecha >= p_desde)
           order by fecha desc, hora desc limit 500) t;
  return jsonb_build_object('actuales', actuales, 'partidas', terminadas);
end $$;

create function public.historial_quitar(p_h text, p_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if not public.historial_es_admin(p_h, false) then raise exception 'acceso denegado' using errcode = '42501'; end if;
  update public.partidas set oculta = true where id = p_id;
  return found;
end $$;

revoke execute on function public.historial_listar(text, date) from public;
revoke execute on function public.historial_quitar(text, uuid) from public;
grant execute on function public.historial_listar(text, date) to anon, authenticated;
grant execute on function public.historial_quitar(text, uuid) to anon, authenticated;
