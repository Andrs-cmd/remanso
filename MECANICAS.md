# Remanso — catálogo de mecánicas

Estado: ✅ hecha · ⬜ candidata

## Cómo funciona una mecánica
Cada mecánica es un archivo en `www/js/mecanicas/<id>.js` que llama a `Remanso.registrar({...})`
y se añade con un `<script>` en `www/index.html`. Recibe `util` con: `lienzo()`, `bucle()`,
`controles()`, `rotulo()`, `alLimpiar()`. Sonido y vibración en `FX` (`www/js/fx.js`).

## Por qué funcionan (principios)
1. **Exhalar más largo que inhalar** activa el sistema parasimpático y baja el pulso.
2. **Tareas visoespaciales** (formas, colores, encajar piezas) ocupan la misma "memoria de trabajo"
   que la rumiación ansiosa: la mente no puede hacer las dos cosas a la vez (Holmes et al., Tetris).
3. **Acción → respuesta inmediata** (toque → sonido + vibración + partícula) da sensación de control,
   que es justo lo que la ansiedad quita.
4. **Ritmo lento y predecible**: animaciones suaves, sin sorpresas bruscas, sin tiempo límite.
5. **Atención al presente por los sentidos** (grounding): nombrar lo que se ve, oye o toca.
6. **Sin castigo**: no se pierde, no hay errores, no hay contador que presione.

## Retener la atención sin volverse adictiva
- Flujo: la mecánica se adapta (más lenta si el usuario va rápido) en vez de exigir.
- Variedad sutil: cambia el color/hoja/sonido en cada ciclo para que no aburra.
- Progreso suave: "minutos de calma" y un antes/después de ánimo, no rachas que generen culpa.
- Cierre natural: tras ~5–10 min sugerir terminar, no enganchar indefinidamente.
- Ayuda real a un toque (líneas 106 / 192 op. 4 / 123).

## Mecánicas
| # | Mecánica | Tipo | Estado |
|---|----------|------|--------|
| 1 | Respirar (suspiro cíclico, coherente, caja, 4-7-8) | Respiración | ✅ |
| 2 | Burbujas infinitas | Táctil / descarga | ✅ |
| 3 | Luz líquida (estelas + notas pentatónicas) | Visual / sonoro | ✅ |
| 4 | Jardín zen: rastrillar arena, colocar piedras | Visual lento | ✅ |
| 5 | Mandala simétrico (dibujar con espejo radial) | Visoespacial | ⬜ |
| 6 | Colorear por zonas (relleno con un toque) | Visoespacial | ⬜ |
| 7 | 5-4-3-2-1 grounding guiado con la cámara o por pasos | Atención plena | ⬜ |
| 8 | Estímulo bilateral: punto que va de lado a lado + vibración alterna | Regulación | ⬜ |
| 9 | Slime / arena cinética deformable (física blanda) | Táctil | ⬜ |
| 10 | Ordenar objetos por color/forma (orden = alivio) | Visoespacial | ⬜ |
| 11 | Relajación muscular progresiva guiada con vibración | Cuerpo | ⬜ |
| 12 | Lluvia en la ventana: limpiar el vapor con el dedo | Visual / sonoro | ⬜ |
| 13 | Soltar preocupaciones: escribirla y verla disolverse | Cognitivo | ⬜ |
| 14 | Lámpara de lava / fluido que se mueve con el inclinómetro | Contemplativo | ⬜ |
| 15 | Fidget: interruptores, ruedas, deslizadores con clic háptico | Táctil | ⬜ |
| 16 | Estanque: ondas en el agua y peces que se acercan si tocas lento | Visual | ⬜ |
| 17 | Gota líquida: bola en plato a su medida; el corte la divide y se cierra, marmoleado de colores | Táctil / visual | ✅ |
| 18 | Liquid Ether: fluido de luz (Navier-Stokes en GPU), paletas del portafolio | Visual / contemplativo | ✅ |
| 19 | Unir puntos: 10 figuras (estrella, corazón, luna, flor…), progreso guardado | Visoespacial | ✅ |
