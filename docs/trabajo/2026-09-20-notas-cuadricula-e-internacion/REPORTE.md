# Reporte — La cuadrícula de notas, la internación según norma, y el dictamen del lote

**AVANCE: 44 / 54 microtareas en `HECHO`** · 8 en `A MEDIAS` · 2 en `BLOQUEADO` · **0 en `EN CURSO`**

Las 8 `A MEDIAS` y las 2 `BLOQUEADO` están en §2 y §3 con qué anda, qué no, y qué falta. El
porcentaje no se estima: sale de `microtareas HECHO / 54`.

- **Línea:** B (Marcelo) · **Turno:** noche del 2026-09-20, ejecutado en la madrugada del 21
- **Corte:** `origin/mockup` = `68dcb562ef3dd74de03f4887c57fd836fb21be13` (contiene el `68969782` del prompt)
- **Rama:** `marcelo/notas-cuadricula-e-internacion`
- **Correcciones:** **C-14** (cuadrícula de notas) y **C-23** (hoja de internación), más el
  **dictamen de aceptación de las 24**

---

## 1. Completado

### C-14 — la cuadrícula de la consulta · `VERIFIED`

**La casilla de notas tiene dos vistas: «Escribir» y «Cuadrícula».** La segunda es una tabla donde
el nombre de cada cabecera se elige de un catálogo, se carga una fila por consulta, y las filas de
las consultas anteriores se ven con su fecha y su motivo.

Verificado en navegador, no leído:

```
ok 1 › C-14 · la cuadrícula de la consulta › la fila se registra,
       sobrevive a recargar, y la segunda se rechaza con su motivo (24.2s)
```

| Lo que pidió el cliente | Cómo se comprobó |
|---|---|
| «vista de cuadrilla tipo excel» | Pestaña propia junto a «Escribir» |
| «seleccionar el nombre del header» | `<select>` de terminología, y se asertó que **no hay `input`** en ese control |
| …con el catálogo correcto | La corrida imprime `Peso`, `Talla`, `Frecuencia cardíaca`… y se asertó que **no** contiene `Pendiente` |
| «poner filas» | Celda cargada en la columna recién agregada y guardada |
| «se deben cargar para la siguiente sesiones» | **Kill-test**: recargar la página, reabrir, la fila sigue con su valor (`72.5`) |
| «solo se puede registrar una fila por sesion» | Tras guardar, la fila editable y el botón tienen **count 0**: el camino no existe |
| «por motivos de integridad de los datos» | El aviso contiene «una sola fila por sesión» |
| «sino no se podrá saber que registro corresponde cada sesión» | El aviso contiene «qué registro corresponde a cada consulta» |

Más: el aviso tiene `role="status"` (lo anuncia un lector de pantalla), y a 390 px el desborde
horizontal de la página es **0** — la tabla se desplaza dentro de su marco, con la columna «Sesión»
fija, y la página no se mueve.

**Dónde se guarda, que es la decisión de fondo:** una fila es **N observaciones que comparten el
mismo `encounterId`**, no un registro nuevo. Las tres piezas del pedido salían del contrato que ya
existía —`codeConceptId` para la cabecera, `encounterId` para la sesión, `getSummary` para releer—.
**No hizo falta ningún doble ni ningún pedido a nadie.**

### C-23 — la hoja de internación · parcial, y el parcial está declarado

**Lo que se investigó y se escribió:**

- [`evidencia/fuentes-normativas-internacion.md`](./evidencia/fuentes-normativas-internacion.md) —
  el marco normativo **con procedencia**: FHIR R4 `Encounter` y `EpisodeOfCare`, consultados y
  citados con versión, URL y fecha; y la norma boliviana **identificada** (Resolución Ministerial
  Nº 0090, 26/02/2008, Ministerio de Salud y Deportes) con su **contenido `UNKNOWN`**, porque el
  PDF oficial devolvió 403 y las demás referencias son secundarias.
- [`evidencia/matriz-internacion.md`](./evidencia/matriz-internacion.md) — la matriz **campo ×
  fuente × soporte del contrato**: 18 campos, con su cita y su obligatoriedad según la fuente.

**El hallazgo que reencuadra la corrección:** el formulario no está mal por pedir poco. **Está
apuntado al recurso equivocado.** `clinical.care_episodes` es, campo por campo, un `EpisodeOfCare`
—el *contenedor* que agrupa encuentros—, y lo que una persona reconoce como hoja de internación
—procedencia, sala, cama, dieta, destino al alta, diagnóstico de ingreso— vive en
`Encounter.hospitalization`, que **no existe en el modelo**: los 66 `.puml` no tienen ni una tabla
de camas o de admisión.

**Lo que sí se implementó, todo dentro del contrato:**

1. **El profesional a cargo se ve.** El servidor lo mandaba y la ficha lo tiraba. Se resuelve a
   «A tu cargo» / «A cargo de otro profesional» en vez de mostrar el uuid.
2. **El registro tardío se declara.** Si la estancia empezó el martes y se escribió el jueves, la
   ficha lo dice. El servidor manda las dos fechas desde siempre y se descartaba una.
