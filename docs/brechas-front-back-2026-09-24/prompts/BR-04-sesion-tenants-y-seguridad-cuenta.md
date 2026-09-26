# TASK PROMPT: BR-04 — Sesión, tenants y seguridad de la cuenta

> **MODO DE EJECUCIÓN:** este prompt se ejecuta en **Modo Planificación (Planning Mode)**.
> El desarrollador o el agente arranca investigando, sin tocar código fuente. Con eso escribe un
> `implementation_plan.md` detallado y espera la aprobación explícita del usuario. Después
> ejecuta los cambios en commits atómicos, verifica con pruebas unitarias y de integración, y
> **contra el artefacto real levantado**. El resultado queda documentado en `walkthrough.md`.

| Campo | Valor |
|---|---|
| **Cierra** | TX-10, TX-11, TX-15, TX-16, TX-19, TX-20, TX-28, TX-29, TX-30, TX-31 (anexo D) · ID-24 (anexo A) · CV-22 (anexo E) |
| **Severidad máxima** | Alta (TX-10, TX-11) |
| **Repo(s)** | `mantra-core-health` (front): `core/auth`, `core/http`, `core/navigation`, `features/account`. `mantra-core-health-api` (clon `mantra-core-health-redesa-api`): `common/auth`, `common/tenant`, `modules/iam` |
| **Toca el modelo** | No. `iam.sessions`, `iam.refresh_tokens`, `iam.mfa_factors`, `iam.authentication_credentials` ya existen |
| **Depende de** | Nada para empezar. La prueba de punta a punta usa el artefacto de BR-01 detrás de nginx (la cookie es `SameSite=Strict`, mismo origen) |
| **Decisión previa** | **D-I**: encender la cookie httpOnly del refresh (`AUTH_REFRESH_COOKIE_ENABLED`). Sub-decisiones del plan: TX-11 (`ownTenantId`), TX-29 (MFA obligatorio para roles administrativos) e ID-24 (cambio de contraseña y sesiones) |

---

## 1. Contexto de negocio y justificación técnica

### A. Por qué importa
Es la puerta de entrada de todos los actores. Hoy el refresh token de **30 días** vive en
`localStorage`, al alcance de cualquier script; la API ya sabe entregarlo como cookie httpOnly,
pero si se enciende sin tocar el front **la sesión se pierde en cada recarga**. La médica con dos
organizaciones ve el selector en cada sesión porque el front espera un claim que sólo firma el
mock. Los menús usan roles planos y muestran secciones de otra organización. Un corte de red al
arrancar desloguea. Una clínica detrás de un NAT choca contra el límite de tasa por IP. Y el
usuario no tiene dónde cambiar su contraseña ni cerrar sus otras sesiones.

### B. Estado del frontend (`mantra-core-health`, `mockup` @ `9b3e0101`, verificado)
- **Refresh en `localStorage` (TX-10):** `core/auth/refresh-token.storage.ts:4`
  `REFRESH_TOKEN_STORAGE_KEY = 'mantra.refresh-token'`. `data-access/iam/iam.client.ts:89-93`
  manda siempre `{ refreshToken }`. `core/auth/session.store.ts:38` convierte `''` en `null`: con
  la cookie encendida, el cuerpo trae `refreshToken: ''`, no se guarda nada y `restoreSession`
  (`auth.service.ts:191-195`) devuelve `false` sin pedir → **sesión perdida al recargar**.
- **Logout y arranque (TX-10, TX-30):** `core/http/auth.interceptor.ts:185` `endSession` limpia el
  store pero no el almacenamiento; `auth.service.ts:197-205` borra el token ante **cualquier** error
  del refresh, incluidos status 0 (sin red) y 429.
- **`ownTenantId` (TX-11):** `core/auth/access-token.ts:65,155-166` y `session.store.ts:91-117`
  lo usan para elegir organización. Sólo lo firma el mock (`core/mock/mock-session.ts:22,94,211`).
  Existe `SELECTED_TENANT_STORAGE_KEY = 'mantra.selected-tenant'` (`refresh-token.storage.ts:17`).
- **`scopedRoles` y tenant (TX-15, TX-16):** `grep scopedRoles src/app` → 0 (menús y
  `section-roles.guard.ts` usan `roles` plano); `auth.interceptor.ts:152-176` manda `X-Tenant-Id`
  sólo con tenant activo y un 403 se pinta como muro sin salida.
