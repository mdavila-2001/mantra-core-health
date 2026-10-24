# Centro de datos · gobierno y acceso · evidencia de navegador

Rol de todas las capturas: administración (SUPERADMIN y SECURITY_ADMIN), contra la API real. Tema claro. Cada captura es el viewport indicado, sin fullPage; el desbordamiento horizontal se midió sobre el documento y sobre `main`. Las que terminan en `-tabla` son la misma pantalla con la tabla desplazada a la vista (en 390, 768 y 1024 queda debajo del pliegue). Las de la carpeta superior (1440x900) son las de `playwright/data-center-governance.spec.ts`.

Asignar y revocar se probó sobre un usuario sintético dado de alta para la prueba, nunca sobre una cuenta existente; todo lo asignado quedó revocado.

## Capturas

| captura | viewport | rol | ruta | overflowX | errores |
|---|---|---|---|---|---|
| viewports/auditoria--390x844.png | 390x844 | administración | /superadmin/portal/gobierno/auditoria | no | ninguno |
| viewports/auditoria-tabla--390x844.png | 390x844 | administración | /superadmin/portal/gobierno/auditoria | no | ninguno |
| viewports/auditoria-accesos--390x844.png | 390x844 | administración | /superadmin/portal/gobierno/auditoria?view=data-access | no | ninguno |
| viewports/auditoria-accesos-tabla--390x844.png | 390x844 | administración | /superadmin/portal/gobierno/auditoria?view=data-access | no | ninguno |
| viewports/usuarios--390x844.png | 390x844 | administración | /superadmin/portal/gobierno/usuarios | no | ninguno |
| viewports/usuarios-tabla--390x844.png | 390x844 | administración | /superadmin/portal/gobierno/usuarios | no | ninguno |
| viewports/usuarios-persona--390x844.png | 390x844 | administración | /superadmin/portal/gobierno/usuarios?user=<usuario sintético> | no | ninguno |
| viewports/usuarios-persona-tabla--390x844.png | 390x844 | administración | /superadmin/portal/gobierno/usuarios?user=<usuario sintético> | no | ninguno |
| viewports/usuarios-permisos-rol--390x844.png | 390x844 | administración | /superadmin/portal/gobierno/usuarios?view=role-permissions&role=<GOVERNANCE_ADMIN> | no | ninguno |
| viewports/usuarios-permisos-rol-tabla--390x844.png | 390x844 | administración | /superadmin/portal/gobierno/usuarios?view=role-permissions&role=<GOVERNANCE_ADMIN> | no | ninguno |
| viewports/usuarios-catalogo-permisos--390x844.png | 390x844 | administración | /superadmin/portal/gobierno/usuarios?view=permissions | no | ninguno |
| viewports/usuarios-catalogo-permisos-tabla--390x844.png | 390x844 | administración | /superadmin/portal/gobierno/usuarios?view=permissions | no | ninguno |
| viewports/deriva-permisos--390x844.png | 390x844 | administración | /superadmin/portal/gobierno/deriva-permisos | no | ninguno |
| viewports/deriva-permisos-tabla--390x844.png | 390x844 | administración | /superadmin/portal/gobierno/deriva-permisos | no | ninguno |
| viewports/deriva-permisos-rutas--390x844.png | 390x844 | administración | /superadmin/portal/gobierno/deriva-permisos?view=without-roles | no | ninguno |
| viewports/deriva-permisos-rutas-tabla--390x844.png | 390x844 | administración | /superadmin/portal/gobierno/deriva-permisos?view=without-roles | no | ninguno |
| viewports/auditoria--768x1024.png | 768x1024 | administración | /superadmin/portal/gobierno/auditoria | no | ninguno |
| viewports/auditoria-tabla--768x1024.png | 768x1024 | administración | /superadmin/portal/gobierno/auditoria | no | ninguno |
| viewports/auditoria-accesos--768x1024.png | 768x1024 | administración | /superadmin/portal/gobierno/auditoria?view=data-access | no | ninguno |
| viewports/auditoria-accesos-tabla--768x1024.png | 768x1024 | administración | /superadmin/portal/gobierno/auditoria?view=data-access | no | ninguno |
| viewports/usuarios--768x1024.png | 768x1024 | administración | /superadmin/portal/gobierno/usuarios | no | ninguno |
| viewports/usuarios-tabla--768x1024.png | 768x1024 | administración | /superadmin/portal/gobierno/usuarios | no | ninguno |
| viewports/usuarios-persona--768x1024.png | 768x1024 | administración | /superadmin/portal/gobierno/usuarios?user=<usuario sintético> | no | ninguno |
| viewports/usuarios-persona-tabla--768x1024.png | 768x1024 | administración | /superadmin/portal/gobierno/usuarios?user=<usuario sintético> | no | ninguno |
| viewports/usuarios-permisos-rol--768x1024.png | 768x1024 | administración | /superadmin/portal/gobierno/usuarios?view=role-permissions&role=<GOVERNANCE_ADMIN> | no | ninguno |
| viewports/usuarios-permisos-rol-tabla--768x1024.png | 768x1024 | administración | /superadmin/portal/gobierno/usuarios?view=role-permissions&role=<GOVERNANCE_ADMIN> | no | ninguno |
| viewports/usuarios-catalogo-permisos--768x1024.png | 768x1024 | administración | /superadmin/portal/gobierno/usuarios?view=permissions | no | ninguno |
| viewports/usuarios-catalogo-permisos-tabla--768x1024.png | 768x1024 | administración | /superadmin/portal/gobierno/usuarios?view=permissions | no | ninguno |
| viewports/deriva-permisos--768x1024.png | 768x1024 | administración | /superadmin/portal/gobierno/deriva-permisos | no | ninguno |
| viewports/deriva-permisos-tabla--768x1024.png | 768x1024 | administración | /superadmin/portal/gobierno/deriva-permisos | no | ninguno |
| viewports/deriva-permisos-rutas--768x1024.png | 768x1024 | administración | /superadmin/portal/gobierno/deriva-permisos?view=without-roles | no | ninguno |
| viewports/deriva-permisos-rutas-tabla--768x1024.png | 768x1024 | administración | /superadmin/portal/gobierno/deriva-permisos?view=without-roles | no | ninguno |
| viewports/auditoria--1024x768.png | 1024x768 | administración | /superadmin/portal/gobierno/auditoria | no | ninguno |
| viewports/auditoria-tabla--1024x768.png | 1024x768 | administración | /superadmin/portal/gobierno/auditoria | no | ninguno |
| viewports/auditoria-accesos--1024x768.png | 1024x768 | administración | /superadmin/portal/gobierno/auditoria?view=data-access | no | ninguno |
| viewports/auditoria-accesos-tabla--1024x768.png | 1024x768 | administración | /superadmin/portal/gobierno/auditoria?view=data-access | no | ninguno |
| viewports/usuarios--1024x768.png | 1024x768 | administración | /superadmin/portal/gobierno/usuarios | no | ninguno |
| viewports/usuarios-tabla--1024x768.png | 1024x768 | administración | /superadmin/portal/gobierno/usuarios | no | ninguno |
| viewports/usuarios-persona--1024x768.png | 1024x768 | administración | /superadmin/portal/gobierno/usuarios?user=<usuario sintético> | no | ninguno |
| viewports/usuarios-persona-tabla--1024x768.png | 1024x768 | administración | /superadmin/portal/gobierno/usuarios?user=<usuario sintético> | no | ninguno |
| viewports/usuarios-permisos-rol--1024x768.png | 1024x768 | administración | /superadmin/portal/gobierno/usuarios?view=role-permissions&role=<GOVERNANCE_ADMIN> | no | ninguno |
| viewports/usuarios-permisos-rol-tabla--1024x768.png | 1024x768 | administración | /superadmin/portal/gobierno/usuarios?view=role-permissions&role=<GOVERNANCE_ADMIN> | no | ninguno |
| viewports/usuarios-catalogo-permisos--1024x768.png | 1024x768 | administración | /superadmin/portal/gobierno/usuarios?view=permissions | no | ninguno |
| viewports/usuarios-catalogo-permisos-tabla--1024x768.png | 1024x768 | administración | /superadmin/portal/gobierno/usuarios?view=permissions | no | ninguno |
| viewports/deriva-permisos--1024x768.png | 1024x768 | administración | /superadmin/portal/gobierno/deriva-permisos | no | ninguno |
| viewports/deriva-permisos-tabla--1024x768.png | 1024x768 | administración | /superadmin/portal/gobierno/deriva-permisos | no | ninguno |
| viewports/deriva-permisos-rutas--1024x768.png | 1024x768 | administración | /superadmin/portal/gobierno/deriva-permisos?view=without-roles | no | ninguno |
| viewports/deriva-permisos-rutas-tabla--1024x768.png | 1024x768 | administración | /superadmin/portal/gobierno/deriva-permisos?view=without-roles | no | ninguno |
| viewports/auditoria--1440x900.png | 1440x900 | administración | /superadmin/portal/gobierno/auditoria | no | ninguno |
| viewports/auditoria-accesos--1440x900.png | 1440x900 | administración | /superadmin/portal/gobierno/auditoria?view=data-access | no | ninguno |
| viewports/usuarios--1440x900.png | 1440x900 | administración | /superadmin/portal/gobierno/usuarios | no | ninguno |
| viewports/usuarios-persona--1440x900.png | 1440x900 | administración | /superadmin/portal/gobierno/usuarios?user=<usuario sintético> | no | ninguno |
| viewports/usuarios-permisos-rol--1440x900.png | 1440x900 | administración | /superadmin/portal/gobierno/usuarios?view=role-permissions&role=<GOVERNANCE_ADMIN> | no | ninguno |
| viewports/usuarios-catalogo-permisos--1440x900.png | 1440x900 | administración | /superadmin/portal/gobierno/usuarios?view=permissions | no | ninguno |
| viewports/deriva-permisos--1440x900.png | 1440x900 | administración | /superadmin/portal/gobierno/deriva-permisos | no | ninguno |
| viewports/deriva-permisos-rutas--1440x900.png | 1440x900 | administración | /superadmin/portal/gobierno/deriva-permisos?view=without-roles | no | ninguno |
| viewports/auditoria--1920x1080.png | 1920x1080 | administración | /superadmin/portal/gobierno/auditoria | no | ninguno |
| viewports/auditoria-accesos--1920x1080.png | 1920x1080 | administración | /superadmin/portal/gobierno/auditoria?view=data-access | no | ninguno |
| viewports/usuarios--1920x1080.png | 1920x1080 | administración | /superadmin/portal/gobierno/usuarios | no | ninguno |
| viewports/usuarios-persona--1920x1080.png | 1920x1080 | administración | /superadmin/portal/gobierno/usuarios?user=<usuario sintético> | no | ninguno |
| viewports/usuarios-permisos-rol--1920x1080.png | 1920x1080 | administración | /superadmin/portal/gobierno/usuarios?view=role-permissions&role=<GOVERNANCE_ADMIN> | no | ninguno |
| viewports/usuarios-catalogo-permisos--1920x1080.png | 1920x1080 | administración | /superadmin/portal/gobierno/usuarios?view=permissions | no | ninguno |
| viewports/deriva-permisos--1920x1080.png | 1920x1080 | administración | /superadmin/portal/gobierno/deriva-permisos | no | ninguno |
| viewports/deriva-permisos-rutas--1920x1080.png | 1920x1080 | administración | /superadmin/portal/gobierno/deriva-permisos?view=without-roles | no | ninguno |
| viewports/usuarios-asignar-rechazo--1440x900.png | 1440x900 | administración | /superadmin/portal/gobierno/usuarios?user=<usuario sintético> · diálogo «Asignar un rol» | no | 422 esperado (rol global con organización) |
| viewports/usuarios-asignado--1440x900.png | 1440x900 | administración | /superadmin/portal/gobierno/usuarios?user=<usuario sintético> | no | ninguno |
| viewports/usuarios-revocar-confirmacion--1440x900.png | 1440x900 | administración | /superadmin/portal/gobierno/usuarios?user=<usuario sintético> · confirmación | no | ninguno |
| viewports/usuarios-revocado--1440x900.png | 1440x900 | administración | /superadmin/portal/gobierno/usuarios?user=<usuario sintético> · tras recargar | no | ninguno |
| viewports/usuarios-asignar-rechazo--390x844.png | 390x844 | administración | /superadmin/portal/gobierno/usuarios?user=<usuario sintético> · diálogo «Asignar un rol» | no | 422 esperado (rol global con organización) |
| viewports/usuarios-asignado--390x844.png | 390x844 | administración | /superadmin/portal/gobierno/usuarios?user=<usuario sintético> | no | ninguno |
| viewports/usuarios-revocar-confirmacion--390x844.png | 390x844 | administración | /superadmin/portal/gobierno/usuarios?user=<usuario sintético> · confirmación | no | ninguno |
| viewports/usuarios-revocado--390x844.png | 390x844 | administración | /superadmin/portal/gobierno/usuarios?user=<usuario sintético> · tras recargar | no | ninguno |

## Recorrido de la mutación (UI → petición → respuesta → API → recarga → UI)

| paso | petición | respuesta | comprobado en la API | tras recargar |
|---|---|---|---|---|
| asignar GOVERNANCE_ADMIN con la organización de la sesión | POST /authz/users/:userId/role-assignments | 422 · `reason` ROLE_ASSIGNMENT_GLOBAL_ROLE_WITH_SCOPE | 0 asignaciones activas | — |
| asignar en toda la plataforma | POST /authz/users/:userId/role-assignments | 201 | 1 activa, `appliesGlobally: true` | — |
| revocar (con confirmación) | DELETE /authz/users/:userId/role-assignments/:assignmentId | 200 | 0 activas | la asignación se ve «Revocada» |

## Denegación

Médico y paciente (dados de alta para la prueba) escriben a mano las tres direcciones del grupo y vuelven al panel; `GET /audit/log` con su propio token responde 403 (`playwright/data-center-governance.spec.ts`, última prueba).

## Mensajes de consola

En todas las pasadas: `Transition was aborted because of invalid state` (transición de vista interrumpida por navegar seguido; no es de estas pantallas) y el 422 esperado del paso de rechazo.
