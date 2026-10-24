# La cuenta de farmacia — registro y portal · 29/09/2026

> **Sólo front, sólo `mockup`.** Dos carriles independientes en dos máquinas, cada uno en su
> worktree desde `origin/mockup`, cada uno con su PR contra `mockup`. Ninguno espera al otro.
> Backend: nada; lo que la API tenga que dar se anota en `PENDIENTES-BACKEND.md`.
>
> | Carril | Qué | Máquina | Prompt |
> |---|---|---|---|
> | **A** | Registro público de una farmacia (`/auth/register/pharmacy`) | cualquiera | [`A-registro-de-farmacia.md`](A-registro-de-farmacia.md) |
> | **B** | El portal de la farmacia como cuenta: menú propio y las pantallas del mockup | **Mac mini** | [`B-portal-de-farmacia.md`](B-portal-de-farmacia.md) |
>
> Peldaño de este documento: **DISCOVERED**. Es un plan; no se ejecutó nada de él.
> La documentación de avance (`REPORTE.md`, `evidencia/`) se escribe **al final** de cada carril.

---

## 1 · Lo que pidió el propietario

1. La cuenta de farmacia (`farmacia@alovida.mock`, tenant `PHARMACY`) se convierte en el diseño de
   `farmacia_ecommerce_mantra (1).html`, **adaptado a nuestro sistema visual y a lo que pide el
   registro de procesos**, no copiado.
2. El menú de la farmacia son **estos renglones, planos, sin agruparlos bajo un encabezado**:
   Resumen · Productos · Categorías · Importación masiva · Inventario · Solicitudes de retiro.
   Arriba, la cabecera de siempre (campana de notificaciones, perfil), como en las demás cuentas.
3. **No tocar** a los demás tipos de usuario ni lo que ya tienen de farmacia (tienda del paciente,
   carrito, recetas, vitrina pública, `/my-account/pharmacy*`, `/pharmacies-directory`).
4. Registro de farmacia con los datos del **Módulo Farmacia §1** del registro de procesos, con el
   diseño de los registros que ya existen. **Obligatorio = lo más básico**; el resto se completa desde
   adentro de la cuenta (y será exigido para operar cuando exista el backend).

## 2 · Hechos verificados (29/09, `mockup` @ `a63ffb57`)

- **La fusión es real.** Con `apareceEnElMenu(s, ['USER'], [tenant], 'PHARMACY')` sobre
  `APP_SECTIONS`, la farmacia hoy tiene en el menú: `directories`, `administration/insurance`,
  `administration/insurance-analytics`, `administration/received-claims`,
  `administration/insurance-campaigns`, `my-account/dependents`, `my-account`,
  `my-account/appointments`, `my-account/medical-record`, `my-account/diagnostic-results`,
  `my-account/diagnostic-orders`, `my-account/cotizaciones`, `notification-center`,
  `administration/my-organization` **y** las cuatro de farmacia (`pharmacy-orders`,
  `pharmacy-campaigns`, `pharmacy-catalog`, `pharmacy-profile`). Las cuatro además viven en el
  desplegable «Farmacia» del grupo «Administración» (`navigation.subgroups.ts:262`).
- **Lo que ya existe y se reusa** (`features/organization/pharmacy-*`, 4 476 líneas):
  catálogo con alta/edición/retiro/«sin stock»/carga masiva CSV en UNA tarjeta con 3 pestañas
  (`pharmacy-catalog`), bandeja de pedidos con alarma sonora y estados
  (`pharmacy-inbox`, `alarma-de-pedidos.ts`), promociones (`pharmacy-campaigns`), ficha legal con
  los 8 tipos de sociedad y los 6 papeles del registro (`pharmacy-profile`, pero edición que **no
  se guarda**). Simulador: `pharmacy.handlers.ts` (`GET /pharmacy/products`, `POST/PATCH/DELETE
  /pharmacies/:id/products/:pid`, `/pharmacy/orders/*`, `/pharmacy/pharmacies/:id/{licenses,contacts}`).
- **No existe registro de farmacia.** `/auth/register` ofrece Paciente · Médico · Aseguradora ·
  Laboratorio · Imagenología. El de **Laboratorio** (`register-laboratory.ts`, 866 líneas) ya
  implementa los mismos 18 puntos del registro de procesos (tipo societario de lista cerrada, 6 PDF,
  central + mapa, sucursales, representante, 3 gerencias, acceso) con `app-paginated-form` +
  `app-auth-split`, y es maqueta (`submit()` no sale a la red). **Es el molde del carril A.**
