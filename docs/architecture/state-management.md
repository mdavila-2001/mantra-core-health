# Gestión de estado

Señales de Angular en servicios `providedIn: 'root'`. **No hay store externo, ni
capa de caché de estado remoto, ni resolvers.** Esta página describe lo que hay y
señala lo que eso implica.

---

## Los cuatro tipos de estado, y dónde vive cada uno

| Tipo | Dónde vive | Sobrevive a… |
|---|---|---|
| **De sesión** | `SessionStore` (señales, en memoria) | Cambios de ruta. **No** a la recarga — salvo el refresh token |
| **De aplicación** | `ThemeService`, `Breakpoints`, `ToastService`, `ShellService` | Cambios de ruta |
| **De servidor** | Una señal `ViewState<T>` dentro de cada pantalla | Nada. Se vuelve a pedir |
| **De URL** | El router (`?token=`) | Es la URL |
| **De formulario** | `FormGroup` del componente | Nada |

## El estado de sesión

```ts
@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly tokens = signal<SessionTokens | null>(null);
  private readonly selectedTenantId = signal<string | null>(null);

  readonly accessToken     = computed(() => emptyToNull(this.tokens()?.accessToken));
  readonly refreshToken    = computed(() => emptyToNull(this.tokens()?.refreshToken));
  readonly claims          = computed(() => decodeAccessToken(this.accessToken() ?? ''));
  readonly isAuthenticated = computed(() => this.claims() !== null);
  readonly userId          = computed(() => this.claims()?.sub ?? null);
  readonly roles           = computed(() => this.claims()?.roles ?? []);
  readonly tenants         = computed(() => this.claims()?.tenants ?? []);
  readonly displayName     = computed(() => this.claims()?.name ?? null);
  readonly activeTenantId  = computed(…);
  readonly needsTenantSelection = computed(…);
}
```

**Dos señales de escritura, diez derivadas.** Todo lo que la interfaz sabe del
usuario sale de decodificar el propio token: no hay `/me` en la API y no hace
falta, porque el token trae `sub`, `roles[]`, `tenants[]`, `name` y `tenantNames`.

### La separación store / servicio

| Clase | Responsabilidad |
|---|---|
| `SessionStore` | **Solo estado.** Sin persistencia, sin HTTP |
| `AuthService` | El caso de uso: hablar con la API y persistir lo justo |
| `TokenRefreshService` | Rotar el par de tokens con **una sola petición en vuelo** |
| `RefreshTokenStorage` | El acceso a `localStorage`, con degradación |

Que `SessionStore` no persista nada es lo que hace que **ninguna rama del código
toque `localStorage` en la ruta de SSR**.

### `activeTenantId` no adivina

```ts
readonly activeTenantId = computed<string | null>(() => {
  const chosen = this.selectedTenantId();
  if (chosen !== null) return chosen;
  const tenants = this.tenants();
  return tenants.length === 1 ? (tenants[0] ?? null) : null;
});
```

Con una organización se resuelve solo. Con varias y ninguna elegida devuelve
`null`, y entonces el interceptor **no manda `X-Tenant-Id`**. Elegir por la
persona podría mostrarle datos de la organización equivocada.

### `renew` no toca el tenant elegido

```ts
renew(tokens: SessionTokens): void {
  this.tokens.set(tokens);      // ← selectedTenantId queda intacto
}
```

La rotación del token es transparente; perder la elección sacaría a la persona de
la organización en la que estaba trabajando. `start()`, en cambio, sí la descarta:
es una sesión nueva.

## El estado de servidor: una señal por pantalla

No hay caché. El patrón, repetido en las siete pantallas que piden datos:

```ts
readonly state = signal<ViewState<T>>(ready(null));   // o loading()

cargar(): void {
  this.state.set(loading());
  this.cliente.operacion().subscribe({
    next: (datos) => this.state.set(ready(datos)),
    error: (error: unknown) => this.state.set(errorToViewState<T>(error)),
  });
}
```

Ese `errorToViewState` es lo que hace que **ninguna pantalla escriba una línea
sobre manejo de errores HTTP**: recibe el fallo y devuelve el estado del M34 que
corresponde.

