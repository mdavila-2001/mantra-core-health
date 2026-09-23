# Doble revisión ultra crítica — capturas del carril

11 capturas reales (Playwright, servidor `ng serve` real, sin mocks de UI) + 1 re-captura tras un
hallazgo de la pasada 2. Ninguna captura de tablet: no se recorrió ese viewport esta noche (declarado
en «No cubierto»).

## Tabla de capturas

| # | Archivo | Viewport | Tema | Estado / pantalla |
|---|---|---|---|---|
| 1 | `antes/capturas/directorio-paciente-desktop.png` | 1440 | claro | Directorio, antes de N-01 |
| 2 | `antes/capturas/romel-rivero-sin-agenda-desktop.png` | 1440 | claro | Ficha de registrado, antes de R-03 |
| 3 | `antes/capturas/romel-rivero-sin-agenda-mobile.png` | 375 | claro | Ficha de registrado, antes de R-03 |
| 4 | `h3/capturas/romel-rivero-con-agenda-desktop.png` | 1440 | oscuro | Ficha de registrado, después de R-03 |
| 5 | `h4/capturas/medica-dashboard-desktop-claro.png` | 1440 | claro | Panel médica, después de N-01 |
| 6 | `h4/capturas/medica-dashboard-desktop-oscuro.png` | 1440 | oscuro | Panel médica, después de N-01, tema |
| 7 | `h4/capturas/paciente-dashboard-mobile.png` | 375 | oscuro | Panel paciente, ANTES del arreglo del cartel |
| 8 | `h4/capturas/paciente-dashboard-mobile-arreglado.png` | 375 | oscuro | Panel paciente, 1er arreglo (defecto encontrado) |
| 9 | `h4/capturas/paciente-dashboard-mobile-arreglado-v2.png` | 375 | oscuro | Panel paciente, **re-captura tras la corrección** |
| 10 | `h3/capturas/escenario-a-03-paciente-confirmada.png` | 1440 | oscuro | Mis citas (paciente), reserva con la médica |
| 11 | `h3/capturas/escenario-a-04-medica-ve-la-cita.png` | 1440 | claro | Consultas (médica), ve la reserva del paciente |
| 12 | `h3/capturas/escenario-b-03-paciente-confirmada.png` | 1440 | oscuro | Mis citas (paciente), reserva con un registrado |

## Pasada 1 — verificación

1. `directorio-paciente-desktop.png` — OK. Sidebar con «Tutoriales» y «Chats» como renglones: es
   exactamente el estado «antes» que la captura tiene que mostrar.
2. `romel-rivero-sin-agenda-desktop.png` — OK. «Todavía no publicó horarios», el kill-test de R-03
   antes del arreglo.
3. `romel-rivero-sin-agenda-mobile.png` — OK. Mismo estado, 375 px.
4. `romel-rivero-con-agenda-desktop.png` — OK. Cupos reales (mié/jue/vie, 14:00–18:00) reemplazan el
   vacío.
5. `medica-dashboard-desktop-claro.png` — OK. Cabecera con campana, selector, tema, Tutoriales, Chats,
   Ajustes, cuenta — los seis, y ninguno en el menú lateral.
6. `medica-dashboard-desktop-oscuro.png` — OK. Mismo layout en oscuro, tooltip «Tema» visible.
7. `paciente-dashboard-mobile.png` — OK **para lo que prueba**: es el «antes» del arreglo del cartel,
   así que el icono de Tutoriales tapado es lo que tiene que mostrar.
8. `paciente-dashboard-mobile-arreglado.png` — OK en el objetivo original (los 6 íconos de la cabecera
   visibles, sin superposición entre ellos y el cartel). **Pasa a defecto en la pasada 2** (ver abajo).
9. `paciente-dashboard-mobile-arreglado-v2.png` — pendiente de la re-captura tras el rebuild (ver
   sección de re-captura).
10. `escenario-a-03-paciente-confirmada.png` — OK. La cita con Valeria Rojas Mendoza aparece «Pedido»,
    con el motivo sintético.
11. `escenario-a-04-medica-ve-la-cita.png` — OK. La médica ve a «Ana Lucía Pérez Quiroga» en su agenda
    del jueves 24, mismo motivo.
12. `escenario-b-03-paciente-confirmada.png` — OK. La cita con Romel Rivero Saavedra aparece «Pedido»,
    junto a la de la médica.

## Pasada 2 — adversarial

Postura: soy quien recibe este trabajo y mi tarea es encontrarle la falla, no confirmar que está bien.

