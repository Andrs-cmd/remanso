// Liquid Ether: fluido real (Navier-Stokes estable en GPU) donde el color sale
// de la velocidad del fluido, como el Liquid Ether del portafolio. Si nadie
// toca, un "dedo fantasma" lo mueve solo; al tocar, el usuario toma el mando.
Remanso.registrar({
  id: 'eter',
  nombre: 'Liquid Ether',
  desc: 'Agita un fluido de luz con los dedos.',
  icono: '✺',
  fondo: 'linear-gradient(150deg, #5227ff, #7b00cc 45%, #2a0a4a)',

  iniciar(esc, util) {
    const L = util.lienzo('webgl');
    const gl = L.cv.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false });
    const aviso = util.rotulo('top: 45%; font-size: 15px; color: rgba(255,255,255,.6); padding: 0 30px;');
    if (!gl || !(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'))) {
      aviso.textContent = 'Este teléfono no soporta el efecto de fluido.';
      return;
    }
    gl.getExtension('OES_texture_float_linear');

    const PALETAS = {
      'Éter': ['#0a0014', '#7b00cc', '#c026d3', '#60a5fa', '#ffffff'],
      'Violeta': ['#1a0b3d', '#5227ff', '#b19eef', '#ff9ffc'],
      'Océano': ['#001a2c', '#0077b6', '#00b4d8', '#90e0ef', '#ffffff'],
      'Aurora': ['#03140f', '#0b6e4f', '#40c9a2', '#a3f7bf', '#fff3b0'],
      'Ocaso': ['#1a0505', '#7a1f3d', '#e0603a', '#f4a259', '#fff1d0'],
    };

    // ---- shaders ----
    const VS = `#version 300 es
      in vec2 aPos; out vec2 vUv;
      void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;
    const cab = '#version 300 es\nprecision highp float; in vec2 vUv; out vec4 o;\n';
    const FS = {
      advectar: cab + `uniform sampler2D uVel; uniform vec2 uTexel; uniform float uDt, uDis;
        void main() {
          vec2 v = texture(uVel, vUv).xy;
          o = vec4(texture(uVel, vUv - uDt * v * uTexel).xy * uDis, 0.0, 1.0);
        }`,
      impulso: cab + `uniform sampler2D uVel; uniform vec2 uPunto, uFuerza; uniform float uRadio, uAspecto, uMax;
        void main() {
          vec2 d = vUv - uPunto; d.x *= uAspecto;
          float f = exp(-dot(d, d) / uRadio);
          vec2 v = texture(uVel, vUv).xy + uFuerza * f;
          float l = length(v);
          if (l > uMax) v *= uMax / l;   // tope: nunca se quema en blanco
          o = vec4(v, 0.0, 1.0);
        }`,
      divergencia: cab + `uniform sampler2D uVel; uniform vec2 uTexel;
        void main() {
          float l = texture(uVel, vUv - vec2(uTexel.x, 0.0)).x;
          float r = texture(uVel, vUv + vec2(uTexel.x, 0.0)).x;
          float b = texture(uVel, vUv - vec2(0.0, uTexel.y)).y;
          float t = texture(uVel, vUv + vec2(0.0, uTexel.y)).y;
          o = vec4(0.5 * (r - l + t - b), 0.0, 0.0, 1.0);
        }`,
      presion: cab + `uniform sampler2D uP, uDiv; uniform vec2 uTexel;
        void main() {
          float l = texture(uP, vUv - vec2(uTexel.x, 0.0)).x;
          float r = texture(uP, vUv + vec2(uTexel.x, 0.0)).x;
          float b = texture(uP, vUv - vec2(0.0, uTexel.y)).x;
          float t = texture(uP, vUv + vec2(0.0, uTexel.y)).x;
          o = vec4((l + r + b + t - texture(uDiv, vUv).x) * 0.25, 0.0, 0.0, 1.0);
        }`,
      gradiente: cab + `uniform sampler2D uP, uVel; uniform vec2 uTexel;
        void main() {
          float l = texture(uP, vUv - vec2(uTexel.x, 0.0)).x;
          float r = texture(uP, vUv + vec2(uTexel.x, 0.0)).x;
          float b = texture(uP, vUv - vec2(0.0, uTexel.y)).x;
          float t = texture(uP, vUv + vec2(0.0, uTexel.y)).x;
          o = vec4(texture(uVel, vUv).xy - 0.5 * vec2(r - l, t - b), 0.0, 1.0);
        }`,
      // Rotacional del campo (para reforzar los remolinos).
      rotacional: cab + `uniform sampler2D uVel; uniform vec2 uTexel;
        void main() {
          float l = texture(uVel, vUv - vec2(uTexel.x, 0.0)).y;
          float r = texture(uVel, vUv + vec2(uTexel.x, 0.0)).y;
          float b = texture(uVel, vUv - vec2(0.0, uTexel.y)).x;
          float t = texture(uVel, vUv + vec2(0.0, uTexel.y)).x;
          o = vec4(0.5 * (r - l - t + b), 0.0, 0.0, 1.0);
        }`,
      // Confinamiento de vorticidad: devuelve el detalle que la simulación pierde.
      vorticidad: cab + `uniform sampler2D uVel, uRot; uniform vec2 uTexel; uniform float uFuerza, uDt;
        void main() {
          float l = abs(texture(uRot, vUv - vec2(uTexel.x, 0.0)).x);
          float r = abs(texture(uRot, vUv + vec2(uTexel.x, 0.0)).x);
          float b = abs(texture(uRot, vUv - vec2(0.0, uTexel.y)).x);
          float t = abs(texture(uRot, vUv + vec2(0.0, uTexel.y)).x);
          float c = texture(uRot, vUv).x;
          vec2 f = 0.5 * vec2(t - b, r - l);
          f /= length(f) + 1e-4;
          f *= uFuerza * c;
          f.y *= -1.0;
          o = vec4(texture(uVel, vUv).xy + f * uDt, 0.0, 1.0);
        }`,
      escalar: cab + `uniform sampler2D uP; uniform float uK;
        void main() { o = vec4(texture(uP, vUv).x * uK, 0.0, 0.0, 1.0); }`,
      pintar: cab + `uniform sampler2D uVel, uPal; uniform float uEscala; uniform vec3 uFondo;
        void main() {
          // Curva suave: el blanco final solo se roza con movimientos fuertes.
          float l = 1.0 - exp(-length(texture(uVel, vUv).xy) * uEscala);
          vec3 c = texture(uPal, vec2(l, 0.5)).rgb;
          o = vec4(mix(uFondo, c, smoothstep(0.0, 0.85, l)), 1.0);
        }`,
    };

    function compilar(tipo, src) {
      const s = gl.createShader(tipo);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    }
    const vs = compilar(gl.VERTEX_SHADER, VS);
    const prog = {};
    for (const [n, src] of Object.entries(FS)) {
      const p = gl.createProgram();
      gl.attachShader(p, vs);
      gl.attachShader(p, compilar(gl.FRAGMENT_SHADER, src));
      gl.bindAttribLocation(p, 0, 'aPos');
      gl.linkProgram(p);
      const u = {};
      const n2 = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n2; i++) { const nom = gl.getActiveUniform(p, i).name; u[nom] = gl.getUniformLocation(p, nom); }
      prog[n] = { p, u };
    }

    // Triángulo que cubre toda la pantalla.
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    function textura(w, h) {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
      const f = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return { t, f };
    }
    function doble(w, h) {
      let a = textura(w, h), b = textura(w, h);
      return { get leer() { return a; }, get escribir() { return b; }, cambiar() { [a, b] = [b, a]; } };
    }

    let sw, sh, vel, pres, div, rot;
    function prepararSim() {
      // Resolución de simulación modesta: el efecto es suave por naturaleza.
      const corto = 128;
      if (L.w < L.h) { sw = corto; sh = Math.round(corto * L.h / L.w); }
      else { sh = corto; sw = Math.round(corto * L.w / L.h); }
      vel = doble(sw, sh); pres = doble(sw, sh); div = textura(sw, sh); rot = textura(sw, sh);
    }
    prepararSim();
    L.alAjustar = prepararSim;

    let paletaTex = gl.createTexture();
    let fondo = [0, 0, 0];
    function hex(c) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
    function usarPaleta(cols) {
      const rgb = cols.map(hex);
      const datos = new Uint8Array(256 * 4);
      for (let i = 0; i < 256; i++) {
        const x = (i / 255) * (rgb.length - 1), k = Math.min(Math.floor(x), rgb.length - 2), f = x - k;
        for (let c = 0; c < 3; c++) datos[i * 4 + c] = rgb[k][c] + (rgb[k + 1][c] - rgb[k][c]) * f;
        datos[i * 4 + 3] = 255;
      }
      gl.bindTexture(gl.TEXTURE_2D, paletaTex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, datos);
      fondo = rgb[0].map(v => v / 255 * 0.6);
    }
    usarPaleta(PALETAS['Éter']);

    function pasada(pr, destino, w, h, unis) {
      gl.useProgram(pr.p);
      let unidad = 0;
      for (const [n, v] of Object.entries(unis)) {
        const loc = pr.u[n];
        if (loc == null) continue;
        if (v && v.t) { gl.activeTexture(gl.TEXTURE0 + unidad); gl.bindTexture(gl.TEXTURE_2D, v.t); gl.uniform1i(loc, unidad++); }
        else if (v instanceof WebGLTexture) { gl.activeTexture(gl.TEXTURE0 + unidad); gl.bindTexture(gl.TEXTURE_2D, v); gl.uniform1i(loc, unidad++); }
        else if (typeof v === 'number') gl.uniform1f(loc, v);
        else if (v.length === 2) gl.uniform2f(loc, v[0], v[1]);
        else if (v.length === 3) gl.uniform3f(loc, v[0], v[1], v[2]);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, destino ? destino.f : null);
      gl.viewport(0, 0, w, h);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    // ---- entrada: varios dedos + dedo fantasma ----
    const FUERZA = 0.45, RADIO_PX = 42, REMOLINO = 9, TOPE = 700;
    const impulsos = [];
    const dedos = new Map();
    let ultimoToque = -10, intensidadAuto = 0;
    const viento = FX.roce({ frec: 500, q: 0.5, vol: 0.12 });
    const abajo = e => { dedos.set(e.pointerId, { x: e.offsetX, y: e.offsetY }); FX.vibrar('ligera'); };
    const mover = e => {
      const d = dedos.get(e.pointerId);
      if (!d) return;
      // Un movimiento largo se reparte en varios impulsos a lo largo del
      // recorrido, para que deje una estela continua y no manchas sueltas.
      const dx = e.offsetX - d.x, dy = e.offsetY - d.y;
      const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (RADIO_PX * 0.4)));
      for (let i = 1; i <= n; i++) {
        impulsos.push({ x: d.x + dx * i / n, y: d.y + dy * i / n, dx: dx / n, dy: dy / n, k: 1 });
      }
      d.x = e.offsetX; d.y = e.offsetY;
      ultimoToque = performance.now() / 1000;
    };
    const arriba = e => dedos.delete(e.pointerId);
    L.cv.addEventListener('pointerdown', abajo);
    L.cv.addEventListener('pointermove', mover);
    L.cv.addEventListener('pointerup', arriba);
    L.cv.addEventListener('pointercancel', arriba);

    const fantasma = { x: 0.5, y: 0.5, ox: 0.5, oy: 0.5, tx: 0.3, ty: 0.6, cambio: 0 };

    const nombres = Object.keys(PALETAS);
    util.controles(nombres.map((n, i) => ({
      txt: n, on: i === 0,
      alTocar(b, todos) { todos.forEach(x => x.classList.remove('on')); b.classList.add('on'); usarPaleta(PALETAS[n]); FX.vibrar('ligera'); },
    })));

    util.bucle((dt, t) => {
      const texel = [1 / sw, 1 / sh];
      const aspecto = L.w / L.h;

      // Dedo fantasma cuando nadie toca (retoma 1.5 s después del último toque).
      const quieto = dedos.size === 0 && t - ultimoToque > 1.5;
      intensidadAuto += ((quieto ? 1 : 0) - intensidadAuto) * Math.min(1, dt * 1.5);
      if (intensidadAuto > 0.01) {
        if (t > fantasma.cambio || Math.hypot(fantasma.tx - fantasma.x, fantasma.ty - fantasma.y) < 0.05) {
          fantasma.tx = 0.15 + Math.random() * 0.7; fantasma.ty = 0.15 + Math.random() * 0.7;
          fantasma.cambio = t + 3;
        }
        fantasma.ox = fantasma.x; fantasma.oy = fantasma.y;
        const dx = fantasma.tx - fantasma.x, dy = fantasma.ty - fantasma.y, dl = Math.hypot(dx, dy) || 1;
        const paso = Math.min(dl, 0.35 * dt);
        fantasma.x += dx / dl * paso; fantasma.y += dy / dl * paso;
        impulsos.push({ x: fantasma.x * L.w, y: fantasma.y * L.h, dx: (fantasma.x - fantasma.ox) * L.w * 1.1, dy: (fantasma.y - fantasma.oy) * L.h * 1.1, k: intensidadAuto });
      }

      // Impulsos de los dedos
      let movimiento = 0;
      for (const im of impulsos.splice(0)) {
        let fx = (im.dx / L.w) * sw / Math.max(dt, 1 / 120) * FUERZA * im.k;
        let fy = -(im.dy / L.h) * sh / Math.max(dt, 1 / 120) * FUERZA * im.k;
        // Un gesto brusco no debe quemar la imagen en blanco.
        const fl = Math.hypot(fx, fy);
        if (fl > TOPE) { fx *= TOPE / fl; fy *= TOPE / fl; }
        if (im.k === 1) movimiento += Math.hypot(im.dx, im.dy);
        pasada(prog.impulso, vel.escribir, sw, sh, {
          uVel: vel.leer, uPunto: [im.x / L.w, 1 - im.y / L.h], uFuerza: [fx, fy],
          uRadio: Math.pow(RADIO_PX / L.h, 2), uAspecto: aspecto, uMax: 420,
        });
        vel.cambiar();
      }
      viento.nivel(Math.min(movimiento / 40, 1));

      pasada(prog.rotacional, rot, sw, sh, { uVel: vel.leer, uTexel: texel });
      pasada(prog.vorticidad, vel.escribir, sw, sh, { uVel: vel.leer, uRot: rot, uTexel: texel, uFuerza: REMOLINO, uDt: dt });
      vel.cambiar();
      pasada(prog.advectar, vel.escribir, sw, sh, { uVel: vel.leer, uTexel: texel, uDt: dt, uDis: 0.978 });
      vel.cambiar();
      pasada(prog.divergencia, div, sw, sh, { uVel: vel.leer, uTexel: texel });
      pasada(prog.escalar, pres.escribir, sw, sh, { uP: pres.leer, uK: 0.8 });
      pres.cambiar();
      for (let i = 0; i < 20; i++) {
        pasada(prog.presion, pres.escribir, sw, sh, { uP: pres.leer, uDiv: div, uTexel: texel });
        pres.cambiar();
      }
      pasada(prog.gradiente, vel.escribir, sw, sh, { uP: pres.leer, uVel: vel.leer, uTexel: texel });
      vel.cambiar();

      pasada(prog.pintar, null, L.cv.width, L.cv.height, { uVel: vel.leer, uPal: paletaTex, uEscala: 1 / 200, uFondo: fondo });
    });

    return () => viento.parar();
  },
});
