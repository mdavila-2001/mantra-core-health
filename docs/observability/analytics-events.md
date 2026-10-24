# Catálogo de eventos analíticos

**Desde el 2026-10-21 el portal emite los eventos de interacción para los mapas
de calor** (sección siguiente). El resto del catálogo de esta página sigue siendo
una propuesta sin implementar.

> El plan maestro es explícito: *«No añadir telemetría nueva como parte implícita
> de la documentación.»* La captura de interacciones se agregó como trabajo
> propio (mapa de calor de UX, 2026-10-21).

---

## Implementado: interacciones para mapas de calor

Código en `src/app/core/observability/ux/`; cliente en
`src/app/core/data-access/telemetry/`. Viajan en lotes a
`POST /telemetry/activity-events` (módulo 28 de la API), que exige token, valida
el consentimiento y descarta reenvíos por `eventIdempotencyKey`.

### Eventos

| Evento | Disparador | Propiedades propias |
|---|---|---|
| `pagina_vista` | `NavigationEnd` con una plantilla de ruta distinta de la anterior | `ruta_anterior` |
| `clic` | `click` en captura, en todo el documento | `objetivo`, `es_interactivo`, `es_teclado`, `es_clic_repetido`, `x_doc`, `y_doc_px`, `x_vp`, `y_vp`, `objetivo_x`, `objetivo_y` |
| `campo_enfocado` | `focusin` en `input`/`select`/`textarea` | `objetivo`, `tipo_campo` |
| `pagina_abandonada` | Navegar a otra plantilla o cerrar la pestaña (`pagehide`) | `profundidad_max`, `ms_en_pagina`, `clics` |

Todas llevan además `ancho_vp`, `alto_vp`, `alto_doc_px` y `tamano_pantalla`
(`movil` < 600 px ≤ `tableta` < 1024 px ≤ `escritorio`).

- **Coordenadas.** `x_doc`, `x_vp`, `y_vp`, `objetivo_x` y `objetivo_y` son
  fracciones 0..1 (cuatro decimales); `y_doc_px` son píxeles del documento. Un
  clic de teclado (`event.detail === 0`) no lleva coordenadas.
- **`objetivo`.** Ruta de hasta cinco etiquetas con los atributos de una lista
  blanca (`data-testid`, `role`, `type`, `formcontrolname`/`name`), con uuid y
  corridas de 4+ dígitos reemplazadas por `:id`. Es la clave para agrupar un
  mismo control entre tamaños de pantalla. Ver `ux-element.ts`.
- **`es_clic_repetido`.** Tercer clic en 700 ms a menos de 30 px: control que no
  responde o que parece un botón y no lo es.
- **Identidad.** `userId` y `tenantId` de la sesión; `sessionId` es un uuid por
  pestaña en `sessionStorage`. `routeTemplate` sale de `routeTemplate()`.

### Lo que nunca sale

Ningún texto de la pantalla, valor de campo, `aria-label`, `title`, `id`,
clase, `href` ni URL sin normalizar. Una zona con `data-ux-ignore` no genera
clics ni focos. No se graba el movimiento del ratón. Lo prueban
`ux-element.spec.ts` y `ux-analytics.service.spec.ts`.

### Envío

Cada 10 s, al llegar a 50 eventos, y al ocultarse o cerrarse la pestaña con
`keepalive` en lotes de 20 (ese lote sale aunque haya otro en vuelo). Con el
access token vencido **no** se manda nada al cerrar: el refresco del interceptor
no lleva `keepalive`, la descarga lo cortaría y la API revocaría la sesión por
reutilización del refresh token.

- Red caída, 429 o 5xx: se reencola (tope 500) con las mismas claves de
  idempotencia, con espera creciente de 10 s a 5 min.
- 400, 403 o 404: se deja de capturar en esa pestaña. Ningún lote más iba a entrar.
- Cambio de persona en la pestaña: se descarta lo pendiente y se renueva el
  `sessionId`, porque la API agrupa el recorrido por él. Solo sale un evento
  cuyo `userId` es el de la sesión actual, y un lote fallido de la persona
  anterior no se reencola.
