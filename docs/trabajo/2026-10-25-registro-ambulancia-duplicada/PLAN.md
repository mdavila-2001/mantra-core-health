# Plan — Registro de paciente: «Servicio de ambulancia» sin duplicados

- Fecha: 2026-10-25 · Repos afectados: `mantra-core-health` · Predecesor: carriles 03 y 04 (alta de paciente)
- Origen: captura de producción (`/auth/register/patient`, paso «Datos de contacto y emergencia») con el título «Servicio de ambulancia» y su ayuda repetidos.
- Nota de proceso: el plan se escribió después de localizar la causa y antes de subir el cambio.

## Alcance
Dentro: la plantilla `trustedAmbulanceService` de `register-patient.html`, su declaración en `register-patient.ts` y una prueba de regresión.
Fuera: los demás campos `custom` (ya declaran `label: ''` o no duplican), el motor `paginated-form`, el directorio de ambulancias.

## H1 — El servicio de ambulancia muestra su título y su ayuda una sola vez
**CA:** dado el paso «Datos de contacto y emergencia», cuando se dibuja el campo «Servicio de ambulancia», entonces el título y la ayuda «Al elegir uno, se completan nombre y teléfono. Puede editarlos.» aparecen exactamente una vez.

- **H1.S1.M1** Localizar la causa. DoD: el motor (`paginated-form.html:47`) envuelve cada campo `custom` en un `app-form-field` con `label`/`hint`/`description`; la plantilla lo envolvía de nuevo.
- **H1.S1.M2** Declarar el campo sin `label`/`hint`/`description` en el `.ts` (`label: ''`, como ya hacen `name`, `additionalPhones` y `additionalEmergencyContacts`) y dejar el `app-form-field` de la plantilla, que es el que cablea el selector por DI. DoD: diff de 2 archivos (`.ts` y spec).
  - *Desvío:* la primera versión quitaba el `app-form-field` de la plantilla. Un revisor independiente avisó que el `app-select` sólo recibe su etiqueta y su `aria-describedby` por inyección del `app-form-field` que tiene encima; se comprobó en el navegador (0 comboboxes con nombre «Servicio de ambulancia», sin `aria-describedby`) y se rehízo.
- **H1.S1.M3** Prueba de regresión de duplicado **y** de accesibilidad (`label[for]` y `aria-describedby` del selector). DoD: **falla sin el arreglo** (`expected 2 to be 1`) y pasa con él.
- **H1.S1.M4** Verlo en la pantalla real. DoD: recorrido Playwright hasta el paso 3 con título y ayuda una vez, el selector con `label for` y `aria-describedby` apuntando a ids existentes, y captura.
- **H1.S1.M5** `yarn lint`, `yarn typecheck` y el spec del registro en la base de `dev` y en la de `test`.

## Riesgos previstos
- Producción corre una build de `dev`/`test` desplegada con Coolify: el arreglo sólo se ve allí tras el despliegue del PR.
