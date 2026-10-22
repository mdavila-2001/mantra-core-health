# P2 independiente — capturas de diagnóstico

- Trabajo: Hito 1, 2026-10-02.
- Revisor: `/root/review_profile_ux`, sin participación en la implementación.
- P1 de diagnóstico cerrada antes de esta revisión: [doble-revision.md](./doble-revision.md).
- Método: las siete imágenes fueron abiertas individualmente con `view_image`. Los tamaños indicados son los del PNG, no necesariamente los del viewport; las capturas largas incluyen toda la página.
- Alcance: material de fallos de builds intermedios. Estas notas no aprueban la matriz final ni verifican el código posterior a las capturas. No se ejecutó navegador, runner ni petición de red.

## Resultado por archivo

| Archivo en diagnostico/ | Tamaño PNG | Severidad principal | Nota P2 | Observación |
|---|---|---|---|---|
| compilacion-overlay.png | 1280×720 | BLOQUEANTE | RECHAZADA | El overlay TS2552 tapa el login e impide observar el perfil. |
| pending-summary.png | 1440×900 | BLOQUEANTE | RECHAZADA | «Verificadas (12)» contradice el sello pendiente de la formación visible. |
| listados-390x844-claro-credenciales.png | 390×1592 | MAYOR | RECHAZADA | Encabezado «CREDENCIAL» y «universitario» se parten dentro de palabras; persiste además el conteo contradictorio. |
| listados-390x844-claro-trayectoria.png | 390×2451 | MAYOR | RECHAZADA | Un aviso flotante tapa nombres, cargos y filas de Actividad actual. |
| datos-propios-390x844-claro.png | 390×1867 | MAYOR | RECHAZADA | Aviso de Trayectoria sobre los datos personales; idioma/nivel aparecen en inglés y hay error de seguros. |
| editor-selector.png | 390×844 | MAYOR | RECHAZADA | El aviso ajeno a esta pestaña tapa la zona de subida del editor. P2 baja la nota respecto de P1. |
| missing-api.png | 1280×720 | MENOR, límite de evidencia | ACEPTABLE CON RESERVAS | El fragmento visible no presenta defecto geométrico evidente; no muestra cancelación y no acredita las peticiones auxiliares. |

## Preguntas adversariales por captura

### compilacion-overlay.png — RECHAZADA

1. **Primer defecto:** error de compilación a toda la anchura útil, por encima del acceso.
2. **Recortes/superposición:** el panel oscuro cubre la cabecera y parte del formulario; es una obstrucción efectiva.
3. **Terminación:** no puede considerarse una pantalla de producto terminada con este overlay.
4. **Coherencia:** el overlay pertenece a herramientas de desarrollo, no a los estados del sistema de diseño.
5. **Tema oscuro:** no aplica como prueba de ese tema; el oscurecimiento proviene del overlay y no permite evaluar el perfil.
6. **Estados:** explica un error técnico al desarrollador, pero no ofrece recuperación comprensible para el usuario final.
7. **Jerarquía:** el error desplaza visualmente a «Entrar»; la tarea del usuario queda interrumpida.
8. **Datos:** correo de prueba visible y contraseña enmascarada; no se observa contenido clínico. El correo corresponde al escenario sintético declarado.
9. **Requisito:** no muestra ficha, cancelación ni credenciales; documenta el fallo previo.
10. **Motivo de rechazo:** compilación rota y superficie de producto oculta. Exige recaptura tras corregir.

### pending-summary.png — RECHAZADA

