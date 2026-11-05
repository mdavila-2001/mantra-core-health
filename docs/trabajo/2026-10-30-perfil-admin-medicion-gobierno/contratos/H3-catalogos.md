# Contrato H3 — Catálogos globales editables por tipo de usuario

> Estado: `WRITTEN` + `TESTED` con dobles (specs dirigidas en verde, ver abajo). **Sin verificar contra PostgreSQL real**: no hay base en la máquina de trabajo. Rama API: `claude/stoic-johnson-4vl5bf` (sin commit). Fecha: 2026-10-31.
> El front consume **solo** lo de este archivo. Lo marcado `BLOQUEADO` no existe en la API y no debe simularse en el front.

## 1. Descubrimiento (qué existía, con ruta:línea, repo `mantra-core-health-api`)

| Catálogo | Entidad / tabla existente | Verbos que ya existían | Dimensión «tipo de usuario» |
|---|---|---|---|
| Servicios | `billing.service_catalog` — `src/modules/billing/entities/service_catalog.entity.ts:7` (`is_active`, `row_version` en `:115`) | `GET/POST/PATCH billing/service-catalog` — `src/modules/billing/controllers/billing-service-catalog.controller.ts:81,165,234` (por **práctica**, `PATCH` sin versión) | **No hay columna.** Lo más cercano: `practice.practices.type_concept_id` (consultorio, clínica, laboratorio, farmacia, aseguradora…, `src/modules/practice/practice.concepts.ts:17-59`) |
| Glosario | motor de terminología: `terminology.catalog_concepts` + `concept_properties` (`glossary-plain-summary`, `glossary-clinical-definition`, `glossary-slug`, `src/modules/terminology/glossary.constants.ts`) | `POST terminology/concepts/:id/{designations,properties,relationships,$deprecate}` (`terminology-concepts.controller.ts:381-463`, `SECURITY_ADMIN`); solo lectura de listado | Texto llano → paciente; definición clínica → profesional. **Sin alta, sin versión, sin reactivar** |
| Reporte contable | `accounting.accounts` / `account_groups` (`src/modules/accounting/entities/accounts.entity.ts`), por práctica; lectura `GET accounting/accounts` y reportes (`accounting-ledger.controller.ts:73,132,148`); alta `POST accounting/accounts` (`:177`) | alta + lecturas | **No hay catálogo de «reporte contable» por tipo de usuario.** Ver §4 |

Reutilizado, sin DDL ni entidades nuevas: se añadieron solo controladores, servicios, DTO y un método de repositorio.

## 2. Servicios — `/admin/catalogs/services`

Módulo: `billing` (`src/modules/billing/{controllers,services,dto}/admin-service-catalog.*`). Roles: `SECURITY_ADMIN` (y el comodín `SUPERADMIN`). Todo se acota a la organización del token (`X-Tenant-Id` resuelto en servidor); servicio o práctica de otra organización => **404** (igual que inexistente). Sin token 401; rol insuficiente (p. ej. `PRACTITIONER`, `PATIENT`) 403.

**«Tipo de usuario» en Servicios = tipo de la organización dueña** (`practiceTypeConceptId`, conceptos `PR_TYPE_*`). Un paciente no tiene catálogo de servicios; un profesional con consultorio propio es una organización tipo `OFFICE`. *Ambigüedad registrada (§5).*

### Tipos

`AdminServiceItem` = `{ id, practiceId, practiceTypeConceptId, code, name, descriptionText?, termsText?, serviceConceptId?, defaultPrice (string "100.00"), currencyConceptId?, currencyCode? ("BOB"|"USD"), isActive, rowVersion, updatedAt (ISO), updatedByUserId? }`

### Rutas

