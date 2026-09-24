# Reporte de ejecución — módulo Médico

- Fecha: 2026-09-24 · Plan: [PLAN.md](./PLAN.md) · Rama: justin/medical-module-cierre
- Fuente funcional única: 02_METAPROMPT_MEDICO.md, copia congelada en MetaPrompts/02-medical-module-plan-b57dfd316c4d/sources/medical-metaprompt.md
- SHA-256 de la fuente: b57dfd316c4d642eb5e1db49257397b8fd2864b511317282ae4b70ff1262a656
- Base inicial del trabajo frontend: mockup a43ad2b311e1a69ff708fba5cef1e5a2100bbbc2. La rama fue rebasada sobre origin/mockup b11dfdd382dd787fab33d5894979ccc2c4d5a96a; la suite frontend completa no se repitió después del rebase.
- Peldaño máximo: TESTED para los filtros dirigidos; no se alcanzó VERIFIED ni REGRESSION_VERIFIED.
- Avance integral: 0/98 criterios incluidos = 0 %. La matriz conserva 100 criterios fuente: 98 IN y 2 OUT.

## Completado

Ningún criterio de aceptación integral alcanzó HECHO. Las verificaciones parciales y sus límites están descritos abajo y en MATRIX.json.

| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| F0.M1–M3, F2 | Fuente, inventario de criterios y plan H1–H8 documentados | revisión de fuente congelada y artefactos | Fuente hash b57dfd…; matriz 100 nodos contables, 98 IN |
| F5 parcial | Tipos del frontend validados en la punta inicial a43ad2b | corepack yarn typecheck | exit 0 |
| F5 parcial | Pruebas frontend dirigidas ejecutadas | corepack yarn ng test --watch=false --filter='(RegisterPractitioner|MyProfile|WorkHistory|Practice|Agenda|MyAgenda|TarjetaDelDia|AppointmentNew|WalkInForm|ClinicalRecord|PatientChart|Consultation|Invoice|invoice|factura|reclamo|Claim|MedicationBlock|medication schedule|cronograma|alarm|alarma|receta)' | 54 archivos; 804 aprobadas; 529 excluidas por el filtro |
| F5 parcial | Evidencia API dirigida agregada desde worktree separado | ver reporte API | 21 suites/505 pruebas unitarias; una integración de registro profesional 8/8 |

## A medias

### F1 — auditoría funcional y contratos
- Qué anda: la matriz cubre los criterios de Médico y se separaron contratos observados, propuestos y externos.
- Qué no anda: no se completó una lectura de persistencia integral por cada obligación ni acuerdos de contratos con dueños externos.
- Qué falta exactamente: cerrar el mapeo criterio por criterio de F0.M4 y confirmar propietarios/contratos de catálogos, avisos, video y facturación periódica.
- Dónde quedó: MATRIX.json, CONTRACTS.md y HANDOFF.md.

### F3 — producto frontend
- Qué anda: se inspeccionaron las áreas profesionales/agenda/consulta/medicación/fiscal; el filtro dirigido de componentes pasó.
- Qué no anda: no se cambió producto ni se demostró una brecha visual concreta con capturas antes/después.
- Qué falta exactamente: seleccionar una microtarea visual de una ficha autorizada, capturar baseline, implementar únicamente el ajuste observado y capturar después.
- Dónde quedó: sin diff de producto; worktree justin/medical-module-cierre.

### F4 — integración médica
- Qué anda: en entorno desechable, una integración de registro profesional pasó 8/8 después de cargar terminología sintética canónica.
- Qué no anda: no se completó ningún journey UI→API→persistencia→recarga→segundo actor; la base canónica no inicializó y Docker dejó de responder durante el lote.
- Qué falta exactamente: resolver la inicialización del catálogo base en su dueño, disponer de API y DB desechables estables y ejecutar MED-E01–E17 sin saltar criterios.
- Dónde quedó: REPORTE.md API en el worktree hermano wt-medical-module-api; no se cambió API/modelo.

### F5 — regresión y evidencia visual
- Qué anda: typecheck frontend, 804 pruebas dirigidas, typecheck/lint API y OpenAPI lint/breaking checks pasaron según salidas registradas.
- Qué no anda: lint frontend reportó 246 errores Angular ESLint; integración por lotes API no pasó; la suite unitaria API agotó heap de 6 GB; E2E de salud no pudo iniciar con API no saludable.
- Qué falta exactamente: regresión completa en infraestructura recuperada, Playwright --workers=1 con evidencia visual, inspección de fotos y reporte visual. No se volvió a ejecutar la suite completa frontend sobre la punta actualizada de mockup.
- Dónde quedó: evidencia de comandos en MATRIX.json, evidence/README.md y el reporte API hermano.

