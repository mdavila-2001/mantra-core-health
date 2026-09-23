---
name: ui-quality-gate
description: Use when reviewing or closing a UX/UI refactor increment and deciding whether functional, visual, accessibility, and performance claims are supported.
---

# Cerrar incrementos con evidencia

Evaluar el candidato real y el alcance acordado. Usar [criterios y reporte](references/decisiones.md) para separar resultado demostrado y pendiente.

## Procedimiento

1. Identificar versión, requisitos y archivos afectados. Revisar instrucciones y comandos reales.
2. Ejecutar checks pertinentes y escenarios de usuario que cubran el riesgo del cambio.
3. Inspeccionar capturas de estados y viewports relevantes; revisar diferencias antes de actualizar referencias.
4. Completar evaluación automática con teclado, foco y revisión manual pertinente. Registrar tecnologías no disponibles.
5. Comparar rendimiento bajo condiciones equivalentes. Separar laboratorio y campo.
6. Emitir aprobado, parcial, bloqueado o no aplica justificado para cada criterio. Corregir fallos del alcance autorizado y repetir la verificación afectada.

## Salida

Entregar versión, alcance, resultados, evidencia existente, defectos por severidad, limitaciones, recuperación y siguiente acción.

## Límites

Una compilación no prueba experiencia. Un screenshot no prueba persistencia. Un análisis automático sin errores no certifica accesibilidad. No ejecutar pruebas indefinidas después de resolver el riesgo y cumplir los gates. No afirmar “perfecto” o “sin errores” por cobertura parcial.
