# Plan — Completar el directorio de pacientes

- Fecha: 2026-10-05 · Repos: mantra-core-health, mantra-core-health-api · Predecesor: ramas marcelo/insurer-patient-directory-dev y -test.
- Resultado observable: administración autorizada y aseguradoras encuentran pacientes y abren su conversación interna en /administration/insurance-patients.
- Kill-test: aseguradora A no recibe un paciente cubierto exclusivamente por B por búsqueda, conteo ni conversación.

## Alcance
- IN: integrar bases origin/dev y origin/test en sus ramas existentes; completar controlador/DTO/servicio/query del directorio, integración mínima de comunidad, cliente/tipos/UI/rutas de acceso, pruebas dirigidas, OpenAPI y evidencia.
- OUT: migraciones no justificadas, cambios generales de mockup, alta/edición/exportación de pacientes, canales externos, deploy, merge a integración.
- Decisiones confirmadas: género administrativo; OWNER/ADMIN e INSURANCE_OPERATOR limitados a cobertura vigente; SECURITY_ADMIN/SUPERADMIN mantienen padrón autorizado; todas las aseguradoras activas autorizadas sin duplicados. Pacientes sin cobertura sólo accesibles al padrón administrativo.
- Se conservan archivos locales ajenos sin incluirlos en commits.

## Contrato acordado
- POST /insurance/patients/search body: {search?, genderConceptId?, occupation?, birthDateFrom?, birthDateTo?, insuranceCarrierId?, insuranceStatus?: ALL|WITH_INSURANCE|NO_INSURANCE, cursor?, limit?:10|25|50, sortBy?, sortDirection?}. Default 25; nombre asc con desempate por id. Filtros AND; fechas civiles inclusivas; rango invertido 400.
- Respuesta: {items, total, limit, nextCursor}. Item: {patientProfileId, fullName, birthDate?, age?, phone?, email?, genderCode?, occupationDisplay?, insurers: [{id,name}], messaging:{channel:'internal',available:boolean}}. Sin documento, afiliación, póliza, slug ni identificadores de perfiles de comunidad. Ausencia de seguro = insurers vacío.
- GET /insurance/patients/options: {insurers:[{id,name}]} autorizado y acotado. Género usa catálogo dinámico existente.
- POST /insurance/patients/conversation body {patientProfileId,channel:'internal'} -> {conversationId}. Revalida acceso y vigencia, resuelve actor/destinatario, respeta comunidad, reutiliza conversación, no envía mensajes.
- Búsqueda y filtros sólo en memoria de sesión y body HTTP. Sin datos sensibles en URL, logs, SSR transfer cache ni almacenamiento persistente.
- Frontend: debounce existente 300ms, cancelación anterior, contador total, chips removibles, limpiar filtros; paginación por cursor 10/25/50; retry conserva filtros. Siete columnas, fecha DD/MM/AAAA (N años), etiquetas completas, correo copiable, chat junto al teléfono. Tarjetas <1024px. M34 con mensajes solicitados, skeleton y acciones accesibles.

## H1 — Bases actualizadas
**CA:** Dadas las ramas existentes, cuando se integra su base, entonces conservan el directorio y contienen el último commit de integración.
**DoD:** git merge-base --is-ancestor origin/<base> marcelo/insurer-patient-directory-<base> -> 0; build de cada variante.
**Estado:** HECHO
### H1.S1 — Integración local
**CA:** Dada cada base, cuando se comprueba ascendencia, entonces está incorporada sin conflictos.
**DoD:** git merge-base --is-ancestor -> 0.
**Estado:** HECHO
| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H1.S1.M1 | Integrar dev | Dada dev, al comprobarla, es ancestro de la rama de trabajo | git merge-base --is-ancestor origin/dev HEAD -> 0 | HECHO |
| H1.S1.M2 | Integrar test | Dada test, al comprobarla, es ancestro de la rama test | git merge-base --is-ancestor origin/test marcelo/insurer-patient-directory-test -> 0 | HECHO |

