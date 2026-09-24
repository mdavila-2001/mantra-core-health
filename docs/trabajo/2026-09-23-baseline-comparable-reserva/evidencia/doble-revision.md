# Doble revisión adversarial de la evidencia visual — baseline comparable de Reserva

Segunda pasada, adversarial, sobre la **re-captura** del 2026-09-24, hecha por un agente **distinto
del que implementó y capturó** (`NO_SELF_APPROVAL`). Describe el set que se entrega hoy; la revisión
del set anterior queda sustituida por ésta. Postura: rechazar salvo que la captura se sostenga sola.

## Método

- Las 14 PNG abiertas como imagen, una por una. No alcanza con mirar tamaños de archivo.
- Ancho real leído de la cabecera IHDR de cada PNG.
- Diferencia por par con NumPy, umbral `|Δ| > 8` por canal, agrupada en bandas; en 1440 se separa el
  área de contenido (`x ≥ 240`, `y ≥ 56`) de la barra lateral y la cabecera.
- Contraste WCAG sobre el píxel más oscuro de cada glifo contra el fondo real (255,255,255 medido).
- `resumen.json` recalculado desde las 40 muestras crudas de `muestras/` y `muestras-sin-horarios/`.
- Cortes y conteo de merges verificados con `git` sobre `b7785e36..a43ad2b3`.
- Spec `playwright/baseline-comparable-reserva.spec.ts` leído entero de nuevo; `REPORTE.md` leído
  entero y contrastado contra el árbol entregado.

## Tabla por par

| Archivo | Ancho real | Qué se ve realmente | Nota |
|---|---|---|---|
| `01-directorio-1440.png` | 1440×900 ✓ | Portada del Directorio cargada: 30 especialidades, «791 profesionales en la red», sin un solo nombre propio en pantalla. **Área de contenido idéntica píxel a píxel entre cortes (0 px).** Toda la diferencia está en barra lateral y cabecera. | **APROBADA** |
| `02-resultados-1440.png` | 1440×900 ✓ | Listado filtrado: buscador con «Valeria Rojas Mendoza», «2 médicos», «Cardiología 1» y «Medicina Interna 1» — la misma persona sintética bajo sus dos especialidades («Clínica Los Olivos · Consultorio Rojas», «Matrícula verificada», «Telemedicina»). **Ningún médico del catálogo de aseguradoras, ni entero ni cortado por el borde.** Diferencia acotada a `y 703-870` y `y 888-899`: el botón «Revisar disponibilidad» y el reflujo que provoca. | **APROBADA** |
| `03-cupos-1440.png` | 1440×900 ✓ | «Sedes y horarios» con cupos a la vista: «Agenda de Valeria Rojas Mendoza» (8 cupos) y «Consultorio propio · Valeria Rojas Mendoza» (7) = 15, primer cupo «vie 25 · 08:30–09:00», semana 21–28 sept. El nombre aparece **dos veces dentro del propio bloque**. **Contenido idéntico píxel a píxel entre cortes (0 px).** | **APROBADA** |
| `04-directorio-390.png` | 390×844 ✓ | Portada en móvil, tarjetas cargadas, **idénticas bajo la cabecera** (la diferencia vive sólo en `y 11-75`). En `antes` la píldora «Datos de prueba» está encima de la cabecera y tapa entera la campana de notificaciones. | **ACEPTABLE CON RESERVAS** (H-5) |
| `05-resultados-390.png` | 390×844 ✓ | Listado filtrado en móvil: «2 médicos», sólo Valeria Rojas Mendoza. Diferencia esperada (botón + cabecera) limpia. Mismo pisado de cabecera en `antes`. | **ACEPTABLE CON RESERVAS** (H-5) |
| `06-cupos-390.png` | 390×844 ✓ | Los mismos 15 cupos en móvil, con el nombre dos veces en el bloque. **Diferencia acotada a la cabecera (`y 11-75`); el resto, idéntico píxel a píxel.** Mismo pisado en `antes`. | **ACEPTABLE CON RESERVAS** (H-5) |
| `07-sin-horarios-1440.png` | 1440×900 ✓ | Camino por defecto: ficha de un médico de la red (sin nombre en cuadro) y «Sedes y horarios» vacío, «Todavía no publicó horarios». Todo el encuadre es idéntico entre cortes **salvo las tres bandas del estado vacío**: en `despues` sigue a **66 % de opacidad y 2 px más abajo**. Subtítulo a **3,37:1**. | **RECHAZADA** (N-1) |

## Estado de los tres BLOQUEANTES de la primera pasada

### H-1 · médicos reales en las capturas — **CERRADO**

