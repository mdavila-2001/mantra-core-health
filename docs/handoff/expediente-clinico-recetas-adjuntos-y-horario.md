# Expediente clínico, recetas, adjuntos y horario — instrucciones de corrección

**Fecha:** 2026-09-10 · **Rama de trabajo:** `mockup` (todo lo que sigue es front + simulador
salvo donde se marca **BACKEND**) · **Origen:** pedido del cliente del 09/09/2026 sobre las
pantallas `/schedule/edit` y `/medical-records/:profileId`.

Este documento existe para que **cualquiera** —una persona o una sesión nueva de Claude— pueda
ejecutar las correcciones sin volver a explorar el repositorio. Cada sección dice: qué pidió el
cliente, qué hay hoy (con archivo y línea), cuál es la causa, qué cambiar exactamente, cómo
probarlo y cómo verificarlo en el navegador. Todo lo citado **fue leído en el código el
2026-09-10**; si una línea no coincide, buscá el identificador que la acompaña, no el número.

---

## 0 · Antes de tocar nada

### 0.1 Reglas de la casa que aplican a todo lo de abajo

| Regla | Dónde está escrita | Consecuencia práctica |
| --- | --- | --- |
| **No hay migraciones.** Esquema = `.puml → gen_ddl.py → SQL/ → base → entidades` | `.claude/rules/99-adaptacion-mantra-core.md` §1, ADR-0021 | Una columna nueva empieza en `mantra-core-health-model/`, nunca en el repo de la API. |
| **`forbidNonWhitelisted`**: una clave que el DTO no declara **rechaza la petición entera con 400** | `mantra-core-health-api` `ValidationPipe` global | Todo campo nuevo del front que viaje a la API real necesita su línea en el DTO **antes** de salir de `mockup`. Mientras tanto se anota en `PENDIENTES-BACKEND.md`. |
| **Formularios centrados y a lo ancho, en columnas** (cliente, 09/09/2026) | `mantra-core-health/CLAUDE.md` regla 6, `docs/components/composition-rules.md` §5 | Toda pantalla nueva o retocada: `inline-size: 100%`, `margin-inline: auto`, campos en 1/2/3 columnas (780 px / 1120 px). Medir con navegador, no a ojo. |
| **Rutas, claves de API e identificadores nuevos en inglés; prosa en castellano** | `.claude/rules/99-…` §9 | Los nombres de rutas y campos DTO de abajo están en inglés a propósito. |
| **Los `*ConceptId` son uuid de terminología**, nunca texto | `clinical.types.ts` cabecera | Un desplegable clínico se alimenta de `GET /system-context/dynamic-enums?target=…` (`app-concept-select`) o de un value set (`TerminologyClient`). |
| **NO_EVIDENCE_NO_DONE** | `mantra-core-health/CLAUDE.md` | Cada punto cierra con captura o medición en navegador. |

### 0.2 Comandos

```bash
cd "mantra-core-health"
yarn typecheck                      # tsc app + cypress + playwright
yarn lint                           # hoy da 7 errores preexistentes en verification-cases.ts y date-picker.ts
yarn test --watch=false             # ~5 200 pruebas; 2 fallos preexistentes en mockup (identity-verification, shell-layout «edit»)
yarn build                          # hoy falla por presupuesto CSS de messaging/thread/thread.css (135 bytes) — preexistente
yarn start                          # :4200, con mockBackend=true en esta rama
```

Cuentas del simulador (cualquier contraseña): `medica@alovida.mock` (doctora, tiene agenda y
expediente de pacientes), `paciente@alovida.mock`.

### 0.3 Coordinación con el plan de evoluciones (`PLAN-EVOLUCIONES-Y-ATENCION.md`)

Hay **otro plan en curso sobre los mismos archivos**, escrito el 09/09 y en ejecución. Este
documento se apoya en él; no compite.

| Su fase | Estado | Qué implica para lo de acá |
| --- | --- | --- |
| 1 · «Atender» nace sólo de Mis citas | **Hecha** (`ced1531`, `3e16406`, `b3f0fa5`, `fad0699`) | El expediente **ya no tiene** botón «Atender» ni la card «Qué se está mirando»: es lectura con un aviso de continuación. El §4.3.4 de acá —«Nuevo diagnóstico» desde el expediente— **no lo contradice**: registrar un diagnóstico no es atender, y el propio plan mueve las ediciones a modal en su 3.2. |
| 3.1 · Sacar la card | **Hecha** (`3e16406`) | — |
| 3.2 · `#celdaAcciones` pasa a menú + modal | **Pendiente** | Lo de acá lo **absorbe**: §4.3.4 y §7.2.2 abren en modal desde el principio, no inline. No dejar dos patrones. |
| 3.3 · Organismo `attachment-dialog` | **Pendiente** | Lo construye la **fase 6** de acá (§7.2.1) y lo usan diagnóstico, receta, alergia, procedimientos y el expediente. Es la pieza que su plan pide y que acá hace falta en seis lugares. |
| 2 · Evoluciones | Pendiente | No se toca desde acá. |

Además, `3ce6f5d feat(uploads)` ya rehízo **`molecules/file-input`** con arrastrar-y-soltar,
previsualizaciones (`molecules/file-preview`) y `shared/forms/file-accept.ts`. La fase 6 de acá
**construye encima de eso**: el `app-file-input` ya sabe recibir varios archivos y mostrarlos; lo que
falta es que `attachment-uploader` deje de pedir uno solo. No rehacer el campo.

### 0.4 Mapa de los archivos que aparecen abajo

```text
mantra-core-health/src/app/
├── features/agenda/agenda-create/          «Publicar/Cambiar mi horario» (/schedule/new y /schedule/edit)
│   ├── agenda-create.ts / .html            formulario, vista previa, publicación
│   └── agenda-turnos.ts                    aritmética de turnos (puro TS, con spec)
├── features/clinical-record/
│   ├── patient-chart/                      «Expediente» (/medical-records/:id) — LECTURA + acciones por fila
│   │   ├── patient-chart.ts / .html        pestañas, filas, columnas, «Cambiar estado», «Adjuntar archivo»
│   │   ├── diagnosis-block/                formulario de diagnóstico (se usa desde «Atención»)
│   │   ├── medication-block/               formulario de receta + lista de recetas
│   │   ├── specialty-form-block/           selector «qué vas a registrar» + fichas por especialidad
│   │   └── …                               admission / procedures / diagnostics / free-note / odontogram
│   └── encounter-workspace/                «Atención» (/medical-records/:id/encounter) — ESCRITURA
├── core/data-access/clinical/              clinical.types.ts (contratos de vista) · clinical.client.ts (HTTP)
├── core/data-access/chart-templates/       plantillas de ficha (GET /charts/templates)
├── core/data-access/files/                 subida y vínculos de archivos
├── core/mock/handlers/                     clinical.handlers.ts · scheduling.handlers.ts · files.handlers.ts · misc.handlers.ts
└── core/mock/fixtures/                     clinica.ts · agenda.ts · conceptos.ts
shared/components/organisms/attachment-uploader/   el subidor genérico (1 archivo, 10 MB)
shared/components/molecules/file-input/            el campo de archivo (ya admite `multiple` y `maxFiles`)

mantra-core-health-api/src/modules/
├── clinical/dto/                           condition.dto.ts · medication.dto.ts · allergy.dto.ts · clinical-read.dto.ts
├── clinical/controllers/clinical-records.controller.ts
├── clinical/services/procedures.service.ts (attachFile: la receta para adjuntar a cualquier recurso)
├── common/dto/enums.ts (OwnerType) · common/dto/files.dto.ts (CreateFileLinkDto)
├── common/services/file-upload.service.ts (UPLOAD_MIME_ALLOWLIST)
├── chart/controllers/chart-documents.controller.ts (POST /charts/documents, varios archivos)
└── …/common/seed/data/clinical-forms/      los 43 formularios estándar (JSON por especialidad)
```

---

## 1 · Resumen ejecutivo: qué pidió el cliente y qué hay hoy