- El simulador de `POST /iam/auth/register-organization` valida `legalEntityType` contra el
  diccionario `TIPO_SOCIETARIO` (400 si no es código) y `payer.latitude/longitude` en rango. La API
  real acepta cualquier `tenantType` de `TENANT_TYPE_CODES` (incluido `PHARMACY`), pero su DTO sólo
  tiene bloques `payer` / `broker` / `diagnosticCenter`: **no hay bloque `pharmacy`** (→ P49).
- **Prefijos del proxy** (`proxy.conf.json`, se comparan por inicio de ruta): `/pharmacy`,
  `/pharmacies`, `/pharmacy-inventory`, `/iam`, `/admin`… Ninguna ruta de pantalla nueva puede
  empezar por `/pharmacy`: todas cuelgan de `/administration/pharmacy-*` o `/auth/register/*`.
- La cabecera (`organisms/header`) ya trae `app-tenant-switcher`, la campana y el avatar: **no hay
  nada que construir arriba**, sólo que la sesión de farmacia la use como todas.
- `catalogo-farmacia.mjs` (24/24 el 29/09) es un guion de navegador, no un spec; no hay actor
  `farmacia()` en `support/actores.ts`.

## 3 · Decisiones (el ejecutor las aplica; el propietario puede vetarlas)

| # | Decisión | Por qué |
|---|---|---|
| D1 | **Registro = `POST /iam/auth/register-organization` con `tenantType: 'PHARMACY'`** + bloque `pharmacy: { branches[] }`. Sin endpoint nuevo. | Es el contrato que ya existe para organizaciones; el simulador ya lo valida. Lo que la API no acepta va a **P49**. |
| D2 | **Obligatorio en el alta:** razón social · tipo de sociedad · NIT (número) · dirección legal de la central · nombre y correo del representante legal · correo de acceso · contraseña (política existente). **Opcional:** los 6 PDF, GPS de la central, sucursales, las 3 gerencias. | Regla del propietario («lo obligatorio es lo más básico»). El alta de Laboratorio hizo obligatorios 3 PDF: acá manda el pedido; se deja constancia. |
| D3 | **Menú de la farmacia, plano y cerrado:** Resumen · Productos · Categorías · Importación masiva · Inventario · Solicitudes de retiro · Promociones · Ficha de la farmacia. Todo lo demás **desaparece del menú** de una sesión `PHARMACY` (sigue alcanzable por URL donde ya lo era: la autoridad es la API). | Los 6 del mockup + los 2 que el registro de procesos exige (§5 promociones, §1 datos legales). «Tu organización» la reemplaza la Ficha; «Directorios» no es del mostrador. |
| D4 | **Cómo se limpia el menú:** el precedente es `hiddenForTenantTypes: ['PAYER']` en cada sección ajena a la aseguradora. Se sigue el mismo: donde hay `['PAYER']` pasa a `['PAYER', 'PHARMACY']`; las 4 de aseguradora ganan `onlyForTenantTypes: ['PAYER']` (ya existe el campo, lo usa `DIAGNOSTIC_CENTER`); las de farmacia ganan `onlyForTenantTypes: ['PHARMACY']` y salen del subgrupo «Farmacia». | Un renglón por sección, sin lógica nueva en `navigation.service`. No cambia lo que ven las otras cuentas: sólo agrega `PHARMACY` a listas de exclusión. |
| D5 | **Rutas** (todas bajo `administration/`): Resumen `pharmacy` (nueva) · Productos `pharmacy-catalog` (existe; queda sólo el listado) · Categorías `pharmacy-categories` (nueva) · Importación `pharmacy-import` (nueva; se extrae de la pestaña) · Inventario `pharmacy-inventory` (nueva) · Solicitudes de retiro `pharmacy-orders` (existe; se renombra el rótulo) · Promociones `pharmacy-campaigns` · Ficha `pharmacy-profile`. Nuevo producto y edición: **modal con pestañas** General · Ficha técnica · Descripción · Imágenes · Publicación. | Prefijos del proxy (§2). El modal con pestañas es la regla 6 de `composition-rules.md` y lo que hace el mockup (`productEditor`). |
| D6 | **Estados de producto:** `Publicado · Borrador · Retirado` + la marca «sin stock» que ya existe. **No** «En revisión»: nadie revisa. | El registro no pide estados; el mockup los trae. Se toma lo que tiene dueño. |
| D7 | **Inventario:** existencias (número) + umbral de alerta por producto, editable en el simulador; `inStock` deriva de `stock > 0`. La pantalla dice que, cuando exista la sincronización con el sistema de la farmacia (registro §2.1.2), pasa a sólo lectura. | Es lo que dibuja el mockup. La API no tiene dónde guardarlo (P47 §4): se anota, no se inventa. |
| D8 | **Categorías:** las 6 del simulador son el punto de partida; la farmacia crea, renombra y elimina (no si tiene productos). | Está en el menú validado por el propietario. |
| D9 | **Imágenes de producto:** hasta 3, por `attachment-uploader` + `files.handlers`. Los productos sembrados **no traen imagen**: el listado muestra el marcador. | Regla `00-non-negotiables` §8: nada de fotos de stock. |
| D10 | **Fuera de esta tanda** (se anotan en `PENDIENTES-BACKEND.md` o quedan para otra): comisiones semanales (§2.1.11), puntos (§4), supermercado (§3), pedidos con seguro (§2.2), facturación SIAT de la farmacia, que la cuenta recién registrada pueda **entrar** (ningún alta del simulador crea cuentas logueables), sincronización con sistemas externos, y mover lo registrado a la Ficha. | «No tan largo». Cada cosa tiene su renglón para no perderla. |

