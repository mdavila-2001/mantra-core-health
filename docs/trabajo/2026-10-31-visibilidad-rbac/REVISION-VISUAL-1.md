# Revisión visual independiente n.º 1 — 01/11/2026 — FAIL 58/100

Revisor independiente (no implementó). Evidencia: evidencia/visual-2026-10-31/.

## Transversales (dueño: agente de PRIMITIVAS)
T1. Cabecera sin icono en loseta 40 px ni eyebrow (ESTRUCTURA-ATLAS §Página 3).
T2. Lateral termina a 900 px en capturas de página completa; debajo franja de otro color.
T3. A 390 la tira de pestañas de sección no desplaza la pestaña activa a la vista (≥6 pantallas).
T4. Orden aviso/KPI y KPIs con/sin icono varían por pantalla. Convención: cabecera → aviso → KPIs (todos con icono) → tarjeta con pestañas.
T5. Filtros no van en una fila: Aplicar/Quitar bajan de línea (auditoría, dq-issues, dq-rules, privacy, policies).
T6. Tablas apiladas a 390 (tabla compartida): rótulo y valor mal alineados, valores partidos a la derecha.
T7. Píldoras «Datos de prueba / Ver componentes» (solo modo demo) y la insignia «3» de la campana pisa el icono.
T8. «Antes» tomados tras el cambio de marco: rehacer los «antes» desde el commit 1d95bdcc.
T9. Estado vacío compartido dice «Todavía no hay nada acá» aun cuando el vacío es por filtro.

## Por pantalla
- marco: migas repetidas aún en despues2 (barrido posterior ya sin ellas); falta captura del Centro /superadmin/portal.
- rbac-matrix: RECHAZADA — oscuro sin recaptura tras arreglo de lateral; KPIs apretados a 390 («PERMISOS / FINOS»).
- roles: KPIs dentro de la tarjeta; capturas de builds distintos; rol cortado «…· G…» a 390; Guardar/Descartar visibles con error.
- field-permissions: fila apilada «Campo national_id patient_profile» desalineada.
- who-can / access-reviews: sin vacío/error/carga; filas de access-reviews no parecen pulsables.
- mutabilidad: RECHAZADA (BLOCKER) — oscuro 1440 y 768 EN BLANCO; solo el primer KPI con icono; tarjetas dentro de tarjeta.
- catalogo-visibilidad: carrusel de KPI a 390 corta una tarjeta.
- reglas-visibilidad: «Nueva regla» duplicada (botón de cabecera + pestaña); botón «Filtros» suelto a 390; KPIs no se refrescan tras editar/terminar.
- ver-como: pide UUID a mano (usar el selector de persona de Quién puede qué); PHARMACY_STAFF sin nombre en el mock.
- catalog-fit: aviso después de los KPIs; captura con rótulo viejo «PUNTOS CIEGOS»; «100 % · Falla grave» contradictorio a la vista; Hallazgos 3890 px a 390.
- runtime-pieces: 18 filas sin paginación (3058 px); «Actualizar» texto suelto junto a botones con borde.
- dq-issues: «Esperando decisión» partido; «Aviso» y «Abierta» mismo ámbar; sin KPIs.
- dq-rules: tarjeta sin pestañas; cambio mínimo respecto del antes.
- privacy: un solo select a todo el ancho y botón en otra línea; sin KPI de vencidas; sin captura de vacío.
- policies: «12:00 a. / m.» partido; «Versión 1» centrado.
- pii: KPIs antes del aviso y sin icono; tarjetas dentro de tarjeta.
- Fichas de detalle de dq-rules, privacy, policies sin recapturar.
