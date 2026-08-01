# Reglas de negocio

Las reglas que el frontend hace cumplir, **cada una con dónde vive**. La
autoridad de todas es la API; acá se registra qué se refleja en la interfaz y
qué la hace imposible de incumplir por olvido.

---

## Reglas de identidad y acceso

| # | Regla | Dónde se hace cumplir |
|---|---|---|
| RN-01 | Un identificador de acceso es correo **o** documento, **nunca ambos** | `LoginCredentials`: unión discriminada. **Mandar los dos no compila** |
| RN-02 | El paciente entra con documento; el correo es opcional | `PatientRegistration` |
| RN-03 | El profesional entra con correo, y necesita matrícula **y** número de colegio | `PractitionerRegistration`, con los tres obligatorios |
| RN-04 | La contraseña tiene al menos 8 caracteres | `MIN_PASSWORD`, espejo del DTO |
| RN-05 | El documento tiene al menos 4 caracteres y solo `[A-Za-z0-9.-]` | `MIN_DOCUMENTO`, `DOCUMENTO_VALIDO` — el mismo `@Matches` del backend |
| RN-06 | **El registro no abre sesión** | Los endpoints devuelven identificadores, no tokens |
| RN-07 | Verificar el correo **no desbloquea nada** | `verify-email.ts` |

## Reglas de sesión

| # | Regla | Dónde |
|---|---|---|
| RN-10 | El access token vive **solo en memoria** | `SessionStore` |
| RN-11 | Solo el refresh token se persiste | `RefreshTokenStorage` |
| RN-12 | El refresco **rota el par completo** | `IamClient.refresh` |
| RN-13 | **Un solo refresco en vuelo** | `TokenRefreshService` |
| RN-14 | El reintento tras un 401 **no recursa** | `authInterceptor` |
| RN-15 | Cerrar sesión limpia **pase lo que pase** | `AuthService.logout` |
| RN-16 | `logout` cierra **esta** sesión, no todas | Se usa `logout`, no `logout-all`, a propósito |
| RN-17 | Un refresh token muerto **se descarta** | `restoreSession` |
| RN-18 | El token **no se verifica** en el cliente | `access-token.ts` |
| RN-19 | Solo `sub` es obligatorio en el token | *«exigirlos acá sería ser más estricto que el contrato»* |

## Reglas de organización

| # | Regla | Dónde |
|---|---|---|
| RN-20 | Con **una** organización se resuelve sola | `activeTenantId` |
| RN-21 | Con **varias**, manda la persona y **no se adivina** | `needsTenantSelection` + `authGuard` |
| RN-22 | Hasta que elija, **`X-Tenant-Id` no se manda** | `withCredentials` |
| RN-23 | Solo se puede elegir una organización del token | `selectTenant` valida |
| RN-24 | Renovar el token **no** pierde la elección | `renew()` no toca `selectedTenantId` |
| RN-25 | Abrir sesión **sí** la descarta | `start()` la limpia |
| RN-26 | Cambiar de organización **vuelve al panel** | *«podría ser el detalle de un recurso que en esta organización no existe»* |

## Reglas de privacidad — las que más importan en este dominio

| # | Regla | Dónde |
|---|---|---|
| RN-30 | **«No encontrado» no revela si el recurso existe** | S6 **descarta `message` y `details`**, y su tipo no tiene campos de datos |
| RN-31 | **El acuse de recuperación es idéntico exista o no la cuenta** | `PasswordResetRequested` trae solo un `message` |
| RN-32 | Los fallos de verificación de correo **no se distinguen** | Un único estado `invalido` |
| RN-33 | Nadie puede pedir la verificación de identidad de otro | Ninguna ruta de `identity` recibe a quién se verifica |
| RN-34 | **Ningún secreto puede llegar al paquete** | `generate-env.mjs`: lista blanca + tres validaciones. **Falla al compilar** |
| RN-35 | Toda subida declara su sensibilidad (`NORMAL` \| `PHI`) | Parámetro **obligatorio**, sin valor por defecto |
| RN-36 | Un enlace externo **no hereda la sesión** | `rel="noopener noreferrer"` automático, con tres pruebas |

