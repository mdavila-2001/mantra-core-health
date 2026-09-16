# Video promocional de AloVida

Pieza de motion graphics de **86 segundos, 1920×1080 a 30 fps, sin audio**, que recorre el
camino completo del producto con los tres actores:

| # | Escena | Qué se ve |
|---|---|---|
| 00 | Marca | Logotipo y claim. |
| 01 | Registro | Las tres cuentas —paciente, médico, aseguradora—; se crea la de médico con matrícula y especialidad. |
| 02 | El paciente pide cita | Escribe su dolencia, la maqueta propone especialidad, médico y turno; queda **pendiente de confirmación**. |
| 03 | El médico acepta y agenda | Acepta la solicitud (el cupo se ocupa) y además **crea una cita él mismo** desde el modal. |
| 04 | El médico atiende | Motivo, signos, diagnóstico con **CIE-10** y receta firmada; cierra la consulta. |
| 05 | La aseguradora resuelve | Tabla con **médico, paciente y solicitud** en la misma fila, panel con el detalle y **Autorizar**. |
| 06 | Cierre | Marca y los cuatro atributos. |

## Qué es y qué no es

Las pantallas están **recreadas** con el sistema de diseño de AloVida (`src/styles/alovida.css`:
petróleo `#0B557E`, aguamarina `#4FB3A9`, menta, ámbar, fondo blanco; Poppins para títulos, Inter
para interfaz) y con el logotipo de `public/alovida/imagenes/`. **No son capturas de la aplicación
en ejecución**: es una pieza de comunicación, no evidencia de funcionamiento. Para evidencia real
están Playwright y `evidencias/`.

Los datos son los personajes de la maqueta (`src/app/core/mock/fixtures/personas.ts`): Clínica Los
Olivos, Dra. Valeria Rojas, Hospital San Lucas. La aseguradora aparece **sin marca**, a propósito:
nombrar a una real en una pieza promocional insinúa un acuerdo que no existe.

## Regenerarlo

```bash
brew install ffmpeg      # una vez: hace falta libx264
node tools/promo/generar.mjs
```

Deja en `artifacts/promo/` (no versionado): `promo-alovida-1080p.mp4`, `promo-alovida-720p.mp4`
—la liviana, para WhatsApp— y `portada.png`.

El ffmpeg que trae Playwright **no sirve**: está compilado sólo con VP8/WebM (`--disable-everything`),
así que no puede escribir H.264.

## Cómo está hecho

`promo.html` no usa animaciones de CSS ni `requestAnimationFrame` para la captura: declara una lista
de pistas `{t0, t1, función}` y **cada fotograma es función pura de `t`**. El generador llama
`window.__seek(t)`, fotografía, avanza. De ahí salen tres propiedades que importan:

- la fluidez no depende de la velocidad de la máquina (nada se «salta» por ir lento);
- dos corridas dan el mismo video, byte a byte;
- se puede inspeccionar cualquier instante: abrí `artifacts/promo/promo.html` en el navegador y
  ejecutá `__seek(42.5)` en la consola. Con `promo.html?play` se reproduce en vivo y en bucle.

Para cambiar textos, tiempos o pantallas se edita `promo.html`: la línea de tiempo de cada escena
está junta, debajo del HTML de esa escena, en segundos absolutos.
