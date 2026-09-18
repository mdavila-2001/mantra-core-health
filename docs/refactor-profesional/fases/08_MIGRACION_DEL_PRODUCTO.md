# Fase 08 — migración del producto por familias de tareas

> Extender lo demostrado sin copiar defectos ni rediseñar cada pantalla desde cero.

**Objetivo:** cubrir el resto del alcance con consistencia y preservación funcional. **Arquitectura:** migración por familias y contratos compatibles. **Stack:** actual. **Spec:** [especificación objetivo](../ESPECIFICACION_OBJETIVO.md).

## Entradas y salidas

Consumir piloto, catálogo y rutas inventariadas. Crear/actualizar `trabajo/MATRIZ_COBERTURA.md`, plan de retirada del legado y evidencias por incremento. Las rutas de implementación son las verificadas en fase 00.

## F08.1 — agrupar y ordenar

- [ ] Agrupar listas/detalles, formularios, reportes, configuración y flujos especiales que realmente existan.
- [ ] Ordenar por impacto, reutilización y dependencia.
- [ ] Definir qué plantilla compartirá cada familia y qué diferencias son legítimas.
- [ ] Marcar rutas fuera de alcance con razón, sin omitirlas silenciosamente.

**Aceptación:** cada ruta tiene destino de migración o exclusión explícita.

## F08.2 — migrar una familia

- [ ] Aplicar componentes y tokens sin duplicar el piloto por copia indiscriminada.
- [ ] Resolver información y acciones específicas del dominio.
- [ ] Conectar estados y operaciones reales de cada ruta.
- [ ] Ejecutar los escenarios relevantes antes de pasar a la siguiente familia.

**Aceptación:** semejanza visual respaldada por comportamiento consistente; diferencias documentadas.

## F08.3 — conservar compatibilidad

- [ ] Verificar URLs anteriores, bookmarks y enlaces internos.
- [ ] Mantener redirecciones y parámetros necesarios sin bucles.
- [ ] Revisar permisos y visibilidad por rol.
- [ ] Probar atrás/adelante y continuidad entre pantallas nuevas y aún antiguas.

**Aceptación:** los usuarios no pierden acceso por un cambio de lugar o nombre.

## F08.4 — cerrar estados y contenido

- [ ] Completar la matriz ruta × rol × estado aplicable.
- [ ] Revisar datos extensos, vacío, error y carga de cada familia.
- [ ] Eliminar textos ficticios y acciones decorativas.
- [ ] Comprobar que dashboards y reportes muestran fuentes y fechas cuando el producto lo requiere.

**Aceptación:** la app no aparenta capacidades inexistentes; los datos no disponibles no se convierten en cero.

## F08.5 — retirar legado gradualmente

- [ ] Localizar consumidores remanentes de componentes y tokens antiguos.
- [ ] Retirar imports, estilos y compatibilidad que ya no se utilizan.
- [ ] Comprobar build y flujos afectados tras cada retirada significativa.
- [ ] Documentar deuda que permanece y su condición de eliminación.

**Gate:** cobertura completa del alcance y transiciones entre rutas coherentes. **Recuperación:** revertir una familia de forma delimitada si falla; mantener contratos de datos compatibles. No eliminar componentes compartidos basándose solo en una búsqueda incompleta de nombres dinámicos o configuración.
