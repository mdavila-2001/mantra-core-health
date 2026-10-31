# Contrato H2 — dinero por módulo y mapa de calor de clics

Plan: [`PLAN.md`](../PLAN.md) · H2.S1.M2 y H2.S1.M3 · API: `mantra-core-health-api`, rama `claude/stoic-johnson-4vl5bf`.
Peldaño de evidencia: `TESTED` (specs HTTP con repositorio doblado + typecheck dirigido + lint). **No** `VERIFIED`: el SQL no se ejecutó contra Postgres (ver «BLOQUEADO»).

Ambos endpoints: solo lectura, `Authorization: Bearer`, acotados al **tenant activo** (`X-Tenant-Id`; sin tenant → 422 `TENANT_REQUIRED`, no hay barrido global), ventana `[from, to)` en UTC, por defecto `to − 7 días`, **máximo 92 días**. Solo agregados: ninguna fila lleva datos de personas.

Errores comunes (contrato de errores del repo):

| HTTP | `code` | Cuándo |
|---|---|---|
| 400 | `VALIDATION_FAILED` | `from`/`to` no ISO-8601, parámetro no declarado, o (heatmap) `route` ausente/vacía/>300, `screenSize`/`portal` fuera de catálogo |
| 401 | `UNAUTHENTICATED` | sin sesión |
| 403 | `FORBIDDEN` (`reason: ROLE_INSUFFICIENT`) | rol fuera de la lista |
| 422 | `VALIDATION_FAILED`, `details.reason` ∈ `EMPTY_WINDOW` · `WINDOW_TOO_LARGE` · `INVALID_DATE` | ventana inválida |
| 422 | `PRECONDITION_FAILED`, `reason: TENANT_REQUIRED` | sin tenant resuelto |

---

## 1. `GET /admin/analytics/money?from&to`

Roles: `PLATFORM_ADMIN`, `SECURITY_ADMIN`, `PAYMENTS_ADMIN`, `ACCOUNTING_APPROVER` (más estricto que la analítica de uso: es dinero).
Código: `src/modules/reporting/controllers/reporting-money.controller.ts` (cabecera con el contrato), `services/reporting-money.service.ts`, `repositories/reporting-money.repository.ts`.

```jsonc
200 {
  "window": { "from": "2026-10-01T00:00:00.000Z", "to": "2026-10-08T00:00:00.000Z" },
  "items": [{
    "module": "billing",              // código real de la fuente: billing | quotations | payments
    "moduleLabel": "Facturación",     // texto para mostrar
    "kind": "FACTURADO",              // FACTURADO | COBRADO | COTIZADO | OTRO
    "currency": "BOB",                // ISO-4217. Un renglón por moneda: NUNCA se suman monedas
    "operations": 12,                 // filas con importe y moneda que entraron en la suma
    "amount": "2500.80"               // decimal exacto, 2 decimales, CADENA (jamás number)
  }],                                 // orden: module, moduleLabel, kind, currency
  "notMeasured": [{ "module": "pharmacy", "reason": "…" }]
}
```

Reglas de lectura para el front:

- `amount` se muestra y suma como cadena/decimal (no `Number`). Formato `^-?\d+\.\d{2}$`.
- **Los renglones son por fuente y no son aditivos entre módulos.** Un cobro de `billing` puede ligarse a una transacción de `payments` (`payments_received.transaction_id`); sumar «Facturación · cobros registrados» con «Pagos · pasarela» contaría dos veces. Mostrar tarjetas por módulo, no un total global.
- `items: []` es «sin operaciones en la ventana» (vacío honesto), no «cero pesos». `notMeasured` siempre trae los módulos sin fuente; con ventana vacía el estado es S2/S5-vacío, no error.
- `notMeasured[].reason` es texto explicativo en español para mostrar tal cual. Además de los módulos sin fuente (`pharmacy`, `insurance`, `accounting`), puede traer avisos dinámicos de una fuente con conteo («N fila(s) … sin importe registrado», «N operación(es) … sin moneda reconocible»): esas operaciones **no** están en `items`.

### Fuentes reales (entidad → qué cuenta)

