# Refactor frontend · código limpio y declarativo

Punto de entrada del encargo «Prompt maestro de refactorización frontend» (código limpio y
declarativo · smart/presentational · atomic design · reutilización semántica · catálogo real de
`mockup`). Se aplica **sobre** el protocolo del repositorio (`FABLE_FRONTEND_REFACTOR_PLAYBOOK.md`,
`docs/frontend/FABLE_STACK.md`, ADR-0005 y las reglas de `CLAUDE.md`), no en su lugar.

| | |
|---|---|
| **Base** | `origin/mockup` @ `5a0776c66b005ad4d2d6722321e933cd7adea621` (2026-09-21) |
| **Rama** | `pablo/refactor-frontend-declarativo` |
| **Toolchain resuelto** | Node 22.23.1 · Yarn 4.18.0 (`nodeLinker: node-modules`) · Angular 21.2.18 / CLI 21.2.19 · TypeScript 5.9.3 · Vitest 4.1.10 · Playwright 1.62.1 |
| **Artefactos** | [Familias](refactor-declarativo/FAMILIAS.md) · [Contratos](refactor-declarativo/CONTRATOS.md) · [Migración](refactor-declarativo/MIGRACION.md) · [Escenarios](refactor-declarativo/ESCENARIOS.md) · [Grafo de usos](refactor-declarativo/usos-organismos.md) · [Ejecución](refactor-declarativo/EJECUCION.md) · [Evidencia](evidence/refactor-declarativo/README.md) |

## Diagnóstico (hechos, no supuestos)

Lo que el repositorio **ya tenía** al llegar, medido sobre el corte:

- Los seis organismos canónicos que el encargo pide evaluar existen, con contrato escrito y
  adopción real: `DataTable` en 28 pantallas de producto, `ContentDialog` en 24, `ViewStateHost`
  en 65, `PageHeader` en 169, `DirectoryPage` en 5, `FilterBar` en 4 (más los organismos que la
  componen). Cero imports sin instanciar, cero selectores sin importar
  ([grafo](refactor-declarativo/usos-organismos.md)).
- `ViewState<T>` tiene las diez variantes que el encargo enumera, con `nextAction`, `asOf` y
  `requestId` obligatorios por tipo. No se tocó.
- El catálogo (`/design-system/stock`) descubre 537 componentes por regex y los monta con valores
  adivinados por nombre y tipo. Para los organismos eso no alcanza: `DataTable` recibía
  `columns = ''`, `trackBy = ''` y `state = ''` (la ficha fallaba o pintaba un contenedor vacío
  mientras el `setInput` rechazado se tragaba en silencio), `ViewStateHost` mostraba siempre la
  rama `ready`, `DirectoryPage` no montaba. Además, «entrar como…» pisaba la sesión de la
  aplicación anfitriona sin devolverla, y el propio banco figuraba en su índice como una
  «pantalla».
- Cuatro listados de producto escribían a mano, línea por línea, la misma regla de paginación
  por cursor con memoria (tres signals, un centinela, reinicio al filtrar), y el mismo comentario
  explicándola.
- Las 70 tablas a mano de `features/alovida/**` son la maqueta portada, declarada en pantalla como
  «referencia de diseño, no la aplicación» (ADR-0014, rama vecina). No son deuda de adopción.

## Lo que se hizo en esta oleada

### Fase 1 · Contrato mínimo y evidencia fiable (catálogo)

- **Escenarios tipados**: un registro en TypeScript (`features/component-stock/escenarios/`) con
  tres anfitriones que importan la implementación canónica, la montan con un contrato válido,
  le proyectan hijos reales y registran sus salidas. `DataTable` (12 variantes: las diez del
  `ViewState` más selección y fila navegable), `ContentDialog` (4: descartable, con cambios
  pendientes, `sm`, `xl`) y `ViewStateHost` (10). Datos fijos, sin `faker` ni `new Date()`.
- **El banco** monta por escenario cuando hay anfitrión, con selector de variante y la opción
  «Valores generados» para comparar; pestaña «Salidas»; las entradas rechazadas por `setInput`
  dejan de tragarse y cuentan como problema; la sesión anfitriona se guarda y se restaura; el
  ruido del servidor de desarrollo sale de la pestaña «Red».
- **El escáner** excluye la infraestructura del banco del índice (537 → 536).
- **Grafo de usos** diferenciado (`scripts/inventario-organismos.mjs`): `imports-available`,
  `template-instantiates` con condición de renderizado, `projection-composes`, `type-only`,
  `dynamic-loads`; producto, catálogo, maqueta y prueba contados por separado.

### Fase 2 · Primera extracción con adopción (producto)

- **`historialDeCursor()`** (`shared/components/organisms/data-table/cursor-history.ts`): la
  regla de «cursor hacia adelante con memoria», escrita una vez, con su tabla de transiciones y
  8 pruebas propias.
- **Cuatro consumidores reales migrados**: `patient-list`, `organization-list`,
  `services-catalog`, `insurance-claims`. Sus specs no se editaron y siguen en verde: fijan la
  conducta a través de la interfaz del componente (`mover`, `cursor`, reintento, filtro).
  Sin cambio de plantilla ni de CSS: la apariencia se conserva por construcción. Las tres
  copias de la regla se retiraron; no queda adaptador temporal.
- El anfitrión de `DataTable` del catálogo usa el mismo `historialDeCursor`: catálogo y producto
  montan la misma pieza.

### Decisiones registradas sin implementar

- **F-02** (búsqueda en la URL): `FilterBar` ya es la implementación canónica; adoptarla en los
  cuatro listados cambia la anatomía visible («Limpiar todo», ancho del buscador). Decisión de
  producto, no de refactor. Ficha F-02 en [Familias](refactor-declarativo/FAMILIAS.md).
