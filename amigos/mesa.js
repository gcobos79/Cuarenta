/* CUARENTA · Amigos — mesa y salas (V2.04).
   Dos modos: «prueba local» (dos personas en la misma pantalla) y «en línea» (cada amigo desde su celular).
   En línea, el celular anfitrión reparte, valida las jugadas con reglas.js y guarda el estado de la sala; los demás envían sus jugadas
   como acciones y dibujan lo que reciben.
   E es el estado real (el más reciente); V es lo que se ve en pantalla: va un paso atrás mientras se anima cada jugada. */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const { jugar, reclamarRonda, puedeRonda, nueva } = Reglas;
  const VERSION = 'V2.30', CLAVE_SESION = 'amigosSesion', CLAVE_NOMBRE = 'amigosNombre';
  let E = null, V = null, modo = null /* null | 'local' | 'red' */, nombres = ['Jugador 1', 'Jugador 2'], ocupado = false, preguntada = '', ultimaCartaId = null;
  let S = null; // sesión en línea
  let avisoFijo = ''; // mensaje de espera (menú o lobby) que se retira al empezar la partida
  let turnoMioAntes = false, pendEv = 0;
  let claveAdmin = '', histDias = 1;
  let pruebaLocal = false; // gancho de las pruebas automáticas: muestra la prueba local aunque no se sea administrador
  const verLocal = () => esAdmin || pruebaLocal; // la «prueba en esta pantalla» la ve el administrador
  let esAdmin = false, panelFin = false, victoriasLocal = [0, 0]; // administrador (ve la prueba local); aviso de fin ya visto; partidas ganadas de la prueba local
  // ---- administrador: la misma clave de Solo (solo se guarda la huella, no la palabra). Se lee del nombre guardado en Solo o del nombre escrito aquí ----
  const CLAVE_SAL = 'cuarenta-don-barajon:clave-de-dueno:v1', CLAVE_HUELLA = 'f7a14d09feb58ab9df36a5d014abec123bc7fd2092dabc56d6dd16f5920c9e1e';
  const normClave = x => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  async function huellaClave(palabra) {
    if (!(window.crypto && crypto.subtle)) return null;
    const enc = new TextEncoder(), k = await crypto.subtle.importKey('raw', enc.encode(normClave(palabra)), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(CLAVE_SAL), iterations: 100000, hash: 'SHA-256' }, k, 256);
    return [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  const patronClave = txt => /^«\s*(.+?)\s*»$/.exec((txt || '').trim());
  async function revisarAdmin() {
    let ok = false;
    const fuentes = []; try { fuentes.push(localStorage.getItem('donBarajonPlayerName') || ''); } catch (e) { } fuentes.push(($('#miNombre') || {}).value || '');
    for (const f of fuentes) { const m = patronClave(f); if (m) { try { if ((await huellaClave(m[1])) === CLAVE_HUELLA) { ok = true; claveAdmin = m[1]; break; } } catch (e) { } } }
    if (ok !== esAdmin) { esAdmin = ok; dibujar(); }
  }
  // Dos cadenas: «serie» aplica cambios al estado uno por uno; «serieEv» muestra animaciones y avisos uno por uno (sin frenar a la anterior).
  let serieP = Promise.resolve(), evP = Promise.resolve();
  const serie = fn => (serieP = serieP.then(fn, fn).catch(e => { console.error(e); }));
  const serieEv = fn => (evP = evP.then(fn, fn).catch(e => { console.error(e); }));
  const clonar = o => JSON.parse(JSON.stringify(o));

  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const limpia = t => (t || '').trim().replace(/\s+/g, ' ').slice(0, 20);
  const yo = () => (modo === 'red' ? S.asiento : 0);          // quién escucha y mira (en la prueba local, el de abajo)
  const abajo = () => yo(), arriba = () => 1 - abajo();
  const jugadorEn = dom => (dom === 0 ? abajo() : arriba());
  const nom = p => (modo === 'red' ? ((S.jugadores.find(j => j.asiento === p) || {}).nombre || 'Esperando…') : nombres[p]);
  const MAY = t => String(t).toLocaleUpperCase();
  const pad2 = n => String(Math.max(0, Math.round(Number(n) || 0))).padStart(2, '0');
  // Reloj de arena (turno del rival): la arena cae unos 3 segundos y luego da la vuelta (ver estilos.css)
  const RELOJ = '<span class="reloj" role="img" aria-label="En espera"><svg viewBox="0 0 24 32" aria-hidden="true"><path class="arena arriba" d="M6.6 4.6H17.4C17.1 9.6 13.8 11.7 12 14.6 10.2 11.7 6.9 9.6 6.6 4.6Z"/><path class="arena abajo" d="M6.6 27.4H17.4C16.4 23.6 13.5 22.1 12 20 10.5 22.1 7.6 23.6 6.6 27.4Z"/><line class="hilo" x1="12" y1="14.6" x2="12" y2="26.5"/><path class="vidrio" d="M5 3.5H19C19 11 14 13 12 16 14 19 19 21 19 28.5H5C5 21 10 19 12 16 10 13 5 11 5 3.5Z"/><rect class="tapa" x="3" y="1" width="18" height="2.5" rx="1"/><rect class="tapa" x="3" y="28.5" width="18" height="2.5" rx="1"/></svg></span>';
  const ganadas = p => (modo === 'red' ? ((S.jugadores.find(j => j.asiento === p) || {}).victorias || 0) : victoriasLocal[p]);
  const marcadorPartidas = () => `${nom(0)} ${ganadas(0)} — ${nom(1)} ${ganadas(1)}`;
  const cartaTxt = c => c.rank + c.suit;
  const esFigura = c => c.rank === 'J' || c.rank === 'Q' || c.rank === 'K';
  const cartaHTML = (c, extra) => `<div class="card ${c.color}${esFigura(c) ? ' figcard' : ''}${extra || ''}" data-id="${c.id}"><span class="idx"><b class="rk">${c.rank}</b><i class="st">${c.suit}</i></span>${esFigura(c) ? `<svg class="fig" viewBox="0 0 200 280" aria-hidden="true"><use href="#fig${c.rank}"/></svg>` : `<b class="pip">${c.suit}</b>`}<span class="idx bottom"><b class="rk">${c.rank}</b><i class="st">${c.suit}</i></span></div>`;
  window.CartaHTML = c => cartaHTML(c);
  const dorsoHTML = '<div class="card back" aria-hidden="true"></div>';

  // ---- avisos y ventanas ----
  function toast(txt, ms) { // solo para avisos del sistema (errores, conexión); lo que pasa en la partida se dice con la voz
    const f = $('.felt').getBoundingClientRect(); $('#toasts').style.top = Math.round(f.top + 34) + 'px';
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

  // ---- dibujo (siempre desde V, lo que se ve) ----
  function textoBoton() {
    if (!modo) return { t: 'PRUEBA LOCAL', dis: false, fin: false, espera: true };
    if (modo === 'local') return E && E.estado === 'jugando' ? { t: 'TERMINAR PARTIDA', fin: true } : { t: 'SALIR' };
    if (!E) return S.anfitrion ? { t: 'COMENZAR', dis: S.jugadores.length < S.maximo, espera: S.jugadores.length >= S.maximo } : { t: 'ESPERANDO AL ANFITRIÓN', dis: true };
    return E.estado === 'jugando' ? { t: S.anfitrion ? 'TERMINAR PARTIDA' : 'SALIR DE LA PARTIDA', fin: true } : { t: 'SALIR' };
  }
  function dibujar() {
    const red = modo === 'red', D = V, jugando = !!D && D.estado === 'jugando';
    $('#n0').textContent = nom(0) + (red && S.asiento === 0 ? ' (tú)' : ''); $('#n1').textContent = nom(1) + (red && S.asiento === 1 ? ' (tú)' : '');
    $('#e0').textContent = nom(jugadorEn(0)); $('#e1').textContent = nom(jugadorEn(1));
    const finVisible = !!D && D.estado === 'fin' && panelFin;
    document.body.classList.toggle('sin-mesa', !D || finVisible); // en el menú, el lobby y el panel de revancha no hay cartas: el tapete usa todo el espacio
    $('#config').hidden = !!modo; $('#lobby').hidden = !(red && !D); $('#estado').hidden = !D; $('#revancha').hidden = !finVisible; $('#mesa').hidden = finVisible;
    $('#btnHistorial').hidden = !esAdmin || !!modo; // el historial lo ve solo el administrador, desde el menú
    $('details.local').hidden = !verLocal(); // la prueba en esta pantalla solo la ve el administrador
    ['g0', 'g1'].forEach((id, p) => { const e = $('#' + id); e.hidden = !modo; e.textContent = modo ? 'GANADAS ' + ganadas(p) : ''; });
    if (finVisible) dibujarRevancha();
    if (red && !D) dibujarLobby();
    if (!D) {
      $('#p0').textContent = '00'; $('#p1').textContent = '00'; $('#c0').textContent = '00'; $('#c1').textContent = '00'; $('#mano0').innerHTML = ''; $('#mano1').innerHTML = ''; $('#mesa').innerHTML = '';
      ['sc0', 'sc1'].forEach(i => $('#' + i).classList.remove('activo')); ['.fila.yo', '.fila.opp'].forEach(s => $(s).classList.remove('su-turno', 'sin-turno'));
      avisoFijo = !modo ? '' : (red ? (S.anfitrion ? 'Cuando entre tu amigo, pulsa COMENZAR.' : 'Esperando a que el anfitrión comience la partida.') : '');
      $('#aviso').textContent = avisoFijo; turnoMioAntes = false;
    } else {
      if (avisoFijo && $('#aviso').textContent === avisoFijo) { $('#aviso').textContent = ''; avisoFijo = ''; } // el mensaje del lobby no se queda durante la partida
      $('#p0').textContent = pad2(D.score[0]); $('#p1').textContent = pad2(D.score[1]);
      $('#c0').textContent = pad2(D.captured[0].length); $('#c1').textContent = pad2(D.captured[1].length); // cartas levantadas de cada jugador (ya no hay «Levantadas» en la mesa)
      const ver = $('#oVer').checked;
      [0, 1].forEach(dom => {
        const p = jugadorEn(dom);
        const activa = jugando && D.turn === p && !ocupado && (red ? (p === S.asiento && !S.enviando) : true);
        const cara = red ? p === S.asiento : (ver || D.turn === p);
        $('#mano' + dom).classList.toggle('activa', activa);
        $('#mano' + dom).innerHTML = D.hands[p].map(c => cara ? cartaHTML(c, activa ? ' jugable' : '') : dorsoHTML).join('');
        $(dom === 0 ? '.fila.yo' : '.fila.opp').classList.toggle('su-turno', jugando && D.turn === p);
        $(dom === 0 ? '.fila.yo' : '.fila.opp').classList.toggle('sin-turno', jugando && D.turn !== p);
      });
      [0, 1].forEach(p => $('#sc' + p).classList.toggle('activo', jugando && D.turn === p));
      $('#mesa').innerHTML = D.table.map(c => cartaHTML(c, c.id === ultimaCartaId ? ' ultima' : '')).join('');
      // una sola línea arriba del tapete: ciclo, sección y a quién le toca (lo propio en dorado)
      const mio = jugando && (red ? D.turn === S.asiento : false);
      const quien = jugando ? ` · <b class="quien${mio ? ' mio' : ''}">${mio ? '¡TU TURNO!' : (red ? RELOJ : 'TURNO DE ' + esc(MAY(nom(D.turn))))}</b>` : '';
      $('#estado').innerHTML = `Ciclo ${D.cycle} · Sección ${D.section}/4${quien}`;
      if (red && jugando) {
        const riv = S.jugadores.find(j => j.asiento === arriba());
        if (riv && S.conectados.length && !S.conectados.includes(riv.id)) $('#aviso').textContent = `${riv.nombre} no está conectado. Cuando vuelva, la partida sigue donde se quedó.`;
        else if ($('#aviso').textContent.endsWith('la partida sigue donde se quedó.')) $('#aviso').textContent = '';
      }
    }
    const b = textoBoton(), pr = $('#principal');
    pr.hidden = !modo && !verLocal(); // sin partida, el botón PRUEBA LOCAL solo lo ve el administrador
    pr.textContent = b.t; pr.disabled = !!b.dis; pr.classList.toggle('fin', !!b.fin); pr.classList.toggle('espera', !!b.espera);
    const solo = $('#irSolo'), bloquea = jugando || red; solo.setAttribute('aria-disabled', String(bloquea)); solo.tabIndex = bloquea ? -1 : 0; solo.hidden = bloquea; /* dentro de una sala o jugando no se muestra SALIR: en la sala se usa SALIR DE LA SALA */
    $('#btnVoz').classList.toggle('off', !Voz.activa()); $('#btnVoz').setAttribute('aria-pressed', String(Voz.activa()));
    $('#btnSonido').classList.toggle('off', !Efectos.sonido()); $('#btnSonido').setAttribute('aria-pressed', String(Efectos.sonido()));
    ajustarMesa();
  }
  // Las cartas de la mesa son un poco más grandes que las de la mano (hasta 1,3 veces, como en Solo) y se achican lo necesario para que quepan todas
  function ajustarMesa() {
    const m = $('#mesa'), f = $('.felt'); if (!m || !f || m.hidden) return;
    m.style.removeProperty('--ch');
    if (!m.querySelector('.card')) return;
    // tamaño base = el de las cartas de la mano. Se mide con una carta de prueba invisible: medir una carta de la mesa fallaba cuando estaba oculta (alto 0) y la carta en vuelo salía de 2 px
    const sonda = document.createElement('div'); sonda.className = 'card'; sonda.style.cssText = 'position:fixed;left:-999px;top:0;visibility:hidden;pointer-events:none';
    document.body.appendChild(sonda); const base = sonda.getBoundingClientRect().height; sonda.remove();
    if (!(base > 20)) return;
    let h = base * 1.3;
    m.style.setProperty('--ch', h.toFixed(1) + 'px');
    while (f.scrollHeight > f.clientHeight + 1 && h > 40) { h *= .95; m.style.setProperty('--ch', h.toFixed(1) + 'px'); }
  }
  window.addEventListener('resize', () => { if (window.Mesa) Mesa.dibujar(); });
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

  function dibujarRevancha() {
    const red = modo === 'red', gan = V.ganador;
    $('#rvMarcador').innerHTML = [0, 1].map(p => `<li class="${gan === p ? 'gana' : ''}"><span>${esc(nom(p))}${red && p === S.asiento ? ' · tú' : ''}${gan === p ? ' · ganó' : ''}</span><b>${ganadas(p)}</b></li>`).join('');
    let estado = '¿Otra partida?', mio = false, otro = false;
    if (red) {
      const yoJ = S.jugadores.find(j => j.id === S.id) || {}, riv = S.jugadores.find(j => j.id !== S.id) || {};
      mio = !!yoJ.listo; otro = !!riv.listo;
      estado = mio && !otro ? `Esperando a que ${riv.nombre || 'tu amigo'} también quiera jugar otra vez…` : (!mio && otro ? `${riv.nombre || 'Tu amigo'} quiere jugar otra vez. ¿Y tú?` : '¿Otra partida en la misma sala?');
    }
    $('#rvEstado').textContent = estado; $('#rvOtra').disabled = mio; $('#rvOtra').textContent = mio ? 'LISTO' : 'JUGAR OTRA VEZ';
  }
  async function marcarListo() { // quiero jugar otra vez
    if (modo === 'local') { comenzarLocal(); return; }
    if (!S || !V || V.estado !== 'fin') return;
    if (S.anfitrion) {
      await serie(async () => { const j = S.jugadores.find(x => x.id === S.id); if (j) j.listo = true; try { await Red.guardar(S.codigo, { jugadores: S.jugadores }); } catch (e) { toast('No se pudo avisar. Revisa tu conexión.'); } dibujar(); await intentarRevancha(); });
    } else {
      const j = S.jugadores.find(x => x.id === S.id); if (j) j.listo = true; dibujar();
      try { await Red.enviarAccion(S.codigo, S.id, 'revancha', {}); } catch (e) { if (j) j.listo = false; toast('No se pudo avisar. Revisa tu conexión.'); dibujar(); }
    }
  }
  async function intentarRevancha() { // solo el anfitrión: cuando los dos están listos, empieza otra partida en la misma sala
    if (!S || !S.anfitrion || !E || E.estado !== 'fin') return;
    if (S.jugadores.length < S.maximo || !S.jugadores.every(j => j.listo && !j.salio)) return;
    S.jugadores.forEach(j => { j.listo = false; });
    const ini = E.dealerInicial === 0 || E.dealerInicial === 1 ? 1 - E.dealerInicial : undefined; // reparte el otro
    E = nueva(Object.assign({}, S.opciones, { dealer: ini })); V = null; preguntada = ''; ultimaCartaId = null; panelFin = false;
    const ev = E.eventosIniciales || []; delete E.eventosIniciales;
    await publicar(ev); encolarEv(ev, clonar(E));
  }
  async function volverAlLobby() { // el amigo se fue: la sala vuelve a esperar a alguien (el marcador de partidas se reinicia)
    if (!S || !S.anfitrion) return;
    S.jugadores = S.jugadores.filter(j => !j.salio && j.id === S.id).map(j => Object.assign({ id: j.id, nombre: j.nombre, asiento: 0, victorias: 0 }, j.adm ? { adm: true } : {}));
    E = null; V = null; panelFin = false; ultimaCartaId = null; preguntada = ''; ocupado = false;
    try { await Red.guardar(S.codigo, { jugadores: S.jugadores, estado: null, fase: 'espera', ultima_accion: S.ultima }); } catch (e) { toast('No se pudo actualizar la sala.'); }
    toast('Tu amigo salió de la sala. Puedes esperar a otro con el mismo código.', 4500); dibujar();
  }

  // ---- historial de partidas (solo el administrador) ----
  const sinAdmin = () => { const c = $('#histSinAdmin'); return !c || c.checked; }; // por defecto el administrador no aparece en los listados
  const fechaCorta = f => { const [y, m, d] = String(f).split('-'); return `${d}/${m}`; };
  async function cargarHistorial() {
    const lista = $('#histLista'); if (!lista) return; lista.innerHTML = '<p class="vacio">Cargando…</p>';
    document.querySelectorAll('#histPanel .chip').forEach(c => c.classList.toggle('activo', Number(c.dataset.dias) === histDias));
    try {
      const r = await Historial.listar(claveAdmin, histDias, sinAdmin()), act = r.actuales || [], par = r.partidas || [];
      if (!$('#histLista')) return;
      let h = `<h4>JUEGOS ACTUALES (${act.length})</h4>` + (act.length ? act.map(a => `<div class="fila-h actual"><span class="cuando">Sala ${esc(a.codigo)}</span><span class="quien">${esc(a.jugador1)} <b>${a.puntaje1}</b> – <b>${a.puntaje2}</b> ${esc(a.jugador2)}</span><span class="extra">Ciclo ${a.ciclo || 1} · sección ${a.seccion || 1}/4 · en juego</span></div>`).join('') : '<p class="vacio">No hay juegos en curso.</p>');
      h += `<h4>ANTERIORES (${par.length})</h4>` + (par.length ? par.map(p => `<div class="fila-h"><span class="cuando">${fechaCorta(p.fecha)} · ${esc(p.hora)}</span><span class="quien">${esc(p.jugador1)} <b>${p.puntaje1}</b> – <b>${p.puntaje2}</b> ${esc(p.jugador2)}</span><span class="extra">Ganó ${esc(p.ganador)}${p.nivel ? ` · Nivel ${esc(p.nivel)}` : ''}</span></div>`).join('') : '<p class="vacio">No hay partidas terminadas en este periodo.</p>');
      lista.innerHTML = h;
    } catch (e) {
      lista.innerHTML = `<p class="vacio">${e.message === 'acceso-denegado' ? 'Acceso denegado: la clave de administrador no coincide con la registrada en el historial.' : 'No se pudo cargar el historial. Revisa tu conexión.'}</p>`;
    }
  }
  function abrirHistorial() {
    if (!esAdmin || $('#histPanel')) return;
    $('#velos').appendChild($('#histTpl').content.firstElementChild.cloneNode(true));
    try { $('#histSinAdmin').checked = localStorage.getItem('amigosHistSinAdmin') !== 'no'; } catch (e) { }
    $('#histSinAdmin').onchange = () => { try { localStorage.setItem('amigosHistSinAdmin', $('#histSinAdmin').checked ? 'si' : 'no'); } catch (e) { } cargarHistorial(); };
    $('#histCerrar').onclick = cerrarHistorial; $('#histActualizar').onclick = cargarHistorial;
    document.querySelectorAll('#histPanel .chip').forEach(c => { c.onclick = () => { histDias = Number(c.dataset.dias); cargarHistorial(); }; });
    cargarHistorial();
  }
  function cerrarHistorial() { const p = $('#histPanel'); if (p) p.remove(); }

  // ---- lo que ocurre en cada jugada: animación, voz y letras grandes ----
  const grandeJugada = e => { // «¡CAÍDA!» / «¡LIMPIA!» con los puntos que sumó
    if (e.puntos <= 0) return '';
    const que = e.puntos >= 4 ? '¡CAÍDA Y LIMPIA!' : (e.caida ? '¡CAÍDA!' : '¡LIMPIA!');
    return `${MAY(nom(e.jugador))}\n${que}\n+${e.puntos} PUNTOS`;
  };
  async function animar(jug) { // sobre lo que se ve ahora (V): sale de la mano, viaja a la mesa y se levantan las cartas
    const dom = jugadorEn(0) === jug.jugador ? 0 : 1;
    try { await Efectos.animarJugada({ carta: jug.carta, captura: jug.captura, mano: $('#mano' + dom), pila: $('#sc' + jug.jugador), mesa: $('#mesa'), vivo: () => !!modo, ajustar: ajustarMesa }); }
    catch (e) { console.error(e); document.querySelectorAll('.card.flight').forEach(x => x.remove()); }
  }
  async function procesar(eventos, snap, rapido) {
    ocupado = true;
    const jug = eventos.find(e => e.tipo === 'jugada');
    if (jug && V && !rapido) { dibujar(); await animar(jug); }
    V = clonar(snap || E); if (V.estado === 'jugando') panelFin = false;
    ultimaCartaId = jug ? ((V.table.find(c => c.id === jug.carta.id) || {}).id || null) : null;
    dibujar();
    Voz.hablarEventos(eventos, yo()); // la voz dice lo que pasó
    for (const e of eventos) {
      if (e.tipo === 'jugada') { const g = grandeJugada(e); if (g && !rapido) Efectos.grande(g, 1700); }
      else if (e.tipo === 'ronda') { if (!rapido) await Efectos.grande(`RONDA DE ${e.valor}\n${MAY(nom(e.jugador))}\n+2 PUNTOS`, 2200); }
      else if (e.tipo === 'bonoRonda') { if (!rapido) await Efectos.grande(`CAÍDA SOBRE LA RONDA\n${MAY(nom(e.jugador))}\n+4 PUNTOS`, 3200); }
      else if (e.tipo === 'falta4') { if (!rapido) await Efectos.grande(`4 DE FALTA\n${MAY(nom(e.jugador))} COBRA 4 PUNTOS\nPORQUE ${MAY(nom(e.repartidor))} NO LEVANTÓ NINGUNA CARTA`, 4200); }
      else if (e.tipo === 'llega38') { if (!rapido) await Efectos.grande(`${MAY(nom(e.jugador))} LLEGÓ A 38\nAHORA SOLO GANA CON UNA CAÍDA`, 3200); }
      else if (e.tipo === 'bloqueo38') { if (!rapido) await Efectos.grande(`${MAY(nom(e.jugador))} TIENE 38\nNO SUMA ${e.puntos} POR ${MAY(({ limpia: 'la limpia', ronda: 'la ronda', bono: 'el bono de la ronda', conteo: 'el conteo', falta: 'los 4 de falta' })[e.por])}`, 3400); }
      else if (e.tipo === 'conteo') {
        const [a, b] = e.capturadas, [pa, pb] = e.puntos;
        const res = pa || pb ? `${MAY(nom(pa ? 0 : 1))} GANA ${pa || pb} PUNTOS` : 'NADIE SUMA PUNTOS';
        if (!rapido) await Efectos.grande(`FIN DEL CICLO\n${MAY(nom(0))}: ${a} CARTAS · ${MAY(nom(1))}: ${b} CARTAS\n${res}`, 4800);
      } else if (e.tipo === 'fin') {
        const mot = { cuatro: 'por cuatro cartas iguales', caida38: 'con una caída estando en 38', '40': 'al llegar a 40 puntos', abandono: 'porque el otro jugador salió de la partida' }[e.motivo] || '';
        if (modo === 'local') victoriasLocal[e.ganador]++;
        dibujar();
        await ventana('¡GANA ' + MAY(nom(e.ganador)) + '!', `<p>${mot ? 'Gana ' + mot + '.\n' : ''}Marcador de esta partida: ${esc(nom(0))} ${e.puntos[0]} — ${esc(nom(1))} ${e.puntos[1]}\nPartidas ganadas: ${esc(marcadorPartidas())}</p>`, [{ txt: 'CONTINUAR', val: 1, id: 'continuarFin' }]);
        ultimaCartaId = null; preguntada = '';
        if (modo === 'red' && S.anfitrion && S.jugadores.some(j => j.salio)) { await volverAlLobby(); } // el amigo ya se fue: la sala vuelve a esperar a alguien
        else panelFin = true; // la sala sigue abierta: se puede jugar otra vez
      }
    }
    ocupado = false; dibujar(); avisarTurno();
  }
  function encolarEv(eventos, snap) { pendEv++; return serieEv(async () => { try { await procesar(eventos, snap, pendEv > 1); } finally { pendEv--; if (pendEv === 0) preguntarRonda(); } }); }
  function avisarTurno() { // un sonido suave cuando te toca jugar (solo en línea)
    const mio = modo === 'red' && !!V && V.estado === 'jugando' && V.turn === S.asiento;
    if (mio && !turnoMioAntes) Efectos.sonidoTurno();
    turnoMioAntes = mio;
  }

  async function preguntarRonda() {
    if (!E || E.estado !== 'jugando' || ocupado || pendEv > 0) return;
    const p = E.turn; if (!puedeRonda(E, p)) return;
    if (modo === 'red' && p !== S.asiento) return; // cada jugador decide solo su ronda
    const clave = `${E.cycle}-${E.section}-${p}`; if (preguntada === clave) return;
    preguntada = clave; ocupado = true; dibujar();
    const cartas = E.hands[p].filter(c => c.value === E.rondaVal[p]);
    const r = await ventana(`¡${MAY(nom(p))} TIENE RONDA!`, `<div class="cartas">${cartas.map(c => cartaHTML(c, ' mini')).join('')}</div><p>¿Deseas cobrarla? Suma 2 puntos.</p><p style="font-size:12px;opacity:.85">Si respondes NO, ya no podrás cobrarla en esta sección.</p>`,
      [{ txt: 'NO', val: 0, id: 'rondaNo' }, { txt: 'SÍ', val: 1, id: 'rondaSi' }]);
    ocupado = false;
    if (r === 1) {
      if (modo === 'red' && !S.anfitrion) { await enviar('ronda', {}); dibujar(); return; }
      await serie(async () => { const res = reclamarRonda(E, p); if (res.ok) { if (modo === 'red') await publicar(res.eventos); encolarEv(res.eventos, clonar(E)); } });
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
      if (r.ok) { if (modo === 'red') await publicar(r.eventos); encolarEv(r.eventos, clonar(E)); }
    });
  }

  function irASolo() { try { if (!window.__sinSalto) location.href = '../'; } catch (e) { } } // TERMINAR PARTIDA devuelve al juego Solo
  async function terminar() {
    if (!E || E.estado !== 'jugando' || ocupado) return;
    const red = modo === 'red';
    ocupado = true;
    const r = await ventana(red && !S.anfitrion ? 'SALIR DE LA PARTIDA' : 'TERMINAR PARTIDA', `<p>${red ? (S.anfitrion ? '¿Realmente deseas terminar la partida? Tu amigo verá que saliste.' : '¿Realmente deseas salir? La partida termina y gana tu amigo.') : '¿Realmente deseas terminar la partida? Se perderá el avance de esta partida.'}</p>`,
      [{ txt: 'SEGUIR JUGANDO', val: 0, id: 'seguir' }, { txt: red && !S.anfitrion ? 'SALIR' : 'TERMINAR PARTIDA', val: 1, clase: 'fin', id: 'terminarSi' }]);
    ocupado = false;
    if (r === 1) {
      if (!red) { Voz.callar(); E = null; V = null; modo = null; ultimaCartaId = null; preguntada = ''; irASolo(); return; }
      else if (S.anfitrion) { await serie(async () => { const ev = abandono(S.asiento); await publicar(ev); }); const cod = S.codigo; quitarEscuchas(); borrarSesion(); Voz.callar(); await new Promise(r => setTimeout(r, 2500)); try { await Red.cerrarSala(cod); } catch (e) { } irASolo(); return; } // el amigo alcanza a ver que ganó
      else { try { await Red.enviarAccion(S.codigo, S.id, 'salir', {}); } catch (e) { } quitarEscuchas(); borrarSesion(); Voz.callar(); irASolo(); return; }
    }
    dibujar();
  }
  function abandono(seat) { // el jugador «seat» sale: gana el otro
    E.estado = 'fin'; E.ganador = 1 - seat; E.motivo = 'abandono';
    return [{ tipo: 'fin', ganador: E.ganador, motivo: 'abandono', puntos: E.score.slice() }];
  }

  // ---- prueba local ----
  function comenzarLocal() {
    if (!verLocal()) return;
    const nuevosNombres = [limpia($('#nom0').value) || 'Jugador 1', limpia($('#nom1').value) || 'Jugador 2'];
    if (modo !== 'local' || nuevosNombres.join() !== nombres.join()) victoriasLocal = [0, 0]; // otra pareja: el marcador de partidas empieza de cero
    nombres = nuevosNombres; panelFin = false;
    modo = 'local'; E = nueva({ rule38: $('#o38').checked, falta4: $('#o4f').checked }); V = null;
    ultimaCartaId = null; preguntada = ''; ocupado = false; $('#aviso').textContent = '';
    const iniciales = E.eventosIniciales || []; delete E.eventosIniciales;
    encolarEv(iniciales, clonar(E));
  }

  // ---- en línea ----
  function guardarSesion() { try { localStorage.setItem(CLAVE_SESION, JSON.stringify({ codigo: S.codigo, id: S.id, nombre: S.nombre, anfitrion: S.anfitrion })); } catch (e) { } }
  function borrarSesion() { try { localStorage.removeItem(CLAVE_SESION); } catch (e) { } }
  const nombreEscrito = () => { const m = patronClave($('#miNombre').value), n = limpia(m ? m[1] : $('#miNombre').value) || 'Jugador'; /* el nombre se usa sin las « » */ try { localStorage.setItem(CLAVE_NOMBRE, n); } catch (e) { } return n; };

  function quitarEscuchas() { if (!S) return; ['escSala', 'escAcc', 'pres'].forEach(k => { if (S[k]) { try { S[k].parar(); } catch (e) { } S[k] = null; } }); }
  function entrarSala(sala, yoJ) {
    S = { codigo: sala.codigo, id: yoJ.id, nombre: yoJ.nombre, anfitrion: yoJ.anfitrion, asiento: Math.max(0, (sala.jugadores.find(j => j.id === yoJ.id) || { asiento: 0 }).asiento), jugadores: sala.jugadores, maximo: sala.maximo, opciones: sala.opciones || {},
      fase: sala.fase, version: sala.version, vistoEv: (sala.estado && sala.estado.evSeq) || 0, ultima: sala.ultima_accion || 0, conectados: [], enviando: false, rivalEn: null };
    modo = 'red'; E = sala.estado ? sala.estado : null; V = E ? clonar(E) : null; panelFin = !!(E && E.estado === 'fin'); ultimaCartaId = null; preguntada = ''; ocupado = false; turnoMioAntes = false;
    guardarSesion();
    S.escSala = Red.escucharSala(sala.codigo, aplicarSala); S.escSala.ver(sala);
    S.pres = Red.presencia(sala.codigo, { id: S.id, nombre: S.nombre }, ids => { if (!S) return; S.conectados = ids; avisarRival(); dibujar(); });
    if (S.anfitrion) S.escAcc = Red.escucharAcciones(sala.codigo, S.ultima, a => serie(() => aplicarAccion(a)));
    dibujar();
    if (E && E.estado === 'jugando') preguntarRonda();
  }
  function avisarRival() { // la voz avisa si tu amigo se desconecta o vuelve durante la partida
    if (!S || !E || E.estado !== 'jugando') { if (S) S.rivalEn = null; return; }
    const riv = S.jugadores.find(j => j.asiento === 1 - S.asiento); if (!riv || !S.conectados.length) return;
    const en = S.conectados.includes(riv.id);
    if (S.rivalEn !== null && en !== S.rivalEn) Voz.hablar(en ? 'Tu amigo volvió.' : 'Tu amigo se desconectó.');
    S.rivalEn = en;
  }
  async function salirSala(avisar) {
    if (!S) { modo = null; E = null; V = null; dibujar(); return; }
    const s = S; quitarEscuchas(); borrarSesion(); Voz.callar(); S = null; modo = null; E = null; V = null; ultimaCartaId = null; preguntada = ''; ocupado = false;
    if (avisar && !s.anfitrion) { try { await Red.enviarAccion(s.codigo, s.id, 'salir', {}); } catch (e) { } }
    dibujar();
    if (s.anfitrion) setTimeout(() => { Red.cerrarSala(s.codigo).catch(() => { }); }, 4000); // un momento para que el otro vea el final
  }

  async function publicar(eventos, extra) { // el anfitrión guarda lo nuevo en la sala (sin partida todavía: solo la lista de jugadores)
    const fin = (eventos || []).find(e => e.tipo === 'fin');
    if (fin && (fin.ganador === 0 || fin.ganador === 1)) { const g = S.jugadores.find(j => j.asiento === fin.ganador); if (g) g.victorias = (g.victorias || 0) + 1; }
    if (fin) { try { Historial.guardar({ modo: 'amigos', nivel: 'Amistoso', jugador1: nom(0), jugador2: nom(1), puntaje1: fin.puntos[0], puntaje2: fin.puntos[1], ganador: fin.ganador === 0 || fin.ganador === 1 ? nom(fin.ganador) : '', admin: S.jugadores.some(j => j.adm) }); } catch (e) { console.error(e); } } // el anfitrión guarda la partida terminada en el historial
    const cambios = { jugadores: S.jugadores, ultima_accion: S.ultima };
    if (E) {
      S.version++;
      const copia = Object.assign({}, E, { ev: eventos || [], evSeq: S.version }); delete copia.eventosIniciales;
      Object.assign(cambios, { estado: copia, version: S.version, fase: E.estado === 'fin' ? 'fin' : 'jugando' });
    }
    await Red.guardar(S.codigo, Object.assign(cambios, extra || {}));
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
        S.jugadores = S.jugadores.concat([{ id: a.jugador, nombre: limpia(a.datos && a.datos.nombre) || 'Amigo', asiento: S.jugadores.length }].map((j, i, v) => (i === v.length - 1 && a.datos && a.datos.adm === true) ? Object.assign(j, { adm: true }) : j));
        dibujar(); toast(`${S.jugadores[S.jugadores.length - 1].nombre} entró a la sala`, 2500);
      }
    } else if (E && E.estado === 'jugando' && seat >= 0) {
      if (a.tipo === 'jugar') { const r = jugar(E, seat, a.datos.carta, a.datos.indice); if (r.ok) eventos = r.eventos; }
      else if (a.tipo === 'ronda') { const r = reclamarRonda(E, seat); if (r.ok) eventos = r.eventos; }
      else if (a.tipo === 'salir') { eventos = abandono(seat); const j = S.jugadores.find(x => x.id === a.jugador); if (j) j.salio = true; }
    } else if (E && E.estado === 'fin' && seat >= 0) {
      if (a.tipo === 'revancha') { const j = S.jugadores.find(x => x.id === a.jugador); if (j) j.listo = true; }
      else if (a.tipo === 'salir') { const j = S.jugadores.find(x => x.id === a.jugador); if (j) j.salio = true; }
    } else if (!E && a.tipo === 'salir' && seat > 0) { S.jugadores = S.jugadores.filter(x => x.id !== a.jugador); } // salió del lobby
    try { await publicar(eventos); } catch (e) { toast('No se pudo guardar la jugada. Revisa tu conexión.', 4000); console.error(e); }
    if (eventos.length) encolarEv(eventos, clonar(E));
    else if (E && E.estado === 'fin' && S.jugadores.some(j => j.salio)) await volverAlLobby();
    else { dibujar(); await intentarRevancha(); }
  }
  async function comenzarRed() { // el anfitrión reparte
    if (!S || !S.anfitrion || E || S.jugadores.length < S.maximo) return;
    await serie(async () => {
      E = nueva(S.opciones); V = null; preguntada = ''; ultimaCartaId = null;
      const ev = E.eventosIniciales || []; delete E.eventosIniciales;
      await publicar(ev); encolarEv(ev, clonar(E));
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
      if (seq > S.vistoEv) { S.vistoEv = seq; encolarEv(evs, clonar(sala.estado)); } else dibujar();
    } else dibujar();
  }

  async function crearSalaUI() {
    if (!Red.disponible()) { toast('No se pudo cargar la conexión. Revisa tu internet y recarga.', 4500); return; }
    const nombre = nombreEscrito(), id = Red.nuevoId();
    $('#btnCrear').disabled = true;
    try {
      const sala = await Red.crearSala({ id, nombre, maximo: 2, adm: esAdmin, opciones: { rule38: $('#o38').checked, falta4: $('#o4f').checked } });
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
      await Red.enviarAccion(codigo, id, 'unirse', esAdmin ? { nombre, adm: true } : { nombre });
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
      if (sala && sala.jugadores.some(j => j.id === ses.id)) { entrarSala(sala, ses); toast('Volviste a la sala ' + sala.codigo, 3000); }
      else borrarSesion();
    } catch (e) { toast('Sin conexión: no se pudo volver a tu sala todavía.', 4000); }
  }

  // ---- eventos de la pantalla ----
  $('#principal').onclick = () => {
    Efectos.desbloquear();
    if (!modo) comenzarLocal();
    else if (modo === 'local') { if (E && E.estado === 'jugando') terminar(); else { E = null; V = null; modo = null; panelFin = false; dibujar(); } }
    else if (!E) comenzarRed();
    else if (E.estado === 'jugando') terminar();
    else salirSala(true);
  };
  $('#btnCrear').onclick = crearSalaUI; $('#btnUnirme').onclick = unirmeUI;
  $('#btnHistorial').onclick = abrirHistorial;
  $('#rvOtra').onclick = marcarListo;
  $('#rvSalir').onclick = () => { if (modo === 'local') { E = null; V = null; modo = null; panelFin = false; dibujar(); } else salirSala(true); };
  $('#miNombre').addEventListener('input', revisarAdmin);
  $('#lbSalir').onclick = () => salirSala(true);
  $('#lbCopiar').onclick = async () => { try { await navigator.clipboard.writeText(S.codigo); toast('Código copiado: ' + S.codigo, 2000); } catch (e) { toast('Código: ' + S.codigo, 3000); } };
  $('#btnVoz').onclick = () => { Voz.alternar(); dibujar(); if (Voz.activa()) Voz.hablar('La voz está activada.'); };
  $('#btnSonido').onclick = () => { Efectos.alternarSonido(); dibujar(); };
  $('#codigoSala').addEventListener('input', e => { e.target.value = Red.normaliza(e.target.value); });
  $('#irSolo').addEventListener('click', e => { if ($('#irSolo').getAttribute('aria-disabled') === 'true') e.preventDefault(); });
  // ---- lupa: mantener pulsada una carta de frente la muestra 3 veces más grande (número y palo se leen sin esfuerzo) ----
  let lupaT = null, lupaEl = null, lupaIni = null, lupaSuprime = 0, cartaGrande = null;
  function lupaCerrar() {
    clearTimeout(lupaT); lupaT = null; lupaIni = null;
    if (lupaEl) { lupaEl.remove(); lupaEl = null; lupaSuprime = Date.now() + 450; }
    if (cartaGrande) { cartaGrande.classList.remove('agrandada'); const f = cartaGrande.closest('.fila'); if (f) f.classList.remove('con-agrandada'); cartaGrande = null; lupaSuprime = Date.now() + 450; }
  }
  // arrastrar una carta de abajo hacia arriba (al menos el alto de la carta) la juega, como si se botara; menos que eso y regresa a la mano
  let arr = null; const MARGEN = 10; // px de margen para distinguir un toque de un arrastre
  const puedeBotar = card => card.classList.contains('jugable') && card.closest('.fila.yo');
  function arrastrar(e) {
    const dx = e.clientX - arr.x, dy = e.clientY - arr.y;
    arr.card.style.transform = `translate(${dx}px, ${dy}px)${arr.grande ? ' scale(1.5)' : ''}`;
    arr.listo = -dy >= arr.alto; arr.card.classList.toggle('listo', arr.listo);
  }
  async function soltarArrastre() {
    if (!arr) return; const a = arr; arr = null; lupaSuprime = Date.now() + 450;
    const card = a.card; card.classList.remove('arrastrando');
    if (a.listo && card.isConnected) {
      const m = /translate\(([^,]+),\s*([^)]+)\)/.exec(card.style.transform || '');
      card.classList.remove('agrandada', 'listo'); const f = card.closest('.fila'); if (f) f.classList.remove('con-agrandada'); cartaGrande = null;
      card.style.transform = m ? `translate(${m[1]}, ${m[2]})` : ''; // la carta sale volando desde donde se soltó
      const id = card.dataset.id, quien = jugadorEn(Number(card.parentElement.id.slice(4)));
      await jugarCarta(quien, id);
      if (card.isConnected) { card.style.transition = 'transform .15s'; card.style.transform = ''; setTimeout(() => { card.style.transition = ''; card.style.transformOrigin = ''; }, 200); }
    } else if (card.isConnected) {
      card.classList.remove('listo', 'agrandada'); const f = card.closest('.fila'); if (f) f.classList.remove('con-agrandada'); cartaGrande = null;
      card.style.transition = 'transform .15s'; card.style.transform = ''; setTimeout(() => { card.style.transition = ''; card.style.transformOrigin = ''; }, 200);
    }
  }
  // cartas de abajo (las tuyas): al mantenerlas pulsadas la carta se agranda un 50 %, nada más
  function agrandar(card) {
    if (!card.isConnected) return;
    card.classList.add('agrandada'); const f = card.closest('.fila'); if (f) f.classList.add('con-agrandada'); cartaGrande = card;
    try { navigator.vibrate && navigator.vibrate(10); } catch (e) { }
  }
  function lupaMostrar(card) {
    if (!card.isConnected) return;
    const r = card.getBoundingClientRect();
    const alto = Math.max(r.height, Math.min(r.height * 3, innerHeight * .7, (innerWidth - 24) / .7)); // 3 veces, sin salirse de la pantalla
    const v = document.createElement('div'); v.className = 'lupa'; v.setAttribute('aria-hidden', 'true');
    const c = card.cloneNode(true);
    c.classList.remove('jugable', 'ultima', 'is-focus', 'is-marked', 'lift-origin', 'flight'); c.removeAttribute('id');
    c.style.cssText = `--ch:${alto}px;--cw:${alto * .7}px`;
    v.appendChild(c); document.body.appendChild(v); lupaEl = v;
    try { navigator.vibrate && navigator.vibrate(12); } catch (e) { }
  }
  document.addEventListener('pointerdown', e => {
    const card = e.target.closest && e.target.closest('.card:not(.back):not(.flight):not(.lupa .card)');
    if (!card || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (card.closest('.fila.opp')) return; // las cartas de arriba (las del rival) nunca se agrandan, ni siquiera en el modo de administrador
    const abajo = !!card.closest('.fila.yo');
    lupaCerrar(); lupaIni = { x: e.clientX, y: e.clientY, card, id: e.pointerId };
    lupaT = setTimeout(() => (abajo ? agrandar(card) : lupaMostrar(card)), 300); // abajo: +50 %; las de la mesa conservan la lupa de siempre
  }, true);
  document.addEventListener('pointermove', e => {
    if (arr) { e.preventDefault(); arrastrar(e); return; }
    if (!lupaIni) return;
    const dx = e.clientX - lupaIni.x, dy = e.clientY - lupaIni.y;
    if (lupaIni.card && dy < -MARGEN && Math.abs(dx) <= Math.abs(dy) && puedeBotar(lupaIni.card)) { // empieza el arrastre hacia arriba
      clearTimeout(lupaT); lupaT = null;
      const card = lupaIni.card; arr = { card, x: lupaIni.x, y: lupaIni.y, alto: card.offsetHeight, grande: card.classList.contains('agrandada'), listo: false };
      card.classList.add('arrastrando'); card.style.transition = 'none'; const f = card.closest('.fila'); if (f) f.classList.add('con-agrandada');
      if (arr.grande) { card.classList.remove('agrandada'); card.style.transformOrigin = '50% 100%'; } // la escala de 1,5 pasa a ir en el transform en línea
      try { card.setPointerCapture(lupaIni.id); } catch (x) { }
      arrastrar(e); return;
    }
    if (lupaT && Math.hypot(dx, dy) > 14) { clearTimeout(lupaT); lupaT = null; }
  }, true);
  ['pointerup', 'pointercancel'].forEach(n => addEventListener(n, () => { if (arr) soltarArrastre(); lupaCerrar(); }, true));
  addEventListener('blur', e => { if (e.target === window) lupaCerrar(); }, true); // solo si la ventana pierde el foco (no cuando cambia el foco de un botón)
  document.addEventListener('visibilitychange', lupaCerrar);
  document.addEventListener('contextmenu', e => { if (e.target.closest && e.target.closest('.card')) e.preventDefault(); }, true);
  document.addEventListener('click', e => { if (Date.now() < lupaSuprime) { e.stopImmediatePropagation(); e.preventDefault(); } }, true); // soltar después de mirar con la lupa no juega la carta
  document.addEventListener('click', e => {
    const c = e.target.closest('.mano .card.jugable'); if (!c) return;
    jugarCarta(jugadorEn(Number(c.parentElement.id.slice(4))), c.dataset.id);
  });
  $('#oVer').addEventListener('change', dibujar);
  document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.opcion')) { e.preventDefault(); e.target.click(); } });
  $('#version').textContent = VERSION;
  // la versión se ve flotando mientras se mantiene pulsado el círculo 40
  { const logo = $('#logo40'), ver = $('#version'); let tv = null;
    const ocultar = () => { clearTimeout(tv); tv = null; ver.hidden = true; };
    logo.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' && e.button !== 0) return; ocultar(); tv = setTimeout(() => { ver.hidden = false; try { navigator.vibrate && navigator.vibrate(10); } catch (x) { } }, 250); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(n => logo.addEventListener(n, ocultar));
    logo.addEventListener('contextmenu', e => e.preventDefault());
    logo.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ver.hidden = false; setTimeout(() => { ver.hidden = true; }, 2000); } });
    // el círculo 40 se ve unos 5 segundos al abrir y luego desaparece: los marcadores usan ese espacio
    setTimeout(() => { logo.classList.add('saliendo'); setTimeout(() => { logo.hidden = true; }, 500); }, 5000);
    // sin el círculo, la versión se ve manteniendo pulsado un marcador (1 segundo)
    const marc = document.querySelector('.scores'); let tm = null;
    const quitarM = () => { clearTimeout(tm); tm = null; ver.hidden = true; };
    marc.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' && e.button !== 0) return; quitarM(); tm = setTimeout(() => { ver.hidden = false; try { navigator.vibrate && navigator.vibrate(10); } catch (x) { } }, 1000); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(n => marc.addEventListener(n, quitarM));
  }
  // El nombre se pide solo la primera vez: si ya está guardado (aquí o en Solo) se usa y el campo ya no se muestra (sin avisos).
  try {
    const solo = localStorage.getItem('donBarajonPlayerName') || '', propio = localStorage.getItem(CLAVE_NOMBRE) || '';
    // Si el nombre de Solo va entre « » (administrador), se usa el nombre sin las flechas, igual que en Solo.
    const mSolo = patronClave(solo);
    const guardado = mSolo ? limpia(mSolo[1]) : (propio || limpia(solo));
    $('#miNombre').value = guardado;
    if (guardado) $('#nombreCampo').hidden = true;
  } catch (e) { }
  // pestañas ANFITRIÓN / INVITADO (se recuerda la última que se usó)
  function elegirPestana(inv, enfocar) {
    $('#panelAnf').hidden = inv; $('#panelInv').hidden = !inv;
    [['#tabAnf', !inv], ['#tabInv', inv]].forEach(([s, on]) => { const b = $(s); b.classList.toggle('activa', on); b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
    try { localStorage.setItem('amigosPestana', inv ? 'invitado' : 'anfitrion'); } catch (e) { }
    if (enfocar) $(inv ? '#tabInv' : '#tabAnf').focus();
  }
  $('#tabAnf').onclick = () => elegirPestana(false); $('#tabInv').onclick = () => elegirPestana(true);
  $('.pestanas').addEventListener('keydown', e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); elegirPestana(e.key === 'ArrowRight', true); } });
  try { elegirPestana(localStorage.getItem('amigosPestana') === 'invitado'); } catch (e) { }
  window.Mesa = { nombreEscrito, forzarAdmin(v, clave) { esAdmin = !!v; if (clave) claveAdmin = clave; dibujar(); }, verPruebaLocal(v) { pruebaLocal = !!v; dibujar(); }, get esAdmin() { return esAdmin; }, get E() { return E; }, get V() { return V; }, get S() { return S; }, get modo() { return modo; }, get ocupado() { return ocupado; }, jugarCarta, dibujar, preguntarRonda };
  dibujar();
  revisarAdmin();
  reanudar();
})();
