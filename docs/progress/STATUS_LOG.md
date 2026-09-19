
## 2026-09-14T14:05:47.440873+00:00 — Carril demo — discovery
- Estado: active
- QA: not-started
- worktree wt-demo-mockup listo; buscando la maqueta en memoria

## 2026-09-14T14:06:32.761071+00:00 — Carril demo — runtime
- Estado: active
- QA: not-started
- levantando ng serve de la maqueta y corriendo mock-backend.spec

## 2026-09-14T14:06:44.710859+00:00 — Carril demo — runtime
- Estado: active
- QA: ejecutando
- ng serve en background; corriendo mock-backend.spec

## 2026-09-14T14:07:12.100879+00:00 — Carril demo — runtime
- Estado: active
- QA: ejecutando
- mock-backend.spec 14/14 PASS; esperando ng serve

## 2026-09-14T14:08:25.144340+00:00 — Carril demo — fix
- Estado: active
- QA: ejecutando
- hallazgo: GET /pharma-labs/reference/concepts sin manejador; leyendo client + handler

## 2026-09-14T14:08:49.084611+00:00 — Carril demo — fix
- Estado: active
- QA: ejecutando
- bug: respuesta genérica {items} vs array esperado en PharmaLabConcepts; buscando claves

## 2026-09-14T14:09:03.704623+00:00 — Carril demo — fix
- Estado: active
- QA: ejecutando
- solo label() se usa; leyendo diccionario real del backend pharma_lab

## 2026-09-14T14:09:25.847029+00:00 — Carril demo — fix
- Estado: active
- QA: ejecutando
- vocabulario real PHL_* obtenido; escribiendo handler reference/concepts

## 2026-09-14T14:09:50.444703+00:00 — Carril demo — fix
- Estado: active
- QA: ejecutando
- escribiendo GET /pharma-labs/reference/concepts en pharma-lab.handlers.ts

## 2026-09-14T14:10:00.941737+00:00 — Carril demo — fix
- Estado: active
- QA: ejecutando
- fix#1 WRITTEN; corriendo tsc + mock-backend.spec

## 2026-09-14T14:10:33.690723+00:00 — Carril demo — qa-barrido
- Estado: active
- QA: ejecutando
- fix#1 tsc OK + spec 14/14; lanzando barrido serial

## 2026-09-14T14:11:45.574694+00:00 — Carril demo — inventario
- Estado: active
- QA: PASS
- barrido 383/0/0 verificado (helpers honestos); inventariando mutaciones sin manejador

## 2026-09-14T14:12:08.317361+00:00 — Carril demo — inventario
- Estado: active
- QA: PASS
- inventario v1 con parser débil (133 falsos); refinando parser de literales

## 2026-09-14T14:12:22.897057+00:00 — Carril demo — inventario
- Estado: active
- QA: PASS
- 13 candidatas; verificando 7 reales contra handlers

## 2026-09-14T14:12:40.316168+00:00 — Carril demo — inventario
- Estado: active
- QA: PASS
- 3 desajustes reales: verification-types /me, PUT vs POST en payment-state y notes/versions

## 2026-09-14T14:13:00.366016+00:00 — Carril demo — inventario
- Estado: active
- QA: PASS
- confirmados 3 desajustes; leyendo contratos para corregirlos + revisando pharmacy-orders/public-catalog/terminology

## 2026-09-14T14:13:15.517896+00:00 — Carril demo — inventario
- Estado: active
- QA: PASS
- leyendo chart-notes client, consumidor de setPaymentState, casos de identidad

## 2026-09-14T14:13:25.175794+00:00 — Carril demo — inventario
- Estado: active
- QA: PASS
- último par de lecturas antes de escribir los 3 fixes

## 2026-09-14T14:13:58.195927+00:00 — Carril demo — fix
- Estado: active
- QA: ejecutando
- escribiendo fixes 2-4: PUT payment-state, PUT notes/versions, GET me/verification-types

## 2026-09-14T14:14:04.657355+00:00 — Carril demo — fix
- Estado: active
- QA: ejecutando
- fixes 2-4 WRITTEN; tsc + mock spec

