# Hallazgos transversales — apagar el mock y salir a producción con la API real

- Fecha: 2026-09-24 · Auditor: agente de solo lectura (sin ediciones, sin commits, sin cambio de rama)
- Front: `mantra-core-health/` — rama local `mockup` en `9b3e0101`; `origin/mockup` = `95472903` (la copia local va 2 commits detrás); `origin/dev` = `64939119`.
- API: `mantra-core-health-redesa-api/` — `dev` en `7541797c` (2026-09-23).
- Inventarios usados: `../inventarios/{api-routes.json (1 362 rutas de código), client-calls.json (490 llamadas), mock-missing.json (34), api-unused.json}`.
- Peldaño de evidencia: **DISCOVERED** (lectura de código + scripts `check-*.mjs` corridos en modo lectura). No se levantó la API ni el front: nada de este informe está verificado en ejecución.
- Scripts corridos (ninguno escribe en disco — verificado con grep de `writeFile|rmSync|unlink`): `check-client-prefixes` ✗ (1), `check-route-prefixes` ✓, `check-api-prefixes` ✗ (`/loyalty`), `check-real-api-config` ✓, `check-api-contract-drift` ✗ (78 + 10), `check-bundle-budget` ✓ (sobre un `dist/` del 16/09, viejo).

> **Corrección de premisa.** El encargo dice que `origin/dev` habla con la API real. **No es así en el código:** `origin/dev:src/environments/environment.ts:62` también tiene `mockBackend: true`, y `origin/dev` trae los 91 archivos de `src/app/core/mock/`. Las dos ramas son la maqueta; la única forma de hablar con la API es la configuración `real-api` / `e2e-real` de `ng serve` (sin SSR). Ver TX-01 y TX-02.

---

## Índice por severidad

| ID | Título | Severidad |
|---|---|---|
| TX-01 | No existe un build de producción con la API real (`mockBackend: true` fijo en `production` y `development`, en dev y mockup) | Bloqueante |
| TX-02 | La única configuración sin mock (`real-api`/`e2e-real`) apaga el SSR: SSR + API real nunca se ejercitó | Bloqueante |
| TX-03 | Las demos que fabrican datos están encendidas por defecto en producción, al revés de lo que dicen sus comentarios | Bloqueante |
| TX-04 | El cartel de cuentas demo se pinta siempre, con o sin mock | Bloqueante |
| TX-05 | 19 operaciones que el front llama no existen en la API (el mock las regala) | Bloqueante |
| TX-06 | `respuestaGenerica` del mock fabrica éxito para cualquier ruta desconocida: oculta la brecha real | Alta |
| TX-07 | Prefijos que faltan en el enrutado de producción (`/loyalty`, `/patients/me/reviews`, `/ai`) | Bloqueante |
| TX-08 | Triage IA: servicio externo sin repositorio, sin enrutado en nginx y con texto clínico del paciente | Bloqueante |
| TX-09 | Descarga por URL firmada abre una pestaña que la API rechaza con 401 | Alta |
| TX-10 | Refresh token en `localStorage`; la API ya soporta cookie httpOnly y el front no | Alta |
| TX-11 | Claim `ownTenantId` sólo existe en el mock: con la API real, quien tiene 2+ organizaciones cae al selector | Alta |
| TX-12 | Contrato de error del mock distinto del real (412 vs 422, 422 vs 400, `issues` vs `details.violations`) | Alta |
| TX-13 | `API_ERROR_CODES` del front no conoce `TIMEOUT`, `CIRCUIT_OPEN`, `CONCURRENCY_LIMIT` | Media |
| TX-14 | El `correlationId` (S9) es un contador por proceso, y la API no devuelve `x-request-id` | Media |
| TX-15 | Menús por `roles` planos: el front ignora `scopedRoles` (MCH-001) | Media |
| TX-16 | Actor sin tenant: 403 FORBIDDEN (muro) en unas rutas, 422 PRECONDITION_FAILED en otras | Media |
| TX-17 | Chat en tiempo real: nunca corrió contra la maqueta; el token del socket no se renueva | Alta |
| TX-18 | Notificaciones por sondeo cada 45 s (2 lecturas por tick); «horario liberado» sólo existe en el mock | Media |
| TX-19 | Límite de tasa por IP en login/refresh (10 y 20 por minuto): una clínica detrás de un NAT choca | Media |
| TX-20 | CORS `origin:false` en HTTP y WS: la API sólo sirve detrás del mismo origen | Media (restricción de despliegue) |
| TX-21 | `security.allowedHosts` horneado con dominios de túneles públicos | Alta |
| TX-22 | `server.ts` redirige `/public/media/:id` a un SVG de maqueta en el artefacto de producción | Media |
| TX-23 | OpenAPI desactualizado (52 rutas reales ausentes) y tipos del front escritos a mano | Media |
| TX-24 | Sin CI efectivo: el del front está encolado; el de la API, en rojo desde agosto | Alta |
| TX-25 | La suite real (`cypress/e2e/real`, 12 specs) existe pero corre sin SSR, fuera de CI y con el rate-limit apagado | Media |
| TX-26 | Pantallas que pintan fixtures sin interruptor (fuera de `core/mock`) | Alta |
| TX-27 | Llamadas N+1 (`forkJoin(lista.map(get))`) en 4 pantallas | Media |
| TX-28 | Variables de cookie de refresh declaradas y validadas pero ignoradas por la API | Baja |
| TX-29 | MFA: el front envía `mfaCode`, la API lo acepta pero no lo exige ni lo desafía | Media |
| TX-30 | `restoreSession` borra la sesión ante cualquier error, incluso de red | Baja |
| TX-31 | Datos en almacenamiento del navegador (plantillas de chat, auto-respuesta, tarifarios) | Baja |
| TX-32 | PDFs clínicos generados en el cliente (historia, notas, cotización), no por la API | Media |
| TX-33 | Descarga de archivos exige escaneo antimalware `SCAN_CLEAN`: sin worker de escaneo, todo 422 | Alta (sin confirmar en despliegue) |
| TX-34 | Almacenamiento de archivos en disco local del contenedor por defecto en Coolify | Media |

---

## 1. Salida del mock

### TX-01 — No existe un build de producción con la API real
**Severidad:** Bloqueante salida-a-producción

**Evidencia**
- Front `src/environments/environment.ts:65` — `mockBackend: true` (producción), sin leer el entorno a propósito (comentario 60-64).
- Front `src/environments/environment.development.ts:63` — `mockBackend: true`.
- `origin/dev:src/environments/environment.ts:62` — también `mockBackend: true`; `git ls-tree origin/dev -- src/app/core/mock` → 91 archivos. **Dev no es «la rama con API real»**.
- `angular.json:116-128` — la configuración `real-api` existe sólo como `ng serve` de desarrollo (`optimization:false`, `sourceMap:true`); `defaultConfiguration: "production"` (l. 131) usa `environment.ts` → mock.
- `Dockerfile:82-88` — `yarn build` sin `--configuration`, o sea `production` → mock dentro del contenedor.
- `src/environments/environment.real-api.spec.ts` fija como contrato que «producción sigue con la maqueta encendida».
- `src/app/app.config.ts:89` — `mockBackendInterceptor` va en la cadena de producción.
- Diferencia `origin/dev` ↔ `origin/mockup`: `git diff --stat` → 550 archivos, +40 700/−246; 453 son `docs/` (+34 792). Código: `features/auth` (15), `core/mock` (13), `features/account` (21), `features/symptom-check` (6), `shell-layout` (4), `core/data-access` (3), `core/messaging` (2), `proxy.conf.mjs`, `environment*.ts` (+`aiBaseUrl`). `git log origin/dev..origin/mockup` = 80 commits; `origin/mockup..origin/dev` = 47. Lo que tiene que volver de mockup a dev es, en código, del orden de 2 700 líneas (sin docs ni playwright); el resto es documentación y evidencia.