| `module` · `kind` · `moduleLabel` | Tabla | Importe · moneda | Fecha de ventana | Filtro de estado |
|---|---|---|---|---|
| `billing` · `FACTURADO` · «Facturación» | `billing.invoices` (`invoices.entity.ts`) | `total` · `currency_concept_id` | `issue_date` (date, medianoche UTC) | `INV_ISSUED`, `INV_PARTIALLY_PAID`, `INV_PAID`, `INV_IN_COLLECTION`, `INV_PAYMENT_PLAN`, `INV_ADJUSTED` (excluye borrador y nota de crédito) |
| `billing` · `OTRO` · «Facturación · notas de crédito» | `billing.invoices` | ídem | `issue_date` | `INV_CREDIT_NOTE` |
| `billing` · `COBRADO` · «Facturación · cobros registrados» | `billing.payments_received` | `amount` · **moneda de la factura que salda** (`invoice_id → invoices.currency_concept_id`; la tabla no tiene moneda propia) | `coalesce(received_at, created_at)` | `PAY_CLEARED`, `PAY_RECONCILED` |
| `quotations` · `COTIZADO` · «Cotizaciones» | `billing.quotations` | `offered_price` · `currency_concept_id` | `created_at` | sin filtro (la entidad solo conoce `ACTIVE`) |
| `payments` · `COBRADO` · «Pagos · pasarela» | `payments.payment_transactions` ⋈ `payment_intents` | `amount` · `currency_concept_id` | `coalesce(processed_at, created_at)` | `TXN_CAPTURED`, `TXN_SETTLED` |
| `payments` · `OTRO` · «Pagos · reembolsos» | `payments.refunds` ⋈ transacciones ⋈ intents | `amount` · `currency_concept_id` | `coalesce(processed_at, created_at)` | `REFUND_DONE` |

Tenant: `practice_id → practice.practices.tenant_id` (billing) o `payment_intents.tenant_id` (payments). La moneda se resuelve por el código del concepto (`terminology.catalog_concepts.code`) con el mismo mapa de ids que ya usa seguros (`resolveInsuranceCurrencyCode`); si no es una ISO-4217 de 3 letras, la operación se aparta y se declara (no se asume BOB).

### `notMeasured` fijo (sin fuente verificable)

| `module` | Por qué |
|---|---|
| `pharmacy` | `pharmacy.*` es catálogo de precios. El movimiento (`pharmacy_inventory.medication_dispensation_lines.patient_amount/insurer_amount`) no lleva moneda; solo la reserva asociada, nullable. No se infiere. |
| `insurance` | `insurance_claims.total_amount` tiene moneda y estado, pero el tenant dueño del siniestro es ambiguo (aseguradora vs. proveedor facturante). **Decisión de negocio pendiente.** |
| `accounting` | `ledger_entries` es partida doble (debe = haber): sumarlo no da dinero del módulo. `accounting.sales` replica `billing.invoices` (`sales.invoice_id`): duplicaría lo facturado. |

---

## 2. `GET /admin/analytics/heatmap?route&from&to[&portal][&screenSize]`

Roles: `ANALYTICS_READ_ROLES` (`PLATFORM_ADMIN`, `SECURITY_ADMIN`, `DATA_PLATFORM_ADMIN`, `MARKETING_MANAGER`, `DPO`), igual que el resto de `/admin/analytics`.
Código: `src/modules/telemetry/presentation/controllers/telemetry-click-heatmap.controller.ts` (cabecera con el contrato), `application/services/telemetry-click-heatmap.service.ts`, `infrastructure/repositories/telemetry-click-heatmap.repository.ts`.
No reemplaza `GET /admin/analytics/onboarding/heatmap` (fricción por campo del alta, en memoria): es otro mapa.

Query: `route` **obligatoria** (plantilla de ruta tal cual `routeTemplate` del evento, p. ej. `/patients/:id`; un mapa es de UNA pantalla) · `from`, `to` · `portal` (`WEB`|`MOBILE`) · `screenSize` (`movil`|`tableta`|`escritorio`, segmenta celdas y elementos).

```jsonc
200 {
  "route": "/patients/:id",
  "window": { "from": "…", "to": "…", "timezone": "UTC", "portal": null, "screenSize": null },
  "grid": { "columns": 20, "rows": 20 },
  "totals": {
    "clicks": 12,           // eventos «clic» de la ruta en la ventana (con el filtro screenSize si lo hay)
    "positioned": 8,        // con coordenadas y NO de teclado: los que se pintan
    "keyboard": 3,          // activados por teclado: se cuentan, no se pintan
    "withoutPosition": 1,   // no de teclado y sin coordenadas completas
    "repeated": 2           // «clic repetido» (rage click) según el cliente
  },
  "cells": [{ "column": 0, "row": 0, "x": 0.025, "y": 0.025, "clicks": 6, "share": 0.75 }],
  "byElement": [{ "target": "button#guardar", "clicks": 7, "repeated": 2 }],
  "byScreenSize": [{ "screenSize": "escritorio", "clicks": 12 }],
  "notMeasured": [{ "metric": "keyboardClicks", "reason": "…" }]
}
```

