# Sistema de movimiento y microinteracciones

## Qué significa una interfaz viva

El sistema confirma entradas, muestra continuidad entre estados y deja que la persona interrumpa o cambie de intención. Una animación no sustituye el feedback de una operación. “Ultra HD” no es una categoría técnica de transiciones web: los resultados buscados son nitidez, estabilidad espacial, baja latencia percibida y movimiento fluido en los dispositivos objetivo.

Esta especificación propone valores propios iniciales. No los atribuye a Apple. Revisarlos en el piloto con contenido y hardware reales.

## Reglas de decisión

1. Nombrar el cambio que necesita explicación: selección, apertura, asociación entre elemento y detalle, actualización o finalización.
2. Si no hay cambio que explicar, preferir una respuesta de color, borde o estado sin desplazamiento.
3. Mantener un origen espacial consistente. Un panel no aparece desde lados distintos para la misma acción sin razón.
4. Ejecutar el efecto de negocio o navegación inmediatamente; el movimiento acompaña el cambio.
5. Diseñar interrupción antes de implementar: cerrar durante apertura, pulsar otra pestaña, navegar mientras carga y cambiar preferencia de movimiento.
6. Asegurar el mismo resultado funcional con efectos desactivados.

## Matriz de transiciones inicial

| Interacción | Respuesta propuesta | Tiempo inicial | Movimiento reducido | Riesgo y mitigación |
|---|---|---|---|---|
| Hover de botón | Cambio de superficie/borde | 100–160 ms | Cambio inmediato | No depender de hover en táctil |
| Pulsación | Estado presionado; escala mínima opcional | 80–120 ms | Solo color/borde | No deformar texto o mover objetivos |
| Foco por teclado | Indicador visible | Inmediato | Igual | No retrasarlo por transición |
| Toggle | Posición y estado textual/semántico | 160–220 ms | Cambio inmediato | Persistencia separada del movimiento |
| Menú | Opacidad y desplazamiento corto | 120–180 ms | Aparición inmediata | Gestionar foco y cierre sin esperar animación |
| Modal | Atenuación y cambio corto de opacidad/escala | 180–240 ms | Aparición inmediata | No dejar contenido interactivo detrás |
| Drawer | Entrada de borde coherente | 220–300 ms | Aparición sin viaje | No generar scroll horizontal |
| Pestañas | Indicador y actualización de panel | 120–180 ms | Cambio inmediato | No esperar carga lenta para mover foco |
| Expandir sección | Revelar contenido con continuidad | 160–240 ms | Sin animación | Medir coste de layout; no animar toda la página |
| Filtro o búsqueda | Estado ocupado local y resultados estables | Depende de la operación | Igual, sin shimmer | Cancelar/descartar respuestas obsoletas |
| Guardar | Ocupado → confirmado/error/desconocido | Duración real | Igual | Nunca fabricar un porcentaje o éxito |
| Toast | Aparición discreta | 160–220 ms | Inmediata | Información crítica persistente en el contexto |
| Reordenar | Mantener relación entre posiciones | 180–260 ms | Movimiento instantáneo | Ofrecer alternativa al arrastre |
| Navegar ruta | Continuidad corta si ayuda | 180–260 ms | Sin transición de recorrido | URL y foco correctos aunque falle el efecto |

Evitar escalonar cientos de filas. Un stagger inicial puede limitarse a unos pocos elementos significativos, con presupuesto total corto. Si leer o actuar queda bloqueado esperando el escalonado, eliminarlo.

## Ficha obligatoria por transición

ID y propósito; origen/destino; elemento animado; propiedad; duración/curva; inicio del efecto funcional; política de interrupción; manejo de foco; variante reducida; fallback; coste observado; test o evidencia; responsable.

Las curvas iniciales pueden ser `cubic-bezier(0.2, 0, 0, 1)` para cambios estándar y una salida breve para desaparición. Los springs se incorporan solo si hay una biblioteca ya presente o un caso que justifique su coste. Documentar parámetros y evitar rebote donde la precisión de lectura o selección sea relevante.

## Implementación escalonada

Preferir CSS para estados simples y APIs del navegador compatibles para transiciones que lo requieran. Verificar soporte real antes de adoptar View Transitions; mantener la navegación funcional sin ellas. Si el proyecto ya usa una biblioteca de movimiento, consolidar sobre ella en vez de introducir una segunda por el mismo propósito.

`transform` y `opacity` suelen evitar trabajo de layout, pero no garantizan por sí solos bajo coste: capas grandes, filtros y áreas repintadas pueden seguir siendo caros. Medir. La [guía de animación de web.dev](https://web.dev/articles/animations-guide) explica cómo relacionar propiedades con el pipeline de renderizado.

Usar `will-change` solo para casos medidos y retirarlo cuando no haga falta. No asignarlo globalmente a todos los elementos. Evitar transiciones sobre `width`, `height` o sombras complejas en grandes regiones si el perfil muestra trabajo excesivo; cuando la expansión de layout sea necesaria, limitar su alcance y comprobar su coste.

## Preferencias y accesibilidad

La consulta [`prefers-reduced-motion`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion) permite responder a la preferencia del sistema. El producto debe conservar feedback informativo en esa variante. No eliminar el indicador de progreso simplemente porque el spinner ya no gira: sustituirlo por texto u otra señal estable.

Ejemplo dirigido, adaptable a las clases reales:

```css
.interactive-control {
  transition: background-color 120ms ease, border-color 120ms ease;
}
.context-panel {
  animation: context-enter 220ms cubic-bezier(0.2, 0, 0, 1);
}
@keyframes context-enter {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
@media (prefers-reduced-motion: reduce) {
  .interactive-control { transition: none; }
  .context-panel { animation: none; }
}
```

No usar una regla global de duración cero sin revisar código que depende de `transitionend` o `animationend`. El estado final debe derivarse de la lógica del componente; ningún control puede quedar bloqueado si no se emite un evento de animación.

## Cómo medir

Grabar una traza en un dispositivo representativo o configuración reproducible. Ejecutar abrir/cerrar, cambiar pestañas, scroll con overlays y repetir interacciones rápidamente. Inspeccionar tareas largas, layout, pintura, frames perdidos y latencia de entrada. A 60 Hz el intervalo nominal es de unos 16,7 ms; a 120 Hz, unos 8,3 ms. No prometer una tasa fija para todos los dispositivos ni usar esos intervalos como único criterio.

Comparar el mismo flujo sin efectos, con efectos y con movimiento reducido. Si el coste empeora la tarea, simplificar primero tamaño de regiones, filtros y número de elementos. Repetir la medición que mostró el problema, no todo el universo de benchmarks.

## Aceptación

Cada transición tiene propósito y ficha. Todos los controles siguen funcionando bajo interacción rápida. No hay esperas decorativas antes de acciones. El foco y el contenido final son correctos con o sin animación. La variante reducida se ha probado y los efectos no incumplen el presupuesto del piloto.
