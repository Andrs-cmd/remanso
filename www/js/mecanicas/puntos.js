// Unión de puntos: une 1 → 2 → 3… arrastrando o tocando. Al cerrar la figura
// se llena de color y aparece la siguiente. Tarea visoespacial sencilla que
// ocupa la mente sin exigir; el siguiente punto siempre late para guiar y los
// toques "equivocados" simplemente no hacen nada.
Remanso.registrar({
  id: 'puntos',
  nombre: 'Unir puntos',
  desc: 'Une los puntos y descubre la figura.',
  icono: '⁘',
  fondo: 'linear-gradient(150deg, #1e3a5f, #172c48 60%, #101e33)',

  iniciar(esc, util) {
    const L = util.lienzo();
    const { g } = L;
    const CLAVE = 'remanso.puntos';

    // Cada figura devuelve puntos en [-1, 1]; cerrada = el último se une al primero.
    const muestra = (n, f, desde = 0, hasta = Math.PI * 2, cerrar = true) =>
      Array.from({ length: n }, (_, i) => f(desde + (hasta - desde) * i / (cerrar ? n : n - 1)));
    const FIGURAS = [
      { nombre: 'Estrella', cerrada: true, tono: 48, pts: () => muestra(10, a => { const r = (Math.round(a / (Math.PI / 5)) % 2) ? 0.42 : 1; return [Math.sin(a) * r, -Math.cos(a) * r]; }) },
      { nombre: 'Corazón', cerrada: true, tono: 345, pts: () => muestra(14, t => [Math.pow(Math.sin(t), 3), -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 16 + 0.1]) },
      { nombre: 'Luna', cerrada: true, tono: 210, pts: () => [
        // Borde exterior (círculo r=1) y borde interior (círculo r=0.8 centrado en x=0.45);
        // se cortan en (0.625, ±0.78).
        ...muestra(9, a => [Math.cos(a) + 0.15, Math.sin(a)], Math.PI * 0.285, Math.PI * 1.715, false),
        ...muestra(7, a => [0.6 + Math.cos(a) * 0.8, Math.sin(a) * 0.8], Math.PI * 1.57, Math.PI * 0.43, false).slice(1, -1),
      ] },
      { nombre: 'Flor', cerrada: true, tono: 300, pts: () => muestra(20, a => { const r = 0.45 + 0.55 * Math.abs(Math.cos(2.5 * a)); return [Math.cos(a) * r, Math.sin(a) * r]; }) },
      { nombre: 'Infinito', cerrada: true, tono: 175, pts: () => muestra(18, t => { const d = 1 + Math.sin(t) ** 2; return [Math.cos(t) / d, Math.sin(t) * Math.cos(t) / d * 1.4]; }) },
      { nombre: 'Espiral', cerrada: false, tono: 140, pts: () => muestra(20, a => [Math.cos(a) * a / 13, Math.sin(a) * a / 13], 0.6, Math.PI * 4, false) },
      // Cuatro alas: las de arriba más grandes; el ángulo se mide desde arriba.
      { nombre: 'Mariposa', cerrada: true, tono: 25, pts: () => muestra(24, a => { const r = 0.22 + 0.78 * Math.abs(Math.sin(2 * a)) * (Math.cos(a) > 0 ? 1 : 0.68); return [Math.sin(a) * r, -Math.cos(a) * r + 0.12]; }) },
      // Dos parábolas: puntas afiladas y puntos repartidos parejo en altura.
      { nombre: 'Hoja', cerrada: true, tono: 100, pts: () => [
        ...muestra(9, u => [0.62 * (1 - u * u), u], -1, 1, false),
        ...muestra(9, u => [-0.62 * (1 - u * u), u], 1, -1, false).slice(1, -1),
      ] },
      { nombre: 'Ola', cerrada: false, tono: 195, pts: () => muestra(18, x => [x, Math.sin(x * Math.PI * 1.5) * 0.35 + Math.sin(x * 9) * 0.04], -1, 1, false) },
      { nombre: 'Mandala', cerrada: true, tono: 265, pts: () => muestra(32, a => { const r = 0.55 + 0.3 * Math.cos(8 * a) + 0.15 * Math.cos(4 * a); return [Math.cos(a) * r, Math.sin(a) * r]; }) },
    ];

    let indice = 0;
    try { indice = parseInt(localStorage.getItem(CLAVE), 10) || 0; } catch (e) {}
    let fig, pts, unidos, completa, llenado, fundido, chispas = [], dedo = null;
    const titulo = util.rotulo('top: calc(64px + env(safe-area-inset-top)); font-size: 20px; font-weight: 300; letter-spacing: 1px; opacity: 0;');
    const pista = util.rotulo('bottom: calc(40px + env(safe-area-inset-bottom)); font-size: 14px; color: rgba(255,255,255,.45);');

    // Fondo de estrellas fijo
    const estrellas = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.2 + 0.2, f: Math.random() * 6 }));

    function cargar() {
      fig = FIGURAS[indice % FIGURAS.length];
      const crudos = fig.pts();
      const tam = Math.min(L.w, L.h * 0.7) * 0.4;
      pts = crudos.map(([x, y]) => ({ x: L.w / 2 + x * tam, y: L.h * 0.5 + y * tam }));
      unidos = 0; completa = false; llenado = 0; fundido = 0; chispas = [];
      titulo.style.opacity = 0;
      pista.textContent = indice === 0 ? 'Empieza por el 1 y arrastra el dedo' : '';
    }
    L.alAjustar = () => { if (fig) cargar(); };
    cargar();

    function color(a = 1, l = 70) { return `hsla(${fig.tono}, 75%, ${l}%, ${a})`; }

    function unir() {
      unidos++;
      FX.vibrar('ligera');
      FX.tono(FX.notaPentatonica(unidos % 15, 220), { dur: 1.4, vol: 0.06 });
      const p = pts[unidos - 1];
      for (let i = 0; i < 6; i++) {
        const a = Math.random() * Math.PI * 2;
        chispas.push({ x: p.x, y: p.y, vx: Math.cos(a) * 50, vy: Math.sin(a) * 50, vida: 1 });
      }
      if (unidos === pts.length) terminar();
    }

    function terminar() {
      completa = true;
      pista.textContent = '';
      titulo.textContent = fig.nombre;
      titulo.style.opacity = 1;
      FX.vibrarPatron(45);
      [0, 2, 4].forEach((k, i) => setTimeout(() => FX.tono(FX.notaPentatonica(k + 5, 220), { dur: 2.6, vol: 0.06 }), i * 120));
      for (const p of pts) for (let i = 0; i < 4; i++) {
        const a = Math.random() * Math.PI * 2, v = 30 + Math.random() * 60;
        chispas.push({ x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vida: 1.4 });
      }
      indice++;
      try { localStorage.setItem(CLAVE, indice); } catch (e) {}
      setTimeout(() => { fundido = 0.0001; }, 2800);
    }

    const RADIO = 26;
    function revisar(x, y) {
      if (completa || unidos >= pts.length) return;
      const p = pts[unidos];
      if (Math.hypot(x - p.x, y - p.y) < RADIO) unir();
    }
    const abajo = e => {
      if (dedo !== null) return;
      dedo = { id: e.pointerId, x: e.offsetX, y: e.offsetY };
      pista.textContent = '';
      revisar(e.offsetX, e.offsetY);
    };
    const mover = e => {
      if (!dedo || e.pointerId !== dedo.id) return;
      dedo.x = e.offsetX; dedo.y = e.offsetY;
      revisar(dedo.x, dedo.y);
    };
    const arriba = e => { if (dedo && e.pointerId === dedo.id) dedo = null; };
    L.cv.addEventListener('pointerdown', abajo);
    L.cv.addEventListener('pointermove', mover);
    L.cv.addEventListener('pointerup', arriba);
    L.cv.addEventListener('pointercancel', arriba);

    function trazo(hasta, cerrar) {
      g.beginPath();
      for (let i = 0; i < hasta; i++) i ? g.lineTo(pts[i].x, pts[i].y) : g.moveTo(pts[i].x, pts[i].y);
      if (cerrar) g.closePath();
    }

    util.bucle((dt, t) => {
      const { w, h } = L;
      g.fillStyle = '#0b1424';
      g.fillRect(0, 0, w, h);
      for (const s of estrellas) {
        g.fillStyle = `rgba(200, 220, 255, ${0.25 + 0.2 * Math.sin(t * 0.8 + s.f)})`;
        g.beginPath(); g.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2); g.fill();
      }

      let alfa = 1;
      if (fundido > 0) {
        fundido += dt * 1.2;
        alfa = Math.max(0, 1 - fundido);
        if (fundido >= 1) { cargar(); alfa = 1; }
      }
      g.globalAlpha = alfa;

      // Relleno al completar
      if (completa && fig.cerrada) {
        llenado = Math.min(1, llenado + dt * 0.7);
        const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.min(w, h) * 0.45);
        gr.addColorStop(0, color(0.55 * llenado, 75));
        gr.addColorStop(1, color(0.18 * llenado, 50));
        g.fillStyle = gr;
        trazo(pts.length, true);
        g.fill();
      }

      // Líneas ya unidas: halo ancho + línea fina
      if (unidos > 1 || completa) {
        const cerrar = completa && fig.cerrada;
        g.lineJoin = 'round'; g.lineCap = 'round';
        g.strokeStyle = color(0.18); g.lineWidth = 10;
        trazo(unidos, cerrar); g.stroke();
        g.strokeStyle = color(0.95, 80); g.lineWidth = 2.5;
        trazo(unidos, cerrar); g.stroke();
      }

      // Línea elástica hasta el dedo
      if (dedo && unidos > 0 && !completa) {
        const p = pts[unidos - 1];
        g.strokeStyle = color(0.4, 80); g.lineWidth = 2;
        g.setLineDash([4, 6]);
        g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(dedo.x, dedo.y); g.stroke();
        g.setLineDash([]);
      }

      // Puntos
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = '11px system-ui, sans-serif';
      pts.forEach((p, i) => {
        const hecho = i < unidos;
        const siguiente = i === unidos && !completa;
        if (siguiente) {
          const pulso = 0.5 + 0.5 * Math.sin(t * 3);
          g.fillStyle = color(0.12 + 0.12 * pulso, 75);
          g.beginPath(); g.arc(p.x, p.y, 14 + pulso * 8, 0, Math.PI * 2); g.fill();
        }
        g.fillStyle = hecho ? color(1, 85) : siguiente ? '#ffffff' : 'rgba(255,255,255,0.55)';
        g.beginPath(); g.arc(p.x, p.y, hecho ? 3.5 : 4.5, 0, Math.PI * 2); g.fill();
        if (!hecho && !completa) {
          // Número desplazado hacia fuera de la figura para que no tape la línea.
          const dx = p.x - w / 2, dy = p.y - h / 2, dl = Math.hypot(dx, dy) || 1;
          g.fillStyle = siguiente ? '#ffffff' : 'rgba(255,255,255,0.45)';
          g.fillText(String(i + 1), p.x + dx / dl * 14, p.y + dy / dl * 14);
        }
      });

      // Chispas
      for (let i = chispas.length - 1; i >= 0; i--) {
        const c = chispas[i];
        c.vida -= dt;
        if (c.vida <= 0) { chispas.splice(i, 1); continue; }
        c.x += c.vx * dt; c.y += c.vy * dt; c.vx *= 0.95; c.vy *= 0.95;
        g.fillStyle = color(Math.min(1, c.vida), 80);
        g.beginPath(); g.arc(c.x, c.y, 1.8, 0, Math.PI * 2); g.fill();
      }
      g.globalAlpha = 1;
    });
  },
});
