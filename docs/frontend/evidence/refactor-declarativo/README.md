# Evidencia · refactor declarativo (2026-09-21)

Generada por `playwright/refactor-declarativo-evidencia.mjs` contra `ng serve --port 4377` con el
backend simulado de `mockup`, Chromium de Playwright 1.62.1, viewport 1440×1000 (y 390×844 donde
se indica), locale `es-BO`, zona `America/La_Paz`, cuenta `superadmin@alovida.mock`.

`veredictos.json` tiene cada comprobación con su resultado y detalle, la URL base y la fecha.
Un veredicto en rojo se conserva ahí: no se borra ni se relaja.

## Qué prueba cada captura

| Archivo | Qué muestra |
|---|---|
| `pacientes-1440-pagina-1.png` | `/administration/patients` con `historialDeCursor`: primera página, «Anterior» apagado |
| `pacientes-1440-pagina-2.png` | Tras «Siguiente»: otras filas, «Anterior» encendido |
| `pacientes-390.png` | La misma pantalla en móvil: prioridad 2 plegada al detalle |
| `organizaciones-1440-pagina-1.png`, `catalogo-servicios-1440-pagina-1.png`, `solicitudes-seguro-1440-pagina-1.png` | Los otros tres consumidores migrados. En el simulador tienen una sola página, así que la paginación no se dibuja (y no debe dibujarse); el cursor se ejercita en sus specs |
| `stock-data-table-<variante>.png` | El banco con `DataTable` montado por escenario: la ficha del escenario y la pestaña «Salidas» |
| `stock-data-table-<variante>-marco.png` | Solo el marco del dispositivo, para comparar contra la pantalla real |
| `stock-content-dialog-<variante>[-marco].png` | `ContentDialog` con contenido proyectado; `con-cambios` tras Escape, preguntando |
| `stock-view-state-host-<estado>[-marco].png` | Los diez estados del `ViewState` en `ViewStateHost` |

## Lo que esta evidencia NO acredita

- **Integración con la API real.** Todo es backend simulado.
- **Peticiones de negocio.** El simulador responde en proceso: ni Playwright ni la pestaña «Red»
  del banco ven esas lecturas. «Nada salió a la red» es literal.
- **Paridad visual medida** entre el organismo en el marco y la misma pieza en su pantalla: las
  capturas están una al lado de la otra para compararlas a ojo; no hay comparación por píxel.
