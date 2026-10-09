// Sonido sintetizado (sin archivos) y vibración háptica.
// Todo es suave a propósito: nada de golpes fuertes ni tonos agudos.
const FX = (() => {
  let ctx = null;
  let maestro = null;
  const ajustes = { sonido: true, vibracion: true };

  function audio() {
    if (!ajustes.sonido) return null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      maestro = ctx.createGain();
      maestro.gain.value = 0.8;
      // Un compresor evita picos cuando suenan muchas cosas a la vez.
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      maestro.connect(comp).connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // Escala pentatónica: cualquier combinación de notas suena bien.
  const PENTA = [0, 2, 4, 7, 9];
  function notaPentatonica(i, base = 220) {
    const oct = Math.floor(i / PENTA.length);
    const grado = PENTA[((i % PENTA.length) + PENTA.length) % PENTA.length];
    return base * Math.pow(2, oct + grado / 12);
  }

  function tono(freq, { dur = 1.2, vol = 0.12, tipo = 'sine', ataque = 0.02 } = {}) {
    const c = audio(); if (!c) return;
    const t = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = tipo;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + ataque);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(maestro);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  // "Pop" de burbuja: ráfaga corta de ruido filtrado + golpecito tonal.
  let ruido = null;
  function bufferRuido(c) {
    if (ruido) return ruido;
    ruido = c.createBuffer(1, c.sampleRate * 0.2, c.sampleRate);
    const d = ruido.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    return ruido;
  }
  function pop(altura = 1) {
    const c = audio(); if (!c) return;
    const t = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = bufferRuido(c);
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 900 * altura + Math.random() * 300;
    f.Q.value = 1.4;
    const g = c.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    src.connect(f).connect(g).connect(maestro);
    src.start(t);

    const o = c.createOscillator();
    const g2 = c.createGain();
    o.frequency.setValueAtTime(380 * altura, t);
    o.frequency.exponentialRampToValueAtTime(140 * altura, t + 0.08);
    g2.gain.setValueAtTime(0.18, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.connect(g2).connect(maestro);
    o.start(t); o.stop(t + 0.12);
  }

  // Colchón ambiental continuo cuyo volumen y brillo se controlan desde fuera (0..1).
  function colchon(base = 110) {
    const c = audio(); if (!c) return { nivel() {}, parar() {} };
    const salida = c.createGain();
    salida.gain.value = 0;
    const filtro = c.createBiquadFilter();
    filtro.type = 'lowpass';
    filtro.frequency.value = 400;
    filtro.connect(salida).connect(maestro);
    const oscs = [1, 1.5, 2.003, 2.997].map((m, i) => {
      const o = c.createOscillator();
      o.type = i % 2 ? 'triangle' : 'sine';
      o.frequency.value = base * m;
      const g = c.createGain();
      g.gain.value = 0.09 / (i + 1);
      o.connect(g).connect(filtro);
      o.start();
      return o;
    });
    salida.gain.linearRampToValueAtTime(0.5, c.currentTime + 2);
    return {
      nivel(x) {
        const t = c.currentTime;
        filtro.frequency.setTargetAtTime(300 + x * 900, t, 0.3);
        salida.gain.setTargetAtTime(0.25 + x * 0.35, t, 0.3);
      },
      parar() {
        const t = c.currentTime;
        salida.gain.setTargetAtTime(0, t, 0.4);
        oscs.forEach(o => o.stop(t + 2));
      },
    };
  }

  // Háptica: plugin nativo de Capacitor si existe, si no navigator.vibrate.
  function haptico() {
    const P = window.Capacitor && window.Capacitor.Plugins;
    return P && P.Haptics ? P.Haptics : null;
  }
  function vibrar(intensidad = 'ligera') {
    if (!ajustes.vibracion) return;
    const h = haptico();
    if (h) {
      const estilo = { ligera: 'LIGHT', media: 'MEDIUM', fuerte: 'HEAVY' }[intensidad] || 'LIGHT';
      h.impact({ style: estilo }).catch(() => {});
      return;
    }
    if (navigator.vibrate) navigator.vibrate({ ligera: 8, media: 18, fuerte: 35 }[intensidad] || 8);
  }
  function vibrarPatron(ms) {
    if (!ajustes.vibracion) return;
    const h = haptico();
    if (h && typeof ms === 'number') { h.vibrate({ duration: ms }).catch(() => {}); return; }
    if (navigator.vibrate) navigator.vibrate(ms);
  }

  return { ajustes, audio, tono, pop, colchon, notaPentatonica, vibrar, vibrarPatron };
})();
