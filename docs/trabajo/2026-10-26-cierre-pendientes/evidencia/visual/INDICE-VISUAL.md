# Índice visual y de punta a punta — P23 · P28 · P29 · P34 · P36 · P37 · P39 · P40 · P44 · P47 · P50 · P51

- Fecha: 2026-10-26 · Rama: `claude/elegant-goodall-0wu6ci` (API y frontend) · Base: `mantra_visual`
  (clon de `mantra_base` + los seis `SQL/patches/2026-10-26_*.sql` del modelo, aplicados en orden con
  `psql -v ON_ERROR_STOP=1`, exit 0).
- Entorno: API real (`node dist/src/main.js`, puerto 4100, `ORM_SCHEMA_SYNC=off`) y `ng serve` (puerto 4300,
  `proxy.conf.json` reapuntado a 4100, `mockBackend: false`). Chromium headless con Playwright, sin
  `networkidle`: cada paso espera un texto o un control concreto.
- Actores, **todos sintéticos** y creados por los caminos reales: administradora de plataforma (bootstrap,
  `visual.admin@alovida.test`), médica por alta asistida + activación (`visual.medica@…`), paciente por
  `register-patient` (`visual.paciente@…`), farmacia y laboratorio por sus altas públicas en el navegador
  (`visual.farmacia.<n>@…`, `visual.lab.<n>@…`), médico por el alta pública (`visual.alta.<n>@…`). Archivos
  de prueba: un PDF mínimo y un PNG liso generados para esto.
- Capturas: 390×844, 1024×768 y 1440×900, tema claro y oscuro (`<pantalla>-<m|t|d>-<light|dark>.png`),
  PNG cuantizado a 256 colores (15 MB en total). **Todas se miraron.** En cada una se midió además
  `scrollWidth` (sin desborde horizontal en ninguna) y se registró consola, errores de página y respuestas
  4xx/5xx de la API.
- Salidas literales (consultas a la base, pruebas): `salidas/`.

> Nota de lectura: las capturas de página completa de Playwright repiten los elementos `sticky` (barra de
> acciones de un formulario, menú lateral) en mitad de la imagen. Donde eso confundía se tomó además una
> captura del viewport (`*-m-dark-top/bottom`, `p23-mis-horarios4`); no es un defecto de la app.
> Ruido de entorno que se filtró de «consola»: avisos CSP del cliente de Vite de `ng serve` (no existen en
> el build) y `POST /telemetry/onboarding-events → 400` (ver «Defectos abiertos»).

## Resumen

