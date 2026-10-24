# C1 — Reporte · Justin · 2026-09-25

Rama: `justin/consulta-notas-medicas-2026-09-25` desde `origin/mockup` @ `aeb47b1f`. Worktree: `wt-justin-consulta-notas-2026-09-25`. Puerto reservado: **4211**. Sólo frontend y simulador; nada de backend.

## 0. Lo que pidió el propietario (25/09/2026, tarde)

1. **«Medición deja de existir.»** La casilla salió de la rejilla de la consulta. Un signo vital es una fila de la nota médica («Presión arterial: 120/80»), no un registro aparte. El bloque `observation-block` y la cuadrícula siguen en el expediente (pestaña «Observaciones»), que no se tocó por estar reservado por otro carril.
2. **«De momento Internación sacarlo.»** La casilla salió de la rejilla. `admission-block` sigue disponible desde el expediente.
3. **«Notas médicas en la barra lateral… sacame esa huevada.»** La sección `progress-notes` se retiró del registro de navegación, del subgrupo «Historia clínica» (que quedaba envolviendo una sola sección y se disolvió), del árbol de accesos del panel y de las rutas. La pantalla, su PDF y su Playwright se borraron.
4. **La nota médica es la tabla clave/valor explicada en la otra sesión**: «en cada cita es posible realizar una observación … cada observación tiene su respectivo ID … es una tabla de valores donde los campos son más dinámicos y laxos … llamadas notas médicas». La casilla «Nota médica» ya no dice «En construcción (C1)»: abre el formulario de filas.

## 1. Lo que hay ahora en «Nota médica»

- Formulario de **filas campo/valor**: una fila vacía al abrir, «Agregar fila», «Quitar» con texto, contador «n de 40», `Enter` en el valor agrega la fila siguiente y la enfoca. Texto libre opcional debajo.
- **Validación en vivo** bajo cada fila: falta el campo, falta el valor, campo repetido (sin distinguir mayúsculas ni tildes), topes 60/500. Guardar sólo se enciende sin problemas y con al menos una fila o un texto.
- **Sin encuentro abierto** el formulario avisa («Abrí el encuentro para registrar») y no guarda.
- Guarda con `POST /charts/notes` (`entries`, `subjectiveText` sólo si hay texto, `encounterId` del encuentro en curso) y **relee** con `GET /charts/notes?patientProfileId=`.
- Lista **«De esta consulta»** arriba (tarjeta por nota: «Nota #a1b2», fecha, autor, sello Borrador/Firmada, tabla de filas, texto libre) y **«Anteriores (n)»** plegadas en acordeón.
- **Firmar** (`POST /charts/notes/:id/versions/:versionId/sign`) cambia el sello y retira el botón. Una firmada no se edita: el simulador responde 409 sin `amendmentReasonText`.
- «Lo registrado en este encuentro» (C8) y la historia del paciente (C6) muestran las filas de la nota tal como se escribieron.

### Simulador

- `fixtures/clinica.ts`: `NotaSimulada.entries`; dos notas por paciente con cuatro a siete filas realistas (cinco juegos, determinista por paciente y visita). La persistencia pasó a `mock.clinica.notas-medicas` a propósito: lo guardado gana sobre la semilla, y las notas guardadas antes de C1 no tenían filas.
- `handlers/medical-notes.handlers.ts`: `GET /charts/notes`, `POST /charts/notes` con validación por fila (422 con `issues` indexadas), `PUT /charts/notes/:id/versions` (409 sobre firmada sin motivo), `POST …/sign`.
- `chart-notes.client.ts`: `listNotes`, `signVersion`; `chart-notes.types.ts`: `ListChartNotesParams`, `ChartNotesPage`, `amendmentReasonText`.

## 2. Verificación

| Qué | Comando | Resultado |
|---|---|---|
| Tipos (app, cypress, playwright) | `yarn typecheck` | exit 0 |
| Lint de los archivos tocados | `npx eslint <archivos>` | exit 0 |
| Unitarias dirigidas | `yarn test --watch=false --include=…` (nota médica, consulta, navegación, panel, handlers clínicos, mock-backend, historia del paciente, expediente) | ver `evidencia/tests.txt` |
| Playwright | `node scripts/pw-guard.mjs --port 4211 --spec playwright/clinica-c1-nota-medica.spec.ts --serve` | ver `evidencia/` |

Kill-test del carril: guardar una nota con tres filas, F5, las tres filas siguen con sus rótulos; firmar cambia el sello. Es exactamente el recorrido de `playwright/clinica-c1-nota-medica.spec.ts`.

## 3. Lo que queda fuera y por qué

- **El alta «Nota» del expediente** (`patient-chart.html`) sigue abriendo `free-note-block` → cuadrícula. `patient-chart.*` está reservado por otro carril con cambios sin commitear esta misma tarde; cambiarlo acá garantizaba un conflicto. Es un cambio de dos líneas (`app-free-note-block` → `app-medical-note-block`) para quien tenga el archivo.
- **Enmendar una nota firmada** (versión nueva con `amendmentReasonText`): el contrato y el simulador lo admiten; la pantalla no lo ofrece todavía.
- **`observation-block`, `measurement-grid` y `free-note-block`** siguen en el código porque el expediente los usa. Si «Medición» deja de existir también en el expediente, se retiran los tres junto con la pestaña «Observaciones».

## P39 — Para pegar en `PENDIENTES-BACKEND.md`

**Nota médica con filas campo/valor.** El frontend escribe y lee `entries: { label, value }[]` en `POST /charts/notes`, `PUT /charts/notes/:id/versions`, `GET /charts/notes` y en `notes[]` de `GET /charts/patients/:id/chart`. Falta en el backend:

- Modelo: `entries_json jsonb` en `chart.clinical_note_versions` (o tabla `chart.clinical_note_entries(version_id, position, label, value)` si se quiere consultar por rótulo).
- DTOs: `entries` opcional en `CreateClinicalNoteDto` y `AppendClinicalNoteVersionDto`; validación: hasta 40 filas, `label` 1–60, `value` 1–500, sin `label` repetido normalizado; 422 si no hay ni filas ni `subjectiveText`.
- Lectura: `entries` en cada nota del chart y en `GET /charts/notes?patientProfileId&encounterId&limit` (hoy la lista no existe: el frontend la consume ya).
- Firma: `POST /charts/notes/:id/versions/:versionId/sign` devolviendo la nota con `signedAt`; 409 `CONFLICT` en `PUT …/versions` sobre una firmada sin `amendmentReasonText`.
