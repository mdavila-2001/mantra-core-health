# Decisiones pendientes del propietario

Registro de las decisiones de producto que ningún carril resuelve por conveniencia (regla 00
§1.7 de `AlovidaPromptManager`). Cada entrada dice qué se necesita saber, quién la puede
resolver y qué queda apagado o con el supuesto más seguro mientras tanto.

## D-C — Qué servicio atiende el triage por IA

- **Registrada:** 2026-09-26, carril M5 (`justin/test-m5-build-real`), H3.S2.
- **Pregunta concreta:** ¿qué servicio atiende `POST /v1/triage/analyze` (síntomas → especialidad),
  con qué base legal para procesar texto clínico del paciente, y dónde corre? Las tres opciones que
  el prompt de enrutado (`AlovidaPromptManager/.../BR-03-enrutado-produccion-y-triage-ia.md`) deja
  planteadas:
  - **A.** Servicio propio (`AlovidaAIService`) en la red interna del despliegue.
  - **B.** Proxy autenticado dentro de la API (`POST /triage/analyze`, JWT + `@Throttle` +
    auditoría sin el texto).
  - **C.** Apagado hasta decidir.
- **Por qué bloquea:** hoy el cliente manda **texto clínico sin autenticar a una IP pública
  escrita en el repositorio** (`173.249.39.237.sslip.io`) y el dictado de voz sale a Google — choca
  con la regla 90.2.4 (PHI nunca a un tercero no acordado).
- **Supuesto tomado mientras tanto (Opción C):** en este carril, `deploy/api-locations.conf`
  responde `/ai/*` con `503 DEPENDENCY_UNAVAILABLE` en JSON — **nunca** el `index.html` del SSR — y
  la IP salió del repositorio (`proxy.conf.mjs` ya no trae un default; ver `git grep` en el reporte
  del carril). No se tocó `triage-ia.client.ts` ni la pantalla de síntomas: quedan fuera del
  alcance de este carril (`src/app/features/**` no está en su IN).
- **A quién confirmarle:** el propietario del producto.
- **Qué desbloquea:** elegir A o B habilita escribir el `location ^~ /ai/` real (y, si es B, el
  módulo `triage_proxy` en la API) y el aviso de consentimiento previo al dictado/envío
  (`features/symptom-check/`, fuera del alcance de este carril).


---

## H2 · 2026-09-26 · PROPUESTA · M7 (BR-07 · BR-08 · BR-09)

Decisiones abiertas de los tres prompts. Ninguna detuvo el hito: cada una se resolvió por el criterio
**más seguro** (no cambia semántica para otros clientes, no toca el modelo, no inventa catálogos) y
queda escrita para que el propietario la confirme o la revierta. Los pedidos al modelo y a M1 están en
`docs/progress/evidence/lane-M7-h2/REPORT.md`.

