# Reporte — Superadministración de AloVida (lado front)

> **AVANCE: 6 / 8 — 75,0 %.** (Microtareas de H0 en este repo; `DESCARTADO` y `NOT_RUN` no suman. H1–H5 de este repo sin empezar.)

- Fecha: 2026-10-17 · Plan: [PLAN.md](./PLAN.md) · Rama: `claude-marcelo/serene-planck-1q7zje`
- Peldaño de evidencia alcanzado (H0, navegación y rutas): **`TESTED`** (tests dirigidos en verde). **No** `VERIFIED`: no se ejercitó en navegador.

## Completado
| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H0.2.1–H0.2.4 | Grupo `Superadministración` (entre «Facturación» y «Mi cuenta»), ícono, bloque «Plataforma», zona `plataforma` en «Tus accesos», 10 secciones (4 retiradas del menú + 6 nuevas) | `yarn test --include='src/app/core/navigation/**/*.spec.ts' --include='src/app/app.routes*.spec.ts'` | 292 verdes, 1 rojo **preexistente** · `evidencia/H0-navegacion-y-rutas.log` |
| H0.3.1–H0.3.2 | Rutas `superadmin/*`; las 4 viejas y sus 2 hijas redirigen conservando parámetro, query y fragmento; 7 enlaces internos actualizados | ídem (8 pruebas nuevas en `app.routes.spec.ts`) y specs de catálogo/QA Lab | 19/19 en `evidencia/H0-admin-catalog-qalab.log` |
| Gates | `typecheck` exit 0; ESLint sobre los 18 archivos tocados exit 0; `check-max-lines`, `check-route-prefixes`, `check-client-prefixes`, `check-architecture` sin hallazgos míos | ver `evidencia/` | PASS (los del baseline preexistente se listan abajo) |

## A medias
Ninguna.

## Pendiente
| ID | Estado | Qué lo destraba |
|---|---|---|
| H0.3.3 | `NOT_RUN` | Evidencia de menú en navegador (perfiles `superadmin`/`paciente`, 3 viewports × claro/oscuro): requiere servidor + Chromium + capturas |
| H0.1.4 | `DESCARTADO` | Ver PLAN.md: `E2E_ADMIN_EMAIL` ya es configurable |
| H1.3, H2.3, H3.4, H5.2 | `TODO` | Dependen de las lecturas de la API (H1.2, H2.2, H3.3, H5.1) |

## Evidencia
`docs/trabajo/2026-10-17-superadmin/evidencia/`: `baseline-navegacion.log` (antes: 284 verdes / 1 rojo), `H0-navegacion-y-rutas.log` (después: 292 / 1), `H0-admin-catalog-qalab.log`, `H0-typecheck.log`.

## No cubierto
- Nada se ejercitó en un navegador ni contra la API real.
- Las secciones `superadmin/observability` y `superadmin/flows` están `planificada` (caen en el placeholder): no tienen pantalla.
- `docs/reports/generated/*` y `ROUTE_HEALTH_MATRIX.md` siguen listando las rutas `administration/*` viejas (se regeneran con herramientas que necesitan navegador).

## Desvíos del plan
- `navigation.map.ts`, `app.routes.ts` y `navigation.types.ts` están congelados por el ratchet de `check-max-lines`; en vez de subir el techo se partieron: `navigation.platform.ts` (10 secciones), `redirecciones-heredadas.ts` y `navigation.groups.ts` (re-exportado desde `navigation.types.ts`).
- Las 2 hijas con parámetro redirigen por función y no por texto (ver hallazgo 1).
- En `navigation.subgroups.spec.ts` se agregó `superadmin/observability` a `SUELTAS_A_PROPOSITO` y en `navigation.service.spec.ts` el grupo nuevo al orden esperado: ambos son cambios de comportamiento pedidos, ninguna aserción se debilitó.

## Riesgos residuales
- Un `SECURITY_ADMIN` de organización también verá «Superadministración» (mismos roles que ya tenía en «Administración › Plataforma»).

## Decisiones y ambigüedades
- «Reformular» se interpretó como **mover** las 4 secciones bajo el grupo nuevo (confirmar con el usuario).

## Hallazgos fuera de alcance (no se arreglan acá)
1. **Toda redirección de texto del router pierde el query** (medido en el harness del repo, no en navegador): `/auth/verificar?token=abc → /auth/verify-email`, `/ajustes?x=1 → /settings`. El comentario de `app.routes.ts` afirma lo contrario. Puede afectar los enlaces de verificación ya enviados por correo.
2. **Gates rojos previos a este trabajo:** `check-mock-vs-client` (8 operaciones), `check-usted` (fixtures de community), `check-doc-links` (`docs/tareas/…`), `check-max-lines` (`symptom-check` ×2, `public-profile-card.css`), 1 test de `navigation.subgroups.spec` (`psychological-help` sin bloque).
3. **Entorno:** `repo.yarnpkg.com` denegado por el proxy → Yarn 4.18.0 se obtuvo de `@yarnpkg/cli-dist` (registro npm permitido) fuera del repo; `CYPRESS_INSTALL_BINARY=0`.