## 2026-09-14T14:15:11.020483+00:00 — Carril demo — qa-flujos
- Estado: active
- QA: ejecutando
- login Médica OK; 2 errores CSP inline script en /auth — investigando

## 2026-09-14T14:15:36.061784+00:00 — Carril demo — qa-flujos
- Estado: active
- QA: ejecutando
- CSP bloquea event-replay de Angular (2 inline scripts); leyendo security-headers.ts

## 2026-09-14T14:15:54.598496+00:00 — Carril demo — qa-flujos
- Estado: active
- QA: ejecutando
- CSP: preexistente, solo ng serve; leyendo server.ts hashes; luego flujos

## 2026-09-14T14:18:02.672761+00:00 — Carril demo — qa-flujos
- Estado: active
- QA: FAIL
- BUG: date-picker corrompe tecleo (15/09/2026 → DD/15/0009); botón Agendar nunca se habilita

## 2026-09-14T14:18:56.743334+00:00 — Carril demo — qa-flujos
- Estado: active
- QA: FAIL
- leyendo date-picker + puedeGuardar + diálogo calendario

## 2026-09-14T14:19:55.918486+00:00 — Carril demo — qa-flujos
- Estado: active
- QA: FAIL
- cita por calendario OK; tecleo de fecha roto; verificando persistencia del mock entre recargas

## 2026-09-14T14:20:37.002797+00:00 — Carril demo — qa-flujos
- Estado: active
- QA: ejecutando
- cita directa: registro aparece en Próximos 7 días (PASS in-tab); revisando persistencia F5 y tecleo de fecha

## 2026-09-14T14:21:17.572961+00:00 — Carril demo — qa-flujos
- Estado: active
- QA: ejecutando
- 39 colecciones, solo 6 persisten; date-picker: clic al centro arranca en mes; listando colecciones y spec

## 2026-09-14T14:21:59.230093+00:00 — Carril demo — qa-flujos
- Estado: active
- QA: ejecutando
- date-picker: comportamiento por segmento es deliberado (spec), no bug; evaluando persistencia F5

## 2026-09-14T14:22:39.021534+00:00 — Carril demo — fix
- Estado: active
- QA: ejecutando
- diseño: Coleccion.persistirEn(clave) + llamadas al pie de fixtures/handlers para sobrevivir F5

## 2026-09-14T14:23:11.105780+00:00 — Carril demo — fix
- Estado: active
- QA: ejecutando
- escribiendo Coleccion.persistirEn + claves en 40 colecciones de negocio

## 2026-09-14T14:26:44.468508+00:00 — Carril demo — qa-clics
- Estado: active
- QA: ejecutando
- typecheck 0; barrido de clics cuenta Médica

## 2026-09-14T14:27:37.123815+00:00 — Carril demo — qa-clics
- Estado: active
- QA: ejecutando
- sweep v1: 44 clics/30 ok — medía pantallas sin pintar; corrigiendo espera y localizador por nombre accesible

## 2026-09-14T14:29:15.729087+00:00 — Carril demo — qa-clics
- Estado: active
- QA: ejecutando
- sweep v2: 138 clics/80 ok/58 desapareció (tabs); pulsar por índice relistado

## 2026-09-14T14:30:56.265299+00:00 — Carril demo — qa-clics
- Estado: active
- QA: ejecutando
- clics Médica 112 ok/0 fallos; corriendo Paciente + Visitador

## 2026-09-14T14:32:20.345871+00:00 — Carril demo — qa-clics
- Estado: active
- QA: ejecutando
- clics Paciente 42 ok, Visitador 46 ok, 0 fallos; corriendo Admin

## 2026-09-14T14:36:17.735646+00:00 — Carril demo — qa-flujos
- Estado: active
- QA: ejecutando
- Evoluciones es lectura; typecheck del sweep y recorrido de pestañas del expediente

## 2026-09-14T14:40:46.547622+00:00 — Carril demo — qa-flujos
- Estado: active
- QA: ejecutando
- expediente: alergia/plan/doc/diag OK; receta, observación y nota sospechosas — leyendo código

## 2026-09-14T14:42:00.243678+00:00 — Carril demo — qa-flujos
- Estado: active
- QA: ejecutando
- nota OK 3→4; receta y observación no habilitan — leyendo puedeRecetar/puedeRegistrar

