# Matriz de migración

Consumidor previo → implementación destino, con las pruebas que lo cubren y su estado. Los
denominadores están escritos para que no se puedan mover sin que se note.

## Oleada 1 · F-01 `historialDeCursor` — 4 de 4 comprometidos

| Consumidor | Antes | Ahora | Líneas | Pruebas (sin cambios) | Aislado | Integrado | Navegador |
|---|---|---|---|---|---|---|---|
| `admin/patients/patient-list` | `VOLVER`, `historia`, `cursorSiguiente`, `cursor` computed, `mover` con push/pop | `paginado = historialDeCursor()`, `cursor = paginado.cursor`, `mover` delega | −20 | `patient-list.spec.ts` (10: filtro, cursor, volver, reintento) | ✔ | ✔ | ✔ ida y vuelta por cursor: `pacientes-1440-pagina-{1,2}.png`, `pacientes-390.png` |
| `admin/organizations/organization-list` | ídem | ídem | −18 | `organization-list.spec.ts` | ✔ | ✔ | ◐ pinta, pero el simulador da una sola página: el cursor solo lo cubre el spec (`organizaciones-*.png`) |
| `admin/services-catalog/services-catalog` | ídem (+ reinicio por práctica) | ídem | −14 | `services-catalog.spec.ts` (avanzar manda el cursor) | ✔ | ✔ | ◐ ídem (`catalogo-servicios-*.png`) |
| `insurance/insurance-claims/insurance-claims` | `BACK`, `history`, `nextCursor` | ídem | −14 | `insurance-claims.spec.ts` (sigue el cursor del servidor) | ✔ | ✔ | ◐ ídem (`solicitudes-seguro-*.png`) |

«Aislado» = la regla con su spec propio. «Integrado» = el spec de la pantalla, montada con
`RouterTestingHarness` y `HttpTestingController`, sigue en verde sin editarlo. «Navegador» =
`playwright/refactor-declarativo-evidencia.mjs` contra `ng serve` con el backend simulado; los
veredictos están en `evidence/refactor-declarativo/veredictos.json`.

**Retirada:** las tres copias de la regla desaparecieron con la migración (no queda `VOLVER`,
`BACK`, `historia` ni `history` en `features/**`). No hay adaptador temporal.

**Solapamiento conocido:** la rama `pablo/refactor-tabla-canonica` (worktree
`mch-pablo-tabla-canonica`, sin commit) agrega dos columnas a `patient-list`. Toca `columnas` y las
plantillas de celda; esta oleada toca imports y el paginado. Al integrar la segunda, el conflicto
esperable es el bloque de imports.

## Oleada 1 · Catálogo — 3 de 6 organismos con escenario

| Organismo | Descubierto | Escenario | Montaje válido | Interacción verificada | Paridad visual | Bloqueado |
|---|---|---|---|---|---|---|
| `DataTable` | ✔ | ✔ 12 variantes | ✔ spec + navegador | ✔ orden, cursor, selección, reintento, actualizar | ✘ no medida contra pantalla real (ver abajo) | — |
| `ContentDialog` | ✔ | ✔ 4 | ✔ | ✔ abrir, cerrar, Escape con cambios, guardar como intención | ✘ | — |
| `ViewStateHost` | ✔ | ✔ 10 | ✔ | ✔ reintentar, actualizar | ✘ | — |
| `FilterBar` | ✔ | ✘ | monta a ciegas (Router del padre) | — | — | pendiente de F-02 |
| `PageHeader` | ✔ | ✘ | monta a ciegas (`title` generado) | — | — | siguiente oleada |
| `DirectoryPage` | ✔ | ✘ | **no monta**: `estado`, `grupos`, `sustantivo` obligatorios sin valor válido | — | — | siguiente oleada |

«Paridad visual» exige comparar el organismo en el marco contra la misma pieza en una pantalla
real con datos equivalentes y el mismo viewport; no se hizo en esta oleada y se deja en ✘ en vez
de darlo por hecho. Las capturas del banco y de las pantallas están en la misma carpeta para
compararlas a ojo, que no es lo mismo.

## Lo que no entró

| Ítem | Motivo |
|---|---|
| F-02 (adopción de `FilterBar` en los cuatro listados) | Cambia anatomía visible: decisión de producto |
| Preview en documento propio con inyectores propios | Rediseño del banco; se documenta el aislamiento actual en `ESCENARIOS.md` |
| Escenarios de `DirectoryPage`, `PageHeader`, `FilterBar` | Fuera del alcance de los dos pilotos; `DirectoryPage` es el siguiente por ser el único que hoy no monta |
