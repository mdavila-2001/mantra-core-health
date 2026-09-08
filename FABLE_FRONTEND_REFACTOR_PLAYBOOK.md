> ## ⚠ ADAPTACIÓN OBLIGATORIA ANTES DE USAR ESTE DOCUMENTO
>
> Este playbook está escrito para un stack **React / Tailwind / npm** genérico.
> **Este repositorio es Angular 21 standalone con señales, CSS plano con 188
> custom properties y Yarn 4 PnP.**
>
> **Leer primero `docs/frontend/FABLE_STACK.md`.** Cuando ese documento y éste
> discrepen, **manda `FABLE_STACK.md`**. En particular quedan sin efecto acá:
> los capítulos de instalación (8–14, 83–86, 92, 94), `frameworks-react`,
> `component-refactoring` de React y `tailwind-design-system`.
>
> Las fases 1–3 (inventario, design system, matriz de rutas y de componentes)
> **ya están hechas** en `docs/`: no las reconstruyas.
>
> Lo que sigue es el documento original, sin modificar, como referencia de
> registro. Su valor está en los principios, los gates, la taxonomía de
> defectos, los contratos de agente y las definiciones de terminado — todo eso
> sí aplica tal cual.

---

# FABLE — Claude Code Frontend Refactor Playbook

> **Objetivo:** transformar un frontend que "funciona" pero se siente inconsistente, genérico o "vibe coded" en una interfaz profesional, coherente, mantenible, responsive y verificable con evidencia real.
>
> **Modo de trabajo:** FABLE-style, outcome-first, evidence-driven, con microtareas, gates obligatorios, revisión independiente y rework hasta aceptación.
>
> **Fecha de verificación de fuentes:** 2026-09-08

---

# 0. TL;DR EJECUTIVO

Este protocolo NO consiste en pedir:

> "haz que la página se vea más bonita"

Ni tampoco en lanzar un agente a reescribir todo el frontend de una sola vez.

El flujo correcto es:

```text
DISCOVERY → BASELINE → SPEC NORMALIZATION → DESIGN SYSTEM EXTRACTION
→ DAG DE RUTAS / COMPONENTES / DEPENDENCIAS
→ MICROTAREA → TRACE → REPRODUCE → CONTRACT → IMPLEMENT
→ STATIC GATE → TEST GATE → RUNTIME GATE → PLAYWRIGHT GATE → EVIDENCE GATE
→ CRITIQUE → POLISH / ADAPT / HARDEN
→ INDEPENDENT REVIEW → REWORK LOOP → REGRESSION
→ ATOMIC COMMIT → INTEGRATION → REMOTE / PR → FINAL REPORT
```

Regla central:

```text
NO_EVIDENCE_NO_DONE
NO_SELF_APPROVAL
NO_BIG_BANG_REWRITE
NO_TEST_WEAKENING
NO_VISUAL_CLAIM_WITHOUT_BROWSER_PROOF
```

---

# 1. PRINCIPIOS FABLE NO NEGOCIABLES

## 1.1 Outcome first

Cada tarea debe empezar por el resultado observable.

Malo: `Refactorizar Dashboard.tsx.`

Bueno:

```text
El dashboard de paciente debe:
- ocupar el ancho disponible;
- mantener jerarquía visual consistente;
- no mostrar grids impropios del panel principal;
- conservar toda funcionalidad existente;
- funcionar a 390, 768, 1024, 1440 y 1920 px;
- no producir errores de consola;
- mantener navegación, permisos y persistencia;
- quedar validado mediante Playwright y screenshots.
```

El archivo tocado es una consecuencia. El resultado es el contrato.

## 1.2 Fuentes de verdad permitidas

Toda decisión debe poder rastrearse a una fuente:

```text
SPEC | CODE | RUNTIME | TEST | EXTERNAL-DOC
```

Prohibido justificar cambios mediante: "parece que", "seguramente", "esto
debería ser", "Claude cree que", "probablemente".

Cuando exista contradicción, **RUNTIME + TEST** tienen prioridad para describir
el comportamiento actual. La especificación define el comportamiento objetivo.

## 1.3 Claim ladder

Ninguna afirmación pasa directamente de "idea" a "terminado".

```text
UNKNOWN → DISCOVERED → WRITTEN → RUNS → TESTED → VERIFIED → REGRESSION_VERIFIED
```

"El modal funciona" sólo puede decirse cuando: fue localizado; se modificó;
compila; se ejecuta; tiene prueba; Playwright lo abrió y verificó; la regresión
no rompió rutas relacionadas.

## 1.4 NO_EVIDENCE_NO_DONE

Una tarea visual NO está terminada porque el build pasa. Requiere, como mínimo:

```text
navegador real · URL exacta · viewport exacto · rol utilizado · interacción
realizada · assertion · screenshot · ausencia de errores de consola relevantes ·
ausencia de page errors · validación de network cuando corresponda ·
validación de persistencia cuando haya mutación
```

## 1.5 NO_SELF_APPROVAL

El agente que implementa NO aprueba su propio trabajo.

Roles mínimos: `IMPLEMENTER`, `REVIEWER`. Para trabajo crítico: `IMPLEMENTER`,
`REVIEWER`, `AUDITOR`, `ORCHESTRATOR`.