- **MFA (TX-29):** `iam.client.ts:83` manda `mfaCode` si existe; `features/auth/login/login.ts:83,95-100`
  mantiene el control sin dibujarlo «porque el backend no emite ninguna señal».
- **Almacenamiento con contenido sensible (TX-31):** plantillas de mensajes del médico
  (`core/messaging/message-templates.ts:104`), auto-respuesta (`chat-auto-reply.ts:281`), tarifarios
  en `sessionStorage` (`features/admin/medical-laboratory/tarifarios-recordados.ts:93`). La API ya
  expone `GET/PUT /community/profiles/:id/auto-reply`.
- **Cuenta (ID-24, CV-22):** no hay pantalla de seguridad en `features/account/*`;
  `auth.service.ts:134` usa `logout`, no `logout-all`. **Mismo origen (TX-20):** `apiBaseUrl`
  vacío recomendado; `server/security-headers.ts:235` suma el origen de la API a `connect-src`.

### C. Estado de la API (`dev` @ `7541797c`, verificado)
- **Cookie (TX-10):** `modules/iam/controllers/iam-auth.controller.ts:332-375`: con la cookie
  encendida lee el refresh de la cookie (`readRefreshCookie`), escribe `Set-Cookie` y devuelve
  `refreshToken: ''` (l. 375). `dto/refresh-token.dto.ts:25-28`: el campo sólo es obligatorio con
  la cookie apagada (`@ValidateIf`). `logout` limpia la cookie (l. ~400). Default en Coolify:
  `AUTH_REFRESH_COOKIE_ENABLED:-false` (`docker-compose.coolify.yml:186`).
- **Variables ignoradas (TX-28):** `common/auth/auth.env.ts:46-48` valida
  `AUTH_REFRESH_COOKIE_NAME` (default **`mch_refresh`**), `_PATH` y `_SAMESITE`, pero
  `common/auth/refresh-cookie.ts:11,87,106` usa las constantes `redesa_refresh`,
  `/iam/auth/token/refresh` y `sameSite:'strict'`. Ojo: honrar la variable **cambia el nombre
  efectivo** de `redesa_refresh` a `mch_refresh` salvo que se ajuste el default.
- **Claims:** `common/auth/jwt-payload.interface.ts` trae `scopedRoles` (l. 25) y `tenantNames`
  (l. 49), **no** `ownTenantId`. `common/auth/roles.guard.ts:37-52`: un código en `scopedRoles`
  sólo autoriza en esos tenants; uno que no aparece es global; `SUPERADMIN` es comodín (TX-15).
- **Tenant (TX-16):** `common/tenant/tenant-resolution.ts:49-53` → 403 «no pertenece a ningún
  tenant» / «pertenece a varios»; `common/tenant/tenant-context.ts:41-44` `requireTenantId` →
  **422** `PRECONDITION_FAILED`. Mismo problema, dos respuestas.
- **Límite de tasa (TX-19):** `iam-auth.controller.ts` login 10/min, forgot 5/min, reset 10/min,
  refresh 20/min; global 300/min (`app.module.ts:140-148`). **El almacenamiento Redis ya está
  cableado** (`app.module.ts:258` `{ provide: ThrottlerStorage, useClass: RedisThrottlerStorage }`;
  el anexo D lo daba «sin confirmar»). El `ThrottlerGuard` (l. 257) usa el tracker por defecto,
  `req.ip`, con `TRUST_PROXY_HOPS=2` (`main.ts:128-131`).
- **MFA (TX-29):** `LoginDto` acepta `mfaCode`; `grep mfa iam-auth.service.ts` → 0: no hay desafío.
- **Cuenta (ID-24, CV-22):** sólo `forgot/reset-password`, `logout`, `logout-all`;
  `GET /iam/users/:id/sessions|devices|mfa-factors` son `SECURITY_ADMIN` (`iam-users.controller.ts:169-196`).
  **CORS (TX-20):** `main.ts:143-145` `origin:false`, también en el gateway WS.

### D. Aislamiento
Sin cambios de negocio ni de modelo. La API suma rutas de la propia cuenta (si se deciden) y
`details.reason` en errores existentes **sin cambiar status**; el front cambia el ciclo de sesión,
el tenant y los roles efectivos. La maqueta sigue: el mock firma `scopedRoles` y no `ownTenantId`.

---

## 2. Flujo de Git y entrega

