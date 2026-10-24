# Plan — Ajuste de columnas en siniestralidad por persona y correcciones visuales en tabla de solicitudes

- Fecha: 2026-10-04 · Repos afectados: `mantra-core-health` · Predecesor: `docs/trabajo/2026-10-04-renombrar-aseguradora-mis-productos`
- Resultado observable:
  1. En la tabla de siniestralidad por persona (`administration/insurance-analytics`), se muestran exactamente las 6 columnas pedidas: Nombre, Solicitudes, Monto aprobado, Monto rechazado, Cuota pagada, % Siniestralidad.
  2. En la tabla de solicitudes recibidas (`administration/received-claims`), las columnas secundarias no quedan ocultas en escritorio por constricción indebida, y se muestra la institución médica (`providerName`) tanto cuando acompaña al médico como cuando no hay profesional asociado.
- Kill-test:
  1. Inspeccionar `columns` en `person-loss-report.ts`: si contiene columnas extra (Plan, Facturado, % aprobación) o nombres distintos a los 6 requeridos, FAIL.
  2. Inspeccionar `received-claims.html`: si `maxHeight="560px"` sigue ocultando columnas secundarias en desktop o si `claim.providerName` no se visualiza en la celda de atención médica, FAIL.

## Alcance
- IN:
  - `src/app/features/insurance/insurance-analytics/person-loss-report/person-loss-report.ts`: configurar las 6 columnas (`Nombre`, `Solicitudes`, `Monto aprobado`, `Monto rechazado`, `Cuota pagada`, `% Siniestralidad`).
  - `src/app/features/insurance/received-claims/received-claims.html`: remover constricción de `maxHeight` en la tabla para que se visualicen todas las columnas en desktop; renderizar la institución médica (`claim.providerName`) en `practitionerCell`; enriquecer `amountCell` con el monto aprobado si existe dictamen.
  - `src/app/features/insurance/received-claims/received-claims.css`: estilos para `.received__institution` y orden de acciones.
  - Pruebas unitarias asociadas y typecheck.
- OUT:
  - Cambios de contrato en backend o endpoints de simulación.
  - Modificación de pantallas no relacionadas a aseguradora/solicitudes.
- Ambigüedades registradas:
  - "tabla de solicitudes": en el menú de aseguradora aplica directamente a `Solicitudes recibidas` (`administration/received-claims`). Se valida además que `my-requests` ya contemplaba la institución médica.

## H1 — Tabla de siniestralidad por persona con columnas requeridas
**CA:** Dado que el usuario visualiza el informe de siniestralidad por persona generado, cuando observa la tabla, entonces ve exactamente las 6 columnas en el siguiente orden: Nombre, Solicitudes, Monto aprobado, Monto rechazado, Cuota pagada y % Siniestralidad.
**DoD:** Tests unitarios de `insurance-analytics` pasan en verde y las columnas coinciden exactamente con la especificación.
**Estado:** HECHO

### H1.S1 — Definición de columnas en `person-loss-report.ts`
**CA:** La señal computada `columns` devuelve únicamente las 6 columnas solicitadas con sus respectivos encabezados y formateo de moneda.
**DoD:** `corepack yarn typecheck` pasa sin errores.
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Estado |
|---|---|---|---|---|
| H1.S1.M1 | Ajustar `columns()` en `person-loss-report.ts` | La lista contiene exactamente `Nombre`, `Solicitudes`, `Monto aprobado${unit}`, `Monto rechazado${unit}`, `Cuota pagada${unit}`, `% Siniestralidad` | `corepack yarn typecheck` → exit code 0 | HECHO |

## H2 — Corrección de bugs visuales y visualización de institución médica en solicitudes
**CA:** Dado que el usuario navega a la tabla de solicitudes recibidas, cuando visualiza la tabla en escritorio, entonces puede ver todas las columnas sin que se oculten por `maxHeight`, y en la celda de atención médica se muestra la institución médica cuando corresponda.
**DoD:** Pruebas unitarias de `received-claims.spec.ts` pasan y las filas reflejan la institución médica.
**Estado:** HECHO

### H2.S1 — Corrección visual y despliegue de columnas en `received-claims.html`
**CA:** La tabla no oculta las columnas en desktop y renderiza la institución médica.
**DoD:** Ejecución de `ng test --include=src/app/features/insurance/received-claims/received-claims.spec.ts` en verde.
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Estado |
|---|---|---|---|---|
| H2.S1.M1 | Remover `maxHeight="560px"` en `<app-data-table>` de `received-claims.html` | La tabla no activa `.data-table--constrained` en desktop y muestra las columnas completas | `git diff src/app/features/insurance/received-claims/received-claims.html` | HECHO |
| H2.S1.M2 | Mostrar institución médica (`claim.providerName`) en `practitionerCell` y estilos | Se visualiza el prestador/institución médica junto al médico o como prestador principal si no hay médico | `ng test --include=src/app/features/insurance/received-claims/received-claims.spec.ts` → 0 failures | HECHO |
| H2.S1.M3 | Mostrar monto aprobado en `amountCell` si la solicitud está dictaminada | Se visualiza el total aprobado cuando `claim.approvedTotal` no es nulo | `ng test --include=src/app/features/insurance/received-claims/received-claims.spec.ts` → 0 failures | HECHO |

## H3 — Verificación integral y entrega de PRs
**CA:** Todo el código pasa typecheck, pruebas dirigidas y se crean PRs a `dev` y `test`.
**DoD:** Salida de checks y PRs mergeables demostrada.
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Estado |
|---|---|---|---|---|
| H3.S1.M1 | Ejecutar typecheck y suites de tests | Cero errores de compilación y pruebas en verde | `corepack yarn typecheck` | HECHO |
| H3.S1.M2 | Commit y push a rama dev | Rama subida a origin | `git push -u origin marcelo/tablas-siniestralidad-y-solicitudes-dev` | HECHO |
| H3.S1.M3 | Crear PR a `dev` | PR abierto | `https://github.com/mdavila-2001/mantra-core-health/pull/940` | HECHO |
| H3.S1.M4 | Portar a rama `test` y crear PR | PR abierto a `test` | `https://github.com/mdavila-2001/mantra-core-health/pull/941` | HECHO |

## Riesgos y bloqueos previstos
| Riesgo | Impacto | Mitigación |
|---|---|---|
| Romper aserciones en `received-claims.spec.ts` al modificar encabezados o celdas | Alto | Mantener encabezados de ordenamiento probados ('Médico') y agregar pruebas específicas |
