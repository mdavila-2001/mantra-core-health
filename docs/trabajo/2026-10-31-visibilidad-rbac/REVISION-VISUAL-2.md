# Revisión visual independiente n.º 2 — 01/11/2026 — FAIL 71/100

Revisor independiente: no implementé nada. Leí las capturas con Read, **sin navegador** (así lo pidieron).
Evidencia: `evidencia/visual-final/<pantalla>/` (commit `57c4c46a`). Los «antes» se tomaron sobre `1d95bdcc`, que existe en la rama.
Por cada una de las 18 pantallas leí `antes-1440-claro`, `despues-1440-claro`, `despues-1440-oscuro` y `despues-390-claro`.
Muestras extra: `mutabilidad/despues-768-claro`, `auditoria/despues-768-claro`, `mutabilidad/despues-390-oscuro` y
`runtime-pieces/despues-390-oscuro`. El resto de 768 y 390 oscuro **no se leyó**.

**Veredicto: FAIL.** Hay 2 hallazgos HIGH y la puntuación queda por debajo de 92. Las capturas no muestran
ningún estado M34 aparte de «elegí algo»: no hay carga, error, vacío filtrado, S7 ni S9, y tampoco
interacción ni teclado. Lo cual no significa que la tarea haya quedado igual que antes: el cambio de marco es real y grande.
Se fue el marco anidado, también la doble miga y la segunda barra oscura. Ahora hay una cabecera con loseta y
eyebrow, y las pestañas de sección siguen el mismo orden en todas las pantallas. El modo oscuro ya no sale en blanco.

## Veredicto por pantalla

