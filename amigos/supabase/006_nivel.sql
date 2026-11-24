-- CUARENTA — historial: nivel de juego de Don Barajón (Normal, Avanzado o Experto) en las partidas de Solo; «Amistoso» en las de Amigos.
-- Las partidas anteriores no tienen nivel (columna vacía). historial_listar devuelve también el nivel de cada partida.
alter table public.partidas add column nivel text check (nivel is null or char_length(nivel) between 1 and 20);
grant insert (nivel) on public.partidas to anon, authenticated;
-- (y se vuelve a crear historial_listar con «nivel» en la lista de columnas de las partidas terminadas; ver 004 y 005)
