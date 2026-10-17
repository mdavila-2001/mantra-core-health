# Reporte — Superadministración de AloVida (lado front)

> **AVANCE: 11 / 14 — 78,6 %.** (`microtareas HECHO / total` del PLAN.md de este repo; `A MEDIAS`, `DESCARTADO` y `NOT_RUN` no suman. Hecho: H0.2.1–4, H0.3.1–2, H1.3.1–4, H1.3.6. H2.3, H3.4 y H5.2 sin empezar y aún sin microtareas.)

- Fecha: 2026-10-17 · Plan: [PLAN.md](./PLAN.md) · Rama: `claude-marcelo/serene-planck-1q7zje`
- Peldaño de evidencia alcanzado: **`TESTED`** (tests dirigidos en verde) y, para la portada, **`VERIFIED_FUNCTIONAL_ONLY`-con-simulador**: se ejercitó en navegador y se miraron 30 capturas, pero contra el backend simulado; **no** contra la API real (el simulador responde dentro de la aplicación, sin red).

## Completado
| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H0.2.1–H0.2.4 | Grupo `Superadministración` (entre «Facturación» y «Mi cuenta»), ícono, bloque «Plataforma», zona `plataforma` en «Tus accesos», 10 secciones (4 retiradas del menú + 6 nuevas) | `yarn test --include='src/app/core/navigation/**/*.spec.ts' --include='src/app/app.routes*.spec.ts'` | 292 verdes, 1 rojo **preexistente** · `evidencia/H0-navegacion-y-rutas.log` |
| H0.3.1–H0.3.2 | Rutas `superadmin/*`; las 4 viejas y sus 2 hijas redirigen conservando parámetro, query y fragmento; 7 enlaces internos actualizados | ídem (8 pruebas nuevas en `app.routes.spec.ts`) y specs de catálogo/QA Lab | 19/19 en `evidencia/H0-admin-catalog-qalab.log` |
| Gates | `typecheck` exit 0; ESLint sobre los 18 archivos tocados exit 0; `check-max-lines`, `check-route-prefixes`, `check-client-prefixes`, `check-architecture` sin hallazgos míos | ver `evidencia/` | PASS (los del baseline preexistente se listan abajo) |

## A medias
### H1.3.5 — Prueba visual de la portada
- **Qué anda:** `playwright/superadmin-observabilidad-visual.mjs` pasa 6/6 (390/820/1440 × claro/oscuro): el grupo «Superadministración» muestra sus 6 secciones, la pantalla carga, solicitudes = exitosas + fallidas, las 4 pestañas se renderizan, sin desborde horizontal, sin errores de consola. Las capturas se miraron y llevaron a dos arreglos reales: el selector de ventana truncaba «7 d…» en teléfono y la tabla de endpoints se cortaba a la derecha (ahora `stackedOnMobile`).
- **Qué no anda / no se probó:** la comparación entre lo que se ve y el cuerpo de la respuesta HTTP (`E2E_MODO=real`) no se corrió: no hay API sirviendo ni login real. Tampoco el menú para el perfil `paciente`.
- **Qué falta exactamente:** levantar la API (ver REPORTE de la API: la app no arranca por un defecto de DI ajeno), sembrar `admin@alovidasalud.com`, y correr el script con `E2E_MODO=real E2E_BASE_URL=… E2E_IDENTIFICADOR=… E2E_CLAVE=…`.
- **Dónde quedó:** `playwright/superadmin-observabilidad-visual.mjs`, capturas en `artifacts/superadmin-observabilidad/` (no versionadas; el log está en `evidencia/H1.3-visual-demo.log`). Compila y los tests pasan.

### H0.3.3 — Menú y redirecciones en navegador
- **Qué anda:** el menú del superadmin con las 6 secciones, verificado en 6 combinaciones (cajón plegado en teléfono y tableta).
- **Qué no anda / no se probó:** el perfil `paciente` (no debe ver el grupo) y las redirecciones `administration/*` → `superadmin/*` en navegador, incluida la pérdida de query de las redirecciones de texto (hallazgo 1).
- **Qué falta exactamente:** un barrido con `paciente` y navegar a las 4 rutas viejas con `?x=1`.
- **Dónde quedó:** mismo script; sin cambios de código pendientes.

## Pendiente
| ID | Estado | Qué lo destraba |
|---|---|---|
| H0.1.4 | `DESCARTADO` | Ver PLAN.md: `E2E_ADMIN_EMAIL` ya es configurable |
| H2.3, H3.4, H5.2 | `TODO` | Dependen de las lecturas de la API (H2.2, H3.3, H5.1) |

## Evidencia
`docs/trabajo/2026-10-17-superadmin/evidencia/`: `H1.3-observability-tests.log` (16/16), `H1.3-navegacion-y-mock.log` (784 verdes / 1 rojo previo), `H1.3-eslint.log`, `H1.3-gates.log`, `H1.3-visual-demo.log`; y `baseline-navegacion.log` (antes: 284 verdes / 1 rojo), `H0-navegacion-y-rutas.log` (después: 292 / 1), `H0-admin-catalog-qalab.log`, `H0-typecheck.log`.

## No cubierto
- Nada se ejercitó contra la API real; en navegador sólo contra el simulador.
- La sección `superadmin/flows` está `planificada` (cae en el placeholder): no tiene pantalla. `superadmin/observability` ya está `disponible`.
- No se corrió la suite completa del front (4985 pruebas); sólo las dirigidas y las de navegación, rutas y handlers.
- `ng build` no se corrió: `tsc` no revisa plantillas; las plantillas se ejercitaron en los tests del componente y en el navegador (`ng serve`).
- `docs/reports/generated/*` y `ROUTE_HEALTH_MATRIX.md` siguen listando las rutas `administration/*` viejas (se regeneran con herramientas que necesitan navegador).

## Desvíos del plan
- `navigation.map.ts`, `app.routes.ts` y `navigation.types.ts` están congelados por el ratchet de `check-max-lines`; en vez de subir el techo se partieron: `navigation.platform.ts` (10 secciones), `redirecciones-heredadas.ts` y `navigation.groups.ts` (re-exportado desde `navigation.types.ts`).
- Las 2 hijas con parámetro redirigen por función y no por texto (ver hallazgo 1).
- En `navigation.subgroups.spec.ts` se agregó `superadmin/observability` a `SUELTAS_A_PROPOSITO` y en `navigation.service.spec.ts` el grupo nuevo al orden esperado: ambos son cambios de comportamiento pedidos, ninguna aserción se debilitó.

## Hallazgos fuera de alcance (H1.3)
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
