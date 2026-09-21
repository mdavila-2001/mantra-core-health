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
> reales. C-08 y C-10 de Pablo (agenda/tabla de horarios) **no** están en #559 —ese PR trae
> reporte del dashboard y fixes de contrato, no la agenda— así que siguen `NOT_RUN`.

## 0. VEREDICTO GLOBAL — `NO ACEPTADO`

**El veredicto global es el más bajo de sus partes.** Ya no son «casi todas `NOT_RUN`» — con
#557 y #559 integrados y recorridos, la mayoría de lo alcanzable dio `PASS` — pero sigue habiendo
un `BLOCKED` real (D-06) y 14 de 24 sin ejercitar porque los otros tres lotes no están.

| | |
|---|---|
| **Aceptadas con evidencia** | **8** de 24 — C-14, C-15, C-16, C-17, C-18, C-19, C-24 en `PASS`; C-23 en `PASS` parcial |
| **Rechazadas** | 0 |
| **Bloqueadas (`BLOCKED`)** | **2** — C-20 y C-22, por D-06 (ver §5) |
| **Sin ejercitar (`NOT_RUN`)** | **14** de 24 — C-01…C-13 y C-21 (transversal), sin lote integrado |
| **Rojos abiertos** | 0 de los ejercitados dio `FAIL`; el estado de las 14 `NOT_RUN` sigue **desconocido** |

### El hecho que explica el dictamen entero

**14 de las 24 correcciones no están integradas en `mockup` todavía.** El corte original (20:59
del 20/09) no tenía ninguna; después llegaron #557 (Justin), #558 (yo) y #559 (Ender/Pablo), que
cubren C-14, C-15…C-20, C-22…C-24 — **10** correcciones. Las otras 14 —Itzan (C-01, C-02, C-05,
C-06, C-09), Pablo (C-04, C-07, C-08, C-10, C-11), la mitad de Pablo en C-12/C-13, y C-21 completo
(transversal, necesita el patrón de Itzan aplicado en los cinco)— siguen sin rama fusionada.

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
| C-01 | Itzan | `NOT_RUN` | No integrada en el corte. Rama de Itzan empujada 01:54, **sin fusionar** |
| C-02 | Itzan | `NOT_RUN` | Ídem |
| C-03 | Ender | `NOT_RUN` | No integrada. Sin rama en el remoto |
| C-04 | Pablo | `NOT_RUN` | No integrada. Sin rama en el remoto |
| C-05 | Itzan | `NOT_RUN` | No integrada |
| C-06 | Itzan + los cinco | `NOT_RUN` | Transversal: no se puede dictaminar hasta que esté el patrón de Itzan **y** su aplicación en los cinco lotes |
| C-07 | Pablo | `NOT_RUN` | No integrada |
| C-08 | Pablo | `NOT_RUN` | No integrada |
| C-09 | Itzan | `NOT_RUN` | No integrada |
| C-10 | Pablo | `NOT_RUN` | No integrada |
| C-11 | Pablo | `NOT_RUN` | No integrada |
| C-12 | Pablo + Ender | `NOT_RUN` | No integrada. Cruza dos lotes |
| C-13 | Pablo + Ender | `NOT_RUN` | No integrada. Cruza dos lotes |
| **C-14** | **Marcelo** | **`PASS`** | **Ejercitada en navegador y contra la API real** (Neon), ver §3 |
| C-15 | Justin | `PASS` | #557 integrado. Recorrida: sin botón de descargar en la pantalla de escritura. `dictamen-h6-recorrido.spec.ts` |
| C-16 | Justin | `PASS` | #557 integrado. Recorrida: sin barra de demostración al registrar |
| C-17 | Justin | `PASS` | #557 integrado. Recorrida: sin «favoritos» ofrecidos |
| C-18 | Justin | `PASS` | #557 integrado. Recorrida: «¿De qué consulta es la receta?» ofrece diagnóstico **y** «Otro motivo — escribirlo», que abre el campo de texto libre |
| C-19 | Justin | `PASS` | #557 integrado. Recorrida: la dosis acepta texto libre («500 mg»); «Unidad» no existe en el formulario |
| C-20 | Justin + Ender | `BLOCKED` | #557+#559 integrados, pero **D-06** (nuevo, ver §5) rompe el buscador de medicamentos: cae al catálogo de reserva `VS_RECORD_STATUS`, así que no se puede elegir NINGÚN medicamento real para ver si la frecuencia se completa sola. Aparte, por lectura de código: `onMedicamentoElegido()` nunca consume `default_frequency` — aunque D-06 se arreglara, el CA seguiría sin cumplirse |
| C-21 | Itzan + Justin + los cinco | `NOT_RUN` | Transversal, mismo caso que C-06: sólo se recorrió la parte de medicación (ver «C-21 parcial» abajo), que quedó `BLOCKED`. El barrido completo sigue esperando el patrón de Itzan en los cinco lotes |
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

