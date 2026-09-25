# C0 — Contrato primero · Marcelo · 2026-09-25

Estado: EN CURSO. Peldaño de contratos/handlers/componentes: TESTED (757 tests dirigidos aprobados). Runtime y publicación pendientes; cobertura global bloqueada.

## Base y decisiones aprobadas

- Base: `origin/mockup` @ `9b8bc46e3f92be7bf80b64b2014cdaf4b86b9796`.
- Rama: `marcelo/feat-clinica-c0-contrato-primero`; worktree `wt-clinica-c0`; puerto exclusivo 4210.
- Contrato de referencia: `AlovidaPromptManager/docs/trabajo/2026-09-25-plan-y-reparto-encuentro-clinico/PLAN-MAESTRO.md`, secciones 3 y 6.
- El usuario aprobó conservar análisis y reconsulta funcionales; solo Nota médica será stub C1.
- El usuario aprobó contrato canónico de cuatro estados y adaptación de C6 conservando tres grupos visuales.
- Publicación: rama y PR a mockup, sin push directo ni merge; aviso en PR y daily con SHA.
- Yarn 4, `nodeLinker: node-modules` existente. Dependencias reutilizadas mediante junction tras comprobar igualdad de yarn.lock; sin instalar ni modificar dependencias.
- Servidor: `corepack yarn dev --port 4210`; `start` es SSR compilado.
- Estándar fusionado sin sobrescribir: 183 skills, 15 reglas, `plan_gate self-test: 11 PASS, 0 FAIL`.
- No backend real; solo simulador y cuentas sintéticas declaradas. Ningún dato clínico real en evidencia.

## Alcance cerrado