| Pantalla | Veredicto | Motivo principal (captura) |
|---|---|---|
| centro | APROBADA | `centro/despues-1440-claro`: marco limpio, cabecera con icono y eyebrow, 4 KPI con icono. La línea suelta «Inventario `maqueta` leído de `maqueta`» con tipografía de código es redundante (LOW). |
| auditoria | CON DEFECTOS | `despues-1440-claro`: los selects «Cualquier per…» y «Cualquier res…» salen truncados aunque la fila tiene sitio de sobra («Más filtros (4)» ocupa ~120 px). Las fechas piden `mm/dd/yyyy` en una interfaz en español. `despues-390-claro`: los filtros llenan toda la primera vista y «Aplicar filtros» queda tapado por la barra inferior. |
| rbac-matrix | CON DEFECTOS | El tema oscuro ya está recapturado y bien. `despues-390-claro`: los 4 KPI van en una sola columna y la matriz no aparece en la primera vista. El buscador «Nombre del recurso» no tiene rótulo visible. |
| roles | CON DEFECTOS | `despues-1440-claro`: las losetas de rol van en 4+1, con «Recepción» huérfana en la segunda fila. Los KPI dentro de la tarjeta desaparecieron (corregido). |
| field-permissions | CON DEFECTOS | `despues-1440-claro`: el select de rol ocupa media fila y «Agregar una regla» (deshabilitado) queda aislado a ~370 px a la derecha. Repite la rejilla 4+1. |
| who-can | CON DEFECTOS | El maquetado está bien (4 selects en una fila). Siguen sin capturas de vacío, error y carga (defecto de RV-1). |
| access-reviews | CON DEFECTOS | «Ver estado →» le da a la fila el aspecto de pulsable (corregido), pero su cuerpo y peso son mayores que los del resto de la fila. Las filas miden ~30 px, el doble de denso que en Auditoría. Siguen sin capturas de vacío, error y carga. |
| mutabilidad | CON DEFECTOS | El tema oscuro ya no sale en blanco y los 5 KPI llevan icono (corregido). `despues-1440-claro`: los rótulos partidos en 2 líneas («CON MODO / DECIDIDO») desalinean las cifras: «13» está a y≈436 y «11 de 13» a y≈457. **`despues-390-claro` y `-390-oscuro`: la cifra se parte en «11 de / 13» (HIGH).** |
| ui-catalog | CON DEFECTOS | `despues-1440-claro`: el filtro no está en una fila. El buscador va solo a todo el ancho y los dos selects bajan a una segunda fila, contra PRIMITIVAS §T5. El «0» de «Reglas vigentes» es un enlace subrayado suelto. A 390 los KPI ya no se cortan como carrusel. |
| ui-rules | CON DEFECTOS | La «Nueva regla» duplicada desapareció (corregido). `despues-1440-claro`: los tres selects de filtro **no tienen rótulo** («Todos los elementos», «A cualquiera»…) ni Aplicar/Quitar, un patrón distinto al de las otras 6 pantallas con filtro. |
| ui-preview | APROBADA | El UUID a mano se cambió por el selector «Persona» (corregido). Vacío guiado con próxima acción. |
| catalog-fit | CON DEFECTOS | El aviso va antes de los KPI y «SIN MEDIR» reemplaza a «PUNTOS CIEGOS» (corregido). Las cifras de los KPI no comparten línea base: el «Veredicto» es una insignia y «hace 2 min» queda más abajo por el rótulo partido. El aviso dice «comprobación(es)» y el KPI usa la jerga «worker». **El grupo tiene 3 hermanas (Tablas, Dominios, Sonda) y no hay SectionTabs.** |
| runtime-pieces | CON DEFECTOS | «Actualizar» ya es un botón con borde (corregido). La cabecera tiene 3 botones y una descripción de 4 líneas. Las fechas van en «01/11/2026 20:37», un formato distinto al del resto del portal («1 nov de 2026, 8:34 p. m.»). Las mismas fichas de estado se repiten en el aviso y en la fila de filtros. **A 390 la cifra se parte en «10 de / 18» (HIGH).** El grupo Sistemas tiene 5 hermanas y no hay SectionTabs. |
| dq-issues | CON DEFECTOS | Tiene KPI, «Esperando decisión» sale en una línea y «Abierta» es azul, distinta del ámbar del aviso (corregido). El menú lateral muestra un único ítem, «Calidad de datos», mientras las pestañas dicen Incidencias/Reglas. |
| dq-rules | CON DEFECTOS | Tiene tarjeta con pestañas (Todas/Fatal/Error/Aviso/Informativa) y se nota el cambio (corregido). Mismo menú lateral de un ítem. La ficha de detalle sigue sin captura. |
| privacy | CON DEFECTOS | El select y los botones van en una fila y hay KPI «Vencidas» (corregido). Sigue sin captura del vacío. La ficha de detalle sigue sin captura. |
| policies | CON DEFECTOS | «12:00 a. m.» ya no se parte y «Versión 1» va a la izquierda (corregido). «Sin estado» lleva una insignia con el mismo peso que «Activa». `despues-390-claro`: la tira de pestañas de la tarjeta muestra la flecha «‹» con «Todas» ya en el borde izquierdo. La ficha de detalle sigue sin captura. |
| pii | CON DEFECTOS | El aviso va antes de los KPI, los KPI llevan icono y ya no hay tarjetas dentro de la tarjeta (corregido). La 4.ª cifra, «3», queda ~20 px más baja que las otras tres porque el rótulo se parte en 2 líneas. |

Recuento: 2 APROBADAS, 16 CON DEFECTOS, 0 RECHAZADAS.

## Seguimiento de REVISION-VISUAL-1

