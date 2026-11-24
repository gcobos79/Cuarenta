// Pruebas de la voz de Amigos: qué se dice por cada evento y qué voz del aparato se elige.  node --test amigos/pruebas/voz.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const Voz = require('../voz.js');

const v = (name, lang) => ({ name, lang });
test('voz del aparato: prefiere una voz de hombre en español', () => {
  const r = Voz.elegirVoz([v('Mónica', 'es-MX'), v('Jorge', 'es-ES'), v('Samantha', 'en-US'), v('Paulina', 'es-MX')]);
  assert.equal(r.voz.name, 'Jorge'); assert.equal(r.masculina, true);
});
test('voz del aparato: entre varias de hombre prefiere la latinoamericana', () => {
  const r = Voz.elegirVoz([v('Jorge', 'es-ES'), v('Juan', 'es-MX'), v('Diego', 'es-AR')]);
  assert.equal(r.voz.name, 'Juan');
});
test('voz del aparato: si solo hay voces de mujer, usa una en español (y se baja el tono al hablar)', () => {
  const r = Voz.elegirVoz([v('Mónica', 'es-MX'), v('Paulina', 'es-MX'), v('Google español', 'es-ES')]);
  assert.ok(/^es/i.test(r.voz.lang)); assert.equal(r.masculina, false);
});
test('voz del aparato: ignora voces de otros idiomas y las de novedad; sin español no elige ninguna', () => {
  assert.equal(Voz.elegirVoz([v('Samantha', 'en-US'), v('Alex', 'en-US'), v('Fred', 'es-ES')]).voz, null);
  assert.equal(Voz.elegirVoz([]).voz, null);
});
test('voz del aparato: una voz española sin nombre reconocible cuenta como neutra', () => {
  const r = Voz.elegirVoz([v('Spanish (Mexico)', 'es-MX'), v('Mónica', 'es-MX')]);
  assert.equal(r.voz.name, 'Spanish (Mexico)');
});

test('las frases reutilizadas existen grabadas; las nuevas son 34, únicas y sin nombres', () => {
  const idx = fs.readFileSync(path.join(__dirname, '..', '..', 'audio', 'index.js'), 'utf8');
  const ids = new Set(idx.match(/ids:'([^']*)'/)[1].split(','));
  const re = Voz.catalogoReutilizado(), nu = Voz.catalogoNuevo();
  assert.equal(re.filter(t => !ids.has(Voz.huella(t))).length, 0, 'todas las frases reutilizadas deben tener grabación');
  assert.equal(nu.length, 34); assert.equal(new Set(nu).size, 34);
  assert.ok(nu.every(t => !/Ana|Beto|Don Barajón/.test(t)), 'las frases no llevan nombres');
});
test('el catálogo guardado coincide con las frases del código', () => {
  const j = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'voz', 'catalogo-amigos.json'), 'utf8'));
  assert.deepEqual(j.nuevas, Voz.catalogoNuevo());
});
test('frases por evento: lo mío en segunda persona y lo del amigo en tercera; con 38 solo se dice lo que sumó', () => {
  assert.deepEqual(Voz.frasesDeEvento({ tipo: 'jugada', jugador: 0, caida: true, limpia: true, puntos: 4 }, 0), ['Caída y limpia tuyas.']);
  assert.deepEqual(Voz.frasesDeEvento({ tipo: 'jugada', jugador: 1, caida: true, limpia: false, puntos: 2 }, 0), ['Caída de tu amigo.']);
  assert.deepEqual(Voz.frasesDeEvento({ tipo: 'jugada', jugador: 1, caida: false, limpia: true, puntos: 0 }, 0), []);
  assert.deepEqual(Voz.frasesDeEvento({ tipo: 'conteo', puntos: [0, 8] }, 0), ['Conteo de cartas: tu amigo suma 8 puntos.']);
  assert.deepEqual(Voz.frasesDeEvento({ tipo: 'conteo', puntos: [0, 0] }, 0), ['Nadie suma por conteo de cartas.']);
  assert.deepEqual(Voz.frasesDeEvento({ tipo: 'reparto', ciclo: 1, seccion: 1, repartidor: 0, comienza: 1 }, 0), ['Comienza el juego. Repartes tú y juega primero tu amigo.']);
  assert.deepEqual(Voz.frasesDeEvento({ tipo: 'reparto', ciclo: 2, seccion: 1, repartidor: 0, comienza: 1 }, 1), ['Nuevo ciclo. Reparte tu amigo y juegas primero tú.']);
  assert.deepEqual(Voz.frasesDeEvento({ tipo: 'fin', ganador: 0, motivo: 'abandono' }, 0), ['Tu amigo salió de la partida. Ganaste.']);
  assert.deepEqual(Voz.frasesDeEvento({ tipo: 'fin', ganador: 1, motivo: '40' }, 0), ['Tu amigo ganó la partida.']);
});
