# Contrato — Visibilidad de la interfaz y RBAC granular por módulo

Fecha 2026-10-31 · Pedido del usuario: catalogar los elementos de la interfaz por módulo, definir
reglas de mostrar/ocultar por rol/usuario/organización y que afecten a **todo** el usuario; RBAC al
mayor nivel de granularidad, por módulo.

## Principio (no negociable)
**La visibilidad NO es autorización.** Ocultar un elemento no protege nada: la API autoriza cada
petición (RBAC/PDP). La visibilidad decide qué se *presenta*; nunca concede acceso. Un elemento
oculto cuyo endpoint sigue permitido se puede llamar, y eso es correcto: la seguridad vive en authz.

## Catálogo (primero se cataloga, después se regla)
Un elemento sólo puede tener reglas si existe en el catálogo.
- `key` estable, en minúsculas con puntos: `<modulo>.<pantalla>.<elemento>` (ej. `pharmacy.orders.export-button`).
- `kind`: `MODULE | MENU_SECTION | SCREEN | SECTION | WIDGET | FIELD | ACTION`.
- `parentKey`: jerarquía. **Ocultar un padre oculta a todos sus descendientes.**
- `source`: `CODE` (registrado desde el registro del front, vía sync) | `ADMIN` (alta manual).
- `defaultVisible` (true por omisión). Sin regla aplicable, gana el valor por omisión.
- Elementos `CODE` que desaparecen del registro pasan a `status = RETIRED` (no se borran; las reglas se conservan).

## Reglas
`effect: SHOW | HIDE` sobre un `elementKey`, para un sujeto:
`subjectType`: `USER | TENANT | ROLE | ORG_TYPE | ALL` (+ `subjectId`, null sólo en ALL).
Vigencia opcional (`validFrom`, `validTo`), `reason` obligatorio (10–500), `version` (bloqueo optimista).
Las reglas no se borran: se **terminan** (`validTo = ahora`) y quedan en la auditoría.

### Resolución (determinista)
1. Se toman las reglas vigentes que aplican al usuario (por su id, su organización, sus roles activos, el tipo de su organización, ALL).
2. Especificidad: `USER` > `TENANT` > `ROLE` > `ORG_TYPE` > `ALL`. Gana la más específica.
3. Empate de especificidad: **HIDE gana a SHOW**. Entre varios ROLE del mismo usuario también.
4. Sin regla: `defaultVisible`.
5. Cascada: si un ancestro resuelve a oculto, el descendiente queda oculto aunque tenga SHOW propio.

## Endpoints (API)
Admin (rol `SECURITY_ADMIN`; `SUPERADMIN` por comodín; el resto 403; `@Audited` en mutaciones; tenant scoping según authz):
- `GET  /admin/ui-visibility/elements?module=&kind=&q=&status=&cursor=&limit=`
- `POST /admin/ui-visibility/elements` (alta manual, source ADMIN)
- `POST /admin/ui-visibility/elements/sync` body `{ elements: UiElementDraft[] }` — idempotente por `key`.
- `GET  /admin/ui-visibility/rules?elementKey=&subjectType=&subjectId=&active=&cursor=&limit=`
- `POST /admin/ui-visibility/rules` · `PATCH /admin/ui-visibility/rules/:id` (header `If-Match: <version>`) · `POST /admin/ui-visibility/rules/:id/end`
- `GET  /admin/ui-visibility/preview?userId=` o `?roleCode=` → ocultos + regla ganadora de cada uno.
Usuario:
- `GET /me/ui-visibility` → `{ hiddenKeys, version, generatedAt }` (sólo lo oculto: lo demás es visible).
Errores estables: `UI_ELEMENT_NOT_FOUND` (404), `UI_ELEMENT_RETIRED` (409), `UI_RULE_VERSION_MISMATCH` (409),
`UI_RULE_DUPLICATE` (409, misma terna elemento+sujeto vigente), `UI_RULE_INVALID_SUBJECT` (422).

## Front
- Tipos compartidos: `src/app/core/data-access/ui-visibility/ui-visibility.types.ts` (solo lectura para todos).
- `core/visibility/`: servicio con señales, carga tras el login y al cambiar de sesión, caché con `version`; directiva
  `*appVisible="'key'"`; guarda de ruta; filtro del menú. Falla ABIERTO sólo para presentación: si `/me/ui-visibility`
  falla, no se oculta nada (la API sigue autorizando) y se registra el estado.
- Portal admin (`superadmin/portal/governance/…`): «Catálogo de visibilidad» y «Reglas de visibilidad», con vista previa «ver como».

## RBAC granular por módulo
- Cada módulo tiene su conjunto de permisos con la forma `<modulo>.<recurso>.<acción>`; acciones canónicas:
  `read, list, create, update, delete, export, approve, reject, assign, configure, audit`. (Sólo las que el módulo realmente ofrece.)
- `GET /authz/catalog/modules` → por módulo: permisos, acciones cubiertas, roles que los tienen y **huecos**
  (rutas de controlador con `@Roles` grueso y sin permiso fino).
- Matriz «Roles × Módulos × Acciones» editable en el portal admin, sobre `PUT /authz/roles/:id/permissions` existente.