| # | Pedido | Estado real hoy | Dónde está el hueco |
| --- | --- | --- | --- |
| 1 | La cita no termina a la hora que debería | La aritmética de turnos es correcta; **editar el horario nunca retira el anterior** y los cupos viejos —con su fin viejo— sobreviven. La vista previa además sólo lista horas de **inicio**. | Front (`agenda-create.ts`) + simulador (`generate-slots`) + vista previa |
| 2 | En diagnóstico/historia clínica no deja poner los formularios respectivos | El bloque existe (`specialty-form-block`) y lee `GET /charts/templates`. **El simulador sirve 4 plantillas; el backend siembra 43.** | Simulador (`PLANTILLAS_DE_EXPEDIENTE`) |
| 3 | Crear un diagnóstico nuevo sobre el expediente, con duración promedio y opción «crónico» | El formulario existe **sólo en «Atención»**, no en el expediente. Tiene curso clínico y fecha esperada, pero **en el simulador el selector de curso no muestra «crónico»** (target sin binding) y el `POST` descarta curso y fecha. | Expediente (falta el botón) + simulador (bindings y persistencia) |
| 4 | Un select para atar la enfermedad a una cita existente o finalizada | El contrato ya acepta `encounterId`; **el formulario no lo ofrece** (toma sólo el encuentro en curso). | `diagnosis-block` |
| 5 | Lo mismo para alergias | **No existe formulario de alergias** en el front; el cliente HTTP sí. El DTO y la tabla **no tienen `encounter_id`**. | Front (bloque nuevo) + **BACKEND/MODELO** (columna) |
| 6 | Tratamiento sobre un diagnóstico previo; la tabla dice a qué receta/diagnóstico pertenece | El contrato ya tiene `indicationConditionId` y el formulario lo manda; **la lectura lo tira** (`MedicationRequest` no lo declara) y la tabla no lo muestra. | `clinical.types.ts` + `patient-chart.ts` + simulador |
| 7 | Toda receta debe poder decir su diagnóstico: uno existente **o un título propio** (psiquiatría) | Existe el select de diagnósticos existentes. **No hay texto libre** ni columna donde guardarlo. | Front + **BACKEND/MODELO** (`indication_text`) |
| 8 | Adjuntos en todos los formularios, de todo tipo, varios a la vez, también en medicación | El subidor existe pero admite **1 archivo**, 2 categorías y una lista cerrada de MIME; sólo diagnósticos y procedimientos aceptan adjuntos. | Front (`attachment-uploader`) + **BACKEND** (tipos de dueño y rutas) |

---

## 2 · Horario: la cita no termina cuando debería

### 2.1 Qué se ve

En `/schedule/edit`, la vista previa dice **«Lunes: 8 turnos · 08:00 · 08:30 · 09:00 · … · 11:30»**
para una franja 08:00–12:00 de 30 minutos. Se lee como si el día terminara a las 11:30. Y después
de cambiar el horario, en «Mi agenda» hay turnos cuyo **fin no coincide** con la duración nueva.

### 2.2 Causa raíz (medida en el código)

Hay **dos** cosas, y conviene no mezclarlas.

**(a) La vista previa muestra sólo horas de inicio.** `agenda-create.html:275-303`:

```html
@for (turno of dia.turnos.slice(0, 3); track turno.desde) { {{ turno.desde }} · }
@if (dia.turnos.length > 3) { {{ dia.turnos[dia.turnos.length - 1].desde }} }
```

`11:30` es el **inicio** del último turno; el turno termina a las 12:00. La aritmética
(`agenda-turnos.ts` → `calcularDia`) es correcta y está probada contra la API viva («trunca porque el
backend trunca»). El defecto es de presentación.

**(b) Editar el horario no retira el anterior.** `agenda-create.ts`:

- `esCambio = computed(() => this.vigente() !== null)` (línea 374) sabe que se está editando.
- `crearPlantilla()` (≈845) **siempre** hace `scheduling.createTemplate(...)` → una plantilla nueva.
- Después llama `generarCupos(templateId)` (≈888) → `POST /scheduling/templates/:id/generate-slots`.
- **Nadie llama a `retireTemplate`** (`scheduling.client.ts:344`, existe y documenta exactamente
  este caso: «retira, no borra; suelta los cupos que nadie reservó, conserva los que tienen cita»).

Y `generate-slots` es **idempotente por instante de inicio**: el simulador
(`scheduling.handlers.ts:425-455`) y el backend (`scheduling-catalog.service.ts:546`, «los slots que
ya existen para el mismo instante se cuentan como `skipped`») **saltan** cualquier cupo cuyo
`startAt` ya exista para ese recurso. Consecuencia: si el lunes tenía turnos de 30' (08:00–08:30,
08:30–09:00…) y el doctor cambia a 45', el cupo de las 08:00 **se conserva con `endAt` 08:30** y el
nuevo de 08:00–08:45 se descarta como duplicado. La cita que se reserve ahí «no acaba a la hora que
debería». Lo mismo si acorta la franja: los cupos de la tarde vieja siguen publicados.

### 2.3 Qué cambiar

#### 2.3.1 Vista previa (front)

Archivo: `src/app/features/agenda/agenda-create/agenda-create.html`, bloque `agenda-create__previa`.

Reemplazar la tira de inicios por **rango + cuenta + fin del último turno**:

```html
<span class="agenda-create__previa-horas">
  de {{ dia.turnos[0].desde }} a {{ dia.turnos[dia.turnos.length - 1].hasta }}
  <span class="agenda-create__previa-detalle">
    ({{ dia.turnos.length }} {{ dia.turnos.length === 1 ? 'turno' : 'turnos' }} de
    {{ grupoDe(diasActivos()[$index].indice).controls.duracion.value }} min)
  </span>
</span>
```

Y mantener el aviso del resto («Te queda libre de 11:30 a 12:00») que ya existe. El texto final
para el caso de la captura: **«Lunes: de 08:00 a 12:00 (8 turnos de 30 min)»**.

Test (Vitest) en `agenda-create.spec.ts`: con franja 08:00–12:00 y 30', el texto de la vista previa
contiene `de 08:00 a 12:00` y no contiene `11:30` como cierre. Hay ya un `describe` de la vista
previa donde colgarlo.

#### 2.3.2 Retirar el horario vigente al publicar el cambio (front)

Archivo: `agenda-create.ts`, método `crearPlantilla(resourceId, policyId)`.

Nuevo orden, sólo cuando `esCambio()` es `true`:

1. `this.scheduling.retireTemplate(this.vigente()!.id)`.
   - Si responde **409** (tiene citas comprometidas — el contrato devuelve `details.bookingIds`), se
     muestra un `app-alert tone="error"` con el mensaje del servidor y **no se publica nada**. Es la
     misma política que la pantalla ya usa para el 422 de choque en el alta de cita: el texto del
     servidor tal cual.
2. Recién con el retiro en `200`, `createTemplate(...)` como hoy.
3. `generarCupos(nueva.id)` como hoy.

Encadenar con `switchMap` de rxjs (el repo ya lo usa en `data-access`) o con `subscribe` anidado como
hace el resto del archivo; lo importante es que **no se cree la plantilla nueva si el retiro
falló**, si no quedan dos vigentes.

Además, en el toast de éxito decir qué pasó con la vieja: el `RetiredTemplate` trae
`releasedSlots` y `keptSlots` → «Se soltaron 24 turnos libres del horario anterior; se conservaron 3
con cita».

Tests en `agenda-create.spec.ts`:

- «al cambiar el horario, primero retira el vigente»: con `vigente` cargado, `guardar()` produce
  `DELETE /scheduling/templates/<id>` **antes** que `POST /scheduling/resources/<r>/templates`.
- «si el retiro responde 409, no crea la plantilla nueva»: `expectNone` sobre el `POST`.
- «al publicar por primera vez no retira nada»: sin `vigente`, `expectNone` sobre el `DELETE`.

#### 2.3.3 El simulador tiene que hacer lo mismo que el backend con los cupos huérfanos

Archivo: `src/app/core/mock/handlers/scheduling.handlers.ts`.

- `DELETE /scheduling/templates/:id` (≈409) ya borra los cupos libres y futuros de la plantilla
  retirada. **Verificar** que devuelve `{ releasedSlots, keptSlots }` con la forma que espera
  `RetiredTemplate` en `scheduling.types.ts`, y que responde **409** si hay reservas confirmadas
  futuras sobre esa plantilla (hoy no lo hace; hace falta para probar el camino del error):

  ```ts
  const comprometidas = reservas.filtrar((r) =>
    r.startAt > ahora() &&
    ['BK-CONFIRMED', 'BK-CHECKED-IN'].includes(codigoDeEstado(r.statusConceptId)) &&
    cupos.get(r.bookableSlotId)?.scheduleTemplateId === t.id,
  );
  if (comprometidas.length > 0) {
    return conflict('El horario tiene citas comprometidas', { bookingIds: comprometidas.map((r) => r.id) });
  }
  ```

- `generate-slots`: dejarlo idempotente como está (es lo que hace el backend). El arreglo no es
  regenerar encima, es retirar antes — punto 2.3.2.

#### 2.3.4 Verificación en navegador

1. `medica@alovida.mock` → `/schedule/edit`. Cambiar Lunes de 30' a 45'. Guardar.
2. Ir a `/schedule` (Mi agenda), semana próxima, lunes: los cupos deben ser 08:00–08:45,
   08:45–09:30… **ninguno** de 30'.
3. Volver a `/schedule/edit`: la vista previa dice «de 08:00 a 12:00 (5 turnos de 45 min)» y «Te queda
   libre de 11:45 a 12:00 (15 min)».
4. Capturas: `artifacts/horario-01-previa.png`, `artifacts/horario-02-agenda-lunes.png`.

---

## 3 · Los formularios «respectivos» en la historia clínica

### 3.1 Qué hay

- El bloque **ya existe y ya está conectado**: `specialty-form-block` pide `GET /charts/templates`
  (`ChartTemplatesClient`), preselecciona por la especialidad del profesional y dibuja los campos
  (`specialty-form-block.ts:248-560`). Su selector ofrece además cuatro bloques fijos
  (`BLOQUE_DIAGNOSTICO`, `PLANTILLA_HOJA_LIBRE`, `BLOQUE_CIRUGIA`, `BLOQUE_ODONTOLOGIA`,
  `BLOQUE_LABORATORIO`, líneas 77-96).
