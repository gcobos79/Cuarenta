-- CUARENTA — historial completo para auditoría (V1.03.77 / V2.33).
-- Cada partida de Solo guarda además: el registro completo de jugadas (texto igual al de «Registro de la partida» + el diagnóstico),
-- «baraja» (el orden de la baraja de cada ciclo y las manos repartidas en cada sección, para comprobar el barajado) y «ases»
-- (cuántos ases de bronce/plata/oro y qué racha de estrellas llevaba el jugador al terminar). Solo se leen con la clave de administrador.
alter table public.partidas
  add column registro text check (registro is null or char_length(registro) <= 400000),
  add column baraja   jsonb check (baraja is null or pg_column_size(baraja) <= 60000),
  add column ases     jsonb check (ases is null or pg_column_size(ases) <= 1000);
grant insert (registro, baraja, ases) on public.partidas to anon, authenticated;

-- La lista añade el modo y si la partida tiene registro completo (sin traer el texto, que pesa).
create or replace function public.historial_listar(p_h text, p_desde date, p_sin_admin boolean) returns jsonb
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
   where s.fase = 'jugando' and s.estado is not null and s.actualizada > now() - interval '45 minutes'
     and (not coalesce(p_sin_admin, false)
          or not exists (select 1 from jsonb_array_elements(s.jugadores) j where coalesce((j->>'adm')::boolean, false)));
  select coalesce(jsonb_agg(to_jsonb(t) order by t.fecha desc, t.hora desc), '[]'::jsonb)
    into terminadas
    from (select id, fecha, to_char(hora, 'HH24:MI') as hora, modo, jugador1, jugador2, puntaje1, puntaje2, ganador, nivel,
                 (registro is not null) as tiene_registro
            from public.partidas
           where not oculta and (p_desde is null or fecha >= p_desde) and (not coalesce(p_sin_admin, false) or not admin)
           order by fecha desc, hora desc limit 500) t;
  return jsonb_build_object('actuales', actuales, 'partidas', terminadas);
end $$;

-- Registros completos de las partidas elegidas (hasta 50 a la vez).
create function public.historial_registros(p_h text, p_ids uuid[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not public.historial_es_admin(p_h, false) then raise exception 'acceso denegado' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(t) order by t.fecha, t.hora)
                     from (select id, fecha, to_char(hora, 'HH24:MI') as hora, modo, jugador1, jugador2, puntaje1, puntaje2, ganador, nivel, registro, baraja, ases
                             from public.partidas where not oculta and id = any (p_ids[1:50])) t), '[]'::jsonb);
end $$;

-- Control de ases: lo último que informó cada jugador de Solo (ases ganados y racha de estrellas por nivel).
create function public.historial_ases(p_h text, p_sin_admin boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not public.historial_es_admin(p_h, false) then raise exception 'acceso denegado' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(t) order by t.jugador)
                     from (select distinct on (jugador1) jugador1 as jugador, ases, fecha, to_char(hora, 'HH24:MI') as hora
                             from public.partidas
                            where modo = 'solo' and ases is not null and not oculta and (not coalesce(p_sin_admin, false) or not admin)
                            order by jugador1, fecha desc, hora desc, creada desc) t), '[]'::jsonb);
end $$;

revoke execute on function public.historial_registros(text, uuid[]) from public;
revoke execute on function public.historial_ases(text, boolean) from public;
grant execute on function public.historial_registros(text, uuid[]) to anon, authenticated;
grant execute on function public.historial_ases(text, boolean) to anon, authenticated;
