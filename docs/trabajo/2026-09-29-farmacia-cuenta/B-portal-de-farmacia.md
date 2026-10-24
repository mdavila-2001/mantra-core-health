# Carril B · El portal de la farmacia como cuenta — prompt para pegar (Mac mini)

Sos la Mac mini. Construís **el portal de la cuenta de farmacia** (`farmacia@alovida.mock`,
tenant `PHARMACY`) en `mantra-core-health` (Angular 21 + SSR, **yarn 4 PnP**), sólo front, sólo
simulador, rama base **`origin/mockup`**. Leé primero [`README.md`](README.md): decisiones D3–D10,
bloqueantes B1–B15 y las reglas para no chocar con el carril A (otra máquina, en paralelo). El
diseño de referencia es `~/Downloads/farmacia_ecommerce_mantra (1).html`: **se traduce a nuestro
sistema de diseño, no se copia**; ya usa los tokens REDSAT (`--c-petrol-*`, `--c-aqua-*`…), así que
los colores no se discuten, la composición sí (B13).

## 0 · Arranque

```bash
df -h /                                        # B11: si queda < 5 GB, limpiá cachés, no worktrees
python3 -S scripts/atlas/check-exclusive-checkout.py
git -C mantra-core-health fetch origin
git -C mantra-core-health worktree add ../wt-farmacia-portal -b justin/farmacia-portal-2026-09-29 origin/mockup
cd ../wt-farmacia-portal
corepack yarn install --immutable
grep -n mockBackend src/environments/*.ts        # true; no lo commitees
yarn typecheck
```

Línea base **antes de la primera edición** (B2/B3 — anotá lo que ya está rojo):

```bash
yarn test --watch=false --include='src/app/core/navigation/**'
yarn test --watch=false --include='src/app/features/organization/**'
```

## 1 · Resultado observable (el kill-test)

Entro como `farmacia@alovida.mock` (clave en `src/app/core/mock/README.md`). Arriba, la cabecera de
siempre: campana, avatar, selector de organización. A la izquierda, **sólo** estos renglones,
planos, sin encabezado ni desplegable: **Resumen · Productos · Categorías · Importación masiva ·
Inventario · Solicitudes de retiro · Promociones · Ficha de la farmacia**. Nada de aseguradora, nada
de «Mis citas», nada de «Tu organización». Entro a Productos, creo uno en el modal con pestañas,
lo veo en el listado con su precio y su estado; lo marco sin stock y deja de estar disponible;
en Inventario le pongo existencias y umbral; en Categorías creo una y la uso; en Importación subo
un CSV y veo el resultado fila por fila; en Resumen los números cambian.

Si en el menú de la farmacia aparece **un solo** renglón de otra cuenta, o si «Farmacia» sigue
siendo un desplegable dentro de «Administración»: **no está hecho**. Si el paciente, el médico o
la aseguradora cambian de menú: **rompiste la regla 3 del propietario**.

## 2 · Lo que ya existe (no lo reescribas)

| Pantalla | Dónde | Qué hace hoy | Qué le pasa en este carril |
|---|---|---|---|
| Catálogo | `features/organization/pharmacy-catalog/` (1 065 + 610 líneas, `catalogo.reglas.ts` 794) | UNA tarjeta con 3 pestañas: Productos · Nuevo producto · Importación masiva. Alta, edición, retiro, «sin stock», precio, categoría, descripción, CSV. | Se parte: la pestaña Productos → **Productos**; Nuevo producto → **modal con pestañas**; Importación → ruta propia. Las reglas del CSV (`catalogo.reglas.ts`) se reusan tal cual. |
| Bandeja de pedidos | `features/organization/pharmacy-inbox/` (391 + `inbox-order/`, `alarma-de-pedidos.ts`, estados en `bandeja-status.ts`/`entrega-status.ts`) | Pedidos con alarma sonora, revisión, alternativa, listo para retiro, entrega, factura. | **Se renombra el rótulo** a «Solicitudes de retiro» y se alinea el vocabulario de estados con el mockup (Revisión de receta · Pendiente · En preparación · Listo para retiro · Finalizada · Cancelada) **sin cambiar** los `EstadoDePedido` del contrato. |
| Promociones | `features/organization/pharmacy-campaigns/` (446) | Campañas de la farmacia (`PharmacyCampaignsClient`). | Queda. Sólo entra al menú plano. |
| Ficha de la farmacia | `features/organization/pharmacy-profile/` (459; pestañas Datos de la empresa · Documentos legales · Representante y gerentes) | Lee `GET /pharmacy/pharmacies/:id` + `/licenses` + `/contacts`; **la edición no se guarda** (fixtures). | Queda como está en esta tanda. Si te sobra tiempo: indicador «te falta para operar: X de 6 papeles» leyendo lo que ya lee. Edición persistente: **no** (D10). |
| Simulador | `core/mock/handlers/pharmacy.handlers.ts` | `GET /pharmacy/products`, `POST/PATCH/DELETE /pharmacies/:id/products/:pid`, `/pharmacy/orders/*`, `/pharmacy/pharmacies` filtrado por tenant. | Gana: estado de producto (D6), `stock`/`minStock` (D7), categorías CRUD (D8), imágenes (D9), y un `GET` de resumen. |

