# Reporte — Correcciones de receta en mockup

- Fecha: 2026-09-22 · Plan: [PLAN.md](./PLAN.md) · Rama: `justin/cierre-receta-y-refactor-directorio`
- Peldaño de evidencia: `TESTED` para la frecuencia de catálogo; el recorrido visual del PR #557 está registrado en el plan original.
- Avance: 13 / 13 microtareas (100 %).

## Completado

| ID | Qué se logró | Evidencia | Resultado |
|---|---|---|---|
| H1–H4, H6 | El PR #557 simplificó la receta, mantuvo sus contratos y retiró caminos no clínicos | merge `01e41bc5` | Integrado en `mockup` |
| H5.S1.M2 | La frecuencia se completa sólo desde `default_frequency` de la ficha terminológica, descarta respuestas tardías y no pisa texto manual | `corepack yarn test --include=src/app/features/clinical-record/patient-chart/medication-block/medication-block.spec.ts --watch=false` | 56/56 en verde |

## A medias

Ninguna.

## Pendiente

Ninguna dentro de este carril. La fuente de frecuencia conserva su procedencia sintética de desarrollo; la receta no transforma ni inventa ese dato.

## Evidencia

```text
MedicationBlock
56 pruebas en verde
```

## No cubierto

- No se repitió el recorrido visual completo del PR #557: este cambio sólo consume una propiedad ya publicada y su comportamiento está cubierto por la prueba dirigida.

## Desvíos del plan

- El bloqueo original de C-20 dejó de aplicar cuando #559 publicó `default_frequency`. Se cerró con una lectura defensiva de la ficha, no con una lista o regla clínica local.

## Riesgos residuales

- Un valor no textual o ausente se ignora y el médico conserva la frecuencia manual; esto evita convertir un dato malformado en una indicación clínica.

## Decisiones y ambigüedades

- Un texto manual existente tiene precedencia sobre el valor por defecto del catálogo.
