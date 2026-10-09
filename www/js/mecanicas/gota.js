// Gota líquida en un plato de su mismo tamaño, centrado. Al pasar el dedo la
// bola se abre por la línea del corte y luego se vuelve a cerrar: sigue siendo
// líquida. La bola tiene anillos de color, como el marmoleado en agua
// (suminagashi): cada corte arrastra los colores y va dejando un patrón.
// Simulación de partículas con relajación de doble densidad (Clavet et al. 2005).
Remanso.registrar({
  id: 'gota',
  nombre: 'Gota líquida',
  desc: 'Córtala con el dedo. Forma patrones en el agua.',
  icono: '◐',
  fondo: 'linear-gradient(150deg, #155a6e, #0f3d52 60%, #0a2a3b)',

  iniciar(esc, util) {
    const L = util.lienzo();
    const { g } = L;
    const h = 15;                 // radio de interacción entre partículas
    const SEP = h * 0.5;          // separación inicial (y de reposo)
    const K = 0.06, KN = 0.2, ROCE = 0.95;
    const VISC = 0.22;            // viscosidad: el líquido se mueve en bloque, como tinta
    const BANDA = h * 1.3;        // ancho de la zona que arrastra cada corte
    const HUECO = 8;              // medio ancho máximo de la herida (px)
    const VIDA = 1.3;             // segundos que tarda en cerrarse
    const PALETAS = [
      [[22, 120, 140], [235, 228, 210], [240, 120, 110], [235, 228, 210]],
      [[40, 60, 140], [250, 240, 225], [90, 170, 220], [250, 240, 225]],
      [[120, 50, 120], [245, 225, 235], [230, 150, 90], [245, 225, 235]],
      [[30, 90, 70], [240, 235, 215], [200, 170, 60], [240, 235, 215]],
    ];
    let paleta = 0;
    let ps = [];

    // Densidad de reposo un poco por debajo de la de la red inicial: el líquido
    // queda levemente a presión dentro del plato, así cualquier hueco que deje
    // un corte se vuelve a llenar solo.
    const RHO0 = 0.88 * (() => {
      let r = 0;
      for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) {
        const x = (i + (j & 1) * 0.5) * SEP, y = j * SEP * 0.866, d = Math.hypot(x, y);
        if (d > 0 && d < h) r += (1 - d / h) ** 2;
      }
      return r;
    })();

    const plato = () => ({ cx: L.w / 2, cy: L.h / 2, r: Math.min(L.w, L.h * 0.62) * 0.4 });

    function llenar() {
      const { cx, cy, r } = plato();
      const pal = PALETAS[paleta % PALETAS.length];
      const ANILLO = r / 6.5;
      ps = [];
      for (let j = -Math.ceil(r / (SEP * 0.866)); j * SEP * 0.866 <= r; j++) {
        for (let i = -Math.ceil(r / SEP) - 1; i * SEP <= r + SEP; i++) {
          const x = (i + (j & 1) * 0.5) * SEP, y = j * SEP * 0.866;
          const d = Math.hypot(x, y);
          if (d > r - SEP * 0.6) continue;
          ps.push({ x: cx + x, y: cy + y, px: 0, py: 0, vx: 0, vy: 0, sx: 0, sy: 0, c: pal[Math.floor(d / ANILLO) % pal.length] });
        }
      }
    }

    // ---- cortes: cada tramo es una pared fina que se abre y se va cerrando;
    // mientras vive, las partículas de lados opuestos tampoco se atraen ----
    const cortes = [];
    function anchoCorte(c) {
      const e = VIDA - c.vida;
      const abre = Math.min(1, e / 0.08);
      const cierra = 1 - Math.max(0, Math.min(1, (e - 0.25) / (VIDA - 0.25)));
      return HUECO * abre * cierra * cierra * (3 - 2 * cierra);
    }
    function apartar() {
      for (const c of cortes) {
        const w = anchoCorte(c);
        if (w < 0.5) continue;
        const sx = c.bx - c.ax, sy = c.by - c.ay, len = Math.hypot(sx, sy);
        const ux = sx / len, uy = sy / len, nx = -uy, ny = ux;
        const x0 = Math.min(c.ax, c.bx) - w, x1 = Math.max(c.ax, c.bx) + w;
        const y0 = Math.min(c.ay, c.by) - w, y1 = Math.max(c.ay, c.by) + w;
        for (const p of ps) {
          if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
          const rx = p.x - c.ax, ry = p.y - c.ay;
          const a = rx * ux + ry * uy;
          if (a < 0 || a > len) continue;
          const s = rx * nx + ry * ny;
          if (Math.abs(s) >= w) continue;
          const lado = s >= 0 ? 1 : -1;
          p.x += nx * (lado * w - s); p.y += ny * (lado * w - s);
        }
      }
    }
    const orient = (px, py, qx, qy, rx, ry) => (qx - px) * (ry - py) - (qy - py) * (rx - px);
    function cruzaCorte(p, q) {
      for (const c of cortes) {
        if ((orient(c.ax, c.ay, c.bx, c.by, p.x, p.y) > 0) !== (orient(c.ax, c.ay, c.bx, c.by, q.x, q.y) > 0) &&
            (orient(p.x, p.y, q.x, q.y, c.ax, c.ay) > 0) !== (orient(p.x, p.y, q.x, q.y, c.bx, c.by) > 0)) return true;
      }
      return false;
    }

    // ---- simulación ----
    const celdas = new Map();
    const clave = (cx, cy) => (cx + 1000) * 8192 + (cy + 1000);
    function rejilla() {
      celdas.clear();
      for (const p of ps) {
        const k = clave(Math.floor(p.x / h), Math.floor(p.y / h));
        let c = celdas.get(k);
        if (!c) celdas.set(k, c = []);
        c.push(p);
      }
    }
    const vs = [];
    let mediaDt = 1 / 60;
    function paso() {
      const { cx, cy, r: RP } = plato();
      for (const p of ps) {
        p.vx *= ROCE; p.vy *= ROCE;
        p.px = p.x; p.py = p.y;
        p.x += p.vx; p.y += p.vy;
      }
      rejilla();
      if (cortes.length) {
        for (const p of ps) p.cerca = cortes.some(c =>
          p.x > Math.min(c.ax, c.bx) - h && p.x < Math.max(c.ax, c.bx) + h &&
          p.y > Math.min(c.ay, c.by) - h && p.y < Math.max(c.ay, c.by) + h);
      }
      for (const p of ps) {
        let rho = 0, rhoN = 0, mvx = 0, mvy = 0, mw = 0;
        vs.length = 0;
        const revisar = cortes.length && p.cerca;
        const gx = Math.floor(p.x / h), gy = Math.floor(p.y / h);
        for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
          const c = celdas.get(clave(gx + i, gy + j));
          if (!c) continue;
          for (const q of c) {
            if (q === p) continue;
            const dx = q.x - p.x, dy = q.y - p.y, d2 = dx * dx + dy * dy;
            if (d2 >= h * h || d2 === 0) continue;
            if (revisar && cruzaCorte(p, q)) continue;
            const d = Math.sqrt(d2), u = 1 - d / h;
            rho += u * u; rhoN += u * u * u;
            mvx += (q.vx - p.vx) * u; mvy += (q.vy - p.vy) * u; mw += u;
            vs.push(q, dx / d, dy / d, u);
          }
        }
        if (mw > 0) { p.sx = mvx / mw; p.sy = mvy / mw; } else { p.sx = p.sy = 0; }
        const P = K * (rho - RHO0), PN = KN * rhoN;
        let ax = 0, ay = 0;
        for (let i = 0; i < vs.length; i += 4) {
          const q = vs[i], u = vs[i + 3];
          const D = (P * u + PN * u * u) * 0.5;
          const dx = vs[i + 1] * D, dy = vs[i + 2] * D;
          q.x += dx; q.y += dy; ax -= dx; ay -= dy;
        }
        p.x += ax; p.y += ay;
      }
      apartar();
      const lim = RP - SEP * 0.5;
      for (const p of ps) {
        // Pared del plato
        const dx = p.x - cx, dy = p.y - cy, d = Math.hypot(dx, dy);
        if (d > lim) { p.x = cx + dx / d * lim; p.y = cy + dy / d * lim; }
        p.vx = p.x - p.px + p.sx * VISC; p.vy = p.y - p.py + p.sy * VISC;
        const v2 = p.vx * p.vx + p.vy * p.vy;
        if (v2 > 36) { const f = 6 / Math.sqrt(v2); p.vx *= f; p.vy *= f; }
      }
    }

    // ---- corte ----
    const estelas = [];
    const dedos = new Map();
    let ultimoSonido = 0;
    function cortar(ax, ay, bx, by) {
      const sx = bx - ax, sy = by - ay;
      const len = Math.hypot(sx, sy);
      if (len < 0.5) return;
      const ux = sx / len, uy = sy / len, nx = -uy, ny = ux;
      let tocadas = 0;
      for (const p of ps) {
        const rx = p.x - ax, ry = p.y - ay;
        const a = rx * ux + ry * uy;
        if (a < 0 || a > len) continue;
        const s = rx * nx + ry * ny;
        if (Math.abs(s) >= BANDA) continue;
        // El líquido se abre hacia los lados y se deja arrastrar un poco en
        // la dirección del dedo (eso es lo que dibuja el patrón). Se fija una
        // velocidad mínima en vez de sumar, para que un trazo con muchos
        // tramos no la dispare.
        const lado = s >= 0 ? 1 : -1;
        const f = 1 - Math.abs(s) / BANDA;
        const abrir = 0.8 * f, arrastre = 1.6 * f;
        const vn = (p.vx * nx + p.vy * ny) * lado;
        if (vn < abrir) { p.vx += nx * lado * (abrir - vn); p.vy += ny * lado * (abrir - vn); }
        const vt = p.vx * ux + p.vy * uy;
        if (vt < arrastre) { p.vx += ux * (arrastre - vt); p.vy += uy * (arrastre - vt); }
        tocadas++;
      }
      cortes.push({ ax, ay, bx, by, vida: VIDA });
      if (tocadas) {
        const ahora = performance.now();
        if (ahora - ultimoSonido > 90) {
          ultimoSonido = ahora;
          FX.vibrar('ligera');
          FX.tono(FX.notaPentatonica(Math.floor(Math.random() * 6), 196), { dur: 0.9, vol: 0.05 });
        }
      }
      estelas.push({ ax, ay, bx, by, vida: 1 });
    }
    const abajo = e => { dedos.set(e.pointerId, { x: e.offsetX, y: e.offsetY }); };
    const mover = e => {
      const d = dedos.get(e.pointerId);
      if (!d) return;
      cortar(d.x, d.y, e.offsetX, e.offsetY);
      d.x = e.offsetX; d.y = e.offsetY;
    };
    const arriba = e => dedos.delete(e.pointerId);
    L.cv.addEventListener('pointerdown', abajo);
    L.cv.addEventListener('pointermove', mover);
    L.cv.addEventListener('pointerup', arriba);
    L.cv.addEventListener('pointercancel', arriba);

    util.controles([
      { txt: 'Otros colores', alTocar() { paleta++; llenar(); FX.vibrar('media'); FX.tono(FX.notaPentatonica(paleta % 5, 147), { dur: 1.6, vol: 0.06 }); } },
      { txt: 'Reiniciar', alTocar() { llenar(); FX.vibrar('media'); } },
    ]);

    // ---- pintura (metabolas en una rejilla de baja resolución) ----
    const S = 2, R = 11, R2 = R * R;
    let fw, fh, F, CR, CG, CB, W, MV, off, offg, img, umbral = 1;
    function prepararCampo() {
      fw = Math.ceil(L.w / S) + 2; fh = Math.ceil(L.h / S) + 2;
      F = new Float32Array(fw * fh); CR = new Float32Array(fw * fh);
      CG = new Float32Array(fw * fh); CB = new Float32Array(fw * fh);
      W = new Float32Array(fw * fh); MV = new Float32Array(fw * fh);
      off = document.createElement('canvas'); off.width = fw; off.height = fh;
      offg = off.getContext('2d'); img = offg.createImageData(fw, fh);
      // Umbral = la mitad del valor del campo dentro del líquido en reposo:
      // así un hueco de una partícula ya se ve como una línea oscura.
      let interior = 0;
      for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) {
        const x = (i + (j & 1) * 0.5) * SEP, y = j * SEP * 0.866, d2 = x * x + y * y;
        if (d2 < R2) interior += (1 - d2 / R2) ** 2;
      }
      umbral = interior * 0.5;
    }
    L.alAjustar = () => { prepararCampo(); llenar(); };
    prepararCampo();
    llenar();

    util.bucle((dt) => {
      for (let i = cortes.length - 1; i >= 0; i--) if ((cortes[i].vida -= dt) <= 0) cortes.splice(i, 1);
      // En teléfonos lentos (menos de ~40 fps) se simula un paso por cuadro.
      mediaDt += (dt - mediaDt) * 0.05;
      paso();
      if (mediaDt < 0.025) paso();

      F.fill(0); CR.fill(0); CG.fill(0); CB.fill(0); W.fill(0); MV.fill(0);
      const rc = Math.ceil(R / S);
      for (const p of ps) {
        const cx = Math.round(p.x / S), cy = Math.round(p.y / S);
        const rapidez = Math.hypot(p.vx, p.vy);
        for (let y = Math.max(0, cy - rc); y <= Math.min(fh - 1, cy + rc); y++) {
          for (let x = Math.max(0, cx - rc); x <= Math.min(fw - 1, cx + rc); x++) {
            const dx = x * S - p.x, dy = y * S - p.y, d2 = dx * dx + dy * dy;
            if (d2 >= R2) continue;
            const k = 1 - d2 / R2, v = k * k, i = y * fw + x;
            // El color usa un núcleo algo más estrecho que la forma para que
            // los anillos se vean definidos sin que se note cada partícula.
            const vc = v * k;
            F[i] += v; W[i] += vc; MV[i] += rapidez * v;
            CR[i] += p.c[0] * vc; CG[i] += p.c[1] * vc; CB[i] += p.c[2] * vc;
          }
        }
      }
      const d = img.data;
      const bajo = umbral * 0.75, ancho = umbral * 0.5;
      for (let y = 1; y < fh - 1; y++) for (let x = 1; x < fw - 1; x++) {
        const i = y * fw + x, f = F[i], k = i * 4;
        if (f < bajo) { d[k + 3] = 0; continue; }
        const a = Math.min(1, (f - bajo) / ancho);
        // Borde del corte un poco más oscuro, como un menisco.
        const sombra = 0.72 + 0.28 * Math.min(1, (f - bajo) / (ancho * 2));
        // Reflejo donde el líquido se mueve: se nota que fluye.
        const brillo = Math.min(1, MV[i] / f * 0.45) * 55;
        const wc = W[i] || 1;
        d[k] = CR[i] / wc * sombra + brillo; d[k + 1] = CG[i] / wc * sombra + brillo; d[k + 2] = CB[i] / wc * sombra + brillo;
        d[k + 3] = a * 255;
      }
      offg.putImageData(img, 0, 0);

      const { w, h: alto } = L;
      const P = plato();
      g.fillStyle = '#06121b';
      g.fillRect(0, 0, w, alto);
      // Sombra del plato sobre la mesa
      const sombra = g.createRadialGradient(P.cx, P.cy + 12, P.r * 0.85, P.cx, P.cy + 12, P.r * 1.3);
      sombra.addColorStop(0, 'rgba(0,0,0,0.55)'); sombra.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = sombra;
      g.beginPath(); g.arc(P.cx, P.cy + 12, P.r * 1.3, 0, Math.PI * 2); g.fill();

      g.save();
      g.beginPath(); g.arc(P.cx, P.cy, P.r, 0, Math.PI * 2); g.clip();
      // Fondo del plato (lo que se ve por la herida del corte)
      g.fillStyle = '#0a2230';
      g.fillRect(P.cx - P.r, P.cy - P.r, P.r * 2, P.r * 2);
      g.imageSmoothingEnabled = true;
      g.filter = 'blur(1.2px)';
      g.drawImage(off, 0, 0, fw * S, fh * S);
      g.filter = 'none';
      // Volumen: brillo arriba a la izquierda y sombra interior en el borde.
      const brillo = g.createRadialGradient(P.cx - P.r * 0.38, P.cy - P.r * 0.42, 0, P.cx - P.r * 0.38, P.cy - P.r * 0.42, P.r * 0.75);
      brillo.addColorStop(0, 'rgba(255,255,255,0.28)'); brillo.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = brillo;
      g.fillRect(P.cx - P.r, P.cy - P.r, P.r * 2, P.r * 2);
      const borde = g.createRadialGradient(P.cx, P.cy, P.r * 0.7, P.cx, P.cy, P.r);
      borde.addColorStop(0, 'rgba(0,0,0,0)'); borde.addColorStop(1, 'rgba(0,10,20,0.35)');
      g.fillStyle = borde;
      g.fillRect(P.cx - P.r, P.cy - P.r, P.r * 2, P.r * 2);
      // Estela del dedo, solo dentro de la gota
      for (let i = estelas.length - 1; i >= 0; i--) {
        const s = estelas[i];
        s.vida -= dt * 2;
        if (s.vida <= 0) { estelas.splice(i, 1); continue; }
        g.strokeStyle = `rgba(255, 255, 255, ${s.vida * 0.25})`;
        g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(s.ax, s.ay); g.lineTo(s.bx, s.by); g.stroke();
      }
      g.restore();

      // Borde de cristal
      g.strokeStyle = 'rgba(170, 220, 235, 0.25)';
      g.lineWidth = 5;
      g.beginPath(); g.arc(P.cx, P.cy, P.r + 2, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      g.lineWidth = 1.5;
      g.beginPath(); g.arc(P.cx, P.cy, P.r + 1, Math.PI * 1.05, Math.PI * 1.45); g.stroke();
    });

  },
});