- `cells`: solo celdas con clics, orden `row`, `column`. `x`,`y` = **centro** de la celda en 0–1 (4 decimales); `share = clicks / totals.positioned` (`null` si `positioned = 0`). Esquina superior izquierda = (0,0). La escala de color la decide el front; `clicks` y `share` bastan para no depender solo del color.
- Eje X: `x_doc` = `pageX / anchoDocumento` (fracción). Eje Y: `y_doc_px / alto_doc_px` con la altura del documento **al momento del clic**: en páginas que crecen al cargar contenido la fila se desplaza (declarado en `notMeasured.verticalPosition`).
- `byElement`: top 20 por el selector `objetivo` que arma el cliente (`describirElemento`); clics sin `objetivo` no entran. `byScreenSize` no se filtra por `screenSize` (es el desglose; `UNSPECIFIED` = el evento no trajo `tamano_pantalla`).
- `notMeasured[]` = `{ metric, reason }` (misma forma que `/devices`). Siempre: `keyboardClicks`, `verticalPosition`. Condicionales: `clicks` (cero eventos en la ventana: no se distingue «nadie la usó» de «no se capturó»), `coordinates` (hay clics pero ninguno con coordenadas), `clicksWithoutCoordinates` (N clics sin coordenadas completas).
- Estados para el front: `totals.clicks = 0` → vacío (S2/S5 según corresponda, con la razón de `notMeasured`); `clicks > 0 && positioned = 0` → mostrar `byElement` y la limitación, **no** una malla vacía.

### Qué se mide hoy y de dónde sale (hechos, con ruta)

- El portal captura `clic` en `src/app/core/observability/ux/ux-events.ts` con propiedades `x_doc` (0–1), `y_doc_px`, `alto_doc_px`, `x_vp`, `y_vp`, `objetivo_x`, `objetivo_y`, `objetivo` (selector), `es_interactivo`, `es_teclado`, `es_clic_repetido`, `ancho_vp`, `alto_vp`, `tamano_pantalla`. Viajan a `POST /telemetry/activity-events` con `routeTemplate`.
- La API **sí** puede guardar coordenadas: cada propiedad es una fila de `telemetry.user_activity_event_properties` (`value_number`/`value_string`/`value_boolean`), ligada a `telemetry.user_activity_events` (`event_name`, `route_template`, `tenant_id`, `occurred_at`). El heatmap lee de ahí.
- **Condición para que existan datos:** `validateEventProperties` (`telemetry/domain/event-property-policy.ts`) solo admite las propiedades que el esquema declara en `propertySchemaJson.properties`. El seeder `src/common/seed/telemetry-ux-heatmap-seed.service.ts` crea el esquema `ux_interaccion` **sin** `propertySchemaJson`, así que, por el código, una propiedad no declarada se rechaza (422 `EVENT_PROPERTY_NOT_ALLOWED`) y la ingesta rechaza el lote. Hay que declarar en `propertySchemaJson` las propiedades de `ux-events.ts` (tipos: `number` para `x_doc`, `y_doc_px`, `alto_doc_px`, … ; `string` para `objetivo`, `tamano_pantalla`; `boolean` para `es_*`) vía `POST /telemetry/event-schemas` o ampliando el seeder. **No verificado contra una base real**: no tengo acceso al esquema desplegado. Hasta entonces el endpoint devuelve `clicks: 0` con `notMeasured.clicks`.
- Fuera de mi terreno (anotado, no tocado): el seeder y la nota anterior. Es una microtarea nueva para el plan (propietario: telemetría/seed).

---

## 3. Evidencia y límites

Comandos (desde `mantra-core-health-api`, sin suite completa ni build):

```
node --experimental-vm-modules node_modules/jest-cli/bin/jest.js <7 specs> --runInBand
  → Test Suites: 7 passed, 7 total · Tests: 81 passed, 81 total
tsc -p <tsconfig dirigido a los 8 archivos nuevos + 2 módulos>   → exit=0
eslint (16 archivos)                                              → exit=0 (tras prettier --fix)
```

BLOQUEADO (exige Postgres real; no hay base en esta máquina): ejecutar las SQL de `MONEY_SOURCES` y de `TelemetryClickHeatmapRepository` contra datos; el **cuadre** (suma del endpoint vs. `SELECT sum(total)…` directo) y la verificación de que `round(sum(),2)::text` devuelve 2 decimales; E2E petición → respuesta → UI. Lo que sí se probó contra dobles declarados: contrato HTTP (401/403/422/400), ventana, monedas nunca mezcladas, importes como cadena, vacío honesto, SQL parametrizado (tenant/ruta/ventana nunca en el texto) y columnas existentes en las entidades.

Ambigüedades abiertas (a confirmar con negocio): (1) estados que cuentan como «facturado» (`INV_ADJUSTED` incluido); (2) dueño de tenant de un siniestro de seguro; (3) si «cobros registrados» y «pasarela» deben presentarse juntos con de-duplicación por `transaction_id`.
