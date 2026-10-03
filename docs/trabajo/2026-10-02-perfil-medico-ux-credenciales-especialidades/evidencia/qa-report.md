# QA — Hito 1

Entorno: Windows/PowerShell, frontend b84f74aa más working tree de la rama solicitada; Node 26.10.0, Yarn 4.18.0, Angular 21.2; Chromium instalado por Playwright. API local real, salud 200, cuentas sintéticas.

| Caso | Resultado | Evidencia y límite |
|---|---|---|
| Typecheck, plantillas Angular, lint | PASS | typecheck-current-base.txt, build-public-padding-final.txt, lint-current-base.txt, exit 0 |
| Credenciales propias/públicas/preview, 0/1/5/6/12, idiomas | PASS | targeted-current-base.txt; preview sólo componente |
| Cancelar limpio/aceptar/rechazar/revertir/inválidos/doble clic/save/imágenes | PASS | targeted-current-base.txt; imágenes y concurrencia con dobles |
| Alias, sesión, ruta anterior, menú y breadcrumbs | PASS | targeted-current-base.txt |
| Acciones laborales, estados reales y errores de respaldo | PASS | targeted-current-base.txt; bordes unitarios |
| Recorrido propio y PDF real/denegación ajena | PASS | e2e-current-base-isolated.txt, 4 PASS; cuatro GET auxiliares aislados |
| Integración sin simulaciones | FAIL | e2e-current-base-real.txt: red/consola por auxiliares API ausentes; salud 200 |
| Matriz visual final | PASS | 32 recapturas, ambas pasadas cerradas: 10 APROBADA, 22 con reservas, cero rechazos finales; revisión independiente enlazada |
| Suite completa | FAIL | 10.628 PASS, 2 FAIL; catálogo base también falla, logo no reproducido en subconjunto |
| Arquitectura/tokens/documentación | FAIL | current-*.txt y baseline-current-*.txt, ambas bases exit 1 |
| Entornos y archivos ajenos | PASS | preparation-and-env.txt |
| PR, base dev, reviewers y mergeabilidad | PASS | Apertura: OPEN, no draft, MERGEABLE y reviewers; estado final MERGED externamente (external-merge.txt) |
| CI y aprobación humana | BLOCKED | tres jobs QUEUED; único runner offline. No equivale a checks aprobados ni hito cerrado |

## Comandos exactos

```powershell
corepack.cmd yarn typecheck
corepack.cmd yarn build
corepack.cmd yarn lint
corepack.cmd yarn test --watch=false
corepack.cmd yarn test --include="src/app/features/account/my-profile/**/*.spec.ts" --include="src/app/app.routes.spec.ts" --include="src/app/core/navigation/navigation.service.spec.ts" --include="src/app/features/shell-layout/shell-layout.spec.ts" --include="src/app/features/directory/practitioner-detail/practitioner-detail.spec.ts" --include="src/app/shared/utils/pdf-export/pdf-logo.spec.ts" --include="src/app/core/pdf-branding/pdf-branding.service.spec.ts" --watch=false
corepack.cmd yarn pw playwright/practitioner-profile-ux.spec.ts playwright/practitioner-profile-lists.spec.ts --project=chromium --workers=1 --retries=0 --max-failures=1
```

El último comando se corre por separado en REAL y con E2E_PROFILE_ISOLATED=1. Fixture documenta exactamente los cuatro GET simulados; no simula ni cancela mutaciones del perfil ni archivos. Cero reintentos, ninguna prueba omitida. [REPORTE.md](../REPORTE.md) incluye salida literal; los logs conservan la ejecución completa.

## Gate de entrega

PR: https://github.com/mdavila-2001/mantra-core-health/pull/868. Se abrió OPEN, isDraft=false, MERGEABLE con ambos reviewers asignados. PabloArauzCaballero lo fusionó externamente a las 05:29:13 UTC; estado actual MERGED, mergeable UNKNOWN. El agente no hizo merge. Sólo hay revisión COMMENTED de Copilot, sin aprobación humana formal registrada. CI sin ejecutar por runner offline, tres jobs QUEUED. No se etiqueta REGRESSION_VERIFIED.

El primer push no invocó el hook porque core.hooksPath estaba ausente; se habilitó localmente .githooks y se corrió manualmente el control completo (stdin LF como Git), exit 0. Sin no-verify. Los controles del último push documental se volverán a observar al terminarlo.

Las pruebas y capturas corresponden a b84f74aa más el producto 794d6fb2. La sincronización concurrente posterior 70ce450b y el resultado externo 74a2c2ba no se presentan como regresión completa certificada. El cierre documental se publica en la rama solicitada, sin un segundo PR.
