# Fase 09 — consolidación de accesibilidad y rendimiento

> Estas disciplinas ya se aplicaron en cada incremento; ahora se verifica su cobertura de conjunto.

**Objetivo:** detectar barreras y regresiones que aparecen al combinar todo el producto. **Arquitectura:** corregir causas compartidas antes de acumular excepciones. **Stack:** herramientas compatibles con el proyecto. **Spec:** [especificación objetivo](../ESPECIFICACION_OBJETIVO.md).

## Entradas y salidas

Consumir matriz de cobertura y baseline. Producir reportes de accesibilidad, comparación de rendimiento y lista de limitaciones. Leer [accesibilidad](../especificaciones/07_ACCESIBILIDAD_RESPONSIVE.md) y [rendimiento](../especificaciones/08_RENDIMIENTO_Y_COMPATIBILIDAD.md).

## F09.1 — revisar procesos completos con teclado

- [ ] Recorrer desde entrada hasta confirmación y salida en cada flujo crítico.
- [ ] Revisar foco en navegación, errores, modales y eliminación de elementos.
- [ ] Probar barras fijas, scroll y componentes que puedan ocultar el foco.
- [ ] Resolver trampas, nombres ambiguos y pérdida de orientación.

**Aceptación:** las tareas principales pueden completarse sin ratón dentro de las capacidades del producto.

## F09.2 — accesibilidad manual y automatizada

- [ ] Ejecutar análisis automático en estados relevantes.
- [ ] Medir contraste efectivo, objetivos y reflow.
- [ ] Probar lector de pantalla en una combinación relevante disponible.
- [ ] Registrar criterios no evaluados y distinguir requisitos AA de recomendaciones adicionales.

**Aceptación:** hallazgos críticos resueltos; alcance y cobertura transparentes. Una herramienta sin errores no se presenta como certificado.

## F09.3 — medir rendimiento comparable

- [ ] Repetir rutas y escenarios del baseline con la misma configuración.
- [ ] Comparar carga, tamaño de recursos, interacción y estabilidad.
- [ ] Perfilado específico de animaciones, listas y overlays costosos.
- [ ] Separar resultados de laboratorio y datos de campo disponibles.

**Aceptación:** las conclusiones se sostienen en mediciones comparables; las diferencias dentro del ruido no se venden como mejoras.

## F09.4 — corregir causas

- [ ] Priorizar recursos bloqueantes, tareas largas, saltos de layout y barreras recurrentes.
- [ ] Corregir el componente o patrón compartido cuando la causa es sistémica.
- [ ] Repetir la verificación de los consumidores afectados.
- [ ] Revisar fallback funcional en navegadores y dispositivos objetivo.

**Aceptación:** no se arregla una ruta rompiendo otra; la corrección reduce el problema medido.

## F09.5 — decidir pendientes

- [ ] Definir severidad y tratamiento de cada defecto restante.
- [ ] Bloquear la entrega por barreras P0/P1 del alcance.
- [ ] Registrar excepciones menores con responsable, efecto y fecha de revisión.
- [ ] Preparar la matriz final para QA.

**Gate:** barreras críticas resueltas, presupuestos controlados y limitaciones identificadas. **Recuperación:** desactivar efectos o volver a patrones simples si una optimización compleja no demuestra beneficio. No reducir requisitos de accesibilidad para conservar una apariencia.