| Método y ruta | Query / cuerpo | Éxito | Errores |
|---|---|---|---|
| `GET /admin/catalogs/services` | query: `practiceTypeConceptId?` (uuid), `practiceId?` (uuid), `isActive?` (`true`/`false`/`1`/`0`), `q?` (≤100, sobre código y nombre), `cursor?`, `limit?` (1..200, def. 50) | 200 `{ items: AdminServiceItem[], count, limit, nextCursor: string\|null }`. Orden determinista `(code, id)`. Solo prácticas **activas** de la organización | 400 query inválida / parámetro no declarado / cursor corrupto; 404 `practiceId` de otra organización |
| `GET /admin/catalogs/services/:id` | — | 200 `AdminServiceItem` | 400 id no uuid; 404 |
| `POST /admin/catalogs/services` | `{ practiceId, code (≤120), name (≤200), defaultPrice ("100.00", >0, ≤2 decimales), descriptionText? (≤2000), serviceConceptId?, currencyConceptId? (def. BOB), isActive? (def. true) }` | **201** creado · **200** si es repetición idéntica (idempotente por `(practiceId, code)`: mismo `id`, sin escribir) | 400 (incluye campo no declarado, p. ej. `rowVersion`); 404 práctica ajena/inexistente; 409 `SERVICE_CATALOG_CODE_ALREADY_EXISTS` (código ocupado con datos distintos); 422 `SERVICE_CATALOG_PRICE_NOT_POSITIVE` |
| `PATCH /admin/catalogs/services/:id` | `{ expectedRowVersion (int ≥1, **obligatorio**), name?, descriptionText?\|null, termsText?\|null, serviceConceptId?, defaultPrice?, currencyConceptId? }` (`null`/vacío limpia el texto; la moneda solo viaja con `defaultPrice`). `code` y `practiceId` **no** se editan | 200 `AdminServiceItem` con `rowVersion` +1 | 400; 404; **409 `SERVICE_CATALOG_VERSION_MISMATCH`** con `details:{expected, actual}`; 422 precio 0 |
| `POST /admin/catalogs/services/:id/deactivate` | `{ expectedRowVersion }` | 200. Idempotente: si ya está inactivo devuelve el estado actual **sin** subir la versión | 400; 404; 409 |
| `POST /admin/catalogs/services/:id/reactivate` | `{ expectedRowVersion }` | 200 (idempotente) | 400; 404; 409 |

No existe `DELETE`. Auditoría (`@Audited`, entidad `service_catalog`): `ADMIN_SERVICE_CATALOG_CREATED` / `_UPDATED` / `_DEACTIVATED` / `_REACTIVATED`; `entityId` = id del servicio. La versión visible es `rowVersion`. Nota: una repetición idempotente de `POST` también sella una entrada de auditoría.

## 3. Glosario — `/admin/catalogs/glossary`

Módulo: `terminology` (`src/modules/terminology/{controllers,services,dto}/admin-glossary.*`). El glosario **no tiene tenant**: lo que se edita llega a todas las organizaciones. Por eso: **lectura** `SECURITY_ADMIN` o `SUPERADMIN`; **escritura solo `SUPERADMIN`** (un `SECURITY_ADMIN` recibe 403). Sin token 401.

**Tipo de usuario (`audience`)**: `patient` ↔ resumen en lenguaje llano (`glossary-plain-summary`); `professional` ↔ definición clínica (`glossary-clinical-definition`). Es la única diferenciación por audiencia que el modelo ya guarda para los términos.

`AdminGlossaryTerm` = `{ conceptId, slug, code, display, nameEs, state ("active"\|"retired"), audience, text: {es, en?}\|null, rowVersion, updatedAt (ISO), updatedByUserId? }` — `text` es el de la audiencia pedida; `null` si todavía no tiene (no se inventa).

| Método y ruta | Query / cuerpo | Éxito | Errores |
|---|---|---|---|
| `GET /admin/catalogs/glossary` | query: `audience` (**obligatorio**, `patient`\|`professional`), `state?` (`active`\|`retired`; ausente = ambos), `q?` (≤100, sobre código y `display`), `cursor?`, `limit?` (1..200, def. 50) | 200 `{ items[], count, limit, nextCursor }`, orden `(code, id)`. Solo términos del code system del glosario | 400 |
| `GET /admin/catalogs/glossary/:conceptId` | query `audience` (obligatorio) | 200 `AdminGlossaryTerm` | 400; 404 `GLOSSARY_TERM_NOT_FOUND` (también si el uuid es un concepto de **otro** catálogo) |
| `POST /admin/catalogs/glossary` | `{ slug (kebab-case ≤80), display (≤200), nameEs (≤200), audience, text: {es (1..4000), en?} }` | **201** creado · **200** repetición idéntica (idempotente por `slug`; el `conceptId` es el determinista del seed) | 400; 409 `GLOSSARY_TERM_ALREADY_EXISTS` (mismo slug, contenido distinto); 422 `GLOSSARY_UMBRELLA_MISSING` |
| `PATCH /admin/catalogs/glossary/:conceptId` | `{ expectedRowVersion (obligatorio), audience, text?, nameEs? }` (al menos `text` o `nameEs`) | 200 `AdminGlossaryTerm`, `rowVersion` +1. Solo toca el texto de **esa** audiencia | 400; 404; **409 `GLOSSARY_TERM_VERSION_MISMATCH`** `details:{expected, actual}` |
| `POST /admin/catalogs/glossary/:conceptId/deactivate` | `{ expectedRowVersion, audience }` | 200. Retira el término (`TERM_RETIRED`, `validTo`) y excluye sus membresías de las expansiones. Idempotente, sin subir versión | 400; 404; 409 |
| `POST /admin/catalogs/glossary/:conceptId/reactivate` | `{ expectedRowVersion, audience }` | 200. Vuelve a `TERM_ACTIVE` y re-incluye sus membresías | 400; 404; 409 |

