# Accesibilidad y diseño adaptable

## Alcance de la evaluación

Objetivo: WCAG 2.2 AA para páginas y procesos definidos en el alcance. La norma se consulta en [WCAG 2.2](https://www.w3.org/TR/WCAG22/). Una herramienta automática detecta parte de los problemas; su resultado no certifica conformidad. La evidencia debe indicar rutas, estados, tecnologías de asistencia, navegadores y fecha.

Esta checklist es operativa y no sustituye revisar todos los criterios aplicables de la norma. Antes de declarar conformidad deben evaluarse procesos completos y el alcance de la declaración, no solo componentes aislados.

## Criterios concretos

| Área | Referencia y objetivo | Prueba |
|---|---|---|
| Texto | Contraste mínimo 4,5:1; texto grande 3:1, según definiciones y excepciones | Medir foreground y background efectivos en estados reales |
| Controles | Contraste no textual aplicable de 3:1 | Identificar bordes/indicadores necesarios, estados y fondos |
| Teclado | Funciones operables sin apuntador; sin trampas | Completar tarea con Tab, Shift+Tab, Enter, Espacio, Escape según patrón |
| Foco | Visible y no totalmente oculto por contenido del autor | Recorrer con barras fijas, diálogos y mensajes presentes |
| Tamaño de objetivo | 24×24 CSS px o condiciones/excepciones de 2.5.8 | Medir áreas activables y espaciado; no solo icono visible |
| Reflow | Contenido usable a 320 CSS px cuando aplique | Ancho estrecho y zoom equivalente, sin scroll bidimensional injustificado |
| Formularios | Etiquetas, instrucciones y errores comprensibles | Lector de pantalla, entrada incompleta y corrección |
| Estado | Cambios importantes percibidos sin mover foco innecesariamente | Probar región de estado y evitar anuncios repetidos |
| Arrastre | Alternativa de puntero simple cuando aplica 2.5.7 | Reordenar sin arrastrar y ofrecer teclado equivalente |
| Autenticación | Evaluar autenticación accesible y mecanismos de asistencia | Pegar contraseña, gestor y ayudas existentes |

El [criterio de contraste de texto](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) define texto grande y excepciones; no redondear resultados por debajo del umbral. El [mínimo de objetivos](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) tiene excepciones precisas, incluidas ciertas situaciones de espaciado y texto en línea. El objetivo de 44 CSS px para acciones táctiles frecuentes de este kit es una propuesta adicional, no el mínimo AA.

El [foco no oculto mínimo](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) exige que el componente enfocado no quede totalmente oculto por contenido creado por el autor. Proponemos como estándar interno que el indicador y el objetivo sean claramente visibles, una expectativa más fuerte que el mínimo de ese criterio.

La [guía de reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) contempla contenido que necesita una disposición bidimensional. Una tabla puede requerir una región de desplazamiento horizontal; eso no justifica que encabezados, filtros y toda la página desborden.

## Semántica antes que ARIA

Usar elementos HTML adecuados. Añadir roles y atributos cuando el patrón los requiera, sin reemplazar interacciones nativas con `div` clicables. Una navegación de enlaces no necesita `role=menu` solo porque visualmente se vea como un menú. Ese rol implica un patrón de teclado específico.

Para modales, contrastar comportamiento con el [patrón Dialog de APG](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/): foco dentro, fondo inerte, cierre adecuado y retorno de foco. Si se usa `<dialog>`, comprobar el comportamiento implementado en los navegadores objetivo y el etiquetado; el elemento no resuelve automáticamente toda decisión de UX.

## Responsive por contenido

Identificar dónde falla el contenido y definir breakpoints alrededor de esas necesidades. No asumir tres tamaños de dispositivo como cobertura suficiente. Probar como mínimo un ancho estrecho de 320 CSS px, móvil representativo de 390, intermedio de 768 y escritorio de 1280 o 1440, más un punto a cada lado de los breakpoints reales. Son puntos de prueba propuestos, no garantías de cobertura.

En cada uno comprobar navegación, etiquetas, teclado virtual, formularios, menús, ventanas, toasts, tabla y lectura de errores. El zoom debe conservar funcionalidades; no desactivar el zoom del navegador para que el diseño encaje.

## Contenido difícil

Permitir salto de línea en títulos y botones cuando sea correcto. Truncar únicamente cuando existe un mecanismo accesible para consultar el valor completo. Evitar tooltips como única solución móvil. URLs largas, identificadores y datos preformateados requieren reglas específicas de wrapping o regiones de scroll local.

Comprobar espaciado de texto personalizado, alto contraste/forced colors cuando corresponda y tema oscuro si está en alcance. La opacidad global de un control deshabilitado no debe convertir en ilegible una explicación necesaria.

## Modalidades de prueba

**Automatizada:** axe u otra herramienta compatible en páginas y estados representativos; inspección de nombres/roles y navegación mediante pruebas de interacción. Guardar hallazgos y decidir cada uno.

**Manual técnica:** teclado completo, foco al cambiar ruta, orden DOM, zoom, reflow, reduced motion, lectura de errores y uso de diálogos. Verificar por lo menos una combinación lector/navegador relevante según el público.

**Con personas:** tareas con usuarios representativos, incluidas necesidades de accesibilidad cuando sea posible. No suplantar esta evaluación con una afirmación del agente. Si falta hardware o lector, dejar claramente pendiente esa combinación.

## Gate

No hay barreras críticas conocidas en los flujos incluidos. Los defectos restantes tienen severidad, alcance y decisión explícita. La matriz permite identificar exactamente qué se probó. Las preferencias de movimiento y los estados de error conservan utilidad. No declarar accesibilidad total por una puntuación de Lighthouse.