**Qué hacer**
1. Crear una configuración `production-api` (o que `production` pase a leer un flag de build) con `mockBackend:false`, optimización, SSR y `fileReplacements` a un `environment.production-api.ts`.
2. Que el `Dockerfile` reciba la configuración por `ARG BUILD_CONFIGURATION` y el compose de producción la fije.
3. Excluir `core/mock` del grafo de producción (el interceptor ya lo carga lazy, pero `MockBanner` y `mock-session` entran en el paquete inicial por `app.ts:8`).
4. Decidir qué rama es la fuente del despliegue real (hoy ninguna) y llevar a dev los 80 commits de mockup que falten.

**Archivos:** `src/environments/*`, `angular.json`, `Dockerfile`, `deploy/docker-compose*.yml`, `src/app/app.config.ts`, `src/app/app.ts`, `scripts/check-real-api-config.mjs`.

**Criterios**
```gherkin
Escenario: El artefacto de producción habla con la API
  Dado el contenedor construido con la configuración de producción real
  Cuando la aplicación pide "GET /terminology/value-sets"
  Entonces la respuesta llega desde la API y no trae la cabecera "x-mock-backend"

Escenario: El paquete de producción no contiene el simulador
  Dado el build de producción real
  Cuando se buscan "alovida.mock" y "crearRouterSimulado" en dist/browser
  Entonces no hay coincidencias

Escenario: check-real-api-config protege la nueva configuración
  Dado angular.json con la configuración de producción real
  Cuando se corre "node scripts/check-real-api-config.mjs"
  Entonces falla si esa configuración deja mockBackend en true
```

### TX-02 — `real-api` apaga el SSR: SSR + API real nunca se probó
**Severidad:** Bloqueante

**Evidencia**
- `angular.json:107-108` (`e2e-real`) y `121-122` (`real-api`): `"ssr": false`, `"outputMode": "static"`, `"server": false`. `check-real-api-config` lo confirma: «real-api apaga la maqueta, las demos de campañas y pago, y el SSR».
- `src/app/app.routes.server.ts` — 11 rutas `RenderMode.Server` (`search/*`, `p/:slug`, `o/:slug`, `f/:slug`) que en el servidor pedirán a la API; 8 `Prerender` (auth). Con el mock encendido el SSR las contesta el interceptor en memoria.
- `src/app/core/data-access/api.ts` — `apiBaseUrl` vacío ⇒ URLs relativas; en el servidor Node la resolución depende del origen de la petición entrante detrás de nginx (**sin confirmar**: no se ejercitó).
- `src/app/core/data-access/terminology/bo-departments.service.ts` — ya documenta que un prerender contra la API colgó el `yarn build`.

**Qué hacer:** decidir el origen que usa el SSR para hablar con la API (red interna `api:3000` vs dominio público), probarlo con la configuración de producción real, y verificar el estado transferido (`TransferState`) de las páginas públicas.

**Archivos:** `angular.json`, `src/server.ts`, `src/app/app.routes.server.ts`, `src/app/core/data-access/api.ts`.

```gherkin
Escenario: Perfil público renderizado en servidor con datos reales
  Dado el contenedor web con SSR y la API real detrás de nginx
  Cuando se pide "/p/<slug-existente>" con curl
  Entonces el HTML trae el nombre del profesional sin ejecutar JavaScript

Escenario: El prerender no cuelga el build
  Dado el build de producción real sin API alcanzable
  Cuando se corre el build
  Entonces termina y las rutas prerenderizadas no contienen datos de la API

Escenario: La API caída no rompe el SSR
  Dado la API detenida
  Cuando se pide "/search/practitioners"
  Entonces el servidor responde 200 con el estado de error S8/S9, no un 500
```

### TX-03 — Demos que fabrican datos encendidas por defecto en producción
**Severidad:** Bloqueante

**Evidencia**
- `src/environments/environment.ts:36,43,51,58` — `demoPresets ?? true`, `paymentDemo ?? true`, `loyaltyDemo ?? true`, `campaignsDemo ?? true`, cuando los comentarios de cada campo dicen «Apagada por defecto».
- `Dockerfile:82-83` sólo pasa `PUBLIC_API_BASE_URL`; los `PUBLIC_*_DEMO` no llegan al build ⇒ en el contenedor valen `true`.
- `environment.real-api.ts` apaga sólo `campaignsDemo` y `paymentDemo`; **hereda `demoPresets:true` y `loyaltyDemo:true`** de desarrollo ⇒ incluso «contra la API real» hay barra de casos demo en la ficha clínica (`features/clinical-record/patient-chart/diagnosis-block/diagnosis-block.ts:286`) y billetera sembrada (`features/account/loyalty/loyalty.fixtures.ts`).
- Pago excluido del alcance, pero el flag igual está mal por defecto.

**Qué hacer:** invertir los respaldos de producción a `false`, pasar los `PUBLIC_*` como `ARG` del Dockerfile, y que `real-api` también apague `demoPresets` y `loyaltyDemo` (o documentar por qué no). Extender `check-real-api-config.mjs`.

```gherkin
Escenario: Producción sin variables no muestra demos
  Dado un build de producción sin ninguna variable PUBLIC_*_DEMO
  Cuando una médica abre la ficha clínica de un paciente
  Entonces no aparece la barra de casos de demostración

Escenario: Billetera honesta en producción
  Dado un paciente sin membresía de puntos
  Cuando abre la billetera
  Entonces ve el estado vacío, sin saldo sembrado

Escenario: El guardián detecta una demo encendida
  Dado environment.ts con un respaldo de demo en true
  Cuando se corre check-real-api-config
  Entonces el script falla
```

### TX-04 — El cartel de cuentas demo se pinta siempre
**Severidad:** Bloqueante

**Evidencia**
- `src/app/app.html:8` — `<app-mock-banner />` sin condición; `src/app/app.ts:8,13` lo importa.
- `src/app/core/mock/mock-banner.ts` (172 líneas) no consulta `environment` en ningún punto: dice «Rama mockup: sin backend… Cualquier contraseña sirve», lista `MOCK_USERS` (5 cuentas `@alovida.mock`) y enlaza a `/design-system/stock`.
- El enlace del stock sí está protegido: `app.routes.ts:1884,1897` `canMatch: [() => environment.mockBackend]` → con el mock apagado cae en 404, pero el botón sigue visible.

**Qué hacer:** montar el cartel sólo con `environment.mockBackend` (y sacarlo del paquete inicial con `@defer` o import dinámico).

```gherkin
Escenario: Sin mock no hay cartel
  Dado el build de producción real
  Cuando cualquier persona abre la aplicación
  Entonces no ve el texto "Datos de prueba" ni ninguna dirección "@alovida.mock"

Escenario: En la maqueta el cartel sigue
  Dado el build con mockBackend en true
  Cuando se abre la aplicación
  Entonces el cartel lista las cinco cuentas de prueba
```

### TX-05 — 19 operaciones del front que no existen en la API
**Severidad:** Bloqueante (cada una rompe una pantalla con la API real)

**Evidencia** (`client-calls.json`, cruzado con `api-routes.json`; se descartan 2 falsos positivos: `POST /identity/verification-cases/:id/checks:plan` sí existe —el cruce no desescapó `\:`— y `/v1/triage/analyze`, que es de otro servicio, TX-08):