| # | Defecto RV-1 | Estado | Evidencia |
|---|---|---|---|
| T1 | Cabecera sin loseta de 40 px ni eyebrow | CORREGIDO | Las 18 `despues-1440-*` muestran loseta, eyebrow con el grupo y título en color de acento |
| T2 | El lateral se corta a 900 px en página completa | NO VERIFICABLE | Las capturas son de vista, no de página entera (INDICE). En vista el lateral llega al pie |
| T3 | A 390 la pestaña activa no se ve | CORREGIDO | `field-permissions`, `who-can`, `access-reviews`, `privacy`, `pii`, `policies` `/despues-390-claro`: la pestaña activa se ve completa o centrada |
| T4 | Orden aviso/KPI y KPI sin icono | CORREGIDO | En todas va aviso → KPI con icono → tarjeta. Queda una inconsistencia nueva: dos estilos de aviso (ver N5) |
| T5 | Aplicar/Quitar bajan de línea | CORREGIDO en las 5 pantallas citadas · PERSISTE en ui-catalog | En auditoria, dq-issues, dq-rules, privacy y policies van en una fila. `ui-catalog/despues-1440-claro` mantiene dos filas |
| T6 | Tabla apilada a 390 desalineada | CORREGIDO (en lo visible) | `access-reviews/despues-390-claro` y `policies/despues-390-claro`: rótulo arriba, valor debajo, a la izquierda |
| T7 | Píldoras de demo y la insignia «3» que pisaba la campana | CORREGIDO | Ya no hay píldoras. La insignia queda arriba a la derecha y apenas roza el contorno (LOW) |
| T8 | «Antes» rehechos desde 1d95bdcc | CORREGIDO | Las 36 `antes-*` muestran el marco anidado viejo. `1d95bdcc` existe en la rama |
| T9 | El vacío por filtro decía «Todavía no hay nada acá» | NO VERIFICABLE | No hay ninguna captura de un vacío con filtros |
| marco | Migas repetidas y faltaba el Centro | CORREGIDO | Las migas viven solo en la barra superior. `centro/` capturado |
| rbac-matrix | Oscuro sin recapturar y KPI apretados a 390 | CORREGIDO / PERSISTE (otra forma) | El oscuro está bien. A 390 los KPI ya no se aprietan, pero en una columna entierran la matriz |
| roles | KPI dentro de la tarjeta, builds distintos, rol cortado, Guardar con error | CORREGIDO / CORREGIDO / CORREGIDO / NO VERIFICABLE | Losetas con el nombre completo. No hay captura de error |
| field-permissions | Fila apilada «national_id» desalineada | NO VERIFICABLE | Las capturas no muestran filas (hay que elegir rol) |
| who-can / access-reviews | Sin vacío/error/carga · filas no pulsables | PERSISTE · CORREGIDO | Ninguna captura de estado. «Ver estado →» en cada fila |
| mutabilidad | Oscuro en blanco, solo 1 KPI con icono, tarjetas dentro de tarjeta | CORREGIDO ×3 | `despues-1440-oscuro` y `despues-768-claro` |
| catalogo-visibilidad | El carrusel de KPI cortaba una tarjeta | CORREGIDO | Rejilla de 2 columnas a 390 |
| reglas-visibilidad | «Nueva regla» duplicada · «Filtros» suelto a 390 · KPI no se refrescan | CORREGIDO · NO VERIFICABLE · NO VERIFICABLE | Hace falta interacción |
| ver-como | UUID a mano · PHARMACY_STAFF sin nombre | CORREGIDO · CORREGIDO (indirecto) | «Personal de farmacia» aparece en `roles/despues-1440-claro` |
| catalog-fit | Orden del aviso · «PUNTOS CIEGOS» · «100 % · Falla grave» · Hallazgos de 3890 px | CORREGIDO · CORREGIDO · CORREGIDO (columnas separadas y explicadas) · NO VERIFICABLE | |
| runtime-pieces | Sin paginación · «Actualizar» suelto | NO VERIFICABLE · CORREGIDO | |
| dq-issues | Texto partido · mismo ámbar · sin KPI | CORREGIDO ×3 | |
| dq-rules | Sin pestañas · cambio mínimo | CORREGIDO ×2 | |
| privacy | Select a todo el ancho · sin KPI de vencidas · sin captura de vacío | CORREGIDO · CORREGIDO · PERSISTE | |
| policies | «12:00 a. / m.» partido · «Versión 1» centrado | CORREGIDO ×2 | |
| pii | KPI antes del aviso y sin icono · tarjetas dentro de tarjeta | CORREGIDO ×2 | |
| fichas | Detalle de dq-rules, privacy y policies sin recapturar | PERSISTE | No hay ninguna captura de ficha en `visual-final/` |

## Defectos nuevos (o que RV-1 no había anotado)

