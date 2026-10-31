# ADR-0018: Quien entra sin el segundo paso que su organización exige entra con un token limitado; la API lo impone y el cliente lo refleja

## Estado

**Aceptado** — 2026-10-30; **revisado el mismo día** cuando la API empezó a imponerlo (ver «Revisión»). Extiende [ADR-0006](ADR-0006-sesion-en-memoria.md) (qué vive en la sesión en memoria) y
[ADR-0017](ADR-0017-mi-equipo-y-personal-de-apoyo.md) (los controles de sesión de la organización).

## Contexto

La política de sesión de una organización puede exigir la verificación en dos pasos (`requireMfa`). Dar de alta un factor
(`POST /iam/me/mfa/totp`) exige estar autenticado, así que rechazar el login dejaría a la persona sin forma de cumplir lo que
se le pide: el login **entra**. La primera versión de la API lo dejaba entrar con la sesión **completa** y solo avisaba
(`mfaEnrollmentRequired: true`); restringir era del cliente.

## Decisión

1. **La API lo impone.** A quien debe dar de alta el factor le emite un **token de alcance limitado**: claim `mfaEnrollment: true`,
   sin roles ni organizaciones. Ese token solo llega a `/iam/me/mfa*`, al cierre de sesión, al refresco y a `GET /iam/me`; todo lo
   demás responde 403 `MFA_ENROLLMENT_REQUIRED` (`MfaEnrollmentScopeGuard`). El refresco conserva el alcance limitado y lo
   **reemite completo** al confirmar el factor.
2. **El cliente lo refleja y conserva su guarda.** `SessionStore` fija `mfaEnrollment = 'required'` al abrir o renovar la sesión
   cuando el token trae el claim; `mfaEnrollmentGuard` (`canActivateChild` del armazón) lleva toda ruta a
   `/my-account/security/mfa?returnUrl=<destino>`, la única que queda abierta. Ya **no** pregunta `GET /iam/me/mfa` tras una recarga:
   el claim lo dice. El login, si `mfaEnrollmentRequired`, navega a la pantalla de alta.
3. **Al confirmar el factor, la pantalla pide un refresco** (`TokenRefreshService`): el token completo vuelve y `renew` levanta la
   restricción. Sin ese paso la sesión seguiría siendo la limitada.
4. **Dar de alta y quitar un método exigen reautenticar** (`currentPassword` o `mfaCode`; 422 `MFA_REAUTH_REQUIRED` /
   `MFA_REAUTH_FAILED`): la pantalla pide la contraseña (o el código de un método ya activo) antes del QR y antes de «Quitar este
   método», y avisa que quitar el último método deja sin acceso a la organización que lo exige.
5. **Con un token completo no se restringe nada**, aunque una organización niegue por falta del factor (`MFA_ENROLLMENT_REQUIRED` en
   `deniedTenants`): la persona trabaja en las demás y se le avisa con un banner no bloqueante que lleva a activar el factor.
6. **El QR se dibuja en el navegador** con `drawQr` y el secreto se muestra una sola vez, como lo entrega la API.

## Lo que esto **es** y **no es**

La barrera es **de la API**: un cliente propio con el token limitado recibe 403 en todo lo que no sea el alta. La guarda del cliente
es cortesía —evita mostrar pantallas que van a fallar y lleva a la única útil—, ya no la frontera. Con un token completo y una
organización que niega, la que niega es la API en cada petición con `X-Tenant-Id` de esa organización (403 con el motivo en `reason`).

## Opciones consideradas

1. **Rechazar el login.** Descartada: dejaría a la persona sin cómo activar el factor.
2. **Sesión completa y solo aviso (lo que hacía la primera versión de la API).** Descartada por la API: la restricción era solo del cliente.
3. **Token de alcance limitado impuesto por la API** (esta decisión) más guarda del cliente por comodidad.

## Consecuencias

- Quien entra sin factor ve primero la pantalla de alta; el resto de las rutas del armazón le redirige a ella hasta que termina.
- Las rutas públicas fuera del armazón (login, directorio) no se restringen.
- Una cuenta con un factor confirmado sigue el camino de siempre: el login pide el código (`MFA_REQUIRED` / `MFA_INVALID`, también para un código ya usado).

## Evidencia

- `src/app/core/auth/mfa-enrollment.guard.ts` y su spec; `session.store.ts` (`limitedToEnrollment`, `mfaEnrollment`, `deniedTenants`); `access-token.ts`.
- `src/app/features/account/mfa-enrollment/` (alta con reautenticación, quitar método) y `core/data-access/iam/mfa.client.ts`.
- Simulador: `core/mock/mock-token-guard.ts` (403 `MFA_ENROLLMENT_REQUIRED` fuera de `/iam/me/mfa*`) y `handlers/support-access.session.handlers.ts`.
- E2E `playwright/seguridad-de-la-cuenta.spec.ts`: login limitado → alta con reautenticación → confirmar → token completo; quitar un método.

## Revisión

Cuando la API deje de emitir el token limitado, la guarda vuelve a ser la única barrera y hay que reabrir este ADR.
