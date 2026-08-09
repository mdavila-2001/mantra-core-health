<!-- GENERADO POR scripts/generate-inventory.mjs — NO EDITAR A MANO. -->

# Inventario de rutas

Leído de `src/app/app.routes.ts` y `src/app/app.routes.server.ts`. 11 entradas declaradas.

| URL | Destino | Acceso | Render en servidor | Título |
|---|---|---|---|---|
| `/` | `ShellLayout` | Protegida (`authGuard`) | Client | — |
| `/` | redirige a `panel` | Protegida (`authGuard`) | Client | — |
| `/design-system` | `DesignSystemSample` (diferida) | Pública | Prerender | Mantra Core Health - Vitrina de Diseño |
| `/auth` | `Login` | Pública | Prerender | Mantra Core Health - Iniciar sesión |
| `/auth/organizacion` | `TenantSelection` | Pública | Client | Mantra Core Health - Elegí tu organización |
| `/auth/registro` | `RegisterPatient` | Pública | Prerender | Mantra Core Health - Crear cuenta |
| `/auth/verificar` | `VerifyEmail` | Pública | Client | Mantra Core Health - Verificar correo |
| `/auth/recuperar` | `ForgotPassword` | Pública | Prerender | Mantra Core Health - Recuperar contraseña |
| `/auth/nueva-clave` | `ResetPassword` | Pública | Client | Mantra Core Health - Nueva contraseña |
| `/error` | `ErrorRecovery` | Pública | Client | Mantra Core Health |
| `/**` | `NotFound` | Pública | Client | Mantra Core Health - Página no encontrada |

## Modo de render

El modo sale de `serverRoutes`. `Prerender` significa que el HTML se genera
en el build; `Client` que el servidor manda el cascarón y el navegador pinta.
