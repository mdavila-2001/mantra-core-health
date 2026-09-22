# Contratos de las piezas extraídas o modificadas

Solo las piezas que esta oleada crea o cambia. Los seis organismos canónicos conservan sus
contratos; los documenta su propio archivo y `docs/components/`.

## `historialDeCursor()` — nueva

| Área | Contenido |
|---|---|
| **Identidad** | `src/app/shared/components/organisms/data-table/cursor-history.ts` · `historialDeCursor(): HistorialDeCursor` · `CURSOR_ANTERIOR = 'anterior'` · regla pura de aplicación · nivel: no es un componente · ámbito: dominio (listados con cursor) |
| **Entradas** | Ninguna en la construcción. Recibe por método: `mover(cursor: string)` (cursor opaco o `CURSOR_ANTERIOR`), `llego(nextCursor: string \| null)`, `reiniciar()` |
| **Salidas** | `cursor: Signal<CursorState>` (`prevCursor` es `CURSOR_ANTERIOR` o `null`; `nextCursor` el último recibido). `actual(): string \| undefined` |
| **Funciones de entrada** | No hay. No recibe callbacks: no decide cuándo cargar |
| **Composición** | Se conecta a `app-data-table` por `[cursor]` y `(cursorChanged)` |
| **Estado** | Dueño: la instancia (una por pantalla). Transiciones: `mover` (push/pop), `llego` (fija siguiente), `reiniciar` (vuelve al inicio). Derivado: `cursor`. Se destruye con el componente que la creó; no hay suscripciones que limpiar |
| **Apariencia** | Ninguna |
| **Errores** | `mover(CURSOR_ANTERIOR)` en la primera página no rompe el historial. `llego(null)` tras un fallo conserva la página vigente |
| **Compatibilidad** | Los cuatro consumidores conservan `mover(cursor)`, `cursor` y `recargar()/retry()` en su interfaz: sus specs no cambiaron. Sin adaptador temporal |
| **Evidencia** | `cursor-history.spec.ts` (8) · specs de las 4 pantallas · `evidence/refactor-declarativo/*-pagina-*.png` y `veredictos.json` |

Tabla de transiciones:

| Estado | Evento | Precondición | Resultado |
|---|---|---|---|
| primera página | `llego('c2')` | — | `nextCursor = c2`, sin «Anterior» |
| primera página | `mover('c2')` | — | `actual() = c2`, «Anterior» disponible |
| página n | `mover(CURSOR_ANTERIOR)` | n > 1 | `actual()` = cursor de n−1 |
| primera página | `mover(CURSOR_ANTERIOR)` | — | sin cambio |
| cualquiera | `llego(null)` | — | sin «Siguiente»; la página vigente se conserva |
| cualquiera | `reiniciar()` | — | primera página, sin cursores |

## Escenarios del banco — nuevos

| Área | Contenido |
|---|---|
| **Identidad** | `src/app/features/component-stock/escenarios/` · `EscenarioDeComponente`, `AnfitrionDeEscenario`, `registroDeSalidas()` · infraestructura del catálogo (no producto: el escáner la excluye del índice) |
| **Entradas del anfitrión** | `variante: input<string>()` — la única que el banco fija con `setInput`. El resto del contrato del organismo lo decide el anfitrión en TypeScript |
| **Salidas del anfitrión** | `salidas: Signal<readonly SalidaRegistrada[]>` — `{ salida, detalle, momento }` por cada `output` recibido |
| **Composición** | Cada anfitrión importa la implementación canónica de `shared/` y le proyecta hijos reales (plantillas de celda, formulario y `[dialog-actions]`, contenido del host de estados) |
| **Estado** | Dueño: el anfitrión. Datos fijos y deterministas (sin `faker`, sin `new Date()`), para que dos montajes se vean igual |
| **Errores** | Una `variante` fuera de la unión cae en la rama por defecto del `switch` (ready) — el registro (`escenarios.ts`) solo declara variantes válidas y el spec monta todas |
| **Compatibilidad** | El montaje «a ciegas» sigue disponible como opción «Valores generados» para los componentes sin anfitrión y para comparar |
| **Evidencia** | `escenarios.spec.ts` (todas las variantes montan; salidas verificadas) · `evidence/refactor-declarativo/stock-*.png` |

Anfitriones y variantes:

| Anfitrión | Organismo | Variantes |
|---|---|---|
| `EscenarioDataTable` | `DataTable<PacienteDeMuestra>` | `ready`, `ready-seleccionable`, `ready-navegable`, `stale`, `empty`, `loading`, `route-auth-pending`, `validation`, `forbidden`, `not-found`, `offline`, `error` |
| `EscenarioContentDialog` | `ContentDialog` | `descartable`, `con-cambios`, `sm`, `xl` |
| `EscenarioViewStateHost` | `ViewStateHost<ResumenDeMuestra>` | los diez `ViewStateStatus` |

## `ComponentStock` — modificado

| Cambio | Antes | Ahora |
|---|---|---|
| Montaje | Siempre con valores generados | Por escenario si el componente tiene anfitrión; selector para elegir variante o «Valores generados» |
| Entradas rechazadas | `setInput` fallido se tragaba y la ficha decía «montado» | Se listan en «Problemas» y en la regla del marco; cuentan como problema |
| Salidas | No se observaban | Pestaña «Salidas» con lo que el anfitrión registró |
| Sesión | «Entrar como…» pisaba `SessionStore` de la aplicación y no lo devolvía | Se guarda la sesión anfitriona antes de pisarla y se restaura al elegir «Sin sesión» y al salir del banco (`ngOnDestroy`) |
| Índice | El banco y sus archivos figuraban como «pantallas» | `generate-component-index.mjs` excluye `features/component-stock/` |

Lo que **no** cambió: el iframe sigue usando los inyectores del padre (ver `ESCENARIOS.md` §
aislamiento).
