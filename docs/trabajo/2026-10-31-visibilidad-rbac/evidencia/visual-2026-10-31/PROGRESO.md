# Progreso visual — 31/10/2026 (agente MARCO)

| Hora | Pantalla / pieza | Captura | Estado |
|---|---|---|---|
| T0 | marco antes (doble menú + hueco 136 px) | marco/antes-1440-claro.png, marco/antes-390-claro.png | medido: lateral global 240 px + lateral portal 238 px; contenido empezaba en y=192 con header en 56; 390 px con desborde horizontal (scrollWidth 447) |
| T1 | rbac-matrix: aviso de límites plegado | commit ba4e155b | hecho (rbac-matrix-page.ts/.css) |
| T2 | marco: portal fuera del armazón global (ruta de primer nivel, mismas guardas) + PortalShell único estilo Atlas | (en curso) | compilando; ng serve se cae por OOM del cgroup compartido (14,3 GB) durante recompilaciones — reiniciado con heap 4500 y sin HMR |
| rbac-matrix | antes: rbac-matrix/antes-{1440,390}-claro.png | después: rbac-matrix/despues-{390,768,1440}-{claro,oscuro}-ok(.png,-vista.png), despues-1440-claro-{vacio,error,carga}.png, tab-gaps/, tab-coverage/, vista-rol/ | commit e36d99dd | specs 30/30; scrollWidth 390 = 390; abiertos: KPIs apretados a 390 (dos columnas con loseta de icono), sublista lateral ilegible en oscuro (MARCO), cabecera sin eyebrow/icono (page-header es del MARCO) |
| T3 | marco: PortalShell único (lateral 268 px fija con tokens `--nav-*` fijos en los dos temas, topbar 64 px con migas+ambiente+buscador+campana+tema+cuenta, pestañas entre hermanas, explicador plegado, barra inferior + «Más» en <1024) | marco/despues2-1440-claro.png, marco/despues2-1440-oscuro.png, marco/despues2-390-claro.png, marco/despues2-390-oscuro.png (+ `-completa`) | medido en Auditoría: sin `.app-side-nav` ni `.app-header`; lateral 268×900, barra 64, h1 a y=162; 390 sin desborde (sw 390); contraste mínimo de textos de la lateral 13,99:1 contra #072F45 en claro y oscuro |
| T3 | migas duplicadas en pantallas reutilizadas | — | corregido en `page-header` con el token `PAGE_HEADER_MIGAS_EN_EL_MARCO` que PortalShell provee; falta repetir el barrido (el servidor se cayó por OOM a mitad) |
| T3 | inputs de fecha «mm/dd/yyyy» | — | `src/index.html` YA tiene `lang="es"`; el formato del input nativo lo pone la configuración regional del navegador (Chromium headless = en-US), no el `lang`. Las capturas nuevas usan `locale: 'es-PE'`. No es defecto del código. |
| T3 | pestaña «Huecos (13)» con icono apilado a 390 | — | NO es del marco: es `app-tabs` (shared/molecules) o el panel de rbac-matrix; queda anotado para el agente de pantallas |
| T3 | infraestructura | — | ng serve + ng test no caben juntos en el cgroup (14,3 GB): ng test llegó a 7 GB y ng serve a 4,4–6 GB; los OOM matan uno u otro. Mientras corre un ng test el servidor puede caerse. |

## Barrido del marco — todas las rutas del portal, 1440×900, tema claro (tras commit 0c3868ea)

Medido con Playwright: migas propias dentro del lienzo (debe ser 0), cantidad de h1 (debe ser 1), cabeceras `app-page-header` (1), desborde horizontal (scrollWidth = 1440), errores de consola.

