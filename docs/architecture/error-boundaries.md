# Manejo de errores y fronteras de fallo

Hay **tres** mecanismos de contención, y uno de ellos —el más importante para un
fallo de render— es más débil de lo que parece. Esta página dice cuál.

---

## Los tres niveles

| Nivel | Mecanismo | Qué contiene | Qué ve la persona |
|---|---|---|---|
| **1 · Error de red o de la API** | `errorToViewState` | Todo fallo HTTP | El estado del M34 que corresponda, dentro de la pantalla |
| **2 · Error de sesión** | `authInterceptor` | 401 y refresco fallido | Vuelve al login |
| **3 · Error de render o de lógica** | `provideBrowserGlobalErrorListeners()` | Excepciones no capturadas | **Nada.** Ver abajo |

## Nivel 1 — el que funciona bien

Todo fallo de la API entra por `errorToViewState` y sale como uno de los nueve
estados. La pantalla lo pinta con `ViewStateHost` y **no escribe una línea sobre
errores**.

```html
<app-view-state-host [state]="directory()" (retry)="loadDirectory()" (refresh)="loadDirectory()">
  <div vsh-skeleton><app-skeleton variant="text" [lines]="4" /></div>
  …contenido…
</app-view-state-host>
```

`ViewStateHost` es el organismo que traduce estado a interfaz: esqueleto para S2,
mensaje con acción para S3, aviso de antigüedad para S7, botón de reintentar para
S8, identificador de la petición para S9.

**Cada pantalla es su propia frontera de fallo para los errores de datos.** Que el
panel no pueda leer el directorio no afecta a la tarjeta de sesión que está al
lado: son dos `app-card` independientes y solo una está envuelta en el host.

## Nivel 2 — la sesión

```ts
function endSession(session: SessionStore, router: Router, error: unknown) {
  session.clear();
  void router.navigateByUrl(LOGIN_ROUTE);
  return throwError(() => error);
}
```

Se dispara en dos casos: 401 sin refresh token, y refresco fallido. **Propaga el
error original** además de navegar, para que quien llamó pueda reaccionar.

El reintento **no recursa**, a propósito: si la petición reintentada vuelve a dar
401, el error sube. Un interceptor que reintenta en bucle agota el límite de
peticiones y deja la interfaz colgada sin decir nada.

## Nivel 3 — lo que se rompe fuera de una petición

```ts
// app.config.ts
provideBrowserGlobalErrorListeners(),
{ provide: ErrorHandler, useClass: AppErrorHandler },
```

`provideBrowserGlobalErrorListeners` engancha `window.onerror` y
`window.onunhandledrejection`; `AppErrorHandler` decide qué hacer con lo que
llega. Cubre lo que ninguna petición puede cubrir:

| Situación | Qué pasa |
|---|---|
| Una excepción en el `constructor` de un componente | `AppErrorHandler` la registra y lleva a `/error` |
| Una excepción en un `computed` usado por la plantilla | Ídem |
| Un fragmento diferido que no baja (chunk 404 tras un despliegue) | Ídem, con el runbook de [chunks desactualizados](../operations/runbooks/chunks-desactualizados.md) |

### El código de soporte

`ErrorReporter` genera un `E-<commit>-<n>`: el commit del build y un contador de
la sesión. Es lo que la persona puede leer por teléfono y lo que conecta su
pantalla con el registro del servidor.

**Lo que deliberadamente NO registra**, y hay una prueba que lo fija:

- La pila de llamadas.
- Ningún identificador de la persona.
- Ningún contenido de formulario.

La prueba mete un valor con pinta de dato clínico y afirma que **no aparece** en
lo reportado. Un reporte de errores es exactamente el lugar por donde se escapa
PHI sin que nadie lo note.

### La pantalla

`features/error-recovery` muestra el código y ofrece recargar. No intenta
explicar qué pasó —no lo sabe— y no ofrece «reintentar», que en un fallo de
renderizado no significa nada.

## Nivel 4 — la red que no responde

Un servidor que **no contesta** no produce ningún error: produce una petición
colgada, un spinner eterno y una persona esperando.

`timeoutInterceptor` corta a los **30 segundos**, y a los **120** en las rutas de
subida (`/common/files/upload`), donde un documento clínico legítimamente tarda.

