# FAR-04 · Catálogo por pestañas — evidencia de navegador

Compilación de producción del front contra la API local, con las cuentas sintéticas de la farmacia (Farmacia FAR
Uno) y del paciente (`@alovida.test`). Ruta: `/administration/pharmacy-catalog`. Errores de consola, `pageerror`,
peticiones fallidas y escrituras: `consola.txt`.

Nombre de archivo: `rol__ruta__estado__tema__viewport.png`.

La rama trae `dev` con FAR-07: se ven seis pestañas, la sexta «Integración».

| # | Caso | Archivos | Estado |
|---|---|---|---|
| 1 | Menú de la farmacia: Resumen, Catálogo, Horario y turnos, Solicitudes de retiro, Promociones, Sucursales (más los fijos «Mi perfil» y «Notificaciones») | `farmacia__menu__abierto__{claro,oscuro}__{1440x900,390x844}.png` | PASS |
| 2 | Un membrete «Catálogo», una tarjeta, seis pestañas con marco de ventana; Productos abierta con su tabla | `farmacia__catalogo__productos__*` | PASS |
| 3 | Clic en cada pestaña: la URL pasa a `?tab=categories`, `prices`, `inventory`, `import`, `integration`, `products`; ninguna dibuja membrete propio dentro de la tarjeta; «Atrás» después de las seis vuelve a `/administration/pharmacy` (sin entradas nuevas en el historial) | `farmacia__catalogo__pestana-*__claro__1440x900.png` | PASS |
| 4 | `/administration/pharmacy-inventory?alerts=true` termina en `/administration/pharmacy-catalog?alerts=true&tab=inventory`, Inventario abierta y «solo alertas» marcado | `farmacia__ruta-vieja-inventario-alertas__claro__1440x900.png` | PASS |
| 5 | `/administration/pharmacy-categories`, `-prices`, `-import` terminan en `?tab=categories`, `prices`, `import`, cada una con su pestaña abierta | `consola.txt` (URLs finales) | PASS |
| 6 | Importación → terminar una carga → «Ver productos» | — | No se ejecutó en esta corrida: la carga de productos de punta a punta está en la evidencia de FAR-05 (casos 2 y 3); el enlace a la misma ruta lo cubre `pharmacy-catalog-hub.spec.ts` |
| 7 | Resumen → «Revisar inventario» abre `?tab=inventory&alerts=true` (Inventario); «Actualizar en lote» abre `?tab=import` (Importación) | `consola.txt` | PASS |
| 8 | Categorías: crear, renombrar y eliminar, cada paso con recarga; Precios: cambiar uno, guardar (`PATCH` 200) y recargar: 17,25 | `farmacia__catalogo__precios-guardado-recarga__claro__1440x900.png`; las de categorías, en la evidencia de FAR-05 (R2) | PASS |
| 9 | 390x844: la tira de pestañas se desplaza, la primera no queda cortada, la página no se desborda | `farmacia__catalogo__productos__{claro,oscuro}__390x844.png` | PASS |
| 10 | Paciente: `/administration/pharmacy-catalog` por URL termina en `/dashboard` sin la tarjeta del catálogo; «Catálogo» no está en su menú (1440 y 390) | `paciente__catalogo-por-url__claro__{1440x900,390x844}.png` | PASS |
| 12 | Cinco viewports (390x844, 768x1024, 1024x768, 1440x900, 1920x1080): tira sin desbordar en las cuatro anchas y desplazable en 390, sin desborde de página | `farmacia__catalogo__productos__claro__*` | PASS |
