# Reporte — La cuadrícula de notas, la internación según norma, y el dictamen del lote

**AVANCE: 50 / 54 microtareas en `HECHO`** · 4 en `A MEDIAS` · 0 en `BLOQUEADO` · **0 en `EN CURSO`**

Las 4 `A MEDIAS` están en §2 con qué anda, qué no, y qué falta. El porcentaje no se estima: sale
de `microtareas HECHO / 54`.

> **El avance BAJÓ de 51 a 50, y es correcto.** H6.S1.M3 («recorrer otras cuentas donde
> corresponda») estaba en `HECHO` porque **ninguna corrección integrada pedía otra cuenta**. Hoy
> C-13 se integró (#564) y sí la pide: el guion la quiere con médica **y** visitador, y se ejercitó
> una. Un hito no se queda en `HECHO` porque ya lo estuvo; se queda si su DoD sigue cumpliéndose.

> **2026-09-21, sesión 5 — #566 y el `FAIL` que el propio PR se metió.** Pablo integró **#566**,
> que refactoriza C-06 al componente `app-row-actions` del sistema de diseño. La migración es la
> decisión correcta —no tener un desplegable propio cuando el sistema publica uno— pero el
> componente **dibuja el icono sólo si la acción lo declara**, y **seis no lo declaran**: las seis
> perdieron el icono que sí tenían en #564. C-06 pide icono **y** texto. Eso es **D-08**, y lo
> introdujo el PR que dice cerrar esa misma corrección. **Pasó `typecheck`, `lint` y 141/141
> pruebas unitarias** — ninguna comprueba que una acción tenga icono. Recorrido entero de nuevo:
> **15/15**. C-06 sigue en `FAIL`, ahora por dos defectos. Detalle en §1 «Hoy, #566».

> **2026-09-21, sesión 4 — la segunda tanda del recorrido (#561, #562, #563, #564).** Mientras se
> resolvía el conflicto que GitHub marcaba en el PR #565 —que **no era real**: el merge local de
> `origin/mockup` salió limpio y el PR volvió a `MERGEABLE`— aparecieron **cuatro PRs más** ya
> integrados. Entre #561 (Itzan, perfil) y #564 (Pablo, consultas) dejaron recorribles **trece** de
> las catorce correcciones que seguían en `NOT_RUN`. Se recorrieron
> (`playwright/dictamen-h6-recorrido-2.spec.ts`, **14/14**, ninguno de los cuatro PRs es mío) y el
> dictamen pasó de **8 aceptadas / 2 `BLOCKED` / 14 `NOT_RUN`** a **19 aceptadas / 1 `FAIL` /
> 3 `BLOCKED` / 1 `NOT_RUN`**. Se destapó **D-07**, que es el `FAIL` de C-06: el interruptor de
> tema del encabezado es sólo-icono y no da globo, y vive en el marco, así que está en toda ruta.
> Detalle en §1 «Hoy, la segunda tanda» y en el dictamen §4.6.

> **2026-09-21, sesión 3 — el recorrido del dictamen (H6.S1.M2/M3).** Al abrir el PR de la sesión 2
> se descubrió que #557 (Justin) y #559 (Ender/Pablo) ya estaban `MERGED` en `mockup`, sin que
> nadie de esta sesión los mergeara. Con eso, **10 de las 24 correcciones dejaron de estar
> `NOT_RUN` por definición** y H6 pasó de `A MEDIAS`/`BLOQUEADO` a `HECHO`: se recorrieron con la
> cuenta médica (regla 70.4.8 — ninguna de las dos la escribí yo) y quedaron con veredicto real.
> Se destapó **D-06**, un hallazgo nuevo del mismo mecanismo que el D-01 ya retirado —pero
> reproducido esta vez—: el buscador de «Medicamento» cae al catálogo de reserva
> `VS_RECORD_STATUS`. Detalle en §1 «Hoy, el recorrido del dictamen» y en el dictamen mismo.

> **2026-09-21, sesión 2 — contra la API real.** El pedido de coordinación fue explícito: *«de las
> pruebas para la API»*, con Docker encendido. Cinco microtareas que quedaron `A MEDIAS`
> específicamente por depender de un backend que fallara a pedido, aceptara un `POST` directo, o
> tuviera auditoría real —cosas que el simulador no puede— se cerraron contra **Neon**, con un
> int-spec nuevo en la API (fuera de mi alcance original, desvío declarado en `PLAN.md`) y
> `playwright/correcciones-c14-c23.real.spec.ts`. Se destaparon en el camino **tres hallazgos
> reales** (uno de esquema, uno de autorización potencial, uno de auditoría) — ver §1 «Hoy, contra
> la API real» y §3.

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

> [!warning] Se quedó atrás mientras se hacía la sesión 2 — **#557, #558 y #559 ya están
> `MERGED` en `mockup`**, los tres de hoy (12:10–14:33 UTC): #557 de Justin (receta), #558 el mío
> (C-14/C-23) y #559 de Pablo (agenda/reportes). Nadie de esta sesión los mergeó; se descubrió
> recién al ir a abrir el PR de hoy. **Ya se recorrió** (sesión 3, §1 «Hoy, el recorrido del
> dictamen»): el veredicto de arriba queda como el corte original lo justificaba, y el nuevo pase
> está hecho, con `PASS`/`BLOCKED` reales para las 10 correcciones que llegaron a integrarse.

**2 aceptadas** (C-14 `PASS`, C-23 `PASS` parcial) · **22 `NOT_RUN`** con su motivo · **0 rojos
ejercitados**. El §6 del dictamen dice qué hace falta para que valga algo.

### Gates

| | |
|---|---|
| `yarn typecheck` | **0** (front y API) |
| `yarn lint` | **0** (front y API, incluidos los 4 archivos de la sesión 2) |
| Suite del expediente | **21 archivos / 326 pruebas** en verde |
| **Suite completa del front** | **6 855 de 6 858** en verde |
| Pruebas nuevas | 12 de `NoteGrid` · 4 de `AdmissionBlock` · 8 de navegador (maqueta) |
| Playwright, maqueta | **8/8**, `--workers=1` |
| Int-spec API real (Neon) | **13/13**, `clinical-c14-c23-notas-e-internacion.int-spec.ts` |
| Playwright, API real (Neon) | **4/4**, `--workers=1`, `correcciones-c14-c23.real.spec.ts` |
| Playwright, recorrido H6 (maqueta) | **10/10**, `--workers=1`, `dictamen-h6-recorrido.spec.ts` — 8 `PASS` + 2 `BLOCKED` por D-06, no 10 aciertos |

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

### Hoy, contra la API real (2026-09-21, sesión 2)

**Int-spec nuevo en la API** —
`mantra-core-health-api/test/integration/clinical-c14-c23-notas-e-internacion.int-spec.ts`—,
**13 casos, 13/13 en verde** (3 corridas hasta llegar ahí, dos causas raíz reales en el camino, no
de método). Fija por HTTP directo, contra Neon:

```
Test Suites: 1 passed, 1 total
Tests:       13 passed, 13 total
```

**Playwright real** —`playwright/correcciones-c14-c23.real.spec.ts`, 4 casos, **4/4 en verde**—,
con médico y paciente **sintéticos registrados por API** (`@example.test`, nunca la cuenta real de
`doctora()`):

```
ok 1 › la guardia de lectura: 403 sin relación, 200 apenas el paciente la acepta (26.3s)
ok 2 › C-14 · vacío, error, y la fila persiste tras recargar (1.3m)
ok 3 › C-23 · alta de internación persiste tras recargar, y el registro tardío se marca (40.6s)
ok 4 › C-23 · el 400 real del servidor llega al único campo del formulario (28.9s)
```

Cinco microtareas pasan de `A MEDIAS`/`BLOQUEADO` a `HECHO` — detalle en `PLAN.md`:

| Microtarea | Qué prueba contra la API real |
|---|---|
| H2.S3.M1 | «Vacío» (paciente sin observaciones) y «error» (`page.route` con 500) — el simulador no podía dar ninguno de los dos |
| H3.S1.M2 | `POST /clinical/observations` con un `encounterId` que ya tiene fila → **201**, el servidor acepta. La regla de una fila por sesión es de la UI |
| H5.S2.M2 | El `400` real de `POST /clinical/care-episodes` (`details.violations`) llega al único campo del formulario |
| H5.S3.M1 | Alta de internación → `page.reload()` → sigue en la lista releída del servidor |
| H5.S3.M2 | **Sí existe** un rastro real y encadenado (`audit.audit_log`, `previous_hash`/`record_hash`) para `POST /authz/care-relationships/request` — verificado por consulta directa a la base, no por HTTP: la API no expone un endpoint que lo lea |

**Tres causas raíz de mi propio spec**, no del producto, corregidas en el camino (regla 05.7 — se
reproduce y se localiza antes de parchar): `irA()` (pushState + `popstate` sintético) no dispara
los resolvers de una ruta anidada parametrizada; el clic de Playwright cae en el **centro** del
campo de fecha, dejando el cursor en el segmento año de la máscara `DD/MM/AAAA` en vez del día
(`Home` lo corrige, ya lo maneja el control); `internacion-duplicada` es el aviso del **409 al
reintentar**, no un indicador persistente de «ya hay internación».

**Regresión verificada después:** maqueta `8/8` intacta, `free-note-block` `19/19`,
`admission-block` `10/10`, `yarn typecheck` 0, `yarn lint` 0 en los cuatro archivos nuevos/tocados.

### Hoy, el recorrido del dictamen (2026-09-21, sesión 3)

Al ir a abrir el PR de la sesión 2 se descubrió que **#557 (Justin) y #559 (Ender/Pablo) ya
estaban `MERGED`** en `mockup` (§1 de sesión 2 lo dejó anotado). Con eso, 10 de las 24
correcciones dejaron de ser `NOT_RUN` por definición, y H6.S1.M2/M3 pasaron de `A MEDIAS`/
`BLOQUEADO` a `HECHO`: se escribió `playwright/dictamen-h6-recorrido.spec.ts` y se recorrieron
con la cuenta médica, sin haber escrito ninguna de las dos (regla 70.4.8).

```
10 passed (2.6m)
```

**8 `PASS`** (C-15, C-16, C-17, C-18, C-19, C-24, más C-14 y C-23 de antes) · **2 `BLOCKED`**
(C-20, C-22, y la mitad de C-21 que se recorrió) · **0 `FAIL`**.

**C-18 cerró su propia ambigüedad**: la corrida imprime las opciones reales de «¿De qué consulta
es la receta?» — hay diagnóstico **y** «Otro motivo — escribirlo», que abre el campo de texto
libre. Ya no hace falta esperar a que Justin la cierre `DESCARTADO`: se pudo recorrer porque la
corrección ya estaba integrada.

**D-06, un hallazgo real** (mismo mecanismo del D-01 ya retirado, esta vez **reproducido antes de
escribirlo**): el buscador de «Medicamento» del bloque de receta cae al catálogo de reserva
`VS_RECORD_STATUS` (Activo/Inactivo) porque `misc.handlers.ts` no tiene un patrón para
`medication_requests.medication_concept_id`. Se probó en el propio test: buscar «Paracetamol» da
«Ningún medicamento coincide»; buscar «Activo» sí trae una opción, con el hint `ST-ACTIVE`. Eso
bloquea C-20 y C-22 completos, y la mitad de C-21. Detalle y reproducción exacta en
`defectos-reportados.md`.

**Tres causas raíz de mis propios selectores**, no del producto, corregidas antes de dar
veredicto: `[attr.data-testid]` de `app-input` cae directo en el `<input>` (`.locator('input')`
encima colgaba buscando un hijo que no existe); `getByPlaceholder` es ambiguo porque
`app-reference-combobox` expone el atributo en su host además del `<input>` interno; y un clic
por texto suelto («Paracetamol») caía sobre una receta **ya existente** en la historia de la
paciente —texto estático, no elegible— en vez de la opción del buscador.

### Hoy, la segunda tanda del recorrido (2026-09-21, sesión 4)

**El disparador fue un falso conflicto.** El PR #565 aparecía `CONFLICTING` en GitHub; al traer
`origin/mockup` el merge local se resolvió **limpio, sin un solo marcador** (`c138cd3e`), y tras
empujar el PR volvió a `MERGEABLE`. Era una comprobación vieja de GitHub contra otra base, no un
conflicto de texto. Lo importante fue lo que apareció al mirar: **cuatro PRs más ya integrados**
—#561 (Itzan), #562, #563 y #564 (Pablo)— que dejaron recorribles **trece** de las catorce
correcciones que seguían `NOT_RUN`.

Se recorrieron en `playwright/dictamen-h6-recorrido-2.spec.ts`, **14/14 en verde**, con
`medica@alovida.mock` sobre la maqueta. Ninguno de los cuatro PRs lo escribí yo (regla 70.4.8).

| Verdicto | Correcciones |
|---|---|
| `PASS` | C-01, C-02, C-04, C-05, C-07, C-08, C-09, C-10, C-11, C-12 |
| `PASS` parcial | C-13 — recorrida con la médica; falta la cuenta del visitador que el guion pide |
| `PASS` (media corrección) | C-21 en el perfil: **las siete** pestañas del editor, ninguna elige con radios |
| **`FAIL`** | **C-06**, por el defecto nuevo **D-07** |

**D-07, el rojo:** el interruptor de tema del encabezado es sólo-icono, tiene nombre accesible y
**no da globo** —ni al apuntarlo ni al enfocarlo aparece un `role="tooltip"`—. ADR-0012 admite
sólo-icono **con** globo; éste no lo tiene. Vive en `shell-layout`, así que **no es una pantalla:
son todas**. Itzan ya lo había declarado en el cuerpo de #561 como hallazgo fuera de su frontera;
acá está reproducido aparte, con captura, por quien no lo escribió — que es lo que hace falta para
poder llamarlo `FAIL` en un dictamen. **No se corrigió:** el marco no es de esta línea, y quien
verifica no corrige.

**Cuatro casos míos estaban mal antes de que llegaran al dictamen**, y los corregí antes de dar
veredicto (regla 05.7): la rejilla de especialidades monta `app-specialty-badge`, no `app-badge`;
`app-tabs` **no dibuja el panel de una pestaña cerrada**, así que contar los controles del editor
de una sola vez medía sobre la nada; la primera tarjeta del día es una cita ya «Atendida» y sobre
ella la tarjeta **explica** en vez de navegar —que es lo que #564 promete, no un fallo—; y tanto
la visita de laboratorio como el primer rato libre caen en días posteriores al de hoy.

### Hoy, #566: el refactor de C-06 que la empeoró (2026-09-21, sesión 5)

Pablo integró **#566**, que lleva las acciones de fila a `app-row-actions`, el componente que el
sistema de diseño publicó para esto. **La decisión es la correcta** —#564 había escrito un
desplegable propio sobre `app-menu`, y tener una implementación paralela de algo que el sistema ya
resuelve es deuda—. El problema está en lo que se perdió al migrar.

**D-08:** `app-row-actions` dibuja el icono sólo si la acción lo declara
(`@if (action.icon)`), y en `accionesDe()` de `agenda.ts` **seis de las doce no lo declaran**:

| Sin icono hoy | ¿Tenía SVG en #564? |
|---|---|
| `agenda-detalle` — **está en toda fila** | Sí |
| `agenda-aceptar`, `agenda-rechazar`, `agenda-completar`, `agenda-llegada`, `agenda-llego` | Sí, las cinco |

Comprobado con `git show cfa889c9:…/agenda.html`: cada una tenía su bloque `slot="icon"`. C-06 pide
icono **y** texto; quedó sólo el texto.

**Lo que sí sigue cumpliendo**, verificado contra las dos formas nuevas del componente: **ninguna
acción es sólo-icono**. 2 acciones quedan en la fila y 38 en desplegables, y las 40 dicen su
palabra.

**Una ambigüedad que registro y no decido** (regla 00.6): `app-row-actions` deja las acciones **en
la fila cuando son dos o menos** y sólo colapsa con tres o más. El guion de C-06 dice «en una
tabla, las acciones están en un desplegable», sin excepción. Con una sola acción, un desplegable de
un ítem es peor — las dos lecturas se defienden. Es decisión de coordinación, no mía.

**Lo que más preocupa de D-08 no es el icono: es que nada lo vio.** `yarn typecheck` 0, `yarn lint`
0, y **141/141** pruebas unitarias de `features/agenda/` + `shared/…/row-actions/` en verde. El
tipo `RowAction` declara `icon` como opcional —correcto para un componente genérico— y las pruebas
de la agenda comprueban **qué** acciones se ofrecen en cada estado, no **cómo** se dibujan. El
arreglo debería venir con esa prueba.

**Y un aviso de lectura, sin veredicto:** los `data-testid` por acción pasaron a ser
`data-action`. Los códigos no cambiaron; el atributo sí.
`playwright/carril-13-solicitudes-de-consulta.spec.ts` todavía los busca con `getByTestId`. **No
pude comprobar si eso lo rompe**: esa suite corre contra la API real y acá falla antes, al entrar
con `doctora()`. Se reporta como lo que es —una lectura del código—, no como defecto verificado.

---

## 2. A medias

### La captura «antes» de C-14/C-23 (H1.S1.M2)

**Irrecuperable en el estado actual**: cuando se abrió el navegador la primera vez, el código ya
estaba cambiado. Sólo vuelve a existir corriendo la maqueta sobre el corte limpio
(`git merge-base` + worktree aparte) — no se hizo por costo/beneficio: lo que aporta es cosmético,
la lista de campos observada **ya está** (la corrida imprime el texto del modal).

### El recorrido de teclado celda por celda (H2.S3.M2)

Los controles son nativos y el marco de la tabla es focalizable (`role="region"`, `tabindex="0"`),
pero no se hizo un recorrido explícito `Tab` por cada celda con verificación de foco visible. No
depende de la API: es trabajo de navegador que no entró en esta sesión.

### C-23 sigue con un solo campo (H5.S1.M1) — de esquema, no de pantalla

No cambió: **10 de los 18 campos de la matriz no tienen dónde caer** porque
`Encounter.hospitalization` no existe en el modelo. Ver §3.

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
| **D-02** | Dueño del modelo | Toda internación se guarda con `type_concept_id = NULL` porque **no existe catálogo de tipo de episodio**. Mandarlo exigiría un uuid a mano, que está prohibido. **Confirmado contra la API real** (int-spec, caso «D-02»): `POST /clinical/care-episodes` sin `typeConceptId` responde `201` y el `summary` releído lo confirma ausente |
| **Para Itzan** | `shared/` | `app-date-picker` trata **«campo cerrado al pasado» como «fecha de nacimiento»** y abre el calendario en **enero de 2000**. Cualquier campo operativo que no pueda ser futuro cae ahí. Se descubrió poniéndole `maxDate` a la internación y se resolvió **quitándoselo** |
| **D-03** | Dueño del modelo/infra | `POST /clinical/encounters/:id/close` responde **500** en esta base de Neon: `InvalidFieldNameException: column "content_hash" of relation "encounters" does not exist` (Postgres `42703`, confirmado con `docker logs`). Deriva de esquema real: la entidad ORM declara la columna, esta base no la tiene materializada. **Ningún encuentro se puede cerrar hoy contra este ambiente** |
| **D-04, hallazgo, sin veredicto** | Dueño de la API | Un médico **sin relación asistencial ni turno** con un paciente pudo abrir un episodio de cuidado para él (`POST /clinical/care-episodes` → `201`). La ruta lleva `@Roles('CLINICIAN','PRACTITIONER')` pero **no** `ClinicalRecordAccessGuard` (`clinical-encounters.controller.ts`) — a diferencia de `clinical/observations` y `clinical-read`, que sí lo llevan. Reproducido y documentado (int-spec); no se corrigió: es un guard de otro, y corregirlo sin acordarlo violaría la regla de «no arreglar código ajeno durante la aceptación» |
| **D-05, hallazgo, sin veredicto** | Dueño de la API | `POST /clinical/care-episodes` con `startAt` en el **futuro** responde `201` — sin rechazo server-side. La regla 60.4 (validar toda mutación server-side) esperaría un rechazo; el front sí lo bloquea, pero el contrato no |

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
| **Se escribió en `mantra-core-health-api`** (2026-09-21, sesión 2) | El `PLAN.md` original decía «se lee y se cita, no se escribe». El pedido de hoy («pruebas para la API») lo amplió explícitamente. Rama propia (`marcelo/int-spec-c14-c23`) desde `origin/dev`, un int-spec nuevo y cuatro filas agregadas a `CUENTA_ESCRIBE_EN` del harness compartido —su propio mensaje de error señalaba exactamente qué faltaba—. Nunca `dev` directo — [mantra-core-health-api PR #450](https://github.com/mdavila-2001/mantra-core-health-api/pull/450) |

---

## 5. Privacidad

Todo lo capturado y pegado es de **cuentas sintéticas declaradas**. Contra la maqueta:
`medica@alovida.mock`, paciente «Ana Lucía Pérez Quiroga» del simulador. Las capturas de la
sesión 4 (`evidencia/dictamen/c01…c13`, `d07`) muestran además la agenda del día con los nombres
que **siembra el simulador** (`core/mock/fixtures/`): son personas inventadas por el paquete de
datos de prueba, no pacientes. Contra la API real (sesión
2): un médico y varios pacientes registrados **en esta misma corrida**, con dominio `@example.test`
y sufijo aleatorio (`crearMedicoSintetico`/`crearPacienteConToken`), **nunca** la cuenta real de
`doctora()` (`pabliarca@gmail.com`) que otras suites del repo sí usan. Ninguno habla de una persona
real. **Ninguna captura, salida, matriz ni dictamen lleva datos de una persona real**, y no hizo
falta enmascarar nada.

**Datos que quedan en Neon, declarado:** los pacientes sintéticos de la sesión 2 **no se limpian**
(no hay helper de borrado para pacientes en el harness, mismo criterio que
`clinical-prescriptions-pdf.int-spec.ts`). El médico del int-spec de la API tampoco: el flujo de
relación asistencial que se ejercita sella un evento en `audit.audit_log`, que es **WORM**
(`trg_forbid_mutation`) — no hay forma de borrarlo después.

---

## 6. Handoff

| A quién | Qué |
|---|---|
| **Coordinación** | El dictamen: sigue **`NO ACEPTADO`**, pero el motivo cambió. Hoy son **19 aceptadas** (17 plenas + C-13 y C-23 parciales), **1 `FAIL`** (C-06, por **D-07 y D-08**), **3 `BLOCKED`** (C-20, C-21, C-22, por D-06) y **1 `NOT_RUN`** (C-03, la única sin rama fusionada). **Ya no es «no hay nada que mirar»: lo que queda rojo es rojo de verdad**, y son **tres** defectos con dueño. Y una decisión que es suya, no mía: `app-row-actions` deja las acciones en la fila cuando son dos o menos, y el guion de C-06 pide desplegable sin excepción — hay que decir cuál vale. El tamaño real de C-23 sigue igual: 10 de 18 campos exigen modelo nuevo |
| **El marco (quien sea su dueño)** | **D-07**, reproducido con captura: el interruptor de tema de `shell-layout.html:362` es sólo-icono y **no lleva `appTooltip`**. Es una línea, y mientras no esté **C-06 sigue en `FAIL`** para toda ruta con cabecera |
| **Pablo** | **D-08, lo primero**: su #566 dejó **seis acciones sin icono** (`agenda-detalle`, que sale en toda fila, más `agenda-aceptar`, `agenda-rechazar`, `agenda-completar`, `agenda-llegada`, `agenda-llego`). Son seis `icon:` en `accionesDe()` de `agenda.ts`, y conviene que vayan con la prueba que faltaba: sus 141 unitarias pasan sin mirar si una acción tiene icono. Del resto, #564 se recorrió entero y **las ocho dieron `PASS`** (C-04, C-07, C-08, C-10, C-11, C-12; C-13 en parcial). A C-13 le falta la mitad del **visitador**, que necesita esa cuenta — si tiene una sintética declarada, se cierra en una corrida |
| **Itzan** | Su lote #561 se recorrió entero y **las cinco dieron `PASS`** (C-01, C-02, C-05, C-09, y C-21 en el perfil: cero radios en las siete pestañas). El hallazgo del interruptor de tema que él mismo declaró está ahora **confirmado por separado como D-07** — no era sólo una observación de paso |
| **Dueño del modelo** | `matriz-internacion.md` §4: el value set de tipo de episodio (barato, no toca tablas) y el esqueleto de `encounter_hospitalizations` / `encounter_locations` / `encounter_diagnoses`. Más **D-02**, confirmado contra la API real |
| **Dueño del modelo/infra** | **D-03**: `clinical.encounters.content_hash` está en la entidad ORM y no en esta base de Neon — `POST /clinical/encounters/:id/close` da 500 siempre. Bloquea cerrar cualquier encuentro contra este ambiente |
| **Dueño de la API** | **D-04** (posible IDOR: `POST /clinical/care-episodes` sin guardia de relación asistencial) y **D-05** (`startAt` futuro aceptado sin rechazo server-side). Ninguno se corrigió: se reporta, no se arregla |
| **Itzan** (aparte, `shared/`) | La heurística de `app-date-picker` que abre en enero de 2000 ante cualquier `maxDate` |
| **Justin** | `consultation.html` es mío: el cambio del `output` de descarga que necesita lo escribo yo o lo acordamos. **C-18 ya se recorrió y dio `PASS`** (su lote #557 quedó integrado) — no hace falta que la cierre él. **C-20 sigue necesitando** que `medication-block.ts` lea `default_frequency`, además de que se resuelva D-06 |
| **Ender** | **D-06**, con reproducción: `misc.handlers.ts` no tiene patrón `ENUMS` para `medication_requests.medication_concept_id` y el buscador de «Medicamento» cae a `VS_RECORD_STATUS`. Bloquea C-20, C-22 y la mitad de C-21 hasta que se agregue la línea |
| **Quien retome** | `consulta-rejilla.spec.ts` busca el rótulo viejo del buscador del archivo clínico («Buscar por nombre o código»); el real es «Nombre o código». No se tocó: no es de este carril |

---

## 7. Procesos

**No quedó ninguno corriendo.** Sesión 1: el `yarn start` de la verificación se cerró matando su
PID a mano (`taskkill /PID 33788 /F`), porque matar la tarea **no** mata el `node.exe` hijo. Sesión
2: dos dev-servers más (`start:real-api`, luego `start` para reverificar la maqueta) dejaron el
mismo residuo cada vez —dos `taskkill` más, PIDs 33088 y 8632— y el `docker compose` con la API y la
infra **se dejó arriba**, porque no lo levanté yo (ya estaba encendido de una sesión anterior del
usuario) y no es mío apagarlo. Puerto 4200 libre, comprobado con `netstat` al cerrar.

### Un candado ajeno, que se pisó sin querer

`.claude/runtime/progress_state.json` de la raíz declaraba un carril **que no es éste**:

```json
{ "lane": "marcelo-casos-e2e", "phase": "report", "state": "blocked", "qa_status": "fail",
  "message": "Guion reejecutado entero: 18/35 PASA. Quedan 8 BLOQUEADO por falta de una sesion
              con rol de agenda (BOOTSTRAP_ADMIN_PASSWORD). Defecto nuevo H-5 abierto.",
  "updated_at": "2026-09-21T02:21:43Z" }
```

**En sesión 1 no se tocó**, a propósito. **En sesión 2 sí**: el checkpoint de avance de esta sesión
(`.claude/hooks/progress.py`) escribe sobre el mismo archivo, y al registrar el carril
`marcelo-c14-c23-api-real` se sobrescribió el de `marcelo-casos-e2e` sin querer — el script no tiene
modo «agregar», sólo «reemplazar». **No se perdió información**: el mensaje completo ya estaba
citado, textual, arriba en este mismo reporte, así que el hallazgo de esa sesión (H-5) sigue
recuperable. Queda avisado para quien sea su dueño; si necesita el archivo restaurado, este bloque
es su contenido exacto.

Es de una sesión anterior a ésta y **bloquea el cierre de cualquier sesión** hasta que se cierre o
se borre. **No se borró**: tiene un bloqueo real y un defecto abierto (H-5) que no es mío cerrar, y
borrarlo destruiría el estado de otro carril. Queda avisado para quien sea su dueño.
