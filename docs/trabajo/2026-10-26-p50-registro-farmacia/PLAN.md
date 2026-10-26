# Plan — P50: el registro público de farmacia, de punta a punta

- Fecha: 2026-10-26 · Repos afectados: mantra-core-health-model, mantra-core-health-api, mantra-core-health
  · Predecesor: `1689bea4` (dev) — el alta ya aceptaba `organization.pharmacy`, creaba `directory.branches` y la
  fila de `pharmacy.pharmacies` en borrador; la verificación de la plataforma ya la activaba.
- Resultado observable: una farmacia se registra sola desde `/auth/register/pharmacy` contra la API real; en la
  misma transacción quedan tenant + owner + `pharmacy.pharmacies` + la casa central y cada sucursal como sede de
  práctica y sede dispensadora (`pharmacy.pharmacy_sites`), con la central enlazada en
  `pharmacies.primary_practice_site_id`; la plataforma no puede dejarla operativa (verificarla) sin los seis papeles
  y el punto de la central, y la farmacia puede completar los papeles después del alta.
- Kill-test: `POST /iam/auth/register-organization` con el cuerpo exacto que arma `IamClient.registerPharmacyOrganization`
  devuelve 400 (`taxIdentifier` no declarado) o 422 (falta el poder) — hoy pasa eso.

## Alcance
- IN: modelo (`diagram_24` + DDL + parche v4252), API (DTO de alta, `IamOrganizationSelfRegistrationService`,
  `TenantTypeProfileService.assertProfileMatchesType`, `PharmacyProvisioningService` nuevo, puerto/adaptador de iam,
  verificación de tenant, endpoint para completar papeles, lectura de requisitos, OpenAPI), frontend (cliente
  `registerPharmacyOrganization`, simulador `auth.handlers.ts`, tipos), tests unitarios + integración real.
- OUT: la pantalla «Ficha» donde la farmacia sube los papeles que le faltan (el endpoint queda listo, la UI no es
  de este P); el alta de laboratorio (P51); catálogo (P47) y disponibilidad por sucursal (P37); notas de la bóveda
  (repo compartido, no se edita: el catálogo ORM `orm:catalog` no se regenera).
- Ambigüedades registradas (decididas por el agente, ver «Decisiones» del reporte):
  1. ¿Los 6 PDF y el SEDES se exigen para registrarse o para operar? → para **operar** (D2 se mantiene).
  2. ¿El representante de farmacia necesita cédula? → se mantiene obligatoria (el front ya la pide).
  3. ¿Qué es «operar»? → pasar a `PHARMACY_ACTIVE` por la verificación de la plataforma.

## H1 — La farmacia nace completa en una transacción
**CA:** Dado el cuerpo del front, cuando se registra una farmacia, entonces responde 201 con `pharmacyId` y en la
base existen la farmacia en borrador, la práctica, una sede de práctica por sitio declarado, una `pharmacy_sites`
por sitio y `primary_practice_site_id` apuntando a la central; si algo falla no queda nada.
**DoD:** unit specs de iam/pharmacy en verde · integración `pharmacy-registration.int-spec.ts` contra `mantra_p50`.
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H1.S1.M1 | Columna `pharmacies.primary_practice_site_id` en el modelo | `\d pharmacy.pharmacies` la muestra con FK | `gen_ddl.py all` + parche aplicado 2 veces | HECHO |
| H1.S1.M2 | Entidad regenerada con `gen_entities.py 24` | diff sólo de la propiedad nueva | `git diff --stat` | HECHO |
| H1.S2.M1 | DTO: `organization.taxIdentifier`, `pharmacy.address` | el cuerpo del front no da 400 | integración escenario 1 | HECHO |
| H1.S2.M2 | `pharmacy` sólo para PHARMACY | otro tipo con `pharmacy` → 422 | unit `tenant-type-profile` + integración | HECHO |
| H1.S2.M3 | Poder opcional en el alta de farmacia | rep. sin poder → 201 | unit self-registration | HECHO |
| H1.S3.M1 | `PharmacyProvisioningService` (práctica, sedes, pharmacy_sites, central) | filas creadas | unit spec del servicio | HECHO |
| H1.S3.M2 | El alta usa el servicio y devuelve `pharmacyId` | respuesta trae el id | integración escenario 1 | HECHO |

## H2 — No opera sin papeles
**CA:** Dada una farmacia registrada sin SEDES, cuando la plataforma la verifica, entonces 422 `missing` nombra lo
que falta y nada cambia; cuando el owner sube lo que falta, la verificación la activa y los papeles quedan
VERIFICADO.
**DoD:** unit specs + integración escenarios 3–6 (incluido negativo de autorización: otro usuario → 403).
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H2.S1.M1 | Requisitos de operación (función + servicio) | lista exacta de faltantes | unit spec | HECHO |
| H2.S1.M2 | Gate en `POST /admin/tenants/:id/verification` | farmacia incompleta → 422 | integración | HECHO |
| H2.S2.M1 | `POST /tenants/:id/affiliation-documents` | owner completa papeles; ajeno → 403 | integración | HECHO |
| H2.S2.M2 | `GET /tenants/:id/pharmacy-readiness` | `{ ready, missing }` | integración | HECHO |
| H2.S3.M1 | OpenAPI regenerado | spec incluye las rutas nuevas | `yarn openapi` | HECHO |

## H3 — El front contra la API real
**CA:** El cliente manda `pharmacy.address`, el simulador sirve el mismo contrato (incluye `pharmacyId`), sin
notas de relajación obsoletas.
**DoD:** specs del cliente, del simulador y del componente en verde.
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H3.S1.M1 | Cliente `registerPharmacyOrganization` | cuerpo con `pharmacy.address` | `iam.client.spec` | HECHO |
| H3.S1.M2 | Simulador y tipos (`pharmacyId`) | handler devuelve `pharmacyId` | `auth.handlers.pharmacy.spec` | HECHO |

## Riesgos y bloqueos previstos
| Riesgo | Impacto | Mitigación |
|---|---|---|
| P51 toca el mismo servicio de alta | conflicto en el merge | cambios acotados a ramas `PHARMACY` |
| P37 modela sucursales de farmacia | doble modelo de sucursal | `pharmacy_sites` es lo que P37 necesita para stock por sede |

## Microtareas agregadas en ejecución
| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H2.S1.M3 | (revisión de seguridad) autorizar con `roleAuthorizesInTenant` + membresía y antes de buscar el tenant | rol acotado a otro tenant → 403; tenant inexistente sin permiso → 403 | unit `tenant-document-completion` + integración 3.3b | HECHO |
| H1.S3.M3 | (pedido de P47) categorías por defecto en la farmacia del alta | 6 filas en `pharmacy_product_categories` | unit `pharmacy-provisioning` + integración escenario 1 | HECHO |
