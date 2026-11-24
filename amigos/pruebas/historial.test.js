const test = require('node:test'), assert = require('node:assert/strict');
global.self = global; // el módulo usa self en el navegador
const H = require('../historial.js');

test('fila: recorta nombres, limita puntajes a 0-40 y completa fecha y hora locales', () => {
  const f = H.fila({ modo: 'solo', jugador1: '  Ana   María ', jugador2: 'Don Barajón', puntaje1: 43, puntaje2: -2, ganador: 'Ana María' }, new Date(2026, 10, 24, 9, 5));
  assert.equal(f.fecha, '2026-11-24'); assert.equal(f.hora, '09:05'); assert.equal(f.modo, 'solo');
  assert.equal(f.jugador1, 'Ana María'); assert.equal(f.puntaje1, 40); assert.equal(f.puntaje2, 0);
  assert.match(f.id, /^[0-9a-f-]{36}$/);
});
test('fila: nombres vacíos y ganador por defecto; modo desconocido pasa a «amigos»', () => {
  const f = H.fila({ modo: 'x', jugador1: '', jugador2: '   ', puntaje1: 10, puntaje2: 40, ganador: '' }, new Date(2026, 0, 2, 23, 59));
  assert.equal(f.jugador1, 'Jugador 1'); assert.equal(f.jugador2, 'Jugador 2'); assert.equal(f.ganador, 'Jugador 2'); assert.equal(f.modo, 'amigos');
  assert.equal(f.fecha, '2026-01-02'); assert.equal(f.hora, '23:59');
});
test('fila: el nombre se corta a 40 caracteres (límite de la base)', () => {
  assert.equal(H.fila({ jugador1: 'x'.repeat(80), jugador2: 'y', puntaje1: 1, puntaje2: 0 }).jugador1.length, 40);
});
test('desde: hoy, 3 días, 5 días y todos (incluye el día de hoy, también al cruzar de mes)', () => {
  const hoy = new Date(2026, 11, 2, 12, 0).getTime(); // 2 de diciembre
  assert.equal(H.desde(1, hoy), '2026-12-02'); assert.equal(H.desde(3, hoy), '2026-11-30'); assert.equal(H.desde(5, hoy), '2026-11-28');
  assert.equal(H.desde(0, hoy), null);
});
test('huella: igual clave (sin tildes ni mayúsculas) da la misma huella de 64 caracteres; otra clave, otra huella', async () => {
  const a = await H.huella('  Clave Ñoño '), b = await H.huella('clave nono'), c = await H.huella('otra');
  assert.match(a, /^[0-9a-f]{64}$/); assert.equal(a, b); assert.notEqual(a, c);
});

test('fila: marca si participó el administrador (solo para poder ocultarla del listado)', () => {
  assert.equal(H.fila({ jugador1: 'A', jugador2: 'B', puntaje1: 1, puntaje2: 0, admin: true }).admin, true);
  assert.equal(H.fila({ jugador1: 'A', jugador2: 'B', puntaje1: 1, puntaje2: 0 }).admin, false);
});
