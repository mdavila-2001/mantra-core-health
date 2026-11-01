# Contrato de ingesta UX — `POST /telemetry/activity-events` (carril API-TELEMETRIA, F0)

Para el carril FRONT-TELEMETRIA. Fuente de verdad: `api › src/modules/telemetry/presentation/dto/activity-event.dto.ts`,
`api › src/common/seed/telemetry-ux-heatmap-seed.service.ts`, `api › src/modules/telemetry/application/services/telemetry-events.service.ts`.

## 1. Identidad: la pone el servidor

El cuerpo **no** lleva `userId`, `sessionId` ni `tenantId`. Salen del token (usuario y sesión `sid`) y del contexto de tenant.
`ValidationPipe` global sigue en `whitelist + forbidNonWhitelisted`: **mandar cualquiera de los tres da 400**
(prueba existente `cuerpo de la ingesta (TEL-02)` en `telemetry-events.service.spec.ts`).

**Decisión sobre tolerar los campos viejos: NO se toleran.** Evidencia: el SDK está apagado por defecto
(`front › src/environments/environment.ts`: `enabled: false`, `eventSchemaDefinitionId: ''`); el esquema v1 no declaraba propiedades,
así que ningún cliente pudo insertar jamás una fila con propiedades; y la prueba TEL-02 fija el rechazo como contrato de seguridad
(la identidad no viene del cliente). No hay transición que cubrir. El front debe quitar los tres campos del cuerpo (puede
conservarlos en memoria para el filtro por generación).

## 2. Ids deterministas (iguales en todos los entornos)

| Qué | Id | Notas |
|---|---|---|
| Esquema `ux_interaccion` **v2** (`PORTAL_UX_HEATMAP`, requiere consentimiento) | `5c1d901c-94da-5c97-b115-e89e303c2c20` | usar en `PUBLIC_UX_ANALYTICS_EVENT_SCHEMA_ID` |
| Esquema `ux_interaccion` v1 | `70768433-6a5e-562f-a03b-c59b34e65bbd` | `DEPRECATED`: el lote que lo use recibe 412 `TELEMETRY_EVENT_SCHEMA_NOT_ACTIVE` |
| Esquema `pagina_vista_anonima` v1 (`PLATFORM_USAGE_AGGREGATE`, **sin** consentimiento) | `df630ae0-3bf4-567d-97f3-5b75ea77bc94` | sólo vista de página |
| Propósito `PORTAL_UX_HEATMAP` | `9889b3b6-4293-5266-bba2-b27fa26bec2e` | `GET /telemetry/tracking-consents/me?purposeDefinitionId=…` |
| Propósito `PLATFORM_USAGE_AGGREGATE` | `d4bc62cd-9826-5f2b-a239-9d1c95f0dd54` | retención 90 días, sin sujeto, `user_id` nulo |

## 3. Cuerpo

`{ "events": [ … ] }` — 1 a 500 eventos por lote. Cada evento:

| Campo | Tipo | Obligatorio | Nota |
|---|---|---|---|
| `eventSchemaDefinitionId` | uuid | sí | los de la tabla de arriba; desconocido = 404 |
| `eventName` | string ≤200 | no | `clic`, `pagina_vista`, `pagina_abandonada`, `campo_enfocado`. En el esquema anónimo sólo se respeta `pagina_vista`; cualquier otro valor se guarda como `pagina_vista_anonima` |
| `eventIdempotencyKey` | string ≤200 | recomendado | un reenvío con la misma clave cuenta `skipped` |
| `routeTemplate` | string ≤300 | no (sí en el anónimo) | plantilla sin ids; en el anónimo se rechaza con 422 si falta, si trae un correo o 7+ dígitos seguidos |
| `occurredAt` | ISO-8601 | no | |
| `analyticsSubjectId`, `sessionJourneyId`, `portalTypeConceptId`, `correlationId` | uuid | no | los dos primeros deben ser del usuario autenticado (si no, 404). **Con `analyticsSubjectId` el evento siempre exige consentimiento GRANTED, también en el esquema anónimo (se descarta)** |
| `properties` | array ≤25 | no | ver abajo |

Propiedad: `{ "propertyName": string ≤200, "valueType": "STRING"|"NUMBER"|"BOOLEAN", y exactamente una de "valueString" (≤4000) | "valueNumber" | "valueBoolean" }`.
`dataClassificationConceptId` se ignora (la fija el servidor).

### Propiedades de `ux_interaccion` v2 (todo lo demás: 422 `TELEMETRY_EVENT_PROPERTY_NOT_ALLOWED`)

