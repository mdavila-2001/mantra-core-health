# Verificación del paquete documental

**Fecha:** 2026-09-18. **Objeto verificado:** este kit de prompts, planes y skills portables. No una aplicación del usuario.

## Composición

50 archivos Markdown: 4 documentos principales, 4 adaptadores/guías de prompts, 12 fases, 10 especificaciones, 5 plantillas, 12 archivos de skills —6 entradas y 6 referencias—, 2 documentos de investigación y este informe. Extensión aproximada: 25.000 palabras. El ZIP incluye un manifiesto adicional de integridad por archivo.

## Comprobaciones realizadas

| Comprobación | Resultado y alcance |
|---|---|
| Enlaces relativos | Se resolvieron los destinos de enlaces Markdown dentro del paquete; sin destinos ausentes |
| Bloques de código | Delimitadores de bloques equilibrados |
| Texto sin terminar | Búsqueda de marcadores de borrador y referencias internas de herramientas; no encontrados |
| Formato de skills | Las 6 entradas pasaron el validador de frontmatter/nombre disponible |
| Autocontención de skills | Cada entrada enlaza una referencia incluida en su propia carpeta |
| Fases | 12 documentos, con objetivo, entradas, tareas, aceptación y recuperación |
| Trazabilidad | R01–R14 asignados a fases; correspondencia con la petición documentada |
| Fuentes | 24 fuentes primarias enlazadas; limitaciones de las páginas HIG con JavaScript declaradas |
| Ejemplos de código | Identificados como patrones a adaptar; no se presentan como ejecutados contra una app |

La validación de metadatos comprueba estructura, no la efectividad universal de una skill. La resolución de enlaces internos comprueba existencia, no certifica que cualquier referencia externa permanecerá disponible en el futuro.

## Evaluación de escenarios

Se hizo una primera evaluación independiente de tres situaciones sin estas skills: movimiento en tabla grande, exportación difícil de encontrar y timeout de escritura. Las respuestas ya conservaron criterios adecuados. No se observó un fallo de base que permita atribuir causalmente una mejora a las skills.

Posteriormente, otra evaluación con las seis skills produjo propuestas para cinco encargos. Fue una prueba de aplicación de instrucciones a escenarios, no una implementación ni un benchmark estadístico de agentes.

| Escenario | Resultado observado |
|---|---|
| Tabla de 500 filas en Android económico | Priorizó legibilidad, feedback y medición; evitó animar cada fila |
| Exportación ubicada en Ajustes sin métricas | Propuso cambio reversible, alcance explícito y validación neutral |
| Timeout tras POST sin consulta/idempotencia | Conservó resultado desconocido; no inventó éxito ni endpoints |
| Button acoplado a persistencia y Link visualmente igual | Separó semántica y responsabilidades; rechazó reorganización indiscriminada |
| Solo build y screenshot desktop | Emitió cierre parcial y enumeró evidencia pertinente pendiente |

Las seis skills pudieron aplicarse a las propuestas. La evaluación reconoció que código, dispositivos y contratos reales serían necesarios para implementar y verificar esos resultados.

## Revisión de coherencia

Se comprobó que Atomic Design incluye plantillas y páginas, que SOLID no exige clases ni microservicios, que las duraciones propuestas no se atribuyen a Apple y que el objetivo táctil de 44 CSS px se distingue del mínimo AA. También se separan datos de laboratorio/campo, mocks/persistencia real y archivo portable/instalación.

El prompt autoriza por defecto trabajo local reversible al ser usado como encargo de implementación, y ofrece un ajuste explícito de solo diagnóstico. Este documento entregado no ejecuta por sí mismo ese encargo sobre un repositorio.

## Lo no verificado en esta entrega

- No se auditó ni refactorizó una web específica: no se proporcionó URL o código.
- No se ejecutaron las pruebas ilustrativas de Playwright contra una aplicación.
- No se midieron Core Web Vitals, contraste o accesibilidad de un producto del usuario.
- No se realizaron entrevistas ni pruebas de usabilidad con personas.
- No se instalaron las skills en los entornos personales de Claude/Codex.
- No se desplegó ni publicó una web.

## Integridad y uso

El archivo `MANIFEST_SHA256.txt` contiene hashes de los archivos Markdown del ZIP. Permite comprobar alteraciones después de la extracción; no es una firma digital de autoría. El contenedor ZIP se comprobó mediante lectura y verificación de sus entradas antes de entregar.

Para empezar, abrir `LEEME_PRIMERO.md` y usar `PROMPT_MAESTRO.md` en el repositorio objetivo. La fase 00 convierte este marco reutilizable en un plan situado con rutas, comandos y evidencias reales.
