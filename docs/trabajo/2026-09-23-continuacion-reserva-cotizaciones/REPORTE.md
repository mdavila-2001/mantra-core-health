# Reporte — Continuación de reserva y cotizaciones del paciente

> **AVANCE: 3 / 5 — 60 %.**

- Fecha: 2026-09-23 · Rama: `justin/continuar-reserva-cotizaciones-2026-09-23`.
- Peldaño: `TESTED` para la generación reproducible y los comportamientos cubiertos de Cotizaciones; quedan estados y mediciones de cierre.

## Completado

| ID | Resultado | Evidencia |
|---|---|---|
| H1.S1.M1 | La continuación parte de `origin/mockup` tras el merge de la reserva previa. | Base `5f3a7da0` |
| H1.S1.M2 | `test` y `typecheck` regeneran el índice de componentes antes de consumirlo. | `scripts/lib/relaciones-de-uso.test.mjs` → 26/26 |
| H2.S1.M1, M3 | Pantalla de Cotizaciones con filtro y orden; ruta lazy y menú de paciente. | Cotizaciones 5/5; navegación 30/30 |
| H2.S1.M2 (parcial) | Órdenes diagnósticas propias se cargan desde `/diagnostic-results/me/orders`; sus conceptos se traducen antes de pintarse. | Cotizaciones 6/6; no se imprimen IDs de orden ni de concepto |

## A medias

### H2.S1.M2 — Fuentes y documentos reales
- Qué anda: se muestran referencias de maqueta con procedencia y precios no publicados sin valor de reemplazo; las órdenes diagnósticas del titular se consultan en el endpoint propio y aparecen con etiqueta de terminología. La pantalla informa si hay truncamiento o un error de esa fuente, y no llama el endpoint si la sesión carece de perfil de paciente.
- Qué no anda: las recetas y servicios médicos no se componen todavía en esta pantalla; los estados vacío y sin origen todavía no tienen superficie propia.
- Qué falta exactamente: reutilizar un adaptador de recetas que no repita la lógica de «Dónde comprar mi receta» y definir un contrato de disponibilidad/precios para servicios médicos.
- Dónde quedó: `src/app/features/account/cotizaciones/`.

### H3.S1.M1–M2 — Medición y gates completos
- Qué anda: login contra la maqueta desplegada fue verificado anteriormente y los tests focalizados están verdes.
- Qué no anda: no se guardó una medición antes/después ni se terminó lint y la suite completa.
- Qué falta exactamente: correr el recorrido autenticado, guardar evidencia y clasificar cualquier rojo ajeno.
- Dónde quedó: `docs/trabajo/2026-09-23-continuacion-reserva-cotizaciones/`.

## Pendiente

| ID | Estado | Qué lo destraba |
|---|---|---|
| H2.S1.M2 | A MEDIAS | Adaptador reutilizable de recetas y contrato para servicios médicos |
| H3.S1.M1 | TODO | Recorrido autenticado y capturas |
| H3.S1.M2 | TODO | Gates completos y revisión final |

## Evidencia

- `node --test scripts/lib/relaciones-de-uso.test.mjs` → 26/26 PASS después de regenerar.
- `yarn test --watch=false --include=...cotizaciones...` → 5/5 PASS antes de incorporar documentos; `...cotizaciones.spec.ts` → 6/6 PASS después de cubrir órdenes propias, truncamiento, error y sesión sin perfil.
- `yarn test --watch=false --include=...navigation.service...` → 30/30 PASS.
- `yarn typecheck` → sin diagnósticos tras regenerar el índice.
- Compilación de `yarn start:dev --port 4202` → bundle de Angular generado; el proceso de verificación se cerró y el puerto 4202 no quedó escuchando.

## No cubierto

- No se declara verificación visual de la versión final: la segunda instancia local no terminó de enlazar antes de cerrarse; la ruta se cubre por pruebas de componente y navegación, pero sigue faltando Playwright contra esta rama.
- No se declara lint ni suite completa en verde. `yarn lint` falla en la base con 243 errores de `prefer-on-push-component-change-detection`, ajenos a estos archivos.

## Revisión técnica

- Revisión independiente posterior al primer incremento: detectó que se ocultaban errores, no se declaraba el truncamiento y no se protegía la sesión sin perfil. Los tres puntos se corrigieron antes del siguiente PR; las pruebas agregadas reprodujeron primero 3 fallos y luego verificaron 6 casos verdes.
