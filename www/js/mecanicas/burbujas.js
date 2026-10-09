// Plástico de burbujas infinito. Descarga motora repetitiva con recompensa
// inmediata (sonido + vibración + partículas). Se puede arrastrar el dedo
// para reventar en cadena y usar varios dedos a la vez.
Remanso.registrar({
  id: 'burbujas',
  nombre: 'Burbujas',
  desc: 'Revienta sin fin. Arrastra el dedo.',
  icono: '⬤',
  fondo: 'linear-gradient(150deg, #3a3f6e, #262a4d 60%, #1b1e38)',

  iniciar(esc, util) {
    const L = util.lienzo();
    const { g } = L;
    const TONOS = [
      [190, 205, 255], [255, 200, 215], [190, 240, 220], [250, 230, 180], [215, 195, 255],
    ];
    let hoja = 0, burbujas = [], particulas = [], desliz = 0, reventadas = 0;
    const contador = util.rotulo('top: calc(64px + env(safe-area-inset-top)); font-size: 13px; color: rgba(255,255,255,.4);');

    function nuevaHoja() {
      const { w, h } = L;
      const r = Math.max(22, Math.min(w, h) / 13);
      const dx = r * 2.15, dy = r * 1.86;
      const top = 110, bottom = h - 40;
      burbujas = [];
      for (let fila = 0, y = top; y < bottom; fila++, y += dy) {
        for (let x = r + 10 + (fila % 2 ? dx / 2 : 0); x < w - r; x += dx) {
          burbujas.push({ x, y, r, viva: true, k: 0, brillo: Math.random() * Math.PI * 2 });
        }
      }
      // Centrar horizontalmente
      const maxX = Math.max(...burbujas.map(b => b.x));
      const minX = Math.min(...burbujas.map(b => b.x));
      const off = (w - (maxX + minX)) / 2;
      burbujas.forEach(b => { b.x += off; });
      desliz = 1;
    }
    L.alAjustar = nuevaHoja;
    nuevaHoja();

    const punteros = new Map();
    function revisar(x, y) {
      for (const b of burbujas) {
        if (!b.viva) continue;
        const dx = x - b.x, dy = y - b.y;
        if (dx * dx + dy * dy < b.r * b.r * 0.9) reventar(b);
      }
    }
    function reventar(b) {
      b.viva = false;
      b.k = 1;
      reventadas++;
      contador.textContent = reventadas;
      FX.pop(0.8 + Math.random() * 0.5);
      FX.vibrar('ligera');
      const c = TONOS[hoja % TONOS.length];
      for (let i = 0; i < 7; i++) {
        const a = Math.random() * Math.PI * 2, v = 40 + Math.random() * 90;
        particulas.push({ x: b.x, y: b.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vida: 1, c });
      }
      if (burbujas.every(x => !x.viva)) {
        FX.tono(FX.notaPentatonica(4, 330), { dur: 2, vol: 0.06 });
        FX.vibrarPatron(40);
        setTimeout(() => { hoja++; nuevaHoja(); }, 600);
      }
    }
    const abajo = e => { punteros.set(e.pointerId, true); revisar(e.offsetX, e.offsetY); };
    const mover = e => { if (punteros.has(e.pointerId)) revisar(e.offsetX, e.offsetY); };
    const arriba = e => punteros.delete(e.pointerId);
    L.cv.addEventListener('pointerdown', abajo);
    L.cv.addEventListener('pointermove', mover);
    L.cv.addEventListener('pointerup', arriba);
    L.cv.addEventListener('pointercancel', arriba);

    util.bucle((dt, t) => {
      const { w, h } = L;
      desliz = Math.max(0, desliz - dt * 2.2);
      const oy = desliz * desliz * h; // la hoja nueva entra desde abajo

      const c = TONOS[hoja % TONOS.length];
      g.fillStyle = `rgb(${c[0] * 0.12}, ${c[1] * 0.12}, ${c[2] * 0.16})`;
      g.fillRect(0, 0, w, h);

      for (const b of burbujas) {
        const y = b.y + oy;
        if (b.viva) {
          const sh = g.createRadialGradient(b.x - b.r * 0.35, y - b.r * 0.4, b.r * 0.1, b.x, y, b.r);
          sh.addColorStop(0, `rgba(255,255,255,0.75)`);
          sh.addColorStop(0.35, `rgba(${c[0]},${c[1]},${c[2]},0.45)`);
          sh.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0.18)`);
          g.fillStyle = sh;
          g.beginPath(); g.arc(b.x, y, b.r, 0, Math.PI * 2); g.fill();
          g.strokeStyle = `rgba(255,255,255,${0.18 + 0.08 * Math.sin(t * 1.5 + b.brillo)})`;
          g.lineWidth = 1.2;
          g.stroke();
        } else {
          // Burbuja aplastada: arruga plana
          b.k = Math.max(0, b.k - dt * 4);
          g.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},0.08)`;
          g.beginPath(); g.ellipse(b.x, y, b.r * (0.9 + b.k * 0.3), b.r * (0.55 + b.k * 0.3), 0, 0, Math.PI * 2); g.fill();
          g.strokeStyle = 'rgba(255,255,255,0.07)';
          g.lineWidth = 1;
          g.beginPath(); g.moveTo(b.x - b.r * 0.5, y - b.r * 0.1); g.lineTo(b.x + b.r * 0.4, y + b.r * 0.15); g.stroke();
        }
      }

      for (let i = particulas.length - 1; i >= 0; i--) {
        const p = particulas[i];
        p.vida -= dt * 2.2;
        if (p.vida <= 0) { particulas.splice(i, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92;
        g.fillStyle = `rgba(${p.c[0]},${p.c[1]},${p.c[2]},${p.vida})`;
        g.beginPath(); g.arc(p.x, p.y + oy, 2.2 * p.vida + 0.5, 0, Math.PI * 2); g.fill();
      }
    });
  },
});
