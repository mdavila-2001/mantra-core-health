# Coordinación entre sesiones que editan este repo

Archivo vivo. Existe para que dos personas (o dos agentes) trabajando a la vez sobre
`justin/j3-t13-auth-y-cva` no se pisen. **Si vas a editar, agregá tu bloque antes de tocar nada.**

---

## Sesión en curso · cierre de Fase 3 (J4, J8, J9 + Home)

**Empezó:** 2026-08-01 · **Rama:** `justin/j3-t13-auth-y-cva` · **Base:** `8d6b1d7`

### Archivos que estoy creando (nuevos, no deberían chocar)

```
src/app/core/http/api-error.ts              J4 · forma estable del error de la API
src/app/core/http/api-error.spec.ts
src/app/core/auth/auth.service.ts           J8 · sesión persistida, login/logout
src/app/core/auth/auth.service.spec.ts
src/app/core/auth/auth.guard.ts             J8 · authGuard / guestGuard / tenantGuard
src/app/core/auth/auth.guard.spec.ts
src/app/core/auth/session.storage.ts        J8 · persistencia del refresh token
src/app/core/layout/breakpoints.ts           tarjeta 10 · el shell pasa a cajón en móvil
src/app/core/data-access/public/             cliente del directorio público (carpeta nueva)
src/app/features/auth/login/                 J9 · pantalla de ingreso
src/app/features/auth/select-organization/   J9 · elección de organización
src/app/features/auth/forgot-password/       recuperación · sobre TU endpoint
src/app/features/auth/reset-password/        recuperación · sobre TU endpoint
src/app/features/shell-layout/               armazón de las pantallas con sesión
src/app/features/dashboard/                  panel autenticado (reemplaza el Home de Angular)
```

### Archivos existentes que estoy modificando

| Archivo | Qué le hago |
|---|---|
| `src/app/app.routes.ts` | Reestructura completa: `/auth/login`, `/auth/organizacion`, área protegida bajo el Shell |
| `src/app/app.routes.server.ts` | Las rutas con sesión pasan a `RenderMode.Client` (ver más abajo) |
| `src/app/app.config.ts` | Agrega el arranque de `AuthService` |
| `src/app/core/http/auth.interceptor.ts` | Solo la constante `LOGIN_ROUTE`: `/auth` → `/auth/login` |
| `src/app/features/home/` | **Se elimina**: era el boilerplate de Angular |
| `src/app/features/auth/auth.ts` | **Se elimina**: era `<p>auth works!</p>` |

### Lo que NO estoy tocando — es todo tuyo

- `src/app/shared/components/**` entero (átomos, moléculas, organismos) y sus `.css`
- `src/app/features/design-system-sample/**` (la vitrina)
- `src/app/core/tokens/**`, `src/app/core/view-state/**`
- `src/app/core/data-access/terminology/**` — es tuyo entero
- `src/styles.css`

### Respuesta a tu bloque · gracias, y dos cosas

**Usé tu recuperación de contraseña.** Están las dos pantallas: `/auth/recuperar` (pide el enlace)
y `/auth/restablecer?token=…` (lo consume). El «¿Olvidaste tu contraseña?» del login ya apunta ahí,
y respeté lo que marcaste: la pantalla **no interpreta el resultado exitoso**, muestra tu mensaje
tal cual y no dice en ningún caso si la cuenta existe. Hay una prueba que lo fija buscando que el
texto no contenga «no existe», «no encontramos» ni «no está registrado».

Toqué **dos archivos de `core/data-access/iam/`** (`iam.client.ts` y `iam.types.ts`) para agregar
`requestPasswordReset`, `resetPassword` y `logout`. Dijiste que sólo tocabas `terminology/`, así que
no deberíamos chocar, pero queda dicho. También agregué `forgot-password` y `reset-password` a
`PUBLIC_PATHS` del interceptor: sin eso, un 401 de recuperación dispararía un intento de refresco.

**Lo que dejé sin usar de lo tuyo:** el `$expand` de terminología, porque ninguna pantalla de las
que escribí tiene un campo de vocabulario. Tu cliente queda listo para la primera que lo necesite.

### Segunda ronda · usé los cuatro cierres del backend

Vi tu reescritura de `PENDIENTES-BACKEND.md`. Los cuatro están consumidos y verificados contra la
API ya reconstruida:

- **`FORBIDDEN_IDENTITY_HINTS` borrada**, como pediste. `api-error.ts` ramifica sobre
  `IDENTITY_VERIFICATION_REQUIRED` y guarda `details.reason`. Un detalle que quizá te interese:
  **`no-person-linked` no ofrece el trámite de verificación** — mandar a verificar la identidad de
  una persona que todavía no está vinculada a la cuenta sería un callejón con cartel de salida—.
  Los otros dos subcasos sí lo ofrecen.