El reviewer debe tratar la implementación como potencialmente defectuosa hasta
demostrar lo contrario.

## 1.6 Una lane activa

Regla: **1 lane activa + máximo 1 subagente especializado simultáneo.**

No permitir dos escritores concurrentes sobre: el router, el layout raíz, el
theme, los estilos globales, los design tokens ni los componentes compartidos.

---

# 2. CLASIFICACIÓN DEL STACK

| Tipo | Qué es | Ejemplo |
|---|---|---|
| Plugin | Paquete instalable con skills, agentes, hooks, comandos y MCP | `frontend-design` |
| Skill | Instrucciones especializadas cargadas por Claude | `component-refactoring` |
| MCP | Servidor que da herramientas externas a Claude | Playwright MCP |
| Hook | Automatización que se ejecuta ante eventos | detector de Impeccable |
| Custom skill | Skill propia del repositorio | `visual-quality-gate` |
| Agent | Rol especializado con herramientas y contrato | visual reviewer |

---

# 3–14. STACK E INSTALACIÓN

> **Sustituido por `docs/frontend/FABLE_STACK.md`.** El original describía la
> instalación de `frontend-design`, `feature-dev`, `code-review`,
> `security-guidance`, `code-simplifier`, Impeccable, Taste, `frontend-skills` y
> Playwright MCP para un entorno npm/React. En este repositorio Playwright ya
> está instalado, el gestor es Yarn 4 PnP, y los paquetes de terceros no
> auditados no se instalan (política de la sección 86 del propio playbook).
>
> Fuentes originales conservadas en la sección 97.

---

# 15. ESTRUCTURA FABLE DENTRO DEL REPO

```text
.claude/
├── skills/
│   ├── project-design-system/SKILL.md
│   ├── visual-quality-gate/SKILL.md
│   ├── frontend-production-gate/SKILL.md
│   └── fable-refactor-orchestrator/SKILL.md
└── agents/
    ├── visual-reviewer.md
    ├── frontend-reviewer.md
    └── regression-auditor.md

docs/frontend/
├── FABLE_STACK.md        ← ataduras a este repo (manda sobre este playbook)
├── INVENTORY.md          ← índice al inventario ya existente
├── REFACTOR_DAG.md
├── VISUAL_BASELINE.md
└── evidence/
```

Las custom project skills van en `.claude/skills/<name>/SKILL.md`.

---

# 16–19. CUSTOM SKILLS

Implementadas en `.claude/skills/`, adaptadas a este repositorio:

| Skill | Qué impone |
|---|---|
| `project-design-system` | Reutilizar antes de crear · sin valores visuales arbitrarios · nueve estados M34 · responsive por contrato · preservar semántica · accesibilidad · Angular standalone + señales |
| `visual-quality-gate` | `NO_EVIDENCE_NO_DONE` · cinco viewports · qué inspeccionar · evidencia · prueba de mutación · prueba de permisos · puntuación /100 con umbral 92 |
| `frontend-production-gate` | Comandos reales del repo · prohibiciones sin justificación · tamaño de componente · estados obligatorios · checks previos al commit |
| `fable-refactor-orchestrator` | Reglas absolutas · escalera de fuentes · escalera de afirmación · franja única · ciclo de microtarea · comportamiento ante fallo · integración |

---

# 20. FASE 0 — FREEZE Y BASELINE

Objetivo: saber exactamente qué existe antes de tocarlo.

```bash
git status
git rev-parse HEAD
git log -1 --oneline
```

Registrar: `BASE_SHA`, rama, cambios locales, URL de runtime, comando de
frontend, URL de API, roles disponibles, origen de credenciales de prueba.

**No guardar credenciales en el `.md`.**

---

# 21-23. INVENTARIO, ROUTE MATRIX, COMPONENT MATRIX

> **Ya hechos en este repositorio.** Ver `docs/frontend/INVENTORY.md`, que indexa
> `docs/routes/route-catalog.md`, `docs/components/catalog.md`,
> `docs/design-system/` y los inventarios generados en
> `docs/reports/generated/`. Reconstruirlos seria `ARCH-DUPLICATE`.

Formato de referencia, por si se necesita para una superficie nueva:

```markdown
| ID | Route | Role | Layout | Main component | APIs | Mutations | Risk | Visual priority |

| Component | Used by | LOC | Variants | Duplication | State complexity | Refactor |
```

Riesgo: `L` bajo, `M` medio, `H` alto, `C` critico.

---

# 24. FASE 2 - BASELINE VISUAL REAL

Para cada ruta prioritaria, en los cinco viewports, capturar el estado previo en
`docs/frontend/evidence/baseline/<ID>/<ancho>x<alto>.png`.

No juzgar solo la imagen. Registrar tambien consola, red, observaciones de
accesibilidad, defectos responsive y comportamiento roto.

---

# 25. DEFECT TAXONOMY

