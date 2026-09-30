# Gates locales — reserva y Cotizaciones

Fecha: 2026-09-23. Base local: `origin/mockup@b7785e36` más esta evidencia.

| Gate | Resultado | Alcance |
|---|---|---|
| Spec de componente de Cotizaciones | **PASS** · 1 archivo, 3 pruebas | Lógica de filtro, orden, precio y ausencia de precio publicado. |
| Mock backend | **PASS** · 1 archivo, 21 pruebas | Contrato de la maqueta integrada. |
| Tipos | **PASS** · sin diagnósticos tras generar el índice | App, Cypress y Playwright. |
| Barrido de rutas mock | **PASS** · 5 pruebas | Médica, Paciente, Admin, Superadmin y Visitador. |
| Playwright local focal | **PASS** · pruebas de Cotizaciones, teclado, medición y navegación única | Navegador autenticado contra la maqueta local. |
| Lint global | **ROJO GLOBAL** · 243 errores | Regla `@angular-eslint/prefer-on-push-component-change-detection` en archivos preexistentes de toda la base. No se ocultó ni se corrigió fuera del alcance. |

Salidas literales relevantes:

```text
corepack yarn test --include=src/app/features/account/cotizaciones/cotizaciones.spec.ts --watch=false
Test Files  1 passed (1)
Tests  3 passed (3)

corepack yarn test --include=src/app/core/mock/mock-backend.spec.ts --watch=false
Test Files  1 passed (1)
Tests  21 passed (21)

E2E_BASE_URL=http://127.0.0.1:4200 npx playwright test playwright/mockup-barrido.spec.ts --workers=1 --reporter=list
5 passed (50.4s)

corepack yarn lint
✖ 243 problems (243 errors, 0 warnings)
```

No se declara verde la suite global: este cierre verificó sus gates relevantes
y conserva el rojo global como deuda de la base.