| ID | Pregunta | Criterio elegido | Por qué |
|---|---|---|---|
| D-BR07-1 | Correo del médico sin institucional (ID-12) | **A**: el front manda `personalEmail === email`; la API, con `workEmail` ausente y `personalEmail` igual a `email`, no crea contacto WORK | no cambia lo que persiste el alta asistida ni el alta administrativa (opción B tocaba ambos flujos); un cliente que no manda `personalEmail` sigue igual (probado) |
| D-BR07-2 | `boardCertified` en la corrección de especialidad | **se acepta** en `PATCH me/specialties/:id` | el tipo del front ya lo declara y omitirlo daba 400; la columna existe; `isPrimary` sigue afuera (400) |
| D-BR07-3 | ¿La CI se corrige desde el perfil? (P28) | **A**: se corrigen sexo al nacer y departamento emisor; el número queda de solo lectura | no toca el modelo ni la cadena CI → matrícula verificada; el departamento se valida contra `VS_BO_DEPARTMENT` (422) |
| D-BR07-4 | Métricas de calidad (ID-14) | **A**: el front no las dibuja sin datos y dice que no hay; el simulador deja de fabricarlas | no se inventan fórmulas que el modelo no respalde; la opción B (calcular en la API) queda como TODO con cada fórmula por definir |
| D-BR07-5 | Borrar una matrícula con historial de auditoría | **no se borra: 422** (se mira la historia y los casos abiertos antes; nunca se captura un `23503`) | la FK `audit.jurisdiction_authorizations_history` no tiene `ON DELETE`; retirar con `valid_to` cambiaría lo que el resumen lista |
| D-BR08-1 | Ciudad del título | **pedido a M1** (`issuing_city_text` en `professional_credentials`, 4 capas); mientras tanto **C transitoria**: el campo sigue visible con el aviso «todavía no se guarda» que ya tenía la pantalla | quitarlo (B) reescribe 29 pruebas y contradice el pedido del dueño; el aviso ya existía. No se agregó `issuingCityText` a ningún DTO sin columna |
| D-BR08-2 | Empresa «Otra» (ID-11) | **A**: el front no manda el concepto con «Otra» | una línea, misma regla que la ocupación; evita chocar con el PR #454 |
| D-BR08-3 | País del título | **B**: no se expone `issuingCountryConceptId` | `VS_COUNTRY` no tiene miembros y no hay lista con fuente aprobada; sembrar una inventada está prohibido. Pedido a M1: sembrar `VS_COUNTRY` con fuente citada (ISO 3166) |
| D-BR08-4 | Universidad del título principal sin número | se une a la fila universitaria **con número** de «Tus títulos»; sin una fila que la lleve el alta se frena y lo dice | una credencial exige número (NOT NULL); mandar un número inventado o descartar la universidad en silencio están descartados |
| D-BR09-1 | Radioprotección (sin clave en el DTO) | **C**: sale del formulario del alta | ofrecer un PDF que se tira es peor que no pedirlo; necesita un rol de documento nuevo (modelo, M1) y se pide luego desde el panel |
| D-BR09-2 | Sucursales en el alta (CL-42) | **B**: el front avisa que se cargan tras la verificación y no viajan | `POST /diagnostic-units/:id/sites` es `SECURITY_ADMIN` (BR-06): crearlas en el alta daría algo que el dueño no puede administrar |
| D-BR09-3 | Alta del hospital (CV-03) | **camino decidido, pantalla diferida**: `register-organization` con `tenantType: HOSPITAL` (la API ya lo acepta); la materialización en `orgext` y la activación las hace la plataforma | `orgext` no tiene lecturas ni alta pública y `CreateHospitalDto` exige `practiceId`; queda como tarjeta |
| D-BR09-4 | Modalidad de laboratorio | se agrega `MODALITY_LABORATORY` a la lista cerrada de modalidades y se publican tres enumeraciones (`diagnostic-unit-type`, `diagnostic-modality`, `tenant-country`) | sin la modalidad la validación existente (422) rechazaba a todo laboratorio; sin enumeraciones públicas el front tendría que hardcodear uuid. Sin DDL: las materializa el seed |
| D-BR09-5 | Jurisdicción del alta | `JURISDICTION_NATIONAL` | es la única con alcance nacional del catálogo; SEDES existe sólo para Santa Cruz. Falta un value set de jurisdicciones por departamento |
| D-BR09-6 | Dueño y representante en una sola pantalla | `owner.displayName` (forma sin partes que la API acepta) y `legalRepresentative.fullName`; el formulario pide además el documento del representante | el formulario tiene un solo nombre completo: no se inventa dónde cortarlo |

**Quién confirma:** el propietario del producto (D-BR07-4, D-BR08-1, D-BR09-2/3), y quien mantiene el
modelo (D-BR08-1/3, D-BR09-1).

# Decisiones — H1 front (BR-04, BR-05, BR-20)

Las decisiones de fondo están en `mantra-core-health-api/docs/progress/DECISIONS.md` de la rama gemela. Acá, lo que
decide el front:

- **D-I (cookie):** interruptor de despliegue `PUBLIC_REFRESH_COOKIE` (público, booleano; excepción declarada al
  filtro de nombres de `generate-env.mjs`). Apagado por defecto; se enciende **con** `AUTH_REFRESH_COOKIE_ENABLED` de
  la API. En modo cookie el refresh no se guarda: sólo la marca no secreta `mantra.session`.
- **TX-11:** se retira `ownTenantId`. La organización elegida se recuerda por persona (`<userId>|<tenantId>`) y
  sobrevive al cierre de sesión (es una preferencia atada a la persona, no un secreto). `mantra.selected-tenant` es la
  única clave `mantra.*` que queda tras cerrar sesión.
- **TX-30:** sólo 400/401 descartan el refresh guardado; sin red, 429 y 5xx lo conservan, se reintenta una vez y se
  restaura al volver `online`.
- **TX-15:** `SessionStore.roles` pasa a ser **efectivo** (regla de `RolesGuard`); todas las pantallas y guards que
  leen `roles()` lo heredan. La autoridad sigue siendo la API.
- **TX-31:** la respuesta automática ya se lee y escribe en la API (`community`); lo local (copia, plantillas del
  médico, tarifarios) se olvida al cerrar sesión vía `SESSION_CLEANERS` (import perezoso, para no engordar el bundle
  inicial, que está en el límite de 1,30 MB).
- **Seguridad de la cuenta:** se entra por el menú de la cuenta del encabezado, **no** por el menú lateral: agregarla
  ahí devolvía «Mi cuenta» al médico, y esa desaparición es a propósito (spec existente).
- **Consentimiento informado:** vive dentro de la casilla «Formulario clínico» de la consulta: la rejilla conserva
  sus diez posibilidades (pedido del propietario, spec existente).
- **Emergencia:** el botón sólo se ofrece ante el 403 del expediente a quien tiene `CLINICAL_APPROVER` o
  `SECURITY_ADMIN`; justificación obligatoria de 10+ caracteres (`confirmWithReason`).
- **`features/alovida/accesos/` (maquetas):** quedan fuera del menú; las reemplazan «Mi privacidad» y «Quién ve mi
  historia».
- **Test reescrito con causa:** `asks for the signed url only when the file is actually opened` exigía la URL firmada
  y `window.open`; el requisito cambió (CL-40), así que ahora exige la lectura por la ruta del resultado y que **no**
  se pida ninguna URL firmada.

## D-BR16-03 — Visibilidad del documento: selector, no interruptor (H3, M7-Legion)

- **Registrada:** 2026-09-26, carril M7-Legion (H3, BR-16/CL-36).
- **Pregunta concreta:** el prompt BR-16 pedía un «interruptor" (`app-switch`, como ya existe para
  `esExterno` en `document-block.ts`) para «Visible para el paciente». Un `Switch` es binario, pero
  no trae de dónde sacar los dos `concept_id` reales sin escribirlos a mano en el código.
