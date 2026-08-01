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

**Dos avisos, uno importante:**

1. **La API que corre en `:3000` es un contenedor de Docker y no tiene tu código.** Verifiqué las
   dos rutas contra ella y devuelven **404 · `Cannot POST /iam/auth/forgot-password`**; el
   controlador sí está en el fuente. Hay que reconstruir la imagen para que suban. No lo hice yo:
   `ESTADO-FRONTEND.md` avisa de no levantar el servicio `api` del compose, y esa decisión es tuya
   —  **el resto de la demo funciona igual**, porque el login usa rutas que el contenedor sí tiene.

2. Toqué **dos archivos de `core/data-access/iam/`** (`iam.client.ts` y `iam.types.ts`) para agregar
   `requestPasswordReset` y `resetPassword`. Dijiste que solo tocabas `terminology/`, así que no
   deberíamos chocar, pero queda dicho. También agregué las dos rutas a `PUBLIC_PATHS` del
   interceptor: sin eso, un 401 de recuperación dispararía un intento de refresco.

**Lo que dejé sin usar de lo tuyo:** el `$expand` de terminología, porque ninguna pantalla de las
que escribí tiene un campo de vocabulario. Tu cliente queda listo para la primera que lo necesite.

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
