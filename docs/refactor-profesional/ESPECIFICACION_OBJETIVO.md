# Especificación del resultado esperado

**Estado:** especificación reutilizable; requiere contextualización en fase 00. **Versión:** 1.0. **Fecha:** 2026-09-18.

## Decisión de enfoque

Se recomienda una modernización incremental por flujos completos. Una capa cosmética aislada no resuelve navegación ni comportamiento; una reescritura total aumenta la superficie de regresión y solo se considerará si el diagnóstico demuestra que la base actual impide el objetivo. La alternativa elegida preserva reglas y contratos mientras sustituye partes verificables.

La dirección visual se denomina aquí **claridad con profundidad moderada**: contenido protagonista, contraste sólido, superficies tranquilas, acciones reconocibles y movimiento que explica relaciones. Es una propuesta propia de este paquete, no un estándar de Apple ni una exigencia universal.

## Requisitos trazables

| ID | Resultado requerido | Evidencia de aceptación | Fase responsable |
|---|---|---|---|
| R01 | Contexto real y alcance explícitos | Inventario de rutas, roles, tareas y comandos contrastados | 00 |
| R02 | Problemas observados y priorizados | Hallazgos con reproducción, impacto y nivel de confianza | 01 |
| R03 | Navegación comprensible | Mapa antes/después y tareas de descubribilidad | 02 |
| R04 | Identidad visual consistente | Pantalla patrón, reglas de composición y tokens semánticos | 03 |
| R05 | Contratos y responsabilidades claros | Mapa de dependencias y prueba de flujo sin acoplamiento de UI al transporte | 04 |
| R06 | Componentes reutilizables completos | Catálogo con estados, accesibilidad y casos de contenido extremo | 05 |
| R07 | Flujo principal utilizable de extremo a extremo | Navegar, actuar, persistir y recuperar errores con datos de prueba | 06 |
| R08 | Movimiento intencional y adaptable | Inventario de transiciones, variante reducida y perfilado | 07 |
| R09 | Cobertura del resto de la app | Matriz de rutas/roles/estados, incluidas rutas antiguas | 08 |
| R10 | Accesibilidad verificable | Checklist WCAG aplicable, revisión manual y pruebas automatizadas | Transversal; cierre 09 |
| R11 | Rendimiento bajo control | Baseline, presupuesto acordado y comparación reproducible | Transversal; cierre 09 |
| R12 | Entrega mantenible y recuperable | CI pertinente, documentación, plan de reversión y registro final | 10–11 |
| R13 | Skills portables y disciplinadas | Metadatos válidos, referencias incluidas y escenarios de uso | 05 y 11 |
| R14 | Afirmaciones honestas | Distinción observado / supuesto / propuesto / no ejecutado | Todas |

## Restricciones globales

1. Conservar funcionalidades y reglas de negocio salvo cambio explícito de alcance. No tomar defectos actuales como comportamiento correcto si hay evidencia de que son errores.
2. Conservar framework, router, gestor de paquetes, biblioteca UI y mecanismo de estado cuando satisfagan las necesidades; justificar cada sustitución.
3. No exigir TypeScript en un proyecto que no lo usa. Los ejemplos tipados se traducen a contratos equivalentes.
4. Objetivo de accesibilidad: WCAG 2.2 AA para las páginas y procesos en alcance. Los criterios AAA opcionales se identifican por separado. Una revisión parcial no acredita conformidad global.
5. Diseñar a 320 CSS px cuando el criterio de reflow aplique; comprobar también anchos intermedios. Las regiones legítimamente bidimensionales requieren tratamiento específico, no una exención de toda la página.
6. Tomar LCP ≤ 2,5 s, INP ≤ 200 ms y CLS ≤ 0,1 en percentil 75 como referencias de buena experiencia de campo. Antes de disponer de muestra real, informar solo mediciones de laboratorio y su configuración.
7. Los tiempos, radios, tamaños y presupuestos propuestos por este kit son puntos de partida. Validarlos con el producto; no presentarlos como valores prescritos por Apple.
8. No añadir efectos cuyo coste impida completar las tareas o empeore significativamente el rendimiento respecto de un presupuesto aprobado.
9. Las acciones con efectos externos conservan autorización, trazabilidad y recuperación. El refactor visual no cambia permisos de backend.
10. Los entregables de ejecución viven en `trabajo/` dentro de la copia del kit en el proyecto; el contenido normativo del kit permanece reconocible.

## Definición de completitud

Un flujo se considera completo si puede iniciarse desde los accesos previstos, informa de su estado, permite terminar o salir sin perder contexto indebidamente, presenta datos persistidos reales y resuelve sus fallos relevantes. Además debe funcionar con los roles en alcance y las modalidades de entrada previstas.

Una ruta sin funcionalidad puede omitirse del refactor solo con una exclusión explícita. Un botón decorativo que no hace nada no cuenta como implementación. Una pantalla vacía sin explicación no cuenta como un estado diseñado.

## Calidad visual observable

- Los elementos que tienen el mismo papel comparten tratamiento; las diferencias visuales comunican diferencias reales.
- Se puede identificar la tarea principal sin recorrer toda la pantalla.
- Los alineamientos, relaciones espaciales y alturas de controles siguen reglas documentadas.
- El texto no depende de que todos los nombres sean cortos. Datos extensos y traducciones no rompen la composición.
- La interfaz conserva un estado estable mientras llegan datos y mientras una operación está en curso.
- Los efectos no impiden ver el contenido ni entender qué es interactivo.

## Qué no se promete

No se garantiza un porcentaje universal de mejora de conversión, un tiempo fijo de implementación, compatibilidad con todas las versiones históricas de navegadores ni ausencia absoluta de defectos. La fase 00 fija alcance real, dispositivos y supuestos. La fase 11 distingue resultado entregado, seguimiento pendiente y limitaciones demostradas.
