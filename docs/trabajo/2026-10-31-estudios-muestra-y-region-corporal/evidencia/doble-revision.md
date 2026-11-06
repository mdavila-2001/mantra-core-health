# Doble revisión de capturas — muestra y región corporal en la orden de estudios

- Fecha: 2026-11-06 · Capturas: `capturas/` (generadas por `playwright/estudios-muestra-y-region.spec.ts` con `E2E_CAPTURAS_DIR`) · Contra la **maqueta** (`yarn start:demo`), no contra la API real.
- **Independencia: NO.** Las dos pasadas las escribió quien implementó (el agente no dispone de un subagente `visual-reviewer`). Por `NO_SELF_APPROVAL` y regla 35.1.6 **ninguna nota pasa de `ACEPTABLE CON RESERVAS`** y la revisión independiente (`visual-reviewer`) queda **pendiente**: no se declara la entrega visual como aprobada.
- Viewports: 390 × 2000, 768 × 1500 y 1440 × 1300 (el alto alcanza para ver la sección entera dentro del modal); tema claro y oscuro; Chromium con SwiftShader (el 3D dibujó en todas: `data-status="ready"`).

## Primera pasada — verificación (una línea por captura)

| Captura | Qué se vio |
|---|---|
| `lab-1440-claro-vacio` | Laboratorio: «Muestra *» vacía, «Pedir estudio» gris, y el motivo dicho junto al campo («Elija la muestra para poder pedir el estudio»). |
| `lab-1440-claro-con-muestra` | Muestra elegida, botón habilitado. |
| `lab-1440-claro-historico` | Tras **recargar la página**: la fila «Glucosa en sangre · Laboratorio · Pendiente · **Muestra: Orina**». |
| `img-{390,768,1440}-{claro,oscuro}-vacio` | Imagen sin elegir: cuerpo 3D dibujado, «Ninguna parte marcada», región vacía, «Elija la región del estudio para poder pedirlo», botón gris. |
| `img-{390,768,1440}-{claro,oscuro}-elegido` | «fémur» elegido por lista: el hueso se resalta en verde, **«Región del estudio» propuesta «Fémur»** desde el cruce de la API, tipo de hueso visible (es del esqueleto), botón habilitado. |
| `img-1440-claro-completo` | Todo cargado: región Fémur, lado Izquierda (elegido a mano: un hueso par elegido por nombre no decide el lado), modalidad «Radiografía simple», tipo «Hueso largo». |

## Segunda pasada — adversarial (postura de quien tiene que rechazar)

Las diez preguntas de `critical-double-review` §3, contestadas sobre las capturas finales.

1. **¿Se ve lo que se pidió, o lo que quería ver?** El pedido dice «toca la parte»: en las capturas la parte se elige **por la lista** (fémur), nunca tocando el lienzo. El toque con puntero **no tiene captura ni prueba de navegador** (sólo la lógica pura, `body-site-picker.logic.spec.ts`). → hallazgo **MAYOR** (cobertura, no defecto visible).
2. **¿Qué falta en pantalla?** Estados de error visibles: no hay captura del 422 en su campo, ni del catálogo del cuerpo en error (`bsp-error`), ni del visor sin WebGL. Sólo unitarios. → **MAYOR** (peldaño visual).
3. **¿Algo desborda o se corta?** En 390 ya no (se corrigieron dos desbordes reales: la columna de la rejilla crecía por el lienzo y por el selector de la respuesta del formulario, ya existente). El botón «Pedir estudio» queda fijo al pie y tapa media fila de «Prioridad» al hacer scroll: es el comportamiento del bloque (pie fijo), no de lo nuevo. → **MENOR**.
4. **¿Jerarquía y alineación?** En 1440 la barra superior del selector mezcla un control segmentado a la izquierda y «Capas» con su leyenda sobre los checkboxes a la derecha; las líneas base no coinciden. → **MENOR**.
5. **¿Redundancia?** El elegido aparece dos veces: la fila «fémur · elegida» de la lista y, debajo, «fémur — Quitar». → **MENOR**.
6. **¿Texto que se rompe mal?** En 390 el cuadrito verde de la leyenda queda solo en una línea y su texto en la siguiente. → **MENOR**.
7. **¿Tema oscuro?** El resaltado verde, el borde del elegido (con texto «· elegida», no sólo color) y los campos conservan contraste legible; el botón habilitado es turquesa con texto oscuro. No se midió contraste con herramienta: **no cubierto**. → **MENOR** (sin evidencia numérica).
8. **¿La orden del paciente?** La línea «Región: …» de «Mis órdenes» **no tiene captura**: sólo prueba unitaria. → **MAYOR** (cobertura).
9. **¿El 3D es el único camino?** No: la lista con buscador elige lo mismo y se opera con teclado (probado en navegador: foco + Enter). Sin WebGL el visor avisa y la lista sigue sirviendo (unitario; no probado con WebGL apagado en navegador). → **MENOR**.
10. **¿Datos verdaderos?** Las regiones (156) y el cruce pieza → región son los de la API (`regiones-cuerpo-3d.json`), no escritos a mano; los tipos de hueso del doble son **sintéticos** (el real lo siembra el modelo). Lo cargado en pantalla no es un catálogo oficial de hueso: se dice en el reporte. → informativo.

## Nota por pantalla

| Pantalla | Nota | Hallazgos |
|---|---|---|
| Laboratorio · vacío / con muestra | ACEPTABLE CON RESERVAS | sin reservas visuales; falta captura de 422 (MAYOR, #2) |
| Laboratorio · histórico tras recargar | ACEPTABLE CON RESERVAS | la línea de muestra es de tamaño y peso de metadato (legible); OK |
| Imagen · 390 claro y oscuro | ACEPTABLE CON RESERVAS | #6 leyenda, #3 pie fijo, #5 redundancia |
| Imagen · 768 claro y oscuro | ACEPTABLE CON RESERVAS | #5 redundancia |
| Imagen · 1440 claro y oscuro | ACEPTABLE CON RESERVAS | #4 alineación de la barra, #5 |
| Orden del paciente («Mis órdenes») | **sin captura: no se declara** | #8 MAYOR |

Ninguna pantalla está `RECHAZADA`; **ninguna está `APROBADA`** (falta la revisión independiente y las capturas de error / paciente / toque del lienzo).
