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
