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

## Nivel 3 — el hueco

```ts
// app.config.ts
provideBrowserGlobalErrorListeners()
```

Eso es **todo**. Ese proveedor engancha `window.onerror` y
`window.onunhandledrejection` y los reenvía al `ErrorHandler` de Angular, cuyo
comportamiento por defecto es **escribir en la consola**.

Lo que eso implica, sin adornos:

| Situación | Qué pasa hoy |
|---|---|
| Una excepción en el `constructor` de un componente | La pantalla no se pinta. **Blanco** |
| Una excepción en un `computed` usado por la plantilla | Ídem |
| Un `null` inesperado en una plantilla | Ídem, o un fragmento sin pintar |
| Un fragmento diferido que no baja (chunk 404 tras un despliegue) | La navegación no completa. Sin aviso |
| Cualquiera de los anteriores | **Nadie se entera**: no hay captura remota de errores |

No hay:

- Ningún `ErrorHandler` propio.
- Ningún componente que envuelva al `router-outlet` para capturar fallos de la
  ruta hija.
- Ninguna pantalla de «algo salió mal» con opción de recargar.
- Ninguna telemetría que registre el fallo.

**Esta es la brecha `CRITICAL` de la arquitectura de errores.** Está registrada
en [el análisis de brechas](../reports/documentation-gap-analysis.md) y en
[reporte de errores](../observability/error-reporting.md), con la propuesta
correspondiente. No se implementa acá: es un cambio de producto.

## El estado S9 sí lleva identificador, y eso ayuda

Cuando el fallo **sí** viene de la API, la pantalla muestra el identificador de la
petición:

```ts
`${state.message ?? 'Ocurrió un error inesperado.'} (${state.requestId})`
```

Sale de `correlationId` del cuerpo, o de la cabecera `x-request-id`, o de
`'sin-id'`. Es lo único que conecta lo que la persona reporta con los registros
del servidor.

Un fallo de nivel 3 **no tiene ese identificador**, porque nunca hubo una
petición. Es otra razón por la que el hueco importa.

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

## Propuesta, no ejecutada

Para cerrar el nivel 3 harían falta cuatro cosas, en este orden de valor:

1. Un `ErrorHandler` propio que registre el fallo con contexto (ruta, versión,
   identificador de sesión) — hoy no hay dónde registrarlo.
2. Un componente frontera alrededor del `router-outlet` que muestre una pantalla
   de recuperación en vez del blanco.
3. Manejo explícito del fallo de carga de un fragmento diferido, que es el caso
   más probable en producción (despliegue nuevo, chunk viejo en caché).
4. Captura remota, sin la cual las tres anteriores solo mejoran lo que la persona
   ve, no lo que el equipo sabe.

Cada una es un cambio de producto con su propio riesgo, prueba y plan de
reversión. Ver [el análisis de brechas](../reports/documentation-gap-analysis.md).
