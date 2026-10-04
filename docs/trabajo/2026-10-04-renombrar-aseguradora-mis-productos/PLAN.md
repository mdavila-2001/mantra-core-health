# Plan — Renombrar menú Aseguradora a Mis productos

- Fecha: 2026-10-04 · Repos afectados: mantra-core-health · Predecesor: ninguno
- Resultado observable: En el menú lateral de navegación (`/administration/insurance`) y en la cabecera de la pantalla de catálogo, el texto dice «Mis productos» en lugar de «Aseguradora».
- Kill-test: Comprobar el valor de `label` en `src/app/core/navigation/navigation.map.ts` para `administration/insurance` y `title` en `src/app/features/insurance/insurance-catalog/insurance-catalog.html`; si alguno dice «Aseguradora», el cambio no está hecho.

## Alcance
- IN:
  - Modificación de `label: 'Aseguradora'` a `label: 'Mis productos'` en `src/app/core/navigation/navigation.map.ts`.
  - Modificación de `title="Aseguradora"` a `title="Mis productos"` en `src/app/features/insurance/insurance-catalog/insurance-catalog.html`.
  - Verificación mediante compilación (`typecheck`, `build`) y pruebas unitarias/navegación dirigidas.
  - Creación de ramas y PRs hacia `dev` y `test`.
  - Documentación obligatoria de trabajo en `docs/trabajo/2026-10-04-renombrar-aseguradora-mis-productos/`.
- OUT:
  - No renombrar el enum de organizaciones (`PAYER: 'Aseguradora'`), ni selectores de tipos de cuenta ni modelos de API.
  - No modificar rutas URL existentes (`administration/insurance` se preserva).
- Ambigüedades registradas:
  - Se confirmó con el usuario que el segundo PR se destina a la rama `test`.

## H1 — Rama y PR para dev
**CA:** Dado el menú lateral y la pantalla de catálogo en la rama dev, cuando un usuario autorizado accede a la sección, entonces ve el rótulo «Mis productos».
**DoD:** Typecheck sin errores, tests de navegación pasando, rama publicada y PR abierto hacia `dev`.
**Estado:** TODO

### H1.S1 — Implementación y verificación en dev
**CA:** El código compila y las pruebas pasan en la rama dev.
**DoD:** `yarn typecheck` y `yarn test` dirigidos exit 0.
**Estado:** TODO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Estado |
|---|---|---|---|---|
| H1.S1.M1 | Crear rama desde origin/dev | Rama local limpia sobre origin/dev | `git checkout -b marcelo/renombrar-aseguradora-mis-productos-dev origin/dev` | TODO |
| H1.S1.M2 | Actualizar rótulo en navigation.map.ts | label es 'Mis productos' | `grep "label: 'Mis productos'" src/app/core/navigation/navigation.map.ts` | TODO |
| H1.S1.M3 | Actualizar título en insurance-catalog.html | title es 'Mis productos' | `grep 'title="Mis productos"' src/app/features/insurance/insurance-catalog/insurance-catalog.html` | TODO |
| H1.S1.M4 | Validar tipos y tests dirigidos | Compilación y suites de navegación en verde | `yarn typecheck; yarn test --include src/app/core/navigation/navigation.map.spec.ts --watch=false` | TODO |
| H1.S1.M5 | Push y PR hacia dev | PR abierto en GitHub con base dev | `git push origin marcelo/renombrar-aseguradora-mis-productos-dev` + apertura de PR | TODO |

## H2 — Rama y PR para test
**CA:** Dado el menú lateral y la pantalla de catálogo en la rama test, cuando un usuario autorizado accede a la sección, entonces ve el rótulo «Mis productos».
**DoD:** Typecheck sin errores, rama publicada y PR abierto hacia `test`.
**Estado:** TODO

### H2.S1 — Implementación y verificación en test
**CA:** El cambio se porta limpiamente sobre origin/test y se valida.
**DoD:** `yarn typecheck` exit 0, push y PR a `test`.
**Estado:** TODO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Estado |
|---|---|---|---|---|
| H2.S1.M1 | Crear rama desde origin/test | Rama local limpia sobre origin/test | `git checkout -b marcelo/renombrar-aseguradora-mis-productos-test origin/test` | TODO |
| H2.S1.M2 | Portar cambios a test | Cambios aplicados en test | `git cherry-pick` o aplicación idéntica de diff | TODO |
| H2.S1.M3 | Validar tipos y tests en test | Compilación y suites en verde | `yarn typecheck; yarn test --include src/app/core/navigation/navigation.map.spec.ts --watch=false` | TODO |
| H2.S1.M4 | Push y PR hacia test | PR abierto en GitHub con base test | `git push origin marcelo/renombrar-aseguradora-mis-productos-test` + apertura de PR | TODO |

## H3 — Cierre y reporte
**CA:** Existe documentación completa de evidencias y estado final.
**DoD:** `REPORTE.md` generado con enlaces a ambos PRs y estado de verificación.
**Estado:** TODO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Estado |
|---|---|---|---|---|
| H3.S1.M1 | Redactar REPORTE.md | Reporte completo con enlaces | `Test-Path docs/trabajo/2026-10-04-renombrar-aseguradora-mis-productos/REPORTE.md` | TODO |

## Riesgos y bloqueos previstos
| Riesgo | Impacto | Mitigación |
|---|---|---|
| Divergencia entre dev y test | Conflicto al aplicar el cambio | Se trabaja cada PR en su propia rama base (`origin/dev` y `origin/test`). |
| Runner offline en CI remoto | Checks pueden quedar en cola | Se ejecuta la validación exhaustiva localmente (`typecheck`, `test`). |
