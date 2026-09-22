# Registro de escenarios del banco

El registro real es código: `src/app/features/component-stock/escenarios/escenarios.ts`. Esta
página explica cómo se lee y qué acredita cada uno. Los campos del encargo (`fixtureFactory`,
`hostSourcePath`, `seed`, `fixedClock`, `viewport`, `networkPolicy`…) se resuelven así:

| Campo | Dónde vive |
|---|---|
| `scenarioId` | `EscenarioDeComponente.id` = `<clave>#<variante>` |
| `componentId` | `clave` (la del índice generado) |
| `sourceCommit` | El del build; el banco carga el componente con el mismo `import()` del índice |
| `hostSourcePath` / `fixtureFactory` | `fuente` y `host` (la clase del anfitrión: las fixtures son sus constantes) |
| `fixtureVersion` / `seed` | No hay semilla: los datos son literales fijos; cambiarlos es un commit |
| `fixedClock` | `DATO_DE = 2026-09-21T09:30:00-04:00` en los anfitriones que muestran fechas |
| `viewport` / `theme` / `locale` / `timezone` | Los del banco al montar: dispositivo elegido (320…1600), tema y locale de la aplicación anfitriona (`es`, `America/La_Paz` en la evidencia) |
| `expectedState` | `seVe` |
| `interactions` / `expectedOutputs` | `interacciones` y `salidasEsperadas` |
| `networkPolicy` | Los anfitriones no inyectan ningún cliente ni piden nada. **Cómo se comprueba y cómo no:** la pestaña «Red» del banco usa `PerformanceObserver` y solo ve lo que sale a la red; el backend simulado de `mockup` responde en proceso, así que una pestaña vacía prueba «nada salió», no «nadie pidió». La garantía real es estática: los anfitriones no importan clientes (`grep -L Client escenarios/*.ts`) |
| `evidencePaths` | `docs/frontend/evidence/refactor-declarativo/stock-<anfitrión>-<variante>.png` |

## Cómo se acredita un escenario

Cuatro pruebas independientes, y una ficha puede pasar unas y no otras:

| Prueba | Cómo | Estado en esta oleada |
|---|---|---|
| **Fuente** | El anfitrión importa `shared/components/organisms/<x>/<x>` — el mismo archivo que el índice carga con `import()` y que el producto usa. El banco carga el componente del índice aunque monte el anfitrión, para que la ficha y el escenario no puedan divergir | ✔ para los 3 |
| **Composición** | El anfitrión monta hijos reales: `app-badge` en celdas, `app-form-field` + `app-input` y `[dialog-actions]` en el modal, contenido proyectado en el host | ✔ |
| **Interacción** | Los `output` del organismo llegan al anfitrión y se ven en «Salidas»; `escenarios.spec.ts` los provoca por el DOM | ✔ |
| **Apariencia** | Tema, fuentes y viewport reales dentro del iframe. Paridad contra pantalla real: **no medida** | ✘ |

## Los escenarios

### `DataTable` (12)

`ready` es el de referencia: seis pacientes sintéticos, «Apellido» ordenable, tres columnas de
prioridad 2 que se pliegan en móvil, «Estado» fija al borde, tres páginas por cursor con
`historialDeCursor` (el mismo del producto). `ready-seleccionable` y `ready-navegable` encienden
`selectable` y `rowNavigable`. Los nueve restantes son los estados del `ViewState`, con el payload
obligatorio de cada uno (`nextAction` en S3, `asOf` en S7, `requestId` en S9).

### `ContentDialog` (4)

Abierto al montar, con un formulario proyectado y «Guardar» en el pie. `con-cambios` arranca
con el borrador escrito y `dismissible=false`: Escape y el fondo emiten `dismissAttempt` y el
anfitrión pregunta antes de descartar. «Guardar» se registra como `guardarSolicitado`, nunca
como éxito: en el banco no hay nada que persista.

### `ViewStateHost` (10)

Uno por estado, con contenido proyectado que solo se ve en `ready` y `stale` — es la forma de
comprobar que S7 muestra la antigüedad **y** el contenido, y que S1 no muestra ni un esqueleto.

## Aislamiento real: lo que el banco hace y lo que no

El encargo pide evaluar «una entrada de preview en documento propio, con bootstrap y providers
específicos». Evaluado; **no implementado** en esta oleada. Estado medido:

| Aspecto | Hoy | Consecuencia |
|---|---|---|
| Documento | El componente vive en el `contentDocument` del iframe: las media queries responden al ancho del marco | ✔ el responsive es real |
| Inyectores | `createComponent` recibe `environmentInjector` y `elementInjector` del padre | `SessionStore`, `Router`, `HttpClient` y el interceptor simulado son los de la aplicación anfitriona |
| `DOCUMENT` | El del padre | `ContentDialog` bloquea el scroll del `body` **del padre**, no del iframe (`lockScroll`). Inofensivo en el banco; es un ejemplo de por qué el aislamiento por iframe no alcanza |
| Sesión | Se pisaba y no se devolvía | **Corregido**: se guarda antes de «entrar como…» y se restaura al volver a «Sin sesión» y en `ngOnDestroy`. El refresh token persistido por `AuthService`, si lo hubiera, viaja con la restauración |
| Red | `PerformanceObserver` sobre `resource` | Ve lo que sale a la red y no bloquea nada. **No ve** lo que el interceptor simulado resuelve en proceso, que es todo el negocio en `mockup`: la pestaña vacía no demuestra ausencia de lecturas (el encargo lo advierte, y se confirmó en la evidencia). El ruido del servidor de desarrollo (`/@ng/`, `/@vite/`) se filtra desde esta oleada |
| Ciclo A→B→A | Cada montaje destruye los anteriores (`desmontar`) y el efecto reacciona al escenario, la cuenta y el ancho | Un montaje demorado de A no reemplaza a B: `montar` es `async` pero `desmontar` corre al inicio del siguiente; **no hay** guardia por id de ejecución si dos `cargar()` se solapan. Riesgo bajo (el `import()` es rápido y cacheado); anotado |
| `postMessage` | No se usa | — |

Lo que haría falta para el aislamiento que pide el encargo: una ruta de preview (`/design-system/
preview/<clave>?variante=…`) servida en el iframe con `bootstrapApplication` propio, un
`SessionStore` en memoria y un `HttpClient` con adaptador que bloquee lo no esperado. Es una
tarea de infraestructura del banco (TOOLING), no de esta oleada de producto.