- El backend siembra **43 formularios estándar** con procedencia documentada
  (`mantra-core-health-api/src/common/seed/data/clinical-forms/*/*.json`, catálogo en
  `catalog.ts`, seed en `clinical-forms-seed.service.ts`). Lista completa en el anexo A.
- **El simulador sirve sólo 4** (`clinical.handlers.ts`, `PLANTILLAS_DE_EXPEDIENTE`, ≈495):
  `CARDIO-BASE`, `PEDIA-CONTROL`, `GINE-PRENATAL`, `MEDINT-GENERAL`, con códigos que **no coinciden**
  con los del backend (`CARDIO_FICHA_BASE`, `PEDIA_CONTROL_NINO_SANO`, `GINOBS_CONTROL_PRENATAL`,
  `MEDINT_EVALUACION_BASE`).

Por eso «no deja poner los formularios respectivos»: para una doctora de medicina general, de
neurología o de odontología el catálogo del simulador **no tiene nada**, y para las cuatro que sí
tiene, los campos son una versión corta inventada.

### 3.2 Qué cambiar: portar los 43 al simulador, desde la fuente

No copiar a mano. Escribir un generador que lea los JSON del backend y produzca el fixture.

**Archivo nuevo:** `mantra-core-health/scripts/gen-chart-templates-fixture.mjs`

```js
// Lee ../mantra-core-health-api/src/common/seed/data/clinical-forms/**/*.json y escribe
// src/app/core/mock/fixtures/plantillas-de-expediente.generated.ts
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ORIGEN = join(process.cwd(), '..', 'mantra-core-health-api', 'src', 'common', 'seed', 'data', 'clinical-forms');
const DESTINO = join(process.cwd(), 'src', 'app', 'core', 'mock', 'fixtures', 'plantillas-de-expediente.generated.ts');

const fichas = [];
for (const carpeta of readdirSync(ORIGEN, { withFileTypes: true }).filter((d) => d.isDirectory())) {
  for (const archivo of readdirSync(join(ORIGEN, carpeta.name)).filter((f) => f.endsWith('.json'))) {
    const json = JSON.parse(readFileSync(join(ORIGEN, carpeta.name, archivo), 'utf8'));
    fichas.push({
      code: json.code,
      name: json.name,
      specialty: json.specialty.code,          // p. ej. MEDICINA_GENERAL, TRANSVERSAL
      provenance: json.provenance,
      fields: json.fields.map((f) => ({
        code: f.code, name: f.name, dataType: f.dataType, required: f.required ?? false,
        ...(f.options ? { options: f.options, multiple: f.multiple ?? false } : {}),
      })),
    });
  }
}
writeFileSync(DESTINO,
  `/* GENERADO por scripts/gen-chart-templates-fixture.mjs — no editar a mano. */\n` +
  `export const FICHAS_ESTANDAR = ${JSON.stringify(fichas, null, 2)} as const;\n`);
console.log(`${fichas.length} fichas`);
```

Agregar el script a `package.json`: `"mock:chart-templates": "node scripts/gen-chart-templates-fixture.mjs"`.

**En `clinical.handlers.ts`:** reemplazar el array literal de `PLANTILLAS_DE_EXPEDIENTE` por:

```ts
import { FICHAS_ESTANDAR } from '../fixtures/plantillas-de-expediente.generated';

export const PLANTILLAS_DE_EXPEDIENTE = FICHAS_ESTANDAR.map((f) =>
  plantilla(
    f.code,
    f.name,
    especialidadDelFormulario(f.specialty),
    f.fields.map((c) => [c.code, c.name, tipoDeDato(c.dataType), c.required, c.options, c.multiple] as const),
    f.provenance,
  ),
);
```

Dos funciones de apoyo, al lado de `plantilla()` (≈547):

- `especialidadDelFormulario(code)`: mapea el `specialty.code` del JSON al concepto de
  `ESPECIALIDAD[...]` de `conceptos.ts` (son los 63 códigos canónicos de `VS_MEDICAL_SPECIALTY`; el
  JSON usa los mismos códigos: `MEDICINA_GENERAL`, `CARDIOLOGIA`, `ODONTOLOGIA`…). Para
  `TRANSVERSAL` devolver el concepto transversal que ya usa `specialty-form-block`
  (`conceptoTransversal`, línea 284) — si no existe en `conceptos.ts`, acuñarlo con
  `uuid('concept-specialty-TRANSVERSAL')` y exportarlo.
- `tipoDeDato(dataType)`: el JSON usa `text | string | number | boolean | date | code`; el bloque del
  front dibuja por `tipoDibujable(dataType)` (`specialty-form-block.ts:785`). Revisar qué literales
  acepta esa función y mapear (`string → TEXT`, etc.). No inventar tipos: si uno no se puede dibujar,
  que caiga a texto y quede anotado.

Y extender `plantilla()` para recibir `provenance` y devolverla en el objeto: el bloque ya la
muestra («De dónde salió») cuando viene.

**Preselección:** `specialty-form-block.ts:537-560` (`anamnesisGeneral`, `preseleccionar`) ya elige
la ficha de la especialidad del profesional y, si no hay, la anamnesis general. Con 43 fichas eso
empieza a funcionar solo. Verificar que `plantillasPropias` (línea 292) filtra por
`specialtyConceptId` del perfil de la sesión.

### 3.3 Pruebas

- Spec nuevo `src/app/core/mock/handlers/clinical.handlers.spec.ts` (o extender el existente):
  `GET /charts/templates` devuelve **43** plantillas; `?specialtyConceptId=<ODONTOLOGIA>` devuelve
  2 (`ODONTO_ANAMNESIS`, `ODONTO_ODONTOGRAMA_OMS`); cada campo tiene `fieldId`, `assignmentId`,
  `dataType` dibujable.
- Guardia de deriva (como `conceptos.spec.ts`): el fixture generado tiene exactamente la cantidad de
  archivos JSON del backend → si alguien agrega una ficha al backend y no regenera, la prueba avisa.

### 3.4 Verificación en navegador

1. `medica@alovida.mock` (cardióloga) → paciente → «Atender» → pestaña «Formulario clínico».
2. El selector muestra «Ficha cardiológica — versión general base» y «Evaluación del riesgo
   cardiovascular (OMS/OPS)» arriba, y «Ver todas» despliega las 43.
3. Elegir la ficha, completar, guardar: `POST /forms/instances` (ver `surveys-forms.handlers.ts`) y
   la respuesta aparece en «Respuesta registrada» del mismo bloque.
4. Captura: `artifacts/fichas-01-selector-43.png`, `artifacts/fichas-02-cardio-completa.png`.

---

## 4 · Diagnóstico nuevo sobre el expediente, con duración y «crónico»

### 4.1 Qué hay

- El formulario **existe**: `diagnosis-block` (dentro de «Atención», como opción «Diagnóstico — del
  catálogo CIE-10» del selector). Campos: diagnóstico (CIE-10), categoría, severidad, lateralidad,
  **curso clínico**, inicio, **fecha esperada de resolución**, hallazgos (`diagnosis-block.html:95-180`;
  señales en `.ts:211-225`; envío en `registrar()` línea 430).
- El contrato ya lo soporta: `NewCondition` (`clinical.types.ts:414`) y `CreateConditionDto`
  (`condition.dto.ts`) tienen `clinicalCourseConceptId`, `expectedResolutionAt`, `encounterId`,
  `noteText`. La entidad tiene las columnas (`conditions.entity.ts`: `encounter_id`,
  `clinical_course_concept_id`, `expected_resolution_at`).
- El expediente (`/medical-records/:id`) **no ofrece registrar**: `patient-chart.html` es lectura +
  «Cambiar estado» + «Adjuntar archivo» sobre cada fila. El comentario del propio `estadoDe()`
  (`patient-chart.ts` ≈590) lo dice: «esta pantalla es de lectura».

### 4.2 Por qué en el simulador no aparece «crónico»

`app-concept-select` pide `GET /system-context/dynamic-enums?target=clinical.conditions.clinical_course_concept_id`.
El simulador resuelve el target contra la tabla `ENUMS` de `misc.handlers.ts` (≈línea 22-39) por
expresión regular, y **esa tabla no tiene entrada para `clinical_course`, `laterality` ni
`category` de condiciones**; caen al default `VS_RECORD_STATUS` («Estado»). El selector de curso
muestra Activo/Archivado en lugar de Agudo/Crónico. Además `POST /clinical/conditions` en el
simulador (`clinical.handlers.ts:319-341`) **descarta** `clinicalCourseConceptId` y
`expectedResolutionAt` (no están en el tipo del `cuerpo<…>` ni en `CondicionSimulada`).

### 4.3 Qué cambiar

#### 4.3.1 Simulador: value set de curso clínico y bindings

`src/app/core/mock/fixtures/conceptos.ts`, junto a `ESTADO_CONDICION` (≈498):