```text
VISUAL         VIS-SPACING · VIS-TYPE · VIS-COLOR · VIS-RADIUS · VIS-SHADOW
               VIS-ALIGNMENT · VIS-DENSITY · VIS-HIERARCHY · VIS-ICON

RESPONSIVE     RESP-OVERFLOW · RESP-CLIP · RESP-WRAP · RESP-TABLE
               RESP-DIALOG · RESP-NAV · RESP-GRID

UX             UX-LABEL · UX-DISCOVERABILITY · UX-FEEDBACK · UX-EMPTY
               UX-ERROR · UX-LOADING · UX-CONFIRMATION

ARCHITECTURE   ARCH-DUPLICATE · ARCH-GOD-COMPONENT · ARCH-STATE
               ARCH-BUSINESS-LOGIC · ARCH-HOOK · ARCH-SERVICE

ACCESSIBILITY  A11Y-KEYBOARD · A11Y-FOCUS · A11Y-LABEL · A11Y-CONTRAST
               A11Y-SEMANTICS · A11Y-DIALOG
```

---

# 26-28. DESIGN SYSTEM

Primero **descubrir**, no imponer. Clasificar cada valor en:

```text
CANONICAL · LEGACY · DUPLICATE · ACCIDENTAL · UNKNOWN
```

Nunca cambiar todos los colores, todos los componentes y todas las paginas a la
vez esperando que compile. Orden de dependencias:

```text
TOKENS -> PRIMITIVES -> SHARED COMPONENTS -> LAYOUTS -> FEATURE -> PAGES
```

> En este repositorio los tokens ya estan consolidados y documentados: 188
> custom properties en `docs/design-system/tokens.md`. No inventar nombres que
> contradigan esa convencion.

---

# 29. FASE 5 - CREAR DAG

Una tarea que depende de otra NO empieza antes de que su dependencia este
`REGRESSION_VERIFIED`. Registro vivo en `docs/frontend/REFACTOR_DAG.md`.

---

# 30. CONTRATO DE MICROTAREA

```text
Outcome     resultado observable
IN          archivos permitidos · rutas · componente · dependencias
OUT         auth · backend no relacionado · rutas no relacionadas
Preserve    contrato de API · click · navegacion · permisos
Acceptance criteria
Browser scenarios
Required evidence   screenshots · assertions · console · network
```

---

# 31. MICROTAREA - TRACE

Antes de editar: donde se renderiza, quien lo llama, que props recibe, que
estado usa, que API, que estilos, que componentes compartidos, que tests.

```text
PatientDashboard -> NextAppointmentCard -> useAppointments
-> appointmentsService -> GET /appointments/upcoming
```

---

# 32. MICROTAREA - REPRODUCE

Demostrar el defecto **antes** de corregirlo.

```text
Viewport: 390x844 · Route: /appointments · Role: patient
Observed: la barra de filtros produce 74px de overflow horizontal.
Evidence: before.png
```

Sin reproduccion, **NO FIX**.

---

# 33-34. CONTRACT Y TEST DESIGN

Definir que debe ocurrir, y decidir **antes del codigo** que prueba el cambio:
prueba de componente para un componente, integracion/e2e para un flujo,
Playwright para la UI.

Un screenshot NO reemplaza una assertion.

---

# 35. MICROTAREA - IMPLEMENT

Orden de skills: `project-design-system` -> `frontend-design` -> ingenieria de
framework si aplica -> implementacion.

No cambiar archivos fuera de `IN` salvo necesidad demostrada. Si aparece una
dependencia arquitectonica nueva: **STOP**, registrar, actualizar el DAG.

---

# 36-38. STATIC / TEST / RUNTIME GATES

Ejecutar los scripts **reales** del repo, leyendo `package.json`. PASS es
`exit code 0`.

Orden barato-primero: la comprobacion que invalida mas rapido va antes.
`target test -> component tests -> feature tests -> broader regression`.

Runtime: la app arranca, la ruta abre, los datos cargan, los permisos son
correctos, no hay fallback inesperado ni excepcion en ejecucion.

---

# 39-40. PLAYWRIGHT GATE

Viewports: `390x844 · 768x1024 · 1024x768 · 1440x900 · 1920x1080`. Para layouts
y paginas los cinco son obligatorios; para un microcambio sin impacto responsive
puede bastar uno con justificacion escrita.

```text
LAYOUT        overflow-x · overlap · clipping · scroll inesperado · sticky
              · fixed · z-index
TYPOGRAPHY    wrapping · truncation · line-height · jerarquia · legibilidad
INTERACTION   hover · focus · click · teclado · tab order · menus · dialogos
              · drawers · popovers · tooltips
ASYNC         loading · success · empty · error · retry
DATA          nombre largo · email largo · numero grande · campo vacio
              · muchas filas · una fila
```

---

# 41. MUTATION PROOF

```text
UI -> REQUEST -> RESPONSE -> PERSISTENCE -> RELOAD -> UI
```

Un toast de "Guardado" NO demuestra persistencia.

---

# 42. PERMISSION PROOF

Para acciones protegidas: UI autorizada + UI no autorizada + denegacion directa
de la API, cuando aplique.

**Nunca asumir que ocultar un boton equivale a seguridad.**

---

# 43. EVIDENCE MANIFEST

