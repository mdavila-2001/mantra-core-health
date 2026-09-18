# Fase 06 — un flujo vertical completo

> Demostrar la transformación en una tarea real antes de propagarla a toda la aplicación.

**Objetivo:** conectar navegación, presentación, estado y persistencia en el piloto. **Arquitectura:** composición de componentes más caso de uso real. **Stack:** detectado y conservado. **Spec:** [especificación objetivo](../ESPECIFICACION_OBJETIVO.md).

## Entradas e interfaces

Consumir mapa UX, tokens, componentes y contratos del piloto. Modificar únicamente las rutas reales asignadas en `PLAN_SITUADO.md`. Producir evidencia de flujo y ajustar el sistema cuando falle en contexto. Leer [estados](../especificaciones/06_ESTADOS_Y_CONTRATOS_DE_INTERACCION.md) y [QA](../especificaciones/09_QA_Y_EVIDENCIAS.md).

## F06.1 — conectar recorrido válido

- [ ] Implementar entrada desde navegación y enlace directo.
- [ ] Cargar datos y presentar contexto con las nuevas jerarquías.
- [ ] Ejecutar la acción principal a través del contrato definido.
- [ ] Mostrar resultado confirmado y comprobarlo al recargar o consultar de nuevo.

**Aceptación:** la tarea funciona contra servicios de prueba reales o integración identificada. Un mock de UI se etiqueta como tal y no acredita persistencia.

## F06.2 — resolver fallos y recuperación

- [ ] Reproducir validación fallida, rechazo de servidor y pérdida de conexión pertinente.
- [ ] Conservar datos ingresados y contexto de navegación cuando sea seguro.
- [ ] Representar resultado desconocido y conflicto si el contrato los contempla.
- [ ] Verificar reintento sin duplicación de efectos garantizada solo donde existe soporte.

**Aceptación:** el mensaje describe lo que realmente se sabe. La UI permite continuar o salir con claridad.

## F06.3 — asegurar continuidad

- [ ] Probar atrás, adelante, recarga y retorno desde detalle.
- [ ] Conservar filtros, selección y scroll según decisiones UX.
- [ ] Gestionar foco al cambiar ruta, abrir/cerrar overlays y mostrar errores.
- [ ] Evitar que una respuesta antigua reemplace una búsqueda nueva.

**Aceptación:** una acción rápida o un retorno no deja la UI en un estado incoherente.

## F06.4 — comprobar por rol y dispositivo

- [ ] Ejecutar el piloto con roles de lectura y escritura pertinentes.
- [ ] Probar móvil, escritorio, texto largo y teclado.
- [ ] Medir carga/interacción básica antes de añadir movimiento avanzado.
- [ ] Revisar captura completa y detalles de foco/error.

**Aceptación:** la mejora existe fuera de la ruta feliz y del escritorio del implementador.

## F06.5 — extraer aprendizaje

- [ ] Registrar qué decisiones del sistema funcionaron y cuáles no.
- [ ] Corregir tokens o contratos compartidos cuando la causa sea sistémica.
- [ ] Evitar parches locales de estilo para esconder un defecto compartido.
- [ ] Actualizar catálogo y preparar la matriz de transiciones.

**Gate:** una tarea completa y recuperable demuestra el sistema. **Recuperación:** volver al recorrido anterior mediante el mecanismo de migración previsto si falla una condición crítica; conservar datos y evidencia de causa. No propagar el piloto mientras esté roto.