**RN-30 es la más elegante**: no es una convención, es un tipo sin campos donde
poner el dato que filtraría.

## Reglas de presentación de datos

| # | Regla | Dónde |
|---|---|---|
| RN-40 | **Un dato que puede estar atrasado lo dice** | S7 **exige** `asOf`; se muestra siempre visible |
| RN-41 | Vacío **gana** sobre atrasado | `Dashboard.toState` |
| RN-42 | Sin `refreshedAt` es `ready`, no `stale` | *«inventar `new Date()` sería afirmar que se calculó recién»* |
| RN-43 | Un vacío **siempre ofrece una próxima acción** | S3 exige `nextAction` |
| RN-44 | Un error inesperado **siempre lleva identificador** | S9 exige `requestId` |
| RN-45 | Los datos clínicos usan **cifras tabulares** | `.tabular-nums` |
| RN-46 | **`--text-muted` jamás en información clínica** | Excepciones E1/E2. ⚠️ **No hecho cumplir** |
| RN-47 | Los conceptos de terminología van por **identificador**, nunca por etiqueta | *«El modelo prohíbe fijar valores de vocabulario en el código»* |
| RN-48 | No ramificar por `display` de un concepto | `terminology.types.ts` |

## Reglas de contrato con la API

| # | Regla | Dónde |
|---|---|---|
| RN-50 | El cuerpo lleva **exactamente** los campos del contrato | `forbidNonWhitelisted` devuelve 400 con uno de más |
| RN-51 | Un opcional vacío **no viaja** | Spread condicional, `stripUndefined` |
| RN-52 | **Se ramifica por `code`, nunca por `message`** | `errorToViewState` |
| RN-53 | Un cuerpo sin la forma del contrato **no se cree** | `readApiError` devuelve `null` |
| RN-54 | El `$` de terminología va **literal** | *«verificado contra la API viva»* |
| RN-55 | El cursor de paginación es **opaco** | Se reenvía tal cual |
| RN-56 | La subida **no fija `Content-Type`** | El navegador debe poner el `boundary` |
| RN-57 | Las rutas públicas **no disparan refresco** ante un 401 | *«sería un bucle contra el límite de 10 intentos por minuto»* |

## Reglas de interfaz (M34)

| # | Regla | Dónde |
|---|---|---|
| RN-60 | **S1 ≠ S2**: autorizar ocurre **antes** de pedir datos sensibles | `authGuard` en el padre; `ViewStateHost` no pinta esqueleto en S1 |
| RN-61 | **S5 ≠ S6**: prohibido no es inexistente | Dos códigos distintos para el mismo 403 |
| RN-62 | Un 403 por identidad **sí** ofrece salida; uno por rol **no** | *«el muro y la puerta»* |
| RN-63 | S4 mueve el foco al mensaje; S2/S7 **no** | *«robar el foco durante una carga es perder el lugar en la página»* |
| RN-64 | El radio de firma va en **un** elemento por pantalla | Sistema de diseño |
| RN-65 | El ámbar ocupa **≤ 10 %** y un solo punto de acción | Ídem |
| RN-66 | Nunca tinta blanca sobre aguamarina (2,51) ni ámbar (2,06) | Ídem |

## Las que **no** se hacen cumplir

Honestidad sobre el alcance:

| Regla | Estado |
|---|---|
| RN-46 (`--text-muted` fuera de lo clínico) | **Escrita en dos lugares, hecha cumplir en ninguno** |
| RN-64, RN-65, RN-66 | Convenciones del sistema de diseño, **sin verificación automática** |
| Cualquier permiso por rol | **La API.** El frontend no autoriza |

Las cuatro dependen de revisión humana. Registradas en
[el análisis de brechas](../reports/documentation-gap-analysis.md).