```json
{
  "run_id": "2026-09-08_UI-001.03_001",
  "requirement_id": "UI-001",
  "microtask_id": "UI-001.03",
  "base_sha": "...",
  "head_sha": "...",
  "route": "/appointments",
  "role": "patient",
  "browser": "chromium",
  "viewport": "390x844",
  "assertions": ["filter bar visible", "no horizontal overflow"],
  "console_errors": [],
  "page_errors": [],
  "failed_requests": [],
  "screenshots": ["after-390x844.png"],
  "result": "PASS"
}
```

---

# 44. VISUAL REVIEW

```text
IMPLEMENTER -> PLAYWRIGHT -> CRITIQUE -> VISUAL REVIEWER
```

Puntuacion sobre 10 en: Typography, Spacing, Hierarchy, Consistency,
Responsiveness, Accessibility, Interaction, States, Density, Polish.

```text
>= 92 PASS      < 92 FAIL
```

Cualquier blocker es FAIL aunque la suma sea 99.

---

# 45. BLOCKER DEFINITIONS

```text
BLOCKER    feature inusable · ruta inaccesible · auth bypass · perdida de datos
           · mutacion destructiva · fallo grave de accesibilidad
           · rotura responsive mayor

CRITICAL   interaccion central rota · falso positivo de persistencia
           · excepcion repetida en ejecucion
           · regresion mayor en componente compartido

HIGH       estado importante ausente · movil inusable · inaccesible por teclado
           · inconsistencia de diseno significativa

MEDIUM     inconsistencia visual localizada · problema de mantenibilidad
           · friccion menor de UX
```

```text
BLOCKER  -> no se integra
CRITICAL -> no se integra
HIGH     -> no se integra
MEDIUM   -> corregir o justificar explicitamente
LOW      -> puede ir al backlog
```

---

# 46-48. REWORK LOOP

```text
RECHAZO -> CAUSA RAIZ -> PARCHE -> STATIC -> TEST -> RUNTIME -> PLAYWRIGHT
-> NUEVA EVIDENCIA -> RE-REVIEW
```

**No reutilizar screenshots viejos.** No marcar "corregido" hasta producir
evidencia nueva.

Si la distribucion instalada expone `critique` / `audit` / `polish`, o
`adapt` / `harden`, el orden es: implementacion -> adapt -> harden -> critique
-> polish, y despues **volver a correr Playwright**. `polish` nunca debe cambiar
logica de negocio.

Orden general de correccion: correctness -> architecture -> layout -> responsive
-> states -> accessibility -> polish. `polish` no oculta problemas
estructurales.

---

# 49-51. REFACTOR DE COMPONENTES

Refactorizar cuando: mas de 300 LOC, muchos estados locales, demasiados efectos,
markup + red + logica de negocio juntos, varios modales, reuso imposible.

No dividir en `Parte1 / Parte2 / Parte3` para bajar lineas. Dividir por
responsabilidad:

```text
AppointmentPage
├── AppointmentFilters
├── AppointmentList
├── AppointmentCard
├── AppointmentEmptyState
└── appointments.service
```

El estado vive en el dueno mas cercano que necesite coordinarlo. Antes de crear
un store global: estado local, elevado, cache de query, estado en la URL, estado
de servidor, contexto. Elegir lo minimo suficiente.

Evitar valores literales repetidos cuando representan diseno compartido:
preferir token, clase semantica, variante o primitiva. No introducir una
abstraccion de variantes nueva solo por moda.

---

# 52. ANTI "VIBE CODE" CHECKLIST

Rechazar patrones repetidos sin proposito:

```text
[ ] card dentro de card dentro de card
[ ] gradiente azul-violeta generico
[ ] todo con el mismo radio grande
[ ] icono en cuadrado redondeado en cada titulo
[ ] sombras en todos los paneles
[ ] demasiados badges
[ ] cuatro colores de acento sin sistema
[ ] spacing aleatorio
[ ] tipografia sin jerarquia
[ ] todos los headers gigantes
[ ] animaciones decorativas
[ ] skeleton sin relacion con el layout real
[ ] placeholder como sustituto de label
[ ] dashboard lleno de metricas que nadie pidio
[ ] graficos decorativos
[ ] microcopy generico
```

Diseno profesional no significa mas decoracion.

---

# 53. CONSISTENCY AUDIT

Debe existir UNA convencion para: Button, Input, Select, Textarea, Checkbox,
Radio, Tabs, Badge, Card, Dialog, Drawer, Tooltip, Dropdown, Table, Pagination,
Breadcrumb, EmptyState, Skeleton, Toast.

Si conviven `Button`, `PrimaryButton`, `BlueButton`, `MainButton`, `ButtonNew` y
`ButtonV2` sin diferencia semantica: `ARCH-DUPLICATE`.

---

# 54. RESPONSIVE STRATEGY

No disenar escritorio y "arreglar movil". Para cada superficie decidir los
cuatro comportamientos:

```markdown
| Surface | Mobile | Tablet | Desktop |
|---|---|---|---|
| Sidebar | drawer | compacto | fijo |
| Filters | sheet | wrap | inline |
| Table | cards/scroll | scroll | tabla |
```

---

# 55. FORM QUALITY GATE

```text
labels · help text · required · optional · validacion · validacion de servidor
resumen de errores · error por campo · loading · disabled · success
dirty state · cancelar · cambios sin guardar · teclado · autofill
formato de fecha · formato de telefono
```

---

# 56. MODAL QUALITY GATE

