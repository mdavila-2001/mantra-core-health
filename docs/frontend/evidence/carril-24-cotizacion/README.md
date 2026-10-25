# Carril 24 · cotizaciones — matriz de criterios (2026-10-25)

Evidencia contra la API real (`dev`, Postgres local): `playwright/carril-24-cotizacion-api-real.spec.ts`,
1/1 con `--workers=1`. Contra la maqueta: `playwright/planes-de-pago-flexibles.spec.ts`.
Unitarias de cotizaciones y del PDF: 29/29.

| # | Criterio de la ficha | Estado | Evidencia |
|---|---|---|---|
| 1 | Vista para elegir cliente | PASS | Buscador de paciente en el alta; `?patient=` la preelige (spec real: «Elsa» elegida) |
| 2 | Fecha de la atención | PASS | Se escribe y vuelve igual de la API (`attentionDate`) |
| 3 | Asociar opcionalmente una cita | PASS (código) | Select «Cita asociada», opcional; no lo ejercita el spec real |
| 4 | Servicio médico adicional, sin tomar la cita como servicio | PASS | El servicio sale del catálogo (`billing/service-catalog`), no de la cita |
| 5 | Precio ofrecido | PASS | Prellenado con el de referencia y guardado igual (`offeredPrice`) |
| 6 | Plan de pagos | PASS | El plan se arma y no deja guardar si no cierra; guardado con la misma cantidad de cuotas |
| 7 | Simulador con tasa de interés | **DESCARTADO** | Quitado el 18/09 (`303f13e42`): un consultorio reparte un precio, no presta dinero. **El propietario confirmó el 25/10/2026 que no vuelve.** El spec fija que no reaparezca |
| 8 | Plazo | **RETIRADO** (ver 7) | Reemplazado por cantidad de cuotas y frecuencia |
| 9 | Método de cálculo de intereses | **RETIRADO** (ver 7) | — |
| 10 | Exportar la cotización | PASS | «Exportar» descarga un `.pdf` |
| 11 | Fecha de validez | PASS | Se escribe y vuelve igual de la API (`validUntil`) |
| 12 | Cálculos deterministas y consistentes front/back | PASS | Anticipo + cuotas guardadas suman exactamente el precio, en centavos |
| 13 | Validar montos, plazos, redondeos, moneda | PASS (código + unitarias) | `flexible-payment-plan.ts` trabaja en centavos enteros; aviso de descuadre |
| 14 | No convertir la cotización en obligación contable sin transición explícita | NO PROBADO | No hay una prueba que lo demuestre; se lee en el código que el alta sólo hace `POST /quotations` |