## 2026-09-14T14:43:15.053809+00:00 — Carril demo — qa-flujos
- Estado: active
- QA: FAIL
- posible bug: Prescribir exige encounterId del host, ignora la cita elegida; Unidad/Registrar observación no se habilitan

## 2026-09-14T14:44:21.209216+00:00 — Carril demo — qa-flujos
- Estado: active
- QA: ejecutando
- chart pasa exigeEncuentro=false; Prescribir depende de elegir medicamento en buscador; leyendo app-input

## 2026-09-14T14:45:29.354479+00:00 — Carril demo — qa-flujos
- Estado: active
- QA: ejecutando
- chips de receta = casos demo que buscan en terminología; verificando catálogo del mock

## 2026-09-14T14:46:27.345494+00:00 — Carril demo — qa-flujos
- Estado: active
- QA: FAIL
- receta: chip llena campos pero Prescribir sigue off con diagnóstico; leyendo hayMotivo/organizacion

## 2026-09-14T14:48:05.214483+00:00 — Carril demo — qa-flujos
- Estado: active
- QA: ejecutando
- receta OK 3→4 (CDS + adjuntos); diagnosticando observación; preparando próximos flujos

## 2026-09-14T14:50:57.298555+00:00 — Carril demo — qa-flujos
- Estado: active
- QA: ejecutando
- visita OK; bloqueo/cotización/servicio campos conocidos; chat/pago/artículo: inspeccionando UI

## 2026-09-14T14:51:16.632895+00:00 — Carril demo — qa-flujos
- Estado: active
- QA: FAIL
- BUG: <img src=/public/media/id> → 500 (no pasa por el interceptor); buscando origen

## 2026-09-14T14:52:12.456539+00:00 — Carril demo — qa-flujos
- Estado: active
- QA: ejecutando
- artículo OK; img rota: photoFileId→/public/media; pago por botón directo; chat estructura

## 2026-09-14T14:53:23.986107+00:00 — Carril demo — qa-flujos
- Estado: active
- QA: ejecutando
- chat por link; pago con hover; img rota: revisando proxy y server.ts

## 2026-09-14T14:54:33.284470+00:00 — Carril demo — qa-flujos
- Estado: active
- QA: ejecutando
- chat OK; pago: leyendo ítems del menú de estado de pago

## 2026-09-14T14:57:40.026497+00:00 — Carril demo — qa-flujos
- Estado: active
- QA: ejecutando
- img rota = avatar autor en artículos; viendo tipo OwnPublicProfile

## 2026-09-14T14:59:06.845303+00:00 — Carril demo — qa-flujos
- Estado: active
- QA: ejecutando
- Médica 15 flujos OK; Paciente: buscando cómo se reserva un cupo

## 2026-09-14T14:59:29.815237+00:00 — Carril demo — qa-flujos
- Estado: active
- QA: FAIL
- BUG: ficha pública dice 'Todavía no publicó horarios' con 41 cupos en el mock

## 2026-09-14T15:00:17.041887+00:00 — Carril demo — qa-flujos
- Estado: active
- QA: FAIL
- disponibilidad: listResources({tenantId}) + listSlots; comparando con handlers del mock

## 2026-09-14T15:00:36.975691+00:00 — Carril demo — qa-flujos
- Estado: active
- QA: FAIL
- disponibilidad: verificando resourceRefId vs id de ruta y TABLAS_DE_PERFIL_PROFESIONAL

## 2026-09-14T15:01:03.800943+00:00 — Carril demo — fix
- Estado: active
- QA: FAIL
- causa: mock emite resourceRefType='PRACTITIONER', la app espera nombres de tabla; parcheando fixture

## 2026-09-14T15:01:32.957132+00:00 — Carril demo — fix
- Estado: active
- QA: FAIL
- parcheando resourceRefType→health_practitioner_profiles en fixture + handler

## 2026-09-14T15:03:07.544810+00:00 — Carril demo — qa-flujos
- Estado: active
- QA: ejecutando
- fix resourceRefType verificado: 24 cupos visibles al paciente; reservando

