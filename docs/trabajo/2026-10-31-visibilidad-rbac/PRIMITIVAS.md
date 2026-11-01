# Primitivas compartidas para las pantallas del portal (revisión visual 1, transversales)

Para los agentes de pantallas. Dueño de estos archivos: agente de PRIMITIVAS. No los edites; si falta algo, pedilo.

## Orden fijo de una pantalla (T4)

`cabecera` → `aviso` (app-alert compacto, 1–2 líneas) → `KPIs` (todos `app-metric-card` **con `icon`**) →
**UNA** `app-card` con `app-tabs`. Dentro de la tarjeta: filtros → tabla → paginación. **Nada de tarjetas
dentro de la tarjeta**: los bloques internos van con `app-section-heading` o un filete, no con otra `app-card`.

## T1 · Cabecera (`app-page-header`)

- Dentro del portal **no hay que hacer nada**: `PortalShell` provee (`PAGE_HEADER_PREDETERMINADOS`) el icono de
  la pantalla y el eyebrow (nombre del grupo de la barra lateral), sacados de `portal-nav.ts` (`icon` por ítem;
  sin él, el del grupo). Las fichas heredan la cabecera de la pantalla de la que cuelgan.
- Si una pantalla necesita otro: `<app-page-header icon="key" eyebrow="Usuarios y accesos" …>`. Lo de la
  pantalla manda sobre el marco. Fuera del portal, sin `icon`/`eyebrow`, la cabecera no cambia.
- Una sola cabecera; no repetir migas (viven en la barra superior).

## T3 · Pestañas

- Tira de sección del marco y `app-tabs`: la activa se centra sola al montar y al cambiar de ruta/pestaña, y los
  bordes se desvanecen cuando queda tira de ese lado. No hace falta código en la pantalla.

## T5 · Filtros (`app-governance-filter-form`)

- ≥ 1024 px: buscador flexible + selects + «Quitar filtros» / «Aplicar filtros» en **la misma fila**. Se apilan
  sólo por debajo. El campo `kind: 'text'` es el buscador (va primero y crece el doble).
- No envuelvas el formulario en un contenedor con ancho propio ni pongas botones aparte: las acciones ya están.

## T6 · Tabla apilada (`app-data-table stackedOnMobile`)

- < 640 px: cada celda es **rótulo arriba (versalitas) y valor debajo, a la izquierda**. Si una celda proyecta
  varias cosas, que sea UN bloque (un `<span>`/`<div>`), no hermanos sueltos.
- Fechas/horas/códigos: `ColumnDef.nowrap: true` (no se parten), y para texto armado a mano
  `sinCortes(texto)` de `shared/components/organisms/data-table/sin-cortes.ts` («12:00 a. m.» con espacios
  duros; `sinCortes(t, true)` une todo). Ej.: `sinCortes(dateTime(fecha))`.

## T7 · Campana

- La insignia ya no pisa el icono (sólo CSS de la campana). Las píldoras de demo no se tocan.

## T9 · Vacío filtrado (ADR-0005, S3)

- «Sin datos» ≠ «sin resultados con estos filtros». Cuando la pantalla tiene algún filtro puesto y el estado es
  `empty`, pasá `[filtered]="hayFiltros()"` y `(clearFilters)="quitarFiltros()"` a `app-data-table` o a
  `app-view-state-host`. El host dice «Ningún resultado con estos filtros» (lupa) y ofrece «Quitar filtros»;
  sin filtros sigue «Todavía no hay nada acá» con su próxima acción. `quitarFiltros()` limpia la URL, igual que
  el «Quitar filtros» del formulario.

## T2 · Lateral

- Fondo continuo hasta el pie también en capturas de página entera: es del marco, nada que hacer en pantallas.

## Revisión visual 2 (N1–N9, parte de primitivas)

- **KPIs (`app-metric-card`)**: la cifra no se parte nunca («11 de 13», «hace 2 min»), baja un escalón en el
  teléfono, el rótulo reserva dos renglones (las cifras de una fila quedan alineadas) y en una tarjeta angosta la
  loseta sube y el cuerpo toma todo el ancho. No le pongas `white-space` ni alturas desde la pantalla.
- **Navegación (N2)**: un solo criterio en `portal-nav.ts`: cada línea del lateral es una sección y sus hermanas
  son pestañas. Sistemas → «Inventario técnico» (6 pestañas), Catálogo → «Catálogo de datos» (3), Calidad →
  «Incidencias y reglas» (Incidencias / Reglas). Rutas y guardas sin cambios.
- **Fechas (N4)**: UN formateador: `fechaHora(valor)` / `fecha(valor)` de
  `shared/components/organisms/data-table/sin-cortes.ts` → «1 nov de 2026, 6:34 p. m.» con la hora sin cortes.
  Reemplazá `| date: 'dd/MM/yyyy HH:mm'` y los `toLocaleString` propios. Los campos de fecha del formulario de
  filtros usan `app-date-picker` (DD/MM/AAAA); el valor de la URL sigue siendo AAAA-MM-DD.
- **Filtros (N3)**: cada select pide el ancho de su opción «Cualquier …» entera; si no entran, bajan los campos,
  nunca las acciones.
- **Aviso (N5)**: UN estilo: `<app-alert tone="info" title="Lead en una frase." collapsible>detalle</app-alert>`
  (lead en negrita + ▸, el detalle se despliega). Sin `collapsible` cuando el aviso es corto y va entero. No armes
  `<details>` propios ni cambies el tamaño de letra.
- **Tabla (N6)**: UNA cabecera: la de `app-data-table` (versalitas sobre el fondo de la tarjeta). No pintes bandas
  de fondo en `thead` ni tablas a mano.
- **390 (N9)**: la barra inferior tiene alto fijo y el lienzo reserva ese alto + safe area; al tabular, el navegador
  deja libre la franja de la barra. Una captura de VISTA sigue mostrando la barra encima del borde inferior: es fija.
