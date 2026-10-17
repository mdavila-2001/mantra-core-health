# Plan — Superadministración de AloVida (lado front)

- Fecha: 2026-10-17 · Repos afectados: mantra-core-health (este), mantra-core-health-api, mantra_core_technologies_health_docs
- Plan completo y decisiones: plan aprobado de la sesión 01BZAD7AhJktetTdBRayMtZ5; acá las microtareas del front.
- Resultado observable: grupo de menú «Superadministración» (sólo SUPERADMIN y los roles de cada sección) con Observabilidad, Catálogo de datos, Catálogo de flujos, Orquestación de pruebas, Analítica web y Operación; las rutas `administration/{data-catalog,web-analytics,qa-lab,operations}` redirigen a `superadmin/*`.
- Kill-test: con el perfil `paciente` el grupo aparece, o una ruta vieja da 404 → no está hecho.

## Alcance
- IN: H0.2–H0.3 navegación y rutas, H1.3 portada, H2.3 catálogo, H3.4 flujos, H5.2 orquestación.
- OUT: roles operativos, cross-tenant, CI del front (caído; `scripts/check-*.mjs` a mano), nuevas librerías de gráficos.
- Reglas: ViewState M34, sin Tailwind, una tarjeta con pestañas (`composition-rules.md` §5), Playwright sin `networkidle`, NO_EVIDENCE_NO_DONE.

## H0 — Grupo, zona, secciones, rutas
| ID | Microtarea | DoD | Estado |
|---|---|---|---|
| H0.2.1 | `NAV_GROUPS` += `'Superadministración'` antes de `'Mi cuenta'` | `yarn typecheck` | HECHO (TESTED) |
| H0.2.2 | Zona `plataforma` en `access-tree.ts` | `yarn test --include='src/app/core/navigation/access-tree.spec.ts'` | HECHO (TESTED) |
| H0.2.3 | Subgrupo «Plataforma» → grupo nuevo | `…navigation.subgroups.spec.ts` | HECHO (TESTED) |
| H0.2.4 | 6 secciones `superadmin/*` + 4 viejas `fueraDelMenuPara:[ANY_ROLE]` | `…navigation.map.spec.ts`; `node scripts/check-route-prefixes.mjs` | HECHO (TESTED) |
| H0.3.1 | `PANTALLAS_DIFERIDAS` + `SECCIONES_REDIRIGIDAS` + `superadmin`→observability | `yarn test --include='src/app/app.routes.spec.ts'` | HECHO (TESTED) |
| H0.3.2 | Hijas renombradas + redirecciones con parámetro | ídem | HECHO (TESTED) |
| H0.3.3 | Evidencia del menú (perfiles superadmin/paciente, 3 viewports × 2 temas) | `yarn pw playwright/superadmin-portal.spec.ts -g 'menu\|redirecciones'` | A MEDIAS: menú del superadmin verificado en navegador (6/6 combinaciones, `evidencia/H1.3-visual-demo.log`); sin correr el perfil `paciente` ni las redirecciones en navegador |
| H0.1.4 | ~~Alinear `E2E_ADMIN_EMAIL` y perfil mock al correo nuevo~~ | — | — | DESCARTADO: `playwright/support/actores.ts:119` ya lee `E2E_ADMIN_EMAIL` del entorno; cambiar el valor por defecto rompería a quien siembra `admin@alovida.com` (también lo usan Cypress y una int-spec de la API). Se corre con `E2E_ADMIN_EMAIL=admin@alovidasalud.com`. El perfil mock (`superadmin@alovida.mock`) no depende del correo real |

## H1.3 — Portada «Observabilidad»
| ID | Microtarea | DoD | Estado |
|---|---|---|---|
| H1.3.1 | Tipos y cliente `OpsTrafficClient` (`ops-traffic.types.ts`, `ops-traffic.client.ts`) | `tsc -p tsconfig.app.json --noEmit`; `check-client-prefixes` | HECHO (RUNS) |
| H1.3.2 | Simulador `ops-traffic.handlers.ts` con las reglas de la API (ventana, 422, totales = suma) | `ops-traffic.handlers.spec.ts` 5/5; `check-mock-vs-client` sin hallazgos míos | HECHO (TESTED) |
| H1.3.3 | Pantalla `features/admin/observability` (una tarjeta con 4 pestañas, estados M34) | `observability.spec.ts` 11/11; ESLint exit 0 | HECHO (TESTED) |
| H1.3.4 | Ruta `superadmin/observability` y sección `disponible`; contrato documentado en `docs/integrations/backend-api.md` | tests de navegación/rutas (784 verdes, 1 rojo previo); `check-api-contract-drift` ya no nombra mis 2 operaciones | HECHO (TESTED) |
| H1.3.5 | Prueba visual 3 anchos × 2 temas × 4 pestañas, mirada, y comparación contra la respuesta de red | `node playwright/superadmin-observabilidad-visual.mjs` | A MEDIAS: 6/6 ✓ y 30 capturas inspeccionadas contra el **simulador**; la comparación con la respuesta de red (`E2E_MODO=real`) NOT_RUN |
| H1.3.6 | Gates manuales (CI caído) | `scripts/check-*.mjs` | HECHO: ninguno nombra un archivo mío; rojos previos listados en el REPORTE |

## H2.3 / H3.4 / H5.2
Pantallas y cambios en `data-catalog`, `features/admin/flows` y `qa-lab`, con los gates `check-*.mjs` en 0 y capturas 390/820/1440 × claro/oscuro.

## Riesgos
Ver plan aprobado §Riesgos. Entorno: sin `node_modules` (Yarn 4 PnP) en esta sesión → todo DoD que requiera instalar/ejecutar se declara `NOT_RUN` hasta lograrlo.