| Operación | Cliente |
|---|---|
| `GET` y `PUT /clinical/me/medical-aspects` | `core/data-access/clinical/clinical.client.ts` |
| `POST /clinical/medication-requests/:id/attachments` | idem |
| `POST /clinical/allergy-intolerances/:id/attachments` | idem |
| `GET /community/conversations/:id` | `community/community.client.ts` (tampoco tiene manejador en el mock → cae en `respuestaGenerica`) |
| `PATCH /forms/field-definitions/:id` · `PATCH`/`DELETE /forms/assignments/:id` · `PUT /forms/assignments/order` | `forms/forms.client.ts` |
| `PATCH /profiles/practitioners/me/credentials/:id` · `PATCH`/`DELETE …/me/specialties/:id` · `PATCH`/`DELETE …/me/jurisdiction-authorizations/:id` | `profiles/profiles.client.ts` |
| `GET /public/profiles/f/:slug/branch-availability` | `public-catalog/public-catalog.client.ts` |
| `PATCH /surveys/templates/:id` · `PATCH`/`DELETE …/questions/:qid` · `PUT …/questions/order` | `surveys/surveys.client.ts` |

Además el mock atiende 13 rutas más que la API no tiene y ningún cliente llama hoy (p. ej. `POST /community/reactions`, `POST /pharmacy/orders/:id/mark-ready`, `POST /scheduling/bookings/:id/payment-state`, `PATCH /notifications/preferences/me`, `GET /identity/verification-types`, `POST /charts/notes/:id/versions`) — `mock-missing.json`.

**Qué hacer:** por cada una, decidir: implementar en la API (con `.puml` si toca modelo), o reescribir el cliente contra la ruta real equivalente, o retirar la función de la UI. Nada de esto se ve con el mock encendido.

```gherkin
Escenario: Ninguna llamada del front queda sin ruta
  Dado el inventario de llamadas de core/data-access
  Cuando se cruza con las rutas de la API
  Entonces la lista de operaciones sin ruta está vacía

Escenario: Editar una credencial profesional persiste
  Dado una médica con una credencial cargada y la API real
  Cuando cambia el número de matrícula y guarda
  Entonces la API responde 2xx y al recargar ve el valor nuevo
```

### TX-06 — `respuestaGenerica` fabrica éxito para cualquier ruta desconocida
**Severidad:** Alta

**Evidencia:** `src/app/core/mock/mock-backend.interceptor.ts:296-320` — GET sin manejador → `{items:[],count:0,…}` 200; DELETE → 204; POST/PUT/PATCH → eco del cuerpo con `id: mock-…`, `status:'ACTIVE'`, 201/200. Sólo deja un `console.warn`. Otros «regalos» del mock: latencia fija por prefijo (l. 269-289: 40/90/120 ms, 600 ms en la subida de documento), `fallos-simulados.ts` (fallos declarados en `sessionStorage 'mock:fallos'`), `horario-liberado.ts` (+ `features/notifications/aviso-de-hueco-libre.ts:79`, sólo con mock), JWT `alg:none` (`mock-session.ts:202`), cualquier contraseña, `desconectar()` con `structuredClone` (l. 180-194), persistencia en `sessionStorage` por pestaña.

**Qué hacer:** antes de apagar, convertir `respuestaGenerica` en un 501 ruidoso (o un fallo de test) para que el recorrido de la maqueta destape lo que falta; mantener el inventario `mock-vs-api` en CI.

```gherkin
Escenario: Una ruta sin manejador no finge éxito
  Dado la maqueta encendida
  Cuando la aplicación hace POST a una ruta que ningún manejador cubre
  Entonces la pantalla muestra un error y el recorrido lo registra como defecto

Escenario: El inventario mock↔API no crece
  Dado el CI del front
  Cuando un PR agrega un manejador de mock sin ruta en la API
  Entonces el chequeo falla nombrando la ruta
```

### TX-26 — Pantallas que pintan fixtures sin interruptor
**Severidad:** Alta

**Evidencia:** 11 archivos `*.fixtures.ts` fuera de `core/mock`. Ejemplos sin ninguna condición de entorno:
- `features/organization/pharmacy-profile/pharmacy-profile.ts:28-30,172-189` — `EMPRESA_DE_EJEMPLO`, `DOCUMENTOS_DE_EJEMPLO`, `GENTE_DE_EJEMPLO` cargados como `ready(...)` siempre.
- `features/account/medical-record/where-to-buy/where-to-buy.ts:55,338` — «aprobados por el seguro de ejemplo».
- `features/organization/pharmacy-inbox/pharmacy-inbox.ts:41` — `NOTA_DE_DATOS_DE_EJEMPLO`.
- `features/symptom-check/corpus.fixture.ts`, `features/account/promotions/promotions.fixtures.ts`, `loyalty.fixtures.ts` (este sí detrás de `loyaltyDemo`).
- `core/data-access/pharmacy/pharmacy.fixtures.ts` declara «Sólo los usan las pruebas» — correcto.

**Qué hacer:** inventariar cada fixture fuera de `core/mock` y clasificarlo: sólo-test, catálogo con procedencia, o demo que debe ir detrás de un flag o a una lectura real.

```gherkin
Escenario: La ficha de la farmacia muestra sus datos reales
  Dado una farmacia registrada y la API real
  Cuando su administrador abre el perfil de la empresa
  Entonces ve su razón social y no la de la empresa de ejemplo

Escenario: Sin datos no se inventan
  Dado una farmacia sin documentos legales cargados
  Cuando abre "Documentos"
  Entonces ve el estado vacío
```

---

## 2. Autenticación y sesión

### TX-10 — Refresh token en `localStorage`; la API ya soporta cookie httpOnly
**Severidad:** Alta

**Evidencia**
- Front `src/app/core/auth/refresh-token.storage.ts:4,59,149` — `localStorage['mantra.refresh-token']`; vida del refresh: `JWT_REFRESH_TTL_DAYS` = 30 días (`api/src/common/auth/refresh-cookie.ts:67`).
- API `src/modules/iam/controllers/iam-auth.controller.ts:332-374` — con `AUTH_REFRESH_COOKIE_ENABLED=true` escribe la cookie `redesa_refresh` (httpOnly, `SameSite=strict`, `path=/iam/auth/token/refresh`) y **devuelve `refreshToken: ''`** en el cuerpo.
- Front `iam.client.ts:89-93` siempre manda `{ refreshToken }` en el cuerpo; `session.store.ts:38` convierte `''` en `null` ⇒ si se enciende la cookie, **se pierde la sesión en cada recarga** (restoreSession no tiene qué leer). Default en Coolify: `AUTH_REFRESH_COOKIE_ENABLED:-false` (`docker-compose.coolify.yml:186`).
- Access token en memoria, TTL `15m` (`auth.env.ts:36`); `idle-logout.ts:23` cierra a los 15 min de inactividad.
- Logout: `auth.service.ts:137-142` llama `POST /iam/auth/logout` y limpia; `auth.interceptor.ts:185-190` (`endSession`) limpia sólo el store, **no** el `localStorage` — el refresh rotado queda y se descarta en el próximo arranque.

**Qué hacer:** soportar el modo cookie en el front (`restoreSession` intenta el refresh sin cuerpo cuando no hay token guardado, el interceptor ya es mismo origen) y encenderlo en producción; que `endSession` también limpie el almacenamiento.

