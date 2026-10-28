# Tipografía

Dos familias, nueve roles, autoalojadas. Sin CDN.

---

## Las dos familias

| Token | Familia | Para qué | Formato |
|---|---|---|---|
| `--font-display` | **Poppins** 500 / 600 / 700 | Display y marca | Estática, tres pesos |
| `--font-body` | **Inter Variable** | Interfaz y datos | Variable, 100–900 en un archivo |

```css
@import '@fontsource/poppins/500.css';
@import '@fontsource/poppins/600.css';
@import '@fontsource/poppins/700.css';
@import '@fontsource-variable/inter';
```

**Autoalojadas**: cero peticiones a Google Fonts ni a ningún CDN. Es una decisión
de privacidad y de rendimiento a la vez — un CDN de tipografías ve la IP de cada
visitante.

Poppins se importa peso por peso porque es estática; Inter Variable cubre todo el
rango en un solo archivo, que es justamente por lo que se eligió una variable
para la interfaz.

### Instaladas y sin importar

`package.json` trae `@fontsource/lato`, `@fontsource-variable/open-sans` y
`@fontsource-variable/roboto`. **Ninguna se importa** desde `styles.css`.

`styles.css` las llama «reserva». No pesan en el paquete —lo que no se importa no
se empaqueta— pero sí ocupan lugar en el lockfile y en la instalación. Anotado
como brecha `LOW`: o se usan, o se quitan.

## La escala ALOVIDA

| Rol | Token | Tamaño | Interlínea | Peso |
|---|---|---:|---:|---|
| `display` | `--fs-display` | 44 px | 50 px | Poppins 700 |
| `h1` | `--fs-h1` | 32 px | 40 px | Poppins 600 |
| `h2` | `--fs-h2` | 26 px | 34 px | Poppins 600 |
| `h3` | `--fs-h3` | 21 px | 28 px | Poppins 500 |
| `body-lg` | `--fs-body-lg` | 17 px | 27 px | Inter 400 |
| `body` | `--fs-body` | 15 px | 23 px | Inter 400 |
| `caption` | `--fs-caption` | 13 px | 18 px | Inter 500 |
| `overline` | `--fs-overline` | 11 px | — | Inter 700, +8 % de espaciado, MAYÚSCULAS |
| `data` | `--fs-data` | 15 px | — | Inter 600, tabular |

### Dos roles sin interlínea propia

`overline` y `data` **no declaran `--lh-*`**: heredan la del contenedor. El tipo
lo hace explícito:

```ts
/** `overline` y `data` no declaran interlínea propia: heredan la del contenedor. */
export const LINE_HEIGHT_ROLES = ['display','h1','h2','h3','body-lg','body','caption'] as const;
```

Siete interlineados para nueve tamaños, y la diferencia está declarada en vez de
ser un olvido.

## Base

```css
html {
  font-family: var(--font-body);
  font-size: var(--fs-body);      /* 15px */
  line-height: 1.55;
}

h1, h2, h3, h4 {
  font-family: var(--font-display);
  color: var(--text-primary);     /* el color es texto, no marca */
  margin: 0;
  letter-spacing: -0.01em;
}
```

**Los encabezados no llevan color de marca.** Un `<h1>` azul petróleo en cada
pantalla convertiría la marca en ruido; el color de marca se reserva para lo que
acciona.

`h4` hereda familia y color pero **no tiene tamaño propio** en la escala: cae en
el del contenedor. Es una omisión menor, anotada como `LOW`.

## Cifras tabulares

```css
.cifras-tabulares, .tabular-nums {
  font-variant-numeric: tabular-nums;
}
```

> *«datos clínicos: columnas de resultados, dosis y rangos alinean por cifra.»*

**En un sistema de salud esto no es tipografía, es legibilidad de datos.** Sin
cifras tabulares, una columna de dosis no alinea y comparar dos valores exige
leerlos en vez de mirarlos.

