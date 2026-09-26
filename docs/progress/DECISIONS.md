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

## H6 (BR-28/BR-29/BR-30) — organización, clínica extendida y contrato de calidad

- **Alcance recortado a capa de datos + config:** construir la UI completa de los 6 hubs de administración
  (`DataTable` + los 9 estados M34 + `visual-quality-gate` con capturas) y de las 4 franjas clínicas de BR-29 es
  más trabajo del que sostiene una sesión que también cubre el backend de dos repos, request-id y regenerar
  OpenAPI. Se priorizó dejar el contrato de datos de la API ya probado (H6 del lado API) y hacer los cambios de
  front de menor riesgo y mayor certeza, en vez de maquetar pantallas nuevas sin pasar el gate de calidad visual
  del repo. **NO CUBIERTO** en esta sesión: pantallas de `delegated-access`, `auth-providers`, `identity-assurance`
  (cola de credenciales), `health-context`, «Mis derivaciones», «Mi cobertura», `/billing` real y la bandeja de
  aprobación de organización en `organization-panel.ts`. Los 6 endpoints nuevos de la API (documentados en
  `mantra-core-health-api/docs/progress/DECISIONS.md`, sección H6) quedan listos para que el próximo carril arme
  la pantalla sin tener que tocar el backend.
- **CV-21 (documento de estado):** `ESTADO-FRONTEND.md` decía "nada está simulado" sin aclarar que eso es cierto
  sólo bajo `production-api`/`real-api` (`mockBackend: false`); la configuración por defecto de `ng serve`
  (`environment.development.ts`) sigue en `mockBackend: true`. Se corrigió la línea para que declare las dos
  cosas, sin reescribir el resto del documento (es una foto fechada del 2026-08-01, no una fuente viva).
- **AG-44 (catálogo de datos):** `processSupported`, `sourceOfTruth` y `producers` ya los acepta
  `UpsertAnnotationDto` del lado de la API (sin tocar el modelo); sólo faltaban en `AnnotationPatch` (tipo) y en
  `annotation-dialog.ts` (formulario). Se agregó una página "Procedencia" al formulario paginado existente;
  `producers` (lista en el contrato) se edita como texto separado por comas y se parte/junta al guardar y al
  cargar, mismo criterio liviano que el resto de listas cortas de nombres libres de la casa. El residuo 2 de
  AG-44 (`.puml` de `data_catalog`/`qa_execution` en `mantra-core-health-model`, DDL) es pedido a M1: sin DDL en
  este repo ni en la API.
- **CV-25 (geolocalización) — NO CUBIERTO, investigado:** se buscó ocultar `administration/geolocation` del menú
  de administración manteniendo la ruta activa (D-BR28-3 opción A). Se encontró que
  `rutasDeSecciones()` (`src/app/app.routes.ts`) genera las rutas del armazón **desde el mismo array** de
  secciones de `src/app/core/navigation/navigation.map.ts`: sacar la entrada de ese registro borra la ruta
  entera, no sólo el ítem de menú. El mecanismo existente para ocultar sin borrar
  (`SECCIONES_FUERA_DEL_ARBOL` en `access-tree.ts`) sólo aplica al panel de "zonas" del dashboard, no al menú
  lateral real (`navigation.service.ts`). Agregar un `canMatch` + una marca de "fuera del menú de lanzamiento"
  que conviva con ese acoplamiento es un cambio de arquitectura de navegación, con riesgo real sobre
  `navigation.service.spec.ts`/`access-tree.spec.ts` (parte de las ~4985 pruebas del repo) que esta sesión no
  tuvo presupuesto para hacer con el `visual-quality-gate` correspondiente. Se documenta completo para el
  próximo carril; no se tocó `navigation.map.ts` ni `app.routes.ts`.
- **TX-14 (request-id, infra):** `deploy/api-proxy.conf` ahora fija `X-Request-Id: $request_id` hacia la API, para
  que el `genReqId` de la API (ver DECISIONS.md de `mantra-core-health-api`) tenga un id de nginx que respetar
  detrás de `TRUST_PROXY_HOPS`. No se tocó `deploy/nginx.conf` (`log_format`): el archivo no declara ninguno
  propio —hereda el del `http {}` que lo incluye, fuera de este repo— y agregar uno nuevo ahí sin ver ese
  contexto real es inventar una convención de logging que Coolify/el operador ya tiene resuelta en otro lado.
  Queda anotado para quien administre esa capa.
