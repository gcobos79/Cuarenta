// Torneo entre dos niveles de Don Barajón.
// Uso: node torneo.js <nivelA> <nivelB> <partidas> [config JSON del Nivel 4 para A] [config JSON para B]
// Ejemplo: node torneo.js 4 3 1000 '{"muestrasFijas":32}'
// Cada par de partidas usa a los dos bots en ambos asientos y alterna quién empieza.
'use strict';
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const os = require('os');

function crearBot(nivel, cfg) {
  const L = require('./niveles-actuales.js');
  const reclamaRonda = v => L.shouldClaimRonda(v);
  if (Number(nivel) === 4) {
    const e = require('../motor/nivel4.js').crear(require('../motor/reglas.js'), cfg || {});
    return { elegir: v => e.elegir(v), reclamaRonda };
  }
  return { elegir: v => L.choose(v, Number(nivel)), reclamaRonda };
}

if (isMainThread) {
  const [a = '4', b = '3', n = '200', ca = '{}', cb = '{}'] = process.argv.slice(2);
  const total = Number(n), hilos = Math.max(1, os.cpus().length);
  const porHilo = Array.from({ length: hilos }, (_, i) => Math.floor(total / hilos) + (i < total % hilos ? 1 : 0));
  let gA = 0, jugadas = 0, hechas = 0, ptsA = 0, ptsB = 0; const t0 = Date.now();
  let offset = 0;
  const trabajos = porHilo.map(k => {
    const w = new Worker(__filename, { workerData: { a, b, k, offset, ca: JSON.parse(ca), cb: JSON.parse(cb) } });
    offset += k;
    return new Promise((res, rej) => {
      w.on('message', m => { gA += m.gA; hechas += m.k; jugadas += m.jugadas; ptsA += m.ptsA; ptsB += m.ptsB; res(); });
      w.on('error', rej);
    });
  });
  Promise.all(trabajos).then(() => {
    const p = gA / hechas, se = Math.sqrt(p * (1 - p) / hechas);
    const out = { A: `Nivel ${a}`, B: `Nivel ${b}`, partidas: hechas, ganadasA: gA, porcentajeA: +(100 * p).toFixed(1),
      intervalo95: [+(100 * (p - 1.96 * se)).toFixed(1), +(100 * (p + 1.96 * se)).toFixed(1)],
      puntosMediosA: +(ptsA / hechas).toFixed(1), puntosMediosB: +(ptsB / hechas).toFixed(1),
      segundos: +((Date.now() - t0) / 1000).toFixed(1), configA: JSON.parse(ca), configB: JSON.parse(cb) };
    console.log(JSON.stringify(out));
  });
} else {
  const { jugarPartida } = require('./partida.js');
  // Mismos repartos para cada par de partidas (A y B cambian de asiento): menos azar en la comparación.
  const semilla = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const { a, b, k, offset, ca, cb } = workerData;
  const A = crearBot(a, ca), B = crearBot(b, cb);
  let gA = 0, jugadas = 0, ptsA = 0, ptsB = 0;
  for (let i = 0; i < k; i++) {
    const g = offset + i, sw = g % 2, first = (g >> 1) % 2;
    const r = jugarPartida(sw ? [B, A] : [A, B], { first, rule38: !!process.env.R38, falta4: !!process.env.F4, rnd: semilla(1000003 * (g >> 1) + 7) });
    const seatA = sw ? 1 : 0;
    if (r.winner === seatA) gA++;
    jugadas += r.moves; ptsA += Math.min(40, r.score[seatA]); ptsB += Math.min(40, r.score[1 - seatA]);
  }
  parentPort.postMessage({ gA, k, jugadas, ptsA, ptsB });
}
