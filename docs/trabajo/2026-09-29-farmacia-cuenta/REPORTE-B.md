# Carril B · El portal de la farmacia como cuenta — reporte · 29/09/2026

Rama `justin/farmacia-portal-2026-09-29` desde `origin/mockup` @ `a63ffb57`, sólo front, sólo simulador.
Peldaño alcanzado: **VERIFIED** (recorrido observado en navegador contra la maqueta) — **no**
`REGRESSION_VERIFIED`: la suite completa del front no se corrió (ver «Lo que no se corrió»).

## Lo que se ve (kill-test de §1)

Entrando como `farmacia@alovida.mock`, el menú son **ocho renglones planos, sin encabezado ni
desplegable**, en este orden: Resumen · Productos · Categorías · Importación masiva · Inventario ·
Solicitudes de retiro · Promociones · Ficha de la farmacia (+ «Mi perfil» y «Notificaciones», fijos de toda
cuenta). Nada de aseguradora, «Mis citas», «Tu organización», ni «Sistema de diseño».

Recorrido observado con `playwright/portal-farmacia.spec.ts` (`--workers=1`, chromium, `ng serve` propio en
:4210, **12/12 PASS**): alta de un producto en el modal con pestañas → aparece en el listado releído con su
precio, estado «Publicado» y «Disponible» → «Marcar sin stock» → «Sin stock» → Inventario: existencias 3,
umbral 5, guardar → «Stock bajo» → Categorías: crear una → Importación: CSV de dos filas con el resultado
fila por fila → Resumen: los publicados cambiaron y la actividad reciente lo cuenta. Consola sin errores
propios (los avisos de CSP por «inline script» son del cliente de recarga de `ng serve`).

## Qué se construyó

| Pantalla | Ruta | Dónde |
|---|---|---|
| Resumen | `administration/pharmacy` | `features/pharmacy/summary/` (nueva) |
| Productos + modal de 5 pestañas | `administration/pharmacy-catalog` | `features/pharmacy/products/` (reemplaza a la tarjeta de 3 pestañas) |
| Categorías | `administration/pharmacy-categories` | `features/pharmacy/categories/` (nueva) |
| Importación masiva (4 pasos) | `administration/pharmacy-import` | `features/pharmacy/import/` (extraída del catálogo) |
| Inventario | `administration/pharmacy-inventory` | `features/pharmacy/inventory/` (nueva) |
| Solicitudes de retiro | `administration/pharmacy-orders` | sólo rótulo y vocabulario de estados |
| Promociones, Ficha | sin cambios | sólo entran al menú plano |

- **Menú**: las 8 secciones con `onlyForTenantTypes: ['PHARMACY']`, en el dominio aplanado `General`;
  el subgrupo «Farmacia» pasó a `General` (se dibuja suelto). `PHARMACY` se suma a `hiddenForTenantTypes` de
  `directories` y de las 6 de `my-account/*`; `hiddenForTenantTypes: ['PHARMACY']` en las 4 de aseguradora y
  «Tu organización». `shell-layout.ts`: la farmacia tampoco ve «Sistema de diseño» (una línea, igual que PAYER).
- **Simulador** (`pharmacy.handlers.ts`, P47): estado del producto (`PUBLISHED`/`DRAFT`/`WITHDRAWN`), lectura
  de gestión `?managed=true`, existencias y umbral, `PATCH …/inventory` (todo o nada), categorías CRUD (409 si
  tienen productos), `imageFileIds` (hasta 3), `GET …/summary` con actividad reciente. Un borrador no sale en la
  vitrina pública.
- **Estados de la bandeja** (sólo rótulos, el contrato `EstadoDePedido` no cambió): Pendiente · Revisión de
  receta · En preparación · Listo para retiro · Finalizada · Cancelada.
- **Reglas del CSV** (`features/pharmacy/catalog-rules/catalogo.reglas.ts`, movidas con `git mv`): modo nuevo
  «Sólo actualizar», categorías por farmacia en vez de la constante, y `leerCsv` devuelve el mapeo columna→campo
  para el paso «Asignar columnas».
- Un subagente hizo la Importación (extracción + specs); el resto lo hice yo.

## Evidencia (`evidencia/B/`)

- `capturas.json` + 32 PNG: las 8 pantallas en 375 / 768 / 1440 claro y 1440 oscuro. **Contenido de `main`
  sin scroll horizontal en las 32.** Medidas por pantalla (fondo blanco, centrado 0–2 px, ancho ≥ 85 %) en
  `medidas-*.json` (1440).
- `modal-producto-publicacion-1440-claro.png`, `menu-1440-claro.png`.
- `menus-antes.json` / `menus-despues.json`: el menú de paciente, médico y aseguradora **es idéntico** antes y
  después; clínica, laboratorio y superadmin sólo pierden las 4 pantallas de farmacia.

## Hallazgos que NO se tocaron

1. **La cabecera del shell desborda a 375 px** (`app-header__account-name`, `right≈640`) en las 8 pantallas y
   también en `/dashboard`. Es preexistente y `header/` está fuera del alcance; queda en `capturas.json` como
   `desbordaLaCabecera`.
2. **`pharmacy-inbox.spec.ts` tiene 15 pruebas rojas preexistentes** (`this.auth.userId is not a function` en
   `cart.store.ts`): idéntico en `origin/mockup` sin mis cambios. Además `navigation-history.service.spec.ts`
   tiene 2 errores de lint preexistentes.
3. Las pantallas de farmacia ahora **cierran la ruta** a una sesión sin organización `PHARMACY` activa
   (`onlyForTenantTypes`; el comodín `SUPERADMIN` tampoco las abre). El plan D3 decía «sigue alcanzable por
   URL»: con este mecanismo no es así. Se documentó en P47; si se quiere lo otro hace falta un campo nuevo en
   `navigation.types.ts`.
4. Contra la **API real** casi todo lo nuevo es un 400/404: está en `PENDIENTES-BACKEND.md` P47 (actualización
   29/09, carril B). El «registro sanitario» del mockup no se dibuja: no hay dónde guardarlo.
5. «Asignar columnas» es de **lectura** (muestra el auto-mapeo por alias), no editable. Una actualización por
   CSV sin columna `disponible` vuelve a marcar el producto disponible (comportamiento previo de
   `revisarProducto`).
6. Los productos retirados cuentan como «existentes» al importar; el simulador los deja retirados si se les
   hace `PATCH` sin `status` (404).

## Lo que no se corrió

- Suite completa del front (`yarn test`): no. Sí **53 archivos / 832 pruebas** de lo tocado
  (`features/pharmacy`, `core/navigation`, `core/mock/handlers`, `core/data-access/pharmacy`, campañas,
  ficha, bandeja salvo el spec ya rojo).
- `yarn typecheck` 0 · `eslint` de lo tocado 0 · `yarn build` exit 0 · `check-route-prefixes` OK.
- No se probó en móvil real ni con lector de pantalla; sólo los cortes de arriba.
- No se corrió el stack Docker ni la API real: nada de esto lo necesita.

## Cierre

`ng serve` del carril (:4210) apagado. Sin cambios en `environments/`.
