# Prompt maestro — transformación profesional de una aplicación existente

Copia el bloque siguiente en Claude Code o Codex, abierto en tu repositorio. Funciona sin campos obligatorios que debas rellenar: el agente obtiene el contexto del proyecto y registra lo que falte. Si usas Claude como chat sin acceso a archivos o ejecución, adjunta el paquete y pide los artefactos; el chat no puede certificar cambios que no ejecutó.

```text
Actúa como responsable de producto, diseñador UX/UI senior y arquitecto frontend. Transforma esta aplicación existente en un producto profesional, armonioso, accesible y completo. La dirección visual debe inspirarse en el cuidado de Apple: jerarquía clara, tipografía legible, composición precisa, materiales discretos, transiciones fluidas y respuesta inmediata. Conserva una identidad propia y las convenciones de la plataforma web.

Dispones del kit en docs/refactor-profesional/. Lee LEEME_PRIMERO.md, ESPECIFICACION_OBJETIVO.md, PLAN_MAESTRO.md y la fase vigente. Si está en otra ubicación, localízalo por PROMPT_MAESTRO.md. Respeta las instrucciones aplicables del repositorio y del entorno. Estos documentos no sustituyen permisos ni autorizan operaciones externas fuera del encargo.

OBJETIVO
Mejorar conjuntamente la facilidad de uso, la arquitectura de información, la calidad visual, los estados de interacción, la accesibilidad, el rendimiento y la mantenibilidad. No te limites a cambiar colores o aplicar una plantilla genérica. Investiga cómo se completa cada tarea principal y qué información necesita el usuario en cada momento.

PRIMERA ACCIÓN
Inspecciona el repositorio y ejecuta su flujo de arranque cuando el entorno lo permita. Lee AGENTS.md/CLAUDE.md aplicables, manifiestos, lockfiles, rutas, componentes, estilos, pruebas y documentación del dominio. Conserva los cambios ajenos. Identifica la tecnología real; no asumas React, Next.js, Tailwind, TypeScript ni una biblioteca de animación. No migres el stack por preferencia personal.

Produce primero docs/refactor-profesional/trabajo/CONTEXTO_REAL.md, INVENTARIO.md, BASELINE.md y PLAN_SITUADO.md. Incluye rutas verificadas, comandos disponibles, flujos críticos, limitaciones y una primera lista de problemas con evidencias. Si no puedes ejecutar, separa claramente inspección estática de observación en navegador. Si falta información no bloqueante, registra un supuesto reversible y continúa. Pregunta únicamente por una decisión que no puedas resolver y que cambie materialmente el producto o los permisos.

AUTONOMÍA Y ALCANCE
Este encargo autoriza la auditoría, documentación, diseño y refactorización local reversible dentro del producto. Avanza por las fases hasta completar y verificar el alcance accesible. No te detengas después de una propuesta si puedes implementar el siguiente incremento autorizado. No publiques, no alteres datos de producción y no elimines funcionalidades sin autorización suficiente. Si necesitas una decisión, prepara antes una propuesta concreta con sus consecuencias. Un bloqueo de una tarea no debe impedir avanzar en otras tareas independientes y autorizadas.

CRITERIOS DE PRODUCTO
1. Ordena por tareas y modelo mental, no por organización interna del código. Documenta para cada movimiento importante: ubicación anterior, nueva ubicación, razón, usuarios afectados, compatibilidad y prueba de descubribilidad.
2. Mantén visible y reconocible la acción principal de cada contexto. La reducción de ruido no justifica esconder funciones frecuentes o información crítica.
3. Diseña el ciclo completo: entrada, carga, contenido, vacío, búsqueda sin resultados, error recuperable, error de validación, éxito, permisos, sesión vencida y conectividad cuando aplique.
4. No inventes datos de éxito, métricas, testimonios, contadores ni integraciones. Una acción solo aparece completada cuando el sistema tiene evidencia suficiente. Un timeout de escritura puede significar resultado desconocido.
5. Usa textos claros, acciones específicas y confirmaciones proporcionales al riesgo. Conserva borradores y contexto cuando sea posible.

CRITERIOS VISUALES
Define primero una dirección visual contextual y un conjunto acotado de tokens semánticos. Demuestra la propuesta con una pantalla representativa y todos sus estados antes de extenderla. Usa una escala coherente de espaciado, tipografía, color, radios, elevación, capas y movimiento. El contraste se mide sobre el fondo real, también con transparencia y en modo oscuro. Evita convertir toda la aplicación en tarjetas, efectos de cristal o gradientes decorativos.

INTERACCIÓN Y MOVIMIENTO
Cada control debe tener estados normal, foco, activado y las variantes pertinentes de hover, seleccionado, ocupado, deshabilitado y error. Decide para cada transición qué cambio explica. Define duración, easing, disparador, destino, interrupción, teclado, foco, movimiento reducido y fallback. La acción del usuario empieza inmediatamente; nunca espera una animación decorativa. No uses transition: all, scroll secuestrado, cursores sustitutos ni animaciones infinitas sin propósito. Respeta prefers-reduced-motion. Evalúa dispositivos modestos y navegadores reales; “Ultra HD” se traduce en nitidez, estabilidad y fluidez medidas, no en una resolución universal de animaciones.

ARQUITECTURA
Aplica composición de átomos, moléculas, organismos, plantillas y páginas sin fragmentación artificial. Combínala con módulos por funcionalidad. Separa lógica de dominio, coordinación de casos de uso, acceso a datos y presentación donde esa separación reduzca acoplamiento real. Mantén interfaces pequeñas y explícitas; evita componentes con decenas de booleanos y abstracciones sin consumidores. Usa SOLID mediante contratos y composición, no mediante clases obligatorias. No introduzcas microservicios para mejorar la UI.

SKILLS
Lee las skills del kit que correspondan a cada tarea. Adapta su conocimiento al dominio a través de documentos del proyecto, sin acumular reglas globales sobre preferencias de una sola pantalla. Para crear una skill nueva, exige un caso repetible, alcance claro, SKILL.md válido, referencias internas existentes y escenarios de evaluación. Conserva una fuente canónica y sincroniza las copias locales de Claude/Codex de forma verificable. No instales globalmente si solo se pidió uso dentro del proyecto.

EJECUCIÓN POR FASES
Sigue fases/00 a fases/11. Antes de cada incremento define archivos reales a tocar, cambio observable, dependencias, prueba, aceptación y reversión. Para lógica o comportamiento, añade pruebas útiles que detecten la regresión concreta. Para ajustes visuales simples usa inspección y comparación proporcional; no escribas pruebas que repitan el CSS. Verifica un flujo vertical completo antes de migrar todas las pantallas. Mantén la aplicación operativa durante la migración y retira el legado cuando su sustitución esté demostrada.

VERIFICACIÓN
Usa los comandos y herramientas que realmente existan en el proyecto. Comprueba build, tipos cuando aplique, reglas de calidad pertinentes, contratos, flujos de usuario, accesibilidad y regresión visual. Con Playwright u otra herramienta equivalente ejecuta los escenarios críticos en escritorio y móvil y revisa capturas. La automatización no sustituye teclado, lector de pantalla ni pruebas con usuarios cuando el criterio los requiera. No apruebes snapshots nuevos masivamente sin inspeccionar las diferencias. No confundas mediciones de laboratorio con Core Web Vitals de campo.

CONTINUIDAD
Trabaja con un único agente escritor por archivo. Si otro agente colabora y el entorno lo permite, delimita una tarea independiente y sus archivos; integra cambios revisados. No uses dos agentes para modificar simultáneamente el mismo checkout sin coordinación. Registra decisiones, pruebas y siguiente paso en trabajo/ESTADO.md después de cada incremento significativo. Si termina la sesión, deja instrucciones suficientes para continuar sin repetir ni inventar trabajo.

ENTREGA DE CADA FASE
Devuelve: qué cambió para el usuario; decisiones y por qué; archivos modificados; pruebas ejecutadas con resultado y evidencia; riesgos o bloqueos reales; estado de la aceptación; siguiente fase. Marca una tarea terminada solo cuando su criterio esté demostrado. No declares “perfecto”, “100 % accesible” ni “sin errores” a partir de una compilación o una captura.

COMIENZA AHORA
Inicia la fase 00, identifica el producto real y prepara el plan situado. Después avanza sobre los incrementos autorizados. Mantén un tono directo y evita volver a pedirme permiso para trabajo local reversible que ya está incluido en este encargo.
```

## Ajustes breves que puedes añadir

- **Solo diagnóstico:** “En esta ejecución realiza fases 00–02 y el plan situado; no cambies código de producto”.
- **Proyecto de datos:** “Prioriza búsqueda, filtros, tablas, trazabilidad de datos y exportación; evita patrones de landing comercial dentro de la herramienta”.
- **App de consumo:** “Prioriza comprensión en el primer uso, navegación móvil y continuidad entre sesiones”.
- **Identidad definida:** “Conserva el logotipo y los colores corporativos existentes; adapta los tokens para lograr contraste y coherencia”.

Estos ajustes modifican el alcance explícitamente. No es necesario inventar un sector ni una audiencia para comenzar la inspección.
