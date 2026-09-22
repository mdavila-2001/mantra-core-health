# Contrato visual — qué significa «premium» en este producto

Adaptado de `mockup-premium-god-skill/references/VISUAL_CONTRACT.md`, con los
números reales del repositorio en lugar de los del paquete. Donde el paquete y
este archivo se contradigan, **manda este archivo**.

## 1 · Composición (lo que ya dictó el propietario)

Fuente: `docs/components/composition-rules.md` §5 + `mantra-core-health/CLAUDE.md` §6.
Se mide con `corr-evidencia.spec.ts`.

| Criterio | Umbral | Cómo se mide |
|---|---|---|
| Fondo blanco en modo claro | `rgb(255, 255, 255)` **y sin imagen ni velo encima** | color del `<body>` + `opacity` de `::before`/`::after` |
| Centrado | holgura izquierda y derecha difieren ≤ **2 px** | unión de las `app-card` contra `.app-main__inner` |
| A lo ancho | la unión de las tarjetas ocupa ≥ **85 %** del área | idem |
| Sin scroll horizontal | `scrollWidth ≤ innerWidth + 1` | documento completo |
| Consola | 0 errores (salvo `socket.io`, que no existe en esta rama) | eventos `console` y respuestas ≥ 500 |

Tres precisiones que ya costaron una medición equivocada y no se vuelven a
discutir: `.app-main` es **transparente** en los dos temas, así que el fondo se
lee del `<body>`; el hijo directo del área siempre mide 100 %, así que se mide
la **unión de las tarjetas**; y la regla §5 prohíbe la columna **vacía**, no la
columna — dos columnas llenas pasan.

El tope de ancho lo pone `.app-main__inner` (1440 px) y **nadie más**: ningún
componente declara su propio `max-inline-size`. Lo que evita las casillas
kilométricas no es acotar el formulario sino repartir los campos en columnas —
una en móvil, dos desde 780 px, tres desde 1120 px.

## 2 · Acabado (lo que agrega este plan)

Se mide con `premium-visual.spec.ts`.

| Criterio | Umbral | Por qué ése |
|---|---|---|
| Nombre accesible de todo control sólo-ícono | no vacío, y **no** proveniente sólo de `title` | `title` no existe para quien tabula y el lector de pantalla lo trata distinto; `atoms/button/button.ts` ya lo exige en dev |
| Globo de ayuda | aparece **con el foco** (no sólo con el puntero), con texto, y se cierra con **Escape** | `atoms/tooltip/tooltip.ts`: con teclado no hay demora, llegar al control ya es la intención |
| Globo sin recorte | su caja entra en el viewport | el globo cuelga del `<body>` justamente para no ser recortado; si igual se sale, está mal colocado |
| Anillo de foco | toda parada de tabulación tiene `outline` o `box-shadow` | se tabula de verdad: `:focus-visible` no se activa igual con `focus()` programático |
| Área táctil | ≥ **24 × 24 px** (WCAG 2.2 AA 2.5.8); < 44 px se informa | 44 es el objetivo de diseño del sistema, 24 es el piso que bloquea |
| Tipografía | ningún texto visible < **12 px** dentro del área de contenido | por debajo deja de leerse en pantalla clínica |
| Reduced motion | ninguna animación > **80 ms** corriendo con `prefers-reduced-motion: reduce` | regla `50-frontend.md` §13 |

## 3 · Lo que decide una persona mirando las fotos

Nada de esto se puntúa con un número, y ningún modelo lo declara aprobado solo:

- jerarquía: un título principal, una acción primaria reconocible, zonas
  distinguibles por estructura y no por recuadros;
- coherencia entre rutas: un lenguaje de íconos, una escala tipográfica, un
  ritmo de espacios; una misma acción no cambia de nombre ni de ícono;
- densidad: aire deliberado, no hueco muerto; agrupar en vez de encoger;
- estados: vacío, cargando, error, éxito, texto largo y listas largas — el
  estado feliz solo no aprueba una familia de componentes;
- motion con motivo: abrir, cerrar, confirmar, revelar. Sin rebotes, sin
  `transition: all`, sin animar todo al cargar.

## 4 · Antipatrones que rechazan una rebanada

Columna de trabajo angosta en escritorio · contenido pegado a un lado · hueco
muerto · ícono sin aclaración · tarjeta de texto plano donde iba el control real
· botón decorativo sin comportamiento · globo recortado · foco invisible ·
tipografía diminuta · `!important` para ganar una pelea de especificidad ·
tamaños fijos que rompen el zoom · tres tarjetas apiladas donde la regla §5 pide
una con pestañas.

## 5 · Lo que no se toca para conseguir que se vea mejor

Contratos HTTP, modelos, validaciones, permisos, rutas de la aplicación,
`package.json`, lockfiles, dependencias, tests existentes y umbrales. Un cambio
de layout no autoriza a rediseñar el sistema. Si una pantalla no se puede
mejorar sin tocar algo de esa lista, se registra el bloqueo y se pregunta.
