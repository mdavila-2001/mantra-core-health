# FAR-07 · Pestaña «Integración» del catálogo de la farmacia — evidencia

Datos sintéticos: «Farmacia FAR Uno» (farmacia 1, ya conectada a su sistema, sede «Casa central»), «Farmacia FAR
Dos» (farmacia 2, sin conexión al empezar), productos `FAR06-*` y cuentas `@alovida.test`. La API corre con
`PHARMACY_ERP_BASE_URL` apuntando al simulador de farmacia de `mock-provider-server` (catálogo de 12 productos
`ERP-0001…ERP-0012`, stock determinista por sucursal). Ruta: `/administration/pharmacy-catalog?tab=integration`.

Cada caso en claro y oscuro a 1440×900 y 390×844, salvo donde se indica. Nombres: `<rol>-<pantalla>-<caso>-<tema>-<ancho>.png`.
Pedidos, respuestas, lecturas de persistencia y errores de consola: `consola.txt`.

Interceptado (lo dice el nombre del archivo): solo las dos capturas «sin conexión» a 390 tras el ajuste del botón,
porque la farmacia 2 ya estaba conectada; ahí se responde vacía la lista de conexiones y el resto de los pedidos son
reales. El 502 y el «no configurada» son **reales**: el simulador se apagó de verdad y la API se arrancó sin la URL.

| # | Rol · caso | Archivos | Resultado |
|---|---|---|---|
| 1 | Farmacia 2 · sin conexión: «Su farmacia todavía no está conectada» y «Conectar el sistema de la farmacia» | `farmacia-integracion-sin-conexion-{claro,oscuro}-1440.png`, `…-{claro,oscuro}-390-tras-ajuste-interceptado.png` | PASS. A 390 el rótulo del botón se salía del botón (`…-390-antes-del-ajuste.png`): corregido en este PR, ahora pasa a dos renglones (alto 66 px, sin desborde) |
| 2 | Farmacia 2 · conectar («Casa central») y vincular X1↔ERP-0001 y X2↔ERP-0002, recargar | `farmacia-integracion-conectada-claro-1440.png`, `farmacia-integracion-vincular-dialogo-claro-1440.png`, `farmacia-integracion-vinculos-tras-recargar-{claro,oscuro}-{1440,390}.png` | PASS. `POST …/integration-connections` 201; `POST …/product-mappings` 201 y 201; tras recargar la tabla muestra los dos vínculos, leídos de la API |
| 3 | Farmacia 1 · «Sincronizar ahora» | `farmacia-integracion-con-conexion-*`, `farmacia-integracion-sincronizando-claro-1440.png`, `farmacia-integracion-resultado-sincronizacion-*`, `farmacia-integracion-lotes-tras-recargar-claro-1440.png` | PASS. Botón deshabilitado mientras viaja (`aria-disabled=true`); `POST …/sync` 200 con recibidos 12, vinculados 2, aplicados 1 (A estaba en 0 en «Casa central», el sistema dice 1) y los 10 sin vincular con su nombre; las tres corridas siguientes, aplicados 0. Tras recargar, «Última sincronización» y la lista de lotes vienen de la API |
| 4 | Farmacia 1 · Inventario → Sucursal «Casa central», filtro «FAR06» | `farmacia-inventario-casa-central-tras-sincronizar-*` | PASS. `GET …/sites/:siteId/stock` 200: A=1 y B=11, las cantidades del sistema externo para esa sede |
| 5 | Paciente · tienda (`/my-account/pharmacy`, búsqueda «FAR06»), antes y después de sincronizar | `paciente-farmacia-busqueda-far06-{antes,despues}-de-sincronizar-{claro-1440,oscuro-390}.png` | PASS. Antes: «Casa central» sin A. Después: «Casa central» con A. Las demás sedes, iguales en las dos |
| 6 | Farmacia 1 · simulador apagado (real) → «Sincronizar ahora» | `farmacia-integracion-simulador-apagado-502-*` | PASS. `POST …/sync` 502 `PHARMACY_INTEGRATION_UNAVAILABLE`; la pantalla dice «No pudimos hablar con el sistema de la farmacia. No se cambió ninguna existencia…» con el número de petición y no muestra resumen; la cantidad de lotes no cambia (7 antes y después) |
| 7 | Farmacia 1 · API sin `PHARMACY_ERP_BASE_URL` (real) | `farmacia-integracion-no-configurada-*` | PASS. Aviso «La conexión con el sistema de la farmacia no está configurada…» y «Sincronizar ahora» deshabilitado; el `POST …/sync` directo responde 422 `PHARMACY_INTEGRATION_NOT_CONFIGURED` |
| 8 | Radio · las otras cinco pestañas | `farmacia-catalogo-pestana-importacion-claro-1440.png` | PASS. `?tab=products|categories|prices|inventory|import` abre cada una con su tarjeta y la pestaña marcada; seis pestañas en la tira |

Medida de la regla de composición (§5): la tarjeta del catálogo queda centrada, con 40 px a cada lado a 1440 (93,3 %
del ancho útil) y 12 px a 390 (93,8 %), sin desborde horizontal.

Observación: en un primer intento, una recarga justo después de sincronizar respondió 401 en un pedido y la pantalla
no llegó a la pestaña; repetido con los mismos pasos, la recarga mantuvo la sesión. No se volvió a reproducir.