- **Decisión tomada (más segura, no requiere confirmación del propietario):** `app-concept-select`,
  el mismo componente que ya usa `categoria` en el mismo formulario, apuntado al catálogo que la API
  publicó en este mismo carril (`chart.document_records.patient_visibility_concept_id`,
  `mantra-core-health-api` PR #478, commit `a3bff4d9`). Sin elegir, la API sigue defaulteando a
  «sólo para el profesional» — no cambia el comportamiento de nadie que no toque el campo nuevo.
  Se prefirió sobre hardcodear los uuid de `VISIBILITY_PATIENT_VISIBLE`/`VISIBILITY_PROVIDER_ONLY`
  en el front, que hubiera sido inventar un valor sin haberlo leído de ningún lado (regla 00 §1).
- **Qué queda apagado mientras tanto:** nada — el catálogo tiene exactamente dos opciones y ya está
  publicado; no depende de una decisión de producto pendiente.

---

# Decisiones de producto y de diseño — H5 (BR-22, BR-27, BR-26)

Carril M7 · Lenovo Legion · 2026-09-26. Ver el DECISIONS.md de `mantra-core-health-api` para el
detalle de las decisiones D-Notif-1..4, D-Comunidad-1, D-PharmaLab-1/2 (compartidas entre los dos
repos). Acá sólo lo que es específico del front.

- **Vocabulario de la campana (D-Notif-1):** `notification-routes.ts` y `notifications.types.ts`
  mapean `scheduling.appointment_bookings`/`scheduling.bookable_slots` (lo real) además de
  `APPOINTMENT` (se deja, nadie lo emite hoy pero retirarlo es más diff del necesario) y suman
  `SERVICE_REQUEST` (MCH-027). El mock (`scheduling.handlers.ts`, `horario-liberado.ts`) usa los
  mismos literales que la API en vez de inventar `'APPOINTMENT'`.
- **AG-07 (regla de horario liberado):** **no se tocó** la heurística de 10 minutos del mock.
  Alinearla a la regla real (sólo lista de espera) queda pendiente — ver D-Notif-3 en el
  DECISIONS.md de la API.
- **TX-18 (sondeo sin pestaña visible):** `notifications.store.ts` saltea la llamada de red con
  `document.hidden` y sigue agendando el próximo tic solo; no se agregó un listener de
  `visibilitychange` para refrescar al instante al volver — se prefirió el cambio mínimo (menos
  superficie, un solo `if` en `agendar()`) sobre la mejora de UX de traer el aviso apenas se
  vuelve a la pestaña.
- **TX-17 (token del socket):** `chat-socket.service.ts` pasa `auth` de objeto a **función** que
  lee `session.accessToken()` en cada intento de reconexión, y desconecta solo cuando
  `session.isAuthenticated()` pasa a `false` (con un `effect()` en el constructor del servicio).
- **AG-19/AG-20 (F4 del chat):** se adoptó sólo la capa de **socket** — `chat-socket.service.ts`
  ahora escucha `conversation:typing`, `profile:presence` y `conversation:message:deleted` (el
  gateway ya los emite) y expone `typing()`/`presencePing()` para emitirlos — y el **dato**
  (`DirectMessage.deletedAt` en `community.types.ts`/`community.client.ts`). **No** se tocó la UI
  del hilo: `chat.store.ts` no consume todavía estos tres observables ni pinta «Se eliminó este
  mensaje», y favoritos/archivados/fijado siguen en `localStorage` (`chat-preferencias.ts`) en vez
  de `PATCH .../participant`. Se priorizó que el dato llegue correctamente convertido (mismo
  patrón que ya existía para `sentAt`) sobre construir la UI que lo consume, dado el tiempo
  disponible del carril.
- **AG-18/BR-27 («Mis sanciones»):** sólo se agregó el cliente HTTP
  (`listMyModerationDecisions`) contra la lectura nueva de la API. No hay pantalla «Mis
  sanciones» con botón «Apelar», ni «Seguir» en la ficha pública, ni «Responder reseña» bajo la
  reseña del profesional — las tres son trabajo de UI nuevo (componente, ruta,
  `navigation.map.ts`, estados M34, prueba visual) que no entró en el tiempo de este carril. Ver
  D-Comunidad-1 en el DECISIONS.md de la API para el porqué de priorizar la corrección de
  seguridad de `appeal()` sobre estas pantallas.
- **BR-26 (visitadores):** sin cambios de front en este carril. `pharma_lab.client.ts` sigue sin
  las 54/76 rutas que el anexo cuenta sin UI (AG-43/CV-17); construirlas contra el mock tiene poco
  sentido antes de que el modelo exista (D-PharmaLab-2, pedido a M1) porque habría que volver a
  tocarlas cuando la forma real de la API se confirme contra una base con el schema
  `pharma_lab`.