| Propiedad | Tipo | Rango |
|---|---|---|
| `ancho_vp`, `alto_vp` | integer | 0–20000 |
| `alto_doc_px` | integer | 0–1000000 |
| `tamano_pantalla` | string | `movil` \| `tableta` \| `escritorio` |
| `ruta_anterior` | string | ≤300 |
| `pestana` | string | ≤36 |
| `profundidad_max` | number | 0–1 (scroll máximo de la página) |
| `ms_en_pagina` | integer | 0–86400000 |
| `clics` | integer | 0–100000 |
| `objetivo` | string | ≤300 (selector estable; 4+ dígitos ya vienen como `:id`; 7+ dígitos o un correo se rechazan) |
| `data_part` | string | ≤120 |
| `es_interactivo`, `es_teclado`, `es_clic_repetido`, `es_clic_muerto` | boolean | |
| `x_doc`, `x_vp`, `y_vp`, `objetivo_x`, `objetivo_y` | number | 0–1 |
| `y_doc_px` | integer | 0–1000000 |
| `tipo_campo` | string | ≤40 |

`pagina_vista_anonima` **no admite ninguna propiedad**: sólo `routeTemplate`.

## 4. Gate de consentimiento

- Propósito con `requires_consent` verdadero (o sin dato): hace falta la última decisión del usuario `GRANTED`; si no, el evento se **descarta** (`skipped`, 201).
- `PLATFORM_USAGE_AGGREGATE` (`requires_consent = false`): el evento entra sin decisión, **sin** `analytics_subject_id`, **sin** `user_id`, **sin** `session_id`, sin journey, y no se reenvía a analítica externa.
- Sin decisión de consentimiento: el front manda `pagina_vista` contra el esquema anónimo y **no** manda `clic` (si lo manda contra v2, se descarta).

## 5. Lote válido (ejemplo)

```json
{
  "events": [
    {
      "eventSchemaDefinitionId": "5c1d901c-94da-5c97-b115-e89e303c2c20",
      "eventName": "clic",
      "eventIdempotencyKey": "0b6f3f0e-7d63-4c0d-9a54-0e0a3a2a9f10",
      "routeTemplate": "/pacientes/:id/agenda",
      "occurredAt": "2026-10-31T14:05:12.000Z",
      "properties": [
        { "propertyName": "ancho_vp", "valueType": "NUMBER", "valueNumber": 1440 },
        { "propertyName": "alto_vp", "valueType": "NUMBER", "valueNumber": 900 },
        { "propertyName": "alto_doc_px", "valueType": "NUMBER", "valueNumber": 2300 },
        { "propertyName": "tamano_pantalla", "valueType": "STRING", "valueString": "escritorio" },
        { "propertyName": "objetivo", "valueType": "STRING", "valueString": "button[data-testid=agenda-guardar]" },
        { "propertyName": "data_part", "valueType": "STRING", "valueString": "tarjeta-agenda" },
        { "propertyName": "es_interactivo", "valueType": "BOOLEAN", "valueBoolean": true },
        { "propertyName": "es_teclado", "valueType": "BOOLEAN", "valueBoolean": false },
        { "propertyName": "es_clic_repetido", "valueType": "BOOLEAN", "valueBoolean": false },
        { "propertyName": "es_clic_muerto", "valueType": "BOOLEAN", "valueBoolean": false },
        { "propertyName": "x_doc", "valueType": "NUMBER", "valueNumber": 0.4132 },
        { "propertyName": "y_doc_px", "valueType": "NUMBER", "valueNumber": 812 },
        { "propertyName": "x_vp", "valueType": "NUMBER", "valueNumber": 0.4132 },
        { "propertyName": "y_vp", "valueType": "NUMBER", "valueNumber": 0.9 },
        { "propertyName": "objetivo_x", "valueType": "NUMBER", "valueNumber": 0.5 },
        { "propertyName": "objetivo_y", "valueType": "NUMBER", "valueNumber": 0.42 }
      ]
    },
    {
      "eventSchemaDefinitionId": "df630ae0-3bf4-567d-97f3-5b75ea77bc94",
      "eventName": "pagina_vista",
      "eventIdempotencyKey": "5a1e5c1e-2b0c-4f7e-8f5a-7c1d9e3b4a22",
      "routeTemplate": "/pacientes/:id/agenda"
    }
  ]
}
```

## 6. Respuesta

`201 { "inserted": n, "skipped": m, "eventIds": ["…"], "sessionJourneyId": "…"? }`. `sessionJourneyId` ausente si todos los eventos fueron anónimos o descartados.
Errores: 400 (campo no declarado en el cuerpo, p. ej. `userId`; más de 25 propiedades), 404 (esquema o referencia ajena), 412 (sesión no registrada; esquema `DEPRECATED`), 422 (propiedad no permitida / valor fuera de rango / ruta anónima inválida).
El SDK debe apagarse en 400/403/404/412 como hoy, y reintentar en 0/429/5xx.
