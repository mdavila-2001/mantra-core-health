# Dónde conseguir lo de mi receta — carril 19

Evidencia de `/my-account/medical-record/where-to-buy/:requestId` con la pestaña en la URL, el
recorrido sugerido y «Cómo llegar». En esta rama la pestaña de imagenología queda en estado vacío
hasta que la búsqueda de centros por cobertura de estudios esté disponible en el backend.

## Con qué cuenta

`paciente@alovida.mock`, entrando desde «Mis recetas» (`/my-account/pharmacy/prescriptions`). El
paciente declaró su casa, así que las distancias se miden desde ahí sin pedir la ubicación.

| Archivo | Qué muestra |
|---|---|
| `1440-farmacias.png`, `1440-farmacias-oscuro.png` | La pestaña de farmacias en claro y en oscuro. |
| `375-farmacias.png` | La misma pestaña en un teléfono de 375 px: sin desborde horizontal. |
| `1440-imagenologia-vacio.png`, `375-imagenologia-vacio.png` | `?tab=imaging`: el estado vacío explica por qué todavía no se puede decir qué centro tiene todos los estudios. |

## Lo que se observó

- Al elegir «Centros de imagenología» la URL pasa a `?tab=imaging`; al recargar, la pestaña activa
  sigue siendo esa.
- La sucursal más cercana tiene toda la receta y el recorrido sugerido lo dice, sin proponer más
  paradas.
- «Cómo llegar» sale con `target="_blank"` y `rel="noopener noreferrer"`, hacia
  `https://www.google.com/maps/search/?api=1&query=<lat>,<lng>`.
- 375 y 768 px sin desborde horizontal; consola sin errores.

## Lo que cubren las pruebas y no las fotos

El recorrido de varias paradas no aparece con estos datos, porque la sucursal más cercana tiene todo.
Lo cubren `where-to-buy.route.spec.ts` (criterio exacto, contraejemplo del método voraz, desempates y
faltantes) y `where-to-buy.spec.ts` (dos sucursales incompletas que juntas cubren la receta).

## Centros médicos (25/10/2026)

`375-centros-medicos.png`: `?tab=medical-centers` a 375 px. La pestaña sigue en estado vacío a
propósito —no hay contrato que diga qué procedimientos le indicaron al paciente ni qué centro los
hace (`diagnostics/me/orders` sólo trae LAB e IMAGING, `procedure-cases` es del equipo quirúrgico,
la búsqueda por cobertura sólo acepta LABORATORY e IMAGING)—, pero ahora muestra la salida
«Ver clínicas y hospitales»: antes el enlace no llevaba `empty-actions` y la molécula no lo
proyectaba. Lo cubren `playwright/carril-19-where-to-buy-tabs.spec.ts` (tres pestañas, `?tab=`,
sólo sucursales completas por defecto, «Cómo llegar» por OpenStreetMap, centros médicos sin
lista inventada) y una prueba nueva en `where-to-buy.spec.ts`.