## 2026-09-14T15:05:40.060490+00:00 — Carril demo — qa-flujos
- Estado: active
- QA: FAIL
- UX: toasts 'Se liberó un horario' tapan Confirmar la reserva; leyendo cadencia de horario-liberado

## 2026-09-14T15:06:19.113555+00:00 — Carril demo — qa-flujos
- Estado: active
- QA: ejecutando
- reserva paciente OK; revisando cadencia de avisos horario-liberado; flujos pedido/perfil/identidad

## 2026-09-14T15:06:57.246544+00:00 — Carril demo — qa-flujos
- Estado: active
- QA: ejecutando
- toasts: diseño deliberado del mock (avisos que llegan) — se documenta; buscando entrada al pedido de farmacia

## 2026-09-14T15:08:04.497320+00:00 — Carril demo — qa-flujos
- Estado: active
- QA: ejecutando
- paciente: identidad (subida de archivo), perfil, pedido desde Recetas

## 2026-09-14T15:09:59.139508+00:00 — Carril demo — qa-flujos
- Estado: active
- QA: FAIL
- identidad: caso nuevo se ve 'Desconocido'; leyendo abrirCaso/casoPropio y mapa de estados

## 2026-09-14T15:11:26.310875+00:00 — Carril demo — qa-flujos
- Estado: active
- QA: FAIL
- pedido OK; perfil no persiste segundo nombre; identidad estado no traducido — leyendo handlers

## 2026-09-14T15:12:15.688293+00:00 — Carril demo — qa-flujos
- Estado: active
- QA: FAIL
- perfil: PATCH del mock ignora middleName; identidad: revisando case-status.ts; Admin: paciente/usuario/org

## 2026-09-14T15:13:11.082579+00:00 — Carril demo — fix
- Estado: active
- QA: FAIL
- fix: CASE_CHECKS_PENDING en case-status.ts; middleName en PATCH del mock

## 2026-09-14T15:15:32.326642+00:00 — Carril demo — qa-flujos
- Estado: active
- QA: ejecutando
- Admin: paciente OK, usuario OK; organización en paso 5 (Registrar organización)

## 2026-09-14T15:16:04.194166+00:00 — Carril demo — qa-flujos
- Estado: active
- QA: FAIL
- org creada OK; lista de organizaciones con nombre vacío y '—' — comparando contrato

## 2026-09-14T15:16:39.303175+00:00 — Carril demo — qa-flujos
- Estado: active
- QA: FAIL
- org nueva no aparece en lista; nombre/tipo vacíos — revisando fixture tenants y ruta POST

## 2026-09-14T15:17:21.067229+00:00 — Carril demo — qa-flujos
- Estado: active
- QA: FAIL
- org list: nombre vacío, tipo sin etiqueta, búsqueda ignorada, alta no listada — leyendo client y value sets

## 2026-09-14T15:18:17.733698+00:00 — Carril demo — qa-flujos
- Estado: active
- QA: ejecutando
- fixes paciente verificados en UI; diagnosticando lista de organizaciones (nombre, etiquetas, paginación, búsqueda)

## 2026-09-14T15:18:58.220869+00:00 — Carril demo — qa-flujos
- Estado: active
- QA: FAIL
- org list: celda usa legalName y llega vacío — buscando ruta real de searchTenants

## 2026-09-14T15:19:32.446236+00:00 — Carril demo — fix
- Estado: active
- QA: FAIL
- causa: GET /admin/tenants duplicado (auth vs directory); quitando el viejo + params q/status

## 2026-09-14T15:20:12.606721+00:00 — Carril demo — qa-flujos
- Estado: active
- QA: ejecutando
- tenants duplicado eliminado (tsc OK, spec 14/14); buscando pantalla de nueva solicitud de visita

## 2026-09-14T15:21:08.021783+00:00 — Carril demo — qa-regresion
- Estado: active
- QA: ejecutando
- visitador: sin pantalla de alta (por diseño); verificando org list en UI; lint

## 2026-09-14T15:21:42.777658+00:00 — Carril demo — qa-regresion
- Estado: active
- QA: ejecutando
- org list verificada en UI; corrigiendo 3 errores de lint

