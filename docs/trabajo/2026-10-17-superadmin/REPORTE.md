# Reporte — Superadministración de AloVida (lado front)

> **AVANCE: 24 / 28 — 85,7 %.** (`microtareas HECHO / total` del PLAN.md de este repo; `A MEDIAS`, `DESCARTADO` y `NOT_RUN` no suman. Hecho: H0.2.1–4, H0.3.1–2, H0.3.4, H1.3.1–6, H2.3.1–5, H3.4.1–6. Pendiente: H5.2.1 (TODO); A medias: H0.3.3; descartada: H0.1.4.)

- Fecha: 2026-10-17 · Plan: [PLAN.md](./PLAN.md) · Rama: `claude-marcelo/serene-planck-1q7zje`
- Peldaño de evidencia alcanzado: **`VERIFIED` local** para la portada «Observabilidad» y las redirecciones: se ejercitaron en navegador contra el front y la **API real** (PostgreSQL 16 descartable, tráfico HTTP real) y se miraron 60 capturas. **No** `REGRESSION_VERIFIED`: no se corrió la suite completa ni se probó el perfil `paciente`.

## Completado
| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H0.2.1–H0.2.4 | Grupo `Superadministración` (entre «Facturación» y «Mi cuenta»), ícono, bloque «Plataforma», zona `plataforma` en «Tus accesos», 10 secciones (4 retiradas del menú + 6 nuevas) | `yarn test --include='src/app/core/navigation/**/*.spec.ts' --include='src/app/app.routes*.spec.ts'` | 292 verdes, 1 rojo **preexistente** · `evidencia/H0-navegacion-y-rutas.log` |
| H0.3.1–H0.3.2 | Rutas `superadmin/*`; las 4 viejas y sus 2 hijas redirigen conservando parámetro, query y fragmento; 7 enlaces internos actualizados | ídem (8 pruebas nuevas en `app.routes.spec.ts`) y specs de catálogo/QA Lab | 19/19 en `evidencia/H0-admin-catalog-qalab.log` |
| Gates | `typecheck` exit 0; ESLint sobre los 18 archivos tocados exit 0; `check-max-lines`, `check-route-prefixes`, `check-client-prefixes`, `check-architecture` sin hallazgos míos | ver `evidencia/` | PASS (los del baseline preexistente se listan abajo) |

| H2.3.1–3 | «Esquemas» (módulo de la bóveda, negocio, sistema, fuente; «sin módulo» y «sin propósito» dichos); ficha con Negocio / Por qué existe / Sistema, badge «Importado de la bóveda · pendiente de revisión», aviso de plantilla, «Nota de la bóveda» por clave foránea (lectura bajo demanda) y «Relaciones»; simulador con las reglas de la API | `yarn test --include admin/**, handlers, navegación, rutas, data-access/admin-portal` | 1 127 verdes; 3 rojos **previos** (ver abajo) · `evidencia/H2.3-tests.log` |
| H2.3.4 | Prueba visual contra la API real (iam importado): 3 anchos × 2 temas, esquemas → ficha importada → nota de FK → relaciones, sin desborde, consola ni 4xx/5xx | `node playwright/superadmin-catalogo-visual.mjs` (`E2E_MODO=real`) | 6/6, 30 capturas miradas · `evidencia/H2.3-visual-real.log` |
| H2.3.5 | **Mutación «Aprobar», de punta a punta y real:** A edita una ficha importada y la envía (`PUT` 200, `NEEDS_REVIEW`, origen `MANUAL`); A intenta aprobar la suya (`POST review` 403, la pantalla explica la segregación, 0 decisiones en la base); B la aprueba (200; fila `APPROVED` con B como revisora y ficha `APPROVED` sobre la revisión vigente); al volver a leer, «Aprobada», ya sin «Importado de la bóveda» | `node playwright/superadmin-catalogo-aprobacion.mjs` | 19/19 comprobaciones · `evidencia/H2.3-aprobacion-real.txt` |

