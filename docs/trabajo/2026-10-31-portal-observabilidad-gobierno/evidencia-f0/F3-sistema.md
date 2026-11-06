# F3-SISTEMA-FRONT: estado real (31/10/2026)

Carril cerrado antes de tiempo por limite de tokens. Lo que sigue es lo que existe y lo que NO se verifico.

## Hecho (commits en la rama)
- **chart-panel**: unidad `duracion`; marcas dataviz (barra <= 24 px con brecha 2 px incl. apiladas, marcador 8 px con anillo, area 10 %, rejilla solida); `tipo 'histograma'` (cubos cerrados a izquierda o derecha); `paleta categorica|ordinal|estado` + `rol` por serie (el contrato rechaza mezclar); `enfasis`, `objetivo`, `anotaciones`; `[plano]`, `[refrescando]`; una serie no lleva leyenda (X-8). KpiTile: `estado`, `hero`, `prefijo`, `[plano]`. `check-chart-palette` en verde. NO hecho: `mapa-calor.escala ordinal`, `app-meter`, `app-segmented-bar`, `DimensionFiltro` abierta por spec.
- **Cliente** `core/data-access/observability/` tipado contra el codigo fuente de la API (el contrato `CONTRATO-observabilidad.md` llego tarde: **no se reconcilio campo a campo**). Quita `interval` donde la API lo rechaza (400).
- **Area Sistema** en `/superadmin/observability`: Resumen, Errores (grupos, detalle con requestId, busqueda por requestId, cambio de estado con motivo y version), Latencia, Consultas SQL, Endpoints, No medido; contexto en URL (rango, La Paz/UTC, frescura). Falta: Workers/dependencias/SLO (la API no los publica), simulador (`check-mock-vs-client` marca el cliente nuevo), p50 en el tiempo (la API no lo da).
- `/admin/observability` agregado a `proxy.conf.json`, `proxy.conf.docker.json` y `deploy/api-locations.conf` (sin ellas el dev server devolvia index.html).

## Verificado
- `tsc -p tsconfig.app.json` limpio sobre el arbol rebasado (13:3x); `tsc` spec y playwright limpios; eslint de lo tocado limpio; Vitest de lo tocado: 17 archivos, 210 pruebas verdes (antes de los ultimos cambios del cliente: `sinIntervalo` y su prueba **no se reejecutaron**).
- Playwright contra API real + Postgres (`playwright/observabilidad-sistema.spec.ts`, corrida 5): pasan 6 de 16. Carga conocida 12x404/9x400/5x403/30x200: deltas exactos en la API; psql: UNMATCHED coincide, 4 requestId del 500 en Postgres = los enviados; composicion (1 tarjeta, holgura izq-der 0, ancho >= 93 %, sin desborde) en 390/768/1440; Resumen: UI 1.877 = API 1877 = psql 1877; Errores: ocurrencias UI 33 = psql 33, los requestId se ven; busqueda por requestId; PATCH 200, fila en Postgres (row_version+1, nota, resolved_at), estado Resuelto tras `page.reload()`. Detalle en `F3-sistema/bitacora-*.json` y `consola-red-*.json`.
- **No corrieron** (test 7 agoto tiempo; los 9 siguientes no se ejecutaron): Latencia, SQL, Endpoints (UNMATCHED en UI), No medido, teclado, URL, estado vacio real, S9/S7/S5 inducidos, control negativo de la medica. Sus capturas no existen.

## Capturas (22, en `F3-sistema/capturas/`): resumen, errores, errores-detalle x 390/768/1440 x claro/oscuro; requestid y estado-cambiado a 1440
Vistas con Read: solo `resumen-1440-claro`. Defectos vistos y SIN corregir: (1) las barras de estado en claro son oscuras y 4xx (marron) y 5xx (rojo oscuro) casi no se distinguen: usar `-fg` como relleno no basta, hay que elegir otros tonos o rotulo directo; (2) cinco tarjetas y una huerfana en la segunda fila (la heroe ocupa dos columnas); (3) la captura fullPage superpone la barra lateral fija (artefacto de captura). Las demas capturas no se miraron.
