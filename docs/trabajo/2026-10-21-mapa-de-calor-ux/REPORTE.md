# Reporte — Captura de interacciones del portal para mapas de calor

> **AVANCE: 10 / 10 — 100 %.** Las 10 microtareas están cerradas. El hito H1 queda
> **A MEDIAS**: se verificó contra un doble de la API, no contra la API real, y
> sin pantalla de consentimiento la API real descartaría los eventos (ver Pendiente).

- Fecha: 2026-10-21 · Plan: [PLAN.md](./PLAN.md) · Rama: `claude-marcelo/dreamy-cerf-bjv3xs`
- Peldaño de evidencia alcanzado: `TESTED` (pruebas dirigidas) + recorrido en
  navegador real contra un **doble** de la API. No llega a `VERIFIED` contra la API real.

## Completado

| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.S1.M1 | `uxAnalytics` en el entorno, apagado por defecto; `PUBLIC_UX_ANALYTICS_*` en el generador; un id que no es uuid rompe el build | `yarn typecheck` · `PUBLIC_UX_ANALYTICS_EVENT_SCHEMA_ID=no-es-uuid node scripts/generate-env.mjs` | PASS: exit 0 · exit 1 con el mensaje del uuid |
| H1.S2.M1 | Descriptor de elemento por lista blanca: nunca texto, `aria-label`, `title`, `id`, clase ni `href`; uuid y números → `:id` | `yarn ng test --include='src/app/core/observability/ux/**/*.spec.ts'` | PASS, `evidencia/tests-dirigidos.txt` |
| H1.S2.M2 | Eventos `pagina_vista`, `clic`, `campo_enfocado`, `pagina_abandonada` con coordenadas normalizadas | ídem | PASS |
| H1.S2.M3 | Servicio con buffer: lote a los 50 o cada 10 s, `keepalive` al ocultar/cerrar, 4xx no se reintenta, red/429/5xx sí con las mismas claves | ídem | PASS (37 pruebas) |
| H1.S2.M4 | Registro en `app.config.ts` y manejador en el backend simulado | `yarn build` | PASS, `evidencia/build.txt` |
| H1.S2.M5 | `/telemetry` en `proxy.conf.json`, `proxy.conf.docker.json` y `deploy/api-locations.conf` | `node scripts/check-client-prefixes.mjs` | `TelemetryClient` ya no aparece (queda `/patients/me/reviews`, previo) |
| H1.S2.M6 | uuid sin `crypto.randomUUID` (HTTP en la red local) e inicializador que no rompe el arranque | spec `nuevoUuid` | PASS |
| H1.S2.M7 | Recorrido en Chromium real (escritorio 1440 y móvil 390) contra un **doble** de la API | `node evidencia/verificar.mjs` | PASS contra el doble, `evidencia/navegador-ingestas.txt` |
| H1.S3.M1 | Catálogo, prohibidos, cómo encenderlo y consulta SQL del mapa | — | `docs/observability/analytics-events.md` |
| H1.S4.M1 | Hallazgos de la revisión independiente (ver abajo) arreglados con su prueba | specs dirigidas · typecheck · lint · build · suite | PASS: 44 pruebas; mutación del aislamiento entre personas → 1 fallo |

## A medias

### H1 — El hito, contra la API real

- **Qué anda:** captura, lotes y envío en un navegador real; el doble valida el
  contrato de `CaptureActivityEventsDto` (lista blanca de claves, uuid, tipos) y
  aceptó los 4 lotes sin errores. Ningún cuerpo llevó el correo, el nombre, la
  clave ni el token.
- **Qué no anda / no se probó:** la ingesta contra la API real
  (`mantra-core-health-api`, con Postgres) no se levantó en esta sesión.
- **Qué falta exactamente:** (1) registrar propósito y esquema con
  `SECURITY_ADMIN` (pasos en `analytics-events.md`); (2) otorgar el
  consentimiento a un usuario de prueba con `POST /telemetry/tracking-consents`;
  (3) repetir `evidencia/verificar.mjs` contra la API real y comprobar filas en
  `telemetry.user_activity_events`; (4) correr la consulta del mapa.
- **Dónde quedó:** rama `claude-marcelo/dreamy-cerf-bjv3xs`, compila.

## Pendiente

| ID | Estado | Qué lo destraba |
|---|---|---|
| Pantalla de consentimiento | `DECISION_REQUIRED` | La API descarta todo evento con `userId` sin consentimiento `GRANTED`. Decidir texto, momento y propósito con producto/legal (Marcelo). |
| Visor del mapa de calor | TODO | Endpoint de lectura agregada en la API o un tablero sobre la consulta SQL documentada. |
| `estado_ux_mostrado` (estados M34) | TODO | Fuera de alcance: otro evento del catálogo propuesto. |

## Evidencia

```text
$ yarn typecheck                                   → EXIT 0
$ yarn eslint <archivos tocados>                   → EXIT 0
$ yarn lint                                        → 256 problemas antes y 256 después (ninguno nuevo)
$ yarn ng test --include='src/app/core/observability/ux/**/*.spec.ts'
 Test Files  3 passed (3)
      Tests  37 passed (37)
$ yarn build                                       → EXIT 0
$ yarn test (corrida 2, completa)
 Test Files  1 failed | 588 passed (589)
      Tests  1 failed | 7476 passed (7477)
 FAIL pestanas-del-perfil-medico.spec.ts > no mapea campos que el alta ya no pregunta
   (falla igual SIN estos cambios: git stash -u + misma prueba → 1 failed)
```

