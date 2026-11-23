// Pruebas de las reglas de Amigos. Se ejecutan con:  node --test amigos/pruebas/
const test = require('node:test');
const assert = require('node:assert/strict');
const Reglas = require('../reglas.js');
const { crearBaraja, capturasLegales, puntosConteo, nueva, jugar, reclamarRonda, puedeRonda, semilla } = Reglas;

const B = Object.fromEntries(crearBaraja().map(c => [c.id, c]));
const cartas = ids => ids.map(id => B[id]);
// Arma una situación concreta sobre un estado nuevo (el resto de la baraja queda en el mazo).
function armar(op, sit) {
  const E = nueva(Object.assign({ rnd: semilla(1), dealer: 0 }, op));
  const usadas = new Set([...(sit.h0 || []), ...(sit.h1 || []), ...(sit.mesa || []), ...(sit.cap0 || []), ...(sit.cap1 || [])]);
  E.estado = 'jugando'; E.ganador = null;
  E.hands = [cartas(sit.h0 || []), cartas(sit.h1 || [])]; E.table = cartas(sit.mesa || []);
  E.captured = [cartas(sit.cap0 || []), cartas(sit.cap1 || [])];
  E.deck = crearBaraja().filter(c => !usadas.has(c.id));
  E.turn = sit.turn === undefined ? 0 : sit.turn; E.section = sit.section || 1; E.dealer = sit.dealer === undefined ? 0 : sit.dealer;
  E.score = sit.score || [0, 0]; E.lastPlayed = sit.ultima ? { jugador: sit.ultima[0], carta: B[sit.ultima[1]] } : null;
  E.rounda = [false, false]; E.rondaVal = [null, null]; E.rondaClaimed = sit.rondaClaimed || [false, false]; E.rondaFall = [false, false];
  if (sit.rondaVal) E.rondaVal = sit.rondaVal;
  E.s1Captured = sit.s1 || [false, false];
  return E;
}
const tipos = r => r.eventos.map(e => e.tipo);

