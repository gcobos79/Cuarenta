/* CUARENTA · Amigos — voz (V2.04).
   Usa las grabaciones de Don Barajón (carpeta audio/, compartida con Solo): cada frase se busca por su «huella» y suena audio/<huella>.mp3.
   Si una frase no tiene grabación, se usa la voz del navegador. Las frases son las de la «versión básica» (sin personalidad):
   lo que haces tú se dice en segunda persona («Caída tuya») y lo de tu amigo como «de tu amigo». No llevan nombres. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(root);
  else root.Voz = factory(root);
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';
  const PARES = [6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26];
  const POR = { limpia: 'la limpia', ronda: 'la ronda', bono: 'el bono de la ronda', conteo: 'el conteo de cartas', falta: 'los 4 de falta' };

  // Frases que ya existen grabadas (versión básica de Solo, dichas por la voz sobre el jugador).
  const MIAS = {
    caidaLimpia: 'Caída y limpia tuyas.', caida: 'Caída tuya.', limpia: 'Limpia tuya.',
    ronda: 'Ronda reclamada: sumas dos puntos.', bono: 'Caída sobre ronda: sumas 4 puntos extra.', falta4: '4 de falta: sumas 4 puntos.',
    en38: 'Estás en 38 puntos.', gana: 'Ganaste la partida.', cuatro: 'Cuatro cartas iguales: ganas la partida.', nadie: 'Nadie suma por conteo de cartas.',
    bloqueo: { limpia: 'Con 38, la limpia no suma para ti.', ronda: 'Con 38, la ronda no suma para ti.', bono: 'Con 38, el bono de la ronda no suma para ti.', conteo: 'Con 38, el conteo de cartas no suma para ti.', falta: 'Con 38, los 4 de falta no suman para ti.' },
    conteo: n => `Conteo de cartas: sumas ${n} puntos.`
  };
  // Frases nuevas para lo que hace tu amigo (hay que grabarlas).
  const AMIGO = {
    caidaLimpia: 'Caída y limpia de tu amigo.', caida: 'Caída de tu amigo.', limpia: 'Limpia de tu amigo.',
    ronda: 'Tu amigo reclama ronda: suma dos puntos.', bono: 'Caída sobre ronda: tu amigo suma 4 puntos extra.', falta4: '4 de falta: tu amigo suma 4 puntos.',
    en38: 'Tu amigo está en 38 puntos.', gana: 'Tu amigo ganó la partida.', cuatro: 'Tu amigo tiene cuatro cartas iguales y gana la partida.',
    bloqueo: { limpia: 'Con 38, la limpia no suma para tu amigo.', ronda: 'Con 38, la ronda no suma para tu amigo.', bono: 'Con 38, el bono de la ronda no suma para tu amigo.', conteo: 'Con 38, el conteo de cartas no suma para tu amigo.', falta: 'Con 38, los 4 de falta no suman para tu amigo.' },
    conteo: n => `Conteo de cartas: tu amigo suma ${n} puntos.`
  };
  const INICIO = ['Comienza el juego', 'Nuevo ciclo', 'Nueva sección'];
  const INICIO_AMIGO = INICIO.map(p => `${p}. Repartes tú y juega primero tu amigo.`).concat(INICIO.map(p => `${p}. Reparte tu amigo y juegas primero tú.`));
  const OTRAS = ['Tu amigo salió de la partida. Ganaste.', 'Tu amigo se desconectó.', 'Tu amigo volvió.'];

  // Lista completa de frases NUEVAS que usa Amigos (las que se graban con la voz elegida).
  function catalogoNuevo() {
    const a = [AMIGO.caidaLimpia, AMIGO.caida, AMIGO.limpia, AMIGO.ronda, AMIGO.bono, AMIGO.falta4, AMIGO.en38, AMIGO.gana, AMIGO.cuatro];
    Object.keys(POR).forEach(k => a.push(AMIGO.bloqueo[k]));
    PARES.forEach(n => a.push(AMIGO.conteo(n)));
    return a.concat(INICIO_AMIGO, OTRAS);
  }
  // Frases de Solo que Amigos reutiliza tal cual.
  function catalogoReutilizado() {
    const a = [MIAS.caidaLimpia, MIAS.caida, MIAS.limpia, MIAS.ronda, MIAS.bono, MIAS.falta4, MIAS.en38, MIAS.gana, MIAS.cuatro, MIAS.nadie];
    Object.keys(POR).forEach(k => a.push(MIAS.bloqueo[k]));
    PARES.forEach(n => a.push(MIAS.conteo(n)));
    return a;
  }

  // ¿Qué se dice por cada evento de la partida? «yo» es el jugador (0 o 1) que escucha.
  function frasesDeEvento(e, yo) {
    const F = p => (p === yo ? MIAS : AMIGO);
    switch (e.tipo) {
      case 'jugada': // se dice lo que de verdad sumó (con 38 la limpia no suma y lo avisa el evento de bloqueo)
        if (e.puntos >= 4) return [F(e.jugador).caidaLimpia]; if (e.puntos > 0) return [e.caida ? F(e.jugador).caida : F(e.jugador).limpia]; return [];
      case 'ronda': return [F(e.jugador).ronda];
      case 'bonoRonda': return [F(e.jugador).bono];
      case 'falta4': return [F(e.jugador).falta4];
      case 'llega38': return [F(e.jugador).en38];
      case 'bloqueo38': return [F(e.jugador).bloqueo[e.por]];
      case 'conteo': { const r = []; [0, 1].forEach(p => { if (e.puntos[p] > 0) r.push(F(p).conteo(e.puntos[p])); }); return r.length ? r : [MIAS.nadie]; }
      case 'reparto': {
        const pre = e.ciclo === 1 && e.seccion === 1 ? INICIO[0] : (e.seccion === 1 ? INICIO[1] : INICIO[2]);
        return [e.repartidor === yo ? `${pre}. Repartes tú y juega primero tu amigo.` : `${pre}. Reparte tu amigo y juegas primero tú.`];
      }
      case 'fin': {
        if (e.motivo === 'abandono') return e.ganador === yo ? [OTRAS[0]] : [];
        if (e.motivo === 'cuatro') return [F(e.ganador).cuatro];
        return [F(e.ganador).gana];
      }
      default: return [];
    }
  }

  // ---- reproducción (solo en el navegador) ----
  const ids = new Set(((root.DON_AUDIO && root.DON_AUDIO.ids) || '').split(',').filter(Boolean));
  const CLAVE = 'amigosVoz';
  let activa = true; try { activa = localStorage.getItem(CLAVE) !== 'false'; } catch (e) { }
  function huella(s) { const b = new TextEncoder().encode(String(s).trim().replace(/\s+/g, ' ')); let a = 0x811c9dc5, c = 0x9747b28c; for (const x of b) { a = Math.imul(a ^ x, 0x01000193) >>> 0; c = Math.imul(c ^ x, 0x01000193) >>> 0; } return a.toString(16).padStart(8, '0') + c.toString(16).padStart(8, '0'); }
  const grabada = t => ids.has(huella(t));
  let el = null, ficha = 0, cola = Promise.resolve();
  const audio = () => { if (!el) { el = new Audio(); el.preload = 'auto'; } return el; };
  if (typeof document !== 'undefined') { // iOS/Safari: el primer toque desbloquea el reproductor con un sonido silencioso
    const un = () => { const a = audio(); if (!a.paused) return; try { a.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA='; const p = a.play(); if (p && p.catch) p.catch(() => { }); } catch (e) { } };
    ['pointerdown', 'touchend', 'keydown'].forEach(ev => document.addEventListener(ev, un, { once: true, passive: true }));
  }
  function clip(texto) { // true si había grabación y se reprodujo
    return new Promise(res => {
      const h = huella(texto); if (!ids.has(h)) { res(false); return; }
      const a = audio(); let fin = false, inicio = false, wd;
      const termina = ok => { if (fin) return; fin = true; clearTimeout(wd); a.onended = a.onerror = a.onplaying = null; res(ok); };
      a.onplaying = () => { inicio = true; }; a.onended = () => termina(true); a.onerror = () => termina(false);
      wd = setTimeout(() => { if (!inicio) { try { a.pause(); } catch (e) { } termina(false); } }, 7000);
      a.src = '../audio/' + h + '.mp3';
      const p = a.play(); if (p && p.catch) p.catch(() => termina(false));
    });
  }
  // ---- voz del aparato: en español y, si se puede, de hombre (misma lógica que Solo) ----
  const MASC = /\b(jorge|juan|diego|carlos|raul|raúl|pablo|alvaro|álvaro|miguel|enrique|andres|andrés|gonzalo|tomas|tomás|luciano|alejandro|male|masculin\w*|hombre|man)\b/i;
  const FEM = /\b(monica|mónica|paulina|angelica|angélica|soledad|marisol|helena|laura|dalia|elena|sabela|lucia|lucía|esperanza|isabela|female|femenin\w*|mujer|woman|google espa\w*)\b/i;
  const BLOQ = /\b(eddy|reed|rocko|grandpa|grandma|flo|sandy|shelley|albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|junior|kathy|organ|ralph|superstar|trinoids|whisper|wobble|zarvox|fred|princess|samantha|alex|daniel|karen|moira|tessa|fiona|victoria|allison|ava|susan|tom)\b/i;
  const listaVoces = () => { try { return (root.speechSynthesis && root.speechSynthesis.getVoices && root.speechSynthesis.getVoices()) || []; } catch (e) { return []; } };
  function elegirVoz(lista) { // 1.º las de hombre reconocidas, 2.º las no femeninas, 3.º cualquiera en español
    const es = (lista || listaVoces()).filter(v => /^es([-_]|$)/i.test(v.lang || '') && !BLOQ.test(v.name || ''));
    const rango = v => (/es[-_](mx|us|419)/i.test(v.lang) ? 0 : 1);
    const masc = es.filter(v => MASC.test(v.name) && !FEM.test(v.name)).sort((a, b) => rango(a) - rango(b));
    if (masc.length) return { voz: masc[0], masculina: true };
    const neutras = es.filter(v => !FEM.test(v.name)).sort((a, b) => rango(a) - rango(b));
    if (neutras.length) return { voz: neutras[0], masculina: false };
    return { voz: es.sort((a, b) => rango(a) - rango(b))[0] || null, masculina: false };
  }
  function navegador(texto) { // si no hay grabación: la voz del aparato (español, de hombre si existe; si no, más grave)
    return new Promise(res => {
      try {
        if (!('speechSynthesis' in root)) { res(); return; }
        const { voz, masculina } = elegirVoz();
        const u = new SpeechSynthesisUtterance(texto); u.lang = (voz && voz.lang) || 'es-MX'; if (voz) u.voice = voz;
        u.rate = .93; u.volume = 1; u.pitch = masculina ? .9 : .78;
        u.onend = u.onerror = () => res();
        root.speechSynthesis.speak(u); setTimeout(res, 9000);
      } catch (e) { res(); }
    });
  }
  function hablar(texto) { // las frases suenan una detrás de otra, sin pisarse
    if (!activa || !texto) return Promise.resolve();
    const t = ficha;
    cola = cola.then(async () => { if (t !== ficha || !activa) return; if (!(await clip(texto))) await navegador(texto); }).catch(() => { });
    return cola;
  }
  function callar() { ficha++; try { if (el && !el.paused) el.pause(); } catch (e) { } try { if ('speechSynthesis' in root) root.speechSynthesis.cancel(); } catch (e) { } }
  function alternar() { activa = !activa; try { localStorage.setItem(CLAVE, String(activa)); } catch (e) { } if (!activa) callar(); return activa; }
  const api = { elegirVoz, frasesDeEvento, catalogoNuevo, catalogoReutilizado, huella, grabada, hablar, callar, alternar, activa: () => activa, INICIO_AMIGO, OTRAS, MIAS, AMIGO };
  api.hablarEventos = (eventos, yo) => eventos.forEach(e => frasesDeEvento(e, yo).forEach(f => api.hablar(f)));
  return api;
});