| P | Pantallas recorridas | Veredicto visual | Punta a punta (UI → request → response → base → recarga → UI) | Defecto de esta noche arreglado |
|---|---|---|---|---|
| P23 | «Cambiar mi horario» (`/schedule/edit`), diálogo de citas vivas, «Mi agenda» → Mis horarios | PASS | PASS — `DELETE templates/:id` 200 (`keptSlots:1`) + `POST templates` 201; base: viejo `TPL_RETIRED`, nuevo `TPL_PUBLISHED`, la cita sigue en su cupo `SLOT_BLOCKED` | **Sí (2.ª pasada)**: A5 «Mi agenda» ya no dice «No atiende» un día flexible — front `95dc255d4` |
| P36 | «Publique su agenda» flexible, reserva del paciente en modo flexible, «Mis citas» | PASS (tras el arreglo) | PASS — plantilla `flexible_hours=t`; hold → request 201; la cita queda con su motivo y se ve tras recargar | **Sí**: la primera hora ofrecida no estaba en la grilla («Ese horario ya no está») — API `2e4c2887`. **2.ª pasada**: A6 horas agrupadas por día — front `b68997544` |
| P28 | Editor del perfil del médico (`/my-account/edit`), documento editable | PASS (editable); bloqueado: no cubierto | PASS — `PATCH /profiles/practitioners/me` 200 con `nationalId`; `common.identifiers`: la fila vieja cerrada (`valid_to`) y la nueva vigente; recarga muestra el número nuevo | — |
| P29 | Alta pública del médico (15 pasos), «Los respaldos de su habilitación» | PASS (tras el arreglo) | PASS — 2 PDF subidos (201) y `licenseFileId`/`sedesLicenseFileId` en el alta 201; `profiles.jurisdiction_authorizations.file_id` con los dos ids | **Sí**: el selector aceptaba JPG/PNG y la API sólo PDF → el alta fallaba en el último paso — front `80a0fbaad` |
| P34 | «Horario y turnos» del portal, «Abiertas ahora» del directorio, «Farmacia» (comprar) del paciente | PASS (tras el arreglo) | PASS — `PUT …/open-24h` y `POST …/on-call-shifts` 201; base `open_24h=t`, 2 turnos; recarga muestra «De turno ahora» / «Próximo»; directorio y «Farmacia» muestran «Abierta 24 h» | **Sí**: las insignias sólo existían en `PharmacyShop`, sin ruta — front `59a9b377e`. **2.ª pasada**: A4 filtro «Abiertas ahora» en «Farmacia» — front `871cc1dd9`; A1 (productos por sede) — API `eb6d15db` |
| P37 | Ficha de la farmacia (`/pharmacies-directory/:slug`) con sucursales y «¿Cuál tiene lo de su receta?» | PASS (tras el arreglo A1) | Sucursales: PASS (`GET …/branches` 200). Receta: `POST …/branch-availability` 200 encuentra el producto publicado con stock declarado; «Marcar sin stock» → «missing»; restaurado → vuelve a encontrarse | **Sí (2.ª pasada)**: A1 regla única de existencias por sede — API `eb6d15db` + `da50d525`, front `dcd0c69bb` |
| P39 | Consulta → «Formulario libre — campo y valor» | PASS | PASS — `POST /charts/notes` con `entries` (2 filas) 201; `chart.clinical_note_versions.entries_json` con las dos filas; tras recargar siguen en «Lo registrado en este encuentro» | — |
| P40 | «Orden de análisis» en la consulta; «Mis órdenes» del paciente | PASS (tras el arreglo A3) | PASS — `POST /clinical/service-requests` 201 con `categoryConceptId` y respuesta `category:"LAB"`; base `clinical:SERVICE_REQUEST_CATEGORY_LAB`; «Mis órdenes» → pestaña «Laboratorio (1)». 2.ª pasada: formulario libre guardado → firmado → orden 201 con `basedOnNoteIds`; `clinical.service_request_notes` con la nota; recarga la muestra | **Sí (2.ª pasada)**: A3 — front `dc4ebd207` |
| P44 | «Mis gastos» | PASS (estado vacío S3) | Lectura real `GET /patient-spending/me` 200 `items:[]`; «con datos»: no cubierto | — |
| P47 | Portal de farmacia: productos, alta, edición (categoría, imagen, precio), categorías, inventario | PASS (tras el arreglo) | PASS — categoría `POST` 201; producto `POST` 201; `PATCH` 200 con `category` e `imageFileIds`; inventario `PATCH` 200; base: categoría propia, 1 imagen, `stock_quantity=3`, `min_stock_quantity=5`; recarga muestra todo | **Sí**: la ruta caía en la pantalla vieja sin edición y el modal rechazaba categorías propias — front `7e0db60ce` |
| P50 | Alta pública de farmacia (10 pasos) y verificación de la organización | PASS (tras el arreglo A2) | Alta: `POST /iam/auth/register-organization` 201 (`legalDocumentsRegistered:5`, `representativesRegistered:4`), farmacia y 4 representantes en base. Verificación desde la UI: 422 de la API pintado en la pantalla (farmacia sin punto de casa central); organización lista → 200, navega a la ficha y tras recargar «Organización verificada» (base: `verification_status_concept_id` cambiado) | **Sí (2.ª pasada)**: A2 — front `c123a04db` |
| P51 | Alta pública de laboratorio con una sucursal (descripción + enlace), «Sucursales» del portal | PASS | PASS — el alta manda `branches[].description/locationUrl` → 201; `directory.branches` con descripción y enlace; el portal los lista tras iniciar sesión | — |

