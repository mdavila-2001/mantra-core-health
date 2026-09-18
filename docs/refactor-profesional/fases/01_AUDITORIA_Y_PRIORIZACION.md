# Fase 01 — auditoría de experiencia y prioridad

> Ejecutar por hallazgos reproducibles. No describir preferencias personales como defectos universales.

**Objetivo:** localizar problemas que impiden que el producto sea claro y completo. **Arquitectura:** evaluación transversal de flujos, estados y componentes. **Stack:** descubierto en 00. **Spec:** [especificación objetivo](../ESPECIFICACION_OBJETIVO.md).

## Entradas, interfaces y salidas

Consumir inventario, baseline y tareas del producto. Crear `trabajo/HALLAZGOS.md` y actualizar `PLAN_SITUADO.md`. Cada hallazgo produce ID, ruta/rol/estado, pasos de reproducción, evidencia, impacto, severidad, confianza y propuesta verificable.

Leer [UX](../especificaciones/01_UX_Y_REORGANIZACION.md), [estados](../especificaciones/06_ESTADOS_Y_CONTRATOS_DE_INTERACCION.md) y [rúbrica](../especificaciones/10_RUBRICA_DE_CALIDAD.md).

## F01.1 — auditar tareas

- [ ] Completar las tareas candidatas sin asumir conocimiento interno.
- [ ] Registrar dónde hay dudas, retrocesos, acciones duplicadas o pérdida de contexto.
- [ ] Separar problemas de descubribilidad, comprensión, ejecución y recuperación.
- [ ] Identificar si los textos coinciden con conceptos reales del dominio.

**Aceptación:** cada problema permite repetir el recorrido y observar la fricción. La afirmación “demasiados clics” identifica cuáles sobran y por qué.

## F01.2 — auditar estados y accesibilidad inicial

- [ ] Forzar vacío, sin resultados, error de lectura y validación utilizando datos o mocks de prueba controlados.
- [ ] Recorrer con teclado y abrir los overlays principales.
- [ ] Revisar contraste, tamaño de objetivos, zoom, contenido largo y móvil.
- [ ] Detectar acciones que muestran éxito sin evidencia, pierden datos o ocultan errores.

**Aceptación:** los estados ausentes se registran explícitamente; no se deducen únicamente leyendo componentes.

## F01.3 — auditar lenguaje visual y arquitectura

- [ ] Comparar botones, campos, títulos, espaciado y superficies entre rutas.
- [ ] Contar familias de variantes con diferencias funcionales y duplicados accidentales.
- [ ] Señalar componentes que mezclan presentación, transporte y reglas de producto.
- [ ] Detectar dependencias que condicionan rendimiento o accesibilidad.

**Aceptación:** las oportunidades técnicas se conectan con una mejora concreta o reducción de riesgo; no se propone reescribir todo por tamaño de archivos.

## F01.4 — priorizar

| Prioridad | Definición | Ejemplo |
|---|---|---|
| P0 | Pérdida grave de datos, acceso indebido o daño crítico | Guardar en entidad equivocada |
| P1 | Impide una tarea principal o su acceso | Modal imposible de cerrar con teclado |
| P2 | Fricción importante con alternativa | Exportación escondida fuera del contexto |
| P3 | Inconsistencia menor o pulido | Radio distinto sin impacto funcional |

- [ ] Asignar severidad separada de confianza. Un posible P0 exige investigar, no afirmar el daño sin prueba.
- [ ] Ordenar con frecuencia conocida, alcance, reversibilidad y dependencias; no inventar una puntuación cuantitativa de usuarios.
- [ ] Elegir un flujo piloto representativo y acotado.

## F01.5 — cerrar diagnóstico operativo

- [ ] Para los hallazgos prioritarios definir condición concreta de corrección.
- [ ] Vincular cada uno con requisitos R01–R14 y fase responsable.
- [ ] Separar cambios de UI, contratos backend y decisiones de negocio.

**Gate:** existe una lista ejecutable y un piloto que prueba el sistema, no solo una pantalla bonita. **Recuperación:** si una hipótesis no se confirma, conservar la evidencia y retirarla de la prioridad; no mantener una refactorización innecesaria por haberla escrito.
