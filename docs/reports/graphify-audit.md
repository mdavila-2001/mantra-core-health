# Auditoría de estructura (Fase 1 · Graphify)

> **Fase 1 del plan documental.** El descubrimiento tenía que empezar por
> Graphify. Este informe registra por qué no pudo, con qué se reemplazó, y qué
> encontró ese reemplazo.

---

## 1. Graphify: ausente, y qué se hizo en su lugar

Se buscaron todas las fuentes que el plan enumera:

```text
graphify-out/graph.json                    ausente
graphify-out/graph.html                    ausente
graphify-out/GRAPH_REPORT.md               ausente
graphify-out/manifest.json                 ausente
graphify-out/cache/stat-index.json         ausente
graphify-out/**/.graphify_labels.json      ausente
graphify-out/<fecha>/…                     ausente
```

```bash
$ ls -d graphify-out
ls: graphify-out: No such file or directory
```

**No existe ningún artefacto de Graphify en este repositorio.** Generarlo habría
significado ejecutar una herramienta de análisis que escribe una carpeta nueva en
la raíz del proyecto y consume el modelo sobre las 336 fuentes; el plan permite
explícitamente la alternativa: *«Si Graphify no existe o no soporta adecuadamente
el stack, documentar la limitación y complementar con análisis estático
reproducible sin modificar producción.»*

### El sustituto

`scripts/lib/scan.mjs` construye el mismo grafo que Graphify produciría para un
repositorio de código: **nodos = archivos, aristas = importaciones**. Resuelve los
alias `@shared`, `@core/*` y `@features/*` contra `tsconfig.json`, separa los
paquetes externos de los internos, y de él salen las tres preguntas que el plan
exige responder: ciclos, huérfanos y centralidad.

Es reproducible, no añade dependencias, no escribe fuera de `docs/`, y su salida
se regenera con una orden:

```bash
node scripts/generate-inventory.mjs          # escribe docs/reports/generated/
node scripts/generate-inventory.mjs --check  # falla si el código cambió y el inventario no
```

**Lo que el sustituto no hace, y Graphify sí:** detección de comunidades,
etiquetado semántico, nodos-dios y consultas en lenguaje natural. Para un
repositorio de 211 archivos TypeScript con una jerarquía declarada
(`core`/`shared`/`features` + atomic design), esas capacidades habrían confirmado
una estructura que ya está explícita en el árbol de carpetas. La limitación queda
registrada como tal.

## 2. Inventario de nodos

Medido, no estimado, **en el momento de la Fase 1**. Fuente:
`docs/reports/generated/`.