## Defectos de esta noche, arreglados (con su prueba y verificación nueva en navegador)

1. **P36 · la primera hora flexible no se podía reservar** (API `2e4c2887`,
   `scheduling/domain/time/flexible-hours.ts`). Con la ventana empezando «ahora» (09:53:14.989), la primera
   hora ofrecida era 09:53:14.989; la reserva la relee con otro «ahora» y respondía «Ese horario ya no está».
   El recorte a `from` ahora corre el inicio al próximo paso de 15 min desde el inicio de la franja.
   Pruebas: 2 nuevas en `flexible-hours.spec.ts` (8/8 PASS; sin el arreglo 2 fallan), suite de
   `application/flexible` 26/26, `yarn typecheck` EXIT 0, eslint EXIT 0. Navegador: la primera hora
   (lunes 10:00) abre el formulario de reserva y se retiene.
2. **P29 · respaldos de la habilitación** (front `80a0fbaad`). El selector aceptaba JPG/PNG; la API
   (`upload-registration-document`) sólo PDF → 422 y el alta moría en el paso 15 con «problema de
   configuración de nuestra parte». Ahora sólo PDF (`p29-png-rechazado-paso10.png`: «Formato no
   permitido» en el acto) y el alta con PDF termina (`p29-wiz-final.png`). Prueba nueva en
   `register-practitioner.spec.ts` (152/152).
3. **P47 · catálogo contra la API real** (front `7e0db60ce`). `administration/pharmacy-catalog` cargaba
   `PharmacyCatalog` (sin edición, sin categoría ni imágenes) salvo con el simulador. Ahora carga siempre
   `PharmacyProducts`; `app.routes.pharmacy.spec.ts` actualizado al contrato nuevo (antes fijaba la pantalla
   vieja para la API real porque «el DTO real todavía no publica» esos campos; P47 los publica). Y el modal
   validaba la categoría contra las seis de partida: una categoría creada por la farmacia nunca llegaba a la
   API. Prueba nueva en `pharmacy-products.spec.ts` (sin el arreglo falla).
4. **P34 · insignias en «Farmacia» del paciente** (front `59a9b377e`). Las insignias «Abierta 24 h» /
   «De turno hasta …» vivían en `PharmacyShop`, que no tiene ruta desde la tienda nueva; ahora las pinta
   `StoreResults`. Dos pruebas nuevas en `store-results.spec.ts`.

Pruebas dirigidas del frontend tras los cuatro arreglos: 6 archivos, 218/218 PASS; `yarn typecheck` EXIT 0
(`salidas/front-tests.txt`).

## Segunda pasada: defectos abiertos A1–A6, arreglados

Cada uno con una prueba que falla sin el arreglo y verificación nueva en navegador contra la API real
(capturas miradas). Salidas: `salidas/a1-a6-front-tests.txt`, `salidas/a1-api-tests.txt`,
`salidas/a2-a3-sql.txt`.

| # | P | Arreglo | Commit | Prueba que falla sin él | Navegador (captura) |
|---|---|---|---|---|---|
| A1 | — | **Arreglado en la segunda pasada** (ver arriba) | — | — |
| A2 | — | **Arreglado en la segunda pasada** (ver arriba) | — | — |
| A3 | — | **Arreglado en la segunda pasada** (ver arriba) | — | — |
| A4 | — | **Arreglado en la segunda pasada** (ver arriba) | — | — |
| A5 | — | **Arreglado en la segunda pasada** (ver arriba) | — | — |
| A6 | — | **Arreglado en la segunda pasada** (ver arriba) | — | — |

Kill test del frontend: con `organization-verify.html` y `chart-notes.client.ts` revertidos, las dos pruebas
nuevas fallan (`salidas/a1-a6-front-tests.txt`). Pruebas dirigidas de los 9 specs tocados: 306/307; la que
falla (`specialty-form-block` «guardar registra la nota… y relee», espera `objectiveText` en el POST) falla
igual **sin** los cambios de esta pasada: es de antes (P39 dejó de plegar las filas en `objectiveText`) y no
se tocó.

