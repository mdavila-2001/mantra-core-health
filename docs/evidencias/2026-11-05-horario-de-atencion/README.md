# Horario de atención en el alta de organización — evidencia

Corrida del 2026-11-05, local: PostgreSQL 16 con el DDL del modelo v4.2.88 y los seeds de arranque, la API
(`node dist/src/main.js`) y el front con `ng serve --configuration real-api` (sin mock). El script es
`lab-hours.playwright.cjs`: los campos que no se prueban (razón social, representante, punto de la central y de una
sucursal) se cargan por los ganchos de desarrollo de Angular; el paso «Horario de atención» y el envío van por la
interfaz real.

| Paso | Evidencia |
|---|---|
| La plantilla precargada (L-V 08–18, sábado 08–12) | `1-hours-template.png` |
| «+ Turno de tarde» con 08–18 se superpone y la fila lo dice | `2-overlap-error.png` |
| Lunes a viernes 08–12 y 14:30–19 («Usar en todos los días abiertos»), sábado cerrado; la sucursal con horario propio, 24 h | `3-hours-edited.png` |
| Lo mismo a 390 px, sin desborde horizontal (`scrollWidthAt390: 390`) | `4-hours-mobile.png` |
| Envío por la interfaz → `POST /iam/auth/register-organization` **201**, sin errores de consola | `run.json`, `5-after-submit.png` |
| Persistencia: 10 turnos de la central y 7 de la sucursal en `directory.tenant_opening_hours` | `db-rows.txt` |

No hay todavía una pantalla que **lea** el horario guardado (ficha de la organización, directorio público): la
recarga → UI no se pudo demostrar y queda en un issue.
