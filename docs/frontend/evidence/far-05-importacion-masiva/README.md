# FAR-05 · Importación masiva — evidencia de navegador

Pestaña «Importación» del catálogo de la farmacia (`/administration/pharmacy-catalog?tab=import`),
con la cuenta sintética de la farmacia y la del paciente. Tema claro y oscuro a 1440x900 y 390x844;
el selector además a 768x1024, 1024x768 y 1920x1080 (claro). Datos sintéticos. Consola y red: `consola.txt`.

Nombre de archivo: `rol__ruta__estado__tema__viewport.png`.

| # | Caso | Archivos | Estado |
|---|---|---|---|
| 1 | Selector «Qué va a importar» con Productos, Categorías, Precios y Sucursales; Productos abre el asistente | `farmacia__catalogo-importacion__selector-productos__*` | PASS |
| 2 | Productos, CSV de 300 filas → «Revisar datos»: revisión local y debajo la vista previa del servidor; dos `POST …/products/bulk` con `dryRun: true` (250 + 50) | `…__productos-revisar-datos__*__1440x900`, `…__reimportar-productos-revisar-datos__*__390x844` | PASS |
| 3 | «Publicar»: dos `POST` sin `dryRun` (250 + 50, 200/200), resultado por fila; tras recargar, Productos lista el producto importado | `…__productos-resultado__*`, `farmacia__catalogo-productos__tras-importar-recarga__*` | PASS |
| 3b | El mismo archivo otra vez: 300 «sin cambios», sin altas | `…__reimportar-*` | PASS |
| 4 | Categorías: plantilla descargada (`plantilla-categorias.csv`); CSV con una fila sin nombre → vista previa con la fila rechazada y su motivo; «Aplicar» crea las otras dos; tras recargar, Categorías las lista | `…__categorias-vista-previa__*`, `…__categorias-aplicado__*`, `farmacia__catalogo-categorias__tras-importar-recarga__*` | PASS |
| 5 | Precios: CSV con coma decimal y un código inexistente → actualizado, sin cambios y rechazado; tras recargar, Precios muestra el importe nuevo | `…__precios-vista-previa__*`, `…__precios-aplicado__*`, `farmacia__catalogo-precios__tras-importar-recarga__*` | PASS |
| 6 | Sucursales: el aviso dice que se crean como sedes de venta; una sede creada y otra rechazada (latitud sin longitud); tras recargar, la sede aparece en Horario y turnos | `…__sucursales-vista-previa__*`, `…__sucursales-aplicado__*`, `farmacia__horario-y-turnos__sede-importada-recarga__*` | PASS |
| 7 | Paciente · Farmacia: el producto importado y publicado aparece con su precio | `paciente__mi-cuenta-farmacia__*` | PASS |
| R1 | Radio · Inventario → «Subir CSV» abre su diálogo como antes (archivo sin cambios en este trabajo) | `farmacia__catalogo-inventario__subir-csv-abierto__*` | PASS (apertura); aplicar un CSV de inventario: no se ejecutó |
| R2a | Radio · categoría: crear (`POST` 201), renombrar (`PATCH` 200) y eliminar con confirmación (`DELETE` 200), cada paso seguido de recarga | `farmacia__catalogo-categorias__crear-dialogo__claro__1440x900.png`, `farmacia__catalogo-categorias__renombrada-recarga__claro__1440x900.png` | PASS |
| R2b | Radio · edición de producto desde el modal: precio a 13,75 en «Publicación», `PATCH` 200, tras recargar la fila dice Bs 13,75 | `farmacia__catalogo-productos__editado-recarga__claro__1440x900.png` | PASS |
| R2c | Radio · alta de producto desde el modal: «paracetamol cinfa 650» en «Medicamento del catálogo oficial» (`GET …/catalog-products` 200, 1 resultado) → ficha oficial (registro 84215, principio activo, concentración, forma, receta, titular) → presentación de 20 comprimidos, SKU `FAR05-PCT650`, «Publicado», Bs 9,50 → «Guardar producto»: `POST …/products` 201 con `catalogProductId`; tras recargar, la fila dice Publicado, Disponible, Bs 9,50; el paciente lo encuentra en las cinco sedes de FAR Uno | `farmacia__catalogo-productos__alta-{busqueda,ficha-oficial}__{claro,oscuro}__{1440x900,390x844}.png`, `farmacia__catalogo-productos__alta-publicacion__claro__1440x900.png`, `farmacia__catalogo-productos__alta-tras-recargar__claro__1440x900.png`, `paciente__mi-cuenta-farmacia__producto-del-catalogo-oficial__{claro__1440x900,oscuro__390x844}.png` | PASS |
| 8 | A 390 la columna «Motivo» de la vista previa va en la ficha de cada fila (tabla apilada), sin desplegar el detalle | `farmacia__catalogo-importacion__categorias-motivo__{claro,oscuro}__{390x844,1440x900}.png` | PASS (sólo vista previa: no se aplicó nada) |
| — | Un 413 dicho en pantalla | — | BLOCKED en navegador (cubierto por `entity-import.spec.ts` y `bulk-publish.spec.ts`) |

Observaciones:

- A 390 px la columna «Motivo» de la vista previa quedaba detrás del detalle plegado de `app-data-table`.
  Corregido: la columna es primaria y la tabla se apila en el teléfono (caso 8).
- En la tienda del paciente el producto importado salía en las sedes sin stock propio y no en las que ya
  llevaban stock por sede (riesgo R-05-5). Con la disponibilidad por producto de la API (PR del mismo nombre)
  un producto sin posición en una sede sigue lo declarado en el catálogo: ver la evidencia de FAR-06, caso 11.
- El catálogo oficial de medicamentos de la base de verificación se cargó por la API, con la cuenta de administración (`POST /terminology/code-systems`, `…/versions`, `…/versions/:id/import`, `…/concepts/:id/properties`, `…/versions/:id/publish`): tres registros reales de CIMA (75594, 70310 y 84215), normalizados con `tools/terminology-import/lib/medicine-catalog` de la API. Nada se escribió directo en la base.
- En la tarjeta del producto el nombre se repite («650 mg · PARACETAMOL CINFA 650 MG COMPRIMIDOS EFG 20 comprimidos»): CIMA nombra cada presentación con el nombre completo del medicamento. No es de este caso.