1. **Primer defecto:** el contador afirma doce verificadas y la fila visible dice «Credencial pendiente de verificación».
2. **Recortes/superposición:** no hay superposición visible; el PNG termina al comenzar las filas y no permite revisar la tabla completa.
3. **Terminación:** la geometría es consistente, pero la contradicción semántica impide aceptar la pantalla.
4. **Coherencia:** tarjeta, pestañas, filtros y sellos emplean el lenguaje visual existente; eso no corrige el conteo.
5. **Tema oscuro:** no cubierto; sólo hay tema claro en esta imagen.
6. **Estados:** el sello pendiente resulta legible, pero contradice la clasificación y el encabezado «Verificada contra».
7. **Jerarquía:** sección y búsqueda son localizables; el resumen dominante transmite una decisión incorrecta.
8. **Datos:** «Prueba Listados», institución sintética y número H1; no se observa información clínica real.
9. **Requisito:** muestra grupos de credenciales, pero falla la separación entre declaración y aprobación real.
10. **Motivo de rechazo:** atribuye aprobación a registros pendientes. Requiere corrección de datos derivados y una captura nueva.

### listados-390x844-claro-credenciales.png — RECHAZADA

1. **Primer defecto:** la columna estrecha divide «CREDENCIAL» y «universitario» en fragmentos difíciles de leer.
2. **Recortes/superposición:** no se observa salida horizontal del contenedor. Sí hay fragmentación de palabras y filas parcialmente visibles en el límite vertical de la tabla.
3. **Terminación:** el reparto título/estado parece sin resolver para este ancho; el sello consume la mayor parte de la fila.
4. **Coherencia:** controles canónicos reconocibles, pero la jerarquía del dato principal se degrada al estrecharse.
5. **Tema oscuro:** no cubierto; imagen clara.
6. **Estados:** pendientes visibles con contador «Verificadas (12)»; la contradicción semántica se suma al defecto de lectura.
7. **Jerarquía:** búsqueda y paginación se reconocen; el título de cada registro pierde protagonismo y legibilidad.
8. **Datos:** nombres y códigos H1 sintéticos; sin documentos adjuntos abiertos ni datos clínicos visibles.
9. **Requisito:** hay paginación y formato denso, pero no una tabla legible en móvil.
10. **Motivo de rechazo:** lectura fragmentada y clasificación falsa. Ambas causas necesitan recaptura después de corregirse.

### listados-390x844-claro-trayectoria.png — RECHAZADA

1. **Primer defecto:** aviso turquesa de Trayectoria sobre la primera tabla.
2. **Recortes/superposición:** cubre institución/cargo y parte de otras filas; no se aprecia desborde horizontal del documento.
3. **Terminación:** no es una captura estable de lectura mientras un aviso tapa los datos que se están evaluando.
4. **Coherencia:** títulos y tablas usan componentes conocidos. La lista accionable inferior repite instituciones y, en este recorte, carece de un encabezado que explique su propósito: reserva menor adicional.
5. **Tema oscuro:** no cubierto; imagen clara.
6. **Estados:** «Declarado» se distingue de los grupos temporalmente actuales/históricos; no se afirma aprobación por estar en curso.
7. **Jerarquía:** ambos grupos se reconocen y hay paginación independiente; la ayuda flotante domina sobre el contenido.
8. **Datos:** «Institución Sintética», «Hospital Histórico Sintético» y cargo de prueba; no se observan datos clínicos reales.
9. **Requisito:** muestra agrupación y recorrido denso, pero la obstrucción impide certificar la lectura completa.
10. **Motivo de rechazo:** filas ocultas por un overlay. Cerrar el aviso y recapturar; no usar este PNG como evidencia final.

### datos-propios-390x844-claro.png — RECHAZADA