## 3 · Lo que construís, en orden

Cada paso termina con `yarn build` verde y un checkpoint. Cada pantalla nueva nace con
`yarn ng generate component features/pharmacy/<x>` (sin sufijo `.component`), `OnPush`, señales,
`ViewState<T>` con sus estados (cargando, vacío, error con próxima acción, listo), SSR-safe.

### 3.1 · El menú (D3, D4) — primero, porque es lo que el propietario mira

- `core/navigation/navigation.map.ts`: las secciones de farmacia ganan
  `onlyForTenantTypes: ['PHARMACY']` (el campo existe: `navigation.types.ts:401`, lo usa
  `DIAGNOSTIC_CENTER` en `:510`). Nuevas secciones con el mismo criterio de acceso que sus
  hermanas (`roles: [ANY_ROLE]`, `requiresTenant`, `hiddenFor: ['PATIENT']`,
  `fueraDelMenuPara: ['PRACTITIONER']`, `module: 'M24 pharmacy'`): `administration/pharmacy`
  (Resumen) · `administration/pharmacy-categories` · `administration/pharmacy-import` ·
  `administration/pharmacy-inventory`. Rótulos: los ocho de §1, en ese orden. Íconos del set
  existente (`app-nav-icon`).
- Las secciones que hoy se cuelan (README §2): donde tengan `hiddenForTenantTypes: ['PAYER']`,
  agregá `'PHARMACY'`; las 4 de aseguradora (`administration/insurance*`, `received-claims`)
  ganan `onlyForTenantTypes: ['PAYER']` si todavía no lo tienen. `notification-center` y
  `my-account` (Mi perfil) **se dejan**: son de toda cuenta.
- `core/navigation/navigation.subgroups.ts:262`: el subgrupo «Farmacia» **desaparece**. Comprobá
  cómo dibuja `side-nav` una sección sin subgrupo (rótulo del grupo `side-nav__section-label`): si
  el grupo «Administración» sigue apareciendo como encabezado sobre los ocho renglones, la sección
  de farmacia se declara en su propio `group` con rótulo vacío o el que el sistema ya use para
  «General». **No** toques `side-nav/` ni `navigation.service.ts` para lograrlo; si no se puede sin
  tocarlos, pará y decilo.
- `core/navigation/access-tree.ts:129-145`: las nuevas entran a `SECCIONES_FUERA_DEL_ARBOL` como
  sus hermanas.
- Specs (B2): actualizá las listas cerradas con la sección nueva y agregá **un** spec que fije el
  menú exacto de la sesión `PHARMACY` (los ocho, en orden, y nada más) y otro que fije que
  paciente/médico/aseguradora **no cambian** (snapshot de sus menús antes y después).
- `app.routes.ts`: sólo el mapa de secciones (`'administration/pharmacy…'`) y las rutas hijas; el
  bloque `auth/register/*` es del carril A.

### 3.2 · Resumen (`administration/pharmacy`)

Lo que dibuja `overviewView` del mockup, en nuestra composición: indicadores arriba (publicados ·
borradores · sin stock · stock bajo · valor del inventario; **sin** «solicitudes» si no viene del
simulador), «productos por categoría», los tres atajos (completar borradores → Productos filtrado;
revisar inventario → Inventario con alertas; actualizar en lote → Importación) y «actividad
reciente» (las últimas altas/ediciones/importaciones que el simulador registre). Fuente:
`GET /pharmacy/products` + un `GET /pharmacy/pharmacies/:id/summary` nuevo en el simulador (anotalo
en P47). Sin gráficos de terceros.

### 3.3 · Productos (`administration/pharmacy-catalog`)

Listado como `data-table` con cursor (no `app-pagination`): columnas nombre · código · categoría ·
precio · estado · disponibilidad; `filter-bar` con búsqueda, estado (Publicado · Borrador ·
Retirado), categoría, disponibilidad, receta; selección múltiple con **publicar / retirar en
lote**; «Nuevo producto» abre el modal. Vista de tarjetas en móvil (el mockup lo hace a 779 px).
Exportar CSV con las columnas de la plantilla de importación.

