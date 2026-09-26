# Reporte — D1: corpus masivo del glosario (front)

> **AVANCE: 10 / 11 microtareas — 90,9 %.** Falta sólo H1.S3.M3 (capturas de `/glossary` con doble
> revisión), que exige navegador. H1.S3.M2 (build) se cerró el 2026-09-26 con la máquina libre.
> Peldaño: `TESTED` · visual `UNKNOWN`. D3 y D4 quedaron para otra tanda (decisión del usuario del
> 2026-09-25). D2 vive en el AI service: PR #2, mergeado.

- Rama: `justin/diagnostico-ia-glosario-2026-09-25` desde `origin/mockup` @ `381ce773` · commit `dec04cff` · PR [#704](https://github.com/mdavila-2001/mantra-core-health/pull/704) a `mockup`, **mergeado el 2026-09-26 01:16 UTC** (`2862369d`; los checks nunca corrieron: el CI está caído).
- Plan con estados por microtarea: [`PLAN.md`](PLAN.md). Plan del paquete: `AlovidaPromptManager/docs/trabajo/2026-09-25-diagnostico-ia-glosario/PLAN.md`.

## Qué se entregó

- `data/glossary/`: `00_README.md` (tres capas, fuente/URL/fecha/licencia por archivo, esquema de fila, `reviewStatus`), `enfermedades-atencion-primaria.ndjson` (201 filas, 6 enriquecen un curado), `analisis-frecuentes.ndjson` (122 filas, 15 enriquecen un curado), `cie10cm-categorias.generated.ndjson` (1 918 categorías FY2026, CMS, con `.meta.json` y SHA-256 del ZIP).
- `scripts/`: `lib/glosario-corpus.mjs` (lectura compartida), `check-glossary-corpus.mjs` (validación sin red), `fetch-icd10cm-categories.mjs` (descarga oficial), `verify-external-codes.mjs` (ICD y LOINC contra el NLM; `--write` completa `enDisplay`), `gen-glossary-fixture.mjs` (lee seed + capas, valida taxonomía/síntomas/relaciones, escribe los campos nuevos).
- `fixtures/glosario.generated.ts` regenerado (2 289 términos) · `fixtures/glosario.ts` (`translated` según `lang`, `properties` con `external_code`, `code_system`, `lang`, `review_status`, `source`, `symptom_ids`, `analysis_category`; los términos en inglés dicen «Sin definición cargada» en vez de mostrar un párrafo vacío o inventado) · `fixtures/glosario.spec.ts` (12 pruebas).

## Comandos (uno por vez, sin suite completa ni build ni navegador)

| Comando                                                                                 | Resultado                                                                                                                                                                                              |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `node scripts/verify-external-codes.mjs --write`                                        | 323 códigos existen · 0 faltantes · 7 `enDisplay` completados (además `M26.60` → `M26.609`, que sí existe)                                                                                             |
| `node scripts/check-glossary-corpus.mjs`                                                | 0 problemas                                                                                                                                                                                            |
| `corepack yarn mock:glossary`                                                           | 2 289 términos (69 curados + 2 220 de las capas: 195 + 107 + 1 918; 21 enriquecen un curado) · 1 relación huérfana preexistente del seed omitida (`hipertension-arterial → control-de-signos-vitales`) |
| `corepack yarn typecheck`                                                               | exit 0                                                                                                                                                                                                 |
| `npx ng test --include=src/app/core/mock/fixtures/glosario.spec.ts --watch=false`       | 12 passed                                                                                                                                                                                              |
| `npx ng test --include=src/app/features/glossary/**/*.spec.ts --watch=false`            | 75 passed (4 archivos)                                                                                                                                                                                 |
| `npx ng test --include=src/app/core/mock/fixtures/anatomia-atlas.spec.ts --watch=false` | 14 passed                                                                                                                                                                                              |
| spec de `core/mock/handlers/terminology.handlers`                                       | 29 passed                                                                                                                                                                                              |
| prettier + eslint sobre los 7 archivos tocados                                          | exit 0                                                                                                                                                                                                 |

Tres defectos encontrados y corregidos antes del PR: el generador escribía mal los números y las claves con guion de `CONTEO_DE_CAPAS` (lo destapó el typecheck); la spec suponía que `neumonia` era de la capa nueva (es un curado enriquecido: se separó el caso); eslint prohíbe que `core/` importe de `features/`, así que la spec lee los ids de síntomas del archivo fuente.

## Lo que NO cubre, y hay que saberlo

- **Bundle: medido el 2026-09-26.** `corepack yarn build` → exit 0, **bundle inicial 1,29 MB**, el mismo valor que `mockup` antes de esta rama: el fixture de ~1,08 MB no entra al bundle inicial porque el simulador se carga con `import()` diferido en `mock-backend.interceptor.ts`. El aviso «bundle initial exceeded maximum budget (620 kB)» es el umbral de advertencia y ya existía; el umbral de error (1,3 MB) no se toca. No hizo falta diferir la capa ICD.
- **Pantalla:** ni capturas ni doble revisión de `/glossary`. La lista y la ficha de un término en inglés se afirman por spec, no por navegador.
- **Revisión médica:** definiciones, síntomas por enfermedad y pruebas relacionadas están `pending-medical-review`; no entran a producción sin revisión.
- **Archivos sobrantes en disco, fuera del commit:** `data/glossary/enfermedades-atencion-primaria.part2.ndjson` y `.part3.ndjson`, ya fusionados en el archivo principal. Borrarlos a mano.
- **El AI service** tiene el corpus pinneado a `381ce773` (PR #2): cuando este PR entre a `mockup`, correr allá `yarn catalog:sync` contra el SHA mergeado.

---

# D3 — Diagnóstico como tabla de presuntivos → evidencia → conclusión → cierre (entrega C3)

> **AVANCE: 8 / 8 microtareas — 100 %.** Peldaño: `VERIFIED` para el resultado observable
> (navegador real contra `yarn dev --port 4220`); lo único que falta es la **doble revisión**
> de las capturas, que no puede ser propia (regla 35.1.6).
> Rama `justin/diagnostico-d3-2026-09-26` desde `origin/mockup` @ `a16a36e3`. PR a `mockup`.

## Qué se entregó

- **Simulador:** `POST /clinical/conditions/:id/verification` real (`diagnosis-verification.handlers.ts`): 200 confirmar (`DXV-CONFIRMED` + `COND-ACTIVE` + inicio + fin esperado, o curso crónico sin fin), 200 rechazar (`DXV-REFUTED` + `resolvedAt`), 404, 409 si ya no está en `DXV-PROVISIONAL`, 422 sin motivo **y** sin evidencia, 422 evidencia ajena o inexistente (orden/informe del circuito, nota del expediente; se guarda **resuelta**: la nota trae su consulta, el informe su orden), 422 al confirmar sin fin ni crónica, 422 motivo > 500. `CondicionSimulada.verification?` en la región de condiciones; el seed ya sembraba un presuntivo por paciente y no se tocó.
- **Cliente:** `ClinicalClient.verifyCondition(id, NewDiagnosisVerification) → Condition` (sólo agregado).
- **Bloque «Diagnóstico»:** arriba del alta, la tabla `app-data-table` Diagnóstico · Estado (`diagnosisStateOf` sobre códigos resueltos con `readConceptLabels`, mismo mecanismo que la consulta) · Evidencia («Orden · motivo…») · Acciones (Confirmar / Rechazar sólo en «En estudio»). Estados cargando, vacío (con la salida «registrá el primero abajo») y error; relee tras el alta y tras cada decisión; emite `cambio`. El alta sigue igual: nace presuntivo.
- **Diálogo `diagnosis-verify-dialog`** (sobre `content-dialog`): evidencia de **esta persona** (informes y órdenes de `getPatientDiagnostics`, notas de `listNotes`, con el nombre del estudio por terminología), motivo ≤ 500 con contador, y al confirmar inicio (precargado con el del presuntivo), fin esperado **o** «Crónica» (curso del catálogo por código `COND_COURSE_CHRONIC`; deshabilitada si el catálogo no lo publica). Espejo del 422 antes de mandar, por campo; 409/422 del servidor en un aviso sin perder lo escrito; cerrar con cambios pregunta.
- `data-testid`: `diagnostico-tabla`, `diagnostico-fila-<id>`, `diagnostico-confirmar-<id>`, `diagnostico-rechazar-<id>`, `verificar-formulario`, `verificar-evidencia`, `verificar-motivo`, `verificar-inicio`, `verificar-fin`, `verificar-cronica`, `verificar-enviar`, `verificar-cancelar`, `verificar-error`.

## Comandos (uno por vez, sin suite completa ni build)

| Comando                                                                                                                                   | Resultado                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `corepack yarn typecheck`                                                                                                                 | exit 0                                                                 |
| `npx ng test --include=src/app/core/mock/handlers/diagnosis-verification.handlers.spec.ts --watch=false`                                  | 9 passed                                                               |
| `npx ng test --include=src/app/core/data-access/clinical/clinical.client.spec.ts --watch=false`                                           | 38 passed (36 previas + 2)                                             |
| `npx ng test --include=…/diagnosis-verify-dialog/diagnosis-verify-dialog.spec.ts --watch=false`                                           | 7 passed                                                               |
| `npx ng test --include=…/diagnosis-block/diagnosis-block.spec.ts --include=…/diagnosis-block/enums-del-diagnostico.spec.ts --watch=false` | 39 passed (35 previas + 4)                                             |
| prettier + eslint sobre los 13 archivos tocados                                                                                           | exit 0 (dos avisos «File ignored» de los `.css`, que eslint no lintea) |

Un ajuste al arnés del spec del bloque, sin debilitar ninguna prueba: la tabla lee el resumen al pintarse y el `afterEach` de las pruebas del alta ahora lo responde vacío para que `http.verify()` no tropiece.

## Navegador (2026-09-26, `yarn dev --port 4220`, Chromium de Playwright)

Recorrido reproducible: `evidencia/d3/recorrido-c3.mjs` (`PACIENTE_ID=<uuid> SALIDA=<carpeta> node recorrido-c3.mjs`), entrando como `medica@alovida.mock` a `/medical-records/<Jorge Luis Mamani Choque>/consultation` y abriendo la casilla «Diagnóstico». Salida literal:

```
filas: Obesidad | Hipertensión arterial esencial | Diabetes mellitus tipo 2
estados: En estudio | En estudio | Enfermedad activa
presuntivos con acciones: 2
evidencias ofrecidas: 10 · Sin evidencia | Informe · Hemograma completo · 19 sept 2026 | Informe · Perfil lipídico · 18 sept 2026 | …
espejo del 422: marca el motivo · marca el fin
crónica habilitada: true
tras confirmar, sigue con acciones d2f63ba9-…: 0   → estados ahora: Enfermedad activa | En estudio | Enfermedad activa
tras rechazar, sigue con acciones af999844-…: 0    → estados ahora: Enfermedad activa | Rechazado | Enfermedad activa
desborde horizontal a 375: false
fallos HTTP en /verification: ninguno
```

| Captura (`evidencia/d3/`)                               | Qué muestra                                                                                                                               |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `01-tabla-presuntivos.png`                              | La tabla arriba del alta, dentro del modal de la casilla: dos «En estudio» con Confirmar/Rechazar, una «Enfermedad activa» con «Decidido» |
| `02-dialogo-confirmar.png`                              | «Confirmar Obesidad», centrado en una tarjeta: evidencia de la persona, motivo con contador, inicio precargado, fin esperado, crónica     |
| `03-validacion-antes-de-mandar.png`                     | Enviar en vacío: error bajo el motivo **y** bajo el fin esperado, sin petición al servidor                                                |
| `04-dialogo-completo.png`                               | Motivo escrito, informe elegido, «Crónica» marcada (el fin esperado desaparece)                                                           |
| `05-confirmado-en-tabla.png`                            | Tras el 200: toast «Obesidad: decidido», el expediente relee y la fila pasa a «Enfermedad activa» con «Informe · motivo…»                 |
| `06-dialogo-rechazar.png` · `07-rechazado-en-tabla.png` | «Rechazar Hipertensión arterial esencial» con motivo → fila «Rechazado»                                                                   |
| `08-tabla-375.png`                                      | A 375 px: diagnóstico y acciones a la vista; estado y evidencia plegados al detalle; sin scroll lateral                                   |

Dos cosas que el navegador destapó y se corrigieron antes del PR: `app-select` ya dibuja su `placeholder` como opción nula y el diálogo sumaba otra («Sin evidencia» dos veces); y a 375 px la columna de acciones quedaba cortada detrás de un scroll lateral, así que estado y evidencia pasaron a plegarse (prioridades 2 y 3).

**Comportamiento del anfitrión, no de este carril:** al emitir `cambio`, la consulta relee y cierra el modal de la casilla; para ver la fila decidida hay que volver a abrirla (el recorrido lo hace). Los únicos errores de consola son avisos de CSP por scripts inline del servidor de desarrollo, presentes desde el login y ajenos a C3.

## Lo que NO cubre, y hay que saberlo

- **Doble revisión de las capturas:** pendiente, y no puede ser propia.
- **Backend real:** P41 sigue pendiente; el contrato se cumple contra el simulador.
- **Las órdenes como evidencia no filtran por estado:** cualquier orden del circuito se puede citar, también una pendiente. Es lo que el contrato admite (`serviceRequestId` sin `diagnosticReportId`); si el equipo médico quiere sólo informes liberados, es un filtro de una línea en `opcionesDeEvidencia`.
- **No se tocó** `specialty-form-block/**` ni `triage-ia/**` (D4, otra rama).

# D4 — El Formulario clínico termina en orden + diagnóstico tentativo, sugeridos por IA

> **AVANCE D4: 4 / 5 microtareas — 80,0 %.** Falta sólo la doble revisión de las capturas (H4.S3.M1,
> regla 35.1.6: no puede ser propia). Peldaño: **`VERIFIED`** para el resultado observable (navegador
> real contra `yarn dev` en el 4221, con el servicio de IA vivo del VPS); visual `WRITTEN` hasta la
> doble revisión. Rama `justin/diagnostico-d4-2026-09-26` desde `origin/mockup` @ `a16a36e3`, worktree
> propio (`wt-justin-d4-2026-09-26`); no toca `diagnosis-block/**` ni la verificación (D3, otra rama).

## Qué se entregó

- `core/data-access/triage-ia/diagnosis-ia.{types,client}.ts` (+ spec, 5 pruebas): `DiagnosisIaClient.sugerir`
  → `POST /v1/diagnosis/suggest` sobre `HttpBackend` (sin JWT, sin simulador), 6 s de espera,
  `leerSugerencia` valida la forma; una fila rota se descarta, un `score` fuera de 0..1 se recorta;
  HTML del SSR, 502 o tiempo agotado → `null`.
- `features/clinical-record/patient-chart/form-conclusion-block/` (+ spec, 8 pruebas): «Cierre del
  formulario». Pide sugerencias 600 ms después de la última respuesta con texto (sólo pregunta +
  respuesta en palabras; nada del paciente). Cinco estados: sin respuestas · pidiendo · sin servicio
  («elegí a mano») · sin sugerencias · con datos (tentativos con ICD, puntaje en %, por qué y pruebas;
  análisis sugeridos; **el `disclaimer` del servicio siempre**). «Usar» resuelve contra el catálogo de la
  plataforma: ICD exacto → categoría de 3 caracteres; LOINC → etiqueta normalizada; sin correspondencia
  avisa y no elige. Selectores de diagnóstico (`clinical.conditions.code_concept_id`), categoría
  (LAB/IMAGING/OTHER) y estudio (`clinical.service_requests.code_concept_id`); emite
  `{ diagnostico, orden }`; una orden sin categoría no viaja y se dice.
- `specialty-form-block` (sólo incrustar y encadenar; + 6 pruebas, 43 previas intactas): el bloque
  aparece sólo con una plantilla de `forms` elegida, antes de las acciones. `completar()` encadena
  abrir → capturar → cerrar la instancia → **`createCondition`** (presuntivo, `encounterId`, `noteText`
  «Del formulario «⟨ficha⟩»») → **`requestStudy`** (`category` + `categoryConceptId`, `encounterId`), en
  serie, cada paso con su aviso. Un fallo frena lo que sigue, **no deshace** lo hecho y queda escrito en
  un aviso ámbar que sobrevive al toast; sin organización en la sesión, la ficha se guarda y el cierre
  se declara no registrado.
- `playwright/evidencia-d4-cierre.mjs`: recorrido suelto (el runner sigue caído) y `evidencia/d4/`.

## Comandos (uno por vez; sin suite completa, sin `ng build`)

| Comando                                                                                              | Resultado                  |
| ---------------------------------------------------------------------------------------------------- | -------------------------- |
| `corepack yarn typecheck`                                                                            | exit 0                     |
| `npx ng test --include=src/app/core/data-access/triage-ia/diagnosis-ia.client.spec.ts --watch=false` | 5 passed                   |
| `npx ng test --include=.../form-conclusion-block/form-conclusion-block.spec.ts --watch=false`        | 8 passed                   |
| `npx ng test --include=.../specialty-form-block/specialty-form-block.spec.ts --watch=false`          | 49 passed (43 previas + 6) |
| `corepack yarn prettier --write` + `corepack yarn eslint` sobre los archivos tocados                 | exit 0 · 0 errores         |

## Recorrido en navegador (`evidencia/d4/`, 1440 y 375)

Sesión `medica@alovida.mock` → agenda → «Atender» → consulta con encuentro abierto → casilla
«Formulario clínico» → «Anamnesis y antecedentes odontológicos» → «Motivo de consulta»: _fiebre alta y
tos con dolor al respirar desde hace tres días_.

- **El servicio vivo respondió** (`POST /ai/v1/diagnosis/suggest → 200`, por el proxy de `ng serve` al
  VPS): 5 tentativos (Bronquitis aguda J20.9 67 %, Neumonía J18.9 59 %, Gripe J11.1, Bronquiolitis, Crup)
  con «por qué» del modelo, 4 análisis sugeridos y el disclaimer. Captura `02`.
- **El catálogo filtra:** «Usar» Bronquitis aguda (J20.9) → aviso «no está en el catálogo de
  diagnósticos. Elegilo a mano» (el simulador tiene 37 códigos). «Usar» Radiografía de tórax → categoría
  Imagenología + estudio «Radiografía de tórax» por etiqueta. Captura `03` (1440 y 375, **sin desborde
  horizontal** a 375).
- **Mutación demostrada, corrida 2:** diagnóstico «Infección respiratoria aguda» + orden Laboratorio ·
  «Densitometría ósea» → «Completar formulario» → tres avisos en orden (Formulario completado ·
  Diagnóstico tentativo registrado · Orden de análisis pedida; captura `04`) → recarga → casilla
  «Diagnóstico» **2 → 3 en la historia** (`05`) y la densitometría listada en «Estudios pedidos»,
  pendiente (`06`).
- **Camino de fallo real, corrida 1** (`RESULTADO-corrida-1-orden-duplicada.md`, `corrida-1-04/05`): con
  «Hemograma completo», la antiduplicación del simulador respondió 412 «Ya existe un estudio igual
  reciente»: la ficha se guardó, el diagnóstico se registró (2 → 3), la orden no, y el aviso ámbar lo dijo.
- Consola: sólo los dos errores de CSP por script inline del `ng serve`, preexistentes y ajenos.
  `99-fallo.png` es de un intento anterior del script y no se commitea.

## Lo que NO cubre, y hay que saberlo

- **Doble revisión** de las capturas: pendiente, no puede ser propia.
- **`patient` (edad/sexo) no se manda**: esta pantalla no los tiene a mano y el puntaje del servicio no
  depende de ellos (A2). Cuando se quiera, se leen del perfil y se agregan a `sugerir`.
- **Antiduplicación de estudios (412)**: el cierre la cuenta como fallo del paso y lo dice; no abre el
  diálogo de reutilizar/repetir del bloque de órdenes. Si se quiere ese diálogo acá, es un carril aparte.
- **`category` viaja además de `categoryConceptId`** (P40, pendiente de backend). El simulador ignora
  `category` y guarda el concepto; si el backend real rechaza claves desconocidas, hay que quitar
  `category` del cuerpo hasta que P40 exista.
- El bloque no aparece en la hoja libre ni en los bloques propios (diagnóstico, alergia, cirugía,
  odontología, laboratorio): sólo con una plantilla de `forms`, como pide el plan.