- Volver con «atrás» desde la caché del navegador (bfcache) reabre la página.
- Una URL que ninguna ruta reconoce viaja con sus segmentos limpios
  (`/legado/8437` → `/legado/:id`).

### Cómo se enciende

1. Con rol `SECURITY_ADMIN`, registrar el propósito y el esquema en la API:

   ```http
   POST /telemetry/tracking-purposes
   { "purposeCode": "UX_HEATMAP", "name": "Mapas de calor del portal",
     "requiresConsent": true, "defaultRetentionDays": 90 }

   POST /telemetry/event-schemas
   { "eventName": "ux_interaccion", "purposeDefinitionId": "<id del propósito>" }
   ```

2. En el entorno del despliegue:
   `PUBLIC_UX_ANALYTICS_ENABLED=true`,
   `PUBLIC_UX_ANALYTICS_EVENT_SCHEMA_ID=<id del esquema>` y, si hace falta,
   `PUBLIC_UX_ANALYTICS_SAMPLE_RATIO` (fracción de sesiones).
3. `/telemetry` ya está en `proxy.conf.json`, `proxy.conf.docker.json` y
   `deploy/api-locations.conf`.

**Consentimiento.** La API descarta (`skipped`) todo evento cuyo `userId` no
tenga un `POST /telemetry/tracking-consents` con decisión `GRANTED` para ese
propósito. El portal todavía no tiene la pantalla donde la persona lo otorga:
hasta que exista, solo llegan los eventos de quien lo otorgó por API.

### Consulta del mapa de calor

```sql
WITH clics AS (
  SELECT e.id, e.route_template,
         max(p.value_number) FILTER (WHERE p.property_name = 'x_doc')           AS x,
         max(p.value_number) FILTER (WHERE p.property_name = 'y_doc_px')        AS y,
         max(p.value_string) FILTER (WHERE p.property_name = 'tamano_pantalla') AS pantalla
  FROM telemetry.user_activity_events e
  JOIN telemetry.user_activity_event_properties p ON p.user_activity_event_id = e.id
  WHERE e.event_name = 'clic' AND e.occurred_at >= now() - interval '7 days'
  GROUP BY e.id, e.route_template
)
SELECT route_template, pantalla,
       floor(x * 50)::int AS celda_x,   -- 50 columnas
       floor(y / 20)::int AS celda_y,   -- filas de 20 px
       count(*)           AS clics
FROM clics
WHERE x IS NOT NULL
GROUP BY 1, 2, 3, 4
ORDER BY clics DESC;
```

Agrupar por la propiedad `objetivo` en vez de por celda da el ranking de
controles por ruta; filtrar `es_clic_repetido` da los puntos de frustración.

---

## Datos prohibidos, en toda propiedad de todo evento

1. Identificadores de paciente, documentos, correos, teléfonos.
2. Nombres de personas.
3. Tokens, completos o truncados.
4. Contenido de formularios.
5. Nombres de archivo — pueden ser identificables por sí solos.
6. **Rutas sin normalizar.** `/pacientes/4821` es un identificador; debe viajar
   como `/pacientes/:id`.
7. Cualquier cosa que revele **qué** consultó una persona. En salud, la sección
   visitada es información de salud.

La 6 y la 7 son las específicas de este dominio y las que más fácil se rompen.

## Cómo se probaría

Sin esto, las reglas de arriba son una intención:

1. Una prueba por evento que compruebe que **solo** emite las propiedades
   declaradas.
2. Una prueba que pase un objeto con un token y compruebe que no sale.
3. Una comprobación de que ninguna ruta viaja sin normalizar.

## Antes de implementar nada

Ver [analítica §antes de agregar](../integrations/analytics.md#antes-de-agregar-analítica)
y [privacidad](../security/privacy.md).

**Y una decisión de orden:** los eventos operativos (`estado_ux_mostrado`,
`api_error`, `chunk_fallido`) son más urgentes y **menos problemáticos en
privacidad** que los de producto. Conviene empezar por ellos: no describen
comportamiento de personas, describen salud del sistema.
