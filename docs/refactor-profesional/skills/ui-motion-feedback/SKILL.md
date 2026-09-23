---
name: ui-motion-feedback
description: Use when designing or refining transitions, microinteractions, loading feedback, and reduced-motion behavior in a web application.
---

# Movimiento útil y respuesta precisa

Toda interacción necesita respuesta comprensible; decidir movimiento según su propósito. Usar la [ficha de transición](references/decisiones.md) para hacer revisable cada efecto.

## Procedimiento

1. Inventariar interacciones y cambios de estado del flujo. Distinguir feedback informativo de decoración.
2. Para cada transición definir propósito, origen/destino, propiedad, duración propuesta, curva, interrupción, foco y alternativa reducida.
3. Mantener inicio inmediato de acción funcional. Hacer que estado final y recuperación sean independientes de eventos de animación.
4. Implementar patrones con la tecnología existente o la opción compatible más simple.
5. Probar pulsaciones rápidas, cierre durante apertura, navegación durante carga y movimiento reducido.
6. Medir coste en hardware/configuración representativa; simplificar regiones, filtros o número de elementos si perjudican la tarea.

## Salida

Entregar matriz de transiciones, implementación o propuesta identificada, evidencia de interrupción, variante reducida y medición de coste.

## Límites

No interpretar “animar todo” como hacer rebotar cada control. No bloquear acciones por coreografía, secuestrar scroll o usar `transition: all`. No prometer 60/120 fps universales. Una falta de soporte visual debe conservar funcionalidad.
