-- CUARENTA — historial: cómo terminó cada partida («motivo»): 'puntos' (alguien llegó a 40), 'cuatro' (cuatro cartas iguales en el reparto,
-- que termina el juego al instante, incluso con 0–0) o 'abandono' (Amigos: un jugador salió). Las partidas anteriores no lo tienen (null):
-- la página lo deduce (Solo sin 40 puntos = cuatro iguales; Amigos sin 40 puntos = abandono).
-- historial_listar devuelve también «motivo» (ver 004–007; el cuerpo completo está aplicado en la base).
alter table public.partidas add column motivo text check (motivo is null or motivo in ('puntos','cuatro','abandono'));
grant insert (motivo) on public.partidas to anon, authenticated;
-- Se ocultaron (oculta = true, sin borrar) dos partidas 0–0 de prueba del 26/11 generadas por una simulación de reparto.
