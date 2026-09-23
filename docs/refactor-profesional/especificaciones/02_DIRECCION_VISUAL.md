# Dirección visual: precisión, calma y respuesta

## Interpretación del estilo solicitado

La inspiración Apple de este kit consiste en jerarquía contenida, cuidado tipográfico, superficies que explican profundidad y transiciones conectadas con el estado. Apple presenta Liquid Glass como una capa dinámica para controles y navegación, con adaptación para mantener legibilidad; esa fuente no prescribe aplicar cristal indiscriminadamente a contenido web. Véase [Meet Liquid Glass](https://developer.apple.com/videos/play/wwdc2025/219/).

La adaptación propuesta aquí usa superficies opacas como base y translucidez limitada donde añada orientación. Es una decisión de diseño propia. CSS `backdrop-filter` no reproduce toda la tecnología de Apple. No copiar activos propietarios ni asumir que las licencias de tipografías o iconos permiten su redistribución en una web.

## Tres direcciones evaluables

| Dirección | Adecuada para | Fortalezas | Riesgo a controlar |
|---|---|---|---|
| Editorial sobria | Lectura, contenido, presentación de producto | Ritmo, tipografía y narrativa | Espacio excesivo en tareas densas |
| Instrumental clara | Tablas, administración y trabajo repetitivo | Escaneo, control y densidad razonable | Apariencia plana sin jerarquía |
| Profundidad contenida | Aplicación de consumo con navegación fluida | Relación entre superficies y respuesta táctil | Exceso de transparencia y coste de efectos |

Seleccionar una dirección dominante y justificarla con tareas reales. La recomendación inicial para una herramienta de trabajo es instrumental clara con detalles de profundidad contenida. No imponerla a una landing editorial.

## Composición

Usar una retícula de contenido y relaciones espaciales explícitas. El espacio entre elementos del mismo grupo debe ser menor que entre grupos, salvo una razón funcional. Alinear títulos, campos, tablas y acciones con anclas compartidas. Unificar alturas de controles que comparten fila.

Una tarjeta delimita una unidad reconocible o manipulable. No envolver cada párrafo, tabla y etiqueta en una tarjeta. Introducir separadores o espacio cuando basten. Evitar sombras compitiendo en cada nivel; el elemento elevado debe tener una función distinta.

Definir tres densidades por necesidad, no por moda: cómoda para lectura/formularios; estándar para navegación; compacta opcional para tablas de expertos. Mantener áreas de activación suficientes y texto legible en las tres. Nunca reducir toda la app para hacer caber una tabla.

## Tipografía

Partir de una fuente de sistema o una familia con licencia verificada. Definir roles —display, título, subtítulo, cuerpo, etiqueta, metadato y dato tabular— con tamaño, peso, interlineado y ancho apropiados. El mismo rol mantiene su tratamiento en todas las rutas.

Evitar texto de baja legibilidad para “verse premium”. El texto auxiliar debe seguir leyéndose. No justificar párrafos estrechos; respetar preferencia de tamaño de fuente y zoom. La tipografía fluida debe tener límites razonables y no provocar desbordamiento. Las cifras comparables pueden usar variantes tabulares si la fuente las ofrece.

## Color

Elegir neutros, una familia de acento y estados semánticos. Cada color comunica una función: acción, selección, advertencia, error o éxito. El color no es la única señal; añadir texto, forma o iconografía. Reservar los colores más intensos para prioridades reales.

El modo oscuro se diseña mediante equivalencias semánticas. No invertir automáticamente los colores. Comprobar imágenes, diagramas, sombras, campos, selección, foco y estados deshabilitados. Si el producto no requiere modo oscuro, registrarlo como alcance opcional en vez de duplicar trabajo por defecto.

## Materiales y profundidad

| Superficie | Propuesta inicial | Prueba necesaria |
|---|---|---|
| Fondo de página | Neutro opaco | Texto y regiones claramente separados |
| Contenido principal | Superficie estable, borde sutil si aporta | Legibilidad con datos extensos |
| Barra fija | Opaca o translucidez contenida | Contraste al pasar cualquier contenido detrás |
| Menú o popover | Fondo sólido de respaldo | Borde, foco y posición en todos los viewports |
| Modal | Superficie definida y fondo atenuado | Orden de foco y lectura del contenido |
| Acción primaria | Acento sólido reconocible | Texto, hover, foco, ocupado y contraste |

Los efectos tienen fallback opaco. No usar blur para resolver un contraste que sigue fallando. El usuario debe poder reducir efectos desde preferencias existentes o una opción del producto cuando se justifique; no asumir soporte universal de consultas de transparencia.

## Iconos y recursos

Usar una familia consistente de iconos con tamaños, grosores y alineamiento comunes. Los iconos decorativos no deben contaminar el nombre accesible. Las acciones poco universales conservan texto visible. Una ayuda emergente no reemplaza el nombre de un botón ni su descubribilidad táctil.

Las imágenes deben tener resolución adecuada a su tamaño de presentación, dimensiones reservadas y texto alternativo según función. Una imagen decorativa no necesita una descripción artificial. Evitar fondos pesados detrás de tareas densas.

## Cómo revisar armonía sin convertirla en gusto arbitrario

Comparar pantallas en una lámina común: mismos márgenes, títulos, controles y densidad. Revisar diferencias que no tienen explicación funcional. Mirar también una pantalla aislada con datos extremos; la uniformidad no sirve si el contenido se corta.

Para cada defecto visual anotar ubicación, regla incumplida, impacto y corrección. “Se ve feo” no ayuda a ejecutar. “La acción secundaria pesa más que Guardar por color y tamaño” sí permite revisar una decisión concreta.

## Pantalla patrón

Elegir una ruta que incluya título, navegación, contenido real, acción principal y al menos un error o estado vacío. Crear la dirección completa en esa ruta y mostrar versión de escritorio, móvil, texto largo y movimiento reducido. Adoptar los patrones que sobrevivan a esas pruebas antes de propagarlos.
