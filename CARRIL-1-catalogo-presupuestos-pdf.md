# Carril 1 · Catálogo de servicios, presupuestos/cotizaciones y exportación a PDF

**Puntos del reclamo:** 2 (PDF), 3 (catálogo maestro de servicios), 5 (presupuesto/cotización
por paciente y procedimiento). **Repos:** backend + frontend, los dos.
**Rama sugerida:** `carril-1/catalogo-presupuestos-pdf` en ambos.
**Coordinación:** ver `CARRILES-2026-08-14-README.md` antes de tocar cualquier archivo
compartido, y postear tu bloque en `COORDINACION-AGENTES.md` antes de empezar.

## Por qué estos tres van juntos

El presupuesto (5) no puede existir sin el catálogo (3): el cliente pidió explícitamente que el
precio sea libre por doctor **sobre una lista fija de servicios**, no que cada uno invente
servicios nuevos. Y el primer caso de uso real de "generar PDF" (2) es entregarle al paciente su
cotización — por eso el export vive acá, como una utilidad que después cualquier otro carril
puede reusar sin tocar este.

## Lo que ya existe, y por qué no alcanza (evidencia de la auditoría)

- `billing.service_catalog` (`redesa-api/src/modules/billing/entities/service_catalog.entity.ts`)
  tiene `code`, `name`, `defaultPrice`, `serviceConceptId`, `taxCodeId` — pero **cero
  controller**. Es un modelo huérfano.
- `billing.budgets` / `billing.budget_lines` (mismas carpeta de entidades) — misma situación:
  sin service, sin controller.
- El frontend no tiene ningún cliente de catálogo ni de presupuestos. `AccountingClient`
  (`src/app/core/data-access/accounting/accounting.client.ts`) solo expone plan de cuentas,
  diario y balance.
- `app.routes.ts:376` — la sección `facturacion: '/billing'` está en el menú pero
  **`disabled: true`**, apagada a propósito por el equipo.
- Sin `jspdf`/`pdfmake`/`html2canvas` en `package.json`. Sin generador de PDF en el backend.

## Backend (`mantra-core-health-redesa-api`)

Módulo: `billing` (ya existe la carpeta, seguí el molde de `billing-operations.controller.ts` /
`billing-payables.controller.ts` para estilo de DTOs, `@Roles`, `em.transactional`).

**Archivos nuevos (no chocan con nada):**

```
src/modules/billing/controllers/billing-service-catalog.controller.ts   + .spec.ts
src/modules/billing/controllers/billing-budgets.controller.ts           + .spec.ts
src/modules/billing/services/billing-service-catalog.service.ts        + .spec.ts
src/modules/billing/services/billing-budgets.service.ts                + .spec.ts
src/modules/billing/dto/service-catalog.dto.ts
src/modules/billing/dto/budget.dto.ts
```

**Endpoints a exponer** (verificá roles reales contra `@Roles` de controllers vecinos de
`billing` antes de inventar uno nuevo):

- `GET /billing/service-catalog` — lectura, para cualquier profesional que cotice (sin rol de
  administración, como hizo terminología en UC-03-13).
- `POST /billing/service-catalog` — alta, **solo admin** (`SECURITY_ADMIN` o el rol de
  facturación que ya usa `administration/accounting` — confirmalo en el controller de
  accounting antes de copiarlo).
- `GET /billing/budgets?patientId=` — listado por paciente.
- `POST /billing/budgets` — crea presupuesto con líneas (`budget_lines`), cada línea referencia
  un `service_catalog.id` y lleva el precio que puso el doctor (**no** el `defaultPrice** a
  ciegas — el cliente pidió precio libre por doctor).

**Antes de escribir el controller**, confirmá con `grep -rn "column" src/modules/billing/entities/service_catalog.entity.ts src/modules/billing/entities/budget*.entity.ts`
si las entidades ya tienen todo lo que necesitás. Si falta una columna (por ejemplo, quién puso
el precio y cuándo), **no la agregues a mano** — es el caso que cubre la advertencia del README
de carriles: avisá en `COORDINACION-AGENTES.md` como bloqueador.

**Archivos existentes que tocás:** ninguno fuera de `src/modules/billing/`. Este módulo no lo
toca ningún otro carril.

## Frontend (`mantra-core-health`)

**Archivos nuevos (no chocan con nada):**

```
src/app/core/data-access/services-catalog/services-catalog.client.ts      + .types.ts + .spec.ts
src/app/core/data-access/budgets/budgets.client.ts                        + .types.ts + .spec.ts
src/app/features/admin/services-catalog/services-catalog.ts               + .html + .css + .spec.ts
src/app/features/clinical-record/patient-chart/budget-block/budget-block.ts  + .html + .css + .spec.ts
src/app/shared/utils/pdf-export/pdf-export.ts                             + .spec.ts
```

- `services-catalog` (admin): listado + alta del catálogo maestro. Mismo molde que
  `terminology-catalog.ts` para paginación y estados de carga/error.
- `budget-block`: **sibling nuevo** de `medication-block`/`diagnosis-block` dentro de
  `patient-chart/` — no edites esos dos archivos, solo agregá el tuyo al lado.
- `pdf-export.ts`: utilidad genérica sobre `jspdf` (`exportElementToPdf(el, filename)` o
  similar) — pensala reusable, porque los carriles 2 a 5 van a querer exportar recetas,
  formularios y reportes más adelante sin tocar este archivo.

**Archivos existentes que tocás (siguiendo el protocolo del README):**

| Archivo | Qué agregás |
|---|---|
| `package.json` | dependencia `jspdf` (sos el único carril que toca este archivo) |
| `src/app/core/navigation/navigation.map.ts` | una fila nueva, grupo **Administración**: `administration/services-catalog`, roles del admin de facturación real (confirmalos contra el `@Roles` que pusiste en el backend), `availability: 'disponible'` recién cuando el `GET` ya responda |
| `src/app/app.routes.ts` | ruta de `administration/services-catalog` |
| `src/app/features/clinical-record/patient-chart/patient-chart.ts` (+ `.html`) | import de `budget-block` + una entrada en el ensamblado de bloques, al final, en tu último commit |

**Lo que NO tocás:** `medication-block/`, `diagnosis-block/`, la lógica de
`registrarEncuentro()`/`cerrarEncuentro()`, `accounting.client.ts` (es de contabilidad, no de
catálogo — aunque se parezcan, son dos dominios distintos), y todo `redsat/` (es el árbol de
maquetas sin lógica, no lo despiertes por accidente).

## Definición de hecho

- Un admin puede crear/listar servicios del catálogo; un médico **no puede crear uno nuevo**,
  solo elegir de la lista (verificalo con un usuario sin rol de admin, no solo con el guard).
- Desde la ficha del paciente se arma un presupuesto con al menos dos líneas, cada una con
  precio propio, y se puede exportar a PDF.
- `yarn lint` · `yarn typecheck` · `yarn test` · `yarn build` en frontend; `yarn lint` ·
  `yarn typecheck` · `yarn test` · `yarn test:integration` en backend.
