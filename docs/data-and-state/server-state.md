# Estado de servidor

Sin capa de caché. Cada pantalla pide, guarda el resultado en una señal
`ViewState<T>` y lo pinta con `ViewStateHost`.

---

## El patrón, completo

```ts
export class Dashboard {
  private readonly publicClient = inject(PublicClient);

  protected readonly directory = signal<ViewState<PublicProjection>>(loading());

  constructor() {
    this.loadDirectory();
  }

  protected loadDirectory(): void {
    this.directory.set(loading());

    this.publicClient.searchDirectory().subscribe({
      next: (projection) => this.directory.set(toState(projection)),
      error: (error: unknown) => this.directory.set(errorToViewState<PublicProjection>(error)),
    });
  }
}
```

Cuatro propiedades que conviene notar:

1. **Se pide en el constructor**, no en `ngOnInit`. No hay resolver.
2. **El error nunca se maneja a mano**: va entero a `errorToViewState`.
3. **La recarga es la misma función** que la carga inicial, así que
   `(retry)="loadDirectory()"` funciona sin nada más.
4. **La señal es el único estado**. No hay `loading`, `error` y `data` por
   separado, que es de donde salen las combinaciones imposibles.

## De la respuesta al estado

```ts
function toState(projection: PublicProjection): ViewState<PublicProjection> {
  if (projection.records.length === 0) {
    return empty(
      { label: 'Ver el sistema de diseño', route: '/design-system' },
      'El directorio público todavía no tiene registros publicados.',
    );
  }

  return projection.refreshedAt === null
    ? ready(projection)
    : stale(projection, projection.refreshedAt);
}
```

### Vacío gana sobre atrasado

> *«Una proyección sin registros no tiene nada que mostrar, así que anunciar su
> antigüedad sería decirle a la persona cuán viejo es un dato que no está
> viendo.»*

### `refreshedAt === null` es `ready`, no `stale`

> *«la vista nunca se refrescó, así que no hay antigüedad que declarar y S7 exige
> una — inventar `new Date()` sería afirmar que se calculó recién.»*

Es la clase de decisión que el tipo obliga a tomar: `stale()` **exige** `asOf`.
No hay forma de construirlo sin decidir qué fecha poner.

## El organismo que pinta los estados

`ViewStateHost` renderiza los nueve estados **una sola vez para todo el
proyecto**. Cada sección envuelve su contenido y se olvida.

```html
<app-view-state-host [state]="directory()" (retry)="loadDirectory()" (refresh)="loadDirectory()">
  <div vsh-skeleton><app-skeleton variant="text" [lines]="4" /></div>
  @if (recordCount(); as total) {
    <p>{{ total }} registro(s) publicados.</p>
  }
</app-view-state-host>
```

### Las cuatro reglas que encarna

Escritas en su propio comentario, *«no las repitas afuera»*:

| Regla | Qué significa |
|---|---|
| **S1 ≠ S2** | Mientras la ruta autoriza, **no hay esqueleto de contenido** — un esqueleto insinúa que hay algo que ver antes de saber si se puede |
| **S6 ≠ S5** | El «no encontrado» es idéntico exista o no el recurso |
| **S7** | `asOf` **siempre visible**, nunca solo en un tooltip |
| **S9** | El `requestId` copiable: sin él no hay soporte posible |

### No reintenta solo

> *«El organismo no reintenta solo: emite `retry`/`refresh` y el dueño de los
> datos decide.»*

Un componente de presentación que dispara peticiones es un componente que no se
puede probar sin una API.

### Ranuras de sustitución

Una por estado, todas con valor por defecto:

```text
[vsh-auth-pending] [vsh-skeleton] [vsh-empty]   [vsh-validation] [vsh-forbidden]
[vsh-not-found]    [vsh-offline]  [vsh-error]   [vsh-stale]
```

El esqueleto por defecto son tres líneas de texto; el panel lo sustituye por
cuatro *«con la forma de la lista que va a ocupar su lugar»*.

### Por qué S7 no tiene su propio `@case`

```html
@default {
  @if (staleState(); as viejo) { <app-alert …>…</app-alert> }
  <ng-content />
}
```

> *«el slot por defecto solo puede existir UNA vez en toda la plantilla — con
> dos, Angular asigna el contenido a uno solo y el otro queda vacío.»*

`ready` y `stale` comparten rama porque los dos muestran el contenido proyectado.
Es una restricción del framework, no una elección.

### El estrechamiento se hace en TypeScript, no en la plantilla

```ts
protected readonly staleState = computed(() => {
  const state = this.state();
  return state.status === 'stale' ? state : null;
});
```

`dataOf`, `hasData` y `mapData` hacen lo mismo del lado de la pantalla:

```ts
protected readonly recordCount = computed<number | null>(() => {
  const data = dataOf(this.directory());
  return data === null ? null : data.records.length;
});
```

Con el motivo escrito: *«hacerlo arriba obligaría a un `$any()` que apaga la
comprobación de tipos justo donde importa».*

## Utilidades de `ViewState`

| Función | Para qué |
|---|---|
| `hasData(state)` | ¿Hay contenido? (`ready` o `stale`) |
| `dataOf(state)` | Los datos o `null` |
| `mapData(state, fn)` | Transforma los datos **conservando el estado**. Separa el DTO del tipo de la vista sin repetir el `switch` |
| `staleAgeMs(state)` | La antigüedad ya calculada, para que ninguna pantalla reste fechas |
| `canRequestSensitiveData(state)` | La regla S1 ≠ S2 como pregunta. `false` solo para S1 |
| `m34CodeOf(state)` | El código del modelo, o `null` para el camino feliz |

## Lo que no hay, y cuánto va a doler

| Ausente | Hoy | A 81 secciones |
|---|---|---|
| Caché entre pantallas | Nulo: solo el panel pide | **Alto** |
| Deduplicación de peticiones en vuelo | Nulo | Medio |
| Invalidación tras mutación | Nulo: no hay mutaciones que refresquen listas | **Alto** |
| Refetch en foco / reconexión | Nulo | Medio |
| Paginación acumulativa | Nulo | Medio |
| Actualización optimista | Nulo | Medio |

El único mecanismo de una-sola-petición-en-vuelo que sí existe es
`TokenRefreshService`, y existe **porque su ausencia rompía algo concreto**: tres
401 simultáneos gastaban tres de los 20 intentos por minuto de la API y rotaban
el token unos sobre otros.

Cuando el resto empiece a doler, la señal será la misma: algo concreto que se
rompe, no una preferencia de arquitectura. Ver
[caché](caching.md) e [invalidación](invalidation.md).
