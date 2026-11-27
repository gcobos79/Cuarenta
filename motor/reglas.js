// CUARENTA · Don Barajón — reglas compartidas por el juego y el simulador.
// Las funciones de captura y conteo están copiadas tal cual del juego (V1.03.29),
// para que el simulador juegue exactamente con las mismas reglas.
(function (root) {
  'use strict';
  const R = ['A', '2', '3', '4', '5', '6', '7', 'J', 'Q', 'K'];
  const SU = ['♠', '♥', '♦', '♣'];
  const V = Object.fromEntries(R.map((r, i) => [r, i + 1]));

  function makeDeck() {
    return SU.flatMap((s, i) => R.map(r => ({ id: r + '.' + i, rank: r, suit: s, value: V[r], color: i === 1 || i === 2 ? 'red' : 'black' })));
  }
  function shuffle(a, rnd = Math.random) {
    a = [...a];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function combos(a, k, start = 0, cur = [], out = []) {
    if (cur.length === k) { out.push([...cur]); return out; }
    for (let i = start; i <= a.length - (k - cur.length); i++) { cur.push(a[i]); combos(a, k, i + 1, cur, out); cur.pop(); }
    return out;
  }
  function expandCapture(base, c, table) {
    const ids = new Set(base.map(x => x.id));
    for (let value = c.value + 1; value <= 10; value++) {
      const next = table.find(x => x.value === value && !ids.has(x.id));
      if (!next) break;
      ids.add(next.id);
    }
    return table.filter(x => ids.has(x.id));
  }
  function legalCaptures(c, table) {
    const out = [], seen = new Set();
    const add = base => {
      const found = expandCapture(base, c, table);
      const key = found.map(x => x.id).sort().join('|');
      if (!seen.has(key)) { seen.add(key); out.push(found); }
    };
    for (const x of table.filter(x => x.value === c.value)) add([x]);
    if (c.value >= 2 && c.value <= 7) {
      const numeric = table.filter(x => x.value >= 1 && x.value < c.value);
      for (let k = 2; k <= numeric.length; k++) {
        for (const group of combos(numeric, k)) {
          if (group.reduce((sum, x) => sum + x.value, 0) === c.value) add(group);
        }
      }
    }
    return out;
  }
  function cardCountPoints(n) { if (n <= 19) return 0; if (n === 20) return 6; const raw = n - 14; return raw % 2 === 0 ? raw : raw + 1; }
  // Conteo al cierre del ciclo: solo suma quien levantó más; con 20–20 suma 6 quien NO repartió.
  function conteo(a, b, dealer) {
    let pa = 0, pb = 0;
    if (a === 20 && b === 20) { if (dealer === 1) pa = 6; else pb = 6; }
    else if (a > b) pa = cardCountPoints(a);
    else if (b > a) pb = cardCountPoints(b);
    return [pa, pb];
  }
  const api = { R, SU, V, makeDeck, shuffle, combos, expandCapture, legalCaptures, cardCountPoints, conteo };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CuarentaReglas = api;
})(typeof self !== 'undefined' ? self : this);
