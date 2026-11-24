-- Amigos V2.05: jugar otra vez en la misma sala. Se permite un tipo de acción nuevo: «revancha» (cada jugador avisa que quiere jugar otra vez).
-- Solo amplía la lista de tipos permitidos; no borra ni modifica datos.
alter table public.acciones
  drop constraint acciones_tipo_check,
  add constraint acciones_tipo_check check (tipo in ('unirse', 'jugar', 'ronda', 'salir', 'revancha'));
