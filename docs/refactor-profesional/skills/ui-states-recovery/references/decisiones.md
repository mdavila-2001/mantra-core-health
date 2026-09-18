# Decisiones de estado y recuperación

## Lectura

Inicial/cargando; datos; vacío inicial; sin resultados filtrados; error; actualización con datos previos; acceso restringido. Cada estado tiene mensaje, acción, foco y semántica de anuncio pertinentes.

## Escritura

Edición → validación → enviando → confirmado/rechazado/desconocido. Un conflicto de versión requiere política explícita. Conservar entradas ante errores y asociar mensajes con campos.

## Timeout tras POST

El mensaje debe expresar incertidumbre: no se pudo confirmar el resultado. Si el servicio permite consultar estado por operación, usarlo. Si ofrece idempotencia, reutilizar la misma clave por intento lógico según su contrato. Si no ofrece ninguna garantía, evitar reintento automático potencialmente duplicado y preparar reconciliación o comprobación compatible. No inventar endpoints.

## Éxito y progreso

Mostrar éxito tras evidencia adecuada. Una operación optimista de bajo riesgo necesita política de reversión y reconciliación. Un porcentaje indica avance real, no una animación temporal. Mantener información crítica cerca del contexto; un toast aislado no es recuperación.

## Evaluación

Comprobar datos conservados tras rechazo, ausencia de falso éxito, resultado de recarga, respuesta tardía y estados de permiso. Distinguir tests con mocks de pruebas de backend. Si el contrato limita recuperación, documentar la dependencia en vez de esconderla.

Este procedimiento es una especificación de ingeniería propuesta para el producto, no una garantía de que un backend desconocido soporte estas capacidades.
