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
> Consecuencia honesta: **el hecho central del veredicto de abajo («ninguna de las 24 está
> integrada») ya no es cierto para las correcciones que #557 y #559 puedan cubrir** —
> probablemente algunas de C-15…C-22 (receta, Justin) y C-08/C-10/C-24 (agenda/reportes, Pablo),
> a confirmar leyendo esos PRs, cosa que **no se hizo en esta sesión** por alcance: hoy se pidió
> «C-14/C-23 contra la API real y pruebas para la API», no un re-barrido de las 24.
> **El §0 y §2 de abajo quedan tal como se escribieron contra el corte original** — no se
> reescriben con una suposición de qué cubren #557/#559 sin leerlos. Queda para quien retome H6:
> los candidatos correctos a recorrer ahora son las correcciones de esos dos PRs, con la cuenta
> médica, siguiendo el guion de §1.

## 0. VEREDICTO GLOBAL — `NO ACEPTADO`

**El veredicto global es el más bajo de sus partes, y sus partes son casi todas `NOT_RUN`.**

| | |
|---|---|
| **Aceptadas con evidencia** | **2** de 24 — C-14 y C-23, y la segunda **parcialmente** |
| **Rechazadas** | 0 |
| **Sin ejercitar (`NOT_RUN`)** | **22** de 24 |
| **Rojos abiertos** | 0 ejercitados · el estado real de 22 es **desconocido**, que no es lo mismo que verde |

### El hecho que explica el dictamen entero

**Ninguna de las 24 correcciones está integrada en `mockup`.** No es una opinión: el último commit
del corte es de las **20:59 del 20/09**, y el pedido del doctor es de ese mismo día. Los cinco
lotes están trabajando **en paralelo, ahora**, cada uno en su rama.

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
| C-15 | Justin | `NOT_RUN` | No integrada |
| C-16 | Justin | `NOT_RUN` | No integrada |
| C-17 | Justin | `NOT_RUN` | No integrada |
| C-18 | Justin | `NOT_RUN` | Q-D4 dice que «parece ya cumplida» en el corte. **No se verificó**: hacerlo exige abrir la receta, y el lote de Justin la está tocando ahora — un veredicto sobre un archivo en vuelo no serviría. **Sigue siendo suyo verificarla y cerrarla `DESCARTADO` con captura**, nunca `HECHO` sin ejercitar |
| C-19 | Justin | `NOT_RUN` | No integrada |
| C-20 | Justin + Ender | `NOT_RUN` | No integrada. Cruza dos lotes, y el dato de posología es sintético declarado (Q-D6) |
| C-21 | Itzan + Justin + los cinco | `NOT_RUN` | Transversal, mismo caso que C-06 |
| C-22 | Justin | `NOT_RUN` | Mismo caso que C-18 |
| **C-23** | **Marcelo** | **`PASS` parcial** | **Ejercitada**, y su límite está declarado. Ver §4 |
| C-24 | Ender | `NOT_RUN` | No integrada |

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

**Un hallazgo más, de `shared/`, para Itzan** (no es defecto de las 24, y no se reportó como tal
porque no lo pidió nadie): `app-date-picker` trata **«campo cerrado al pasado» como «es una fecha
de nacimiento»** y abre el calendario en **enero de 2000**. Cualquier campo operativo que
legítimamente no pueda ser futuro —el inicio de una internación, por ejemplo— cae en esa rama y
abre a veintiséis años del día que se busca. Se descubrió poniéndole `maxDate` a la internación y
se resolvió **quitándoselo**; la heurística sigue ahí para el próximo que la pise.

---

## 6. Qué hace falta para que este dictamen valga algo

1. **Integrar los cinco lotes en `mockup`.** Hasta entonces no hay nada que aceptar.
2. **Recorrer las 22 `NOT_RUN`** con el guion de §1, por alguien que no las escribió.
3. **C-18 y C-22 las cierra Justin**, ejercitándolas: si ya estaban, `DESCARTADO` **con captura**,
   nunca `HECHO` sin ejercitar (Q-D4).
4. **C-06 y C-21 son transversales** y no se dictaminan por lote: exigen un barrido del proyecto
   entero después de que los cinco apliquen el patrón.
5. **C-23 necesita una decisión que no es técnica**: o se acepta que la hoja de internación es una
   fecha hasta que el modelo crezca, o se prioriza el cambio de modelo de `matriz-internacion.md` §4.
