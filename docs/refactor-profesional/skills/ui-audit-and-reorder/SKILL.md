---
name: ui-audit-and-reorder
description: Use when auditing an existing application's usability, navigation, or placement of functions before a UX refactor.
---

# Auditar tareas y reorganizar con evidencia

Inspeccionar el producto real antes de decidir qué mover. Conservar el alcance autorizado y las reglas de negocio. Usar [decisiones y contrato de salida](references/decisiones.md) para registrar hallazgos y movimientos.

## Procedimiento

1. Identificar rutas, roles y tareas principales. Separar hechos observados, documentación, hipótesis y desconocidos.
2. Recorrer entrada, tarea, resultado y recuperación. Registrar dónde la persona pierde contexto o necesita información ausente.
3. Relacionar cada función con su alcance: objeto, conjunto o cuenta. Proponer su ubicación junto a la tarea que la necesita.
4. Para un cambio importante, documentar ubicación actual/propuesta, razón, evidencia, permisos, continuidad de enlaces y prueba de descubribilidad.
5. Sin datos de usuarios, etiquetar la propuesta como hipótesis y preferir un incremento reversible. Preparar tareas neutrales para validarla.

## Salida

Entregar inventario de tareas, hallazgos priorizados y fichas de reubicación. Cada hallazgo incluye reproducción, impacto, confianza y aceptación verificable. Si no hay acceso al navegador, diferenciar inspección estática de observación de uso.

## Límites

No convertir ajustes visuales pequeños en reorganización completa. No esconder funciones frecuentes únicamente para reducir ruido. No afirmar mejora de tiempo o éxito sin medición. No instalar herramientas ni modificar datos productivos por el mero hecho de auditar.
