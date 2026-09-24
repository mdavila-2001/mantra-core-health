# Revisión adversarial de la evidencia visual — baseline comparable de Reserva

Tercera pasada, adversarial, sobre la re-captura del 2026-09-24, hecha por un agente **distinto del
que implementó y capturó** (`NO_SELF_APPROVAL`). Describe el set que se entrega hoy; las revisiones
de los dos sets anteriores quedan sustituidas por ésta. Postura: rechazar salvo que la captura se
sostenga sola.

## Método

- Las 14 PNG abiertas como imagen, una por una. No alcanza con mirar tamaños de archivo.
- Ancho real leído de la cabecera IHDR de cada PNG; sha256 de los 14 archivos registrado.
- Diferencia por par con NumPy, umbral `|Δ| > 8` por canal, agrupada en bandas; en 1440 se separa el
  área de contenido (`x ≥ 240`, `y ≥ 56`) de la barra lateral y la cabecera.
- Contraste WCAG sobre el píxel más oscuro de cada glifo contra el fondo real.
- **Coherencia interna**: dentro de cada corte se comparó la barra lateral y la cabecera de las tres
  capturas de 1440 entre sí, y la cabecera de las tres de 390 entre sí, para detectar deriva
  introducida por la regeneración.
- `resumen.json` recalculado desde las 40 muestras crudas, incluidos mediana, media, rango,
  solapamiento y el conteo de muestras posteriores por encima de la mediana anterior.
- Spec leído entero de nuevo (`foto()`, `asentado()`); `REPORTE.md` leído entero y contrastado frase
  por frase contra la evidencia publicada; `.gitignore` verificado con `git check-ignore`.

## Tabla por par

| Archivo | Ancho real | Qué se ve realmente | Nota |
|---|---|---|---|
| `01-directorio-1440.png` | 1440×900 ✓ | Portada del Directorio cargada: 30 especialidades, «791 profesionales en la red», ningún nombre propio en pantalla. **Contenido idéntico píxel a píxel entre cortes (0 px).** | **APROBADA** |
| `02-resultados-1440.png` | 1440×900 ✓ | Listado filtrado: «Valeria Rojas Mendoza» en el buscador, «2 médicos», «Cardiología 1» y «Medicina Interna 1» — la misma persona sintética bajo sus dos especialidades. **Ningún médico del catálogo de aseguradoras, ni entero ni cortado por el borde.** Diferencia acotada a `y 703-870` y `y 888-899`: el botón «Revisar disponibilidad» y su reflujo. | **APROBADA** |
| `03-cupos-1440.png` | 1440×900 ✓ | «Sedes y horarios» con cupos: «Agenda de Valeria Rojas Mendoza» (8) y «Consultorio propio · Valeria Rojas Mendoza» (7) = 15, primer cupo «vie 25 · 08:30–09:00». Nombre **dos veces dentro del bloque**. **Contenido idéntico píxel a píxel (0 px).** | **APROBADA** |
| `04-directorio-390.png` | 390×844 ✓ | Portada en móvil, tarjetas cargadas, **idénticas bajo la cabecera** (diferencia sólo en `y 11-75`). En `antes` la píldora «Datos de prueba» tapa entera la campana de notificaciones. | **ACEPTABLE CON RESERVAS** (H-5) |
| `05-resultados-390.png` | 390×844 ✓ | Listado filtrado en móvil: «2 médicos», sólo Valeria Rojas Mendoza. Diferencia esperada (botón + cabecera) limpia. Mismo pisado en `antes`. | **ACEPTABLE CON RESERVAS** (H-5) |
| `06-cupos-390.png` | 390×844 ✓ | Los mismos 15 cupos en móvil, nombre dos veces. **Diferencia acotada a la cabecera; el resto idéntico píxel a píxel.** Mismo pisado en `antes`. | **ACEPTABLE CON RESERVAS** (H-5) |
| `07-sin-horarios-1440.png` | 1440×900 ✓ | Camino por defecto: «Todavía no publicó horarios», sin nada identificatorio en cuadro. **Contenido idéntico píxel a píxel entre cortes (0 px).** Estado vacío **asentado en los dos cortes**: tinta idéntica y misma posición. | **APROBADA** |

## `07`: el bloqueante de la pasada anterior, cerrado

