<!-- GENERADO POR scripts/generate-inventory.mjs — NO EDITAR A MANO. -->

# Inventario de la suite de extremo a extremo (Selenium)

Leído de `e2e/selenium/`. 9 archivos de prueba, 54 pruebas, 6 Page Objects y 9 escenarios de API.

La guía de uso —cómo correrla, cómo agregar una prueba, qué variables acepta—
está en [`e2e/selenium/README.md`](../../../e2e/selenium/README.md).

## Pruebas por suite

| Suite | Bloque | Pruebas | Archivo |
| --- | --- | --- | --- |
| `authentication` | Autenticación · inicio de sesión | 7 | `e2e/selenium/specs/authentication/login.spec.ts` |
| `authentication` | Autenticación · sesión | 6 | `e2e/selenium/specs/authentication/sesion.spec.ts` |
| `forms` | Formularios · recuperar contraseña | 4 | `e2e/selenium/specs/forms/recuperar-password.spec.ts` |
| `forms` | Formularios · registro | 7 | `e2e/selenium/specs/forms/registro.spec.ts` |
| `navigation` | Navegación | 7 | `e2e/selenium/specs/navigation/navegacion.spec.ts` |
| `regression` | Regresión · accesibilidad | 6 | `e2e/selenium/specs/regression/accesibilidad.spec.ts` |
| `regression` | Regresión · directorio del panel | 4 | `e2e/selenium/specs/regression/panel-directorio.spec.ts` |
| `responsive` | Responsive · escritorio · Responsive · tableta · Responsive · móvil | 6 | `e2e/selenium/specs/responsive/responsive.spec.ts` |
| `smoke` | Humo | 7 | `e2e/selenium/specs/smoke/aplicacion.spec.ts` |

## Page Objects

| Clase | Ruta | Métodos | Archivo |
| --- | --- | --- | --- |
| `DashboardPage` | `/panel` | 9 | `e2e/selenium/pages/dashboard.page.ts` |
| `ForgotPasswordPage` | `/auth/recuperar` | 7 | `e2e/selenium/pages/forgot-password.page.ts` |
| `LoginPage` | `/auth` | 15 | `e2e/selenium/pages/login.page.ts` |
| `NotFoundPage` | `/esta-ruta-no-existe` | 2 | `e2e/selenium/pages/not-found.page.ts` |
| `RegisterPage` | `/auth/registro` | 12 | `e2e/selenium/pages/register.page.ts` |
| `TenantSelectionPage` | `/auth/organizacion` | 5 | `e2e/selenium/pages/tenant-selection.page.ts` |

## Escenarios de la API simulada

| Escenario | Qué provoca |
| --- | --- |
| `sesion-simple` | Una sola organización: el login entra directo al panel. |
| `multi-organizacion` | Dos organizaciones: hay que elegir antes de entrar. |
| `sin-organizacion` | Token sin organizaciones: la pantalla de elección queda vacía. |
| `credenciales-invalidas` | El login responde 401: credenciales que no sirven. |
| `refresco-vencido` | El refresh token ya no sirve: al recargar se vuelve al login. |
| `directorio-poblado` | El directorio público devuelve registros: el panel los cuenta. |
| `directorio-caido` | El directorio responde 503: el panel ofrece reintentar. |
| `registro-duplicado` | El alta responde 409: ese documento ya tiene cuenta. |
| `api-lenta` | Respuestas demoradas: hay estado de carga que observar. |

## Coherencia de los selectores

Los 37 identificadores que la suite localiza están declarados en las plantillas.
