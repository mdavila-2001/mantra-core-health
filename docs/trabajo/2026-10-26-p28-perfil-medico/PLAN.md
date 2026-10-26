# Plan — P28: el perfil del médico llega a los campos de su registro

- Fecha: 2026-10-26 · Repos afectados: mantra-core-health-api, mantra-core-health (front) · Predecesor: P32/P33 (consultorio propio, `isOwnSite`)
- Resultado observable: el médico, desde «Editar mi perfil», lee y corrige sexo al nacer, número de
  documento + departamento emisor y correo de trabajo, y al recargar ve lo guardado. Un administrador de
  plataforma puede hacer la misma corrección sobre el perfil de otro; nadie más.
- Kill-test: `PATCH /profiles/practitioners/me {"nationalId":"..."}` responde 400
  (`property nationalId should not exist`), o el editor del front sigue diciendo «no se corrige desde el perfil».

## Descubrimiento (hechos, contra `origin/dev`)
- `UpdateOwnPractitionerProfileDto` YA acepta `sexAtBirth`, `issuerAdministrativeAreaConceptId` y `workEmail`
  (`src/modules/profiles/presentation/dto/update-practitioner-profile.dto.ts`); el servicio los escribe
  (`profiles-practitioners.service.ts`, `updateOwnPractitionerProfile`, `fixIssuance`, `replaceContact`).
- La lectura propia YA devuelve `sexAtBirth`, `nationalId`, `issuerAdministrativeAreaConceptId`, `workEmail`.
- El front YA edita sexo al nacer, departamento y correo de trabajo (`practitioner-profile-edit.ts`).
- Falta: el **número** del documento (el DTO lo excluye a propósito: «tiene su circuito de verificación»).
- Falta: una ruta para que la plataforma (`SECURITY_ADMIN`/`SUPERADMIN`, los roles que ya editan perfiles vía
  `ProfileOwnershipService`) corrija el perfil de otro profesional.
- Esquema: `common.identifiers.value` existe, sin índice único → **sin cambio de modelo**.
- El login del profesional es el correo (`externalSubject: dto.email`), no la CI: corregirla no toca la cuenta.
- «Identidad verificada» = aserción vigente en `identity_assurance.identity_assertions`
  (`personRecords.hasCurrentIdentityAssertion`).

## Alcance
- IN: DTO de escritura (`nationalId`), servicio (corrección del número + ruta de plataforma), controlador,
  lectura propia (`identityVerified`), error-reason nuevo, tests unitarios + integración, OpenAPI regenerado;
  front: cliente, tipos, simulador, editor del perfil, tests.
- OUT: modelo/patch (no hace falta columna), correo del paciente, documento del paciente, matrícula (P29),
  teléfono/horario de la sede (anotado en P32).
- Decisiones (sin respuesta posible esta noche, ver REPORTE):
  1. El número se corrige mientras la identidad NO está verificada; con aserción vigente → 409
     `NATIONAL_ID_LOCKED_BY_VERIFIED_IDENTITY`. Alternativa descartada: siempre editable (rompe lo verificado).
  2. ~~Se edita la fila vigente en el lugar~~ → corregido tras la revisión de seguridad: se cierra la
     fila vigente (`valid_to`) y se abre otra, para no alterar lo que apunta a la vieja
     (`tenant_legal_representatives.ci_identifier_id`, `tenant_affiliation_documents.identifier_id`).
  5. 409 también con un caso de verificación de identidad no terminal (revisión de seguridad).
  3. Correo de trabajo: se mantiene editable como contacto (ya lo era); no es credencial de acceso.
  4. Ruta de plataforma `PATCH /profiles/practitioners/:profileId` con el mismo DTO, autorizada por
     `assertOwnsPractitionerProfile` (titular o plataforma).

## H1 — API
**CA:** Dado un médico sin identidad verificada, cuando manda `nationalId`, entonces la lectura siguiente lo
devuelve corregido; con identidad verificada recibe 409; otro médico sobre `:profileId` ajeno recibe 403.
**DoD:** unit + integración contra `mantra_p28` + typecheck + lint dirigido. **Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H1.S1.M1 | DTO acepta `nationalId` con el formato del alta | DTO spec: válido pasa, `''`/caracteres raros fallan | `yarn test …dto.spec` | HECHO |
| H1.S1.M2 | Servicio corrige el número / 409 si verificado | spec del servicio | `yarn test profiles-practitioners.service` | HECHO |
| H1.S1.M3 | Ruta de plataforma + `identityVerified` en lectura propia | spec del servicio | `yarn test src/modules/profiles` | HECHO |
| H1.S1.M4 | (revisión de seguridad) 409 también con caso de verificación abierto | spec + integración | `yarn test` + int-spec | HECHO |
| H1.S1.M5 | (revisión de seguridad) cerrar y abrir la fila, no mutar el número en el lugar | spec + integración (fila vieja intacta) | `yarn test` + int-spec | HECHO |
| H1.S2.M1 | Integración real: corrige, relee, 400, 403, 401, plataforma, caso abierto 409, verificada 409 | int-spec verde | `yarn test:integration <archivo>` | HECHO |
| H1.S3.M1 | OpenAPI + referencia de endpoints regenerados | `EXIT=0` | `yarn docs:openapi:generate` | HECHO |

## H2 — Frontend
**CA:** En «Editar mi perfil», el número del documento es un campo editable (sólo lectura con aviso si la
identidad está verificada) y guardar manda `nationalId` sólo si cambió.
**DoD:** vitest dirigido del editor y del cliente + typecheck + lint. **Estado:** HECHO (sin prueba visual)

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H2.S1.M1 | Tipos + simulador sirven el contrato (`nationalId`, `identityVerified`) | spec del handler | `yarn ng test --include …handlers.spec` | HECHO |
| H2.S1.M2 | Editor: campo de documento editable/bloqueado, envío del diff | spec del editor | `yarn ng test --include …practitioner-profile-edit.spec` | HECHO |
| H2.S1.M3 | Catálogo de claves del simulador regenerado desde el OpenAPI | `--check` limpio | `node scripts/gen-mock-contract.mjs` | HECHO |

## Riesgos
| Riesgo | Impacto | Mitigación |
|---|---|---|
| P29 toca el mismo módulo `profiles` | conflicto de merge | cambios acotados, merge en push |
| Prueba visual sin navegador | sin evidencia visual | declarado en «No cubierto» |