```bash
cd mantra-core-health-redesa-api && git status && git fetch origin && git checkout -b <dev>/feat-sesion-cookie-y-cuenta origin/dev
cd ../mantra-core-health && git status && git fetch origin && git checkout -b <dev>/feat-sesion-cookie-tenants origin/mockup
```

- **Dos PR independientes.** API: `gh pr create --base dev`. Front: `gh pr create --base mockup`.
  Revisores `jsaldias39,PabloArauzCaballero` en los dos. El front soporta los dos modos de
  refresh, así que ninguno espera al otro.
- Commits atómicos, por ejemplo:
  - API: `fix(auth): refresh-cookie honra AUTH_REFRESH_COOKIE_NAME/PATH/SAMESITE`,
    `feat(tenant): details.reason TENANT_REQUIRED en 403 y 422`,
    `feat(auth): throttle de login por IP+identificador y de refresh por sesión`,
    `feat(iam): change-password y /iam/me/sessions`, `feat(auth): desafío MFA_REQUIRED`
  - Front: `feat(auth): modo cookie`, `fix(auth): endSession y restoreSession`,
    `feat(auth): roles efectivos desde scopedRoles`, `fix(auth): tenant sin ownTenantId`,
    `feat(account): sección Seguridad`, `fix(mock): claims iguales a los de la API`
- **El merge exige revisión humana.** El flujo termina en abrir los PR.

---

## 3. Diagrama

```mermaid
sequenceDiagram
    autonumber
    actor U as Navegador
    participant F as Front (mismo origen)
    participant A as API
    U->>F: F5 (arranque)
    F->>A: POST /iam/auth/token/refresh {} (Cookie: redesa_refresh, SameSite=Strict)
    A-->>F: 200 {accessToken, refreshToken:""} + Set-Cookie rotada
    F->>F: roles efectivos = roles globales ∪ scopedRoles[tenant activo]
    F->>A: GET /scheduling/... (Authorization, X-Tenant-Id)
    alt Sin tenant resoluble
        A-->>F: 403/422 details.reason = TENANT_REQUIRED
        F->>U: selector de organización (no el muro)
    end
    U->>F: Cerrar sesión
    F->>A: POST /iam/auth/logout
    A-->>F: 200 + cookie borrada; sesión revocada
    F->>F: limpia store y claves mantra.* del almacenamiento
```

---

## 4. Archivos a modificar o crear

**API (`mantra-core-health-redesa-api`)**
- `[MODIFICAR]` `src/common/auth/refresh-cookie.ts` y `auth.env.ts`: usar las tres variables; fijar
  el default del nombre en `redesa_refresh` o documentar el cambio a `mch_refresh` (TX-28).
- `[MODIFICAR]` `src/common/tenant/tenant-resolution.ts` y `tenant-context.ts`:
  `details.reason = 'TENANT_REQUIRED'` (y `TENANT_AMBIGUOUS` si hay varios) sin cambiar status
  (TX-16). Revisar los int-specs `redis-runtime`/`search-platform` que esperan 403 y reciben 422.
- `[CREAR]` `src/common/security/auth-throttler.guard.ts`: tracker `ip + identificador
  normalizado` para `login`/`forgot-password`, y `sid` o hash del refresh para `token/refresh`
  (TX-19). Respuesta 429 con `code: RATE_LIMITED` y `Retry-After`.
- `[MODIFICAR]` `src/modules/iam/controllers/iam-auth.controller.ts` + servicio: si D-I/TX-29 lo
  aprueban, desafío `401 details.reason = MFA_REQUIRED` para cuentas con factor verificado.
- `[CREAR]` rutas de la propia cuenta, si ID-24 entra: `POST /iam/auth/change-password`
  (actual + nueva, revoca las otras sesiones), `GET /iam/me/sessions`,
  `POST /iam/me/sessions/:id/revoke`. DTO con `whitelist`; `@TenantAgnostic()`.
- `[CREAR]` specs: `iam-auth.controller.spec.ts` (cookie, desafío), `auth-throttler.guard.spec.ts`,
  y que `iam.module.spec.ts` exija los controladores en `controllers`.
- `[MODIFICAR]` `docker-compose.coolify.yml`: `AUTH_REFRESH_COOKIE_ENABLED` según D-I;
  `RATE_LIMIT_DISABLED` sin definir.
- `[DOCUMENTAR]` `src/common/auth/README.md` y `docs/api/conventions.md`: mismo origen (TX-20),
  `TENANT_REQUIRED`, `MFA_REQUIRED`.

