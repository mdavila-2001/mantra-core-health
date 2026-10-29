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
| H11 | Médica · agenda del 10/11, solicitud «Por confirmar»: el menú ofrece «Aceptar la solicitud»; la tarjeta abre «Solicitud de consulta» con «Aceptar solicitud»; `200 POST /scheduling/bookings/:id/accept`; tras recargar, «Confirmada» | `h11-agenda-dia-antes-1440.png`, `h11-menu-acciones-1440.png`, `h11-solicitud-de-consulta-1440.png`, `h11-tras-aceptar-1440.png`, `h11-tras-recargar-1440.png` |

No visto en navegador (solo por spec):

- **El monto en la insignia** («150,00 Bs»): la API de `dev` todavía no manda
  `amountPaid` en la lista (contrato §2, FAC-01). Sin monto en la red, ningún
  monto en pantalla, que es lo que se ve.
- **El detalle del calendario (`?vista=calendario`) de una cita pagada a mano**
  («Esta cita ya figura como pagada»): cubierto por
  `booking-payment-receipts.spec.ts`.
- **H11 fuera de la ventana de la tabla:** en este recorrido la tarjeta del día
  coincidió con la ventana; la causa (estado sin resolver fuera de ella) la
  reproduce `agenda.spec.ts`, que fallaba antes del arreglo.
- H11 en 390 px.
