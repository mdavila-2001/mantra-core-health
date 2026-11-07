# Contrato PROVISIONAL — directorio de todos los usuarios (sesión G)

Estado: **simulado**. El endpoint no existe en la API; lo define el front y lo responde el simulador
(`src/app/core/mock/handlers/governance-directory.handlers.ts`, respuesta con `source: "SIMULATED"`).
La sesión E construye el endpoint real; **una persona debe reconciliarlos**. Tipos del front:
`src/app/core/data-access/authz-admin/authz-admin-directory.types.ts`.

## `GET /authz/directory-users` (rol `SECURITY_ADMIN`)

Query (todo opcional; clave vacía no se envía): `q` (nombre visible), `type`, `status`, `roleCode`, `limit` (1–200, def. 50 en el front), `cursor` (opaco).
`type` ∈ `PATIENT | DOCTOR | PHARMACY | LABORATORY | INTERNAL`; `status` ∈ `ACTIVE | PENDING | SUSPENDED | BLOCKED`. Valor desconocido → 400.

Respuesta 200:

```json
{
  "items": [{
    "id": "uuid", "type": "DOCTOR", "displayName": "string",
    "maskedEmail": "d***@dominio.tld | null",
    "status": "ACTIVE", "lastLoginAt": "ISO-8601 | null",
    "roles": [{ "code": "DOCTOR", "name": "Médico" }],
    "permissions": { "allowed": 21, "denied": 1, "dangerous": 2, "resources": ["clinical_record"] }
  }],
  "nextCursor": "string | null", "limit": 50,
  "typeCounts": { "PATIENT": 0, "DOCTOR": 0, "PHARMACY": 0, "LABORATORY": 0, "INTERNAL": 0 },
  "unavailableTypes": ["LABORATORY"],
  "source": "SIMULATED"
}
```

- `typeCounts`: totales por tipo con los mismos `q/status/roleCode` pero **sin** `type` (alimenta los chips).
- `unavailableTypes`: tipos cuya fuente no se pudo leer → lista **parcial** (M34); omitir o `[]` si todo respondió.
- `source`: sólo lo manda el simulador; la API real no lo envía (el aviso «Datos simulados» desaparece solo).
- `permissions`: resumen por conteos y áreas; el detalle se pide aparte (cajón de la persona).

## Privacidad (parte del contrato)

Sin contraseñas, hashes, tokens, documentos, teléfonos ni direcciones. El correo viaja **ya enmascarado** por la API.
Defensa en el front: el cliente copia sólo los campos de la lista blanca; un correo sin `*` no se muestra.

## Decisiones abiertas (no inventadas por G)

1. ¿`displayName` de pacientes completo o iniciales? G lo muestra tal como llega.
2. ¿Los tipos son exactamente estos cinco y los estados estos cuatro?
3. ¿La gestión de roles desde esta lista aplica a no internos? Hoy sólo las cuentas `INTERNAL` abren el cajón de asignaciones.
4. Ruta y nombre definitivos (`/authz/directory-users` es provisional).

## Brechas de gates (archivos fuera de la lista de G; no se tocaron)

- `scripts/contracts/admin-portal-known-gaps.json`: falta la entrada `GET /authz/directory-users` → `check-admin-portal-contract` la marca como no declarada.
- `docs/integrations/backend-api.md`: la operación no está documentada → `check-api-contract-drift` la marca.
