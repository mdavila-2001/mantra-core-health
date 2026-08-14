# El port de las vistas de la bóveda

Las pantallas de este front salen de la bóveda de documentación
(`mantra_core_technologies_health_docs/SALUD/Vistas/`), que tiene dos capas:

| Capa | Qué es | Cobertura |
| --- | --- | --- |
| `Vistas/HTML/` | Maquetas HTML estáticas contra **REDSAT v1.1** | 7 módulos, 133 archivos |
| `Vistas/*.md` | Fichas que especifican las pantallas de cada módulo | 70 módulos, 755 vistas declaradas |

Lo que está portado es la primera capa. Lo que falta es casi toda la segunda, y
más abajo está el detalle de cuánto.

## Las tres piezas

### 1 · La hoja normativa

`src/styles/redsat.css` es **generado**: sale de `_assets/redsat.css` en la
bóveda con `node scripts/sync-redsat.mjs`. Nunca se edita a mano — el próximo
sync lo pisa. El script hace dos cosas y ninguna más:

- las tipografías pasan a servirse desde `/redsat/tipografias/` (`public/`);
- cada selector de tema oscuro de la bóveda (`data-tema="oscuro"`) gana un
  gemelo con el contrato del front (`data-theme="dark"`).

Se carga **después** de `src/styles.css` (ver `angular.json`). Los dos ficheros
conviven porque sus tokens son disjuntos: la bóveda nombra en castellano
(`--tinta`, `--petroleo`, `--e1`…`--e6`, `--r-card`) y el front en inglés
(`--text-primary`, `--brand-primary`, `--sp-4`, `--r-md`). Ninguno pisa al otro,
y la paleta de marca es la misma en los dos.

**El tema se estampa dos veces**, a propósito. `data-theme` conserva su contrato
de tres estados (`light` / `dark` / ausente = lo que diga el sistema).
`data-tema` lleva siempre el tema **ya resuelto**, porque la hoja de REDSAT no
sabe leer `prefers-color-scheme` por su cuenta. Los dueños son
`core/tokens/theme.service.ts` y el script anti-parpadeo de `index.html`, que
son espejo uno del otro.

### 2 · Los comportamientos

`RedsatRuntimeService` (`core/redsat/redsat-runtime.service.ts`) es el puerto de
`_assets/redsat.js`.
Aquel archivo es un IIFE que corre una vez sobre un documento estático; acá el
trabajo se parte en dos, porque en una SPA el documento no se recarga:

- `instalar()` — una vez por sesión: menús de desborde, diálogo con Esc y foco
  atrapado, fondo que responde al puntero.
- `refrescar(estado)` — en cada `NavigationEnd`: secuencia de entrada, aparición
  por scroll, etiquetas de columna de las tablas, cajón de navegación, buscador
  compacto, y el estado de la pantalla.

Lo llama `App`, que además lee de la ruta activa el **arquetipo** (`listado`,
`formulario`, `detalle`, `modal`) y lo estampa en el `<body>`: la hoja tiene
reglas de composición que cuelgan de ahí.

Lo que **no** se portó, y por qué:

- el conmutador de tema, que gobierna `RedsatThemeToggleDirective` contra
  `ThemeService` — dos dueños del mismo atributo se pisan;
- la barra de estados de la maqueta (`.barra-maqueta`) y el selector
  `[data-ir-a-pantalla]`, que son andamiaje de la maqueta, no producto.

De la barra sí sobrevive una cosa útil: los formularios por etapas navegan con
`?estado=paso2`, y `fijarEstado()` conmuta los bloques de
`.app-view-state-host`.

### 3 · Las pantallas

`node scripts/port-vistas-redsat.mjs` genera `src/app/features/redsat/`. De cada
maqueta saca el contenido de `<main class="app-main__inner">` —el marco sale
aparte, una sola vez— y escribe un componente por pantalla más sus rutas.

Lo que reescribe al pasar:

| En la maqueta | En el front |
| --- | --- |
| `href="V04-02-membresias-listado.html"` | `routerLink="/directorio/membresias-listado"` |
| `href="?estado=paso2"` | `routerLink="." [queryParams]="{ estado: 'paso2' }"` |
| `href="#"` | sin destino, `aria-disabled="true"`, `data-sin-destino` |
| `src="../imagenes/x.svg"` | `/redsat/imagenes/x.svg` |
| `{{` y `@if` en texto | escapados, para que Angular no los compile |

**Archivos generados** (no se editan a mano; el generador los pisa):
`redsat.routes.ts`, `redsat-nav.data.ts`, `vistas.manifest.json`,
`marcos.crudos.json`, y los `.html`/`.ts` de cada pantalla.
`shell/` **no** se genera: los dos marcos se escriben a mano.

## Las rutas

| Segmento | Módulo de la bóveda | Marco |
| --- | --- | --- |
| `/inicio` | `landing` | lienzo propio, sin marco |
| `/buscar/*` | V65 buscador | `RedsatPublicShell` |
| `/datos-compartidos/*` | V02 common | `RedsatShell` |
| `/terminologia/*` | V03 terminology | `RedsatShell` |
| `/directorio/*` | V04 directory | `RedsatShell` |
| `/personas/*` | V05 profiles | `RedsatShell` |
| `/accesos/*` | V06 authz | `RedsatShell` |

> **`/directorio`, no `/organizaciones`.** El proxy de desarrollo desvía a la API
> todo lo que empieza con `/org`, así que una ruta con ese nombre nunca llegaría
> al router: la respondería el backend con un 404. Es la misma trampa que
> documenta `proxy.conf.json`, y ya mordió antes con `/administracion`.

Cada módulo cuelga de su propio segmento y monta el marco ahí, en lugar de
agrupar todo bajo una ruta de path vacío. Es a propósito: el armazón de la
aplicación también vive en `path: ''`, y dos padres vacíos compitiendo por la
misma URL dejarían el ruteo dependiendo de que el router retroceda.

## Las pantallas que ya existían

`features/shell-layout/` dejó de delegar en el organismo `app-shell` y pinta el
marco REDSAT directamente. No es un cambio de CSS: REDSAT compone al revés —el
nav es columna de altura completa y el header vive **dentro** de la columna de
contenido—, y eso exige cambiar el orden del marcado.

Con eso, **toda** pantalla con sesión quedó bajo el marco de la bóveda, no sólo
las portadas. El menú se sigue armando con `NavigationService` desde el registro
de secciones: cambió cómo se pinta, no de dónde sale.

El organismo `app-shell` sigue existiendo y no se tocó — lo usa la vitrina del
sistema de diseño para mostrarlo aislado.

## Lo que falta

De las 755 vistas que declaran las fichas MD, **126 están portadas**: las que
tenían maqueta HTML. Las otras ~629 existen sólo como especificación en prosa,
repartidas en los módulos V00–V01 y V07–V64.

El nav lateral las declara igual, sin destino (`data-sin-destino`): están en el
mapa de la plataforma y todavía no se maquetaron. Es deliberado — esconderlas
haría creer que la plataforma es más chica de lo que es, y darles una ruta
falsa mandaría a un 404.

El orden para construirlas está en `🗺️ Orden de trabajo.md` en la bóveda.

## Cómo regenerar

```bash
node scripts/sync-redsat.mjs        # la hoja normativa
node scripts/port-vistas-redsat.mjs # las 126 pantallas y sus rutas
```

Las dos leen de la bóveda por ruta absoluta. Si la bóveda se mueve, se ajustan
las constantes `ORIGEN` y `VAULT` al principio de cada script.