```gherkin
Escenario: Ningún token al alcance de JavaScript
  Dado producción con la cookie de refresh encendida
  Cuando una persona inicia sesión
  Entonces localStorage no contiene "mantra.refresh-token" y la cookie es httpOnly

Escenario: La sesión sobrevive a F5 con cookie
  Dado una sesión iniciada en modo cookie
  Cuando se recarga la página
  Entonces la persona sigue dentro sin volver a escribir la contraseña

Escenario: Cerrar sesión revoca en el servidor
  Dado una sesión iniciada
  Cuando se cierra sesión y se reintenta el refresh con el token anterior
  Entonces la API responde 401
```

### TX-11 — `ownTenantId` sólo existe en el mock
**Severidad:** Alta

**Evidencia:** Front `core/auth/access-token.ts:65,155-166` y `session.store.ts:91-117` lo usan para elegir organización por defecto. El mock lo firma (`core/mock/mock-session.ts:22,94,211`). La API **no lo emite**: `api/src/common/auth/jwt-payload.interface.ts` declara `sub, sid, roles, scopedRoles, tenants, name, tenantNames, pid, hpid, typ`; `grep ownTenantId api/src` → 0. Con la API real, la médica de 2 organizaciones (caso demo «Dos organizaciones») verá el selector en cada sesión nueva.

**Qué hacer:** o la API firma `ownTenantId` (decisión de modelo: qué es «mi consultorio»), o el front lo deja de esperar y persiste la última elección (ya existe `SELECTED_TENANT_STORAGE_KEY`).

```gherkin
Escenario: Profesional con consultorio propio y una clínica
  Dado una cuenta con 2 tenants y la API real
  Cuando inicia sesión por primera vez en el dispositivo
  Entonces la aplicación resuelve el tenant según el contrato acordado, no según un claim inexistente

Escenario: Claims del mock iguales a los de la API
  Dado el token que emite el mock y el que emite la API
  Cuando se comparan sus claves
  Entonces el mock no firma ninguna clave que la API no firme
```

### TX-19 — Límite de tasa por IP en rutas de autenticación
**Severidad:** Media

**Evidencia:** API `iam-auth.controller.ts:272` login 10/min, `:334` refresh 20/min, `:299` forgot 5/min, `:112,133,198` registros 10/min; global 300/min (`app.module.ts:140-148`), clave por `req.ip` con `TRUST_PROXY_HOPS=2` (`main.ts:128-131`, `docker-compose.coolify.yml:169`). Todo el personal de una clínica detrás de un NAT comparte cubo: el refresh de 20 pestañas cada 15 min más reintentos ya roza el tope. La suite real exige `RATE_LIMIT_DISABLED=true` (`scripts/run-recorrido-real.mjs:31`), así que nunca se midió con el límite puesto.

**Qué hacer:** clave compuesta (IP + identificador de cuenta para login; `sid` para refresh), Redis como almacenamiento (el comentario de `app.module.ts:136-139` dice que ya pasa a Redis — **sin confirmar** que esté cableado), y que el front trate `RATE_LIMITED` (429) con su propio estado y `Retry-After`.

```gherkin
Escenario: Diez personas de la misma clínica entran a la vez
  Dado 12 cuentas distintas saliendo por la misma IP
  Cuando las 12 inician sesión en el mismo minuto
  Entonces ninguna recibe 429

Escenario: Fuerza bruta sobre una cuenta
  Dado una cuenta
  Cuando se prueban 11 contraseñas en un minuto
  Entonces el intento 11 recibe 429 con código RATE_LIMITED y la UI lo explica
```

### TX-29 — MFA declarado pero no exigido
**Severidad:** Media

**Evidencia:** API `LoginDto` acepta `mfaCode` opcional; `iam-mfa.service.ts` enrola factores; los registros crean `MFA_DISABLED`; no hay desafío en el login (grep `mfa` en `iam-auth.service.ts` → 0). Front `features/auth/login/login.ts:83,95-100` mantiene el control pero no lo dibuja «porque el backend no emite ninguna señal».
**Qué hacer:** decidir si los roles administrativos (`SECURITY_ADMIN`, `SUPERADMIN`) exigen MFA en producción; si sí, contrato de desafío (p. ej. 401 con `details.reason=MFA_REQUIRED`) y UI.
```gherkin
Escenario: Administrador con MFA habilitado
  Dado un SECURITY_ADMIN con factor TOTP verificado
  Cuando inicia sesión sin código
  Entonces la API rechaza con un motivo distinguible y la UI pide el código
```

### TX-30 — `restoreSession` borra la sesión ante cualquier error
**Severidad:** Baja
**Evidencia:** `core/auth/auth.service.ts:197-205` — `catchError(() => { this.storage.clear(); … })`: un corte de red (status 0) o un 429 al arrancar desloguea.
**Qué hacer:** borrar sólo ante 401/400 del refresh.
```gherkin
Escenario: Arranque sin red
  Dado un refresh token válido guardado
  Cuando la aplicación arranca con la API inalcanzable
  Entonces el token sigue guardado y al volver la red la sesión se restaura
```

---

## 3. Contrato de errores

### TX-12 — El mock responde errores con otra forma que la API
**Severidad:** Alta

**Evidencia**
- Mock `core/mock/mock-router.ts:61-69` `preconditionFailed` → **412**; API `common/errors/domain.exception.ts:106-118` `PreconditionFailedException` → **422** con `code: PRECONDITION_FAILED` (y `all-exceptions.filter.ts:414-415` mapea 422 → `PRECONDITION_FAILED`). 16 manejadores usan `preconditionFailed(`.
- Mock `mock-router.ts:84-92` `validation` → **422** `VALIDATION_FAILED` con clave `issues`; API → **400** `VALIDATION_FAILED` con `details.violations` (`all-exceptions.filter.ts:393-395`, `405-407`). 10 manejadores usan `validation(`.
- Pantallas que ramifican por status: `features/clinical-record/request-access/request-access.ts:104` espera **412** — con la API real nunca entra en esa rama. (Otras ya documentan «422, no 412»: `clinical.client.ts:317`, `register-practitioner.ts:174`, `medication-block.ts:178`.)
- `error-to-view-state.ts:160` lee `details.violations ?? details.messages` — bien contra la API, nunca contra el mock (`issues`).

**Qué hacer:** alinear `mock-router.ts` al contrato real (422 para precondición, 400 + `details.violations` para validación), y ramificar por `code`, no por status.

```gherkin
Escenario: Precondición fallida se muestra igual en mock y en API
  Dado un profesional sin perfil propio
  Cuando pide un vínculo de acceso a un paciente
  Entonces ve "Tu cuenta no tiene un perfil profesional propio…" tanto con el mock como con la API

Escenario: Errores de validación por campo
  Dado un formulario enviado con un campo inválido
  Cuando la API responde 400 con details.violations
  Entonces el mensaje aparece junto al campo
```

### TX-13 — `API_ERROR_CODES` incompleto
**Severidad:** Media
**Evidencia:** Front `core/http/api-error.ts:10-30` (12 códigos). API `common/errors/error-codes.ts:6-50` agrega `TIMEOUT` (l. 34), `CIRCUIT_OPEN` (l. 41), `CONCURRENCY_LIMIT` (l. 48); `defaultCode` emite `TIMEOUT` para 408/504 (filtro l. 424-426). `readApiError` (l. 63-65) devuelve `null` si el código no está en la lista ⇒ se pierde `correlationId` y `message`, y la pantalla cae en el genérico.
**Qué hacer:** agregar los tres códigos y su mapeo a estado M34 (reintentable).
```gherkin
Escenario: Dependencia con circuito abierto
  Dado la API responde 503 con code CIRCUIT_OPEN
  Cuando la pantalla lo recibe
  Entonces muestra el estado reintentable con el ID de petición
```

