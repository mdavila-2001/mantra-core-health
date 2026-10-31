# Personal de apoyo: administración y seguridad

Pantallas de la **organización**, de la **persona de apoyo** y del **doctor** para el diseño de
«personal de apoyo» (secretaria, recepción, caja, call center…), más los controles de sesión
de la organización. Esta página es el mapa; el detalle está en:

- [Rutas](rutas.md) — qué pantalla vive en qué dirección y quién la ve.
- [Contrato propuesto](contrato-propuesto.md) — lo que el front pide a la API y lo que ya alinea con sus DTO.
- [Cuentas demo](cuentas-demo.md) — con quién entrar al simulador para probar cada cosa.
- [ADR-0017](../adr/ADR-0017-mi-equipo-y-personal-de-apoyo.md) — por qué «Mi equipo» es el renglón doce del doctor y por qué el
  personal de apoyo no es un rol global.

## Qué hay

| Lado | Pantalla | Qué hace |
|---|---|---|
| Organización | **Controles de sesión** | Una regla por alcance (todas las cuentas, personal, un rol): cierre por inactividad, aviso de dispositivo nuevo, horario laboral en una semana visual, red de la organización y dos pasos obligatorios. Cada control explicado en lenguaje simple, con su efecto y una vista previa que prueba un ingreso. Guardar pide confirmación y vuelve a leer. La pestaña **«Redes de la organización»** define qué redes (rangos CIDR) permiten o bloquean el ingreso: ayuda en lenguaje simple, validación del rango, aviso de que no se puede guardar un conjunto que deje afuera a quien lo guarda, y una vista previa que prueba una dirección. |
| Organización | **Respuestas preparadas** | Los textos administrativos que el personal usa en la bandeja: listar, crear, editar con control de versión (nadie pisa el cambio de otro), retirar y reactivar. Se llega desde «Equipo de apoyo». |
| Organización | **Revisión periódica** | Los vínculos por vencer, vencidos o suspendidos; confirmar de a uno o en lote (reactiva a los suspendidos), quitar permisos en lote y el historial. |
| Organización | **Solicitudes de apoyo** | La bandeja con filtros por persona, rol, estado y antigüedad (en la URL), paginación y la vista de la solicitud vencida a los 15 días. |
| Organización | **Actividad del equipo de apoyo** | La bitácora con filtros por persona, doctor, acción y fecha, y exportación de lo que se ve a CSV. |
| Persona de apoyo | **Mis accesos** | Aviso y botón **«Confirmar que sigo trabajando aquí»** (una declaración: la que renueva el vínculo es la organización); un vínculo suspendido dice **«Suspendido: pida a su organización que lo renueve»** y no ofrece botón. El QR de una invitación se lee del fragmento y se borra de la dirección. |
| Persona de apoyo | **Mi actividad** | Lo que hizo ella, con los mismos filtros y el CSV. |
| Doctor | **Actividad de mi equipo** | Lo que hicieron las personas de apoyo sobre su agenda, con filtros y CSV. Se llega desde «Mi equipo». «Mi equipo» dice por qué alguien ya no está activo (suspendida por su organización, retirada o vencida). |
| Todas las cuentas | **Aviso de dispositivo nuevo** | Tras el login, si la API lo indica: «Fui yo» (pide el código de 8 dígitos del correo: `/confirm-code` y `/confirm`) o «No fui yo, cerrar otras sesiones» (`/not-me`, que cierra las demás sesiones en una sola operación). |
| Todas las cuentas | **Verificación en dos pasos** (`/my-account/security/mfa`) | Alta de la app autenticadora: QR dibujado en el navegador, código para escribir a mano, confirmación con el código y los estados de error. Quien entra sin el segundo paso que su organización exige llega acá solo y **la aplicación queda restringida** hasta que lo activa. |
| Login | **Políticas de sesión** | `MFA_REQUIRED` y `MFA_INVALID` piden el código; `OUTSIDE_ALLOWED_HOURS` y `OUTSIDE_ALLOWED_NETWORK` bloquean y explican qué hacer. Sin factor y con dos pasos exigidos el login **entra** con un token de alcance limitado y lleva al alta. Una organización que no deja entrar (`deniedTenants`: horario, red, inactividad o segundo paso) no impide entrar a las otras: se dice en un aviso y en el selector. |
| Todas las cuentas | **Invitaciones de organizaciones** (`/my-account/security/organization-invitations`) | Las membresías pendientes (`PENDING_ACCEPTANCE`): aceptar o rechazar. La organización ve «Invitación enviada, pendiente de aceptación» y puede retirarla. |
| Todas las cuentas | **Quitar un método de verificación** | «Quitar este método» confirma la identidad (contraseña o código) y llama a `POST /iam/me/mfa/:factorId/revoke`. |

