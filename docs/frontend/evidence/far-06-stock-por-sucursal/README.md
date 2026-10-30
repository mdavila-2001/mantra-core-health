# FAR-06 · Stock por sucursal — evidencia de navegador

Datos sintéticos (Farmacia FAR Uno, productos FAR06-A…H, cuentas `@alovida.test`). Ruta de la farmacia:
`/administration/pharmacy-catalog?tab=inventory`. Ruta del paciente: `/my-account/pharmacy` (tienda, búsqueda
«FAR06»), que pide la misma `GET /pharmacy-inventory/availability` que «Dónde comprar» y el carrito.
Errores de consola, red y lecturas de persistencia: `consola.txt`.

| # | Caso | Archivos | Estado |
|---|---|---|---|
| 1 | Selector «Sucursal» con «Todas» y cada sede de `opening-hours`; con «Todas», la tabla de siempre | `farmacia_…_todas_{claro,oscuro}_{1440,390}.png`, `farmacia_…_selector-abierto_{claro,oscuro}_{1440,390}.png` | PASS |
| 2 | Con «Todas», aviso «Casa central lleva su propio stock…» | los mismos de 1 | PASS |
| 3 | Sede en modo catálogo (Sucursal Sur 2): aviso de que el primer guardado la pasa a su propio stock | `farmacia_…_sur2-modo-catalogo-antes_claro_1440.png` | PASS |
| 4 | Mutación: Sur 2 → A en «No lo tengo» → Guardar → `PUT` 200 → relectura → recarga → A sigue en «No lo tengo» y la sede muestra «Esta sucursal lleva su propio stock…» | `farmacia_…_sur2-A-no-lo-tengo-sin-guardar_claro_1440.png`, `farmacia_…_sur2-A-no-lo-tengo-tras-recargar_claro_1440.png`, `consola.txt` | PASS |
| 5 | Paciente, regresión de rebote: antes A y B en todas las sedes; después Sur 2 sin A y **con B**, las demás sedes igual | `paciente_my-account-pharmacy_antes_*`, `paciente_my-account-pharmacy_despues-A-no-en-sur2_*` (claro y oscuro 1440, claro 390) | PASS |
| 6 | Casa central: D «Marcado sin stock en el catálogo», sin interruptor; H (publicado después) «Sin registrar en esta sucursal» con «Lo tengo» | `farmacia_…_casa-central_{claro,oscuro}_{1440,390}.png` | PASS en 1440. En 390 la celda se salía de la fila: corregido en CSS, no se volvió a ver (ver 9) |
| 7 | Volver a «Lo tengo» con cantidad (A en Sur 2 con 3) y el paciente ve A de nuevo | — | BLOCKED: no se ejecutó (ver 9) |
| 8 | Un 422 queda en su fila con el motivo | — | BLOCKED: no se ejecutó en navegador; cubierto por `site-stock-panel.spec.ts` |
| 9 | Corrección de la celda «En la sucursal» en 390 (rótulo más corto y valor que se acomoda) | — | BLOCKED: la compilación de desarrollo para volver a capturar se interrumpió por falta de memoria del equipo |
| 10 | Radio: Precios, Productos y «Subir CSV» sin cambios | — | BLOCKED: no se ejecutó |

Las capturas de 1440 con «¿Lo tiene en esta sucursal?» como cabecera de la columna son anteriores al cambio a
«En la sucursal».
