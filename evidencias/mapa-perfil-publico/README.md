# El mapa de la ficha pública (26/08/2026)

Qué prueba cada archivo de esta carpeta.

| Archivo | Qué prueba |
| --- | --- |
| `01-clinica-del-sur-con-mapa.png` | La ficha pública de una organización con coordenadas cargadas: la sección «Dónde atiende» dibuja el mapa, con un pin en el punto exacto. |
| `02-medico-sin-ubicacion-sin-mapa.png` | Un profesional sin ciudad ni dirección cargadas: la ficha no revienta y la sección «Dónde atiende» simplemente no se pinta. |

Corrido contra la API arrancada desde el fuente en `:3013` (no el contenedor, que
todavía sirve una imagen sin este cambio — ver
[[api-desde-el-fuente-en-3010]]) y el front en `ng serve :4210`, con
`tools/alovida/seed-vitrina-publica.mjs` sembrando la organización con dirección y
coordenadas.

## El primer intento no era este: iba por un `<iframe>` de Google Maps

La versión que llegó a este punto sin commitear usaba
`https://maps.google.com/maps?...&output=embed` en un `iframe`. Andaba en
aislamiento, pero la aplicación ya tiene una Content Security Policy con
`default-src 'self'` y ningún `frame-src` abierto — a propósito, según su propio
comentario: *"un iframe superpuesto puede inducir a confirmar una acción clínica
que la persona cree estar haciendo en otro sitio"*. El navegador bloqueaba el
mapa en silencio:

```
Framing 'https://maps.google.com/' violates the following Content Security
Policy directive: "default-src 'self'".
```

Además la aplicación **ya tenía** un mapa propio —`app-map`, Leaflet +
OpenStreetMap, sin clave de API, usado en «Dónde comprar mi receta»—, así que
el iframe no sólo rompía la política: duplicaba un organismo que ya existía.
Se reemplazó el `iframe` por `app-map` con un solo pin. Sin coordenadas no hay
pin que dibujar: a diferencia del embed de Google, Leaflet no busca por texto,
así que la ciudad o la dirección solas ya no alcanzan para mostrar un mapa
(antes sí, como *fallback*).
