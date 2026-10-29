# FAC-08 · Lo que ve cada uno en pantalla — evidencia de navegador

Chromium sin ventana (Playwright) contra el front de esta rama servido con la
configuración `real-api` y la API de `origin/dev` (`691c1d052`) con su base
construida por el DDL del repositorio. Cuentas sintéticas `@alovida.test`
creadas por las rutas reales (alta asistida de la médica con consultorio propio,
registro público de la paciente, cupos, reserva, aceptación y cotización por la
API). Zona `America/La_Paz`, 2026-10-29. `recorrido.log` es la salida literal:
cada respuesta de `/scheduling`, `/quotations`, `/terminology` y
`/patient-spending` que pidió cada pantalla.

| Hallazgo | Escenario | Capturas |
|---|---|---|
| H03 | La médica marca «Pagada» a mano (`PUT …/payment-state` 200, sin monto). Paciente · «Mis citas»: la fila dice «Confirmada» y «Pagada», sin monto; la otra cita aceptada no lleva insignia y ofrece «Subir comprobante», que abre el formulario del comprobante | `h03-mis-citas-lista-{1440,390}.png`, `h03-subir-comprobante-{1440,390}.png` |
| H02 | Paciente · «Mis gastos» sin facturas: el texto nuevo, sin la promesa | `h02-mis-gastos-{1440,390}.png` |
| H15 | Médica · «Cotizaciones» → la paciente: «Cita médica · 300,00 Bs · Vigente · 10/11/2026 · 30/11/2026» | `h15-cotizaciones-{1440,390}.png` |
| H11 | Médica · agenda del 10/11, solicitud «Por confirmar»: el menú ofrece «Aceptar la solicitud»; la tarjeta abre «Solicitud de consulta» con «Aceptar solicitud»; `200 POST /scheduling/bookings/:id/accept`; tras recargar, «Confirmada» | `h11-day-before-1440.png`, `h11-menu-acciones-1440.png`, `h11-request-dialog-1440.png`, `h11-tras-aceptar-1440.png`, `h11-tras-recargar-1440.png` |
| H11 · 390 px | La misma aceptación en el celular, con otra solicitud pedida por la paciente (`201` retener cupo y pedir): «Solicitud de consulta» → «Aceptar solicitud» → `200 POST …/accept`; tras recargar la API la da confirmada (mismo concepto que la de 1440) | `h11-day-before-390.png`, `h11-request-dialog-390.png`, `h11-after-reload-390.png` |
| H03 · calendario | Paciente · «Mis citas» en calendario → la cita del 29/10 que la médica marcó pagada a mano: «Esta cita ya figura como pagada: no hace falta subir ningún comprobante.» y «El pago se registró sin comprobante.», sin formulario. La cita sola (`GET /scheduling/bookings/:id`) no trae `paymentState`: el bloque usa el de la lista | `h03-calendar-detail-paid-{1440,390}.png` |
| H03 · monto | Paciente · «Mis citas», la cita del 29/10 pagada a mano. **La API de `dev` todavía no manda `amountPaid` (FAC-01)**: el navegador toma la respuesta real de `GET /scheduling/bookings` y le suma, solo a esa cita, `amountPaid` y `currencyCode` con la forma del contrato §2. Con 150 y `BOB`: «Pagada · 150,00 Bs»; con 20,5 y `USD`: «Pagada · 20,50 USD»; con `0`: «Pagada», sin monto (antes decía «Pagada · 0,00 Bs», corregido en `fix(mis-citas)`); con `null`: «Pagada» | `h03-amount-bob-{1440,390}.png`, `h03-amount-usd-1440.png`, `h03-amount-zero-1440.png`, `h03-amount-null-1440.png` |

La segunda vuelta (H11 a 390 px y el calendario) está al final de `recorrido.log`.
En ella apareció un texto que se contradecía: con la cita pagada a mano y sin
comprobantes, el bloque decía «no hace falta subir **otro** comprobante» y
debajo «Todavía no subió comprobantes». Se corrigió en `fix(mis-citas)` y las
capturas son las de después.

No visto en navegador (solo por spec):

- **El monto con la API real:** se vio con la respuesta modificada en el
  navegador (fila «H03 · monto»). Con la API real falta que FAC-01 mande
  `amountPaid`; entonces alcanza con mirar la misma fila.
- **H11 fuera de la ventana de la tabla:** en los recorridos la tarjeta del día
  coincidió con la ventana; la causa (estado sin resolver fuera de ella) la
  reproduce `agenda.spec.ts`, que fallaba antes del arreglo.
