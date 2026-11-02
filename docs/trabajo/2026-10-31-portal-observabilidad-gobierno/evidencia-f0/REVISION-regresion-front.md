# Revisión de regresión F0 (front) — veredicto: NOT_VERIFIED

Base `origin/dev...HEAD` (26 commits). Auditor independiente; sin cambios de código, sin commit.
NOT_VERIFIED porque faltan pruebas de navegador (ver «Sin verificar»); no se halló ninguna regresión bloqueante.

## Evidencia ejecutada
- Vitest dirigido (core/auth, core/http, core/observability, features/auth, reporting, portal-selector, shell-layout, ux-consent, dashboard, insights, app.routes.spec): 115 archivos, 2367 pruebas, todas verdes.
- `tsc -p tsconfig.app.json --noEmit`: limpio. `ng build` (SSR incluido, plantillas): exit 0, sólo avisos NG8113 y CommonJS preexistentes.
- Comparación de `check-*.mjs`, HEAD vs worktree de `origin/dev` (quitado al terminar):
  - Pasan en ambos: check-route-prefixes, check-doc-links, check-contrast, check-tokens.
  - check-chart-palette: pasa en HEAD; el script no existe en la base.
  - Fallan en AMBOS (preexistentes): check-css-tokens (--base origin/dev; salida idéntica: --fs-h4 etc.), check-colores-sueltos (idéntica), check-architecture (los 11 «no resuelven» son archivos generados; en HEAD ya existían generados, ruido del worktree), check-max-lines (app.routes.ts baja 2564→2531 y shell-layout.html 792→767; siguen sobre el techo, pero mejoran; ningún archivo nuevo supera).
  - Empeoran POR ESTE DIFF:
    - check-english-identifiers: 1205 → 1239 (+34 identificadores en castellano). En `src`: ux-consent.service.ts:102,123,187,207; privacy-signal.ts:11,17,23; ux-analytics.service.ts:110; reporting-mock.routes.ts:30; error-to-view-state.ts:50; tenant-menu.html:8,24; platform-home.html:11; ux-consent-panel.html:19; más specs y playwright/entrada-portal-admin.spec.ts, support/sesion.ts, auditoria-qa-mockup.spec.ts.
    - check-doc-coverage: 69 → 68 hallazgos netos, pero NUEVO: «servicio sin mencionar: TelemetryConsentClient» (el diff además documenta UxAnalytics, bulk/ops; mejora otros) y 2 marcadores «marcador provisional» en docs/trabajo (01-entrada-y-acceso.md, 06-cargas-masivas…).

## Hallazgos
1. [MEDIA] check-english-identifiers regresa (+34). Reproducir: `node scripts/check-english-identifiers.mjs | head`, comparar con la base. Una puerta de calidad que ya fallaba, ahora más.
2. [BAJA] check-doc-coverage: `TelemetryConsentClient` (src/app/core/data-access/telemetry/telemetry-consent.client.ts:35) sin mencionar en docs; 2 marcadores provisionales en docs/trabajo. Reproducir: `node scripts/check-doc-coverage.mjs | grep -n Consent`.
3. [BAJA] Enlace «Cambiar de portal» de Insights apunta a `/portal-selector` (src/app/features/insights/insights-shell.html:67; insights-shell.ts:50-53). Con la bandera apagada y un rol que sume administración + insights, `cantidadDePortales>=2` lo muestra y la ruta redirige a `/`→`/dashboard`. No hay bucle ni 404, pero el rótulo promete un selector que no existe. Reproducir: sesión PLATFORM_ADMIN en `/insights`, clic en el enlace.
4. [BAJA/informativa] Roles de reportería sin administración (REPORT_VIEWER, REPORT_AUTHOR, REPORTING_ADMIN, BUSINESS_ADMIN) que entren por URL directa a `/reports/**` con la bandera apagada: redirige (sin guard) a `/superadmin/observability`, cuyos roles son PLATFORM_ADMIN, SRE, SECURITY_ADMIN, RELEASE_MANAGER, GOVERNANCE_ADMIN (navigation.platform.ts:91); `seccionRolesGuard` los manda a `/dashboard` (section-roles.guard.ts:22,87). Sin bucle. Es el comportamiento buscado; queda anotado porque estos roles pierden su portal. Anónimo: `/reports/x` → observability → login (el returnUrl será observability, no /reports/x).
5. [BAJA] `/auth/organization?returnUrl=/auth/organization` (tenant-selection.ts:83-84): `safeReturnUrl` acepta cualquier ruta interna incluida `/auth/**`; quien ya eligió y vuelve a esa URL queda en el selector (no es redirección abierta ni bucle automático; los emisores internos excluyen `/auth/`). Reproducir: construir esa URL a mano.
6. [BAJA, estilo] shell-layout.ts:659 reformateó a una sola línea larga el computed `tenants` (cambio sin relación) y shell-layout.ts:791 `if … else` en una línea; cuenta contra lint/max-lines de estilo.