```text
[ ] el foco entra al modal
[ ] escape se comporta bien
[ ] la interaccion de fondo se bloquea cuando corresponde
[ ] el foco vuelve al cerrar
[ ] existe titulo
[ ] existe forma de cerrar
[ ] usable en viewport movil
[ ] el contenido scrollea sin perder las acciones
[ ] las acciones destructivas son explicitas
```

---

# 57. TABLE QUALITY GATE

```text
[ ] cabecera clara
[ ] estado de ordenamiento visible
[ ] estado de filtro visible
[ ] paginacion comprensible
[ ] estado vacio
[ ] estado de carga
[ ] estrategia movil
[ ] estrategia para texto largo
[ ] las acciones de fila se descubren
[ ] accesible por teclado donde aplique
```

---

# 58. ACCESSIBILITY GATE

```text
HTML semantico · labels · focus-visible · teclado · contraste · alt con sentido
semantica de dialogo · jerarquia de encabezados · objetivo tactil
anuncio de estado donde corresponda · reduced motion donde corresponda
```

No "arreglar" accesibilidad agregando `aria-label` indiscriminadamente. Primero
HTML semantico.

---

# 59. PERFORMANCE GATE

```text
rerenders innecesarios · dependencias grandes · requests duplicadas
waterfalls · imagenes enormes · layout shift · jank de animacion
listas caras · virtualizacion donde realmente hace falta
```

No optimizar prematuramente sin evidencia.

---

# 60. SECURITY GATE

```text
HTML inseguro · inyeccion en URL · redirecciones no confiables
exposicion de token · PII en logs · autorizacion solo en cliente
subida de archivos peligrosa · acceso directo a objetos · secretos
```

---

# 61. CODE REVIEW GATE

Antes de integrar, correr `/code-review`. FABLE no autoacepta el resultado. Cada
finding se clasifica:

```text
CONFIRMED · FALSE_POSITIVE · OUT_OF_SCOPE · FIXED · DEFERRED_WITH_RATIONALE
```

---

# 62. REGRESSION GATE

Despues de que la microtarea pase, revisar: la ruta actual, las rutas hermanas,
los consumidores del componente compartido, auth, navegacion y responsive.

Si se modifico una primitiva, no revisar una sola pagina: revisar una muestra
representativa de sus usos.

---

# 63. ATOMIC COMMIT

Solo despues de STATIC, TEST, RUNTIME, PLAYWRIGHT, EVIDENCE, REVIEW y
REGRESSION en verde.

```bash
git status
git diff --check
git diff
git add <files>
git commit -m "refactor(ui): normalize appointment filters"
```

No meter cinco features, limpieza no relacionada y formateo global en el mismo
commit.

---

# 64-66. INTEGRACION Y REMOTO

```bash
git fetch --prune
git status
git rev-parse HEAD
```

Verificar: arbol limpio, rama esperada, evidence manifest, aprobaciones, orden
de dependencias. **No force push en rama compartida.**

Los conflictos se resuelven semanticamente: nunca `ours` / `theirs` a ciegas.
Despues de un conflicto se vuelven a correr STATIC, TEST, RUNTIME, PLAYWRIGHT y
REGRESSION.

El PR debe incluir: resumen, requisitos, screenshots, tests, evidencia, riesgo,
migraciones, huecos conocidos y rollback.

> **En este repositorio el merge a `dev` exige revision humana.** `gh pr merge` y
> el auto-merge estan bloqueados. El flujo termina en **abrir el PR**.

---

# 67-75. ESTRATEGIA POR WAVES

No refactorizar por archivos. Refactorizar por capas:

```text
WAVE 0  Infraestructura   medicion antes de tocar UI
WAVE 1  Fundacion         tokens, tipografia, iconos, spacing, radios,
                          superficies, colores de estado
WAVE 2  Primitivas        Button, Input, Select, Textarea, Checkbox, Radio,
                          Badge, Card, Tabs, Dialog, Drawer, Dropdown, Tooltip,
                          helpers de tabla, Skeleton, EmptyState
WAVE 3  Layouts           shell raiz, shells por rol, sidebar, topbar,
                          contenedor de contenido, cabecera de pagina
WAVE 4  Flujos criticos   por criticidad de negocio, frecuencia de uso,
                          impacto visual y riesgo tecnico
WAVE 5  Flujos secundarios  ajustes, notificaciones, perfil, directorios,
                          administracion secundaria, reportes
WAVE 6  Cola larga        el modal olvidado, la pagina vieja, el formulario
                          duplicado, la ruta rara, el rol poco usado
WAVE 7  Regresion global
```

La Wave 0 se cierra cuando existen: Playwright operativo, baseline capturado,
inventario de rutas, inventario de componentes, build en verde conocido, tests
en verde conocidos, las custom skills FABLE y la carpeta de evidencia.

La Wave 3 es la que define la percepcion de "producto profesional".

Un sistema solo se ve profesional si las esquinas olvidadas tambien obedecen al
sistema.

Cada primitiva de la Wave 2 requiere: matriz visual, estados, responsive,
teclado y tests.

Matriz de la Wave 7:

```markdown
| Route | Role | 390 | 768 | 1024 | 1440 | 1920 | Console | Network | Result |
|---|---|---|---|---|---|---|---|---|---|
```

