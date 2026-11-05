# Poder del representante legal: obligatorio en toda alta de organización

**Fecha:** 05/11/2026 · **Pedido:** el propietario, con captura del alta de
imagenología donde el campo decía «Poder del representante legal (opcional)» y,
debajo, «Este dato es obligatorio». Pidió que sea obligatorio sí o sí, que no
diga «opcional», y revisar los otros registros de organización.

## Qué pasaba

- **Imagenología** rotulaba el campo «(opcional)» siempre, pero el validador lo
  exigía a todo tipo societario salvo UNIPERSONAL. Para una S.R.L. salían a la
  vez «(opcional)» y el error de obligatorio: la contradicción de la captura.
- **Laboratorio, farmacia y centro médico** cambiaban el rótulo y el validador
  según el tipo societario: obligatorio para todos, «(opcional)» y sin
  validador para UNIPERSONAL (espejo de la regla BR-09 de la API).
- **Aseguradora** (`register-organization`) ya lo exigía siempre.

## Decisión aplicada

El poder del representante es obligatorio en los cuatro registros, para todo
tipo societario, y su rótulo nunca lleva «(opcional)». El front pide más que
la API (que sigue dejando pasar a una unipersonal sin él), nunca menos. La
escritura de constitución conserva su excepción para la unipersonal: no era
parte del pedido.

Se eliminó el parámetro `required` de `notarizedPowerField` (helper compartido):
ya no hay forma de declarar ese campo como opcional.

## Archivos

| Área | Cambio |
| --- | --- |
| `shared-registration/legal-documents.ts` | `notarizedPowerField` siempre obligatorio |
| `register-imaging-center.ts` | validador fijo en `poderFile`, rótulo y ayuda; mensaje de error compartido |
| `register-laboratory.ts` | validador fijo; se quitó `poderObligatorio()` y la suscripción al tipo societario |
| `register-pharmacy.ts` / `.help.ts` | ídem; `campoDelPoder` deja de ser `computed` |
| `register-medical-center/*` | `DOCUMENTOS_OPCIONALES_POR_TIPO.UNIPERSONAL` ya no incluye el poder; textos |
| Pruebas | `legal-documents.spec`, y los cuatro `register-*.spec` fijan la regla nueva |
| `playwright/altas-api-real-tres-escenarios.spec.ts` | el escenario unipersonal adjunta el poder |

## Validación

- `yarn lint`: limpio. `yarn typecheck`: limpio.
- `ng test` acotado a `features/auth/{register-*,shared-registration}`:
  24 archivos, 534 pruebas, todas verdes.
- Navegador (Chromium, 1440×900, `ng serve --configuration development,demo`),
  guion en `capturas/guion-evidencia.mjs`: se restaura un borrador con tipo
  societario **UNIPERSONAL** en la página del representante de cada alta y
  se pulsa «Siguiente» sin adjuntar el poder. En los cuatro casos el rótulo es
  «Poder del representante legal», ninguno dice «opcional», el asistente se
  queda en la página y muestra «Este documento es obligatorio para continuar».
  Resultado por formulario en `capturas/resultados.json`; capturas en
  `capturas/`.
- No se corrió `altas-api-real-tres-escenarios` ni `alta-organizacion-medica.mjs`
  (el primero necesita API real; el segundo no entra en `yarn pw`). Los dos se
  actualizaron para que la unipersonal adjunte el poder.
- Revisión independiente (`frontend-reviewer`, agente): APROBADO con
  observaciones, todas atendidas salvo una preexistente:
  - `alta-organizacion-medica.mjs` avanzaba la página del poder sin subirlo
    (quedaría roto): ahora lo sube y afirma que viaja en el cuerpo.
  - El texto del 422 de la API (`registration-errors.ts`) decía «sólo una
    unipersonal puede registrarse sin él»: ahora dice que es obligatorio para
    toda organización.
  - **Preexistente, no tocado:** `register-pharmacy.html` y
    `register-laboratory.html` pasan `[required]="false"` a todas las
    dropzones, poder incluido, así que `app-file-input` no recibe `required`
    ni `aria-required` en ese campo (centro médico e imagenología sí lo
    marcan). Es deuda de accesibilidad anterior a este cambio; corregirla
    exige evidencia de navegador aparte.
  - `docs/refactor-profesional/trabajo/ESTADO.md` todavía describe a la
    unipersonal «sin constitución ni poder» (deriva documental, no bloqueante).

## Estado de `dev` al rebasar (05/11/2026)

La rama se rebasó sobre `origin/dev` (5fe05941e). En ese punto `dev` no
compila por sí solo: `agenda/booking-new/motivo-figura/motivo-figura.ts`
importa `core/data-access/triage-ia/triage-ia.client` y
`symptom-check/ai-reading`, que no existen en `dev`; `yarn lint` tiene 10
errores en `app.routes.ts` y en handlers del mock. Nada de eso está en este
diff. Por eso la corrida verde de pruebas se hizo en un worktree sobre la base
anterior (75b8378f) con este mismo diff aplicado; en la rama rebasada el
bundle de pruebas no llega a correr por el error ajeno.
