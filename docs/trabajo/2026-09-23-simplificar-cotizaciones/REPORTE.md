# Reporte — Simplificar la pantalla de Cotizaciones

- Fecha: 2026-09-23 · Plan: [PLAN.md](./PLAN.md) · Rama: `justin/simplificar-cotizaciones-2026-09-23`
- Peldaño de evidencia alcanzado: `TESTED` para el componente; la verificación visual autenticada permanece bloqueada.
- Avance: 3 / 4 microtareas HECHO (75.0%)

## Completado

| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.S1.M1 | Se reemplazó la prueba de estudios por una que exige su ausencia. | `corepack yarn test --include=src/app/features/account/cotizaciones/cotizaciones.spec.ts --watch=false` antes del cambio | ROJO esperado: `getOwnOrders` se había llamado una vez. |
| H1.S1.M2 | Se retiraron el bloque de documentos, estados de carga/error/truncamiento y las dependencias de órdenes/terminología. | Mismo comando después del cambio | 3/3 PASS; la prueba conserva ambos clientes simulados y exige cero llamadas. |
| H1.S1.M3 | Se registraron resultado, pruebas y límites. | Este reporte | Trazabilidad completa. |

## A medias

### H1 — Comparador sin documentos incrustados
- Qué anda: la pantalla ya presenta solamente controles y resultados de cotización; el test dirigido confirma que no queda el texto de documentos.
- Qué no anda: no se obtuvo una observación visual autenticada de la versión nueva.
- Qué falta exactamente: servir este SHA en una instancia con una sesión sintética o proveer un recorrido autenticado reproducible.
- Dónde quedó: `src/app/features/account/cotizaciones/`.

## Pendiente

| ID | Estado | Qué lo destraba |
|---|---|---|
| H1.S1.M4 | BLOQUEADO | Instancia que sirva este SHA y sesión sintética; el mockup público observado todavía no sirve la punta del código. |

## Evidencia

```text
$ corepack yarn test --include=src/app/features/account/cotizaciones/cotizaciones.spec.ts --watch=false
Test Files  1 passed (1)
Tests  3 passed (3)

$ corepack yarn typecheck
exit 0

$ corepack yarn test --watch=false
Test Files  1 failed | 574 passed (575)
Tests  1 failed | 7172 passed (7173)
```

## No cubierto

- No se declara verificación visual ni despliegue de esta versión.

## Desvíos del plan

- La suite completa dejó un timeout de `register-practitioner.spec.ts` en un caso de backend simulado. Al ejecutarlo solo pasó 95/95; no se reprodujo aisladamente y queda pendiente de clasificación: esa evidencia no permite atribuirle una causa.
- Los dos rojos anteriores de `shell-layout.spec.ts` se corrigieron actualizando su contrato para incluir la ruta ya existente de Cotizaciones en el bloque clínico. El spec pasó 54/54; `insurance-analytics.spec.ts` también pasó 10/10 aislado.

## Riesgos residuales

- El comparador conserva resultados de maqueta ya existentes; retirar documentos no convierte esos precios en publicados.

## Decisiones y ambigüedades

- Los documentos diagnósticos se mantienen en su área propia. Cotizaciones no los carga ni usa como cabecera para conservar una sola responsabilidad visual.
