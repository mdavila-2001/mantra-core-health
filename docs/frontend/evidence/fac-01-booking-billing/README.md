# FAC-01 · el pago de la agenda llega a facturación — evidencia

Front de la rama `itzan/fac-01-pago-de-agenda-en-facturacion-dev` (`yarn start:real-api`) contra
la API de la rama del mismo nombre (`d54e65827`) en local, con Postgres local. Cuentas
sintéticas `@alovida.test` creadas por las rutas reales; la cita de prueba se retuvo, se
solicitó y se aceptó por la API. Ninguna base gestionada.

## Recorrido (`recorrido.log`)

UI → request → response → BD → recarga → UI:

| Paso | Qué se ve | Prueba |
|---|---|---|
| Marcar «Parcialmente pagada» y escribir 50 | `h01-amount-typed-1440.png` | `200 PUT …/payment-state` |
| «Registrar pago» | `h01-amount-saved-1440.png`: «Recibido: 50,00 Bs de 150,00 Bs.» | cuerpo `{"state":"PARTIALLY_PAID","insuranceUsed":false,"amountReceived":50}`, respuesta `billing.linked=true` |
| 200 Bs con saldo de 100 | `h01-amount-exceeds-1440.png`: el error dice el saldo y el campo conserva «200» | `422 PAYMENT_AMOUNT_EXCEEDS_BALANCE` |
| BD | — | factura de la cita `150.00 / 50.00 / 100.00` (total / pagado / saldo) |
| Recargar | `h01-pending-after-reload-1440.png`, `h01-pending-390.png`: «Recibido: 50,00 Bs» en «Pendientes de pago», leído de la API | `GET /scheduling/bookings` trae `paymentState.amountPaid` |
| Paciente, «Reservar una cita» | `h02-booking-price-1440.png`, `h02-booking-price-390.png`: «Precio de la consulta 150.00 Bs» | `GET /scheduling/slots` trae `price` |

## HTTP (`http-api.log`)

Contra la misma API: precio del turno, los tres 422 (`PAYMENT_AMOUNT_WITHOUT_PAYMENT`,
`PAYMENT_AMOUNT_INVALID`, `PAYMENT_AMOUNT_EXCEEDS_BALANCE`), dos pagos a la **misma** factura,
la marca sin monto que devuelve el vínculo existente, `NO_AMOUNT` en otra cita, y la BD: una
factura por cita, dos pagos, dos asignaciones, estado `billing:INVOICE_PAID`.

`GET /billing/invoices/:id` responde 403 a la médica: es una ruta de facturación con sus propios
roles. La factura se comprobó en la BD.

## Lo que no se ve acá

- «El consultorio todavía no publicó el precio»: cubierto por las pruebas de `booking-new.spec.ts`;
  en local la práctica tiene precio y no se lo quité para la captura.
- El vínculo factura → encuentro al abrir la atención (S-3): cubierto por pruebas de la API, no
  se recorrió en navegador.
