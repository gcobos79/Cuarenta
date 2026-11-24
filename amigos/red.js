/* CUARENTA · Amigos — conexión con Supabase (V2.03).
   La llave de abajo es la llave PÚBLICA del proyecto (está pensada para ir dentro de la página); lo que se puede hacer con ella lo
   limitan las reglas de seguridad de las tablas (ver supabase/001_salas.sql).
   Las escuchas usan tiempo real y, como respaldo, consultan cada pocos segundos por si algún aviso se pierde. */
(function (root) {
  'use strict';
  const URL = 'https://pzfddyfmvjxelwmugfvo.supabase.co', LLAVE = 'sb_publishable_-x8ilMiv0S4Z5UvQuKyrog_OdkyHv0u';
  const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin I, O, 0 ni 1
  let cli = null;

  const disponible = () => !!(root.supabase && root.supabase.createClient);
  function cliente() {
    if (!cli) {
      if (!disponible()) throw new Error('sin-libreria');
      cli = root.supabase.createClient(URL, LLAVE, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    }
    return cli;
  }
  const normaliza = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
  const codigoValido = c => /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{3}$/.test(c);
  function codigoAzar() { let s = ''; for (let i = 0; i < 3; i++) s += ALFABETO[Math.floor(Math.random() * ALFABETO.length)]; return s; }
  const nuevoId = () => (root.crypto && crypto.randomUUID ? crypto.randomUUID() : 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10)).slice(0, 36);

  async function crearSala({ id, nombre, maximo, opciones }) {
    for (let i = 0; i < 8; i++) {
      const codigo = codigoAzar();
      const { data, error } = await cliente().from('salas').insert({ codigo, anfitrion: id, maximo: maximo || 2, opciones: opciones || {}, jugadores: [{ id, nombre, asiento: 0 }] }).select().single();
      if (!error) return data;
      if (error.code !== '23505') throw error; // 23505: ese código ya existe; se prueba otro
    }
    throw new Error('sin-codigo');
  }
  async function leerSala(codigo) {
    const { data, error } = await cliente().from('salas').select('*').eq('codigo', codigo).maybeSingle();
    if (error) throw error; return data;
  }
  async function enviarAccion(codigo, id, tipo, datos) {
    const { error } = await cliente().from('acciones').insert({ sala: codigo, jugador: id, tipo, datos: datos || {} });
    if (error) throw error;
  }
  async function accionesDesde(codigo, desde) {
    const { data, error } = await cliente().from('acciones').select('*').eq('sala', codigo).gt('id', desde).order('id');
    if (error) throw error; return data || [];
  }
  async function guardar(codigo, cambios) {
    const { error } = await cliente().from('salas').update(cambios).eq('codigo', codigo);
    if (error) throw error;
  }
  async function cerrarSala(codigo) { // las salas solo se pueden borrar cuando están terminadas
    await guardar(codigo, { fase: 'fin' });
    await cliente().from('salas').delete().eq('codigo', codigo);
  }

  // Cambios de la sala: cb(sala) con cada cambio; cb(null) si la sala desapareció.
  function escucharSala(codigo, cb, msRespaldo) {
    let ultima = null, vista = false, parado = false;
    const entrega = s => { if (parado) return; if (!s) { if (vista) { vista = false; cb(null); } return; } vista = true; if (s.actualizada === ultima) return; ultima = s.actualizada; cb(s); };
    const canal = cliente().channel('sala-' + codigo + '-' + Math.random().toString(36).slice(2, 6))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'salas', filter: 'codigo=eq.' + codigo }, p => entrega(p.new))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'salas', filter: 'codigo=eq.' + codigo }, () => entrega(null))
      .subscribe();
    const t = setInterval(async () => { try { entrega(await leerSala(codigo)); } catch (e) { /* sin conexión: se reintenta */ } }, msRespaldo || 3000);
    return { parar() { parado = true; clearInterval(t); cliente().removeChannel(canal); }, ver(s) { vista = true; ultima = s && s.actualizada; } };
  }

  // Acciones nuevas de los jugadores (las lee el anfitrión): cb(accion) en orden de id.
  function escucharAcciones(codigo, desde, cb, msRespaldo) {
    let visto = desde || 0, parado = false, ocupado = false;
    const pend = [];
    const vaciar = async () => { if (ocupado) return; ocupado = true; try { while (pend.length && !parado) { pend.sort((a, b) => a.id - b.id); const a = pend.shift(); if (a.id > visto) { visto = a.id; await cb(a); } } } finally { ocupado = false; } };
    const canal = cliente().channel('acc-' + codigo + '-' + Math.random().toString(36).slice(2, 6))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'acciones', filter: 'sala=eq.' + codigo }, p => { pend.push(p.new); vaciar(); })
      .subscribe();
    const sondeo = async () => { try { (await accionesDesde(codigo, visto)).forEach(a => pend.push(a)); vaciar(); } catch (e) { /* se reintenta */ } };
    const t = setInterval(sondeo, msRespaldo || 2000); sondeo();
    return { parar() { parado = true; clearInterval(t); cliente().removeChannel(canal); } };
  }

  // Quién está conectado: onCambio(lista de ids).
  function presencia(codigo, yo, onCambio) {
    const canal = cliente().channel('pres-' + codigo, { config: { presence: { key: yo.id } } });
    canal.on('presence', { event: 'sync' }, () => onCambio(Object.keys(canal.presenceState())));
    canal.subscribe(estado => { if (estado === 'SUBSCRIBED') canal.track({ id: yo.id, nombre: yo.nombre }); });
    return { parar() { cliente().removeChannel(canal); } };
  }

  root.Red = { disponible, normaliza, codigoValido, codigoAzar, nuevoId, crearSala, leerSala, enviarAccion, accionesDesde, guardar, cerrarSala, escucharSala, escucharAcciones, presencia };
})(typeof self !== 'undefined' ? self : this);