Todas las rutas P0 y P1 deben estar en PASS.

---

# 76. CONTRATOS DE AGENTE

**ORCHESTRATOR** puede planificar, asignar, consolidar, rechazar e integrar. No
puede autoaprobar su propia implementacion.

**IMPLEMENTER** trabaja una microtarea, toca solo `IN`, preserva `OUT`, ejecuta
los gates, produce evidencia y **no aprueba**.

**VISUAL REVIEWER** revisa screenshots, estado del navegador, responsive,
jerarquia visual, consistencia, interaccion y estados. No revisa unicamente el
diff.

**FRONTEND REVIEWER** revisa arquitectura, tipos, framework, estado, reuso,
rendimiento, tests y mantenibilidad.

**REGRESSION AUDITOR** busca efectos colaterales, rotura de componentes
compartidos, rutas olvidadas, permisos, regresiones responsive y debilitamiento
de tests.

> Implementados en `.claude/agents/`: `visual-reviewer`, `frontend-reviewer`,
> `regression-auditor`.

---

# 77. PROMPT MAESTRO FABLE

```text
Actua como FABLE Frontend Refactor Orchestrator para este repositorio.

OBJETIVO
Transformar el frontend completo en un producto profesional, coherente,
responsive y production-grade sin alterar comportamiento funcional valido.

REGLAS ABSOLUTAS
- NO_EVIDENCE_NO_DONE.
- NO_SELF_APPROVAL.
- NO_BIG_BANG_REWRITE.
- NO_TEST_WEAKENING.
- NO_FORCE_PUSH.
- No inventes comportamiento.
- Toda afirmacion debe provenir de SPEC, CODE, RUNTIME, TEST o EXTERNAL-DOC.
- Trabaja una sola lane de escritura a la vez.
- Maximo un subagente especializado simultaneo.
- No modifiques datos de produccion.
- No agregues mocks para ocultar APIs rotas.
- No reemplaces el package manager.
- No reemplaces componentes existentes sin antes auditarlos.
- No crees un nuevo design primitive si existe uno equivalente.

FASE 1 - DISCOVERY
No escribas codigo. Inventaria rutas, roles, layouts, componentes, primitivas
compartidas, estilos, estado, servicios, tests, tokens, formularios, dialogos,
tablas y estados vacio/carga/error.

FASE 2 - BASELINE
Levanta la aplicacion. Usa Playwright. Captura baseline de rutas prioritarias en
los cinco viewports. Registra errores de consola, page errors y requests
fallidas.

FASE 3 - NORMALIZACION
Produce o actualiza los documentos de docs/frontend/.

FASE 4 - DAG
Divide todo en waves y microtareas. Cada microtarea declara OUTCOME, IN, OUT,
PRESERVE, ACCEPTANCE, TESTS, PLAYWRIGHT SCENARIOS y EVIDENCE.

MICROTASK LOOP
TRACE -> REPRODUCE -> CONTRACT -> TEST DESIGN -> IMPLEMENT -> STATIC GATE
-> TEST GATE -> RUNTIME GATE -> PLAYWRIGHT GATE -> EVIDENCE GATE
-> INDEPENDENT REVIEW -> REWORK -> REGRESSION -> ATOMIC COMMIT.

VISUAL PASS
Typography, Spacing, Hierarchy, Consistency, Responsiveness, Accessibility,
Interaction, States, Density, Polish, sobre 10 cada una.
PASS = 92/100 minimo. BLOCKER/CRITICAL/HIGH impiden aprobacion aunque la
puntuacion sea superior.

MUTATIONS
Demuestra UI -> request -> response -> persistencia -> reload -> UI.

REVIEW
El implementador no puede aprobar. Si el reviewer rechaza:
CAUSA RAIZ -> PARCHE -> rerun gates -> nueva evidencia -> re-review.

INTEGRATION
Solo integra tareas REGRESSION_VERIFIED. No force-push. No mezcles cambios no
relacionados.

Comienza por DISCOVERY y BASELINE. No hagas todavia un rediseno masivo.
```

---

# 78. PROMPT PARA UNA LANE

```text
Ejecuta exclusivamente la lane UI-XXX. No trabajes ninguna otra lane.

1. Lee su contrato.        9.  Ejecuta runtime gate.
2. TRACE.                  10. Ejecuta Playwright gate.
3. REPRODUCE en navegador. 11. Genera evidence manifest.
4. Define expected behavior. 12. Entrega a reviewer independiente.
5. Disena tests.           13. Si falla, ejecuta rework loop.
6. Implementa el cambio minimo correcto.  14. Ejecuta regression.
7. Ejecuta static gate.    15. Solo entonces prepara atomic commit.
8. Ejecuta test gate.

No digas "done" si no existe evidencia.
```

---

# 79. PROMPT DEL VISUAL REVIEWER

```text
Actua como reviewer visual adversarial. NO confies en la descripcion del
implementador.

Inspecciona: requirement, screenshots, runtime de Playwright, viewport, consola,
red, interaccion, movil, escritorio, vacio/carga/error, teclado, tipografia,
espaciado, jerarquia, consistencia.

Intenta demostrar que la implementacion esta mal.

Findings: BLOCKER, CRITICAL, HIGH, MEDIUM, LOW.
Puntua las diez dimensiones. PASS >= 92 y cero BLOCKER/CRITICAL/HIGH.
Si falta evidencia: FAIL: INSUFFICIENT_EVIDENCE.
```

