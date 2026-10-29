# «Mis citas» · la cita que ya pasó no ofrece «Cancelar»

Chromium sin ventana (Playwright) contra el front de esta rama (`real-api`) y la API de `origin/dev`
(`691c1d052`) en local, con la paciente sintética `@alovida.test` de FAC-08. Zona `America/La_Paz`,
2026-10-29, por la tarde: la cita del 29/10 a las 09:00 ya terminó.

| Escenario | Qué se ve | Capturas |
|---|---|---|
| Lista, 1440 y 390 | Las tres próximas ofrecen «Cancelar»; la de «Anteriores» (29/10, confirmada y pagada) no | `cancel-past-list-{1440,390}.png` |
| Calendario, 1440 | El detalle de la cita del 29/10 no ofrece «Cancelar»; el de la del 30/10 sí | `cancel-past-calendar-{past,upcoming}-1440.png` |

`recorrido.log` es la salida literal: qué fila ofrece el botón y qué dice cada detalle.
