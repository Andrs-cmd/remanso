// Respiración guiada con un orbe que crece y se encoge.
// Patrones con respaldo: suspiro cíclico (Balban et al., 2023), respiración
// coherente ~5.5 rpm (variabilidad cardiaca), caja (4-4-4-4) y 4-7-8.
// La exhalación más larga que la inhalación activa el sistema parasimpático.
Remanso.registrar({
  id: 'respirar',
  nombre: 'Respirar',
  desc: 'Sigue el orbe. Tu cuerpo baja el ritmo solo.',
  icono: '◯',
  fondo: 'linear-gradient(150deg, #1d4a5a, #12303d 60%, #0d2430)',
  ancha: true,

  iniciar(esc, util) {
    // fases: [nombre, segundos, tamaño objetivo 0..1]
    const PATRONES = {
      suspiro: { txt: 'Suspiro', fases: [['Inhala', 2.2, 0.8], ['Un poco más', 1.0, 1], ['Exhala lento', 6, 0]] },
      coherente: { txt: 'Coherente', fases: [['Inhala', 5.5, 1], ['Exhala', 5.5, 0]] },
      caja: { txt: 'Caja', fases: [['Inhala', 4, 1], ['Sostén', 4, 1], ['Exhala', 4, 0], ['Sostén', 4, 0]] },
      relajante: { txt: '4·7·8', fases: [['Inhala', 4, 1], ['Sostén', 7, 1], ['Exhala', 8, 0]] },
    };
    let patron = PATRONES.suspiro;
    let fase = 0, tFase = 0, desde = 0, tam = 0, ciclos = 0, pausa = false;

    const L = util.lienzo();
    const { g } = L;
    const rotulo = util.rotulo('top: 62%; font-size: 22px; font-weight: 300; letter-spacing: 1px;');
    const contador = util.rotulo('top: calc(64px + env(safe-area-inset-top)); font-size: 13px; color: rgba(255,255,255,.4);');
    const pad = FX.colchon(98);

    // Motas que orbitan y siguen la respiración.
    const motas = Array.from({ length: 70 }, () => ({
      a: Math.random() * Math.PI * 2,
      r: 0.6 + Math.random() * 0.9,
      v: (Math.random() * 0.15 + 0.05) * (Math.random() < 0.5 ? -1 : 1),
      s: Math.random() * 1.6 + 0.4,
    }));

    function entrarFase(i) {
      fase = i; tFase = 0; desde = tam;
      const [nombre] = patron.fases[fase];
      rotulo.style.opacity = 0;
      setTimeout(() => { rotulo.textContent = nombre; rotulo.style.opacity = 1; }, 180);
      FX.vibrar(nombre.startsWith('Exhala') ? 'media' : 'ligera');
      if (nombre.startsWith('Inhala')) FX.tono(FX.notaPentatonica(ciclos % 5, 196), { dur: 2.5, vol: 0.05 });
    }

    util.controles(Object.entries(PATRONES).map(([k, p]) => ({
      txt: p.txt, on: p === patron,
      alTocar(b, todos) {
        todos.forEach(x => x.classList.remove('on'));
        b.classList.add('on');
        patron = PATRONES[k];
        ciclos = 0;
        entrarFase(0);
      },
    })));

    // Tocar la pantalla pausa / reanuda.
    const alTocar = () => {
      pausa = !pausa;
      rotulo.textContent = pausa ? 'En pausa' : patron.fases[fase][0];
    };
    esc.addEventListener('pointerdown', alTocar);
    util.alLimpiar(() => esc.removeEventListener('pointerdown', alTocar));

    const suave = x => 0.5 - Math.cos(Math.PI * x) / 2;
    entrarFase(0);

    util.bucle((dt, t) => {
      if (!pausa) {
        tFase += dt;
        const [, dur, meta] = patron.fases[fase];
        tam = desde + (meta - desde) * suave(Math.min(tFase / dur, 1));
        if (tFase >= dur) {
          const sig = (fase + 1) % patron.fases.length;
          if (sig === 0) { ciclos++; contador.textContent = ciclos === 1 ? '1 respiración' : `${ciclos} respiraciones`; }
          entrarFase(sig);
        }
      }
      pad.nivel(tam);

      const { w, h } = L;
      const cx = w / 2, cy = h * 0.42;
      const base = Math.min(w, h) * 0.16;
      const radio = base * (1 + tam * 0.9);

      // Fondo que respira con el orbe.
      const fondo = g.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.8);
      fondo.addColorStop(0, `rgba(30, ${70 + tam * 30}, ${90 + tam * 30}, 1)`);
      fondo.addColorStop(1, '#050c12');
      g.fillStyle = fondo;
      g.fillRect(0, 0, w, h);

      // Halo
      const halo = g.createRadialGradient(cx, cy, radio * 0.6, cx, cy, radio * 2.2);
      halo.addColorStop(0, `rgba(127, 211, 196, ${0.18 + tam * 0.15})`);
      halo.addColorStop(1, 'rgba(127, 211, 196, 0)');
      g.fillStyle = halo;
      g.beginPath(); g.arc(cx, cy, radio * 2.2, 0, Math.PI * 2); g.fill();

      // Orbe con borde ligeramente ondulante (se siente vivo, no mecánico).
      const orbe = g.createRadialGradient(cx - radio * 0.3, cy - radio * 0.3, radio * 0.1, cx, cy, radio);
      orbe.addColorStop(0, 'rgba(225, 250, 245, 0.95)');
      orbe.addColorStop(0.5, 'rgba(127, 211, 196, 0.75)');
      orbe.addColorStop(1, 'rgba(60, 130, 150, 0.35)');
      g.fillStyle = orbe;
      g.beginPath();
      for (let i = 0; i <= 64; i++) {
        const a = (i / 64) * Math.PI * 2;
        const r = radio * (1 + 0.015 * Math.sin(a * 5 + t * 1.3) + 0.01 * Math.sin(a * 3 - t));
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.fill();

      // Anillo guía: hasta dónde llegará el orbe.
      g.strokeStyle = 'rgba(255,255,255,0.08)';
      g.lineWidth = 1;
      g.beginPath(); g.arc(cx, cy, base * 1.9, 0, Math.PI * 2); g.stroke();

      // Progreso de la fase como arco fino.
      const [, durF] = patron.fases[fase];
      g.strokeStyle = 'rgba(255,255,255,0.35)';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(cx, cy, base * 1.9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(tFase / durF, 1));
      g.stroke();

      // Motas
      g.fillStyle = 'rgba(220, 245, 240, 0.6)';
      for (const m of motas) {
        m.a += m.v * dt * (pausa ? 0.3 : 1);
        const r = radio * (1.15 + m.r * (0.6 + tam * 0.6));
        g.globalAlpha = 0.25 + 0.5 * tam * (m.s / 2);
        g.beginPath(); g.arc(cx + Math.cos(m.a) * r, cy + Math.sin(m.a) * r, m.s, 0, Math.PI * 2); g.fill();
      }
      g.globalAlpha = 1;
    });

    return () => pad.parar();
  },
});
