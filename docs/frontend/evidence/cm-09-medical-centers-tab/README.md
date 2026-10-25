# Evidencia CM-09 · pestaña «Centros médicos» (rama `mockup`)

Recorrido en Chromium (Playwright) contra `ng serve`, con `paciente@alovida.mock`: Mi historia clínica →
Recetas → «Dónde conseguir» → pestaña «Centros médicos» (`?tab=medical-centers`). El registro completo está
en `journey.log`.

## Datos de la corrida

Con los datos de `mockup` tal cual están, el paciente de ejemplo no tiene procedimientos pendientes: la
pestaña mostró el estado vacío «No tiene procedimientos pendientes». Para ver la lista se
**sembraron en local, sin commitear**, dos órdenes pendientes de la categoría procedimiento y los conceptos
`proc-endoscopia-alta` y `proc-colonoscopia` (con `uuid('<semilla>')`, como pide `CONTRATO.md`). Esa
siembra no está en la rama: la traen las órdenes de CM-08 y los conceptos que CM-08 defina.

## Lo que se observó

| Qué | Resultado |
|---|---|
| Por defecto, solo completos | 1 tarjeta: Clínica Norte, «Tiene todos» |
| «Ver el que tiene una parte» | 2 tarjetas; el botón pasa a «Mostrar solo los que tienen todo» con `aria-pressed=true`; Centro Médico Sur dice «Le falta: Colonoscopia» (por nombre, sin uuid) |
| Orden | El de la API: el completo primero aunque el parcial (Sur, 2,5 km) esté más cerca que Norte (4,9 km) |
| «Su médico trabaja en este centro» | Aparece en Sur, que no es el primero; las dos tarjetas tienen la misma clase (`centros__centro`) |
| Precio, referencia, total | «650,00 Bs», «Referencia: 380,00 UMA», «Total: 1.550,00 Bs» |
| «Cómo llegar» | `https://www.openstreetmap.org/directions?route=%3B<lat>%2C<lng>`, solo el destino; `target=_blank`, `rel=noopener noreferrer` |
| Sin origen (Farmacias → «Dejar de usar este punto» → volver) | Sin distancias y con el texto que explica cómo elegir un punto |
| Anchos 390, 768, 1024, 1440 y 1920 | Sin desborde horizontal (`0px`) |
| Oscuro en 390 y 1440 | Tema aplicado (`rgb(8, 22, 28)`); texto, distintivos y botón legibles |
| Errores de página | Ninguno |

## Lo que NO cubre esta evidencia

- Los parámetros de red (`lat`/`lng` juntos o ninguno, solo ids de órdenes en la URL, carga solo al abrir
  la pestaña): el backend simulado responde dentro de Angular y no sale ninguna petición que Playwright
  pueda ver. Los fija `medical-centers.client.spec.ts` y `medical-centers-tab.spec.ts`.
- Las pestañas Farmacias e imagenología como radio: solo se corrieron sus pruebas unitarias (96 en verdes);
  no se compararon capturas con la base.
- «Cómo llegar» en oscuro se ve más tenue que el resto del texto; es el componente `Link` del sistema, el
  mismo de imagenología, y no se ajustó acá.
- Contra la API real (`dev`): no se corrió.
- Revisión independiente (`visual-reviewer`, `frontend-reviewer`): no se hizo. Quien implementa no aprueba.
