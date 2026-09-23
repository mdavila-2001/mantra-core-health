# Política de seguridad de contenido (CSP)

**Implementada.** `src/server.ts` emite las seis cabeceras en todas las
respuestas, y la política se arma en `src/server/security-headers.ts`.

---

## Estado

| Cabecera | Estado |
|---|---|
| `Content-Security-Policy` | ✅ con hashes de los scripts en línea |
| `X-Content-Type-Options` | ✅ `nosniff` |
| `Referrer-Policy` | ✅ `strict-origin-when-cross-origin` |
| `X-Frame-Options` | ✅ `DENY`, más `frame-ancestors 'none'` en la CSP |
| `Permissions-Policy` | ✅ `camera=(), microphone=(self), geolocation=(self)` — «dónde comprar mi receta» pide la posición, y el dictado de síntomas y la nota de voz piden el micrófono, siempre con permiso del navegador |
| `Strict-Transport-Security` | ✅ `max-age=63072000; includeSubDomains` |

```bash
curl -I https://<dominio>/auth | grep -i "content-security-policy"
```

## Cómo se resolvió el problema de los scripts en línea

El obstáculo real no era escribir la política: era que **cuatro rutas se
prerenderizan**, y su HTML se genera cuando todavía no existe ninguna petición
que numerar. Un nonce por petición las dejaría con un valor muerto.

Y no basta con el script del tema: una página prerenderizada trae **cuatro**
scripts en línea —el del tema más los tres que Angular emite para la
hidratación, incluido el `__nghData__` con el estado del render—, y los tres
últimos son distintos en cada ruta.

**La solución es recolectar los hashes del artefacto ya construido, al
arrancar**, recorriendo todo el HTML de `dist/…/browser`:

```ts
const headers = securityHeaders({
  apiBaseUrl: process.env['PUBLIC_API_BASE_URL'] ?? '',
  inlineScriptHashes: collectInlineScriptHashes(browserDistFolder),
});
```

Se hace **una vez por proceso**: hacerlo por petición costaría leer y parsear
HTML en cada respuesta para un valor que no cambia mientras el proceso viva.

### Verificado empíricamente

Sobre el artefacto real, ruta por ruta: las 4 prerenderizadas (4 scripts en
línea cada una), las de cliente (1) y una inexistente (0). **Todos los scripts
servidos están autorizados por la política que los acompaña.**

Si alguno no lo estuviera, el navegador lo bloquearía sin avisar y el síntoma
—tema que parpadea, o aplicación que no arranca— aparecería solo en producción.

## Por qué importa acá

El refresh token vive en `localStorage`. **Un XSS lo lee.** El vector es estrecho
—cero `innerHTML`, cero scripts de terceros, 10 dependencias, todas de Angular—
pero una CSP es la segunda línea que hoy no existe.

Y sin `frame-ancestors`, la aplicación **se puede meter en un iframe**. En un
sistema de salud, un iframe superpuesto puede inducir a confirmar una acción
clínica que la persona cree estar haciendo en otro sitio.

## Lo que la aplicación necesita permitir

Inventariado del código, no supuesto:

| Recurso | Origen | Nota |
|---|---|---|
| Scripts | **Propio solamente** | Cero terceros |
| Script en línea | `src/index.html` | El anti-parpadeo del tema. **Necesita `'nonce-…'` o un hash** |
| Estilos | Propios | `styles.css` + los de componente |
| Estilos en línea | Angular los genera | **Necesita `'unsafe-inline'` o nonce** |
| Tipografías | **Propias** (`@fontsource*`) | Autoalojadas: **no hace falta abrir ningún CDN** |
| Imágenes | Propias + `data:` + `tile.openstreetmap.org` | Los SVG son en línea; los tiles del mapa (Leaflet sin clave de API) van directo del navegador |
| Conexiones | La API | `'self'`, o el dominio de la API si va en otro |
| Marcos | **Ninguno** | |
| Objetos | **Ninguno** | |

**Que las tipografías estén autoalojadas simplifica mucho la política**: no hay
que abrir `fonts.googleapis.com` ni `fonts.gstatic.com`.

## La política, tal como se emite

```
default-src 'self';
script-src 'self' 'sha256-…' (uno por script en línea del artefacto);
style-src 'self' 'unsafe-inline';
font-src 'self';
img-src 'self' data: https://tile.openstreetmap.org;
connect-src 'self' (+ el origen de la API si vive en otro dominio);
frame-ancestors 'none';
object-src 'none';
base-uri 'self';
form-action 'self';
upgrade-insecure-requests
```

### Las dos concesiones, y por qué

**`'unsafe-inline'` en `style-src`.** Angular emite los estilos de componente en
línea; sin esto la aplicación se ve sin estilos. Es un riesgo mucho menor que en
`script-src` —que la política **no** concede— y es lo habitual en Angular.

**Y una tercera, solo de imágenes: los tiles de OpenStreetMap.** El mapa
(Leaflet, sin clave de API) los pide directo del navegador; sin ese origen el
mapa queda gris. Es `img-src` y nada más: ni scripts, ni conexiones, ni
tipografías salen a terceros — las tipografías están autoalojadas, así que
`font-src 'self'` alcanza.

### `connect-src` sigue a la configuración

```ts
connect-src 'self'                              // PUBLIC_API_BASE_URL vacío
connect-src 'self' https://api.ejemplo.com      // API en otro dominio
```

Sale de la **misma variable** que compila el paquete, así que las dos mitades no
se pueden separar. Es otro argumento para la opción de mismo dominio: con ella,
la política no cambia nunca.

## Qué verificar tras un despliegue

```bash
curl -I https://<dominio>/auth | grep -iE "content-security-policy|x-frame|referrer|strict-transport"
```

Y en el navegador, con la consola abierta:

- [ ] Las cuatro rutas prerenderizadas cargan **sin errores de CSP**
- [ ] El tema **no parpadea**: el script en línea sigue ejecutándose
- [ ] Las tipografías cargan
- [ ] El login funciona: `connect-src` permite la API
- [ ] La aplicación **no** se puede meter en un iframe

## Lo que queda

| Qué | Estado |
|---|---|
| Cabeceras y CSP | ✅ implementadas y con prueba |
| Verificación empírica sobre el artefacto | ✅ hecha |
| **Probarla en un entorno desplegado** | ⏳ **depende de que exista el despliegue** |
| Modo `Report-Only` como paso previo | No hace falta: la política se verificó contra el artefacto real |

La única tarea pendiente es de **configuración**, no de código: comprobar las
cabeceras en el entorno real la primera vez que se despliegue.
