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
| H0.3.3 | Evidencia del menú (perfiles superadmin/paciente, 3 viewports × 2 temas) | `yarn pw playwright/superadmin-portal.spec.ts -g 'menu\|redirecciones'` | NOT_RUN (requiere navegador y servidor) |
| H0.1.4 | ~~Alinear `E2E_ADMIN_EMAIL` y perfil mock al correo nuevo~~ | — | — | DESCARTADO: `playwright/support/actores.ts:119` ya lee `E2E_ADMIN_EMAIL` del entorno; cambiar el valor por defecto rompería a quien siembra `admin@alovida.com` (también lo usan Cypress y una int-spec de la API). Se corre con `E2E_ADMIN_EMAIL=admin@alovidasalud.com`. El perfil mock (`superadmin@alovida.mock`) no depende del correo real |

## H1.3 / H2.3 / H3.4 / H5.2
Cliente y tipos (`platform.types.ts`, `platform.client.ts`), mock (`admin-portal.handlers.ts`), pantallas `features/admin/{observability,flows}` y cambios en `data-catalog`/`qa-lab`, con los gates `check-*.mjs` en 0 y capturas 390/768/1440 × claro/oscuro.

## Riesgos
Ver plan aprobado §Riesgos. Entorno: sin `node_modules` (Yarn 4 PnP) en esta sesión → todo DoD que requiera instalar/ejecutar se declara `NOT_RUN` hasta lograrlo.
