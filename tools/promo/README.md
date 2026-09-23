# Material de comunicación de AloVida

Dos piezas que comparten sistema de diseño, fuente de estilos y motor de render:

| Pieza | Archivo | Salida |
|---|---|---|
| **Video promocional** | `promo.html` | `promo-alovida-1080p.mp4` (86 s · 1920×1080 · 30 fps · sin audio), 720p y portada |
| **Mazo para aseguradoras** | `deck-aseguradoras.html` | `AloVida-para-aseguradoras.pdf` (17 láminas 16:9) y un PNG por lámina |

```bash
brew install ffmpeg                          # una vez; sólo lo necesita el video
node tools/promo/generar.mjs                 # las dos piezas
node tools/promo/generar.mjs --solo-deck     # sólo el PDF y los PNG (rápido)
node tools/promo/generar.mjs --solo-video    # sólo el MP4
```

Todo sale a `artifacts/promo/`, que está en `.gitignore`.

## El video

| # | Escena | Qué se ve |
|---|---|---|
| 00 | Marca | Logotipo y claim. |
| 01 | Registro | Las tres cuentas —paciente, médico, aseguradora—; se crea la de médico con matrícula y especialidad. |
| 02 | El paciente pide cita | Escribe su dolencia, la maqueta propone especialidad, médico y turno; queda **pendiente de confirmación**. |
| 03 | El médico acepta y agenda | Acepta la solicitud (el cupo se ocupa) y además **crea una cita él mismo**. |
| 04 | El médico atiende | Motivo, signos, diagnóstico con **CIE-10** y receta firmada. |
| 05 | La aseguradora resuelve | **Médico, paciente y solicitud** en la misma fila; panel de detalle y **Autorizar**. |
| 06 | Cierre | Marca y los cuatro atributos. |

## El mazo para aseguradoras

Diecisiete láminas pensadas para convencer a una aseguradora, no para explicar el producto en
general: el problema de recibir solicitudes sueltas, el expediente único, la anatomía de una
solicitud, la pantalla de autorización, prestadores verificados, padrón y coberturas, auditoría
inmutable, contabilidad, indicadores, seguridad, integración, **estado real del producto**, plan de
piloto en cuatro fases, modelo comercial y cierre.

Dos láminas piden atención antes de presentarla:

- **La 14 («Qué está construido y qué entra en el piloto»)** dice en voz alta qué falta del lado de
  la aseguradora —roles propios, importación del padrón real, coberturas, tablero, salida a
  liquidación—. Está a propósito: es lo que evita prometer de más en una reunión.
- **La 16 (modelo comercial)** tiene tres casillas en ámbar (`monto a completar`, `tramos a
  completar`, `contacto`) que **hay que completar** antes de presentar.

## Qué es y qué no es

Las pantallas están **recreadas** con el sistema de diseño de AloVida (`src/styles/alovida.css`:
petróleo `#0B557E`, aguamarina `#4FB3A9`, menta, ámbar, fondo blanco; Poppins para títulos, Inter
para interfaz) y con el logotipo de `public/alovida/imagenes/`. **No son capturas de la aplicación
en ejecución**: es material de comunicación, no evidencia de funcionamiento. Para evidencia real
están Playwright y `evidencias/`.

Los personajes son los de la maqueta (`src/app/core/mock/fixtures/personas.ts`): Clínica Los Olivos,
Dra. Valeria Rojas, Hospital San Lucas. La aseguradora aparece **sin marca**, a propósito: nombrar a
una real insinúa un acuerdo que no existe. Las cifras del gráfico de la lámina 11 están rotuladas
como datos de demostración.

## Cómo está hecho

`promo.html` no usa animaciones de CSS: declara pistas `{t0, t1, función}` y **cada fotograma es
función pura de `t`** (`window.__seek(t)`). El generador mueve la página fotograma a fotograma,
fotografía y encadena con ffmpeg. De ahí salen tres propiedades que importan:

- la fluidez no depende de la velocidad de la máquina;
- dos corridas dan el mismo video;
- se puede inspeccionar cualquier instante: abrí `artifacts/promo/promo.html` y ejecutá
  `__seek(42.5)` en la consola; con `promo.html?play` se reproduce en vivo y en bucle.

`deck-aseguradoras.html` **hereda los estilos de `promo.html`**: el generador extrae sus bloques
`<style>` a `heredado.css` y el mazo lo enlaza. Los tokens de marca se tocan en un solo lugar. Cada
lámina es un `<section class="lamina">` de 1920×1080 con `page-break-after`, así que el mismo archivo
da los PNG (captura por elemento) y el PDF (impresión de Chromium con `@page { size: 1920px 1080px }`).

El ffmpeg que trae Playwright **no sirve** para el video: está compilado sólo con VP8/WebM
(`--disable-everything`), así que no puede escribir H.264. El mazo no lo usa.