## 2026-09-14T15:21:51.531893+00:00 — Carril demo — qa-regresion
- Estado: active
- QA: ejecutando
- quitando import sin uso y relanzando lint

## 2026-09-14T15:22:15.998319+00:00 — Carril demo — qa-regresion
- Estado: active
- QA: ejecutando
- lint 0; typecheck final

## 2026-09-14T15:22:27.604141+00:00 — Carril demo — qa-regresion
- Estado: active
- QA: ejecutando
- typecheck 0; corriendo yarn test completo

## 2026-09-14T15:23:13.524177+00:00 — Carril demo — qa-regresion
- Estado: active
- QA: ejecutando
- yarn test 5863/5863; barrido de rutas final

## 2026-09-14T15:24:16.912640+00:00 — Carril demo — fix
- Estado: active
- QA: FAIL
- barrido final: 1 problema (img 500 en artículos); decidiendo fix

## 2026-09-14T15:24:45.922421+00:00 — Carril demo — fix
- Estado: active
- QA: FAIL
- fix img: servir /public/media/* con bypass del proxy (dev) y ruta Express (SSR)

## 2026-09-14T15:25:28.488692+00:00 — Carril demo — fix
- Estado: active
- QA: FAIL
- escribiendo mock-media.svg + proxy.conf.mjs + ruta SSR para /public/media

## 2026-09-14T15:25:43.231360+00:00 — Carril demo — fix
- Estado: active
- QA: FAIL
- reiniciando ng serve para tomar proxy.conf.mjs

## 2026-09-14T15:26:02.905839+00:00 — Carril demo — fix
- Estado: active
- QA: ejecutando
- ng serve relanzado; verificando /public/media/* → SVG

## 2026-09-14T15:26:36.562613+00:00 — Carril demo — fix
- Estado: active
- QA: FAIL
- bypass reescribe pero cae al index.html; probando rutas servibles

## 2026-09-14T15:27:05.912212+00:00 — Carril demo — fix
- Estado: active
- QA: FAIL
- bypass → 302 a /mock-media.svg; reiniciando ng serve

## 2026-09-14T15:27:24.536681+00:00 — Carril demo — fix
- Estado: active
- QA: ejecutando
- ng serve relanzado con bypass 302; verificando

## 2026-09-14T15:27:42.749513+00:00 — Carril demo — qa-regresion
- Estado: active
- QA: ejecutando
- img fix verificado (302→svg); lint + typecheck finales

## 2026-09-14T15:28:06.868448+00:00 — Carril demo — qa-regresion
- Estado: active
- QA: ejecutando
- lint/typecheck 0; barrido de rutas final

## 2026-09-14T15:28:33.007334+00:00 — Carril demo — qa-regresion
- Estado: active
- QA: ejecutando
- barrido rutas 383/0/0; barrido de clics final 4 cuentas

## 2026-09-14T15:34:01.817614+00:00 — Carril demo — cierre
- Estado: active
- QA: PASS
- clics 466/0, rutas 383/0, test 5863/5863, lint/typecheck 0; preparando commit único

## 2026-09-14T15:34:54.719767+00:00 — Carril demo — cierre
- Estado: active
- QA: PASS
- mensaje de commit listo; revisando los 2 commits nuevos del remoto

## 2026-09-14T15:35:09.164234+00:00 — Carril demo — cierre
- Estado: active
- QA: PASS
- upstream toca solo agenda; commit + rebase

## 2026-09-14T15:35:28.706547+00:00 — Carril demo — cierre
- Estado: active
- QA: ejecutando
- rebase OK; inventario post-rebase + typecheck

## 2026-09-14T15:35:48.045212+00:00 — Carril demo — cierre
- Estado: active
- QA: ejecutando
- post-rebase: inventario limpio, typecheck 0; specs mock + agenda

## 2026-09-14T15:36:13.677015+00:00 — Carril demo — cierre
- Estado: active
- QA: ejecutando
- specs 121/121; barrido de rutas sobre el árbol rebasado

## 2026-09-14T15:36:43.095377+00:00 — Carril demo — cierre
- Estado: active
- QA: PASS
- barrido post-rebase 383/0/0; push único a origin/mockup