> **Las cifras de esta sección son una fotografía.** El trabajo concurrente
> descrito en [la línea base §1.1](baseline.md#11--trabajo-concurrente-durante-la-medición)
> añadió después un archivo y tres aristas (`env.generated.ts` y sus dos
> importadores), y tres pruebas. Los inventarios generados llevan **siempre** el
> número vigente; ésta es la lectura del momento en que se hizo el análisis.
> Ninguna conclusión cambia.

| Tipo de nodo | Cantidad | Dónde |
|---|---:|---|
| Archivos TypeScript | 211 | `src/**/*.ts` |
| Archivos totales | 336 | `src/**` (ts + html + css) |
| Componentes | 61 | ver desglose |
| Servicios inyectables | 15 | 13 en `core/`, 2 en `shared/` |
| Rutas declaradas | 11 | `app.routes.ts` (8 navegables + 1 layout + 1 redirección + comodín) |
| Clientes de API | 6 | `core/data-access/*/` |
| Operaciones HTTP | 20 | ver [inventario de API](generated/api-inventory.md) |
| Guards | 1 | `authGuard` |
| Interceptores | 1 | `authInterceptor` |
| Archivos de prueba | 71 | `**/*.spec.ts` |
| Pruebas | 804 | ejecución de `yarn test` |

### Componentes por nivel

| Nivel | Cantidad | Con prueba |
|---|---:|---:|
| Átomos | 15 | 14 |
| Moléculas | 19 | 15 |
| Organismos | 14 | 12 |
| Features (pantallas y galerías) | 11 | 7 |
| Core (herramienta de desarrollo) | 1 | 0 |
| Raíz (`app-root`) | 1 | 1 |
| **Total** | **61** | **49** |

Los 12 componentes sin archivo de prueba propio están listados con nombre en
[el inventario generado](generated/component-inventory.md#componentes-sin-prueba)
y analizados en [la estrategia de pruebas](../testing/strategy.md#componentes-sin-prueba-propia).
Casi todos son **subcomponentes que solo existen dentro de su padre**
(`TooltipPanel`, `AccordionPanel`, `MenuItem`, `Radio`, `Tab`) y quedan
ejercitados por la prueba del padre; eso explica que la cobertura de `shared/`
sea del 94 % pese a los huecos de esta columna.

### Ausencias verificadas

Nodos que un frontend de este tamaño suele tener y **este no**:

| Tipo de nodo | Estado |
|---|---|
| Store global (NgRx, Akita, Elf) | No existe. El estado es de señales, en servicios `providedIn: 'root'` |
| Capa de caché de estado remoto (TanStack Query o equivalente) | No existe. Cada pantalla llama al cliente y guarda el resultado en una señal |
| Resolvers de ruta | No existe. Los datos se piden desde el componente |
| Módulos NgModule | No existe. Todo es standalone |
| Archivos de traducción | No existe |
| Service worker / PWA | No existe |
| Web workers | No existe |

## 3. Inventario de relaciones

### 3.1 · Importaciones

**587 importaciones internas** entre los 211 archivos, más 10 paquetes externos:

| Paquete | Importaciones |
|---|---:|
| `@angular/core` | 185 |
| `@angular/common` | 51 |
| `@angular/router` | 34 |
| `@angular/forms` | 14 |
| `node:fs` | 12 |
| `rxjs` | 10 |
| `@angular/platform-browser` | 4 |
| `@angular/ssr` | 3 |
| `express` | 1 |
| `node:path` | 1 |

`node:fs` aparece **solo en archivos de prueba**: hay una familia de pruebas que
lee `src/styles.css` desde el disco para comprobar que los tokens declarados en
TypeScript existen realmente en CSS. Es una defensa contra la deriva entre las dos
fuentes, y está documentada en
[pruebas unitarias](../testing/unit-tests.md#las-pruebas-que-leen-el-css-del-disco).

Solo 10 paquetes de terceros, todos de Angular o de su cadena de arranque:
**la superficie de dependencias en tiempo de ejecución es mínima.**

### 3.2 · Dependencias circulares

```text
Ciclos detectados: 0
```

Ninguna. No es casualidad: `tsconfig.json` declara las tres fronteras
(`@core`, `@shared`, `@features`) y `src/app/shared/index.ts` documenta la regla
que las sostiene — *«`shared/` NUNCA importa de `features/`»*. La comprobación
está automatizada en [`check-architecture.mjs`](../governance/documentation-policy.md#verificaciones-automáticas).

### 3.3 · Alta centralidad

Los archivos que más se importan. Un número alto no es un defecto: es el precio
que cuesta cambiarlos.

| Archivo | Lo importan | Lectura |
|---|---:|---|
| `atoms/button/button.ts` | 25 | El botón es el control universal. Cambiar su API toca un tercio de la interfaz |
| `shared/forms/form-control.context.ts` | 19 | El contrato de accesibilidad entre un campo y su control. Es el nodo más crítico que nadie ve |
| `core/view-state/view-state.types.ts` | 14 | Los 9 estados del M34. Es el vocabulario compartido de toda la aplicación |
| `core/view-state/view-state.ts` | 12 | Sus constructores |
| `atoms/input/input.ts` | 11 | |
| `molecules/form-field/form-field.ts` | 11 | |
| `atoms/link/link.ts` | 9 | |
| `core/auth/session.store.ts` | 8 | La sesión. Todo lo protegido pasa por acá |
| `core/auth/auth.service.ts` | 7 | |

**Los dos nodos que gobiernan el sistema son `view-state.types.ts` y
`form-control.context.ts`**, y ninguno de los dos es una pantalla. Es la señal de
que la arquitectura está organizada alrededor de contratos y no de features, que
es lo que el modelo del proyecto (M34) pide.

### 3.4 · Archivos que nadie importa

```text
src/app/shared/index.ts
src/environments/environment.development.ts
```

Los dos son **falsos positivos explicables, no código muerto**:

- `shared/index.ts` es el barril público de `shared/`. Su razón de ser es
  documental: fija qué de `shared/` es API pública. **Hoy no lo importa nadie** —
  `from '@shared'` a secas no aparece en el código; los 21 archivos que usan el
  alias lo hacen por ruta profunda (`@shared/components/...`). Es una observación
  real, anotada en
  [reglas de composición](../components/composition-rules.md#el-barril-y-las-rutas-profundas).
- `environment.development.ts` lo inyecta el builder por `fileReplacements` en
  `angular.json`, no un `import`. Ningún grafo de importaciones puede verlo.

**No hay código huérfano real.**

### 3.5 · Llamadas a la API

20 operaciones, todas en `core/data-access/**/*.client.ts`. **Ningún componente
arma una URL por su cuenta** — verificado: la búsqueda de `this.http` fuera de esa
carpeta no devuelve nada. El mapa completo está en
[el mapa de integraciones](../architecture/integration-map.md).

### 3.6 · Lectura y escritura de estado

| Estado | Quién escribe | Quién lee |
|---|---|---|
| Sesión (`SessionStore`) | `AuthService`, `TokenRefreshService` | `authGuard`, `authInterceptor`, `ShellLayout`, `Dashboard`, `TenantSelection` |
| Tema (`ThemeService`) | La vitrina y el encabezado | `document.documentElement`, y de ahí todo el CSS |
| Ancho de ventana (`Breakpoints`) | `matchMedia` | `ShellLayout` → `Shell` |
| Avisos (`ToastService`) | Cualquier pantalla | `ToastContainer` |
| Panel lateral (`ShellService`) | `Shell` | `Shell` |

### 3.7 · Navegación

Las transiciones programáticas —`router.navigateByUrl`— salen de seis lugares y
todas están documentadas en [routing y navegación](../architecture/routing-and-navigation.md#navegación-programática).

### 3.8 · Duplicación relevante

Tres duplicaciones **deliberadas y con prueba que las vigila**. No son deuda:

| Qué se duplica | Dónde | Por qué no se puede unificar |
|---|---|---|
| La escala de breakpoints | `src/styles.css` (`--bp-*`) y `core/tokens/breakpoints.ts` | CSS no admite custom properties dentro de un `@media` |
| El umbral del cajón de navegación (780 px) | `shell.css`, `side-nav.css` y `core/layout/breakpoints.ts` | El CSS decide cómo se ve; el TS decide si el botón de menú existe en el árbol |
| La clave del tema en `localStorage` | `index.html` (script anti-parpadeo) y `theme.service.ts` | El script corre antes de que exista Angular |

Cada una tiene una prueba que compara las dos fuentes y falla si se separan. Está
documentado en [tokens](../design-system/tokens.md#las-tres-duplicaciones-necesarias).

## 4. Contraste con las otras fuentes

El plan exige contrastar el grafo con seis fuentes. Resultado:

| Fuente | Coincide | Divergencia encontrada |
|---|---|---|
| Árbol real del repositorio | ✅ | — |
| Router (`app.routes.ts`) | ✅ | — |
| Manifiestos del framework (`angular.json`) | ✅ | — |
| Cliente API vs. OpenAPI del backend | ⚠️ | El OpenAPI no está accesible desde este repositorio: ver §5 |
| Pruebas | ✅ | 12 componentes sin prueba propia, todos identificados |
| Sistema de diseño | ⚠️ | Una deriva declarada: ver §5 |
| Configuración de build y despliegue | ⚠️ | No hay despliegue de producción definido: ver §5 |

## 5. Derivas encontradas

Se registran; **no se corrigen**. Corregir cualquiera de ellas es un cambio de
producto. Están priorizadas en
[el análisis de brechas](documentation-gap-analysis.md).

### D1 · Un comentario de `login.ts` contradice al propio código

`src/app/features/auth/login/login.ts` declara en su comentario de clase:

> *«No hay enlace de "olvidé mi contraseña": **la API no tiene ese endpoint**
> todavía. Un enlace que no lleva a ningún lado es peor que su ausencia.»*

Pero `login.html` **sí tiene ese enlace** (`routerLink="/auth/forgot-password"`), la
ruta existe, el componente `ForgotPassword` existe y `IamClient.forgotPassword`
llama a `POST /iam/auth/forgot-password`. El comentario quedó de una etapa
anterior; `PENDIENTES-BACKEND.md` §«La recuperación de contraseña llegó» confirma
que el endpoint se entregó después.

**Comportamiento real: el enlace funciona.** Es el comentario el que está viejo.

### D2 · La raíz de la API ya es configurable — RESUELTA por trabajo ajeno

Al empezar la Fase 1, `environment.ts` traía un `TODO` («fijar la raíz real de la
API cuando exista el despliegue») y `apiBaseUrl` fijo en `''`. Un despliegue con
la API en otro dominio exigía **editar código y recompilar**.

Durante esta misma sesión, el trabajo concurrente descrito en
[la línea base §1.1](baseline.md#11--trabajo-concurrente-durante-la-medición) lo
resolvió: `PUBLIC_API_BASE_URL` entra por entorno, `scripts/generate-env.mjs` la
traduce a `src/environments/env.generated.ts`, y los dos archivos de entorno solo
aportan el respaldo vacío.

**Queda un residuo, y sigue abierto:** vacío significa *mismo origen*, y ningún
documento de despliegue dice todavía si el despliegue de producción va a poner la
API detrás del mismo dominio o en otro. La decisión, no el mecanismo, es lo que
falta. Ver [configuración](../operations/configuration.md) y
[el informe de preparación productiva](production-readiness.md).

### D3 · `.env.example` se referenciaba sin existir — RESUELTA por trabajo ajeno

`docker-compose.yml`, `Dockerfile.dev`, `.dockerignore` y `.gitignore` mencionaban
`.env.example` como si estuviera en el repositorio, y no estaba: la única
plantilla que le dice a alguien nuevo qué variables existen.

El mismo trabajo concurrente lo creó, con las tres variables reales
(`PUBLIC_API_BASE_URL`, `PORT`, `FRONTEND_PORT`, `BACKEND_ORIGIN`) y la
advertencia de que nada de lo público es secreto. Este trabajo documental **no lo
tocó**; lo describe en
[variables de entorno](../getting-started/environment-variables.md).

### D4 · El sistema de diseño se declara en dos escalones distintos

`design-tokens.types.ts` declara `SPACING_STEPS` con 11 escalones y
`RADIUS_NAMES` con 8 nombres, incluido `signature`. `styles.css` los define todos.
No hay deriva de **valores** — hay una prueba que la vigila. Lo que sí falta es la
comprobación inversa: un token declarado en CSS y ausente en TypeScript pasaría
sin aviso. Registrado como brecha `MEDIUM`.

### D5 · El OpenAPI del backend no es alcanzable desde este repositorio

Los tipos de `core/data-access/**` se escribieron **a mano** contra el contrato
del backend, con la referencia anotada en comentarios («copiados de
`src/common/errors/error-codes.ts` del backend», «verificadas una por una contra
`iam-auth.controller.ts`»). Es rastreable, pero no verificable de forma
automática desde acá.

`scripts/check-api-contract-drift.mjs` compara los endpoints del código contra la
lista declarada en [la documentación de la API](../integrations/backend-api.md) —
detecta que alguien agregue una llamada sin documentarla, pero **no** puede
detectar que el backend cambie el contrato. Esa segunda mitad exige acceso al
OpenAPI y queda como requisito abierto.

## 6. Criterio de salida de la Fase 1

| Requisito | Estado |
|---|---|
| Artefactos de Graphify consultados | ✅ Verificada su ausencia |
| Limitación documentada y sustituto justificado | ✅ §1 |
| Nodos inventariados | ✅ §2 y `generated/` |
| Relaciones inventariadas | ✅ §3 |
| Ciclos, huérfanos y centralidad revisados | ✅ §3.2–3.4 |
| Contraste contra las demás fuentes | ✅ §4 |
| Derivas registradas sin corregirlas | ✅ §5 |
| Entregables generados | ✅ [dependencias](../architecture/module-dependencies.md) · [integraciones](../architecture/integration-map.md) · [trazabilidad](../governance/traceability-matrix.md) |