Verificado imagen por imagen, no por la aserción. En `02` y `05` la única persona en pantalla es
*Valeria Rojas Mendoza*, sintética, escrita a mano en `fixtures/personas.ts`; su consultorio
(«Clínica Los Olivos · Consultorio Rojas») también lo es. Revisé además los bordes: en `antes/02` la
segunda tarjeta asoma recortada bajo las píldoras de desarrollo y es **ella otra vez** («VR» +
«Valeria Rojas Mendoza»), no un tercero. `01` y `04` no muestran ningún nombre propio, sólo
contadores por especialidad. `03` y `06` son su agenda.

`07` sigue siendo la ficha de un médico real, pero **no queda nada identificatorio en el cuadro**:
ni nombre, ni dirección, ni clínica, ni número de matrícula. Lo visible es prosa genérica de estados
vacíos —«No hay actividad actual registrada», «No hay experiencia histórica registrada», «Todavía no
hay credenciales cargadas»— más «En la plataforma desde mayo 2025», que no identifica a nadie.
Aceptado.

### H-2 · capturas a medias de animación — **NO CERRADO** (ver N-1)

`animations: 'disabled'` cerró el problema en `03` y `06`, que ahora dan 0 px de diferencia de
contenido. **No lo cerró en `07`.**

### H-3 · el corte «después» no es el PR #583 — **CERRADO en el reporte**

No se re-capturó, y la decisión de declarar el SHA real está bien ejecutada. Revisé `REPORTE.md`
frase por frase buscando atribuciones a #583 y **no encontré ninguna**; al contrario, hay cuatro
lugares que la niegan explícitamente:

- la tabla de cortes nombra `a43ad2b3` como «la punta de `origin/mockup`» y no como el PR;
- «**El corte «después» no es el PR #583**» y «**nada de este reporte se adjudica a un PR en
  particular**»;
- la diferencia de barra lateral y cabecera se adjudica a los tres `ender/simulador-cabecera`
  (#584, #592, #598), que es exactamente lo que verifiqué por `git`;
- «La mejora no es del carril de Directorio» nombra la tabla de latencia determinista del simulador
  como candidata y dice que separarla pide un tercer corte que no se hizo. Eso es más riguroso de lo
  que pedí.
- D-2 va más lejos y **des**atribuye al PR #583 lo que el daily le adjudicaba («ya se cumplía en
  `b7785e36`»).

Queda una tensión menor (N-8) y dos números del reporte que no se sostienen (N-2, N-3).

## Hallazgos

### N-1 · BLOQUEANTE — `07` sigue fotografiado a mitad de la animación de entrada

`animations: 'disabled'` está en el `foto()` que usan las 14 capturas, pero **en `07` no produjo un
render asentado**. Medición sobre `despues/07-sin-horarios-1440.png`:

| | píxel más oscuro | contraste | desplazamiento |
|---|---|---|---|
| título `antes` | RGB(36,40,40) | 14,65:1 | 0 px |
| título `despues` | RGB(109,111,111) | **4,97:1** | **+2 px** |
| subtítulo `antes` | RGB(78,81,81) | 7,88:1 | 0 px |
| subtítulo `despues` | RGB(137,139,139) | **3,37:1** (bajo AA) | **+2 px** |
| icono `antes` | RGB(10,56,82) | 12,14:1 | 0 px |
| icono `despues` | RGB(91,122,139) | 4,49:1 | **+2 px** |

No es un cambio de color: el alfa implícito es **el mismo en los ocho canales medidos** sobre tres
colores distintos —0,664 · 0,667 · 0,667 · 0,663 · 0,663 · 0,667 · 0,665 · 0,667— lo que sólo puede
producir una opacidad uniforme.

Y hay una comprobación que lo cierra sin lugar a duda. `empty-state.css:153` define
`empty-state-entra` con `from { opacity: 0; transform: translateY(6px) }`: ambas propiedades corren
sobre el mismo progreso `p`, así que **desplazamiento = 6 × (1 − opacidad)**. Con α = 0,665 eso da
**2,01 px**, y lo medido son 2 px. La misma cuenta cuadra en las tres capturas que he visto falladas:
α 0,74 → 1,6 px (medido 2), α 0,40 → 3,6 px (medido 4), α 0,665 → 2,0 px (medido 2). Es el keyframe,
muestreado en vuelo.

Por qué escapó, no lo sé y no lo invento: el mecanismo exacto por el que la animación de `07`
sobrevive al flag no está verificado. Lo que sí está verificado es el resultado. La salida robusta no
es confiar en el flag sino **aseverar el estado asentado antes de disparar** —esperar
`Promise.all(el.getAnimations().map(a => a.finished))`, o comprobar que la opacidad calculada es 1—
que además dejaría una aserción dura donde hoy hay una suposición.