| H3.4.1–4 | Catálogo de flujos en el front: lista, detalle con árbol (listas anidadas con botones de plegado), pestañas Endpoints / Casos QA / Fuente, cliente, simulador, rutas y sección `disponible` | `yarn test --include 'admin/flows/**/*.spec.ts' + flows.handlers.spec.ts + navegación + rutas` | 335 verdes, 1 rojo **previo** (`navigation.subgroups`) · ESLint exit 0 · `typecheck` exit 0 · `evidencia/H3.4-*.log` |
| H3.4.5 | Prueba visual real (6 combinaciones) contra el simulador y contra la API real, con las capturas **miradas** | `node playwright/superadmin-flujos-visual.mjs` | demo 6/6 (48 capturas) y real 6/6 (36), sin desborde, sin errores de consola ni 4xx/5xx inesperadas. **Defectos hallados mirando y corregidos:** el detalle no se recargaba al pasar de un flujo a otro (leía el parámetro una vez); en teléfono la sangría del árbol dejaba columnas de una palabra; la fecha de la última corrida se pegaba a su badge; la columna «Última corrida» quedaba cortada en tableta |
| H3.4.6 | Gates manuales | `scripts/check-*.mjs` | `css-tokens`, `contrast`, `client-prefixes`, `route-prefixes` en 0; los rojos son los previos |

## A medias
### H0.3.3 — Menú del perfil `paciente`
- **Qué anda:** el menú del superadmin con las 6 secciones (6/6 combinaciones, simulador y API real) y las 7 redirecciones en navegador, incluidas query y fragmento.
- **Qué no anda / no se probó:** que un `paciente` **no** vea «Superadministración» ni llegue a `/superadmin/observability`: en la API real no hay una cuenta de paciente sembrada (`SEED_CONTENT_ON_BOOT=false`). Lo cubren las pruebas unitarias de navegación y `seccionRolesGuard`, no un navegador.
- **Qué falta exactamente:** sembrar o crear una cuenta de paciente y recorrer `/dashboard` y `/superadmin/observability` con ella (o correr el script contra el perfil `paciente` del simulador).
- **Dónde quedó:** sin cambios de código pendientes; compila.

## Pendiente
| ID | Estado | Qué lo destraba |
|---|---|---|
| H0.1.4 | `DESCARTADO` | Ver PLAN.md: `E2E_ADMIN_EMAIL` ya es configurable |
| H5.2.1 | `TODO` | Segunda entrega: pestañas «Por flujo» / «Por endpoint» en `qa-lab`; depende de H5.1 (API) |

## Evidencia
`docs/trabajo/2026-10-17-superadmin/evidencia/`: `H2.3-tests.log`, `H2.3-visual-real.log`, `H2.3-aprobacion-real.txt`, `H1.3-observability-tests.log` (16/16), `H1.3-visual-real.log` (6/6 contra la API real), `H0.3.3-redirecciones-navegador.log` (7/7), `H0-hallazgo-query-redirecciones-texto.log`, `H1.3-navegacion-y-mock.log` (784 verdes / 1 rojo previo), `H1.3-eslint.log`, `H1.3-gates.log`, `H1.3-visual-demo.log`; y `baseline-navegacion.log` (antes: 284 verdes / 1 rojo), `H0-navegacion-y-rutas.log` (después: 292 / 1), `H0-admin-catalog-qalab.log`, `H0-typecheck.log`.

## No cubierto
- La API real corrió como proceso suelto contra un PostgreSQL 16 descartable (sin Timescale), con un parche de DI aplicado sólo al `dist` de la copia; no es el stack de Docker ni un despliegue.
- «Ejecutar» un flujo desde la pantalla no existe todavía (H5.2): el catálogo sólo lee. Con la API real se vio el estado «Sin correr»; los veredictos PASSED/FAILED por rama se vieron en el **simulador** y, contra Postgres real, en el int-spec de la API.
- Teclado: el árbol se manejó con clic y con `aria-expanded`; el recorrido completo con Tab/Enter no se probó en navegador, ni con lector de pantalla (axe automático en los specs, sin violaciones).
- En el árbol no se usa el rol `tree` a propósito (ver el comentario de `flow-tree.ts`).
- No se corrió la suite completa del front (4985 pruebas); sólo las dirigidas y las de `admin/**`, navegación, rutas, handlers y data-access del portal (1 130).
- «Volver a leer» en la prueba de aprobación es navegar y pedir de nuevo al servidor, no una recarga dura del navegador (la sesión vive en memoria).
- `ng build` no se corrió: `tsc` no revisa plantillas; las plantillas se ejercitaron en los tests del componente y en el navegador (`ng serve`).
- `docs/reports/generated/*` y `ROUTE_HEALTH_MATRIX.md` siguen listando las rutas `administration/*` viejas (se regeneran con herramientas que necesitan navegador).