Medido igual que la vez pasada, en los dos cortes:

| | `antes` | `despues` |
|---|---|---|
| título, píxel más oscuro | RGB(36,40,40) — **14,65:1** | RGB(36,40,40) — **14,65:1** |
| subtítulo | RGB(78,81,81) — **7,88:1** | RGB(78,81,81) — **7,88:1** |
| icono | RGB(10,56,82) — **12,14:1** | RGB(10,56,82) — **12,14:1** |
| filas con tinta del título | 704–723 | 704–723 |
| diferencia de contenido entre cortes | — | **0 px** |

Opacidad 1 y desplazamiento 0 en los dos: los valores de `antes` eran ya los asentados en la pasada
anterior, y ahora `despues` los reproduce exactamente. El subtítulo pasó de **3,37:1** a **7,88:1**.
La identidad `desplazamiento = 6 × (1 − opacidad)` que delataba el keyframe en vuelo ya no tiene nada
que delatar. **N-1 cerrado**, verificado por medición y a ojo.

## La regeneración no introdujo nada

Las 14 se re-generaron, así que la barrí entera:

- **Los siete anchos** siguen coincidiendo con el sufijo del nombre.
- **Coherencia interna perfecta**: dentro de cada corte, la barra lateral y la cabecera de `01`, `03`
  y `07` son **byte a byte iguales** (diferencia máxima 0 en los dos cortes), y la cabecera móvil de
  `04`, `05` y `06` también (máxima 0 en `despues`, **1** en `antes` — un escalón de antialias,
  invisible y muy por debajo del umbral). Si la regeneración hubiera movido algo, ahí se vería.
- **Las bandas de diferencia son exactamente las mismas** que en la pasada anterior, con los mismos
  conteos de píxeles: `02` 111 450 + 813 px en las dos bandas del botón, `04`/`06` 5 356/5 357 + 719
  px de cabecera, `05` los mismos más 38 956 px del botón. Nada nuevo apareció.
- **Tres pares con 0 px de diferencia de contenido** (`01`, `03`, `07`) y dos con la diferencia
  acotada al botón esperado (`02`, `05`); `04` y `06`, sólo cabecera.
- Conté a mano los cupos en `03` y `06`: 8 + 7 = **15** en 2 sedes, primer cupo
  «vie 25 · 08:30–09:00». Cuadra con la tabla de invariantes.
- Ninguna captura muestra esqueletos, placeholders ni opacidades a medias.

## Las mediciones nuevas: recalculadas desde las 40 muestras crudas

`resumen.json` es **fiel a las muestras** y ahora redondea correctamente (N-7 cerrado). Todo lo
comprobé de cero:

| Escenario · corte | series crudas = resumen | mediana | media | mín/máx | rango |
|---|---|---|---|---|---|
| A · antes | ✓ | 1427,5 → **1428** | 1428 | 1285/1566 | 281 |
| A · después | ✓ | 1107,5 → **1108** | 1150,7 → 1151 | 914/1448 | 534 |
| B · antes | ✓ | 1459,5 → **1460** | 1454,4 → 1454 | 1300/1673 | 373 |
| B · después | ✓ | 892 | 937 | 803/1133 | 330 |

Y las comparaciones: A −320 ms / −22,4 %, rangos **se solapan**, **1** muestra posterior sobre la
mediana anterior (1448 > 1428). B −568 ms (redondeo de 567,5) / −38,9 %, rangos **no se solapan**
(máx. posterior 1133 < mín. anterior 1300), **0** muestras por encima. Los cuatro valores publicados
coinciden con los que calculé.

**Ninguna frase de la sección «La medición» afirma más de lo que aguantan estos números.** Al
contrario: el reporte llama a A «el escenario más débil de los dos», dice que ahí sólo se afirma la
separación de medianas, y en «Cómo hay que leer estos números» nombra la tabla de latencia
determinista del simulador como causa candidata y se niega a adjudicar la mejora sin un tercer corte.
Eso es más conservador de lo que los datos obligan.

## Hallazgos

### R-1 · MAYOR — `evidencia/pr-mergeable.txt` sigue sin existir