**Front (`mantra-core-health`)**
- `[MODIFICAR]` `src/environments/*` y `scripts/generate-env.mjs`: `PUBLIC_REFRESH_COOKIE`
  (booleano público, no es secreto).
- `[MODIFICAR]` `core/auth/auth.service.ts`: `restoreSession` en modo cookie pide el refresh sin
  cuerpo; sólo borra ante 400/401 (TX-30); 429 y status 0 conservan la sesión y reintentan.
- `[MODIFICAR]` `core/data-access/iam/iam.client.ts`: `refresh()` sin cuerpo en modo cookie.
- `[MODIFICAR]` `core/http/auth.interceptor.ts`: `endSession` limpia almacenamiento; al recibir
  `TENANT_REQUIRED` navega al selector; al recibir 429 no desloguea.
- `[MODIFICAR]` `core/auth/session.store.ts` y `access-token.ts`: retirar `ownTenantId`; tenant por
  defecto = último elegido (`mantra.selected-tenant`) si sigue en `tenants`; `effectiveRoles`
  calculado con la regla de `roles.guard.ts`.
- `[MODIFICAR]` `core/navigation/*` y `section-roles.guard.ts`: usar `effectiveRoles` (TX-15).
- `[MODIFICAR]` `features/auth/login/login.ts`: paso de código MFA ante `MFA_REQUIRED`.
- `[CREAR]` `features/account/security/` (por CLI): cambiar contraseña, sesiones abiertas,
  «cerrar sesión en todos lados» (`logout-all`), factores MFA si hay rutas propias.
- `[MODIFICAR]` `core/messaging/message-templates.ts`, `chat-auto-reply.ts`,
  `tarifarios-recordados.ts`: la auto-respuesta se lee y escribe en la API; el resto se borra al
  cerrar sesión (TX-31).
- `[MODIFICAR]` `core/mock/mock-session.ts` y `handlers/auth.handlers.ts`: sin `ownTenantId`, con
  `scopedRoles`, cookie simulada y token de 15 min.

---

## 5. Reglas de implementación

- **Paso 1 del plan: pedir la decisión D-I.** Opciones:

  | Opción | A favor | En contra |
  |---|---|---|
  | **A** Encender la cookie en producción (recomendada) | El refresh sale del alcance de JavaScript; la API ya lo soporta; `SameSite=Strict` y `path` acotado | Exige mismo origen (ya obligatorio por TX-20); el front necesita el modo cookie; no sirve para la app móvil, que sigue con cuerpo |
  | **B** Mantener `localStorage` y endurecer | Cero cambios de despliegue | Un XSS se lleva 30 días de sesión; incumple la recomendación de la propia API |
  | **C** Transición: el front soporta ambos y el entorno decide | Se despliega sin coordinar; se puede volver atrás | Dos caminos que probar; hay que fijar fecha para retirar B |

- **Sub-decisiones que el plan tiene que dejar escritas**, cada una con dueño: TX-11 (el front deja
  de esperar `ownTenantId`, **recomendado**, o la API define «mi consultorio», que es una decisión
  de modelo y va aparte); TX-29 (qué roles exigen MFA); ID-24 (si el cambio de contraseña y las
  sesiones entran en el lanzamiento).
- **La autoridad es la API.** `effectiveRoles` sólo decide qué se muestra; nunca reemplaza el 403.
- **Mismo origen es un requisito** (TX-20): no se abre CORS. Si algún día se separan dominios, se
  declara la allowlist en la API en un prompt aparte.
- **No se cambian status existentes:** `TENANT_REQUIRED` va en `details.reason`.
- **Nada de secretos en el front**; el flag de cookie es público.
- **Un caso de uso = una transacción** en `change-password` (credencial nueva + revocación de
  sesiones).
- **El mock firma exactamente las claves que firma la API** (ni `ownTenantId` ni menos que
  `scopedRoles`).
- La app móvil no se toca: sigue con refresh en el cuerpo (la cookie es por entorno web).

---

## 6. Criterios de aceptación (Gherkin)

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
  Entonces la API responde 401 y no queda ninguna clave "mantra.*" de sesión

Escenario: Arranque sin red
  Dado un refresh válido guardado
  Cuando la aplicación arranca con la API inalcanzable
  Entonces la sesión no se borra y se restaura al volver la red

Escenario: Profesional con consultorio propio y una clínica
  Dado una cuenta con 2 tenants y la API real
  Cuando inicia sesión por segunda vez en el dispositivo
  Entonces entra en la última organización elegida, sin selector