## Autorización (buscado y NO hallado)
- `hasPlatformScope` (core/auth/platform-scope.ts:25-35) compara con igualdad exacta mayúsculas: «superadmin», «Superadmin» o « SUPERADMIN» NO dan alcance (falla cerrado → sigue el selector). Sesión sin roles o `claims===null` → false.
- `scopedRoles`: un rol de plataforma presente en cualquier lista con ámbito se trata como de organización (falla cerrado); el caso queda cubierto por la prueba NEGATIVA en login.spec.ts. Un rol no global no puede obtener el alcance.
- Lo único que cambia con el alcance: `needsTenantSelection` (authGuard no manda al selector), no enviar `X-Tenant-Id` sin organización, rótulo «Toda la plataforma». No concede acceso: `seccionRolesGuard` y la API siguen decidiendo. `clearSelectedTenant()` es no-op sin alcance (auth.service.ts:224-234).
- Tenant recordado en storage: se valida contra los tenants del token (`selectTenant`) y es por usuario; no restaura alcance. El token de acceso no se persiste.
- Interceptor (auth.interceptor.ts:140-150): con alcance no navega ante TENANT_REQUIRED (evita bucle `/dashboard`↔`/auth/organization`); la pantalla muestra S5/forbidden con «Elegir organización». Sin alcance sigue yendo al selector con `returnUrl` validado.
- `returnUrl`: `safeReturnUrl` rechaza `//x` y `/\x`; centralizado en login, selector, interceptor y error-to-view-state. Sin redirección abierta (cubierto por login.spec).

## Consumidores y rutas
- `/portal-selector`→`/`→homeGuard→`/dashboard`; `/reports/**`→`/superadmin/observability`; sin bucles. Con bandera encendida las rutas reales conservan guards (`authGuard`+`seccionRolesGuard`) y van delante del armazón (reporting.routes.spec.ts adaptado, no debilitado; app.routes.spec.ts nuevo).
- Pruebas: no hay `skip/only/todo` nuevos en specs de Vitest. Las aserciones eliminadas en ux-analytics.service.spec.ts (userId/tenantId/sessionId) corresponden al nuevo DTO sin esos campos y se reemplazan por pruebas de que NO viajan. `reporteria-capturas.spec.ts` se salta de forma condicional con motivo explícito (sin `PW_REPORTING_MOCK=1`); `playwright/support/sesion.ts` ya no acepta `/portal-selector` sin la bandera (endurece, no relaja).
- Playwright/cypress: `header-organizacion` se conserva en `tenant-menu.html` (mismo testid, host `display: contents`; el contrato `.menu-anclaje`/`aria-haspopup` se mantiene). Ningún spec ni cypress usa los testids eliminados. Los scripts `playwright/*.mjs` esperan `/dashboard|auth/organization|portal-selector`: siguen aceptando `/dashboard`, y su rama del selector queda inerte.
- Plataforma-home: el título «Portal de reportería» pasó a «Observabilidad y gobierno» (id `reporteria`→`observabilidad`); ningún consumidor externo encontrado por grep (excl. specs ajustadas).

## Aviso de consentimiento (app.html)
- SSR: `UxConsent` sólo lee DNT/GPC con `isPlatformBrowser`; en servidor no hay sesión, `disponible=false`, no se pinta ni llama a la API; `localStorage` dentro de try. Sin desajuste de hidratación esperado (la sesión se restaura en cliente después). `ng build` con SSR compiló.
- Rutas públicas: se muestra sobre cualquier ruta (incluidas públicas) pero sólo con sesión, captura activa, sin DNT/GPC y decisión `ninguna`. Es `position: fixed; z-index: var(--z-overlay)` abajo y centrado: puede tapar controles inferiores en móvil hasta que se responda (riesgo para clics de Playwright, que no lo descartan; el aviso depende de `config.active`, normalmente apagado en e2e).
- Mientras `decision==='desconocida'` (consulta pendiente/falló) `modo='anonimo'` emite vistas de página anónimas; coherente con el diseño, pero conviene saberlo.

## Sin verificar (por qué)
- `yarn pw:rutas` / `yarn pw:accesos`, entrada por URL directa y los cinco viewports: no se ejecutaron (requieren `ng serve` + navegador + API/simulador; no hay en este entorno). Por eso NO se emite REGRESSION_VERIFIED.
- Renderizado SSR real de una página con el aviso, y solapamiento visual del aviso en 390×844: sin captura.
- Suite completa de Vitest (4985): sólo se corrió el subconjunto de consumidores; `yarn lint` y typecheck de cypress/playwright no se corrieron.
- Para pasar a VERIFIED: correr `yarn pw:rutas`, `yarn pw:accesos`, `playwright/entrada-portal-admin.spec.ts` y entrada directa a `/reports/x`, `/portal-selector`, `/auth/organization?returnUrl=//x` en 5 viewports, y corregir 1-2.
