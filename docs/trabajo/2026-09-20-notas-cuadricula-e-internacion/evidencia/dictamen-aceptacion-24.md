# Dictamen de aceptación — las 24 correcciones del doctor

> **H6** del lote. Regla 70.4.8: la verificación no la hace quien escribió el código, y por eso
> este hito es de la línea B. Regla 40.5.2: **prohibido el resumen optimista con algo en rojo**.
>
> **Quién dictamina:** línea B (Marcelo) · **Fecha:** 2026-09-21, madrugada
> **Contra qué se dictamina:** `origin/mockup` = `68dcb562ef3dd74de03f4887c57fd836fb21be13`
> (2026-09-20 20:59 -04), más la rama `marcelo/notas-cuadricula-e-internacion` para C-14 y C-23.

---

> [!warning] Actualización 2026-09-21, ~15:00 — **la integración avanzó mientras se escribía esto**
> Al ir a abrir el PR de la sesión 2 se descubrió que **tres PRs de este mismo lote ya están
> `MERGED` en `mockup`**, todos hoy, después del corte de este dictamen (20/09 20:59):
>
> | PR | Autor | Título | Merge |
> |---|---|---|---|
> | #557 | Justin | Simplificar el formulario de receta | 12:10:35 UTC |
> | #558 | Marcelo (yo) | C-14 y C-23: la cuadrícula de la consulta, y la internación… | 12:11:04 UTC |
> | #559 | Pablo | reporte de consultas + fix de contratos de agenda, visita y terminología | 14:33:42 UTC |
>
> **Esto no lo hice yo** en esta sesión — nadie de esta sesión mergeó nada — y **no se descubrió
> hasta ahora** porque el trabajo de hoy se hizo contra la API real, no releyendo `mockup`.
>
> **Actualización, misma sesión: ya se recorrió.** Regla 70.4.8 se cumple porque ninguno de los
> dos PRs es mío: `playwright/dictamen-h6-recorrido.spec.ts`, 10 casos, **10/10 en verde** (el
> «verde» de la corrida no es el veredicto — cada caso afirma lo que el guion de §1 pide, incluido
> el `BLOCKED` de tres de ellos). **§0 y §2 de abajo ya están actualizados** con los resultados
> reales.
>
> **Y volvió a avanzar, otra vez mientras se escribía.** Al resolver el conflicto del PR #565
> aparecieron **cuatro PRs más** ya `MERGED` en `mockup` — #561 (Itzan), #562, #563 y #564
> (Pablo) —, que entre los dos cubren **trece** de las catorce que quedaban. Se recorrieron
> también: `playwright/dictamen-h6-recorrido-2.spec.ts`, con la misma cuenta sintética. Tampoco
> escribí ninguno de los cuatro. **La única sin integrar es C-03.**
>
> **Y una tercera vez, ya escrito todo lo anterior:** entró **#566** (Pablo), que refactoriza C-06
> al componente del sistema. Se volvió a recorrer entero — **15/15** — y el veredicto de C-06
> **empeoró**: además de D-07, el propio #566 introdujo **D-08** (seis acciones perdieron su
> icono). El detalle está en **§4.6**.

## 0. VEREDICTO GLOBAL — `NO ACEPTADO`

**El veredicto global es el más bajo de sus partes.** El tablero cambió tres veces en un día: hoy
**23 de las 24 están integradas y recorridas**, y la enorme mayoría dio `PASS`. Pero sigue siendo
`NO ACEPTADO`, y por dos motivos que no son de conteo: hay **un `FAIL` con reproducción** (C-06,
defectos **D-07** y **D-08**) y **tres `BLOCKED`** que ningún avance de integración destraba,
porque los bloquea un defecto del simulador (**D-06**).

> **Ojo con C-06: el último PR la empeoró.** #566 migró las acciones de fila al componente del
> sistema —que es lo correcto— y en el camino **seis acciones perdieron su icono** (D-08). La
> corrección que #566 dice cerrar pide «icono **y** texto»: el texto quedó, el icono no. Pasó
> `typecheck`, `lint` y **141/141** pruebas unitarias sin que ninguna lo viera.

