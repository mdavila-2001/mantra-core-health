# Plano de planta (F1c) — reporte del trabajo web

Rama `claude/web-infra-plano` (desde `origin/dev`), worktree `/home/user/wt-web-plano`.
Sin push y sin PR. Contrato que manda: `CONTRATO-PLANO.md` (repositorio de documentación).
Todo lo de abajo está verificado **contra el simulador del front**; no contra la API real.

## Qué quedó hecho

| Pedido | Estado | Dónde |
|---|---|---|
| Cliente + tipos exactos del contrato | Hecho, con prueba | `core/data-access/floor-plan/` |
| Simulador coherente (estado que cambia con `asOf`, 422/412/404, `patient` ausente para Limpieza y Mantenimiento) | Hecho, con prueba | `core/mock/fixtures/floor-plan.*`, `core/mock/handlers/floor-plan.*` |
| Visor SVG: zoom y desplazamiento por rueda, pellizco y teclado; foco por área, zona y unidad; pestañas por piso; capas; leyenda; color por ciclo de vida, disponibilidad, ocupación, higiene, aislamiento, v2, unidad y función con patrón + glifo + texto; búsqueda que centra; minimapa; lista alternativa | Hecho | `shared/components/organisms/floor-plan-canvas`, `features/floor-plan/viewer` |
| Tarjeta de hover (WCAG 1.4.13): 300 ms / 0 ms en caliente / 200 ms, singleton, alcanzable con el puntero, `Escape` sin mover el foco, voltea y desplaza en los bordes; teclado con una sola parada y flechas espaciales; toque (primer toque tarjeta, segundo ficha); hoja no modal en 390 px | Hecho | `shared/components/molecules/plan-space-card`, `core/floor-plan/hover-intent.ts` |
| `Tooltip` extendido, no duplicado | Hecho | `shared/components/atoms/tooltip` (motor `placeFloating`, modo `legacy`) |
| Nueve estados M34 en el visor (S3 con próxima acción, S7 con antigüedad, S9 con `requestId`) | Hecho en 1440/768/390, claro y oscuro | evidencia `informe-m34-*` |
| Editor: mover (con sus camas), redimensionar con 8 asas, rotar (Shift = 15°), local rectangular y poligonal, vértices, muros, puertas y ventanas, imán a grilla/vértices/aristas (Alt suspende, Shift ortogonal, no pisa a una hermana), validación local por figura con borde + glifo + rótulo, guardar con `If-Match` por delta, 422 por figura (S4) con lista que enfoca, 412 con *Ver cambios* / *Recargar y reaplicar*, deshacer/rehacer (100 pasos), paleta de sin ubicar, quitar del plano con confirmación, bloquear, borrador en `localStorage`, `beforeunload` | Hecho | `features/floor-plan/editor`, `core/floor-plan/editor-*` |
| Editor en 390 px | Solo lectura con aviso (D-PL-02) | `floor-plan-editor-page` |
| Claro y oscuro, 1440/768/390, táctil | Hecho | evidencia |

## Peldaños reales

1. **Escrito y tipado**: `tsc -p tsconfig.app.json --noEmit` limpio; `ngc -p tsconfig.app.json --noEmit` (revisa plantillas) sin errores en archivos del plano; `eslint --max-warnings=0` limpio en todo lo tocado.
2. **Pruebas unitarias**: `ng test` sobre el código final, **26 archivos y 301 pruebas en verde** (cliente, simulador y semilla, geometría, imán, intención de hover, gestos, validación, modelo, muros/puertas/ventanas, atajos, guardado y almacén del editor, almacén M34 del visor, `Tooltip`, `placeFloating`). No se corrió la suite completa del repo (`yarn test`) ni se midió regresión fuera de las pruebas del plano y del `Tooltip`.
3. **Navegador contra el simulador** (Chromium 1243 con Playwright, sin `networkidle`): **440 comprobaciones, 0 fallas** en 6 guiones (editor 154, hover 50, M34 54, modos de color/leyenda/lista/búsqueda/foco 72, roles 34, teclado y toque 76), cada uno por ancho (1440/768/390) y tema (claro/oscuro). Informes en `docs/frontend/evidence/plano/informe-*.json`, capturas en el mismo directorio (218 PNG).
4. **Contraste medido con `getComputedStyle`** (compuesto sobre el fondo, WCAG 2.x), 30 combinaciones por tema: rótulo ≥ 4,5:1 y borde ≥ 3:1 en todas **después** de aclarar el relleno fuerte (antes 5 combinaciones quedaban entre 3,85 y 4,26). `contraste-estados-1440-*.json`. Ojo: las capturas de los modos de color son anteriores a ese ajuste de relleno.
5. Gates del repo tocados y en verde para el plano: `check-max-lines`, `check-usted`, `check-english-identifiers`, `check-css-tokens`, `check-colores-sueltos`, `check-client-prefixes`, `check-api-prefixes`, `check-route-prefixes`, `check-doc-links`, `check-doc-coverage` (los organismos del plano), `check-api-contract-drift` (0 operaciones del plano sin documentar).

## Lo que NO se verificó

