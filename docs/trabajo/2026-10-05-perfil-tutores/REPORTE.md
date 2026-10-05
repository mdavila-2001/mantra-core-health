# Reporte — Perfil: tutores, dependientes y contactos de emergencia

- Fecha: 2026-10-05
- Rama: `codex/perfil-tutores-dev`
- Base: `origin/dev`

## Resultado

La ficha del paciente muestra los contactos de emergencia dentro de **Contacto**. La pestaña **Tutores** sólo existe cuando el perfil tiene al menos un representante aceptado, y cada fila muestra nombre, teléfono y relación. **Dependientes** conserva la dirección inversa: sólo lista a quienes la cuenta representa.

Al aceptar una solicitud entrante se exige elegir la relación de la persona solicitante con el paciente. El formulario ofrece únicamente las relaciones válidas para una representación. El editor de datos personales ya no presenta una pestaña Tutores, porque esos vínculos nacen del flujo de solicitudes y no de una edición manual.

## Cambios principales

- Tipos y normalización compatibles con `emergencyContacts` y `guardians` separados.
- Contactos de emergencia dentro de Contacto.
- Tutores condicionales, con parentesco legible y sin insignias de emergencia.
- Selección obligatoria de relación antes de aceptar una solicitud.
- Mock funcional persistente y prueba de navegador del flujo completo.
- Ajuste de los índices de pestañas cuando Tutores no existe; Mis puntos continúa siendo la última pestaña.

## Evidencia

| Verificación                                                                  | Resultado                                                                                                                                                                                                  |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prettier sobre los 15 archivos modificados                                    | PASS                                                                                                                                                                                                       |
| ESLint dirigido sobre TypeScript del alcance                                  | PASS                                                                                                                                                                                                       |
| `yarn typecheck`                                                              | PASS                                                                                                                                                                                                       |
| 5 specs dirigidos de perfil, dependientes, cliente, editor y handlers mock    | PASS: 170 pruebas sobre `origin/dev`                                                                                                                                                                       |
| `yarn build` (navegador + SSR)                                                | PASS, con advertencias preexistentes de imports y presupuestos                                                                                                                                             |
| Playwright `b1-dependientes.spec.ts --grep "pedir por CI" --project=chromium` | PASS: 1 flujo E2E en la rama gemela para `mockup`                                                                                                                                                          |
| Suite global de Vitest, rama gemela para `mockup`                             | 741 archivos pasan y 5 fallan; 10.322/10.327 pruebas pasan. Los fallos ajenos están en resumen contable, árbol de accesos, shards del glosario, cantidad de fichas estándar y un límite de jitter del mock |
| Lint global                                                                   | No verde por 276 errores preexistentes fuera de los archivos modificados                                                                                                                                   |

El E2E comprueba la secuencia completa: solicitud, selección de `Madre`, aceptación, contacto de emergencia dentro de Contacto, aparición de Tutores con nombre y relación, y presencia del paciente en la lista de Dependientes de la cuenta representante.

## Evidencia visual

Se revisaron manualmente las capturas generadas por Playwright en la rama gemela para `mockup`:

- `artifacts/playwright/perfil-tutores-escritorio.png` — 1280 × 720.
- `artifacts/playwright/perfil-tutores-telefono.png` — 390 × 844.

En ambos tamaños la fila del tutor queda contenida, el parentesco es visible y la navegación de pestañas no se corta.

## Infraestructura y despliegue

No fue necesario desplegar. El servidor Angular local se usó sólo durante Playwright, se cerró al finalizar y el puerto 4200 quedó libre.

## Riesgo y reversión

El frontend tolera respuestas anteriores porque normaliza las listas ausentes a `[]`; el backend tolera clientes anteriores que aceptan sin relación explícita. La reversión consiste en revertir este commit, sin migraciones ni estado externo.
