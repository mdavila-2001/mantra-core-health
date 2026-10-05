# Revisión visual — P1 y P2 cerradas

Las capturas usan datos sintéticos y respuestas HTTP interceptadas. Demuestran la interfaz; no demuestran autorización ni persistencia en API.

## Pasada 1

- P1 — directory-390-light.png — OK: tarjeta sin recortes; nombre extenso envuelve; teléfono y acción primaria visibles; siete campos, fecha/edad y ausencias explícitas; foco visible, controles alineados y márgenes consistentes. Botón primario de 44px; la captura es de página completa y exige desplazamiento vertical normal.
- P1 — directory-390-dark.png — OK: mantiene jerarquía y legibilidad; no aparecen fondos claros ni bordes perdidos en la tarjeta; foco y acción primaria distinguibles; datos sintéticos identificados.

## Pasada 2

PENDIENTE: revisión independiente adversarial con las diez preguntas de critical-double-review sobre la matriz final. Esta evidencia no autoriza declarar la interfaz verificada visualmente.

## Primera matriz completa (14 pruebas PASS, 24 capturas abiertas)

| Captura | P1 | Observación |
|---|---|---|
| directory-390-light.png | OK | Campos envuelven, chat primario y foco visible. |
| directory-390-dark.png | OK | Contraste, foco y ausencias legibles. |
| directory-649-light.png | OK | Una columna sin recortes; nombres y aseguradoras envuelven. |
| directory-649-dark.png | OK | Misma estructura legible; acción primaria distinguible. |
| directory-650-light.png | OK | Toolbar y detalles pasan a dos columnas; sin solapamientos. |
| directory-650-dark.png | OK | Bordes y controles permanecen visibles. |
| directory-768-light.png | OK | Tarjetas con siete campos y acción primaria completa. |
| directory-768-dark.png | OK | Etiquetas y datos legibles; sin fondos claros ajenos. |
| directory-1023-light.png | OK | Sidebar y tarjetas conviven sin recortes. |
| directory-1023-dark.png | OK | Mantiene jerarquía y legibilidad del directorio. |
| directory-1024-light.png | DEFECTO MAYOR | Columna Seguro fuera del área visible; scroll lateral poco evidente. |
| directory-1024-dark.png | DEFECTO MAYOR | Mismo defecto; la presencia del texto en DOM no lo detectó. |
| directory-1440-light.png | OK | Siete columnas visibles; teléfono y chat destacan. |
| directory-1440-dark.png | OK | Tabla legible y badges diferenciados. |
| directory-1920-light.png | OK | Contenedor centrado y ancho acotado; filas sin recortes. |
| directory-1920-dark.png | OK | Acciones y ausencias legibles en tabla completa. |
| directory-loading-light.png | OK | Seis filas skeleton, contador anuncia búsqueda, filtros estables. |
| directory-loading-dark.png | OK | Skeleton visible; tooltip de tema no tapa contenido del directorio. |
| directory-empty-light.png | OK | Explicación descriptiva y acción Actualizar directorio. |
| directory-empty-dark.png | OK | Mensaje y acción visibles y legibles. |
| directory-error-light.png | OK | Error orienta, conserva filtros y ofrece Reintentar carga. |
| directory-error-dark.png | OK | Alerta y acción legibles; no presenta el error crudo. |
| directory-forbidden-light.png | OK | Acceso denegado explícito, seguro deshabilitado, sin pacientes. |
| directory-forbidden-dark.png | OK | Alerta legible; no expone pacientes. |

Corrección del defecto MAYOR: `insurance-patients.css`, commit fea045a7. Tarjetas también cuando el contenedor disponible mide menos de 1024px, aunque el viewport sea mayor. Conserva siete campos y chat primario. Recompilación y recaptura pendientes; no se aprueba con estas imágenes.

La fixture de error se ajustó al contrato real `code: INTERNAL, correlationId` para verificar el identificador de soporte; las imágenes anteriores muestran el fallback sin-id y serán reemplazadas tras la siguiente corrida.

## No cubierto

Recapturas de la corrección, segunda pasada independiente y flujo real con API pendientes. Vacío por filtros fue probado funcionalmente; su captura y revisión específica siguen pendientes.