---

# 80. PROMPT DEL FRONTEND REVIEWER

```text
Actua como senior frontend reviewer adversarial. Revisa exclusivamente el diff y
las dependencias afectadas.

Busca duplicacion, propiedad del estado incorrecta, mal uso de las primitivas de
reactividad, efectos innecesarios, logica de negocio o de API duplicada,
componentes-dios, escapes de tipo, accesibilidad, rendimiento, manejo de
errores, huecos de prueba, codigo muerto y regresiones.

No hagas nitpicks cosmeticos. Prioriza defectos reales y mantenibilidad.
No apruebes si existe BLOCKER, CRITICAL o HIGH.
```

---

# 81. PROMPT DEL REGRESSION AUDITOR

```text
Actua como auditor independiente. Asume que el cambio local funciona pero puede
haber roto consumidores.

Mapea: archivo cambiado -> imports -> consumidores -> rutas -> roles -> estados.

Prueba una muestra representativa. Confirma primitivas compartidas, rutas
vecinas, responsive, auth, permisos, navegacion y tests.

Solo emite REGRESSION_VERIFIED con evidencia.
```

---

# 82. PROMPT DE DESIGN SYSTEM NORMALIZATION

```text
No redisenes todavia.

Audita el sistema visual existente y clasifica cada patron en CANONICAL, LEGACY,
DUPLICATE, ACCIDENTAL o UNKNOWN.

Inventaria colores, tipografia, spacing, radios, sombras, contenedores, botones,
inputs, cards, dialogos, tablas, tabs, badges y estados vacio/carga/error.

Propon el sistema minimo consolidado que preserve la identidad del producto y
reduzca inconsistencia.

No implementes hasta producir: token map, component map, migration order, rutas
afectadas y analisis de riesgo.
```

---

# 83-86. COMANDOS, ORDEN DE INSTALACION Y POLITICA DE TERCEROS

> **Sustituido por `docs/frontend/FABLE_STACK.md`.** Lo que se conserva como
> norma:

**Que no instalar al principio.** No llenar Claude con cincuenta skills
visuales. Evitar tres variantes de `frontend-design`, cuatro colecciones
completas de UI, skills de estilo contradictorias, skills sin fuente revisada y
plugins que ejecutan scripts desconocidos. Primero establecer un stack estable.

**Politica de terceros.** Antes de instalar un plugin comunitario revisar: repo,
README, LICENSE, SKILL.md, hooks, scripts, `package.json`, MCP, permisos y
actividad del repositorio. No dar por seguro un paquete por el nombre.

**Politica de hooks.** Los hooks ejecutan codigo automaticamente. Antes de
habilitar uno: que evento lo dispara, que comando ejecuta, puede escribir, puede
hacer red, puede leer secretos, puede ejecutar shell. Conservar los hooks
existentes; **no sobrescribir `.claude/settings.json` a ciegas** — merge
semantico.

---

# 87-88. CLAUDE.MD

La seccion de protocolo vive en `CLAUDE.md`, en la raiz:

```markdown
## Frontend Quality Protocol

All frontend changes MUST follow FABLE_FRONTEND_REFACTOR_PLAYBOOK.md.

- NO_EVIDENCE_NO_DONE
- NO_SELF_APPROVAL
- NO_BIG_BANG_REWRITE
- NO_TEST_WEAKENING
- Preserve behavior during visual-only refactors.
- Use project design primitives before creating new ones.
- Browser proof required for UI claims.
- Mutations require UI -> request -> response -> persistence -> reload -> UI.
```

---

# 89. DEFINITION OF DONE - MICROTAREA

```text
[ ] outcome satisfecho        [ ] network revisado
[ ] IN respetado              [ ] persistencia si hay mutacion
[ ] OUT respetado             [ ] puntuacion visual >= 92
[ ] funcionalidad preservada  [ ] sin blocker
[ ] static pass               [ ] sin critical
[ ] tests pass                [ ] sin high
[ ] runtime pass              [ ] revision independiente pass
[ ] Playwright pass           [ ] regresion pass
[ ] screenshots capturados    [ ] commit atomico
[ ] consola revisada
[ ] page errors revisados
```

---

# 90. DEFINITION OF DONE - REFACTOR GLOBAL

```text
[ ] inventario de rutas completo      [ ] gate de accesibilidad pass
[ ] inventario de componentes completo [ ] revision de seguridad pass
[ ] design system documentado          [ ] build global pass
[ ] primitivas canonicas adoptadas     [ ] tests globales pass
[ ] duplicacion mayor eliminada        [ ] regresion Playwright pass
[ ] rutas P0 verificadas               [ ] evidence manifest completo
[ ] rutas P1 verificadas               [ ] aprobacion de reviewer completa
[ ] matriz responsive pass             [ ] integracion final limpia
```

---

# 91. FINAL REPORT TEMPLATE

