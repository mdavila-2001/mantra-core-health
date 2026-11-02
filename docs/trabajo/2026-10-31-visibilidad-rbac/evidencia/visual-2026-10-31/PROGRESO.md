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
| roles | antes: roles/antes-{1440,390}-claro.png | después: roles/despues-con-rol-{390,768,1440}-{claro,oscuro}-ok(.png,-vista.png), despues-sin-rol-{1440,390}-claro-ok.png, despues-{1440,390}-claro-{vacio,error,carga}.png | commit 378fdd99 | specs permisos 48/48; scrollWidth = viewport en todas; abiertos: pestañas renombradas a «Por acción / Historial» después de las capturas (texto), acciones Descartar/Guardar visibles también en error |
| field-permissions | antes: field-permissions/antes-{1440,390}-claro.png | después: field-permissions/despues-{390,768,1440}-{claro,oscuro}-ok(.png,-vista.png), despues-1440-claro-{vacio,error,carga}.png, despues-sin-rol-*, tab-recurso/ | commit 63127095 | specs permisos 48/48 (antes del cambio de rótulos de pestaña); scrollWidth = viewport; abiertos: ninguno visto en capturas |
| catalog-fit | antes: catalog-fit/antes-1440-claro.png, antes-390-claro.png | después: catalog-fit/despues-{390,768,1440}-{claro,oscuro}-ok(.png/-vista.png), despues-1440-claro-{error,carga,hallazgos,detalle(-vista)}.png, despues-390-claro-hallazgos(-vista).png | commit 2722c50e | abiertos: vacío S3 no forzable desde la maqueta (el informe siempre existe); 768-oscuro muestra el rótulo previo «Puntos ciegos» (renombrado a «Sin medir» después); en 390 la pestaña Hallazgos mide 3890 px (14 filas apiladas por la tabla compartida) |
| who-can | antes: who-can/antes-{1440,390}-claro.png | después: who-can/despues-{390,768,1440}-{claro,oscuro}-ok(.png,-vista.png), tab-quien/despues-{1440,390}-claro-ok.png | commit 73a13b21 | specs permisos+matriz 78/78; scrollWidth = viewport; abiertos: estados vacío/error/carga NO capturados (el simulador es formulario y la tabla usa un paginador sin señal forzable); la captura «sin permiso» falló por caída de ng serve |
| runtime-pieces | antes: runtime-pieces/antes-1440-claro.png, antes-390-claro.png | después: runtime-pieces/despues-{390,768,1440}-{claro,oscuro}-ok(.png/-vista.png), despues-1440-claro-{error,carga,vacio,hallazgos}.png, despues-390-claro-instancias(-vista).png | commit 0a68a3bb | abiertos: 390 mide 3012 px con 18 piezas (paginado de 25 lo fija la API); el estado vacío por filtro usa el título genérico «Todavía no hay nada acá» del view-state-host compartido |
| access-reviews | antes: access-reviews/antes-{1440,390}-claro.png | después: access-reviews/despues-{390,768,1440}-{claro,oscuro}-ok(.png,-vista.png), tab-revision/despues-{1440,390}-claro-ok.png | commit e88c4b14 | specs permisos+matriz 78/78; scrollWidth = viewport; abiertos: estados vacío/error/carga NO capturados (tablas con paginador sin señal forzable desde el navegador; cubiertos por specs) |

## Pantallas de visibilidad y mutabilidad (agente PANTALLAS-VIS)