Mutación de control: agregar `textContent` al descriptor hace fallar 6 pruebas
(5 del descriptor y la del servicio que busca «Ana», «Pérez», «receta» en el cuerpo).

Navegador, contra el doble (`evidencia/api-doble.mjs`):

```text
Lotes recibidos: 4 · errores de contrato: [] en los 4
- /dashboard: pagina_vista, clic ×3 (el 3.º con es_clic_repetido=true), pagina_abandonada
- /my-account (tras recarga completa y sesión restaurada): pagina_vista, pagina_abandonada
objetivo de un clic: app-page-header[data-testid="mi-salud"] > div > div > h1
contiene 'paciente.sintetico' / 'Sintético' / 'clave-sintetica' / 'Bearer ey' -> False
```

## No cubierto

- La API real y su base: persistencia, gate de consentimiento y deduplicación
  reales. Se cubrió con un doble en los tres niveles (correcto, límite e
  inválido: 400, 503 y sin sesión), declarado como tal.
- La bandera `keepalive` se comprobó en pruebas unitarias (`req.request.keepalive`),
  no en la red: el navegador no la expone al servidor.
- Viewport de tableta y tema oscuro: no aplica prueba visual, el cambio no
  pinta nada.
- Corrida 1 de la suite: además fallaron 2 pruebas de seguros
  (`insurance-analytics`, `insurance-portability`). No se reprodujeron aisladas,
  ni con todo `core/mock`, ni en la corrida 2. No tocan ningún archivo de este
  cambio. Sin causa raíz demostrada: quedan registradas como intermitentes.

## Revisión independiente

`frontend-reviewer` (solo lectura) dictaminó **NO APROBADO** sobre el primer
commit, y la revisión de seguridad automática agregó un hallazgo. Todos se
verificaron contra el código y se arreglaron en `cb8b4663`, cada uno con su prueba:

| # | Hallazgo | Arreglo |
|---|---|---|
| 1 | Cerrar la pestaña con el token vencido podía revocar la sesión (refresco sin `keepalive` cortado por la descarga, `auth.interceptor.ts:105`) | Sin envío al ocultar o cerrar si el token venció |
| 2 | Mismo `sessionId` para dos personas en la misma pestaña (la API agrupa por él, `telemetry-events.service.ts:517`) | Se renueva al cambiar de usuario; también la página abierta |
| S | Un lote fallido de A se reencolaba y salía con el token de B | Contador de generación + filtro por `userId` al enviar |
| 3 | El abandono del cierre no salía si el lote del ocultamiento seguía en vuelo | `keepalive` ignora `enVuelo` |
| 4 | Tras bfcache no se capturaba nada | `pageshow` con `persisted` reabre la página |
| 5 | Una URL sin plantilla viajaba cruda | `normalizarRuta` |
| 6 | Un 4xx definitivo reintentaba cada 10 s para siempre | 400/403/404 detienen la captura |
| 7 | 429 sin espera | Espera creciente de 10 s a 5 min |
| 8 | Las pruebas usaban ids que no son uuid | uuid como los de la API |
| 9 | Esquema vacío rompía el build | Vacío deja la captura apagada |
| 10 | Salen eventos de quien no consintió (la API los descarta) | Registrado como decisión (abajo) |

## Desvíos del plan

- Se agregaron H1.S2.M5 (proxy sin `/telemetry`: lo denunció
  `check-client-prefixes`), H1.S2.M6 (uuid en contexto no seguro) y H1.S2.M7
  (recorrido en navegador).
- El recorrido en navegador encontró un defecto de producto: se emitía
  `pagina_abandonada` de `/auth` sin su vista. Se corrigió y tiene prueba.

## Riesgos residuales

- Volumen: un clic, un evento. Mitigado con lotes y `PUBLIC_UX_ANALYTICS_SAMPLE_RATIO`.
- `objetivo` depende de que las pantallas tengan `data-testid`; sin él la clave
  es la ruta de etiquetas y cambia si cambia la estructura.
- Al cerrar sesión se descartan los eventos pendientes (≤ 10 s).
- `check-api-prefixes` ya fallaba por `/loyalty` antes de este cambio.

## Decisiones y ambigüedades

- «Todos los pasos visuales» se tomó como vistas, clics (con clic repetido),
  foco de campos y abandono con profundidad y tiempo. **No** se graba el
  movimiento del ratón ni ningún contenido. Confirmar con Marcelo.
- Se envía `userId` para que la API aplique el consentimiento: el frontend no
  autoriza. Sin pantalla de consentimiento, los eventos quedan en `skipped`.
- Un solo esquema de evento con `eventName` por tipo, en vez de un esquema por
  evento: la API admite el override y así el despliegue configura un solo id.
- **Minimización (hallazgo 10):** el navegador manda los eventos de quien
  todavía no consintió y la API los descarta. Lo correcto es no mandarlos, pero
  el frontend no tiene hoy cómo saber si hubo consentimiento. Se resuelve con la
  pantalla de consentimiento. Confirmar con Marcelo / responsable de privacidad.
- `data-ux-ignore` como vía para excluir zonas sensibles de una pantalla.
