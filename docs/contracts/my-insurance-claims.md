# Contrato — «Mis solicitudes»: las decisiones de la aseguradora vistas por cada cuenta

- Fecha: 2026-10-01 · Módulo: M26 `insurance` · Pantalla: `/my-account/requests`
- Estado: **servido por el simulador** (`src/app/core/mock/handlers/insurer-received-claims.handlers.ts`).
  La API todavía **no** lo expone (P56 en `PENDIENTES-BACKEND.md`).

## Qué es

La otra cara de `GET /insurance/received-claims` (`insurer-received-claims.md`): la misma
`insurance.insurance_claims` y el mismo dictamen, vistos por quien presentó o hizo la prestación.
**No es una copia**: lo que la aseguradora decide (`POST /insurance/received-claims/:id/decision`)
aparece en la próxima lectura de este endpoint.

## `GET /insurance/my-claims`

Sin parámetros. **El lado lo resuelve el servidor por la sesión**, en este orden:

| `view` | Quién | Qué solicitudes |
|---|---|---|
| `PRACTITIONER` | sesión con perfil profesional | las de sus atenciones (`encounter` → profesional) |
| `LABORATORY` | personal de una unidad diagnóstica de laboratorio (tenant activo, del que es miembro) | las de análisis clínicos que ejecutó |
| `IMAGING` | personal de un centro de imagenología | las de estudios de imagen que ejecutó |
| `PATIENT` | sesión `PATIENT` con perfil de paciente | las suyas |
| `NONE` | cualquier otra (aseguradora, farmacia…) | ninguna — **200 con lista vacía**, no 403 |

Un `X-Tenant-Id` de un tenant del que la sesión **no es miembro** no abre la vista de un centro.
Sin sesión: `401`.

```json
{
  "view": "PATIENT",
  "truncated": false,
  "items": [
    {
      "id": "uuid",
      "claimIdentifier": "CLM-2026-1180",
      "patientName": null,
      "practitioner": { "displayName": "Dra. Valeria Rojas Mendoza", "specialty": "Cardiología" },
      "providerName": "Consultorio Dra. Rojas",
      "service": { "code": "SVC_ECOGRAFIA", "display": "Ecografía" },
      "additionalServiceCount": 0,
      "billedTotal": { "amount": "320.00", "currency": { "code": "BOB", "display": "Boliviano" } },
      "approvedTotal": null,
      "submittedAt": "2026-09-28T09:15:00.000Z",
      "serviceDate": "2026-09-27",
      "insurerName": "Seguros Andina",
      "planName": "Seguros Andina · Plan Integral",
      "status": { "code": "SUBMITTED", "display": "Enviada" },
      "decision": null
    }
  ]
}
```

- `decision`: `{ outcome: 'APPROVED' | 'PARTIAL' | 'REJECTED', decidedAt, reason }` o `null`
  mientras no haya dictamen. `reason` es obligatorio en `PARTIAL` y `REJECTED`.
- `approvedTotal`: `null` sin dictamen. **No es cero.**
- `patientName`: `null` en la vista `PATIENT` (es quien mira).
- Orden: de la más reciente a la más antigua. Tope 500 (`truncated: true` por encima).

### Lo que deliberadamente NO viaja

Mínimo necesario para entender la decisión (ASVS / regla 60-backend §8):

- ni la **factura** entre prestador y aseguradora (`invoice`), ni los **renglones** (`lines`);
- ni la **póliza** ni el número de afiliado;
- ni **quién** de la aseguradora firmó el dictamen (`decidedBy`): es personal de la aseguradora.

## Origen en el modelo

El mismo de `insurer-received-claims.md`; ninguna tabla ni columna nueva. La disciplina de un
estudio (laboratorio / imagen) sale del servicio de la orden y de la unidad diagnóstica que la
ejecutó.
