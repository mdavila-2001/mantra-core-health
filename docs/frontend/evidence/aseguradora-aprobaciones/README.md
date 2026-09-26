# Evidencia · Solicitudes de aprobación (aseguradora)

Registro de procesos · MÓDULO ASEGURADORA · «Recepción de solicitudes de
órdenes de Aprobación»: la aseguradora aprueba / no aprueba cada ítem, con la
cláusula del contrato en lo que no aprueba.

- **Rutas:** `/administration/insurance-approvals` (bandeja) y
  `/administration/insurance-approvals/:requestId` (detalle).
- **Rol:** cuenta `aseguradora@alovida.mock` (USER + tenant PAYER). El
  paciente no ve la sección.
- **Backend:** maqueta (`mockBackend: true`, `prior-authorization.handlers.ts`),
  con el mismo contrato y las mismas reglas que la API. El camino real
  HTTP → PostgreSQL está verificado en
  `mantra-core-health-api/test/integration/patient-coverage-copays.int-spec.ts`.

## Corrida (2026-09-26)

`playwright/carril-aseguradora-aprobaciones.spec.ts` contra `ng serve` con
Chromium 1194: **8/8 en verde**.

- **Filtro:** pendientes → respondidas, y el filtro viaja en la URL.
- **Mutación:**
  1. Se marcan dos ítems como «No aprobar»; el modal no confirma sin cláusula.
  2. «Aprobar los que faltan» completa el resto.
  3. Se envía la respuesta.
  4. El almacén de la maqueta la persiste como PARTIAL, con las dos cláusulas.
  5. Después de recargar, la ficha muestra Aprobado ×3 y No aprobado ×2 con sus
     cláusulas, sin acciones.
  6. La bandeja queda con 2 pendientes.
- **Cinco viewports** (390, 768, 1024, 1440 y 1920): sin desborde horizontal
  del documento, y la tarjeta está centrada (holgura ≤ 2 px) y ocupa ≥ 85 % del
  área (§5). El modal «No aprobar» queda dentro del viewport.
- **Consola:** sin errores propios de estas pantallas. Se filtra el aviso de
  CSP por los scripts en línea de `ng serve`, que aparece en todas las
  pantallas del servidor de desarrollo.

Unitarias: bandeja, detalle, cliente y handler de la maqueta en verde. En la
suite completa (`yarn test`) no aparece ningún fallo atribuible a este cambio:
las diferencias contra la base son archivos que pasan por separado, así que
dependen del orden de ejecución.

Revisión adversarial (`frontend-reviewer`): 2 HIGH, 3 MEDIUM y 4 LOW, todos
corregidos:
- el 422 relee el detalle;
- el enlace S3 usa `queryParams`;
- el filtro cancela la lectura anterior;
- el 403 del detalle muestra S6;
- se agregó el spec de la bandeja;
- el foco vuelve al título después de enviar;
- la carga sigue a `:requestId`;
- la maqueta valida la decisión y los largos;
- el nombre del spec «sin pisar» ahora corresponde a lo que prueba.
