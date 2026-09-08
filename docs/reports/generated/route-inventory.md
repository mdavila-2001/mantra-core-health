<!-- GENERADO POR scripts/generate-inventory.mjs — NO EDITAR A MANO. -->

# Inventario de rutas

Leído de `src/app/app.routes.ts` y `src/app/app.routes.server.ts`. 19 entradas declaradas.

| URL | Destino | Acceso | Render en servidor | Título |
|---|---|---|---|---|
| `/` | — | Protegida (`homeGuard`) | Client | — |
| `/` | `ShellLayout` | Protegida (`authGuard`) | Client | — |
| `/feed` | `Feed` (diferida) | Protegida (`authGuard`) | Client | Muro profesional |
| `/design-system` | `DesignSystemSample` (diferida) | Pública | Prerender | AloVida - Vitrina de Diseño |
| `/design-system/stock` | `ComponentStock` (diferida) | Pública | Client | AloVida - Stock de componentes |
| `/design-system/stock/**` | `ComponentStock` (diferida) | Pública | Client | AloVida - Stock de componentes |
| `/auth` | `Login` | Pública | Prerender | AloVida - Iniciar sesión |
| `/auth/organization` | `TenantSelection` | Pública | Client | AloVida - Elegí tu organización |
| `/auth/register` | `RegisterAccountType` | Pública | Prerender | AloVida - Crear cuenta |
| `/auth/register/patient` | `RegisterPatient` (diferida) | Pública | Prerender | AloVida - Crear cuenta de paciente |
| `/auth/register/practitioner` | `RegisterPractitioner` (diferida) | Pública | Prerender | AloVida - Crear cuenta de profesional |
| `/auth/register/organization` | `RegisterOrganization` | Pública | Prerender | AloVida - Registrar aseguradora |
| `/auth/verify-email` | `VerifyEmail` | Pública | Client | AloVida - Verificar correo |
| `/auth/forgot-password` | `ForgotPassword` | Pública | Prerender | AloVida - Recuperar contraseña |
| `/auth/activate` | `ActivateAccount` | Pública | Client | AloVida - Activar cuenta |
| `/auth/resend-verification` | `ResendVerification` | Pública | Client | AloVida - Reenviar verificación |
| `/auth/reset-password` | `ResetPassword` | Pública | Client | AloVida - Nueva contraseña |
| `/error` | `ErrorRecovery` | Pública | Client | AloVida |
| `/**` | `NotFound` | Pública | Client | AloVida - Página no encontrada |

## Modo de render

El modo sale de `serverRoutes`. `Prerender` significa que el HTML se genera
en el build; `Client` que el servidor manda el cascarón y el navegador pinta.
