# ADR-0006: Access token en memoria, refresh token en `localStorage`

## Estado

**Aceptado** — con una restricción externa que lo condiciona.

## Contexto

La sesión se abre con `POST /iam/auth/login`, que devuelve `accessToken`,
`refreshToken` y `expiresAt` **en el cuerpo de la respuesta**.

## Fuerzas y restricciones

**La restricción que lo decide todo es del backend:**

> La API entrega el refresh token **en el cuerpo del login, no como cookie**.

Consecuencia: el frontend **no puede** convertirlo en `HttpOnly`. Esa decisión no
está en este repositorio.

Y dos más:

- La sesión debe sobrevivir a una recarga.
- Bajo SSR no hay `localStorage`, y en algunos navegadores **lanza**.

## Opciones consideradas

| Opción | Descartada porque |
|---|---|
| Los dos tokens en `localStorage` | Expone una credencial de más sin ganar nada |
| Los dos en memoria | La sesión no sobreviviría a una recarga |
| Cookie `HttpOnly` | **No está en manos del frontend** |
| `sessionStorage` | Se pierde entre pestañas; peor experiencia |

## Decisión

| Credencial | Dónde | Motivo |
|---|---|---|
| **Access token** | Memoria (`SessionStore`) | *«dura minutos y se vuelve a obtener con el otro, así que guardarlo sería exponer una credencial de más sin ganar nada»* |
| **Refresh token** | `localStorage` (`mantra.refresh-token`) | Es lo único que hace que la sesión sobreviva a la recarga |

Con cuatro decisiones de apoyo:

1. **`SessionStore` no persiste nada**, así que ninguna rama toca `localStorage`
   en la ruta de SSR.
2. **El refresco rota el par completo**: el token viejo deja de servir.
3. **El token guardado se descarta** cuando el canje falla al arrancar.
4. **El almacenamiento degrada sin romper**: `localStorage` **lanza**, no
   devuelve `null`, y por eso hay `try/catch` en cada operación.

## Consecuencias positivas

- La sesión sobrevive a la recarga, sin parpadeo (`provideAppInitializer`).
- El servidor nunca ve una credencial, y por eso no puede filtrarla.
- La rotación hace que un robo sea detectable del lado del servidor.
- La aplicación **funciona** en Safari privado: la sesión dura la pestaña.
- Un fallo al borrar **no impide cerrar sesión**.

## Consecuencias negativas

- **El refresh token es alcanzable por XSS.**
- Sobrevive al cierre del navegador.
- Un dispositivo compartido conserva la sesión.
- **Cerrar sesión en una pestaña no cierra la otra.**

## Riesgos

| Riesgo | Mitigación actual | Residual |
|---|---|---|
| XSS lee el token | Cero `innerHTML`, cero terceros, 10 dependencias | **Medio — sin CSP** |
| Sesión persistente en dispositivo compartido | `logout()` limpia pase lo que pase | **Medio — sin cierre por inactividad** |
| Otra pestaña sigue viva | Ninguna | **Medio** |
| Refresco reactivo (una petición fallida por expiración) | `isAccessTokenExpired` **existe y nadie la llama** | Bajo |

Los cuatro están en
[el modelo de amenazas](../security/threat-model.md).

## Evidencia

- `refresh-token.storage.ts`, con el motivo de la degradación escrito.
- `session.store.ts`: *«Deliberadamente **sin persistencia**… no hay nada que
  leer durante el render del servidor.»*
- `auth.service.ts`: `restoreSession` con `catchError` que descarta el token.
- `app.config.ts`: el `provideAppInitializer` que evita el parpadeo.

## Plan de revisión

**Revisar si la API pasa a entregar el refresh token como cookie `HttpOnly`.**
Eso cambiaría este ADR y también
[ADR-0002](ADR-0002-ssr-prerenderizado-selectivo.md), porque el servidor pasaría
a ver la sesión.

Y revisar antes de la primera pantalla con PHI: un dispositivo compartido con
datos clínicos y sin cierre por inactividad es un riesgo distinto.
