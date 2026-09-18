# Fase 07 — movimiento, respuesta y sensación de calidad

> Añadir movimiento sobre un flujo funcional, con propósito, interrupción y alternativa accesible.

**Objetivo:** que la app responda con precisión y conserve continuidad. **Arquitectura:** tokens de movimiento y patrones reutilizables. **Stack:** CSS/APIs compatibles o biblioteca existente. **Spec:** [especificación objetivo](../ESPECIFICACION_OBJETIVO.md).

## Entradas y salidas

Consumir piloto verificado y baseline de interacción. Crear `trabajo/MATRIZ_MOVIMIENTO.md`, evidencia de rendimiento y catálogo de variantes. Leer [movimiento](../especificaciones/05_MOVIMIENTO_Y_MICROINTERACCIONES.md).

## F07.1 — inventariar todas las interacciones del piloto

- [ ] Listar botones, enlaces, inputs, menús, pestañas, overlays, notificaciones y actualizaciones.
- [ ] Asignar feedback visible a cada uno y distinguir cuáles requieren movimiento.
- [ ] Definir propósito, origen/destino, propiedad, duración y curva para cada transición.
- [ ] Incluir teclado, táctil y ausencia de hover.

**Aceptación:** no hay controles silenciosos ni animaciones sin propósito documentado.

## F07.2 — implementar patrones

- [ ] Consolidar duraciones y curvas en tokens.
- [ ] Ejecutar la acción funcional de inmediato y acompañar con feedback.
- [ ] Mantener geometría estable para no desplazar objetivos mientras se pulsan.
- [ ] Comprobar que eventos visuales no controlen el éxito del negocio.

**Aceptación:** desactivar animaciones no bloquea ninguna acción ni deja controles ocupados.

## F07.3 — interrupción y preferencias

- [ ] Abrir/cerrar rápidamente y cambiar de destino durante una transición.
- [ ] Navegar mientras hay carga y comprobar limpieza de efectos.
- [ ] Activar movimiento reducido antes de cargar y durante la sesión cuando el entorno lo permita.
- [ ] Sustituir desplazamientos/shimmer por feedback estable en la variante reducida.

**Aceptación:** estado final, foco y datos correctos; sin colas de animaciones acumuladas.

## F07.4 — perfilar

- [ ] Grabar scroll, overlays y acciones repetidas con datos representativos.
- [ ] Revisar trabajo de layout/pintura, tareas largas y coste de filtros/capas.
- [ ] Comparar con baseline sin efectos bajo condiciones equivalentes.
- [ ] Simplificar efectos que exceden presupuesto y repetir la medición específica.

**Aceptación:** la mejora perceptiva no reduce la capacidad de completar la tarea en dispositivos objetivo.

## F07.5 — revisión visual dinámica

- [ ] Observar coherencia espacial y ritmo entre transiciones.
- [ ] Revisar que salida y entrada no oculten información ni acumulen retraso.
- [ ] Documentar fallback por navegador y dependencia nueva, si la hay.
- [ ] Actualizar componentes compartidos para que el patrón se propague coherentemente.

**Gate:** matriz completa, variantes probadas y coste conocido. **Recuperación:** desactivar el efecto problemático conservando feedback y funcionalidad; no revertir todo el flujo por un defecto cosmético. Las transiciones son mejora progresiva, no una dependencia de la operación.
