# H6 — veredicto por cada `iconOnly` (D-05, ADR-0012)

- Fecha: 2026-09-23 · Rama: `itzan/perfil-d05-iconos` (sale de `itzan/perfil-medico-configurar-tu-perfil`, PR #606)
- Medición: `git grep -c iconOnly -- <archivo>.html`. Da las mismas cifras que el encargo: 8 · 7 · 7 · 4 · 3 · 1 · 1 = **31** en los archivos de este tramo. Las otras 6 son de la rama núcleo.
- Las líneas son las de **antes** del cambio.
- **Criterio (ADR-0012 §3):** un botón queda sólo con ícono si su significado es universal en su contexto (cerrar un diálogo, quitar un elemento, pasar de página) **y** cumple las dos condiciones: `aria-label` y **globo visible** (`appTooltip`). La excepción se justifica en una línea junto al botón. Si no, lleva ícono y texto (§1).
- **Q-19 (doctor):** «No se convierten a ciegas: cada uno se re-audita contra el ADR». El paginador de listas deja de ser excepción. Eso nombra a `molecules/pagination`, que es de Pablo; no nombra la navegación de un formulario por páginas (ver Q-I11 en `PLAN.md`).

## Veredictos

| # | Archivo:línea | Botón | Veredicto | Motivo |
|---|---|---|---|---|
| 1 | `register-patient.html:67` | `[iconOnlyNav]="true"`: flechas «Atrás» y «Siguiente» del alta | **Excepción** | Pasar de página en un formulario paginado. `paginated-form` les pone `aria-label` y `appTooltip`. La última página nunca es ícono: ahí dice «Crear cuenta» |
| 2 | `register-patient.html:175` | Quitar el nombre N | **Excepción** | Quitar un elemento de una lista. El `aria-label` y el globo dicen cuál se quita |
| 3 | `register-patient.html:335` | Quitar la ubicación de tu domicilio (mapa abierto, sin punto) | **Texto** (24/09; era excepción): cruz + «Cerrar el mapa» y nombre «Cerrar el mapa de tu domicilio», porque sin punto el botón sólo cierra el mapa | Mismo caso que las filas 27-29: el alta del paciente tiene su propia copia del mapa. Pasa a ícono + «Quitar la ubicación», con el `aria-label` completo. Lo marcó la segunda pasada de capturas, repetida (H6-02) |
| 4 | `register-patient.html:379` | Quitar la ubicación de tu domicilio (punto confirmado) | **Texto** (24/09; era excepción) | idem |
| 5 | `register-patient.html:426` | Quitar la ubicación de tu domicilio (tercer estado del bloque) | **Texto** (24/09; era excepción) | idem |
| 6 | `register-patient.html:611` | Quitar la ubicación de tu lugar de trabajo (mapa abierto, sin punto) | **Texto** (24/09; era excepción): cruz + «Cerrar el mapa», nombre «Cerrar el mapa de tu lugar de trabajo» | idem |
| 7 | `register-patient.html:651` | idem, punto confirmado | **Texto** (24/09; era excepción) | idem |
| 8 | `register-patient.html:696` | idem, tercer estado | **Texto** (24/09; era excepción) | idem |
| 9–14 | `paginated-form.html:250, 263, 264, 265, 266, 270` | «Atrás» en modo ícono (comentario + 5 enlaces del mismo botón) | **Excepción** | Pasar de página. Sólo con `iconOnlyNav`, **apagado por defecto** (`paginated-form.ts:255`). Ya lleva `aria-label` + `appTooltip`. Sin cambio de comportamiento |
| 15 | `paginated-form.html:288` | «Siguiente» en modo ícono | **Excepción** | idem. Nunca en la última página (`nextAsIcon`, `paginated-form.ts:348`) |
| 16 | `date-picker.html:93` | Cerrar el calendario | **Texto** | «Cerrar un diálogo» sería excepción, pero el calendario es un `<dialog>` modal (`showModal`, `date-picker.ts:521`) y el globo se cuelga del `<body>` (`tooltip.ts:131`). Queda debajo de la capa superior del modal, así que no se puede cumplir «globo visible». Pasa a ícono + «Cerrar» |
| 17 | `date-picker.html:105` | Año anterior | **Texto** | Mismo motivo que la 16. Ícono + «Año»; el `aria-label` «Año anterior» se conserva y contiene el texto visible |
| 18 | `date-picker.html:111` | Mes anterior | **Texto** | idem: ícono + «Mes» |
| 19 | `date-picker.html:120` | 30 años anteriores | **Texto** | idem: ícono + «30 años» |
| 20 | `date-picker.html:149` | Mes siguiente | **Texto** | idem: «Mes» + ícono |
| 21 | `date-picker.html:154` | Año siguiente | **Texto** | idem: «Año» + ícono |
| 22 | `date-picker.html:164` | 30 años siguientes | **Texto** | idem: «30 años» + ícono |
| 23–26 | `back-link.html:7, 8, 9, 14` | «Volver» en modo ícono | **Excepción** | Navegar hacia atrás. Sólo con `iconOnly`, **apagado por defecto** (`back-link.ts:90`). Ya lleva `aria-label` + `appTooltip` con el `label`. Lo encienden la cabecera y la agenda, que no son de este tramo. Sin cambio de comportamiento |
| 27 | `ubicacion-picker.html:40` | Quitar la ubicación (mapa abierto, sin punto) | **Texto** (24/09; era excepción): cruz + «Cerrar el mapa», porque sin punto el botón sólo cierra el mapa | No hay lista de la que quitar, y el aro con un menos queda junto al «−» del zoom del plano (`organisms/map/map.css:164`): se lee como «alejar». Pasa a ícono + «Quitar la ubicación», que es el comienzo del `aria-label` completo (`etiquetaQuitar()`). Lo marcó la segunda pasada de capturas (H6-02) |
| 28 | `ubicacion-picker.html:83` | idem, punto confirmado | **Texto** (24/09; era excepción) | idem |
| 29 | `ubicacion-picker.html:124` | idem, tercer estado | **Texto** (24/09; era excepción) | idem |
| 30 | `patient-profile-edit.html:86` | Quitar el nombre N | **Excepción** | Quitar un elemento de una lista |
| 31 | `my-profile.html:111` | Editar (lápiz) | **Texto** | El lápiz es el ejemplo del ADR de ícono ambiguo: puede ser editar, firmar o anotar (ADR-0012, Contexto). Pasa a ícono + «Editar». El pedido del 09/09 era el lápiz; D-05 (22/09) le suma el nombre |

**Total:** 14 excepciones (2 + 7 + 4 + 1) y 17 a texto (7 + 3 + 6 + 1). Hasta el 24/09 eran 23 y 8: los nueve botones que quitan la ubicación de un mapa (tres en el mapa compartido, seis en la copia del alta del paciente) pasaron a texto. En las excepciones el cambio es sólo la línea de justificación en el código; el DOM no cambia, porque Angular no emite comentarios de plantilla.

## De la rama núcleo (los veredicta esa sesión)

| Archivo | Cantidad |
|---|---|
| `register-practitioner.html` | 3 (una es `[iconOnlyNav]="true"`, que sigue el veredicto de la fila 1) |
| `practitioner-profile-edit.html` | 2 |
| `practitioner-profile-view.html` | 1 (el lápiz «Editar» de la ficha del médico: mismo caso que la fila 31) |

## Hallazgos que no son de este tramo

- **`atoms/tooltip/tooltip.ts:131`:** el globo se cuelga del `<body>`. Dentro de un `<dialog>` abierto con `showModal()` queda debajo de la capa superior, así que ningún botón de sólo ícono dentro de un modal nativo puede cumplir la condición «globo visible» del ADR-0012 §3. Afecta a cualquier excepción dentro de `molecules/dialog`, `content-dialog` o el calendario. Es para quien lleve el átomo. **Confirmado en el navegador el 23/09:** un elemento colgado del `<body>` con `z-index: 2147483647` sobre el panel del calendario queda debajo (`elementFromPoint` devuelve el calendario); comprobación del guion `playwright/d05-iconos.mjs`, `evidencia/h6/pasada-despues.txt`.
- **`playwright/mi-perfil-paciente.mjs:93-94`** (guion de Pablo, 09/09): afirma que «Editar» es un lápiz sin texto. Con la fila 31 esas dos comprobaciones quedan viejas; no se tocan desde acá.
- **`register-laboratory.html:67` y `register-imaging-center.html:68`** también encienden `[iconOnlyNav]="true"`. No están en los 37 del encargo. Les toca el mismo veredicto que a la fila 1 (pasar de página: excepción, Q-I11), pero no tienen la línea de justificación. Su botonera no cambió con este tramo (comparada en el navegador).
- **«Mi perfil» desborda 1 px a lo ancho en 375**, antes y después de D-05 (medido en las dos pasadas: `desborde-mi-perfil-antes.json`). Lo que se pasa es `div.app-header__derecha` del encabezado (el avatar termina en 376 px), no la tarjeta. Es del encabezado.
