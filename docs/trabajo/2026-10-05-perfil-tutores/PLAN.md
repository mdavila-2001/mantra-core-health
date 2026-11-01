# Plan — Perfil: tutores, dependientes y contactos de emergencia

- Fecha: 2026-10-05
- Rama: `codex/perfil-tutores-mockup` (base: `origin/mockup`)
- Predecesor: contrato de perfil propio del backend en esta misma entrega

## Resultado

Actor: paciente.

Dónde: ficha `/my-account`, pestañas Contacto y Tutores, y bandeja de solicitudes de Dependientes.

Estado inicial: puede tener contactos de emergencia, solicitudes pendientes o representantes activos.

Acción: consulta su perfil o acepta una solicitud indicando quién es la persona para él/ella.

Observable: Contacto lista exclusivamente contactos de emergencia; Tutores aparece solo con representaciones aceptadas y vigentes, y cada fila dice nombre, teléfono y relación; Dependientes sigue listando solo a quienes la cuenta representa.

Persistencia: tras aceptar y recargar, la ficha muestra al tutor devuelto por la API. Una solicitud pendiente o un contacto de emergencia aislado no habilitan la pestaña Tutores.

Fuera: no se duplican reglas de autorización en el navegador ni se modifican rutas clínicas.

Kill-test: cargar un perfil con `emergencyContacts` y `guardians: []` no muestra la pestaña Tutores.

## Alcance

- IN: tipos y cliente del perfil, vista de perfil, aceptación de solicitud con relación, pruebas y evidencia visual.
- OUT: creación de dependientes, permisos, estilos globales y cambios de backend no necesarios para el consumo.
- Ambigüedad: el usuario puede no definir la relación en un cliente anterior; la vista muestra el rótulo de respaldo entregado por la API.

## H1 — Ficha sin mezcla de conceptos

**CA:** Dado un contacto de emergencia sin tutor, cuando el paciente abre Contacto, entonces ve el contacto allí y no existe la pestaña Tutores.

**DoD:** spec de ficha pasa y navegador confirma la ruta en viewports requeridos.

## H2 — Tutor visible solo por representación aceptada

**CA:** Dado un perfil con tutor activo, cuando abre Tutores, entonces ve nombre, teléfono y relación; no ve contactos de emergencia ni seguros.

**DoD:** spec de ficha pasa y la captura/documentación de evidencia no presenta errores de consola ni solicitudes fallidas.

## H3 — Aceptación con relación

**CA:** Dada una solicitud entrante, cuando el paciente selecciona la relación y acepta, entonces el navegador envía `relationshipConceptId` con la aceptación y retira la solicitud al responder 200.

**DoD:** spec de Dependents pasa.

## Riesgos y mitigación

| Riesgo | Mitigación |
|---|---|
| Índices de pestañas desfasados cuando Tutores no existe | Resolver la pestaña solicitada por clave después de recibir el perfil. |
| Mostrar UUID o etiqueta técnica | Consumir `relationshipDisplay` resuelto por el backend. |
| Que el navegador autorice por apariencia | La UI solo ofrece acciones; la API mantiene la autorización. |
