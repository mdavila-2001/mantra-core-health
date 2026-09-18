# Síntesis aplicada y decisiones del paquete

## Qué se toma de la investigación

La base combina principios de diseño de producto, composición visual, accesibilidad, arquitectura y verificación. Ninguna fuente por sí sola describe cómo refactorizar una app desconocida de extremo a extremo. La secuencia de 12 fases, sus contratos y los prompts son una propuesta original para integrar esas disciplinas.

| Idea investigada | Decisión de este kit | Límite |
|---|---|---|
| Separar contenido y controles con jerarquía | Superficies estables y profundidad contenida | No trasladar literalmente tecnología nativa a CSS |
| Diseñar partes y pantallas conjuntamente | Pantalla patrón y flujo piloto antes de escalar | No fabricar todo el catálogo en aislamiento |
| Mantener estado comprensible | Matriz de lectura/escritura y recuperación | La UI depende de garantías reales del servicio |
| Revelar complejidad de forma gradual | Secundarias en niveles reconocibles | No esconder tareas frecuentes |
| Proteger responsabilidades y dependencias | Features, contratos y UI compartida | No imponer capas sin beneficio |
| Responder a preferencias de movimiento | Alternativa reducida con información equivalente | Desactivar efectos no puede bloquear operaciones |
| Evaluar experiencia mediante evidencia | QA por riesgo, capturas y recorridos | La automatización tiene cobertura limitada |

La heurística de visibilidad del estado y el uso de lenguaje del usuario fundamentan parte del diagnóstico; consultar [NN/g](https://www.nngroup.com/articles/ten-usability-heuristics/). La ficha de hallazgos y su priorización son elaboraciones operativas de este kit.

## Decisiones propias, expresamente propuestas

1. **Modernización incremental:** elegida para preservar funcionalidad y detectar fallos temprano. Puede revisarse si la auditoría demuestra que la base impide el objetivo.
2. **Una pantalla patrón y un flujo vertical:** permiten probar composición, datos y recuperación antes de migrar todas las rutas.
3. **Doce fases con gates:** hacen visible el avance; no representan un proceso obligatorio de una metodología externa.
4. **Escalas de espacio y movimiento:** puntos de partida coherentes, ajustables con contenido y hardware real.
5. **Objetivo táctil de 44 CSS px en acciones frecuentes:** propuesta de comodidad adicional, diferenciada del criterio AA mínimo.
6. **Rúbrica de 85/100 y mínimos por dimensión:** herramienta de discusión interna; no certificación de UX ni dato de investigación.
7. **Tolerancia inicial de rendimiento del 10 % bajo medición estable:** propuesta que debe calibrarse por ruido y presupuesto real.
8. **Skills especializadas y autocontenidas:** reducen carga de contexto y permiten reutilizar procedimientos sin duplicar toda la documentación.

## Lo que la evidencia no permite prometer

No permite asegurar “la mejor interfaz” para cualquier audiencia, una mejora porcentual universal, cero errores, compatibilidad con cualquier dispositivo ni que un prompt produzca por sí solo resultados perfectos. La calidad depende de contexto, implementación, revisión y uso real.

El plan responde a esa incertidumbre con decisiones verificables: si una reubicación es una hipótesis, se prueba; si una animación cuesta demasiado, se simplifica; si una API no confirma el efecto, la UI expresa incertidumbre; si una prueba no se ejecutó, el informe conserva esa condición.

## Correspondencia con la petición

| Necesidad solicitada | Respuesta del paquete |
|---|---|
| Prompt para Claude y Codex | Prompt maestro y adaptadores específicos |
| De apariencia improvisada a profesional | Auditoría, dirección visual, tokens y rúbrica |
| Estilo Apple | Síntesis de jerarquía, materiales y continuidad adaptada a web |
| Transiciones cuidadas en controles | Matriz completa de feedback, movimiento, interrupción y preferencias |
| Reordenar lo difícil de usar | Fichas de reubicación y protocolo de descubribilidad |
| SOLID y disciplina | Contratos, límites de responsabilidad y gates con evidencia |
| Átomos, moléculas y organismos | Composición completa con plantillas y páginas |
| Generación de skills de diseño | Seis skills portables y procedimiento de extensión |
| Plan por fases ultra detallado | Doce fases con tareas, salidas, aceptación y recuperación |
| Investigación y ZIP con Markdown | Fuentes primarias enlazadas y documentación organizada |
