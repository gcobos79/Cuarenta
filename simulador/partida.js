// Simulador de una partida completa entre dos bots, con el mismo flujo que el juego:
// ciclos de 4 secciones, ronda, cuatro iguales, caída, limpia, conteo, «38 que no juegan» y «4 de falta».
'use strict';
const { makeDeck, shuffle, legalCaptures, conteo } = require('../motor/reglas.js');
const { rondaValueOfHand } = require('./niveles-actuales.js');

// Vista del estado desde el asiento `me` (que pasa a ser el índice 1, como Don en el juego).
function vistaDesde(S, me) {
  const sw = a => me === 1 ? [a[0], a[1]] : [a[1], a[0]];
  return {
    deck: S.deck, table: S.table, section: S.section, cycleNo: S.cycleNo,
    rule38: S.rule38, falta4: S.falta4,
    hands: sw(S.hands), captured: sw(S.captured), score: sw(S.score),
    rounda: sw(S.rounda), rondaClaimed: sw(S.rondaClaimed), rondaVal: sw(S.rondaVal),
    rondaFall: sw(S.rondaFall), s1Captured: sw(S.s1Captured), played: sw(S.played),
    historial: S.historial.map(h => ({ ...h, p: h.p === me ? 1 : 0 })),
    dealer: S.dealer === me ? 1 : 0,
    turn: S.turn === me ? 1 : 0,
    lastPlayed: S.lastPlayed ? { player: S.lastPlayed.player === me ? 1 : 0, card: S.lastPlayed.card } : null,
  };
}

const hasN = (h, n) => Object.values(h.reduce((m, c) => (m[c.value] = (m[c.value] || 0) + 1, m), {})).some(k => k === n);

function jugarPartida(bots, opts = {}) {
  const first = opts.first ?? 0;
  const rnd = opts.rnd || Math.random; // azar del mazo (con semilla en el torneo, para comparar con los mismos repartos)
  const S = {
    deck: shuffle(makeDeck(), rnd), hands: [[], []], table: [], captured: [[], []], score: [0, 0],
    dealer: 1 - first, turn: first, section: 1, cycleNo: 1, lastPlayed: null,
    rounda: [false, false], rondaClaimed: [false, false], rondaVal: [null, null], rondaFall: [false, false],
    s1Captured: [false, false], played: [[], []], historial: [], rule38: !!opts.rule38, falta4: !!opts.falta4,
  };
  const at38 = p => S.rule38 && S.score[p] === 38;
  const stats = { moves: 0, ciclos: 0 };
  let winner = null;
  const win = p => { winner = p; return true; };

  function dealSection() {
    if (S.section === 1) S.s1Captured = [false, false];
    const f = 1 - S.dealer; S.hands = [[], []];
    for (let i = 0; i < 5; i++) { S.hands[f].push(S.deck.shift()); S.hands[S.dealer].push(S.deck.shift()); }
    S.turn = f; S.lastPlayed = null; S.rondaClaimed = [false, false]; S.rondaFall = [false, false]; S.played = [[], []]; S.historial = [];
    S.rondaVal = S.hands.map(rondaValueOfHand);
    S.rounda = S.hands.map(h => hasN(h, 3));
    const four = S.hands.findIndex(h => hasN(h, 4));
    if (four !== -1) return win(four);
    // Cada asiento decide si reclama su ronda (en el juego, Don decide primero; el orden no cambia el resultado).
    for (const p of [0, 1]) {
      if (!S.rounda[p] || at38(p)) continue;
      const bot = bots[p];
      const claim = bot.reclamaRonda ? bot.reclamaRonda(vistaDesde(S, p)) : true;
      if (claim) { S.rondaClaimed[p] = true; S.score[p] += 2; if (S.score[p] >= 40) return win(p); }
    }
    return false;
  }

  function aplicar(p, c, take) {
    const prev = S.lastPlayed;
    const mesaAntes = S.table.slice();
    const caida = !!(prev && prev.player !== p && prev.card.value === c.value && take.some(x => x.id === prev.card.id));
    const limpia = take.length > 0 && S.table.filter(x => !take.some(y => y.id === x.id)).length === 0;
    S.hands[p] = S.hands[p].filter(x => x.id !== c.id);
    S.table = S.table.filter(x => !take.some(y => y.id === x.id));
    if (take.length) S.captured[p].push(...take, c); else S.table.push(c);
    S.played[p].push(c);
    S.historial.push({ p, c, capturo: take.length > 0, mesaAntes });
    let pts = (caida ? 2 : 0) + (limpia ? 2 : 0);
    if (at38(p) && pts) pts = caida ? 2 : 0;
    S.score[p] += pts;
    S.lastPlayed = { player: p, card: c };
    if (take.length && S.section === 1) S.s1Captured[p] = true;
    if (caida && S.rondaClaimed[1 - p] && S.rondaVal[1 - p] === c.value) S.rondaFall[p] = true;
    S.turn = 1 - p;
    stats.moves++;
    if (S.score[p] >= 40) return win(p);
    return false;
  }

  function endSection() {
    for (const h of [0, 1]) {
      if (S.rondaClaimed[h] && S.rondaVal[h] != null) { const f = 1 - h; if (S.rondaFall[f] && !at38(f)) S.score[f] += 4; }
    }
    if (S.score[0] >= 40 || S.score[1] >= 40) return win(S.score[0] >= 40 ? 0 : 1);
    if (S.falta4 && S.section === 1) {
      const d = S.dealer, r = 1 - d;
      if (!S.s1Captured[d] && S.s1Captured[r] && !at38(r)) { S.score[r] += 4; if (S.score[r] >= 40) return win(r); }
    }
    if (S.section < 4) { S.section++; return dealSection(); }
    // Fin de ciclo: conteo de cartas.
    let [pa, pb] = conteo(S.captured[0].length, S.captured[1].length, S.dealer);
    if (at38(0)) pa = 0; if (at38(1)) pb = 0;
    S.score[0] += pa; S.score[1] += pb; stats.ciclos++;
    S.deck = shuffle([...S.table, ...S.captured[0], ...S.captured[1]], rnd);
    S.table = []; S.captured = [[], []]; S.dealer = 1 - S.dealer; S.section = 1; S.cycleNo++; S.lastPlayed = null;
    if (S.score[0] >= 40 || S.score[1] >= 40) return win(S.score[0] >= 40 ? 0 : 1);
    if (S.cycleNo > 60) return win(S.score[0] >= S.score[1] ? 0 : 1); // salvaguarda
    return dealSection();
  }

  if (dealSection()) return { winner, score: S.score, ...stats };
  for (;;) {
    const p = S.turn;
    const pick = bots[p].elegir(vistaDesde(S, p));
    // Validación: la jugada debe ser legal (captura obligatoria si existe).
    const legal = legalCaptures(pick.c, S.table);
    const ok = S.hands[p].some(x => x.id === pick.c.id) &&
      (legal.length ? legal.some(o => o.length === pick.o.length && o.every(x => pick.o.some(y => y.id === x.id))) : pick.o.length === 0);
    if (!ok) throw new Error('Jugada ilegal del bot ' + p);
    if (aplicar(p, pick.c, pick.o)) break;
    if (!S.hands[0].length && !S.hands[1].length) { if (endSection()) break; }
  }
  return { winner, score: S.score, ...stats };
}

module.exports = { jugarPartida, vistaDesde };
