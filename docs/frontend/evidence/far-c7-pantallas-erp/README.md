# Catálogo de la farmacia: compacto y sin sorpresas (31/10/2026)

Capturas de la rama `itzan/far-c7-erp-screens-dev`, servida con `ng serve` contra la API local, con la
cuenta de Farmacia Chavez (`admin.farmacia-chavez@alovida.test`). Ventana fija, sin `fullPage`. Esto es
evidencia, no aprobación: la revisión visual la hace otra persona.

«Filas visibles» cuenta las filas de la tabla dentro de la ventana (una fila cortada cuenta su parte).
«Capacidad» es `(alto de ventana − arriba de la primera fila) / alto de fila`: cuántas entrarían con
datos de sobra.

## Antes

Medido con el mismo recorrido sobre el código anterior (dos tarjetas, filas de 65-69 px, 10 por página):

| Pestaña, 1440×900 | Arriba de la 1.ª fila | Alto de fila | Capacidad |
|---|---|---|---|
| Productos | 612 px | 65 px | 4,4 |
| Precios | 535 px | 69 px | 5,3 |
| Inventario | 769 px | 67 px | 2,0 |
| Categorías | 477 px | 65 px | 6,5 |

A 390×844 Productos dejaba la primera fila en 877 px, fuera de la pantalla, detrás de buscador, cuatro
filtros y dos botones.

## Las seis pestañas, datos reales (24 capturas)

`<pestaña>-<ancho>-<tema>.jpg` para `products`, `categories`, `prices`, `inventory`, `import`,
`integration`; `1440` (1440×900) y `390` (390×844); `light` y `dark`. En todas hay una sola
`app-card`, la del catálogo.

| Pestaña | 1440: filas visibles / capacidad | 390: filas visibles / capacidad |
|---|---|---|
| Productos | 3 de 3 / 6,0 (fila de 55 px desde 571 px) | 3 de 3 / 3,1 (primera fila en 656 px; filtros detrás de «Filtros») |
| Categorías | 6 de 6 / 9,6 | 3,5 / 3,5 |
| Precios | 3 de 3 / 9,2 | 2,9 / 2,9 |
| Inventario | 3 de 3 / 6,5 | 0,4 / 0,4 (fichas apiladas de 213 px) |
| Importación | sin tabla al abrir | sin tabla al abrir |
| Integración | 5 / 7,1 | 0,5 / 0,5 |

## Densidad con más productos (`density-*.jpg`)

La farmacia de prueba tiene tres productos. Para ver cuántas filas entran, el listado
`GET /pharmacy/products` se interceptó **en el navegador** y se devolvieron 60 copias de los productos
reales con código y existencias distintas. No se escribió nada en la base.

| Captura | Filas visibles |
|---|---|
| `density-products-1440-light.jpg` | **6,2** (antes 4,4 con el mismo cálculo; el informe midió 5,5) |
| `density-prices-1440-light.jpg` | **9,2** (antes 5,3) |
| `density-inventory-1440-light.jpg` | **6,5** (antes 2,0) |
| `density-products-390-light.jpg` | 3,1 (antes 0) |

## Más de 500 productos (`over-500-*.jpg`)

Misma intercepción, con 520 copias: la respuesta llega cortada en 500 y con `truncated: true`.
Productos ya avisaba; ahora también Precios e Inventario («Se muestran los primeros 500», que en
Inventario aclara que «Sólo con alertas» y «Exportar CSV» ven sólo esos).

## Cambios sin guardar y enlace a la importación

- `unsaved-prices-ask-1440-light.jpg`: precio escrito en Precios y clic en «Inventario». Pregunta
  «¿Sale sin guardar?» con el diálogo de descarte de siempre.
- `unsaved-prices-kept-1440-light.jpg`: tras «Seguir en esta pestaña» sigue en Precios, la URL sigue en
  `?tab=prices` y el campo conserva `77.70`. Después se eligió «Descartar» y pasó a Inventario. No se
  guardó nada.
- `import-target-from-url-1440-light.jpg`: `?tab=import&target=prices` abre directo la importación de
  precios.

## Lo que no cubre

- La revisión visual y su aprobación.
- Inventario a 390 px sigue mostrando primero la sucursal, la forma de llevar el inventario, el CSV, el
  buscador y el guardado: los filtros plegables se aplicaron a Productos, que es la captura citada.
