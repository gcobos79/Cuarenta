/* CUARENTA · Amigos — historial de partidas (V2.07).
   Guarda cada partida terminada en la tabla «partidas» de Supabase (fecha, hora, jugadores, puntajes y ganador) y, solo para el administrador,
   la lista y permite quitar partidas del listado. Ver supabase/003_partidas.sql: la página solo puede AGREGAR filas; leer y quitar se hace con
   funciones que piden la clave del administrador. Si no hay conexión, la partida queda en una cola y se envía al volver. */
(function (root) {
  'use strict';
  const URL = 'https://pzfddyfmvjxelwmugfvo.supabase.co', LLAVE = 'sb_publishable_-x8ilMiv0S4Z5UvQuKyrog_OdkyHv0u';
  const COLA = 'cuarentaPartidasPendientes', SAL = 'cuarenta-don-barajon:historial:v1';
  const pad = n => String(n).padStart(2, '0');
  const nuevoId = () => (root.crypto && crypto.randomUUID) ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
  const fechaLocal = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const horaLocal = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const nombre = (t, otro) => String(t == null ? '' : t).replace(/\s+/g, ' ').trim().slice(0, 40) || otro;
  const punto = n => Math.max(0, Math.min(40, Math.round(Number(n) || 0)));

  // Nivel de juego: el de Don Barajón en Solo (Normal, Avanzado o Experto) y «Amistoso» en Amigos
  const nivelDe = p => { const n = String(p.nivel == null ? '' : p.nivel).trim().slice(0, 20); return n || (p.modo === 'solo' ? null : 'Amistoso'); };
  // Fila lista para guardar. p = { modo, jugador1, jugador2, puntaje1, puntaje2, ganador }
  function fila(p, ahora) {
    const d = ahora || new Date();
    const j1 = nombre(p.jugador1, 'Jugador 1'), j2 = nombre(p.jugador2, 'Jugador 2');
    return { id: p.id || nuevoId(), fecha: fechaLocal(d), hora: horaLocal(d), modo: p.modo === 'solo' ? 'solo' : 'amigos', jugador1: j1, jugador2: j2,
      puntaje1: punto(p.puntaje1), puntaje2: punto(p.puntaje2), admin: !!p.admin, nivel: nivelDe(p), ganador: nombre(p.ganador, punto(p.puntaje1) >= punto(p.puntaje2) ? j1 : j2) };
  }
  // Fecha «desde» para el filtro: hoy = 1 día, 3 días, 5 días; todos = null.
  function desde(dias, ahora) {
    if (!dias) return null;
    const d = new Date(ahora || Date.now()); d.setDate(d.getDate() - (dias - 1)); return fechaLocal(d);
  }

  const leerCola = () => { try { const a = JSON.parse(localStorage.getItem(COLA) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
  const escribirCola = a => { try { localStorage.setItem(COLA, JSON.stringify(a.slice(-50))); } catch (e) { } };
  async function enviar(f) { // true si quedó guardada (201) o ya estaba (409)
    try {
      const r = await fetch(URL + '/rest/v1/partidas', { method: 'POST', keepalive: true,
        headers: { apikey: LLAVE, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify(f) });
      if (r.ok || r.status === 409) return true;
      return r.status >= 400 && r.status < 500 && r.status !== 408 && r.status !== 429 ? true /* la base la rechazó: no se reintenta */ : false;
    } catch (e) { return false; }
  }
  let vaciando = false;
  async function vaciarCola() {
    if (vaciando) return; vaciando = true;
    try { for (const f of leerCola()) { if (await enviar(f)) escribirCola(leerCola().filter(x => x.id !== f.id)); else break; } } finally { vaciando = false; }
  }
  function guardar(p) { const f = fila(p); escribirCola([...leerCola(), f]); vaciarCola(); return f; }
  if (root.addEventListener) { root.addEventListener('online', vaciarCola); root.addEventListener('load', () => setTimeout(vaciarCola, 1500)); }

  // ---- administrador ----
  const norm = x => String(x).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  async function huella(clave) { // misma idea que la clave de Solo, con otra sal: solo la huella viaja a la base
    const enc = new TextEncoder(), k = await crypto.subtle.importKey('raw', enc.encode(norm(clave)), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(SAL), iterations: 100000, hash: 'SHA-256' }, k, 256);
    return [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  async function rpc(fn, cuerpo) {
    const r = await fetch(URL + '/rest/v1/rpc/' + fn, { method: 'POST', headers: { apikey: LLAVE, 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
    if (!r.ok) { const e = new Error(r.status === 403 || r.status === 401 ? 'acceso-denegado' : 'error-' + r.status); e.estado = r.status; throw e; }
    return r.json();
  }
  // sinAdmin = true oculta las partidas y salas donde participó el administrador (no se borra nada)
  const listar = async (clave, dias, sinAdmin) => rpc('historial_listar', { p_h: await huella(clave), p_desde: desde(dias), p_sin_admin: !!sinAdmin });

  root.Historial = { guardar, fila, desde, listar, huella, vaciarCola, pendientes: () => leerCola().length };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.Historial;
})(typeof self !== 'undefined' ? self : this);
