# Doble revisión de las capturas — carril 16, P0 (frontend)

Capturas en `docs/progress/evidence/lane-16/P0/`: 26 PNG, generadas por
`playwright/carril-16-cobro-con-seguro.spec.ts` (25 pruebas en verde, `--workers=1`).
Cada captura se abrió como imagen en la pasada 1. La pasada 2 se hizo después, con la postura de
rechazar la entrega.

## Tabla de capturas

| Pantalla | 375 px claro/oscuro | 768 px claro/oscuro | 1280 px claro/oscuro |
|---|---|---|---|
| Médica · reparto del cobro (`cotizacion-medico-cifras`) | sí / sí | sí / sí | sí / sí |
| Médica · botón de envío habilitado (`cotizacion-medico-envio`) | sí / sí | sí / sí | sí / sí |
| Médica · modal de objeción (`objecion-modal`, solo 1280) | — | — | sí / sí |
| Paciente · desglose (`desglose-paciente`) | sí / sí | sí / sí | sí / sí |
| Paciente · objeción presentada (`objecion-paciente`) | sí / sí | sí / sí | sí / sí |

## Pasada 1 — verificación contra el criterio

- `cotizacion-medico-cifras-*` (6): OK. Las cuatro cifras aparecen con su moneda. Con 90 % sobre
  500,00 Bs y copago 0,00 se leen 50,00 Bs para el paciente y 450,00 Bs para la aseguradora.
- `cotizacion-medico-envio-*` (6): OK. El botón está habilitado (aprobación previa dada).
- `objecion-modal-1280-*` (2): OK. Título, texto, tres motivos, botón deshabilitado sin motivo.
- `desglose-paciente-*` (6): OK. Cobertura 50 %, copago 20,00 Bs, paciente 66,88 Bs, aseguradora
  46,89 Bs sobre 113,77 Bs. Coincide con la regla de redondeo a favor del paciente.
- `objecion-paciente-*` (6): OK. Sello «Objeción presentada» y texto sobre la pausa del cobro.

## Pasada 2 — adversarial

| # | Hallazgo | Severidad | Respuesta |
|---|---|---|---|
| 1 | La leyenda de prueba con el uuid de la aprobación de la maqueta aparecía en la sección de cobro. | MAYOR | Corregido: se retiró la leyenda del componente. Las capturas se regeneraron. |
| 2 | Primera captura de la médica en 375 px: la sección se veía cortada y con la página de fondo encima. | MAYOR | Causa: la captura del elemento completo incluye la parte fuera del diálogo. Corregido: se captura el bloque recortado al diálogo, en dos momentos (reparto y botón). Re-capturado y revisado de nuevo. |
| 3 | Las capturas de envío muestran solo el botón, sin contexto. | MENOR | Aceptado. Muestran el estado habilitado; el contexto está en la captura del reparto. |
| 4 | El botón deshabilitado «Presentar objeción» tiene poco contraste en tema claro. | MENOR | Aceptado. Es el estado deshabilitado del sistema de diseño. |
| 5 | Los radios del modal son pequeños, sin marca visible de foco en la captura. | MENOR | Aceptado. Se evidencia el foco en la prueba de teclado de la suite real, no en esta captura. |
| 6 | En 375 px el nombre del servicio se corta en el campo y el valor de la aprobación se ve desde la mitad. | MENOR | Aceptado. Es el comportamiento normal de un campo de una línea. |
| 7 | El título «Qué paga usted y qué paga su aseguradora» no tiene jerarquía de encabezado. | MENOR | Aceptado. Se corrige en un hito de pulido, no en esta entrega. |
| 8 | Las capturas de desglose y objeción se regeneraron con el mismo código; su contenido no cambió. | — | Se reutilizan los veredictos de la primera pasada porque la pantalla no cambió. |
| 9 | Los nombres de archivo no llevan datos de la persona; las capturas son de elementos, no de la página. | — | Sin hallazgo. Prueba de nombres en verde. |

## Nota por pantalla

| Pantalla | Nota |
|---|---|
| Médica · reparto del cobro | ACEPTABLE CON RESERVAS (hallazgos 3, 6) |
| Médica · envío | ACEPTABLE CON RESERVAS (hallazgo 4) |
| Médica · modal de objeción | ACEPTABLE CON RESERVAS (hallazgo 5) |
| Paciente · desglose | ACEPTABLE CON RESERVAS (hallazgo 7) |
| Paciente · objeción presentada | APROBADA en la captura; ver «No cubierto» |

Ninguna pantalla queda RECHAZADA. Los hallazgos MAYOR 1 y 2 se corrigieron y se re-capturaron.

## No cubierto

- El modal de objeción no se capturó en 375 ni en 768 px: se objeta una sola vez por solicitud en la
  maqueta y la captura de 1280 px es la única del modal.
- No hay captura del estado bloqueado del envío (alerta «Todavía no puede enviar el cobro») en ningún
  ancho. Lo cubre la prueba de la suite (REQ-16-024), no la captura.
- Tema oscuro en 1280 px del bloque de cobro, en el estado bloqueado: no capturado.
