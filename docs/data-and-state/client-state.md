# Estado de cliente

Señales en servicios `providedIn: 'root'`. Seis servicios con estado, y ninguno
usa un store externo.

---

## Los seis

| Servicio | Estado | Persiste | Prueba |
|---|---|---|---|
| `SessionStore` | Tokens y organización elegida | **No** | Sí |
| `ThemeService` | Preferencia de tema | `localStorage` | Sí |
| `Breakpoints` | Si la ventana está bajo 780 px | No | Sí |
| `ToastService` | Cola de avisos | No | Sí |
| `ShellService` | Si el panel lateral está abierto | No | **No** |
| `TokenRefreshService` | El refresco en vuelo | No | **No** |

## `SessionStore` — el más importante

```ts
private readonly tokens = signal<SessionTokens | null>(null);
private readonly selectedTenantId = signal<string | null>(null);
```

**Dos señales de escritura, diez derivadas.** Todo lo que la interfaz sabe del
usuario sale de decodificar el token: no hay `/me` en la API y no hace falta.

| Derivada | De dónde |
|---|---|
| `accessToken`, `refreshToken` | `tokens()`, normalizando `''` a `null` |
| `claims` | `decodeAccessToken(accessToken())` |
| `isAuthenticated` | `claims() !== null` |
| `userId`, `roles`, `tenants`, `displayName` | Claims del token |
| `activeTenantId` | La elección, o la única organización |
| `needsTenantSelection` | Varias organizaciones y ninguna elegida |

### `''` se normaliza a `null`

```ts
readonly refreshToken = computed(() => emptyToNull(this.tokens()?.refreshToken));
```

> *«Un texto vacío es lo mismo que no tener token: se normaliza acá para que
> quien lo consulte compare contra `null` y nada más. Dejar pasar `''` haría que
> el interceptor intentara refrescar con una credencial que no existe.»*

### Los tres métodos de escritura, y en qué se diferencian

| Método | Tokens | Organización elegida |
|---|---|---|
| `start()` | Los fija | **La descarta** — es una sesión nueva |
| `renew()` | Los reemplaza | **No la toca** — la rotación es transparente |
| `clear()` | `null` | `null` |

> *«perder su elección la sacaría de la organización en la que estaba
> trabajando.»*

### `selectTenant` valida

```ts
selectTenant(tenantId: string): void {
  if (this.tenants().includes(tenantId)) {
    this.selectedTenantId.set(tenantId);
  }
}
```

Un identificador ajeno se ignora en silencio. La autoridad sigue siendo la API:
un `X-Tenant-Id` que no corresponda sería rechazado del otro lado igual.

### La separación store / servicio

| Clase | Responsabilidad |
|---|---|
| `SessionStore` | **Solo estado.** Sin persistencia, sin HTTP |
| `AuthService` | El caso de uso: hablar con la API y persistir lo justo |
| `TokenRefreshService` | Un solo refresco en vuelo |
| `RefreshTokenStorage` | `localStorage`, con degradación |

Que el store no persista nada es lo que garantiza que **ninguna rama del código
toque `localStorage` en la ruta de SSR**.

## `ThemeService`

Tres responsabilidades y ninguna más: leer la preferencia, resolverla contra el
sistema, estamparla en `document.documentElement`. Ver
[temas](../design-system/themes.md).

Es **el único lugar del proyecto con un `effect`**:

```ts
effect(() => this.applyPreference(this.preference()));
```

Y es el uso correcto: escribir en el DOM es salir del sistema de señales, que es
exactamente para lo que `effect` existe. Todo lo demás es `computed`.

## `Breakpoints`

Una señal booleana y un oyente de `matchMedia`, montado en `afterNextRender`
porque el servidor no tiene ventana. Ver
[diseño adaptable](../design-system/responsive-design.md).

## `ToastService` y `ShellService`

`ToastService` es la cola de avisos; `ShellService` resuelve los cuatro modos del
panel de navegación (`expanded`, `collapsed`, `drawer-open`, `drawer-closed`).

**`ShellService` no tiene prueba propia**, aunque `shell.spec.ts` cubre el
componente que lo usa.

## Estado local de componente

Todo lo que no es compartido vive en el propio componente:

```ts
readonly state    = signal<ViewState<null>>(ready(null));   // envío
readonly tipo     = signal<TipoCuenta>('paciente');         // registro
readonly estado   = signal<Estado>('verificando');          // verificar correo
readonly done     = signal(false);                          // nueva contraseña
readonly registered = signal(false);                        // registro
readonly revokedSessions = signal(0);                       // nueva contraseña
```

**Nada de esto sobrevive a un cambio de ruta**, y está bien: son estados de una
interacción, no del sistema.

## Reglas

1. **`computed` por defecto, `effect` casi nunca.** Un `effect` que escribe otra
   señal es un ciclo esperando a pasar.
2. **Las señales de escritura, privadas.** `SessionStore` expone `tokens` como
   `private` y solo publica derivadas y métodos.
3. **`asReadonly()` cuando se expone una señal directamente**, como hace
   `ThemeService.currentTheme` y `Breakpoints.isNavDrawer`.
4. **Nada de `localStorage` en el constructor de un servicio** sin comprobar la
   plataforma: el servidor no lo tiene y `localStorage` **lanza** cuando está
   bloqueado.
5. **Los servicios de estado no llaman a la API.** `SessionStore` no conoce
   `HttpClient`; `AuthService` sí.

## Lo que no hay

| Elemento | Estado |
|---|---|
| Store externo (NgRx, Akita, Elf, NGXS) | No |
| Devtools de estado | No. Depurar es leer señales en la consola |
| Viaje en el tiempo / deshacer | No |
| Sincronización entre pestañas | **No.** Dos pestañas tienen sesiones independientes en memoria: cerrar sesión en una no cierra la otra hasta que su token venza |
| Persistencia de estado de interfaz (filtros, orden, página) | No |
| `linkedSignal` / `resource()` de Angular 21 | No se usan |

La falta de sincronización entre pestañas es la más visible en uso real:
**cerrar sesión en una pestaña deja la otra funcionando** hasta que su access
token expire y el refresco falle. Registrado como brecha `MEDIUM` en
[seguridad de sesión](../security/session-and-tokens.md).