## Nota

A MEDIAS; sin aprobación visual final.

## P1 final — recapturas revisadas

Se abrieron individualmente las 26 capturas finales. La matriz completa terminó con 14 pruebas PASS (`frontend-browser-final-pass.txt`). Los estados se recapturaron con movimiento reducido y viewport estable: 5 pruebas PASS (`frontend-browser-states-final.txt`). La primera matriz y su defecto se conservan arriba como historial; no son la evaluación final.

| Capturas finales (ambos temas) | P1 | Evidencia observada |
|---|---|---|
| directory-390-{light,dark}.png | OK | Tarjetas completas, texto largo envuelve y chat primario visible. |
| directory-649-{light,dark}.png | OK | Una columna sin recortes ni desbordamiento. |
| directory-650-{light,dark}.png | OK | Filtros y detalles en dos columnas, etiquetas legibles. |
| directory-768-{light,dark}.png | OK | Siete campos conservados y acción primaria accesible. |
| directory-1023-{light,dark}.png | OK | Sidebar y tarjetas sin solapamiento. |
| directory-1024-{light,dark}.png | OK | Defecto MAYOR cerrado: tarjetas muestran Seguro y los siete campos. |
| directory-1440-{light,dark}.png | OK | Siete columnas visibles, fecha/edad juntas, Ninguno explícito. |
| directory-1920-{light,dark}.png | OK | Tabla centrada sin recortes; acciones y ausencias legibles. |
| directory-loading-{light,dark}.png | OK | Skeleton visible y filtros estables, sin spinner que mueva la vista. |
| directory-empty-{light,dark}.png | OK | Directorio vacío descriptivo con acción de actualización. |
| directory-error-{light,dark}.png | OK | Alerta y reintento visibles, identificador sintético de soporte. |
| directory-forbidden-{light,dark}.png | OK | Acceso denegado explícito sin pacientes expuestos. |
| directory-filter-empty-{light,dark}.png | OK | Mensaje exacto, chip activo y Restablecer filtros visibles. |

La captura inicial de vacío filtrado coincidía con una transición del sidebar; la recaptura estable elimina ese artefacto. El tooltip de tema en algunas capturas oscuras permanece en el encabezado sin tapar el directorio. No hay defectos bloqueantes en P1. Esta pasada no constituye autoaprobación: P2 debe ser independiente, adversarial y registrar las diez preguntas y nota por pantalla.

Pendiente fuera de P1: P2 independiente y recorrido con API real. Las respuestas interceptadas no demuestran aislamiento ni persistencia.

## P2 final — independiente

La segunda pasada está registrada en [revision-visual-p2.md](./revision-visual-p2.md): abrió las 26 capturas y contestó las diez preguntas adversariales. Directorio con datos: ACEPTABLE CON RESERVAS por el final recortado del placeholder del buscador a1024px; etiqueta accesible y operación permanecen completas. Los cinco estados capturados: APROBADA. Ningún hallazgo MAYOR o BLOQUEANTE pendiente. El defecto de Seguro oculto quedó cerrado en ambas pasadas.

Estas notas sustituyen el estado pendiente anterior de revisión visual. El recorrido con API real se evalúa separadamente y todavía está pendiente.

## P1 positiva — API real test

Se abrieron directory-real-data.png y directory-real-chat.png tras frontend-browser-real-test-api.txt: 1 passed (5.6s), EXIT_CODE=0. Listado: siete columnas completas, total12, chip de búsqueda, ausencia de contacto explícita y chat00 primario; texto largo envuelve sin recortes. Conversación tras recarga: hilo seleccionado, cabecera del perfil sintético, vacío orientado y compositor visible; sin solapamientos. P1 OK en ambas. El identificador y canal enviados, reutilización, persistencia y consola/red se demuestran por las pruebas reales, no por las imágenes.

La captura histórica de fallo del selector se abrió y revisó en P1/P2 antes de la limpieza automática de Playwright; no quedó conservada. Se preservó su salida literal FAIL y se reemplaza como evidencia visual actual con estas dos capturas positivas.
