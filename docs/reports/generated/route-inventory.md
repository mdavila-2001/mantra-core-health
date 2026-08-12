<!-- GENERADO POR scripts/generate-inventory.mjs — NO EDITAR A MANO. -->

# Inventario de rutas

Leído de `src/app/app.routes.ts` y `src/app/app.routes.server.ts`. 13 entradas declaradas.

| URL | Destino | Acceso | Render en servidor | Título |
|---|---|---|---|---|
| `/` | `ShellLayout` | Protegida (`authGuard`) | Client | — |
| `/` | redirige a `dashboard` | Protegida (`authGuard`) | Client | — |
| `/design-system` | `DesignSystemSample` (diferida) | Pública | Prerender | Mantra Core Health - Vitrina de Diseño |
| `/auth` | `Login` | Pública | Prerender | Mantra Core Health - Iniciar sesión |
| `/auth/organization` | `TenantSelection` | Pública | Client | Mantra Core Health - Elegí tu organización |
| `/auth/register` | `RegisterPatient` | Pública | Prerender | Mantra Core Health - Crear cuenta |
| `/auth/verify-email` | `VerifyEmail` | Pública | Client | Mantra Core Health - Verificar correo |
| `/auth/forgot-password` | `ForgotPassword` | Pública | Prerender | Mantra Core Health - Recuperar contraseña |
| `/auth/activate` | `ActivateAccount` | Pública | Client | Mantra Core Health - Activar cuenta |
| `/auth/resend-verification` | `ResendVerification` | Pública | Client | Mantra Core Health - Reenviar verificación |
| `/auth/reset-password` | `ResetPassword` | Pública | Client | Mantra Core Health - Nueva contraseña |
| `/error` | `ErrorRecovery` | Pública | Client | Mantra Core Health |
| `/**` | `NotFound` | Pública | Client | Mantra Core Health - Página no encontrada |

## Modo de render

El modo sale de `serverRoutes`. `Prerender` significa que el HTML se genera
en el build; `Client` que el servidor manda el cascarón y el navegador pinta.