```ts
conjunto('VS_CONDITION_CLINICAL_COURSE', 'Curso clínico', 'Cómo evoluciona la condición.');
export const CURSO_CLINICO = definir('VS_CONDITION_CLINICAL_COURSE', [
  ['COURSE-ACUTE', 'Agudo'],
  ['COURSE-SUBACUTE', 'Subagudo'],
  ['COURSE-CHRONIC', 'Crónico'],
  ['COURSE-RECURRENT', 'Recurrente'],
  ['COURSE-UNKNOWN', 'Sin declarar'],
]);
conjunto('VS_CONDITION_CATEGORY', 'Categoría del diagnóstico', 'Diagnóstico del encuentro o problema de la lista.');
export const CATEGORIA_CONDICION = definir('VS_CONDITION_CATEGORY', [
  ['CAT-ENCOUNTER-DIAGNOSIS', 'Diagnóstico del encuentro'],
  ['CAT-PROBLEM-LIST-ITEM', 'Problema de la lista'],
]);
conjunto('VS_LATERALITY', 'Lateralidad', 'El lado afectado.');
export const LATERALIDAD = definir('VS_LATERALITY', [
  ['LAT-LEFT', 'Izquierda'], ['LAT-RIGHT', 'Derecha'], ['LAT-BILATERAL', 'Bilateral'],
]);
```

> Los códigos exactos del backend están en `mantra-core-health-api/src/common/seed/dynamic-enum-catalog.ts`
> líneas 927 (categoría), 950 (lateralidad) y 988 (curso). **Copiar los códigos de ahí**, no los de
> arriba, para que las pantallas que filtran por código (como `CODIGO_OCUPACION_OTRA`) funcionen igual
> contra la API real. Es la misma clase de defecto que ya mordió tres veces (departamentos,
> especialidades, ocupaciones): el simulador inventando códigos que las pantallas no reconocen.

`src/app/core/mock/handlers/misc.handlers.ts`, tabla `ENUMS`, **antes** de la entrada de
`/severity/` (el orden importa: gana la primera regex que casa):

```ts
[/conditions\.clinical_course_concept_id/, 'VS_CONDITION_CLINICAL_COURSE', 'Curso clínico'],
[/conditions\.category_concept_id/, 'VS_CONDITION_CATEGORY', 'Categoría'],
[/conditions\.laterality_concept_id/, 'VS_LATERALITY', 'Lateralidad'],
[/conditions\.clinical_status_concept_id/, 'VS_CONDITION_CLINICAL_STATUS', 'Estado clínico'],
```

Guardia: en `misc.handlers.spec.ts` (crearlo si no existe), para cada `TARGET_*` exportado por
`diagnosis-block.ts` (líneas 42-60) el enum devuelto **no** es `VS_RECORD_STATUS`. Esa prueba es la
que impide que vuelva a pasar.

#### 4.3.2 Simulador: persistir curso y fecha esperada

`clinica.ts` → `CondicionSimulada` (línea 30): agregar
`readonly clinicalCourseConceptId?: string; readonly expectedResolutionAt?: string;`.

`clinical.handlers.ts` → `POST /clinical/conditions` (319): leerlos del cuerpo y guardarlos;
devolver `clinicalCourse: datos.clinicalCourseConceptId ?? null` en lugar de `null` fijo. La lectura
`GET /clinical/patients/:id/summary` ya devuelve la fila entera (`sinPaciente`), así que la ficha los
recibe sin más.

#### 4.3.3 Front: «duración promedio» y la opción «crónico»

Archivo: `diagnosis-block.html/.ts`. Hoy hay dos campos sueltos: «Curso clínico» y «Fecha esperada
de resolución». El pedido es que la duración sea la pregunta y que «crónico» aparezca como opción.
Cambio mínimo que lo cumple sin tocar el contrato:

1. Debajo de «Curso clínico», un grupo de chips **«Duración estimada»** —`7 días · 14 días · 30 días
   · 90 días · Crónico / seguimiento continuo`— igual que los chips de duración de la receta
   (`medication-block.html:268-285`, `opcionesDuracionRapida`, `fijarDuracion`). Reutilizar
   `app-chip selectable`.
2. Al elegir días: `fechaEsperada = inicio ?? hoy + N días` y `cursoClinico` pasa a **Agudo** (o
   Subagudo si N > 30) **sólo si el usuario no eligió curso a mano**. Al elegir «Crónico»:
   `cursoClinico = COURSE-CHRONIC`, `fechaEsperada = null` y el date-picker de fecha esperada se
   **oculta** (con `@if`, no con CSS — regla del repo: un campo escondido igual se tabula).
3. El date-picker de fecha esperada queda visible sólo cuando el curso **no** es crónico, con el hint
   actual («Tiene sentido sobre todo en curso agudo o subagudo»).
4. `puedeRegistrar` no cambia: la duración es opcional en el contrato y debe seguir siéndolo.

Buscar el concepto «crónico» **por código**, no por posición: en `cargarOpciones` (línea 364) ya se
guardan las opciones del enum de curso (`opcionesCurso`); exponer un `computed` `conceptoCronico` que
encuentre `code === 'COURSE-CHRONIC'` (o el código real del backend).

Tests en `diagnosis-block.spec.ts`:

- «elegir 14 días fija la fecha esperada 14 días después del inicio y curso agudo».
- «elegir crónico borra la fecha esperada y oculta el campo».
- «con crónico, el cuerpo del POST lleva `clinicalCourseConceptId` y no `expectedResolutionAt`».

#### 4.3.4 Front: «Nuevo diagnóstico» desde el expediente

Archivo: `patient-chart.html/.ts` (`/medical-records/:id`).

1. En la pestaña **Diagnósticos**, encima de la tabla, un botón `app-button variant="primary"`
   «Nuevo diagnóstico» (`data-testid="expediente-nuevo-diagnostico"`). Sólo si la sesión puede
   escribir: mismo criterio que usa «Atención» (`encounter-workspace.ts`, `puedeRegistrar`) — rol
   `PRACTITIONER`/`CLINICIAN` y `auth.activeTenantId() !== null`.
2. Al apretarlo se abre **el mismo `app-diagnosis-block`** dentro de un `<app-content-dialog>` — en
   modal y no en un panel inline, que es lo que pide la fase 3.2 del plan de evoluciones para toda
   edición que pida datos —, con
   `[patientProfileId]` y `[encounterId]="null"` (ver 4.3.5 para elegir la cita) y `(cambio)="recargar()"`.
3. Al registrar, el bloque ya emite `cambio` → `recargar()` vuelve a pedir el resumen y la fila
   aparece en la tabla.

**Importante:** el bloque hoy exige encuentro para registrar (`hayEncuentro`, línea 273; el aviso
«sin encuentro» está en el HTML). Para el expediente ese requisito cambia: el `encounterId` pasa a
ser **opcional** (el contrato lo declara opcional) y se elige con el select de 4.3.5. Revisar
`puedeRegistrar` (287) para que no dependa de `hayEncuentro()` cuando el bloque se usa fuera de
«Atención» — un `input<boolean>` `exigeEncuentro` con default `true` mantiene el comportamiento
actual en «Atención» y lo relaja en el expediente.

Layout: el diálogo/panel sigue la regla 6 (campos en 2 columnas desde 780 px, 3 desde 1120 px). La
ficha del expediente ya está a lo ancho.

#### 4.3.5 Front: select «¿En qué cita se detectó?»

Archivo: `diagnosis-block.html/.ts`.

1. Nuevo `input<readonly EncuentroParaElegir[]>` `encuentros` con `{ id, etiqueta, enCurso }`. Lo
   arma quien hospeda al bloque:
   - «Atención» (`encounter-workspace.ts`): desde `datos()?.encounters` — hoy sólo expone
     `encuentrosEnCurso` (299); agregar `encuentrosParaElegir` con **todos** (`endAt` definido =
     finalizado), ordenados del más reciente al más viejo, etiqueta
     `«9 Sep 2026, 08:00 · Chequeo anual»` (`startAt | date:'d MMM y, HH:mm'` + `reasonText`) y sufijo
     «· en curso» cuando `endAt` es `undefined`.
   - Expediente (`patient-chart.ts`): mismo cálculo desde `datos()?.resumen.encounters`.
2. En el formulario, **antes** de «Diagnóstico», un `app-form-field label="¿En qué cita se detectó?"`
   con `app-select` (`SelectOption<string | null>`), primera opción `{ value: null, label: 'Sin cita
   asociada' }`. Preseleccionar el encuentro en curso cuando existe (es el comportamiento de hoy).
3. `registrar()` manda `encounterId` sólo si hay elección (`...(encuentro === null ? {} : { encounterId: encuentro })`).
   El DTO ya lo acepta; el simulador ya lo guarda (línea 328).
4. En la tabla del expediente, columna «Cita» (ver 6.3 para la mecánica de columnas): la etiqueta del
   encuentro, o «—».

Test: «manda el `encounterId` elegido y no el del encuentro en curso cuando se eligió otro».

### 4.4 Verificación en navegador

1. `/medical-records/<paciente>` → pestaña Diagnósticos → «Nuevo diagnóstico».
2. Elegir cita «7 Sep 2026, 09:00 · Seguimiento post infarto», diagnóstico «Hipertensión esencial»,
   chip **Crónico** → el campo de fecha esperada desaparece.
3. Registrar → la fila aparece con estado «Activa», curso «Crónico», cita «7 Sep 2026».
4. Repetir con «14 días» → fila con «Resuelve ~ 24 Sep 2026».
5. Capturas `artifacts/dx-01-nuevo.png`, `artifacts/dx-02-cronico.png`, `artifacts/dx-03-tabla.png`.

