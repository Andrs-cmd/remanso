// Luz líquida: el dedo deja estelas de luz que se desvanecen despacio y
// suenan en escala pentatónica (nunca desafina). Movimiento lento = notas
// graves y estela ancha; recompensa la calma sin decirlo.
Remanso.registrar({
  id: 'estela',
  nombre: 'Luz líquida',
  desc: 'Dibuja con luz que se disuelve.',
  icono: '〰',
  fondo: 'linear-gradient(150deg, #4a2d5c, #2e1d40 60%, #1d1430)',

  iniciar(esc, util) {
    const L = util.lienzo();
    const { g } = L;
    let tono = Math.random() * 360;
    const chispas = [];
    const punteros = new Map();
    let ultimaNota = 0;

    const pista = util.rotulo('top: 48%; font-size: 16px; color: rgba(255,255,255,.45);');
    pista.textContent = 'Desliza el dedo despacio';

    function emitir(x, y, vx, vy, vel) {
      const n = 2 + Math.min(6, vel / 120);
      for (let i = 0; i < n; i++) {
        chispas.push({
          x: x + (Math.random() - 0.5) * 6, y: y + (Math.random() - 0.5) * 6,
          vx: vx * 0.15 + (Math.random() - 0.5) * 30, vy: vy * 0.15 + (Math.random() - 0.5) * 30 - 10,
          vida: 1, tam: 8 + Math.random() * 16 * (1 - Math.min(vel / 2500, 0.6)),
          h: tono + (Math.random() - 0.5) * 30,
        });
      }
      if (chispas.length > 1600) chispas.splice(0, chispas.length - 1600);
    }

    function nota(y, vel) {
      const ahora = performance.now();
      if (ahora - ultimaNota < 140) return;
      ultimaNota = ahora;
      const grado = Math.round((1 - y / L.h) * 12);
      FX.tono(FX.notaPentatonica(grado, 196), { dur: 2.4, vol: 0.035 + Math.min(vel / 6000, 0.03), ataque: 0.05 });
    }

    const abajo = e => {
      punteros.set(e.pointerId, { x: e.offsetX, y: e.offsetY, t: performance.now() });
      pista.style.opacity = 0;
      FX.vibrar('ligera');
      nota(e.offsetY, 0);
    };
    const mover = e => {
      const p = punteros.get(e.pointerId);
      if (!p) return;
      const ahora = performance.now();
      const dt = Math.max(ahora - p.t, 1) / 1000;
      const vx = (e.offsetX - p.x) / dt, vy = (e.offsetY - p.y) / dt;
      const vel = Math.hypot(vx, vy);
      // Interpolar para que la estela sea continua aunque el dedo vaya rápido.
      const pasos = Math.ceil(Math.hypot(e.offsetX - p.x, e.offsetY - p.y) / 6);
      for (let i = 1; i <= pasos; i++) {
        emitir(p.x + (e.offsetX - p.x) * i / pasos, p.y + (e.offsetY - p.y) * i / pasos, vx, vy, vel);
      }
      nota(e.offsetY, vel);
      punteros.set(e.pointerId, { x: e.offsetX, y: e.offsetY, t: ahora });
    };
    const arriba = e => punteros.delete(e.pointerId);
    L.cv.addEventListener('pointerdown', abajo);
    L.cv.addEventListener('pointermove', mover);
    L.cv.addEventListener('pointerup', arriba);
    L.cv.addEventListener('pointercancel', arriba);

    g.fillStyle = '#07060d';
    g.fillRect(0, 0, L.w, L.h);

    util.bucle((dt, t) => {
      const { w, h } = L;
      tono = (tono + dt * 8) % 360;
      // Velo translúcido: lo anterior se desvanece despacio en vez de borrarse.
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = 'rgba(7, 6, 13, 0.06)';
      g.fillRect(0, 0, w, h);

      g.globalCompositeOperation = 'lighter';
      for (let i = chispas.length - 1; i >= 0; i--) {
        const c = chispas[i];
        c.vida -= dt * 0.45;
        if (c.vida <= 0) { chispas.splice(i, 1); continue; }
        c.x += c.vx * dt + Math.sin(t * 0.7 + c.y * 0.01) * 6 * dt;
        c.y += c.vy * dt;
        c.vx *= 0.96; c.vy = c.vy * 0.96 - 4 * dt; // flotan hacia arriba
        const r = c.tam * (0.4 + c.vida * 0.6);
        const grad = g.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
        grad.addColorStop(0, `hsla(${c.h}, 80%, 72%, ${0.22 * c.vida})`);
        grad.addColorStop(1, `hsla(${c.h}, 80%, 60%, 0)`);
        g.fillStyle = grad;
        g.beginPath(); g.arc(c.x, c.y, r, 0, Math.PI * 2); g.fill();
      }
      g.globalCompositeOperation = 'source-over';
    });
  },
});
