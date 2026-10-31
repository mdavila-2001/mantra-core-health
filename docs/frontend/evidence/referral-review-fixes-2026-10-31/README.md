# Evidencia — correcciones de la revisión de «Derivar»

Revisión independiente de la casilla «Derivar» de
`/medical-records/:profileId/consultation` (PR #1584 y #1585, ya mergeados):
hallazgos de código (H1, M2–M6, L7, L8) y visuales (a 390 px puntuaba 75/100).

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
  **28/28 aserciones**, 0 `pageerror`.

## Qué demuestra

| Hallazgo | Aserción / medida | Captura |
|---|---|---|
| HIGH — el resultado del envío a 390 | éxito, 409 y error **dentro del viewport** tras enviar (top 473–486, bottom 583–595 de 844) y el foco en `referral-outcome` | `06-submit-success-390.png`, `07-submit-409-390.png`, `08-submit-error-390.png` |
| H1 — texto de organización | «Le avisamos a la persona que la derivó a Hospital San Lucas. Va a ver la derivación en su portal.» | `06-submit-success-390.png` |
| M5 — 404 sin sub-código | «El encuentro, el destino o el servicio ya no están disponibles. Vuelva a buscar el destino.» (fallo simulado `mock:fallos`) | `08-submit-error-390.png` |
| M — relectura sin salto | un `MutationObserver` no vio «Buscando las derivaciones…» durante la relectura tras derivar (S7 en vez de S2) | — |
| M — sin servicios | aviso en línea «Este destino no tiene servicios publicados», 222 px a 390 (antes: S3 de página ~290 px, «Todavía no hay nada acá»), con «Derivar sin un servicio» y «Buscar otro destino»; este último devuelve el foco al buscador | `05-no-services-390.png`, `12-no-services-{768,1440,1920}.png` |
| M — pista huérfana | el campo «Servicio» existe apagado, con la pista, antes de elegir destino | `04-service-pending-390.png` |
| M — sin encuentro | «Ir a abrir el encuentro» cierra el modal y deja el foco en «Abrir encuentro», a la vista | `02-no-encounter-390.png`, `03-no-encounter-focus-390.png` |
| L — ícono doble en Vigencia | rótulos de «Tipo» y «Vigencia» a la misma altura a 768, 1440 y 1920 | `11-modal-{768,1440,1920}.png` |
| L — «Sin tipo» | ninguna fila de la lista lo dice (la fila sembrada sin tipo se titula con el destino) | `02-no-encounter-390.png` |
| L — sufijo de la casilla | «4 derivaciones», no «en la historia» | `01-grid-390.png`, `10-grid-*.png` |
| Pista del motivo | con una organización: «La persona lo ve en su lista de derivaciones, no en el aviso» (el aviso de la API no lleva el motivo) | `07-submit-409-390.png` |
| Persistencia | UI → POST → respuesta → F5 → la casilla pasa de 4 a 5 y la fila «Hospital San Lucas · Solicitada» sigue | `09-after-reload-390.png` |
| Responsive | sin desborde horizontal a 390, 768, 1440 y 1920 | todas |

## Lo que NO demuestra

- **API real.** La maqueta contesta dentro del interceptor; la persistencia es
  `sessionStorage`. Contra la API viva no se ejecutó.
- **1024 px** no se capturó (se pidieron 390, 768, 1440 y 1920).
- El estado «Contando… / No se pudo contar» de la casilla y el aviso
  `ORGANIZATION_PROFILE` de la campana están cubiertos por pruebas unitarias
  (`consultation.spec.ts`, `notification-routes.spec.ts`,
  `referrals.handlers.spec.ts`), no por capturas.
- Con «Tratamiento» (el tipo por omisión) tras derivar se abre encima el
  detalle con el consentimiento — es el próximo paso del flujo. Por eso el
  script deriva con «Interconsulta»: así lo que queda a la vista es el
  resultado del envío.
- Consola: avisos `NG0505` (hidratación sin SSR en `demo`) y `NG0955` (claves
  «Consulta» duplicadas, ajeno a este cambio), un 403 de
  `GET /tenants/:id/branches` de la maqueta al elegir una organización ajena
  (el bloque lo absorbe y ofrece «Cualquier sede»), y el 409/404 que el propio
  script provoca.
- Sin aprobación: quien implementa no aprueba (`NO_SELF_APPROVAL`). Falta la
  revisión visual independiente.

## Fuera de alcance (reportado, no corregido)

- La altura del encabezado del modal compartido (`app-content-dialog`) a 390:
  ocupa ~240 px con título y bajada (ver cualquier captura `-390`).
- Erratas del catálogo de nomenclador generado de la maqueta
  (`fee-schedules.generated.ts`), p. ej. «Descenso coténico abdomino perineal
  (tipo sweason, soave, duha- mel, otros)».
