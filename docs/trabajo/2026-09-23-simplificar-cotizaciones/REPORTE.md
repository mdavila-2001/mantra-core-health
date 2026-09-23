# Reporte — Simplificar la pantalla de Cotizaciones

> **AVANCE: 4 / 4 microtareas HECHO (100 %).**

- Fecha: 2026-09-23 · Plan: [PLAN.md](./PLAN.md) · Rama de verificación: `justin/verificar-cotizaciones-navegador-2026-09-23` sobre `origin/mockup@b7785e36` (incluye el merge de #581).
- Peldaño de evidencia alcanzado: `VERIFIED` localmente con sesión sintética de paciente y Chromium. No se declara despliegue remoto.

## Completado

| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.S1.M1 | Se reemplazó la prueba de estudios por una que exige su ausencia. | `corepack yarn test --include=src/app/features/account/cotizaciones/cotizaciones.spec.ts --watch=false` antes del cambio | ROJO esperado: `getOwnOrders` se había llamado una vez. |
| H1.S1.M2 | Se retiraron el bloque de documentos, estados de carga/error/truncamiento y las dependencias de órdenes/terminología. | Mismo comando después del cambio | 3/3 PASS; la prueba conserva ambos clientes simulados y exige cero llamadas. |
| H1.S1.M3 | Se registraron resultado, pruebas y límites. | Este reporte | Trazabilidad completa. |
| H1.S1.M4 | Se abrió la ruta autenticada de Cotizaciones contra el SHA integrado: no muestra el bloque, no solicita `/diagnostic-results/me/orders`, conserva precio/procedencia, filtro, orden y vacío. | `npx playwright test playwright/cotizaciones-paciente.spec.ts playwright/reserva-cotizaciones-recorrido.spec.ts --workers=1 --reporter=list` | 2/2 PASS. |

## A medias

- Ninguna para este plan. Las fuentes de precio y la medición de reserva pertenecen al carril original y siguen registradas por separado; no se reinterpretan como cierre de esta simplificación.

## Pendiente

- Ninguno dentro de este plan.

## Evidencia

```text
$ corepack yarn test --include=src/app/features/account/cotizaciones/cotizaciones.spec.ts --watch=false
Test Files  1 passed (1)
Tests  3 passed (3)

$ corepack yarn typecheck
exit 0

$ npx playwright test playwright/cotizaciones-paciente.spec.ts playwright/reserva-cotizaciones-recorrido.spec.ts --workers=1 --reporter=list
2 passed (13.0s)

$ E2E_BASE_URL=http://127.0.0.1:4200 npx playwright test playwright/mockup-barrido.spec.ts --workers=1 --reporter=list
5 passed (47.0s)

$ corepack yarn test --include=src/app/core/mock/mock-backend.spec.ts --watch=false
Test Files  1 passed (1)
Tests  21 passed (21)

$ corepack yarn test --watch=false
Test Files  1 failed | 574 passed (575)
Tests  1 failed | 7172 passed (7173)
```

## No cubierto

- No se declara despliegue remoto ni medición antes/después del flujo de reserva. La evidencia nueva es contra una instancia local que sirve el SHA integrado.

## Desvíos del plan

- La suite completa dejó un timeout de `register-practitioner.spec.ts` en un caso de backend simulado. Al ejecutarlo solo pasó 95/95; no se reprodujo aisladamente y queda pendiente de clasificación: esa evidencia no permite atribuirle una causa.
- Los dos rojos anteriores de `shell-layout.spec.ts` se corrigieron actualizando su contrato para incluir la ruta ya existente de Cotizaciones en el bloque clínico. El spec pasó 54/54; `insurance-analytics.spec.ts` también pasó 10/10 aislado.

## Riesgos residuales

- El comparador conserva resultados de maqueta ya existentes; retirar documentos no convierte esos precios en publicados.
- `yarn lint` global sigue rojo con 243 errores de `prefer-on-push-component-change-detection` en specs ajenos al carril; los dos specs nuevos pasan lint focalizado.

## Decisiones y ambigüedades

- Los documentos diagnósticos se mantienen en su área propia. Cotizaciones no los carga ni usa como cabecera para conservar una sola responsabilidad visual.
