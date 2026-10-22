# Formulario médico: pestañas «Plantilla» y «Flexible» (28/09/2026)

Pedido: un botón para ver el formulario fijo de la plantilla o el formulario
flexible (filas «campo: valor» con archivos).

## Qué cambió

- `specialty-form-block`: la ficha se divide en dos pestañas de `app-tabs`
  (composition-rules §5): **Plantilla** (los campos fijos) y **Flexible**
  (`app-additional-fields`). Captura y lectura usan las mismas pestañas, en el
  mismo orden, con el índice compartido. Al pasar a lectura vuelve a
  «Plantilla».
- La pestaña cerrada no se dibuja, pero lo proyectado lo instancia el bloque:
  lo escrito en «Flexible» se conserva y se completa desde cualquiera de las
  dos con el mismo botón.
- «Flexible (n)» cuenta filas con contenido + texto libre: el mismo número
  antes y después de guardar.
- Si el botón está gris por algo de la otra pestaña, el motivo va dentro de
  `app-form-actions` (`role="status"`).
- Lectura: título visible, estados buscando / error con ID de petición /
  vacío. Antes el error de `GET /charts/patients/:id/chart` se tragaba.
- Sin «medida de formulario»: se quitó `max-inline-size: 40rem`.
- Sin ningún valor en la plantilla el botón queda gris (antes quedaba
  habilitado y el clic no mandaba nada); si hay algo en «Flexible», lo dice:
  «Completá al menos un campo de «Plantilla».».
- La lectura de las notas trata como fallo todo lo que no sea «buscando» ni
  «listo» (404 y 429 incluidos): nunca un «no se agregaron» falso.

## Sobre `mockup`

Rama `justin/formulario-pestanas`, desde `origin/mockup`. Convive con el
«Formulario libre — campo y valor» del PR #768:

- **Formulario libre** (entrada propia del selector): lo flexible solo, sin
  plantilla, con su propio «Guardar formulario».
- **Pestañas** (con una plantilla de `forms` elegida): «Plantilla» y
  «Flexible» dentro de la misma ficha, un solo «Completar formulario».
- El cierre D4 (diagnóstico tentativo y orden sugeridos por la IA) va
  después de las pestañas: es de la ficha entera.
- La lectura de notas usa `GET /charts/notes` con filas estructuradas, como
  en `mockup`, ahora con estados buscando / error / vacío.

## Evidencia (Playwright contra `ng serve` con el simulador, movimiento reducido)

| Archivo | Qué muestra |
|---|---|
| `plantilla-{1440,768,390}.png` | pestaña «Plantilla» |
| `flexible-{1440,768,390}.png` | «Flexible (1)» con una fila a medio escribir; el motivo junto al botón (encima, a 390) |
| `teclado-{1440,768,390}.png` | foco en «Plantilla» tras ← + Enter |
| `corregir-flexible-{1440,768,390}.png` | desde «Plantilla»: «Corregí una fila de «Flexible».» |
| `lectura-plantilla-{1440,768,390}.png` | lectura, abre en «Plantilla» |
| `lectura-flexible-vacio-{1440,768,390}.png` | lectura sin nada flexible: lo dice |
| `e2e-3a-pestana-plantilla.png` | el e2e tras contestar la ficha |
| `e2e-3b-plantilla-con-flexible-pendiente.png` | de vuelta en «Plantilla» con «Flexible (3)» cargado |
| `e2e-4a-lectura-plantilla.png` | lectura del e2e, en «Plantilla» |
| `e2e-4b-lectura-flexible.png` | lectura, «Flexible (3)» con nota y adjunto releídos (tomada sobre `dev`) |

Medidas (borde derecho de la tira / del formulario / de la tarjeta, en px):
1440 → 1074 / 1074 / 1099; 768 → 657 / 657 / 682; 390 → 329 / 329 / 354.
Ningún rótulo de pestaña con `scrollWidth > clientWidth`; sin scroll
horizontal de página. El motivo mide un renglón (17 px) en los tres anchos.

Buscando y error con ID de petición de la lectura: sólo en pruebas unitarias
(el simulador vive en el navegador y no deja forzar el fallo).

## Deuda de primitivas (no se tocó acá)

- `app-tabs`: el anillo de foco se recorta arriba y a la izquierda
  (`overflow-x: auto` de `.tabs__list`); el hover le gana a `.is-selected`.
- `app-form-actions` fija (< 780 px) dentro del modal: asoma contenido debajo
  de la barra.

`playwright/consulta-formulario-medico.spec.ts` recorre el circuito completo:
completa desde «Plantilla» con lo flexible cargado → nota y documento en el
simulador → relectura en modo lectura.
