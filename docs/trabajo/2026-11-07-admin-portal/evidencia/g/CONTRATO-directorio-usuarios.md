# Contrato del directorio de usuarios — reconciliado con API PR #1409 (carril G)

Fuente: [API PR #1409](https://github.com/mdavila-2001/mantra-core-health-api/pull/1409) (borrador de la sesión E, commit `f5dfde9`).
El front sigue ese contrato. **No se ejecutó contra una API real**: la respuesta la da el simulador
(`src/app/core/mock/handlers/governance-directory.handlers.ts`), marcada `source: "SIMULATED"`.
Tipos del front: `src/app/core/data-access/authz-admin/authz-admin-directory.types.ts`.
Estado de evidencia: máximo `VERIFIED_FUNCTIONAL_ONLY` (simulador); contra la API real, no se ejecutó.

## Cambios respecto al contrato provisional anterior

| Antes (provisional G) | Ahora (E, #1409) |
|---|---|
| `GET /authz/directory-users` | `GET /authz/users/directory` |
| filtro `q` (nombre) | **sin texto libre, a propósito** (PHI en la URL): la pantalla ya no tiene buscador |
| `type`: `DOCTOR`, … | `PATIENT\|PRACTITIONER\|PHARMACY\|LABORATORY\|INTERNAL\|OTHER` |
| `status`: `ACTIVE\|PENDING\|…` | `status` = **uuid** de concepto (`iam.users.status_concept_id`) |
| `limit` 1–200 | `limit` 1–100 (def. 50) |
| `roles[]{code,name}` | `roles[]{assignmentId,roleCode,roleName,tenantId,validTo}` |
| `permissions{allowed,denied,dangerous,resources}` | `permissions{allowed,denied,dangerous,directGrants}` (deny gana) |
| `status` en cada fila | `statusConceptId` + `mfaStatusConceptId` (uuid / `null`) |
| `typeCounts`, `unavailableTypes` | **no existen**: sin conteos por chip ni estado «parcial» por tipo |
| — | `scope: PLATFORM\|TENANT` (la pantalla lo dice) |

## Contrato que consume el front

Query (todo opcional; clave vacía no se envía): `type`, `status` (uuid), `roleCode` (`^[A-Z0-9_]+$`, ≤64), `cursor` (opaco, ≤512), `limit`.
Rol `SECURITY_ADMIN`; `SUPERADMIN` sin organización ve toda la plataforma; cualquier otro queda acotado a la organización resuelta y, sin ella, recibe **403** (`TENANT_REQUIRED`).

Respuesta 200: `{ items: DirectoryUser[], nextCursor: string|null, limit, scope }` con
`DirectoryUser = { id, displayName, type, statusConceptId, mfaStatusConceptId|null, lastLoginAt|null, maskedEmail|null, roles[], permissions }`.
`maskedEmail` (`u***@e***.org`) es `null` si el acceso no es un correo. Orden por nombre e id (keyset).
`source: "SIMULATED"` es una marca **sólo del simulador**; la API real no la envía y el aviso «Datos simulados» desaparece solo.

## Estados (M34)

- Vacío con filtro: «Quitar el filtro». Vacío sin filtro: «Ver los usuarios internos».
- Error: estado S9 estándar con ID de petición. **403 `TENANT_REQUIRED`** se muestra como prohibido (S5), no como lista vacía.
- Cargando / reintento: los de `app-data-table`.
- Se quitó el estado «parcial» por tipo: la API no lo informa. Si E lo añade, hay que volver a contratarlo.

## Privacidad

El cliente copia sólo los campos de la lista blanca y descarta cualquier extra (hash, documento, teléfono). Un correo sin `*` no se muestra.
La API sella cada consulta en `audit.audit_log` (lectura de PHI): el front no pide más de lo que muestra.

## Lo que el front NO decide (pendiente de E / producto)

1. **Estado de la cuenta**: llega como uuid de concepto y el front no tiene el value set; se muestra «Concepto …xxxx», sin inventar etiquetas, y no se expone el filtro `status`. Hace falta que la API publique las etiquetas (o un catálogo) para traducirlo.
2. Reglas de tipo (E #1408): `PRACTITIONER` = rol global o perfil de profesional; `LABORATORY` = membresía en organización `DIAGNOSTIC_CENTER`; «Profesionales» y «Laboratorios» son rótulos del front para esos supuestos.
3. `displayName` de pacientes completo o iniciales: se muestra como llega.
4. Gestión de roles desde esta lista para no internos: sólo `INTERNAL` abre el cajón de asignaciones.
5. Hallazgo de seguridad de E (#1406): `POST /iam/users/search` y `GET /iam/users/:id` no recortan por organización; el cajón de esta pantalla usa `GET /iam/users/:id` para nombrar a quien no está en la lista.

## Brechas de gates (archivos compartidos, fuera del alcance de G; no se tocaron)

- `scripts/contracts/admin-portal-known-gaps.json` (o el OpenAPI refrescado): falta `GET /authz/users/directory` → `check-admin-portal-contract` la marca. E no regeneró `openapi/**` (choca con #1370, ver #1408).
- `docs/integrations/backend-api.md`: operación sin documentar → `check-api-contract-drift` la marca.
