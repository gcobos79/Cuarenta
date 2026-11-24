-- CUARENTA — historial: opción de ocultar las partidas del administrador (en lugar de quitar partida por partida).
-- Cada partida guarda si participó el administrador (columna «admin»: la marca la página; solo sirve para ocultarla del listado del administrador).
-- historial_listar recibe p_sin_admin: si es verdadero, no devuelve las partidas ni las salas en juego donde participa el administrador.
-- La función de quitar partidas (historial_quitar) deja de usarse: se le retira el permiso de ejecución.

alter table public.partidas add column admin boolean not null default false;
grant insert (admin) on public.partidas to anon, authenticated;

create function public.historial_listar(p_h text, p_desde date, p_sin_admin boolean) returns jsonb
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
   where s.fase = 'jugando' and s.estado is not null and s.actualizada > now() - interval '6 hours'
     and (not coalesce(p_sin_admin, false)
          or not exists (select 1 from jsonb_array_elements(s.jugadores) j where coalesce((j->>'adm')::boolean, false)));
  select coalesce(jsonb_agg(to_jsonb(t) order by t.fecha desc, t.hora desc), '[]'::jsonb)
    into terminadas
    from (select id, fecha, to_char(hora, 'HH24:MI') as hora, jugador1, jugador2, puntaje1, puntaje2, ganador
            from public.partidas
           where not oculta and (p_desde is null or fecha >= p_desde) and (not coalesce(p_sin_admin, false) or not admin)
           order by fecha desc, hora desc limit 500) t;
  return jsonb_build_object('actuales', actuales, 'partidas', terminadas);
end $$;

revoke execute on function public.historial_listar(text, date, boolean) from public;
grant execute on function public.historial_listar(text, date, boolean) to anon, authenticated;
revoke execute on function public.historial_listar(text, date) from anon, authenticated;
revoke execute on function public.historial_quitar(text, uuid) from anon, authenticated;
