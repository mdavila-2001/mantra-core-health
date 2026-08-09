# Estrategia de renderizado

Angular 21 con SSR y prerenderizado selectivo. La decisión de qué se prerenderiza
no es de rendimiento: es de **corrección**.

---

## La regla que gobierna todo

> **El servidor no ve la sesión.**

El refresh token vive en `localStorage` y el access token en memoria del
navegador. La API entrega el refresh token **en el cuerpo del login, no como
cookie**, así que no hay nada en la petición HTTP que le diga al servidor quién
está entrando.

Consecuencia directa: prerenderizar una pantalla con sesión produciría HTML de
«no autenticado» —el armazón sin usuario, el panel sin datos— que al hidratar se
reemplazaría por el real. Eso es un parpadeo en el mejor caso, y en el peor un
`<main>` vacío servido como si fuera el contenido de la aplicación.

## El reparto

`src/app/app.routes.server.ts`:

| Ruta | Modo | Motivo |
|---|---|---|
| `/auth` | **Prerender** | Se ve igual para todo el mundo |
| `/auth/registro` | **Prerender** | Ídem |
| `/auth/recuperar` | **Prerender** | Ídem |
| `/design-system` | **Prerender** | La vitrina no depende de nada |
| `/auth/verificar` | Cliente | Lee `?token=` del query string, que en el build no existe |
| `/auth/nueva-clave` | Cliente | Ídem |
| `/auth/organizacion` | Cliente | La lista de organizaciones sale del token de sesión |
| `**` (todo lo demás: `/`, `/panel`) | Cliente | Tiene sesión |

El build lo confirma:

```text
Prerendered 4 static routes.
```

### Por qué las landings con token van en cliente

Prerenderizadas mostrarían el estado «falta el código»:

```ts
// verify-email.ts
const token = this.route.snapshot.queryParamMap.get('token');
if (token === null || token.trim() === '') {
  this.estado.set('sin-token');   // ← esto es lo que se congelaría en el HTML
  return;
}
```

En el build no hay query string. El HTML generado diría que el enlace del correo
llegó incompleto, para todo el mundo.

## Hidratación

```ts
provideClientHydration(withEventReplay())
```

`withEventReplay()` graba los eventos que ocurren **antes** de que la aplicación
hidrate y los reproduce después. En una pantalla prerenderizada eso importa: el
login se ve al instante, y si alguien escribe y pulsa «Entrar» antes de que
JavaScript esté listo, el clic no se pierde.

### Lo que no se puede tocar sin romper la hidratación

| Regla | Por qué | Dónde está |
|---|---|---|
| Nada de `localStorage` en la ruta de render | En el servidor no existe y lanza | `RefreshTokenStorage.storage()`, `ThemeService.storage()` |
| Nada de `window`/`matchMedia` en el constructor | Ídem | `Breakpoints` usa `afterNextRender` |
| `withFetch()` obligatorio | Sin él el cliente usa XHR, que en el servidor obliga a un reemplazo y rompe la transferencia de estado | `app.config.ts` |
| El árbol del servidor y el del cliente deben coincidir | Un elemento de más o de menos rompe la hidratación | Ver el caso del botón de menú, abajo |

### El caso del botón de menú

`Breakpoints` arranca en `false` (escritorio) y se corrige tras el primer
render:

```ts
constructor() {
  afterNextRender(() => this.observe(), { injector: this.injector });
}
```

Arrancar en `true` sería peor: el HTML del servidor traería el botón de
hamburguesa y **desaparecería al hidratar** en cualquier pantalla grande. Es un
cambio de árbol, no de estilo, y por eso el CSS no puede resolverlo solo.

## El tema, y por qué no parpadea

Tres piezas que se sostienen entre sí:

```text
index.html      script en línea en el <head>, antes del primer paint.
                Lee localStorage y estampa data-theme si hay preferencia manual.

styles.css      @media (prefers-color-scheme: dark) { :root:not([data-theme='light']) }
                → la preferencia del sistema se resuelve SIN JavaScript

theme.service   escribe data-theme cuando la persona elige; borra el atributo
                cuando vuelve a 'system'
```

La clave `'mantra-core-health.theme'` está literalmente duplicada entre
`index.html` y `THEME_STORAGE_KEY`, y ambos archivos lo declaran como espejo. La
preferencia `system` **no escribe atributo** a propósito: por eso nunca parpadea.

## Cache de estáticos

`src/server.ts`:

```ts
express.static(browserDistFolder, { maxAge: '1y', index: false, redirect: false })
```

Un año es correcto **porque `angular.json` usa `outputHashing: "all"`** en
producción: cada archivo lleva su hash en el nombre, así que un despliegue nuevo
produce nombres nuevos y no hay nada que invalidar.

`index: false` impide que Express sirva `index.html` por su cuenta y se salte el
motor de Angular.

## Carga diferida

Dos fragmentos, y solo dos:

| Fragmento | Tamaño | Por qué está diferido |
|---|---:|---|
| `design-system-sample` | 181,73 kB | La vitrina expone el sistema entero. Con import directo se llevaba el presupuesto inicial por delante |
| `toast-dev-panel` | 2,98 kB | Herramienta de desarrollo |

**Las seis pantallas de autenticación y el panel son import directo**, no
diferido. A esta escala es defendible; a 81 secciones no lo será. Analizado en
[presupuestos](../performance/budgets.md#la-oportunidad-más-clara).

## Lo que esta estrategia no hace

| Técnica | Estado |
|---|---|
| ISR (regeneración incremental) | No se usa |
| Streaming SSR | No se usa |
| `@defer` en plantillas | No se usa en ninguna |
| Transferencia de estado servidor → cliente | No aplica: el servidor no pide datos |
| Service worker | No existe |

La ausencia de transferencia de estado es coherente: como el servidor no ve la
sesión, no pide nada a la API, así que no hay estado que transferir.
