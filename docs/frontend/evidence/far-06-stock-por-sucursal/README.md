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
| 6 | Casa central: D «Marcado sin stock en el catálogo», sin interruptor (la marca llega de la API como `outOfStockDeclared`). H, publicado después, ya no sale «Sin registrar»: sigue el catálogo (ver 11) | `farmacia__catalogo-inventario__casa-central-far06__{claro,oscuro}__{1440x900,390x844}.png` | PASS. Las capturas `farmacia_pharmacy-catalog-inventory_casa-central_*` son anteriores al cierre |
| 7 | Volver a «Lo tengo» con cantidad: Sur 2 → A en «Lo tengo» con 3 → Guardar → `PUT` 200 con `{available:true, quantity:3}` → recarga → A en «Lo tengo»; el paciente vuelve a ver A en Sur 2 (1440 y 390) | `farmacia__catalogo-inventario__sur2-A-lo-tengo-3-{sin-guardar,tras-recargar}__claro__1440x900.png`, `paciente__mi-cuenta-farmacia__A-de-nuevo-en-sur2__claro__*` | PASS |
| 8 | Un 422 queda en su fila: con la pantalla abierta, C se marca «no tengo» desde el catálogo (otra pestaña, por la API); «Lo tengo» en C → Guardar → `PUT` 422 → el motivo y el código de soporte quedan bajo la fila de C, el aviso dice «el motivo está en su fila»; después la marca se deshace y C queda como estaba (conteo 0) | `farmacia__catalogo-inventario__sur2-C-rechazo-422__claro__1440x900.png`, `consola.txt` | PASS |
| 9 | 390: la celda «En la sucursal» y la cantidad entran en la fila; el rótulo vacío de la cantidad («Del catálogo») se lee entero | `farmacia__catalogo-inventario__casa-central-{far06,producto-nuevo}__{claro,oscuro}__390x844.png` | PASS |
| 10 | Radio: Precios y Productos cargan su tabla; «Subir CSV» abre su diálogo | `farmacia__catalogo-{prices,products}__radio__claro__1440x900.png`, `farmacia__catalogo-inventario__radio-subir-csv__claro__1440x900.png` | PASS (apertura; no se aplicó un CSV) |
| 11 | Disponibilidad por producto (cierre): un producto publicado después de que Casa central lleva stock propio (CIERRE-113533) sale en Casa central como «Lo tengo · Como en el catálogo», con el aviso «Los productos con stock propio en esta sucursal no siguen lo que cambie en "Todas"; los demás muestran lo declarado en el catálogo.» | `farmacia__catalogo-inventario__casa-central-producto-nuevo__{claro,oscuro}__{1440x900,390x844}.png` | PASS |

Las capturas de 1440 con «¿Lo tiene en esta sucursal?» como cabecera de la columna son anteriores al cambio a
«En la sucursal».

Los casos 1 a 5 son de la primera entrega. Con la disponibilidad por producto cambiaron los textos de los avisos:
con «Todas», «Casa central tiene stock propio en algunos productos: en esos, lo que cambie en "Todas" no la afecta,
tampoco lo que suba por CSV»; en una sede sin stock propio, «El producto que cambie acá pasa a llevar su propio stock
en esta sucursal; los demás siguen el catálogo». Los casos 6 a 11 son del cierre (30/10/2026) y sus hechos están al
final de `consola.txt`.