### TX-14 — `correlationId` débil y sin cabecera
**Severidad:** Media
**Evidencia:** API `all-exceptions.filter.ts:157-158` usa `request.id ?? header['x-request-id']`; pino-http asigna `req.id` siempre (no hay `genReqId` en `src/logging/*`, grep 0) ⇒ el id es un contador por proceso (1, 2, 3…), se repite tras cada reinicio y entre réplicas, y el `x-request-id` del cliente se ignora. La API no escribe `x-request-id` en la respuesta (grep 0). Front `error-to-view-state.ts:219` cae a `error.headers.get('x-request-id')` → siempre `null` ⇒ `'sin-id'` en errores sin cuerpo (502 de nginx).
**Qué hacer:** `genReqId` con UUID (o el `trace_id` de OTel), aceptar el entrante, devolverlo en `X-Request-Id` y exponerlo; nginx con `$request_id`.
```gherkin
Escenario: El ID de S9 encuentra la línea de log
  Dado un error 500 en producción
  Cuando la persona copia el ID de la pantalla
  Entonces ese ID aparece exactamente una vez en los logs de la API
```

---

## 4. Paginación, filtros y orden

### Observación (sin ID propio) — tres convenciones en la API
- Cursor (`nextCursor`, keyset `common/pagination/keyset-cursor.ts`): ~51 archivos de módulos.
- Página (`PaginationQueryDto` `page/pageSize/order/sortBy`, `PageResponseDto {data, meta{page,pageSize,total,totalPages}}`, `common/dto/*.ts`): sólo `document_store` y `promotions` (7 archivos).
- `limit/offset`: 4 archivos.
- El sobre varía por endpoint (`items`, `entries`, `data`). El front lo absorbe cliente por cliente (`DataTable` sólo cursor, M34). El mock genérico (l. 300-306) devuelve `{items,count,limit,nextCursor}` a cualquier GET con `limit`/`cursor` — oculta cuando una API real usa otro sobre.
- Límites grandes: el front pide `limit: 500` en agenda (`my-agenda.ts:799,1128`, `consultas-resumen.ts:157-158`, `procedure-import.ts:378`); la API los acepta (`scheduling-agenda.dto.ts:20` `AGENDA_MAX_LIMIT = 500`). `limit` de `services-catalog` **sin confirmar**.
- **Qué hacer:** documentar la convención única en `docs/api/conventions.md` y marcar `PaginationQueryDto` como legado; que el mock genérico devuelva 501 (TX-06).

---

## 5. Archivos

### TX-09 — La URL firmada de descarga abre una pestaña que responde 401
**Severidad:** Alta
**Evidencia:** API `modules/common/services/files.service.ts:643-645` emite `/common/files/:id/content?versionId=&expires=&signature=` (HMAC); `common-files.controller.ts:115-121` `GET :id/content` exige `@CurrentUser()` (no es `@Public`) y **no valida `signature` ni `expires`**. Front `features/account/diagnostic-results/diagnostic-results.ts:275-278` hace `window.open(url, '_blank')` ⇒ la pestaña nueva no lleva `Authorization` ⇒ 401. El propio `files.client.ts:152` advierte que `downloadUrl()` no sirve para pintar.
**Qué hacer:** o un endpoint público que valide la firma (y el TTL), o el front descarga por `HttpClient` con blob (como ya hace `files.client.ts:208,246`).
```gherkin
Escenario: Paciente descarga su resultado de laboratorio
  Dado un resultado con archivo escaneado limpio
  Cuando el paciente pulsa "Descargar"
  Entonces el PDF se abre o se descarga, sin 401

Escenario: Enlace vencido
  Dado una URL firmada con expires en el pasado
  Cuando se abre
  Entonces la API responde 403/410 sin entregar el contenido
```

### TX-33 — Descargas bloqueadas sin escaneo antimalware
**Severidad:** Alta (sin confirmar en el despliegue)
**Evidencia:** `files.service.ts:630-634` exige `SCAN_CLEAN` para emitir la URL; el escaneo lo hace un worker interno (`/internal/files/versions/pending-scan`, `…/:vid/scan-result`). Si el worker/escáner no corre en producción, toda descarga devuelve 422. En el mock no existe esta precondición.
**Qué hacer:** confirmar que el worker y el motor de escaneo están en el compose de producción; UI para «en análisis».
```gherkin
Escenario: Archivo recién subido
  Dado un archivo subido hace 1 segundo
  Cuando se intenta descargar
  Entonces la UI muestra "en análisis", no un error genérico
```

### TX-34 — Archivos en disco local del contenedor por defecto
**Severidad:** Media
**Evidencia:** API `docker-compose.coolify.yml:140-147` — `FILE_STORAGE_ADAPTER:-local`, `FILE_STORAGE_S3_ENDPOINT: http://minio:9000` (hostname interno; un presign real apuntaría a un host que el navegador no resuelve y que la CSP `connect-src 'self'` bloquea), `FILE_STORAGE_S3_PREFIX:-audio-assets` (prefijo del módulo de audio usado para todo). Volumen `api_storage:/app/storage` (l. 602). Tope 10 MB en los dos lados (`upload-policy.ts:35` ↔ `FILE_STORAGE_MAX_SIZE_BYTES`), JSON 1 MB (`main.ts:140`).
**Qué hacer:** decidir el adaptador de producción, backup del volumen o MinIO, prefijo por dominio.
```gherkin
Escenario: Redepliegue no pierde archivos
  Dado una foto de perfil subida
  Cuando se redepliega la API
  Entonces la foto sigue disponible
```

### TX-32 — PDFs clínicos generados en el cliente
**Severidad:** Media
**Evidencia:** Front `shared/utils/clinical-pdf/clinical-pdf.ts`, `progress-notes-pdf/`, `quotation-pdf/`, `receipt-pdf/`, `form-template-pdf/`, `order-invoice.pdf.ts` — el navegador arma el PDF de la historia; la API expone `GET /charts/encounters/:id/pdf` que ningún cliente llama (sólo se usan `/clinical/prescriptions/:id/pdf` y `/insurance/portability/certificates/:id/pdf`). PDF de credenciales profesionales: **sin confirmar**.
**Qué hacer:** definir qué documento es oficial (firmado, auditado) y cuál es una impresión de pantalla; los oficiales, desde la API.
```gherkin
Escenario: Historia clínica descargada deja rastro
  Dado un paciente que descarga su historia
  Cuando se genera el PDF
  Entonces la API registra la lectura en la auditoría
```

---

## 6. Tiempo real

### TX-17 — Chat: nunca probado contra la maqueta y token del socket fijo
**Severidad:** Alta
**Evidencia:** Front `core/messaging/chat-socket.service.ts:117` no conecta con `mockBackend` ⇒ toda la demo de chat corre sin tiempo real. `:133-135` `io({ auth: { token } })` con el access token del momento; al vencer (15 min) una reconexión reusa el token viejo (**sin confirmar** si el gateway re-verifica: `community-messaging.gateway.ts:140-145` autentica sólo en `handleConnection`). Gateway `cors:{origin:false}` (l. 108) ⇒ sólo mismo origen; nginx sí tiene `/socket.io/` con upgrade (`deploy/api-locations.conf`). Playwright `carril-chat-realtime.spec.ts` existe (**sin confirmar** contra qué corre).
**Qué hacer:** `auth` como función que lee el token vigente; desconectar al cerrar sesión; prueba real de dos navegadores detrás de nginx.
```gherkin
Escenario: Mensaje en vivo detrás del proxy
  Dado una médica y un paciente con el chat abierto en producción
  Cuando el paciente envía un mensaje
  Entonces la médica lo ve sin recargar en menos de 2 segundos

Escenario: Sesión larga
  Dado un chat abierto durante 20 minutos
  Cuando el socket se reconecta
  Entonces usa el access token vigente y sigue recibiendo mensajes
```

