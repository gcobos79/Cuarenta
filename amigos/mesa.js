/* CUARENTA · Amigos — mesa (V2.02): pantalla de prueba local con dos jugadores en la misma pantalla.
   Usa las reglas de reglas.js; más adelante cada amigo verá la mesa desde su propio celular. */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const { jugar, reclamarRonda, puedeRonda, nueva, R } = Reglas;
  let E = null, nombres = ['Jugador 1', 'Jugador 2'], ocupado = false, preguntada = '', ultimaCartaId = null;

  const nom = p => nombres[p];
  const cartaTxt = c => c.rank + c.suit;
  const esFigura = c => c.rank === 'J' || c.rank === 'Q' || c.rank === 'K';
  const cartaHTML = (c, extra) => `<div class="card ${c.color}${esFigura(c) ? ' figcard' : ''}${extra || ''}" data-id="${c.id}"><span class="idx">${c.rank}<br>${c.suit}</span>${esFigura(c) ? `<svg class="fig" viewBox="0 0 200 280" aria-hidden="true"><use href="#fig${c.rank}"/></svg>` : `<b class="pip">${c.suit}</b>`}<span class="idx bottom">${c.rank}<br>${c.suit}</span></div>`;
  const dorsoHTML = '<div class="card back" aria-hidden="true"></div>';
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

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

  // ---- texto de los eventos ----
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
  function dibujar() {
    $('#n0').textContent = nom(0); $('#n1').textContent = nom(1); $('#e0').textContent = nom(0); $('#e1').textContent = nom(1);
    const jugando = !!E && E.estado === 'jugando';
    $('#config').hidden = !!E; $('#estado').hidden = !E;
    if (!E) {
      $('#p0').textContent = '0'; $('#p1').textContent = '0'; $('#mano0').innerHTML = ''; $('#mano1').innerHTML = ''; $('#mesa').innerHTML = '';
      $('#pila0').innerHTML = ''; $('#pila1').innerHTML = ''; $('#sc0').classList.remove('activo'); $('#sc1').classList.remove('activo');
      $('#aviso').textContent = 'Escribe los nombres, elige las reglas y pulsa COMENZAR.';
    } else {
      $('#p0').textContent = E.score[0]; $('#p1').textContent = E.score[1];
      const ver = $('#oVer').checked;
      [0, 1].forEach(p => {
        const activa = jugando && E.turn === p && !ocupado;
        const cara = ver || E.turn === p;
        $('#mano' + p).classList.toggle('activa', activa);
        $('#mano' + p).innerHTML = E.hands[p].map(c => cara ? cartaHTML(c, activa ? ' jugable' : '') : dorsoHTML).join('');
        $('#pila' + p).innerHTML = `Levantadas<b>${E.captured[p].length}</b>`;
        $('#sc' + p).classList.toggle('activo', jugando && E.turn === p);
      });
      $('#mesa').innerHTML = E.table.map(c => cartaHTML(c, c.id === ultimaCartaId ? ' ultima' : '')).join('');
      $('#estado').textContent = `Ciclo ${E.cycle} · Sección ${E.section} de 4 · Reparte ${nom(E.dealer)}` + (jugando ? ` · Turno de ${nom(E.turn)}` : '');
    }
    const pr = $('#principal');
    pr.textContent = jugando ? 'TERMINAR PARTIDA' : 'COMENZAR'; pr.classList.toggle('fin', jugando); pr.classList.toggle('espera', !jugando && !E);
    const solo = $('#irSolo'); solo.setAttribute('aria-disabled', String(jugando)); solo.tabIndex = jugando ? -1 : 0;
  }

  // ---- flujo ----
  async function procesar(eventos) {
    ocupado = true; dibujar();
    for (const e of eventos) {
      if (e.tipo === 'jugada') { const j = E.table.find(c => c.id === e.carta.id); ultimaCartaId = j ? j.id : null; }
    }
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
        const mot = { cuatro: 'por cuatro cartas iguales', caida38: 'con una caída estando en 38', '40': 'al llegar a 40 puntos' }[e.motivo] || '';
        const r = await ventana('¡GANA ' + nom(e.ganador).toLocaleUpperCase() + '!', `<p>${mot ? 'Gana ' + mot + '.\n' : ''}Marcador final: ${esc(nom(0))} ${e.puntos[0]} — ${esc(nom(1))} ${e.puntos[1]}</p>`, [{ txt: 'NUEVA PARTIDA', val: 1, id: 'nuevaPartida' }]);
        E = null; ultimaCartaId = null; preguntada = '';
      }
    }
    ocupado = false; dibujar(); preguntarRonda();
  }

  async function preguntarRonda() {
    if (!E || E.estado !== 'jugando' || ocupado) return;
    const p = E.turn; if (!puedeRonda(E, p)) return;
    const clave = `${E.cycle}-${E.section}-${p}`; if (preguntada === clave) return;
    preguntada = clave; ocupado = true; dibujar();
    const cartas = E.hands[p].filter(c => c.value === E.rondaVal[p]);
    const r = await ventana(`¡${nom(p).toLocaleUpperCase()} TIENE RONDA!`, `<div class="cartas">${cartas.map(c => cartaHTML(c, ' mini')).join('')}</div><p>¿Deseas cobrarla? Suma 2 puntos.</p><p style="font-size:12px;opacity:.85">Si respondes NO, ya no podrás cobrarla en esta sección.</p>`,
      [{ txt: 'NO', val: 0, id: 'rondaNo' }, { txt: 'SÍ', val: 1, id: 'rondaSi' }]);
    ocupado = false;
    if (r === 1) { const res = reclamarRonda(E, p); if (res.ok) { await procesar(res.eventos); return; } }
    dibujar();
  }

  async function elegirCaptura(c, opciones) {
    const ordenadas = opciones.map(o => o.slice().sort((a, b) => a.value - b.value));
    const cuerpo = `<p>Esta carta permite más de una captura. Elige la que prefieras.</p>` + ordenadas.map((o, i) => `<div class="opcion" role="button" tabindex="0" data-val="${i}"><span>OPCIÓN ${i + 1}</span>${cartaHTML(c, ' mini')}${o.map(x => `<span class="mas">+</span>${cartaHTML(x, ' mini')}`).join('')}</div>`).join('');
    return ventana('ELIGE TU CAPTURA', cuerpo, [{ txt: 'CANCELAR', val: -1, id: 'cancelarCaptura' }]);
  }

  async function jugarCarta(p, id) {
    if (!E || E.estado !== 'jugando' || ocupado || E.turn !== p) return;
    let r = jugar(E, p, id);
    if (!r.ok && r.error === 'elegir') {
      ocupado = true; dibujar();
      const c = E.hands[p].find(x => x.id === id), i = await elegirCaptura(c, r.opciones);
      ocupado = false; if (i < 0) { dibujar(); return; }
      r = jugar(E, p, id, i);
    }
    if (r.ok) await procesar(r.eventos);
  }

  async function terminar() {
    if (!E || E.estado !== 'jugando' || ocupado) return;
    ocupado = true;
    const r = await ventana('TERMINAR PARTIDA', '<p>¿Realmente deseas terminar la partida? Se perderá el avance de esta partida.</p>', [{ txt: 'SEGUIR JUGANDO', val: 0, id: 'seguir' }, { txt: 'TERMINAR PARTIDA', val: 1, clase: 'fin', id: 'terminarSi' }]);
    ocupado = false;
    if (r === 1) { E = null; ultimaCartaId = null; preguntada = ''; }
    dibujar();
  }

  function comenzar() {
    nombres = [($('#nom0').value || '').trim().slice(0, 20) || 'Jugador 1', ($('#nom1').value || '').trim().slice(0, 20) || 'Jugador 2'];
    E = nueva({ rule38: $('#o38').checked, falta4: $('#o4f').checked });
    ultimaCartaId = null; preguntada = ''; ocupado = false;
    $('#aviso').textContent = '';
    const iniciales = E.eventosIniciales || [];
    dibujar();
    if (E.estado === 'fin') { procesar(iniciales.filter(e => e.tipo === 'fin').length ? iniciales : [{ tipo: 'fin', ganador: E.ganador, motivo: E.motivo, puntos: E.score.slice() }]); return; }
    toast(`Reparte ${nom(E.dealer)} y comienza ${nom(1 - E.dealer)}`, 3000);
    preguntarRonda();
  }

  // ---- eventos de la pantalla ----
  $('#principal').onclick = () => { if (E && E.estado === 'jugando') terminar(); else if (!E) comenzar(); };
  $('#irSolo').addEventListener('click', e => { if (E && E.estado === 'jugando') e.preventDefault(); });
  document.addEventListener('click', e => {
    const c = e.target.closest('.mano .card.jugable'); if (!c) return;
    jugarCarta(Number(c.parentElement.id.slice(4)), c.dataset.id);
  });
  $('#oVer').addEventListener('change', dibujar);
  document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.opcion')) { e.preventDefault(); e.target.click(); } });
  $('#version').textContent = 'V2.02';
  window.Mesa = { get E() { return E; }, jugarCarta, dibujar, preguntarRonda };
  dibujar();
})();
