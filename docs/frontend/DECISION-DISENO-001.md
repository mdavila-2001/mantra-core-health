# DD-001 · Unificar la paleta y la escala tipográfica

**Fecha:** 2026-09-08 · **Pedido por:** el dueño del producto
**Encargo literal:** «lo más recomendado para un diseño premium y sobre todo
limpio. Un layout que haga sentir el producto terminado y completo. NO hecho
con IA.»

---

## La decisión

**No se rediseña nada.** Se hace que el código obedezca al sistema de diseño
que este producto ya tiene.

Esa es la respuesta al encargo, y no es una evasiva: ALOVIDA ya es un sistema
premium. Tiene 11 rampas de color, contraste medido caso por caso, dos
excepciones documentadas *con el número que las justifica*, una grilla estricta
de 4 px y una escala tipográfica de 8 escalones. Un sistema así no se mejora
agregándole cosas.

Lo que rompía la sensación de producto terminado eran las **intrusiones**.

## Por qué se veía «hecho con IA»

El diagnóstico no es estético, es forense. Los colores que estaban fuera de la
paleta no eran variaciones del criterio del diseñador: eran **defaults de
librerías ajenas**.

| Color encontrado | Qué es en realidad |
|---|---|
| `#6b7280` | Tailwind `gray-500` |
| `#dc2626` | Tailwind `red-600` |
| `#f8fafc` | Tailwind `slate-50` |
| `#c0392b` | Flat UI «Pomegranate», paleta de 2013 |
| `#e5e5e5`, `#d4d4d4` | grises genéricos sin origen |

Un producto con identidad propia, salpicado de valores por defecto de otro
sistema. **Eso** es lo que se lee como generado en vez de diseñado: no la falta
de adornos, sino la mezcla de dos vocabularios.

## Qué se cambió

### Colores a la rampa ALOVIDA

Cada intruso al token más cercano de la paleta, con criterio semántico (un rojo
va a la familia de error, un petróleo a la rampa petrol), no sólo por distancia.

Los reemplazos con distancia perceptual < 15 son imperceptibles. Los rojos
`#dc2626` y `#c0392b` sí cambian de forma visible: **el rojo de error de ALOVIDA
es un ladrillo apagado (`#b5533c`), no el rojo saturado de Tailwind.** El cambio
es el punto — un alert que grita en un rojo que no es el tuyo delata que el
componente vino de otro lado.

### Tipografía a la escala

Los `14px`, `30px` y `42px` no existen en la escala
(11/13/15/17/21/26/32/44). Van a `--fs-body`, `--fs-h1` y `--fs-display`.

### Espaciado a la grilla

El `padding: var(--sp-1) 10px` del badge pasa a `--sp-3` (12 px): 4/12 es la
proporción de pastilla del sistema, y **10 px no existe en una grilla de 4**.

## Lo que se decidió NO hacer

Deliberadamente, porque sería lo contrario de lo pedido:

- no agregar gradientes;
- no poner sombra en cada panel;
- no anidar tarjetas dentro de tarjetas;
- no meter iconos en cuadraditos redondeados junto a cada título;
- no sumar métricas ni gráficos que nadie pidió;
- no cambiar el layout, que el baseline mostró sano (0 desbordes en 140
  mediciones sobre cinco viewports).

Esa lista es, literalmente, el checklist anti-«vibe code» del playbook. El
trabajo premium acá era **quitar**, no agregar.

## Lo que NO se tocó, y por qué

El `#fff` de `atoms/button/button.css` se queda. El comentario que tiene encima
lo justifica:

> *«blanco literal del spec (btn-danger): en oscuro `--text-inverse` es
> petrol-900 y el diseñador fija #fff en ambos temas»*

Es una decisión documentada, no deuda. Antes de tocar un literal hay que leer el
comentario de al lado.

## Verificación

El mismo arnés de la Wave 0: `yarn lint`, `yarn typecheck` y las 140 mediciones
de `playwright/fable-baseline.spec.ts` en los cinco viewports, para comprobar
que ningún cambio de tamaño introdujo desborde.
