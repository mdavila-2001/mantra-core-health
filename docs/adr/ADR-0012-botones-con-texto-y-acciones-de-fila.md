# ADR-0012: Todo botón lleva icono y texto; las acciones de fila van en un desplegable

## Estado

**Aceptado** — 2026-09-20. **Reemplaza la decisión del 2026-09-13** registrada en
`src/app/features/agenda/agenda.html:545`, cuyo motivo se conserva más abajo.

## Contexto

Un botón que sólo muestra un icono obliga a adivinar. El icono de un lápiz puede
ser «editar», «firmar» o «anotar»; tres puntos verticales pueden ser «más
acciones» o «menú». El nombre existe —en `aria-label` y en el globo— pero sólo
para quien usa lector de pantalla o se detiene a esperar el globo. Quien mira la
pantalla y decide rápido no tiene ninguno de los dos.

Medición sobre el corte `68dcb562`:

```text
$ git grep -o "iconOnly" -- 'src/app/**/*.html' | wc -l
107
$ git grep -l "iconOnly" -- 'src/app/**/*.html' | wc -l
34
```

**107 apariciones en 34 plantillas.** No es un caso aislado: es el patrón por
omisión del proyecto.

## La decisión que esto reemplaza, y por qué existió

El 2026-09-13 se decidió lo contrario para la agenda. El motivo está escrito en
`src/app/features/agenda/agenda.html:545`:

> *Íconos con su globo (propietario, 2026-09-13): con texto, una solicitud
> ofrecía hasta cinco botones y la fila crecía a tres renglones.*

**Ese motivo era correcto y sigue siéndolo.** Cinco botones con texto en una
fila de tabla no entran, y una fila de tres renglones hace ilegible el listado.
La decisión no fue un descuido: resolvía un problema real.

Lo que cambia no es el diagnóstico sino la solución disponible. Poner texto en
los cinco botones y poner los cinco botones en la fila son dos cosas distintas,
y sólo la segunda rompía el layout.

## Fuerzas y restricciones

- El nombre de una acción tiene que estar **visible**, no sólo anunciado.
- Una fila de tabla no puede crecer a tres renglones.
- Hay filas que ofrecen hasta cinco acciones.
- El desplegable ya existe y está resuelto: `shared/components/molecules/menu/`
  reubica su panel al `<body>` mientras está abierto, así que **ningún
  contenedor con `overflow` lo recorta** — que es donde mueren los menús dentro
  de una tabla.
- El globo ya existe y está bien hecho: `shared/components/atoms/tooltip/`.
- Cambiar el comportamiento por omisión de un átomo que usan 34 plantillas es
  inaceptable (regla 95.1): lo que se publica es una opción nueva.

## Decisión

### 1. Todo botón lleva icono y texto

Un botón nuevo se escribe con su etiqueta visible. El icono acompaña al texto;
no lo sustituye.

### 2. Las acciones de fila van en un desplegable

Cuando una fila ofrece **más de dos acciones**, van dentro de un desplegable
construido sobre `app-menu`, con **cada opción con su icono y su texto**. La
fila muestra un único disparador.

Esto resuelve las dos cosas a la vez: el nombre vuelve a estar visible, y la
fila deja de crecer, porque las acciones ya no compiten por su ancho.

Hasta dos acciones pueden quedar en la fila, con texto.

### 3. La única excepción admitida

Un botón puede quedar sólo con icono cuando **su significado es universal en el
contexto donde aparece** —cerrar un diálogo, quitar un elemento de una lista,
navegar a la página siguiente— y cumple **las dos** condiciones:

| Condición | Cómo se cumple |
|---|---|
| Nombre accesible | `aria-label` con el nombre de la acción, no del icono |
| Globo visible | `appTooltip`, que aparece con puntero y con foco de teclado |

**Las dos, no una.** Un `aria-label` sin globo deja fuera a quien ve la pantalla;
un globo sin `aria-label` deja fuera a quien no la ve.

Toda excepción se justifica en el código, en una línea, junto al botón.

## Consecuencias

**A favor**

- El nombre de cada acción es legible sin esperar ni pasar el puntero.
- La fila no crece: el desplegable saca las acciones del flujo horizontal.
- Se reusa lo que ya está resuelto y probado, en vez de construir otra cosa.

**En contra**

- Una acción dentro de un desplegable exige un clic más que un botón en la fila.
  Es el precio de que la fila siga siendo legible con cinco acciones; con dos o
  menos no se paga, porque ahí siguen en la fila.
- Hay 107 apariciones que revisar. Se reparten por dueño de archivo; ninguna se
  cambia desde fuera de su territorio.

**Neutro**

- El átomo de botón no cambia su comportamiento por omisión. Lo que se agrega es
  una opción nueva.

## Cómo se aplica

```html
<!-- Dos acciones o menos: en la fila, con texto -->
<button app-button variant="secondary" size="sm">
  <svg app-icon>…</svg>
  Ver detalle
</button>

<!-- Más de dos: un disparador y el desplegable -->
<button app-button variant="ghost" size="sm" [appMenuTrigger]="accionesDeFila">
  <svg app-icon>…</svg>
  Acciones
</button>
<app-menu #accionesDeFila>
  <app-menu-item (selected)="aceptar(fila)">
    <svg app-icon>…</svg>
    Aceptar
  </app-menu-item>
  <app-menu-item [disabled]="!fila.puedeIniciar" (selected)="iniciar(fila)">
    <svg app-icon>…</svg>
    Iniciar
  </app-menu-item>
</app-menu>

<!-- Excepción: significado universal, con las dos condiciones -->
<button app-button variant="ghost" iconOnly
        aria-label="Cerrar el diálogo"
        appTooltip="Cerrar">
  <svg app-icon>…</svg>
</button>
```

## Verificación

Un cambio cumple esta decisión cuando:

1. Ningún botón nuevo usa `iconOnly` sin su par `aria-label` + `appTooltip` y su
   justificación de una línea.
2. Toda fila con más de dos acciones las ofrece en un desplegable.
3. El desplegable se abre, se recorre, se elige y se cierra **sólo con teclado**,
   y el foco vuelve al disparador al cerrarse.
4. La fila no creció de alto respecto de la captura previa.

## Referencias

- Decisión que reemplaza: `src/app/features/agenda/agenda.html:545` (2026-09-13).
- Desplegable: `src/app/shared/components/molecules/menu/`.
- Globo: `src/app/shared/components/atoms/tooltip/`.
- Accesibilidad de botones y desplegables: [`docs/accessibility/keyboard.md`](../accessibility/keyboard.md),
  [`docs/accessibility/focus-management.md`](../accessibility/focus-management.md).