### TX-18 — Notificaciones por sondeo; «horario liberado» sólo en el mock
**Severidad:** Media
**Evidencia:** `core/notifications/notifications.store.ts:21` `INTERVALO_MS = 45_000`, dos lecturas por tick (messaging + social) por pestaña — decisión D2 documentada (l. 68-73), sin SSE (la API no tiene `@Sse`). `features/notifications/aviso-de-hueco-libre.ts:79` sólo arranca con `mockBackend`; contra la API «llega por el canal de avisos» (**sin confirmar** que la API emita `SLOT_RELEASED`). Contadores de la cabecera = suma de los dos `unreadCount`.
**Qué hacer:** confirmar el evento real; pausar el sondeo con la pestaña oculta; medir el costo contra el límite global de 300/min.
```gherkin
Escenario: Se libera un horario esperado
  Dado un paciente en espera de hueco con la API real
  Cuando otra persona cancela ese turno
  Entonces el paciente recibe el aviso en la campana en menos de 60 segundos
```

---

## 7. Autorización y tenants

### TX-15 — El front ignora `scopedRoles`
**Severidad:** Media
**Evidencia:** API `common/auth/roles.guard.ts:14-17,43-52` autoriza un rol de negocio sólo en el tenant que lo indexa en `scopedRoles`; el JWT lo trae (`jwt-payload.interface.ts:25`). Front: `grep scopedRoles src/app` → 0; menús y `section-roles.guard.ts` usan `roles` plano. Los 33 códigos de rol del front existen todos en algún `@Roles` de la API (cruce sin diferencias).
**Qué hacer:** que `SessionStore.roles` sea el efectivo del tenant activo.
```gherkin
Escenario: Rol concedido en otra organización
  Dado una persona con RECEPTIONIST sólo en la clínica A y tenant activo B
  Cuando abre el menú
  Entonces no ve las secciones de recepción
```

### TX-16 — Actor sin tenant: 403 o 422 según el camino
**Severidad:** Media
**Evidencia:** API `common/tenant/tenant-resolution.ts:49-53` → 403 «no pertenece a ningún tenant» / «pertenece a varios»; `tenant-context.ts:44` `requireTenantId` → 422 `PRECONDITION_FAILED` (SUPERADMIN sin cabecera). CLAUDE.md ya registra int-specs que esperan 403 y reciben 422. Front `auth.interceptor.ts:170-176` sólo manda `X-Tenant-Id` si hay tenant activo; un 403 se pinta como muro sin salida.
**Qué hacer:** un código distinguible (p. ej. `details.reason = TENANT_REQUIRED`) y en el front llevar al selector de organización en vez del muro.
```gherkin
Escenario: Usuario con varias organizaciones sin elegir
  Dado un token con 2 tenants y ninguno activo
  Cuando pide un recurso con alcance de tenant
  Entonces la UI abre el selector de organización, no "sin permiso"
```

---

## 8. Proxy y prefijos

### TX-07 — Prefijos ausentes en el enrutado de producción
**Severidad:** Bloqueante (esas funciones reciben HTML del SSR con 200)
**Evidencia**
- `check-api-prefixes`: `/loyalty` está en `proxy.conf.json` pero no en `proxy.conf.docker.json` ni en `deploy/api-locations.conf` ⇒ en producción `/loyalty/me` lo contesta el SSR.
- `check-client-prefixes`: `POST /patients/me/reviews` (`community.client.ts:802`) no está en ningún proxy.
- `/ai/` sólo existe en `proxy.conf.mjs:36-45` (dev); nginx no tiene `location /ai` (TX-08).
- `/socket.io` está en nginx y en `proxy.conf.json` (entrada aparte) — bien.
**Qué hacer:** agregar a las tres declaraciones; para `/patients` usar el prefijo largo `/patients/me/reviews` (la regla de `check-route-prefixes`); hacer que el CI falle con estos scripts.
```gherkin
Escenario: Todo prefijo de cliente llega a la API
  Dado deploy/api-locations.conf
  Cuando se corre check-client-prefixes y check-api-prefixes
  Entonces ambos salen en verde

Escenario: Billetera en producción
  Dado un paciente en el despliegue con nginx
  Cuando pide GET /loyalty/me
  Entonces recibe JSON de la API, no el index.html
```

### TX-20 — CORS cerrado: sólo mismo origen
**Severidad:** Media (restricción que hay que respetar)
**Evidencia:** API `main.ts:143-145` `enableCors({ origin: false })`; gateway `cors: { origin: false }`. Front `environment.types.ts` recomienda `apiBaseUrl` vacío; `security-headers.ts:235` agrega el origen a `connect-src` si no. Con API en otro dominio no funcionaría nada.
**Qué hacer:** dejar escrito que producción es mismo origen detrás de nginx, o declarar la allowlist en la API si se separan dominios.
```gherkin
Escenario: API en otro dominio
  Dado PUBLIC_API_BASE_URL apuntando a otro origen
  Cuando la aplicación hace una petición
  Entonces la API devuelve la cabecera Access-Control-Allow-Origin del front autorizado
```

### TX-21 — `allowedHosts` con dominios de túneles públicos
**Severidad:** Alta
**Evidencia:** `angular.json:54-62` (build, se hornea en el artefacto de producción): `.devtunnels.ms`, `.trycloudflare.com`, `.ngrok-free.app`, `.loca.lt`; `src/server.ts:38` suma `APP_DOMAIN` en ejecución (`src/server/allowed-hosts.ts`). Cualquier subdominio de esos servicios es un `Host` aceptado por el SSR de producción. (Las reglas de la casa prohíben sacar datos por túneles.)
**Qué hacer:** dejar en el build sólo `localhost`/`127.0.0.1`/`frontend` y el dominio real por `APP_DOMAIN`; los túneles, sólo en `serve`.
```gherkin
Escenario: Host ajeno
  Dado el contenedor de producción
  Cuando llega una petición con Host "x.trycloudflare.com"
  Entonces el servidor responde 400
```

### TX-22 — `/public/media/:id` redirigido a un SVG de maqueta en producción
**Severidad:** Media
**Evidencia:** `src/server.ts:150-160` `app.get('/public/media/:id', → 302 /mock-media.svg)` sin condición. La API sirve `GET /public/media/:id` (`community-public.controller`). Detrás de nginx gana `location ^~ /public/` y no se nota; en cualquier despliegue sin nginx delante del SSR, las fotos reales se reemplazan por el SVG.
**Qué hacer:** condicionar al mock o quitarlo.
```gherkin
Escenario: Foto de vitrina real
  Dado una publicación con imagen y la API real
  Cuando se pide /public/media/<id>
  Entonces se recibe la imagen, no un 302 a mock-media.svg
```

---

## 9. Configuración y despliegue

