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
| H0.3.3 | Evidencia del menú (perfiles superadmin/paciente, 3 viewports × 2 temas) | `yarn pw playwright/superadmin-portal.spec.ts -g 'menu\|redirecciones'` | A MEDIAS: menú del superadmin 6/6 y redirecciones 7/7 verificados en navegador contra el front real; sin correr el perfil `paciente` (no hay cuenta de paciente sembrada) |
| H0.3.4 | La redirección de sección conserva el fragmento `#ancla` (hallado en navegador) | `app.routes.spec.ts` 69/69 y `playwright/superadmin-redirecciones.mjs` 7/7 | HECHO (VERIFIED local) · `evidencia/H0.3.3-redirecciones-navegador.log` |
| H0.1.4 | ~~Alinear `E2E_ADMIN_EMAIL` y perfil mock al correo nuevo~~ | — | — | DESCARTADO: `playwright/support/actores.ts:119` ya lee `E2E_ADMIN_EMAIL` del entorno; cambiar el valor por defecto rompería a quien siembra `admin@alovida.com` (también lo usan Cypress y una int-spec de la API). Se corre con `E2E_ADMIN_EMAIL=admin@alovidasalud.com`. El perfil mock (`superadmin@alovida.mock`) no depende del correo real |

## H1.3 — Portada «Observabilidad»
| ID | Microtarea | DoD | Estado |
|---|---|---|---|
| H1.3.1 | Tipos y cliente `OpsTrafficClient` (`ops-traffic.types.ts`, `ops-traffic.client.ts`) | `tsc -p tsconfig.app.json --noEmit`; `check-client-prefixes` | HECHO (RUNS) |
| H1.3.2 | Simulador `ops-traffic.handlers.ts` con las reglas de la API (ventana, 422, totales = suma) | `ops-traffic.handlers.spec.ts` 5/5; `check-mock-vs-client` sin hallazgos míos | HECHO (TESTED) |
| H1.3.3 | Pantalla `features/admin/observability` (una tarjeta con 4 pestañas, estados M34) | `observability.spec.ts` 11/11; ESLint exit 0 | HECHO (TESTED) |
| H1.3.4 | Ruta `superadmin/observability` y sección `disponible`; contrato documentado en `docs/integrations/backend-api.md` | tests de navegación/rutas (784 verdes, 1 rojo previo); `check-api-contract-drift` ya no nombra mis 2 operaciones | HECHO (TESTED) |
| H1.3.5 | Prueba visual 3 anchos × 2 temas × 4 pestañas, mirada, y comparación contra la respuesta de red | `node playwright/superadmin-observabilidad-visual.mjs` | HECHO (VERIFIED local): 6/6 contra el simulador y 6/6 contra la **API real** (login `admin@alovidasalud.com`, la cifra en pantalla = `measured.requests` de la respuesta de red), 60 capturas inspeccionadas · `evidencia/H1.3-visual-demo.log`, `H1.3-visual-real.log` |
| H1.3.6 | Gates manuales (CI caído) | `scripts/check-*.mjs` | HECHO: ninguno nombra un archivo mío; rojos previos listados en el REPORTE |

## H2.3 — Catálogo de datos completo (front)
| ID | Microtarea | DoD | Estado |
|---|---|---|---|
| H2.3.1 | Tipos (`SchemaDescription`), `listColumnEvidence` y simulador (`catalog-vault.mock.ts`: descripción por schema, ficha importada con plantilla, nota de FK) | `tsc`; `admin-portal.handlers.spec.ts` | HECHO (TESTED) |
| H2.3.2 | Pestaña «Esquemas» (módulo de la bóveda, negocio, sistema, fuente; «sin módulo» y «sin propósito» dichos) | `data-catalog.spec.ts` 6 casos nuevos | HECHO (TESTED) |
| H2.3.3 | Ficha: Negocio / Por qué existe / Sistema, badge de origen, aviso de plantilla, «Nota de la bóveda» por FK (lectura bajo demanda), «Relaciones» | `catalog-object-detail.spec.ts` 7 casos nuevos | HECHO (TESTED) |
| H2.3.4 | Prueba visual real (3 anchos × 2 temas) | `node playwright/superadmin-catalogo-visual.mjs` con `E2E_MODO=real` | HECHO (VERIFIED local) · `evidencia/H2.3-visual-real.log` |
| H2.3.5 | Mutación «Aprobar» real: UI → petición → respuesta → fila → volver a leer → UI | `node playwright/superadmin-catalogo-aprobacion.mjs` | HECHO (VERIFIED local) · `evidencia/H2.3-aprobacion-real.txt` |

