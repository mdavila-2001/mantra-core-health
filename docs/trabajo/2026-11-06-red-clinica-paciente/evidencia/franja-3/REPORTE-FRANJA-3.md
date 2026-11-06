# Red clínica del paciente — Franja 3: panel de detalle, filtros y alertas

06/11/2026 · lo reporta quien implementó; **no es una aprobación**.


Rama `claude/red-clinica-franja-3`, hash 8694d03a, en el clon
/home/user/mantra-core-health-model/.claude/worktrees/agent-a4449eee563e0d7e7/front
(base 75b8378f; ya mergeó Franja 1 eec56490 + 525d4d32). Sin push.

Archivos: `patient-chart/red-clinica/` (types, filtro, alertas, valores, demo, panel/, filtros/,
alertas/), `component-stock/scenarios/red-clinica.scenarios.ts` (+ spec) y una línea en
`component-stock/scenarios/scenarios.ts`. Evidencia en
`docs/trabajo/2026-11-06-red-clinica-paciente/evidencia/franja-3/` (24 capturas, aserciones.txt,
captura-franja-3.cjs).

## Contrato
- Tipos ya traducidos: `NodoDeRed {id, tipo, titulo, subtitulo?, cuando, profesional?, especialidad?,
  estado?, buscable?, detalle?}`; `DetalleDeNodo` por tipo (estudio con resultado y valores con
  rango; diagnóstico con certeza, decisión, evidencia, reemplazadoPor; derivación con respuesta,
  llegada, contrarreferencia; cita/reconsulta; general). `AristaDeRed {desde, hasta, tipo, inferido?}`.
- Vínculos (desde → hasta): registrado-en, reconsulta-de, derivada-desde, recibida-en,
  orden-de-derivacion, pedido-para, evidencia-de, indicado-para, reemplazado-por, reemplaza-receta,
  estudio-previo, resultado-de. Id de nodo = id del registro.
- `<app-red-clinica-panel>`: in `nodo|null`, `nodos`, `aristas`, `ahora`, `presentacion`
  ('auto'|'lateral'|'hoja'); out `nodoElegido: string`, `cerrado`. ≥780 px `<aside>` en rejilla
  mapa|panel sin atrapar foco; <780 px `<dialog>` modal. PDF con FilesClient.contentDataUrl;
  estados S4/S5/S6/S8/S9.
- `<app-red-clinica-filtros>`: in `nodos`, `[(filtro)]` (model FiltroDeRed), `visibles`.
- `<app-red-clinica-alertas-lista>`: in `alertas`, `titulo`; out `nodoElegido`, `resaltar: string[]`.
- Puras: `aplicarFiltro(nodos, filtro, aristas)`, `hiloDeDiagnostico`, `FILTRO_VACIO`,
  `criteriosActivos`, `aristasVisibles`, `alertasDeApoyo(entrada)` sobre tipos reales
  (Condition, DiagnosticOrder, DiagnosticReport, Referral, Encounter) + resultados, codigoDe,
  etiquetaDe, idDeNodo?, umbrales?. Alertas: resultado crítico/fuera de rango, presuntivo sin
  resolver, estudio sin resultado, derivación sin respuesta, sin contrarreferencia, diagnóstico
  repetido, motivo repetido. Ninguna sugiere diagnóstico (probado).

## Decisiones
- Reusa `diagnosisStateOf`. Antigüedad «hace 3 meses (94 días)». Plazos de referencia (no normas):
  presuntivo 14 d, estudio 7, derivación 7, contrarreferencia 14; ×3 → prioridad alta.
- No usa `app-filter-bar` (guarda en URL, sin rango de fechas).

## Resultados
ng test red-clinica + escenarios: 8 archivos, 161 pruebas OK; typecheck 0; build 0; lint 0;
check-colores-sueltos sin hallazgos propios; check-css-tokens falla por 3 tokens ajenos previos
(--fs-h4, --lh-h4, --doctor-color); check-english-identifiers no evaluable (sin base de diff).
Navegador: stock `/design-system/stock/features/clinical-record/patient-chart/red-clinica/...`,
1440 y 390, claro y oscuro, 74 aserciones PASS.

## Pendiente
Integración en el expediente (Franja 2); sin prueba sobre datos de pid-paciente; 768/1024/1920,
visual gate y axe sin correr; descarga con 403 real sólo unitaria; en oscuro el badge del panel a
390 casi no se distingue y la fila «Alto» queda marrón; `generate-component-index` no cuenta los
escenarios nuevos; mapeo `replacedByRequestId` → `reemplaza-receta` es de Franja 2. En 390 no se
pudo probar que Tab nunca sale de la hoja (escapa del iframe al banco).