| Ruta | Captura | migas en página | h1 | cabeceras | scrollWidth | errores consola | Estado |
|---|---|---|---|---|---|---|---|
| systems/operations | marco/barrido/systems_operations-1440-claro.png | 0 | 1 | 1 | 1440 | 0 | OK |
| systems/flows | marco/barrido/systems_flows-1440-claro.png | 0 | 1 | 1 | 1440 | 0 | OK |
| systems/flows/diagram | marco/barrido/systems_flows_diagram-1440-claro.png | 0 | 1 | 1 | 1440 | 0 | OK |
| systems/drift | marco/barrido/systems_drift-1440-claro.png | 0 | 1 | 1 | 1440 | 0 | OK |
| systems/review | marco/barrido/systems_review-1440-claro.png | 0 | 1 | 1 | 1440 | 0 | OK |
| systems/runtime-pieces | marco/barrido/systems_runtime-pieces-1440-claro.png | 0 | 1 | 1 | 1440 | 0 | OK |
| processes | marco/barrido/processes-1440-claro.png | 0 | 1 | 1 | 1440 | 0 | OK |
| catalog/tables | marco/barrido/catalog_tables-1440-claro.png | 0 | 1 | 1 | 1440 | 0 | OK |
| catalog/domains | marco/barrido/catalog_domains-1440-claro.png | 0 | 1 | 1 | 1440 | 0 | OK |
| catalog/fit | marco/barrido/catalog_fit-1440-claro.png | 0 | 1 | 1 | 1440 | 0 | OK |
| lineage | marco/barrido/lineage-1440-claro.png | 0 | 1 | 1 | 1440 | 0 | OK |
| schemas | marco/barrido/schemas-1440-claro.png | 0 | 1 | 1 | 1440 | 0 | OK |
| governance/audit | marco/barrido/governance_audit-1440-claro.png | 0 | 1 | 1 | 1440 | 0 | OK |
| governance/users | marco/barrido/governance_users-1440-claro.png | 0 | 1 | 1 | 1440 | 0 | OK |
| governance/permission-drift | marco/barrido/governance_permission-drift-1440-claro.png | 0 | 1 | 1 | 1440 | 0 | OK |
| governance/roles | marco/barrido/governance_roles-1440-claro.png | 0 | 1 | 1 | 1440 | 0 | OK |
| governance/field-permissions | marco/barrido/governance_field-permissions-1440-claro.png | 0 | 1 | 1 | 1440 | 0 | OK |
| governance/who-can | marco/barrido/governance_who-can-1440-claro.png | 0 | 1 | 1 | 1440 | 0 | OK |
| governance/access-reviews | marco/barrido/governance_access-reviews-1440-claro.png | 0 | 1 | 1 | 1440 | 0 | OK |
| governance/rbac-matrix | marco/barrido/governance_rbac-matrix-1440-claro.png | 0 | 1 | 1 | 1440 | 0 | OK |
| governance/ui-catalog | marco/barrido/governance_ui-catalog-1440-claro.png | 0 | 1 | 1 | 1440 | 0 | OK |
| governance/ui-rules | marco/barrido/governance_ui-rules-1440-claro.png | 0 | 1 | 1 | 1440 | 0 | OK |
| governance/ui-preview | marco/barrido/governance_ui-preview-1440-claro.png | 0 | 1 | 1 | 1440 | 0 | OK |
| governance/mutability | marco/barrido/governance_mutability-1440-claro.png | 0 | 1 | 1 | 1440 | 0 | OK |
| governance/policies | marco/barrido/governance_policies-1440-claro.png | 0 | 1 | 1 | 1440 | 0 | OK |
| governance/pii | marco/barrido/governance_pii-1440-claro.png | 0 | 1 | 1 | 1440 | 0 | OK |
| governance/privacy-requests | marco/barrido/governance_privacy-requests-1440-claro.png | 0 | 1 | 1 | 1440 | 0 | OK |
| data-quality/issues | marco/barrido/data-quality_issues-1440-claro.png | 0 | 1 | 1 | 1440 | 0 | OK |
| data-quality/rules | marco/barrido/data-quality_rules-1440-claro.png | 0 | 1 | 1 | 1440 | 0 | OK |
| (centro) `/superadmin/portal` | — | — | — | — | — | — | NO barrido (la ruta vacía se cayó de la lista del guion) |

Pendientes vistos y NO del marco: fechas nativas «mm/dd/yyyy» (lo pone la configuración regional de Chromium headless; `index.html` ya declara `lang="es"`); icono apilado sobre el texto en la pestaña «Huecos (13)» a 390 (rbac-matrix / `app-tabs`).

Barra lateral: fondo continuo `--nav-carril` (también pintado en el contenedor para páginas largas); el cuerpo ya no reserva el relleno inferior de la maqueta bajo el portal.
