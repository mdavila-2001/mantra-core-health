# Política de seguridad de contenido (CSP)

**No existe ninguna.** Es la brecha de seguridad más clara del proyecto, y
también la más fácil de cerrar.

---

## Estado

```bash
grep -rn "Content-Security-Policy\|setHeader\|helmet" src/server.ts src/index.html
```

Sin resultados. `src/server.ts` sirve estáticos y delega en Angular; **no fija
ninguna cabecera**.

| Cabecera | Estado |
|---|---|
| `Content-Security-Policy` | **No existe** |
| `X-Content-Type-Options` | **No existe** |
| `Referrer-Policy` | **No existe** |
| `X-Frame-Options` | **No existe** |
| `Permissions-Policy` | **No existe** |
| `Strict-Transport-Security` | **No existe** |

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
| Imágenes | Propias (favicon) + `data:` | Los SVG son en línea |
| Conexiones | La API | `'self'`, o el dominio de la API si va en otro |
| Marcos | **Ninguno** | |
| Objetos | **Ninguno** | |

**Que las tipografías estén autoalojadas simplifica mucho la política**: no hay
que abrir `fonts.googleapis.com` ni `fonts.gstatic.com`.

## Propuesta

Para un despliegue de **mismo origen**:

```
default-src 'self';
script-src 'self' 'nonce-{RANDOM}';
style-src 'self' 'unsafe-inline';
font-src 'self';
img-src 'self' data:;
connect-src 'self';
frame-ancestors 'none';
object-src 'none';
base-uri 'self';
form-action 'self';
upgrade-insecure-requests;
```

Con la API en **otro dominio**, cambia una línea:

```
connect-src 'self' https://api.ejemplo.com;
```

Y con el resto de las cabeceras:

```ts
// src/server.ts — PROPUESTA, no implementada
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  next();
});
```

## Las tres dificultades reales

Esto **no es pegar una cabecera**, y conviene saberlo antes de empezar.

### 1 · El script en línea del `<head>`

```html
<script>
  var preferencia = localStorage.getItem('mantra-core-health.theme');
  …
</script>
```

Es **imprescindible**: evita el parpadeo del tema bajo SSR. Y una CSP estricta lo
bloquea.

Tres salidas:

| Opción | Consecuencia |
|---|---|
| `nonce` por petición | La correcta. Exige que el servidor genere el nonce y lo inyecte — Angular soporta `ngCspNonce` |
| Hash del contenido | Funciona, pero **hay que regenerarlo cada vez que el script cambie** |
| `'unsafe-inline'` en `script-src` | Anula la mitad del beneficio de la CSP |

**Y las cuatro rutas prerenderizadas complican la primera opción**: su HTML se
genera en el build, cuando todavía no hay petición que numerar. Es exactamente el
tipo de detalle que hace fallar un despliegue.

### 2 · Los estilos en línea de Angular

Angular emite estilos en línea para los componentes. `style-src 'self'` a secas
los bloquea, así que hace falta `'unsafe-inline'` o un nonce para estilos.

`'unsafe-inline'` en `style-src` es un riesgo mucho menor que en `script-src`, y
es lo habitual.

### 3 · No hay dónde probarlo

**No existe un despliegue.** Una CSP mal puesta rompe la aplicación entera de
forma silenciosa —el navegador bloquea recursos sin avisar al usuario—, así que
hace falta un entorno donde probarla antes.

**Mitigación para el primer intento:** empezar con
`Content-Security-Policy-Report-Only`, que informa sin bloquear.

## Plan sugerido

1. **Añadir las cuatro cabeceras que no necesitan negociación**
   (`nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS). Riesgo casi nulo.
2. **Añadir `frame-ancestors 'none'`** vía CSP, o `X-Frame-Options: DENY`.
   Cierra el clickjacking sin tocar nada más.
3. **Añadir la CSP completa en `Report-Only`** y observar qué reporta.
4. **Resolver el script en línea** con `ngCspNonce`, comprobando las cuatro
   rutas prerenderizadas.
5. **Pasar a modo bloqueante.**

Los pasos 1 y 2 se pueden hacer hoy y cierran dos riesgos residuales del
[modelo de amenazas](threat-model.md) (I8 e I9).

## Qué verificar después

```bash
curl -I https://…/auth | grep -i "content-security\|x-frame\|referrer\|strict-transport"
```

Y en el navegador, con la consola abierta:

- Las cuatro rutas prerenderizadas cargan **sin errores de CSP**.
- El tema **no parpadea**: el script en línea sigue ejecutándose.
- Las tipografías cargan.
- El login funciona: `connect-src` permite la API.
- La aplicación **no** se puede meter en un iframe.

## Estado

**`HIGH`**, no bloqueante para el desarrollo, **sí para producción**. Registrado
en [el análisis de brechas](../reports/documentation-gap-analysis.md) y en
[el informe de preparación productiva](../reports/production-readiness.md).

Depende del `BLOCKER` de [despliegue](../operations/deployment.md): sin un
entorno donde probar, ponerla es arriesgado.