### N-2 · MAYOR — el reporte afirma dos veces algo que `07` desmiente

- Fila `H1.S2.M4` de **Completado**: «Catorce capturas comparables, 1440×900 y 390×844, sin médicos
  reales y **sin animaciones a medias**». La segunda mitad es falsa: `07` está a medias.
- Hallazgo `I-5`: «**Corregido** con `animations: 'disabled'` en las 14 capturas». El flag está en
  las 14; la corrección no llegó a la 14.ª.

La fila está declarada HECHO. Con `07` como está, no lo está.

### N-3 · MAYOR — `evidencia/pr-mergeable.txt` no existe

`REPORTE.md` lo enlaza **tres veces**, y dos de ellas son la columna «Comando de verificación» de
filas declaradas HECHO (`H3.S1.M2` PR hacia `mockup`, `H3.S1.M3` PR hacia `main`). El archivo no está
en la carpeta entregada:

```
FALTA evidencia/pr-mergeable.txt
OK    evidencia/resumen.json
OK    evidencia/doble-revision.md
```

Dos microtareas cuya única prueba es un archivo ausente. O se agrega, o esas dos filas no pueden
declararse HECHO.

### N-4 · MENOR — `resumen.json` y `REPORTE.md` no dicen lo mismo sobre los merges

`resumen.json`: «30 commits y **10 merges de PR**». `REPORTE.md`: «30 commits y **8 merges de PR**»,
con las 8 filas listadas. **El reporte tiene razón**: `git log --merges b7785e36..a43ad2b3` devuelve
10 merges, de los cuales **8** son `Merge pull request` y 2 son merges de integración
(`e65bc4f5`, `300045e3`). El número de mi revisión anterior era el impreciso; el que quedó mal es el
de `resumen.json`.

### N-5 · MENOR — el arreglo de H-6 es manual, y el instrumento sigue emitiendo lo que se quitó

`resumen.json` está **verificado contra las 40 muestras crudas**: las diez series coinciden una a una,
y mediana, mínimo, máximo, rango, solapamiento y «cuántas posteriores superan la mediana anterior»
(0 y 1) los recalculé y dan. H-6 está cerrado en el entregable.

Pero el spec **sigue escribiendo** `medicion.json` y `medicion-sin-horarios.json` en
`evidencia/<corte>/` (dos `writeFileSync` al final de cada test), y «Cómo reproducirlo» lo documenta:
«Cada corrida escribe `medicion.json` y `medicion-sin-horarios.json`». Hoy no están porque se
borraron a mano. Quien siga las instrucciones del reporte los vuelve a crear y reintroduce la corrida
suelta que H-6 mandó sacar. Que el instrumento escriba el agregado, o que el reporte diga que hay que
borrarlos.

### N-6 · MENOR — `animations: 'disabled'` puede tapar un estado de carga

Es lo contrario del riesgo que ya se cubrió, y conviene anotarlo porque toda la premisa del spec es
«no fotografiar una pantalla cargando». El flag **cancela** las animaciones infinitas: un spinner o un
esqueleto animado desaparece de la captura y la pantalla sale pareciendo cargada aunque no lo esté.
En estas 14 no tapó nada —el contenido está cargado y verificado por otras vías—, pero el flag no
sustituye a la espera por contenido real, y ahora la espera por contenido real es lo único que
protege de eso.

### N-7 · MENOR — `resumen.json` trunca en vez de redondear

`1163,5 → 1163`, `1131,7 → 1131`, `1431,5 → 1431`, `1452,8 → 1452`, `991,5 → 991`. Siempre hacia
abajo y en los dos cortes, así que no mueve el delta ni el sentido de la comparación. Cosmético.

### N-8 · MENOR — una frase en tensión con «nada se adjudica a un PR en particular»

El cierre de la sección de hallazgos dice: «El delta visual que **sí** corresponde al carril de
Directorio está en `02` y `05`: la acción «Revisar disponibilidad»…». Es la única atribución del
documento. Resulta que **se sostiene** —`4c9e419f`, dentro de #583, se titula literalmente «fix:
mostrar disponibilidad en tarjetas de directorio»—, pero el lector no tiene cómo saberlo: o se
escribe ese apoyo al lado, o la frase contradice la regla que el propio reporte se puso.

## Hallazgos anteriores: qué sobrevive en el set nuevo