---

## 5 · Alergias: mismo patrón que diagnósticos

### 5.1 Qué hay

- Cliente HTTP: `ClinicalClient.createAllergyIntolerance` (`clinical.client.ts:440`) → `POST
  /clinical/allergy-intolerances`. Contrato `NewAllergyIntolerance` (`clinical.types.ts:478`):
  `substanceConceptId` (obligatorio), `typeConceptId`, `categoryConceptId`, `criticalityConceptId`,
  `reactions[] { manifestationConceptId, severityConceptId?, description? }`.
- **Ninguna pantalla lo usa** (`grep createAllergyIntolerance src/app/features` → 0). La alergia sólo
  se ve (banda ámbar arriba del expediente + pestaña).
- **No hay `encounter_id`** ni en `CreateAllergyIntoleranceDto` ni en la tabla
  (`allergy_intolerances.entity.ts`: custodian, patient, substance, type, category, criticality,
  clinical_status, verification_status, recorded_by…). → «basarla en una cita» exige columna nueva.
- No hay bindings de enum para alergias **ni en el backend** (`dynamic-enum-catalog.ts` no declara
  ningún target `clinical.allergy_intolerances.*`) **ni en el simulador**. El simulador sí tiene los
  value sets `VS_ALLERGY_CATEGORY` y `VS_ALLERGY_CRITICALITY` (`conceptos.ts:521-535`); las
  sustancias de las alergias sembradas salen del catálogo de medicamentos más dos sustancias sueltas
  (`clinica.ts:211`).

### 5.2 Qué cambiar

#### 5.2.1 Front: bloque `allergy-block` (nuevo)

Generar con el CLI, como el resto: `ng generate component features/clinical-record/patient-chart/allergy-block`.

Copiar la estructura de `diagnosis-block` (inputs `patientProfileId`, `encounterId`, output `cambio`;
señales por campo; `registrar()`; `puedeRegistrar`; `app-form-actions`). Campos:

| Campo | Control | Fuente | Obligatorio |
| --- | --- | --- | --- |
| ¿En qué cita se detectó? | `app-select` | `encuentros` (igual que 4.3.5) | no |
| Sustancia | `app-reference-combobox` con lupa | catálogo de medicamentos (`TARGET_MEDICAMENTO`, ya usado por la receta) **+** alimentos/ambientales: un value set `VS_ALLERGY_SUBSTANCE` a acuñar en el simulador con las sustancias no medicamentosas más comunes (maní, mariscos, látex, polvo, polen, picadura de himenóptero…) | **sí** |
| Tipo | `app-concept-select` target `clinical.allergy_intolerances.type_concept_id` | `VS_ALLERGY_TYPE` (alergia / intolerancia) | no |
| Categoría | `app-concept-select` target `clinical.allergy_intolerances.category_concept_id` | `VS_ALLERGY_CATEGORY` | no |
| Criticidad | `app-concept-select` target `clinical.allergy_intolerances.criticality_concept_id` | `VS_ALLERGY_CRITICALITY` | no |
| Reacción: manifestación | `app-concept-select` target `clinical.allergy_reactions.manifestation_concept_id` | `VS_ALLERGY_MANIFESTATION` (urticaria, angioedema, anafilaxia, broncoespasmo, náuseas…) | sí, si se agrega una reacción |
| Reacción: severidad | `app-concept-select` target `…reactions.severity_concept_id` | `VS_SEVERITY` (ya existe) | no |
| Reacción: descripción | `app-textarea` | — | no |
| Adjuntos | `app-attachment-uploader` tras guardar | ver §7 | no |

Se permite **más de una reacción**: lista con «Agregar reacción», igual que los nombres extra del
alta de paciente (`register-patient.ts`, `nombresExtra`).

Dónde se ofrece:
- En «Atención»: nueva opción del selector de `specialty-form-block` → `BLOQUE_ALERGIA = 'bloque-alergia'`
  con etiqueta «Alergia o intolerancia», y `<app-allergy-block>` en su `@if` (patrón de
  `esDiagnostico`, `specialty-form-block.html:38`).
- En el expediente: botón «Nueva alergia» en la pestaña Alergias, mismo mecanismo que 4.3.4.

#### 5.2.2 Simulador

- `conceptos.ts`: acuñar `VS_ALLERGY_TYPE`, `VS_ALLERGY_MANIFESTATION`, `VS_ALLERGY_SUBSTANCE`
  (copiar códigos del backend si existen; si no, dejarlo anotado como provisional en el comentario,
  como hace `bo-occupations.catalog.ts`).
- `misc.handlers.ts` → `ENUMS`: entradas para `allergy_intolerances.type|category|criticality` y
  `allergy_reactions.manifestation|severity`. Recordar que `/severity/` ya casa: poner la de
  reacciones **antes** si su value set es distinto, o dejar que caiga en `VS_SEVERITY` si es el mismo.
- `clinica.ts` → `AlergiaSimulada`: `encounterId?`, `reactions?: { manifestationConceptId; severityConceptId?; description? }[]`.
- `clinical.handlers.ts` → `POST /clinical/allergy-intolerances` (357): leer y guardar todos los
  campos; devolver `reactionIds` con un id por reacción. Agregar
  `POST /clinical/allergy-intolerances/:id/attachments` (ver §7).

#### 5.2.3 BACKEND / MODELO (no se hace en `mockup`; queda en `PENDIENTES-BACKEND.md`)

1. **Columna `encounter_id uuid NULL`** (FK → `clinical.encounters`) en
   `clinical.allergy_intolerances`. Camino obligatorio: `mantra-core-health-model/Mantra Core Health
   Context/modules/diagram_08_clinical.puml` → `python salud-db/gen_ddl.py` → `SQL/` → patch en
   `SQL/patches/` para bases vivas → `gen_entities.py` → entidad. **Nunca** `ALTER` a mano ni
   migración del ORM (ADR-0021).
2. `CreateAllergyIntoleranceDto` + `AllergyItemDto` (`clinical-read.dto.ts:85`): `encounterId?`.
3. Bindings de enum en `dynamic-enum-catalog.ts` para los cinco targets de la tabla de 5.2.1, con sus
   value sets (los value sets se declaran en el vault + `VS_OWNER` de `gen_seeds.py`, ver
   CLAUDE.md «Bloqueador conocido» de `devices.platform_concept_id`, que es el mismo trámite).
4. `POST /clinical/allergy-intolerances/:id/attachments` (ver §7.3).

### 5.3 Verificación en navegador

Registrar «Penicilina · alergia · medicamento · alta criticidad · reacción: anafilaxia, grave» desde
el expediente, atada a la cita del 7 Sep. Debe aparecer en la banda ámbar de arriba **y** en la
pestaña Alergias con la cita. Captura `artifacts/alergia-01-nueva.png`.

---

## 6 · Tratamientos sobre un diagnóstico; la tabla dice a qué receta pertenece

### 6.1 Qué hay

- Escritura: el formulario de receta ya pregunta **«¿Para qué es esta receta?»** con los diagnósticos
  del expediente (`medication-block.html:311-320`, `opcionesDeIndicacion`, `.ts:401-410`) y manda
  `indicationConditionId` (`recetar()`, ≈1016). El backend lo valida: **422 si la condición no es
  del mismo paciente** (`NewMedicationRequest` doc, `clinical.types.ts:388-398`).
- Lectura: el backend **sí lo devuelve** (`MedicationRequestItemDto.indicationConditionId`,
  `clinical-read.dto.ts:77`), pero el tipo de vista `MedicationRequest` (`clinical.types.ts:54-73`)
  **no lo declara** → el mapper `toMedicationRequest` (`clinical.client.ts:776`) lo conserva por el
  `...resto`, pero nadie puede leerlo con tipos. `encounterId` tampoco está en el tipo de vista.
- Simulador: `RecetaSimulada` (`clinica.ts:56`) **no guarda** `indicationConditionId` ni
  `encounterId`; el `POST` (`clinical.handlers.ts:286`) los descarta.
- Tabla «Medicación» del expediente (`patient-chart.ts:327-336`): principal = medicamento,
  secundario = dosis · frecuencia, estado, fecha, detalle «Con fin previsto». **Nada del diagnóstico**.
- Lista de recetas dentro de «Atención» (`RecetaEnFicha`, `medication-block.ts:152`;
  `encounter-workspace.ts:352`): tampoco lleva el diagnóstico.

### 6.2 Qué cambiar

#### 6.2.1 Contrato de vista y simulador

`clinical.types.ts` → `MedicationRequest`: agregar

```ts
readonly encounterId?: string;
/** La condición que motiva la receta — «para qué es» (v4.1.6). */
readonly indicationConditionId?: string;
```

`clinica.ts` → `RecetaSimulada`: `encounterId?`, `indicationConditionId?`. `clinical.handlers.ts` →
`POST /clinical/medication-requests`: leerlos del cuerpo y guardarlos. Sembrar en las recetas del
fixture (`clinica.ts`, generador de recetas) un `indicationConditionId` que apunte a una condición
**del mismo paciente**, para que la tabla tenga algo que mostrar de entrada.

#### 6.2.2 La tabla «Medicación» del expediente

`patient-chart.ts`:

1. `FilaClinica` (línea 97): agregar `readonly diagnostico?: string; readonly cita?: string;`.
2. `medicacion` (327): `diagnostico: this.etiquetaDeCondicion(fila.indicationConditionId)` donde la
   función busca en `datos()?.resumen.conditions` por id y devuelve `label(codeConceptId)`; si la
   receta tiene `indicationText` (ver 6.2.4) devuelve ese texto; si no hay nada, `''`.
   `cita: this.etiquetaDeEncuentro(fila.encounterId)` con el formato de 4.3.5.
3. `columnasPara` (528): para `clave === 'medicacion'` agregar
   `{ key: 'diagnostico', header: 'Diagnóstico', priority: 2 }` y `{ key: 'cita', header: 'Receta', priority: 3 }`.
   Para `diagnosticos` y `alergias`, la columna `cita` («Cita») cuando alguna fila la tiene, con el
   mismo patrón de `hayDetalle`.

> «Receta a la que pertenece»: en este modelo **cada `medication_request` es una línea de receta**;
> lo que agrupa varias líneas es el encuentro (`encounterId`) y la fecha. La columna «Receta» muestra
> por eso «9 Sep 2026, 08:00» (el encuentro) y, si no hay encuentro, la fecha de `validFrom`. Si el
> cliente quiere un **número de receta** compartido por varias líneas, eso es una entidad que el
> modelo no tiene (`medication_requests` no tiene `prescription_id`) y va a PENDIENTES como decisión
> de modelo, no se inventa en el front.

#### 6.2.3 «Un tratamiento exige diagnóstico previo»

`medication-block.ts`: hoy `puedeRecetar` no mira la indicación. Regla nueva, **configurable**:

- `input<boolean>` `exigeDiagnostico` con default `true`.
- `puedeRecetar = … && (!this.exigeDiagnostico() || this.indicacion() !== null || this.indicacionLibre().trim() !== '')`.
- Cuando falta, el `app-form-actions` queda deshabilitado y arriba del select un
  `app-alert tone="info"`: «Elegí el diagnóstico que motiva esta receta, o escribí el motivo».

La opción vacía «Sin diagnóstico asociado» **se conserva** en la lista (el contrato lo permite y el
propio código explica por qué: recetas sintomáticas/profilácticas), pero con `exigeDiagnostico`
activo elegirla obliga a escribir el motivo libre de 6.2.4.

#### 6.2.4 «Un título de diagnóstico propio» (psiquiatría y recetas sin condición registrada)

Front (`medication-block`):

1. En `opcionesDeIndicacion` agregar al final `{ value: OTRO_MOTIVO, label: 'Otro motivo — escribirlo' }`
   con `const OTRO_MOTIVO = '__otro__'`.
2. Señal `indicacionLibre = signal('')`. Cuando `indicacion() === OTRO_MOTIVO` se dibuja (con `@if`)
   un `app-form-field label="¿Cuál es el motivo?"` con `app-input` (`data-testid="receta-motivo-libre"`,
   placeholder «Trastorno de ansiedad generalizada», máximo 200 caracteres).
3. `recetar()`: si `indicacion() === OTRO_MOTIVO` → **no** mandar `indicationConditionId`; mandar
   `indicationText: this.indicacionLibre().trim()`.
4. `NewMedicationRequest` (`clinical.types.ts:353`): `readonly indicationText?: string;` con el
   comentario de que **contra la API de hoy da 400** (`forbidNonWhitelisted`) hasta que exista la
   columna — misma advertencia que llevan P19/P20/P22.
5. `MedicationRequest` (lectura): `readonly indicationText?: string;` y la tabla lo muestra en
   «Diagnóstico» cuando no hay `indicationConditionId`.

Simulador: `RecetaSimulada.indicationText?`, guardar en el `POST`, devolver en el resumen.

**BACKEND / MODELO** (a `PENDIENTES-BACKEND.md`): columna `indication_text varchar(200) NULL` en
`clinical.medication_requests` (hoy la entidad tiene `indication_condition_id`, línea 147, y **no**
tiene texto). Mismo camino que 5.2.3 (`.puml → gen_ddl → SQL/ → patch → entidad`), más
`CreateMedicationRequestDto.indicationText?` con `@MaxLength(200)`, `MedicationRequestItemDto.indicationText?`
y la regla de exclusión en el servicio: **si vienen los dos, gana el concepto** y el texto se descarta
(el mismo criterio que `occupation_free_text` vs `occupation_concept_id` en `persons`). La receta
impresa (`clinical-pdf`) imprime uno u otro bajo «Diagnóstico».

Tests (`medication-block.spec.ts`):

- «con `exigeDiagnostico`, sin indicación ni motivo el botón está deshabilitado».
- «elegir Otro motivo muestra el campo y manda `indicationText`, no `indicationConditionId`».
- «elegir un diagnóstico manda `indicationConditionId` y no `indicationText`».

### 6.3 Verificación en navegador

1. «Atención» → pestaña Receta. Sin diagnóstico, «Prescribir» deshabilitado con el aviso.
2. Elegir «Hipertensión esencial» → prescribir → en «Recetas» la línea dice el diagnóstico.
3. Elegir «Otro motivo», escribir «Insomnio de conciliación» → prescribir.
4. `/medical-records/<id>` → Medicación: dos filas con columna «Diagnóstico» («Hipertensión
   esencial» / «Insomnio de conciliación») y «Receta» con la fecha del encuentro.
5. Capturas `artifacts/rx-01-exige-dx.png`, `artifacts/rx-02-otro-motivo.png`, `artifacts/rx-03-tabla.png`.

---

## 7 · Adjuntos en todos los formularios

### 7.1 Qué hay

- **Front, subidor:** `app-attachment-uploader` (`shared/components/organisms/attachment-uploader/`).
  Sube (`POST /common/files/upload`) y liga (`POST /common/files/:id/links` o el `linkVia` que le
  pasen). Hoy: **1 archivo** (`[maxFiles]="1"`, `attachment-uploader.html:23`), **10 MB**
  (`MAX_BYTES`, `.ts:26`), categoría `DOCUMENT|IMAGE` y sensibilidad `NORMAL|PHI` por radios.
- **Front, campo de archivo:** `app-file-input` **ya admite** `multiple`, `maxFiles`, `accept`,
  `maxSizeBytes`, y desde `3ce6f5d` además **arrastrar y soltar** y previsualizaciones
  (`molecules/file-preview`, `shared/forms/file-accept.ts`). El límite de uno es del **subidor**, no
  del campo: `attachment-uploader` le pasa `[maxFiles]="1"`.
- **Front, tipos de dueño:** `OWNER_TYPES = ['USER','PATIENT','TENANT','CONDITION','PROCEDURE']`
  (`files.types.ts:12-18`). El comentario de al lado explica que sumar un tipo **no toca el modelo**:
  es un concepto que el backend acuña en `CONCEPTS.OWNER_*` y siembra al arrancar.
- **Front, dónde se ofrece:** sólo en `diagnosis-block` (tras registrar) y en la fila de Diagnósticos
  del expediente (`patient-chart.html`, `celdaAcciones`, «Adjuntar archivo»). Ningún otro formulario
  ni pestaña.
- **Backend:** `OwnerType` (`common/dto/enums.ts:8-16`) tiene los mismos cinco; rutas
  `POST /clinical/conditions/:id/attachments` y `POST /clinical/procedures/:id/attachments`
  (`clinical-records.controller.ts:96,232`). La receta para cualquier otro recurso es de **diez
  líneas** y ya está escrita en `procedures.service.ts` → `attachFile()`: buscar el recurso, loguear,
  `this.filesService.createLink(dto.fileId, { ownerType, ownerId }, actor)`.
- **Backend, tipos de archivo:** `UPLOAD_MIME_ALLOWLIST` (`file-upload.service.ts`): `IMAGE` =
  jpeg/png/webp/gif; `DOCUMENT` = pdf + esas imágenes + docx + xlsx + txt. El tipo se **detecta por
  firma de bytes** (`sniffMimeType`), no por extensión. Un solo archivo por petición
  (`FileInterceptor('file', { limits: { files: 1 } })`, `common-files.controller.ts:74`); tamaño por
  `FILE_STORAGE_MAX_SIZE_BYTES`.
- **Backend, documentos del expediente:** `POST /charts/documents` (`chart-documents.controller.ts`,
  `CreateDocumentDto` con `files: DocumentFileInputDto[]` — **varios archivos**, `encounterId`,
  `categoryConceptId`, `title`). Es el mecanismo genérico «adjuntar N archivos a esta atención». **No
  tiene cliente en el front** (`grep charts/documents src/app` → 0).

### 7.2 Qué cambiar en el front

#### 7.2.1 El subidor admite varios archivos y cualquier formato

`attachment-uploader.ts/.html`:

1. `readonly maxFiles = input<number>(10)` y pasarlo al `app-file-input` (`[multiple]="maxFiles() > 1"`,
   `[maxFiles]="maxFiles()"`). El texto del hint: «Hasta 10 archivos de 10 MB cada uno».
2. `subir()` recorre `seleccionados()` **en secuencia** (`concatMap`, o un `for … of` con `await
   firstValueFrom`): sube uno, lo liga, sigue. Lleva un progreso «3 de 7» en la pantalla y, si uno
   falla, **sigue con los demás** y al final lista los que no entraron (ya existe `rechazados()` para
   los que el campo descartó; reutilizar la misma lista con el motivo del servidor).