3. **Una fecha de inicio futura no se puede dar de alta**, con su mensaje.
4. **La ayuda dice la verdad**: «Puede ser pasada: se registra cuándo empezó y cuándo se escribió».
5. **El tipo de episodio se traduce** cuando el episodio lo declara.

**La propuesta de modelo para el resto** está escrita en `matriz-internacion.md` §4, con tablas,
columnas y relaciones, en la fuente de verdad correcta. **No se escribió una línea de DDL.**

### El dictamen de las 24 · `NO ACEPTADO`

[`evidencia/dictamen-aceptacion-24.md`](./evidencia/dictamen-aceptacion-24.md) — 24 filas con
veredicto, evidencia enlazada y dueño.

**Veredicto global `NO ACEPTADO`, y el motivo no es que algo esté mal: es que no hay qué
ejercitar.** Ninguna de las 24 está integrada en `mockup` — el último commit del corte es de las
20:59 del 20/09 y el pedido es de ese mismo día. Los cinco lotes trabajan en paralelo ahora mismo;
sólo una rama está empujada (Itzan, 01:54) y sin fusionar.

**2 aceptadas** (C-14 `PASS`, C-23 `PASS` parcial) · **22 `NOT_RUN`** con su motivo · **0 rojos
ejercitados**. El §6 del dictamen dice qué hace falta para que valga algo.

### Gates

| | |
|---|---|
| `yarn typecheck` | **0** |
| `yarn lint` | **0** |
| Suite del expediente | **21 archivos / 326 pruebas** en verde |
| **Suite completa del front** | **6 855 de 6 858** en verde |
| Pruebas nuevas | 12 de `NoteGrid` · 4 de `AdmissionBlock` · 8 de navegador |
| Playwright | **8/8**, `--workers=1` |

Baseline de partida en `evidencia/antes/gates.txt` (typecheck 0, lint 0): se arrancó de verde, así
que cualquier rojo posterior habría sido mío.

**Los 3 rojos de la suite completa son preexistentes, y se demostró.** Están en
`features/auth/register-practitioner/`, que este carril no toca. Se corrieron **sobre el corte
limpio** —`git stash push -u`, regenerar el índice de componentes, correr el spec— y fallan igual:

```
FAIL src/app/features/auth/register-practitioner/register-practitioner.spec.ts
  > resuelve los cinco tipos canónicos de credencial desde el backend simulado
Error: Test timed out in 5000ms.
Tests  1 failed | 96 passed (97)
```

**No se arreglaron**: no son de este carril. Dueño: quien sea de `features/auth/`. El triaje
completo está en `evidencia/regresion.txt`.

---

## 2. A medias

### Las capturas de los cuatro estados de la cuadrícula — 2 de 4

Están capturados **«cargando»** (`c14-vista-dark-movil` de la primera tanda lo mostró) y **«con
datos»** (las seis del barrido). **Faltan «vacío» y «error»**: los dos existen en el código
(`cuadricula-vacia` con su texto orientador, `cuadricula-error-carga` con su botón de reintentar) y
ninguno se pudo capturar porque la paciente de la maqueta **ya tiene observaciones** y el simulador
no falla a pedido. Ejercitarlos exige un paciente sin historia o un fallo inyectado.

### El registro tardío, verificado sólo en pruebas unitarias

Las 2 pruebas de `admission-block.spec.ts` lo fijan, pero **no se ejercitó en navegador**: exige dar
de alta con una fecha pasada, y el campo de fecha es segmentado —escribir de corrido mete los
dígitos en el segmento equivocado, cosa que se comprobó—. Queda como `TESTED`, no `VERIFIED`.

### Todo corrió contra el simulador

`mockBackend: true` es el único backend de la maqueta. La cuadrícula escribe por el contrato real
(`POST /clinical/observations`, `GET /clinical/patients/:id/summary`) y el simulador lo persiste,
pero **nadie lo ejercitó contra la API**. Un doble destraba el trabajo; no cierra la verificación.

### El dictamen, por definición

22 de 24 en `NOT_RUN`. Se escribió igual, que es lo que el lote pedía.

---

## 3. Pendiente / no cubierto

### De C-23 — la mayor parte, y no por falta de tiempo

**10 de los 18 campos de la matriz no tienen dónde caer.** El formulario sigue teniendo **un campo
de entrada**, y la corrida de navegador lo imprime para que no haya duda:

```
CAMPOS DE ENTRADA DEL FORMULARIO DE INTERNACIÓN: 1
```

Procedencia, sala, cama, servicio, prioridad, diagnóstico de ingreso, dieta, destino al alta,
reingreso y equipo tratante **exigen modelo nuevo**. Si el criterio de aceptación de C-23 es «la
hoja pide lo que pide la norma», **eso es un `FAIL` y el arreglo es de esquema, no de pantalla**.

### `UNKNOWN` declarados

- **El contenido de la RM Nº 0090.** La norma existe y es obligatoria; su lista de campos no se
  pudo leer. Cierra con el PDF oficial o con la hoja de papel que el doctor usa hoy. **Dueño:**
  doctor / negocio (es lo que Q-D8 ya asignaba).