- **`POST /iam/auth/logout` se llama al cerrar sesión.** Verificado en el navegador: después del
  logout, reusar el refresh token da 401.
- **Claims `name` y `tenantNames` en uso.** El encabezado dice «Administrador Postman» y la
  elección de organización muestra «Mantra Core Default Tenant». Ambos con respaldo al identificador
  acortado si el claim falta, porque los omitís cuando están vacíos.
- **La recuperación de contraseña ahora sí responde**: pedir el enlace da 202 contra la API real.

**El `correlationId` ya está arreglado** (PR #25 de la API, mergeado). Viajaba como número aunque el
DTO lo declarara `string`: `pino-http` numera las peticiones y el tipo inline del filtro lo declaraba
`string` con un cast que silenciaba la contradicción, así que el compilador nunca la vio. Se
normaliza en el filtro, no en cada cliente, porque el contrato publicado es el del servidor.

Toqué **solo** `all-exceptions.filter.ts` y su spec, en una rama aparte, para no arrastrar tus 167
archivos en curso. De paso quedaron cubiertos dos casos que se perdían: `x-request-id` repetido
—Express lo entrega como array y el cast dejaba pasar el array entero— y los `NaN`, que ahora quedan
`undefined` en vez de convertirse en el texto «NaN».

**Un aviso de proceso:** en una corrida vi `data-table.spec.ts` fallar entero y a la siguiente pasar
sin tocar nada. Si te aparece, mirá si no estábamos corriendo `yarn test` los dos a la vez.

---

## Sesión en curso · cola de Pablo (backend) + cliente de terminología

**Empezó:** 2026-08-01 · **Rama:** `justin/j3-t13-auth-y-cva` · **Base:** `8d6b1d7`

Casi todo mi trabajo está en **el otro repositorio** (`mantra-core-health-redesa-api`). Acá toco
sólo lo que ese trabajo desbloquea, dentro de lo que tu bloque marca como mío.

### Archivos que estoy creando (nuevos, no chocan con los tuyos)

```
src/app/core/data-access/terminology/terminology.types.ts    P3 · contrato del $expand de lectura
src/app/core/data-access/terminology/terminology.client.ts
src/app/core/data-access/terminology/terminology.client.spec.ts
```

Reemplaza el `README.md` de esa carpeta, que documentaba por qué estaba vacía.

### Lo que NO estoy tocando

Nada de lo tuyo: ni `core/auth/**`, ni `core/http/**`, ni `features/**`, ni `app.routes.ts`,
ni `app.config.ts`. El resto de `core/data-access/**` tampoco cambia.

### Lo que cambió del lado de la API y te sirve

- **`GET /terminology/value-sets/:id/$expand`** ya existe: autenticado, **sin exigir rol de
  administración**, paginado por cursor. Verificado contra la API viva.
- **`POST /iam/auth/forgot-password`** y **`POST /iam/auth/reset-password`** ya existen, ambos
  públicos. El enlace «¿Olvidó su clave?» del diseño ya tiene a dónde apuntar: `forgot-password`
  responde **202 y el mismo mensaje siempre**, exista o no la cuenta — no muestres «ese correo no
  está registrado», el backend no te lo va a decir a propósito.
- **La cuenta de demostración se siembra sola** al arrancar la API si están
  `BOOTSTRAP_ADMIN_EMAIL` y `BOOTSTRAP_ADMIN_PASSWORD`; ya no hace falta `yarn postman:bootstrap`
  a mano.

---

## Dos decisiones que te afectan si tocás rutas

**1. Las rutas con sesión no se pueden prerenderizar.** La sesión vive en el navegador
(`localStorage` + memoria) y el servidor no la ve, así que prerenderizar una pantalla protegida
produce HTML de «no autenticado» que después parpadea al hidratar. Por eso el área protegida va
con `RenderMode.Client` y solo `/auth/**` sigue prerenderizada.

**2. El guard espera a que la sesión se restaure.** Al recargar, `AuthService` cambia el refresh
token guardado por un par nuevo (una petición). Si el guard leyera el store antes de eso, echaría
al login a alguien que sí tiene sesión. `authGuard` hace `await auth.ensureRestored()` primero.
Si agregás un guard nuevo sobre el área protegida, hacé lo mismo.

---

## Cómo levantar todo

```bash
# Almacenes (nunca el servicio `api` del compose: arranca con DDL propio)
docker compose up -d postgres mongodb redis opensearch minio

corepack yarn start          # API, en su repo, puerto 3000
corepack yarn start          # frontend, acá, puerto 4200
```

**Cuenta de demostración** (la siembra `yarn postman:bootstrap` en el repo de la API):

```
admin@redesa.test / S3cret-passw0rd
```

Verificada hoy contra la API viva: devuelve 200 con roles `SECURITY_ADMIN`, `SUPERADMIN` y un
tenant. Es la que usa la pantalla de login para la demo.

---

## Sesión en curso · endurecimiento para producción (código)

Cierro los pendientes de código del portal documental: seguridad, errores,
accesibilidad, sesión y pruebas. **No toco nada de telemetría** — ver abajo.

### Archivos que estoy creando (nuevos, no chocan)

```text
src/server/security-headers.ts        + .spec.ts
src/app/core/build/build-info.ts
src/app/core/errors/error-reporter.ts + .spec.ts
src/app/core/errors/app-error-handler.ts
src/app/shared/a11y/announce-on-appear.ts + .spec.ts
src/app/features/error-recovery/
src/app/features/not-found/
src/app/features/identity-verification/
src/app/features/dashboard/dashboard.spec.ts
src/app/features/shell-layout/shell-layout.spec.ts
src/app/core/http/token-refresh.service.spec.ts
```

### Archivos existentes que estoy modificando

| Archivo | Qué |
|---|---|
| `src/server.ts` | Cabeceras de seguridad + CSP por hash |
| `src/app/app.config.ts` | `ErrorHandler` propio, cierre de sesión entre pestañas |
| `src/app/app.routes.ts` | Rutas `/error`, `/identidad/verificar`, 404 en el comodín |
| `src/app/core/http/error-to-view-state.ts` | `IDENTITY_VERIFICATION_ROUTE` apuntaba a la API, no al router |
| `src/app/core/http/auth.interceptor.ts` | Refresco proactivo con `isAccessTokenExpired` |
| `src/app/core/auth/auth.service.ts` · `refresh-token.storage.ts` | Organización persistida, oyente de `storage` |
| Las 6 plantillas de `features/auth/` | Directiva `appAnuncio` (región viva + foco) |
| `src/app/features/shell-layout/shell-layout.ts` | Ítem de menú de la pantalla nueva |
| `src/app/shared/index.ts` | Exporta `AnnounceOnAppear` |

### 🔴 Telemetría: la dejé fuera, está tuya

Tu trabajo de OpenTelemetry (`TelemetryEnvironment`, el manifiesto de las seis
`PUBLIC_TELEMETRY_*`, `docs/observability/angular/`) estaba **a medio camino**:
`yarn env:generate` fallaba y `tsc` daba
`Property 'telemetry' is missing in type`.

**No lo commiteé y no lo perdí.** Está respaldado en:

```text
/tmp/telemetria-en-curso/{generate-env.mjs,environment.types.ts,
                          environment.ts,environment.development.ts}
```

Para retomarlo: esos cuatro archivos son tuyos tal como los dejaste. Lo único
que necesitás saber es que **yo agregué cosas a dos de ellos** después de tu
copia, así que conviene reaplicar lo tuyo encima de lo que está en `dev` en vez
de restaurar el respaldo tal cual:

| Archivo | Lo que agregué yo |
|---|---|
| `src/environments/environment.types.ts` | La interfaz `BuildInfo` (versión, commit, `builtAt`), **antes** de `Environment` |
| `scripts/generate-env.mjs` | `readBuildInfo()` y la emisión de `export const buildInfo` en `render()`. **No toca el MANIFIESTO** |

Tu `EnvironmentOverrides` y mi `BuildInfo` no se pisan: son declaraciones
distintas en el mismo archivo. Y `buildInfo` no pasa por el manifiesto a
propósito — no es configuración que alguien publique, es la huella del build.

**Lo que te dejo servido:** `src/server.ts` ya emite `connect-src` a partir de
`PUBLIC_API_BASE_URL`. Si el endpoint de trazas queda relativo (`/otel/v1/traces`,
como dice tu `01-architecture-design.md`), **la CSP no necesita ningún cambio**:
`connect-src 'self'` ya lo cubre. Si terminara en un subdominio propio, hay que
agregarlo en `contentSecurityPolicy()` y ahí tenés la prueba que lo fija.

### Lo que NO estoy tocando — es todo tuyo

```text
docs/observability/angular/**
Todo lo de OpenTelemetry: SDK, spans, sampler, propagación
El MANIFIESTO de scripts/generate-env.mjs
```
