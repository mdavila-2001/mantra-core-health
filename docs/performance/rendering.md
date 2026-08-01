# Rendimiento de renderizado

Todo `OnPush`, todo señales, cero `@defer`. Lo que eso da y lo que deja fuera.

---

## Detección de cambios

**Los 61 componentes son `OnPush`**, salvo `App` (la raíz), que no tiene entradas
ni estado propio.

Con señales en todas partes, `OnPush` no exige disciplina extra: la señal
notifica al marcar, y el componente se revisa solo cuando algo que lee cambió.

```ts
@Component({
  …
  changeDetection: ChangeDetectionStrategy.OnPush,
})
```

## `computed` en vez de trabajo en la plantilla

Ninguna plantilla calcula nada:

```ts
readonly buttonClasses = computed(() => {
  const classes = ['btn', `btn--${this.variant()}`, `btn--${this.size()}`];
  if (this.iconOnly()) classes.push('btn--icon-only');
  …
  return classes.join(' ');
});
```

Un `computed` se recalcula **solo si alguna de sus dependencias cambió**. Una
expresión en la plantilla se evalúa en cada revisión.

Y el estrechamiento de tipos también sube a TypeScript:

```ts
protected readonly recordCount = computed<number | null>(() => {
  const data = dataOf(this.directory());
  return data === null ? null : data.records.length;
});
```

> *«hacerlo arriba obligaría a un `$any()` que apaga la comprobación de tipos
> justo donde importa.»*

## Un solo `effect` en todo el proyecto

```ts
// theme.service.ts
effect(() => this.applyPreference(this.preference()));
```

Y es el uso correcto: escribir en `document.documentElement` es salir del sistema
de señales hacia el DOM, que es exactamente para lo que `effect` existe.

Un `effect` que escribe otra señal es un ciclo esperando a pasar. Que haya
**uno solo** es una señal de salud del código.

`ViewStateHost` tiene dos efectos más, y los dos son igual de legítimos: mover el
foco en S4 (DOM) y avisar en desarrollo de un S9 sin `requestId`.

## `track` en los bucles

```html
@for (role of roles(); track role) { <app-badge variant="info" [value]="role" /> }
@for (issue of invalido.issues; track issue.message) { … }
```

Sin `track`, Angular destruye y recrea el DOM en cada cambio de la lista.
`app-data-table` recibe un `trackBy` como entrada, así que la identidad de fila la
decide quien conoce los datos.

## Trabajo en el arranque

```ts
provideAppInitializer(() => { inject(ThemeService); });
provideAppInitializer(() => inject(AuthService).restoreSession());
```

El segundo **bloquea el arranque** hasta que el canje del refresh token resuelve.
Es deliberado:

> *«Si no se esperara, alguien con sesión válida vería un parpadeo al login
> mientras el canje del refresh token está en vuelo.»*

**Cuesta una petición antes de la primera pintada**, y compra que no haya
parpadeo. En el servidor resuelve de inmediato sin pedir nada, porque no hay
almacenamiento.

Es un intercambio consciente. Si el LCP resultara malo al medirlo, éste es el
primer lugar donde mirar.

## Hidratación

```ts
provideClientHydration(withEventReplay())
```

`withEventReplay()` graba los eventos previos a la hidratación y los reproduce.
En las cuatro rutas prerenderizadas eso importa: el login se ve al instante, y un
clic anterior a que JavaScript esté listo no se pierde.

## El único cambio de layout tras hidratar

`Breakpoints` arranca en escritorio y se corrige en `afterNextRender`. En un
teléfono, el nav pasa de columna a cajón **después** del primer render.

Es un CLS observable, y está elegido a conciencia frente a la alternativa: con el
arranque contrario, el botón de hamburguesa **desaparecería** en escritorio, y un
elemento que se va es peor que uno que llega.

## Lo que no se usa

| Técnica | Estado | Cuándo haría falta |
|---|---|---|
| **`@defer`** | **En ninguna plantilla** | Un bloque pesado bajo el pliegue |
| `NgOptimizedImage` | No hay imágenes | Cuando las haya |
| Desplazamiento virtual | Sin CDK | Listas de cientos de filas |
| Web workers | No | Cálculo pesado en el cliente |
| `linkedSignal` / `resource()` | No se usan | — |
| Memoización manual | No hace falta: `computed` ya lo es | — |

### `@defer` es la ausencia más notable

Angular lo trae desde la 17 y permite diferir **dentro** de una plantilla, con
disparadores (`on viewport`, `on interaction`, `on idle`) y con marcadores de
posición.

El candidato obvio es la vitrina, que ya está diferida por ruta pero carga sus
secciones de golpe. Y lo será cualquier panel con contenido bajo el pliegue.

**No es una brecha hoy** —no hay ninguna pantalla lo bastante pesada— pero es la
herramienta que falta conocer cuando la haya.

## Riesgos de rendimiento sin materializar

| Riesgo | Hoy | Cuándo aparece |
|---|---|---|
| Sin caché: cada navegación repide | Nulo: una pantalla pide | Con listas y detalles |
| Sin cancelación: una respuesta tardía se procesa igual | Nulo | Con navegación rápida entre pantallas |
| Sin virtualización | Nulo | Con listas largas |
| Sin `@defer` | Nulo | Con pantallas densas |
| El arranque espera al refresco | Una petición | Se mantiene |

**Cuatro de los cinco son consecuencia del mismo hecho: la aplicación todavía es
chica.** Documentarlos ahora es más barato que descubrirlos después.

## Cómo medir cuando haga falta

```bash
# Perfil de la aplicación real
yarn build && yarn serve:ssr:mantra-core-health
# DevTools › Performance › grabar una navegación

# Detección de cambios de Angular
# DevTools › Angular › Profiler   (extensión Angular DevTools)
```

Angular DevTools muestra cuántas veces se revisa cada componente, que es la
medición que corresponde a un problema de `OnPush`.
