# H4.S1.M5 — Hallazgo real a 375px: el cartel «Datos de prueba» tapaba «Tutoriales»

**Medido, no supuesto.** `document.documentElement.scrollWidth` (364) vs `clientWidth` (360) a 375 px de
viewport en `/dashboard` con `paciente@alovida.mock` — 4 px de desborde, dentro de tolerancia de
scrollbar, no un problema en sí. Pero al revisar por qué «Tutoriales» no se veía en la captura aunque
existía en el DOM (`getBoundingClientRect()`), se confirmó la causa real:

- `[data-testid=header-tutoriales]`: `{ x: 183, y: 10, w: 35, h: 35 }`
- El botón «Datos de prueba» (`mock-banner.ts`): `{ x: 112, y: 14, w: 114, h: 29 }`

Los dos rectángulos se superponen (183–218 cae dentro de 112–226). Causa raíz: `mock-banner.ts` fija el
cartel plegado a `inset-inline-start: 112px` bajo 60rem — un offset calculado a mano para esquivar la
hamburguesa y la flecha de «Volver», **de antes de que N-01 agregara Tutoriales y Chats** a la cabecera.
Con dos íconos más a la derecha, el conjunto de la cabecera ya no deja ese hueco libre a 375 px.

**Corrección aplicada** (`mock-banner.ts`, dentro de mi alcance — `core/mock/**`): el cartel plegado baja
debajo de la cabecera completa (`inset-block-start: calc(var(--h-header, 56px) + 8px)`), el mismo lugar
donde el panel *abierto* ya vivía sin problema. Deja de perseguir un hueco fijo en píxeles que la propia
cabecera puede volver a angostar en el futuro.

**Estado de la verificación: `VERIFIED`.** El primer intento de recarga se colgó 59 s por la misma
falta de memoria de siempre en esta máquina compartida (0,93 GB libres de 15,73 GB); se esperó a que el
`Application bundle generation complete` realmente saliera y se repitió la medición:

- `header-tutoriales`: `{ x: 183, y: 10, w: 35, h: 35 }` (sin cambios)
- Badge «Datos de prueba»: `{ x: 8, y: 64, w: 114, h: 29 }` (antes `{ x: 112, y: 14, ... }`)

Ya no se superponen. Captura mirada: `evidencia/h4/capturas/paciente-dashboard-mobile-arreglado.png` —
los 6 íconos de la cabecera (hamburguesa, campana, tema, Tutoriales, Chats, Ajustes) se ven completos.
El cartel bajado queda parcialmente sobre el título «Hola, Ana Lucía…» de la pantalla, el mismo
compromiso que ya tenía el estado «abierto» del propio cartel (comentario original del componente) —
tapa contenido de página, no un control interactivo, y desaparece solo al desplegarse o cerrarse.
