// Núcleo de Remanso: registro de mecánicas, navegación, check-in de ánimo y progreso.
//
// Para añadir una mecánica nueva: crear js/mecanicas/<id>.js con
//   Remanso.registrar({
//     id, nombre, desc, icono, fondo,      // fondo = CSS de la tarjeta
//     ancha: false,                         // true = ocupa las dos columnas
//     iniciar(escenario, util) { ...; return () => { /* limpiar */ }; }
//   });
// y añadir su <script> en index.html. `util` trae lienzo(), bucle(), controles() y rotulo().
const Remanso = (() => {
  const mecanicas = [];
  const CLAVE = 'remanso.v1';
  // Del más tenso (rojo apagado) al más tranquilo (verde agua).
  const ANIMOS = [
    { color: '#c96a6a', txt: 'Muy tenso' },
    { color: '#d29a6a', txt: 'Inquieto' },
    { color: '#c9c27a', txt: 'Regular' },
    { color: '#8fc49a', txt: 'Tranquilo' },
    { color: '#7fd3c4', txt: 'En calma' },
  ];

  let datos = cargar();
  let sesion = null;

  function cargar() {
    try {
      const d = JSON.parse(localStorage.getItem(CLAVE));
      if (d) return d;
    } catch (e) { /* datos dañados: empezar de cero */ }
    return { segundos: 0, historial: [], ajustes: { sonido: true, vibracion: true }, usos: {} };
  }
  function guardar() {
    try { localStorage.setItem(CLAVE, JSON.stringify(datos)); } catch (e) { /* sin espacio */ }
  }

  const $ = id => document.getElementById(id);

  function registrar(m) { mecanicas.push(m); }

  // ---------- utilidades para las mecánicas ----------
  function crearUtil(escenario) {
    const limpiezas = [];
    return {
      // Canvas a pantalla completa con densidad de píxeles correcta.
      lienzo() {
        const cv = document.createElement('canvas');
        escenario.appendChild(cv);
        const g = cv.getContext('2d');
        const L = { cv, g, w: 0, h: 0, dpr: 1 };
        const ajustar = () => {
          L.dpr = Math.min(window.devicePixelRatio || 1, 2);
          L.w = escenario.clientWidth;
          L.h = escenario.clientHeight;
          cv.width = Math.round(L.w * L.dpr);
          cv.height = Math.round(L.h * L.dpr);
          g.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
          if (L.alAjustar) L.alAjustar();
        };
        ajustar();
        window.addEventListener('resize', ajustar);
        limpiezas.push(() => window.removeEventListener('resize', ajustar));
        return L;
      },
      // requestAnimationFrame con dt en segundos (limitado para no dar saltos).
      bucle(fn) {
        let ultimo = performance.now(), id = 0, vivo = true;
        const paso = t => {
          if (!vivo) return;
          const dt = Math.min((t - ultimo) / 1000, 0.05);
          ultimo = t;
          fn(dt, t / 1000);
          id = requestAnimationFrame(paso);
        };
        id = requestAnimationFrame(paso);
        limpiezas.push(() => { vivo = false; cancelAnimationFrame(id); });
      },
      // Fila de chips abajo; opciones = [{txt, on, alTocar}]
      controles(opciones) {
        const cont = document.createElement('div');
        cont.className = 'controles';
        const botones = opciones.map(op => {
          const b = document.createElement('button');
          b.className = 'chip' + (op.on ? ' on' : '');
          b.textContent = op.txt;
          b.addEventListener('pointerdown', e => e.stopPropagation());
          b.addEventListener('click', e => {
            e.stopPropagation();
            op.alTocar(b, botones);
          });
          cont.appendChild(b);
          return b;
        });
        escenario.appendChild(cont);
        return botones;
      },
      rotulo(estilo = '') {
        const r = document.createElement('div');
        r.className = 'rotulo';
        r.style.cssText = estilo;
        escenario.appendChild(r);
        return r;
      },
      alLimpiar(fn) { limpiezas.push(fn); },
      _limpiar() { limpiezas.splice(0).reverse().forEach(f => { try { f(); } catch (e) {} }); },
    };
  }

  // ---------- navegación ----------
  function abrir(m) {
    FX.audio(); // desbloquea el audio con el gesto del usuario
    const escenario = $('escenario');
    escenario.innerHTML = '';
    const util = crearUtil(escenario);
    $('sesionTitulo').textContent = m.nombre;
    $('sesionTitulo').style.opacity = 1;
    setTimeout(() => { $('sesionTitulo').style.opacity = 0; }, 2500);
    $('inicio').classList.remove('activa');
    $('sesion').classList.add('activa');
    const detener = m.iniciar(escenario, util) || (() => {});
    sesion = { m, util, detener, inicio: Date.now(), animoAntes: animoActual };
    history.pushState({ sesion: true }, '');
  }

  function cerrar(desdeHistorial) {
    if (!sesion) return;
    const s = sesion;
    sesion = null;
    try { s.detener(); } catch (e) {}
    s.util._limpiar();
    const seg = Math.round((Date.now() - s.inicio) / 1000);
    datos.segundos += seg;
    datos.usos[s.m.id] = (datos.usos[s.m.id] || 0) + 1;
    guardar();
    $('sesion').classList.remove('activa');
    $('inicio').classList.add('activa');
    // Vaciar tras el fundido, salvo que ya se haya abierto otra mecánica.
    setTimeout(() => { if (!sesion) $('escenario').innerHTML = ''; }, 600);
    pintarProgreso();
    if (!desdeHistorial) history.back();
    // Solo preguntamos si la sesión fue lo bastante larga como para notar cambio.
    if (seg >= 30) pedirCierre(s, seg);
  }

  // ---------- ánimo ----------
  let animoActual = null;

  function pintarEscala(cont, alElegir) {
    cont.innerHTML = '';
    ANIMOS.forEach((a, i) => {
      const b = document.createElement('button');
      b.style.background = a.color;
      b.setAttribute('aria-label', a.txt);
      b.addEventListener('click', () => {
        [...cont.children].forEach(x => x.classList.remove('sel'));
        b.classList.add('sel');
        FX.vibrar('ligera');
        alElegir(i);
      });
      cont.appendChild(b);
    });
  }

  function pedirCierre(s, seg) {
    const nota = $('cierreNota');
    nota.textContent = `${Math.max(1, Math.round(seg / 60))} min contigo mismo. Bien hecho.`;
    pintarEscala($('escalaCierre'), i => {
      datos.historial.push({ t: Date.now(), mec: s.m.id, seg, antes: s.animoAntes, despues: i });
      if (datos.historial.length > 500) datos.historial.shift();
      guardar();
      animoActual = i;
      marcarInicio(i);
      if (s.animoAntes != null && i > s.animoAntes) nota.textContent = `Llegaste "${ANIMOS[s.animoAntes].txt.toLowerCase()}" y ahora estás "${ANIMOS[i].txt.toLowerCase()}".`;
      else if (s.animoAntes != null && i === s.animoAntes) nota.textContent = 'A veces lo importante es haber parado un momento.';
      else nota.textContent = 'Gracias por contarlo.';
    });
    $('modalCierre').classList.add('abierto');
  }

  function marcarInicio(i) {
    const cont = $('escalaInicio');
    [...cont.children].forEach((x, j) => x.classList.toggle('sel', j === i));
    $('checkinNota').textContent = ANIMOS[i].txt;
  }

  // ---------- pantalla de inicio ----------
  function pintarRejilla() {
    const rej = $('rejilla');
    rej.innerHTML = '';
    mecanicas.forEach(m => {
      const b = document.createElement('button');
      b.className = 'tarjeta' + (m.ancha ? ' ancha' : '');
      b.style.background = m.fondo;
      b.innerHTML = `<span class="icono">${m.icono}</span><span class="nombre">${m.nombre}</span><span class="desc">${m.desc}</span>`;
      b.addEventListener('click', () => { FX.vibrar('ligera'); abrir(m); });
      rej.appendChild(b);
    });
  }

  function pintarProgreso() {
    $('minutosCalma').textContent = Math.floor(datos.segundos / 60);
  }

  function pintarAjustes() {
    FX.ajustes.sonido = datos.ajustes.sonido;
    FX.ajustes.vibracion = datos.ajustes.vibracion;
    $('btnSonido').classList.toggle('on', datos.ajustes.sonido);
    $('btnVibracion').classList.toggle('on', datos.ajustes.vibracion);
  }

  function saludo() {
    const h = new Date().getHours();
    $('saludo').textContent = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  }

  function iniciar() {
    saludo();
    pintarRejilla();
    pintarProgreso();
    pintarAjustes();
    pintarEscala($('escalaInicio'), i => {
      animoActual = i;
      $('checkinNota').textContent = i <= 1 ? `${ANIMOS[i].txt}. Elige lo que te llame, sin prisa.` : ANIMOS[i].txt;
    });

    $('btnVolver').addEventListener('click', () => cerrar(false));
    // Botón atrás de Android (Capacitor lo traduce a historial).
    window.addEventListener('popstate', () => {
      if ($('modalAyuda').classList.contains('abierto')) { $('modalAyuda').classList.remove('abierto'); return; }
      if (sesion) cerrar(true);
    });
    $('btnSonido').addEventListener('click', () => { datos.ajustes.sonido = !datos.ajustes.sonido; guardar(); pintarAjustes(); });
    $('btnVibracion').addEventListener('click', () => {
      datos.ajustes.vibracion = !datos.ajustes.vibracion; guardar(); pintarAjustes(); FX.vibrar('media');
    });
    $('btnCerrarModal').addEventListener('click', () => $('modalCierre').classList.remove('abierto'));
    $('btnAyuda').addEventListener('click', () => $('modalAyuda').classList.add('abierto'));
    $('btnCerrarAyuda').addEventListener('click', () => $('modalAyuda').classList.remove('abierto'));

    // Si la app pasa a segundo plano durante una sesión, se cierra limpia.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && FX.audio()) FX.audio().suspend();
      else if (!document.hidden && sesion && FX.audio()) FX.audio().resume();
    });
  }

  return { registrar, iniciar, ANIMOS };
})();