Ya avisaste que se crea al abrir los PRs; lo marco igual porque hoy el árbol no lo tiene y
`REPORTE.md` lo enlaza **tres veces**, dos de ellas como la columna «Comando de verificación» de
filas declaradas HECHO (`H3.S1.M2` PR hacia `mockup`, `H3.S1.M3` PR hacia `main`). Mientras falte,
el **«AVANCE: 11 / 12 microtareas HECHO»** de la cabecera está sobredeclarado: son 9 con prueba en el
árbol y 2 con prueba pendiente.

### R-2 · MAYOR — `D-1` quedó con las medianas del set anterior

Dice: «con este instrumento el mismo recorrido da **1163 ms** de mediana en el corte actual y
**1691** en el anterior». Ésas son las cifras de la tanda anterior de muestras. Las que publica hoy
`resumen.json`, y que verifiqué, son **1108** y **1428**. Es un número del reporte que contradice al
`resumen.json` del mismo reporte — justo el tipo de discrepancia que este trabajo existe para no
tener.

### R-3 · MENOR — «Cinco defectos» encabeza una tabla de seis

La sección «Del instrumento que se heredó» sigue diciendo «Cinco defectos, todos encontrados
auditándolo antes de creerle, todos corregidos en el spec», y debajo hay **seis** filas, `I-1` a
`I-6`. `I-6` se agregó al partir `I-5`; el conteo no acompañó.

### R-4 · MENOR — «las dos pasadas de revisión de capturas»

La viñeta del peldaño de evidencia sigue diciendo dos. Con ésta van **tres**, y la tercera es la que
verifica que el bloqueante de la segunda quedó cerrado — que es la que le da valor a la cadena.

### R-5 · MENOR — el flag que sigue puesto contradice el comentario que lo explica

El comentario de `foto()` dice, sobre excluir las animaciones infinitas: «si hay una corriendo, lo
correcto es que la captura la muestre, no que la congele fingiendo que la pantalla ya cargó». El
razonamiento es el correcto y responde a lo que planteé. Pero la línea siguiente sigue siendo
`page.screenshot({ ..., animations: 'disabled' })`, y **ese flag cancela las infinitas**: un spinner o
un esqueleto latiendo no saldría en la captura igual. O el flag se quita ahora que la espera explícita
lo reemplaza, o el comentario deja de prometer lo que el flag impide. Sin efecto en estas 14 —no hay
nada cargando— pero es una promesa escrita que el código no cumple.

### R-6 · MENOR — «los cinco últimos son la prueba de que la fixture es equivalente»

De las seis filas de invariantes, «Peticiones de negocio observables: 0 / 0» no prueba nada sobre la
fixture: cero peticiones en los dos cortes es compatible con datos distintos. La prueba de
equivalencia son las **cuatro** filas de datos (sedes, cupos, etiqueta del primer cupo, mensaje del
camino por defecto), y son suficientes. Decir cinco incluye una que no aporta.

### O-1 · observación, no hallazgo — el `05` varió 1–3 bytes entre corridas

`05` cambió de tamaño en los dos cortes entre la tanda anterior y ésta (52318↔52319, 54533↔54536),
mientras el resto mantuvo su tamaño exacto. Lo perseguí: **no es un cursor de texto parpadeando** —el
campo de búsqueda tiene el foco, pero no hay ninguna barra de tinta después de «Mendoza», y la caja
del buscador es **0 px distinta entre cortes**. Encaja con el escalón de antialias de diferencia
máxima 1 que medí en la cabecera móvil de `antes`: ruido de compresión por debajo del umbral, no un
estado distinto. Lo dejo anotado sin severidad.

### O-2 · observación — la aserción dura cubre un solo punto

`asentado()` se invoca únicamente sobre el estado vacío de `07`. Es donde estuvo el defecto, y el
cinturón general es la espera de `foto()` a todas las animaciones finitas de la página, que sí cubre
las 14. Me parece bien dimensionado; lo digo para que sea una decisión y no un olvido: si mañana
aparece una entrada con `fade` en las tarjetas de resultado, la que la atrapa es `foto()`, no una
aserción. Nota secundaria: si un `finished` no resolviera, la prueba agota su tiempo en vez de
publicar un PNG malo — falla en la dirección segura.

## Hallazgos anteriores: estado en este set

