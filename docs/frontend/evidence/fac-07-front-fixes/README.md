# FAC-07 · Arreglos sueltos de front — evidencia de navegador

Chromium sin ventana (Playwright) contra el front de esta rama servido con la
configuración `real-api` y `proxy.conf.json` de esta rama, y la API de
`origin/dev` (`691c1d052`) con su base construida por el DDL del repositorio.
Cuentas sintéticas `@alovida.test` creadas por las rutas reales (alta asistida
de la médica con consultorio propio, registro público de dos pacientes, cupos,
reserva y aceptación por la API). Zona `America/La_Paz`, 2026-10-29.
`recorrido.log` es la salida literal, con las respuestas de la API que pidió
cada pantalla.

| Hallazgo | Escenario | Capturas |
|---|---|---|
| H16 | Con la sesión de la médica, el servidor de desarrollo reenvía `/patient-coverages/by-patient/:id`, `/billing/invoices` y `/billing/payments-received` a la API: responden JSON (403 por rol en los dos primeros, como pide hoy la API; 404 de la API en el tercero, que no tiene `GET` en la raíz), no el HTML de la SPA | (sin captura: `recorrido.log`, líneas H16) |
| H12 | Médica · Contabilidad → «Anotar gastos, equipos y deudas»: monta la tabla, sin el aviso «El servidor aún no ofrece esta función»; «Nuevo gasto» → `201 POST /accounting/practitioner/simple/records`; aparece en la tabla y sigue tras recargar. «Resumen» trae los tres números (`GET …/simple/summary` 200), que no cambian por el gasto: es lo esperado | `h12-anotar-gastos-{1440,390}.png`, `h12-gasto-formulario-1440.png`, `h12-expense-in-table-1440.png`, `h12-gasto-tras-recargar-1440.png`, `h12-resumen-tres-numeros-1440.png` |
| H12 · 390 px | La misma alta en el celular: «Nuevo gasto» → `201 POST /accounting/practitioner/simple/records`; aparece en la tabla y sigue tras recargar. La tabla se desplaza a lo ancho dentro de su marco para mostrar «Acciones», como en el resto de las tablas | `h12-expense-form-390.png`, `h12-expense-in-table-390.png`, `h12-expense-after-reload-390.png` |
| H04 | Médica · agenda · cita «Pagada» a mano → «Estado del pago»: «Pagada», «El pago se registró sin comprobante» y un solo «Marcar sin comprobante…». Otra cita sin pago: el vacío de siempre y un solo control; marcarla desde el pie → `200 PUT …/payment-state` → el mismo diálogo pasa a «Pagada» sin contradecirse, y así sigue en una sesión nueva | `h04-dialogo-pagada-{1440,390}.png`, `h04-dialog-unpaid-1440.png`, `h04-marcada-pagada-1440.png`, `h04-tras-recargar-1440.png` |
| H07 | Médica · `/medical-records/<id>/consultation` por URL con una paciente sin vínculo y con un id inventado: el mismo texto para el profesional, el código de soporte y «Pedir acceso a su historia» (abre `/medical-records/<id>/request-access`). Con la paciente de la cita de hoy, la consulta abre como antes | `h07-no-access-{unlinked-patient,made-up-id}-{1440,390}.png`, `h07-pedir-acceso-1440.png`, `h07-consultation-with-booking-1440.png` |

Radio: la paciente que intenta abrir la consulta o la contabilidad por URL
vuelve a su panel (`patient-consultation-1440.png`, `patient-accounting-1440.png`).

No verificado:

- **H16 en el proxy del servidor desplegado** (`deploy/api-locations.conf`):
  solo se ve en `dev` después del merge. BLOQUEADO hasta entonces.
- **El enlace a «Configuración para facturar»** (REQ-FAC-07-013): la ruta
  `/administration/accounting/billing-setup` es de FAC-06 y todavía no existe
  en ninguna rama publicada. BLOQUEADO.

## `playwright/practitioner-corrections-c4b.spec.ts`

Corrido contra la maqueta (`yarn start:demo`), con el Chromium de la máquina.
«Una cita sin comprobantes lo dice y ofrece marcar el pago sin comprobante»,
la que cambia de selector en este carril, **pasa** (19,5 s). La otra prueba del
archivo cumple todos sus pasos y cae al final por dos avisos de consola
`AbortError: Transition was skipped` de la transición de vista; en la base
limpia (`origin/dev`) esa prueba también cae, antes, al buscar el turno de las
13:00 en el calendario: no es de este cambio. De esa corrida se actualizan las
capturas del diálogo vacío en `correcciones-medico-c4b/`
(`practitioner-receipts-dialog-empty-*`, `practitioner-manual-payment-1280-light`),
que mostraban el botón dos veces.
