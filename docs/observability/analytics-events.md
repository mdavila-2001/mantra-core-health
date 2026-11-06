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
- **Identidad.** El cuerpo **no** lleva `userId`, `sessionId` ni `tenantId`: la
  API los toma del token y del contexto de tenant, y responde 400 al lote que los
  mande. El uuid de la pestaña (`sessionStorage`) viaja como la propiedad
  declarada `pestana`. `routeTemplate` sale de `routeTemplate()`. Contrato:
  `docs/trabajo/2026-10-31-portal-observabilidad-gobierno/evidencia-f0/CONTRATO-ingesta-ux.md`.

### Consentimiento y señales de privacidad

Código en `src/app/core/observability/consent/`. `UxConsent` decide qué puede
emitir el SDK; la API sigue siendo la autoridad (verifica el consentimiento en
cada evento).

| Situación | Qué emite |
|---|---|
| DNT («No rastrear») o Global Privacy Control activos | **Nada**: el SDK no arranca (ni oyentes ni vistas anónimas) y deja un `console.info` |
| Decisión ausente (`NONE`), o no se pudo consultar | Solo `pagina_vista`, contra el esquema `pagina_vista_anonima` (propósito agregado): sin identidad, sin sesión, sin propiedades. **Nunca clics, foco ni abandono** |
| Consentimiento otorgado (`GRANTED`) | Todos los eventos contra `ux_interaccion` v2, con `pestana` |
| Consentimiento retirado (`WITHDRAWN`) | Nada; lo que había en cola se descarta |

- Aviso de una sola vez (`app-ux-consent-notice`, montado en `app.html`): `app-alert`
  con «Aceptar» y «Ahora no»; no vuelve en ese navegador para esa persona
  (`localStorage` `mch.ux.aviso.<userId>`, solo comodidad: la decisión vive en la API).
- Cambiar de opinión: **Mi cuenta › Mi privacidad › Mis consentimientos**
  (`app-ux-consent-panel`, `features/ux-consent/`), para cualquier cuenta.
- API: `GET /telemetry/tracking-consents/me?purposeDefinitionId=…`,
  `POST /telemetry/tracking-consents` y `POST /telemetry/tracking-consents/:id/withdraw`.
- Cliente HTTP: `TelemetryConsentClient` (`core/data-access/telemetry/telemetry-consent.client.ts`).
  Tres llamadas (`getMine`, `grant`, `withdraw`), siempre del usuario autenticado: el cuerpo
  no nombra a nadie y la API rechaza una clave `userId`. Solo lo usa `UxConsent`.

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
- 400, 403, 404 o 412 (esquema `DEPRECATED`, sesión no registrada): se deja de
  capturar en esa pestaña. Ningún lote más iba a entrar. **No en silencio:** el
  estado y la `reason`/`message` de la API quedan en `console.warn` y en
  `UxAnalytics.motivoDeApagado`.
- 422 (propiedad o ruta que la API no admite): ese lote se descarta y se
  registra; la captura sigue.
- Cambio de persona en la pestaña: se descarta lo pendiente y se renueva el
  uuid de la pestaña. Solo sale un evento capturado para la persona y la
  organización actuales (se guardan **en memoria**, no en el cuerpo), y un lote
  fallido de la persona anterior no se reencola.
- Volver con «atrás» desde la caché del navegador (bfcache) reabre la página.
- Una URL que ninguna ruta reconoce viaja con sus segmentos limpios
  (`/legado/8437` → `/legado/:id`).

### Cómo se enciende

Apagado por defecto (`enabled: false`). Para encenderlo en un entorno:

1. **Esquemas y propósitos.** Los siembra la API con ids deterministas (iguales
   en todos los entornos; `CONTRATO-ingesta-ux.md` §2). No hace falta registrarlos
   a mano:

   | Qué | Id |
   |---|---|
   | Esquema `ux_interaccion` v2 (`PORTAL_UX_HEATMAP`, exige consentimiento) | `5c1d901c-94da-5c97-b115-e89e303c2c20` |
   | Esquema `pagina_vista_anonima` v1 (`PLATFORM_USAGE_AGGREGATE`) | `df630ae0-3bf4-567d-97f3-5b75ea77bc94` (constante en `ux-analytics.config.ts`) |
   | Propósito `PORTAL_UX_HEATMAP` | `9889b3b6-4293-5266-bba2-b27fa26bec2e` (constante en `ux-analytics.config.ts`) |

   En un entorno sin esa siembra, un `SECURITY_ADMIN` los registra con
   `POST /telemetry/tracking-purposes` y `POST /telemetry/event-schemas`.
2. **Variables del front** (`.env`; `.env.example` las documenta; `scripts/generate-env.mjs`
   las valida al construir):

   ```bash
   PUBLIC_UX_ANALYTICS_ENABLED=true
   PUBLIC_UX_ANALYTICS_EVENT_SCHEMA_ID=5c1d901c-94da-5c97-b115-e89e303c2c20
   PUBLIC_UX_ANALYTICS_SAMPLE_RATIO=1   # fracción de SESIONES (por pestaña); en producción, p. ej. 0.25
   ```

   Sin el id del esquema no se enciende (`active = enabled && id !== ''`).
3. `/telemetry` ya está en `proxy.conf.json`, `proxy.conf.docker.json` y
   `deploy/api-locations.conf`.
4. Reconstruir/reiniciar el front: son variables de compilación, no de ejecución.
5. **Comprobar:** iniciar sesión con una cuenta sin decisión → aparece el aviso;
   «Aceptar» → `POST /telemetry/tracking-consents` 201 y fila `GRANTED` en
   `telemetry.tracking_consents`; navegar y hacer clic → en ≤ 10 s,
   `POST /telemetry/activity-events` 201 con `inserted > 0`, y filas en
   `telemetry.user_activity_events` con `user_id` y `session_id` puestos por la API
   (no por el navegador). Con DNT activo en el navegador no debe salir ninguna
   petición a `/telemetry/*`.

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