## H2 — Directorio completo
**CA:** Dado un actor autorizado, al buscar y contactar, recibe sólo datos permitidos y abre el hilo correcto.
**DoD:** pruebas dirigidas de API y frontend PASS.
**Estado:** HECHO
### H2.S1 — API y contrato mínimo
**CA:** Dada una consulta, al resolverla, filtros/conteo/página aplican el mismo alcance.
**DoD:** yarn test --runInBand insurer-patients -> PASS.
**Estado:** HECHO
| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H2.S1.M1 | Consulta y opciones autorizadas | Dado un actor ajeno, al buscar, no obtiene datos ajenos | yarn test --runInBand insurer-patients -> PASS | HECHO |
| H2.S1.M2 | Abrir conversación | Dado un paciente permitido, al abrir dos veces, recibe el mismo hilo | yarn test --runInBand insurer-patients -> PASS | HECHO |
| H2.S1.M3 | Contrato OpenAPI | Dada la spec, al inspeccionarla, declara POST y sólo campos mínimos | prueba de contrato del directorio -> PASS | HECHO |
### H2.S2 — Interfaz
**CA:** Dados datos, al operar filtros y chat, muestra estados correctos en todos los anchos.
**DoD:** yarn ng test --watch=false --include '**/insurance-patients.spec.ts' -> PASS.
**Estado:** HECHO
| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H2.S2.M1 | Cliente POST mínimo | Dada una búsqueda, al enviar, los filtros sólo viajan en body | prueba insurance.client.spec -> PASS | HECHO |
| H2.S2.M2 | Filtros y estados | Dados cambios rápidos, al completarlos, se muestra sólo la respuesta vigente | prueba insurance-patients.spec -> PASS | HECHO |
| H2.S2.M3 | Tabla y tarjetas | Dado un ancho móvil, al renderizar, el chat es primario en cada tarjeta | Playwright directorio -> PASS | HECHO |

## H3 — Evidencia e integración final
**CA:** Dado el stack real sintético, al recorrerlo, cumple los criterios y no expone pacientes ajenos.
**DoD:** API integration y Playwright PASS; lint/typecheck/build seriales, revisión visual doble independiente; reporte literal.
**Estado:** A MEDIAS
### H3.S1 — Verificación
**CA:** Dadas ambas variantes, al verificarlas, el reporte distingue lo comprobado de lo pendiente.
**DoD:** comandos y salidas en evidencia; REPORTE.md.
**Estado:** A MEDIAS
| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H3.S1.M1 | Gates y regresión | Dado el código final, al compilar/probar, pasa | yarn lint; yarn typecheck; yarn build; pruebas dirigidas -> 0 | A MEDIAS |
| H3.S1.M2 | Recorrido real y privacidad | Dado actor A, al solicitar paciente B, no obtiene acceso | integración + Playwright con API real -> PASS | HECHO |
| H3.S1.M3 | Revisión visual | Dadas capturas, al revisar dos veces, no quedan hallazgos bloqueantes | evidencia/doble-revision.md -> APROBADA | HECHO |
| H3.S1.M4 | Propagar a test | Dada la corrección dev, al aplicarla en test, conserva diferencias de base | diff de archivos del directorio y gates -> PASS | A MEDIAS |

## Riesgos y bloqueos previstos
| Riesgo | Impacto | Mitigación |
|---|---|---|
| Bases difieren | Conflictos y regresión de comunidad | Merge sin reescritura; revisar archivos coincidentes; productores antes de consumidores |
| Stack local ausente | No se puede afirmar integración real | Inspeccionar herramientas/puertos; datos sintéticos; aislar dobles declarados sin afirmar E2E real |
| PHI en logs o respuestas | Exposición indebida | DTO allowlist, POST, auditoría por ids, pruebas negativas |
| Pruebas previas exigen semántica antigua | Assertions incompatibles | Actualizar assertions a requisitos confirmados conservando cobertura; nunca skip/only |
## Ajustes de verificación observados
- H3.S1.M5 — Publicar ambas ramas y dejar PR revisables. CA: dadas las variantes, al abrir sus PR, contienen la base actual, no tienen conflictos y el estado de CI es explícito. DoD: push no force; gh pr view --json isDraft,mergeable,mergeStateStatus; gh pr checks después del último push; fuera de draft y checks sin pendientes para entrega completa. Estado: A MEDIAS. No se mergea ni se despliega. Runner self-hosted offline es bloqueo externo documentado.
- Bases remotas avanzaron durante QA: se incorporaron origin/dev y origin/test actualizadas mediante merge sin conflictos; preservar variantes.
- El área disponible junto al sidebar puede ser menor a1024px aunque el viewport sea mayor: usar tarjetas también por ancho del contenedor; defecto de Seguro oculto cerrado con recapturas.
- Pruebas UI interceptadas declaradas @ui-mock; recorrido adicional @real-directory exige API y persistencia reales con fixtures sintéticas y trazas desactivadas.


## Cierre de verificación
- Directorio verificado con API y PostgreSQL reales en dev y test; chat persistido y revocaciones comprobados. La entrega global permanece A MEDIAS: gates heredados y CI externo, detallados en REPORTE.md. No se modifican permisos de reclamos ni contratos públicos ajenos para forzar gates verdes.