| | |
|---|---|
| **Aceptadas con evidencia** | **19** de 24 — 17 plenas (C-01, C-02, C-04, C-05, C-07…C-12, C-14…C-19, C-24) y 2 parciales con su límite declarado (C-13, C-23) |
| **Rechazadas (`FAIL`)** | **1** — C-06, por **D-07** y **D-08** (ver §5) |
| **Bloqueadas (`BLOCKED`)** | **3** — C-20, C-21 y C-22, por **D-06** (ver §5) |
| **Sin ejercitar (`NOT_RUN`)** | **1** — C-03 (Ender), la única que no tiene rama fusionada |
| **Rojos abiertos** | **3** — D-06 (Ender), D-07 (el marco) y **D-08** (Pablo, regresión metida por #566) |

### El hecho que explica el dictamen entero

**Ya no es «no está integrado»: es que lo que queda rojo es rojo de verdad.** El corte original
(20:59 del 20/09) no tenía ninguna corrección. En el día entraron siete PRs:

| PR | Autor | Cubre | Recorrido en |
|---|---|---|---|
| #557 | Justin | C-15…C-20, C-22, la parte de medicación de C-21 | §4.5 |
| #558 | Marcelo (yo) | C-14, C-23 | §3 y §4 — **no lo dictamino yo** salvo por evidencia propia declarada |
| #559 | Ender/Pablo | C-24 + contratos | §4.5 |
| #561 | Itzan | C-01, C-02, C-05, C-09, y la parte de perfil de C-06/C-21 | §4.6 |
| #562 | Pablo | contratos de scheduling | — (sin correción propia del lote) |
| #563 | Ender | datos del simulador para C-24 | §4.5 |
| #564 | Pablo | C-04, C-06, C-07, C-08, C-10, C-11, C-12, C-13 | §4.6 |
| #566 | Pablo | C-06 otra vez: migra las acciones de fila a `app-row-actions` | §4.6 — **introduce D-08** |

**La única que sigue sin integrar es C-03** (Ender, globo del panel principal).

```
$ git log --since="2026-09-20 00:00" --format='%h %ad %an | %s' --date=format:'%d/%m %H:%M' origin/mockup | head -3
68dcb562 20/09 20:59 Pablo Arauz Caballero | docs(deploy): documentar Traefik por IP en vez del dominio sslip.io de Coolify
68969782 20/09 12:32 Justin David Saldias | Merge pull request #554 from mdavila-2001/justin/build-rotulos-y-precios
5aacb0a2 20/09 12:32 Justin David Saldias | Merge pull request #552 from mdavila-2001/marcelo/auditoria-aseguradora-mockup
```

```
$ git for-each-ref --sort=-committerdate --format='%(committerdate:format:%d/%m %H:%M) | %(refname:short)' refs/remotes/origin | head -4
21/09 01:54 | origin/itzan/patron-acciones-fila-insignia-perfil
20/09 21:46 | origin/dev
20/09 21:43 | origin/marcelo/fix-agendas-homonimas
20/09 20:59 | origin/mockup
```

Sólo una rama de esta noche está empujada (Itzan, 01:54) y **no está fusionada**. Las demás no
existen en el remoto todavía.

> [!warning] Lo que este dictamen **no** dice
> No dice que las 22 estén mal. Dice que **no se pueden ejercitar todavía**, y que quien las
> ejercite tiene que ser alguien que no las escribió, **después** de que estén integradas.
> Un `NOT_RUN` honesto vale; un `PASS` porque «seguramente lo hizo» no vale nada.

---

## 1. El guion — el caso mínimo que acepta o rechaza cada una

Escrito **antes** de recorrer (H6.S1.M1). Cuando el prompt del lote correspondiente ya define un
kill-test, se usa ése y no se reinventa.

| ID | Caso mínimo que la acepta o la rechaza | Cuenta |
|---|---|---|
| C-01 | Abrir `/my-account` → pestaña «Dónde atiendo». La sección «Cómo atendés» **no está** | médica |
| C-02 | En `/my-account` no existen los enlaces «Mi consultorio propio» ni «Mi organización médica»; el consultorio es una pestaña con su QR | médica |
| C-03 | Panel principal → pasar el ratón por un panel. Sale un tooltip **con el diseño de los de la agenda** | médica |
| C-04 | `/schedule` → clic en una tarjeta. Lleva a iniciar el encuentro | médica |
| C-05 | `/my-account` → «Editar» en **cada** pestaña. Todos los campos aparecen y se pueden editar | médica |
| C-06 | Cualquier botón: tiene icono **y** texto. En una tabla, las acciones están en un desplegable | todas |
| C-07 | `/schedule?vista=table` ya no existe como vista | médica |
| C-08 | Semana se despliega con hover · mes con hover de tarjeta y chips · el rótulo dice «Consultas», no «Calendario» | médica |
| C-09 | Las especialidades se ven como grid de insignias, **igual** en perfil público y privado | médica + anónima |
| C-10 | Horarios: no hay «Cupos» · se llena desde un modal · no pide hora · usa toggles · los slots respetan bloqueos y descansos | médica |
| C-11 | Con una consulta en curso, iniciar otra **no se puede**; los botones de arriba a la derecha no están | médica |
| C-12 | Programar horario de «Mis Servicios» bloquea la agenda con razón **«Otros servicios»** | médica |
| C-13 | La visita de laboratorio se crea en la misma pestaña, la tarjeta es **roja** y dice VISITADOR, y el slot es de 15 min configurable | médica + visitador |
| **C-14** | **Abrir notas → hay cuadrícula → elegir cabecera → cargar fila → recargar → la fila sigue → la segunda se rechaza con su motivo** | **médica** |
| C-15 | En la pantalla donde se **escribe** la receta **no** hay botón de descargar | médica |
| C-16 | La barra de demostración no aparece al registrar una receta | médica |
| C-17 | La receta no ofrece «favoritos» | médica |
| C-18 | «¿De qué consulta es la receta?» permite **elegir un diagnóstico o escribir una razón** | médica |
| C-19 | El campo de dosis acepta letras y números; «Unidad» ya no existe | médica |
| C-20 | Elegir un medicamento con posología de fábrica **completa la frecuencia sola** | médica |
| C-21 | Todo lo que elige un valor de una lista es un `select` | todas |
| C-22 | «¿Para qué es esta receta?» se puede dejar vacío y la receta se emite igual | médica |
| **C-23** | **Abrir internación → la hoja pide lo que la norma exige y el contrato soporta** | **médica** |
| C-24 | Panel: los colores coinciden · hay reporte semanal y mensual · mapa de calor hora×día · se ven las canceladas · se ven otras atenciones | médica |

---

## 2. El dictamen, corrección por corrección

**Veredictos:** `PASS` (aceptada, con evidencia) · `FAIL` (rechazada, con reproducción) ·
`NOT_RUN` (no se ejercitó, con motivo) · `BLOCKED` (no se puede ejercitar).

| ID | Dueño | Veredicto | Evidencia / motivo |
|---|---|---|---|
| C-01 | Itzan | `PASS` | #561 integrado. Recorrida: «Dónde atiendo» ya no tiene la sección «Cómo atendés». [`c01-sin-como-atendes.png`](dictamen/c01-sin-como-atendes.png) |
| C-02 | Itzan | `PASS` | #561 integrado. Recorrida: no existe ningún enlace «Mi consultorio propio» ni «Mi organización médica»; el consultorio se edita **dentro** de la pestaña. [`c02-consultorio-en-el-perfil.png`](dictamen/c02-consultorio-en-el-perfil.png) |
| C-03 | Ender | `NOT_RUN` | **La única que sigue sin integrar.** Sin rama en el remoto |
| C-04 | Pablo | `PASS` | #564 integrado. Recorrida en sus dos mitades: sobre una cita «Atendida» la tarjeta **explica** que está cerrada; sobre una «En consulta» **lleva a atenderla**. [`c04-tarjeta-cita-cerrada.png`](dictamen/c04-tarjeta-cita-cerrada.png) · [`c04-tarjeta-lleva-a-atender.png`](dictamen/c04-tarjeta-lleva-a-atender.png) |
| C-05 | Itzan | `PASS` | #561 integrado. Recorrida: el editor abre con las **siete** pestañas de la ficha. [`c05-editor-siete-pestanas.png`](dictamen/c05-editor-siete-pestanas.png) |
| **C-06** | **Itzan + Pablo + los cinco** | **`FAIL`** (dos defectos) | #561, #564 y **#566** integrados. Lo que cumple: **ninguna acción de fila es sólo-icono** — las 2 que quedan en la fila y las 38 del desplegable llevan su palabra. Lo que no: **D-08**, que lo metió #566 — al migrar a `app-row-actions`, **seis acciones perdieron su icono** (`agenda-detalle`, que está en toda fila, `agenda-aceptar`, `agenda-rechazar`, `agenda-completar`, `agenda-llegada`, `agenda-llego`); C-06 pide icono **y** texto, y ahora falta el icono. Y **D-07**, transversal: el interruptor de tema del encabezado es sólo-icono **y no da globo**, en toda ruta con cabecera. [`c06-acciones-desplegable.png`](dictamen/c06-acciones-desplegable.png) · [`d08-acciones-sin-icono.png`](dictamen/d08-acciones-sin-icono.png) · [`d07-interruptor-de-tema-sin-globo.png`](dictamen/d07-interruptor-de-tema-sin-globo.png) |
| C-07 | Pablo | `PASS` | #564 integrado. Recorrida: `?vista=table` ya no dibuja tabla ninguna, cae al calendario **y no redirige** (la dirección se conserva, así que «atrás» no se rompe). [`c07-sin-tabla.png`](dictamen/c07-sin-tabla.png) |
| C-08 | Pablo | `PASS` | #564 integrado. Recorrida: la solapa se llama «Consultas»; no queda ninguna llamada «Calendario». [`c08-solapa-consultas.png`](dictamen/c08-solapa-consultas.png) |
| C-09 | Itzan | `PASS` | #561 integrado. Recorrida: rejilla de insignias, cada una **con el nombre escrito** (no sólo color). [`c09-insignias-especialidad.png`](dictamen/c09-insignias-especialidad.png) |
| C-10 | Pablo | `PASS` | #564 integrado. Recorrida entera: no hay solapa «Cupos» para quien tiene calendario · tocar un rato libre abre un **modal** · sobre un cupo la franja es **dato** y no se pregunta la hora («Desde»/«Hasta» no existen). [`c10-sin-solapa-cupos.png`](dictamen/c10-sin-solapa-cupos.png) · [`c10-modal-sin-preguntar-la-hora.png`](dictamen/c10-modal-sin-preguntar-la-hora.png) |
| C-11 | Pablo | `PASS` | #564 integrado. Recorrida en sus dos mitades: el encabezado ya no lleva los tres botones sueltos, **y** con una consulta en curso abrir otra se rechaza diciendo cuál está abierta. [`c11-encabezado-sin-botones.png`](dictamen/c11-encabezado-sin-botones.png) · [`c11-una-consulta-a-la-vez.png`](dictamen/c11-una-consulta-a-la-vez.png) |
| C-12 | Pablo + Ender | `PASS` | #564 integrado. Recorrida de punta a punta: «Programar horario» recicla la grilla del horario, avisa **antes** de guardar con qué razón va a aparecer, y el rato queda en la agenda clínica como «Otros servicios». [`c12-programar-horario.png`](dictamen/c12-programar-horario.png) · [`c12-agenda-otros-servicios.png`](dictamen/c12-agenda-otros-servicios.png) |
| C-13 | Pablo + Ender | `PASS` parcial | #564 integrado. Recorrida con la cuenta médica: la visita se ve como tarjeta con insignia «Visitador» y **su bloque no publica un solo dato clínico** (se buscó «diagnóstico», «receta», «medicamento» y «alergia» en el texto del bloque: ninguno). **Límite declarado:** falta la mitad del visitador — el guion pide esa cuenta y no se ejercitó. [`c13-tarjeta-visitador.png`](dictamen/c13-tarjeta-visitador.png) |
| **C-14** | **Marcelo** | **`PASS`** | **Ejercitada en navegador y contra la API real** (Neon), ver §3 |
| C-15 | Justin | `PASS` | #557 integrado. Recorrida: sin botón de descargar en la pantalla de escritura. `dictamen-h6-recorrido.spec.ts` |
| C-16 | Justin | `PASS` | #557 integrado. Recorrida: sin barra de demostración al registrar |
| C-17 | Justin | `PASS` | #557 integrado. Recorrida: sin «favoritos» ofrecidos |
| C-18 | Justin | `PASS` | #557 integrado. Recorrida: «¿De qué consulta es la receta?» ofrece diagnóstico **y** «Otro motivo — escribirlo», que abre el campo de texto libre |
| C-19 | Justin | `PASS` | #557 integrado. Recorrida: la dosis acepta texto libre («500 mg»); «Unidad» no existe en el formulario |
| C-20 | Justin + Ender | `BLOCKED` | #557+#559 integrados, pero **D-06** (nuevo, ver §5) rompe el buscador de medicamentos: cae al catálogo de reserva `VS_RECORD_STATUS`, así que no se puede elegir NINGÚN medicamento real para ver si la frecuencia se completa sola. Aparte, por lectura de código: `onMedicamentoElegido()` nunca consume `default_frequency` — aunque D-06 se arreglara, el CA seguiría sin cumplirse |
| C-21 | Itzan + Justin + los cinco | `BLOCKED` | Transversal, y sus dos mitades recorridas dan cosas distintas. **Perfil (#561): cumple** — las **siete** pestañas del editor se recorrieron una por una y **ninguna elige de una lista con radios**; todo lo que elige es un `select`. **Medicación (#557): `BLOCKED` por D-06** (abajo). Como una parte no se puede ejercitar, la corrección entera queda `BLOCKED`. [`c21-editor-controles.png`](dictamen/c21-editor-controles.png) |
| C-21 (parcial, medicación) | Justin | `BLOCKED` | Bloqueada por D-06: no se puede crear una receta nueva (todas las existentes ya están emitidas) para comprobar el menú de acciones |
| C-22 | Justin | `BLOCKED` | Bloqueada por D-06: el CA exige elegir un medicamento y dejar el motivo vacío; sin poder elegir medicamento no hay nada que ejercitar |
| **C-23** | **Marcelo** | **`PASS` parcial** | **Ejercitada**, y su límite está declarado. Ver §4 |
| C-24 | Ender | `PASS` | #559 integrado. Recorrida: panel «Tus consultas» con cifras semana/mes/canceladas, mapa de calor con celdas numeradas (no sólo color) |

---

## 3. C-14 — `PASS`

**Ejercitada en navegador**, `playwright/correcciones-c14-c23.spec.ts`:

```
ok 1 › C-14 · la cuadrícula de la consulta › la fila se registra,
       sobrevive a recargar, y la segunda se rechaza con su motivo (22.5s)
```

Lo que esa corrida demuestra, punto por punto contra el pedido del cliente:

| Lo que pidió | Estado | Cómo se comprobó |
|---|---|---|
| «vista de cuadrilla tipo excel» en el modal de notas | ✅ | Pestaña «Cuadrícula» junto a «Escribir»; tabla con cabeceras y filas |
| «que le permita seleccionar el nombre del header» | ✅ | `<select>` de terminología. Se asertó que **no hay `input`** en ese control: no se puede teclear un nombre |
| …y que el catálogo sea el correcto | ✅ | La corrida imprime: `Peso`, `Talla`, `Presión arterial sistólica`, `Frecuencia cardíaca`, … y se asertó que **no** contiene `Pendiente` |
| «poner filas» | ✅ | Celda cargada y guardada |
| «estas filas se deben cargar para la siguiente sesiones» | ✅ | **Kill-test**: recargar la página, reabrir la casilla, la fila está con su valor (`123`) |
| «solo se puede registrar una fila por sesion» | ✅ | Tras guardar, `cuadricula-fila-nueva` y `cuadricula-guardar` tienen **count 0**: el camino no existe, no está sólo deshabilitado |
| «debe decirle que por motivos de integridad…» | ✅ | El aviso contiene «una sola fila por sesión» |
| «Explicando que sino no se podrá saber que registro corresponde cada sesión» | ✅ | El aviso contiene «qué registro corresponde a cada consulta» |
| Se anuncia a un lector de pantalla | ✅ | El aviso tiene `role` en `status\|alert` |
| Usable en móvil | ✅ | A 390 px: desborde horizontal de la página **= 0** (la tabla se desplaza, la página no) |

**Capturas:** `c14-1-cuadricula-al-abrir.png` · `c14-2-columna-agregada.png` ·
`c14-3-fila-guardada-y-restriccion.png` · `c14-4-tras-recargar.png` · `c14-5-movil-390.png` ·
`c14-vista-{light,dark}-{movil,tablet,escritorio}.png`

**Cobertura unitaria:** 12 pruebas en `note-grid.spec.ts`, dentro de **21 archivos / 326 pruebas**
en verde del expediente.

**Actualizado 2026-09-21 (sesión 2): ejercitada también contra la API real.** Lo de arriba corrió
contra el simulador; después se cerró contra Neon (Docker encendido, sin `mockBackend`):

```
# API, por HTTP directo — clinical-c14-c23-notas-e-internacion.int-spec.ts
Tests: 13 passed, 13 total

# Navegador, contra la API real — correcciones-c14-c23.real.spec.ts
ok 1 › la guardia de lectura: 403 sin relación, 200 apenas el paciente la acepta (26.3s)
ok 2 › C-14 · vacío, error, y la fila persiste tras recargar (1.3m)
4 passed
```

Cierra lo que el simulador no podía dar: los estados «vacío» y «error» (no falla a pedido), y qué
responde el servidor si la petición de una segunda fila llega igual (**acepta**, `201` — la regla
de una fila por sesión es de la UI). **Peldaño: `VERIFIED` contra API real**, no sólo contra
maqueta. Tres hallazgos nuevos en el camino (esquema, autorización potencial, auditoría real sin
endpoint de lectura) — ver `defectos-reportados.md`.

---

## 4. C-23 — `PASS` parcial, y el parcial es lo importante

**Lo que se entregó:**

```
ok 2 › C-23 · la hoja de internación › sigue teniendo un campo porque el contrato da uno,
       y muestra lo que el servidor devuelve (15.5s)
```

| Lo que se hizo | Estado |
|---|---|
| **Investigar qué debe tener según norma** | ✅ [`fuentes-normativas-internacion.md`](./fuentes-normativas-internacion.md) — FHIR R4 citado y verificado; norma boliviana identificada (RM Nº 0090, 26/02/2008) con **contenido `UNKNOWN`** |
| **Matriz campo × fuente × soporte** | ✅ [`matriz-internacion.md`](./matriz-internacion.md) — 18 campos, 6 soportados, 10 sin lugar donde caer |
| Mostrar el profesional a cargo | ✅ La corrida imprime: `En curso Desde el 21/09/2026 02:30 A tu cargo` |
| Declarar el registro tardío | ✅ Cubierto por 2 pruebas en `admission-block.spec.ts` (no se pudo ejercitar en navegador: exige un alta con fecha pasada, y el campo es segmentado) |
| Rechazar una fecha de inicio futura | ✅ Cubierto por 2 pruebas en `admission-block.spec.ts` |
| La ayuda dice la verdad sobre las dos fechas | ✅ «Puede ser pasada: se registra cuándo empezó y cuándo se escribió» |

**Lo que NO se hizo, y es la mayor parte del pedido:**

La corrida imprime el dato que importa:

```
CAMPOS DE ENTRADA DEL FORMULARIO DE INTERNACIÓN: 1
```

**El formulario sigue teniendo un campo**, porque `POST /clinical/care-episodes` no acepta ningún
otro que se pueda ofrecer hoy. Procedencia, sala, cama, servicio, diagnóstico de ingreso, dieta,
destino al alta y reingreso **no tienen columna en el modelo** — y en el estándar viven en
`Encounter.hospitalization`, no en el episodio al que este formulario escribe.

**Si el criterio de aceptación de C-23 es «el formulario pide lo que pide la norma», el veredicto
es `FAIL`, y el arreglo no es de pantalla: es de modelo.** La propuesta está escrita, con tablas y
columnas, en `matriz-internacion.md` §4, y **no se tocó la base** (regla 97.1.3).

---

## 4.5. C-15…C-19, C-24 — `PASS`; C-20/C-21(parcial)/C-22 — `BLOCKED`

**Ejercitados en navegador**, `playwright/dictamen-h6-recorrido.spec.ts`, 10/10 en verde:

```
ok  1 › C-15 · en la pantalla donde se escribe la receta no hay botón de descargar (16.9s)
ok  2 › C-16 · la barra de demostración no aparece al registrar una receta (17.8s)
ok  3 › C-17 · la receta no ofrece «favoritos» (16.0s)
ok  4 › C-18 · «¿De qué consulta es la receta?» permite elegir un diagnóstico o escribir una razón (17.7s)
ok  5 › C-19 · el campo de dosis acepta letras y números; «Unidad» ya no existe (15.2s)
ok  6 › D-06 · el buscador de «Medicamento» ofrece Activo/Inactivo, no medicamentos (14.9s)
ok  7 › C-20 · BLOCKED por D-06 (15.8s)
ok  8 › C-21 (parcial, medicación) · BLOCKED por D-06 (14.4s)
ok  9 › C-22 · BLOCKED por D-06 (15.4s)
ok 10 › C-24 · el panel coincide en colores, tiene reporte semanal/mensual, mapa de calor,
        canceladas y otras atenciones (8.6s)
```

**«10/10 verde» es la corrida, no el veredicto**: 7 casos afirman lo que el CA pide (`PASS`), y 3
afirman —y prueban con evidencia reproducida— que el CA no se puede ejercitar (`BLOCKED`). Ninguno
declara `PASS` de algo que no corrió.

**C-18, punto por punto:** las opciones que imprime la corrida son
`["Seleccionar opción", "Sin diagnóstico asociado", "Hipertensión arterial esencial",
"Dislipidemia", "Infección respiratoria aguda · Resuelto", "Otro motivo — escribirlo"]` — hay
diagnóstico **y** motivo libre, y elegir «Otro motivo» abre el campo de texto
(`receta-motivo-libre`). Cierra el `NOT_RUN` que tenía por Q-D4: no hizo falta esperar a Justin,
la corrección ya estaba integrada y se pudo recorrer.

**Tres causas raíz del propio recorrido, no del producto**, corregidas antes de dar un veredicto
(regla 05.7 — reproducir y localizar antes de reportar): `data-testid` de `app-input` cae
directo en el `<input>` (`.locator('input')` encima buscaba un hijo que no existe y colgaba);
`getByPlaceholder` es ambiguo porque `app-reference-combobox` expone el atributo en su host
además del `<input>` interno; y un clic por texto suelto («Paracetamol») caía sobre una receta
**ya existente** en la historia de la paciente en vez de la opción del buscador —el síntoma no
era «no encuentra el medicamento», era «elige el texto equivocado y nunca selecciona nada»—.

**D-06, la causa real detrás de C-20/21/22**, con reproducción en el propio test: buscar
«Paracetamol» → `Ningún medicamento coincide`; buscar «Activo» → aparece, con el hint `ST-ACTIVE`
— el mismo código que `VS_RECORD_STATUS` usa en el diagnóstico. Detalle completo en
`defectos-reportados.md`.

---

## 4.6. C-01…C-13 y C-21(perfil) — la segunda tanda, con #561 y #564

Los cuatro PRs de la tarde (#561 Itzan, #562, #563 y #564 Pablo) dejaron recorribles **trece** de
las catorce que quedaban. Recorrido en `playwright/dictamen-h6-recorrido-2.spec.ts`, cuenta
`medica@alovida.mock`, maqueta (`mockBackend: true`), `--workers=1`:

```
ok  1 C-01 - «Dónde atiendo» ya no tiene la sección «Cómo atendés» (12.5s)
ok  2 C-02 - el consultorio propio es una pestaña del perfil, no un enlace afuera (10.2s)
ok  3 C-05 - el editor tiene las siete pestañas de la ficha (11.6s)
ok  4 C-09 - las especialidades se ven como una rejilla de insignias (11.0s)
ok  5 C-21 (parcial, perfil) - ninguna de las siete pestañas del editor elige con radios (14.0s)
ok  6 C-08 - la solapa se llama «Consultas» y ya no «Calendario» (9.7s)
ok  7 C-07 - «vista=table» ya no dibuja la tabla y no redirige (12.2s)
ok  8 C-10 - sin solapa «Cupos», el alta es un modal y sobre un cupo no se pregunta la hora (12.1s)
ok  9 C-06 - las acciones de la fila del día son un desplegable con icono y texto (9.3s)
ok 10 C-04 - la tarjeta del día hace lo que la cita admite en su estado (10.3s)
ok 11 C-13 (parcial, médica) - la visita de laboratorio es una tarjeta de «Visitador» sin dato clínico (9.6s)
ok 12 C-06 (transversal) - D-07: el interruptor de tema del encabezado es sólo-icono y no da globo (11.1s)
ok 13 C-12 - «Mis servicios» programa su horario y el rato queda como «Otros servicios» (17.4s)
ok 14 C-11 - el encabezado pierde los tres botones y no se abre una segunda consulta (10.1s)
14 passed (2.7m)
```

**El verde de la corrida no es el veredicto.** El caso 12 pasa **afirmando un defecto**: que el
interruptor no da globo. Es la forma de dejarlo reproducible en vez de anotado.

### Lo que la corrida contestó y no estaba decidido

- **C-21, la mitad del perfil, se cierra en `PASS`.** El guion pide que «todo lo que elige un valor
  de una lista sea un `select`». Se recorrieron las **siete** pestañas del editor una por una —el
  panel de una pestaña cerrada **no existe en el DOM**, así que contarlas de una sola vez habría
  medido sobre la nada— y el conteo por pestaña fue: `Datos personales` 0 radios / 1 select ·
  `Contacto` 0 / 1 · `Facturación` 0 / 0 · `Dónde atiendo` 0 / 0 · `Trayectoria` 0 / 2 ·
  `Credenciales` 0 / 2 · `Actividad` 0 / 0. **Cero radios en las siete.**
- **C-04 tiene dos comportamientos, no uno.** «La tarjeta lleva a iniciar el encuentro» se cumple
  sobre una cita abierta; sobre una ya atendida la tarjeta **responde igual**, explicando que está
  cerrada. Se ejercitaron los dos: primero fallé el caso dando por sentado que toda tarjeta navega
  —la primera del día era «Atendida»— y la corrida lo desmintió antes de que llegara al dictamen.
- **C-07 no rompe el «atrás».** La dirección `?vista=table` se conserva tal cual: cae al calendario
  **sin** redirigir, que es lo que Pablo declaró y lo que evita meter una entrada al historial.
- **C-06 no se cierra con las dos áreas ejercitadas.** Las acciones de fila cumplen, pero el barrido
  transversal tiene un contraejemplo en el marco — **D-07**, abajo.

### Y una tercera vuelta: #566, el PR que refactoriza C-06

Ya escrito lo de arriba, se integró **#566** («las acciones de la fila usan `app-row-actions`, el
componente del sistema»). Se volvió a recorrer entero: **15/15**. Cambia dos cosas que importan
para el veredicto:

1. **Las acciones ya no van siempre a un desplegable.** `app-row-actions` las deja **en la fila
   cuando son dos o menos** y sólo colapsa con tres o más. En el día de la médica: 2 en la fila
   (una cita «Atendida» ofrece sólo «Ver detalle») y 38 en desplegables. **El guion de C-06 dice
   «en una tabla, las acciones están en un desplegable», sin excepción.** Las dos lecturas son
   defendibles y **no la resuelvo yo**: queda registrada como ambigüedad para coordinación
   (regla 00.6), no como defecto.
2. **Seis acciones perdieron su icono: D-08.** Esto sí es defecto, y no es ambiguo — C-06 pide
   icono **y** texto, y seis quedaron sin icono, entre ellas la que aparece en **toda** fila. Las
   seis lo tenían en #564.

**Lo que sigue cumpliendo, y se verificó de nuevo contra las dos formas nuevas:** ninguna acción es
sólo-icono. Las 40 dicen su palabra.

**Una nota para quien mantenga otras suites:** los `data-testid` por acción (`agenda-detalle`,
`agenda-aceptar`, …) pasaron a ser **`data-action`**. Los códigos son los mismos; el atributo no.
`playwright/carril-13-solicitudes-de-consulta.spec.ts` todavía los busca con `getByTestId`. **No
se pudo comprobar si eso lo rompe**: esa suite corre contra la API real y acá falla antes, al
entrar. Queda como aviso de lectura, no como defecto verificado.

### El límite de esta tanda, declarado

- **C-13 queda `PASS` parcial**: el guion pide **médica + visitador**, y sólo se ejercitó la médica.
- **C-06 y C-21 siguen siendo transversales.** Lo recorrido son las áreas donde el patrón ya está
  aplicado; un barrido del proyecto entero sigue sin hacerse.
- **C-03 no se recorrió**: no está integrada.

---

## 5. Rojos, y su clasificación

**Hay un rojo ejercitado de las 24 —C-06, por D-07—** y dos `BLOCKED` que dependen de D-06. El
resto de los hallazgos son de esquema y de contrato, destapados al cerrar C-14/C-23 contra la API
real (sesión 2). Todos en [`defectos-reportados.md`](./defectos-reportados.md):

| ID | Clase | Dueño | Estado |
|---|---|---|---|
| ~~D-01~~ | — | — | **RETIRADO.** Lo reporté mal: clasifiqué desde un `grep` vacío sin reproducir, y el navegador lo desmintió. Queda escrito con su error de método en vez de borrarse |
| D-02 | `PRODUCT_BUG` | Dueño del modelo | Abierto. Toda internación se guarda con `type_concept_id = NULL` porque no existe catálogo de tipo de episodio. **Confirmado contra la API real** |
| D-03 | `PRODUCT_BUG` | Dueño del modelo/infra | Abierto. `POST /clinical/encounters/:id/close` da `500` en esta base de Neon: falta la columna `content_hash` que la entidad ORM declara. Ningún encuentro se puede cerrar hoy |
| D-04 | Hallazgo, sin veredicto | Dueño de la API | `POST /clinical/care-episodes` no lleva `ClinicalRecordAccessGuard`: un médico sin relación con el paciente pudo internarlo. Reproducido, no corregido |
| D-05 | Hallazgo, sin veredicto | Dueño de la API | `startAt` futuro en `care-episodes` se acepta sin rechazo server-side |
| D-06 | `PRODUCT_BUG` (maqueta) | Ender — `core/mock/handlers/misc.handlers.ts` | Abierto. El buscador de «Medicamento» del bloque de medicación cae al catálogo de reserva `VS_RECORD_STATUS` (Activo/Inactivo) porque la tabla `ENUMS` no tiene patrón para `medication_requests.medication_concept_id`. **Reproducido con captura y sin adivinar** (mismo mecanismo del D-01 retirado, pero real esta vez): buscar cualquier medicamento no devuelve nada; buscar «Activo» sí. Bloquea C-20 y C-22 completos y la mitad de C-21 |
| **D-07** | **`PRODUCT_BUG`** | Transversal — `features/shell-layout/shell-layout.html:362` + `core/alovida/alovida-theme-toggle.directive.ts` | **Abierto, y es el `FAIL` de C-06.** El interruptor de tema del encabezado es sólo-icono, tiene nombre accesible («Cambiar a modo claro/oscuro») y **no tiene globo**: ni al apuntarlo ni al enfocarlo aparece ningún `role="tooltip"`. Vive en el marco, así que se repite en **toda** ruta con cabecera. Lo había declarado **Itzan** en el cuerpo de #561 como hallazgo fuera de su frontera; acá está **reproducido por separado**, con captura, por quien no lo escribió |

| **D-08** | **`PRODUCT_BUG`** (regresión) | **Pablo** — `src/app/features/agenda/agenda.ts`, `accionesDe()` | **Abierto, y es el segundo motivo del `FAIL` de C-06.** #566 migró las acciones de fila a `app-row-actions` —correcto— pero el componente dibuja el icono sólo si la acción lo declara, y **seis no lo declaran**: `agenda-detalle` (está en toda fila), `agenda-aceptar`, `agenda-rechazar`, `agenda-completar`, `agenda-llegada`, `agenda-llego`. **Las seis tenían su SVG en #564**, verificado con `git show cfa889c9`. Lo introdujo el PR que dice cerrar C-06 |

**Un hallazgo más, de `shared/`, para Itzan** (no es defecto de las 24, y no se reportó como tal
porque no lo pidió nadie): `app-date-picker` trata **«campo cerrado al pasado» como «es una fecha
de nacimiento»** y abre el calendario en **enero de 2000**. Cualquier campo operativo que
legítimamente no pueda ser futuro —el inicio de una internación, por ejemplo— cae en esa rama y
abre a veintiséis años del día que se busca. Se descubrió poniéndole `maxDate` a la internación y
se resolvió **quitándoselo**; la heurística sigue ahí para el próximo que la pise.

---

## 6. Qué hace falta para que este dictamen valga algo

1. **Integrar C-03** (Ender, globo del panel principal). Es la única sin rama fusionada, y la única
   `NOT_RUN` que queda. Al integrarse, se recorre con el guion de §1 por quien no la escribió.
2. **D-08 lo cierra Pablo**, y es lo más barato de la lista: seis `icon:` en `accionesDe()`
   (`agenda.ts`). Es una regresión de su propio #566 sobre la corrección que ese PR refactoriza.
   Y conviene que el arreglo venga con la prueba que faltaba: las 141 unitarias de la agenda pasan
   **sin mirar si una acción tiene icono**.
3. **D-07 lo cierra quien sea dueño del marco.** Es una línea: el interruptor de tema de
   `shell-layout.html:362` necesita su `appTooltip`, igual que el resto de los sólo-icono del
   proyecto. Hasta entonces **C-06 sigue en `FAIL`**, y el `FAIL` alcanza a toda ruta con cabecera.
4. **Cerrar la mitad que falta de C-13**: el guion pide la cuenta del visitador y sólo se ejercitó
   la médica. Mientras tanto queda `PASS` parcial, no `PASS`.
5. **D-06 lo cierra Ender** (`misc.handlers.ts`, es suyo): una línea en la tabla `ENUMS` con el
   patrón `/medication_requests\.medication_concept_id/` → `VS_MEDICAMENTO` (o el nombre que use
   el fixture real de medicamentos). Sin eso, C-20/C-22/C-21(parcial) siguen `BLOCKED` aunque el
   resto de #557 ya esté integrado.
6. **C-20 tiene una segunda causa, de Justin**: aunque D-06 se arregle, `onMedicamentoElegido()`
   (`medication-block.ts`) no lee `default_frequency` de la ficha del concepto — sólo
   `dose_forms`/`strengths`. Sin esa línea el CA sigue sin cumplirse.
7. **C-06 y C-21 son transversales** y no se cierran con lo recorrido: falta el barrido del
   proyecto entero. De C-21 ya están las dos mitades que se pueden mirar hoy — el perfil en `PASS`,
   la medicación `BLOCKED` por D-06 —, y de C-06 está el contraejemplo que la manda a `FAIL`.
8. **C-23 necesita una decisión que no es técnica**: o se acepta que la hoja de internación es una
   fecha hasta que el modelo crezca, o se prioriza el cambio de modelo de `matriz-internacion.md` §4.
