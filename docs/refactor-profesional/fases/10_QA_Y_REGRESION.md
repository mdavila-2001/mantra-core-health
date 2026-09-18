# Fase 10 — QA integral y regresión

> La evidencia debe corresponder al candidato final, no a una versión anterior que ya cambió.

**Objetivo:** comprobar integridad y calidad de la entrega. **Arquitectura:** pruebas por riesgo y revisión visual contextual. **Stack:** suite real del proyecto. **Spec:** [especificación objetivo](../ESPECIFICACION_OBJETIVO.md).

## Entradas y salidas

Consumir matriz de cobertura y reportes previos. Crear `trabajo/QA_FINAL.md` y actualizar `EVIDENCIAS.md`. Leer [QA](../especificaciones/09_QA_Y_EVIDENCIAS.md) y [rúbrica](../especificaciones/10_RUBRICA_DE_CALIDAD.md).

## F10.1 — preparar candidato y datos

- [ ] Identificar commit o versión exacta del candidato.
- [ ] Fijar datos reproducibles, roles y configuración de navegadores.
- [ ] Confirmar que las pruebas no actúan sobre información productiva.
- [ ] Enumerar suites y escenarios aplicables Q01–Q16.

**Aceptación:** otra persona puede repetir la evaluación y reconocer qué se probó.

## F10.2 — ejecutar checks y flujos

- [ ] Ejecutar build, tipos y calidad pertinentes según comandos reales.
- [ ] Ejecutar contratos, integración y end to end críticos.
- [ ] Verificar persistencia real donde la prueba lo declara.
- [ ] Revisar consola y fallos de red inesperados en el contexto de la tarea.

**Aceptación:** resultados exactos y fallos explicados; no confundir tests omitidos con aprobados.

## F10.3 — regresión visual

- [ ] Capturar rutas/estados representativos en viewports acordados.
- [ ] Comparar con referencias revisadas y controlar variabilidad legítima.
- [ ] Inspeccionar foco, error, contenido largo, overlays y temas incluidos.
- [ ] Aprobar cada cambio esperado de baseline con justificación.

**Aceptación:** los snapshots no se actualizan únicamente para volver verde la suite.

## F10.4 — revisión de producto

- [ ] Repetir tareas de descubribilidad y recuperación seleccionadas.
- [ ] Puntuar la rúbrica con evidencia y incertidumbre explícita.
- [ ] Comprobar que las mejoras UX no cambiaron reglas de negocio inadvertidamente.
- [ ] Examinar reubicaciones y continuidad con rutas antiguas.

**Aceptación:** la evaluación describe efectos para el usuario, no solo cumplimiento técnico.

## F10.5 — cerrar defectos

- [ ] Corregir fallos prioritarios y repetir checks afectados.
- [ ] Investigar pruebas inestables sin esconderlas con reintentos indefinidos.
- [ ] Actualizar la matriz con aprobado, parcial, bloqueado o no aplica justificado.
- [ ] Emitir decisión de candidato listo o bloqueado con razones concretas.

**Gate:** definición de terminado satisfecha en alcance y evidencia vigente. **Recuperación:** si aparece un P0/P1, retirar el candidato y aplicar la recuperación del incremento afectado. No ampliar infinitamente las pruebas una vez resuelto el riesgo y cumplidos los gates.