| Pantalla | antes | después | commit | defectos abiertos |
|---|---|---|---|---|
| mutabilidad | mutabilidad/antes-{1440,390}-claro.png | mutabilidad/despues-{390,768,1440}-{claro,oscuro}-datos.png, -vista, -tablas(-vista), -evidencia, 1440-claro-{vacio,error,carga}.png, 1440-oscuro-tablas.png | 56bd67f2 | 390 resumen 2286 px y tablas 2046 px (antes 3586/3909); carga = esqueleto genérico de view-state-host; sin eyebrow/icono en la cabecera (page-header es del MARCO) |
| catalogo-visibilidad | catalogo-visibilidad/antes-{1440,390}-claro.png | catalogo-visibilidad/despues-{390,768,1440}-{claro,oscuro}-datos.png, -vista, -agregar, 1440-claro-{vacio,error,carga}.png | 69656668 | 390 = 2035 px (antes 5482; incluye ~100 px del hueco de la barra inferior); «Ver los N restantes» sólo en <780 px; fila de módulos desplazable si hay muchos |
| reglas-visibilidad | reglas-visibilidad/antes-{1440,390}-claro.png | reglas-visibilidad/despues-{390,768,1440}-{claro,oscuro}-datos.png, -vista, -nueva, 1440-claro-{vacio,error,carga}.png | 5a1a088f | KPIs calculados del índice del catálogo al abrir (no se recalculan tras terminar/editar sin recargar) |
| ver-como | ver-como/antes-{1440,390}-claro.png | ver-como/despues-{390,768,1440}-{claro,oscuro}-datos.png, -vista, -rol, 1440-claro-{error,carga}.png | ebf5f30f | el mock de /authz/roles no trae PHARMACY_STAFF: el selector lo agrega «(no figura entre los roles asignables)» y la cifra muestra el código (dato de core/mock, no de la pantalla) |
| runtime-pieces (2.ª pasada: filtros y aviso) | antes: runtime-pieces/antes-1440-claro.png | después: runtime-pieces/despues-{390,768,1440}-{claro,oscuro}-ok.png, despues-1440-claro-vacio.png | commit c2ef8ae6 | abiertos: ninguno nuevo |
| dq-issues | antes: dq-issues/antes-1440-claro.png, antes-390-claro.png | después: dq-issues/despues-{390,768,1440}-{claro,oscuro}-ok(.png/-vista.png), despues-1440-claro-{error,carga,vacio,todas}.png | commit f419de52 | abiertos: sin KPIs (la API no da conteos; la prueba exige una sola petición); tabla apilada en 390 con rótulo/valor de la tabla compartida |
| dq-rules | antes: dq-rules/antes-1440-claro.png, antes-390-claro.png | después: dq-rules/despues-{390,768,1440}-{claro,oscuro}-ok(.png/-vista.png), despues-1440-claro-{error,carga,vacio}.png | commit 0fd993fc | abiertos: una sola vista, tarjeta sin pestañas (no hay vistas hermanas dentro de la pantalla); ficha de regla sólo perdió las migas, no se recapturó |
| privacy | antes: privacy/antes-1440-claro.png, antes-390-claro.png | después: privacy/despues-{390,768,1440}-{claro,oscuro}-ok(.png/-vista.png), despues-1440-claro-{error,carga}.png | commit 97ce401f | abiertos: sin captura de vacío (la maqueta siempre trae solicitudes y el único filtro es de tipo); pestañas con carrusel en 390; ficha sólo perdió las migas, no se recapturó |
| policies | antes: policies/antes-1440-claro.png, antes-390-claro.png | después: policies/despues-{390,768,1440}-{claro,oscuro}-ok(.png/-vista.png), despues-1440-claro-{error,carga,vacio,retencion}.png | commit 47b3fa18 | abiertos: pestañas con carrusel en 390; ficha sólo perdió las migas, no se recapturó |
| pii | antes: pii/antes-1440-claro.png, antes-390-claro.png (desbordaba a 560 px) | después: pii/despues-{390,768,1440}-{claro,oscuro}-ok(.png/-vista.png), despues-1440-claro-{error,carga,vacio,columnas,conciliacion}.png, despues-390-claro-columnas(-vista).png | commit a0e3837d | abiertos: «No medido (unapprovedColumns)» conserva el código técnico porque una prueba lo exige literal |
| rbac-matrix (rev. 1) | — | después: rbac-matrix/despues-390-{claro,oscuro}-ok(-vista).png | commit 29ea8d14 | KPIs de a uno <560 px; specs 78/78 |
| roles (rev. 1) | — | después: roles/despues-con-rol-{1440,390}-claro-ok.png, despues-1440-claro-error.png | commit 0c3133d4 | KPIs sobre la tarjeta; selector sólo con nombre; acciones ocultas sin catálogo |
| field-permissions (rev. 1) | — | después: field-permissions/despues-390-claro-ok-vista.png | commit 457ed42d | celdas en un bloque; alineación final depende de la tabla apilada de PRIMITIVAS |
| who-can (rev. 1) | — | después: who-can/tab-quien/despues-1440-claro-{vacio,error,carga}.png | commit b76f157f | estados forzados reemplazando el cliente en el navegador |
| access-reviews (rev. 1) | — | después: access-reviews/despues-1440-claro-{ok,vacio,error,carga}.png | commit 3ff7aab4 | columna «Acción · Ver estado →»; el error forzado muestra «sin-id» porque el error simulado no trae ID |
| revisión visual 1 — mis 7 pantallas | antes: los de cada carpeta | después (verificación, 1440 y 390 claro): catalog-fit, runtime-pieces, dq-issues, dq-rules (+ despues-ficha-*), privacy (+ despues-1440-claro-vacio, despues-ficha-*), policies (+ despues-ficha-*), pii (+ despues-1440-claro-conciliacion) | commits 3b047430 06fe4a5d ac3fa577 6036c646 bdcb5bdf d5b4fd5e a907e82b | abiertos: sin recapturar tras los últimos ajustes porque ng serve cayó (catalog-fit a 390: veredicto/antigüedad/versión a lo ancho y 5 comprobaciones por tanda; políticas: espacio entre fecha y hora); las cifras de dq-issues/dq-rules/privacy sólo aparecen con la lista completa en una página |
