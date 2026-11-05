# Integración clara: deshacer, corregir y el resultado por sede (31/10/2026)

Capturas de la rama `itzan/far-c8-erp-integration-dev`, servida con `ng serve` (configuración `real-api`)
contra la API local con los cambios de la misma tarea, y el simulador del sistema de la farmacia. Cuenta
de Farmacia Chavez (`admin.farmacia-chavez@alovida.test`), conexión «Sucursal Centro (simulada)». Ventana
fija (1440×900 y 390×844), sin `fullPage`. Esto es evidencia, no aprobación: la revisión visual la hace
otra persona.

Los datos se escribieron de verdad (`POST`, `PATCH`, `DELETE` y `sync` contra la API). Al terminar, la
conexión quedó como estaba al empezar: un solo vínculo, `ERP-0003` → `AMOX-500`.

## Recorrido, en orden

| Paso | Captura | Petición y respuesta | Qué se ve después (releído de la API) |
|---|---|---|---|
| Vincular `ERP-0001` con Paracetamol | `link-dialog-1440-light.jpg` | `POST …/product-mappings` 201 | La unidad llega precargada con `BOX`, la del catálogo del sistema |
| Sincronizar | `sync-after-link-1440-light.jpg` | `POST …/sync` 200 | 12 recibidas = 2 vinculadas + 10 sin vínculo; una fila por sede; aplicadas 1 |
| Corregir la unidad a `TAB` | `correct-dialog-1440-light.jpg` | `PATCH …/product-mappings/:id` 200 con `{ externalUnitCode: "TAB" }` | La tabla muestra `TAB` |
| Sincronizar otra vez | `sync-unit-mismatch-1440-light.jpg` | `POST …/sync` 200 | «1 línea vinculada no se aplicó … Unidad del vínculo TAB / del sistema BOX» |
| Corregir hacia un producto que otro acaba de vincular | `correct-409-1440-light.jpg` | `PATCH` 409 `EXTERNAL_MAPPING_PRODUCT_TAKEN` | El aviso en castellano y «Corregir ese vínculo», que abre el modal con `ERP-0002` |
| Deshacer `ERP-0002` | `undo-confirm-1440-light.jpg`, `after-undo-1440-light.jpg`, `sync-after-undo-1440-light.jpg` | `DELETE …/product-mappings/:id` 200 | Confirmación destructiva; la fila desaparece |
| Código ambiguo (`ERP-0003` vinculado a dos productos) | `ambiguous-*.jpg`, `links-*.jpg`, `sync-unmapped-1440-light.jpg` | — | Aviso «Códigos ambiguos» con sus productos y «Deshacer»; badge «Ambiguo» en la tabla; en el resultado, «Ambiguo · 2 productos» frente a «Sin vincular» con «Vincular» |
| Deshacer el vínculo que sobra | `undo-ambiguous-confirm-1440-light.jpg`, `after-undo-ambiguous-1440-light.jpg`, `sync-after-undo-ambiguous-1440-light.jpg` | `DELETE` 200, `sync` 200 | El aviso desaparece; `ERP-0003` vuelve a contar como vinculado |
| Deshacer `ERP-0001`, a 390 en oscuro | `undo-confirm-390-dark.jpg`, `after-undo-390-dark.jpg`, `sync-after-undo-390-dark.jpg` | `DELETE` 200, `sync` 200 | Estado inicial |

`integration-*.jpg` y `sync-result-*.jpg` son la pestaña y el resultado de sincronizar en los cuatro
cortes (1440 y 390, claro y oscuro), con el código ambiguo presente.

## Lo que no se vio en vivo

- **Varias sedes.** La conexión del simulador es de una sola sede: la tabla por sede tiene una fila. La
  suma con dos sedes y las líneas por sede las cubren las pruebas (`integration-sync.spec.ts`).
- **«El sistema ya no lo manda»** (`notSent`): el simulador manda siempre los doce códigos. Cubierto por
  pruebas.
- **`SITE_MARKED_NOT_AVAILABLE`** y los demás motivos que no son de unidad: cubiertos por pruebas
  (`sync-skip-message.spec.ts`).
- **Un 404 al corregir o deshacer** (otro lo deshizo antes): cubierto por pruebas.
