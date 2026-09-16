# Material de comunicación de AloVida

Dos piezas que comparten sistema de diseño, fuente de estilos y motor de render:

| Pieza | Archivo | Salida |
|---|---|---|
| **Video promocional** | `promo.html` | `promo-alovida-1080p.mp4` (86 s · 1920×1080 · 30 fps · sin audio), 720p y portada |
| **Mazo de paciente y médico** | `deck-paciente-y-medico.html` | `AloVida-modulos-paciente-medico.pdf` (15 láminas 16:9) y un PNG por lámina |

```bash
yarn start                                   # el mazo necesita la maqueta levantada
node tools/promo/generar.mjs --solo-deck     # PDF + PNG (rápido, sin ffmpeg)

brew install ffmpeg                          # una vez; sólo lo necesita el video
node tools/promo/generar.mjs --solo-video    # MP4 1080p, 720p y portada
node tools/promo/generar.mjs                 # las dos piezas
node tools/promo/generar.mjs --solo-deck --base http://localhost:4300
```

Todo sale a `artifacts/promo/`, que está en `.gitignore`.

## El mazo: capturas, no dibujos

**Las quince láminas se arman con capturas de la aplicación andando.** El generador entra al
simulador como `paciente@alovida.mock` y como `medica@alovida.mock` —cualquier contraseña no vacía
sirve— y fotografía nueve pantallas reales, ocultando el cartel flotante del modo demostración:

| Lámina | Pantalla | Cómo se llega |
|---|---|---|
| 03 | Pedir turno | «Mis citas → Agendar una cita», eligiendo profesional para que aparezcan los horarios |
| 04 | Mis citas | `/my-account/appointments` |
| 05 | Agenda del médico | `/schedule` |
| 06 | Estado del pago | menú de la columna «Pago», abierto |
| 07 | La consulta | desde la agenda, con «Continuar consulta» |
| 08 | Nuevo diagnóstico | el panel de diagnóstico de esa consulta |
| 09 | Mis resultados | `/my-account/diagnostic-results` |
| 10 | Precios y contabilidad | `/my-services` y `/administration/accounting` |
| 11-14 | Red social | muro, perfil público del directorio, chats con una conversación abierta, directorios |

Si el servidor no responde, el generador **falla diciéndolo**; no hay láminas de repuesto ni
pantallas inventadas. Las direcciones que dependen de datos —el perfil público, la consulta— se
resuelven navegando, no con identificadores escritos a mano, así que sobreviven a un cambio de
semillas.

Todo lo que se ve es la **maqueta con `mockBackend: true`**: datos de demostración, no de un
cliente. Dos detalles que conviene conocer antes de proyectarlo: el autor de las publicaciones del
muro figura como «Perfil <id>» —el simulador todavía no resuelve ese nombre— y el compositor avisa
que **no se pueden adjuntar imágenes**.

## El video

| # | Escena | Qué se ve |
|---|---|---|
| 00 | Marca | Logotipo y claim. |
| 01 | Registro | Las tres cuentas; se crea la de médico con matrícula y especialidad. |
| 02 | El paciente pide cita | Escribe su dolencia; la pieza propone especialidad, médico y turno. |
| 03 | El médico acepta y agenda | Acepta la solicitud y además crea una cita él mismo. |
| 04 | El médico atiende | Motivo, signos, diagnóstico CIE-10 y receta firmada. |
| 05 | La aseguradora resuelve | Médico, paciente y solicitud en la misma fila. |
| 06 | Cierre | Marca y los cuatro atributos. |

A diferencia del mazo, **el video sí recrea las pantallas** con el sistema de diseño
(`src/styles/alovida.css`) y el logotipo de `public/alovida/imagenes/`: es una pieza de
comunicación, no evidencia de funcionamiento.

## Cómo está hecho

`promo.html` no usa animaciones de CSS: declara pistas `{t0, t1, función}` y **cada fotograma es
función pura de `t`** (`window.__seek(t)`). El generador mueve la página fotograma a fotograma,
fotografía y encadena con ffmpeg. De ahí salen tres propiedades que importan:

- la fluidez no depende de la velocidad de la máquina;
- dos corridas dan el mismo video;
- se puede inspeccionar cualquier instante: abrí `artifacts/promo/promo.html` y ejecutá
  `__seek(42.5)` en la consola; con `promo.html?play` se reproduce en vivo y en bucle.

El mazo **hereda los estilos de `promo.html`**: el generador extrae sus bloques `<style>` a
`heredado.css` y el mazo lo enlaza. Los tokens de marca se tocan en un solo lugar. Cada lámina es un
`<section class="lamina">` de 1920×1080 con `page-break-after`, así que el mismo archivo da los PNG
(captura por elemento) y el PDF (impresión de Chromium con `@page { size: 1920px 1080px }`).

El ffmpeg que trae Playwright **no sirve** para el video: está compilado sólo con VP8/WebM
(`--disable-everything`), así que no puede escribir H.264. El mazo no lo usa.
