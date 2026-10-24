# Doble revisión de capturas — C-01 (MD-06 / PA-04)

Capturas: `capturas/` (38) · API real (`127.0.0.1:3005`) · datos sintéticos de
`scripts/e2e-sembrar-api-real.mjs --etiqueta pablo` (comprobante: imagen sintética legible,
rotulada «sin validez») · tomadas por `playwright/capturas-c01-comprobantes.spec.ts` (1 passed)
con movimiento reducido y espera a diálogo opaco.

**CA literal.** El médico ve en la consulta los comprobantes del paciente (miniatura, monto,
método, fecha), los acepta o los rechaza con motivo; ve la tabla de pagos por sesión con
paciente, monto, seguro, estado y comprobante.

La mutación real (aceptar → recargar → pagado; cerrar sin pago → aviso) está demostrada aparte
por `playwright/c01-aceptar-comprobante.spec.ts` (2 passed, API real, sin mocks).

## Ronda 1

Primera pasada (implementador): se corrigieron montos partidos en 390 y la miniatura «Sin
imagen» (el médico no podía leer el archivo del paciente → `GET /billing/payment-proofs/:id/file`
autorizado por contexto).

Segunda pasada (agente `visual-reviewer`, independiente): **5 de 6 pantallas RECHAZADAS**.
Hallazgos y qué se hizo:

| # | Hallazgo (sev.) | Respuesta |
|---|---|---|
| 1 | Diálogo capturado a mitad de animación en 390 oscuro (BLOQUEANTE) | Capturas con `reducedMotion: 'reduce'` y espera a `opacity: 1` del diálogo por nombre. Re-capturado. |
| 2 | Sin evidencia de rechazar con motivo ni de aceptar (MAYOR) | Capturas `caja-pagos-rechazar-con-motivo-*` y `caja-pagos-aceptar-*`, más la prueba E2E de mutación real. |
| 3 | Seguro y comprobante no demostrados en 768/390 (MAYOR) | Capturas `pagos-por-sesion-detalle-{768,390}-*` con la fila desplegada. |
| 4 | Nombre en tres renglones en 390 (MAYOR) | `display:block; text-wrap: balance`. Sigue en tres renglones: la columna admite ~8 caracteres y la «B» es el sufijo sintético. Se rebaja a MENOR. |
| 5 | Fecha ISO partida en la tabla de cobros (MAYOR) | Es `patient-charges`, componente previo que este trabajo no toca (`git diff` vacío). Fuera de alcance, anotado. |
| 6 | Error sin ID de petición (S9) (MAYOR) | La caja ahora dice qué pasó, muestra el ID de petición y reintentar; `offline` aparte. Spec nuevo. Captura `estado-error-interceptado-*` de la tabla. |
| 7 | Pestaña en dos renglones en 390 (MENOR) | `app-tabs` compartido; anotado. |
| 8 | ▼ desalineado (MENOR) | `app-data-table` compartido; anotado. |
| 9 | Hora sola en otro renglón (MENOR) | `white-space: nowrap` en la fecha de subida. |
| 10 | Dos formatos de fecha (MENOR) | El ISO es de `patient-charges` (previo). Anotado. |
| 11 | Misma marca de tiempo en todas las filas (MENOR) | Artefacto del sembrado: el check-in fija la hora. Anotado. |
| 12 | Sin lightbox (MENOR) | Implementado: la miniatura abre la captura en grande (`caja-pagos-ampliado-*`). |

## Ronda 2 — primera pasada (implementador)