**Modal de producto** (`content-dialog`, regla §6) con pestañas **General** (nombre, código, marca,
genérico, presentación, concentración, receta) · **Ficha técnica** (principio activo, código de
barras, registro sanitario) · **Descripción** · **Imágenes** (hasta 3, `attachment-uploader`) ·
**Publicación** (estado, precio, categoría, disponibilidad). Guardar = `POST`/`PATCH` → relectura
del listado: la prueba es la lista, no el toast. Cerrar con cambios sin guardar pide confirmación.

### 3.4 · Categorías (`administration/pharmacy-categories`)

Lista con conteo de productos; crear, renombrar (los productos siguen), eliminar (bloqueado con
productos: 409 del simulador mostrado en pantalla). Simulador: `GET/POST/PATCH/DELETE
/pharmacies/:id/categories`, partiendo de las 6 que ya existen.

### 3.5 · Importación masiva (`administration/pharmacy-import`)

Los 4 pasos del mockup: Subir archivo (dropzone + «descargar plantilla») → Asignar columnas
(auto-mapeo por alias; `catalogo.reglas.ts` ya parsea) → Revisar datos (errores por fila,
duplicados de código dentro del archivo, «descargar errores») → Resultado. Modo **crear /
actualizar / crear y actualizar**. Es la misma carga en serie que hoy vive en la pestaña; sólo
cambia de casa y gana los pasos 2 y 3 como pantallas.

### 3.6 · Inventario (`administration/pharmacy-inventory`)

Tabla editable: existencias · umbral de alerta · disponibilidad derivada (`stock > 0`); filtro
«sólo con alertas»; «Guardar cambios» aplica todo junto (`PATCH` por producto o un `PATCH
/pharmacies/:id/inventory` nuevo — elegí uno y anotalo en P47). Aviso fijo: «Cuando exista la
sincronización con tu sistema, esta pantalla pasa a sólo lectura» (registro §2.1.2).

### 3.7 · Solicitudes de retiro y Promociones

Sólo lo dicho en §2. Si al renombrar rompés un spec de la bandeja, es porque el rótulo estaba en
una aserción: actualizá el rótulo, no la lógica.

## 4 · Archivos: qué es tuyo y qué no

**Tuyos:** `features/pharmacy/**` (nuevo; si movés ahí las 4 pantallas existentes, hacelo en el
**primer commit**, sólo si `grep -rn "features/organization/pharmacy-"` fuera de `app.routes.ts` y
`component-index.generated.ts` da 0), `features/organization/pharmacy-*/**`,
`core/navigation/{navigation.map,navigation.subgroups,access-tree}.ts` + specs,
`core/mock/handlers/pharmacy.handlers.ts` + spec, `core/data-access/pharmacy/**`,
`app.routes.ts` (**sólo** mapa de secciones y rutas hijas), `component-index.generated.ts`
(regenerado, sólo vos), `playwright/support/actores.ts` (agregá `farmacia()`),
`playwright/portal-farmacia.spec.ts` (Write/Edit, no heredoc), `PENDIENTES-BACKEND.md` **sólo la
sección P47 en su lugar** (línea ~1947; ni la tabla ni el final: son del carril A). Al cierre:
`REPORTE-B.md` + `evidencia/B/` en esta carpeta.

**Prohibidos:** `features/auth/**`, `core/mock/handlers/auth.handlers.ts`, `mock-session.ts`,
`navigation.service.ts`, `header/`, `side-nav/`, `shell/`, `features/account/**`,
`public-directories/**`, `insurance/**`, `environments/`, `proxy.conf*.json`.

## 5 · Cierre

```bash
yarn typecheck; yarn lint; yarn build; node scripts/check-route-prefixes.mjs
yarn test --watch=false --include='src/app/core/navigation/**'
yarn test --watch=false --include='src/app/features/pharmacy/**'
```

E2E en primer plano, `--workers=1`, chromium, entrando como `farmacia()`: el kill-test de §1
completo; y un segundo recorrido corto como paciente y como aseguradora que fije que **sus menús no
cambiaron**. Capturas fullPage de las 8 pantallas en 375 / 768 / 1440 claro y 1440 oscuro; medí
fondo, centrado ≤ 2 px, ancho ≥ 85 %, sin scroll horizontal, consola sin errores.

Si el carril A ya mergeó: `git merge origin/mockup`, `yarn build` de nuevo, y recién el PR contra
`mockup`. Después del merge de los dos, **`yarn build` sobre la cabeza de `mockup`** (README §4.4) y
`~/.local/bin/alovida-autodeploy.sh --estado` para confirmar que la demo se reconstruyó.

Checkpoints cada ≤ 3 operaciones materiales. Fallo → causa raíz antes de parche; nunca subir un
timeout ni relajar una aserción ajena.

## 6 · Lo que NO hacés

Comisiones semanales · puntos · supermercado · pedidos con seguro · facturación · que lo registrado
en A aparezca acá · edición persistente de la Ficha · tocar la tienda del paciente, la vitrina
pública o cualquier otra cuenta · backend.
