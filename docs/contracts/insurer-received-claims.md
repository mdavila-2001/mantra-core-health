# Contrato — Solicitudes recibidas por la aseguradora

- Fecha: 2026-09-27 · Módulo: M26 `insurance` · Pantalla: `/administration/received-claims`
- Estado: **servido por el simulador** (`src/app/core/mock/handlers/insurer-received-claims.handlers.ts`).
  La API todavía **no** expone esta cara; este documento es lo que tiene que implementar.

## Qué es

La cara de **quien paga** del mismo `insurance.insurance_claims` que el prestador ve en
«Solicitudes de seguro» (`GET /insurance-claims`, `ClaimsReadController`). Aquél filtra por
`billing_provider_entity_id` (lo que *mi organización envió*); éste filtra por
`insurance_carrier_id` (lo que *le presentaron a mi aseguradora*).

**No hace falta ninguna tabla ni columna nueva.** Todo sale de lo que el modelo ya declara:

| Campo | Origen en el modelo |
|---|---|
| `patient` | `insurance_claims.patient_coverage_id` → cobertura → perfil del paciente |
| `practitioner` | `insurance_claims.encounter_id` → `clinical.encounters` (profesional de la atención) |
| `serviceDate` | `clinical.encounters`, comienzo de la atención (día, `format: date`) |
| `service` | `insurance_claim_lines.service_concept_id` de la línea de **mayor** `billed_amount` |
| `additionalServiceCount` | cantidad de líneas − 1 |
| `providerName` | `insurance_claims.billing_provider_entity_id` resuelto a su nombre |
| `billedTotal` | `insurance_claims.total_amount` + `currency_concept_id` |
| `approvedTotal` | última `claim_adjudication_versions.total_approved_amount`, `null` sin dictamen |
| `submittedAt` / `status` | `insurance_claims.submitted_at` / `status_concept_id` |
| `policyIdentifier` / `planName` | póliza y plan de la cobertura |
| `lines` | `insurance_claim_lines` (código del catálogo, cantidad, precio, importe), de mayor a menor importe |
| `decision` | última `claim_adjudication_versions`: resultado, fecha, quién y motivo; `null` sin dictamen |
| `invoice` | la factura que emitió el dictamen favorable, con las anuladas en `previous` — **ver «Pendiente en el modelo»** |

Una solicitud sin `encounter_id` viaja con `practitioner: null` y `serviceDate: null`; la pantalla
lo dice con palabras («Sin atención asociada»), no con un guion.

## `GET /insurance/received-claims`

Sin parámetros. El alcance lo resuelve el servidor por la **membresía del usuario en la
aseguradora activa** (el tenant `PAYER` del token), igual que `GET /insurance/analytics/loss-ratio`.
El cliente no manda ningún id de aseguradora: si lo mandara, sería un IDOR esperando pasar.

Respuesta `200`:

```json
{
  "items": [
    {
      "id": "uuid",
      "claimIdentifier": "CLM-2026-1042",
      "patient": { "id": "uuid", "displayName": "…", "patientCode": "PAC-…", "memberIdentifier": "AF-…" },
      "practitioner": { "id": "uuid", "displayName": "…", "specialty": "Cardiología" },
      "providerName": "Clínica …",
      "service": { "code": "…", "display": "Ecografía" },
      "additionalServiceCount": 0,
      "billedTotal": { "amount": "400.25", "currency": { "code": "BOB", "display": "Boliviano" } },
      "approvedTotal": null,
      "submittedAt": "2026-09-26T14:00:00.000Z",
      "serviceDate": "2026-09-17",
      "policyIdentifier": "POL-…",
      "planName": "… · Plan Oro",
      "status": { "code": "IN_REVIEW", "display": "En revisión" },
      "lines": [
        {
          "sequence": 1, "code": "SVC_ECOGRAFIA", "display": "Ecografía", "quantity": 1,
          "unitPrice": { "amount": "400.25", "currency": { "code": "BOB", "display": "Boliviano" } },
          "billedAmount": { "amount": "400.25", "currency": { "code": "BOB", "display": "Boliviano" } }
        }
      ],
      "decision": null,
      "invoice": null
    }
  ],
  "truncated": false
}
```

- Orden: `submittedAt` descendente.
- **Tope 500 filas** y `truncated: true` si hay más. La pantalla es una lista local de ADR-0015
  (busca, filtra, ordena y pagina en el cliente) y avisa del recorte. Si el volumen real de una
  aseguradora lo supera, el paso siguiente es mover los filtros al servidor con cursor, no subir
  el tope.
- Importes como **cadena decimal** (mismo criterio que AC-16-6): nunca `number`.
- `403` para quien no pertenece a una aseguradora (paciente, médico, prestador).

## Datos del simulador

180 solicitudes deterministas para Seguros Andina. **Ninguna persona real**: médicos escritos de
la maqueta y `DEMO` (nunca `RED_ASEGURADORA` ni `USUARIO_PROPIETARIO`) y pacientes escritos o
generados (nunca los de `USUARIO_PACIENTES_1.md`). Lo verifica
`insurer-received-claims.handlers.spec.ts`.

## Dictamen y factura (2026-09-30)

La pantalla ya no sólo lee: la aseguradora **dictamina** desde la fila o desde el detalle, y
puede **anular la factura** que produjo el dictamen. Hoy lo sirve el simulador.

### `POST /insurance/received-claims/:id/decision`

```json
{ "outcome": "APPROVED" | "PARTIAL" | "REJECTED", "approvedAmount": "200.00", "reason": "…" }
```

- **Definitivo.** `409 { reason: "ALREADY_DECIDED" }` si la solicitud ya no está en `SUBMITTED` o
  `IN_REVIEW`. No existe ruta para revertirlo; la pantalla lo advierte antes de mandar.
- `APPROVED`: aprueba el monto solicitado; `reason` opcional.
- `PARTIAL`: `approvedAmount` obligatorio, cadena decimal, mayor que cero y **menor** que lo
  solicitado; `reason` obligatorio (≥ 5 caracteres). `422` si no.
- `REJECTED`: `reason` obligatorio. No se emite factura.
- Un dictamen favorable **produce el evento de facturación en el mismo acto**: la factura del
  prestador a la aseguradora por el monto aprobado. Responde `200` con la solicitud completa.

### `POST /insurance/received-claims/:id/invoice/annulment`

`{ "reason": "…" }` (≥ 5 caracteres). Anula la factura vigente; **el dictamen no cambia**.
`409 NO_ACTIVE_INVOICE` si no hay factura vigente; `409 ALREADY_PAID` si la solicitud ya está
pagada (eso se corrige con nota de crédito, otro circuito).

### `POST /insurance/received-claims/:id/invoice`

Emite la factura corregida de una solicitud aprobada cuya factura se anuló. La anulada pasa a
`invoice.previous`. `409 NOTHING_TO_REISSUE` si no corresponde.

### Pendiente en el modelo

`insurance_claims` no tiene hoy vínculo con una factura. Para que la API cumpla esto hace falta
decidir **dónde vive la factura del prestador a la aseguradora** — reusar la facturación
(`/billing`, SIAT) con la aseguradora como compradora, o una tabla propia — y el evento que la
emite al dictaminar. La anulación en la API real tiene que pasar por la anulación del SIAT
(`anulacionFactura`, con código de motivo del catálogo), que el simulador de facturación del
front ya modela en `core/mock/siat-sim/`. Mientras tanto el simulador de este contrato guarda la
factura dentro de la solicitud, en `sessionStorage` (`mock.insurerReceivedClaims`).
