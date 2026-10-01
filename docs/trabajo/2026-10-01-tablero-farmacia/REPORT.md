# Tablero de «Solicitudes de retiro» de la farmacia — 2026-10-01

Rama `justin/pharmacy-board`, base `mockup`. Solo front: la maqueta en memoria
sirve todo; no se tocó el modelo ni la API.

## Qué cambió

- **Seis columnas** (Nuevos · En revisión · Esperando al paciente · Listos para
  retiro · En preparación · Cerrados). Se quitó el acordeón que plegaba las dos
  últimas.
- **Cada columna** tiene alto máximo (`clamp(20rem, 100dvh − 22rem, 45rem)`) y se
  desplaza por dentro. El tablero se desplaza de costado cuando las seis no
  entran (en el teléfono una columna ocupa el 85 % y deja asomar la siguiente).
- **Sede**: la bandeja abre en la casa matriz y el selector lleva «Todas las
  sedes». Con una sola sede el selector no sale. La elección queda en la URL
  (`?site=`).
- **Fecha**: recorta **solo «Cerrados»** (Hoy · Ayer · Últimos 7 días · Últimos
  30 días · Todos; por defecto Hoy, en hora de La Paz). Lo pendiente nunca se
  recorta: un pedido de días atrás que sigue esperando sigue en su cola. Queda
  en la URL (`?closed=`).
- Un aviso dice cuando volvieron tantos pedidos como el tope pedido (500) y puede
  haber más.
- Cambiar de sede cancela la petición anterior, reinicia la línea de base de la
  alarma (lo que hay en otra sede no suena como nuevo) y el sondeo de 20 s
  repite los mismos filtros.

## Límites declarados (no son deuda escondida)

- **La casa matriz no existe en el modelo.** Ninguna tabla la marca; hoy es solo
  la dirección legal de la organización. El front lee `isHeadOffice` **si la API
  lo publica** (campo opcional, `TODO(model)`); mientras no, abre con la única
  sede o con la de código más bajo y lo dice en pantalla. La maqueta sí lo
  declara (Sucursal Central). Cerrarlo de verdad es un cambio de modelo (`.puml`
  → `SQL/` → ORM → API), fuera de este PR.
- **«Cerrados» se mide por fecha de creación**, la única que trae el contrato del
  pedido. Un pedido creado ayer y retirado hoy cuenta como de ayer
  (`TODO(FAR-E2)`: medir por fecha de cierre cuando la API la publique).
- El recorte de fechas es del lado del cliente: la API real no distingue
  pendientes de cerrados y su tope por defecto cortaba en 100 pedidos. Se pide
  con `limit=500` y se avisa si se llega al tope.
- A 1440 px caben unas cuatro columnas y media: las seis exigen scroll de costado
  (decisión del propietario).

## Evidencia

| Capa | Comando | Resultado |
|---|---|---|
| Tipos | `yarn typecheck` · `tsc -p tsconfig.spec.json` | limpio |
| Unitarias | `yarn test --include='…/pharmacy-inbox/**'` | 8 archivos · 125 pruebas verdes |
| Mock y vecinos | `--include` de `core/mock`, `data-access/pharmacy*`, `organization/pharmacy-*`, `features/pharmacy` | 1 237 verdes · 1 roja ajena (abajo) |
| Navegador | `playwright/tablero-de-pedidos-de-farmacia.spec.ts --workers=1` (Chrome del sistema, contra `ng serve` con la maqueta) | 6/6 |
| Build | `yarn build` | compila; solo avisos de presupuesto ya existentes (ninguno en esta pantalla) |
| Visual | `evidencia/*.png` — 375 · 1280×680 · 1440 · 2560 · 1440 oscuro | revisadas a ojo |

Lo que **no** se ejecutó: contra la API real o el stack Docker (no hace falta en
`mockup` y el stack requiere permiso), Firefox/WebKit, y la suite completa
de `yarn test`.

## Hallazgos fuera de alcance

- `core/mock/handlers/patient-spending.handlers.spec.ts` («del más reciente al más
  antiguo») falla según la hora del día: un movimiento de la noche aparece como
  «futuro». Ningún import lo une a este cambio; no se tocó.
- El spec de la bandeja **ya fallaba 15/15 en `mockup`** antes de este cambio: su
  doble de `SessionStore` no tenía `userId`, que el carrito (`CartStore`) lee.
  Se corrigió el doble, no las aserciones.
- `yarn lint` global da 275 errores preexistentes (`prefer-on-push` en specs de
  otras carpetas); los archivos de este cambio salen limpios.

## Un defecto que la prueba de navegador atrapó

Un `span.sr-only` (posición absoluta) del encabezado de la sexta columna
escapaba del `overflow` del tablero y estiraba el ancho de la **página** a
1565 px a 1280 (desplazamiento horizontal fantasma). Se arregló con
`position: relative` en `.bandeja__colas`, que pasa a ser su bloque contenedor.