## H3.4 — Catálogo de flujos (front)
| ID | Microtarea | DoD | Estado |
|---|---|---|---|
| H3.4.1 | Tipos y cliente `FlowsClient`, simulador `flows.handlers.ts` con las reglas de la API | `flows.handlers.spec.ts` · `tsc` | HECHO (TESTED) · `evidencia/H3.4-flows-tests.log` |
| H3.4.2 | Lista `features/admin/flows` (filtros, contrato, cobertura, última corrida; estados M34) | `flows.spec.ts` | HECHO (TESTED) |
| H3.4.3 | Detalle (una tarjeta con pestañas Árbol · Endpoints · Casos QA · Fuente) y árbol presentacional | `flow-detail.spec.ts` + `flow-tree.spec.ts`, con axe | HECHO (TESTED) |
| H3.4.4 | Rutas `superadmin/flows` y `superadmin/flows/:flowId`, sección `disponible`, contrato en `backend-api.md` | `app.routes`/navegación en verde (1 rojo previo) · `check-api-contract-drift` y `check-doc-coverage` ya no nombran `flows` | HECHO (TESTED) |
| H3.4.5 | Prueba visual 3 anchos × 2 temas, simulador y API real, mirando las capturas | `node playwright/superadmin-flujos-visual.mjs` (`E2E_MODO=demo` y `real`) | HECHO (VERIFIED local) · 6/6 y 6/6 · `evidencia/H3.4-visual-informes.log` |
| H3.4.6 | Gates manuales (CI caído) | `scripts/check-*.mjs` | HECHO: ninguno nombra un archivo mío; rojos previos sin cambios · `evidencia/H3.4-gates.log` |

## H5.2
| ID | Microtarea | DoD | Estado |
|---|---|---|---|
| H5.2.1 | Pestañas «Por flujo» / «Por endpoint» en `qa-lab` | spec + Playwright `orquestacion` | TODO |

## H6 — Alta administrativa de un médico (pedido del 17/10, tras el PR)
**Resultado observable:** un `SECURITY_ADMIN` abre «Usuarios › Registrar médico», completa lo mínimo y recibe el código de activación de un solo uso (nunca una contraseña) para entregarlo al médico. Consume `POST /iam/users/assisted-practitioner-registration`, que la API ya tiene y el front no usaba.
**Kill-test:** sin el cliente/pantalla, `grep -rn assisted-practitioner-registration src/app` sólo nombra el contrato generado.
**Alcance IN:** formulario mínimo (nombre y apellidos, correo, CI y departamento emisor, matrícula, hasta cuatro especialidades opcionales, rol asistencial, motivo), pantalla de resultado con el token, cliente, tipos, simulador con las reglas de la API, ruta con guarda de sección, enlace desde «Usuarios», doc de contrato, pruebas, prueba en navegador contra la API real.
**Alcance OUT:** el formulario completo del autorregistro (3 200 líneas: domicilio, coordenadas, credenciales con PDF, consultorio propio) — el médico lo completa en su perfil; una **lista** administrativa de médicos (no hay endpoint de listado: es la deuda «Listado pendiente»); verificar la matrícula.
**Ambigüedades:** (1) el rol `CLINICIAN` se ofrece marcado por defecto porque sin rol la cuenta «no puede hacer nada» (comentario de la API), pero la matrícula nace PENDIENTE de verificación → confirmar con quien gobierna permisos; (2) los códigos de rol válidos son los de `GET /authz/roles`: se ofrece sólo `CLINICIAN`, el que usa el resto del front, y no se inventan otros.

