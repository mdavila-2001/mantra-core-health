# Fase 02 — tareas, navegación y arquitectura de información

> Cambiar la organización cuando mejore una tarea demostrable; conservar continuidad y contratos.

**Objetivo:** definir cómo las personas encuentran, comprenden y completan las tareas. **Arquitectura:** mapa de navegación y flujos antes de detallar componentes. **Stack:** sin cambios. **Spec:** [especificación objetivo](../ESPECIFICACION_OBJETIVO.md).

## Entradas y salidas

Consumir hallazgos priorizados, rutas y roles. Crear `trabajo/MAPA_UX.md`, fichas de reubicación en `DECISIONES.md` y escenarios neutrales de prueba. Leer [especificación UX](../especificaciones/01_UX_Y_REORGANIZACION.md).

## F02.1 — modelar tareas

- [ ] Para cada tarea principal describir disparador, información necesaria, decisión, acción y resultado.
- [ ] Detectar pasos cuyo único propósito es compensar mala organización.
- [ ] Identificar comprobaciones necesarias para evitar errores; no eliminarlas para reducir clics.
- [ ] Señalar la continuidad deseada entre lista, detalle, edición y retorno.

**Aceptación:** cada paso tiene propósito o propuesta de eliminación justificada.

## F02.2 — proponer organización

- [ ] Agrupar destinos según conceptos de usuario y alcance de acciones.
- [ ] Separar navegación global, navegación contextual y herramientas de la vista.
- [ ] Preparar dos alternativas solo cuando exista una decisión real; comparar descubribilidad, densidad y coste de cambio.
- [ ] Elegir una propuesta con justificación y nivel de confianza.

**Aceptación:** las etiquetas son específicas, las acciones tienen contexto y la estructura no refleja simplemente carpetas del código.

## F02.3 — documentar movimientos

- [ ] Para cada cambio registrar ubicación anterior/nueva y alcance de datos afectado.
- [ ] Definir redirección, acceso transitorio, alias o comunicación si hay hábito previo.
- [ ] Preservar permisos, enlaces profundos y compatibilidad necesaria.
- [ ] Describir cómo se comprobará que se encuentra la función.

**Aceptación:** ningún movimiento relevante se justifica solo con “más limpio”.

## F02.4 — diseñar wireframes de comportamiento

- [ ] Representar pantalla principal, móvil y estados vacío/error con contenido realista.
- [ ] Marcar acción principal, secundarias, ayudas y recuperación.
- [ ] Definir orden DOM y foco junto con la composición visual.
- [ ] Especificar qué permanece visible al filtrar, enviar, abrir detalle o fallar.

**Aceptación:** se puede recorrer el flujo sin necesitar colores o animaciones para entenderlo.

## F02.5 — validar la hipótesis

- [ ] Si hay participantes, ejecutar tareas neutrales y registrar hallazgos con contexto de muestra.
- [ ] Si no los hay, hacer una revisión heurística identificada como tal y dejar protocolo listo.
- [ ] Ajustar problemas encontrados y actualizar las fichas de decisión.
- [ ] Entregar a fase 03 la propuesta elegida y a fase 04 los cambios de rutas/contratos afectados.

**Gate:** navegación propuesta coherente, movimientos trazables y principales riesgos de comprensión tratados. La validación pendiente no se marca como realizada.

## Recuperación y excepciones

Si un cambio amplio necesita una decisión de producto no disponible, implementar o prototipar el ajuste reversible más acotado y continuar con componentes independientes. Si los usuarios encuentran peor una función, restaurar un acceso claro y revisar la hipótesis antes de mover más pantallas. No crear redirecciones circulares ni mantener dos comportamientos de negocio diferentes para la misma acción.