### TX-08 — Triage IA: servicio fuera de los repos, sin ruta en producción y con datos clínicos
**Severidad:** Bloqueante
**Evidencia**
- Front `core/data-access/triage-ia/triage-ia.client.ts:52-63` — `HttpClient` sin interceptores, `POST {aiBaseUrl}/v1/triage/analyze` con `{ text }` = lo que el paciente escribe o dicta sobre sus síntomas. Sin credencial («es público»).
- `proxy.conf.mjs:36` — destino por defecto `https://ai.173.249.39.237.sslip.io` (una IP pública con DNS comodín de terceros).
- `environment.types.ts` dice «En el despliegue la resuelve Traefik»; `deploy/nginx*.conf` y `api-locations.conf` **no tienen** `/ai` ⇒ en el despliegue con nginx cae en el SSR (`location /`), devuelve HTML y el cliente lo trata como `null` en silencio (l. 58-60: `catchError(() => of(null))`).
- Ningún repo del workspace contiene `AlovidaAIService` ni `triage/analyze` (API: 0; `AlovidaPromptManager` es un paquete de skills). **Sin confirmar** dónde vive, quién lo opera, si registra el texto y con qué modelo.
- Regla de la casa (`AGENTS.md` §1.4 y regla 90.2.4): PHI «nunca a servicios de terceros no acordados».
**Qué hacer:** identificar el repo y el dueño del servicio; acuerdo de tratamiento de datos; enrutarlo por nginx (`location ^~ /ai/`) o por la API (proxy autenticado con límite de tasa); quitar la IP del repo.
```gherkin
Escenario: El triage llega al servicio acordado
  Dado producción detrás de nginx
  Cuando un paciente describe "dolor de pecho"
  Entonces POST /ai/v1/triage/analyze responde JSON del servicio acordado y no HTML

Escenario: Sin servicio, sin fuga
  Dado el servicio de IA apagado
  Cuando el paciente escribe síntomas
  Entonces la pantalla sigue con el motor local y el texto no sale a ningún otro destino
```

### Variables faltantes / inconsistentes (resumen para TX-01/TX-03/TX-08)
- `scripts/generate-env.mjs` maneja `PUBLIC_API_BASE_URL`, `PUBLIC_AI_BASE_URL`, `PUBLIC_DEMO_PRESETS`, `PUBLIC_PAYMENT_DEMO`, `PUBLIC_LOYALTY_DEMO`, `PUBLIC_CAMPAIGNS_DEMO`, `PUBLIC_TELEMETRY_*`; **no hay** variable para `mockBackend` (a propósito) — por eso hace falta la configuración de build.
- `Dockerfile:82-83` sólo reenvía `PUBLIC_API_BASE_URL`.
- `APP_DOMAIN` obligatorio para el SSR (comentario de `docker-compose.yml`).
- API: `AUTH_REFRESH_COOKIE_ENABLED`, `TRUST_PROXY_HOPS`, `FILE_STORAGE_*`, `RATE_LIMIT_DISABLED` (no debe definirse en producción).

### TX-28 — Variables de la cookie validadas pero ignoradas
**Severidad:** Baja
**Evidencia:** API `common/auth/auth.env.ts:46-48` valida `AUTH_REFRESH_COOKIE_NAME` (default `mch_refresh`), `…_PATH`, `…_SAMESITE`; `common/auth/refresh-cookie.ts:11,18,85-91` usa constantes `redesa_refresh`, `/iam/auth/token/refresh`, `sameSite:'strict'`. Cambiar la variable no cambia nada.
```gherkin
Escenario: Nombre de cookie configurable
  Dado AUTH_REFRESH_COOKIE_NAME=mch_refresh
  Cuando se inicia sesión
  Entonces la cookie se llama mch_refresh
```

---

## 10. Terminología y catálogos

- Los catálogos que pinta el front se leen de `/terminology` (107 archivos lo usan; `terminology.client.ts:95` `…/value-sets/:id/$expand`). Ejemplo bien resuelto: `bo-departments.service.ts` pide `VS_BO_DEPARTMENT`, sembrado por `BoGeographySeedService` de la API.
- Hardcodeos detectados: `features/auth/register-practitioner/register-practitioner.ts:103` `ESPECIALIDADES_ODONTOLOGICAS` (conjunto fijo de códigos para decidir UI — **sin confirmar** si coincide con lo sembrado); fixtures de `features/symptom-check/corpus.fixture.ts`.
- El mock tiene su propia terminología en `core/mock/fixtures/` — sus ids no son los uuid5 de la base; cualquier id copiado de la maqueta no existe en la API.
- Plataformas iOS/Android (`iam.devices.platform_concept_id`): no aplica a la web; bloquea sólo a la app móvil (CLAUDE.md raíz). **Sin confirmar** para el front web.
- **Qué hacer:** listar los `valueSetCode` que pide el front y comprobar `memberCount > 0` contra la base viva (una prueba de humo de catálogos).
```gherkin
Escenario: Todo catálogo que la UI pide está sembrado
  Dado la base recién reconstruida
  Cuando se expanden todos los value sets que referencia el front
  Entonces ninguno devuelve 0 conceptos
```

---

## 11. Observabilidad y calidad

### TX-23 — OpenAPI desactualizado y tipos a mano
**Severidad:** Media
**Evidencia:** `openapi/openapi.json` último commit `a5753dc7` 2026-09-19. Cruce con el código: 1 306 operaciones en OpenAPI vs 1 358 en el código ⇒ **52 rutas reales ausentes**: `/admin/catalog/*` (21), `/admin/qa/*` y `/internal/qa/plans/run-next` (17), `/admin/analytics/*` (8), `/admin/ops/*` (7), `/internal/catalog/scans/run-next`. (Las 16 «sólo en OpenAPI» son las mismas rutas con `:` escapado, no diferencias reales.) El front no genera tipos (sin `openapi-typescript`/`orval` en `package.json`); `check-api-contract-drift` compara contra `docs/integrations/backend-api.md` y hoy da 78 operaciones llamadas y no documentadas + 10 documentadas y no llamadas.
**Qué hacer:** regenerar OpenAPI en CI con `git diff --exit-code` (ya está en el workflow de la API) y derivar tipos o, al menos, un test de contrato por cliente.
```gherkin
Escenario: OpenAPI al día
  Dado un PR que agrega una ruta
  Cuando corre el CI de la API
  Entonces falla si openapi.json no incluye la ruta
```

### TX-24 — Sin CI efectivo
**Severidad:** Alta
**Evidencia:** Front `CLAUDE.md` «El CI propio está caído; los check-*.mjs se corren a mano»; `gh run list` (front) → 5 corridas de `CI` en estado `queued` hasta 40 min (runner no disponible). API `gh run list --branch dev` → últimas corridas de «Documentación» en `failure` (2026-08-18/19); del CI de la API sólo corre `postgres-privileges` de integración (CLAUDE.md raíz).
**Qué hacer:** runner operativo; que `check-client-prefixes`, `check-api-prefixes`, `check-real-api-config` y el inventario mock↔API sean obligatorios.
```gherkin
Escenario: Un PR con prefijo sin rutear no se fusiona
  Dado un PR que agrega una llamada a un prefijo nuevo
  Cuando corre el CI
  Entonces el check falla y bloquea el merge
```