## 5. Rojos, y su clasificación

**No hay rojos ejercitados de las 24**, porque no hubo qué ejercitar. Sí hay hallazgos —de esquema
y de contrato, destapados al cerrar C-14/C-23 contra la API real (sesión 2)— en
[`defectos-reportados.md`](./defectos-reportados.md):

| ID | Clase | Dueño | Estado |
|---|---|---|---|
| ~~D-01~~ | — | — | **RETIRADO.** Lo reporté mal: clasifiqué desde un `grep` vacío sin reproducir, y el navegador lo desmintió. Queda escrito con su error de método en vez de borrarse |
| D-02 | `PRODUCT_BUG` | Dueño del modelo | Abierto. Toda internación se guarda con `type_concept_id = NULL` porque no existe catálogo de tipo de episodio. **Confirmado contra la API real** |
| D-03 | `PRODUCT_BUG` | Dueño del modelo/infra | Abierto. `POST /clinical/encounters/:id/close` da `500` en esta base de Neon: falta la columna `content_hash` que la entidad ORM declara. Ningún encuentro se puede cerrar hoy |
| D-04 | Hallazgo, sin veredicto | Dueño de la API | `POST /clinical/care-episodes` no lleva `ClinicalRecordAccessGuard`: un médico sin relación con el paciente pudo internarlo. Reproducido, no corregido |
| D-05 | Hallazgo, sin veredicto | Dueño de la API | `startAt` futuro en `care-episodes` se acepta sin rechazo server-side |
| D-06 | `PRODUCT_BUG` (maqueta) | Ender — `core/mock/handlers/misc.handlers.ts` | Abierto. El buscador de «Medicamento» del bloque de medicación cae al catálogo de reserva `VS_RECORD_STATUS` (Activo/Inactivo) porque la tabla `ENUMS` no tiene patrón para `medication_requests.medication_concept_id`. **Reproducido con captura y sin adivinar** (mismo mecanismo del D-01 retirado, pero real esta vez): buscar cualquier medicamento no devuelve nada; buscar «Activo» sí. Bloquea C-20 y C-22 completos y la mitad de C-21 |

**Un hallazgo más, de `shared/`, para Itzan** (no es defecto de las 24, y no se reportó como tal
porque no lo pidió nadie): `app-date-picker` trata **«campo cerrado al pasado» como «es una fecha
de nacimiento»** y abre el calendario en **enero de 2000**. Cualquier campo operativo que
legítimamente no pueda ser futuro —el inicio de una internación, por ejemplo— cae en esa rama y
abre a veintiséis años del día que se busca. Se descubrió poniéndole `maxDate` a la internación y
se resolvió **quitándoselo**; la heurística sigue ahí para el próximo que la pise.

---

## 6. Qué hace falta para que este dictamen valga algo

1. **Integrar los tres lotes que faltan** (Itzan, Pablo, y la mitad de Pablo+Ender en C-12/C-13)
   **en `mockup`.** Hasta entonces las 14 `NOT_RUN` siguen sin nada que aceptar.
2. **Recorrer esas 14** con el guion de §1, por alguien que no las escribió, apenas se integren.
3. **D-06 lo cierra Ender** (`misc.handlers.ts`, es suyo): una línea en la tabla `ENUMS` con el
   patrón `/medication_requests\.medication_concept_id/` → `VS_MEDICAMENTO` (o el nombre que use
   el fixture real de medicamentos). Sin eso, C-20/C-22/C-21(parcial) siguen `BLOCKED` aunque el
   resto de #557 ya esté integrado.
4. **C-20 tiene una segunda causa, de Justin**: aunque D-06 se arregle, `onMedicamentoElegido()`
   (`medication-block.ts`) no lee `default_frequency` de la ficha del concepto — sólo
   `dose_forms`/`strengths`. Sin esa línea el CA sigue sin cumplirse.
5. **C-06 y C-21 son transversales** y no se dictaminan por lote: exigen un barrido del proyecto
   entero después de que los cinco apliquen el patrón. La mitad de C-21 (medicación) ya se recorrió
   y quedó `BLOCKED` por D-06, no por el patrón de Itzan.
6. **C-23 necesita una decisión que no es técnica**: o se acepta que la hoja de internación es una
   fecha hasta que el modelo crezca, o se prioriza el cambio de modelo de `matriz-internacion.md` §4.