| ID | Microtarea | DoD | Estado |
|---|---|---|---|
| H6.1 | Tipos y `AssistedPractitionerClient.register` (cliente propio y no un método más de `IamClient`, ya largo; cuerpo armado campo por campo, sin claves vacías) | `assisted-practitioner.client.spec.ts` (5) + `tsc` | HECHO — `evidencia/H6-tests.log`, `H6-typecheck.log` |
| H6.2 | Simulador `POST /iam/users/assisted-practitioner-registration` con las reglas de la API (campos obligatorios, 403 sin rol, token de un solo uso) | `assisted-practitioner.handlers.spec.ts` (7) | HECHO — `evidencia/H6-tests.log` |
| H6.3 | Pantalla `features/admin/practitioner-assisted-registration` (UNA tarjeta con 3 pestañas, no formulario paginado: regla del cliente §5; resultado con token). Desvío: `check-form-pages` pedía paginar → excepción escrita con su motivo | spec del componente (11, con axe en formulario y en resultado) | HECHO — `evidencia/H6-tests.log` |
| H6.4 | Ruta `administration/users/practitioner` con `seccionRolesGuard` (en su propio `.route.ts`: `app.routes.ts` está en su techo de líneas), botón «Registrar médico» en «Usuarios», contrato en `backend-api.md` | navegación/rutas en verde; `check-doc-coverage` y `check-api-contract-drift` sin hallazgos de esta pantalla | HECHO — `evidencia/H6-tests.log`, `H6-gates.log` (los rojos que quedan son previos) |
| H6.5 | Prueba real en navegador contra la API: alta → token → activar cuenta → el médico inicia sesión; 3 anchos × 2 temas, mirando capturas | `node playwright/superadmin-registrar-medico.mjs` + SQL (usuario, perfil, matrícula PENDIENTE, rol) | HECHO — `evidencia/H6-playwright-real.log` (6/6, sin fallos), `H6-persistencia-sql.txt` |

## H7 — Contingencia: los cambios, en la rama `mockup` (pedido del 17/10)
**Resultado observable:** quien corre la rama `mockup` (simulador, sin API) entra con el superadministrador local (`admin@alovidasalud.com`, cualquier contraseña no vacía) y recorre Superadministración y «Registrar médico».
**Alcance IN:** los 6 commits del front (5 de la Superadministración ya en `dev` + H6) llevados con `cherry-pick` a una rama nueva con base `origin/mockup`; adaptar lo que `mockup` nombra distinto; alias de la cuenta en el simulador; prueba en navegador contra el simulador. **OUT:** API y bóveda (no se tocan); poner `mockup` al día con `dev`.
**Ambigüedad:** «ese usuario que creamos» se tomó como `admin@alovidasalud.com` (el de la API real local); en `mockup` entra a la cuenta `superadmin` del simulador.

| ID | Microtarea | DoD | Estado |
|---|---|---|---|
| H7.1 | Rama `claude-marcelo/serene-planck-1q7zje-mockup` desde `origin/mockup` + 6 `cherry-pick`; conflictos resueltos conservando las dos partes (`app.routes.ts`, `navigation.subgroups.spec.ts`, `backend-api.md`); identificadores adaptados a los de `mockup` (`CamposDeNombre`, `grupoDeNombre`, `unirNombres`; helper `validation` = 422) | `typecheck` exit 0 + ESLint de lo tocado | HECHO |
| H7.2 | Alias `admin@alovidasalud.com` → cuenta `superadmin` del simulador (`ALIAS_DE_CUENTA`), con prueba y nota en el README del simulador | `mock-backend.spec.ts` | HECHO |
| H7.3 | Prueba en navegador contra el simulador con ese usuario: «Registrar médico» (6 combinaciones), Observabilidad y Flujos (escritorio claro) | `playwright/superadmin-*.mjs` con `E2E_MODO=demo` | HECHO con reservas — ver REPORTE |

## Riesgos
Ver plan aprobado §Riesgos. Entorno: sin `node_modules` (Yarn 4 PnP) en esta sesión → todo DoD que requiera instalar/ejecutar se declara `NOT_RUN` hasta lograrlo.
