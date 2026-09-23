# Rúbrica para decidir si la transformación está lograda

Esta rúbrica es una propuesta de evaluación del kit, no un estándar externo ni una certificación. Ayuda a convertir palabras como “profesional” o “armonioso” en observaciones revisables.

## Escala

0: ausente o roto. 1: parcial, con barreras importantes. 2: usable con inconsistencias visibles. 3: sólido en el alcance probado. 4: sólido, coherente entre estados y respaldado por evidencia suficiente.

| Dimensión | Peso | Qué observar para puntuar 4 |
|---|---:|---|
| Claridad de tareas y navegación | 20 | Se reconoce contexto, siguiente acción y ubicación de funciones; validación disponible |
| Estados y recuperación | 15 | Éxito, error, vacío, ocupado y conflictos pertinentes resueltos |
| Consistencia visual | 15 | Tokens, jerarquía, alineamientos y contenido extremo coherentes |
| Accesibilidad | 15 | Revisión aplicable completa y sin barreras críticas conocidas |
| Rendimiento y estabilidad | 10 | Presupuestos cumplidos con medición comparable |
| Arquitectura y mantenibilidad | 10 | Contratos claros, responsabilidad localizada y sin complejidad artificial |
| Movimiento y respuesta | 10 | Feedback inmediato, continuidad útil, interrupción y variante reducida |
| Documentación y evidencia | 5 | Reproducción, continuidad y reversión suficientemente documentadas |

Puntuación ponderada = suma de `peso × nota / 4`. Meta propuesta: al menos 85/100, sin dimensiones por debajo de 3. No compensar una barrera crítica con puntos de estética. Si no hay evidencia, la nota debe expresar la incertidumbre y no alcanzar 4 por intuición.

## Condiciones que bloquean la entrega

- Pérdida de datos, permiso roto, acción destructiva equivocada o flujo principal inutilizable.
- Falso éxito, resultado desconocido presentado como confirmado o dependencia productiva simulada sin avisar.
- Barrera de teclado o de lectura que impide completar el proceso incluido.
- Regresión de rendimiento que impide uso razonable y no se ha resuelto.
- Capturas o resultados de pruebas fabricados.

## Revisión antes/después

Comparar la misma tarea, datos y condiciones. Describir resultado observable: “el filtro se conserva al volver del detalle” o “el error se asocia al campo”. No limitarse a “más moderno”. Si se informa mejora de tiempo o éxito, adjuntar muestra, método y limitaciones.

## Anti-patrones frecuentes

| Apariencia de mejora | Problema | Sustitución |
|---|---|---|
| Todo tiene sombra, blur y gradiente | Desaparece la jerarquía | Reservar materiales para una función |
| Todos los controles son iconos | Baja descubribilidad | Texto visible en acciones ambiguas |
| Se ocultan campos para “limpiar” | Se rompe la tarea o el contrato | Agrupar y explicar requisitos |
| Todo entra animado desde abajo | Ruido y espera repetitiva | Movimiento solo donde explica continuidad |
| Componentes con veinte flags | Combinaciones imposibles | Variantes explícitas y composición |
| Carpetas atómicas para toda la lógica | Responsabilidades confusas | Features y contratos aparte de UI compartida |
| Un screenshot desktop como prueba | No cubre interacción ni errores | Matriz de estados y flujos reales |
| Lighthouse 100 como certificado | Cobertura limitada | Evidencia manual y del producto |

## Cierre de observaciones

Cada observación debe acabar con corrección comprobada, exclusión justificada o deuda residual responsable y fechada. No mantener una lista indefinida de “pulidos” sin impacto. Priorizar la corrección por el perjuicio a la tarea y la frecuencia observada.