test('la baraja tiene 40 cartas distintas (A a 7, J, Q, K en cuatro palos)', () => {
  const b = crearBaraja(); assert.equal(b.length, 40); assert.equal(new Set(b.map(c => c.id)).size, 40);
  assert.deepEqual([...new Set(b.map(c => c.value))].sort((x, y) => x - y), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test('capturas: igualdad y suma dan opciones distintas', () => {
  const o = capturasLegales(B['5.1'], cartas(['5.0', '2.0', '3.0']));
  const claves = o.map(g => g.map(c => c.id).sort().join('+')).sort();
  assert.deepEqual(claves, ['2.0+3.0', '5.0']);
});
test('capturas: la escalera continúa con el valor siguiente y se detiene al faltar uno', () => {
  const o = capturasLegales(B['4.1'], cartas(['4.0', '5.0', '6.0', '3.0']));
  assert.equal(o.length, 1); assert.deepEqual(o[0].map(c => c.id).sort(), ['4.0', '5.0', '6.0']);
  const o2 = capturasLegales(B['A.1'], cartas(['A.0', '2.0', '3.0', '5.0']));
  assert.deepEqual(o2[0].map(c => c.id).sort(), ['2.0', '3.0', 'A.0']);
});
test('capturas: J, Q y K solo capturan por igualdad y nunca suman', () => {
  assert.equal(capturasLegales(B['J.1'], cartas(['2.0', '3.0', '5.0', '7.0'])).length, 0);
  const o = capturasLegales(B['J.1'], cartas(['J.0', 'Q.0']));
  assert.deepEqual(o[0].map(c => c.id).sort(), ['J.0', 'Q.0']); // igualdad con J y continúa con la Q
  assert.equal(capturasLegales(B['7.1'], cartas(['J.0'])).length, 0);
});
test('capturas: la suma usa solo cartas numéricas menores', () => {
  const o = capturasLegales(B['7.1'], cartas(['2.0', '5.0', '3.0', '4.0']));
  const claves = o.map(g => g.map(c => c.id).sort().join('+')).sort();
  assert.deepEqual(claves, ['2.0+5.0', '3.0+4.0']);
});

test('conteo de cartas: 19 no suma, 20 vale 6 y luego de 2 en 2', () => {
  assert.deepEqual([19, 20, 21, 22, 23, 24, 25, 26, 30, 32].map(puntosConteo), [0, 6, 8, 8, 10, 10, 12, 12, 16, 18]);
});

test('caída y limpia suman 2 cada una', () => {
  const E = armar({}, { h0: ['7.1'], h1: ['K.0'], mesa: ['7.0', '3.0'], turn: 0, ultima: [1, '7.0'] });
  const r = jugar(E, 0, '7.1'); assert.ok(r.ok);
  const j = r.eventos.find(e => e.tipo === 'jugada');
  assert.equal(j.caida, true); assert.equal(j.limpia, false); assert.equal(E.score[0], 2);
  const E2 = armar({}, { h0: ['7.1'], h1: ['K.0'], mesa: ['7.0'], turn: 0, ultima: [1, '7.0'] });
  jugar(E2, 0, '7.1'); assert.equal(E2.score[0], 4); // caída + limpia
});
test('limpia sin caída suma 2 y levantar una carta que no es la última jugada no es caída', () => {
  const E = armar({}, { h0: ['7.1'], h1: ['K.0'], mesa: ['7.0'], turn: 0, ultima: [0, '3.0'] });
  const r = jugar(E, 0, '7.1'); const j = r.eventos.find(e => e.tipo === 'jugada');
  assert.equal(j.caida, false); assert.equal(j.limpia, true); assert.equal(E.score[0], 2);
});
test('jugar fuera de turno o una carta que no se tiene no hace nada', () => {
  const E = armar({}, { h0: ['7.1'], h1: ['K.0'], turn: 0 });
  assert.equal(jugar(E, 1, 'K.0').ok, false); assert.equal(jugar(E, 0, 'K.0').ok, false);
});
test('con varias capturas posibles hay que elegir', () => {
  const E = armar({}, { h0: ['5.1', 'K.1'], h1: ['K.0', 'Q.0'], mesa: ['5.0', '2.0', '3.0'], turn: 0 });
  const r = jugar(E, 0, '5.1'); assert.equal(r.ok, false); assert.equal(r.error, 'elegir'); assert.equal(r.opciones.length, 2);
  const r2 = jugar(E, 0, '5.1', 1); assert.ok(r2.ok);
});

test('38 que no juegan: la limpia no suma, la caída sí y gana', () => {
  const E = armar({ rule38: true }, { h0: ['7.1', 'K.1'], h1: ['K.0'], mesa: ['7.0'], turn: 0, score: [38, 0], ultima: [0, '3.0'] });
  const r = jugar(E, 0, '7.1'); assert.ok(tipos(r).includes('bloqueo38')); assert.equal(E.score[0], 38);
  const E2 = armar({ rule38: true }, { h0: ['7.1', 'K.1'], h1: ['K.0'], mesa: ['7.0', '2.0'], turn: 0, score: [38, 0], ultima: [1, '7.0'] });
  const r2 = jugar(E2, 0, '7.1'); assert.equal(E2.score[0], 40); assert.equal(E2.estado, 'fin'); assert.equal(E2.motivo, 'caida38'); assert.ok(tipos(r2).includes('fin'));
});
test('al llegar justo a 38 se avisa', () => {
  const E = armar({ rule38: true }, { h0: ['7.1', 'K.1'], h1: ['K.0'], mesa: ['7.0'], turn: 0, score: [36, 0], ultima: [0, '3.0'] });
  const r = jugar(E, 0, '7.1'); assert.equal(E.score[0], 38); assert.ok(tipos(r).includes('llega38'));
});

test('ronda: se cobra antes de jugar la primera carta y suma 2', () => {
  const E = armar({}, { h0: ['7.0', '7.1', '7.2', 'K.0', '2.0'], h1: ['3.0', '4.0', '5.0', '6.0', 'Q.0'], turn: 0 });
  E.rounda = [true, false]; E.rondaVal = [7, null];
  assert.equal(puedeRonda(E, 0), true); assert.equal(puedeRonda(E, 1), false);
  const r = reclamarRonda(E, 0); assert.ok(r.ok); assert.equal(E.score[0], 2); assert.equal(puedeRonda(E, 0), false);
  const E2 = armar({}, { h0: ['7.0', '7.1', '7.2', 'K.0', '2.0'], h1: ['3.0', '4.0', '5.0', '6.0', 'Q.0'], turn: 0 });
  E2.rounda = [true, false]; E2.rondaVal = [7, null]; jugar(E2, 0, 'K.0');
  assert.equal(puedeRonda(E2, 0), false); // ya jugó una carta
});
test('ronda: no se puede cobrar con 38 (38 que no juegan)', () => {
  const E = armar({ rule38: true }, { h0: ['7.0', '7.1', '7.2', 'K.0', '2.0'], h1: ['3.0', '4.0', '5.0', '6.0', 'Q.0'], turn: 0, score: [38, 0] });
  E.rounda = [true, false]; E.rondaVal = [7, null]; assert.equal(puedeRonda(E, 0), false);
});
test('ronda: caída del rival sobre su valor da +4 al cerrar la sección', () => {
  const E = armar({}, { h0: ['7.0'], h1: ['7.1'], turn: 0, rondaClaimed: [true, false], rondaVal: [7, null] });
  jugar(E, 0, '7.0'); const r = jugar(E, 1, '7.1');
  assert.ok(tipos(r).includes('bonoRonda')); assert.equal(E.score[1], 2 + 2 + 4); // caída + limpia + bono
  assert.equal(E.section, 2); assert.equal(E.hands[0].length, 5); // se repartió la sección siguiente
});
test('4 de falta: el rival cobra 4 si quien reparte no levantó nada en la primera mano', () => {
  const E = armar({ falta4: true }, { h0: ['K.0'], h1: ['A.0'], mesa: ['A.1'], turn: 1, dealer: 0, section: 1 });
  jugar(E, 1, 'A.0'); const r = jugar(E, 0, 'K.0');
  assert.ok(tipos(r).includes('falta4')); assert.equal(E.score[1], 2 + 4); // limpia + 4 de falta
  const E2 = armar({ falta4: false }, { h0: ['K.0'], h1: ['A.0'], mesa: ['A.1'], turn: 1, dealer: 0, section: 1 });
  jugar(E2, 1, 'A.0'); jugar(E2, 0, 'K.0'); assert.equal(E2.score[1], 2);
});
test('cuatro cartas iguales en el reparto: gana quien las tiene', () => {
  let visto = false;
  for (let s = 1; s < 4000 && !visto; s++) { const E = nueva({ rnd: semilla(s) }); if (E.estado === 'fin') { visto = true; assert.equal(E.motivo, 'cuatro'); assert.ok(E.ganador === 0 || E.ganador === 1); } }
  assert.ok(visto, 'se esperaba encontrar un reparto con cuatro iguales entre 4000 semillas');
});

// Arma el último movimiento de un ciclo: quien mueve primero deja un K en la mesa y el otro lo levanta con su K (igualdad, caída).
function cierreDeCiclo(dealer, levantadas0, levantadas1, mesa) {
  const resto = crearBaraja().map(c => c.id).filter(id => !['K.3', 'K.2'].includes(id));
  const E = armar({}, { h0: ['K.3'], h1: ['K.2'], turn: 1 - dealer, section: 4, dealer });
  E.captured = [cartas(resto.slice(0, levantadas0)), cartas(resto.slice(levantadas0, levantadas0 + levantadas1))];
  E.table = cartas(resto.slice(levantadas0 + levantadas1, levantadas0 + levantadas1 + mesa)); E.deck = [];
  assert.equal(E.captured[0].length + E.captured[1].length + E.table.length + 2, 40);
  return E;
}
test('fin de ciclo: el conteo suma al que levantó más y se reparte un ciclo nuevo', () => {
  const E = cierreDeCiclo(0, 20, 14, 4); // el jugador 1 mueve primero; el 0 levanta el K y llega a 22
  jugar(E, 1, 'K.2'); const r = jugar(E, 0, 'K.3', undefined, semilla(5));
  const conteo = r.eventos.find(e => e.tipo === 'conteo');
  assert.deepEqual(conteo.capturadas, [22, 14]); assert.deepEqual(conteo.puntos, [8, 0]);
  assert.equal(E.score[0], 2 + 8); // caída + conteo
  assert.equal(E.cycle, 2); assert.equal(E.dealer, 1); assert.equal(E.section, 1); assert.equal(E.hands[0].length, 5);
  assert.equal(E.hands[0].length + E.hands[1].length + E.deck.length + E.table.length + E.captured[0].length + E.captured[1].length, 40);
});
test('20 cartas cada uno: los 6 puntos son para quien no reparte', () => {
  // reparte el jugador 1: mueve primero el 0 y el 1 levanta; llegan 20 y 20
  let E = cierreDeCiclo(1, 20, 18, 0); jugar(E, 0, 'K.3');
  let r = jugar(E, 1, 'K.2', undefined, semilla(2)); assert.deepEqual(r.eventos.find(e => e.tipo === 'conteo').puntos, [6, 0]);
  // reparte el jugador 0: mueve primero el 1 y el 0 levanta
  E = cierreDeCiclo(0, 18, 20, 0); jugar(E, 1, 'K.2');
  r = jugar(E, 0, 'K.3', undefined, semilla(2)); assert.deepEqual(r.eventos.find(e => e.tipo === 'conteo').puntos, [0, 6]);
});

test('100 partidas completas al azar: siempre 40 cartas, sin errores y todas terminan', () => {
  for (let s = 1; s <= 100; s++) {
    const rnd = semilla(s * 7919);
    const E = nueva({ rnd, rule38: s % 2 === 0, falta4: s % 3 === 0 }); let pasos = 0;
    while (E.estado === 'jugando') {
      if (++pasos > 4000) assert.fail('la partida ' + s + ' no termina');
      const p = E.turn;
      if (puedeRonda(E, p) && rnd() < 0.6) { const r = reclamarRonda(E, p); assert.ok(r.ok); if (E.estado !== 'jugando') break; }
      const mano = E.hands[p]; assert.ok(mano.length > 0, 'turno sin cartas');
      const c = mano[Math.floor(rnd() * mano.length)]; const op = capturasLegales(c, E.table);
      const r = jugar(E, p, c.id, op.length > 1 ? Math.floor(rnd() * op.length) : undefined, rnd);
      assert.ok(r.ok, JSON.stringify(r.error));
      const total = E.deck.length + E.hands[0].length + E.hands[1].length + E.table.length + E.captured[0].length + E.captured[1].length;
      assert.equal(total, 40); assert.equal(new Set([...E.deck, ...E.hands[0], ...E.hands[1], ...E.table, ...E.captured[0], ...E.captured[1]].map(x => x.id)).size, 40);
      assert.ok(E.score[0] >= 0 && E.score[1] >= 0);
    }
    assert.equal(E.estado, 'fin'); assert.ok(E.ganador === 0 || E.ganador === 1);
    if (E.motivo !== 'cuatro') assert.ok(E.score[E.ganador] >= 40);
    if (E.motivo === 'caida38') assert.equal(E.score[E.ganador], 40); // con 38 solo una caída (+2) lleva a la victoria
  }
});
test('el estado es JSON: se puede guardar y seguir jugando', () => {
  const rnd = semilla(42), E = nueva({ rnd }); let pasos = 0;
  while (E.estado === 'jugando' && pasos < 30) { pasos++; const p = E.turn, c = E.hands[p][0]; const op = capturasLegales(c, E.table); jugar(E, p, c.id, op.length > 1 ? 0 : undefined, rnd); }
  const copia = JSON.parse(JSON.stringify(E)); assert.deepEqual(copia.hands, E.hands); assert.deepEqual(copia.table, E.table);
  if (copia.estado === 'jugando') { const p = copia.turn, c = copia.hands[p][0]; const op = capturasLegales(c, copia.table); assert.ok(jugar(copia, p, c.id, op.length > 1 ? 0 : undefined, rnd).ok); }
});
