// CUARENTA · Don Barajón — NIVEL 4 «LEYENDA».
//
// Idea: Don no ve tus cartas. Inventa muchas manos posibles para ti (solo con cartas que
// todavía no se han visto y que encajan con lo que ya pasó), y con cada una calcula la
// mano completa hasta el final de la sección, suponiendo que los dos juegan lo mejor posible.
// Elige la jugada que en promedio le deja más puntos reales: caídas, limpias, ronda,
// «4 de falta», conteo de cartas y la posibilidad de llegar a 40.
//
// Funciona igual en el juego (navegador) y en el simulador (Node). No usa la mano real del rival:
// la vista que recibe solo se lee en `hands[1]` (Don) y en el TAMAÑO de `hands[0]`.
(function (root) {
  'use strict';

  const DEFAULTS = {
    pesoCarta: 0.5,      // valor de cada carta de ventaja en el conteo cuando el ciclo aún no termina
    pesoVictoria: 100,   // valor de llegar a 40 dentro de la mano calculada
    minMuestras: 24,     // manos posibles mínimas antes de poder parar
    maxMuestras: 400,    // tope de manos posibles
    tiempoMs: 1200,      // tiempo máximo para pensar (solo si se usa el modo con tiempo)
    muestrasFijas: 0,    // >0: usa exactamente estas muestras, sin reloj (para el torneo)
    conteoEsperado: false,// true: estima el conteo final con una binomial (en el torneo no rindió mejor)
    sobranMesa: 2,       // cartas que suelen quedar en la mesa al cerrar el ciclo
    creerSoltar: 0.25,   // probabilidad de aceptar una mano en la que el rival soltó carta pudiendo levantar
  };

  function crear(reglas, cfg = {}) {
    const P = Object.assign({}, DEFAULTS, cfg);
    const { makeDeck, legalCaptures, conteo } = reglas;
    const FULL = makeDeck();
    const rnd = P.random || Math.random;

    function jugadas(hand, table) {
      const out = [];
      for (const c of hand) {
        const opts = legalCaptures(c, table);
        if (opts.length) for (const o of opts) out.push({ c, o }); else out.push({ c, o: [] });
      }
      return out;
    }

    function cartasNoVistas(V) {
      const seen = new Set([...V.hands[1], ...V.table, ...V.captured[0], ...V.captured[1]].map(c => c.id));
      return FULL.filter(c => !seen.has(c.id));
    }
    const cuenta = cards => { const m = {}; for (const c of cards) m[c.value] = (m[c.value] || 0) + 1; return m; };

    // Mano posible del rival, coherente con lo observado: su mano original de esta sección
    // (la que tiene + las que ya jugó) no tenía cuatro iguales, y si reclamó ronda, tenía un trío.
    // Además, si el rival soltó una carta sin levantar nada teniendo otra que sí levantaba, esa mano
    // es poco creíble (casi nadie lo hace): se acepta solo a veces (P.creerSoltar).
    function muestraRival(pool, n, V) {
      const played = (V.played && V.played[0]) || [];
      const needTrio = !!(V.rondaClaimed && V.rondaClaimed[0]);
      const hist = (V.historial || []).filter(x => x.p === 0);
      let hand = null;
      for (let t = 0; t < 300; t++) {
        const a = pool.slice();
        for (let i = 0; i < n; i++) { const j = i + Math.floor(rnd() * (a.length - i)); const x = a[i]; a[i] = a[j]; a[j] = x; }
        hand = a.slice(0, n);
        const m = Object.values(cuenta([...hand, ...played]));
        if (m.some(k => k >= 4)) continue;
        if (needTrio && !m.some(k => k === 3)) continue;
        if (P.creerSoltar < 1 && t < 200 && hist.length) {
          let raro = false;
          for (let j = 0; j < hist.length && !raro; j++) {
            const h = hist[j];
            if (h.capturo) continue;
            // Mano que tenía en ese momento: la actual + lo que jugó después.
            const despues = hist.slice(j + 1).map(x => x.c);
            for (const c of [...hand, ...despues]) if (legalCaptures(c, h.mesaAntes).length) { raro = true; break; }
          }
          if (raro && rnd() > P.creerSoltar) continue;
        }
        return hand;
      }
      return hand;
    }

    // ----- Cálculo completo hasta el final de la sección (Don = asiento 1, maximiza) -----
    function crearBuscador(V) {
      const at38 = (sc, p) => V.rule38 && sc[p] === 38;
      const s0 = V.score[0], s1 = V.score[1];
      const ultimaSeccion = V.section === 4;
      const W = P.pesoCarta, WIN = P.pesoVictoria;
      let nodos = 0;

      function hoja(st) {
        const sc = st.sc.slice();
        // Bono de ronda: caída sobre una carta de la ronda reclamada.
        for (const h of [0, 1]) {
          if (V.rondaClaimed[h] && V.rondaVal[h] != null) { const f = 1 - h; if (st.rf[f] && !at38(sc, f)) sc[f] += 4; }
        }
        if (sc[1] >= 40 && sc[1] >= sc[0]) return WIN + (sc[1] - s1) - (sc[0] - s0);
        if (sc[0] >= 40) return -WIN + (sc[1] - s1) - (sc[0] - s0);
        if (V.falta4 && V.section === 1) {
          const d = V.dealer, r = 1 - d;
          if (!st.s1[d] && st.s1[r] && !at38(sc, r)) { sc[r] += 4; if (sc[r] >= 40) return (r === 1 ? WIN : -WIN) + (sc[1] - s1) - (sc[0] - s0); }
        }
        let v = (sc[1] - s1) - (sc[0] - s0);
        if (ultimaSeccion) {
          let [pa, pb] = conteo(st.cap[0], st.cap[1], V.dealer);
          if (at38(sc, 0)) pa = 0; if (at38(sc, 1)) pb = 0;
          const f0 = sc[0] + pa, f1 = sc[1] + pb;
          v += pb - pa;
          if (f0 >= 40 || f1 >= 40) v += (f0 >= 40 ? -WIN : WIN);
        } else if (P.conteoEsperado) {
          v += conteoEsperado(st.cap[0], st.cap[1]);
        } else {
          v += W * (st.cap[1] - st.cap[0]);
        }
        return v;
      }
      // Valor esperado del conteo al cierre del ciclo: las cartas que faltan se reparten al azar
      // entre los dos (distribución binomial). Así una carta vale más cuando acerca a las 20.
      const memo = new Map();
      function conteoEsperado(a, b) {
        const key = a * 64 + b; let r = memo.get(key); if (r !== undefined) return r;
        const rem = Math.max(0, 40 - a - b - P.sobranMesa);
        let e = 0, comb = 1; const half = Math.pow(0.5, rem);
        for (let k = 0; k <= rem; k++) {
          const [pa, pb] = conteo(a + k, b + rem - k, V.dealer);
          e += comb * half * (pb - pa);
          comb = comb * (rem - k) / (k + 1);
        }
        memo.set(key, e); return e;
      }

      // st: { h:[mano0,mano1], t:mesa, last:{p,c}|null, turn, sc:[..], cap:[..], rf:[..], s1:[..] }
      function aplicar(st, p, c, o) {
        const last = st.last;
        const caida = !!(last && last.p !== p && last.c.value === c.value && o.some(x => x.id === last.c.id));
        const mesa = o.length ? st.t.filter(x => !o.some(y => y.id === x.id)) : st.t.concat([c]);
        const limpia = o.length > 0 && mesa.length === 0;
        let pts = (caida ? 2 : 0) + (limpia ? 2 : 0);
        if (at38(st.sc, p) && pts) pts = caida ? 2 : 0;
        const h = [st.h[0], st.h[1]]; h[p] = h[p].filter(x => x !== c);
        const sc = [st.sc[0], st.sc[1]]; sc[p] += pts;
        const cap = [st.cap[0], st.cap[1]]; if (o.length) cap[p] += o.length + 1;
        let rf = st.rf;
        if (caida && V.rondaClaimed[1 - p] && V.rondaVal[1 - p] === c.value) { rf = [rf[0], rf[1]]; rf[p] = true; }
        let s1x = st.s1;
        if (o.length && V.section === 1 && !s1x[p]) { s1x = [s1x[0], s1x[1]]; s1x[p] = true; }
        return { h, t: mesa, last: { p, c }, turn: 1 - p, sc, cap, rf, s1: s1x, caida, pts };
      }

      function buscar(st, alpha, beta) {
        nodos++;
        // Llegar a 40 termina la partida en el acto.
        if (st.sc[1] >= 40) return WIN + (st.sc[1] - s1) - (st.sc[0] - s0);
        if (st.sc[0] >= 40) return -WIN + (st.sc[1] - s1) - (st.sc[0] - s0);
        const p = st.turn;
        if (!st.h[0].length && !st.h[1].length) return hoja(st);
        if (!st.h[p].length) return buscar({ ...st, turn: 1 - p }, alpha, beta);
        const movs = jugadas(st.h[p], st.t);
        // Orden: primero lo que más levanta (mejor poda).
        movs.sort((a, b) => b.o.length - a.o.length);
        if (p === 1) {
          let best = -Infinity;
          for (const m of movs) {
            const v = buscar(aplicar(st, 1, m.c, m.o), alpha, beta);
            if (v > best) best = v; if (best > alpha) alpha = best; if (alpha >= beta) break;
          }
          return best;
        } else {
          let best = Infinity;
          for (const m of movs) {
            const v = buscar(aplicar(st, 0, m.c, m.o), alpha, beta);
            if (v < best) best = v; if (best < beta) beta = best; if (alpha >= beta) break;
          }
          return best;
        }
      }

      function evaluar(cand, manoRival) {
        const st0 = {
          h: [manoRival, V.hands[1].slice()], t: V.table.slice(),
          last: V.lastPlayed ? { p: V.lastPlayed.player, c: V.lastPlayed.card } : null,
          turn: 1, sc: [s0, s1], cap: [V.captured[0].length, V.captured[1].length],
          rf: [!!V.rondaFall[0], !!V.rondaFall[1]], s1: [!!(V.s1Captured && V.s1Captured[0]), !!(V.s1Captured && V.s1Captured[1])],
        };
        const c = st0.h[1].find(x => x.id === cand.c.id);
        return buscar(aplicar(st0, 1, c, cand.o), -Infinity, Infinity);
      }
      return { evaluar, nodos: () => nodos };
    }

    function preparar(V) {
      const cands = jugadas(V.hands[1], V.table);
      const pool = cartasNoVistas(V);
      const n = Math.min(V.hands[0].length, pool.length);
      return { cands, pool, n, B: crearBuscador(V), sum: new Float64Array(cands.length), sq: new Float64Array(cands.length), k: 0 };
    }
    function paso(V, ctx) {
      const mano = muestraRival(ctx.pool, ctx.n, V);
      for (let i = 0; i < ctx.cands.length; i++) { const v = ctx.B.evaluar(ctx.cands[i], mano); ctx.sum[i] += v; ctx.sq[i] += v * v; }
      ctx.k++;
    }
    function resultado(ctx) {
      let bi = 0;
      for (let i = 1; i < ctx.cands.length; i++) if (ctx.sum[i] > ctx.sum[bi]) bi = i;
      const ch = ctx.cands[bi];
      return { c: ch.c, o: ch.o, muestras: ctx.k, valor: ctx.k ? ctx.sum[bi] / ctx.k : 0, nodos: ctx.B.nodos(), opciones: ctx.cands.length };
    }
    // ¿Ya está clara la mejor jugada? (ventaja grande frente a la segunda, con margen estadístico)
    function decidida(ctx) {
      if (ctx.k < P.minMuestras) return false;
      const k = ctx.k, m = [], se = [];
      for (let i = 0; i < ctx.cands.length; i++) { const mu = ctx.sum[i] / k; m.push(mu); se.push(Math.sqrt(Math.max(0, ctx.sq[i] / k - mu * mu) / k)); }
      const idx = m.map((_, i) => i).sort((a, b) => m[b] - m[a]);
      const a = idx[0], b = idx[1];
      return m[a] - m[b] > 2.5 * Math.hypot(se[a], se[b]) + 0.05;
    }

    // Versión directa (simulador): muestras fijas o reloj.
    function elegir(V) {
      const ctx = preparar(V);
      if (ctx.cands.length === 1 || !ctx.n) { if (ctx.cands.length > 1) paso(V, ctx); return resultado(ctx); }
      if (P.muestrasFijas > 0) { for (let i = 0; i < P.muestrasFijas; i++) paso(V, ctx); return resultado(ctx); }
      const t0 = Date.now();
      while (ctx.k < P.maxMuestras && Date.now() - t0 < P.tiempoMs && !decidida(ctx)) paso(V, ctx);
      return resultado(ctx);
    }
    // Versión por tandas (juego): cede el control a la pantalla entre tandas para que no se trabe.
    async function elegirSinTrabar(V, tiempoMs = P.tiempoMs) {
      const ctx = preparar(V);
      if (ctx.cands.length === 1 || !ctx.n) { if (ctx.cands.length > 1) paso(V, ctx); return resultado(ctx); }
      const t0 = Date.now();
      while (ctx.k < P.maxMuestras && Date.now() - t0 < tiempoMs && !decidida(ctx)) {
        const tt = Date.now();
        while (Date.now() - tt < 30 && ctx.k < P.maxMuestras) paso(V, ctx);
        await new Promise(r => setTimeout(r, 0));
      }
      return resultado(ctx);
    }
    return { elegir, elegirSinTrabar, config: P };
  }

  const api = { crear, DEFAULTS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DonNivel4 = api;
})(typeof self !== 'undefined' ? self : this);