### Capturas 1–4, 10–12 (directorio, fichas, «mis citas» — sin cambios de cabecera)

| # | Pregunta | Respuesta |
|---|---|---|
| 1 | Qué se ve mal primero | Nada estructural. En #1 y #2 hay un artefacto de transición del menú lateral (franja semitransparente sobre el sidebar) — es el estado intermedio de la animación de «Recoger el menú», no algo que mi cambio haya tocado ni que la captura necesitara evitar |
| 2 | Texto cortado/solapado | No |
| 3 | ¿Terminado o prototipo? | Terminado — coincide con el resto del producto |
| 4 | Coherente con pantallas vecinas | Sí |
| 5 | Tema oscuro pierde contraste | #4, #10, #12 en oscuro: sin problemas, chips y texto legibles |
| 6 | Estado vacío/error orienta | #2/#3 (vacío de agenda) orienta con texto y acción; no aplica a las demás |
| 7 | Jerarquía a la acción principal | Sí — en #10-12 el estado «Pedido» y «Cancelar» son lo primero que se lee de cada fila |
| 8 | Dato inventado/real/sensible | Todos los nombres son de los fixtures sintéticos declarados (`personas.ts`, `registered-people.ts`); los motivos de consulta que yo mismo escribí (#10, #12) dicen explícitamente «dato sintético». Sin PHI real |
| 9 | Muestra lo que pide el requisito | Sí — R-03 (cupos reales) y los dos escenarios completos (reserva visible de los dos lados) |
| 10 | Por qué la rechazaría | No la rechazo. Sin hallazgos |

**Nota: APROBADA** (capturas 1, 2, 3, 4, 10, 11, 12).

### Capturas 5–6 (cabecera de la médica, escritorio, claro/oscuro)

| # | Pregunta | Respuesta |
|---|---|---|
| 1 | Qué se ve mal primero | Nada — los 6 íconos están alineados, con espaciado uniforme |
| 2 | Texto cortado/solapado | No |
| 3 | ¿Terminado o prototipo? | Terminado |
| 4 | Coherente con vecinos | Sí — mismo tratamiento visual que «Ajustes», que ya existía |
| 5 | Contraste en oscuro | #6: el tooltip «Tema» tiene fondo oscuro con texto claro, legible; los íconos mantienen contraste |
| 6 | Estados vacío/error | No aplica (panel con datos) |
| 7 | Jerarquía | La campana con «8» es lo más llamativo, correcto — es la única con info nueva |
| 8 | Dato sensible | Nombres de pacientes de los fixtures sintéticos («María López Collado», etc.), sin PHI real |
| 9 | Cumple el requisito | Sí — N-01 e implícitamente D-05 (globo en el tema) |
| 10 | Por qué la rechazaría | No la rechazo |

**Nota: APROBADA** (capturas 5, 6).

### Captura 7 (mobile, ANTES del arreglo del cartel — documenta el defecto a propósito)

No se califica con nota de aprobación: es evidencia de un estado roto, capturada a propósito para
documentar el hallazgo. Confirmo que el defecto que muestra es real (el ícono de Tutoriales
desaparece detrás del cartel) y no un artefacto de la captura — corroborado con
`getBoundingClientRect()` en `evidencia/h4/overlap-mock-banner-375px.md`.

### Captura 8 — `paciente-dashboard-mobile-arreglado.png` (1.ª corrección)

| # | Pregunta | Respuesta |
|---|---|---|
| 1 | Qué se ve mal primero | El cartel «Datos de prueba» tapa la mitad de «Hola, Ana Lucía Pérez Quiroga» — el título de la pantalla queda parcialmente ilegible |
| 2 | Texto cortado/solapado | **Sí** — «Hola,» queda debajo del cartel naranja, ilegible |
| 3 | ¿Terminado o prototipo? | Se ve como un ajuste a medio hacer: resolví la superposición con los íconos de la cabecera y creé una nueva, distinta, con el título de la página |
| 4 | Coherente con vecinos | No es coherente: ninguna otra pantalla del producto tiene un elemento flotante tapando su título |
| 9 | Cumple el requisito | Cumple el requisito **explícito** de H4.S1.M5 (que los íconos de la cabecera no se tapen), pero introduce un problema nuevo que nadie pidió pasar por alto |
| 10 | Por qué la rechazaría | Por esto exactamente — un título parcialmente tapado es lo primero que se nota, y es innecesario: hay espacio libre a la derecha de esa misma franja |

**Hallazgo:** `MAYOR` — el título de la pantalla queda parcialmente cubierto por el cartel de modo
demostración. No es `BLOQUEANTE` porque no oculta información funcional ni rompe la interacción (nada
deja de poder tocarse, el cartel es descartable y no afecta ningún flujo del carril), pero sí es un
defecto visible a simple vista que corresponde corregir dentro de esta misma microtarea, no dejarlo
pasar.

**Corrección:** `mock-banner.ts` — el cartel plegado en angosto pasa de `inset-inline-start: 8px`
(ocupa desde el borde izquierdo, debajo de los títulos que arrancan ahí) a `inset-inline-end: 8px`
(esquina superior derecha, bajo la cabecera): ninguna pantalla recorrida esta noche tiene texto de
título en esa franja. El panel *abierto* (con el texto largo y la lista de cuentas) sigue ocupando el
ancho completo, sin cambios.

**Nota de la captura 8: `RECHAZADA`** (hallazgo `MAYOR` sin corregir en esta imagen — la corrección
vive en la re-captura, #9).

### Captura 9 — `paciente-dashboard-mobile-arreglado-v2.png` (re-captura)

Corrección aplicada: `mock-banner.ts`, el cartel plegado pasa de `inset-inline-start: 8px` a
`inset-inline-end: 8px` (esquina superior derecha en vez de izquierda). Medido con
`getBoundingClientRect()`:

- `h1` («Hola, Ana Lucía Pérez Quiroga»): `{ x: 12, y: 72, w: 336, h: 72 }` (dos líneas)
- Cartel: `{ x: 237.9, y: 64, w: 114, h: 29 }`

| # | Pregunta | Respuesta |
|---|---|---|
| 1 | Qué se ve mal primero | El borde izquierdo del cartel todavía toca el final de la primera línea del título («…Pérez») en unos pocos píxeles — mucho menos que antes (que tapaba «Hola,» entero) |
| 2 | Texto cortado/solapado | Parcial: un par de caracteres del final de la primera línea (`…Pérez`), no la palabra completa ni la segunda línea («Quiroga») |
| 3 | ¿Terminado o prototipo? | El resto de la pantalla se ve terminado; este resto de superposición es un detalle fino |
| 9 | Cumple el requisito | Sí — el requisito de H4.S1.M5 (íconos de cabecera sin taparse) se cumple sin excepción |
| 10 | Por qué la rechazaría | No la rechazaría: a diferencia de la v1, acá lo que se pierde son un par de píxeles de una letra a mitad de una oración decorativa (el saludo), no una palabra ni contenido accionable. Perseguir el pixel exacto exige o acortar el saludo (fuera de mi alcance, es contenido de otra pantalla) o angostar aún más el cartel del modo demo (reduce su legibilidad como herramienta de desarrollo) |

**Hallazgo:** `MENOR` — un par de píxeles de superposición entre el cartel de modo demostración y el
final de la primera línea del saludo, en el viewport más angosto soportado (375 px). Se registra y no
se corrige más: es contenido decorativo (un saludo, no una acción ni un dato funcional), el cartel es
propio del entorno de desarrollo (no existe en producción) y las dos alternativas de corrección
adicional (acortar el saludo o angostar el cartel) salen del alcance de este carril o degradan la
herramienta de depuración para los otros cuatro.

**Nota de la captura 9 (re-captura): `ACEPTABLE CON RESERVAS`** — el `MENOR` queda registrado, sin
`BLOQUEANTE` ni `MAYOR` abiertos.

## Nota final por pantalla

| Pantalla | Capturas | Nota |
|---|---|---|
| Directorio y fichas (antes/después R-03) | 1, 2, 3, 4 | `APROBADA` |
| Cabecera de la médica (N-01, D-05) | 5, 6 | `APROBADA` |
| Cabecera del paciente en 375 px + cartel de modo demo | 7 (antes, documenta el hallazgo a propósito), 8 (`RECHAZADA`, corregida), 9 (re-captura) | **`ACEPTABLE CON RESERVAS`** (el `MENOR` de la captura 9, declarado) |
| Escenarios de reserva completos (A y B) | 10, 11, 12 | `APROBADA` |

## No cubierto

- Viewport tablet (768–1024 px aprox.) no se capturó en ninguna pantalla esta noche.
- No se recapturó el tema **claro** del panel del paciente en 375 px (todas las capturas de mobile de
  esta sesión quedaron en oscuro, porque el tema es una preferencia que persiste entre sesiones y no se
  alternó para esa pantalla puntual).
- La ficha del registrado (capturas 2–4) no se repitió en 375 px después del arreglo de R-03 (sólo
  antes, captura 3); la de «después» sólo se tomó en escritorio (captura 4).
