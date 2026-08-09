# Seguridad frontend

**El principio rector está escrito en el código del proyecto:**

> *«Esconder un ítem no protege nada —la autoridad es la API, que valida en cada
> petición—; es no ofrecer una puerta que va a estar cerrada.»*
> — `features/shell-layout/shell-layout.ts`

Nada de lo que hace el frontend es un control de seguridad. Lo que hace es no
ofrecer lo que no corresponde y no exponer lo que no hace falta.

---

## Resumen del estado

| Área | Estado |
|---|---|
| XSS | **Fuerte.** Cero `innerHTML`, cero `bypassSecurityTrust*` |
| Scripts de terceros | **Cero** |
| Dependencias en ejecución | **Diez, todas de Angular** |
| Enlaces externos | **Fuerte.** `noopener noreferrer` automático, con prueba |
| Almacenamiento | Solo el refresh token y el tema |
| Secretos en el paquete | **Imposibles por construcción.** Ver §Variables |
| **CSP** | **No existe** |
| **Cabeceras de seguridad** | **No existe ninguna** |
| Autorización en la interfaz | No existe, y está bien dicho |
| Mapas de fuente en producción | No se generan |

Las dos filas en negrita del medio son las brechas principales.

## XSS

### Angular escapa por defecto, y el proyecto no lo desactiva

```bash
grep -rn "innerHTML\|bypassSecurityTrust\|DomSanitizer\|eval(" src/
```

**Un solo resultado, y es un comentario que explica por qué no se usa:**

```html
<!-- input.html
     Van proyectados y NO por [innerHTML]: el sanitizador de Angular descarta … -->
```

No hay ningún `[innerHTML]`, ningún `bypassSecurityTrustHtml`, ningún `eval`.
Toda interpolación pasa por el escapado de Angular.

### Cero superficie de terceros

```bash
grep -n "<script" src/index.html
```

Un solo `<script>`: el anti-parpadeo del tema, **propio y en línea**, que además
valida lo que lee de `localStorage`:

```js
if (preferencia === 'light' || preferencia === 'dark') {
  document.documentElement.dataset.theme = preferencia;
}
```

Un `localStorage` manipulado no puede estampar nada distinto de esas dos cadenas.

### El riesgo residual

**El refresh token vive en `localStorage`**, así que cualquier script que llegara
a ejecutarse en el origen podría leerlo. La defensa actual es que no hay por
dónde inyectar uno; la defensa que falta es una CSP. Ver
[CSP](content-security-policy.md).

## Enlaces externos

`app-link` detecta el destino **por el `href`** y aplica la protección sin que
nadie lo pida:

```ts
host: {
  '[attr.target]': 'isExternal() ? "_blank" : null',
  '[attr.rel]':    'isExternal() ? "noopener noreferrer" : null',
}
```

> *«la pestaña nueva no puede quedarse con una referencia a la sesión clínica.»*

Tres detalles bien resueltos:

1. **La detección corre en el constructor**, no solo tras hidratar:
   > *«Un `href` estático ya está en el elemento cuando se construye la
   > directiva: leerlo acá hace que el HTML del servidor SALGA con
   > `target`/`rel`. Es lo que evita la ventana en la que un enlace externo se
   > puede clickear todavía sin `noopener`.»*
2. **Solo `http:` y `https:` cuentan como navegables.** `mailto:` y `tel:` no son
   «externos» y no llevan `target="_blank"`.
3. **Hay tres pruebas** que fijan el `rel`, incluida una que lo dice con todas las
   letras: *«la pestaña nueva no hereda la sesión»*.

`afterEveryRender` relee el `href` para cubrir un `[href]` que cambie.

## Variables públicas y privadas

**Ningún secreto puede llegar al paquete, y no por disciplina: por construcción.**

`scripts/generate-env.mjs` es el único puente entre el entorno y el código del
navegador, y es deliberadamente angosto:

| Defensa | Qué impide |
|---|---|
| **Lista blanca (`MANIFEST`)** | El resto del `.env` **no se lee**. Nada puede colarse por descuido |
| `assertPublicName` | Claves con nombre de secreto: `SECRET`, `PASSWORD`, `PRIVATE`, `CREDENTIAL`, `TOKEN`, `APIKEY`, `API_KEY`, `*_KEY`, `SIGNATURE`, `SALT`, `SESSION`, `COOKIE` |
| `assertPublicValue` | Valores con forma de JWT (`eyJ….….`) o de clave PEM (`-----BEGIN`) |
| `validateApiBaseUrl` | URLs con `usuario:contraseña@`, query o fragmento |
| `.gitignore` | La salida generada no se versiona |

El fallo es **al compilar**, no en producción. Es la diferencia entre un error y
una filtración.

Y el mensaje de error explica el porqué en vez de solo negarse:

> *«El nombre indica un secreto, y todo lo que pasa por acá se empaqueta en el
> JavaScript que descarga el navegador: sería público para cualquiera. Un
> frontend no puede guardar secretos. Ese valor va del lado de la API.»*

`environment.types.ts` lo repite donde alguien va a leerlo:

> *«Agregar acá una clave de API, una contraseña o un token no es una filtración
> potencial: es publicarlo.»*

## Mapas de fuente

```json
"development": { "sourceMap": true }
"production":  // no lo declara → false
```

**No se generan en producción**, que es lo correcto: publicarlos expone el código
original y los comentarios.

Si alguien los genera para analizar el bundle
([análisis del paquete](../performance/bundle-analysis.md)), **ese artefacto no
se despliega**.

## Lo que NO hay

### Sin CSP

Ninguna cabecera `Content-Security-Policy`, ni en `src/server.ts` ni en un meta
del `index.html`. Es la mitigación que falta contra el riesgo residual de XSS.
Ver [CSP](content-security-policy.md).

### Sin cabeceras de seguridad

`src/server.ts` no fija ninguna:

```ts
app.use(express.static(browserDistFolder, { maxAge: '1y', index: false, redirect: false }));
app.use((req, res, next) => angularApp.handle(req).then(…));
```

Faltan `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options` /
`frame-ancestors`, `Permissions-Policy` y `Strict-Transport-Security`.

**Sin `frame-ancestors` ni `X-Frame-Options`, la aplicación se puede meter en un
iframe** — clickjacking. En una aplicación de salud, un iframe superpuesto puede
inducir a confirmar una acción clínica.

### Sin CSRF, y no hace falta

La autenticación es `Authorization: Bearer`, **no cookies**. Un ataque CSRF
necesita que el navegador adjunte la credencial solo; un token en una cabecera no
se adjunta solo.

### Sin redirecciones abiertas, por ausencia

Ninguna navegación toma su destino de un parámetro de la URL. Todas las llamadas
a `navigateByUrl` usan constantes.

**Regla para el futuro:** si alguna vez hay un `?redirect=`, hay que validar que
el destino sea una ruta interna. Es el error clásico.

### Sin autorización en el cliente

| Mecanismo | Qué hace |
|---|---|
| `authGuard` | Sesión y organización. **No mira roles** |
| Menú lateral | Dos ítems fijos |
| Cualquier permiso real | **La API** |

Y el token **no se verifica**:

> *«Verificarla en el cliente no aportaría nada: la clave es del servidor y quien
> pueda alterar el token también puede alterar el código que lo comprueba.»*

## Cabeceras propuestas

Para `src/server.ts`, cuando se autorice:

```ts
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  res.setHeader('Content-Security-Policy', "…"); // ver content-security-policy.md
  next();
});
```

**No se implementa acá**: es un cambio de producto que altera respuestas HTTP y
puede romper el prerenderizado o la carga de tipografías si la CSP queda mal.
Requiere prueba en un entorno y verificación de las cuatro rutas
prerenderizadas.

Ver también [el modelo de amenazas](threat-model.md) y
[el análisis de brechas](../reports/documentation-gap-analysis.md).