## 4 · Reglas para que las dos máquinas no choquen

1. **Cada carril es dueño exclusivo de sus archivos** (lista en cada prompt). Un archivo compartido
   se toca **sólo en la región asignada**:
   - `src/app/app.routes.ts` — **A:** sólo el bloque `auth/register/*` (una ruta). **B:** el mapa
     de secciones (`'administration/pharmacy…'`) y las rutas hijas. Regiones distintas: el merge es
     limpio.
   - `PENDIENTES-BACKEND.md` — **A:** agrega la fila **P49** a la tabla y su sección **al final**.
     **B:** edita la sección **P47 en su lugar** (línea ~1947), no toca la tabla ni el final.
   - `features/component-stock/component-index.generated.ts` — **sólo B** lo regenera.
2. **Nadie edita** `mock-session.ts`, `navigation.service.ts`, `header/`, `side-nav/`, `shell/`,
   nada de `features/account/pharmacy*`, `public-directories/`, `insurance/`, ni los registros de
   paciente/médico/aseguradora/laboratorio/imagenología.
3. Rama y PR: `justin/farmacia-registro-2026-09-29` (A) y `justin/farmacia-portal-2026-09-29` (B),
   desde `origin/mockup`, PR contra `mockup`. El segundo en terminar hace `git merge origin/mockup`
   **antes** de abrir el PR y vuelve a correr `yarn build`.
4. **Tras el segundo merge, la Mac mini corre `yarn build` sobre la cabeza de `mockup`.** El
   presupuesto de CSS/JS rompe sólo al mezclar y, si rompe, el vigilante de autodespliegue
   (launchd `bo.alovida.autodeploy`, sólo en la Mac mini) deja el VPS en la versión vieja sin
   avisar. Estado: `~/.local/bin/alovida-autodeploy.sh --estado`.

## 5 · Bloqueantes conocidos (medidos, no supuestos)