Dos decisiones:

- Traduce el `TimeoutError` a un `HttpErrorResponse` con `status: 0`, para que la
  interfaz lo pinte como **S8 (sin conexión)** y no como S9 genérico. Para quien
  espera, un timeout y una red caída son lo mismo, y S8 ofrece la acción correcta.
- Va **primero** en la cadena de interceptores, para que el límite cubra también
  el refresco de token que el interceptor de autenticación pueda disparar. Puesto
  después, una renovación colgada quedaba fuera del reloj.

## El estado S9 sí lleva identificador, y eso ayuda

Cuando el fallo **sí** viene de la API, la pantalla muestra el identificador de la
petición:

```ts
`${state.message ?? 'Ocurrió un error inesperado.'} (${state.requestId})`
```

Sale de `correlationId` del cuerpo, o de la cabecera `x-request-id`, o de
`'sin-id'`. Es lo único que conecta lo que la persona reporta con los registros
del servidor.

Un fallo de nivel 3 no tiene ese identificador, porque nunca hubo una petición.
Por eso `ErrorReporter` fabrica el suyo: `E-<commit>-<n>` cumple la misma función
—conectar el relato de la persona con el registro— sin depender de que haya
habido una petición.

## Degradación deliberada, que no es un error

Tres lugares fallan en silencio **a propósito**, y conviene no confundirlos con
descuidos:

| Dónde | Qué se traga | Por qué |
|---|---|---|
| `RefreshTokenStorage` (`read`/`write`/`clear`) | Excepciones de `localStorage` | Safari privado y cookies de terceros deshabilitadas hacen que `localStorage` **lance**, no que devuelva `null`. La sesión sigue funcionando durante la pestaña y se pierde al recargar. Peor es romper |
| `ThemeService.storage()` | Ídem | Sin persistencia el tema funciona por sesión |
| `AuthService.logout()` | El fallo de `POST /iam/auth/logout` | Si la petición falla, la persona igual quiso salir. Se limpia local **pase lo que pase**: dejarla adentro por un error de red sería lo peor de los dos mundos |
| `decodeAccessToken` | Formato inválido, base64 corrupta, JSON ilegible | Devuelve `null` en vez de lanzar. Un token ilegible es una sesión que no sirve, y eso lo resuelve quien llama cerrando sesión, no un `try/catch` en cada punto de uso |

Los cuatro están comentados en el código con su motivo.

## Un aviso que sí se emite

`TerminologyClient.readAllOptions` corta a las 20 páginas y **avisa en consola**:

```ts
console.warn(
  `[terminology] El conjunto ${valueSetId} tiene más de ${MAX_PAGES * BULK_PAGE_SIZE} ` +
  'opciones: se devuelven las recorridas hasta acá.',
);
```

Devuelve lo recorrido en vez de lanzar —una lista incompleta sigue siendo
utilizable— pero deja constancia, «porque una lista truncada en silencio es
indistinguible de una lista que de verdad terminó ahí».

Es el único `console.warn` de producción del proyecto, junto con el de
`AppButton` que avisa de un botón de ícono sin nombre accesible (y ese solo corre
en modo desarrollo).

## Lo que sigue faltando

Tres de las cuatro piezas del nivel 3 están:

| Pieza | Estado |
|---|---|
| Un `ErrorHandler` propio que registre el fallo con contexto | ✅ `AppErrorHandler` + `ErrorReporter` |
| Una pantalla de recuperación en vez del blanco | ✅ `features/error-recovery` |
| Manejo del fallo de carga de un fragmento diferido | ✅ mismo camino, con [su runbook](../operations/runbooks/chunks-desactualizados.md) |
| **Captura remota** | ❌ **falta** |

La que falta es la que decide cuánto valen las otras tres: hoy mejoran lo que la
persona ve, no lo que el equipo sabe. `ErrorReporter` deja el código de soporte
listo para enviarse, pero **no hay a dónde enviarlo** — y elegir destino es una
decisión de operación con implicaciones de privacidad, no un cambio de código.

Ver [reporte de errores](../observability/error-reporting.md) y
[el análisis de brechas](../reports/documentation-gap-analysis.md).