```markdown
# FABLE Frontend Refactor Final Report

## Base            Base SHA / Final SHA / Branch
## Scope
## Waves completed
## Routes verified
## Components normalized
## Design system changes
## Tests
## Playwright
## Evidence
## Security
## Accessibility
## Performance
## Known gaps
## Risks
## Rollback
## Result           REGRESSION_VERIFIED
```

---

# 92. TROUBLESHOOTING

**Plugin no aparece:** `/reload-plugins`, luego `/plugin`. Verificar el scope.

**Pegaste comandos juntos:** cada comando se ejecuta por separado. En el modal
de marketplace va solo `owner/repo`, sin el `/plugin install` pegado detras.

**Playwright no aparece:** `claude mcp list` en terminal, `/mcp` dentro de
Claude. En este repositorio el MCP se declara en `.mcp.json` del proyecto, asi
que cada persona debe aprobarlo la primera vez.

**Skill duplicada:** buscar el nombre en el plugin oficial, en los plugins
comunitarios, en `~/.claude/skills` y en `.claude/skills`. Mantener una sola
autoridad primaria.

---

# 93. COLISIONES DE SKILLS

Dos plugins que exponen skills con el mismo nombre entran en conflicto. Por eso
FABLE exige **un unico dueno canonico por capacidad**. El reparto vigente para
este repositorio esta en `docs/frontend/FABLE_STACK.md`.

---

# 94. STACK FINAL

> Ver `docs/frontend/FABLE_STACK.md`. Obligatorio: `frontend-design`,
> `feature-dev`, `code-review`, `security-guidance`, Playwright.
> Ingenieria: `angular-architect` (no las skills de React).
> Opcional: `code-simplifier`.

---

# 95. ORDEN DE EJECUCION POR PANTALLA

```text
1. TRACE               9. TEST                17. PLAYWRIGHT OTRA VEZ
2. BASELINE           10. RUNTIME             18. VISUAL REVIEWER
3. REQUIREMENT        11. PLAYWRIGHT          19. FRONTEND REVIEWER
4. DESIGN SYSTEM CHECK 12. CRITIQUE           20. SECURITY SI APLICA
5. FRONTEND-DESIGN    13. FIX                 21. REGRESION
6. IMPLEMENT          14. AUDIT               22. COMMIT
7. REFACTOR COMPONENTE 15. FIX
8. STATIC             16. POLISH
```

---

# 96. RESULTADO ESPERADO

El proyecto no deberia "verse profesional" porque tiene sombras bonitas.
Deberia sentirse profesional porque el sistema visual es coherente; la jerarquia
tiene intencion; las pantallas comparten lenguaje; las interacciones tienen
estados completos; movil no es una adaptacion tardia; los formularios son
claros; los componentes son mantenibles; la arquitectura es consistente; no hay
duplicaciones absurdas; las mutaciones son reales; la navegacion es predecible;
la accesibilidad es verificable; las regresiones se detectan; y cada afirmacion
importante tiene evidencia.

Eso separa "una UI generada" de "un producto construido".

---

# 97. FUENTES

Verificadas el 2026-09-08.

**Anthropic**
- Claude Code Plugins Official — https://github.com/anthropics/claude-plugins-official
- Marketplace — https://github.com/anthropics/claude-plugins-official/blob/main/.claude-plugin/marketplace.json
- Frontend Design — https://github.com/anthropics/claude-plugins-official/tree/main/plugins/frontend-design
- Feature Dev — https://github.com/anthropics/claude-plugins-official/blob/main/plugins/feature-dev/README.md
- Code Review — https://github.com/anthropics/claude-plugins-official/blob/main/plugins/code-review/README.md
- Security Guidance — https://github.com/anthropics/claude-plugins-official/tree/main/plugins/security-guidance
- Code Simplifier — https://github.com/anthropics/claude-plugins-official/blob/main/plugins/code-simplifier/agents/code-simplifier.md
- MCP — https://code.claude.com/docs/en/mcp

**Microsoft**
- Playwright MCP — https://github.com/microsoft/playwright-mcp

**Terceros (no instalados; ver FABLE_STACK.md)**
- Impeccable — https://github.com/pbakaus/impeccable · https://impeccable.style/
- Taste — https://github.com/tyfarrago-hub/taste
- Frontend Skills — https://github.com/nmhjklnm/frontend-skills

---

# 98. TRUST HIERARCHY

```text
1. documentacion oficial actual    5. documentacion comunitaria
2. repositorio oficial actual      6. blog/post
3. README del proveedor            7. comentario aislado
4. codigo/manifest del plugin
```

Para instalacion, siempre volver al README/manifest actual.

---

# 99. MANTENIMIENTO DEL STACK

Mensualmente o antes de una refactorizacion grande: revisar la version de Claude
Code, el marketplace, los changelogs de los plugins, Playwright MCP, las custom
skills, y ejecutar el smoke del baseline.

No actualizar todo durante una lane critica. Las herramientas se actualizan en
una lane separada: `TOOLING-001`.

---

# 100. FABLE FINAL RULE

```text
A refactor is not complete because the code changed.

It is complete when:

the intended behavior is preserved,
the intended design is demonstrated,
the runtime agrees,
the tests agree,
the browser agrees,
the reviewer agrees,
and regression evidence exists.
```