Sin `DELETE`. Auditoría (`entity: catalog_concept`): `ADMIN_GLOSSARY_TERM_CREATED` / `_UPDATED` / `_DEACTIVATED` / `_REACTIVATED`. Las rutas previas `terminology/concepts/*` siguen intactas (el editor nuevo no las usa).

Riesgo declarado: `reactivate` pone `included = true` en **todas** las membresías del término; el seed siembra todas incluidas, pero un término cuya membresía estuviera excluida a propósito antes de retirarlo quedaría incluida.

## 4. Reporte contable — `BLOQUEADO` (decisión de negocio + faltantes)

No se implementó nada para este catálogo. Motivos, verificados en código:

1. **No hay catálogo de «reporte contable» por tipo de usuario.** Lo que existe es el plan de cuentas (`accounting.accounts`/`account_groups`) **por práctica**, que alimenta balance, resultados y mayor (`accounting-ledger.controller.ts:132,148`). El front hoy usa «Reporte contable» como etiqueta de estado de esas vistas (`src/app/features/accounting/accounting.html:210,415`), no como catálogo editable.
2. **«Desactivar» no tendría efecto.** No existe un concepto de estado inactivo para cuentas (`CONCEPTS` solo trae `STATE_ACTIVE`, `src/common/constants/concepts.ts:182-187`) y el posteo no consulta `statusConceptId` (`ledger.service.ts:763` solo lo fija al crear). Habilitarlo exige un concepto nuevo y tocar el posteo, fuera de este terreno.
3. **Editar cuentas toca la integridad del mayor** (regla 91 de la casa): cambiar tipo/saldo normal de una cuenta con asientos no es una edición de catálogo.

Qué falta y quién decide (`DECISION_REQUIRED`): definir qué es el «Reporte contable» editable por tipo de usuario (¿plantilla de plan de cuentas por tipo de organización?, ¿estructura de los reportes?), y, si es plantilla, una tabla/columna de tipo en `mantra-core-health-model` (`SQL/…accounting`) más el concepto de cuenta inactiva. Confirmar con el usuario.

## 5. Ambigüedades y supuestos

| Ambigüedad | Supuesto tomado | A quién confirmar |
|---|---|---|
| «Tipo de usuario» en Servicios | Tipo de organización dueña (`practice.type_concept_id`); el paciente no ofrece servicios | Usuario |
| «Tipo de usuario» en Glosario | `patient` = resumen llano, `professional` = definición clínica (únicas dos audiencias que el modelo guarda por término); laboratorio/farmacia/aseguradora no tienen texto propio | Usuario |
| Glosario global editable por un solo rol | Solo `SUPERADMIN` escribe (catálogo sin tenant) | Usuario |
| «Global» en Servicios | Global = toda la organización del admin (varias prácticas); no hay catálogo único de plataforma en el modelo | Usuario |

## 6. Evidencia (API, dobles declarados)

Specs nuevas, todas con `jest --runInBand`:

- `src/modules/billing/controllers/admin-service-catalog.controller.http.spec.ts` — cadena real `JwtAuthGuard` + `RolesGuard` + pipe global, servicio doblado: 401 sin token, 403 `PATIENT`/`PRACTITIONER`, 400 lista blanca/versión/precio, 201 vs 200 idempotente, sin `DELETE`.
- `src/modules/billing/services/admin-service-catalog.service.spec.ts` — EntityManager y repos doblados: aislamiento por tenant, 404 uniforme, idempotencia, `409` por versión, desactivar sin borrar, paginación `(code,id)`.
- `src/modules/terminology/controllers/admin-glossary.controller.http.spec.ts` y `.../services/admin-glossary.service.spec.ts` — ídem para el glosario (incluye `SECURITY_ADMIN` => 403 en escritura).
- `src/common/audit-trail/audit-trail-coverage.spec.ts` — 10/10 (toda ruta que muta lleva `@Audited`).
- Regresión de módulos tocados: `src/modules/terminology` + `src/modules/billing` — 62 suites, 875 tests en verde.
- `eslint` (type-aware) sobre los 15 archivos tocados: sin hallazgos. `tsc` acotado a los archivos nuevos y su grafo: sin errores.

**No cubierto:** persistencia real (insert/update con `row_version` de PostgreSQL, `version: true` incrementando de verdad, `ILIKE`/keyset sobre datos reales), arranque DI del módulo completo, auditoría escrita en `audit.audit_log`, y E2E con el front. Requieren PostgreSQL real: `BLOQUEADO` hasta tenerlo.

## 7. Adenda 2026-10-31 — estado real en el checkout del API y `GET /admin/catalogs/services/scopes`

> Esta adenda manda sobre las secciones 1 a 6 en lo que contradiga el código. Motivo: el árbol `mantra-core-health-api` de esta sesión **no trae** los archivos que describe §6 (rama `claude/stoic-johnson-4vl5bf` sin commit, perdida o en otra máquina). Se volvió a implementar Servicios; el resto no.

| Catálogo | API (esta sesión) | Front |
|---|---|---|
| Servicios | **Implementado** en `src/modules/admin_catalogs/` (módulo nuevo, sin DDL): controlador, servicio, DTO, README. 51 pruebas en verde (`jest --runInBand src/modules/admin_catalogs`) con **dobles** (servicio y EntityManager en memoria): sin PostgreSQL real. | Pestaña «Servicios» contra este contrato. |
| Glosario | **NO implementado.** §3 queda como contrato acordado; construirlo toca el motor de terminología (concepto, designaciones, propiedades jsonb, pertenencia al conjunto paraguas) y exige una base real para probarse. | Pestaña «Glosarios» cerrada contra un **doble** (`catalog-editor.handlers.ts`, regla 65). Contra la API real responderá 404 hasta que exista. |
| Reporte contable | **NO implementado** (§4, decisión de negocio pendiente). | Pestaña que dice que no existe; no guarda nada. |

### `GET /admin/catalogs/services/scopes` (nuevo, no estaba en §2)

La pantalla necesita saber **qué tipos de organización, prácticas y monedas existen** sin conocer los uuid de los conceptos `PR_TYPE_*` ni de las monedas. Roles y alcance iguales a los demás verbos de Servicios (`SECURITY_ADMIN`/`SUPERADMIN`; sólo prácticas activas de la organización del token).

```json
{
  "types":      [{ "conceptId": "uuid", "code": "PR_TYPE_CLINIC", "display": "Clinic practice type" }],
  "practices":  [{ "id": "uuid", "name": "…", "typeConceptId": "uuid" }],
  "currencies": [{ "conceptId": "uuid", "code": "BOB" }, { "conceptId": "uuid", "code": "USD" }]
}
```

### Diferencias de implementación respecto de §2

- La lista pagina por `(code, id)` con cursor opaco; `q` escapa `%` y `_` (son literales).
- `POST` acepta `currencyConceptId` sólo BOB/USD (422 `SERVICE_CATALOG_CURRENCY_NOT_SUPPORTED` si no). `PATCH` sin ningún campo editable es 422 `SERVICE_CATALOG_EMPTY_UPDATE`.
- `defaultPrice` se acepta **sólo como texto** (`"100.00"`); un `number` en el cuerpo es 400. Siempre se devuelve con dos decimales.
- Los 409 de versión llevan `reason: SERVICE_CATALOG_VERSION_MISMATCH` y `details: { expected, actual }`.
- `display` de los tipos sale tal cual del concepto (hoy en inglés técnico: «Clinic practice type»). Traducirlo es trabajo de terminología, no del editor.
