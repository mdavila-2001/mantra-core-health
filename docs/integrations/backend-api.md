# API de backend

Las 20 operaciones que el frontend consume, su contrato y su modelo de error.

> **Esta página es el contrato declarado.** `scripts/check-api-contract-drift.mjs`
> compara la lista de abajo con lo que el código realmente llama, y falla si
> alguien agrega una operación sin documentarla.

---

## Configuración

| Aspecto | Valor |
|---|---|
| Raíz | `API_BASE_URL` (`InjectionToken`), desde `environment.apiBaseUrl` |
| Por defecto | `''` — rutas relativas |
| Cliente | `HttpClient` con `withFetch()` |
| Interceptor | `authInterceptor` |
| Prefijos | `/iam` `/public` `/terminology` `/profiles` `/identity` `/common` |

```ts
export function apiUrl(baseUrl: string, path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return baseUrl === '' ? normalizedPath : `${baseUrl.replace(/\/$/, '')}${normalizedPath}`;
}
```

`API_BASE_URL` es un token y no una lectura directa de `environment` *«para que
las pruebas puedan fijar otra raíz sin tocar el archivo de entorno, y para que un
futuro despliegue con varias APIs pueda proveerla por rama del árbol de
inyección»*.

---

## Catálogo de operaciones

### `IamClient` — 12 operaciones

| Método | Ruta | Consumidor | Pública |
|---|---|---|---|
| `POST` | `/iam/auth/login` | `Login` | Sí |
| `POST` | `/iam/auth/token/refresh` | Interceptor + arranque | Sí |
| `POST` | `/iam/auth/register-patient` | `RegisterPatient` | Sí |
| `POST` | `/iam/auth/register-practitioner` | `RegisterPatient` | Sí |
| `POST` | `/iam/auth/verify-email` | `VerifyEmail` | Sí |
| `POST` | `/iam/auth/activate` | **Sin consumidor** | Sí |
| `POST` | `/iam/auth/forgot-password` | `ForgotPassword` | No declarada |
| `POST` | `/iam/auth/reset-password` | `ResetPassword` | No declarada |
| `POST` | `/iam/auth/logout` | `ShellLayout` | No |
| `POST` | `/iam/users` | `UserRegistration` | No |
| `POST` | `/iam/users/assisted-registration` | `AssistedRegistration` | No |

#### Las tres altas no son la misma operación con distintos campos

Se parecen y hacen cosas distintas; confundirlas es cómo alguien termina fijando
la contraseña de otra persona.

| | Quién la ejecuta | La contraseña la elige | Devuelve |
|---|---|---|---|
| `/iam/auth/register-patient` · `register-practitioner` | la persona, sin sesión | su dueño, al registrarse | los ids del perfil |
| `/iam/users` | un `SECURITY_ADMIN` | **quien crea la cuenta** | la cuenta creada |
| `/iam/users/assisted-registration` | un `SECURITY_ADMIN` o `CLINICIAN` | su dueño, **al activar** | un **token de activación de un solo uso** |

`/iam/users` es la única de las tres que fija una clave desde afuera, y por eso
la pantalla que la usa dice explícitamente que hay que entregarla por un canal
seguro y pedir que la cambien.

El **alta asistida no lleva contraseña en el cuerpo** —mandarla devuelve
`400 property password should not exist`, porque el backend valida con
`forbidNonWhitelisted`— y exige `reason`, que queda en la trazabilidad C-18: es
lo que justifica haber creado una cuenta a nombre de otra persona.

**Ninguna de las dos se orquesta desde el frontend.** El backend crea persona,
perfil y cuenta en la misma transacción (registro CTI atómico, regla 11 de la
v4.0.7), así que no hay estado intermedio que reanudar: o quedó todo, o no quedó
nada. Lo que sí se evita acá es el **doble envío**, y de eso se ocupa
`app-form-actions`.

### `PublicClient` — 1 operación

| Método | Ruta | Consumidor |
|---|---|---|
| `GET` | `/public/directory` | `Dashboard` |

Admite dos filtros opcionales de query string, `city` y `specialty`, que **se
omiten si no vienen**: mandarlos vacíos filtraría por la cadena vacía en vez de
no filtrar. `Dashboard` llama sin ninguno.

### `IdentityClient` — 4 operaciones · sin consumidor

| Método | Ruta |
|---|---|
| `POST` | `/identity/me/identity-verification` |
| `POST` | `/identity/me/practitioner/identity-verification` |
| `POST` | `/identity/me/practitioner/license-verification` |
| `GET` | `/identity/me/verification-cases/:caseId` |

### `ProfilesClient` — 3 operaciones · sin consumidor

| Método | Ruta |
|---|---|
| `POST` | `/profiles/patients` |
| `POST` | `/profiles/practitioners` |
| `POST` | `/profiles/persons/:personId/account-links` |

### `TerminologyClient` — 1 operación · sin consumidor

| Método | Ruta |
|---|---|
| `GET` | `/terminology/value-sets/:valueSetId/$expand` |

### `FilesClient` — 1 operación · sin consumidor

| Método | Ruta |
|---|---|
| `POST` | `/common/files/upload` |

