# Inventario CORR-33

Fecha: 2026-10-13 · rama `justin/mockup-corr-33-mis-organizaciones` · base `c36a0188f`

## Panel destino

- `features/admin/medical-organization/medical-organization.ts` declara el componente standalone y `medical-organization.html` declara siete `app-tab` en este orden: Sedes, Áreas, Infraestructura, Servicios, Plantilla, Legajo, Inventario.
- La pestaña nueva es la octava y última: `Tab` índice **7**, rótulo **Mis vinculaciones**. `linkedSignal` ya interpreta `?tab=memberships` y el spec del panel comprueba selección directa.
- El panel administra su ámbito con `MedicalOrganizationClient`; las vinculaciones del profesional deben seguir usando `PracticeSitesClient` para `GET /practitioners/me/role-assignments` y `POST /practices/:id/role-assignments/self-request`. El formulario usa `AccountingClient.listPractices()` para las opciones.
- El estado de tabla actual es `ViewState<readonly AssignmentRow[]>`: error no se convierte en vacío, reintento vuelve a consultar, y solicitud enviada relee vinculaciones.
- La pantalla vieja ya usa `app-data-table`, `app-badge`, `app-empty-state` y el formulario; se puede trasladar como hijo standalone conservando la lógica, estilos y tests.

## Desviaciones verificadas en la base

- `/my-organizations` ya está redirigida, pero a `/administration/medical-organization` sin `tab=memberships`; la matriz de evidencia lo marcaba como fallo de ruta. Cambiar el destino canónico para añadir `tab=memberships` y comprobarlo en evidencia.
- El componente todavía vive en `features/organizations/my-organizations.*` y se importa desde el panel. La ficha pide moverlo a `features/admin/medical-organization/memberships-tab/` y eliminar la pantalla vieja.
- `navigation.map.ts` conserva `my-organizations` en `PANTALLAS_DIFERIDAS` y `app.routes.ts` todavía registra ese loader aunque el router redirige antes. Eliminar esa entrada y quitar la ruta del árbol de accesos; conservar sólo la redirección con query.
- La pestaña existe y está probada en el panel (spec ya cubre acceso directo y evita la segunda petición a `/practices`). No hay indicio de que la pantalla necesite el cliente administrativo para las vinculaciones.
- `my-profile.html` documenta que el acceso al panel se ofrece en «Tus accesos»; revisar el perfil de profesional y su spec antes de tocar enlaces, para no recrear enlaces duplicados que la corrección anterior ya retiró.

## Estado de acceso y presentación

- «Organización médica» acepta `PRACTITIONER`, pero está fuera del menú de ese rol; acceso desde perfil y «Tus accesos» queda según la decisión de TAREA-33 §3.
- El modo simulador ya retorna filas y la tabla mantiene estados activo, pendiente, rechazado/finalizado, error, vacío y solicitud. Conservar estas ramas y sus aserciones durante el traslado.
- La matriz previa de CORR-33 midió ocho celdas. La ruta vieja falló porque no conservaba el query; el destino activo pasó en claro y falló el color oscuro por CORR-04. Rehacer la línea base después de que el auditor acepte el destino final esperado.