## Pendiente

| ID | Estado | Qué lo destraba |
|---|---|---|
| F0.M4–M5 | A MEDIAS | Mapeo de implementaciones/contratos y selección de microtarea visual con baseline aprobable |
| H1–H8 / 98 criterios IN | A MEDIAS / BLOQUEADO / TODO según MATRIX.json | Completar aceptación end-to-end; contratos/infraestructura/propietarios faltantes |
| F4 | BLOQUEADO parcialmente | Docker local estable, DDL canónica corregida por su propietario y recorridos API/UI aislados |
| F5 | BLOQUEADO parcialmente | Ejecutar lint/regresión/E2E cuando los servicios estén disponibles y tratar fallos sin ocultarlos |
| F6 | A MEDIAS | Ramas documentales publicadas en origin; no se abrió PR ni se hizo merge o deploy; publicar no equivale a cerrar el plan clínico |

## Evidencia

- corepack yarn typecheck → exit 0 en el frontend a43ad2b.
- corepack yarn ng test --watch=false --filter='(RegisterPractitioner|MyProfile|WorkHistory|Practice|Agenda|MyAgenda|TarjetaDelDia|AppointmentNew|WalkInForm|ClinicalRecord|PatientChart|Consultation|Invoice|invoice|factura|reclamo|Claim|MedicationBlock|medication schedule|cronograma|alarm|alarma|receta)' → 54 archivos, 804 aprobadas, 529 excluidas.
- corepack yarn lint → exit 1; 246 errores @angular-eslint/prefer-on-push-component-change-detection.
- corepack yarn pw playwright/carril-19-route-health.spec.ts --workers=1 → fallo en beforeAll por API localhost:3005 no saludable; 1 falló y 3 no corrieron. No hay foto ni verificación de flujo.
- API dirigido → 21 suites, 505 pruebas aprobadas; integración profesional aislada → 1 suite, 8 pruebas aprobadas.
- Suite frontend completa de la revisión anterior: 7.220/7.221 pruebas, una falla en insurance-analytics.handlers.spec.ts (coveragesWithoutPremiumCount esperado 0, observado 1). Corresponde a la revisión anterior y no certifica la punta actualizada.
- Suite completa de API con heap de 6 GB: terminó por JavaScript heap out of memory y no emitió resumen.
- Inicialización SQL: el patch existente de aseguradoras esperaba 17 catálogos canónicos y recibió 0; el SQL original no quedó inicializado. Una copia temporal que omitió ese patch sí levantó 1260 tablas; esa ejecución no cuenta como init canónica.
- Se registran además 1369 conceptos de terminología cargados desde el paquete canónico del modelo y 7104 referencias huérfanas advertidas al cargar sólo ese módulo; la advertencia explica que las demás semillas de arranque no se cargaron en esa base parcial.
- La integración por lotes API reportó 12 suites fallidas, 1 omitida y 1 aprobada; 90 pruebas fallidas, 8 omitidas y 26 aprobadas. Los logs muestran ECONNREFUSED 127.0.0.1:55433. Docker Desktop dejó de responder y no se reinició para evitar afectar servicios compartidos.
- No se alteraron pruebas, contratos OpenAPI, datos administrados, el repositorio del modelo ni archivos del plan de Paciente.

## No cubierto

No se probó el flujo completo de alta/edición, el acceso por segundo tenant, agenda con reinicio/deduplicación, activación PAC, episodio clínico completo, teleconsulta con proveedor real, jobs persistentes de medicación, emisión y periodicidad fiscal, ni MED-E01–E17 como recorridos end-to-end. Tampoco se inspeccionaron fotos porque no se generó ninguna nueva.

## Desvíos del plan

Se abrió un worktree API separado para auditoría y verificación parcial. No se editaron productos API/modelo. Para obtener un único recorrido de integración, se usó una copia temporal del SQL sin un patch base que depende de catálogos que todavía no existen durante init; esa prueba se etiqueta parcial y no sustituye el DDL canónico. No se corrigió el patch ni se ocultó su fallo.

## Riesgos residuales

El servicio local Docker quedó no disponible; el proceso de inicialización de catálogo canónico sigue fallando por el orden entre DDL y seed. Las tareas dependientes de contratos externos y de Paciente no se deben simular. El lint frontend y regresiones fallidas permanecen visibles.

## Decisiones y ambigüedades

El alcance visual del AGENTS.md continúa rigiendo los cambios de producto frontend. La instrucción directa de ejecutar el plan habilitó auditoría y pruebas API en un worktree aislado, pero no se introdujeron cambios de producto sin brecha confirmada y sin resolver el bloqueo de modelo/DDL. Las ambigüedades externas siguen registradas en DECISIONS.md y CONTRACTS.md.