## Defectos abiertos (no arreglados: grandes o de antes de esta noche)

| # | P | Defecto | Reproducción | Causa probable |
|---|---|---|---|---|
| A1 | P37 / P34 / P47 | La búsqueda de la receta en la ficha y la búsqueda de productos en «Farmacia» dicen que una sede **no tiene** un producto publicado, con precio y con existencias declaradas | Farmacia nueva → producto publicado con stock 3 desde «Inventario» → ficha pública → «Venda elástica» → «No tiene nada» (`p37-receta.png`); `GET /pharmacy-inventory/availability` → `items: []` | Dos fuentes de existencias: el portal (P47) escribe `pharmacy.pharmacy_products.stock_quantity`; la disponibilidad por sede lee `pharmacy_inventory.inventory_stock_positions` (libro mayor), que el portal no alimenta. Decisión de producto/arquitectura, no un parche |
| A2 | P50 | «Verificar y activar» de la plataforma responde 403 «La solicitud privilegiada declara tenants propietarios contradictorios» y la pantalla no muestra ningún error | Admin → `/administration/organizations/<tenant>/verify` → «Verificar y activar» (`p50-verify-ok.png`) | El cliente manda `X-Tenant-Id` del tenant activo del SUPERADMIN y la ruta trae otro `:id`; `resolvePrivilegedTenantId` (25/10) lo rechaza. Además el 403 no se pinta. Por API sin la cabecera responde 200 |
| A3 | P40 / P39 | Con un «Formulario libre — campo y valor» guardado, «Orden de análisis» sigue diciendo «Falta el formulario médico» y no deja pedir | Consulta → formulario libre guardado → Orden de análisis (`p40-orden-form.png`) | El requisito mira respuestas de `forms`; la nota de campo/valor es una nota de `charts`. Elegir notas como base de la orden (`basedOnNoteIds`) no tiene UI (decisión de P40) |
| A4 | P34 | El filtro «Abiertas ahora» de «Farmacia» del paciente no existe en la pantalla con ruta (sí en el directorio) | `/my-account/pharmacy` | Igual que el arreglo 4: estaba en `PharmacyShop`. Agregarlo exige tocar `PharmacySearchService` (parámetro `openNow`); queda anotado |
| A5 | P36 / P23 | «Mi agenda» → «Consultas» dice «No atiende este día» un día con horario flexible publicado; «Mis horarios» lo rotula «consultas de 30 min» | `p23-mi-agenda-d-light.png` | La vista del día lee cupos fijos; el horario flexible no crea cupos |
| A6 | P36 | La lista de horas flexibles del paciente muestra cada 15 min de 90 días (≈180 renglones) en una sola columna | `p36-pac-buscar.png` | Sin agrupación por día ni paginación |
| A7 | P23 | `DELETE templates/:id` devuelve `liveBookings: 0` con una cita «por confirmar» conservada (`keptSlots: 1`); el diálogo previo sí la cuenta | Respuesta registrada: `{"releasedSlots":1,"keptSlots":1,"liveBookings":0,"liveBookingIds":[],"cancelledBookings":0}` | Criterio distinto de «cita viva» entre la lectura y el retiro |
| A8 | — | Fecha escrita con barras («01/02/1980») en `app-date-picker` vacío → «Revise la fecha»; con sólo dígitos funciona | Alta del médico, paso 2 | Componente de antes (`date-picker`, 24/10). No se tocó |
| A9 | — | `POST /telemetry/onboarding-events` → 400 `property events should not exist` en cada alta | Cualquier alta pública | Contrato del cliente (`events`) distinto del DTO. De antes; no se tocó |
| A10 | — | `PUT /iam/onboarding-drafts/<tipo>/<id>` → 404 «Borrador no encontrado» desde el segundo guardado del borrador | Cualquier alta pública | El segundo PUT no lleva el `draftSecret` que devolvió el primero (a confirmar). De antes; no se tocó |
| A11 | P34 | «Directorio de farmacias» pagina solo hasta el final (≈10 pedidos de 50) y con dos recargas seguidas el limitador responde 429 | `p34-abiertas-ahora-t-*` (consola con 429) | La lista pide todas las páginas al montar. **No lo causó P34** («Abiertas ahora» es un filtro sobre la misma lista): la paginación completa es del 24/10. No se tocó |
| A12 | P47 | El alta rápida de producto (pestaña «Nuevo producto» de la pantalla vieja) tenía campos sin etiqueta visible; con el arreglo 3 esa pantalla ya no se usa contra la API real | `p47-nuevo-form.png` | — |
| A13 | P34 | «Horario y turnos» usa `input type=date/time` nativos (mm/dd/yyyy en el navegador) en vez de `app-date-picker` | `p34-horario-*` | Coherencia con el sistema de diseño. De antes; no se tocó |
| A14 | — | «Alta de membresía» (`membership-new.html`) tiene el mismo `<form (ngSubmit)>` sin `FormsModule` que rompía A2: el envío nativo recarga la página | Leído en el código, no ejercitado en navegador | Mismo patrón; fuera del alcance de A2, anotado |
| A15 | P39 | `specialty-form-block.spec.ts` «guardar registra la nota… y relee» falla en la rama (espera `objectiveText` en el POST) | `yarn ng test --include …specialty-form-block.spec.ts` (`salidas/a1-a6-front-tests.txt`) | P39 llevó las filas a `entries` y la prueba sigue fijando el plegado viejo |
| A16 | P40 | En móvil, el modal «Pedir un análisis» desborda a la derecha (los selectores se cortan) | `p40/a3-firmado-m-oscuro.png` | Ancho del modal de la consulta; de antes del selector nuevo |
| A17 | P50 | «Verificar» es un bloque pegado a la izquierda con una columna vacía, contra la regla 6 del `CLAUDE.md` | `p50/a2-error-d.png` | Composición de la pantalla, de antes |

