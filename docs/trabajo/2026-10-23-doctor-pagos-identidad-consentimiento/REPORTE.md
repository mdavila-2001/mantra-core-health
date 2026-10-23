# Reporte — carril 2 · Pablo · comprobantes, cierre con pago (C-01) — corte del 2026-10-23

> **AVANCE: 23 / 79 — 29,1 %.** H1 y H2 (C-01) cerrados salvo 3 microtareas; H3–H8 sin empezar; carril de Justin sin empezar.

- Fecha: 2026-10-23 · Plan: [PLAN.md](./PLAN.md) · Rama: `claude/intelligent-faraday-444u25` en `mantra-core-health`, `mantra-core-health-api`, `mantra-core-health-model`, `mantra_core_technologies_health_docs`
- Peldaño de evidencia alcanzado, por área:
  - API C-01: `VERIFIED` (int-spec contra Postgres real + E2E contra la API real).
  - Front C-01: `VERIFIED` con doble revisión visual (veredicto final: 8 pantallas `ACEPTABLE CON RESERVAS`, ninguna `RECHAZADA`).
  - Regresión: parcial (ver «No cubierto»).

## Completado

| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1 (8) | Corte, baseline, cuentas sintéticas, contratos C-01/05/06/10 publicados, kill-tests en rojo | plan 06 | PASS (plan 06, `evidencia/` de AlovidaPromptManager) |
| H2.S1.M1–M3 | `billing.payment_proofs` en `.puml` M17, CHECK en M33, patch v4247 idempotente, entidad, catálogo ORM | `gen_ddl.py 17` · `gen_integrity.py` · psql ×2 · `orm:audit` | PASS — `mantra-core-health-model/…/evidencia/h2-modelo.txt` |
| H2.S2.M1–M4, M6, M8, M9 | Endpoints C-01, precondición en la escritura (doble aceptación → una gana, 409), cierre bloqueado sin pago (422 `PAYMENT_REQUIRED`) con excepción auditada, tabla del prestador con cursor y filtro por persona, avisos al paciente, imagen del comprobante autorizada por contexto | `yarn test:integration c01-comprobantes-de-pago` | PASS 14/14 — `mantra-core-health-api/…/evidencia/h2-int-spec-c01.txt` |
| H2.S3.M1–M5 | Cliente, caja «Comprobantes del paciente» (miniatura, lightbox, aceptar, rechazar con motivo), cierre que explica el pago faltante y ofrece la excepción, pestaña «Pagos por sesión» en Contabilidad del médico y en `/billing`, simulador C-01 en tres niveles | `playwright test c01-aceptar-comprobante` (API real, sin mocks) | PASS 3/3 — `evidencia/h2-e2e-mutacion-api-real.txt` |
| Kill-test MD-06 | La tabla de pagos por sesión existe y tiene sus columnas | `playwright test correcciones-… --grep MD-06` (API real) | PASS 1/1 |
| Datos de prueba en la API real | Script versionado que siembra el escenario C-01 completo por endpoints públicos, sintético e idempotente | `node scripts/e2e-sembrar-api-real.mjs --etiqueta carril2` ×2 | PASS — `evidencia/h2-datos-de-prueba-api-real.txt` |
| Capturas | 52 capturas, 3 anchos × 2 temas, doble revisión con revisor independiente (4 rondas) | `playwright test capturas-c01-comprobantes` | PASS — `evidencia/capturas/`, `evidencia/doble-revision.md` |

## A medias

### H2.S2.M5 — el cargo nace al iniciar la reserva
- Qué anda: el estado del cargo se deriva del comprobante aceptado o de la cuenta saldada; `PUT /scheduling/bookings/:id/payment-state` está marcado deprecado en OpenAPI.
- Qué no anda: el cargo no nace en `start` con sede y precio; se calcula desde el encuentro.
- Qué falta exactamente: decidir con Q-P2 si hace falta materializarlo; si sí, crear la cuenta por cobrar en `StartAppointmentUseCase`.
- Dónde quedó: API, rama del carril, compila y pasa.

### H2.S2.M7 — factura real con pago
- Qué anda: la factura fiscal simulada exige pago (422 `PAYMENT_REQUIRED`, int-spec caso 2b).
- Qué no anda: `POST /billing/invoices:issue-from-encounter` real no consulta `charge-settlement`.
- Qué falta exactamente: llamar a `paymentRequired(chargeSettlement(...))` en `InvoicesService.issueFromEncounter` y su int-spec.
- Dónde quedó: API, rama del carril.

### H2.S3.M6 — móvil
- Qué anda: nada todavía.
- Qué no anda: la hoja de cobro de la consulta en Flutter no muestra comprobantes.
- Qué falta exactamente: consumir `PaymentProofsClient` equivalente en `consultation_billing_sheet.dart` y su `flutter test`.
- Dónde quedó: sin tocar.

## Pendiente

| ID | Estado | Qué lo destraba |
|---|---|---|
| H3 (C-10 CI único) · H4 (Colegio Médico) · H5 (consentimiento por sección) · H6 (encuestas) · H7 (Coolify) · H8 (cierre) | TODO | Siguiente turno. Kill-tests MD-01, MD-02, MD-03, MD-05 siguen rojos. |
| Carril de Justin | TODO | El usuario pidió correrlo al terminar el de Pablo; no se empezó. |

