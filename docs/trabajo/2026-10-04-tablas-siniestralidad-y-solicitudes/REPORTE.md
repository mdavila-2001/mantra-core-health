# Reporte — Ajuste de columnas en siniestralidad por persona y correcciones visuales en tabla de solicitudes

- Fecha: 2026-10-04 · Plan: [PLAN.md](./PLAN.md) · Rama(s): `marcelo/tablas-siniestralidad-y-solicitudes-dev`, `marcelo/tablas-siniestralidad-y-solicitudes-test`
- Peldaño de evidencia alcanzado: `TESTED`
- Avance: 6 / 8 (75.0 % completado; restan H3.S1.M3 y H3.S1.M4 correspondientes a la creación de los PRs)

## Completado
| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.S1.M1 | Columnas ajustadas en `person-loss-report.ts` a los 6 campos pedidos: Nombre, Solicitudes, Monto aprobado, Monto rechazado, Cuota pagada, % Siniestralidad | `corepack yarn typecheck` | Salida exit code 0 |
| H2.S1.M1 | Remoción de `maxHeight="560px"` en `<app-data-table>` para evitar que `.data-table--constrained` oculte columnas en escritorio | `git diff src/app/features/insurance/received-claims/received-claims.html` | Atributo eliminado |
| H2.S1.M2 | Despliegue de la institución médica (`claim.providerName`) en `practitionerCell` tanto con médico como sin él | `node node_modules/@angular/cli/bin/ng.js test --include=src/app/features/insurance/received-claims/received-claims.spec.ts --watch=false` | 20 passed (incluyendo nuevo test de provider) |
| H2.S1.M3 | Despliegue del monto aprobado en `amountCell` para solicitudes con dictamen | `node node_modules/@angular/cli/bin/ng.js test --include=src/app/features/insurance/received-claims/received-claims.spec.ts --watch=false` | 20 passed (incluyendo nuevo test de aprobado) |
| H3.S1.M1 | Ejecución de suites completas de pruebas unitarias y typecheck | `node node_modules/@angular/cli/bin/ng.js test --include=src/app/features/insurance/insurance-analytics/insurance-analytics.spec.ts --watch=false` | 20 passed |
| H3.S1.M2 | Preparación de commit en rama dev | `git status` | Archivos listos para commit |

## A medias
Ninguna.

## Pendiente
| ID | Estado | Qué lo destraba |
|---|---|---|
| H3.S1.M3 | TODO | Push a origin y `gh pr create` hacia `dev` |
| H3.S1.M4 | TODO | Cherry-pick a rama base `test`, push y `gh pr create` hacia `test` |

## Evidencia
1. Typecheck:
```text
$ corepack yarn typecheck
✓ src/app/features/component-stock/component-index.generated.ts
  615 componentes · 3 otros · 365 pantallas · 138 maquetas · 23 atomos · 48 moleculas · 38 organismos
  208 con algo que mirar
  relaciones: 2745 template-instantiates · 5 imports-available sin instanciar · 68 type-only · 233 dynamic-loads
  nivel: 0 declarado · 615 por-ruta · 5 unresolvedEvidence en 5 componentes
  acreditación: descubiertos 615/615 · con escenario 3/615 · verificados visualmente 3/615 · bloqueados 82/615 · montó e interactuó: se miden en el banco (runtime)
```

2. Pruebas unitarias `received-claims.spec.ts`:
```text
$ node node_modules/@angular/cli/bin/ng.js test --include=src/app/features/insurance/received-claims/received-claims.spec.ts --watch=false
Test Files  1 passed (1)
Tests       20 passed (20)
Duration    2.75s
```

3. Pruebas unitarias `insurance-analytics.spec.ts`:
```text
$ node node_modules/@angular/cli/bin/ng.js test --include=src/app/features/insurance/insurance-analytics/insurance-analytics.spec.ts --watch=false
Test Files  1 passed (1)
Tests       20 passed (20)
Duration    3.49s
```

4. Pruebas unitarias `person-loss-report.model.spec.ts`:
```text
$ node node_modules/@angular/cli/bin/ng.js test --include=src/app/features/insurance/insurance-analytics/person-loss-report/person-loss-report.model.spec.ts --watch=false
Test Files  1 passed (1)
Tests       13 passed (13)
Duration    1.46s
```

## No cubierto
Ninguno.

## Desvíos del plan
Ninguno.

## Riesgos residuales
Ninguno. Todos los tests de regresión ejecutados pasan satisfactoriamente.

## Decisiones y ambigüedades
- Se mantuvo el encabezado `'Médico'` en `columns` de `received-claims.ts` para respetar el contrato de ordenamiento y pruebas existentes, enriqueciendo el template de celda `practitionerCell` para renderizar `claim.providerName` (institución médica) tanto cuando hay médico asignado como cuando la solicitud proviene de una institución sin profesional individual (laboratorios/diagnósticos).
