# Plan — Captura de interacciones del portal para mapas de calor

- Fecha: 2026-10-21 · Repos afectados: `mantra-core-health` (frontend) · Predecesor: ninguno
- Rama: `claude-marcelo/dreamy-cerf-bjv3xs`
- Resultado observable: con sesión iniciada y la captura encendida
  (`PUBLIC_UX_ANALYTICS_ENABLED=true` + el id del esquema de evento), cada vista
  de página, clic, foco de campo y abandono de página del portal viaja en lotes a
  `POST /telemetry/activity-events` con coordenadas normalizadas, viewport,
  plantilla de ruta y un descriptor estable del elemento — lo necesario para
  pintar un mapa de calor por ruta y por tamaño de pantalla.
- Kill-test: abrir el portal con la captura encendida, hacer clic y comprobar en
  la red que no sale ningún `POST /telemetry/activity-events`, o que el cuerpo
  lleva texto de la pantalla, valores de campos, ids en la ruta o el `id`/clase
  del elemento.

## Hechos (descubrimiento)

- La API ya tiene la ingesta: `mantra-core-health-api/src/modules/telemetry/controllers/telemetry-events.controller.ts`
  (`POST /telemetry/activity-events`, lote 1..500, guard global → exige token).
- El contrato está en `.../telemetry/dto/activity-event.dto.ts`: cada evento exige
  `eventSchemaDefinitionId` (uuid de un esquema registrado) y admite `eventName`
  (override), `eventIdempotencyKey`, `userId`, `sessionId`, `tenantId`,
  `routeTemplate` (≤300), `occurredAt`, `properties[]` (`STRING|NUMBER|BOOLEAN`).
- El servicio (`telemetry-events.service.ts:98`) descarta los eventos cuyo
  `userId` no tiene consentimiento `GRANTED` para el propósito del esquema, y los
  reenvíos con la misma `eventIdempotencyKey`.
- No hay esquemas de evento sembrados: se registran con
  `POST /telemetry/event-schemas` (rol `SECURITY_ADMIN`).
- El frontend no emite ningún evento de actividad
  (`docs/observability/analytics-events.md`: «El catálogo está vacío»).
- Ya existen: `routeTemplate()` (`core/observability/routing/route-template.ts`),
  `SessionStore` (`userId`, `activeTenantId`), `API_BASE_URL`/`apiUrl`, el patrón
  de oyentes fuera de Angular de `core/auth/idle-logout.ts`, y el generador de
  entorno `scripts/generate-env.mjs`.

## Alcance

- IN: configuración de entorno de la captura; servicio de captura en
  `core/observability/ux/`; cliente HTTP del lote; manejador del backend simulado;
  pruebas unitarias; documentación del catálogo y de cómo provisionar el esquema.
- OUT: banner o pantalla de consentimiento (decisión de producto/legal);
  endpoint de lectura agregada y visor del mapa de calor; movimiento del ratón;
  cambios en la API; cambios visuales.
- Ambigüedades registradas:
  1. «Absolutamente todos los pasos visuales»: se toma como vistas de página,
     clics (con marca de clic repetido), foco de campos y abandono de página con
     profundidad de desplazamiento y tiempo. No se graba el movimiento del ratón
     ni el contenido. Confirmar con Marcelo.
  2. Consentimiento: se envía `userId`, así que la API descarta los eventos de
     quien no otorgó consentimiento. Sin pantalla de consentimiento los eventos
     llegan como `skipped`. Decisión pendiente (`DECISION_REQUIRED`): Marcelo.

## H1 — El portal registra las interacciones para el mapa de calor

**CA:** Dado un usuario autenticado y la captura encendida, cuando navega y hace
clic, entonces la API recibe lotes de eventos con la forma del contrato y sin
datos personales ni de salud.
**DoD:** `yarn typecheck` y `yarn lint` en verde · specs dirigidas en verde ·
`yarn build` en verde.
**Estado:** A MEDIAS — todo el DoD en verde; falta el recorrido contra la API real
con un esquema registrado y el consentimiento (ver REPORTE.md).

### H1.S1 — Configuración

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H1.S1.M1 | `uxAnalytics` en `Environment`, entornos y generador | Apagada por defecto; se enciende con `PUBLIC_UX_ANALYTICS_*`; un id que no es uuid falla el build | `yarn typecheck` → exit 0 | HECHO (typecheck exit 0; generador: uuid válido anidado, `no-es-uuid` → exit 1) |

### H1.S2 — Captura

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H1.S2.M1 | Descriptor de elemento sin texto ni ids | Devuelve `data-testid`/etiquetas/rol; nunca texto, `id`, clase ni `href` | spec `ux-element.spec.ts` verde | HECHO (`evidencia/tests-dirigidos.txt`) |
| H1.S2.M2 | Constructores de eventos (clic, vista, foco, abandono) | Coordenadas normalizadas, propiedades tipadas, sin PII | spec `ux-events.spec.ts` verde | HECHO (`evidencia/tests-dirigidos.txt`) |
| H1.S2.M3 | Servicio con buffer, lotes y envío | Lote ≤50 o cada 10 s; al ocultarse la pestaña con `keepalive`; solo con sesión; fallo no rompe la UI | spec `ux-analytics.service.spec.ts` verde | HECHO (`evidencia/tests-dirigidos.txt`) |
| H1.S2.M4 | Registro en `app.config.ts` y manejador simulado | Apagada no instancia oyentes; el mock responde 201 sin aviso | `yarn build` → exit 0 | HECHO (`evidencia/build.txt`) |

### H1.S3 — Documentación

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H1.S3.M1 | Catálogo y provisión del esquema | Doc lista eventos, propiedades, prohibidos, cómo encender y consulta SQL del mapa | revisión del archivo | HECHO (`docs/observability/analytics-events.md`) |

### H1.S2 — Microtareas agregadas en el camino

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H1.S2.M5 | `/telemetry` en las tres declaraciones del proxy | `check-client-prefixes` deja de listar `TelemetryClient` | `node scripts/check-client-prefixes.mjs` | HECHO (solo queda `/patients/me/reviews`, previo) |
| H1.S2.M6 | uuid sin `crypto.randomUUID` (HTTP en red local) y arranque blindado | Sin contexto seguro la captura arranca y los ids son uuid v4 | spec `nuevoUuid` verde | HECHO (`evidencia/tests-dirigidos.txt`) |
| H1.S2.M7 | Recorrido en navegador real contra un doble HTTP de la API | Login → clics → scroll → navegación → cierre llegan al doble con 201 y sin datos de pantalla | `node evidencia/verificar.mjs` | HECHO contra el DOBLE (`evidencia/navegador-ingestas.txt`); contra la API real: pendiente |

### H1.S4 — Hallazgos de la revisión independiente (`frontend-reviewer` y la revisión de seguridad)

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H1.S4.M1 | Arreglar los hallazgos 1 a 9 y el aislamiento de lotes entre personas | Cada arreglo tiene su prueba y la mutación del aislamiento la detecta | specs dirigidas · typecheck · lint · build · suite | HECHO (`evidencia/tests-dirigidos.txt`, `evidencia/suite-completa.txt`) |

## Riesgos y bloqueos previstos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Sin consentimiento otorgado la API descarta todo | Mapa vacío para usuarios reales | Se declara como decisión pendiente; el doble del backend cubre los tres niveles |
| Volumen de clics | Carga de la API | Lotes, muestreo por sesión (`sampleRatio`) |
| Un descriptor filtra un identificador | Fuga de datos de salud | Lista blanca de atributos y pruebas que lo comprueban |
