// Jardín zen: rastrillar arena y colocar piedras.
// La arena es un mapa de alturas iluminado de lado, así los surcos tienen
// relieve real. El rastrillo tiene 5 púas; las piedras dibujan anillos.
Remanso.registrar({
  id: 'zen',
  nombre: 'Jardín zen',
  desc: 'Rastrilla la arena. Pon piedras.',
  icono: '≋',
  fondo: 'linear-gradient(150deg, #6b5a3e, #4a3e2b 60%, #33291c)',

  iniciar(esc, util) {
    const L = util.lienzo();
    const { g } = L;
    const S = 2;            // px por celda del mapa de alturas
    const SP = 11;          // separación entre púas (px)
    const PUAS = 5;
    const MEDIO = SP * PUAS / 2;
    let gw, gh, H, grano, img, off, offg, sucio = true;
    let piedras = [];
    let modo = 'rastrillo';

    const sonido = FX.roce({ frec: 2600, q: 0.6, vol: 0.16 });

    function crear() {
      gw = Math.ceil(L.w / S); gh = Math.ceil(L.h / S);
      H = new Float32Array(gw * gh);
      grano = new Float32Array(gw * gh);
      for (let i = 0; i < grano.length; i++) grano[i] = Math.random();
      off = document.createElement('canvas');
      off.width = gw; off.height = gh;
      offg = off.getContext('2d');
      img = offg.createImageData(gw, gh);
      // Empieza ya rastrillado en líneas horizontales, con dos piedras.
      for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
        H[y * gw + x] = -Math.cos((2 * Math.PI * y * S) / SP) * 0.9;
      }
      piedras = [];
      ponerPiedra(L.w * 0.32, L.h * 0.36, Math.min(L.w, L.h) * 0.075);
      ponerPiedra(L.w * 0.68, L.h * 0.64, Math.min(L.w, L.h) * 0.055);
      sucio = true;
    }
    L.alAjustar = crear;

    // Mezcla la altura de las celdas hacia un perfil dado.
    function mezclar(i, perfil, peso) { H[i] += (perfil - H[i]) * peso; }

    function dentroDePiedra(px, py, margen = 0) {
      for (const p of piedras) {
        const dx = px - p.x, dy = py - p.y;
        if (dx * dx + dy * dy < (p.r + margen) * (p.r + margen)) return true;
      }
      return false;
    }

    function anillos(p) {
      const R = p.r + SP * 3.5;
      const x0 = Math.max(0, Math.floor((p.x - R) / S)), x1 = Math.min(gw - 1, Math.ceil((p.x + R) / S));
      const y0 = Math.max(0, Math.floor((p.y - R) / S)), y1 = Math.min(gh - 1, Math.ceil((p.y + R) / S));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x * S - p.x, y * S - p.y);
        if (d < p.r || d > R) continue;
        const borde = 1 - Math.max(0, (d - (R - SP)) / SP);
        mezclar(y * gw + x, -Math.cos((2 * Math.PI * (d - p.r)) / SP), 0.95 * borde);
      }
      sucio = true;
    }

    function ponerPiedra(x, y, r) {
      // Contorno irregular fijo para que cada piedra sea única.
      const forma = Array.from({ length: 14 }, (_, i) => 0.86 + Math.random() * 0.2 + (i % 2) * 0.03);
      const p = { x, y, r, forma, tono: 70 + Math.random() * 40, giro: Math.random() * Math.PI };
      piedras.push(p);
      anillos(p);
    }

    // Una pasada del rastrillo centrada en (px,py) orientada según dir.
    function rastrillar(px, py, dx, dy) {
      const nx = -dy, ny = dx;
      const R = MEDIO + 4;
      const x0 = Math.max(0, Math.floor((px - R) / S)), x1 = Math.min(gw - 1, Math.ceil((px + R) / S));
      const y0 = Math.max(0, Math.floor((py - R) / S)), y1 = Math.min(gh - 1, Math.ceil((py + R) / S));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const rx = x * S - px, ry = y * S - py;
        const s = rx * nx + ry * ny;     // posición a lo ancho del rastrillo
        const a = rx * dx + ry * dy;     // posición a lo largo del trazo
        if (Math.abs(s) > MEDIO || Math.abs(a) > 3) continue;
        if (dentroDePiedra(x * S, y * S, 2)) continue;
        const borde = Math.min(1, (MEDIO - Math.abs(s)) / (SP * 0.5));
        mezclar(y * gw + x, -Math.cos((2 * Math.PI * (s + SP / 2)) / SP), 0.55 * borde * (1 - Math.abs(a) / 3));
      }
      sucio = true;
    }

    // ---- entrada ----
    let activo = null, dirX = 0, dirY = 1, recorrido = 0;
    const abajo = e => {
      if (activo !== null) return;
      const x = e.offsetX, y = e.offsetY;
      if (modo === 'piedras') {
        const i = piedras.findIndex(p => Math.hypot(x - p.x, y - p.y) < p.r);
        if (i >= 0) { piedras.splice(i, 1); FX.vibrar('ligera'); sucio = true; return; }
        if (piedras.length >= 9) return;
        ponerPiedra(x, y, Math.min(L.w, L.h) * (0.04 + Math.random() * 0.04));
        FX.vibrar('media');
        FX.tono(110 + Math.random() * 40, { dur: 0.5, vol: 0.12, tipo: 'triangle' });
        return;
      }
      activo = { id: e.pointerId, x, y };
    };
    const mover = e => {
      if (!activo || e.pointerId !== activo.id) return;
      const x = e.offsetX, y = e.offsetY;
      const dx = x - activo.x, dy = y - activo.y;
      const len = Math.hypot(dx, dy);
      if (len < 1) return;
      // Dirección suavizada: el rastrillo gira con inercia, no a saltos.
      dirX += (dx / len - dirX) * 0.35; dirY += (dy / len - dirY) * 0.35;
      const dl = Math.hypot(dirX, dirY) || 1;
      const ux = dirX / dl, uy = dirY / dl;
      const pasos = Math.ceil(len / 2);
      for (let i = 1; i <= pasos; i++) rastrillar(activo.x + dx * i / pasos, activo.y + dy * i / pasos, ux, uy);
      sonido.nivel(Math.min(len / 14, 1));
      recorrido += len;
      if (recorrido > 22) { recorrido = 0; FX.vibrar('ligera'); }
      activo.x = x; activo.y = y;
    };
    const arriba = e => { if (activo && e.pointerId === activo.id) { activo = null; sonido.nivel(0); } };
    L.cv.addEventListener('pointerdown', abajo);
    L.cv.addEventListener('pointermove', mover);
    L.cv.addEventListener('pointerup', arriba);
    L.cv.addEventListener('pointercancel', arriba);

    // ---- alisar: una ola de arena lisa que baja por la pantalla ----
    let alisando = -1;
    util.controles([
      { txt: 'Rastrillo', on: true, alTocar(b, t) { modo = 'rastrillo'; t[0].classList.add('on'); t[1].classList.remove('on'); } },
      { txt: 'Piedras', alTocar(b, t) { modo = 'piedras'; t[1].classList.add('on'); t[0].classList.remove('on'); } },
      { txt: 'Alisar', alTocar() { if (alisando < 0) { alisando = 0; FX.vibrarPatron(30); } } },
    ]);

    crear();

    util.bucle(dt => {
      if (alisando >= 0) {
        const antes = Math.floor(alisando * gh);
        alisando += dt * 0.9;
        const ahora = Math.min(gh, Math.floor(alisando * gh));
        for (let y = Math.max(0, antes - 6); y < ahora; y++) for (let x = 0; x < gw; x++) H[y * gw + x] *= 0.25;
        sonido.nivel(0.5);
        sucio = true;
        if (alisando >= 1) { alisando = -1; sonido.nivel(0); piedras.forEach(anillos); }
      }
      if (!sucio) return;
      sucio = false;

      // Sombreado: luz que entra desde arriba a la izquierda.
      const d = img.data;
      for (let y = 1; y < gh - 1; y++) {
        for (let x = 1; x < gw - 1; x++) {
          const i = y * gw + x;
          const lx = H[i - 1] - H[i + 1];
          const ly = H[i - gw] - H[i + gw];
          const luz = 0.86 + (lx * 0.55 + ly * 0.75) * 0.28 + H[i] * 0.035 + (grano[i] - 0.5) * 0.09;
          const k = i * 4;
          d[k] = 222 * luz; d[k + 1] = 206 * luz; d[k + 2] = 172 * luz; d[k + 3] = 255;
        }
      }
      offg.putImageData(img, 0, 0);
      g.imageSmoothingEnabled = true;
      g.drawImage(off, 0, 0, gw * S, gh * S);

      // Viñeta suave
      const v = g.createRadialGradient(L.w / 2, L.h / 2, Math.min(L.w, L.h) * 0.4, L.w / 2, L.h / 2, Math.max(L.w, L.h) * 0.75);
      v.addColorStop(0, 'rgba(40,25,10,0)');
      v.addColorStop(1, 'rgba(40,25,10,0.35)');
      g.fillStyle = v;
      g.fillRect(0, 0, L.w, L.h);

      for (const p of piedras) dibujarPiedra(p);
    });

    function contorno(p, escala, ox = 0, oy = 0) {
      g.beginPath();
      p.forma.forEach((f, i) => {
        const a = p.giro + (i / p.forma.length) * Math.PI * 2;
        const x = p.x + ox + Math.cos(a) * p.r * f * escala;
        const y = p.y + oy + Math.sin(a) * p.r * f * escala * 0.88;
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      });
      g.closePath();
    }
    function dibujarPiedra(p) {
      g.fillStyle = 'rgba(50, 35, 20, 0.35)';
      contorno(p, 1.04, p.r * 0.18, p.r * 0.22);
      g.fill();
      const gr = g.createRadialGradient(p.x - p.r * 0.35, p.y - p.r * 0.4, p.r * 0.1, p.x, p.y, p.r * 1.1);
      gr.addColorStop(0, `rgb(${p.tono + 70}, ${p.tono + 68}, ${p.tono + 62})`);
      gr.addColorStop(0.6, `rgb(${p.tono}, ${p.tono - 2}, ${p.tono - 6})`);
      gr.addColorStop(1, `rgb(${p.tono - 35}, ${p.tono - 38}, ${p.tono - 42})`);
      g.fillStyle = gr;
      contorno(p, 1);
      g.fill();
    }

    return () => sonido.parar();
  },
});
