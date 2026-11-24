/* CUARENTA · Amigos — reglas del juego (V2.02).
   Copia de la mecánica y del puntaje del juego Solo, sin pantalla: capturas por igualdad, suma y escalera, caída, limpia,
   ronda con su bono, «38 que no juegan», «4 de falta» y conteo de cartas. Todo el estado es JSON (se podrá guardar y enviar).
   Los jugadores son 0 y 1. Cada función recibe el estado E y devuelve la lista de eventos que ocurrieron. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Reglas = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const R = ['A', '2', '3', '4', '5', '6', '7', 'J', 'Q', 'K'], SU = ['♠', '♥', '♦', '♣'];
  const V = {}; R.forEach((r, i) => { V[r] = i + 1; });

  function crearBaraja() {
    const out = [];
    SU.forEach((s, i) => R.forEach(r => out.push({ id: r + '.' + i, rank: r, suit: s, value: V[r], color: (i === 1 || i === 2) ? 'red' : 'black' })));
    return out;
  }
  function mezclar(a, rnd) {
    rnd = rnd || Math.random; a = a.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function semilla(n) { // generador repetible para las pruebas
    return function () { n |= 0; n = n + 0x6D2B79F5 | 0; let t = Math.imul(n ^ n >>> 15, 1 | n); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const ordenar = h => h.sort((a, b) => a.value - b.value || SU.indexOf(a.suit) - SU.indexOf(b.suit));

  // ---- capturas (idénticas a Solo) ----
  function combinaciones(a, k, start, cur, out) {
    start = start || 0; cur = cur || []; out = out || [];
    if (cur.length === k) { out.push(cur.slice()); return out; }
    for (let i = start; i <= a.length - (k - cur.length); i++) { cur.push(a[i]); combinaciones(a, k, i + 1, cur, out); cur.pop(); }
    return out;
  }
  function expandirCaptura(base, c, mesa) {
    const ids = new Set(base.map(x => x.id));
    // La escalera continúa con una carta de cada valor siguiente y nunca pasa de K (10).
    for (let value = c.value + 1; value <= 10; value++) {
      const next = mesa.find(x => x.value === value && !ids.has(x.id));
      if (!next) break;
      ids.add(next.id);
    }
    return mesa.filter(x => ids.has(x.id));
  }
  function capturasLegales(c, mesa) {
    const out = [], seen = new Set();
    const add = base => {
      const found = expandirCaptura(base, c, mesa);
      const key = found.map(x => x.id).sort().join('|');
      if (!seen.has(key)) { seen.add(key); out.push(found); }
    };
    for (const x of mesa.filter(x => x.value === c.value)) add([x]); // igualdad
    if (c.value >= 2 && c.value <= 7) { // suma de dos o más cartas numéricas menores; J, Q y K nunca suman
      const numericas = mesa.filter(x => x.value >= 1 && x.value < c.value);
      for (let k = 2; k <= numericas.length; k++) {
        for (const grupo of combinaciones(numericas, k)) if (grupo.reduce((s, x) => s + x.value, 0) === c.value) add(grupo);
      }
    }
    return out;
  }

  // ---- puntajes ----
  function puntosConteo(n) { if (n <= 19) return 0; if (n === 20) return 6; const raw = n - 14; return raw % 2 === 0 ? raw : raw + 1; }
  function valorRonda(h) { const m = {}; h.forEach(c => { m[c.value] = (m[c.value] || 0) + 1; }); const v = Object.keys(m).find(k => m[k] === 3); return v === undefined ? null : Number(v); }
  const cuatroIguales = h => Object.values(h.reduce((m, c) => (m[c.value] = (m[c.value] || 0) + 1, m), {})).some(n => n === 4);
  const tiene38 = (E, p) => E.opts.rule38 && E.score[p] === 38;

  // Suma puntos respetando «38 que no juegan» (con 38 solo suma una caída).
  function sumar(E, p, pts, fuente, ev) {
    if (tiene38(E, p)) { ev.push({ tipo: 'bloqueo38', jugador: p, puntos: pts, por: fuente }); return false; }
    const antes = E.score[p]; E.score[p] += pts;
    if (E.opts.rule38 && antes < 38 && E.score[p] === 38) ev.push({ tipo: 'llega38', jugador: p });
    return true;
  }
  function terminar(E, ganador, motivo, ev) {
    E.estado = 'fin'; E.ganador = ganador; E.motivo = motivo;
    ev.push({ tipo: 'fin', ganador, motivo, puntos: E.score.slice() });
  }

  // ---- partida ----
  function nueva(op) {
    op = op || {}; const rnd = op.rnd || Math.random;
    const E = {
      v: 1, opts: { rule38: !!op.rule38, falta4: !!op.falta4 },
      deck: mezclar(crearBaraja(), rnd), hands: [[], []], table: [], captured: [[], []], score: [0, 0],
      dealer: (op.dealer === 0 || op.dealer === 1) ? op.dealer : (rnd() < 0.5 ? 0 : 1), turn: 0, section: 1, cycle: 1, lastPlayed: null,
      rounda: [false, false], rondaVal: [null, null], rondaClaimed: [false, false], rondaFall: [false, false], s1Captured: [false, false],
      estado: 'jugando', ganador: null, motivo: ''
    };
    E.dealerInicial = E.dealer; // quién repartió primero (en la revancha reparte el otro)
    const ev = []; repartir(E, ev); E.eventosIniciales = ev; return E;
  }
  function repartir(E, ev) {
    const first = 1 - E.dealer; E.hands = [[], []];
    for (let i = 0; i < 5; i++) { E.hands[first].push(E.deck.shift()); E.hands[E.dealer].push(E.deck.shift()); }
    E.hands.forEach(ordenar);
    E.turn = first; E.lastPlayed = null; E.rondaClaimed = [false, false]; E.rondaFall = [false, false];
    E.rondaVal = E.hands.map(valorRonda); E.rounda = E.rondaVal.map(v => v !== null);
    if (E.section === 1) E.s1Captured = [false, false];
    ev.push({ tipo: 'reparto', seccion: E.section, ciclo: E.cycle, repartidor: E.dealer, comienza: first });
    const cuatro = E.hands.findIndex(cuatroIguales);
    if (cuatro !== -1) terminar(E, cuatro, 'cuatro', ev); // cuatro cartas iguales en el reparto: gana quien las tiene
  }
  const opciones = (E, p, id) => { const c = E.hands[p].find(x => x.id === id); return c ? capturasLegales(c, E.table) : []; };

  function puedeRonda(E, p) {
    return E.estado === 'jugando' && E.turn === p && E.rounda[p] && !E.rondaClaimed[p] && E.hands[p].length === 5 && !tiene38(E, p);
  }
  function reclamarRonda(E, p) {
    if (!puedeRonda(E, p)) return { ok: false, error: 'ronda' };
    const ev = []; E.rondaClaimed[p] = true;
    sumar(E, p, 2, 'ronda', ev);
    ev.push({ tipo: 'ronda', jugador: p, valor: R[E.rondaVal[p] - 1], puntos: 2 });
    if (E.score[p] >= 40) terminar(E, p, '40', ev);
    return { ok: true, eventos: ev };
  }

  function jugar(E, p, id, indice, rnd) {
    if (E.estado !== 'jugando') return { ok: false, error: 'fin' };
    if (E.turn !== p) return { ok: false, error: 'turno' };
    const c = E.hands[p].find(x => x.id === id); if (!c) return { ok: false, error: 'carta' };
    const opts = capturasLegales(c, E.table); let take;
    if (opts.length > 1) {
      if (indice === undefined || indice === null || !opts[indice]) return { ok: false, error: 'elegir', opciones: opts };
      take = opts[indice];
    } else take = opts[0] || [];
    const ev = [], previa = E.lastPlayed;
    const caida = !!(previa && previa.jugador !== p && previa.carta.value === c.value && take.some(x => x.id === previa.carta.id));
    const limpia = take.length > 0 && E.table.filter(x => !take.some(y => y.id === x.id)).length === 0;
    E.hands[p] = E.hands[p].filter(x => x.id !== c.id);
    E.table = E.table.filter(x => !take.some(y => y.id === x.id));
    if (take.length) E.captured[p].push(...take, c); else E.table.push(c);
    let pts = (caida ? 2 : 0) + (limpia ? 2 : 0);
    const antes = E.score[p];
    if (tiene38(E, p) && pts) { if (caida) pts = 2; else { ev.push({ tipo: 'bloqueo38', jugador: p, puntos: pts, por: 'limpia' }); pts = 0; } }
    if (pts) { E.score[p] += pts; if (E.opts.rule38 && antes < 38 && E.score[p] === 38) ev.push({ tipo: 'llega38', jugador: p }); }
    E.lastPlayed = { jugador: p, carta: c };
    if (take.length && E.section === 1) E.s1Captured[p] = true;
    if (caida && E.rondaClaimed[1 - p] && E.rondaVal[1 - p] === c.value) E.rondaFall[p] = true; // caída sobre la ronda del rival
    E.turn = 1 - p;
    ev.push({ tipo: 'jugada', jugador: p, carta: c, captura: take, caida, limpia, puntos: pts });
    if (E.score[p] >= 40) { terminar(E, p, (E.opts.rule38 && antes === 38) ? 'caida38' : '40', ev); return { ok: true, eventos: ev }; }
    if (!E.hands[0].length && !E.hands[1].length) cerrarSeccion(E, ev, rnd);
    return { ok: true, eventos: ev };
  }

  function cerrarSeccion(E, ev, rnd) {
    for (const h of [0, 1]) { // confirmación de la ronda y bono de +4 si el rival hizo caída sobre ella
      if (E.rondaClaimed[h] && E.rondaVal[h] != null) {
        const f = 1 - h, cayo = E.rondaFall[f];
        ev.push({ tipo: 'rondaConfirmada', jugador: h, valor: R[E.rondaVal[h] - 1], caida: cayo });
        if (cayo && sumar(E, f, 4, 'bono', ev)) ev.push({ tipo: 'bonoRonda', jugador: f, puntos: 4 });
      }
    }
    if (E.score[0] >= 40 || E.score[1] >= 40) { terminar(E, E.score[0] >= 40 ? 0 : 1, '40', ev); return; }
    if (E.opts.falta4 && E.section === 1) { // 4 de falta: quien reparte no levantó nada en la primera mano y el rival sí
      const d = E.dealer, r = 1 - d;
      if (!E.s1Captured[d] && E.s1Captured[r]) {
        if (sumar(E, r, 4, 'falta', ev)) ev.push({ tipo: 'falta4', jugador: r, repartidor: d, puntos: 4 });
        if (E.score[0] >= 40 || E.score[1] >= 40) { terminar(E, E.score[0] >= 40 ? 0 : 1, '40', ev); return; }
      }
    }
    if (E.section < 4) { E.section++; repartir(E, ev); return; }
    // fin del ciclo: conteo de cartas
    const a = E.captured[0].length, b = E.captured[1].length; let pa = 0, pb = 0;
    if (a === 20 && b === 20) { if (E.dealer === 1) pa = 6; else pb = 6; }
    else if (a > b) pa = puntosConteo(a); else if (b > a) pb = puntosConteo(b);
    ev.push({ tipo: 'conteo', capturadas: [a, b], puntos: [pa, pb] });
    if (pa > 0) sumar(E, 0, pa, 'conteo', ev);
    if (pb > 0) sumar(E, 1, pb, 'conteo', ev);
    if (E.score[0] >= 40 || E.score[1] >= 40) { terminar(E, E.score[0] >= 40 ? 0 : 1, '40', ev); return; }
    E.deck = mezclar([...E.table, ...E.captured[0], ...E.captured[1]], rnd);
    E.table = []; E.captured = [[], []]; E.dealer = 1 - E.dealer; E.section = 1; E.cycle++; E.lastPlayed = null;
    ev.push({ tipo: 'ciclo', ciclo: E.cycle });
    repartir(E, ev);
  }

  return { R, SU, V, crearBaraja, mezclar, semilla, capturasLegales, expandirCaptura, combinaciones, puntosConteo, valorRonda, nueva, opciones, puedeRonda, reclamarRonda, jugar };
});
