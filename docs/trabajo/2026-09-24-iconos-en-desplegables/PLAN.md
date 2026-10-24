# Plan — Ícono en toda opción de desplegable

- Fecha: 2026-09-24 · Repos afectados: mantra-core-health · Predecesor: C-06 (acciones de fila en desplegable)
- Resultado observable: en cualquier desplegable de acciones de la app, cada opción muestra un ícono descriptivo junto a su texto.
- Kill-test: abrir «Acciones» de una solicitud en la agenda y ver una opción sin ícono.

## Alcance
- IN: set `NavIconName` (íconos nuevos), `RowAction.icon` obligatorio, acciones de la agenda y de «Mi trayectoria» (sedes), menú de pago de la agenda, menú «Acciones» del expediente, menú de preferencias de publicación, menú de cuenta («Cerrar sesión»), menú «Más acciones» del encabezado de página (`PageHeaderAction.icon` obligatorio).
- IN (agregado en ejecución): menú de recetas (`svg` suelto sin tamaño → `app-nav-icon`), selector de organización, menús de muestra de la vitrina.
- OUT: el menú de escalones ocultos del breadcrumb (es navegación, no acciones); el resumen de cuenta deshabilitado del menú de cuenta (es un rótulo, no una opción); ninguno más.
- Ambigüedades registradas: el comentario de `RowAction` dice que ampliar el set es decisión de quien lo lleva. Supuesto: el pedido explícito del propietario (2026-09-24, «todos los desplegables tienen ícono») es esa decisión.

## H1 — Toda opción de desplegable lleva ícono
**CA:** Dado cualquier desplegable de acciones, cuando se abre, entonces cada opción muestra ícono + texto.
**DoD:** `yarn typecheck` exit 0 · `yarn lint` exit 0 · specs de row-actions, page-header, post-preferences, agenda en verde · captura del menú de la agenda.
**Estado:** A MEDIAS — falta la captura del menú real de la agenda (API caída)

### H1.S1 — Set de íconos y contratos
**CA:** El compilador rechaza un `RowAction`/`PageHeaderAction`/`PostPreferenceEntry` sin ícono.
**DoD:** `yarn typecheck` exit 0.
**Estado:** A MEDIAS (M5)

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H1.S1.M1 | Íconos nuevos en `nav-icon` | Cada nombre nuevo tiene su `@case` | `yarn typecheck` → exit 0 | HECHO |
| H1.S1.M2 | `icon` obligatorio en los tres contratos y en los menús | Plantillas dibujan el ícono siempre | `yarn typecheck` → exit 0 | HECHO |
| H1.S1.M3 | Íconos en menús de plantilla (pago, expediente, cuenta) | Cada `app-menu-item` tiene `slot=icon` | `grep` sin items sin ícono en alcance | HECHO |
| H1.S1.M4 | Tests y lint | Specs afectadas verdes | `yarn lint` y `ng test --include` → verdes | HECHO |
| H1.S1.M5 | Prueba visual | Menú de agenda con íconos en todas las opciones | captura en navegador | A MEDIAS |

## Riesgos y bloqueos previstos
| Riesgo | Impacto | Mitigación |
|---|---|---|
| Specs que arman acciones sin ícono | typecheck rojo | agregar el ícono en el dato de prueba |
