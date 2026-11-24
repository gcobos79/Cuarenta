/* CUARENTA · Amigos — efectos de las cartas y sonidos (V2.04).
   Copia de los efectos del juego Solo: la carta sale de la mano y viaja a la mesa, las cartas de la captura se iluminan una por una,
   se levantan hacia el montón, suena el golpe de la carta y los puntos salen con letras grandes. */
(function (root) {
  'use strict';
  const espera = ms => new Promise(r => setTimeout(r, ms));
  const HIGHLIGHT_MS = 320, FINAL_PAUSE_MS = 500; // mismos tiempos que Solo
  const CLAVE_SONIDO = 'amigosSonido';
  let sonidoOn = true; try { sonidoOn = localStorage.getItem(CLAVE_SONIDO) !== 'false'; } catch (e) { }
  let audioCtx = null;
  const sinMovimiento = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };

  // ---- sonido ----
  function desbloquear() {
    try {
      if (navigator.audioSession) navigator.audioSession.type = 'playback';
      if (!audioCtx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; audioCtx = new AC(); }
      if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) { }
  }
  ['pointerdown', 'touchend', 'keydown'].forEach(ev => document.addEventListener(ev, desbloquear, { passive: true }));
  function sonidoCarta() { // golpe de carta sobre el tapete (el mismo de Solo)
    if (!sonidoOn || !audioCtx || audioCtx.state !== 'running') return;
    try {
      const t0 = audioCtx.currentTime, sr = audioCtx.sampleRate, len = Math.floor(sr * .09), buf = audioCtx.createBuffer(1, len, sr), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4);
      const src = audioCtx.createBufferSource(); src.buffer = buf;
      const bp = audioCtx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1500 + Math.random() * 900; bp.Q.value = .9;
      const g = audioCtx.createGain(); g.gain.setValueAtTime(.275, t0); g.gain.exponentialRampToValueAtTime(.001, t0 + .09);
      src.connect(bp); bp.connect(g); g.connect(audioCtx.destination); src.start(t0);
      const o = audioCtx.createOscillator(), og = audioCtx.createGain(); o.type = 'sine';
      o.frequency.setValueAtTime(150 + Math.random() * 30, t0); o.frequency.exponentialRampToValueAtTime(70, t0 + .06);
      og.gain.setValueAtTime(.14, t0); og.gain.exponentialRampToValueAtTime(.001, t0 + .07);
      o.connect(og); og.connect(audioCtx.destination); o.start(t0); o.stop(t0 + .08);
    } catch (e) { }
  }
  function sonidoTurno() { // dos notas suaves cuando le toca jugar a quien tiene el celular
    if (!sonidoOn || !audioCtx || audioCtx.state !== 'running') return;
    try {
      const t0 = audioCtx.currentTime;
      [[660, 0], [880, .13]].forEach(([f, dt]) => {
        const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t0 + dt); g.gain.exponentialRampToValueAtTime(.16, t0 + dt + .02); g.gain.exponentialRampToValueAtTime(.001, t0 + dt + .22);
        o.connect(g); g.connect(audioCtx.destination); o.start(t0 + dt); o.stop(t0 + dt + .25);
      });
    } catch (e) { }
  }
  function alternarSonido() { sonidoOn = !sonidoOn; try { localStorage.setItem(CLAVE_SONIDO, String(sonidoOn)); } catch (e) { } desbloquear(); if (sonidoOn) setTimeout(sonidoCarta, 60); return sonidoOn; }

  // ---- vuelo de las cartas ----
  function crearVuelo(el, ref) { // copia fija de la carta (o del dorso) sobre la pantalla
    const rect = (el || ref).getBoundingClientRect();
    const clone = (el || ref).cloneNode(true);
    clone.classList.add('flight'); clone.classList.remove('is-focus', 'is-marked', 'lift-origin', 'jugable', 'ultima', 'back');
    Object.assign(clone.style, { position: 'fixed', left: rect.left + 'px', top: rect.top + 'px', width: rect.width + 'px', height: rect.height + 'px', margin: '0', transform: 'none', transition: 'none' });
    document.body.appendChild(clone);
    return clone;
  }
  function huecoMesa(mesa, tomadas) { // dónde quedará la carta nueva en la mesa, ya sin las cartas capturadas
    const ocultas = [];
    for (const id of tomadas) { const el = mesa.querySelector(`[data-id="${id}"]`); if (el) { ocultas.push([el, el.style.display]); el.style.display = 'none'; } }
    const hueco = document.createElement('div'); hueco.className = 'card table-slot'; hueco.setAttribute('aria-hidden', 'true');
    hueco.style.cssText = 'visibility:hidden;pointer-events:none;flex:none;margin:0;'; mesa.appendChild(hueco);
    const r = hueco.getBoundingClientRect(); hueco.remove();
    for (const [el, d] of ocultas) el.style.display = d;
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  }
  async function volarA(clone, left, top, ms) {
    if (sinMovimiento()) ms = 1;
    const l0 = parseFloat(clone.style.left), t0 = parseFloat(clone.style.top);
    const an = clone.animate([{ left: l0 + 'px', top: t0 + 'px' }, { left: left + 'px', top: top + 'px' }], { duration: ms, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
    await an.finished; clone.style.left = left + 'px'; clone.style.top = top + 'px'; an.cancel();
  }
  async function alMonton(el, pila) {
    if (!el) return;
    el.classList.remove('is-marked');
    const destino = pila.getBoundingClientRect(), clone = crearVuelo(el);
    el.classList.add('lift-origin');
    const ini = clone.getBoundingClientRect(), dx = destino.left + destino.width / 2 - ini.width / 2 - ini.left, dy = destino.top + destino.height / 2 - ini.height / 2 - ini.top;
    const an = clone.animate([{ transform: 'translate3d(0,0,0)', opacity: 1 }, { transform: `translate3d(${dx}px,${dy}px,0)`, opacity: 1 }], { duration: sinMovimiento() ? 1 : 310, easing: 'cubic-bezier(.42,0,.22,1)', fill: 'forwards' });
    await an.finished; clone.remove();
  }
  function ordenarCaptura(tomadas, jugada) { // base de la captura, la carta jugada y la escalera, en ese orden
    let base = tomadas.find(x => x.value === jugada.value) ? [tomadas.find(x => x.value === jugada.value)] : null;
    if (!base && jugada.value >= 2 && jugada.value <= 7) {
      const num = tomadas.filter(x => x.value >= 1 && x.value < jugada.value);
      for (let k = 2; k <= num.length && !base; k++) for (const g of root.Reglas.combinaciones(num, k)) if (g.reduce((s, x) => s + x.value, 0) === jugada.value) { base = g; break; }
    }
    if (!base) base = tomadas.slice().sort((a, b) => a.value - b.value).slice(0, 1);
    const ids = new Set(base.map(x => x.id));
    return [...base, jugada, ...tomadas.filter(x => !ids.has(x.id)).sort((a, b) => a.value - b.value)];
  }

  // Anima una jugada sobre el dibujo ANTERIOR: sale de la mano, viaja a la mesa y, si captura, se levantan las cartas.
  // mano: elemento de la mano de quien juega; pila: su montón; mesa: la mesa; vivo(): false si hay que cortar.
  async function animarJugada({ carta, captura, mano, pila, mesa, vivo }) {
    const sigue = () => (vivo ? vivo() : true);
    const propia = mano.querySelector(`[data-id="${carta.id}"]`);
    const dorsos = mano.querySelectorAll('.card');
    const origen = propia || dorsos[Math.floor(dorsos.length / 2)];
    if (!origen) return;
    const tomadasIds = captura.map(x => x.id);
    const destino = huecoMesa(mesa, tomadasIds);
    const clon = crearVuelo(origen);
    if (!propia) { // la carta del rival aparece de frente al salir de su mano
      const wrap = document.createElement('div'); wrap.innerHTML = root.CartaHTML(carta); const cara = wrap.firstElementChild;
      clon.className = cara.className + ' flight'; clon.innerHTML = cara.innerHTML; origen.remove();
    } else origen.classList.add('lift-origin');
    Object.assign(clon.style, { width: destino.width + 'px', height: destino.height + 'px' });
    await new Promise(requestAnimationFrame);
    await volarA(clon, destino.left, destino.top, 900);
    sonidoCarta();
    if (!sigue()) { clon.remove(); return; }
    if (captura.length) {
      const secuencia = ordenarCaptura(captura, carta);
      for (const x of secuencia) {
        const el = x.id === carta.id ? clon : mesa.querySelector(`[data-id="${x.id}"]`);
        if (el) { el.classList.add('is-focus', 'is-marked'); }
        await espera(sinMovimiento() ? 1 : HIGHLIGHT_MS);
        if (el) el.classList.remove('is-focus');
        if (!sigue()) { clon.remove(); return; }
      }
      clon.classList.add('is-focus'); await espera(sinMovimiento() ? 1 : FINAL_PAUSE_MS); clon.classList.remove('is-focus');
      for (const id of tomadasIds) { const el = mesa.querySelector(`[data-id="${id}"]`); await alMonton(el, pila); await espera(sinMovimiento() ? 1 : 130); }
      clon.classList.remove('is-marked');
      const d = pila.getBoundingClientRect();
      clon.style.left = (d.left + d.width / 2 - clon.offsetWidth / 2) + 'px'; clon.style.top = (d.top + d.height / 2 - clon.offsetHeight / 2) + 'px';
      clon.style.transform = 'scale(.25) rotate(12deg)'; clon.style.opacity = '.15';
      await espera(sinMovimiento() ? 1 : 450);
    }
    clon.remove();
  }

  // ---- letras grandes en el centro de la pantalla (puntos, caída, limpia…) ----
  function grande(texto, ms) {
    if (sinMovimiento()) ms = Math.min(ms || 1800, 60);
    return new Promise(res => {
      const el = document.createElement('div'); el.className = 'points event-message'; el.textContent = texto;
      el.style.animationDuration = (ms || 1800) + 'ms'; document.body.appendChild(el);
      const fin = () => { el.remove(); res(); };
      setTimeout(fin, ms || 1800);
    });
  }

  root.Efectos = { animarJugada, grande, sonidoCarta, sonidoTurno, alternarSonido, sonido: () => sonidoOn, desbloquear, espera, ordenarCaptura };
})(typeof self !== 'undefined' ? self : this);
