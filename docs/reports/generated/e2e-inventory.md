<!-- GENERADO POR scripts/generate-inventory.mjs — NO EDITAR A MANO. -->

# Inventario de la suite de extremo a extremo (Cypress)

Leído de `cypress/`. 33 archivos de prueba, 164 pruebas, 11 Page Objects y 12 escenarios de API.

La guía de uso —cómo correrla, cómo agregar una prueba, qué variables acepta—
está en [`cypress/README.md`](../../../cypress/README.md).

## Pruebas por suite

| Suite | Bloque | Pruebas | Archivo |
| --- | --- | --- | --- |
| `authentication` | Autenticación · inicio de sesión | 7 | `cypress/e2e/authentication/login.cy.ts` |
| `authentication` | Autenticación · sesión | 6 | `cypress/e2e/authentication/sesion.cy.ts` |
| `forms` | Formularios · activar cuenta | 5 | `cypress/e2e/forms/activar-cuenta.cy.ts` |
| `forms` | Formularios · nueva contraseña | 6 | `cypress/e2e/forms/nueva-clave.cy.ts` |
| `forms` | Formularios · recuperar contraseña | 4 | `cypress/e2e/forms/recuperar-password.cy.ts` |
| `forms` | Formularios · reenviar verificación | 5 | `cypress/e2e/forms/reenviar-verificacion.cy.ts` |
| `forms` | Formularios · registro | 7 | `cypress/e2e/forms/registro.cy.ts` |
| `forms` | Formularios · verificación de correo | 4 | `cypress/e2e/forms/verificar-correo.cy.ts` |
| `navigation` | Navegación | 8 | `cypress/e2e/navigation/navegacion.cy.ts` |
| `real` | Recorrido real · administrador | 1 | `cypress/e2e/real/01-administrador.cy.ts` |
| `real` | Recorrido real · paciente | 1 | `cypress/e2e/real/02-paciente.cy.ts` |
| `real` | Recorrido real · médico | 2 | `cypress/e2e/real/03-medico.cy.ts` |
| `real` | Recorrido real · organización | 1 | `cypress/e2e/real/04-organizacion.cy.ts` |
| `real` | Recorrido real · portal de turnos del paciente | 2 | `cypress/e2e/real/05-portal-turnos.cy.ts` |
| `real` | Recorrido real · estados de un caso de verificación | 1 | `cypress/e2e/real/06-estados-de-caso.cy.ts` |
| `real` | Recorrido real · la cola de revisión de identidad | 1 | `cypress/e2e/real/07-cola-de-revision.cy.ts` |
| `real` | Recorrido real · el sello del titular sigue al caso | 2 | `cypress/e2e/real/08-sello-del-titular.cy.ts` |
| `real` | Recorrido real · el camino del consumidor | 1 | `cypress/e2e/real/09-camino-consumidor.cy.ts` |
| `real` | Recorrido real · el camino del médico | 2 | `cypress/e2e/real/10-camino-medico.cy.ts` |
| `recorrido` | Recorrido · pantallas públicas | 11 | `cypress/e2e/recorrido/01-publico.cy.ts` |
| `recorrido` | Recorrido · área con sesión · Recorrido · armazón | 10 | `cypress/e2e/recorrido/02-sesion.cy.ts` |
| `recorrido` | Recorrido · administración | 10 | `cypress/e2e/recorrido/03-administracion.cy.ts` |
| `recorrido` | Recorrido · vitrina de diseño | 3 | `cypress/e2e/recorrido/04-vitrina.cy.ts` |
| `recorrido` | Recorrido · atención | 5 | `cypress/e2e/recorrido/05-atencion.cy.ts` |
| `e2e` | Pantallas portadas de la bóveda | 5 | `cypress/e2e/redsat-port.cy.ts` |
| `regression` | Regresión · accesibilidad | 6 | `cypress/e2e/regression/accesibilidad.cy.ts` |
| `regression` | Regresión · modales | 6 | `cypress/e2e/regression/modales.cy.ts` |
| `regression` | Regresión · notificaciones | 5 | `cypress/e2e/regression/notificaciones.cy.ts` |
| `regression` | Regresión · directorio del panel | 4 | `cypress/e2e/regression/panel-directorio.cy.ts` |
| `regression` | Regresión · tabla de datos | 6 | `cypress/e2e/regression/tabla.cy.ts` |
| `responsive` | Responsive · escritorio · Responsive · tableta · Responsive · móvil | 6 | `cypress/e2e/responsive/responsive.cy.ts` |
| `smoke` | Humo | 10 | `cypress/e2e/smoke/aplicacion.cy.ts` |
| `tutorials` | Centro de tutoriales | 11 | `cypress/e2e/tutorials/centro-de-tutoriales.cy.ts` |

## Page Objects

| Objeto | Ruta | Métodos | Archivo |
| --- | --- | --- | --- |
| `ActivateAccountPage` | `/auth/activate` | 13 | `cypress/support/pages/activate-account.page.ts` |
| `DashboardPage` | `/dashboard` | 11 | `cypress/support/pages/dashboard.page.ts` |
| `DesignSystemPage` | `/design-system` | 7 | `cypress/support/pages/design-system.page.ts` |
| `ForgotPasswordPage` | `/auth/forgot-password` | 9 | `cypress/support/pages/forgot-password.page.ts` |
| `LoginPage` | `/auth` | 17 | `cypress/support/pages/login.page.ts` |
| `NotFoundPage` | `/esta-ruta-no-existe` | 4 | `cypress/support/pages/not-found.page.ts` |
| `RegisterPage` | `/auth/register` | 13 | `cypress/support/pages/register.page.ts` |
| `ResendVerificationPage` | `/auth/resend-verification` | 10 | `cypress/support/pages/resend-verification.page.ts` |
| `ResetPasswordPage` | `/auth/reset-password` | 12 | `cypress/support/pages/reset-password.page.ts` |
| `TenantSelectionPage` | `/auth/organization` | 6 | `cypress/support/pages/tenant-selection.page.ts` |
| `VerifyEmailPage` | `/auth/verify-email` | 7 | `cypress/support/pages/verify-email.page.ts` |

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
| `token-vencido` | El token del correo ya no sirve: verificar y cambiar la clave fallan. |
| `clave-cambiada-con-sesiones` | El cambio de contraseña cierra otras dos sesiones abiertas. |
| `reenvio-limitado` | El reenvío de verificación responde 429: hay que esperar 45 segundos. |
| `api-lenta` | Respuestas demoradas: hay estado de carga que observar. |

## Coherencia de los selectores

Los 84 identificadores que la suite localiza están declarados en las plantillas.
