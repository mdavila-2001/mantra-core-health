# Runbook 7 · Assets o imágenes no disponibles

**Síntoma.** La página carga sin estilos, sin tipografías, o con 404 de `.js` y
`.css`.

**Impacto.** Alto: sin estilos la aplicación es prácticamente inusable.
**Severidad.** S1 si faltan los estilos, S3 si es solo el favicon.

---

## Qué activos existen

**Muy pocos**, y eso acota el diagnóstico:

| Activo | Origen |
|---|---|
| `main-<hash>.js`, `chunk-<hash>.js` | Build |
| `styles-<hash>.css` | Build |
| Tipografías (`@fontsource`) | **Empaquetadas**, no externas |
| `favicon.ico` | `public/`, copiado tal cual |
| Íconos | **SVG en línea**, no archivos |
| Imágenes | **Ninguna** |

**Cero peticiones a terceros**: las tipografías están autoalojadas. Eso descarta
de entrada un CDN caído.

## Diagnóstico

### 1 · ¿Qué falta exactamente?

```text
F12 → Red → filtrar por 404
```

| Falta | Causa probable |
|---|---|
| **Todos** los `.js` y `.css` | Ruta base o `express.static` → pasos 2 y 3 |
| **Uno** solo | [Runbook 3](chunks-desactualizados.md) |
| Solo las tipografías | El build no las empaquetó |
| Solo el favicon | Trivial → paso 5 |

### 2 · La ruta base

```html
<base href="/">
```

Si la aplicación se sirve bajo un subdirectorio (`https://…/app/`), **el `<base>`
tiene que decirlo** o todas las rutas relativas fallan.

```bash
curl -s https://<dominio>/auth | grep "<base"
```

El proyecto **no configura `baseHref`** en `angular.json`, así que asume raíz del
dominio. Servirlo bajo un subdirectorio requiere `--base-href` al construir.

### 3 · La estructura de `dist/`

```ts
const browserDistFolder = join(import.meta.dirname, '../browser');
```

`server.mjs` busca `../browser` **relativo a sí mismo**:

```text
dist/mantra-core-health/
├── browser/     ← acá
└── server/      ← server.mjs
```

Si al copiar se aplanó la estructura, el servidor arranca y **no encuentra nada
que servir**.

```bash
ls dist/mantra-core-health/browser/ | head
```

### 4 · `index: false`

```ts
express.static(browserDistFolder, { maxAge: '1y', index: false, redirect: false })
```

`index: false` **impide que Express sirva `index.html` por su cuenta** y se salte
el motor de Angular. Quitarlo produce un síntoma raro: la aplicación carga pero
el enrutado del servidor no funciona.

### 5 · El favicon

Sin hash, con `maxAge: '1y'`. **Cambiarlo no se ve durante un año** en los
navegadores que ya lo tengan.

Solución: renombrarlo al cambiarlo.

### 6 · Con CDN, si existiera

Un `.js` con 404 en el borde y 200 en el origen es una purga pendiente. Hoy **no
hay CDN**, así que este paso no aplica.

## Evidencia

- [ ] Lista de 404 de la pestaña de red
- [ ] `curl -s https://<dominio>/auth | grep "<base"`
- [ ] `ls dist/mantra-core-health/browser/`
- [ ] ¿La aplicación se sirve en la raíz o en un subdirectorio?
- [ ] Registros del servidor

## Mitigación

| Causa | Acción |
|---|---|
| Estructura de `dist/` mal | **Redesplegar** preservándola |
| Subdirectorio sin `baseHref` | **Reconstruir** con `--base-href` |
| `index: false` quitado | Restaurarlo |
| Un chunk viejo | [Runbook 3](chunks-desactualizados.md) |
| Favicon | Renombrar |

**Las dos primeras exigen un artefacto nuevo**, no un reinicio.

## Escalamiento

Frontend, salvo que sea configuración del servidor web o del CDN.

## Prevención

- **Smoke tras el despliegue.** El paso «`/design-system` carga» detecta esto de
  inmediato: es la ruta con más estilos y un fragmento diferido.
- **Fijar `baseHref` explícitamente** si el destino no es la raíz.
- Comprobación de salud que pida un `.js` con hash, no solo el HTML.