Escenario: Rol concedido en otra organización
  Dado una persona con RECEPTIONIST sólo en la clínica A y tenant activo B
  Cuando abre el menú
  Entonces no ve las secciones de recepción

Escenario: Usuario con varias organizaciones sin elegir
  Dado un token con 2 tenants y ninguno activo
  Cuando pide un recurso con alcance de tenant
  Entonces la API responde con details.reason TENANT_REQUIRED y la UI abre el selector

Escenario: Diez personas de la misma clínica entran a la vez
  Dado 12 cuentas distintas saliendo por la misma IP
  Cuando las 12 inician sesión en el mismo minuto
  Entonces ninguna recibe 429

Escenario: Fuerza bruta sobre una cuenta
  Dado una cuenta
  Cuando se prueban 11 contraseñas en un minuto
  Entonces el intento 11 recibe 429 RATE_LIMITED con Retry-After y la UI lo explica

Escenario: Cerrar sesión en todos lados
  Dado un usuario con dos sesiones abiertas
  Cuando elige "Cerrar sesión en todos lados"
  Entonces la otra sesión recibe 401 en su próxima llamada

Escenario: Cambio de contraseña
  Dado un usuario logueado
  Cuando cambia su contraseña con la actual correcta
  Entonces la API responde 200 y las otras sesiones quedan revocadas

Escenario: Nombre de cookie configurable
  Dado AUTH_REFRESH_COOKIE_NAME=mch_refresh
  Cuando se inicia sesión
  Entonces la cookie se llama mch_refresh y el refresh la lee con ese nombre
```

---

## 7. Definition of Done

- [ ] `implementation_plan.md` aprobado con **D-I** y las sub-decisiones TX-11, TX-29 e ID-24
      escritas.
- [ ] API: cookie configurable, `TENANT_REQUIRED`, throttle compuesto, (MFA y cuenta si entran).
      `corepack yarn build`, `corepack yarn typecheck`, `corepack yarn lint --max-warnings=0` y
      `corepack yarn test` en verde.
- [ ] Rutas nuevas: `node dist/src/main.js` y el log con `Mapped {/iam/auth/change-password, POST}`
      y `Mapped {/iam/me/sessions, GET}`; `iam.module.spec.ts` exige el controlador en
      `controllers`.
- [ ] Front: modo cookie, `endSession` limpio, `restoreSession` selectivo, `effectiveRoles`,
      selector ante `TENANT_REQUIRED`, sección Seguridad, mock con claims de la API.
      `corepack yarn lint`, `typecheck`, `build`, `test --watch=false` en verde.
- [ ] **Evidencia de runtime pegada en los PR**, contra la API viva detrás de nginx: `curl -si` del
      login con `Set-Cookie: redesa_refresh=…; HttpOnly; SameSite=Strict` y `refreshToken:""`;
      DevTools sin `mantra.refresh-token` y F5 que conserva la sesión; refresh viejo tras logout →
      401; 12 logins desde una IP sin 429 y 11 contraseñas malas → 429 con `Retry-After`; cambio de
      contraseña UI → request → response → persistencia → recarga → UI.
- [ ] PR abiertos (`--base dev` y `--base mockup`) con revisores `jsaldias39` y
      `PabloArauzCaballero`, y `walkthrough.md`.

---

## 8. Plan de QA

### A. Pruebas automatizadas
```bash
corepack yarn test src/common/auth src/common/tenant src/modules/iam   # API
corepack yarn test:integration --testPathPatterns=iam                    # API
corepack yarn test --watch=false --include=src/app/core/{auth,http,navigation}/**
```
- Specs: `effectiveRoles` con la tabla de verdad de `roles.guard.ts`; `restoreSession` para 0, 400,
  401, 429 y 503.

### B. Integración (artefacto real)
1. `mantra-redesa` con `AUTH_REFRESH_COOKIE_ENABLED=true`, sin `RATE_LIMIT_DISABLED`; front
   `production-api` (BR-01) detrás de nginx.
2. Médica de dos organizaciones: login → elegir B → F5 → cerrar → volver a entrar (entra en B).
3. Dos navegadores: «cerrar sesión en todos lados» en uno; el otro recibe 401.
4. Correr `cypress/e2e/real` con el límite de tasa encendido y anotar lo que choca.

### C. Verificación manual y logs
- Log de la API: ningún refresh token en claro. Navegador: ninguna clave de sesión tras cerrar.