## Desvíos del plan
- `navigation.map.ts`, `app.routes.ts` y `navigation.types.ts` están congelados por el ratchet de `check-max-lines`; en vez de subir el techo se partieron: `navigation.platform.ts` (10 secciones), `redirecciones-heredadas.ts` y `navigation.groups.ts` (re-exportado desde `navigation.types.ts`).
- Las 2 hijas con parámetro redirigen por función y no por texto (ver hallazgo 1).
- En `navigation.subgroups.spec.ts` se agregó `superadmin/observability` a `SUELTAS_A_PROPOSITO` y en `navigation.service.spec.ts` el grupo nuevo al orden esperado: ambos son cambios de comportamiento pedidos, ninguna aserción se debilitó.

## Hallazgos de H2.3
- **3 pruebas en rojo previas** que este trabajo no causó: `navigation.subgroups.spec` («psychological-help», ya conocido) y 2 de `patient-list.spec` (fallan igual con mis cambios tracked retirados con `git stash`).
- El simulador de «Esquemas» y el real coinciden en el caso de datos: 61 schemas, 59 con módulo, 2 sin él (`medical_groups`, `surveys`); `accounting` y `clinical` muestran «La bóveda no describe el propósito de negocio de este módulo».
- La prueba de mutación **usa dos cuentas locales** (`admin@alovidasalud.com` y `revisor@alovidasalud.com`, ambas `SUPERADMIN`+`SECURITY_ADMIN`, contraseña `12345678`): sólo local y dev, como se decidió. Dejó en la base descartable `iam.mfa_factors` aprobada y `iam.devices`/`iam.sessions` como borradores manuales.
- El texto de «Negocio» de la mayoría de los módulos está en **inglés** (la bóveda), mezclado con la interfaz en español; no se traduce porque sería inventar.
- La tabla de datos compartida (`data-table`) con `maxHeight` no deja fijo el encabezado al desplazar: visible en «Esquemas» (61 filas). Es del componente compartido; no se tocó.

## Hallazgos fuera de alcance (H1.3)
- **Confirmado en navegador:** las redirecciones de **texto** de `app.routes.ts` pierden la query: `/auth/verificar?token=abc123` termina en `/auth/verify-email` **sin el token** (el enlace del correo de verificación) y `/ajustes?x=1` en `/auth` (`evidencia/H0-hallazgo-query-redirecciones-texto.log`). Código previo, no tocado: se arregla igual que las secciones (`redireccionConQuery`), pero afecta a otros flujos y requiere decisión del dueño.
- Gates en rojo **previos** que no son de este trabajo: `check-api-contract-drift` (19 operaciones sin documentar), `check-colores-sueltos` (`map.css`), `check-form-pages` (`inline-name-fields`), `check-max-lines` (`symptom-check`, `public-profile-card.css`), `check-mock-vs-client` (8 operaciones), `check-usted` (`symptom-check/text.ts`).
- El selector `Hoy/24 h/7 días` usa «Hoy» = 00:00 UTC (las 20:00 del día anterior en La Paz); está dicho en pantalla. Decisión pendiente del usuario si se quiere hora de La Paz.

## Riesgos residuales
- Un `SECURITY_ADMIN` de organización también verá «Superadministración» (mismos roles que ya tenía en «Administración › Plataforma»).

## Decisiones y ambigüedades
- «Reformular» se interpretó como **mover** las 4 secciones bajo el grupo nuevo (confirmar con el usuario).

## Hallazgos fuera de alcance (no se arreglan acá)
1. **Toda redirección de texto del router pierde el query** (medido en el harness del repo, no en navegador): `/auth/verificar?token=abc → /auth/verify-email`, `/ajustes?x=1 → /settings`. El comentario de `app.routes.ts` afirma lo contrario. Puede afectar los enlaces de verificación ya enviados por correo.
2. **Gates rojos previos a este trabajo:** `check-mock-vs-client` (8 operaciones), `check-usted` (fixtures de community), `check-doc-links` (`docs/tareas/…`), `check-max-lines` (`symptom-check` ×2, `public-profile-card.css`), 1 test de `navigation.subgroups.spec` (`psychological-help` sin bloque).
3. **Entorno:** `repo.yarnpkg.com` denegado por el proxy → Yarn 4.18.0 se obtuvo de `@yarnpkg/cli-dist` (registro npm permitido) fuera del repo; `CYPRESS_INSTALL_BINARY=0`.