| ID | Estado | Verificación |
|---|---|---|
| H-1 médicos reales | **CERRADO** | Las 14 revisadas a ojo, bordes incluidos. Sólo Valeria en `02`/`05`; `01`/`04` sin nombres; `07` sin nada identificatorio. |
| H-2 animación a medias | **CERRADO** | `07` con 0 px de diferencia y tinta asentada en los dos cortes. |
| H-3 SHA y atribución | **CERRADO** | «30 commits, 8 merges de pull request (más 2 de integración, `e65bc4f5` y `300045e3`)» coincide exactamente con `git`. |
| H-4 de quién es la ficha | **CERRADO** | `03`/`06` llevan el nombre dos veces en el bloque. En `07` la omisión es deliberada y el reporte ya apoya la comparabilidad en la identidad píxel a píxel, no en el encuadre. |
| H-5 píldora sobre la cabecera | **PERSISTE** | En `antes/04`, `05` y `06`. Defecto real del corte anterior, capturado con fidelidad y registrado como `P-2`. Por eso esos tres pares van con reservas. |
| H-6 corrida suelta como titular | **CERRADO** | `resumen.json` recalculado y fiel; medianas, rangos y solapamiento publicados. |
| H-7 cifras del listado | **PERSISTE** | «2 médicos» / «Cardiología 1» / portada «Cardiología · 50 médicos». Idéntico en ambos cortes. `P-3`. |
| H-8 «Mis puntos» | **CERRADO como duda** | El reporte cita ahora el daily con sección y texto (§4-bis, Ender H4.S2, `fueraDelMenuPara: [ANY_ROLE]`). **No puedo verificar ese daily desde este repositorio**; con la cita al lado, deja de ser una pérdida sin explicar. |
| H-9 píldoras tapando texto | **PERSISTE** | Ruido de captura, idéntico en ambos cortes. |
| N-1 `07` en vuelo | **CERRADO** | Ver arriba. La salida es la propuesta: esperar las animaciones finitas y **aseverar** el estado asentado. |
| N-2 frases falsificadas por `07` | **CERRADO** | `H1.S2.M4` dice ahora «con el estado asentado **aseverado**, no confiado a un flag»; `I-5` se partió e `I-6` declara con mis números que el flag no alcanzó y que el mecanismo no se verificó. Las dos frases casan con lo que medí. |
| N-3 `pr-mergeable.txt` | **ABIERTO** | R-1. |
| N-4 conteo de merges | **CERRADO** | Reporte y `resumen.json` dicen ahora lo mismo, y es lo correcto. |
| N-5 corrida suelta reintroducida | **CERRADO** | `evidencia/.gitignore` verificado con `git check-ignore`: ignora `antes/medicion.json` y `despues/medicion-sin-horarios.json`, y `git ls-files` confirma que ninguna está versionada. «Cómo reproducirlo» lo explica. |
| N-6 el flag tapa un estado de carga | **CERRADO en el razonamiento** | El spec excluye las infinitas a propósito y explica por qué, que es exactamente la respuesta correcta. Queda el residuo R-5: el flag sigue puesto y las cancela igual. |
| N-7 truncar en vez de redondear | **CERRADO** | Recalculado: los ocho agregados redondean bien. |
| N-8 atribución sin apoyo | **CERRADO** | La única atribución del documento lleva ahora su apoyo: `4c9e419f`, dentro de #583, se titula «fix: mostrar disponibilidad en tarjetas de directorio». Verificado. |

## Qué falta para firmar

1. `pr-mergeable.txt`, o bajar de HECHO las dos filas que lo citan y ajustar el «11 / 12» (R-1).
2. Actualizar las dos medianas de `D-1`: **1108** y **1428**, no 1163 y 1691 (R-2).
3. «Cinco defectos» → seis (R-3) y «dos pasadas» → tres (R-4).
4. Decidir sobre `animations: 'disabled'`: quitarlo o dejar de prometer lo contrario (R-5); y
   «los cinco últimos» → los cuatro de datos (R-6).

Ninguno de los cuatro toca una captura: las 14 se sostienen como están.

## Veredicto global

**Las capturas se pueden entregar**: ninguna pantalla queda RECHAZADA, el bloqueante de `07` está
cerrado y verificado, y las mediciones publicadas coinciden con las 40 muestras crudas — pero
`REPORTE.md` todavía arrastra dos cifras del set anterior en `D-1` y dos filas declaradas HECHO cuyo
archivo de prueba no está en el árbol.
