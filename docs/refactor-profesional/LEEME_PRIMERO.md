# De prototipo a producto profesional

**Kit de refactorización UX/UI para Claude Code y Codex · 18 de septiembre de 2026**

Este paquete convierte una petición estética ambiciosa en trabajo verificable: comprender el producto, reorganizar sus tareas, crear un lenguaje visual, refactorizar componentes, resolver los estados reales, añadir movimiento útil y demostrar que todo sigue funcionando.

La dirección es una experiencia inspirada en la claridad y el cuidado de Apple, adaptada a la web y a la identidad del producto. El objetivo es que la aplicación se sienta coherente, ágil y completa. La perfección no se garantiza con un prompt; se aproxima mediante decisiones explícitas, iteraciones y evidencias.

## Cómo empezar en cinco pasos

1. Descomprime esta carpeta en `docs/refactor-profesional/` del repositorio que quieres mejorar. Ese es el nombre convencional que usan los prompts; si eliges otro, indícaselo al agente.
2. Abre el repositorio con Claude Code o Codex. El acceso al código, a una ejecución local y a datos de prueba permite una evaluación real. Una captura aislada solo permite evaluar parte de la apariencia.
3. Copia el contenido del bloque principal de [PROMPT_MAESTRO.md](PROMPT_MAESTRO.md). Añade el adaptador de [Claude](prompts/CLAUDE_CODE.md) o [Codex](prompts/CODEX.md) si necesitas configurar sus archivos de instrucciones y skills.
4. El agente comienza con las fases 00–02 y produce un plan situado: rutas existentes, comandos realmente disponibles, problemas observados, dirección de diseño y cambios de navegación justificados.
5. Ejecuta por fases. Para continuar en otra sesión o cambiar de agente usa [CONTINUAR_Y_REVISAR.md](prompts/CONTINUAR_Y_REVISAR.md). El estado del trabajo vive en documentos del proyecto, no en la memoria de una conversación.

## Qué hay en el paquete

| Carpeta o documento | Para qué sirve |
|---|---|
| `PROMPT_MAESTRO.md` | Instrucción integral para iniciar y conducir la transformación |
| `PLAN_MAESTRO.md` | Dependencias, gates, alcance y secuencia de las 12 fases |
| `ESPECIFICACION_OBJETIVO.md` | Requisitos trazables y significado concreto de calidad |
| `prompts/` | Adaptadores por agente, continuidad y revisión crítica |
| `fases/` | Trabajo detallado, entregables, aceptación y recuperación por fase |
| `especificaciones/` | UX, diseño, tokens, composición, arquitectura, movimiento, estados y calidad |
| `plantillas/` | Registros que el agente rellenará con evidencia del proyecto |
| `skills/` | Skills portables con referencias internas autocontenidas |
| `fuentes/` | Investigación, enlaces originales y distinción entre norma y propuesta |
| `verificacion/` | Informe de comprobaciones del paquete |

## Alcance y límites honestos

No se recibió una URL ni un repositorio específico. Por ello, este paquete no afirma que una aplicación concreta haya sido auditada, rediseñada, probada o desplegada. Los nombres como `src/ui/` y el ejemplo de gestión de proyectos son propuestas ilustrativas. La fase 00 debe sustituirlos por las rutas y conceptos reales antes de editar código de producto.

Las skills se entregan como archivos portables para tu proyecto. No necesitas instalarlas globalmente para usar el prompt: el agente puede leerlas por ruta. El paquete no modifica automáticamente tu configuración personal. Las instrucciones de instalación local están en [INSTALAR_SKILLS.md](prompts/INSTALAR_SKILLS.md).

No pegues todos los documentos en una sola conversación. Carga el prompt, la especificación y la fase vigente; lee las referencias que corresponden a esa tarea. Así se conserva espacio para código y evidencias reales.

## Reglas que protegen el resultado

- Toda interacción tiene una respuesta comprensible; no toda interacción necesita desplazarse, rebotar o producir un efecto.
- Una pantalla bonita debe funcionar con errores, datos vacíos, permisos limitados, texto largo, teclado y red lenta.
- Reubicar una función exige explicar su relación con la tarea y verificar su descubribilidad; no se mueve únicamente porque “queda mejor”.
- Atomic Design organiza composición visual; SOLID guía responsabilidades y contratos. Ninguno obliga a una reescritura o a miles de archivos.
- Las transiciones tienen variantes de movimiento reducido y una salida funcional cuando el navegador no soporta un efecto.
- Se preservan reglas de negocio, enlaces relevantes, permisos y datos. Los cambios se migran en incrementos recuperables.
- Las pruebas y capturas se ejecutan y revisan. “No ejecutado” es un estado válido de un informe; nunca se convierte en “aprobado”.

## Lectura mínima recomendada

Para dirigir: este archivo, `PROMPT_MAESTRO.md`, `PLAN_MAESTRO.md` y la rúbrica de calidad.

Para implementar: lo anterior, `ESPECIFICACION_OBJETIVO.md`, fase vigente y especificaciones que esa fase enlaza.

Para revisar: matriz de requisitos, evidencias de ejecución, catálogo de estados, comparación antes/después y plan de reversión.

La investigación está documentada en [fuentes primarias](fuentes/01_FUENTES_PRIMARIAS.md) y [síntesis aplicada](fuentes/02_SINTESIS_Y_DECISIONES.md). Las comprobaciones de esta entrega están en el [informe de verificación](verificacion/INFORME_DEL_PAQUETE.md).