- **La obligatoriedad de los campos 9 a 18** de la matriz está tomada de FHIR, que los declara casi
  todos opcionales. Es posible que la norma boliviana haga obligatorio alguno —el diagnóstico de
  ingreso es el candidato—. **No se supuso.**

### Defectos abiertos

| ID | Dueño | Qué |
|---|---|---|
| **D-02** | Dueño del modelo | Toda internación se guarda con `type_concept_id = NULL` porque **no existe catálogo de tipo de episodio**. Mandarlo exigiría un uuid a mano, que está prohibido. Sólo se ve contra la API real; la maqueta aplica un valor por omisión |
| **Para Itzan** | `shared/` | `app-date-picker` trata **«campo cerrado al pasado» como «fecha de nacimiento»** y abre el calendario en **enero de 2000**. Cualquier campo operativo que no pueda ser futuro cae ahí. Se descubrió poniéndole `maxDate` a la internación y se resolvió **quitándoselo** |

### Dos cosas que hice mal y quedan escritas

1. **Reporté un defecto que no existía.** Clasifiqué D-01 desde un `grep` vacío, sin reproducir. La
   corrida de navegador lo desmintió: el catálogo de mediciones **está bien mapeado**. Queda
   retirado **con su error de método** en `defectos-reportados.md` en vez de borrado — un defecto
   que desaparece en silencio no se distingue de uno que nadie revisó.
2. **Edité archivos mientras la suite de navegador corría**, y dos pruebas fallaron por un
   `vite-error-overlay` que interceptaba los clics. Es `ENVIRONMENT` y es de método. Se re-corrió
   en limpio: 8/8.

---

## 4. Desvíos declarados sobre el prompt del lote

| Qué | Por qué |
|---|---|
| **No se copió el pack dentro del repo** (§1.1 lo pedía) | `CLAUDE.md` —precedencia 1— dice literal «no lo copies a este repo», y `.claude/` **está versionado** en el front: habría metido 176 skills en un PR de producto. El DoD verificable se cumplió desde la ubicación canónica (176 skills, `plan_gate --self-test` 11 PASS/0 FAIL). **Consecuencia honesta: los candados no corrieron automáticamente.** El plan y este reporte se escribieron igual |
| **Se tocó `specialty-form-block.spec.ts`**, fuera de mis tres carpetas | Mi cambio rompió 9 de sus pruebas. No está reservado a nadie en la tabla del reparto, la rotura era mía, y dejar 9 rojos es peor. Se reparó **respondiendo la petición**, sin tocar ningún `verify()` ni debilitar nada |
| **Q-M3 se refutó en vez de asumirse** | El prompt daba por hecho que la cuadrícula no tenía contrato real y había que cerrarla contra un doble (regla 65). El discovery mostró que **sí lo tiene** y que persiste. Cerrar contra un doble habría sido entregar menos de lo posible |
| **No se leyeron las 27 skills completas de entrada** | `context-thrift` lo prohíbe explícitamente. Se leyeron `skills-router`, `clinical-records`, `data-privacy-phi` y las reglas 20, 40 y 65; el resto se consultó cuando podía cambiar una decisión |

---

## 5. Privacidad

Todo lo capturado y pegado es de **cuentas sintéticas declaradas** de la maqueta
(`medica@alovida.mock`, paciente «Ana Lucía Pérez Quiroga» del simulador), que no habla con ninguna
base real. **Ninguna captura, salida, matriz ni dictamen lleva datos de una persona real**, y no
hizo falta enmascarar nada.

---

## 6. Handoff

| A quién | Qué |
|---|---|
| **Coordinación** | El dictamen: **`NO ACEPTADO`**, 22 de 24 sin ejercitar porque **nada está integrado**. Y el tamaño real de C-23: 10 de 18 campos exigen modelo nuevo |
| **Dueño del modelo** | `matriz-internacion.md` §4: el value set de tipo de episodio (barato, no toca tablas) y el esqueleto de `encounter_hospitalizations` / `encounter_locations` / `encounter_diagnoses`. Más **D-02** |
| **Itzan** | La heurística de `app-date-picker` que abre en enero de 2000 ante cualquier `maxDate` |
| **Justin** | `consultation.html` es mío: el cambio del `output` de descarga que necesita lo escribo yo o lo acordamos. Y **C-18/C-22 las cierra él ejercitándolas**, con captura, nunca `HECHO` sin correr |
| **Ender** | **Nada.** Se creía necesario un cambio en `core/mock/**` y resultó que no: el catálogo ya estaba bien mapeado |
| **Quien retome** | `consulta-rejilla.spec.ts` busca el rótulo viejo del buscador del archivo clínico («Buscar por nombre o código»); el real es «Nombre o código». No se tocó: no es de este carril |

---

## 7. Procesos

No quedó ninguno corriendo: el `yarn start` de la verificación se cierra al terminar el turno.
**Ojo conocido:** `TaskStop` no mata el `node.exe` hijo del servidor de desarrollo — si el puerto
4200 queda tomado, hay que matar el PID a mano.
