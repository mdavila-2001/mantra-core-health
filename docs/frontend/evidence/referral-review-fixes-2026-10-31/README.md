# Evidencia — correcciones de la revisión de «Derivar»

Revisión independiente de la casilla «Derivar» de
`/medical-records/:profileId/consultation` (PR #1584 y #1585, ya mergeados):
hallazgos de código (H1, M2–M6, L7, L8) y visuales (a 390 px puntuaba 75/100),
y la segunda ronda (89/100): textos que no prometen el aviso, avisos del mock
literales de la API, `queryCleared`, selector a 360/390, S7 con latencia,
relectura fallida, campana `ORGANIZATION_PROFILE`, NG0955 y el 403 de sedes;
y la tercera (91/100): relectura fallida sin filas, foco tras «Reintentar»,
cifra «al menos N», textos unificados y el botón apagado que dice qué falta;
y la final (93/100): «Código de soporte» con copiar en un solo componente
(`app-support-code`, también en `view-state-host`), S9 de la lista que no
culpa al envío, anillo de foco del título y resumen de un externo.

- Fecha: 2026-10-31 · Rama: `claude/sleepy-bardeen-m8dn2i`, ya con `origin/dev`
  integrado (`dafaa2974`, el formulario en dos pestañas «Derivación» y
  «Traslado»): las capturas son de ese estado
- Modo: **maqueta** (`yarn start:demo --port 4321`, `mockBackend: true`) · Chromium headless · cuenta `medica@alovida.mock`
- Persona: Ana Lucía Pérez Quiroga, **sintética** (fixture de la maqueta)
- Script: [`referral-review-evidence.cjs`](./referral-review-evidence.cjs) —
  `node referral-review-evidence.cjs http://localhost:4321 <salida>` (con
  `PW_CHROMIUM=<ruta>` si hace falta). Un solo navegador, capturas en serie;
  **no espera `networkidle`**, espera selectores.
- Resultado: [`run-log.json`](./run-log.json) y [`run-output.txt`](./run-output.txt) —
  **56/56 aserciones**, 0 `pageerror`. El reloj de la página se controla
  (`page.clock`) para dejar quieta la relectura y fotografiar S7.

## Qué demuestra

| Hallazgo | Aserción / medida | Captura |
|---|---|---|
| HIGH — el resultado del envío a 390 | éxito, 409 y error **dentro del viewport** tras enviar (top 473–486, bottom 583–595 de 844) y el foco en `referral-outcome` | `06-submit-success-390.png`, `07-submit-409-390.png`, `08-submit-error-390.png` |
| 1a/1b — textos sin promesa | botón «Derivar» (y «Registrar la derivación» con un externo); los tres éxitos con título «Derivación registrada»: organización «Quedó registrada la derivación a Hospital San Lucas. Si la persona tiene cuenta en el portal, puede recibir un aviso; la ve en su lista de derivaciones.»; profesional «… puede recibir un aviso para ver la ficha y reservar.»; externo, «no recibe aviso» | `06-submit-success-390.png`, `08b-submit-success-practitioner-390.png`, `08c-submit-success-external-390.png` |
| 1c/1d — pista del motivo y bajada | pista por clase de destino; la bajada del modal es neutral: «La derivación queda registrada en su historia» | `08b-…`, `08c-…`, `08-submit-error-390.png` |
| 4 — selector a 360 y 390 | los tres rótulos enteros (`scrollWidth <= clientWidth`): las pastillas pasan a una segunda fila (`wrap`) | `04b-kind-390.png`, `04c-kind-360.png` |
| L-2 — S7 al releer | «Actualizando · lista de las HH:MM» con la lista a la vista (relectura detenida con el reloj) | `08d-list-s7-refreshing-390.png` |
| L-4 — relectura fallida | la lista sigue; el fallo se dice en línea con «Reintentar»; la casilla dice «al menos N derivaciones» con tono de aviso | `08e-list-refresh-error-390.png` |
| Ronda 3 · 2 — foco tras «Reintentar» | el foco queda en el título de la lista (`tabindex="-1"`), dentro del diálogo | `08f-list-retry-focus-390.png` |
| Final · 3 — código de soporte | el mismo `app-support-code` (código sin cortes y «Copiar código») en el aviso de relectura, en el S9 de la lista y en `view-state-host` | `08e-list-refresh-error-390.png`, `15-list-s9-390.png`, `16-view-state-host-s9-390.png` |
| Final · 4 — S9 de la lista | «No pudimos cargar la lista»; tras derivar, «La derivación se registró, pero no pudimos cargar la lista.» (prueba unitaria) | `15-list-s9-390.png` |
| Final · 5 — anillo de foco del título | 2 px sólido con offset, como `.paginated-form__titulo` (con teclado) | `08f-list-retry-focus-390.png` |
| Final · 6 — resumen de un externo | «Revise antes de registrar», con viñetas | `08g-external-issues-390.png` |
| Ronda 3 · 8 — botón apagado | «Para derivar, elija el destino.» junto al botón, con `aria-describedby` | `04-service-pending-390.png` |
| L-3 — campana | la persona recibe «Su médico le derivó a Hospital San Lucas…» (texto de la API), el aviso es un botón y abre `/o/hospital-san-lucas` | `13-bell-organization-1440.png`, `14-bell-opens-organization-1440.png` |
| 13 — consola | sin `NG0955` y sin el 403 de `GET /tenants/:id/branches` | `run-log.json` |
| M5 — 404 sin sub-código | «El encuentro, el destino o el servicio ya no están disponibles. Vuelva a buscar el destino.» (fallo simulado `mock:fallos`) | `08-submit-error-390.png` |
| M — relectura sin salto | un `MutationObserver` no vio «Buscando las derivaciones…» durante la relectura tras derivar (S7 en vez de S2) | — |
| M — sin servicios | aviso en línea «Este destino no tiene servicios publicados», 222 px a 390 (antes: S3 de página ~290 px, «Todavía no hay nada acá»), con «Derivar sin un servicio» y «Buscar otro destino»; este último devuelve el foco al buscador | `05-no-services-390.png`, `12-no-services-{768,1440,1920}.png` |
| M — pista huérfana | el campo «Servicio» existe apagado, con la pista, antes de elegir destino | `04-service-pending-390.png` |
| M — sin encuentro | «Ir a abrir el encuentro» cierra el modal y deja el foco en «Abrir encuentro», a la vista | `02-no-encounter-390.png`, `03-no-encounter-focus-390.png` |
| L — ícono doble en Vigencia | rótulos de «Tipo» y «Vigencia» a la misma altura a 768, 1440 y 1920 | `11-modal-{768,1440,1920}.png` |
| L — «Sin tipo» | ninguna fila de la lista lo dice (la fila sembrada sin tipo se titula con el destino) | `02-no-encounter-390.png` |
| L — sufijo de la casilla | «4 derivaciones», no «en la historia» | `01-grid-390.png`, `10-grid-*.png` |
| Persistencia | UI → POST → respuesta → F5 → la casilla suma las 5 emitidas (4 → 9) y la fila «Hospital San Lucas · Solicitada» sigue | `09-after-reload-390.png` |
| Responsive | sin desborde horizontal a 360, 390, 768, 1440 y 1920 | todas |

## Lo que NO demuestra

- **API real.** La maqueta contesta dentro del interceptor; la persistencia es
  `sessionStorage`. Contra la API viva no se ejecutó.
- **1024 px** no se capturó (se pidieron 390, 768, 1440 y 1920).
- El estado «Contando… / No se pudo contar» de la casilla, las viñetas del
  resumen «Revise antes de derivar», el título y el código sin cortes del
  500, y `queryCleared` en el `<input>` real están cubiertos por pruebas
  unitarias, no por capturas.
- Con «Tratamiento» (el tipo por omisión) tras derivar se abre encima el
  detalle con el consentimiento — es el próximo paso del flujo. Por eso el
  script deriva con «Interconsulta»: así lo que queda a la vista es el
  resultado del envío.
- Consola: avisos `NG0505` (hidratación sin SSR en `demo`), un
  `AbortError` de una View Transition saltada por la navegación rápida del
  script, y los 409/404/500 que el propio script provoca.
- Sin aprobación: quien implementa no aprueba (`NO_SELF_APPROVAL`). Falta la
  revisión visual independiente.

## Fuera de alcance (reportado, no corregido)

- La altura del encabezado del modal compartido (`app-content-dialog`) a 390:
  ocupa ~240 px con título y bajada (ver cualquier captura `-390`).
- Erratas del catálogo de nomenclador generado de la maqueta
  (`fee-schedules.generated.ts`), p. ej. «Descenso coténico abdomino perineal
  (tipo sweason, soave, duha- mel, otros)».