- **N1 · HIGH.** La cifra del KPI se parte a 390 y se lee como dos valores: «11 de / 13» en `mutabilidad/despues-390-claro` y `-390-oscuro`, «10 de / 18» en `runtime-pieces/despues-390-claro` y `-390-oscuro`. Es un problema de la primitiva `app-metric-card` (falta `white-space: nowrap` o `sinCortes` en el valor), así que afecta a toda pantalla con valores «X de Y».
- **N2 · HIGH.** La convención de navegación se contradice. Gobierno y acceso usa ítems de grupo más SectionTabs. Sistemas (5 hermanas) y Catálogo (3 hermanas) listan cada pantalla en el lateral y **no tienen SectionTabs**, contra ESTRUCTURA-ATLAS §Página 1. Calidad de datos clínicos va al revés: un solo ítem «Calidad de datos» con SectionTabs Incidencias/Reglas. Evidencia: `runtime-pieces/despues-1440-claro`, `catalog-fit/despues-1440-claro` y `dq-issues/despues-1440-claro`.
- **N3 · MEDIUM.** Selects truncados en la fila de filtros de Auditoría a 1440 y a 768 («Cualquier per…»). Es el viewport de escritorio principal.
- **N4 · MEDIUM.** Tres formatos de fecha: «1 nov de 2026, 5:31 p. m.» en Auditoría, «01/11/2026 20:37» en Piezas y `mm/dd/yyyy` en los campos de fecha de Auditoría (formato de EE. UU.).
- **N5 · MEDIUM.** Dos estilos de aviso. rbac-matrix, roles, field-permissions, who-can y access-reviews usan texto de 12–13 px sin lead. mutabilidad, ui-*, catalog-fit, runtime-pieces, dq-*, privacy, policies y pii usan 15 px con lead en negrita y ▸.
- **N6 · MEDIUM.** Dos estilos de tabla. Unas tienen cabecera en versalitas sobre el fondo de la tarjeta (auditoria, access-reviews, dq-*, privacy, policies). Otras tienen cabecera en caja normal sobre una banda tostada (mutabilidad, catalog-fit, pii).
- **N7 · MEDIUM.** Los KPI de 1440 con rótulo de 2 líneas desalinean las cifras entre tarjetas. Pasa en mutabilidad, catalog-fit, runtime-pieces y pii. A 390, la rejilla 1+2 deja columnas de ~90 px con descripciones de 4–5 líneas.
- **N8 · MEDIUM.** Controles sin rótulo visible: los 3 selects de `ui-rules` y el buscador de `rbac-matrix`. Además, ui-catalog y ui-rules no siguen el patrón T5 (filtro sin Aplicar/Quitar y en dos filas).
- **N9 · MEDIUM.** A 390 el contenido principal queda bajo la primera vista y la barra inferior tapa la acción primaria o las pestañas de la tarjeta: auditoria («Aplicar filtros»), dq-issues (pestañas), rbac-matrix y catalog-fit (KPI en columna).
- **N10 · LOW.** Losetas de rol en 4+1 (roles y field-permissions) · «Agregar una regla» aislado · «Ver estado →» más grande que la fila · insignia «Sin estado» con peso de estado real · flecha «‹» activa al inicio de la tira (policies 390) · «comprobación(es)», «worker», «hace 0 s» · línea «Inventario maqueta leído de maqueta» en el Centro.

## Puntuación (/10 por dimensión)

| Dimensión | Nota | Motivo |
|---|---|---|
| Tipografía | 8 | La jerarquía de cabecera es buena. Hay dos tamaños de aviso, rótulos de KPI partidos y una cifra partida |
| Espaciado | 8 | Relleno y ritmo coherentes. Huecos en field-permissions y en las rejillas 4+1 |
| Jerarquía | 8.5 | Cabecera → aviso → KPI → tarjeta aplicado en todas las pantallas |
| Consistencia | 6 | Dos modelos de navegación, dos estilos de aviso, dos de tabla, tres formatos de fecha y dos patrones de filtro |
| Responsive | 7 | Sin desborde. Cifras partidas y contenido enterrado a 390 |
| Accesibilidad | 6.5 | Controles sin rótulo, selects truncados y fecha en formato extranjero. Sin evidencia de foco ni de teclado |
| Interacción | 6 | Ninguna evidencia de interacción (no se pidió navegador). Afordancias mejoradas («Ver estado →») |
| Estados | 5 | Solo «elegí algo» y vacíos guiados. Sin carga, error, vacío filtrado, S7 ni S9 |
| Densidad | 7.5 | Bien en general. KPI de 390 demasiado altos y filas de access-reviews demasiado densas |
| Acabado | 8 | El salto respecto del «antes» es grande. Quedan detalles visibles (N3, N7, N10) |
| **Total** | **70.5 → 71/100** | |

```text
PASS = >= 92 Y cero BLOCKER/CRITICAL/HIGH  →  FAIL (71, 2 HIGH)
```

Para pasar: N1 y N2. Después N3–N9. Además, capturas de los estados M34 (vacío filtrado, error con ID de petición,
carga, dato viejo) y de las fichas de detalle de dq-rules, privacy y policies.
