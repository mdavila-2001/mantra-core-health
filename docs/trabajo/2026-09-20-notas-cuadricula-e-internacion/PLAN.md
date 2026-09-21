# Plan — La cuadrícula de notas, la internación según norma, y el dictamen del lote

- **Fecha:** 2026-09-20 (turno noche; la ejecución entra en el 2026-09-21) · **Línea:** B
- **Repos afectados:** `mantra-core-health` (escritura). `mantra-core-health-api` y
  `mantra-core-health-model` **se leen y se citan, no se escriben**.
- **Corte:** `origin/mockup` = `68dcb562ef3dd74de03f4887c57fd836fb21be13` (2026-09-20 20:59 -04).
  Contiene el `68969782` (PR #554) que declara el prompt — verificado con
  `git merge-base --is-ancestor`. El único commit de diferencia es `docs(deploy)`.
- **Rama:** `marcelo/notas-cuadricula-e-internacion`
- **Predecesor:** `docs/requisitos/CORRECCIONES-DOCTOR-2026-09-20.md` (C-14, C-23) y
  `docs/verificacion/VERIFICACION-CONTRA-CODIGO-2026-09-20.md`, ambos en `AlovidaPromptManager/`.
- **Resultado observable:** quien atiende abre la casilla «notas» y encuentra una cuadrícula con
  cabeceras elegibles y una fila por sesión; abre «internación» y encuentra una hoja que pide lo
  que el contrato sabe guardar; y coordinación tiene un dictamen de las 24 correcciones.
- **Kill-test:** cargar dos filas en la misma sesión (si deja, C-14 no está) · abrir internación
  (si sigue con un campo, C-23 no está) · pedir la evidencia de un `PASS` del dictamen (si no hay
  comando ni captura, el dictamen no existe).

## Desvío declarado sobre la sección 1 del prompt

El prompt manda `cp -r ../AlovidaPromptManager/.claude ./` dentro del checkout. **No se hizo**, y
el motivo es que `CLAUDE.md` —precedencia 1, por encima del prompt— dice literal «Leelo desde ahí;
no lo copies a este repo», y `.claude/` **está versionado** en `mantra-core-health`
(`git ls-files .claude` devuelve 8 archivos, y `git check-ignore` no lo ignora): copiarlo metería
176 skills y 14 reglas de tooling en un PR de producto.

El DoD verificable se cumplió desde la ubicación canónica:

| Comprobación | Resultado |
|---|---|
| `ls .claude/skills \| wc -l` en `AlovidaPromptManager/` | **176** |
| `ls .claude/rules/[0-9]*.md \| wc -l` | **14** |
| `python .claude/hooks/plan_gate.py --self-test` | **11 PASS, 0 FAIL** (exit 0) |

Consecuencia honesta: **los candados no corren automáticamente en esta sesión** (los hooks
registrados en el `settings.json` de la raíz son los de ATLAS). El plan y el reporte siguen siendo
igual de obligatorios y se escriben igual; lo que falta es la red de seguridad, no la obligación.

Skills cargadas de entrada: `skills-router`, `clinical-records`, `data-privacy-phi`, y las reglas
20, 40 y **65**. El resto se carga cuando pueda cambiar una decisión concreta (`context-thrift`),
no de entrada — leer 27 skills completas antes de empezar es exactamente lo que esa skill prohíbe.

## Desvío declarado (2026-09-21) — hoy sí se escribió en `mantra-core-health-api`

Este `PLAN.md` decía en su cabecera «`mantra-core-health-api` … se lee y se cita, no se escribe».
Cuando el pedido pasó a «pruebas para la API» se amplió: **rama propia**
(`marcelo/int-spec-c14-c23`, desde `origin/dev`), **un archivo nuevo**
(`test/integration/clinical-c14-c23-notas-e-internacion.int-spec.ts`, 13 casos) y **una adición**
al harness compartido (`CUENTA_ESCRIBE_EN` en `test/integration/harness.ts`: cuatro tablas que la
propia limpieza señaló como faltantes con su error). Nunca `dev` directo: PR pendiente de abrir
(ver §5 del reporte). No se tocó ningún archivo de dominio de la API — sólo el arnés de pruebas
y las pruebas mismas.

## Alcance

- **IN:** corte y capturas previas · marco normativo con procedencia o `UNKNOWN` · descarte escrito
  de los cuatro candidatos · cuadrícula de notas con cabeceras de catálogo y una fila por sesión ·
  el mensaje que explica la restricción · filas anteriores en sólo lectura · matriz campo × fuente ×
  soporte para la internación · formulario de internación con lo que el contrato soporta · propuesta
  de modelo para lo que no cabe · dictamen de las 24 · regresión dirigida · capturas.
- **OUT:** todo archivo fuera de `free-note-block/**`, `admission-block/**` y `consultation/**` ·
  `core/mock/**` (Ender) · `shared/**` (Itzan) · `medication-block/**` (Justin) ·
  `features/agenda/**` y `my-services/**` (Pablo) · **escribir** en la API o en el modelo · DDL a
  mano · inventar un campo normativo sin cita · inventar un tipo de pregunta en el motor de
  formularios · corregir código ajeno durante la aceptación · declarar `PASS` sin ejercitar.

## Hallazgos del discovery que CAMBIAN el plan del prompt

### 1. La cuadrícula SÍ tiene contrato real. Q-M3 estaba equivocada.

El prompt y la verificación concluyen que «la grilla de C-14 no tiene hoy dónde guardarse» porque
el motor de formularios no tiene tipo tabla. Lo segundo es cierto y está verificado
(`question-type-icon.ts:63-88`: `TEXT`, `SCALE`, `BOOLEAN`, `SINGLE_CHOICE`, `MULTIPLE_CHOICE`).
Lo primero **no se sigue**: el motor de formularios no es el único contrato disponible.

`NewObservation` (`core/data-access/clinical/clinical.types.ts:615`) tiene las tres piezas:

| Pieza de C-14 | Campo del contrato |
|---|---|
| «seleccionar el nombre del header» | `codeConceptId` — concepto de terminología, elegido con `app-concept-select`, el mismo patrón que ya usa `observation-block.html:24-29` |
| «una fila por sesión» | `encounterId` — las observaciones que comparten encuentro **son** la fila |
| «estas filas se deben cargar para la siguiente sesiones» | `GET /clinical/patients/:id/summary` → `observations[]` + `encounters[]` |

**Una fila = N observaciones con el mismo `encounterId`**, no una observación con N `components`.
La diferencia no es de gusto: el contrato de escritura admite `components[]`
(`clinical.types.ts:629`) pero **la lectura no los devuelve** (`interface Observation`,
`clinical.types.ts:115-129`, no tiene `components`), y el simulador los descarta —acepta el array y
sólo devuelve `componentIds` generados al vuelo (`clinical.handlers.ts:511`)—. Guardar en
componentes sería escribir algo que la pantalla no puede releer nunca: exactamente la mentira que
`admission-block.ts:64-71` se prohíbe por escrito.

**Y persiste:** `fixtures/clinica.ts:509-511` declara `observaciones.persistirEn(…)`,
`encuentros.persistirEn(…)` y `episodios.persistirEn(…)`, así que guardar → recargar → seguir ahí
es comprobable. **Consecuencia: no hace falta pedirle nada a Ender, y no hace falta doble.**

### 2. Las columnas no necesitan almacenamiento propio

Las cabeceras elegidas **son** los `codeConceptId` que ya tienen observaciones de esa persona: la
unión de lo medido hasta hoy. Una columna nueva existe desde que se la usa por primera vez, y
sobrevive porque sobreviven sus observaciones. No hay catálogo de columnas que inventar ni tabla
de definición que pedir — que es lo que Q-M1 temía.

### 3. C-23 tiene un campo que entra hoy, y es el que más pesa

`care_episodes` declara `type_concept_id` nullable (`care_episodes.entity.ts:40`), el DTO lo acepta
(`care-episode.dto.ts:40-46`), el cliente lo tipa (`NewCareEpisode.typeConceptId`,
`clinical.types.ts:261`) y **el formulario nunca lo manda**. El servicio lo pasa tal cual sin
default (`care-episodes.service.ts:63`), así que **hoy toda internación se guarda con
`type_concept_id = NULL`**: el expediente no registra que la internación es una internación,
teniendo `EP_HOSPITALIZATION` sembrado desde siempre (`clinical.concepts.ts:18-21`).

Lo demás que una hoja de admisión necesita —servicio, sala, cama, diagnóstico de ingreso,
procedencia, acompañante— **no tiene columna**, y eso es H4: matriz y propuesta, sin tocar la base.

## H1 — Corte, estado real de las dos pantallas, y el marco normativo con procedencia

**CA:** Dado el pedido «investigar qué debe tener según norma», cuando alguien pregunta de dónde
sale cada campo propuesto, entonces hay fuente con nombre, referencia y fecha, o `UNKNOWN`
declarado, y ninguna invención.
**DoD:** las 9 microtareas en `HECHO` o `BLOQUEADO`; documento de fuentes y capturas en `evidencia/`.
**Estado:** A MEDIAS — 8 de 9 en `HECHO`; falta la captura «antes» (H1.S1.M2)

### H1.S1 — El corte, el entorno y las capturas previas
**CA:** Dada la rama, cuando se la compara con `origin/mockup`, sale de ese corte y hay captura de
las dos pantallas antes de tocarlas. **DoD:** las 3 microtareas en `HECHO`.
**Estado:** A MEDIAS — ver H1.S1.M2

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H1.S1.M1 | Fijar el corte y salir de ahí | El SHA está en el plan | `git log -1 origin/mockup` + `merge-base --is-ancestor` | HECHO |
| H1.S1.M2 | Capturar «notas» e «internación» antes de tocarlas | Hay dos capturas y la lista de campos observada | Capturas en `evidencia/antes/` | A MEDIAS — la lista de campos observada sí está (la corrida imprime el texto del modal); **las capturas «antes» no se tomaron**: cuando se abrió el navegador el código ya estaba cambiado |
| H1.S1.M3 | Baseline de typecheck, lint y specs del expediente | Hay exit code de los tres | `yarn typecheck`, `yarn lint`, specs → `evidencia/antes/gates.txt` | HECHO |

### H1.S2 — Buscar dentro de la casa antes de inventar
**CA:** Dada la cuadrícula, cuando alguien pregunta por qué no se reusó lo que había, hay descarte
escrito de los cuatro candidatos. **DoD:** las 3 en `HECHO`, **antes** del primer archivo nuevo.
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H1.S2.M1 | Motor de formularios: ¿sirve? | Veredicto con motivo citando los 5 tipos | `question-type-icon.ts:63-88` pegado → **NO sirve**: sin tipo tabla ni grupo repetible. No se inventa un tipo nuevo (OUT) | HECHO |
| H1.S2.M2 | `observation-block`: ¿ya resuelve «una fila por sesión»? | Veredicto con motivo | **SÍ, parametrizado** (regla 95.1.3): mismo contrato, mismo `app-concept-select`, mismo `encounterId`. La cuadrícula es su vista tabular multi-columna | HECHO |
| H1.S2.M3 | Dónde se guarda la fila y si el contrato lo soporta | Destino escrito; contrato real o doble declarado | **Contrato real**: N observaciones con un `encounterId`. Persiste (`fixtures/clinica.ts:509`). **No hace falta doble ni pedido a Ender** | HECHO |

### H1.S3 — La norma, con procedencia o con `UNKNOWN`
**CA:** Dado el documento de fuentes, cada requisito tiene fuente/referencia/fecha, y lo no
confirmado está `UNKNOWN`. **DoD:** cero campos sin fuente ni marca; cero fuentes inventadas.
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H1.S3.M1 | Buscar primero en la casa: vault, casos de uso, modelo | Registrado qué hay y qué no | Búsqueda pegada sobre la bóveda y el modelo. Lo de la casa gana (regla 00 §8) | HECHO |
| H1.S3.M2 | Fuente externa sólo con nombre, referencia, fecha y condición | Cada fuente con los 4 datos | Ficha de procedencia por fuente (regla 97.4.2) | HECHO |
| H1.S3.M3 | Marcar `UNKNOWN` lo no confirmado | Ningún campo con fuente supuesta | Lista de `UNKNOWN` con qué haría falta. Precedente B-13 leído | HECHO |

## H2 — La cuadrícula de notas: cabeceras elegibles y una fila

**CA:** Dada la casilla de notas, cuando se la abre, ofrece una cuadrícula donde se elige el nombre
de cada cabecera y se carga una fila, con los cuatro estados resueltos y usable con teclado.
**DoD:** las 9 en `HECHO` o `BLOQUEADO`; la fila **releída** del servidor; los 4 estados capturados.
**Kill-test:** cargar fila → recargar → reabrir. Si no está, estaba pintada.
**Estado:** A MEDIAS — 8 de 9 en `HECHO`. **El kill-test pasa en navegador y contra la API real.**
Los 4 estados (H2.S3.M1) se cerraron contra Neon (`correcciones-c14-c23.real.spec.ts`), no contra
la maqueta: ésta no falla a pedido. Falta H2.S3.M2, el recorrido de teclado celda por celda.

### H2.S1 — Las cabeceras se eligen
| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H2.S1.M1 | Fijar de dónde sale la lista de nombres | Fuente con ruta | Terminología vía `app-concept-select`; **nunca** literal en plantilla | HECHO |
| H2.S1.M2 | Elegir con el `select` del sistema, no texto libre | No se teclea nombre arbitrario | Captura + control usado | HECHO |
| H2.S1.M3 | Las columnas sobreviven a la recarga | Siguen ahí tras recargar | Captura tras recargar. Son la unión de `codeConceptId` ya medidos | HECHO |

### H2.S2 — La fila se carga y se guarda de verdad
| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H2.S2.M1 | Cargar una fila y guardarla | Queda guardada | Petición y respuesta pegadas | HECHO |
| H2.S2.M2 | Releer y verificar que está | Aparece tras recargar | Captura tras recargar | HECHO |
| H2.S2.M3 | Ninguna captura con datos de paciente real | Todo sintético declarado | Revisión. Reglas 90.2.3 y 40.5.5 | HECHO |

### H2.S3 — Los cuatro estados y el teclado
| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H2.S3.M1 | Resolver los 4 estados, con el vacío orientando | Los 4 existen; el vacío dice qué hacer | 4 capturas. Regla 95.2: vacío mudo prohibido | HECHO — «cargando» y «con datos» ya estaban (maqueta); **«vacío» y «error» cerrados contra la API real** (`c14-real-vacio.png`, `c14-real-error.png`): un paciente recién registrado sin observaciones para el vacío, `page.route` con 500 para el error — ninguno de los dos era posible contra el simulador |
| H2.S3.M2 | Recorrido con teclado por celda | Se llega a cada celda sin ratón | Recorrido + captura del foco | A MEDIAS — los controles son nativos y el marco de la tabla es focalizable, pero **no se hizo un recorrido de teclado celda por celda** |
| H2.S3.M3 | Móvil estrecho sigue usable | Sin desborde ni celdas inalcanzables | Captura móvil. Regla 95.4.4 | HECHO |

## H3 — Una fila por sesión, explicada, y las anteriores a la vista

**CA:** Dada una sesión con fila registrada, cuando se intenta otra, no se registra y el sistema
explica que por integridad sólo se admite una —sin eso no se sabría a qué sesión corresponde cada
registro—; y las filas anteriores se cargan y se ven.
**DoD:** las 9 en `HECHO` o `BLOQUEADO`; la segunda fila **no** queda guardada.
**Kill-test:** intentar la segunda y recargar. Si quedaron dos, la restricción está sólo en el cartel.
**Estado:** HECHO — 9 de 9. **El kill-test pasa.** El `POST` directo se forzó contra la API real
(H3.S1.M2): el servidor **acepta** una tercera observación con el mismo `encounterId` — la regla de
«una fila por sesión» es de la UI, el contrato no la tiene.

### H3.S1 — La restricción donde se escribe
| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H3.S1.M1 | Freno en la UI con fila ya registrada | El camino no está disponible | Captura | HECHO |
| H3.S1.M2 | Qué hace el servidor si la petición llega igual | Respuesta real registrada | Petición y respuesta pegadas. Regla 96.3.2 | HECHO — forzado contra la API real: `POST /clinical/observations` con el mismo `encounterId` responde **201**. `clinical-c14-c23-notas-e-internacion.int-spec.ts`, caso «H3.S1.M2» |
| H3.S1.M3 | Releer tras el intento: una sola fila | Hay exactamente una | Captura tras recargar | HECHO |

### H3.S2 — El mensaje que explica, no el que sólo niega
| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H3.S2.M1 | Mensaje con la restricción y su motivo | Dice regla y razón | Captura. Regla 95.2.3 | HECHO |
| H3.S2.M2 | Se anuncia a un lector de pantalla | Tiene rol de estado | Revisión + captura. Regla 80.7.3 | HECHO |
| H3.S2.M3 | Lo escrito no se pierde al fallar | Los valores siguen | Caso ejercitado. Regla 95.3.3 | HECHO |

### H3.S3 — Las filas anteriores se cargan
| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H3.S3.M1 | Mostrar filas anteriores con su sesión | Cada fila dice de qué sesión es | Captura con ≥2 sesiones | HECHO |
| H3.S3.M2 | Sólo lectura, con el supuesto registrado | No se editan desde la sesión nueva | Captura + Q-D7 con dueño | HECHO |
| H3.S3.M3 | Orden determinista y tope | Orden con desempate; lista acotada | Caso con varias filas. Regla 96.6.2 | HECHO |

## H4 — Internación: la matriz campo × fuente × soporte

**CA:** Dada la matriz, cada campo tiene tres columnas respondidas: qué fuente lo pide, si el
contrato lo soporta y dónde, y si no, qué falta.
**DoD:** las 9 en `HECHO` o `BLOQUEADO`; ningún campo sin fuente o sin `UNKNOWN`.
**Kill-test:** tomar tres campos y pedir su columna del modelo. Si falta y no dice «no cabe», está a medias.
**Estado:** HECHO — 9 de 9. La matriz tiene 18 campos con fuente citada o `UNKNOWN` declarado

### H4.S1 — Qué soporta hoy el contrato, leído
| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H4.S1.M1 | Campos reales de la entidad | Lista literal del archivo | `care_episodes.entity.ts` pegado | HECHO |
| H4.S1.M2 | Cliente y endpoint que usa el bloque | Ruta y cuerpo | `clinical.client.ts` pegado | HECHO |
| H4.S1.M3 | Qué admiten `type_concept_id` y `status_concept_id` | De qué conjunto salen | `clinical.concepts.ts` pegado; si no se sabe, `UNKNOWN` | HECHO |

### H4.S2 — Los campos que la norma pide
| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H4.S2.M1 | Listar los campos con su cita | Cada campo con fuente y referencia | Matriz en `evidencia/` | HECHO |
| H4.S2.M2 | Obligatoriedad según la fuente | Cada campo dice obligatorio/condicional/opcional y de dónde | Matriz. Regla 00 §1.6 | HECHO |
| H4.S2.M3 | ¿Hay recurso estándar de interoperabilidad? | Dicho si existe y si conviene | Cita o `UNKNOWN` | HECHO |

### H4.S3 — El cruce y la propuesta
| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H4.S3.M1 | Cruzar contra el contrato en tres grupos | Cada campo en «entra hoy» / «doble» / «exige modelo» | Matriz completa | HECHO |
| H4.S3.M2 | Propuesta de modelo para lo que no cabe | Tablas, columnas y relaciones, en la fuente correcta | Documento + ruta del modelo. **Cero DDL a mano** | HECHO |
| H4.S3.M3 | Dueño del cambio y qué bloquea | Dueño e impacto registrados | Registro con dueño | HECHO |

## H5 — El formulario de internación que el contrato sí soporta

**CA:** Dada la casilla de internación con encuentro en curso, pide los campos que la matriz marcó
soportados, valida, y la internación se relee con esos datos.
**DoD:** las 9 en `HECHO` o `BLOQUEADO`; releído tras recargar; el `409` sigue contándose como «ya
está internada».
**Kill-test:** dar de alta, recargar, reabrir. Si los campos nuevos no están, se guardaron en la pantalla.
**Estado:** A MEDIAS — 7 de 9 en `HECHO`. **No se pudo agregar ningún campo de entrada: el contrato
no admite otro.** Lo que entró fueron lecturas que se descartaban. El tamaño real está en la matriz.
El error de campo y la relectura tras recargar (H5.S2.M2, H5.S3.M1) se cerraron contra la API real;
el rastro de auditoría (H5.S3.M2) sigue sin verse desde la UI, pero ahora se sabe que **sí existe**.

### H5.S1 — Los campos que entran hoy
| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H5.S1.M1 | Agregar los soportados, cada uno con su fila en la matriz | Cero campos sin fila | Captura + matriz | A MEDIAS — **no se pudo agregar ningún campo de entrada**: el contrato no admite otro. Lo que entró fueron lecturas que se descartaban. Declarado en el reporte |
| H5.S1.M2 | Etiqueta accesible y ayuda en cada campo | Todos con etiqueta real | Revisión + captura. Regla 95.3.5 | HECHO |
| H5.S1.M3 | Lo que NO entra, declarado en el reporte | La lista está escrita | Sección «No cubierto» | HECHO |

### H5.S2 — Validación y errores
| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H5.S2.M1 | Validar lo obligatorio según la fuente | No se manda sin eso | Caso + captura | HECHO |
| H5.S2.M2 | Error de campo del servidor mapeado a su campo | Llega a su campo | Caso ejercitado. Regla 95.3.2 | HECHO — cuerpo del `400` capturado contra la API real (`details.violations`, int-spec) y reproducido en navegador con `page.route`; llega a `internacion-error`, el único campo del formulario. Declarado: el contrato no manda nombre de campo estructurado, así que «a su campo» es por adyacencia (un solo campo) |
| H5.S2.M3 | El `409` sigue siendo «ya está internada» | El ámbar sigue apareciendo | Caso + captura | HECHO |

### H5.S3 — Guardado real y rastro
| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H5.S3.M1 | Alta con los campos nuevos y relectura | Los datos están tras recargar | Captura tras recargar | HECHO — cerrado contra la API real: alta → `page.reload()` → la lista releída del servidor sigue mostrando la internación (`c23-real-tras-recargar.png`) |
| H5.S3.M2 | Rastro de acción sensible | Hay rastro o `NOT_RUN` con motivo | Evidencia o declaración. Regla 90.2.7 | A MEDIAS, con hallazgo — **sí existe** un rastro real y encadenado (`audit.audit_log`, hash previo/actual) para `POST /authz/care-relationships/request` (`authz-care-relationships.service.ts:149`), pero **la API no expone ningún endpoint de lectura para él**: `GET /audit/history/:entity/:id` sólo cubre las tablas `*_history` del espejo de `HistoryMirrorSubscriber`, y `care_episodes`/`care_relationships` no están entre ellas. No hay pantalla que lo muestre; verificado por consulta directa a la base, no por HTTP |
| H5.S3.M3 | Ninguna captura con paciente real | Todo sintético | Revisión. Regla 90.2.3 | HECHO |

## H6 — El dictamen de aceptación de las 24 correcciones

**CA:** Dado el lote, coordinación sabe por corrección si está aceptada, rechazada, bloqueada o sin
ejercitar, con evidencia enlazada y rojos clasificados.
**DoD:** las 9 en `HECHO`; 24 filas con veredicto; cada `PASS` con comando u observación; cada rojo
con su clase. **Ninguna corrección ajena tocada.**
**Kill-test:** pedir la evidencia de un `PASS`. Sin captura ni comando, baja a `NOT_RUN`.
**Estado:** A MEDIAS — 8 de 9. **El dictamen está escrito con sus 24 filas**, y **23 de las 24
están recorridas** con veredicto real, en dos tandas: #557/#559 primero y #561/#564 después.
Resultado: **19 aceptadas · 1 `FAIL` (C-06, por el defecto nuevo D-07) · 3 `BLOCKED` (C-20, C-21
y C-22, por D-06) · 1 `NOT_RUN`** (C-03, la única sin rama fusionada).

**Lo que falta para cerrar el hito es H6.S1.M3, y bajó a `A MEDIAS` a propósito**: C-13 se
integró en #564 y su guion pide dos cuentas —médica y visitador—; se ejercitó una. Estaba en
`HECHO` cuando C-13 no existía en `mockup`; ahora existe, así que el hito vuelve a tener trabajo
real pendiente. Subirlo a `HECHO` sin esa cuenta sería exactamente el `PASS` sin evidencia que el
kill-test de este hito prohíbe.

### H6.S1 — El recorrido, con intención
| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H6.S1.M1 | Guion: caso mínimo por `C-nn` | Las 24 con su caso, antes de empezar | Guion en `evidencia/` | HECHO |
| H6.S1.M2 | Recorrer con la cuenta médica | Las 24 con resultado o `NOT_RUN` | Tabla + capturas | HECHO — **23 de 24** integradas y recorridas, en dos tandas. `dictamen-h6-recorrido.spec.ts` 10/10 (#557, #559) y `dictamen-h6-recorrido-2.spec.ts` 14/14 (#561, #564). Resultado: **19 aceptadas · 1 `FAIL` (C-06, por D-07) · 3 `BLOCKED` (C-20/C-21/C-22, por D-06) · 1 `NOT_RUN`** (C-03, la única sin rama fusionada) |
| H6.S1.M3 | Recorrer otras cuentas donde corresponda | Paciente y visitador cubiertos donde el caso lo pide | Resultados + capturas | A MEDIAS — C-13 **ya está integrada** (#564) y se recorrió con la médica: la tarjeta de «Visitador» se ve y no publica un solo dato clínico. Falta la mitad que el guion pide con la **cuenta del visitador**, que no se ejercitó. Las otras 22 recorridas son todas de la médica |

### H6.S2 — Clasificar los rojos, con evidencia
| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H6.S2.M1 | Reproducir cada rojo antes de clasificar | Pasos que otro puede seguir | Pasos + captura. Regla 80.4.2 | HECHO |
| H6.S2.M2 | Clasificar en una de las cinco clases | Cada rojo con una clase y su evidencia | Tabla. Regla 80.4.1 | HECHO |
| H6.S2.M3 | Reportar cada rojo a su dueño en el momento | Aviso en el daily con la hora | Entradas en el daily. Regla 50 | HECHO |

### H6.S3 — El dictamen, la regresión y el cierre
| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H6.S3.M1 | Dictamen con veredicto por corrección y global | 24 filas; el global es el más bajo | Dictamen en `evidencia/`. Regla 40.5.2 | HECHO |
| H6.S3.M2 | Regresión del área y barrido, serial | Gates en 0 y filas del expediente limpias | `yarn typecheck`, `yarn lint`, specs, barrido `--workers=1` | HECHO |
| H6.S3.M3 | Capturas 3 viewports × 2 temas, miradas, y `REPORTE.md` | Cada captura con su observación | Índice + archivo en disco | HECHO |

## Ambigüedades registradas

| ID | Ambigüedad | Quién resuelve | Supuesto con el que sigo |
|---|---|---|---|
| Q-D7 | C-14 no dice si las filas anteriores son editables | Doctor | Sólo lectura las anteriores; editable la de la sesión en curso |
| Q-D8 | C-23 dice «según nomra» sin nombrar la norma | Doctor / negocio | Se cita lo que se pueda; el resto `UNKNOWN`. Ningún campo «porque suena a norma» |
| Q-M1 | C-14 no dice de qué lista salen los nombres de cabecera | Doctor | **Resuelto por discovery**: terminología, vía `app-concept-select`. Sin catálogo nuevo |
| Q-M2 | C-14 no dice cuántas filas ni en qué orden | Doctor | Todas, orden determinista por fecha del encuentro con desempate por id; tope declarado |
| Q-M3 | «La cuadrícula no tiene contrato real» | — | **Refutada por discovery**: `NewObservation` + `encounterId` lo soporta y persiste. Sin doble |
| Q-M4 | `care_episodes` no tiene columnas para casi nada de una hoja de admisión | Dueño del modelo | Entra lo que cabe (incluido `typeConceptId`, hoy sin usar); el resto es propuesta, sin tocar la base |
| Q-M5 | El dictamen depende del trabajo de los otros cuatro | Coordinación | Se escribe igual, con `NOT_RUN` en lo que no llegó |

## Riesgos y bloqueos previstos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| El trabajo de los otros cuatro no está en `mockup` al recorrer H6 | El dictamen queda mayormente `NOT_RUN` | Se escribe igual; `NOT_RUN` con motivo es honesto, un `PASS` optimista no |
| La sesión no alcanza para las 54 | Cierre parcial | `A MEDIAS` con qué anda, qué no y qué falta (regla 20 §5). H6 se escribe aunque sea con `NOT_RUN` |
| `consultation.html` es mío y Justin necesita un cambio ahí | Colisión de reparto | Se acuerda por daily y se anota en los dos (regla del reparto) |
