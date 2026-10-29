# Plano de planta — componentes y reglas del lienzo

El plano arquitectónico de una sede (F1c) tiene dos pantallas —el visor, en
`/administration/medical-organization/plan`, y el editor, en
`/administration/medical-organization/plan/edit`— y comparte un solo lienzo.
El contrato que manda es `CONTRATO-PLANO.md` (repositorio de documentación,
`SALUD/Arquitectura/infraestructura-hospitalaria/`); esta página dice **dónde
vive cada cosa** y qué regla no se rompe.

## Capas y quién importa a quién

| Capa | Qué hay | Regla |
|---|---|---|
| `core/floor-plan/` | Geometría, índice espacial, imán, atajos del lienzo, intención de hover, gestos, vista (zoom y encuadre), validación del dibujo, modelo del editor | Funciones puras, sin Angular ni DOM. Se prueban sin navegador |
| `core/data-access/floor-plan/` | `FloorPlanClient`, tipos del contrato, lectura de fallos (`reason`, `requestId`, errores por elemento) | La API es la autoridad: el cliente no decide nada |
| `core/mock/…/floor-plan.*` | Semilla coherente (88 espacios, 33 en PB, 51 en P1), estado que cambia con el tiempo y manejadores | Solo simulador. El rol se elige con `sessionStorage['mock:plan-role']` |
| `shared/components/…` | `app-floor-plan-canvas`, `app-floor-plan-minimap`, `app-plan-space-card`, `app-plan-legend`, `app-plan-glyph` | Presentacionales: reciben datos y emiten eventos |
| `features/floor-plan/` | `FloorPlanStore` (visor), `FloorPlanEditorStore` (editor), las dos páginas | La URL manda: `?site=&plan=&space=&focus=&unit=&color=&view=` |

## Organismos

- **`app-floor-plan-canvas`** (`FloorPlanCanvas`): el lienzo SVG. Zoom de 5 % a
  1 600 % (100 % = 10 px por metro), desplazamiento con rueda, arrastre, pellizco
  y teclado, capas, leyenda, color por ciclo de vida, disponibilidad, ocupación,
  higiene, aislamiento, estado v2, unidad o función —siempre con patrón, glifo y
  texto, nunca solo color—, rótulos y camas con nivel de detalle según el zoom, y
  virtualización a partir de 400 nodos. En modo `edit` emite eventos de puntero
  en metros (`worldPointer`) y pinta lo que el editor le pasa (`overlay`).
- **`defs[app-plan-glyph-defs]`** (`PlanGlyphDefs`): las definiciones SVG de los
  glifos y patrones que el lienzo reutiliza con `<use>`.
- **`app-floor-plan-minimap`** (`FloorPlanMinimap`): el plano entero en chico con
  el rectángulo de lo que se ve; un clic o un arrastre centran la vista.

## Tarjeta de detalle (hover, foco y toque)

`app-plan-space-card` se posiciona con `placeFloating` (voltea y desplaza para no
recortarse en los bordes), vive **fuera del SVG**, es singleton y cumple WCAG
1.4.13: se puede alcanzar con el puntero sin que se cierre, se descarta con
`Escape` sin mover el foco y no tapa al espacio que describe. La intención de
hover (`HoverIntent`) abre a los 300 ms (0 ms si hubo una abierta hace menos de
400 ms), cierra a los 200 ms y con foco de teclado abre a los 120 ms. Con toque,
el primer toque abre la tarjeta y el segundo abre la ficha; en 390 px la tarjeta
es una hoja anclada abajo y no modal. `app-tooltip` usa el mismo motor de
posición (modo `legacy`, sin cambiar su comportamiento anterior).

## Editor

Barra: Seleccionar (`V`), Mano (`H`), Local rectangular (`R`), Local poligonal
(`P`), Muro (`W`), Puerta (`D`) y Ventana (`N`). `Ctrl+Z`, `Ctrl+Shift+Z` y
`Ctrl+Y` deshacen y rehacen (hasta 100 pasos); `Ctrl+S` guarda; `Supr` quita; las
flechas empujan un paso de grilla (`Shift` = 5); `Alt` suspende el imán y `Shift`
fuerza el eje.

- El delta de `PATCH /layout` lleva `If-Match: <layoutVersion>` y solo lo que
  cambió; lo nuevo va sin `expectedRowVersion`, y los muros, puertas y ventanas
  nuevos con un id que genera el cliente (reintentar es idempotente).
- La validación local (solape entre hermanas, salida del padre o del lienzo,
  abertura fuera de su muro) es una **ayuda inmediata**; el servidor decide y
  sus errores por elemento (422) reemplazan a los locales.
- 412: aviso «Otra persona modificó este plano», con *Ver cambios* y *Recargar y
  reaplicar mis cambios* (reaplica lo que no chocó).
- El borrador sin guardar queda en `localStorage` (todo en `try/catch`).
- Se edita desde 768 px; en 390 px el plano queda en solo lectura con un aviso.

## Lo que el contrato pide y todavía no está

Plantillas de habitación (`POST /stamp`), calibrar el fondo, escalera/ascensor,
circulación, anotación, medir, alinear y distribuir, duplicar, traer/enviar atrás
y el reemplazo total (`PUT /layout`). Quedaron fuera de esta entrega; el detalle
está en `docs/trabajo/2026-10-29-infraestructura-plano-web/REPORTE.md`.