| # | Bloqueante | Cómo se evita |
|---|---|---|
| B1 | `/pharmacy*` y `/pharmacies*` son prefijos del proxy: una ruta de pantalla que empiece así **se la come el proxy** y da 404 en `ng serve` y en nginx. | Todas las rutas nuevas bajo `administration/pharmacy-*` (D5). Correr `node scripts/check-route-prefixes.mjs` antes del PR. |
| B2 | **Listas cerradas en specs**: `navigation.map.spec.ts` (123–126, 416–418), `access-tree.spec.ts` (121–124), `navigation.service.spec.ts` (menú del médico de nueve, 767), `navigation.subgroups.spec.ts`, `carril-19-route-health.spec.ts`. Agregar secciones las rompe **por diseño**. | B las actualiza con la sección nueva; **no** se relaja ninguna aserción ajena. Medir la línea base de `src/app/core/navigation/**` antes de tocar. |
| B3 | El reporte del mercado de seguros (28/09) dejó **6 specs de navegación en rojo preexistentes** en `dev`. En `mockup` está sin medir. | Cada carril mide `yarn test --include=<sus specs>` sobre la línea base **antes** de la primera edición y anota lo que ya estaba rojo. |
| B4 | `mockBackend` viene de `environment*.ts`; en `dev` está en `false`. | Comprobar `grep mockBackend src/environments/*.ts` en el worktree; en `mockup` debe estar en `true`. No commitear cambios de `environments/`. |
| B5 | El simulador **no crea cuentas logueables** en ningún alta (`register-patient` devuelve `PENDING_VERIFICATION` y no toca `MOCK_USERS`). | El carril A termina donde terminan los otros: 201 → pantalla de verificación de correo. Entrar con la cuenta nueva queda en D10. |
| B6 | Códigos de tipo societario: el alta de Laboratorio y el simulador usan **códigos** (`SRL`, `LTDA`, `SA`, `SOCIEDAD_COLECTIVA`…); `pharmacy-profile.types.ts` usa **rótulos** (`'S.A.'`). Mandar rótulos da 400. | A usa los códigos del diccionario (`TIPO_SOCIETARIO` de `auth.handlers.ts`). B, al hacer editable la Ficha, convierte a códigos. `SRL`/`LTDA` son la misma figura: ya está escalado, no se resuelve acá. |
| B7 | `tsc` **no revisa plantillas**: una plantilla rota compila y aparece como 404 en ejecución. | `yarn build` (AOT) es obligatorio, no sólo `yarn typecheck`. |
| B8 | Presupuesto del bundle inicial (500 kB): la vitrina lo rompió una vez (503 kB). | Todo lo nuevo por `loadComponent` (el mapa de secciones ya lo hace). |
| B9 | Vitest tira `Timeout waiting for worker to respond` con muchos specs: contención, no fallo. | Re-correr o aislar con `--include`. |
| B10 | El guardián ATLAS de la Mac mini bloquea cualquier Bash con la palabra «playwright» sin `--workers=1` y cualquier `&` (incluidos `&&` y `2>&1`). | Specs con Write/Edit, nunca heredoc. Correr en primer plano, `--workers=1`, encadenar con `;`, redirigir con `2>archivo`. Con carga de CPU > 1,0 bloquea el navegador entero: esperar. |
| B11 | Disco de la Mac mini cerca del 100 % (78 worktrees). | `df -h` antes de crear el worktree; si falta espacio, borrar **sólo** cachés (`.angular/`, `~/.yarn/berry/cache`), nunca worktrees ajenos ni volúmenes de Docker. |
| B12 | Yarn 4 PnP: `npm install` rompe el árbol. | `corepack yarn install --immutable`. |
| B13 | Regla del cliente: fichas y formularios **centrados, a lo ancho, en UNA tarjeta con pestañas** (`composition-rules.md` §5); cambios sobre un registro existente **en modal** (§6). El mockup HTML usa tarjetas apiladas en «Resumen»: se traduce, no se copia. | La revisión visual mide fondo, centrado ≤ 2 px, ancho ≥ 85 %, sin scroll horizontal, en 375/768/1440 claro y 1440 oscuro. |
| B14 | La otra máquina puede no tener los hooks del repo raíz (`Mantra Core Health/.claude`): no la frenan, pero tampoco la protegen. | El prompt A repite las reglas que importan (un navegador, `--workers=1`, sin `npm`). |
| B15 | La alarma sonora de la bandeja depende de la política de autoplay: no suena hasta la primera interacción. Preexistente. | No es de esta tanda; no se «arregla» subiendo timeouts. |

## 6 · Definición de terminado (por carril)

`yarn typecheck` 0 · `yarn lint` limpio en lo tocado · `yarn build` exit 0 · specs dirigidos + los de
navegación en verde (o rojo **preexistente** anotado) · e2e dirigido `--workers=1` PASS · capturas
375/768/1440 claro + 1440 oscuro de cada pantalla nueva · `check-route-prefixes` · PR contra
`mockup` · y recién entonces `REPORTE.md` + `evidencia/` en esta carpeta.

Skills a cargar antes de escribir UI: `project-design-system`, `frontend-design`, `design-taste`;
antes de cerrar: `visual-quality-gate`, `frontend-production-gate`, `verify`.
