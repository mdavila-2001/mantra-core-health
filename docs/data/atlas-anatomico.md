# El atlas anatómico en el glosario

El glosario médico ya no tiene 69 términos: tiene **617**, porque las 548
láminas del atlas anatómico entraron como términos de la categoría Anatomía.

| | |
|---|---|
| Fuente | `data/anatomy-atlas/` — taxonomía anatómica v2 auditada sobre el Atlas de Anatomía Humana de Netter, 4.ª ed. |
| Fixture | `src/app/core/mock/fixtures/anatomia-atlas.generated.ts` |
| Generador | `yarn mock:anatomy` |
| Prueba de deriva | `src/app/core/mock/fixtures/anatomia-atlas.spec.ts` |
| Dónde se ve | `/glossary?category=glossary-category-anatomy` |

## Qué trae

| | |
|---|---:|
| Regiones | 8 |
| Subregiones | 65 |
| Láminas | 548 |

Las 8 regiones son **etiquetas** del glosario, no categorías: un término tiene
una categoría y varias etiquetas, así que la categoría de una lámina es
Anatomía y la región es la faceta por la que se acota. Sin ese filtro, la
categoría sería un muro de quinientas entradas.

## Quién lo ve

**Sólo quien ejerce o administra.** El glosario está restringido por una
decisión del cliente del 18/08/2026: a una paciente la ruta la manda al panel.
Probarlo con la cuenta equivocada da un «no se ve nada» que parece un fallo de
datos y es un permiso funcionando.

## Las 3 161 entidades del índice NO están, y es a propósito

El corpus trae, además de las láminas, 3 161 entidades del índice escaneado.
No entraron porque sus etiquetas están **mal cortadas**, y no es ruido que se
pueda filtrar:

- 1 400 de 3 161 traen daño visible.
- «Abertura — mujer», «Abertura — varón», «Abertura — radiografía» son líneas
  de continuación del índice pegadas a la entrada anterior.
- «Abertura lateral (agujero de Luschka) — espinoso» y decenas más arrastran el
  paréntesis de una entrada previa hacia forámenes que no tienen que ver.

Entre las que parecen sanas hay muchas igual de mal cortadas, así que un filtro
por forma no alcanza. Mostrar «Abertura — mujer» como término anatómico en un
producto clínico es peor que no tener el término.

El corpus lo dice de sí mismo: se declara **para entrenamiento de IA**,
conserva la forma fuente literalmente y advierte que no es nomenclatura
normativa sin cotejar contra FIPAT.

## Qué se limpia del título, y qué no

Los encabezados de lámina comparten página con numeración y marcas de sección,
y el OCR se los lleva: **205 de 548** llegaban con restos.

- Delante: letras sueltas y fragmentos de hasta cuatro caracteres —«ql Agujeros
  de la base del cráneo», «a] Atrio y ventrículo derechos», «ños) Vasos y
  nódulos linfáticos»—.
- Detrás: colas del pie de página —«… visión superior La», «Arteria subclavia
  a», «… visión posterior os»—.

**Lo difícil es que hay fragmentos cortos que sí son parte del título.** `Aa.`,
`Nn.`, `Mm.` y `Vv.` son las abreviaturas de arterias, nervios, músculos y
venas, y abren diez láminas. Una regla que borre «token corto inicial» se las
lleva puestas y deja títulos mutilados que nadie nota hasta buscar «Nn.
craneales» y no encontrarlo.

Por eso la regla exige tres cosas a la vez: el fragmento mide cuatro caracteres
o menos, no está en la lista de abreviaturas, y lo que queda detrás empieza en
mayúscula. Así `TC` sobrevive en «imágenes axiales de TC» y `Bazo` sigue siendo
un título entero.

**Dos láminas de 548** llegan con el encabezado ilegible: el OCR no leyó nada
aprovechable. Se las nombra por su bloque —«Lámina 113 · Meninges y encéfalo»—,
que es un dato cierto, en vez de mostrar el ruido.

## Qué se emite de cada definición, y qué no

Los archivos de origen mezclan tres cosas: la descripción anatómica del bloque,
prosa sobre **cómo entrenar un modelo con esto**, y una advertencia de qué no
inferir. Sólo viajan la primera y la tercera.

El campo se llama `regionalContext` y no «descripción» por una razón: **no
describe la lámina, describe su región y su subregión**. En la fuente es el
mismo texto para todas las láminas del mismo bloque, y llamarlo descripción
haría creer que cada lámina trae la suya.

La advertencia viaja pegada a la definición a propósito. Un atlas visual dice
dónde está algo, no qué hace, qué lo irriga ni qué lo inerva; separarlas dejaría
la primera sonando a más de lo que es.

## Cómo se regenera

```bash
yarn mock:anatomy
yarn test --watch=false src/app/core/mock/fixtures/anatomia-atlas.spec.ts
```
