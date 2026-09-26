# Hallazgos · agenda, social, directorios y operación — contrato front ↔ API

**Fecha:** 2026-09-24 · **Front:** `mantra-core-health` `origin/mockup` 9b3e0101 (y `origin/dev`) · **API:** `mantra-core-health-redesa-api` `dev` 7541797c (incluye PR #451 portal admin y #452).
**Método:** solo lectura de código; **no se ejecutó nada contra la API viva** — toda severidad «Bloqueante demo» vale para la demo contra la API real salvo que diga «en mockup». ValidationPipe global confirmado: `whitelist + forbidNonWhitelisted + transform + enableImplicitConversion` (`src/main.ts:159-164`) → campo de más en body = 400. Los controladores `/public/*` leen `@Query` sueltos: un query de más se ignora, no da 400.
**Fuera de alcance (solo anotado):** pasarela de pago (`/scheduling/bookings/:id/payment-state`, `estaPagado`/`pago` de pedidos) y delivery/envío a domicilio (modos `DOMICILIO`/`TRABAJO`, trips/pings/geocercas de `geo`).
**Fuente del modelo:** el DDL vigente está en `mantra-core-health-redesa-api/database/SQL/` + `mantra-core-health-model/`; el `SQL/` de la raíz del workspace es una foto vieja (ver AG-14). **Diferencias mockup vs dev en este dominio:** sólo `core/mock/fixtures/agenda.ts`, `core/messaging/chat.store.ts` (contador N-01) y navegación de `practitioners-directory` — ninguna cambia contratos.

## Duplicados consolidados
- **AG-16 ≡ AG-42** (P37 sucursales + receta entre sucursales): mismo trabajo, visto desde directorios públicos y desde farmacia.
- **AG-25 ≡ AG-41** (P34 farmacia 24 h / de turno).
- **AG-06 + AG-21**: la campana no sabe abrir los `destination.type` que la API emite (agenda: `scheduling.appointment_bookings`/`scheduling.bookable_slots`; `SERVICE_REQUEST`). Conviene resolverlo en un solo cambio de `notification-routes.ts`.
- **AG-13 condiciona AG-15** (P30 necesita descripción del servicio).

## Índice
| ID | Severidad | Tipo | Título |
|---|---|---|---|
| AG-01 | Alta | contrato-body + dato-inexistente-en-modelo | Cuando el profesional elige «Horario flexible», la plantilla se rechaza con 400 (P36 abierto) |
| AG-02 | Alta | autorización | El médico no puede registrar la llegada del paciente: check-in da 403 |
| AG-03 | Alta | autorización | La reserva de mostrador (`/schedule/book/:slotId`, entrada DESK) da 403 cuando la usa el médico |
| AG-04 | Bloqueante demo | ruta-faltante (del mock) | El mock no simula el alta de mostrador (walk-in): la demo de «paciente nuevo» devuelve un eco sin cita |
| AG-05 | Alta | contrato-respuesta / otro (regla de negocio divergente entre | Cambiar un horario con citas vivas sigue siendo imposible (P23 abierto), y el mock lo esconde |
| AG-06 | Alta | contrato-respuesta | Las notificaciones de agenda de la API no se pueden abrir desde la campana |
| AG-07 | Media | tiempo-real + dato-inexistente-en-modelo (regla del mock) | P21 (horario liberado): la API ya avisa, pero con otra regla que el mock |
| AG-08 | Media | contrato-body | Los ids de `close-slots` y `shift-slots` se validan como UUID v4: los cupos sembrados (uuid5) darían 400 |
| AG-09 | Media | dato-inexistente-en-modelo | El mock inventa reglas que la API no tiene (agenda) |
| AG-10 | Media | otro (el front no consume la API) | El paciente no puede reprogramar su propia cita aunque la API lo permite |
| AG-11 | Baja | otro | La API tiene operaciones de agenda que el front no consume |
| AG-12 | Baja | contrato-respuesta | `roleTitle` de las solicitudes de afiliación puede llegar `null` y el front lo tipa como `string` |
| AG-13 | Baja | contrato-body | «Mis servicios» y el catálogo no pueden cargar la descripción ni la imagen del servicio |
| AG-14 | Baja | otro | Fuente del modelo duplicada: el `SQL/` de la raíz ya no es la verdad |
| AG-15 | Alta | ruta-faltante | Las fichas de clínica y farmacia (P30/P31) no tienen su ruta en la API |
| AG-16 | Alta | ruta-faltante + dato-inexistente-en-modelo | Sucursales de cadena y receta entre sucursales (P37): falta la ruta, y dos campos no existen en el modelo |
| AG-17 | Alta | dato-inexistente-en-modelo (falta la semilla) | Un sticker en el chat da 404 contra la API real |
| AG-18 | Media | autorización | El autor sancionado no puede apelar: la decisión solo la lee SECURITY_ADMIN |
| AG-19 | Media | tiempo-real + otro | El backend del chat estilo WhatsApp (F4) ya está en la API y el front no lo usa |
| AG-20 | Media | contrato-respuesta | Un mensaje borrado se pinta como una burbuja vacía |
| AG-21 | Media | contrato-respuesta | La campana no sabe abrir SERVICE_REQUEST (y trae un tipo que la API no emite) |
| AG-22 | Baja | tiempo-real | Notificaciones: polling de 45 s, sin push |
| AG-23 | Media | otro | La API ofrece funciones de red social que no tienen UI |
| AG-24 | Media | ruta-faltante | Tendencias del muro (P38): sigue abierto |
| AG-25 | Media | dato-inexistente-en-modelo | Farmacias abiertas 24 h o de turno (P34): el modelo no lo tiene, y `openNow` no lo calcula nadie |
| AG-26 | Baja | otro | El mock desalineado de este dominio |
| AG-27 | Baja | contrato-body (el query param se ignora en silencio) | El filtro `city` solo lo lee `/public/search/organizations` |
| AG-28 | Baja | contrato-respuesta | Listas que se cortan sin cursor |
| AG-29 | Baja | tiempo-real | Socket.io en producción: sin confirmar |
| AG-30 | Bloqueante demo | dato-inexistente-en-modelo | Las 47 rutas de visitadores, visitas, agenda y encuestas de laboratorio responden 500 contra cualquier base del pipeline |
| AG-31 | Alta | autorización | Los roles `MEDICAL_VISITOR` y `PHARMA_LAB_ADMIN` no los emite ninguna parte de la API |
| AG-32 | Alta | autorización | El mostrador de la farmacia exige `SECURITY_ADMIN`: el personal de la farmacia recibe 403 en toda la bandeja |
| AG-33 | Baja | otro (deuda del mock) | `mark-ready` y `keep-original` son alias muertos del simulador (lo que se había pedido revisar) |
| AG-34 | Media | contrato-body (del mock) | El simulador de disponibilidad lee `productIds` y el cliente manda `products`: la maqueta nunca prueba la consulta real |
| AG-35 | Bloqueante demo | contrato-body | Cotizaciones: el front manda los importes como `number` y la API exige texto numérico → 400 en todo alta |
| AG-36 | Media | contrato-respuesta | Cotizaciones: la respuesta trae `statusConceptId`, no `status`, y no trae `patientName` |
| AG-37 | Alta | autorización | Cotizaciones: `GET /quotations?patientProfileId` y `GET /quotations/:id` no tienen rol ni verifican de quién es el dato |
| AG-38 | Alta | contrato-body y contrato-respuesta | Cockpit contable: amortización, devengo y compensación mandan un body que la API rechaza (400) y esperan otra respuesta |
| AG-39 | Alta | autorización | Cockpit contable: acciones que la pantalla ofrece al médico y la API reserva a `SECURITY_ADMIN`/`ACCOUNTING_APPROVER` |
| AG-40 | Media | ruta-faltante y dato-inexistente-en-modelo | Campañas de farmacia: no hay ninguna lectura en la API y el build de producción las fabrica por defecto |
| AG-41 | Media | dato-inexistente-en-modelo | P34: no hay forma de saber qué farmacia abre 24 h ni cuál está de turno (sigue abierto) |
| AG-42 | Media | ruta-faltante y dato-inexistente-en-modelo | P37: las sucursales de una cadena y la disponibilidad de una receta en texto solo existen en el simulador |
| AG-43 | Media | ruta-faltante (del lado del front) | Visitas médicas: la API publica encuestas, registro, confirmación, calificación y reprogramación, y el front no las consume |
| AG-44 | Baja | otro | Portal admin (PR #451): las rutas `/admin/catalog`, `/admin/analytics`, `/admin/qa` y `/admin/ops` ya existen — cierres y residuos |
| AG-45 | Baja | contrato-respuesta | Cierre de período: el front espera el período y la API devuelve `{ok,id}` |

---

## Parte A: agenda y consultorio (auditoría del contrato entre front y back)

**Fecha:** 2026-09-24 · **Front:** `mantra-core-health` en la rama `mockup` (9b3e0101). En este dominio `origin/dev` y `origin/mockup` solo difieren en `core/mock/fixtures/agenda.ts`: los clientes y las pantallas son los mismos en las dos ramas.
**API:** `mantra-core-health-redesa-api` en `dev` (7541797c). El ValidationPipe global corre con `whitelist: true, forbidNonWhitelisted: true, transform: true, enableImplicitConversion: true` (`src/main.ts:159-164`).
**Modelo usado como verdad:** `mantra-core-health-redesa-api/database/SQL/` y `mantra-core-health-model/Mantra Core Health Context/modules/diagram_41_scheduling.puml`. **Ojo:** el `SQL/` de la raíz del workspace está desactualizado. Por ejemplo, `SQL/41_scheduling/02_tables.sql:80-96` no tiene `schedule_rules.gap_minutes`, que sí está en `database/SQL/41_scheduling/02_tables.sql` (fila 28 de la tabla) y en el patch `2026-08-27_v422_agenda_gap_y_codigo_por_sede.sql`.
**Fuera de alcance:** `PUT/GET /scheduling/bookings/:id/payment-state` (pasarela de pago). El mock también registra `POST …/payment-state` (`scheduling.handlers.ts:269`), que la API no tiene. No se audita.

Rutas: las **56 llamadas** de agenda y consultorio del front existen en la API con el mismo método (ver la tabla del final). Los hallazgos son de body, autorización, respuesta, huecos del mock y datos que inventa el mock.

---

### AG-01 · Cuando el profesional elige «Horario flexible», la plantilla se rechaza con 400 (P36 abierto)
- **Severidad:** Alta (Bloqueante demo si la demo contra la API real usa «Horario flexible: Sí»).
- **Tipo:** contrato-body + dato-inexistente-en-modelo.
- **Evidencia front:** `core/data-access/scheduling/scheduling.client.ts:302` manda `flexibleHours: true`. Lo arma `features/agenda/agenda-create/agenda-create.ts:1126`. **El código ya está en `origin/dev`** (`git grep flexibleHours origin/dev` → `scheduling.client.ts:302`).
- **Evidencia API:** `src/modules/scheduling/dto/scheduling-catalog.dto.ts:342-399` (`CreateTemplateDto`) no declara `flexibleHours`, así que `forbidNonWhitelisted` devuelve 400 con «property flexibleHours should not exist». PENDIENTES-BACKEND P36 dice que «el DTO lo descartaría», y es incorrecto: lo **rechaza**.
- **Tablas del modelo:** `scheduling.schedule_templates` no tiene columna de modo (`database/SQL/41_scheduling/02_tables.sql:61-79`) y el `.puml` 41 tampoco (grep `flex` sin resultados).
- **Qué inventa el mock:** `scheduling.handlers.ts:421,495-497`. Guarda el flag y genera un solo bloque por franja con capacidad `floor(dur/15)`, una regla que no existe en ningún lado.
- **Qué hacer:** (1) decisión de producto: bloque con capacidad o pedido de hora que el médico confirma; (2) columna en el `.puml` 41 → `SQL/` → entidad → `CreateTemplateDto`/`UpdateTemplateDto`/`TemplateDetailDto`; (3) mientras tanto, esconder la opción «Sí» cuando `environment.mockBackend === false`.
- **Archivos:** `diagram_41_scheduling.puml`, `database/SQL/41_scheduling/02_tables.sql` más un patch, `entities/schedule_templates.entity.ts`, `dto/scheduling-catalog.dto.ts`, `services/scheduling-catalog.service.ts` (generateSlots), `agenda-create.ts`.
- **Gherkin:**
  - Dado un profesional con recurso, cuando publica una plantilla con `flexibleHours: true` contra la API real, entonces recibe 201 y `GET …/templates` devuelve `flexibleHours: true`.
  - Dado que P36 no está implementado, cuando la app corre con `mockBackend=false`, entonces la pregunta «Horario flexible» no se ofrece.

### AG-02 · El médico no puede registrar la llegada del paciente: check-in da 403
- **Severidad:** Alta (el flujo «reservar → aceptar → llegó → atender» se corta en «llegó»; iniciar la atención sigue funcionando).
- **Tipo:** autorización.
- **Evidencia front:** `scheduling.client.ts:741`. Lo llaman `features/agenda/my-agenda/my-agenda.ts:1687` (botón «llegó» de Mi agenda) y `features/agenda/agenda.ts:1599`.
- **Evidencia API:** `controllers/scheduling-bookings.controller.ts:344-345` exige `@Roles('SCHEDULING_ADMIN','SCHEDULING_AGENT')`. El profesional autorregistrado solo recibe `roles: ['PRACTITIONER']` (`iam/services/iam-practitioner-self-registration.service.ts:1016`). En `src/` no hay ningún código que otorgue `SCHEDULING_AGENT`.
- **Mock:** `scheduling.handlers.ts:323-329` no controla el rol, así que la maqueta esconde el 403.
- **Tablas:** `scheduling.appointment_bookings.checked_in_at`.
- **Qué hacer:** agregar `'PRACTITIONER'` al `@Roles` de check-in y validar en el servicio que el actor sea el profesional del recurso (como hacen accept/start). La otra salida es esconder «llegó» al médico, pero el consultorio propio no tiene secretaria.
- **Archivos:** `scheduling-bookings.controller.ts`, `scheduling-bookings.service.ts` (checkIn: `assertRecursoDelActor`), y el mock `scheduling.handlers.ts` para que imite el 403 del rol.
- **Gherkin:**
  - Dado un médico con rol PRACTITIONER dueño del recurso y una cita CONFIRMED, cuando hace `POST /scheduling/bookings/:id/check-in`, entonces recibe 200 con `checkedInAt`.
  - Dado un médico de OTRO recurso, cuando hace check-in, entonces recibe 403.

### AG-03 · La reserva de mostrador (`/schedule/book/:slotId`, entrada DESK) da 403 cuando la usa el médico
- **Severidad:** Alta.
- **Tipo:** autorización.
- **Evidencia front:** `app.routes.ts:873-877`: la entrada `DESK` hereda el rol de la sección agenda (profesional). `features/agenda/booking-new/booking-new.ts:448` usa `placeHold` → `confirmHold`/`requestHold` (`scheduling.client.ts:586,602,622`).
- **Evidencia API:** `scheduling.controller.ts:590-591`, `607-608` y `631-632` permiten `SCHEDULING_ADMIN`, `SCHEDULING_AGENT` y `PATIENT`, sin `PRACTITIONER`. El médico solo tiene PRACTITIONER (ver AG-02).
- **Mock:** `scheduling.handlers.ts:177-222` no controla el rol.
- **Qué hacer:** decidir si el médico reserva por la vía hold (entonces agregar PRACTITIONER a los tres endpoints) o si el mostrador del médico usa `POST /scheduling/appointments/direct`, que ya lo admite (`scheduling.controller.ts:545-548`). En ese caso, redirigir el botón.
- **Gherkin:**
  - Dado un médico en `/schedule/book/:slotId`, cuando confirma la reserva de un paciente, entonces la API responde 201 y la cita aparece en Mi agenda.
  - Dado un usuario sin rol de agenda, cuando intenta el hold, entonces recibe 403 y la pantalla muestra el motivo.

### AG-04 · El mock no simula el alta de mostrador (walk-in): la demo de «paciente nuevo» devuelve un eco sin cita
- **Severidad:** Bloqueante demo (en la rama `mockup`).
- **Tipo:** ruta-faltante (del mock).
- **Evidencia front:** `features/agenda/walk-in/walk-in-form.ts:293-310` y `features/agenda/appointment-new/appointment-new.ts:624` llaman `createWalkInAppointment`, que hace `POST /scheduling/appointments/walk-in` (`scheduling.client.ts:509`) y lee `creado.bookingId`, `encounterId`, `patientCode` y `patientProfileId`.
- **Evidencia mock:** en `core/mock/handlers/*.ts` no hay ninguna ruta `walk-in`. Cae en `respuestaGenerica` (`mock-backend.interceptor.ts:297-321`), que devuelve `{id, ...body, createdAt, status:'ACTIVE'}`. Resultado: sin `bookingId` ni `encounterId`, la cita no entra en `reservas` y no aparece en la agenda. Ni el paciente ni el encuentro se crean.
- **Evidencia API:** existe, con contrato alineado: `scheduling.controller.ts:574-575` y `dto/scheduling-walk-in.dto.ts:44-276`. Todos los campos que manda el front están declarados y la respuesta coincide campo por campo con `WalkInAppointmentCreated` (`scheduling.types.ts:1003`).
- **Tablas:** `profiles.persons`, `patient_profiles`, `common.identifiers`, `scheduling.bookable_slots`, `appointment_bookings`, `clinical.encounters`.
- **Qué hacer:** agregar el handler `router.post('/scheduling/appointments/walk-in', …)` en `scheduling.handlers.ts`: crear el paciente en `personas`, el cupo y la reserva con estado `BK-IN-PROGRESS`, devolver `WalkInAppointmentResponseDto`, y responder 409 si `nationalId` ya existe y 422 si hay choque.
- **Gherkin:**
  - Dado el mock activo, cuando recepción registra un paciente nuevo por walk-in, entonces la respuesta trae `bookingId`, `encounterId` y `patientCode`, y la cita aparece EN CURSO en Mi agenda.
  - Dado un documento ya registrado, cuando se repite el walk-in, entonces el mock responde 409 y la pantalla ofrece buscar al paciente.

### AG-05 · Cambiar un horario con citas vivas sigue siendo imposible (P23 abierto), y el mock lo esconde
- **Severidad:** Alta.
- **Tipo:** contrato-respuesta / otro (regla de negocio divergente entre mock y API).
- **Evidencia API:** `services/scheduling-catalog.service.ts:994-1006` → `findBookingsOfTemplate(…, ACTIVE_BOOKING_STATES)` y `if (citas.live > 0) throw ConflictException`, sin filtro de fecha. No existen `release-free-slots` ni `generate-slots?replace` (grep sin resultados).
- **Evidencia mock:** `scheduling.handlers.ts:445-455` solo cuenta las citas **futuras** (`r.startAt > ahora()`) e incluye `BK-IN-PROGRESS`. En la maqueta, una cita confirmada del pasado que nadie cerró no bloquea el cambio. Contra la API sí lo bloquea. La demo en mockup no reproduce el muro.
- **Evidencia front:** `agenda-create.ts` y `my-agenda.ts` llaman a `retireTemplate` antes de publicar (`scheduling.client.ts:348`).
- **Tablas:** `schedule_templates`, `bookable_slots`, `appointment_bookings`.
- **Qué hacer:** en la API, limitar el 409 a las citas vivas **posteriores a `from`** (opción 1 de P23) o agregar `POST /scheduling/templates/:id/release-free-slots?from=`. Igualar el mock a la regla que quede.
- **Archivos:** `scheduling-catalog.service.ts` (retireTemplate), `repositories/scheduling-catalog.repository.ts` (`findBookingsOfTemplate` con `from`), `scheduling.controller.ts:291`, mock `scheduling.handlers.ts:445`.
- **Gherkin:**
  - Dado un horario con una cita confirmada en 3 meses y el cambio rige desde mañana, cuando el médico retira la plantilla con `from=mañana`, entonces recibe 200 con `keptSlots ≥ 1` y la cita sigue intacta.
  - Dado un horario con una cita viva dentro del rango que se deja de publicar, cuando lo retira, entonces recibe 409 con `details.bookingIds`.

### AG-06 · Las notificaciones de agenda de la API no se pueden abrir desde la campana
- **Severidad:** Alta (el aviso de cupo liberado de P21 llega pero no lleva a ningún lado).
- **Tipo:** contrato-respuesta.
- **Evidencia API:** `scheduling/notices/agenda-notices.ts:22,25` define `RECURSO_CITA = 'scheduling.appointment_bookings'` y `RECURSO_CUPO = 'scheduling.bookable_slots'`. Los usa como `relatedResourceType` (líneas 97, 161, 204, 249, 283, 349, 400), y `messaging/services/notifications.service.ts:776` los devuelve tal cual como `destination.type`. El resto de la API sigue el mismo patrón `schema.tabla` (`accounting.journal_transactions`, `profiles.practitioner_affiliations`, `consent.consents`) o usa minúsculas (`visit_request`).
- **Evidencia front:** `core/notifications/notification-routes.ts:25-48` solo conoce `APPOINTMENT`, `PRESCRIPTION`, `ENCOUNTER`, `PHARMACY_ORDER`, `CONVERSATION`, etc. `rutaDeNotificacion` devuelve `null` para `scheduling.*`, y la campana pinta el aviso sin enlace.
- **Mock:** usa `destination: { type: 'APPOINTMENT' }` (`notifications.handlers.ts:38,42,52,54`, `scheduling.handlers.ts:116`, `core/mock/horario-liberado.ts:149`), así que en mockup la navegación sí funciona. Es un vocabulario **inventado por el mock**.
- **Tablas:** `messaging.in_app_notifications.related_resource_type`.
- **Qué hacer:** fijar el vocabulario en un contrato. Lo más barato es sumar a `RUTAS` las claves `'scheduling.appointment_bookings' → /my-account/appointments` y `'scheduling.bookable_slots' → /my-account/appointments`, y cambiar el mock para que use los valores de la API. Es transversal: lo mismo pasa con farmacia, receta y pharma_lab. Se reporta acá solo por la parte de agenda.
- **Gherkin:**
  - Dado un aviso `SLOT_RELEASED` emitido por la API, cuando el paciente lo toca en la campana, entonces navega a `/my-account/appointments`.
  - Dado el mock, cuando emite un aviso de agenda, entonces su `destination.type` es el mismo literal que emite la API.

### AG-07 · P21 (horario liberado): la API ya avisa, pero con otra regla que el mock
- **Severidad:** Media.
- **Tipo:** tiempo-real + dato-inexistente-en-modelo (regla del mock).
- **Evidencia API (se cerró la parte de la lista de espera):** cancelar promueve la lista de espera en línea (`services/scheduling-bookings.service.ts:1584-1620` → `waitlist.promoteWaitlist`), y eso emite `avisarCupoLiberado` (`services/scheduling-waitlist.service.ts:336` → `scheduling-agenda-notices.service.ts:57-95`) con `kind: 'SLOT_RELEASED'`. También existe el barrido `promote-waitlist.job` cada 30 s, según el comentario de la línea 1584. La entrega depende de los seeds correctos del canal IN_APP (PREGUNTAS-CARRIL-B §1: con el paquete viejo, 0 avisos y ningún error visible).
- **Qué sigue abierto:** (a) la regla del mock, «confirmada y sin iniciar pasados 10 min = liberada» (`core/mock/horario-liberado.ts`, sondeo cada 20 s en `features/notifications/aviso-de-hueco-libre.ts:79`, solo con `mockBackend`), no existe en la API; (b) el interesado según la API es quien está **en lista de espera**, y según el mock es «quien tiene una cita futura con esa profesional»; (c) el payload de la API no trae `kind` en `payloadJson` (trae `route`, `slotId`, `resourceId`, `startAt`; el `kind` va en el aviso interno). No hay SSE para la campana: sondeo.
- **Tablas:** `scheduling.waitlist_entries`, `messaging.notification_requests`, `in_app_notifications`.
- **Qué hacer:** que producto elija la regla. Si la del mock es la buena, falta un productor en la API (job que marque «desconfirmada») y la escritura en la lista de espera al reservar una fecha distinta de la pedida. Si no, cambiar el mock a «solo lista de espera». Verificar la revisión de seeds en cada ambiente.
- **Gherkin:**
  - Dado un paciente en la lista de espera de un recurso, cuando otro paciente cancela un cupo de ese recurso, entonces el primero recibe una notificación in-app con `payloadJson.slotId`.
  - Dado `mockBackend=false`, cuando la app arranca, entonces `aviso-de-hueco-libre` no sondea.

### AG-08 · Los ids de `close-slots` y `shift-slots` se validan como UUID v4: los cupos sembrados (uuid5) darían 400
- **Severidad:** Media (sin confirmar contra la base viva).
- **Tipo:** contrato-body.
- **Evidencia API:** `dto/scheduling-catalog.dto.ts:1020` (`ShiftSlotsDto.slotIds`) y `1081` (`CloseSlotsDto.slotIds`) usan `@IsUUID('4', { each: true })`. Los cupos que genera la app son v4 (`entities/bookable_slots.entity.ts:13` `randomUUID()`), pero los seeds del paquete derivan ids **uuid5** (namespaces `MODEL_VERSION`/`PATCH_*`, CLAUDE.md). En el resto de la API se usa `@IsUUID()` a secas.
- **Evidencia front:** `my-agenda.ts` → `closeSlots`/`shiftSlots` (`scheduling.client.ts:406,422`) con los ids leídos de `GET /scheduling/slots`.
- **Tablas:** `scheduling.bookable_slots`.
- **Qué hacer:** cambiar a `@IsUUID()` (cualquier versión). Verificar con un cupo sembrado.
- **Gherkin:**
  - Dado un cupo sembrado con id uuid5, cuando el médico lo cierra con `close-slots`, entonces recibe 200 y no 400.

### AG-09 · El mock inventa reglas que la API no tiene (agenda)
- **Severidad:** Media.
- **Tipo:** dato-inexistente-en-modelo.
- **Evidencia mock → API:**
  1. `scheduling.handlers.ts:281`: cancelar como no-show devuelve `feeAmount: '50.00'` fijo. La API solo cobra si la política define `no_show_fee_amount` (`booking_policies.no_show_fee_amount`, `database/SQL/41_scheduling/02_tables.sql` línea 150 en adelante).
  2. `:177-185`: el hold no descuenta `remainingCapacity` del cupo. La API bloquea con `FOR UPDATE` y descuenta, así que dos holds simultáneos se comportan distinto.
  3. `:205`: traduce `channel: 'PHONE'` (canal de **pedido**) al concepto `CH-TELECONSULTA` (modalidad de **atención**) y mezcla `BOOKING_CHANNELS` con `APPOINTMENT_CHANNELS` (`dto/scheduling-bookings.dto.ts:23-43`).
  4. `:357-400`: la cita directa nunca responde 422 por «regla madre» (choque del profesional en otra sede), que la API sí aplica. La demo no muestra ese mensaje.
  5. `:294-316`: reprogramar no exige estado vigente ni `reasonText` (la API responde 422: `scheduling-bookings.service.ts:1237`), y cancelar no exige motivo (`:1390`).
  6. `:474-525`: `generate-slots` usa `setHours` (hora local del navegador) en vez de la zona del recurso (defecto R-6/H-02 corregido en la API) y no devuelve `omittedByCommitments` (`GenerateSlotsResponseDto:711`).
  7. `:526-557`: shift-slots y close-slots nunca responden 409 (la API es «todo o nada» y rechaza con 409 si hay pacientes citados).
  8. Cancelar en el mock no promueve la lista de espera ni emite el aviso (la API sí, ver AG-07).
- **Qué hacer:** alinear el mock con esas respuestas de error y reglas (hoy la demo solo recorre el camino feliz).
- **Gherkin:**
  - Dado el mock, cuando el médico cierra un cupo con paciente citado, entonces recibe 409 con los `bookingIds`, como en la API.
  - Dado un no-show en un recurso cuya política no tiene cargo, cuando se cancela, entonces la respuesta no trae `feeAmount`.

### AG-10 · El paciente no puede reprogramar su propia cita aunque la API lo permite
- **Severidad:** Media (pedido explícito «cancelación/reagenda»).
- **Tipo:** otro (el front no consume la API).
- **Evidencia API:** `scheduling-bookings.controller.ts:311-315` admite `PATIENT` en `POST /scheduling/bookings/:id/reschedule`.
- **Evidencia front:** `features/account/appointments/appointments.ts:1395` solo ofrece `cancelBooking(…, { cancelledBy: 'PATIENT' })`. `rescheduleBooking` solo aparece en `features/agenda/agenda.ts`.
- **Qué hacer:** agregar en «Mis turnos» la acción «Cambiar horario»: elegir cupo con `listSlots(onlyAvailable)` y llamar `rescheduleBooking(toSlotId, reasonText)`. El mock ya tiene la ruta.
- **Gherkin:**
  - Dado un paciente con una cita CONFIRMED, cuando elige otro cupo libre y escribe el motivo, entonces la cita queda en el cupo nuevo con `rescheduledFrom` y el profesional recibe el aviso.

### AG-11 · La API tiene operaciones de agenda que el front no consume
- **Severidad:** Baja.
- **Tipo:** otro.
- **Evidencia API sin cliente en el front:** `POST /scheduling/bookings/:id/request-info` y `/propose-schedule` (`scheduling-bookings.controller.ts:167,190`); `GET /scheduling/resources/:resourceId/waitlist` (`scheduling.controller.ts:696`: el médico no ve su lista de espera); `PATCH /scheduling/templates/:id` (`:265`: el mock la tiene en `scheduling.handlers.ts:428`, el cliente no); `POST /scheduling/bookings/:id/reminders`; `/scheduling/confirmation-rules*` (`scheduling-confirmation.controller.ts`); `GET /scheduling/resources/:id/slots`; `GET /practices/:id/sites` y las escrituras SECURITY_ADMIN de `practices`.
- **Qué hacer:** que producto priorice. Las más visibles son la lista de espera del médico y «proponer otro horario» para una solicitud.
- **Gherkin:**
  - Dado un médico con pacientes en su lista de espera, cuando abre Mi agenda, entonces ve cuántos esperan y quiénes.

### AG-12 · `roleTitle` de las solicitudes de afiliación puede llegar `null` y el front lo tipa como `string`
- **Severidad:** Baja.
- **Tipo:** contrato-respuesta.
- **Evidencia API:** `profiles/dto/affiliation-request.dto.ts:56-57` (`roleTitle!: string | null`, opcional desde ALV-007 y el patch `2026-09-05_v426_practitioner_affiliations_role_title_nullable.sql`).
- **Evidencia front:** `core/data-access/directory/directory.types.ts:107` (`readonly roleTitle: string`). `toPractitionerRequest` (`directory.client.ts:594-607`) pasa por `sinNulos`, que convierte `null` en ausencia de la clave, sin cambiar el tipo. Una pantalla que haga `roleTitle.trim()` o lo interpole mostraría «undefined» (sin confirmar en la vista).
- **Qué hacer:** `readonly roleTitle: string | null` más `roleTitle: body.roleTitle ?? null` en el mapeo, y un rótulo «Consultorio propio / sin cargo» en la bandeja.
- **Gherkin:**
  - Dado un pedido de afiliación sin cargo, cuando la organización abre la bandeja, entonces la fila dice «sin cargo declarado» y no «undefined».

### AG-13 · «Mis servicios» y el catálogo no pueden cargar la descripción ni la imagen del servicio
- **Severidad:** Baja (condiciona P30, la ficha pública de la clínica, que es de la parte B).
- **Tipo:** contrato-body.
- **Evidencia API:** `billing/dto/*service-catalog*.ts:55-69`: el alta acepta `descriptionText` e `imageFileId` (patch `2026-09-04_v425_service_catalog_description_image.sql`), pero `UpdateServiceCatalogItemDto` (`:141-183`) no los acepta, así que nunca se pueden editar. Además, el alta es solo `SECURITY_ADMIN` (`billing-service-catalog.controller.ts:125-126`).
- **Evidencia front:** `core/data-access/services-catalog/services-catalog.types.ts:16-36,79-88` no declara `descriptionText` ni `imageFileId`. El médico solo edita el precio y la baja (PATCH, permitido a PRACTITIONER: `controller:150-151`).
- **Qué hacer:** agregar los dos campos al `UpdateServiceCatalogItemDto` y a los tipos y formularios del front. Si la ficha pública P30 lee `description`, mapearlo desde `descriptionText`.
- **Gherkin:**
  - Dado un médico en «Mis servicios», cuando escribe qué incluye un servicio y guarda, entonces `PATCH /billing/service-catalog/:id` responde 200 y el texto persiste.

### AG-14 · Fuente del modelo duplicada: el `SQL/` de la raíz ya no es la verdad
- **Severidad:** Baja (riesgo de auditorías falsas).
- **Tipo:** otro.
- **Evidencia:** `SQL/41_scheduling/02_tables.sql:80-96` (raíz) no tiene `gap_minutes`, que la entidad mapea (`entities/schedule_rules.entity.ts:65`) y que sí está en `mantra-core-health-redesa-api/database/SQL/41_scheduling/02_tables.sql` y en `mantra-core-health-model/SQL/…`. El CLAUDE.md de la raíz dice que `database/` se eliminó (v4.0.9) y que no hay que inventar migraciones en el repo de la API. Hoy existe `database/SQL/patches/` con más de 40 patches (el último es `2026-09-19_v4221_…`).
- **Qué hacer:** actualizar el CLAUDE.md de la raíz o sincronizar `SQL/` desde `mantra-core-health-model`. No auditar contra la raíz.

---

### Estado de los pendientes previos (PENDIENTES-BACKEND.md) en la API `dev` actual

| Pendiente | Estado hoy | Evidencia |
| --- | --- | --- |
| **P15**: retirar una plantilla | **CERRADO** | `DELETE /scheduling/templates/:id` (`scheduling.controller.ts:291-294`) retira (TPL_RETIRED), libera los cupos libres y devuelve `releasedSlots`/`keptSlots` (`RetireTemplateResponseDto:847-871`). También `POST …/reactivate` (`:242`) y `PATCH …/templates/:id` (`:265`). |
| **P21**: aviso de horario liberado | **PARCIAL** | La API emite `SLOT_RELEASED` a la lista de espera al cancelar (`scheduling-bookings.service.ts:1584-1620`, `scheduling-agenda-notices.service.ts:57`). La regla del mock (desconfirmar) y la navegación desde la campana siguen abiertas: AG-06, AG-07. |
| **P22**: alta del paciente de mostrador | **CERRADO en la API; ABIERTO en el mock** | `POST /scheduling/appointments/walk-in` (`scheduling.controller.ts:574`, DTO `scheduling-walk-in.dto.ts` con todo el bloque §1.1: nombre en 4 partes, CI, departamento, nacimiento, ocupación, tutor) en una sola transacción. El front ya lo consume. El mock no lo tiene (AG-04). La decisión «correo obligatorio o celular» sigue abierta (sin confirmar). |
| **P23**: cambiar un horario con citas | **ABIERTO** | `scheduling-catalog.service.ts:994-1006`: el 409 se dispara con cualquier cita viva, sin filtro de fecha (AG-05). |
| **P36**: horario flexible | **ABIERTO** | No hay columna en el modelo ni en el DTO. El front ya lo manda desde `dev` y la API responde 400 (AG-01). |
| REGISTRO-DEFECTOS A-01 (el motivo de consulta llega a la organización) | **Parece cerrado en el código; sin confirmar en runtime** | `scheduling-bookings.service.ts:3064` agrega `reasonText` de forma condicional; `scheduling-tenant-agenda.service.ts:46,87` dice «sin motivo de consulta». El registro no lo marca CERRADO. |
| REGISTRO-DEFECTOS A-02/A-03 (hold y disponibilidad en el pasado) | CERRADO (MAC-1) | `REGISTRO-DEFECTOS.md:537-538` |

### Llamadas verificadas OK (ruta, método, body y respuesta alineados con el DTO)

| Front (`scheduling.client.ts` salvo que se indique) | API | Nota |
| --- | --- | --- |
| GET `/scheduling/resources` :122 | `scheduling-agenda.controller.ts:33` | `includeInactive` usa `queryBoolean()` y `"false"` se lee bien. Respuesta `{items,count}` con `site`. |
| GET `/scheduling/slots` :153 | `scheduling-agenda.controller.ts:46` | `onlyAvailable` usa `queryBoolean`. `{items,count,limit,truncated}`: sin cursor en ninguno de los dos lados. |
| GET `/scheduling/bookings` y `/:id` :186, :215 | `scheduling-bookings.controller.ts:85,128` | Parámetros sueltos con `@Query`. `includeCancelled==='true'`. El DTO trae además `encounterId` (el front lo ignora). |
| POST resources / booking-policies / templates :233, :251, :280 | `scheduling.controller.ts:161,178,195` | Bodies armados campo a campo. `gapMinutes` sí está en `ScheduleRuleDto:324-327`. Excepción: `flexibleHours` (AG-01). |
| GET templates, reactivate, DELETE templates, generate-slots :316, :331, :348, :359 | `:223,242,291,308` | |
| shift-slots / close-slots :406, :422 | `:409,382` | Ver AG-08 por `IsUUID('4')`. |
| activity-types / exception-types :429, :433 | `:436,458` | Enums iguales al mock (ABSENCE…OTHER; APPOINTMENT…OTHER). |
| exceptions GET/POST/PATCH/DELETE :445, :455, :566, :573 | `:337,470,497,520` | |
| appointments/direct, walk-in :477, :509 | `:545,574` | `channel` ∈ PRESENCIAL/TELECONSULTA/DOMICILIO. |
| holds, confirm, request :586, :602, :622 | `:590,607,631` | Body OK. Roles: ver AG-03. |
| cancel / reschedule / reject :645, :665, :704 | `scheduling-bookings.controller.ts:327,311,206` | `reasonText` obligatorio en los tres. |
| accept / start / complete :731 | `:144,276,295` | `reminderOffsetsMinutes` declarado. |
| check-in :741 | `:344` | Contrato OK. Rol: AG-02. |
| waitlist POST/GET :760, :787 | `scheduling.controller.ts:648,665` | `includeClosed` string `'true'`. Respuesta `{items}`. |
| delay booking / resource :801, :820 | `scheduling-bookings.controller.ts:362`; `scheduling.controller.ts:723` | |
| GET `/tenants/:id/agenda` (`directory.client.ts:381`) | `tenant-agenda.controller.ts:36` | Sin `@Roles`, con control de pertenencia. Rango ≤ 31 días (422). Campos iguales. |
| practitioner-requests GET/approve/reject (`directory.client.ts:325,335,353`) | `profiles/controllers/tenant-practitioner-requests.controller.ts` | `reason` opcional. Ver AG-12. |
| practice-sites: GET `:id/sites`, `me/role-assignments`, self-request, POST/PATCH/DELETE `me/sites`, PUT bank-qr (`practice-sites.client.ts:61-162`) | `practice/controllers/practitioner-sites.controller.ts:70-176`, `practices.controller.ts:265` | `isOwnSite` y `bankQrFileId` están en la API (P32/P33 cerrados). `fileId: null` es válido (`ValidateIf`). El mock usa los mismos nombres. |
| GET `/practices`, `/practices/:id/organization` (`medical-organization.client.ts:44,58`) | `practices.controller.ts:90,124` | Las 8 claves de la consola coinciden. |
| services-catalog GET/POST/PATCH, procedure-specialties, procedures (`services-catalog.client.ts:42-144`) | `billing-service-catalog.controller.ts:72-223` | Cursor `nextCursor` en los dos lados. POST solo SECURITY_ADMIN (lo usa `admin/services-catalog`, bien). Ver AG-13. |
| PUT/GET payment-state :205 | `scheduling-bookings.controller.ts:234,256` | **Fuera de alcance (pasarela).** |


## Parte B — Social, mensajería, notificaciones y directorios públicos

Auditoría de contrato front ↔ API. Solo lectura. Corte: front `origin/mockup` (9b3e0101) y `origin/dev`; API `dev` (7541797c, post PR #451/#452).
Rutas: front = `mantra-core-health/src/app/…`; API = `mantra-core-health-redesa-api/src/modules/…`.
Modelo: **la fuente vigente del DDL está en el repo de la API, en `mantra-core-health-redesa-api/database/SQL/`** (el `SQL/` de la raíz del workspace es una foto vieja: no tiene `community.chat_auto_replies` ni `comment_media`, que la API sí tiene como patches `2026-09-11_v429` y `2026-09-04_t01`).
ValidationPipe verificado en `src/main.ts:159-164` (`whitelist` + `forbidNonWhitelisted` + `transform`). Ojo: **los controladores públicos leen `@Query('x')` sueltos y no un DTO**, así que un query param de más en `/public/*` se ignora en silencio, no da 400.

**En `mockup` y no en `dev`, dentro de este dominio, solo cambió `core/messaging/chat.store.ts`** (`prepararContador()`, N-01: contador de chats sin leer en el armazón; no cambia el contrato) y `features/directory/practitioners-directory` (navegación, sin contrato). Todo lo demás de esta parte es igual en las dos ramas.

Fuera de alcance: pasarela de pago y delivery.

---

### AG-15 · Las fichas de clínica y farmacia (P30/P31) no tienen su ruta en la API
- **Severidad:** Alta (contra la API real, las secciones «Servicios» y «Productos» de `ClinicDetail`/`PharmacyDetail` se quedan en error; en `mockup` se ven llenas).
- **Tipo:** ruta-faltante
- **Evidencia front:** `core/data-access/public-catalog/public-catalog.client.ts:57-76` (`GET /public/profiles/o/:slug/services`, `GET /public/profiles/f/:slug/products`, envoltura `{items,nextCursor,totalHint,generatedAt}`); consumidores en `features/public-directories/clinic-detail`, `pharmacy-detail` y `public-catalog-detail.ts`. Mock en `core/mock/handlers/public.handlers.ts:452-462`.
- **Evidencia API:** no existe. `community/controllers/community-public.controller.ts` solo sirve `GET /public/profiles/:prefijo/:slug` y `…/reviews`. Si el slug es de otro tipo, no hay ninguna ruta hermana que lo atrape: responde 404.
- **Tablas del modelo:** P30 → `billing.service_catalog` (`code`, `name`, `description_text`, `default_price numeric NOT NULL`, `currency_concept_id`, `is_active`), o bien `practice.healthcare_services`: **sin confirmar cuál de las dos es la oferta publicable**. P31 → `pharmacy.pharmacy_products` (`generic_name`, `brand_name`, `strength_text`, `dosage_form_concept_id`, `package_size_text`, `requires_prescription`) + `pharmacy.pharmacy_product_prices` + `pharmacy_inventory.inventory_stock_positions`.
- **Lo que inventa el mock y no está en el modelo:** `therapeuticGroup` no es columna de `pharmacy_products`; habría que sacarlo de la terminología (ATC del `medication_concept_id`), sin confirmar. `price: null` («sin precio publicado») **no se puede expresar**: `service_catalog.default_price` es `NOT NULL`. O el modelo agrega una marca «precio publicado», o la API decide que null significa `is_active=false`.
- **Qué hacer:** dos lecturas `@Public()` con `@Throttle(PUBLIC_RATE_LIMIT)` en `CommunityPublicController`, colgadas de `public/profiles/o/:slug/services` y `public/profiles/f/:slug/products`, con paginación keyset y los importes serializados como texto. Resolver slug → tenant → practice/pharmacy en un servicio de proyección que no exponga `income_account_id` ni `tax_code_id`.
- **Archivos:** API `community/controllers/community-public.controller.ts`, `community/services/community-public.service.ts` (o un `public-catalog.service.ts` nuevo), `community/dto/public-catalog.dto.ts` (nuevo), `community/repositories/public-search.repository.ts`. Front: nada, salvo actualizar `CONTRATO-PUBLICO.md` y fundir `PublicCatalogClient` cuando el contrato se publique.
- **Gherkin:**
  - Dado un slug de organización con 3 servicios activos, cuando pido `GET /public/profiles/o/{slug}/services` sin token, entonces recibo 200 y 3 ítems, cada uno con `price` como string, y nada de `incomeAccountId` en el cuerpo.
  - Dado un slug de farmacia, cuando pido `/public/profiles/o/{slug}/services`, entonces recibo 404 con la misma forma que un slug inexistente.
  - Dado un producto sin stock, cuando pido `/public/profiles/f/{slug}/products`, entonces aparece con `inStock=false` y no se omite.

### AG-16 · Sucursales de cadena y receta entre sucursales (P37): falta la ruta, y dos campos no existen en el modelo
- **Severidad:** Alta
- **Tipo:** ruta-faltante + dato-inexistente-en-modelo
- **Evidencia front:** `core/data-access/public-catalog/public-catalog.client.ts:85-122` (`GET /public/profiles/f/:slug/branches`, y `GET /public/profiles/f/:slug/branch-availability?items=a|b&lat&lng`, que responde `{items}`); tipos en `public-catalog.types.ts:94-159`. Mock en `public.handlers.ts:470-506`.
- **Evidencia API:** no existe ninguna de las dos (`grep branch-availability|branches` sobre `community/`, `pharmacy/` y `read_models/` no da nada). Además es la única llamada del front que el inventario `client-calls.json` marca `NULL` en este dominio.
- **Tablas:** `pharmacy.pharmacies` → `pharmacy.pharmacy_sites` (`pharmacy_id`, `practice_site_id`, `name`, `home_delivery_available`, `pickup_available`) → `practice.practice_sites.address_id` → `common.addresses`. La cadena es «una `pharmacies` con varias `pharmacy_sites`».
- **Lo que inventa el mock:** `openingHours` (no hay tabla de horarios de farmacia en ningún schema; es la misma raíz que P34), `phone` (no es columna de `practice_sites` ni de `pharmacy_sites`; puede estar en un contact point de `common`, sin confirmar) y `locationAccuracy` (sin confirmar).
- **Qué hacer:** `GET …/branches` es barato (join sites → addresses). `branch-availability` tiene que buscar texto libre contra `pharmacy_products.generic_name/brand_name` y contra el stock por sede (`inventory_stock_positions` ↔ `inventory_locations`), y ordenar igual que `/pharmacy-inventory/availability`. `openingHours` y `phone` van null hasta que el modelo los tenga.
- **Archivos:** API `pharmacy/controllers/pharmacy-public.controller.ts` (o `community-public.controller.ts`), un servicio nuevo `pharmacy/services/pharmacy-public-branches.service.ts` y su DTO. Modelo: `.puml` del módulo 24 si se decide agregar horario y teléfono.
- **Gherkin:**
  - Dada una farmacia sin cadena, cuando pido `/branches`, entonces recibo 1 ítem con `isCurrent=true`.
  - Dada una cadena con 3 sucursales y una receta «amoxicilina 500|paracetamol», cuando pido `/branch-availability` con lat/lng, entonces primero vienen las `complete=true`, ordenadas por `distanceKm`.
  - Dado un renglón que no coincide con ningún producto, entonces aparece en `missing` y no en `matches`.

### AG-17 · Un sticker en el chat da 404 contra la API real
- **Severidad:** Alta (bloquea la demo si se hace sobre la API real: la burbuja queda con ⚠ y «Reintentar». En `mockup` funciona).
- **Tipo:** dato-inexistente-en-modelo (falta la semilla)
- **Evidencia front:** `core/messaging/chat.store.ts:929-947` (`enviarSticker` manda `attachmentFileId = sticker.id`, que es un uuid fijo) y `:978-990` (`contentType:'MEDIA'`). El pack está en `core/messaging/sticker-pack.generated.ts:11-13`, que afirma que «el backend siembra el pack en `common.files`». Uuid de muestra: `a7c1f0e2-0001-4a00-9000-5713ca110001`.
- **Evidencia API:** `community/services/community-messaging.service.ts:263-286` → `assertAttachmentCanBeAssociated` → `common/services/attachable-file.service.ts:119-121`: si el archivo no existe, `ResourceNotFoundException` → **404**. Esa excepción no la atrapa el `catch`, que solo captura `ForbiddenException`. Y aunque el archivo existiera, `:123-128` exige `createdByUserId === actor.id`, así que un sticker compartido daría **403**. El uuid no aparece en ninguna parte del repo de la API, ni en `seedsGenerales/` ni en `salud-db/`.
- **Tablas:** `common.files`, `common.file_versions`, `community.direct_messages.attachment_file_id`.
- **Qué hacer:** (a) sembrar el pack en `common.files` con esos uuid fijos y un dueño de sistema, y (b) en `assertAttachmentCanBeAssociated`, aceptar los archivos del pack del producto, por ejemplo con una categoría de sistema o una allowlist de ids. La alternativa es mandar el sticker como `bodyText` con una convención y sin adjunto, pero eso cambia el contrato.
- **Archivos:** API `common/seed/*` (una semilla nueva de stickers), `community/services/community-messaging.service.ts`, `common/services/attachable-file.service.ts`. Front: `scripts/gen-sticker-pack.mjs` si cambian los ids.
- **Gherkin:**
  - Dado un participante activo de una conversación, cuando manda `POST …/messages` con `contentType=MEDIA` y un `attachmentFileId` del pack, entonces recibe 201.
  - Dado el otro participante, cuando pide `GET …/attachments/{fileId}/content`, entonces recibe los bytes del sticker.
  - Dado un `fileId` que no es del pack ni del emisor, entonces sigue recibiendo 403.

### AG-18 · El autor sancionado no puede apelar: la decisión solo la lee SECURITY_ADMIN
- **Severidad:** Media
- **Tipo:** autorización
- **Evidencia front:** `core/data-access/community/community.client.ts:730-745` (`appealDecision`) **no tiene ningún consumidor en `features/`**. La moderación (`features/admin/moderation/moderation.ts`) está detrás de `roles:['SECURITY_ADMIN']` (`core/navigation/navigation.map.ts:853-866`).
- **Evidencia API:** `community/controllers/community-moderation.controller.ts:78` (`POST moderation/decisions/:decisionId/appeal`, sin `@Roles`), pero `GET moderation/decisions` (`:119-120`) y `GET moderation/appeals` (`:132-133`) son `@Roles('SECURITY_ADMIN')`. El autor nunca llega a conocer el `decisionId` que necesita para apelar.
- **Tablas:** `community.moderation_decisions`, `community.moderation_appeals`, `community.moderation_strikes`.
- **Qué hacer:** una lectura propia, por ejemplo `GET /community/moderation/decisions/mine?profileId=`, acotada por titularidad del perfil (`CommunityVisibilityService`), y una pantalla «Mis sanciones» con un botón «Apelar».
- **Archivos:** API `community-moderation.controller.ts`, `services/community-moderation-read.service.ts`. Front: `community.client.ts` y una feature nueva.
- **Gherkin:**
  - Dado un autor con una publicación REMOVED, cuando pide sus decisiones, entonces ve la suya y no las de otros.
  - Dado ese autor, cuando apela con `appellantProfileId` propio, entonces recibe 201 y la apelación queda OPEN.
  - Dado un tercero, cuando pide las decisiones de otro perfil, entonces recibe 403.

### AG-19 · El backend del chat estilo WhatsApp (F4) ya está en la API y el front no lo usa
- **Severidad:** Media
- **Tipo:** tiempo-real + otro
- **Evidencia front:** el socket solo escucha `conversation:message`, `:message:updated`, `conversation:read` y `conversation:new` (`core/messaging/chat-socket.service.ts:136-149`), y nunca emite `typing` ni `presence:ping`. Favoritos y archivados siguen en `localStorage` (`core/messaging/chat-preferencias.ts:12-50`). El cliente no tiene métodos para borrar mensajes, fijar, ni `PATCH …/participant`/`GET …/presence`. `ConversationsQuery` no manda `q` ni `cursor`. `PLAN-CHAT-WHATSAPP.md:22` todavía dice «F4 ⏳ abierta».
- **Evidencia API (F4 cerrada en `dev`):** `community/controllers/community-messaging.controller.ts:102` (DELETE mensaje), `:132` (PATCH participant: `isFavorite`, `isPinned`, `archived`), `:146/:158` (pin), `:218-225` (lista con `cursor` y `q`), `:251` (presence). Gateway: `community/gateways/community-messaging.gateway.ts:255` (`typing` → `conversation:typing`), `:278` (`presence:ping`), `:328` (`conversation:message:deleted`), `:412` (`profile:presence`). DTO de la lista con `isFavorite`, `isPinned`, `archivedAt`, `pinnedMessageId`, `lastMessageReadByPeer` (`dto/read-messaging.dto.ts:119-180`).
- **Tablas:** `community.conversation_participants` (ya con preferencias), `community.conversations.pinned_message_id`, `community.direct_messages.deleted_at`.
- **Qué hacer:** migrar favoritos y archivados del navegador a `PATCH …/participant`; pintar ✓✓ con `lastMessageReadByPeer`; escuchar `:deleted`, `conversation:typing` y `profile:presence`; emitir `presence:ping`, porque sin ping la presencia vence por TTL; y pasar la búsqueda de la bandeja a `q` + `cursor`. Actualizar `PLAN-CHAT-WHATSAPP.md`.
- **Archivos:** front `core/messaging/chat-socket.service.ts`, `chat.store.ts`, `chat-preferencias.ts`, `core/data-access/community/community.client.ts` + `.types.ts`, y el mock `community.handlers.ts` para no divergir.
- **Gherkin:**
  - Dado que marco una conversación como favorita en un navegador, cuando entro desde otro, entonces sigue marcada.
  - Dado que el otro participante escribe, entonces veo «escribiendo…» en menos de 2 s.
  - Dado que el último mensaje fue leído por el otro, entonces la bandeja muestra ✓✓.

### AG-20 · Un mensaje borrado se pinta como una burbuja vacía
- **Severidad:** Media
- **Tipo:** contrato-respuesta
- **Evidencia front:** `community.client.ts:1846-1848` (`toMessage` no declara `deletedAt`), `chat.store.ts:262-276` (la burbuja se arma con `bodyText`/`attachmentFileId` e ignora `deletedAt`). Tampoco se escucha `conversation:message:deleted`.
- **Evidencia API:** `dto/read-messaging.dto.ts:247` (`DirectMessageDto.deletedAt`) y `:30` (el preview de la bandeja también lo trae); el borrado lógico está en `community-messaging.controller.ts:102`.
- **Tablas:** `community.direct_messages.deleted_at`.
- **Qué hacer:** declarar `deletedAt` en `DirectMessage`/`ConversationPreview` y mostrar «Se eliminó este mensaje»; aplicar el evento `:deleted` sobre la fila.
- **Archivos:** front `community.types.ts`, `community.client.ts`, `chat.store.ts`, y la plantilla del hilo en `features/messaging`.
- **Gherkin:**
  - Dado un mensaje borrado por su autor, cuando el otro abre el hilo, entonces ve «Se eliminó este mensaje» y no una burbuja vacía.
  - Dado el hilo abierto, cuando llega `conversation:message:deleted`, entonces la burbuja cambia sin recargar.

### AG-21 · La campana no sabe abrir SERVICE_REQUEST (y trae un tipo que la API no emite)
- **Severidad:** Media
- **Tipo:** contrato-respuesta
- **Evidencia front:** `core/notifications/notification-routes.ts:30-52`: no está `SERVICE_REQUEST`, así que `rutaDeNotificacion` devuelve null y la notificación de una orden de estudios no navega. Declara en cambio `PHARMACY_RECEIPT`, que la API no emite. `NotificationDestinationType` del front (`data-access/notifications/notifications.types.ts:29-35`) tiene 6 tipos; la API tiene 9.
- **Evidencia API:** `messaging/notifications.contract.ts:80-110` (`PHARMACY_ORDER`, `CARE_RELATIONSHIP_REQUEST`, `SERVICE_REQUEST`, este último de MCH-027).
- **Tablas:** `messaging.in_app_notifications.related_resource_type`.
- **Qué hacer:** agregar `SERVICE_REQUEST → lista de órdenes del paciente`, alinear la unión de tipos del front con el contrato y quitar o marcar `PHARMACY_RECEIPT` como solo del front.
- **Archivos:** front `notification-routes.ts`, `notifications.types.ts` y su spec.
- **Gherkin:**
  - Dada una notificación con destino `SERVICE_REQUEST`, cuando la toco, entonces navego a la lista de órdenes de estudio.
  - Dado un tipo desconocido, entonces la notificación se marca leída y no navega, sin lanzar.

### AG-22 · Notificaciones: polling de 45 s, sin push
- **Severidad:** Baja
- **Tipo:** tiempo-real
- **Evidencia front:** `core/notifications/notifications.store.ts:21` (`INTERVALO_MS = 45_000`, `setTimeout` encadenado, `:234`).
- **Evidencia API:** no hay `@Sse` ni un evento WS de notificación in-app (`grep @Sse|text/event-stream` vacío). El gateway WS existe, pero solo para `community` (`community-messaging.gateway.ts:108`).
- **Tablas:** `messaging.in_app_notifications`.
- **Qué hacer:** decidir el transporte. Lo más barato es reusar el gateway socket.io y emitir `notification:new` a la sala `user:{id}` al crear la in-app; el front ya tiene el socket.
- **Archivos:** API `messaging/services/notifications.service.ts` y el gateway (o uno nuevo). Front `notifications.store.ts`.
- **Gherkin:**
  - Dado que se emite una in-app para mí, cuando tengo la app abierta, entonces el contador de la campana sube en menos de 3 s sin esperar el sondeo.
  - Dado que el socket está caído, entonces el sondeo de 45 s sigue siendo el respaldo.

### AG-23 · La API ofrece funciones de red social que no tienen UI
- **Severidad:** Media
- **Tipo:** otro
- **Evidencia front:** métodos del cliente **sin ningún consumidor** en `features/`, `core/` ni `shared/`: `follow`/`unfollow` (`community.client.ts:407/425`), `block`/`unblock` (`:473/:490`), `listFollows`/`listBookmarks`/`listBlocks`, `readReactions`, `listReviews`, `publishReview`, `respondToReview` (`:814`, así que **el profesional no puede contestar una reseña**), `appealDecision`, `readPoll` (`:1235`). El cliente tampoco tiene métodos para crear una encuesta ni para votar.
- **Evidencia API:** `POST /community/follows|blocks` (`community-social.controller.ts`), `POST /community/profiles/:profileId/reviews/:reviewId/responses` (`community-reviews.controller.ts:95`), `POST /community/posts/:postId/polls` y `POST /community/polls/:pollId/votes` (`community-polls.controller.ts`, DTO `dto/poll.dto.ts:20-72`).
- **Tablas:** `community.social_follows`, `user_blocks`, `review_responses`, `polls`, `poll_options`, `poll_votes`.
- **Qué hacer:** priorizar con producto; para la demo lo mínimo es «Seguir» en la ficha pública y «Responder reseña» en el perfil del profesional.
- **Archivos:** front `features/public-profile/*`, `features/feed/*` y los nuevos `createPoll`/`vote` en `community.client.ts`.
- **Gherkin:**
  - Dado un profesional con una reseña recibida, cuando escribe su respuesta, entonces la ficha pública la muestra debajo de la reseña.
  - Dado un paciente en una ficha pública, cuando toca «Seguir», entonces `GET /community/follows` la incluye.

### AG-24 · Tendencias del muro (P38): sigue abierto
- **Severidad:** Media
- **Tipo:** ruta-faltante
- **Evidencia front:** `PENDIENTES-BACKEND.md:1643-1675`. La columna de tendencias muestra hoy los grupos con más miembros (`GET /community/groups`, `memberCount`).
- **Evidencia API:** no existe `/community/trends` (grep `trends|trending` vacío). `PostListItemDto` no trae `hashtags`: están solo en `PostDetailDto` (`dto/read-social.dto.ts:325-332`).
- **Tablas:** `community.hashtags`, `community.content_hashtags`, `community.social_posts` (**el dato existe en el modelo**; falta la agregación).
- **Qué hacer:** `GET /community/trends?days=&limit=` → `{items:[{tag, posts}]}`, contando `content_hashtags` de posts PUBLIC en la ventana y respetando bloqueos y visibilidad.
- **Archivos:** API `community/controllers/community-topics.controller.ts` (o uno nuevo), un servicio de lectura y su DTO. Front: el cliente y la columna del feed.
- **Gherkin:**
  - Dado que se publicaron 5 posts con #diabetes en 7 días, cuando pido `trends?days=7`, entonces `diabetes` aparece con `posts=5`.
  - Dado un post PRIVATE con #x, entonces no suma a la tendencia.

### AG-25 · Farmacias abiertas 24 h o de turno (P34): el modelo no lo tiene, y `openNow` no lo calcula nadie
- **Severidad:** Media
- **Tipo:** dato-inexistente-en-modelo
- **Evidencia front:** `PENDIENTES-BACKEND.md:172-235`. El filtro de mapa (subtarea E.2) no se implementó.
- **Evidencia API:** `community/dto/public-search.dto.ts:244` declara `openNow: boolean | null` en `PublicPharmacySummaryDto`, pero **ningún servicio o repositorio lo asigna** (grep `openNow` en `src` solo da el DTO). No hay `open_24h` en `pharmacy.pharmacy_sites` (`database/SQL/24_pharmacy/02_tables.sql:25-42`), y `platform_ops.on_call_shifts` es la guardia de la plataforma, no la de una farmacia.
- **Tablas:** `pharmacy.pharmacy_sites` (a extender); habría que crear `pharmacy_on_call_shifts`.
- **Qué hacer:** decisión de producto (quién carga el turno, con qué granularidad y de qué fuente), después `.puml` → DDL → API. Mientras tanto, quitar `openNow` del DTO o documentar que siempre viene null.
- **Archivos:** modelo (módulo 24), `database/SQL/24_pharmacy`, `pharmacy_sites.entity.ts`, `public-search.repository.ts`.
- **Gherkin:**
  - Dada una sede con `open_24h=true`, cuando filtro «24 h», entonces aparece.
  - Dada una sede sin dato, entonces `open24h` viaja null y el front no la presenta como cerrada.

### AG-26 · El mock desalineado de este dominio
- **Severidad:** Baja
- **Tipo:** otro
- **Evidencia front / mock:**
  - `GET /public/comments/:commentId/replies` (el que llama `public-directory.client.ts:342`, usado en `features/public-profile/public-post-comments/public-post-comments.ts:221`) **no tiene manejador**. El mock registra en su lugar `/public/posts/:id/comments/:commentId/replies` (`public.handlers.ts:528`), que nadie llama. Cae en `respuestaGenerica` (`mock-backend.interceptor.ts:297-306`), así que en `mockup` las respuestas de los comentarios públicos siempre salen vacías.
  - `GET /community/conversations/:id/attachments/:fileId/content` (`community.client.ts:363-380`) no tiene manejador. Con `responseType:'blob'`, la respuesta genérica JSON no es una imagen, y los adjuntos del chat no se ven en `mockup` (salvo los stickers, que se pintan locales).
  - `POST /community/reports` del mock devuelve `{id, queued:true}` (`community.handlers.ts:863`); la API devuelve `{id, moderationQueueId}` (`dto/responses.dto.ts:159-173`), que es lo que tipa el front.
  - Rutas de más, inocuas: `POST /community/reactions` (`community.handlers.ts:383`; el cliente y la API usan PUT) y `PATCH /notifications/preferences/me` (`notifications.handlers.ts:173`; el cliente y la API usan PUT).
- **Evidencia API:** `community-public.controller.ts:166-167` (`public/comments/:commentId/replies`).
- **Qué hacer:** renombrar el manejador de respuestas, agregar el de adjuntos de conversación, corregir la respuesta de reports y borrar las dos rutas de más.
- **Archivos:** `core/mock/handlers/public.handlers.ts`, `community.handlers.ts`, `notifications.handlers.ts`.
- **Gherkin:**
  - Dado `mockup`, cuando abro las respuestas de un comentario público, entonces veo las respuestas sembradas y no una lista vacía.
  - Dado `mockup`, cuando reporto un post, entonces el cuerpo trae `moderationQueueId`.

### AG-27 · El filtro `city` solo lo lee `/public/search/organizations`
- **Severidad:** Baja
- **Tipo:** contrato-body (el query param se ignora en silencio)
- **Evidencia front:** `public-directory.client.ts:381-396` (`searchParams` manda `city` a todos los verticales). La pantalla ya lo sabe y filtra del lado cliente (`features/public-directories/public-directory-listing.ts:66-76`).
- **Evidencia API:** `community-public.controller.ts:252-253`: solo organizations tiene `@Query('city')`; pharmacies (`:305`), insurers, diagnostic-units y medications no lo leen.
- **Tablas:** `common.addresses` (ciudad).
- **Qué hacer:** leer `city` en los cinco verticales y quitar el filtrado local (que solo acota lo que ya está en pantalla).
- **Gherkin:**
  - Dada una búsqueda de farmacias con `city=Cochabamba`, entonces todos los ítems tienen `city` = Cochabamba y el cursor pagina dentro de ese filtro.

### AG-28 · Listas que se cortan sin cursor
- **Severidad:** Baja
- **Tipo:** contrato-respuesta
- **Evidencia front:** `features/laboratory-directory/laboratory-directory.ts:443,495` (`limit: 100` y nunca pide `offset`); `public-marketplace.client.ts:40-53` (`/public/medications` sin cursor).
- **Evidencia API:** `diagnostic_units/dto/catalog.dto.ts:25,118-126` (máximo 100, con `offset`); `pharmacy/controllers/pharmacy-public.controller.ts:102-108` (solo `limit`, devuelve `total`).
- **Qué hacer:** paginar con `offset` en el laboratorio; y cursor, o al menos `offset`, en `/public/medications`.
- **Gherkin:**
  - Dados 130 laboratorios publicados, cuando recorro el directorio, entonces llego a ver los 130.

### AG-29 · Socket.io en producción: sin confirmar
- **Severidad:** Baja
- **Tipo:** tiempo-real
- **Evidencia:** front `chat-socket.service.ts:131-134` (`io()` del mismo origen, solo `websocket`); `proxy.conf.json:126` proxya `/socket.io` en dev. API `main.ts:143-152` (`IoAdapter`) y el gateway con `cors:{origin:false}` (`community-messaging.gateway.ts:108`). **Sin confirmar** que el despliegue (ingress o reverse proxy) haga el upgrade de `/socket.io`. Sin él, el chat cae al sondeo de 60 s/30 s.
- **Qué hacer:** verificar el upgrade en el entorno de demo y documentarlo.
- **Gherkin:**
  - Dado el entorno de demo, cuando abro Chats, entonces el socket queda `connected=true` y un mensaje llega sin esperar el sondeo.

---

### Pendientes de los documentos previos: qué se cerró en `dev` (con evidencia) y qué sigue abierto

| Ítem | Estado hoy | Evidencia |
|---|---|---|
| `PENDIENTES-RED-SOCIAL` H1 (cero lecturas) / H3 (worker de fan-out) | Cerrado | 17+ `@Get` en `community/controllers`; worker `internal/community/feed` |
| H2 (cero superficie pública) | **Cerrado** (el doc dice abierto) | `community-public.controller.ts:105-525` con `@Public()` y `@Throttle` |
| H5 (cero frontend) | Cerrado | `features/feed`, `groups`, `communities`, `messaging`, `public-profile`, `admin/moderation` |
| F8 (sin WebSocket) | Cerrado para el chat; **abierto** para la campana (AG-22) | `community-messaging.gateway.ts` |
| F9 (moderación sin lecturas) | Cerrado; **abierto** para la apelación del autor (AG-18) | `community-moderation.controller.ts:109-133` |
| F1.2 (roles) | Resuelto así: lecturas y escrituras con sesión, moderación con `SECURITY_ADMIN`, reseña propia con `PATIENT` | `patient-reviews.controller.ts:42` |
| F3 (OpenSearch) | Parcial: existe `internal/community/search` (`community-search-index.controller.ts`); cobertura sin confirmar | — |
| `REGISTRO-DEFECTOS` A-04 (grupo sin dueño) | **Cerrado** | `community-groups.service.ts:219-230` crea al dueño en la misma transacción |
| `PLAN-CHAT-WHATSAPP` F4.1–F4.6 | **Cerrado en la API**; el front no lo adoptó (AG-19) | ver AG-19 |
| P30 / P31 / P37 | Abiertos | AG-15, AG-16 |
| P34 | Abierto (modelo) | AG-25 |
| P38 | Abierto | AG-24 |
| `PREGUNTAS-CARRIL-B` (agenda → mensajería, `debounce_key`, canal IN_APP) | Fuera de esta parte (del lado de los avisos de agenda); la #9 («qué tabla materializa la conversación de SupportAdmin») sigue sin respuesta | `PREGUNTAS-EQUIPO-CARRIL-B-2026-09-20.md:44-62` |

### Llamadas verificadas OK (ruta, método, body y forma de la respuesta)

| Llamada | Nota |
|---|---|
| `GET/PUT /community/profiles/me`, `GET/PUT /community/profiles/:id/auto-reply` | El body coincide con `UpsertOwnPublicProfileDto` y `UpsertChatAutoReplyDto` |
| `POST /community/profiles/:id/posts` | `bodyText, visibility, commentsEnabled, hashtags` ⊂ `CreatePostDto` |
| `POST /community/comments` | `commentableType:'POST'` + `media[{fileId,mediaRole,altText}]` ⊂ `CreateCommentDto` |
| `PUT /community/reactions` | = `ReactionDto` (las enums coinciden) |
| `POST/DELETE /community/follows|bookmarks|blocks` y sus GET | Coinciden (no hay UI: AG-23) |
| Moderación: queue, decisions y appeals (GET y POST) | Body y respuesta coinciden (`ReportResponseDto`, `ModerationDecisionResponseDto`) |
| Reseñas: `POST /patients/me/reviews` y `/community/profiles/:id/reviews` | `CreateReviewDto` coincide; `@Roles('PATIENT')` en la propia |
| Grupos: CRUD, members (PATCH por membershipId, DELETE por profileId), wall, topics | Coinciden, incluida la semántica de `:member` |
| Chat: `GET/POST /community/conversations`, messages, PATCH edit, `POST read`, `GET …/attachments/:fileId/content` | `SendMessageDto`, `EditMessageDto` y `MarkReadDto` coinciden |
| `GET /community/conversations/:id` | **Falso positivo del inventario**: el front no lo llama; es la concatenación de `…/:id` + `/attachments/…` en `community.client.ts:372` |
| `GET /community/polls/:id` | Existe; no hay crear ni votar (AG-23) |
| Notificaciones: `GET /notifications/me`, `POST in-app/:id/read`, `read-all`, `GET/PUT preferences/me` | El cliente usa **PUT**, como la API. `UpdateMyPreferencesDto` coincide (categorías `CLINICAL/SCHEDULING/MESSAGES/SOCIAL`, `quietHours HH:mm`) |
| Públicas: `/public/posts`, `/public/posts/:id/reactions|comments`, `/public/comments/:id/replies`, `/public/search*`, `/public/nearby`, `/public/profiles/:prefijo/:slug(/reviews)`, `/public/directory` | La envoltura `{items,nextCursor,totalHint,generatedAt}` y los campos de `PublicDirectoryProfileDto` coinciden |
| `/public/medications`, `/public/medications/:conceptId/availability` | Campo a campo = `PublicMedicationPageDto` y `PublicMedicationAvailabilityDto` (salvo la paginación: AG-28) |
| `/diagnostic-units/search` (directorio de laboratorios) | Query ⊂ `SearchDiagnosticUnitsQueryDto`; `limit=100` ≤ `CATALOG_MAX_LIMIT` |
| Socket: `join:inbox`, `join:conversation`, `leave:conversation`; eventos `conversation:message|:updated|read|new` | Coinciden con el gateway; faltan los eventos de AG-19 |
| `core/tutorials` | No llama a la API (estado local) |


## Parte C — farmacia, laboratorios, seguros, finanzas del médico, geo y portal admin

Auditoría de solo lectura, 2026-09-24. Front `mantra-core-health` en `mockup` (9b3e0101); API `mantra-core-health-redesa-api` en `dev` (7541797c, incluye el PR #451).
Todas las rutas del front salen de `calls-all.tsv` y `lits.tsv`, y además se leyeron los clientes a mano (varios arman la URL con un helper y el extractor no las ve).
La API corre con `ValidationPipe({ whitelist, forbidNonWhitelisted, transform })`, confirmado en `src/main.ts:159-164`: un campo de más en el body devuelve 400.

**Fuera de alcance, solo se anota:**
- La pasarela de pago: `estaPagado` y `pago` en `pharmacy-orders.client.ts:238`; `PatientSettlementFields` sí se revisó.
- Delivery y envío a domicilio: `DELIVERY_MODES` incluye `DOMICILIO`/`TRABAJO` en `pharmacy-orders.dto.ts:41`, y el cliente solo admite `RETIRO`.
- El rastreo de `geo`: trips, pings y geocercas son la infraestructura del delivery.

---

### AG-30 · Las 47 rutas de visitadores, visitas, agenda y encuestas de laboratorio responden 500 contra cualquier base del pipeline
- **Severidad:** Bloqueante demo (cuando la demo apunta a la API real).
- **Tipo:** dato-inexistente-en-modelo.
- **Evidencia del front:** `core/data-access/pharma-lab/pharma-lab.client.ts:60-240`. Son 21 llamadas: `/pharma-labs*`, `/visit-agenda/*`, `/visit-requests*` y `/visit-records*`. En `mockup` las sirve `core/mock/handlers/pharma-lab.handlers.ts:129-254`.
- **Evidencia de la API:**
  - `src/modules/pharma_lab/` tiene 31 entidades con `schema: 'pharma_lab'` y 13 controladores.
  - No existe `diagram_*_pharma_lab.puml`.
  - No hay `CREATE TABLE "pharma_lab".` ni en `SQL/` ni en `database/SQL/`, patches incluidos.
  - `database/README.md:60-64` dice textualmente: «`pharma_lab` entero … es B-8 de `REGISTRO-DEFECTOS.md`, todavía abierto».
  - El defecto está registrado en `REGISTRO-DEFECTOS.md:324-339` como B-8.
- **Tablas del modelo:** ninguna. También faltan las historias `audit.pharma_lab_staff_history`, `pharma_products_history`, `regulatory_documents_history` y `visit_requests_history`.
- **Qué hacer:** promover el módulo por el camino canónico.
  1. Escribir `diagram_NN_pharma_lab.puml` transcribiendo las 31 entidades.
  2. Correr `gen_ddl.py` para generar `SQL/NN_pharma_lab/` y copiarlo a `database/SQL` con `yarn db:vendor`.
  3. Declarar el schema en el catálogo ORM y agregar los seeds de conceptos `PHL_*`.
  4. Mientras tanto, la demo del visitador tiene que correr en `mockup`.
- **Archivos:**
  - Crear: `Mantra Core Health Context/modules/diagram_NN_pharma_lab.puml` y `SQL/NN_pharma_lab/*`.
  - Modificar: `mantra-core-health-redesa-api/database/SQL/*` (con vendor), `src/orm/catalog/*` y `salud-db/gen_seeds.py` (value sets `PHL_*`).
- **Gherkin:**
  - Dado un stack reconstruido con `rebuild_stack.py --yes`, cuando un `PRACTITIONER` hace `GET /visit-agenda/me`, entonces responde 200 o 404 de dominio, nunca 500 `relation "pharma_lab.…" does not exist`.
  - Dado el arranque con `ORM_SCHEMA_SYNC=dry-run`, entonces la deriva ya no lista tablas `pharma_lab`.
  - Dado un visitador vinculado, cuando hace `POST /visit-requests` con un body válido, entonces recibe 201 con `id`.

### AG-31 · Los roles `MEDICAL_VISITOR` y `PHARMA_LAB_ADMIN` no los emite ninguna parte de la API
- **Severidad:** Alta.
- **Tipo:** autorización.
- **Evidencia del front:**
  - `core/auth/role-labels.ts:25,30` les pone nombre.
  - El mock decide «soy visitador» con `request.user?.roles.includes('MEDICAL_VISITOR')` en `pharma-lab.handlers.ts:125`.
- **Evidencia de la API:**
  - Hay `@Roles('MEDICAL_VISITOR')` en `pharma_lab/controllers/visit-requests.controller.ts` (3 rutas) y `visit-records.controller.ts`, y `@Roles('PHARMA_LAB_ADMIN', …)` en `pharma-labs.controller.ts` y `medical-visitors.controller.ts`.
  - Un `grep` de `MEDICAL_VISITOR|PHARMA_LAB_ADMIN` fuera de `modules/pharma_lab`, en `src/`, `database/`, `seedsGenerales/` y `salud-db/`, da 0 resultados.
  - Solo el comodín `SUPERADMIN` pasa esas guardas.
  - Sin confirmar: si existe un camino administrativo (authz) para asignar un código de rol libre.
- **Tablas:** `iam.*` y `authz.*` (asignación de roles); `directory` (membresía al tenant del laboratorio).
- **Qué hacer:**
  1. Sembrar los dos roles (y `REGULATORY_AFFAIRS` y `PHARMACOVIGILANCE_OFFICER`, que también usan `pharma-catalog` y `pharmacovigilance`).
  2. Resolver cómo llegan al token: por membresía del tenant laboratorio o por rol global.
  3. Que el alta de un visitador (`POST /pharma-labs/:id/medical-visitors`) otorgue el rol.
- **Archivos:** `salud-db/gen_seeds.py` (roles), el servicio de login de `iam` que arma `roles[]`, y `pharma_lab/services/medical-visitors.service.ts`.
- **Gherkin:**
  - Dado un usuario dado de alta como visitador de un laboratorio, cuando inicia sesión, entonces su token trae `MEDICAL_VISITOR`.
  - Dado ese token, cuando hace `GET /visit-requests/mine`, entonces responde 200.
  - Dado un `PATIENT`, cuando hace `GET /visit-requests/mine`, entonces responde 403.

### AG-32 · El mostrador de la farmacia exige `SECURITY_ADMIN`: el personal de la farmacia recibe 403 en toda la bandeja
- **Severidad:** Alta. Pasa a Bloqueante demo si la demo entra con un usuario de farmacia que no sea admin.
- **Tipo:** autorización.
- **Evidencia del front:**
  - La ruta `administration/pharmacy-orders` (`app.routes.ts:214-217`) y su hija `:orderId` (`app.routes.ts:492-497`) dan acceso «por membresía» con `seccionRolesGuard`.
  - La pantalla llama a `pedidosDeFarmacia()` (`features/organization/pharmacy-inbox/pharmacy-inbox.ts:202,361`), `abrirRevision` (`inbox-order.ts:354`) y `marcarListo` (`inbox-order.ts:437`).
- **Evidencia de la API:**
  - `pharmacy_inventory/controllers/pharmacy-orders.controller.ts`: `@Roles('SECURITY_ADMIN')` en GET `/` (l.59-60), `:id/review` (161-162), `:id/confirm` (177-178), `:id/reject` (232-233), `:id/ready` (253-254) y `:id/dispense` (273-274).
  - El JSDoc de l.53-57 dice «`SECURITY_ADMIN` es **provisional**: no existe todavía un rol runtime de farmacia».
  - `REGISTRO-DEFECTOS.md:453` confirma que «quien atiende el mostrador de una farmacia no tiene rol propio en el token».
- **Tablas:** `pharmacy_inventory.patient_orders` (patch v4.2.1 `2026-08-27_v421_pharmacy_patient_orders.sql`), `directory.tenant_memberships`.
- **Qué hacer:** definir el rol runtime de farmacia (FAR-E2, p. ej. `PHARMACIST`/`PHARMACY_STAFF`, sin confirmar el nombre) o autorizar por membresía activa al tenant de la farmacia. Luego reemplazar `SECURITY_ADMIN` en las 6 rutas. El filtro por tenant en el WHERE ya existe.
- **Archivos:** `pharmacy_inventory/controllers/pharmacy-orders.controller.ts`, seeds de roles y, en el front, `core/navigation/access-tree.ts` si el nuevo rol se usa como filtro.
- **Gherkin:**
  - Dado un empleado con membresía activa en la farmacia F y sin `SECURITY_ADMIN`, cuando hace `GET /pharmacy/orders`, entonces recibe 200 solo con los pedidos de F.
  - Dado el mismo empleado, cuando hace `POST /pharmacy/orders/{id}/ready` sobre un pedido `CONFIRMADO` de F, entonces el pedido pasa a `LISTO_PARA_RETIRO`.
  - Dado un empleado de la farmacia G, cuando hace `POST /pharmacy/orders/{idDeF}/ready`, entonces recibe 404 o 403.

### AG-33 · `mark-ready` y `keep-original` son alias muertos del simulador (lo que se había pedido revisar)
- **Severidad:** Baja.
- **Tipo:** otro (deuda del mock).
- **Evidencia del front:**
  - El cliente arma la URL con `postOrder(id, action)` → `${orderUrl(id)}/${action}` (`pharmacy-orders.client.ts:179-183`).
  - Las acciones que usa son `ready` (l.159-161), `prefer-original` (l.91-93), `accept-substitutions`, `cancel` y `review`.
  - `mark-ready` y `keep-original` no los emite ningún código del front: solo existen en `core/mock/handlers/pharmacy.handlers.ts:387` y `:399`, duplicando `:386` y `:404`.
- **Evidencia de la API:** `POST /pharmacy/orders/:id/ready` y `/:id/prefer-original` existen (`pharmacy-orders.controller.ts:253`, `:216`). Contrato alineado.
- **Tablas:** `pharmacy_inventory.patient_orders`, `patient_order_substitutions`.
- **Qué hacer:** borrar los dos alias del mock para que `mock-missing.json` deje de reportarlos y nadie los tome como contrato.
- **Archivos:** `src/app/core/mock/handlers/pharmacy.handlers.ts`.
- **Gherkin:**
  - Dado el simulador, cuando se pide `POST /pharmacy/orders/{id}/mark-ready`, entonces responde 404 como la API real.
  - Dado el cliente, cuando la farmacia marca un pedido listo, entonces la petición es `POST …/ready`.

### AG-34 · El simulador de disponibilidad lee `productIds` y el cliente manda `products`: la maqueta nunca prueba la consulta real
- **Severidad:** Media.
- **Tipo:** contrato-body (del mock).
- **Evidencia del front:**
  - `core/data-access/pharmacy/pharmacy.client.ts` en `availability()` hace `params.set('products', …)`.
  - El mock lee `texto(query, 'productIds')` en `core/mock/handlers/pharmacy.handlers.ts:288`, así que en `mockup` la lista pedida llega siempre vacía.
  - El mock además cruza por `medicationConceptId` entre farmacias; la API cruza por `productId`.
- **Evidencia de la API:** `@ApiQuery({ name: 'products' … })` en `pharmacy_inventory/controllers/pharmacy-inventory-read.controller.ts:56-80`; servicio en `pharmacy-inventory-read.service.ts:172-281`. El front está bien y el mock está mal.
- **Tablas:** `pharmacy_inventory.stock_*`, `pharmacy.pharmacy_products`, `pharmacy.pharmacy_sites`.
- **Qué hacer:** que el mock lea `products` y cruce por `productId` como la API. Agregar un spec que falle si el nombre del parámetro diverge.
- **Archivos:** `core/mock/handlers/pharmacy.handlers.ts` y un spec nuevo `pharmacy.handlers.spec.ts`.
- **Gherkin:**
  - Dada una receta con dos productos, cuando «Dónde comprar» consulta la disponibilidad en `mockup`, entonces `requestedProductIds` trae los dos ids.
  - Dado un producto sin stock en la sede S, entonces S figura con `complete=false` y ese id en `missingProductIds`.

### AG-35 · Cotizaciones: el front manda los importes como `number` y la API exige texto numérico → 400 en todo alta
- **Severidad:** Bloqueante demo (contra la API real no se puede guardar ninguna cotización).
- **Tipo:** contrato-body.
- **Evidencia del front:**
  - En `core/data-access/quotations/quotations.types.ts` son `number`: `Installment.amount` (l.19), `NewQuotation.offeredPrice` (l.35) y `downPaymentAmount` (l.39).
  - `features/quotations/quotation-form/quotation-form.ts:684-698` los manda así (`offeredPrice: precio`, `downPaymentAmount: this.anticipo() ?? 0`) y `toInstallments` hace lo mismo con las cuotas.
  - El mock (`finance.handlers.ts:1137-1165`) los acepta como números y oculta el problema.
- **Evidencia de la API:** `quotations/dto/create-quotation.dto.ts` pone `@IsNumberString()` en `installments[].amount` (l.63-65), `offeredPrice` (l.122-124) y `downPaymentAmount` (l.151-153). Un `number` de JSON falla `IsNumberString`, y el `enableImplicitConversion` no convierte a string un valor declarado `string`: sin confirmar en runtime, pero es el comportamiento documentado de class-transformer.
- **Tablas:** `billing.quotations` y `billing.quotation_installments` (patch `2026-09-18_v4218_quotations_flexible_payment_plan.sql`). **P35 está cerrado en el modelo y en el DTO**; el que quedó desalineado es el front.
- **Qué hacer:** tipar los tres importes como `string` en el front, con dos decimales, igual que el resto del repo («importes como texto»). Que el mock valide con la misma regla.
- **Archivos:** `quotations.types.ts`, `quotation-form.ts`, `flexible-payment-plan.ts`, `payment-plan-panel.ts` (lee `offeredPrice`) y `core/mock/handlers/finance.handlers.ts`.
- **Gherkin:**
  - Dado un servicio de 1500.00 BOB, anticipo 300 y 3 cuotas de 400, cuando el médico guarda, entonces el body lleva `"offeredPrice":"1500.00"` y la API responde 201.
  - Dado un body con `offeredPrice: 1500` (número), cuando llega a la API, entonces es 400 y el simulador también responde 400.

### AG-36 · Cotizaciones: la respuesta trae `statusConceptId`, no `status`, y no trae `patientName`
- **Severidad:** Media.
- **Tipo:** contrato-respuesta.
- **Evidencia del front:**
  - `quotations.types.ts:72,84` espera `status: string`.
  - `features/quotations/quotation-list/quotation-list.html:65` hace `<app-badge [value]="cotizacion.status">`: contra la API el badge queda vacío.
  - El mock inventa `status: 'DRAFT'` y `patientName` en el listado (`finance.handlers.ts:1158,1171`).
- **Evidencia de la API:**
  - `quotations/dto/quotation-response.dto.ts:114` devuelve `statusConceptId` (uuid) y `createdAt` (Date).
  - `GET /quotations` devuelve `QuotationResponseDto[]` completos (`controllers/quotations.controller.ts:67-79`), no un resumen.
- **Tablas:** `billing.quotations.status_concept_id` → `terminology.concepts`.
- **Qué hacer:** que la API agregue `status: { code, display }` a la respuesta (patrón `InventoryConceptDto`), o que el front resuelva el concepto. Sacar `patientName` y `status` literal del mock.
- **Archivos:** API `quotations/dto/quotation-response.dto.ts` y `services/quotations.service.ts`. Front `quotations.types.ts`, `quotation-list.*` y `finance.handlers.ts`.
- **Gherkin:**
  - Dada una cotización recién creada, cuando se lista, entonces el badge muestra el estado en palabras («Borrador»), no vacío ni un uuid.
  - Dado el listado real, entonces no se lee ningún campo que la API no devuelve.

### AG-37 · Cotizaciones: `GET /quotations?patientProfileId` y `GET /quotations/:id` no tienen rol ni verifican de quién es el dato
- **Severidad:** Alta (fuga de datos entre pacientes y profesionales).
- **Tipo:** autorización.
- **Evidencia del front:** `quotations.client.ts` en `listQuotationsByPatient` y `getQuotation`. Lo consumen `payment-plan-panel.ts:195-201` y `quotation-list.ts:152`.
- **Evidencia de la API:**
  - `quotations/controllers/quotations.controller.ts:67-93`: sin `@Roles`.
  - `services/quotations.service.ts:165-191` busca por id o por paciente sin filtrar por tenant, práctica ni actor.
  - Sin confirmar si la RLS de tenant (`2026-07-30_tenant_rls.sql` y sucesores) cubre `billing.quotations`.
- **Tablas:** `billing.quotations` (`practice_id`, `patient_profile_id`, `created_by_practitioner_profile_id`).
- **Qué hacer:** agregar `@Roles('PRACTITIONER','CLINICIAN','PATIENT')`. Filtrar por práctica del actor (profesional) o por `patientProfileId` propio (paciente). Responder 404 si no le pertenece.
- **Archivos:** `quotations/controllers/quotations.controller.ts`, `services/quotations.service.ts`, `repositories/*` y un int-spec nuevo.
- **Gherkin:**
  - Dado el paciente A, cuando pide `GET /quotations?patientProfileId=<B>`, entonces 403 o una lista vacía.
  - Dado el médico M de la práctica P, cuando pide una cotización de otra práctica, entonces 404.
  - Dado el médico M, cuando lista las de su paciente en P, entonces 200.

### AG-38 · Cockpit contable: amortización, devengo y compensación mandan un body que la API rechaza (400) y esperan otra respuesta
- **Severidad:** Alta. Bloqueante demo si se muestra el cockpit o el «Cobrado/Pagado» del resumen del médico.
- **Tipo:** contrato-body y contrato-respuesta.
- **Evidencia del front (`core/data-access/accounting/accounting.client.ts`):**

  | Método | Body que manda | Respuesta que espera |
  | --- | --- | --- |
  | `runDepreciation` (l.359) | `{ practiceId }` | `RunResult {amount, periodName, assets, transactionNumber}` |
  | `runAccruals` (l.371) | `{ practiceId }` | `RunResult {…, objects}` |
  | `clearOpenItems` (l.304) | `{ openItemIds }` | `ClearingResult {clearingDocumentId, clearedItems, clearedAmount}` |
  | `lockFiscalPeriod` (l.289) | `{}` | un `FiscalPeriod` |

  - Los llaman `features/accounting/cockpit/cockpit.ts:361,388,411` y `features/accounting/resumen/resumen.ts:484`, que es el botón «Cobrado/Pagado» del médico.
  - `cockpit.ts:417` hace `r.clearingDocumentId.slice(0, 8)`: con la respuesta real revienta con TypeError.
  - El mock (`finance.handlers.ts:686,780,848,627`) acepta esos bodies.
- **Evidencia de la API:**
  - `RunDepreciationDto` exige `practiceId`, `fiscalPeriodId` y `depreciationExpenseAccountId` (`accounting/dto/asset.dto.ts:123-146`) y responde `{depreciatedAssets, transactionIds}` (l.202-210).
  - `RunAccrualsDto` exige `accrualObjectId`, `fiscalPeriodId`, `practiceId` y `postingDate` (`dto/accrual.dto.ts:134-164`) y responde `{postedLines, transactionIds}`.
  - `CreateClearingDto` exige `tenantId`, `practiceId`, `bankAccountId`, `clearingDate` e `items[{openItemId, clearedAmount…}]`, y no declara `openItemIds`, así que es 400 por whitelist (`dto/subledger.dto.ts:127-170`). Responde `{id, clearingNumber, transactionId}` (l.213-225).
  - `lock` responde `AccountingStatusDto {ok,id}` (`dto/journal.dto.ts:411-419`).
- **Tablas:** `accounting.fixed_assets`, `depreciation_runs`, `accrual_objects`, `open_items`, `clearing_documents`, `fiscal_periods` y `journal_transactions`.
- **Qué hacer:** decidir de qué lado se acomoda.
  - Opción a: la API agrega variantes «de práctica» que resuelven período, cuentas y banco por defecto (lo que el cockpit supone).
  - Opción b: el front pide y manda los campos obligatorios y mapea las respuestas reales.
  - En los dos casos, alinear el mock.
- **Archivos:** `accounting.client.ts`, `accounting.types.ts` (`RunResult`, `ClearingResult`), `cockpit.ts`, `resumen.ts` y `finance.handlers.ts`; o, del lado API, `accounting-asset.controller.ts`, `accounting-accrual.controller.ts` y `accounting-subledger.controller.ts` con sus DTOs.
- **Gherkin:**
  - Dado un período abierto y un activo depreciable, cuando se corre la amortización desde el cockpit, entonces la API responde 201 y el toast muestra el período y el importe, sin «undefined».
  - Dada una partida abierta por cobrar, cuando el médico pulsa «Cobrado», entonces se crea un documento de compensación y la partida desaparece del listado.
  - Dado un body con `openItemIds`, cuando llega a la API real, entonces el simulador también responde 400.

### AG-39 · Cockpit contable: acciones que la pantalla ofrece al médico y la API reserva a `SECURITY_ADMIN`/`ACCOUNTING_APPROVER`
- **Severidad:** Alta.
- **Tipo:** autorización.
- **Evidencia del front:**
  - `accounting.ts:217-221,894-898` sí filtra `postJournal` para que solo lo vea SECURITY_ADMIN.
  - En cambio `cockpit.ts` no tiene ningún filtro de roles (no hay `auth` ni `roles` en el archivo) y ofrece amortizar, devengar, cerrar período, compensar y `advanceWorkflow` con `approve`, `post` y `reverse` (l.312,335,361,388,411).
  - `resumen.ts:484` (compensar) es la vista del médico.
- **Evidencia de la API:**
  - `@Roles('SECURITY_ADMIN')` en `depreciation/run` (`accounting-asset.controller.ts:38`), `accruals/run` (`accounting-accrual.controller.ts:38`), `clearing-documents` (`accounting-subledger.controller.ts:38`), `fiscal-periods/:id/lock` (`accounting-fiscal.controller.ts:46`) y `:id/post` y `:id/reverse` (`accounting-ledger.controller.ts`).
  - `:id/approve` admite `SECURITY_ADMIN` o `ACCOUNTING_APPROVER`.
- **Tablas:** idem AG-38.
- **Qué hacer:** ocultar o deshabilitar en el cockpit y en el resumen las acciones según `auth.roles()`, igual que `accounting.ts`. Si el médico tiene que poder saldar su partida, habilitar `PRACTITIONER` en `clearing-documents`, acotado a su práctica.
- **Archivos:** `features/accounting/cockpit/cockpit.ts` y su `.html`, `features/accounting/resumen/resumen.ts`; API `accounting-subledger.controller.ts` si se amplía el rol.
- **Gherkin:**
  - Dado un `PRACTITIONER`, cuando abre el cockpit, entonces no ve «Amortizar», «Devengar», «Cerrar período» ni «Postear/Revertir».
  - Dado un `ACCOUNTING_APPROVER`, cuando aprueba un documento en revisión, entonces 200.
  - Dado un `PRACTITIONER`, cuando marca «Cobrado» una partida de su práctica, entonces se salda (si se habilita), o el botón no existe.

### AG-40 · Campañas de farmacia: no hay ninguna lectura en la API y el build de producción las fabrica por defecto
- **Severidad:** Media.
- **Tipo:** ruta-faltante y dato-inexistente-en-modelo.
- **Evidencia del front:**
  - `core/data-access/pharmacy-campaigns/pharmacy-campaigns.client.ts:36-72`: «**sin backend y con gate de demo**». Siembra con `CAMPANAS_SEMBRADAS` y sincroniza por `BroadcastChannel`.
  - El gate `readonly activo = environment.campaignsDemo` (l.82) vale `true` en `environments/environment.ts:58`, que es el entorno de **producción** («Entorno por defecto (producción)»), salvo que el `.env` diga otra cosa.
  - Solo `environment.real-api.ts:45` lo pone en `false`.
  - `features/account/promotions/promotions.fixtures.ts` reutiliza los mismos fixtures.
- **Evidencia de la API:** `promotions` y `marketing` publican solo `POST` (`POST /promotions`, `/promotions/:id/coupons/batch`, 13 `POST /marketing/*`). No hay ningún GET de campañas y nada vincula campaña con producto: `discount_rules.target_filter_json` no se lee, según el propio JSDoc del cliente; el modelo no se verificó más allá.
- **Tablas:** `promotions.*` y `marketing.campaigns`. El vínculo campaña → `pharmacy.pharmacy_products` no existe en el modelo.
- **Qué hacer:**
  1. Poner `campaignsDemo: false` como default de `environment.ts`, para que solo el perfil mockup o dev lo encienda.
  2. Pedir al modelo el vínculo campaña ↔ productos de farmacia y las lecturas `GET` (propias de la farmacia y públicas vigentes).
- **Archivos:** `src/environments/environment.ts` y `scripts/generate-env.mjs`; en el modelo, `.puml` de promotions/marketing; en la API, `promotions/controllers/*`.
- **Gherkin:**
  - Dado un build de producción sin variables, cuando un paciente abre la ficha de una farmacia, entonces no ve ninguna campaña sembrada.
  - Dada una campaña creada por la farmacia vía API, cuando el paciente abre la ficha, entonces la ve con su vigencia.

### AG-41 · P34: no hay forma de saber qué farmacia abre 24 h ni cuál está de turno (sigue abierto)
- **Severidad:** Media.
- **Tipo:** dato-inexistente-en-modelo.
- **Evidencia del front:**
  - `PENDIENTES-BACKEND.md:172-233`. El directorio no muestra el filtro, a propósito.
  - El corpus del mock tiene `openingHours` libre («24 horas, todos los días») en `core/mock/fixtures/bolivia-eje-central.generated.ts:666-723`, y `public-catalog.types.ts:103` lo expone.
- **Evidencia de la API:**
  - `pharmacy.pharmacy_sites` (`database/SQL/24_pharmacy/02_tables.sql:25-42`) no tiene `open_24h`, horario ni turno.
  - `grep open_24|on_call|opening_hours` sobre `SQL/24_pharmacy` y los patches da 0 resultados.
- **Tablas:** propuestas en P34: `pharmacy_sites.open_24h boolean NULL` y `pharmacy_on_call_shifts(pharmacy_site_id, starts_at, ends_at, source_concept_id)`. No existen.
- **Qué hacer:** que producto decida las 3 preguntas de P34 (quién carga el turno, granularidad, caducidad). Después, `.puml` → DDL → `GET /public/search/pharmacies?open24h&onCall`.
- **Archivos:** `diagram_24_pharmacy.puml`, `SQL/24_pharmacy/*`, `pharmacy/dto/read-responses.dto.ts` y `community-public.controller.ts` (`searchPharmacies`).
- **Gherkin:**
  - Dada una sede con `open_24h = true`, cuando se busca con el filtro «24 horas», entonces aparece.
  - Dada una sede con un turno vencido, cuando se busca «de turno», entonces no aparece.

### AG-42 · P37: las sucursales de una cadena y la disponibilidad de una receta en texto solo existen en el simulador
- **Severidad:** Media. Se superpone con la auditoría de directorios públicos.
- **Tipo:** ruta-faltante y dato-inexistente-en-modelo.
- **Evidencia del front:**
  - `core/data-access/public-catalog/public-catalog.client.ts:87` (`/public/profiles/f/:slug/branches`) y `:114-116` (`/branch-availability?items=a|b&lat&lng`).
  - La cadena sale de `fixtures/bolivia-eje-central.ts`, según `PENDIENTES-BACKEND.md:1636-1642`.
- **Evidencia de la API:** no existe. Solo están `GET /public/profiles/:prefijo/:slug` y `/reviews` (`community/controllers/community-public.controller.ts`). `GET /pharmacy-inventory/availability` existe, pero con sesión y por `productId`.
- **Tablas:** `directory` no declara el vínculo cadena → sucursal para farmacias. `pharmacy.pharmacies` 1-N `pharmacy.pharmacy_sites` podría servir como «sucursales» (sin confirmar que ese sea el significado de negocio).
- **Qué hacer:** exponer `pharmacy_sites` de la farmacia del slug como página pública, y una versión pública de `availability` que acepte términos de texto (búsqueda por genérico/marca) acotada a esas sedes.
- **Archivos:** `community-public.controller.ts` o un `pharmacy-public.controller.ts` nuevo, y `pharmacy_inventory/services/pharmacy-inventory-read.service.ts`.
- **Gherkin:**
  - Dada una farmacia con 3 sedes, cuando se pide `/public/profiles/f/<slug>/branches`, entonces vienen 3 con `isCurrent` marcando la mirada.
  - Dada una receta «amoxicilina|ibuprofeno», cuando se consulta la disponibilidad con `lat/lng`, entonces vienen primero las completas y, entre ellas, la más cercana.

### AG-43 · Visitas médicas: la API publica encuestas, registro, confirmación, calificación y reprogramación, y el front no las consume
- **Severidad:** Media. Queda detrás de AG-30.
- **Tipo:** ruta-faltante (del lado del front).
- **Evidencia del front:** `pharma-lab.client.ts` no tiene llamadas a `/visit-surveys/*`, `POST /visit-records`, `/visit-records/:id/confirm`, `/rating`, `/visit-requests/:id/propose-time`, `/reschedule`, `/request-info`, `/visit-agenda/blocks` ni `/pharma-labs/:id/visitor-posts`. Un `grep` de `visit-surveys` en `src/app` da 0 resultados.
- **Evidencia de la API:** `pharma_lab/controllers/visit-surveys.controller.ts` (7 rutas), `visit-records.controller.ts` (confirm, rating, create) y `visit-requests.controller.ts` (propose-time, reschedule, request-info).
- **Tablas:** `pharma_lab.*` (inexistentes, ver AG-30).
- **Qué hacer:** cerrar primero AG-30 y AG-31. Después, completar el cliente y las pantallas del ciclo (el visitador registra, el médico confirma y califica, el laboratorio encuesta).
- **Archivos:** `pharma-lab.client.ts`, `pharma-lab.types.ts`, `pharma-lab.handlers.ts` y `features/pharma-lab/*` (sin confirmar la ruta exacta).
- **Gherkin:**
  - Dada una visita aceptada y realizada, cuando el visitador la registra, entonces el médico la ve en `/visit-records/inbox` para confirmar.
  - Dada una encuesta publicada por el laboratorio, cuando el médico la abre desde pendientes, entonces puede responderla una sola vez.

### AG-44 · Portal admin (PR #451): las rutas `/admin/catalog`, `/admin/analytics`, `/admin/qa` y `/admin/ops` ya existen — cierres y residuos
- **Severidad:** Baja.
- **Tipo:** otro.
- **Qué quedó cerrado:**
  - El `mock-vs-api.json` anterior listaba 40 rutas de `admin-portal.handlers.ts` sin par. Hoy existen todas las que llama el front: `data_catalog/controllers/data-catalog.controller.ts:57-310`, `telemetry/controllers/telemetry-analytics.controller.ts:118-176`, `qa_lab/controllers/qa-lab-read.controller.ts:57-99`, `qa_execution/controllers/qa-execution.controller.ts:58-130` y `ops_console/ops-console.controller.ts:49-104`.
  - Bodies y queries verificados campo a campo: `ListObjectsQueryDto` = `CatalogObjectsQuery`; `ReviewAnnotationDto` = `ReviewInput`; `AddEvidenceDto` = `EvidenceInput`; `ImpactQueryDto` (`direction`/`depth`); `AnalyticsWindowQueryDto` (`from`/`to`/`interval`/`portal`) = `AnalyticsWindowQuery`; `SessionsPage {items,nextCursor,limit}` con cursor; y las listas de qa y ops son arreglos, como espera el front.
- **Residuos:**
  1. `AnnotationPatch` (`admin-portal/data-catalog.types.ts:304`) no declara `processSupported`, `producers` ni `sourceOfTruth`, que `UpsertAnnotationDto` sí acepta: la UI no puede editarlos. No causa 400.
  2. Los DDL de `data_catalog` y `qa_execution` están escritos a mano en `database/SQL/patches/2026-09-18_v4219_data_catalog.sql` y `2026-09-18_v4220_qa_execution.sql`, sin `.puml`. Es un desvío de ADR-0021 declarado en `docs/adr/ADR-0024-portal-admin-catalogo-de-datos.md`. `init-postgres.sh` sí aplica los patches, así que no hay 500 en base limpia.
  3. Los escaneos del catálogo quedan `QUEUED` si no se despliega `worker-data_catalog` (ADR-0024 §Consecuencias).
  4. `telemetry` y `qa_lab` sí tienen `.puml` (`diagram_28`, `diagram_36`). La autorización es por roles de plataforma (`CATALOG_*_ROLES` en `data_catalog/data-catalog.roles.ts`); el front no los contrasta, pero la ruta es de superadmin.
- **Tablas:** `data_catalog.*` (8 entidades), `qa_execution.*` (4), `qa_lab.*` y `telemetry.*`.
- **Qué hacer:**
  - Agregar los 3 campos al `AnnotationPatch` y al formulario.
  - Declarar `diagram_67_data_catalog.puml` y el de `qa_execution` para que el patch pase a ser salida generada.
  - Documentar en el runbook el despliegue del worker.
- **Archivos:** `admin-portal/data-catalog.types.ts`, la pantalla de anotación en `features/admin/*`, y en el modelo `Mantra Core Health Context/modules/diagram_67_data_catalog.puml` (nuevo).
- **Gherkin:**
  - Dado un objeto del catálogo, cuando el gobernador de datos completa «Fuente de verdad», entonces `PUT …/annotation` lo guarda y el historial lo muestra.
  - Dada una base reconstruida desde cero, cuando se pide `GET /admin/catalog/coverage`, entonces 200.

### AG-45 · Cierre de período: el front espera el período y la API devuelve `{ok,id}`
- **Severidad:** Baja.
- **Tipo:** contrato-respuesta.
- **Evidencia del front:** `accounting.client.ts:289-294` tipa `Observable<FiscalPeriod>`. `cockpit.ts:335` recarga después, así que el efecto visible es menor (sin confirmar si lee campos del resultado).
- **Evidencia de la API:** `accounting-fiscal.controller.ts:45-53` devuelve `Promise<AccountingStatusDto>` (`{ok, id?}`) y acepta `LockPeriodDto {reason?}`.
- **Tablas:** `accounting.fiscal_periods`.
- **Qué hacer:** tipar la respuesta como `{ ok: boolean; id?: string }` y releer el ejercicio.
- **Archivos:** `accounting.client.ts`, `accounting.types.ts` y `finance.handlers.ts:627`.
- **Gherkin:**
  - Dado un período abierto, cuando el aprobador lo cierra, entonces la pantalla relee el ejercicio y lo muestra «Cerrado».

---

### Llamadas verificadas OK (sin hallazgo)

| Superficie | Rutas | Qué se verificó |
| --- | --- | --- |
| Pedidos de farmacia (paciente) | `POST /pharmacy/orders`, `GET /pharmacy/orders/me`, `GET /:id`, `POST /:id/{cancel,accept-substitutions,prefer-original}` | El body `CreatePharmacyOrderDto` = `pharmacy-orders.dto.ts:62-113` y la respuesta `PharmacyOrderDto` coinciden campo a campo; los importes van como texto. |
| Pedidos de farmacia (mostrador) | `/:id/{review,confirm,reject,ready,dispense}` | Los bodies (`ConfirmPharmacyOrderDto`, `RejectPharmacyOrderDto {reason}`, `DispensePharmacyOrderDto`) coinciden; solo falla el rol (AG-32). |
| Directorio de farmacias | `GET /pharmacy/pharmacies`, `GET /pharmacy/products` (`search`, `conceptId`, `limit`), `GET /pharmacy-inventory/availability` (`products`, `lat`, `lng`, `limit`) | Las respuestas `PharmacyDirectoryResponseDto`, `PharmacyProductSearchResponseDto` y `AvailabilityResponseDto` coinciden con `pharmacy.types.ts`. |
| Vitrina pública | `GET /public/medications`, `/:conceptId/availability` | Existen y son `@Public()`. |
| Seguros | `insurance-carrier-catalog`, `insurance-carriers[/:id]`, `insurance-brokers[/:id[/clients]]`, `insurance-claims[/:id]` (cursor), `POST /insurance-claims/:id/disputes`, `POST /insurance-products/:id/plans`, `POST|PUT /insurance-plans/:id/benefits[/:bid[/rules]]`, `PUT /insurance-plans/:id/premium` | Los DTO de `insurance/dto/backbone.dto.ts:150-360` y `claims.dto.ts:409-449` = inputs del front; los importes van como `@IsNumberString`. |
| Analítica de seguros | `GET /insurance/analytics/loss-ratio` | `InsuranceAnalyticsQueryDto` y `LossRatioKpiDto` = `insurance-analytics.types.ts`. |
| Portabilidad | `POST /insurance/portability/export`, `GET …/certificates/:id/{pdf,json}`, `GET /public/portability/verify/:hash` | `RequestPortabilityExportDto {patientProfileId, format, targetInsurerTenantId}` = `PortabilityExportInput`. El cambio de `mockup` es solo de rótulos. |
| Contabilidad (libros) | `accounts`, `trial-balance`, `journal-transactions[/:id]`, `general-ledger` (cursor), `income-statement`, `balance-sheet`, `journal-transactions/drafts`, `fiscal-years`, `open-items`, `dimensions`, `document-flow`, `assets`, `accrual-objects` | Existen, con el rol `PRACTITIONER` incluido en las lecturas. `CockpitFiscalYearDto` = `FiscalYear` (PR #403). |
| Contabilidad del médico | `practitioner/{paid-consultations, consultation-income, entries}` | Rutas y roles (`PRACTITIONER`) OK. |
| Activos y pasivos | `GET\|POST /accounting/practitioner/{assets,liabilities}`, `PATCH …/:id/automation`, `POST …/:id/progress` | `CapitalizeAssetDto`, `CreateOwnLiabilityDto`, `RegisterAssetProgressDto`, `RegisterLiabilityProgressDto`, `SetAutomationDto` y `AssetSummaryDto` = tipos del front. |
| Geo | 10 comandos y `last-position` | Los DTO coinciden, incluido `tenantId?` en `CreateTrackedSubjectDto:51`. Es rastreo o delivery: fuera de alcance funcional. |
| Organización médica | `GET /practices`, `GET /practices/:id/organization`, `GET\|POST /practitioners/:id/sites` | Las rutas existen (sin revisar los bodies en profundidad). |
| Lealtad | `GET /loyalty/me`, `/me/points`, `POST /me/points/redeem` | Las rutas existen (módulo `promotions`). |
| Laboratorio (contrato) | `PutVisitPolicyDto`, `CreateVisitRequestDto`, `VisitDecisionDto`, `CancelVisitDto` | Coinciden con `pharma-lab.types.ts:103-222`. El problema es AG-30 y AG-31, no el contrato. |

**Cierres confirmados en `dev`:** P35 (patch v4.2.18 + DTO sin interés), P32 y P33 (fuera de esta parte) y el portal admin (PR #451).

**Siguen abiertos:** P34 (AG-41), P37 (AG-42) y B-8 (AG-30).