## Evidencia

- API: `mantra-core-health-api/docs/trabajo/2026-10-23-doctor-pagos-identidad-consentimiento/evidencia/` (`h2-int-spec-c01.txt`, `h2-api-verificacion.txt`, `h2-regresion-cierre-encuentro.txt`).
- Modelo: `mantra-core-health-model/…/evidencia/h2-modelo.txt`.
- Front: `evidencia/h2-e2e-mutacion-api-real.txt`, `h2-datos-de-prueba-api-real.txt`, `h2-regresion-front.md`, `doble-revision.md`, `capturas/` (52).

```text
$ yarn test:integration test/integration/c01-comprobantes-de-pago.int-spec.ts
Tests:       14 passed, 14 total
$ yarn playwright test playwright/c01-aceptar-comprobante.spec.ts --workers=1   (API real)
  3 passed (17.9s)
$ yarn playwright test playwright/correcciones-2026-10-23-kill-tests.spec.ts --grep MD-06   (API real)
  1 passed (5.2s)
```

## No cubierto

- Regresión completa del front: corrida por lotes. Los rojos de `features [d-l]`, `[m-p]` y de `core` también lo están en HEAD o pasan aislados. `account` (1 rojo) y `admin` (2 rojos) no tienen cambios de C-01, pero no se les corrió línea de base. `auth` y `auth-providers` no se corrieron.
- Regresión completa de la API: sólo billing, encounters y los int-specs de cierre (fx12, fx17, br14).
- Estados vacío y error capturados con la red interceptada: evidencia de UI, no de integración.
- C-02 contra un doble (`NoCoveragePatientShare`, siempre «Sin seguro»): falta integrarlo con el puerto real de Richard.
- La pantalla de pago del paciente (Richard) no existe: el paciente subió comprobantes por API en el sembrado y en la E2E.
- El simulador no bloquea el cierre del encuentro por pago.

## Desvíos del plan

- **422 en vez de 412.** El contrato C-01 dice 412; la casa mapea las precondiciones a 422 `PRECONDITION_FAILED` y el simulador ya lo documentaba así. El cliente distingue por `details.reason = PAYMENT_REQUIRED`.
- **«Pagos por sesión» en Contabilidad, no sólo en `/billing`.** El menú del médico es una lista cerrada del cliente (`navigation.service.spec.ts`); se agregó como tercera pestaña de Contabilidad, que ya está en ese menú. El kill-test MD-06 abre Contabilidad; la aserción es la misma.
- **Etiqueta «Pendiente»** en vez de «Pendiente de pago», por ancho en 390 px.
- **Endpoint nuevo `GET /billing/payment-proofs/:id/file`.** El médico no podía ver la imagen que subió el paciente.
- **Patch v4247** y no v4243: la copia de despliegue de la API ya llegaba a v4246.

## Riesgos residuales

- **BUG-C2-01 (producto, fuera de C-01, con arista de seguridad).** `GET /practices` devuelve todas las prácticas del tenant, y los médicos independientes comparten el tenant por defecto. La Contabilidad del médico abre la práctica de otro médico (422 «sin vinculación activa») y lista nombres de prácticas ajenas. Se nombró en la E2E en vez de ignorarlo. Dueño: práctica/contabilidad.
- **Mismo patrón arreglado en billing.** «La primera práctica del tenant» se usaba para el precio y el emisor de un cobro; ahora se resuelve por la asignación del profesional (`charge-settlement.ts`, `loadCharges`).
- **Base local con deriva.** Los patches v4223–v4246 de la API no estaban aplicados en la base local; se aplicaron (idempotentes). Cualquier entorno armado sólo desde el repo del modelo tiene la misma deriva.
- **Pendientes de componentes compartidos** que señaló la revisión visual (MENOR): fecha ISO partida en `patient-charges`, mensaje crudo en `errorToViewState`, pestaña en dos renglones, ▼ desalineado.
- **Rojos previos ajenos:** `billing.spec` «la puerta por omisión», `navigation.subgroups.spec`, `audit-trail-coverage.spec` (`PUT /community/ratings`), gate `check-api-prefixes` (`/admin/portal`), `check-colores-sueltos` (map.css), CSS desbalanceado en `data-table.css`.

## Decisiones y ambigüedades

- 422 vs 412 en C-01: confirmar con Richard, Ender e Itzan (consumidores).
- Dónde vive la tabla del prestador para el médico (Contabilidad): confirmar con el propietario.
- Aviso al paciente sin `destination` (la bandeja colapsaba «pagado» con un «rechazado» sin leer): el cargo va en el payload.
- Mockup: el usuario avisó que `mockup` tiene cambios visuales que no llegaron a `dev` ni `test`. Este trabajo se hizo sobre `dev` con componentes compartidos y sin restilizarlos. `billing/`, `payments-block/` y `consultation/` difieren entre `dev` y `mockup` en los dos sentidos: habrá que resolverlo al integrar.
