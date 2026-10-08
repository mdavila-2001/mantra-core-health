# Reporte — El alta de aseguradora sin «Tu cuenta»: el representante legal es el owner

- **Fecha:** 2026-10-08
- **Rama:** `marcelo/alta-aseguradora-solo-representante-dev` → PR a `dev` (el mismo cambio de la rama de `mockup`, portado; ver «Port a dev»)
- **Pedido:** el único que inicia sesión por una aseguradora es su representante legal. El paso «Tu cuenta» (un segundo juego de nombre, correo y contraseña para «quien administra») ya no va.
- **Peldaño de evidencia:** **VERIFIED** en el navegador contra el simulador (`mockup`). **No** se probó contra la API real (ver «No cubierto»).

## Qué cambió

| Dónde | Cambio |
|---|---|
| `register-organization.ts` / `.html` | Se quita la página «Tu cuenta» (`ownerName`, `email`). La contraseña se pide en «Representante legal (1 de 2)», junto al correo, que pasa a ser el del login. `datos()` arma el `owner` del contrato con el nombre y el correo del representante, y su contraseña. El alta queda en **7 páginas** (8 en países multizona; antes 8 y 9). La última página es «Directorio ejecutivo», cuyo «Continuar» envía. |
| `register-organization.spec.ts` | Se reescribe el bloque del owner; 77 pruebas del alta en verde. |
| `playwright/helpers/` | `owner.ts` se elimina; `completarRepresentanteLegal` pide la contraseña y acepta el correo. Los cinco specs del alta se adaptan. |
| `tools/video-aseguradora/` | El representante (Rodrigo Salvatierra) es quien se registra y entra; el correo del login pasa a ser el suyo. Se quita el paso 8 del recorrido. |

Además, **se arregló un paso del video que ya estaba roto en `mockup`**: el commit `8acf703` (6/10) puso el selector de tipo de organización entre «Registrá tu organización» y el formulario, y `grabar.mjs` seguía esperando el formulario directo. Ahora elige la tarjeta «Aseguradora».

## El back (`mdavila-2001/mantra-core-health-api`, rama `dev`)

**No hace falta tocarlo para este cambio.** El contrato no cambia: el front sigue mandando `owner{email,password,name,lastName,…}` y `legalRepresentative{…}`, ahora con los mismos datos de la persona.

- `RegisterOrganizationOwnerDto` exige `email` y `password` (mín. 8): el front los sigue mandando.
- `contact_points` es polimórfico y sin restricción de unicidad: el mismo correo en la cuenta owner y en el contacto del representante no choca.
- La duplicación existe en el back, no en la pantalla: `createContactPerson` crea una fila en `profiles.persons` para el representante, y el owner es una cuenta **sin** `persons` (lo dice el propio DTO). Quedan dos registros de la misma persona sin vínculo entre sí.

**Propuesta para el back (no incluida):** que el alta acepte `owner` derivado de `legalRepresentative` + `password`, y que la cuenta quede enlazada a la persona del representante. Es un cambio de contrato; se deja a quien sea dueño del DTO.

## Evidencia

```
$ ng test --include 'src/app/features/auth/register-organization/**/*.spec.ts'
 Test Files  2 passed (2)
      Tests  77 passed (77)

$ playwright test carril-registro-aseguradora{,-representante,-documentos,-gps}.spec.ts   (Chromium, ng serve, simulador)
 representante: 13 passed
 resto:         22 passed

$ node tools/video-aseguradora/grabar.mjs --hasta perfil
 Marcas (s): … representante-legal=38.32 · directorio-ejecutivo=49.04 · alta-confirmada=63.08 · login=67.29
 Controles: sin «Andina», sin dominios .mock, sin errores de página ni rutas sin manejador.
 (registro → confirmación → login con el correo y la contraseña del representante → «Mi perfil»)

$ tsc -p tsconfig.app.json --noEmit · tsc -p playwright/tsconfig.json --noEmit · eslint (archivos tocados)
 salida 0

$ ng test --watch=false   (suite completa)
 Test Files  2 failed | 756 passed (758)
      Tests  2 failed | 10463 passed (10465)
```

Capturas del navegador, en [evidencia/](./evidencia/): `01` el representante con correo y contraseña («Paso 5 de 7»), `02` la última página con «Crear cuenta de la aseguradora», `03` la confirmación.

## Rojos que no son de este cambio

- `fichas-estandar.spec.ts › son tantas como los JSON que siembra el backend`: lee los JSON del repo del back, que en este entorno no está al lado. Ya figuraba en rojo en `mockup` (reporte del 5/10). No se tocó `src/app/core`.
- `lab-orden-entrante.spec.ts`: falló en la suite completa y **pasa** al correrlo aislado. Intermitente.

## No cubierto

- **La API real.** `registro-organizacion-api-real.spec.ts` se adaptó (compila y pasa lint) pero **no se ejecutó**: necesita `E2E_API_REAL=1` con la API levantada.
- **El MP4 completo del video.** Se ensayó hasta «Mi perfil»; el tramo posterior (Mis productos, solicitudes, siniestralidad, directorio) no se tocó y no se regrabó.
- **Doble revisión** (`NO_SELF_APPROVAL`): quien implementó no aprueba; falta el pase de `visual-reviewer` y `frontend-reviewer`.
- Los checks de CI del PR, que el repo tiene caídos.

## Port a `dev`

- `dev` tenía el mismo «Tu cuenta», más un validador sobre el nombre del owner (`nombresAdicionalesLargos`, tope de 100 en el `middleName` del back). Como el owner ahora es el representante legal, el validador pasa a `legalRepresentative` (y su prueba, también).
- `tools/video-aseguradora/` no existe en `dev` (es de `mockup`): esos cambios no viajan.
- `dev` sirve contra la API real por defecto (`mockBackend: false`); los e2e de este reporte se corrieron con `ng serve --configuration demo`, que trae el simulador.

```
$ ng test --include 'src/app/features/auth/**/*.spec.ts'     (sobre dev)
 Test Files  22 passed (22)
      Tests  570 passed (570)

$ playwright test carril-registro-aseguradora*.spec.ts registro-farmacia.spec.ts   (ng serve --configuration demo)
 38 passed · 1 failed
```

El rojo es `registro-farmacia.spec.ts › kill-test mínimo` (`.paginated-form__titulo` resuelve a dos títulos durante la transición, antes del mensaje de éxito). **Falla igual en `origin/dev` sin estos cambios** (comprobado en un worktree limpio): no es de este PR.