1. **Primer defecto:** ayuda de Trayectoria tapa información personal en una pestaña distinta.
2. **Recortes/superposición:** obstruye la zona entre fecha de nacimiento y especialidades. El resto del texto visible cabe dentro de la tarjeta.
3. **Terminación:** la mezcla «Spanish clinical language · Native language proficiency» dentro de una interfaz española queda sin resolver.
4. **Coherencia:** etiquetas, tarjeta e imágenes vacías son consistentes con el producto; el aviso pertenece a otra sección.
5. **Tema oscuro:** no cubierto; imagen clara.
6. **Estados:** seguros muestra error y pide recargar; los vacíos de logo/firma/sello y especialidades tienen texto. La imagen no permite establecer la causa del error de seguros.
7. **Jerarquía:** el aviso compite con los datos y los oculta. Las acciones inferiores son legibles.
8. **Datos:** nombre de prueba, identificadores H1 y código profesional del escenario sintético; sin contenido clínico real visible.
9. **Requisito:** Idiomas está en Datos personales y conserva nivel/interpretación, pero la captura no acredita una lectura limpia de la pestaña.
10. **Motivo de rechazo:** superposición y rotulación mezclada. Registrar también el error de seguros; no convertir esta captura en prueba de red correcta.

### editor-selector.png — RECHAZADA

1. **Primer defecto:** el aviso «Trayectoria» continúa visible dentro del editor de Datos personales.
2. **Recortes/superposición:** tapa instrucciones y parte inferior de la zona de subida. No se aprecia un defecto horizontal en el fragmento visible.
3. **Terminación:** el editor no puede evaluarse como estable con una notificación ajena bloqueando su contenido.
4. **Coherencia:** tarjeta y selector siguen el diseño existente; el contexto del aviso es incorrecto para esta pestaña.
5. **Tema oscuro:** no cubierto; imagen clara.
6. **Estados:** «Sin logo» es claro. No se muestra validación, subida en curso ni confirmación de descarte.
7. **Jerarquía:** el aviso domina el borde inferior y oculta la acción de carga.
8. **Datos:** avatar de prueba; no se ve contenido personal o clínico real.
9. **Requisito:** la captura muestra el inicio del editor, no el flujo de cancelación. Un selector duplicado del test no puede diagnosticarse sólo mirando este PNG.
10. **Motivo de rechazo:** contenido y acción tapados. La nota P2 es más baja que P1 por esa obstrucción observada, no por inferir el fallo del test.

### missing-api.png — ACEPTABLE CON RESERVAS

1. **Primer defecto:** no se observa un defecto geométrico evidente en la porción capturada; su limitación principal es mostrar sólo el inicio del editor.
2. **Recortes/superposición:** no hay superposiciones. Los campos de nombre empiezan justo en el borde inferior del PNG: el resto del formulario no es evaluable.
3. **Terminación:** cabecera, pestañas y subida tienen acabado consistente en esta porción.
4. **Coherencia:** navegación y controles corresponden al patrón existente de una tarjeta con pestañas.
5. **Tema oscuro:** no cubierto; imagen clara.
6. **Estados:** «Sin logo» y formatos/tamaño de archivo orientan. Los 404 auxiliares consignados en P1 no son visibles en la imagen y no fueron comprobados por este revisor.
7. **Jerarquía:** la subida de logo tiene una acción identificable. Guardar y Cancelar están fuera del recorte, por lo que no se evalúan.
8. **Datos:** sólo iniciales y controles; no se observa contenido clínico o personal real.
9. **Requisito:** sirve para inspeccionar el inicio del editor, no demuestra cancelación, persistencia, respaldo ni red correcta.
10. **Motivo de reserva:** evidencia incompleta y límite de integración documentado en P1. No es aprobación de la pantalla completa ni de su funcionamiento.

## No cubierto y cierre de esta pasada

- No se revisó ninguna captura de la matriz final; no estaba disponible en este encargo.
- No se verificó funcionamiento, foco, descarga, accesibilidad dinámica, consola ni red mediante ejecución. Una imagen no prueba esos puntos.
- Estas siete capturas son claras; no certifican tema oscuro.
- Los defectos pueden haber sido corregidos después: esta pasada califica únicamente los PNG abiertos, no hereda resultados de tests ni de cambios posteriores.
- Resultado: seis capturas RECHAZADAS y una ACEPTABLE CON RESERVAS. Ninguna queda APROBADA como evidencia de entrega.