### Consecuencias de no tener caché

Honestas, porque hoy no duelen y mañana sí:

| Consecuencia | Impacto hoy | Impacto a 81 secciones |
|---|---|---|
| Dos pantallas que pidan lo mismo lo piden dos veces | Nulo: solo el panel pide | Alto |
| No hay deduplicación de peticiones en vuelo | Nulo | Medio |
| No hay invalidación tras una mutación | Nulo: no hay mutaciones que refresquen listas | Alto |
| Volver a una pantalla la recarga entera | Aceptable | Medio |
| No hay estado optimista | Nulo | Medio |

El único mecanismo de una-sola-petición-en-vuelo que sí existe es
`TokenRefreshService`, y existe porque su ausencia rompía algo concreto: tres
401 simultáneos gastaban tres de los 20 intentos por minuto que admite la API y
rotaban el token unos sobre otros.

## Los cuatro servicios de estado de aplicación

| Servicio | Estado | Persiste | Nota |
|---|---|---|---|
| `ThemeService` | Preferencia + preferencia del sistema | `localStorage` | `system` se guarda como **ausencia** de la clave |
| `Breakpoints` | Si la ventana está bajo 780 px | No | Arranca en escritorio bajo SSR |
| `ToastService` | Cola de avisos | No | |
| `ShellService` | Si el panel lateral está abierto | No | |

## Reactividad: `computed` sobre `effect`

El proyecto usa `effect` en **un solo lugar**:

```ts
// theme.service.ts
effect(() => this.applyPreference(this.preference()));
```

Y es el uso correcto: escribir en `document.documentElement`, que es un efecto de
verdad —salir del sistema de señales hacia el DOM—. Todo lo demás es `computed`.

## Los nueve estados del M34

`ViewState<T>` es una unión discriminada por `status`, para que `@switch` estreche
el tipo sin conversiones en la plantilla:

| Código | `status` | Qué significa | Campo obligatorio |
|---|---|---|---|
| S1 | `route-auth-pending` | La ruta resuelve permiso. **No se piden datos todavía** | — |
| S2 | `loading` | Autorización resuelta, datos en camino | — |
| S3 | `empty` | Sin resultados | **`nextAction`** |
| — | `ready` | Camino feliz | `data` |
| S4 | `validation` | Validación, conflicto o límite de peticiones | `issues` |
| S5 | `forbidden` | Prohibido sobre un recurso que sí se puede saber que existe | — |
| S6 | `not-found` | No encontrado, **sin filtrar existencia** | — |
| S7 | `stale` | Datos posiblemente atrasados | **`asOf`** |
| S8 | `offline` | La petición no llegó | — |
| S9 | `error` | Fallo inesperado | **`requestId`** |

### Las tres distinciones que el tipo hace cumplir

Los campos obligatorios no son decorativos: **hacen que el olvido no compile**.

1. **S3 exige `nextAction`.** El modelo llama al estado «Empty *with next
   action*»: un vacío sin salida es un callejón.
2. **S7 exige `asOf`.** Hay 14 proyecciones materializadas en el modelo y el
   contrato obliga a exponer la antigüedad. Un tipo que permitiera omitirla
   dejaría pasar el olvido.
3. **S9 exige `requestId`.** Es lo único que conecta el reporte de la persona con
   los registros del servidor. Si la respuesta no lo trae, quien traduzca el error
   debe generarlo (`'sin-id'`).

Y **S6 no transporta ningún dato del recurso**, a propósito: cualquier detalle
—su nombre, su dueño, por qué no aparece— confirmaría que existe. Un «no tenés
permiso» sobre un identificador es una filtración.

## Lo que no hay

| Ausente | Nota |
|---|---|
| NgRx / Akita / Elf / NGXS | No hay ninguno, y a esta escala no hace falta |
| TanStack Query o equivalente | La ausencia más costosa a futuro |
| `linkedSignal` / `resource()` | Las API nuevas de Angular 21 no se usan |
| Persistencia de estado de interfaz (filtros, orden, página) | No existe |
| Deshacer / rehacer | No existe |
| Sincronización entre pestañas | No existe: dos pestañas tienen sesiones independientes en memoria |