3. Quitar el radio de **categoría**: deducirla del MIME (`image/*` → `IMAGE`, resto → `DOCUMENT`).
   Dejar sólo **sensibilidad**, con default `PHI` cuando `ownerType` es clínico (`CONDITION`,
   `PROCEDURE`, `MEDICATION_REQUEST`, `ALLERGY_INTOLERANCE`, `ENCOUNTER`) y `NORMAL` en el resto.
4. `accept`: no restringir en el campo (`accept=""`), y **explicar** en el hint qué acepta hoy el
   servidor: «PDF, imágenes, Word, Excel y texto» — hasta que el backend amplíe la lista (7.3.3). Un
   formato no admitido vuelve como 422 del servidor y se muestra en la lista de rechazados con su
   nombre. Mentir «de todo tipo» en el hint sería peor que decir la lista real.
5. Nuevo output `attachedAll` (cuando terminó la tanda) además de `attached` (por archivo), para que
   quien lo hospeda cierre el panel una sola vez.

`files.types.ts` → `OWNER_TYPES`: agregar `'MEDICATION_REQUEST'`, `'ALLERGY_INTOLERANCE'`,
`'ENCOUNTER'`, `'CHART_NOTE'`, `'FORM_INSTANCE'`. `LinkedFile`, `NewFileLink` y el resto no cambian.

`clinical.client.ts`: `attachFileToMedicationRequest(id, fileId)` y `attachFileToAllergy(id, fileId)`
calcados de `attachFileToCondition` (400), apuntando a `POST /clinical/medication-requests/:id/attachments`
y `POST /clinical/allergy-intolerances/:id/attachments`.

Cliente nuevo `core/data-access/chart-documents/chart-documents.client.ts` (espejo de
`chart-notes.client.ts`): `createDocument(input: NewChartDocument)` → `POST /charts/documents` con
`{ patientProfileId, tenantId, title, encounterId?, categoryConceptId?, files: [{ fileId, contentRole?, ordinal }] }`.
Es la vía para «adjuntar N archivos a esta atención / a este formulario» sin acuñar un dueño por
cada tipo de formulario.

#### 7.2.2 Dónde aparece

| Pantalla / bloque | Qué se agrega | `ownerType` / vía |
| --- | --- | --- |
| `diagnosis-block` | ya está; sólo pasa a admitir varios | `CONDITION` |
| `medication-block` | tras «Prescribir», el mismo panel que el diagnóstico («Adjuntar archivos a esta receta»); y en cada fila de «Recetas», botón «Adjuntos» | `MEDICATION_REQUEST` + `attachFileToMedicationRequest` |
| `allergy-block` (nuevo, §5) | tras registrar | `ALLERGY_INTOLERANCE` + `attachFileToAllergy` |
| `specialty-form-block` (fichas de especialidad, hoja libre) | debajo de la respuesta registrada, «Adjuntar archivos a esta ficha» | `POST /charts/documents` con `encounterId` y `title = nombre de la ficha` |
| `procedures-block`, `odontogram` | ya tienen `PROCEDURE` (ALV-033); verificar que usan el subidor múltiple | `PROCEDURE` |
| Expediente `/medical-records/:id` | «Adjuntar archivo» en **todas** las pestañas (hoy sólo Diagnósticos): `celdaAcciones` pasa a dibujarse para `medicacion`, `alergias`, `encuentros` con el `ownerType` de cada clave; y una pestaña **«Documentos»** que liste `chart.documents` (ya viene en `GET /charts/patients/:id/chart`, `ChartDocument`, y hoy no se dibuja) con «Descargar» (`FilesClient.downloadUrl`) | según fila; `ENCOUNTER` para encuentros |

Para ver lo ya adjuntado en cada fila: `FilesClient.listLinked({ ownerType, ownerId })` (existe:
`LinkedFilesQuery`, `GET /common/files/links`) → una lista chica bajo la fila con nombre, fecha y
«Descargar». Cargarla **al abrir** el panel de adjuntos, no para todas las filas de entrada.

#### 7.2.3 Simulador

`files.handlers.ts` ya tiene `upload`, `links` (GET y POST), `download-url`, `content`, `delete`.
Agregar en `clinical.handlers.ts`:

```ts
router.post('/clinical/medication-requests/:id/attachments', ({ params, body }) => enlazar('MEDICATION_REQUEST', params['id']!, body));
router.post('/clinical/allergy-intolerances/:id/attachments', ({ params, body }) => enlazar('ALLERGY_INTOLERANCE', params['id']!, body));
```

donde `enlazar` reutiliza lo que hace hoy `POST /common/files/:id/links` (guardar el vínculo en la
colección de vínculos para que `GET /common/files/links?ownerType=&ownerId=` lo devuelva). Y
`POST /charts/documents` que agregue el documento a `documentos` del paciente con sus `fileIds`.

Hoy `POST /clinical/conditions/:id/attachments` (354) devuelve `{ ok: true }` **sin guardar nada**:
corregirlo con el mismo `enlazar`, si no el listado de adjuntos por fila sale siempre vacío.

### 7.3 BACKEND (a `PENDIENTES-BACKEND.md`)

1. `OwnerType` (`common/dto/enums.ts`): `MEDICATION_REQUEST`, `ALLERGY_INTOLERANCE`, `ENCOUNTER`,
   `CHART_NOTE`, `FORM_INSTANCE`. `CONCEPTS.OWNER_MEDICATION_REQUEST` etc. en
   `common/constants/concepts.ts` (≈358-380), con el mismo `def('common:owner-type:…')`. El comentario
   de `files.types.ts` lo confirma: **no hace falta tocar el `.puml`**, el concepto se siembra al
   arrancar.
2. Rutas `POST /clinical/medication-requests/:id/attachments` y
   `POST /clinical/allergy-intolerances/:id/attachments` en `clinical-records.controller.ts`, con
   `attachFile()` en `medication.service` y `allergy.service` calcado de
   `procedures.service.ts` (busca el recurso → 404 si no existe → `filesService.createLink`). DTOs
   `AttachFileToMedicationRequestDto { fileId }` iguales a `AttachFileToConditionDto`.
3. **«Todo tipo y formato»**: ampliar `UPLOAD_MIME_ALLOWLIST` **con firma de bytes** para cada tipo
   nuevo (`SIGNATURES` en `file-upload.service.ts`): DICOM (`DICM` en el byte 128), HEIC/HEIF,
   TIFF, MP4/MOV (`ftyp`), MP3, WAV, ZIP, PPTX, CSV/RTF (texto). Lo que **no** se debe hacer es
   aceptar cualquier cosa sin firma: la regla `40-security.md` exige límites y tipos en subidas, y
   el sniffing es lo que impide subir un ejecutable renombrado `.pdf`. Documentar la lista final en
   el hint del subidor (7.2.1 punto 4).
4. Varios archivos por petición **no hace falta**: el front sube en secuencia (7.2.1) y el vínculo
   es por archivo. Si más adelante se quiere una sola transacción, `POST /charts/documents` ya
   recibe `files[]`.

### 7.4 Verificación en navegador

1. Diagnóstico nuevo → «Adjuntar» → elegir 3 archivos (pdf, jpg, docx) → progreso «3 de 3» → los
   tres listados debajo con «Descargar».
2. Receta → prescribir → «Adjuntar archivos a esta receta» → 1 imagen → aparece en la fila.
3. Expediente → Medicación → «Adjuntar archivo» en la fila → listado.
4. Un `.exe` renombrado `.pdf` → aparece en «no se pudieron usar» con el motivo del servidor (en el
   simulador, simular el 422 por extensión).
5. Capturas `artifacts/adj-01-tres-archivos.png`, `artifacts/adj-02-receta.png`, `artifacts/adj-03-rechazo.png`.

---

## 8 · Orden de entrega (PRs a `mockup`)

Cada PR: rama `justin/mockup-<tema>`, pruebas Vitest de lo tocado, `yarn typecheck` limpio, capturas
en `artifacts/`, y descripción con **qué se puede llevar a `dev` y qué no** (por `forbidNonWhitelisted`).

| # | PR | Secciones | Depende de | Tamaño |
| --- | --- | --- | --- | --- |
| 1 | `horario-retira-el-anterior` | 2.3.1, 2.3.2, 2.3.3 | — | chico |
| 2 | `fichas-estandar-en-el-simulador` | 3 | — | mediano (el generador + regenerar) |
| 3 | `curso-clinico-y-bindings` | 4.3.1, 4.3.2, 4.3.3 | — | chico |
| 4 | `diagnostico-desde-el-expediente` | 4.3.4, 4.3.5, columna «Cita» | 3 | mediano |
| 5 | `receta-con-diagnostico` | 6 | 4 (para la columna) | mediano |
| 6 | `adjuntos-multiples` | 7.2.1, 7.2.3, 7.2.2 (diagnóstico + receta + expediente) | 5 | mediano |
| 7 | `alergias` | 5 | 3, 6 | grande (bloque nuevo + enums + adjuntos) |
| 8 | `PENDIENTES-BACKEND` P23–P26 | 5.2.3, 6.2.4, 7.3 | — | doc |

