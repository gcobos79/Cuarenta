/* CUARENTA · Amigos — mesa y salas (V2.03).
   Dos modos: «prueba local» (dos personas en la misma pantalla) y «en línea» (cada amigo desde su celular).
   En línea, el celular anfitrión reparte, valida las jugadas con reglas.js y guarda el estado de la sala; los demás envían sus jugadas
   como acciones y dibujan lo que reciben. */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const { jugar, reclamarRonda, puedeRonda, nueva } = Reglas;
  const VERSION = 'V2.03', CLAVE_SESION = 'amigosSesion', CLAVE_NOMBRE = 'amigosNombre';
  let E = null, modo = null /* null | 'local' | 'red' */, nombres = ['Jugador 1', 'Jugador 2'], ocupado = false, preguntada = '', ultimaCartaId = null;
  let S = null; // sesión en línea
  // Dos cadenas: «serie» aplica cambios al estado uno por uno; «serieEv» muestra los avisos y ventanas uno por uno (sin frenar a la anterior).
  let serieP = Promise.resolve(), evP = Promise.resolve();
  const serie = fn => (serieP = serieP.then(fn, fn).catch(e => { console.error(e); }));
  const serieEv = fn => (evP = evP.then(fn, fn).catch(e => { console.error(e); }));

  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const limpia = t => (t || '').trim().replace(/\s+/g, ' ').slice(0, 20);
  const abajo = () => (modo === 'red' ? S.asiento : 0), arriba = () => 1 - abajo();
  const jugadorEn = dom => (dom === 0 ? abajo() : arriba());
  const nom = p => (modo === 'red' ? ((S.jugadores.find(j => j.asiento === p) || {}).nombre || 'Esperando…') : nombres[p]);
  const cartaTxt = c => c.rank + c.suit;
  const esFigura = c => c.rank === 'J' || c.rank === 'Q' || c.rank === 'K';
  const cartaHTML = (c, extra) => `<div class="card ${c.color}${esFigura(c) ? ' figcard' : ''}${extra || ''}" data-id="${c.id}"><span class="idx">${c.rank}<br>${c.suit}</span>${esFigura(c) ? `<svg class="fig" viewBox="0 0 200 280" aria-hidden="true"><use href="#fig${c.rank}"/></svg>` : `<b class="pip">${c.suit}</b>`}<span class="idx bottom">${c.rank}<br>${c.suit}</span></div>`;
  const dorsoHTML = '<div class="card back" aria-hidden="true"></div>';

  // ---- avisos y ventanas ----
  function toast(txt, ms) {
    const f = $('.felt').getBoundingClientRect(); $('#toasts').style.top = Math.round(f.top + 34) + 'px'; // sobre el tapete, sin tapar los marcadores
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = txt; $('#toasts').appendChild(t);
    setTimeout(() => t.remove(), ms || 3200);
  }
  function ventana(titulo, cuerpoHTML, botones) { // devuelve una promesa con el valor del botón pulsado
    return new Promise(res => {
      const v = document.createElement('div'); v.className = 'velo'; v.setAttribute('role', 'dialog'); v.setAttribute('aria-modal', 'true');
      v.innerHTML = `<div class="panel"><h3>${esc(titulo)}</h3>${cuerpoHTML}<div class="acciones"></div></div>`;
      const ac = v.querySelector('.acciones');
      (botones || []).forEach(b => { const e = document.createElement('button'); e.type = 'button'; e.className = 'btn' + (b.clase ? ' ' + b.clase : ''); e.textContent = b.txt; e.id = b.id || ''; e.onclick = () => { v.remove(); res(b.val); }; ac.appendChild(e); });
      v.querySelectorAll('[data-val]').forEach(e => { e.onclick = () => { v.remove(); res(Number(e.dataset.val)); }; });
      $('#velos').appendChild(v);
      const f = v.querySelector('.btn'); if (f) { try { f.focus({ preventScroll: true }); } catch (e) { } }
    });
  }

  function textoEvento(e) {
    switch (e.tipo) {
      case 'jugada': {
        let t = e.captura.length ? `${nom(e.jugador)} levanta ${e.captura.length + 1} cartas con el ${cartaTxt(e.carta)}` : `${nom(e.jugador)} deja el ${cartaTxt(e.carta)} en la mesa`;
        if (e.caida) t += ' · ¡CAÍDA! +2'; if (e.limpia) t += ' · ¡LIMPIA! +2'; return t;
      }
      case 'ronda': return `${nom(e.jugador)} cobra la ronda de ${e.valor}: +2`;
      case 'bonoRonda': return `${nom(e.jugador)} hizo caída sobre la ronda: +4`;
      case 'bloqueo38': return `${nom(e.jugador)} tiene 38: ${({ limpia: 'la limpia', ronda: 'la ronda', bono: 'el bono de la ronda', conteo: 'el conteo', falta: 'los 4 de falta' })[e.por]} no suma ${e.puntos}. Necesita una caída.`;
      case 'llega38': return `${nom(e.jugador)} llegó a 38: ahora solo gana con una caída.`;
      default: return '';
    }
  }

  // ---- dibujo ----
  function textoBoton() {
    if (!modo) return { t: 'PRUEBA LOCAL', dis: false, fin: false, espera: true };
    if (modo === 'local') return E && E.estado === 'jugando' ? { t: 'TERMINAR PARTIDA', fin: true } : { t: 'COMENZAR' };
    if (!E) return S.anfitrion ? { t: 'COMENZAR', dis: S.jugadores.length < S.maximo, espera: S.jugadores.length >= S.maximo } : { t: 'ESPERANDO AL ANFITRIÓN', dis: true };
    return E.estado === 'jugando' ? { t: S.anfitrion ? 'TERMINAR PARTIDA' : 'SALIR DE LA PARTIDA', fin: true } : { t: 'SALIR' };
  }
  function dibujar() {
    const red = modo === 'red', jugando = !!E && E.estado === 'jugando';
    $('#n0').textContent = nom(0) + (red && S.asiento === 0 ? ' (tú)' : ''); $('#n1').textContent = nom(1) + (red && S.asiento === 1 ? ' (tú)' : '');
    $('#e0').textContent = nom(jugadorEn(0)); $('#e1').textContent = nom(jugadorEn(1));
    $('#config').hidden = !!modo; $('#lobby').hidden = !(red && !E); $('#estado').hidden = !E;
    if (red && !E) dibujarLobby();
    if (!E) {
      $('#p0').textContent = '0'; $('#p1').textContent = '0'; $('#mano0').innerHTML = ''; $('#mano1').innerHTML = ''; $('#mesa').innerHTML = '';
      $('#pila0').innerHTML = ''; $('#pila1').innerHTML = ''; $('#sc0').classList.remove('activo'); $('#sc1').classList.remove('activo');
      $('#aviso').textContent = !modo ? 'Crea una sala, únete con un código o prueba en esta pantalla.' : (red ? (S.anfitrion ? 'Cuando entre tu amigo, pulsa COMENZAR.' : 'Esperando a que el anfitrión comience la partida.') : '');
    } else {
      $('#p0').textContent = E.score[0]; $('#p1').textContent = E.score[1];
      const ver = $('#oVer').checked;
      [0, 1].forEach(dom => {
        const p = jugadorEn(dom);
        const activa = jugando && E.turn === p && !ocupado && (red ? p === S.asiento : true);
        const cara = red ? p === S.asiento : (ver || E.turn === p);
        $('#mano' + dom).classList.toggle('activa', activa);
        $('#mano' + dom).innerHTML = E.hands[p].map(c => cara ? cartaHTML(c, activa ? ' jugable' : '') : dorsoHTML).join('');
        $('#pila' + dom).innerHTML = `Levantadas<b>${E.captured[p].length}</b>`;
      });
      [0, 1].forEach(p => $('#sc' + p).classList.toggle('activo', jugando && E.turn === p));
      $('#mesa').innerHTML = E.table.map(c => cartaHTML(c, c.id === ultimaCartaId ? ' ultima' : '')).join('');
      $('#estado').textContent = `Ciclo ${E.cycle} · Sección ${E.section} de 4 · Reparte ${nom(E.dealer)}` + (jugando ? ` · Turno de ${nom(E.turn)}` : '');
      if (red && jugando) {
        const riv = S.jugadores.find(j => j.asiento === arriba());
        if (riv && S.conectados.length && !S.conectados.includes(riv.id)) $('#aviso').textContent = `${riv.nombre} no está conectado. Cuando vuelva, la partida sigue donde se quedó.`;
      }
    }
    const b = textoBoton(), pr = $('#principal');
    pr.textContent = b.t; pr.disabled = !!b.dis; pr.classList.toggle('fin', !!b.fin); pr.classList.toggle('espera', !!b.espera);
    const solo = $('#irSolo'), bloquea = jugando || (red && !!E); solo.setAttribute('aria-disabled', String(bloquea)); solo.tabIndex = bloquea ? -1 : 0;
  }
  function dibujarLobby() {
    $('#lbCodigo').textContent = S.codigo;
    $('#lbJugadores').innerHTML = Array.from({ length: S.maximo }, (_, i) => {
      const j = S.jugadores.find(x => x.asiento === i);
      if (!j) return `<li class="vacio">Esperando a un amigo…</li>`;
      const on = !S.conectados.length || S.conectados.includes(j.id);
      return `<li><span class="punto ${on ? 'on' : 'off'}" aria-hidden="true"></span>${esc(j.nombre)}${i === 0 ? ' · anfitrión' : ''}${j.id === S.id ? ' · tú' : ''}${on ? '' : ' · desconectado'}</li>`;
    }).join('');
    const o = S.opciones || {}; $('#lbOpciones').textContent = `Reglas: ${o.rule38 ? '38 que no juegan' : 'sin 38'} · ${o.falta4 ? '4 de falta' : 'sin 4 de falta'}`;
  }

  // ---- eventos de la partida (los dos modos) ----
  async function procesar(eventos) {
    ocupado = true; dibujar();
    for (const e of eventos) if (e.tipo === 'jugada') { const j = E && E.table.find(c => c.id === e.carta.id); ultimaCartaId = j ? j.id : null; }
    dibujar();
    const lineas = eventos.map(textoEvento).filter(Boolean);
    if (lineas.length) { $('#aviso').textContent = lineas.join(' · '); lineas.forEach((l, i) => setTimeout(() => toast(l, 3200), i * 200)); }
    for (const e of eventos) {
      if (e.tipo === 'rondaConfirmada') {
        await ventana('RONDA CONFIRMADA', `<p>La ronda de ${esc(nom(e.jugador))} era de ${e.valor}.${e.caida ? `\n${esc(nom(1 - e.jugador))} hizo caída sobre la ronda.` : ''}</p>`, [{ txt: 'CONTINUAR', val: 1 }]);
      } else if (e.tipo === 'falta4') {
        await ventana('4 DE FALTA', `<p>${esc(nom(e.jugador))} cobra 4 puntos porque ${esc(nom(e.repartidor))} no levantó ninguna carta en la primera mano.</p>`, [{ txt: 'CONTINUAR', val: 1 }]);
      } else if (e.tipo === 'conteo') {
        const [a, b] = e.capturadas, [pa, pb] = e.puntos;
        const res = pa || pb ? `${esc(nom(pa ? 0 : 1))} gana ${pa || pb} puntos por el conteo.` : 'Nadie suma puntos por el conteo.';
        await ventana('FIN DEL CICLO', `<p>${esc(nom(0))}: ${a} cartas\n${esc(nom(1))}: ${b} cartas\n${res}</p>`, [{ txt: 'CONTINUAR', val: 1 }]);
      } else if (e.tipo === 'reparto' && (e.seccion > 1 || e.ciclo > 1)) {
        toast(`Sección ${e.seccion}${e.ciclo > 1 ? ' del ciclo ' + e.ciclo : ''}: reparte ${nom(e.repartidor)} y comienza ${nom(e.comienza)}`, 3000);
      } else if (e.tipo === 'fin') {
        const mot = { cuatro: 'por cuatro cartas iguales', caida38: 'con una caída estando en 38', '40': 'al llegar a 40 puntos', abandono: 'porque el otro jugador salió de la partida' }[e.motivo] || '';
        await ventana('¡GANA ' + nom(e.ganador).toLocaleUpperCase() + '!', `<p>${mot ? 'Gana ' + mot + '.\n' : ''}Marcador final: ${esc(nom(0))} ${e.puntos[0]} — ${esc(nom(1))} ${e.puntos[1]}</p>`, [{ txt: modo === 'red' ? 'SALIR' : 'NUEVA PARTIDA', val: 1, id: 'nuevaPartida' }]);
        if (modo === 'red') await salirSala(false); else { E = null; modo = null; }
        ultimaCartaId = null; preguntada = '';
      }
    }
    ocupado = false; dibujar(); preguntarRonda();
  }

  async function preguntarRonda() {
    if (!E || E.estado !== 'jugando' || ocupado) return;
    const p = E.turn; if (!puedeRonda(E, p)) return;
    if (modo === 'red' && p !== S.asiento) return; // cada jugador decide solo su ronda
    const clave = `${E.cycle}-${E.section}-${p}`; if (preguntada === clave) return;
    preguntada = clave; ocupado = true; dibujar();
    const cartas = E.hands[p].filter(c => c.value === E.rondaVal[p]);
    const r = await ventana(`¡${nom(p).toLocaleUpperCase()} TIENE RONDA!`, `<div class="cartas">${cartas.map(c => cartaHTML(c, ' mini')).join('')}</div><p>¿Deseas cobrarla? Suma 2 puntos.</p><p style="font-size:12px;opacity:.85">Si respondes NO, ya no podrás cobrarla en esta sección.</p>`,
      [{ txt: 'NO', val: 0, id: 'rondaNo' }, { txt: 'SÍ', val: 1, id: 'rondaSi' }]);
    ocupado = false;
    if (r === 1) {
      if (modo === 'red' && !S.anfitrion) { await enviar('ronda', {}); dibujar(); return; }
      await serie(async () => { const res = reclamarRonda(E, p); if (res.ok) { if (modo === 'red') await publicar(res.eventos); serieEv(() => procesar(res.eventos)); } });
      return;
    }
    dibujar();
  }

  async function elegirCaptura(c, opciones) {
    const ordenadas = opciones.map(o => o.slice().sort((a, b) => a.value - b.value));
    const cuerpo = `<p>Esta carta permite más de una captura. Elige la que prefieras.</p>` + ordenadas.map((o, i) => `<div class="opcion" role="button" tabindex="0" data-val="${i}"><span>OPCIÓN ${i + 1}</span>${cartaHTML(c, ' mini')}${o.map(x => `<span class="mas">+</span>${cartaHTML(x, ' mini')}`).join('')}</div>`).join('');
    return ventana('ELIGE TU CAPTURA', cuerpo, [{ txt: 'CANCELAR', val: -1, id: 'cancelarCaptura' }]);
  }

  async function jugarCarta(p, id) {
    if (!E || E.estado !== 'jugando' || ocupado || E.turn !== p) return;
    if (modo === 'red' && (p !== S.asiento || S.enviando)) return;
    const opts = Reglas.opciones(E, p, id); let indice;
    if (opts.length > 1) {
      ocupado = true; dibujar();
      const c = E.hands[p].find(x => x.id === id), i = await elegirCaptura(c, opts);
      ocupado = false; if (i < 0) { dibujar(); return; }
      indice = i;
    }
    if (modo === 'red' && !S.anfitrion) { await enviar('jugar', { carta: id, indice }); return; }
    await serie(async () => {
      const r = jugar(E, p, id, indice);
      if (r.ok) { if (modo === 'red') await publicar(r.eventos); serieEv(() => procesar(r.eventos)); }
    });
  }

  async function terminar() {
    if (!E || E.estado !== 'jugando' || ocupado) return;
    const red = modo === 'red';
    ocupado = true;
    const r = await ventana(red && !S.anfitrion ? 'SALIR DE LA PARTIDA' : 'TERMINAR PARTIDA', `<p>${red ? (S.anfitrion ? '¿Realmente deseas terminar la partida? Tu amigo verá que saliste.' : '¿Realmente deseas salir? La partida termina y gana tu amigo.') : '¿Realmente deseas terminar la partida? Se perderá el avance de esta partida.'}</p>`,
      [{ txt: 'SEGUIR JUGANDO', val: 0, id: 'seguir' }, { txt: red && !S.anfitrion ? 'SALIR' : 'TERMINAR PARTIDA', val: 1, clase: 'fin', id: 'terminarSi' }]);
    ocupado = false;
    if (r === 1) {
      if (!red) { E = null; modo = null; ultimaCartaId = null; preguntada = ''; }
      else if (S.anfitrion) await serie(async () => { const ev = abandono(S.asiento); await publicar(ev); serieEv(() => procesar(ev)); });
      else { try { await Red.enviarAccion(S.codigo, S.id, 'salir', {}); } catch (e) { } await salirSala(false); }
    }
    dibujar();
  }
  function abandono(seat) { // el jugador «seat» sale: gana el otro
    E.estado = 'fin'; E.ganador = 1 - seat; E.motivo = 'abandono';
    return [{ tipo: 'fin', ganador: E.ganador, motivo: 'abandono', puntos: E.score.slice() }];
  }

  // ---- prueba local ----
  function comenzarLocal() {
    nombres = [limpia($('#nom0').value) || 'Jugador 1', limpia($('#nom1').value) || 'Jugador 2'];
    modo = 'local'; E = nueva({ rule38: $('#o38').checked, falta4: $('#o4f').checked });
    ultimaCartaId = null; preguntada = ''; ocupado = false; $('#aviso').textContent = '';
    const iniciales = E.eventosIniciales || []; delete E.eventosIniciales;
    dibujar();
    if (E.estado === 'fin') { procesar(iniciales); return; }
    toast(`Reparte ${nom(E.dealer)} y comienza ${nom(1 - E.dealer)}`, 3000);
    preguntarRonda();
  }

  // ---- en línea ----
  function guardarSesion() { try { localStorage.setItem(CLAVE_SESION, JSON.stringify({ codigo: S.codigo, id: S.id, nombre: S.nombre, anfitrion: S.anfitrion })); } catch (e) { } }
  function borrarSesion() { try { localStorage.removeItem(CLAVE_SESION); } catch (e) { } }
  const nombreEscrito = () => { const n = limpia($('#miNombre').value) || 'Jugador'; try { localStorage.setItem(CLAVE_NOMBRE, n); } catch (e) { } return n; };

  function quitarEscuchas() { if (!S) return; ['escSala', 'escAcc', 'pres'].forEach(k => { if (S[k]) { try { S[k].parar(); } catch (e) { } S[k] = null; } }); }
  function entrarSala(sala, yo) {
    S = { codigo: sala.codigo, id: yo.id, nombre: yo.nombre, anfitrion: yo.anfitrion, asiento: Math.max(0, (sala.jugadores.find(j => j.id === yo.id) || { asiento: 0 }).asiento), jugadores: sala.jugadores, maximo: sala.maximo, opciones: sala.opciones || {},
      fase: sala.fase, version: sala.version, vistoEv: (sala.estado && sala.estado.evSeq) || 0, ultima: sala.ultima_accion || 0, conectados: [], enviando: false };
    modo = 'red'; E = sala.estado ? sala.estado : null; ultimaCartaId = null; preguntada = ''; ocupado = false;
    guardarSesion();
    S.escSala = Red.escucharSala(sala.codigo, aplicarSala); S.escSala.ver(sala);
    S.pres = Red.presencia(sala.codigo, { id: S.id, nombre: S.nombre }, ids => { if (S) { S.conectados = ids; dibujar(); } });
    if (S.anfitrion) S.escAcc = Red.escucharAcciones(sala.codigo, S.ultima, a => serie(() => aplicarAccion(a)));
    dibujar();
    if (E && E.estado === 'jugando') preguntarRonda();
  }
  async function salirSala(avisar) {
    if (!S) { modo = null; E = null; dibujar(); return; }
    const s = S; quitarEscuchas(); borrarSesion(); S = null; modo = null; E = null; ultimaCartaId = null; preguntada = ''; ocupado = false;
    if (avisar && !s.anfitrion) { try { await Red.enviarAccion(s.codigo, s.id, 'salir', {}); } catch (e) { } }
    dibujar();
    if (s.anfitrion) setTimeout(() => { Red.cerrarSala(s.codigo).catch(() => { }); }, 4000); // un momento para que el otro vea el final
  }

  async function publicar(eventos, extra) { // el anfitrión guarda el estado nuevo en la sala
    S.version++;
    const copia = Object.assign({}, E, { ev: eventos || [], evSeq: S.version });
    delete copia.eventosIniciales;
    await Red.guardar(S.codigo, Object.assign({ estado: copia, version: S.version, fase: E.estado === 'fin' ? 'fin' : 'jugando', jugadores: S.jugadores, ultima_accion: S.ultima }, extra || {}));
  }
  async function enviar(tipo, datos) { // un invitado manda su jugada al anfitrión
    S.enviando = true; dibujar();
    try { await Red.enviarAccion(S.codigo, S.id, tipo, datos); }
    catch (e) { toast('No se pudo enviar la jugada. Revisa tu conexión.'); S.enviando = false; dibujar(); return; }
    setTimeout(() => { if (S && S.enviando) { S.enviando = false; dibujar(); } }, 6000);
  }
  async function aplicarAccion(a) { // solo el anfitrión
    if (!S || !S.anfitrion) return;
    S.ultima = a.id; let eventos = [];
    const seat = (S.jugadores.find(j => j.id === a.jugador) || { asiento: -1 }).asiento;
    if (a.tipo === 'unirse') {
      if (!E && S.jugadores.length < S.maximo && !S.jugadores.some(j => j.id === a.jugador)) {
        S.jugadores = S.jugadores.concat([{ id: a.jugador, nombre: limpia(a.datos && a.datos.nombre) || 'Amigo', asiento: S.jugadores.length }]);
        dibujar(); toast(`${S.jugadores[S.jugadores.length - 1].nombre} entró a la sala`, 2500);
      }
    } else if (E && E.estado === 'jugando' && seat >= 0) {
      if (a.tipo === 'jugar') { const r = jugar(E, seat, a.datos.carta, a.datos.indice); if (r.ok) eventos = r.eventos; }
      else if (a.tipo === 'ronda') { const r = reclamarRonda(E, seat); if (r.ok) eventos = r.eventos; }
      else if (a.tipo === 'salir') eventos = abandono(seat);
    }
    await publicar(eventos);
    if (eventos.length) serieEv(() => procesar(eventos));
    else dibujar();
  }
  async function comenzarRed() { // el anfitrión reparte
    if (!S || !S.anfitrion || E || S.jugadores.length < S.maximo) return;
    await serie(async () => {
      E = nueva(S.opciones); preguntada = ''; ultimaCartaId = null;
      const ev = E.eventosIniciales || []; delete E.eventosIniciales;
      await publicar(ev); dibujar();
      if (E.estado === 'fin') { serieEv(() => procesar(ev)); return; }
      toast(`Reparte ${nom(E.dealer)} y comienza ${nom(1 - E.dealer)}`, 3000);
      preguntarRonda();
    });
  }
  function aplicarSala(sala) { // lo que llega de la sala (invitados; el anfitrión solo vigila que la sala exista)
    if (!S) return;
    if (!sala) { if (!(E && E.estado === 'fin')) { toast('La sala se cerró.'); salirSala(false); } return; }
    if (S.anfitrion) return;
    S.jugadores = sala.jugadores; S.maximo = sala.maximo; S.opciones = sala.opciones || {}; S.fase = sala.fase;
    if (sala.estado && sala.version >= S.version) {
      const evs = sala.estado.ev || [], seq = sala.estado.evSeq || 0;
      E = sala.estado; S.version = sala.version; S.enviando = false;
      if (seq > S.vistoEv) { S.vistoEv = seq; serieEv(() => procesar(evs)); } else dibujar();
    } else dibujar();
  }

  async function crearSalaUI() {
    if (!Red.disponible()) { toast('No se pudo cargar la conexión. Revisa tu internet y recarga.', 4500); return; }
    const nombre = nombreEscrito(), id = Red.nuevoId();
    $('#btnCrear').disabled = true;
    try {
      const sala = await Red.crearSala({ id, nombre, maximo: 2, opciones: { rule38: $('#o38').checked, falta4: $('#o4f').checked } });
      entrarSala(sala, { id, nombre, anfitrion: true });
    } catch (e) { toast('No se pudo crear la sala. Inténtalo otra vez.', 4000); }
    $('#btnCrear').disabled = false;
  }
  async function unirmeUI() {
    if (!Red.disponible()) { toast('No se pudo cargar la conexión. Revisa tu internet y recarga.', 4500); return; }
    const codigo = Red.normaliza($('#codigoSala').value), nombre = nombreEscrito();
    if (!Red.codigoValido(codigo)) { toast('Escribe el código de 3 caracteres.', 3000); return; }
    $('#btnUnirme').disabled = true;
    try {
      let sala = await Red.leerSala(codigo);
      if (!sala) { toast('No existe una sala con ese código.', 3500); return; }
      if (sala.fase !== 'espera') { toast('Esa partida ya empezó.', 3500); return; }
      if (sala.jugadores.length >= sala.maximo) { toast('Esa sala ya está llena.', 3500); return; }
      const id = Red.nuevoId();
      await Red.enviarAccion(codigo, id, 'unirse', { nombre });
      for (let i = 0; i < 20; i++) { // el anfitrión tarda un momento en aceptar
        await new Promise(r => setTimeout(r, 600)); sala = await Red.leerSala(codigo);
        if (sala && sala.jugadores.some(j => j.id === id)) { entrarSala(sala, { id, nombre, anfitrion: false }); return; }
      }
      toast('El anfitrión no respondió. Pídele que abra la sala e inténtalo otra vez.', 5000);
    } catch (e) { toast('No se pudo entrar a la sala. Revisa tu conexión.', 4000); }
    finally { $('#btnUnirme').disabled = false; }
  }
  async function reanudar() { // volver a una sala después de cerrar la página o perder la conexión
    let ses = null; try { ses = JSON.parse(localStorage.getItem(CLAVE_SESION) || 'null'); } catch (e) { }
    if (!ses || !ses.codigo || !ses.id || !Red.disponible()) return;
    try {
      const sala = await Red.leerSala(ses.codigo);
      if (sala && sala.jugadores.some(j => j.id === ses.id) && !(sala.fase === 'fin')) { entrarSala(sala, ses); toast('Volviste a la sala ' + sala.codigo, 3000); }
      else borrarSesion();
    } catch (e) { toast('Sin conexión: no se pudo volver a tu sala todavía.', 4000); }
  }

  // ---- eventos de la pantalla ----
  $('#principal').onclick = () => {
    if (!modo) comenzarLocal();
    else if (modo === 'local') { if (E && E.estado === 'jugando') terminar(); else { E = null; modo = null; dibujar(); } }
    else if (!E) comenzarRed();
    else if (E.estado === 'jugando') terminar();
    else salirSala(false);
  };
  $('#btnCrear').onclick = crearSalaUI; $('#btnUnirme').onclick = unirmeUI;
  $('#lbSalir').onclick = () => salirSala(true);
  $('#lbCopiar').onclick = async () => { try { await navigator.clipboard.writeText(S.codigo); toast('Código copiado: ' + S.codigo, 2000); } catch (e) { toast('Código: ' + S.codigo, 3000); } };
  $('#codigoSala').addEventListener('input', e => { e.target.value = Red.normaliza(e.target.value); });
  $('#irSolo').addEventListener('click', e => { if ($('#irSolo').getAttribute('aria-disabled') === 'true') e.preventDefault(); });
  document.addEventListener('click', e => {
    const c = e.target.closest('.mano .card.jugable'); if (!c) return;
    jugarCarta(jugadorEn(Number(c.parentElement.id.slice(4))), c.dataset.id);
  });
  $('#oVer').addEventListener('change', dibujar);
  document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.opcion')) { e.preventDefault(); e.target.click(); } });
  $('#version').textContent = VERSION;
  try { $('#miNombre').value = localStorage.getItem(CLAVE_NOMBRE) || ''; } catch (e) { }
  window.Mesa = { get E() { return E; }, get S() { return S; }, get modo() { return modo; }, jugarCarta, dibujar, preguntarRonda };
  dibujar();
  reanudar();
})();
