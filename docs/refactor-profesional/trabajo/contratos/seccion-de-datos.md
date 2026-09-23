# Contrato — Sección de datos: `fact-section` y `fact-list`

> Corte: `origin/mockup` @ `d40b5631`. Fuentes: `organisms/fact-section/fact-section.ts` (239 líneas),
> `molecules/fact-list/fact-list.ts` (73 líneas).

## Hallazgo previo al contrato

La familia «**sección editable** de datos» que describe el §9 del documento maestro («etiqueta,
contenido en modo consulta, acción de edición y estado visible») **no existe en el repo**. Ni
`fact-section` ni `fact-list` tienen salida (`output`) ni acción de edición: las dos son de **sólo
lectura**. Lo que sí existe es una jerarquía de presentación de datos de sólo consulta:
`fact-list` (la lista) usada por `fact-section` (la sección con buscador/paginación) o directamente
por una pantalla.

## §10 — `fact-list` (molécula, viva: 4 consumidores)

| Área | Contenido |
|---|---|
| Identidad | `molecules/fact-list`, `FactList`, `app-fact-list`, molécula, compartido |
| Entradas | `hechos: readonly Hecho[]` (requerido) · `disposicion: 'filas'\|'columnas' = 'filas'` · `etiqueta: string = ''` |
| Salidas | Ninguna |
| Composición | Sin slots; `imports: [NavIcon]`; renderiza un `<dl>` |
| Estado | `visibles` (computed que descarta `Hecho` con `valor === null`) |
| Apariencia | `disposicion` cambia el layout (filas: campo|valor en columna; columnas: campos lado a lado) |
| Errores | N/A — no muta nada, no hace red |
| Compatibilidad | Sin versiones previas |
| Evidencia | `fact-list.spec.ts` |
| **Consumidores** | `admin/data-catalog/object-detail/catalog-object-detail.html:54,72` · `laboratory-directory/laboratory-detail/laboratory-detail.html:24` · `public-directories/clinic-detail/clinic-detail.html:8` · `public-directories/pharmacy-detail/pharmacy-detail.html:8` — **ninguno en `clinical-record`** |

## §10 — `fact-section` (organismo, con 0 consumidores fuera del banco)

| Área | Contenido |
|---|---|
| Identidad | `organisms/fact-section`, `FactSection`, `app-fact-section`, organismo, compartido |
| Entradas | `icono: NavIconName` (requerido) · `titulo: string` (requerido) · `bloques: readonly BloqueDeFicha[]` (requerido) · `columnas: 1\|2 = 1` · `porPagina: number` · `conBuscador: boolean = false` |
| Salidas | Ninguna |
| Composición | `imports: [Card, Chip, FactList, Pagination, SearchField, SectionHeading]`; envuelve varios `FactList` con buscador y paginación por página (no por cursor — es de sólo lectura sobre datos ya en memoria, no pide al servidor) |
| Estado | `termino`, `etiquetaElegida`, `pagina` (signals internos) |
| Apariencia | `columnas` cambia el layout de bloques |
| Errores | N/A |
| Compatibilidad | Sin versiones previas |
| Evidencia | `fact-section.spec.ts` |
| Queda fuera | Persistencia de cualquier dato y las reglas propias de cada campo — el organismo sólo presenta lo que ya le dieron |

## Las cuatro mediciones (H5)

| Medición | Comando | Resultado |
|---|---|---|
| Usos estáticos por selector | `git grep -c '<app-fact-section' -- 'src/app/**/*.html'` | **0** |
| Usos por importación de la clase (fuera de su carpeta y specs) | `git grep -n 'FactSection' -- 'src/app/**/*.ts'` | **1** — sólo el re-export del barrel `shared/components/organisms/index.ts:34` |
| Usos dinámicos o por ruta | `git grep -n 'loadComponent\|createComponent\|ViewContainerRef' -- 'src/app/**/*.ts'` filtrado por "fact" | **0** |
| Presencia en el catálogo generado | `grep -n '"clase": "FactSection"' src/app/features/component-stock/component-index.generated.ts` | **Sí** — sólo ahí (línea ~22754), el índice del banco de componentes |

**Las mismas cuatro para `FactList`** (contraste, no parte de H5 pero necesarias para no confundir las
dos piezas): 6 usos estáticos, 4 importaciones fuera de su carpeta, 0 dinámicos, presente en el
catálogo. `FactList` está viva; `FactSection` no.

## Veredicto (Q-M2 / Q-D)

**`fact-section` queda PENDIENTE con dueño Pablo, no se borra esta noche.**

Motivo de no adoptarlo ahora: el único candidato razonable dentro del alcance de este carril es el
modal de detalle de lectura del expediente (`patient-chart.html:299-341`), que hoy es un `<dl>` a mano
de 3-5 campos fijos. `fact-section` agrega buscador, chips de filtro y paginación — mecanismo pensado
para **listas largas de bloques**, no para una ficha de 3-5 campos fija. Adoptarlo ahí sería forzar el
organismo equivocado sólo para justificar que se usa (exactamente lo que el §9 de la ficha prohíbe:
«no adoptar a la fuerza para justificar que existe»). `fact-list` (la molécula, sin buscador ni
paginación) sí encajaría en ese `<dl>`, pero es una decisión de diseño visual distinta —cambiar el
detalle de lectura del expediente— que no estaba en el alcance de H3 de este carril y se propone como
candidata de oleada 2.

**Propuesta de retiro condicional**: si en la oleada 2 ningún consumidor real lo adopta,
`fact-section` es candidato a retiro (regla `dead-code-duplication`). Hasta entonces permanece en el
repo sin cambios.

## Qué falta / no cubierto

- No se probó `fact-section` en el navegador (0 consumidores reales, nada que ejercitar en runtime).
- No se decidió si el detalle de lectura del expediente migra a `fact-list` — queda para Pablo/oleada 2.