| ID | Estado | Qué veo hoy |
|---|---|---|
| H-1 | **CERRADO** | Ver arriba. Ningún médico del catálogo en ninguna de las 14. |
| H-2 | **ABIERTO** en `07` | N-1. Cerrado en `03` y `06`. |
| H-3 | **CERRADO** | Declarado y sin atribuciones. Ver arriba. |
| H-4 | **CERRADO** | `03` y `06` llevan «Agenda de Valeria Rojas Mendoza» y «Consultorio propio · Valeria Rojas Mendoza» **dentro del bloque**, dos veces cada una. Sobre `07`: **la omisión me parece defendible**, y además está mejor sostenida de lo que el reporte dice — no hace falta creerle al encuadre, porque **todo el resto de la captura es idéntico píxel a píxel entre cortes**, y eso prueba por sí solo que las dos son la misma ficha en la misma posición. Conviene que el reporte lo diga, para que el lector no tenga que tomarlo por fe. |
| H-5 | **PERSISTE** | En `antes/04`, `antes/05` y `antes/06` la píldora «Datos de prueba» sigue encima de la cabecera, tapando entera la campana (el globo «4» asoma recortado) y media mitad del conmutador de tema. Es un defecto real del corte anterior, capturado con fidelidad y registrado como `P-2`. Por eso esos tres pares quedan con reservas y no aprobados. |
| H-6 | **CERRADO** | `resumen.json` recalculado y fiel a las 40 muestras. Ninguna corrida suelta como titular. Ver N-5 para el residuo. |
| H-7 | **PERSISTE, mutado** | Ahora conviven «2 médicos», «Cardiología 1» y, en la portada, «Cardiología · 50 médicos». Idéntico en los dos cortes, así que no rompe la comparación. Registrado como `P-3`. |
| H-8 | **PERSISTE** | «Mis puntos» sigue sólo en `antes`. El reporte lo da por intencional citando el daily (Ender H4.S2, `/my-account/loyalty` redirige); **no pude verificar ese daily desde acá**, así que lo dejo como explicación plausible no comprobada. |
| H-9 | **PERSISTE** | Las píldoras de desarrollo tapan «22 médicos» de Psicología Clínica en `01` y la segunda tarjeta en `02`. Idéntico en ambos cortes; ruido de captura, no hallazgo de producto. |

## Lo que pregunté a propósito y salió bien

- **¿El filtro por nombre invalida la comparación de tiempos?** No. El cronómetro (`inicio =
  performance.now()`) arranca **después** de teclear y de que el filtro se asiente, y la ventana
  medida son las cuatro activaciones hasta tener un cupo visible — idéntica en los dos cortes.
  Corroboración independiente: la mediana de `antes` del escenario A es **1691 ms**, y la de la ruta
  de Valeria en la entrega anterior, medida **sin filtro**, era **1733,5 ms**. Un 2,5 % de
  diferencia sobre el mismo commit: el filtro no movió la ventana medida. Sí conviene no mezclar
  estos números con los del camino por defecto, y el reporte no los mezcla.
- **Los anchos no mienten**: 1440×900 y 390×844 en las siete parejas, leídos del PNG.
- **Ninguna captura muestra esqueletos ni placeholders.** El único fallo es de animación, no de carga.
- **Tres pares con 0 px de diferencia de contenido** (`01`, `03`, y `06` fuera de la cabecera) y dos
  con la diferencia acotada exactamente al botón esperado (`02`, `05`). Es la mejor prueba posible de
  que el recorrido, el estado, el encuadre y los datos son los mismos.
- **Los invariantes cuadran con las imágenes**: conté 8 + 7 = 15 cupos y 2 sedes en `03` y en `06`, y
  el primer cupo dice «vie 25 · 08:30–09:00», igual que la tabla del reporte.
- Ninguna imagen contradice que el recorrido llegue donde dice llegar.

## Qué falta para poder entregar

1. Re-capturar `07` con el estado vacío asentado, y aseverarlo en vez de confiar en el flag (N-1).
2. Corregir `H1.S2.M4` e `I-5`, que hoy afirman lo contrario de lo que muestra `07` (N-2).
3. Agregar `evidencia/pr-mergeable.txt` o bajar de HECHO las dos filas que lo citan (N-3).
4. Alinear el conteo de merges de `resumen.json` con el del reporte: son **8** (N-4).

## Veredicto global

**La evidencia no se puede entregar como está:** seis de los siete pares se sostienen —dos bloqueantes
cerrados y `01`, `02`, `03` aprobados sin reservas— pero `07-sin-horarios-1440.png` sigue fotografiado
a mitad de la animación de entrada, con el subtítulo a 3,37:1, y el reporte declara HECHO que eso ya
no pasa.
