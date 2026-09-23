# Contratos de PLAN_SITUADO.md y ESTADO.md

## Tarea ejecutable

| Campo | Requisito |
|---|---|
| ID y fase | Identificador estable y requisito R correspondiente |
| Resultado | Cambio observable para el usuario o consumidor |
| Archivos | Rutas existentes verificadas y nuevas rutas explícitas |
| Consume | Contratos/documentos de los que depende |
| Produce | Interfaz, componente, comportamiento o evidencia |
| Pasos | Acciones específicas y ordenadas |
| Verificación | Comando real o recorrido con datos y resultado esperado |
| Aceptación | Condición binaria o rúbrica con evidencia |
| Riesgo | Qué podría romper y cómo se detecta |
| Recuperación | Reversión delimitada y comprobación posterior |
| Estado | Pendiente, en curso, verificado, bloqueado o excluido con razón |

No completar “archivos” con rutas imaginadas de un framework favorito. Primero resolverlas desde el inventario.

## Registro de sesión

Fecha; candidato/commit; fase; última tarea verificada; archivos modificados; evidencia; decisiones recientes; tareas en curso; bloqueos concretos; cambios ajenos presentes; siguiente comando o acción; precauciones de contexto.

## Handoff entre Claude y Codex

El agente receptor verifica estado del checkout, instrucciones y existencia de evidencias. No acepta como hecho una frase como “todo está listo” sin alcance. Resuelve divergencias entre documentación y archivos antes de continuar. Conserva diseño y contratos aprobados salvo nueva evidencia.

## Reglas de continuidad

- Registrar el resultado después de un incremento significativo, no cada pulsación.
- No marcar verificado si solo se escribió código.
- Un bloqueo describe qué falta y qué tareas pueden continuar.
- La siguiente acción debe permitir retomar sin reinterpretar todo el plan.
- No incluir secretos, tokens de acceso ni datos personales reales innecesarios.
