# Caché y CDN

Una regla de caché, y está bien puesta. Ningún CDN.

---

## La regla que existe

```ts
// src/server.ts
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);
```

| Opción | Por qué |
|---|---|
| `maxAge: '1y'` | Correcto **porque `outputHashing: "all"`**: cada archivo lleva su hash, un despliegue produce nombres nuevos y no hay nada que invalidar |
| `index: false` | **Impide que Express sirva `index.html` por su cuenta** y se salte el motor de Angular |
| `redirect: false` | Sin redirecciones automáticas por barra final |

Las tres son decisiones, no valores por defecto. `index: false` es la que más
fácil se omite y la que rompería el SSR.

## Lo que se cachea y lo que no

| Recurso | Caché |
|---|---|
| `main-<hash>.js`, `chunk-<hash>.js`, `styles-<hash>.css` | **1 año**, inmutables |
| `favicon.ico` | 1 año — **sin hash**. Ver abajo |
| Tipografías (`@fontsource`, empaquetadas) | 1 año, con hash |
| **`index.html` y el HTML prerenderizado** | Lo sirve el motor de Angular, **no `express.static`** |
| Respuestas de la API | Sin cabeceras propias: las que devuelva la API |

### El favicon no lleva hash

`public/favicon.ico` se copia tal cual y recibe `maxAge: '1y'`. **Cambiarlo no se
verá durante un año** en los navegadores que ya lo tengan.

Es un detalle menor con solución trivial (renombrarlo al cambiarlo), pero conviene
saberlo. Brecha `LOW`.

### El HTML no debe cachearse largo

Lo sirve `angularApp.handle(req)`, no `express.static`, así que **no recibe el
`maxAge: '1y'`**. Correcto: un `index.html` cacheado un año seguiría apuntando a
chunks que ya no existen.

**No se fija ninguna cabecera explícita para el HTML.** Con un CDN delante, eso
importa: convendría `Cache-Control: no-cache` para el HTML y dejar el año solo
para los estáticos con hash.

Brecha `MEDIUM` cuando exista CDN.

## No hay CDN

| Elemento | Estado |
|---|---|
| CDN de estáticos | No configurado |
| CDN de terceros | **Ninguno, a propósito.** Las tipografías están autoalojadas |
| Purga | No aplica |
| Cabeceras en el borde | No aplica |

**Cero terceros** es una propiedad de privacidad y seguridad. Ver
[servicios externos](../integrations/external-services.md).

## Caché del navegador que la aplicación usa

| Qué | Dónde | Duración |
|---|---|---|
| Refresh token | `localStorage` | Hasta cerrar sesión o que falle el canje |
| Preferencia de tema | `localStorage` | Indefinida |
| **Datos de la API** | **No se cachean** | — |

Ver [caché de datos](../data-and-state/caching.md).

## Caché de desarrollo

| Qué | Dónde |
|---|---|
| Compilación de Angular | `.angular/cache`, y un volumen Docker |
| Instalación de Yarn | `.yarn/cache`, `.yarn/unplugged` |

El volumen de Docker existe para que *«sobreviva a los reinicios y no ensucie el
host»*.

## Si se agrega un CDN

Reglas mínimas:

| Recurso | Cabecera |
|---|---|
| `*-<hash>.js`, `*-<hash>.css` | `Cache-Control: public, max-age=31536000, immutable` |
| `index.html` y el HTML prerenderizado | `Cache-Control: no-cache` |
| `favicon.ico` | `max-age=86400`, o renombrarlo al cambiarlo |
| Respuestas de la API | **Nunca en el CDN.** Pueden llevar PHI |

**La última no es negociable.** Un CDN que cachee una respuesta de la API en una
aplicación de salud puede servir el dato de un paciente a otro. La API es un
origen distinto y no debe pasar por el borde de estáticos.

Y hay que verificar dos cosas antes de dar por bueno el CDN:

1. Que el **HTML prerenderizado de las cuatro rutas** se sirva actualizado.
2. Que el CDN **no comprima ni transforme** el JavaScript de forma que rompa los
   hashes de integridad, si algún día se añaden.

## Verificación

```bash
curl -I https://…/main-<hash>.js   # → Cache-Control: public, max-age=31536000
curl -I https://…/auth             # → sin max-age largo
```

## Estado

Lo que hay está bien y no requiere cambios. Lo que falta —cabeceras explícitas
para el HTML, política de CDN— depende del `BLOCKER` de
[despliegue](deployment.md).