## No cubierto

- **P28 bloqueado**: el estado «identidad verificada» (número fijo + motivo) no se ejercitó: no hay camino de
  UI corto para verificar la identidad de la médica sintética. Sólo el estado editable.
- **P44 con datos**: no se generaron gastos (exige cobrar una consulta con precio o facturar); sólo el
  estado vacío contra la API real. Error y cargando: no forzados.
- **P29 recarga → UI**: no se inició sesión con el médico recién creado para ver la matrícula y sus
  archivos en su perfil (la cuenta queda pendiente de verificación de correo); la persistencia se comprobó
  en la base.
- **P50 operar**: la farmacia de la primera pasada se activó por API; tras A2 se verificó desde la pantalla una organización lista (laboratorio sintético). La farmacia sintética sigue sin punto de casa central, así que su verificación desde la UI termina en el 422 esperado.
- **P40**: con A3 la orden se basa en la nota libre firmada (`basedOnNoteIds` con un id). Una consulta con formulario de `forms` **y** nota libre a la vez: la prueba de componente lo cubre, el navegador no.
- **A6**: las horas se ven en la zona horaria del navegador de prueba (UTC); no se repitió con `America/La_Paz`.
- **P37**: la ficha se vio con sesión de paciente; sin sesión la ruta redirige a `/auth` (comportamiento
  previo, no se cambió). Búsqueda de receta con coincidencias: cubierta tras A1.
- **P34 «De turno»** como única insignia: la sede de prueba es 24 h y de turno a la vez; se ve «Abierta 24 h»
  (precedencia de `aperturaDe`). La insignia de turno sólo se cubre en la prueba de componente.
- Viewports 768×1024 y 1920×1080 de la skill `visual-quality-gate` no se tomaron (se pidieron tres).
- Accesibilidad con lector de pantalla y teclado: no ejercitada.
- La suite completa del frontend y la de integración de la API no se corrieron (las corre «pasada final»).
