# Dónde conseguir lo de mi receta — carril 19

Evidencia de `/my-account/medical-record/where-to-buy/:requestId` con la pestaña en la URL, el
recorrido sugerido, «Cómo llegar» y los centros de imagenología por cobertura de estudios.

## Con qué cuenta

`paciente@alovida.mock`, entrando desde «Mis recetas» (`/my-account/pharmacy/prescriptions`). El
paciente declaró su casa, así que las distancias se miden desde ahí sin pedir la ubicación.

| Archivo | Qué muestra |
|---|---|
| `1440-imagenologia.png` | `?tab=imaging`. Los estudios pendientes del paciente y los centros que los tienen todos, del más cercano al más lejano, con dirección, distancia en línea recta y «Cómo llegar». |
| `375-imagenologia.png` | La misma pestaña en un teléfono de 375 px: sin desborde horizontal. |
| `375-farmacias.png` | La pestaña de farmacias en 375 px: sin desborde horizontal. |
| `1440-recorrido-claro.png`, `1440-recorrido-oscuro.png` | El recorrido sugerido cuando una sucursal tiene todo: lo dice y no propone más paradas. |
| `1440-tarjeta-claro.png`, `1440-tarjeta-oscuro.png` | La tarjeta de la sucursal con «Cómo llegar», que abre el punto en el mapa en una pestaña nueva. |

## Lo que se observó

- Al elegir «Centros de imagenología» la URL pasa a `?tab=imaging`; al recargar, la pestaña activa
  sigue siendo esa.
- «Cómo llegar» sale con `target="_blank"` y `rel="noopener noreferrer"`, hacia
  `https://www.google.com/maps/search/?api=1&query=<lat>,<lng>`. Es navegación, no una carga: la
  política de contenido no cambia.
- Consola sin errores en todo el recorrido.

## Lo que cubren las pruebas y no las fotos

Con los datos del simulador la sucursal más cercana tiene la receta entera, así que el recorrido
de varias paradas no aparece en pantalla. Lo cubren `where-to-buy.route.spec.ts` (el criterio
exacto, el contraejemplo del método voraz, desempates y faltantes) y `where-to-buy.spec.ts` (dos
sucursales incompletas que juntas cubren la receta, en orden de distancia). Lo mismo pasa con un
centro de imagenología al que le falta un estudio: el paciente del simulador tiene uno solo
pendiente, y el caso parcial lo cubre `where-to-buy.spec.ts`.