Tipos clinical/chart-notes/diagnostics/scheduling; conceptos; handlers clinical/diagnostics/index y nuevos medical-notes/diagnosis-verification; specs mock dirigidos; shared/clinical/diagnosis-state y spec; history-view-model.ts y spec (C6); consultation/**; rename diagnostics-block a analysis-order-block con subdirectorio; specialty-form-block imports/selectores; nuevo medical-note-block; follow-up-block existente (preservar); comentario en misc.handlers e insurance-claim-detail; playwright/consulta-rejilla.spec.ts; scripts/pw-guard.mjs; docs/testing/pw-guard.md; ADR-0016 e índice; glosario; README/c0/**; inventarios derivados; .gitignore solo artifacts/pw-guard. Stock generado ignorado, no forzar su versionado.

Excepción mecánica H3: exportar avisarFichaAlPaciente y reutilizar el mismo Set, evitando duplicar notificaciones. H4: output cambio de análisis tras guardado exitoso. Nombres contractuales existentes se conservan; identificadores nuevos en inglés.

Fuera: C1/C2/C3 completos, API, modelos, migraciones, limpieza transversal de lint y funcionalidades nuevas ajenas. No borrar ni debilitar tests; corregir expectativas solo cuando cambió el contrato aprobado, conservando los escenarios.

## Hitos, subtareas y microtareas (21)

Los IDs originales C0.Hn.Mm corresponden a C0.Hn.S1.Mm. Estados: TODO, EN CURSO, HECHO, A MEDIAS, BLOQUEADO, DESCARTADO.

| ID | Cambio / CA (Dado / Cuando / Entonces) | DoD (comando u observación) | Estado |
|---|---|---|---|
| C0.H1.S1.M1 | Dada mockup / al aislar y medir / hay SHA, estándar y baseline preservado | lint, typecheck y tests mock/clínica en evidencia/antes con exit literal | HECHO |
| C0.H1.S1.M2 | Dado el contrato / al leer ADR-0016 / explica encuentro, límites y pendientes | node scripts/check-doc-links.mjs | TODO |
| C0.H1.S1.M3 | Dados nombres del dominio / al consultar glosario / hay UI, código, contrato y nombres retirados | check-doc-links y README de coordinación | TODO |
| C0.H2.S1.M1 | Dados los value sets / al expandir / aparecen ACT-FOLLOW-UP, APT-RECONSULTA, SRQ-OTHER | terminology.handlers.spec.ts verde | HECHO |
| C0.H2.S1.M2 | Dados ChartNote y entradas / al tipar entries / aceptan pares readonly label/value | corepack yarn typecheck | HECHO |
| C0.H2.S1.M3 | Dadas órdenes / al tipar / category y basedOnNoteIds son opcionales; PatientOrder incluye category | corepack yarn typecheck | HECHO |
| C0.H2.S1.M4 | Dada Condition / al tipar verification / coincide con §3.4 y P41 | corepack yarn typecheck | HECHO |
| C0.H2.S1.M5 | Dada C4 integrada / al completar contrato / followUpOf y extensiones siguen compatibles | scheduling client y follow-up-block specs verdes | HECHO |
| C0.H2.S1.M6 | Dados ocho escenarios / al clasificar / estado canónico correcto y tres grupos C6 conservados | shared/clinical + history-view-model specs verdes con reloj fijo | HECHO |
| C0.H3.S1.M1 | Dadas tres rutas de notas / al trasladarlas / mantienen respuestas, versiones y aviso único | clinical.handlers, mock-backend y aviso-ficha-medica specs | HECHO |
| C0.H3.S1.M2 | Dada alta de orden / al moverla a diagnostics / conserva alta, reutilización y 412 | clinical.handlers y diagnostics.handlers specs | HECHO |
| C0.H3.S1.M3 | Dada verificación C3 / al pedirla / responde 404 Pendiente: carril C3 | assertion exacta en mock-backend.spec.ts | HECHO |
| C0.H4.S1.M1 | Dado bloque diagnóstico / al renombrar / funciona bajo AnalysisOrderBlock sin referencias antiguas | rg -n 'diagnostics-block\|DiagnosticsBlock' src/app sin matches; specs bloque/especialidad | EN CURSO |
| C0.H4.S1.M2 | Dado Nota médica / al abrir / muestra En construcción (C1) y contratos de inputs/output | spec mínimo y stock runtime | EN CURSO |
| C0.H4.S1.M3 | Dada Reconsulta existente / al conectar / conserva funcionalidad C4 | follow-up-block.spec.ts y modal runtime | EN CURSO |
| C0.H4.S1.M4 | Dada consulta / al renderizar / aparecen las 12 casillas en orden aprobado | consultation.spec.ts y E2E | EN CURSO |
| C0.H4.S1.M5 | Dadas tres casillas / al abrir / reciben paciente/encuentro y cita; cambios recargan | consultation + analysis-order specs y capturas de modales | EN CURSO |
| C0.H5.S1.M1 | Dados niños reales y puerto 4210 / al ejecutar guard / 3 PASS 0 FAIL y RESUMEN real | node scripts/pw-guard.mjs --self-test; --port 4210 --spec playwright/consulta-rejilla.spec.ts | EN CURSO |
| C0.H6.S1.M1 | Dado diff final / al verificar / evidencia y reporte distinguen alcance y bloqueos | gates, revisión independiente y REPORTE.md | TODO |
| C0.H6.S1.M2 | Dados commits probados / al publicar rama / PR revisable contra mockup, sin merge | git push; gh pr create; gh pr view | TODO |
| C0.H6.S1.M3 | Dado SHA publicado / al avisar / dailies y PR dicen disponible en PR, no integrado | commit/publicación dailies y aviso trazable | TODO |

H1.S1: base/documentación. H2.S1: contratos. H3.S1: handlers. H4.S1: consulta. H5.S1: guard. H6.S1: entrega.

## Contratos de comportamiento

- diagnóstico: REFUTED antes de IN_STUDY; ACTIVE solo confirmado + activo + sin resolvedAt + sin expectedResolutionAt o fin >= now; resto HISTORIC. Comparación por instante, igualdad vigente. C6 normaliza códigos y agrupa rechazados con históricos sin nuevas llamadas.
- handlers de notas: POST alta, PUT/POST versiones; no agregar GET/firma/validación de C1. Registro único de rutas.
- rejilla: Nota médica, Orden de análisis, Diagnóstico, Reconsulta, Receta, Alergia, Medición, Plan de cuidados, Documento, Formulario clínico, Internación, Pagos. Conteos de órdenes y reconsulta null.
- pw-guard: port, spec repetible, attempts=3, stall=120 s, deadline=25 min, serve, retry-failures una vez y self-test. Health 180 s cada 5 s; Playwright workers=1, reporter=list, timeout=90000. Solo mata árboles propios. Aserciones no se reintentan por defecto. Salidas 0/1/124/125, RESUMEN y last-run.json en todos los resultados.

## Verificación serial

Comandos desde el worktree, guardar stdout/stderr y exit en evidencia/antes y evidencia/despues:

```powershell
corepack yarn lint
corepack yarn typecheck
corepack yarn build
corepack yarn test --watch=false --coverage '--include=src/app/core/mock/**/*.spec.ts' '--include=src/app/core/data-access/scheduling/**/*.spec.ts' '--include=src/app/shared/clinical/**/*.spec.ts' '--include=src/app/features/clinical-record/**/*.spec.ts' '--include=src/app/features/account/medical-record/**/*.spec.ts'
node scripts/pw-guard.mjs --self-test
node scripts/pw-guard.mjs --port 4210 --spec playwright/consulta-rejilla.spec.ts
rg -n 'diagnostics-block|DiagnosticsBlock' src/app
node scripts/check-architecture.mjs
node scripts/check-route-prefixes.mjs
node scripts/check-tokens.mjs
node scripts/check-css-tokens.mjs
node scripts/check-form-pages.mjs
node scripts/check-contrast.mjs
node scripts/check-doc-links.mjs
node scripts/generate-inventory.mjs --check
```

rg sin coincidencias sale 1 (PASS del kill-test). Capturas de rejilla/modales/stock/agrupación C6 en 390/768/1024/1440/1920, claro/oscuro, doble revisión; teclado, foco, Escape, recarga y red/consola. Solo fixtures sintéticas. Cobertura core/shared >=80 y features >=60 sin bajar umbrales. Corregir fallos del cambio; baseline ajeno bloquea cierre global y se reporta sin limpieza masiva.

## Publicación y reporte

Commits atómicos con paths explícitos; actualizar contra origin/mockup y repetir pruebas afectadas. Push rama y PR con reviewers jsaldias39,PabloArauzCaballero; sin merge. REPORTE.md: Completado, A medias (qué anda/no anda/falta/dónde), Pendiente, Evidencia literal, No cubierto, Desvíos/riesgos. Dailies personal/equipo solo sección clínica en repo separado, mantener Farmacia/Carga Masiva. Indicar SHA y si está disponible en PR o integrado. Detener procesos propios al cerrar.

## Ajustes factuales durante baseline

- El patrón --include terminado en /** incluye HTML/Markdown como entradas: fallo reproducido «No loader is configured». Los comandos dirigidos usan ahora **/*.spec.ts.
- El primer typecheck en worktree limpio no encuentra env.generated.ts; el script test genera ese artefacto ignorado. Se repite typecheck con entorno generado antes de editar producto.
- Lint base mockup: 263 errores preexistentes, exit 1, evidencia/antes/lint.txt.
- H2.M6 también adapta consultation/lo-registrado.ts y sus specs (ya dentro consultation/**): consume el helper antiguo.

## Microtarea adicional necesaria: C0.H4.S2.M1 — identidad de la reserva

Estado EN CURSO. Extensión concreta descubierta: `?cita=` contiene `Booking.appointmentId`, no `Booking.id`. Usarlo en FollowUpBlock provocaría 404. Alcance adicional: clinical-record.routes.ts (constante BOOKING_QUERY_PARAM), agenda.ts (un campo adicional en paramsDeLaAtencion), agenda.spec.ts (assertions del vínculo), consultation/** (consumidor ya reservado).

CA: Dada reserva b-1 con cita clínica ap-1, cuando se inicia consulta, entonces query conserva cita=ap-1 y agrega booking=b-1; check-in usa ap-1 y Reconsulta usa b-1. Sin reserva de origen no se inventa un ID.

DoD: `corepack yarn test --watch=false --include=src/app/features/agenda/agenda.spec.ts --include=src/app/features/clinical-record/consultation/consultation.spec.ts`; E2E C0 desde agenda, sin 404 de booking. No se cambia scheduling, backend ni semántica de check-in. Total: 21 microtareas originales + 1 integración necesaria.

## Verificación observada durante implementación

- `typecheck`: exit 0. Kill-test del rename: cero coincidencias, rg exit 1.
- Suite amplia con cobertura: 970 aprobados / 4 fallidos. Fuentes de los fallos ajenas a C0; se conserva evidencia y se compara con base. No se atribuye éxito a esa orden.
- Suite dirigida con `VITEST_MAX_WORKERS=2` (opción comprobada en Vitest instalado): 34 archivos / 757 tests aprobados. Concurrencia reducida tras observar jitter y timeout con la corrida amplia; sin cambiar aserciones o timeouts.
- Cobertura dirigida: statements 62.75%, branches 56.61%, functions 59.74%, lines 63.37%; falla umbral por glob de core/shared y funciones features. Exit 1, umbrales intactos.
- Inventarios regenerados: cinco archivos; `generate-inventory --check` exit 0. Incluye deriva previa del inventario detectada por el generador; no se editó a mano.
- Nuevos bordes de pw-guard sometidos a revisión: fallo seguido de silencio, caída de salud con historial previo y descendientes huérfanos. En Windows se usa Job Object nativo para conservar propiedad del árbol aun cuando muere el launcher; sin dependencia npm.
