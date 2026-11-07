# Carril C — carga masiva de catálogo de farmacia

Pantalla nueva `src/app/features/admin/catalog-bulk/` + cliente
`core/data-access/admin-portal/catalog-bulk.client.ts`. Usa
`POST /pharmacies/:pharmacyId/{categories,products,prices,sites}/bulk`
(CREATE/UPDATE/UPSERT, `dryRun`, ≤1000 filas). No toca `superadmin/bulk-imports`.

## Ruta y menú

- Ruta: `superadmin/catalog-bulk`, registrada SOLO como ruta hija en
  `src/app/routes/app.routes.hijas-admin.ts` (excepción autorizada por Ender),
  con `seccionRolesGuard` y roles `SECURITY_ADMIN`, `PHARMACY_STAFF`.
- Menú: NO registrado. Propuesta: sección «Carga de catálogo de farmacia», grupo
  «Superadministración», junto a «Cargas masivas» (`navigation.platform.ts`).
  Pendiente de decisión.

## Estados

| Afirmación | Estado | Evidencia |
|---|---|---|
| Cliente, lectura de CSV/JSON y handler simulado | TESTED | `unit-tests.log` (10 pruebas) |
| Flujo UI→petición→respuesta→persistencia→recarga→UI contra el simulador (categorías) | VERIFIED_FUNCTIONAL_ONLY | `demo.mjs`, `demo.log`, `requests.json`, capturas `DESPUES-*` |
| Productos, precios, sucursales en navegador | no se ejecutó (solo pruebas unitarias del handler) | — |
| Persistencia de sucursales | no se ejecutó: no hay endpoint de lectura | — |
| Contra la API real / Postgres | no se ejecutó | — |
| Revisión visual independiente, móvil, tema oscuro | no se ejecutó | — |
| `pre-push-gate.mjs` | ver `pre-push-gate.log` | `pre-push-gate.log` |
| Spec `playwright/catalog-bulk.spec.ts` (simulador, no PostgreSQL) | ver `pre-push-gate.log` | `pre-push-gate.log` |

## Simulado

`core/mock/handlers/catalog-bulk.handlers.ts` es un handler NUEVO y SIMULADO:
reproduce el contrato y persiste delegando en los handlers de categorías y
productos del simulador. No mide nada de la API real. Para registrarlo se tocó
`core/mock/handlers/index.ts` (1 import + 1 llamada), fuera de la lista de
archivos: excepción autorizada por Ender en la sesión.