Los PR 1, 2 y 3 no se pisan y pueden ir en paralelo. Del 4 en adelante, en orden.

---

## 9 · Lo que va a `PENDIENTES-BACKEND.md` (redactar con el formato de P19–P22)

- **P23 · La alergia no sabe en qué cita se detectó.** Columna `encounter_id` en
  `clinical.allergy_intolerances` (modelo), DTO de alta y de lectura, bindings de enum para los
  cinco targets de alergia (hoy no existe ninguno en `dynamic-enum-catalog.ts`).
- **P24 · La receta no puede llevar un motivo escrito.** Columna `indication_text` en
  `clinical.medication_requests`, DTO de alta (`@MaxLength(200)`) y de lectura, exclusión
  concepto-gana-al-texto en el servicio, impresión en el PDF de la receta.
- **P25 · Sólo diagnósticos y procedimientos aceptan adjuntos.** Cinco `OwnerType` nuevos y dos
  rutas `:id/attachments` (receta y alergia), calcadas de `procedures.service.attachFile`.
- **P26 · La subida acepta ocho tipos de archivo.** Ampliar `UPLOAD_MIME_ALLOWLIST` con firmas
  (DICOM, HEIC, TIFF, MP4/MOV, MP3, WAV, ZIP, PPTX, CSV/RTF), nunca sin sniffing.
- **Nota para P16/P22 (ya abiertos):** nada de lo de arriba los cambia.

---

## 10 · Checklist de cierre por pedido

- [ ] Horario: vista previa «de HH:MM a HH:MM (N turnos de M min)»; editar retira el vigente; Mi
      agenda muestra los cupos con la duración nueva; 409 con citas comprometidas se muestra tal cual.
- [ ] Fichas: 43 plantillas en el simulador, generadas desde los JSON del backend; preselección por
      especialidad; guardia de deriva verde.
- [ ] Diagnóstico: botón en el expediente; curso con «Crónico» visible; chips de duración; fecha
      esperada oculta cuando es crónico; select de cita; tabla con curso y cita.
- [ ] Alergias: bloque nuevo en «Atención» y en el expediente; select de cita; reacciones múltiples;
      enums resueltos; P23 anotado.
- [ ] Recetas: exige diagnóstico o motivo; «Otro motivo» con texto; tabla con «Diagnóstico» y
      «Receta»; P24 anotado.
- [ ] Adjuntos: varios archivos en secuencia con progreso; categoría deducida; en diagnóstico, receta,
      alergia, fichas y en todas las pestañas del expediente; pestaña «Documentos»; P25 y P26 anotados.
- [ ] Cada pantalla nueva o retocada cumple la regla 6 (medida con navegador: holgura ≤ 2 px, ≥ 85 %).
- [ ] `yarn typecheck` limpio; `yarn test --watch=false` con sólo los 2 fallos preexistentes.

---

## Anexo A · Los 43 formularios estándar del backend

`mantra-core-health-api/src/common/seed/data/clinical-forms/<carpeta>/<archivo>.json` — cada uno
con `code`, `name`, `specialty { code, display }`, `version`, `provenance { sourceTitle, organization,
url, license, sourceVersion, retrievedAt, note }` y `fields[] { code, name, dataType, required,
options?, multiple? }`.

| Carpeta | `code` | Nombre |
| --- | --- | --- |
| anestesiologia | `ANEST_VALORACION_PREANESTESICA` | Valoración preanestésica |
| bioquimica-clinica | `BIOQ_INFORME_BASE` | Informe de laboratorio bioquímico |
| cardiologia | `CARDIO_FICHA_BASE` | Ficha cardiológica — versión general base |
| cardiologia | `CARDIO_RIESGO_CV_OMS` | Evaluación del riesgo cardiovascular (OMS/OPS) |
| cirugia-general | `CIRGEN_EVALUACION_BASE` | Evaluación de cirugía general |
| dermatologia | `DERMA_EXAMEN_BASE` | Examen dermatológico — versión general base |
| endocrinologia | `ENDO_EVALUACION_BASE` | Evaluación endocrinológica |
| enfermeria | `ENFER_VALORACION_BASE` | Valoración de enfermería |
| fisioterapia | `FISIO_EVALUACION_BASE` | Evaluación kinesiológica |
| gastroenterologia | `GASTRO_EVALUACION_BASE` | Evaluación gastroenterológica |
| geriatria | `GERIA_VALORACION_BASE` | Valoración geriátrica |
| ginecologia-obstetricia | `GINOBS_CONTROL_PRENATAL` | Control prenatal — Historia Clínica Perinatal (CLAP/SMR) |
| hematologia | `HEMATO_EVALUACION_BASE` | Evaluación hematológica |
| infectologia | `INFECTO_EVALUACION_BASE` | Evaluación infectológica |
| medicina-deportiva | `MEDEP_EVALUACION_BASE` | Evaluación de medicina deportiva |
| medicina-emergencia | `EMERG_ATENCION_BASE` | Atención en emergencia |
| medicina-familiar | `MEDFAM_CONSULTA_BASE` | Consulta de medicina familiar |
| medicina-general | `MEDGEN_CONSULTA_BASE` | Consulta de medicina general |
| medicina-intensiva | `MEDINT_UCI_EVALUACION` | Evaluación en medicina intensiva |
| medicina-interna | `MEDINT_EVALUACION_BASE` | Evaluación de medicina interna — versión general base |
| nefrologia | `NEFRO_EVALUACION_BASE` | Evaluación nefrológica |
| neumologia | `NEUMO_EVALUACION_BASE` | Evaluación neumológica |
| neurologia | `NEURO_EVALUACION_BASE` | Evaluación neurológica |
| nutricion | `NUTRI_EVALUACION_BASE` | Evaluación nutricional |
| obstetricia | `OBST_CONTROL_BASE` | Control obstétrico |
| odontologia | `ODONTO_ANAMNESIS` | Anamnesis y antecedentes odontológicos |
| odontologia | `ODONTO_ODONTOGRAMA_OMS` | Odontograma y evaluación bucodental (OMS) |
| oftalmologia | `OFTALMO_EXAMEN_BASE` | Examen oftalmológico — versión general base |
| oncologia | `ONCO_EVALUACION_BASE` | Evaluación oncológica |
| otorrinolaringologia | `ORL_EVALUACION_BASE` | Evaluación otorrinolaringológica |
| patologia-clinica | `PATOL_INFORME_BASE` | Informe de anatomía patológica |
| pediatria | `PEDIA_CONTROL_NINO_SANO` | Control de niño sano |
| pediatria | `PEDIA_CURVAS_CRECIMIENTO_OMS` | Curvas de crecimiento (patrones OMS) |
| psicologia-clinica | `PSICO_EVALUACION_BASE` | Evaluación psicológica |
| psiquiatria | `PSIQ_EVALUACION_BASE` | Evaluación de salud mental — versión general base |
| radiologia | `RADIO_INFORME_BASE` | Informe de estudio por imágenes |
| reumatologia | `REUMA_EVALUACION_BASE` | Evaluación reumatológica |
| transversal | `TRANSV_ANAMNESIS_GENERAL` | Anamnesis / Historia clínica general |
| transversal | `TRANSV_CONSENTIMIENTO_INFORMADO` | Consentimiento informado |
| transversal | `TRANSV_EPICRISIS` | Epicrisis / Resumen de egreso |
| transversal | `TRANSV_EXAMEN_FISICO` | Examen físico general |
| traumatologia | `TRAUMA_EVALUACION_BASE` | Evaluación musculoesquelética — versión general base |
| urologia | `URO_EVALUACION_BASE` | Evaluación urológica |

## Anexo B · Contratos que ya existen y NO hay que reinventar

| Necesidad | Ya existe | Dónde |
| --- | --- | --- |
| Diagnóstico con curso, fecha esperada, cita y notas | `NewCondition` / `CreateConditionDto` | `clinical.types.ts:414` · `condition.dto.ts` |
| Cambiar estado clínico de un diagnóstico | `POST /clinical/conditions/:id/change-status` | `patient-chart.html` `celdaAcciones` |
| Receta atada a un diagnóstico | `indicationConditionId` (v4.1.6) | `NewMedicationRequest`, `medication.dto.ts:154` |
| Receta devuelta con su diagnóstico | `MedicationRequestItemDto.indicationConditionId` | `clinical-read.dto.ts:77` |
| Alergia con reacciones | `NewAllergyIntolerance` / `CreateAllergyIntoleranceDto` | `clinical.types.ts:478` · `allergy.dto.ts` |
| Subir un archivo y ligarlo | `FilesClient.upload` + `createLink` / `attachFileToCondition` | `files.client.ts` · `clinical.client.ts:400` |
| Adjuntar varios archivos a una atención | `POST /charts/documents` con `files[]` | `chart-documents.controller.ts` · `documents.dto.ts:57` |
| Fichas por especialidad, con campos propios por organización | `GET /charts/templates`, `POST /forms/assignments` | `chart-templates.client.ts` · `specialty-form-block` |
| Retirar un horario conservando las citas | `DELETE /scheduling/templates/:id` | `scheduling.client.ts:344` |
| Aritmética de turnos igual a la del backend | `calcularTurnos` | `agenda-turnos.ts` |
