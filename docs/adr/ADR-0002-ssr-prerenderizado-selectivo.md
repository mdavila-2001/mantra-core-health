# ADR-0002: SSR con prerenderizado selectivo según la sesión

## Estado

**Aceptado** — con evidencia documental abundante en el propio código.

## Contexto

La aplicación usa SSR (`outputMode: "server"`). Hay que decidir **qué rutas se
prerenderizan** en el build y cuáles se pintan en el cliente.

## Fuerzas y restricciones

La restricción que decide todo, escrita en `app.routes.server.ts`:

> *«La sesión vive en el navegador —refresh token en `localStorage`, access token
> en memoria— y el servidor no la ve: la API entrega el refresh token en el cuerpo
> del login, no como cookie, así que **no hay nada en la petición que le diga al
> servidor quién está entrando**.»*

Y dos más:

- Dos landings leen un token del **query string**, que en el build no existe.
- El login, el registro y la vitrina se ven **igual para todo el mundo**.

## Opciones consideradas

| Opción | Descartada porque |
|---|---|
| Prerenderizar todo | Produciría HTML de «no autenticado» para las pantallas con sesión |
| No prerenderizar nada | Desperdicia el SSR justo donde paga |
| SSR completo por petición | El servidor no tiene sesión que usar |

## Decisión

**Prerenderizar lo público y sin parámetros; cliente para todo lo demás.**

| Ruta | Modo |
|---|---|
| `/auth`, `/auth/registro`, `/auth/recuperar`, `/design-system` | **Prerender** |
| `/auth/verificar`, `/auth/nueva-clave` | Cliente — leen `?token=` |
| `/auth/organizacion` | Cliente — la lista sale del token |
| `**` (`/`, `/panel`) | Cliente — tienen sesión |

Con `provideClientHydration(withEventReplay())` y `withFetch()` obligatorio.

## Consecuencias positivas

- Las cuatro rutas más visitadas salen del servidor **ya pintadas**.
- `withEventReplay()` conserva los clics anteriores a la hidratación.
- Nunca se sirve HTML de «no autenticado» a alguien que sí lo está.
- El servidor **no habla con la API**, así que no hay estado que transferir ni
  credencial que gestionar del lado del servidor.

## Consecuencias negativas

- **Un cambio en cualquiera de las cuatro pantallas exige un build nuevo** para
  regenerar su HTML.
- Revertir exige revertir el artefacto entero.
- El área autenticada no aprovecha el SSR.
- Todo lo que toque el navegador debe ir en `afterNextRender` o tras
  `isPlatformBrowser`.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Desajuste de hidratación | Ids deterministas (`nextControlId`); guardas de plataforma |
| Despliegue parcial (JS nuevo, HTML viejo) | Regla: el artefacto se despliega entero |
| Cambio de layout tras hidratar | `Breakpoints` arranca en escritorio **a conciencia** |

## Evidencia

- `app.routes.server.ts` tiene 30 líneas de comentario explicando exactamente
  esta decisión.
- `yarn build` → `Prerendered 4 static routes.`
- `app.config.ts`: *«`withFetch` no es opcional bajo SSR: sin él el cliente usa
  XHR, que en el servidor obliga a un reemplazo y rompe la transferencia de
  estado.»*

## Plan de revisión

Revisar si la API pasa a entregar el refresh token como cookie `HttpOnly`: eso
haría visible la sesión para el servidor y **cambiaría la premisa de este ADR por
completo**.
