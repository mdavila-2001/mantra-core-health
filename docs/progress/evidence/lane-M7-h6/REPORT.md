# Reporte - H6 - Organizacion, clinica extendida y contrato de calidad (BR-28/BR-29/BR-30) - M7 - Lenovo Legion (front)

> AVANCE: 3/8 hallazgos con algo entregado (CV-21 doc, AG-44 tipo+formulario, TX-14 infra de nginx). El resto de
> BR-28/BR-29 (6 hubs de administracion, derivaciones, teleconsulta, Mi cobertura, /billing real) y CV-25/TX-24/
> TX-25/TX-27 quedan NO CUBIERTO o BLOQUEADO, documentados con causa en DECISIONS.md.
> Peldano alcanzado: TESTED (typecheck + lint + specs unitarios de lo tocado, en verde). No hay evidencia de
> navegador (visual-quality-gate) porque no se construyo ninguna pantalla nueva en esta sesion: los cambios son
> tipo, formulario existente y config de nginx.

- Fecha: 2026-09-26 - Maquina: M7 - Lenovo Legion - Plan: docs/trabajo/2026-09-26-h6-organizacion-clinica-calidad/PLAN.md
  - Decisiones: docs/progress/DECISIONS.md (seccion "H6")
- Rama: legion/test-h6-organizacion-calidad, desde origin/test, PR contra test
- Compuertas: corepack yarn typecheck exit 0 - eslint sobre los archivos tocados exit 0 - specs de
  catalog-object-detail 8/8 en verde

## Completado

| ID | Que se logro (observable) | Comando | Resultado |
|---|---|---|---|
| H2 (CV-21) | ESTADO-FRONTEND.md deja de decir sin matices "nada esta simulado": aclara que eso es cierto bajo production-api/real-api y que ng serve por defecto sigue en mockBackend true | lectura del documento | Corregido, sin reescribir el resto (es una foto fechada) |
| H2 (AG-44) | AnnotationPatch (tipo) suma processSupported, sourceOfTruth y producers; annotation-dialog.ts agrega una pagina "Procedencia" al formulario paginado existente, con producers editado como texto separado por comas | corepack yarn typecheck; corepack yarn test --include=".../object-detail/catalog-object-detail.spec.ts" | typecheck limpio; 8/8 specs existentes en verde (no se rompio nada) |
| H2 (TX-14, infra) | deploy/api-proxy.conf fija X-Request-Id: $request_id hacia la API, para que el genReqId de la API (ver DECISIONS.md de la API) tenga un id de nginx que respetar detras de TRUST_PROXY_HOPS | lectura del archivo | Agregado; sin tocar deploy/nginx.conf (ver DECISIONS.md, razon documentada) |

## A medias

Ninguna: lo que se toco quedo completo (tipo + formulario + config), no hay piezas sueltas.

## Pendiente

| ID | Estado | Que lo destraba |
|---|---|---|
| BR-28 (6 hubs de administracion: delegated-access, auth-providers, identity-assurance, health-context) | NO CUBIERTO | Pantallas nuevas completas (listado + DataTable + 9 estados M34 + visual-quality-gate); la API ya expone 2 de los 6 listados (ver reporte de la API) |
| BR-28 (bandeja de aprobacion en organization-panel.ts, CV-14) | NO CUBIERTO | Wiring de UI sobre GET /practices/:id/role-assignments, ya disponible en la API |
| BR-29 (Mis derivaciones, Mi cobertura, /billing real) | NO CUBIERTO | Pantallas nuevas; la API ya expone las 3 lecturas (referrals/me, patient-coverages/me, billing/invoices) |
| CV-25 (geolocalizacion fuera del menu) | NO CUBIERTO, investigado | canMatch + marca "fuera del menu de lanzamiento" que no dependa de borrar la seccion del registro que tambien genera las rutas; riesgo sobre navigation.service.spec.ts/access-tree.spec.ts sin presupuesto de esta sesion para hacerlo con el gate visual correspondiente |
| TX-24 (CI del front) | BLOQUEADO | El propio CLAUDE.md del repo declara el CI caido; no hay runner en este sandbox |
| TX-25 (suite real e2e) | BLOQUEADO | Requiere el artefacto production-api + nginx + Postgres con seeds levantado; fuera del presupuesto de RAM/tiempo |
| TX-27 (N+1, 5 pantallas) | NO CUBIERTO | La API no genero lecturas en lote en esta sesion (ver reporte de la API); sin eso, nada que consumir del lado del front |

## Evidencia

- typecheck: corepack yarn typecheck en verde (0 errores) tras corregir env.generated con
  node scripts/generate-env.mjs (archivo generado, no versionado).
- eslint sobre annotation-dialog.ts y data-catalog.types.ts: 0 problemas.
- corepack yarn test --watch=false --include=".../object-detail/catalog-object-detail.spec.ts": 8/8 en verde.

## No cubierto

- Las 6 pantallas de hubs de administracion (BR-28) y las 4 franjas clinicas de BR-29 (derivaciones,
  teleconsulta, Mi cobertura, /billing): ninguna pantalla nueva. El contrato de API para 6 de esas lecturas ya
  esta listo (ver el reporte de mantra-core-health-api).
- CV-25 (geo), TX-24 (CI), TX-25 (e2e real), TX-27 (N+1): ver seccion Pendiente.

## Desvios del plan

- El plan de la sesion preveia al menos wiring de datos (clientes) para los 6 endpoints nuevos de la API; se
  recorto a los 3 cambios de menor riesgo (doc, tipo+formulario existente, config de nginx) para no construir UI
  nueva sin pasar por visual-quality-gate ni arriesgar los ~4985 tests del repo con cambios de navegacion sin
  verificar.

## Riesgos residuales

- ESTADO-FRONTEND.md sigue siendo una foto historica (2026-08-01): la correccion de esta sesion es puntual, no
  una actualizacion completa.

## Decisiones y ambiguedades

Ver docs/progress/DECISIONS.md, seccion "H6 (BR-28/BR-29/BR-30)".
