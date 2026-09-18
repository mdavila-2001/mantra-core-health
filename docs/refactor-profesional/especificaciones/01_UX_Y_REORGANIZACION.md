# UX, arquitectura de información y reubicación de funciones

## Punto de partida

La unidad de diseño es la tarea: qué intenta lograr alguien, con qué información, desde qué situación y con qué riesgo de error. Una página puede contener varias tareas; un flujo puede atravesar varias páginas. El mapa UX debe modelar ambas cosas sin asumir que los menús actuales son correctos.

Usar observación de usuarios y datos existentes cuando estén disponibles. Un análisis heurístico aporta hipótesis de fricción, no demuestra por sí solo el comportamiento de la audiencia. La distinción es especialmente importante al quitar etiquetas, cambiar nombres o esconder acciones.

## Inventario por tarea

Para cada tarea registrar: rol, disparador, frecuencia conocida, resultado deseado, entrada habitual, datos necesarios, pasos, dependencias, errores frecuentes, dispositivos, permisos, salida y continuidad. Identificar si el usuario explora, compara, decide, introduce datos o supervisa. No imponer la misma densidad a los cinco casos.

Separar evidencia directa —grabación autorizada, observación, error reproducido— de inferencia —“probablemente no ve el botón”—. Adjuntar ruta y captura a cada hallazgo. No inferir frecuencia real a partir de la prominencia actual.

## Reubicar con criterio

| Pregunta | Implicación |
|---|---|
| ¿La acción afecta un objeto, una colección o toda la cuenta? | Ubicarla junto al alcance que modifica |
| ¿Se necesita al completar la tarea principal? | Mantener acceso visible en ese contexto |
| ¿Es ocasional, experta o secundaria? | Evaluar divulgación progresiva con rótulo reconocible |
| ¿Tiene consecuencias irreversibles? | Separación suficiente, texto explícito y recuperación o confirmación |
| ¿Depende de una selección? | Mostrar relación clara entre selección, cantidad y acción |
| ¿El cambio rompe hábitos o enlaces? | Mantener redirección o acceso transitorio y explicar el nuevo lugar |
| ¿No hay evidencia de problema? | No reorganizar masivamente; probar una hipótesis acotada |

La divulgación progresiva permite dejar detalles menos frecuentes para un segundo nivel; el criterio es que la tarea básica siga completa y los usuarios avanzados encuentren el resto. Esa idea procede de la [explicación de NN/g](https://www.nngroup.com/articles/progressive-disclosure/). Las decisiones concretas de esta tabla son propuestas operativas del kit.

## Ejemplo trabajado: exportación en una tabla

Supuesto ilustrativo: la exportación de resultados vive en Ajustes generales. Quien filtra la tabla debe abandonar su contexto para exportar.

1. Identificar si exporta todo el conjunto, el resultado filtrado o filas seleccionadas. Confirmarlo con el contrato existente.
2. Colocar “Exportar resultados” en la barra de herramientas de esa colección. Si exporta seleccionados, mostrar “Exportar 12 seleccionados” y explicar si la selección cruza páginas.
3. Conservar filtros y orden en la URL cuando ya sean compartibles; evitar exportar silenciosamente un conjunto distinto del que ve el usuario.
4. Mostrar formato y alcance antes de una operación larga. Comunicar generación, listo, error y caducidad del enlace cuando corresponda.
5. Mantener temporalmente un acceso desde Ajustes que conduzca al nuevo lugar si hay usuarios habituados. La duración se define con soporte y uso real.
6. Medir si alguien encuentra la función sin pistas. Revisar éxito, dudas, primer lugar buscado y correspondencia del archivo con la selección.

No inventar que exportar “tarda menos” porque está más cerca. Medir el flujo y comprobar que la ubicación ayuda.

## Jerarquía de pantalla

Orden recomendado adaptable: identidad del contexto → estado importante → contenido o decisión principal → acción relevante → detalles secundarios. No convertirlo en una plantilla rígida: una pantalla de emergencia puede necesitar primero una alerta; una tabla operacional puede necesitar filtros antes de indicadores.

El encabezado responde dónde estoy. La navegación muestra dónde puedo ir. Las herramientas actúan sobre lo que estoy viendo. Los ajustes modifican preferencias o configuración duradera. Mezclar esas cuatro funciones produce acciones ambiguas.

Usar etiquetas del dominio del usuario. Evitar “gestión”, “módulos” o “procesos” como sustitutos vagos si “Pacientes”, “Solicitudes” o “Facturas” representan mejor el contenido real. No adoptar esos ejemplos si el dominio es otro.

## Formularios

Agrupar por significado, ordenar según dependencias y mostrar qué es obligatorio. No ocultar un requisito de negocio para acortar visualmente el formulario. Pedir cada dato en el momento en que se necesita. Mantener etiquetas visibles y ayudas cerca del campo; los ejemplos no sustituyen la etiqueta.

Si el formulario es largo, elegir entre secciones o pasos según la tarea. Un asistente por pasos ayuda cuando hay secuencia y dependencia; perjudica cuando el usuario compara información entre secciones. Mostrar resumen editable antes de confirmar cuando hay consecuencias relevantes.

Preservar datos ante errores. Situar errores junto al campo y ofrecer resumen cuando hay varios. Mover foco al resumen o al primer error según el patrón acordado, sin anunciar cada carácter como error. No validar de forma agresiva mientras la persona apenas empieza a escribir.

## Navegación y adaptación

- En escritorio, sidebar si hay destinos frecuentes suficientes; top navigation si el conjunto es pequeño y estable.
- En móvil, priorizar los destinos realmente usados; no copiar automáticamente toda la sidebar dentro de un menú oculto.
- Mantener URL, atrás/adelante, abrir en pestaña nueva y enlaces profundos cuando el recurso lo permita.
- Conservar scroll y filtros al volver a una lista si esa continuidad es parte de la tarea.
- Evitar cambiar automáticamente de página después de una selección si el usuario no lo espera.
- Distinguir pestañas de vistas del mismo contexto y navegación hacia páginas distintas.

## Validación formativa

Preparar tareas neutrales: “Encuentra los registros pendientes de este mes y guarda una copia” es mejor que “Usa el botón Exportar”. Reclutar personas representativas cuando sea posible; registrar experiencia previa y dispositivos. Una ronda pequeña de 5–8 personas puede revelar problemas cualitativos, pero no produce por sí sola una estimación estadística de toda la población.

Comparar éxito sin ayuda, tiempo, errores, confianza declarada y observaciones. Contrabalancear el orden de versiones si se comparan antes/después para reducir aprendizaje. Informar número de participantes y limitaciones. Si no hay participantes, entregar hipótesis y protocolo pendiente; una autoevaluación del agente no se denomina investigación con usuarios.

## Aceptación

Cada reubicación importante tiene una ficha de decisión. Los flujos críticos mantienen accesibilidad, permisos, rutas y recuperación. Los usuarios pueden reconocer acciones por texto o convención estable. La reducción de pasos no se consigue eliminando controles que evitan errores importantes.
