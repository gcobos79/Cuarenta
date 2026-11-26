-- CUARENTA — se deshacen los cambios 007 y 008 (registro completo, barajas, motivo). Se conservan los ases (columna «ases» y función historial_ases).
-- Motivo: el detalle de cada partida ya no se guarda en el servidor; cada jugador ve su partida actual y la anterior en su dispositivo.
-- Orden seguido: primero se publicó el juego que ya no envía registro, baraja ni motivo (Solo V1.03.83 / Amigos V2.37) y después se aplicó esto.
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
    from (select id, fecha, to_char(hora, 'HH24:MI') as hora, jugador1, jugador2, puntaje1, puntaje2, ganador, nivel
            from public.partidas
           where not oculta and (p_desde is null or fecha >= p_desde) and (not coalesce(p_sin_admin, false) or not admin)
           order by fecha desc, hora desc limit 500) t;
  return jsonb_build_object('actuales', actuales, 'partidas', terminadas);
end $$;
drop function public.historial_registros(text, uuid[]);
alter table public.partidas drop column registro, drop column baraja, drop column motivo;
-- las tres partidas de prueba (generadas por simulaciones, no reales) se borran definitivamente
delete from public.partidas where id in ('474bee21-078a-4db1-8dd6-9cf20183a16b','5a1e1cba-4c71-4294-9686-7b98812c228f','4ec50521-0b71-4a36-a3d5-a72c3913363e');
