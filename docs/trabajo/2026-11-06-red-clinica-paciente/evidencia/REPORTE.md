# Red clínica del paciente — Franja 1 (vínculos y datos)

06/11/2026 · rama `claude/charming-cerf-q7sgmk` · commit `eec56490e`. Lo reporta quien implementó;
**no es una aprobación**: la revisión independiente está pendiente.

## Contrato (patch v4291 de la API, `13d2c494` + `fbf18626`)

| Vínculo | Escritura | Lectura | Rechazos (422) |
|---|---|---|---|
| `reasonConditionId` | `POST /clinical/service-requests` | respuesta y `GET /diagnostics/patients/:id/orders` | `SERVICE_REQUEST_REASON_CONDITION_INVALID` |
| `replacedByConditionId` | `POST /clinical/conditions/:id/verification`, sólo REFUTED | respuesta y resumen | `CONDITION_REPLACEMENT_REQUIRES_REFUTED`, `CONDITION_REPLACEMENT_SELF`, `CONDITION_REPLACEMENT_INVALID` |
| `targetEncounterId` | `PATCH /referrals/:id/respond`, sólo ACCEPT | lecturas de referrals | `REFERRAL_TARGET_ENCOUNTER_NOT_ALLOWED`, `REFERRAL_TARGET_ENCOUNTER_INVALID` |

Los dos vínculos a diagnósticos exigen además el mismo tenant custodio (`fbf18626`). La API no
acepta `targetEncounterId` en la llegada (`arrival`).

## Hecho

- Tipos y clientes de `core/data-access` (clinical, diagnostics, referrals); `null` se normaliza a
  ausente. Las claves pendientes del contrato, en `simulator-extensions.ts`.
- Reglas de los vínculos en el simulador (`core/mock/handlers/clinical-links.mock.ts`).
- Historia de ~18 meses de `pid-paciente` (`core/mock/fixtures/patient-network.data.ts`), sólo
  agregando filas:
  - diferencial anemia / hipotiroidismo: la anemia se descarta con `replacedByConditionId`; el
    hipotiroidismo se confirma con `basedOn` → informe de TSH;
  - estudios de laboratorio e imagen con `reasonConditionId` e informe liberado;
  - levotiroxina 25 → 50 → 75 mcg y ciprofloxacino, con indicación;
  - citas: primera consulta, reconsultas `followUpOf`, una cancelada y una no asistida;
  - derivación a endocrinología aceptada, con `targetEncounterId` y contrarreferencia; derivación a
    neurología rechazada;
  - internación por pielonefritis;
  - un presuntivo de ansiedad pendiente.
- Unidades de las observaciones: la causa de «118 mg» / «36.4 mg» era el simulador
  (`clinic.ts` y `faker/clinical.ts` usaban `UNIT-MG` para todo). Corregido, con prueba.
- Formularios: «Para qué diagnóstico» (orden de estudio), «Se confirmó en su lugar» (rechazo de
  diagnóstico) y la atención en curso como atención de llegada al aceptar una derivación. Los 422
  se marcan en el control correspondiente.

## Decisiones

- **D1.** El vínculo de llegada va sólo en `respond` con ACCEPT: la API no lo acepta en `arrival`.
- **D2.** Sin filtro por tenant en los selectores del front: `ConditionItemDto` no publica
  `custodianTenantId`. Los selectores excluyen descartados y el propio diagnóstico; el 422 de la
  API se muestra en el control.
- **D3.** El simulador no valida el tenant destino de `targetEncounterId` (las atenciones
  simuladas no tienen tenant). Sí valida mismo paciente y que quien responde sea el destino.
- **D4.** El resumen clínico de la API no publica `replacedByRequestId` (reemplazo de receta);
  está sembrado sólo en el simulador.
- **D5.** No se tocó `patient-chart.ts/html/css` ni `recorrido-clinico/**` (Franja 2).

## Resultados

| Comando | Resultado |
|---|---|
| Pruebas dirigidas del front | 164 + 96 pruebas, 0 fallas |
| Pruebas del simulador y del contrato | 95 pruebas, 0 fallas |
| 68 specs que dependen de `pid-paciente` o de los fixtures | 1000 pruebas, 0 fallas |
| `yarn lint` · `yarn typecheck` · `yarn build` | 0 · 0 · 0 |
| `check-english-identifiers` | 0 |
| `check-mock-vs-client` | sólo entradas previas de insurance y terminology |

## Evidencia de navegador

Simulador (`development,demo`), médica `medica@alovida.mock`, una sesión nueva por caso,
`deviceScaleFactor: 2`. Request y response sacadas de `window.__mockRequests` (`red-*.json`);
script `evidencia.cjs`.

| Caso | UI → request → response → recarga → UI | Archivos |
|---|---|---|
| Unidades | «118 mmHg», «36.4 °C», «64 latidos por minuto», «88 mg/dL» | `01-expediente-unidades.png`, `01-unidades.txt`, `red-unidades.json` |
| Orden con «Para qué diagnóstico» | `POST /clinical/service-requests {reasonConditionId}` → 201 → tras recargar, «Vitamina D … Para: Hipotiroidismo» | `02-orden-formulario.png`, `03-orden-tras-recarga*.png`, `red-orden.json` |
| Rechazo con «Se confirmó en su lugar» | `POST …/verification {outcome:REFUTED, replacedByConditionId}` → 200 → tras recargar, «Rechazado · … · Reemplazado por Hipotiroidismo» | `04-rechazo-formulario.png`, `04b-rechazo-enviado.png`, `05-rechazo-tras-recarga*.png`, `05-rechazo-fila.txt`, `red-rechazo.json` |
| Aceptar derivación con atención en curso | `PATCH …/respond {decision:ACCEPT, targetEncounterId}` → 200 → tras recargar, `GET /referrals/:id` trae el campo y el detalle muestra «Atención de llegada: 6 nov 2026 … · Consulta» | `06-aceptar-confirmacion.png`, `07-derivacion-tras-recarga.png`, `07-llegada.txt`, `red-derivacion.json` |

## Hallazgos fuera de alcance

- **sessionStorage del simulador al límite:** con la sesión médica abierta ocupa 4,37 MB de ~5 MB
  (`mock.comunidad.vitrinas` solo, 3,9 MB). Desde la segunda mutación en la misma pestaña, la
  escritura de colecciones grandes falla en silencio y no sobrevive a F5. Defecto previo, no
  corregido; por eso la evidencia usa una sesión por caso.

## No ejecutado

- `yarn test` completo: el cgroup compartido de 14,3 GB lo mató por falta de memoria 4 veces
  (varios agentes compilando a la vez).
- `yarn pw` y el resto de los `check-*.mjs`.