- **Nada contra la API real.** No hay fila de red: el simulador responde dentro del `HttpClient`, así que Playwright no ve peticiones. La forma de la petición (`PATCH /layout` con `If-Match`, delta, ids de cliente, 422/412) se comprueba en pruebas del almacén y del manejador, no en la red.
- **La ausencia de `patient` en la respuesta de red** para Limpieza y Mantenimiento se comprobó en el manejador y en el DOM (sin iniciales ni nombre), no en una respuesta HTTP.
- **«Recarga dura → misma imagen»**: el simulador vive en memoria y se reinicia al recargar. Tras guardar se comprueba que la pantalla muestra lo que devuelve un nuevo `GET /layout` del simulador, no persistencia real.
- **Rendimiento con 1 600 locales**: no se midió (la semilla tiene 88 espacios). La virtualización existe y está probada con datos sintéticos de la prueba, sin trazas de Playwright.
- **Carga por ventana de la ficha completa**: el visor carga el plano entero en páginas de 500; no pide solo lo visible.
- **Editor con toque**: las asas táctiles de ≥ 44 px están en el CSS pero el editor no se probó con un contexto `hasTouch`.
- **Combobox de búsqueda**: es un listbox simple con teclado, no un combobox ARIA completo. Auditoría axe: no corrida.
- Última construcción del navegador con `--aot=false --source-map=false`, por memoria (la AOT se mató por OOM varias veces); las plantillas se revisaron con `ngc` aparte. Las capturas del visor de la primera mitad del trabajo salieron de construcciones AOT.
- Los inventarios generados (`docs/reports/generated/*`) están desactualizados para todo el repo y **no se regeneraron** (otros carriles también los tocan; conviene regenerar una vez al integrar).
- Las pruebas de Playwright del repo (`yarn pw`) no se corrieron ni se agregó spec propia a `playwright/`: la evidencia son guiones externos.

## Lo que el contrato pide y quedó fuera

Plantillas de habitación (`POST /stamp`) con vista previa, calibrar fondo, escalera/ascensor, circulación, anotación, medir, alinear y distribuir, duplicar (`Ctrl+D`), traer/enviar atrás (`zOrder`), reemplazo total (`PUT /layout`), `dryRun` desde la pantalla, uso de `GET /validation` en la UI, edición con varias figuras elegidas a la vez, «crear el primer lienzo», desplazar con la barra espaciadora, diferencia con el `area_m2` declarada durante el arrastre (solo se muestra el aviso `AREA_MISMATCH` que devuelve el guardado), y el motivo del «quitar del plano» no viaja al servidor (el contrato no tiene campo para él).

## Supuestos (cambiarlos es barato)

- La lista de unidades sale de `card.ownerUnit` de los espacios; no hay endpoint propio.
- El simulador acepta cualquier sede salvo la «ajena» (404 de otro tenant); el rol se elige con `sessionStorage['mock:plan-role']` (SA, AO, AS, ENF, ADM, LIM, MAN, JQ, FAC, PRO).
- Escenarios del simulador: `mock:plan-scenario` = `no-plans`, `empty-plan` o `concurrent-edit` (la próxima escritura da 412 porque «otra persona» quitó una cama).
- Los glifos del plano son propios (el juego de iconos de navegación es cerrado).
- La ficha de un espacio abre `/administration/medical-organization/spaces/:id`, que pertenece a F1.
- El editor no tiene guardia de salida de ruta (no hay `canDeactivate` en el repo): protege `beforeunload` y el botón «Volver al plano» pregunta.
- Se agregaron al proxy y a nginx los prefijos `/floor-plans`, `/care-spaces`, `/sites/` y `/practice/floor-plan-catalog`.

## Defectos que la propia evidencia encontró y quedaron corregidos

El encuadre inicial quedaba para un tamaño intermedio del contenedor (120 % donde «Ajustar» daba 75 %); un imán a vértice dejaba una figura encima de su hermana; la ayuda de la herramienta empujaba el plano 36 px y el clic caía en otro punto; el lienzo consumía `Entrar` y el editor no podía cerrar un trazo; en 390 px la hoja de la tarjeta tapaba 16 px del espacio tocado; el relleno fuerte no llegaba a 4,5:1 con el rótulo; faltaban los prefijos del proxy; el panel derecho del editor se ensanchaba con una opción larga.

## Archivos fuera de las carpetas propias

`src/app/app.routes.ts` (+5), `src/app/core/navigation/navigation.map.ts` (+28, dos secciones), `src/app/core/mock/handlers/index.ts` (+3), `src/app/shared/components/atoms/tooltip/*` (extensión), `proxy.conf.json`, `proxy.conf.docker.json`, `deploy/api-locations.conf`, `docs/integrations/backend-api.md` (12 operaciones), `docs/components/plano-de-planta.md`, `docs/index.md` (una fila).

## Evidencia (`docs/frontend/evidence/plano/`)

`10-…` hover con cada tipo de estado y en los bordes (voltea/desplaza) · `20-…`/`21-…` foco por teclado y toque (primer y segundo toque) · M34 (S2…S9) del visor · `50-…` modos de color · `51-…` leyenda como filtro · `52-…` lista alternativa · `53-…`/`54-…` búsqueda · `40-…` roles · `60`–`71` editor (inicial, selección, mover, solape local, 422 por figura, guardado, 412 y «Ver cambios», quitar/dibujar, borrador, muro/puerta/ventana, 390 solo lectura) · `informe-*.json` y `contraste-estados-*.json`.