### TX-25 — Suite real existente pero fuera del circuito
**Severidad:** Media
**Evidencia:** `cypress/e2e/real/` 12 specs (administrador, paciente, médico, organización, portal de turnos, estados de caso, cola de revisión, sello, caminos consumidor/médico, directorio público, foto profesional); `scripts/run-recorrido-real.mjs:111` corre `ng serve --configuration e2e-real` (sin SSR, `angular.json:101-111`) y exige `RATE_LIMIT_DISABLED=true` (l. 31). Playwright: 8 archivos mencionan API real/`localhost:3000` (`correcciones-c14-c23.real.spec.ts`, `prescription-official-pdf.spec.ts`, `carril-insurance-*`, …) — **sin confirmar** si corren sin mock. Ninguna en CI.
**Qué hacer:** correr la suite real contra el artefacto de producción real (con SSR y nginx), con el límite de tasa encendido salvo en los endpoints de alta de actores.
```gherkin
Escenario: Recorrido real contra el artefacto
  Dado el stack completo de producción levantado localmente
  Cuando se corre la suite cypress/e2e/real
  Entonces los 12 specs pasan sin RATE_LIMIT_DISABLED global
```

- OTel: `telemetry.enabled` apagado por defecto (`environment.ts:79`), `/otel` proxificado por el SSR con `limit_req` en nginx; el `traceparent` sólo sale con la telemetría encendida. Correlación front↔back depende de TX-14.

---

## 12. Rendimiento

### TX-27 — Llamadas N+1
**Severidad:** Media
**Evidencia:** `forkJoin(lista.map(…))` pidiendo por ítem:
- `features/account/access-requests/access-requests.ts:73` — una lectura por solicitud pendiente.
- `features/account/medical-record/medical-record.ts:348` — `forms.getMyInstance` por ítem.
- `features/account/my-profile/medical-articles/medical-articles.ts:201` — `community.readPost` por publicación de la página.
- `features/clinical-record/consultation/payment-plan-panel/payment-plan-panel.ts:201` — `getQuotation` por cotización vigente.
- `features/dashboard/consultas-resumen/consultas-resumen.ts:154-159` — `searchBookings(limit:500)` por recurso.
- `practitioner-availability`: hasta 2 `GET /scheduling/slots` por sede (comentario del interceptor l. 263-265).
Con latencia fija de 40-120 ms del mock no se nota; contra la API con 300 req/min globales por IP, una página de 20 artículos consume 21 peticiones.
**Qué hacer:** endpoints de lista que devuelvan lo necesario (o `ids=` en lote).
```gherkin
Escenario: Lista de artículos en una petición
  Dado una médica con 20 artículos
  Cuando abre "Mis artículos"
  Entonces la pantalla hace como máximo 2 peticiones a la API
```

- Bundles: `check-bundle-budget` ✓ — inicial 249 kB (sobre el `dist/` del 16/09); 851 fragmentos diferidos, el mayor 595 kB. El simulador (~0,5 MB) va en un fragmento diferido y en producción real no debería existir (TX-01). SSR: las rutas con sesión van en `RenderMode.Client` (`app.routes.server.ts:5-16`) — correcto.

---

## 13. Seguridad

- Tokens en almacenamiento accesible por script: TX-10.
- **TX-31 (Baja)** — `localStorage` con contenido que puede ser clínico: plantillas de mensajes del médico (`core/messaging/message-templates.ts:104`), configuración de auto-respuesta (`chat-auto-reply.ts:281`) y preferencias de chat; `sessionStorage` de tarifarios (`features/admin/medical-laboratory/tarifarios-recordados.ts:93`). El mock persiste tablas clínicas sintéticas en `sessionStorage` (sólo maqueta). La auto-respuesta es lógica de cliente aunque la API ya expone `GET/PUT /community/profiles/:id/auto-reply`.
  ```gherkin
  Escenario: Dispositivo compartido
    Dado una médica que cierra sesión en un equipo compartido
    Cuando otra persona abre el navegador
    Entonces no quedan plantillas ni datos de la sesión anterior en localStorage
  ```
- PII en logs del front: `console.log/info/debug` fuera de `core/mock` y del stock → 0 coincidencias. Login: el span registra categoría, nunca el mensaje (`auth.service.ts:91-93`). API: `pino-options.ts:62` redacta y quita rutas.
- Rate limiting en rutas públicas: global 300/min por IP + específicos en `/iam/auth/*`; las rutas `/public/*` sólo con el global (**sin confirmar** si hay `@Throttle` propios). Ver TX-19.
- Triage con PHI a tercero: TX-08. `allowedHosts` con túneles: TX-21.
- Swagger/Scalar se apagan con `NODE_ENV=production` (`main.ts:173`) — confirmar que el compose lo fija.

---

## Checklist de apagado del mock (orden sugerido)

1. **Decidir la rama fuente** del despliegue real (hoy dev y mockup tienen `mockBackend: true`) y traer a ella los 80 commits de mockup que falten (TX-01).
2. **Cerrar la brecha de rutas** antes de tocar el interruptor: las 19 operaciones de TX-05 (implementar en API o reescribir cliente) y convertir `respuestaGenerica` en 501 para que la maqueta deje de ocultar faltantes (TX-06).
3. **Alinear el mock al contrato real de errores** (422/400/`details.violations`) y corregir las pantallas que ramifican por 412 (TX-12); sumar los 3 códigos faltantes (TX-13).
4. **Retirar lo que sólo existe en el mock** o darle par real: claim `ownTenantId` (TX-11), aviso de horario liberado (TX-18), fixtures sin interruptor en pantallas (TX-26), redirección de `/public/media` en `server.ts` (TX-22), cartel de cuentas demo (TX-04).
5. **Enrutado de producción:** `/loyalty`, `/patients/me/reviews` y `/ai` en `proxy.conf.json`, `proxy.conf.docker.json` y `deploy/api-locations.conf`; `check-*-prefixes` en verde (TX-07).
6. **Triage IA:** localizar el servicio, acordar tratamiento de datos, enrutarlo y quitar la IP del repo (TX-08).
7. **Sesión:** soportar el modo cookie httpOnly y encenderlo; `endSession` limpia el almacenamiento; `restoreSession` sólo borra ante 401 (TX-10, TX-30); `scopedRoles` en menús (TX-15); selector de tenant ante `TENANT_REQUIRED` (TX-16).
8. **Archivos:** descarga por blob o endpoint de firma pública (TX-09); worker de escaneo en el compose (TX-33); adaptador y respaldo de almacenamiento (TX-34).
9. **Tiempo real:** token del socket renovable y prueba de chat detrás de nginx (TX-17).
10. **Configuración de build de producción real** con SSR, demos en `false`, `ARG` del Dockerfile y `allowedHosts` sin túneles (TX-01, TX-03, TX-21); extender `check-real-api-config`.
11. **SSR contra la API** de las 11 rutas `RenderMode.Server` y del prerender (TX-02).
12. **Observabilidad:** `X-Request-Id` UUID de punta a punta (TX-14); OpenAPI regenerado (TX-23).
13. **CI operativo** con los `check-*.mjs` y el inventario mock↔API obligatorios (TX-24).
14. **Suite real** (`cypress/e2e/real` + Playwright `.real`) contra el artefacto de producción con SSR, nginx y límites de tasa encendidos (TX-25, TX-19); medir N+1 (TX-27).
15. **Recién entonces** construir con la configuración real, desplegar en staging con datos sintéticos, y dejar la maqueta como despliegue aparte (`mockBackend: true` sólo en su propia configuración).

## No cubierto
- Nada se ejecutó contra la API ni el front levantados: todas las afirmaciones son de código (peldaño DISCOVERED).
- No se revisó pantalla por pantalla la forma de cada respuesta (eso es de los auditores por dominio).
- Pasarela de pago y delivery: excluidos por pedido.
- `proxy.conf.docker.json` sólo se leyó a través de `check-api-prefixes`.
- Si el `ThrottlerModule` usa ya Redis, si el gateway WS re-verifica tokens, si la API emite `SLOT_RELEASED`, dónde vive AlovidaAIService: sin confirmar.