**Once operaciones sin pantalla que las llame.** No es código muerto: todas
tienen prueba y son la mitad de un flujo cuya interfaz todavía no se escribió.
Ver [el mapa de integraciones §3](../architecture/integration-map.md#3--operaciones-sin-consumidor).

---

## Modelo de error

Copiado de `src/common/errors/error-codes.ts` del backend, que los declara parte
del contrato:

```ts
export const API_ERROR_CODES = [
  'VALIDATION_FAILED', 'UNAUTHENTICATED', 'FORBIDDEN',
  'IDENTITY_VERIFICATION_REQUIRED', 'NOT_FOUND', 'CONFLICT',
  'PRECONDITION_FAILED', 'CONCURRENCY_CONFLICT', 'PAYLOAD_TOO_LARGE',
  'RATE_LIMITED', 'DEPENDENCY_UNAVAILABLE', 'INTERNAL',
] as const;
```

### Cuerpo de error

```jsonc
{
  "code": "VALIDATION_FAILED",
  "message": "…",                 // para mostrar, NO para ramificar
  "correlationId": "…",           // si el servidor asignó uno
  "details": { "messages": ["…"] },
  "timestamp": "…",
  "path": "…"
}
```

### **Se ramifica por `code`, nunca por `message`**

Es la regla del proyecto, y tiene dos razones:

1. El mensaje está pensado para humanos y puede cambiar de redacción o de idioma.
2. **Dos códigos comparten el 403** y hay que separarlos, así que el estado HTTP
   tampoco alcanza:

| Código | Significado | Estado |
|---|---|---|
| `FORBIDDEN` | Rol insuficiente. **Un muro sin salida** | S5 sin acción |
| `IDENTITY_VERIFICATION_REQUIRED` | Identidad sin verificar. **Una puerta** | S5 **con** acción |

> *«Para la persona son estados opuestos: rol insuficiente es un muro sin salida,
> e identidad sin verificar es una puerta —hay algo que puede hacer y hay que
> ofrecérselo.»*

### `readApiError` devuelve `null` cuando no confía

```ts
export function readApiError(error: HttpErrorResponse): ApiErrorBody | null {
  const body: unknown = error.error;
  if (typeof body !== 'object' || body === null) return null;
  const code = (body as Record<string, unknown>)['code'];
  if (typeof code !== 'string' || !isApiErrorCode(code)) return null;
  …
}
```

> *«Devuelve `null` cuando la respuesta no tiene esa forma —un proxy que devuelve
> HTML, un fallo de red, un 502 de infraestructura—, que es exactamente cuando no
> hay que confiar en lo que venga.»*

Un `code` que no esté en la lista se descarta: el frontend no inventa
significados que el contrato no declara.

### Traducción completa a estados

Ver [flujo de datos §5](../architecture/data-flow.md#5--el-error-se-traduce-a-un-estado-del-m34).

---

## Reglas del transporte

### 1 · Los cuerpos se arman campo por campo

El backend valida con `forbidNonWhitelisted`: **un campo de más devuelve 400**. Y
un opcional presente en `undefined` viaja como clave declarada, así que se omite
con spread condicional o con `stripUndefined()`.

### 2 · Los tipos de la vista no son los DTO

```ts
export interface Session {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: Date;      // ← el transporte manda texto ISO
}
```

> *«Que la API devuelva una fecha como texto ISO es asunto del transporte, no de
> la pantalla.»*

### 3 · Las uniones discriminadas impiden peticiones imposibles

```ts
export type LoginCredentials =
  | { kind: 'email';      email: string;      password: string; mfaCode?: string }
  | { kind: 'nationalId'; nationalId: string; password: string; mfaCode?: string };
```

> *«Con dos opcionales, mandar los dos compilaría y fallaría recién contra el
> servidor; así no se puede ni escribir.»*

### 4 · El `$` de terminología va literal

> *«Express enruta sobre el path sin decodificar, así que `%24expand` no casa con
> la ruta `:id/$expand` y vuelve 404 — verificado contra la API viva.»*

### 5 · La subida no fija `Content-Type`

El navegador tiene que ponerlo él para incluir el `boundary`.

### 6 · El cursor es opaco

Se reenvía tal cual y no se interpreta. Y **no hay total**: solo `count` de la
página y `nextCursor`.

---

## Lo que NO está cubierto

| Aspecto | Estado |
|---|---|
| Cancelación de peticiones | **No se usa.** Ninguna llamada se cancela al destruir el componente |
| Timeout explícito | **No se fija.** Se usa el del navegador |
| Reintentos automáticos | **Ninguno**, salvo el refresco único del interceptor |
| Deduplicación | Solo el refresco |
| Respuestas parciales | No se contemplan |
| Fallback ante fallo | Ninguno. Se muestra S8/S9 |
| Tipos generados desde OpenAPI | **No.** Escritos a mano |
| Pruebas de contrato | **No existen** |

### Las dos que más pesan

**Sin cancelación**, una pantalla que se destruye mientras su petición viaja
recibe la respuesta y escribe en una señal huérfana. Hoy es inocuo —las señales
no lanzan— pero es un patrón que no escala.

**Sin tipos generados ni pruebas de contrato**, la única defensa contra un cambio
del backend es que alguien lo note. Los comentarios rastrean el origen
(«verificadas una por una contra `iam-auth.controller.ts`»), pero eso es
trazabilidad, no verificación.

Las dos están en [el análisis de brechas](../reports/documentation-gap-analysis.md),
la segunda como `HIGH`.

---

## Verificación

```bash
node scripts/check-api-contract-drift.mjs
```

Compara los endpoints del código con los de esta página. **Detecta que alguien
agregue una llamada sin documentarla; no detecta que el backend cambie el
contrato.** Esa segunda mitad exige acceso al OpenAPI del backend, que no es
alcanzable desde este repositorio.