Los dos nombres son válidos: `.tabular-nums` es el del spec ALOVIDA y
`.cifras-tabulares` el del vault. Misma regla, dos puertas.

Se usa en `view-state-host` para el código de soporte y está disponible para
cualquier columna numérica.

## `.sr-only`

```css
.sr-only {
  position: absolute;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}
```

Para *«texto que completa un nombre accesible sin ocupar espacio visual (p. ej.
"(obligatorio)" junto al asterisco)»*.

Usa `clip-path` y no el `clip` obsoleto, y conserva `white-space: nowrap` para
que el texto no se parta en una línea de 1 px de ancho — dos detalles que
distinguen una implementación correcta de una copiada a medias.

`app-data-table` la usa para su `<caption>`.

## Enlaces

Un enlace sin estilo del sistema sale con el azul del navegador, y el violeta al
visitarlo. Hay **tres capas**, de la más específica a la más general, y cada una
existe porque la anterior no llega a todo:

| Qué | Dónde vive | Se aplica a |
|---|---|---|
| Átomo `app-link` | `atoms/link/link.css` | `<a app-link>` en plantillas que importan `Link`. Trae las variantes `subtle` y `danger` y el ícono de destino externo |
| Respaldo de `app-link` | `:where(a[app-link])` en `styles/alovida.css` | `<a app-link>` en plantillas que **no** montan el átomo (las maquetas ALOVIDA) |
| Base de texto suelto | `:where(a[href]:not([class], [app-button], [app-link]))` en `styles.css` | Un `<a href>` sin clase: el de un párrafo, una alerta o un pie |

Las tres dicen lo mismo, y `link.spec.ts` lo vigila:

- color `--text-link`, que en oscuro pasa a aguamarina;
- **subrayado siempre**, fino (`1px`, a `0.2em`): el color no puede ser el único
  portador de «esto se puede seguir»;
- en hover, el color baja a `--brand-primary-hover` **y** el subrayado se
  engrosa a `2px`, para que tampoco dependa del tono.

**Especificidad cero a propósito.** Las dos capas globales van dentro de
`:where()`, así que cualquier regla de componente o de contenedor les gana sin
pelearse. Cuando el respaldo de `app-link` era `a[app-link]` a secas, le ganaba
al `:host` del átomo y dejaba sin efecto el subrayado y las variantes.

**No hace falta una regla `:visited`.** Un `color` de autor le gana al violeta del
navegador en todos los estados, también en el visitado.

**Lo que la base no toca, y por qué:**

- un `<a>` **sin `href`** no es un enlace: no se le pinta como tal;
- un `<a>` **con clase** decide su propio aspecto (tarjeta, navegación, chip);
- `a[app-button]` y `a[app-link]` ya tienen la suya.

**Dentro de una alerta**, el enlace proyectado toma la tinta del tono
(`color: inherit` en `alert.css`) y sigue subrayado: el color de enlace del
sistema está calculado contra el fondo de la página, y sobre el fondo tonal de la
alerta, en oscuro, quedaba en 4,35:1.

## Lo que no hay

| Elemento | Estado |
|---|---|
| Escala tipográfica adaptable (`clamp()`) | No. Los tamaños son fijos en todos los anchos |
| Tokens de peso (`--fw-*`) | No. El peso se escribe literal en cada regla |
| Tokens de espaciado entre letras | No. Solo el `-0.01em` de los encabezados |
| `text-wrap: balance` en títulos | No se usa |
| Color de enlace para un `<a>` **con clase** que no declara color | No. Esa clase decide, y si sólo fija el peso (`.panel__fila-nombre` en `dashboard.css`) el enlace sale con el azul del navegador. Se arregla poniendo `app-link` o el color en la clase |
| Soporte de escritura de derecha a izquierda | No |

La primera es la más visible: un `display` de 44 px en un teléfono de 320 px de
ancho ocupa mucho. Anotada como `MEDIUM` en
[diseño adaptable](responsive-design.md).
