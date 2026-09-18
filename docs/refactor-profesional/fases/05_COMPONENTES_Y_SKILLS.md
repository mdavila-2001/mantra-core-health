# Fase 05 — componentes completos y conocimiento reutilizable

> Construir los componentes que necesita el piloto. Probarlos dentro de pantallas reales antes de ampliar el catálogo.

**Objetivo:** convertir dirección y contratos en elementos reutilizables. **Arquitectura:** composición atómica, con organismos específicos dentro de features cuando corresponda. **Stack:** biblioteca UI existente si sirve. **Spec:** [especificación objetivo](../ESPECIFICACION_OBJETIVO.md).

## Entradas y salidas

Consumir tokens y contratos. Actualizar archivos reales de componentes; crear catálogo de estados y documentación de uso. Revisar [componentes](../especificaciones/04_ATOMIC_DESIGN_Y_SOLID.md), [estados](../especificaciones/06_ESTADOS_Y_CONTRATOS_DE_INTERACCION.md) e [instalación de skills](../prompts/INSTALAR_SKILLS.md).

## F05.1 — seleccionar el conjunto mínimo

- [ ] Enumerar componentes requeridos por el piloto y consumidores actuales.
- [ ] Reutilizar primitivos accesibles existentes antes de desarrollar equivalentes.
- [ ] Clasificar responsabilidad: átomo, molécula, organismo, plantilla o específico de feature.
- [ ] Definir API pequeña y variantes válidas; evitar flags incompatibles.

**Aceptación:** cada nuevo componente tiene propósito y consumidor, o protege una consistencia compartida concreta.

## F05.2 — implementar estados

- [ ] Resolver normal, hover pertinente, pressed, focus-visible, ocupado, deshabilitado y error según componente.
- [ ] Definir contenido corto/largo, icono opcional y texto ausente permitido o prohibido.
- [ ] Comprobar semántica, teclado y asociación de etiquetas/errores.
- [ ] Mantener estilos y lógica de negocio separados según contratos.

**Aceptación:** una variante no pierde accesibilidad ni cambia silenciosamente el significado del control.

## F05.3 — montar catálogo verificable

- [ ] Usar Storybook, una ruta de desarrollo o el sistema existente; no introducir una herramienta pesada si no aporta.
- [ ] Mostrar variantes aplicables y contenidos extremos con datos controlados.
- [ ] Adjuntar pruebas de comportamiento que cubran riesgos reales.
- [ ] Revisar cómo se componen en la pantalla patrón.

**Aceptación:** el catálogo no muestra estados imposibles que la implementación real nunca puede producir; los estados críticos están conectados a comportamiento.

## F05.4 — adaptar las skills portables

- [ ] Elegir las skills del paquete pertinentes, sin cargarlas todas para cada tarea.
- [ ] Mantener referencias autocontenidas al copiarlas al directorio del agente.
- [ ] Registrar conocimiento específico del producto en sus documentos; evitar convertir una preferencia local en regla universal.
- [ ] Si se crea una skill nueva, definir disparador, exclusiones, contrato de salida, referencias y escenarios de evaluación.

**Aceptación:** skills válidas y utilizables por ruta; instalación local verificable cuando se solicite. No confundir entrega de archivos con instalación global.

## F05.5 — retirar duplicados del piloto

- [ ] Migrar sus consumidores al componente consolidado.
- [ ] Comparar comportamiento, estilo y accesibilidad antes/después.
- [ ] Eliminar código muerto solo cuando no tenga referencias reales.
- [ ] Registrar excepciones temporales y su condición de retirada.

**Gate:** piloto dispone de componentes completos y documentación útil. **Recuperación:** mantener un adaptador transitorio acotado si la API compartida afecta consumidores no migrados; no forzar cambios masivos sin sus pruebas. Retirar la compatibilidad cuando termine su función.
