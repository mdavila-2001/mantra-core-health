# FAR-07 · Pestaña «Integración» del catálogo de la farmacia — evidencia

Estado al cierre de esta entrega: **sin evidencia de navegador**. Ningún caso
visual se da por bueno (`NO_EVIDENCE_NO_DONE`).

## Por qué no hay capturas

La construcción de desarrollo (`ng build --configuration development`), que es
el paso previo a servir la aplicación para el navegador, se cortó tres veces por
falta de memoria en la máquina compartida (el proceso de construcción y su
`esbuild` superan juntos el límite disponible mientras corren otras tareas). Sin
servidor no se abrió ninguna pantalla. El guion de capturas quedó listo pero no
se ejecutó.

## Casos

| # | Rol · ruta | Qué se tenía que ver | Estado |
|---|---|---|---|
| 1 | Farmacia 2 · `/administration/pharmacy-catalog?tab=integration` sin conexión | «Conectar el sistema de la farmacia» | BLOCKED (sin servidor) |
| 2 | Farmacia 2 · conectar y vincular dos productos, recargar | La conexión y los dos vínculos tras recargar; `POST` 201 y 201 | BLOCKED (sin servidor) |
| 3 | Farmacia 1 · «Sincronizar ahora» | Botón deshabilitado en vuelo; recibidos, vinculados, aplicados y los 10 sin vincular | BLOCKED (sin servidor) |
| 4 | Farmacia 1 · Inventario → Sucursal «Casa central» | Cantidades traídas del sistema externo | BLOCKED (sin servidor; además, el inventario por sucursal del front no está en esta rama) |
| 5 | Paciente · disponibilidad de A y B | La Casa central refleja la sincronización | BLOCKED (sin servidor) |
| 6 | Farmacia 1 · sincronizar con el sistema de la farmacia caído (502 interceptado en el navegador) | «No pudimos hablar con el sistema de la farmacia», sin resumen a medias | BLOCKED (sin servidor) |
| R | Radio: las otras cinco pestañas del catálogo | Abren como antes | BLOCKED en navegador; cubierto por `pharmacy-catalog-hub.spec.ts` |

Temas claro y oscuro, 1440×900 y 390×844: ninguno capturado.

## Lo que sí se verificó (sin navegador)

- Specs: `pharmacy-integration.client.spec.ts` (las siete llamadas),
  `pharmacy-integration.spec.ts` (16 casos: sin conexión, alta, datos de la
  conexión, sincronización en vuelo y resultado, 422 y 502 en castellano,
  conexión inactiva, sistema no configurado, vincular producto y su 409),
  `catalog-tabs.spec.ts` y `pharmacy-catalog-hub.spec.ts` con la sexta pestaña.
- `tsc -p tsconfig.app.json --noEmit` y `eslint` sobre los archivos tocados.

Errores de consola, `pageerror` y peticiones fallidas: no hay registro porque
no se abrió el navegador (`consola.txt`).