- **Aislamiento del preview**: evaluado y documentado; el iframe sigue usando los inyectores del
  padre. Implementar un documento con bootstrap propio es tarea de infraestructura del banco.
  Sección «Aislamiento real» en [Escenarios](refactor-declarativo/ESCENARIOS.md).

## Cómo reproducir

```bash
git worktree add ../mch-refactor -b pablo/refactor-frontend-declarativo origin/mockup   # o checkout de la rama
corepack yarn install --immutable
corepack yarn stock:generate && corepack yarn lint && corepack yarn typecheck
corepack yarn ng test --watch=false \
  --include "src/app/shared/components/organisms/data-table/**/*.spec.ts" \
  --include "src/app/features/component-stock/**/*.spec.ts"
corepack yarn test                                   # suite completa; ver EJECUCION.md por los 3 fallos preexistentes
node scripts/inventario-organismos.mjs --check       # el grafo refleja el código
node scripts/check-architecture.mjs                  # 5 hallazgos preexistentes, idénticos en la base
corepack yarn ng serve --port 4377                   # y en otra terminal:
corepack yarn node playwright/refactor-declarativo-evidencia.mjs http://localhost:4377 /tmp/evidencia
```

Para ver los escenarios a mano: `/design-system/stock/shared/components/organisms/data-table/data-table`
y elegir la variante en «Escenario».

## Revisión adversarial (las veinte preguntas del encargo, respondidas)

| # | Pregunta | Respuesta con evidencia |
|---|---|---|
| 1 | ¿Se aprobaría moviendo archivos sin cambiar responsabilidades? | No: la regla del cursor dejó de vivir en cuatro contenedores y pasó a una función con spec propio; los contenedores perdieron 66 líneas de estado duplicado |
| 2 | ¿Smart gigante → fachada gigante? | No hay fachada: `historialDeCursor` tiene cuatro métodos y una señal |
| 3 | ¿UI que consigue negocio por una dependencia con nombre inocente? | Los anfitriones del catálogo no inyectan clientes (`grep -L Client escenarios/*.ts`); el historial no conoce HTTP |
| 4 | ¿Dos estados para el mismo hecho? | `cursor` es un `computed` de `historia` y `siguiente`; los contenedores ya no tienen copia |
| 5 | ¿El componente nuevo necesita saber qué pantalla lo usa? | No: cuatro pantallas y un anfitrión lo usan sin parámetros |
| 6 | ¿La extracción borra una diferencia de dominio? | Cada pantalla conserva cliente, tamaño de página, filtros y sus dos vacíos |
| 7 | ¿Una variación decorativa produjo otro organismo? | No se creó ningún organismo |
| 8 | ¿El contrato permite usos inválidos sin check? | `mover('anterior')` en la primera página y `llego(null)` tras fallo están probados |
| 9 | ¿La tabla del catálogo está vacía? | Seis filas, columnas con plantillas, `trackBy`, orden, cursor y selección (`stock-data-table-ready.png`) |
| 10 | ¿La demo recrea la pantalla? | El anfitrión importa `shared/…/data-table/data-table`, el mismo archivo que el índice carga y el producto usa |
| 11 | ¿El producto usa el duplicado mientras el catálogo muestra la pieza nueva? | Las cuatro pantallas y el anfitrión usan `historialDeCursor`; no queda `VOLVER`/`BACK` en `features/**` |
| 12 | ¿Un cambio externo pierde selección, borrador o respuesta? | El historial no toca selección ni borradores; el filtro reinicia el cursor como antes |
| 13 | ¿Un cierre esquiva la protección de cambios? | El escenario `con-cambios` prueba Escape y fondo → `dismissAttempt` (spec + navegador) |
| 14 | ¿Un output se llama éxito? | `guardarSolicitado`, y el spec verifica que no exista `guardadoExitoso` |
| 15 | ¿El iframe comparte sesión o servicios? | **Sí, todavía** (inyectores del padre). Se corrigió que la sesión se pisara sin devolverla; el resto está documentado como pendiente |
| 16 | ¿Un mock exitoso se presenta como integración? | La evidencia dice «backend simulado» en cada veredicto; la API real no se tocó |
| 17 | ¿Se retiró código sin revisar consumidores dinámicos? | Lo retirado eran constantes y signals privados; el grafo de usos no muestra otro consumidor |
| 18 | ¿Se declara verificado algo solo inspeccionado? | La paridad visual del catálogo contra pantalla real está en ✘ a propósito; el aislamiento en «pendiente» |
| 19 | ¿El informe oculta pendientes reduciendo el denominador? | 4/4 consumidores de F-01; 3/6 organismos con escenario; F-02 diferida con motivo; 3 fallos de suite preexistentes listados |
| 20 | ¿Otra persona puede ubicar la regla y cambiarla? | `cursor-history.ts`, 120 líneas con la tabla de transiciones en `CONTRATOS.md` |

## Pendiente dentro del alcance

| Ítem | Tipo de bloqueo | Siguiente paso |
|---|---|---|
| F-02 · `FilterBar` en los cuatro listados | decisión de producto | Confirmar «Limpiar todo» y ancho; migrar con los specs existentes |
| Escenarios de `DirectoryPage`, `PageHeader`, `FilterBar` | implementación | `DirectoryPage` primero: es el único que hoy no monta |
| Paridad visual catálogo ↔ pantalla real | implementación | Captura del organismo en el marco y en su pantalla con los mismos datos y viewport |
| Preview con documento e inyectores propios | decisión + implementación | Ruta `/design-system/preview/<clave>` con `bootstrapApplication` y `SessionStore` en memoria |
| Guardia por id de ejecución en `montar()` | implementación | Ignorar el `import()` resuelto si otro montaje empezó después |