## Cómo está armado

- **Cliente**: `SupportAccessClient` (`core/data-access/support-access/support-access.client.ts`). Traduce en un solo lugar
  (`support-access.wire.ts`) los nombres de las pantallas a los de los DTO de la API.
- **Lógica pura** (con sus specs), sin Angular: `session-policy.ts`, `support-recertification.ts`,
  `support-request-filters.ts`, `support-activity.ts`.
- **Pantallas**: `features/support-access/{session-controls,support-review,support-requests,support-activity,my-support,my-team,reply-templates}`,
  `features/account/mfa-enrollment` y `features/shell-layout/new-device-banner`.
- **Lógica pura** (con spec): además `ip-rules.ts` (leer y evaluar CIDR igual que la API) y `ip-rules-draft.ts` / `ip-rules-failure.ts`.
- **Simulador**: `core/mock/handlers/support-access.*.handlers.ts` y `core/mock/fixtures/support-hospital*.ts`. El estado vive en
  `sessionStorage`: sobrevive a F5 y se borra al cerrar la pestaña.
- **Aviso de dispositivo nuevo**: el login lo enciende en `NewDeviceAlert` (`core/auth/new-device-alert.ts`) y `new-device-banner` lo dibuja en el armazón.
- **Navegación**: las secciones están en `core/navigation/navigation.support.ts`.

## Lo que el front no hace

No autoriza. Ocultar una sección o un botón no es seguridad: la API decide con `SupportAccessPolicy` en cada
petición y con la política de sesión al emitir cada token. Lo que dicen estas pantallas sobre «qué rige» es la
lectura del front de la regla de la API y se prueba contra su código (`domain/session-policy.ts`), pero la
autoridad es la API.

## Cómo probarlo

```bash
yarn start:demo                       # el simulador, con las cuentas de abajo
yarn ng test --watch=false --include 'src/app/features/support-access/**/*.spec.ts'
E2E_BASE_URL=http://localhost:4200 yarn playwright test playwright/administracion-y-seguridad.spec.ts
```

El e2e es **serial** y comparte pestaña: lo que una persona deja en el simulador lo ve la siguiente.

## Contra la API real

`playwright/hospital-piloto-api-real.spec.ts` recorre los 13 casos del hospital piloto con el front compilado con `--configuration real-api`
(sin simulador) contra la API real y la base del modelo con `salud-db/demo/04-hospital-piloto.sql` (`-v demo_accounts=1`). Necesita, fuera del
repositorio: la API levantada (Postgres 16 con `max_locks_per_transaction=4096`, Redis), un servidor que sirva el front y haga proxy a la
API con los prefijos de `proxy.conf.json`, y los datos de agenda del piloto (una agenda por doctor, cupos y siete citas, más dos conversaciones de chat de pacientes
con cuenta). El demo no trae SECURITY_ADMIN para el administrador del hospital: sin ese rol, `/org/*` responde 403 `ROLE_INSUFFICIENT`.
Variables: `E2E_BASE_URL` (el servidor del front) y `E2E_REAL_DB` (`host:puerto:usuario:base`, con `E2E_REAL_DB_PASSWORD`).