| Captura | Observación |
|---|---|
| pagos-por-sesion-1440-* | Seis columnas, estado con texto, montos en una línea. |
| pagos-por-sesion(-detalle)-{768,390}-* | Tres columnas + detalle con fecha, seguro y comprobante. Nombre en 3 renglones en 390 (MENOR, ver #4). |
| caja-pagos-* | Miniatura legible, rechazado con motivo, pendiente con acciones; 390 sin transparencia. |
| caja-pagos-ampliado-* | La captura en grande, legible, en ambos temas. |
| caja-pagos-rechazar-con-motivo-* / aceptar-* | Diálogos con motivo (contador 44/500) y con el monto a confirmar. |
| estado-vacio / estado-error-interceptado-* | Vacío orienta; error con mensaje, código de soporte, copiar y reintentar. Red interceptada: evidencia de UI, no de integración. |

## Ronda 2 — segunda pasada (revisor independiente)

(sección siguiente)

### Segunda pasada — revisor independiente (ronda 2) · resumen

Rechazó Pagos por sesión 390, Caja 390, Diálogos y Estados. Causas: la espera miraba el
`<dialog>` y la animación corre en `.panel-muelle`; `reducedMotion` estaba mal declarado
(ignorado); el tema se cambiaba con la página pintada; faltaba la E2E del rechazo; nombre en
tres renglones; faltaban el error de la caja y los estados en 768/390.

## Ronda 3 — correcciones

| Hallazgo ronda 2 | Corrección |
|---|---|
| Diálogos a medio aparecer (BLOQUEANTE) | `contextOptions.reducedMotion` (antes ignorado) + espera a que terminen todas las animaciones finitas del documento (`getAnimations()`), panel incluido. |
| Vacío capturado a mitad del cambio de tema (BLOQUEANTE) | El tema se fija en `localStorage` ANTES de navegar; ya no se cambia con la página pintada. |
| Sin E2E del rechazo (MAYOR) | `c01-aceptar-comprobante.spec.ts` ahora: rechazar con motivo → POST con `{reason}` → 200 → recargar → «Rechazado» + motivo guardado. 3 passed contra la API real. |
| Nombre en tres renglones (MAYOR) | La etiqueta de estado pasa a «Pendiente» (columna «Estado» de una tabla de pagos); el nombre queda en dos renglones. |
| Transparencia en 390 oscuro (MAYOR) | Misma causa que el primero; re-capturado. |
| Error de la caja sin captura (MENOR) | `caja-pagos-estado-error-interceptado-*` en 3 anchos × 2 temas. |
| Estados sólo en 1440 (MENOR) | Vacío y error en 3 anchos × 2 temas. |
| Botones pegados en el error, detalle sin alinear, fecha ISO | Componentes compartidos / previos (`view-state-host`, `data-table`, `patient-charges`): anotados, fuera de alcance. |

## Ronda 3 — primera pasada (implementador)

52 capturas. Diálogos opacos en los tres anchos (atrás se ve el diálogo «Pagos» atenuado por su
fondo, que es el apilado esperado). Vacío claro enteramente claro. Nombres en dos renglones en
390. Error de la caja con qué pasó, ID de petición y reintentar.

### Segunda pasada — revisor independiente (ronda 3) · resumen
Siete pantallas ACEPTABLE CON RESERVAS; Estados RECHAZADA por el error de la caja en un solo
renglón (ID pegado al botón, sin ranura `alert-actions`). Menores: «Consulta · Pendiente»
ambiguo, «Todavía» repetido en el vacío, mensaje crudo del mapeador compartido, contraste del
diálogo de confirmar en oscuro.

Corrección: mensaje e ID en `<p>`, ID en `<code>`, «Reintentar» en `alert-actions`;
«Consulta … · Cobro: Pendiente»; vacío sin repetir. Re-capturado (52).

### Segunda pasada — revisor independiente (ronda 4) · veredicto final

| Pantalla | Nota |
|---|---|
| Pagos por sesión · 1440 / 768 / 390 | ACEPTABLE CON RESERVAS |
| Caja · 1440 / 768 / 390 | ACEPTABLE CON RESERVAS |
| Diálogos (ampliado / rechazar / aceptar) | ACEPTABLE CON RESERVAS |
| Estados (vacío / error) | ACEPTABLE CON RESERVAS |

Sin regresiones ni hallazgos nuevos. Ninguna llega a APROBADA por los MENOR abiertos, todos de
componentes compartidos o previos (fuera del alcance de C-01, anotados para su dueño):
- `patient-charges`: fecha ISO partida («2026-10-/23») y «Sin pago» vs «Pendiente».
- `errorToViewState`: el error de la tabla muestra el `message` crudo del backend (regla 95.2.3).
- `app-tabs`: «Pagos por sesión» en dos renglones a 390.
- `app-data-table`: ▼ desalineado y detalle sin columna común.
- `view-state-host`: «Copiar código» y «Reintentar» pegados.
- Diálogo de confirmación con la misma superficie que el de atrás en oscuro.
- Datos del sembrado: misma hora en todas las filas (el check-in fija la hora).

---

# H3 · C-10 / MD-01 — línea de comprobación del CI (2026-10-24)

Capturas: [`capturas-h3/`](./capturas-h3/) — 36 = 6 estados × 3 anchos (1440 · 768 · 390) × 2 temas.
Generadas por `playwright/capturas-c10-ci-unico.spec.ts` contra la API real (4201 → 3005).
`*-interceptado-*` = red interceptada a propósito: evidencia de UI, no de integración.

## Primera pasada (quien implementó)

| Estado | Lo que se ve | Veredicto |
|---|---|---|
| falta-departamento | Línea neutra «Elija el departamento de emisión…» bajo el par número/departamento, en los 6 cortes | OK |
| disponible | «Documento disponible.» con icono de check, tono éxito; claro y oscuro legibles | OK |
| ya-registrado | Borde rojo del campo + mensaje del campo («Ya hay un médico registrado…») + línea «Este documento ya está registrado…». Primera toma en 390 salía desplazada (el campo fuera de cuadro): se corrigió encuadrando el título y se re-capturó | OK tras re-captura |
| sin-respuesta (503 interceptado) | Línea neutra con icono de reintento; el campo no se pone en rojo | OK |
| sin-catálogo (500 interceptado) | El aviso de antes («No pudimos traer el catálogo de departamentos. Reintentar») ahora desde el componente compartido; el departamento ocupa la fila entera, como antes | OK |
| paciente-disponible | El CI del médico, con La Paz, sale «Documento disponible.» en el alta de paciente | OK |

Dudas que dejo para la segunda pasada: (1) en «ya registrado» hay dos textos rojos que dicen casi lo mismo; (2) la línea de estado usa la tipografía de ayuda (caption): ¿alcanza el contraste del tono éxito en oscuro?

### Segunda pasada — revisor independiente (ronda 1) · FAIL, 65/100

- MAYOR-1 «ya registrado» duplicado (dos rojos, dos iconos, dos redacciones; doble anuncio al lector). → la línea de estado queda vacía en `tomado`; lo dice el campo.
- MAYOR-2 el mensaje de error del campo daba ~2,9:1 en oscuro (`form-field.css` con `--c-error-500` fijo). → `--text-danger` (con variante de tema) en el mensaje y el asterisco. Microtarea nueva H3.S2.M7. `check-contrast` sigue en 0.
- MAYOR-3 faltaba evidencia de «comprobando», de paciente «ya registrado» y del foco de teclado en «Reintentar». → agregadas.
- MENOR atendidos: icono `pin` en «falta departamento», `history` en «sin respuesta» (no promete acción), logo recortado en 768 (encuadre).
- MENOR que quedan registrados, fuera del alcance: hueco de la región vacía en la grilla del motor; aviso «sin catálogo» gris con «Reintentar» ghost (estilo previo); columna vacía en «sin catálogo» (§6, previo); «ocupaciones caído» con el marcado viejo.

### Primera pasada (ronda 2, re-capturas: 54 = 9 estados × 3 anchos × 2 temas)

| Estado | Lo que se ve | Veredicto |
|---|---|---|
| ya-registrado (médico y paciente) | Un solo mensaje, el del campo, con el borde; en oscuro, rojo claro legible | OK |
| comprobando (interceptado: respuesta real demorada) | «Comprobando el documento…» con reloj, sin rojo | OK |
| sin-catálogo + foco en «Reintentar» | Anillo de foco visible en 390/768/1440. Nota: al tabular desde la cédula vacía, la cédula queda tocada y muestra su error de obligatorio (comportamiento real del motor) | OK |
| resto | como en la ronda 1, con los iconos corregidos | OK |

### Segunda pasada — ronda 2 · sin BLOQUEANTE ni MAYOR en C-10 (82/100)

Notas: falta-departamento, comprobando, disponible, paciente-disponible y sin-respuesta APROBADAS; ya-registrado (médico y paciente), sin-catálogo y foco en «Reintentar» ACEPTABLE CON RESERVAS. Ninguna RECHAZADA.
MAYOR propio de H3.S2.M7 (no de las pantallas): `form-field` es una primitiva compartida y faltaba evidencia de regresión.

### H3.S2.M7 · regresión de `form-field` (antes / después)

[`capturas-h3-form-field/antes`](./capturas-h3-form-field/antes/) y [`despues`](./capturas-h3-form-field/despues/): ingreso, recuperar contraseña y alta de organización, con sus errores a la vista, 1440 y 390, claro y oscuro (`playwright/capturas-h3-form-field-regresion.spec.ts`, simulador).
Diferencia por píxel: confinada a los mensajes de error y los asteriscos (1 000–2 600 px por captura, ninguna fuera de esas zonas).

Primera pasada (quien implementó): en claro el texto pasa de #B5533C a #6F382C, más oscuro y con más contraste. En oscuro pasa de #B5533C (≈2,9:1, no llega a AA) a #DFB4AA (≈7,7:1). Se lee menos «rojo», pero es `--st-error-fg` del tema oscuro, y el error lo siguen marcando el ícono y el borde. El asterisco cambia igual. Los bordes de error no se tocaron: siguen en `--c-error-500` en todos los controles, con 2,99:1 en oscuro, que ya era así. Queda registrado como deuda para el dueño del sistema de diseño, porque unificarlos toca diez controles compartidos.

### Segunda pasada — ronda 3 (H3.S2.M7) · ACEPTABLE CON RESERVAS

Sin regresión de maquetación en los 12 pares. Mensaje en oscuro de ≈3,0:1 a ≈7,9:1, en claro de 4,9:1 a 9,2:1. El tono oscuro se sigue leyendo como error, con matiz rojizo, ícono y borde.
Deuda registrada (dueño: sistema de diseño): (1) borde y texto de error en dos tonos; los bordes siguen en `--c-error-500` en ~10 controles (input, select, textarea, checkbox, radio, date-picker, tree-select, grid-group, department-map, progress), con destino `--st-error-bd` o `--text-danger`; (2) en claro el error se ve marrón oscuro; (3) en oscuro el asterisco se ve casi blanco. Higiene: en `antes/alta-organizacion-1440-light.png` el logo no terminó de cargar (182 px de la diferencia).

## Notas finales H3

| Pantalla | Nota |
|---|---|
| falta-departamento · comprobando · disponible · paciente-disponible · sin-respuesta | APROBADA |
| ya-registrado (médico y paciente) · sin-catálogo · foco en «Reintentar» | ACEPTABLE CON RESERVAS |
| `form-field` en formularios ajenos (H3.S2.M7) | ACEPTABLE CON RESERVAS |

Ninguna RECHAZADA.
