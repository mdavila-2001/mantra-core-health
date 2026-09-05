# Auditoría frontend — Fase 0 y Fase 1

**Proyecto:** mantra-core-health · **Rama:** `dev` · **Commit auditado:** `ca3a245`
**Fecha:** 2026-07-31

---

## Nota preliminar sobre el encargo

El prompt de auditoría asume un proyecto React/Next con `features/` desordenado y
componentes por clasificar. **La realidad del repositorio es distinta y conviene
decirlo antes que nada:**

1. El proyecto es **Angular 21** (standalone + signals + SSR), no React.
2. La arquitectura Atomic Design **ya existe y está bien construida**:
   `shared/components/atoms|molecules` con 15 componentes, tokens de diseño
   tipados, contrato de accesibilidad por DI y 18 archivos de pruebas.
3. `features/` contiene 3 carpetas, dos de ellas *stubs* del CLI. No hay
   duplicación masiva de componentes porque **todavía no hay producto**.

Por lo tanto la tarea real **no es** "mover archivos de `features/` a
`atoms/molecules/organisms`". Ese trabajo ya está hecho. La tarea real es:

- **Desbloquear el build**, que está roto en `dev` (18 errores de compilación).
- Corregir **clasificaciones atómicas incorrectas** (5 componentes mal ubicados).
- Cerrar **huecos de infraestructura** (barriles, alias, lint, lazy loading).
- **Completar la capa común** que falta antes de que empiecen las features reales.

---

## Fase 0 — Preparación y uso de skills

### Objetivo

Inventariar capacidades realmente instaladas, convenciones del repositorio y
comandos de validación disponibles.

### Skills utilizadas

Inventario **real** del entorno. La mayoría de las skills instaladas son de
dominio Swift/SwiftUI/iOS y **no aplican** a este proyecto Angular. No se
inventan capacidades inexistentes.

| Skill | ¿Aplica? | Uso concreto previsto |
|---|---|---|
| `simplify` | **Sí** | Fase 5–6: limpieza de reuso/simplificación sobre el diff de cada migración. |
| `/code-review` | **Sí** | Fase 6: revisión del diff de la rama antes de cerrar cada fase. |
| `security-review` | **Sí** | Fase 6: revisión de la carga de archivos (`file-input`) y del manejo de `localStorage`. |
| `run` | **Sí** | Fase 6: levantar la app y verificar visualmente la vitrina de diseño. |
| `init` | **Sí** | Fase 7: generar/actualizar `CLAUDE.md` con las reglas de arquitectura. |
| `figma` | **Condicional** | Solo si existe el archivo Figma de ALOVIDA. Hoy la fuente normativa citada no está en el repo (ver *Información faltante*). |
| `graphify` | **Opcional** | Grafo de dependencias. Con 96 archivos el mapeo directo fue suficiente; se reserva para cuando crezcan las features. |
| `database-design`, `dataviz`, `artifact-*`, `claude-api`, `swiftui-*`, `swift-concurrency-pro`, `keybindings-help`, `update-config`, `schedule`, `loop`, `fewer-permission-prompts`, `statusline-setup` | **No** | Fuera de dominio para esta tarea. |

**Herramientas de validación disponibles (verificadas):** `yarn build`,
`yarn test`, `yarn test:coverage`, `yarn start`, `prettier`.
**No disponibles:** ESLint, pruebas e2e, pruebas de accesibilidad automatizadas,
Storybook. Son huecos, no omisiones de la auditoría.

### Hallazgos

- `package.json` **no declara script `lint`** ni dependencia de ESLint. El
  criterio de aceptación "el lint no presenta errores críticos" **no es
  verificable hoy**.
- `tsconfig.json` ya es estricto: `strict`, `strictTemplates`,
  `noImplicitOverride`, `noPropertyAccessFromIndexSignature`,
  `noImplicitReturns`, `noFallthroughCasesInSwitch`. Excelente base.
- `angular.json` define presupuestos de bundle (500 kB warning / 1 MB error) y
  `anyComponentStyle` 4 kB / 8 kB.
- Runner de pruebas: `@angular/build:unit-test` sobre **Vitest 4** + jsdom.
- Prefijo de selectores: `app`. Estilos: CSS plano (no Sass).
- **No hay alias de rutas** (`paths`) en `tsconfig.json`.

### Decisiones tomadas

- No se introduce ESLint dentro de la refactorización: es un cambio de
  herramienta, no de arquitectura. Se propone como tarea separada de Fase 6.
- Se conserva CSS plano; migrar a Sass sería un cambio no solicitado.

### Criterios de aceptación

- [x] Skills inventariadas contra el entorno real, sin invenciones.
- [x] Comandos de validación identificados y ejecutados.
- [x] Huecos de tooling documentados explícitamente.

---

## Fase 1 — Diagnóstico

### Objetivo

Mapear la arquitectura real, inventariar y clasificar cada componente, detectar
duplicación, inconsistencias, dependencias y riesgos.

### Skills utilizadas

Lectura directa del código (96 archivos, 7 745 líneas) + ejecución de `yarn build`
y `yarn test` para obtener evidencia objetiva en lugar de inferencias.

---

### 1. Arquitectura encontrada

| Eje | Situación |
|---|---|
| Framework | Angular 21.2, standalone components, **sin NgModules** |
| Reactividad | Signals (`input()`, `model()`, `output()`, `computed`) — API moderna, consistente |
| Detección de cambios | `OnPush` en todos los componentes de diseño; **ausente** en los 6 *stubs* |
| SSR | Activo (`@angular/ssr`, `outputMode: server`, hidratación con `withEventReplay`) |
| Estilos | CSS plano + tokens CSS custom properties en `src/styles.css` (305 líneas) |
| Tokens | `core/tokens/design-tokens.types.ts` — catálogo **tipado** de 232 líneas, sin duplicar valores |
| Tema | `ThemeService` con `signal` + anti-parpadeo por script en `index.html` |
| Formularios | **No usa `@angular/forms`**; contrato propio por DI (`FORM_CONTROL_CONTEXT`) |
| Validación de esquemas | **Inexistente** (no hay Zod/Valibot ni equivalente) |
| Rutas | 3 rutas, **todas con carga ansiosa** (`component:`, sin `loadComponent`) |
| HTTP | **Inexistente** — no hay `provideHttpClient` ni servicios de datos |
| Estado global | Solo `ThemeService`. No hay store |
| Permisos/roles | **Inexistente** |
| Notificaciones | Toast **iniciado y roto** (ver hallazgo crítico) |
| Modales/portales | **No hay componente genérico**; `date-picker` implementa el suyo en línea |
| Tablas/filtros/paginación | **Inexistentes** |
| Pruebas | 18 `.spec.ts`, Vitest — **la suite completa no compila hoy** |
| Storybook | Inexistente. `features/design-system-sample` cumple ese rol (433 líneas) |

**Fortalezas reales que deben preservarse** (no tocar en la refactorización):

- El contrato `FORM_CONTROL_CONTEXT` resuelve accesibilidad de formularios de
  forma estructural: el campo genera `id`/`aria-describedby` y el control los
  consume. Es mejor que lo habitual.
- Ids estables entre servidor y cliente (`nextControlId`) — la hidratación no rompe.
- `design-tokens.types.ts` declara **nombres, nunca valores**: evita deriva
  CSS ↔ TS por construcción.
- Decisiones difíciles ya resueltas y comentadas: `0` válido en inputs numéricos,
  correos no pasados a minúsculas (RFC 5321), `aria-disabled` en vez de
  `disabled` nativo, `<option>` por índice para no degradar tipos.

---

### 2. Hallazgo crítico — el build está roto en `dev`

**Evidencia objetiva:**

```
$ yarn build
… 18 errores
$ yarn test --watch=false
… los mismos errores: la suite no llega a ejecutarse
```

**Causa:** el commit `ca3a245` incorporó **plantillas y CSS completos** del
sistema de avisos, pero dejó las **clases como stubs vacíos del CLI**.

| Archivo | Clase | Plantilla espera | Clase declara |
|---|---|---|---|
| `shared/components/molecules/toast/toast.ts` | `Toast` | `toast()`, `iconLabel()`, `dismiss()` | *(vacía)* |
| `shared/components/molecules/toast-container/toast-container.ts` | `ToastContainer` | `toasts()`, `dismiss()`, `<app-toast>` | *(vacía, `imports: []`)* |
| `core/dev/toast-dev-panel/toast-dev-panel.ts` | `ToastDevPanel` | `types`, `lanzar()`, `lanzarFijo()`, `lanzarRafaga()`, `limpiar()`, `app-button` | *(vacía, `imports: []`)* |
| `app/app.ts` | `App` | `isDev`, `<app-toast-container>`, `<app-toast-dev-panel>` | solo `RouterOutlet` |
| `shared/components/molecules/toast/toast.service.ts` | `ToastService` | — | `{}` vacío |
| `shared/components/molecules/toast/toast.types.ts` | `Toast` (interfaz) | — | `interface Toast {}` vacía |

**Consecuencias:** ninguna validación del prompt (build, type-check, pruebas) es
alcanzable hasta reparar esto. La regla 9 del encargo —"no dar por completada una
fase si el build falla"— **bloquea toda la refactorización**.

**Defecto adicional:** `toast.types.ts` exporta `interface Toast` y `toast.ts`
exporta `class Toast`. **Colisión de nombres** en el mismo directorio: al
implementar habrá que renombrar uno de los dos (propuesta: `ToastComponent` /
`ToastMessage`).

---

### 3. Inventario y matriz de clasificación

Leyenda de riesgo: **B**ajo / **M**edio / **A**lto.

| # | Componente | Ubicación actual | Clasificación actual | Clasificación propuesta | Destino propuesto | Acción | Prioridad | Riesgo |
|---|---|---|---|---|---|---|---|---|
| 1 | `AppButtonComponent` | `atoms/button/app-button.*` | atom | **atom** ✔ | `atoms/button/button.*` | Renombrar archivos | Media | B |
| 2 | `InputComponent` | `atoms/input/` | atom | **atom** ✔ | *(sin cambio)* | Conservar | — | — |
| 3 | `SelectComponent` | `atoms/select/` | atom | **atom** ✔ | *(sin cambio)* | Conservar + corregir import de tipo | Alta | B |
| 4 | `CheckboxComponent` | `atoms/checkbox/` | atom | **atom** ✔ | *(sin cambio)* | Conservar | — | — |
| 5 | `SwitchComponent` | `atoms/switch/` | atom | **atom** ✔ | *(sin cambio)* | Conservar | — | — |
| 6 | `RadioComponent` | `atoms/radio/` | atom | **atom** ✔ | *(sin cambio)* | Conservar + **agregar spec** | Alta | B |
| 7 | `RadioGroupComponent` | `atoms/radio-group/` | atom | **molecule** ✘ | `molecules/radio-group/` | **Mover** | Media | M |
| 8 | `AvatarGroupComponent` | `atoms/avatar-group/` | atom | **molecule** ✘ | `molecules/avatar-group/` | **Mover** | Media | B |
| 9 | `FileInputComponent` | `atoms/file-input/` | atom | **molecule** ✘ | `molecules/file-input/` | **Mover** | Media | M |
| 10 | `Badge` | `atoms/badge/` | atom | **atom** ✔ | *(sin cambio)* | Conservar | — | — |
| 11 | `Avatar` | `atoms/avatar/` | atom | **atom** ✔ | *(sin cambio)* | Conservar | — | — |
| 12 | `FormFieldComponent` | `molecules/form-field/` | molecule | **molecule** ✔ | *(sin cambio)* | Conservar | — | — |
| 13 | `DatePickerComponent` | `molecules/date-picker/` | molecule | **organism** ✘ | `organisms/date-picker/` | **Mover + dividir** | Media | **A** |
| 14 | `Toast` | `molecules/toast/` | molecule | **molecule** ✔ | *(sin cambio)* | **Reescribir** (stub roto) | **Crítica** | **A** |
| 15 | `ToastContainer` | `molecules/toast-container/` | molecule | **organism** ✘ | `organisms/toast-container/` | **Reescribir + mover** | **Crítica** | **A** |
| 16 | `ToastService` | `molecules/toast/toast.service.ts` | — | servicio | `shared/services/toast.service.ts` | **Reescribir + mover** | **Crítica** | M |
| 17 | `FormControlContext` | `components/form-control/` | *(sin clasificar)* | contrato DI | `shared/forms/form-control.context.ts` | **Mover** | Baja | M |
| 18 | `ToastDevPanel` | `core/dev/toast-dev-panel/` | — | herramienta dev | `dev/toast-dev-panel/` | **Reescribir** | **Crítica** | M |
| 19 | `ThemeService` + tokens | `core/tokens/` | core | **core** ✔ | *(sin cambio)* | Conservar | — | — |
| 20 | `Home` | `features/home/` | feature | boilerplate del CLI | `features/home/` | **Reescribir** (contenido Angular por defecto) | Media | B |
| 21 | `Auth` | `features/auth/` | feature | stub | `features/auth/` | Mantener temporalmente | Baja | B |
| 22 | `DesignSystemSample` | `features/design-system-sample/` | feature | vitrina | `features/design-system/` | Conservar + **cargar diferido** | Media | B |

**Tipos mal ubicados:**

| Tipo | Declarado en | Consumido por | Destino propuesto |
|---|---|---|---|
| `SelectOption<T>` | `atoms/input/input.types.ts` | `atoms/select/select.ts`, `features/design-system-sample` | `atoms/select/select.types.ts` |
| `DatePickerMode` | `atoms/input/input.types.ts` | `molecules/date-picker/date-picker.ts` | `organisms/date-picker/date-picker.types.ts` |
| `RejectedFile` | `atoms/file-input/file-input.ts` | *(sin consumidor externo)* | `molecules/file-input/file-input.types.ts` |
| `CalendarDay` | `molecules/date-picker/date-picker.ts` | *(sin consumidor externo)* | `organisms/date-picker/date-picker.types.ts` |

---

### 4. Matriz de duplicaciones

**Resultado: no hay duplicación de componentes.** Los 15 componentes del sistema
son únicos y sin variantes competidoras. Esto es consecuencia de que el producto
todavía no existe, no de un trabajo previo de consolidación.

Lo que sí se detecta es **duplicación de patrón interno**, que es el germen de la
duplicación futura:

| Patrón repetido | Aparece en | Líneas ~idénticas | Acción propuesta |
|---|---|---|---|
| Bloque `ownId` / `controlId` / `describedBy` / `required` / `invalid` contra `FORM_CONTROL_CONTEXT` | `input`, `select`, `checkbox`, `switch`, `file-input`, `date-picker`, `radio-group` (7 componentes) | 6–8 líneas × 7 | **Extraer** a función `injectFormControl(prefix)` en `shared/forms/` |
| Construcción de `wrapperClasses` por concatenación manual de estados | `input`, `select` (y variantes en `button`, `badge`, `avatar`) | 10–18 líneas × 5 | Utilidad `classList()` en `shared/utils/` |
| Aviso en dev por nombre accesible ausente (`afterNextRender` + `isDevMode`) | `button`, `badge` | 12 líneas × 2 | Utilidad `warnIfNoAccessibleName()` en `shared/utils/a11y.ts` |
| Trampa de foco / diálogo modal | `date-picker` (única implementación, **en línea**) | ~60 líneas | **Extraer** a `organisms/dialog/` — máximo valor de reuso |

---

### 5. Componentes ausentes en la capa común

Contrastado contra la lista del encargo (§3). **Ausentes hoy:**

- **Atoms:** `Typography`, `Icon`, `Spinner`, `Skeleton`, `Divider`, `Tooltip`,
  `Link`, `Label` (suelto), `Textarea`.
- **Molecules:** `SearchField`, `Card`, `ButtonGroup`, `Pagination`,
  `Breadcrumbs`, `EmptyState`, `Alert`, `Dropdown`/`Menu`.
- **Organisms:** **`Dialog`/`Modal` genérico** ⟵ *el más urgente*,
  `ConfirmDialog`, `DataTable` (con filtros/orden/paginación), `PageHeader`,
  `Navbar`, `Sidebar`, `FilterPanel`, `Toolbar`, `NotificationCenter`.
- **Transversal:** manejo de permisos/roles, capa HTTP, validación de esquemas,
  estados consistentes de carga/error/vacío.

**No se propone construirlos todos ahora.** El principio 12 del encargo prohíbe
abstraer sin un caso real de reuso. Se construyen por demanda, salvo `Dialog`,
que ya tiene un consumidor real (`date-picker`) y uno inminente (confirmaciones).

---

### 6. Hallazgos por eje de auditoría

#### Arquitectura

| Hallazgo | Evidencia | Severidad |
|---|---|---|
| Build roto: plantillas sin clase | 18 errores de compilación | **Crítica** |
| Sin barriles `index.ts` — la API pública de `shared/` no existe | 0 archivos `index.ts` en el repo | Alta |
| Sin alias de rutas: imports profundos y frágiles | `../../shared/components/atoms/avatar/avatar` en `design-system-sample.ts` | Alta |
| `RadioComponent` inyecta `RadioGroupComponent` de forma obligatoria | `radio.ts:26` — acoplamiento atom→atom | Media |
| `SelectComponent` importa su tipo desde `input.types.ts` | `select.ts:22` — frontera de módulo cruzada | Media |
| Carpeta `form-control/` fuera de la clasificación atómica | `shared/components/form-control/` | Baja |
| `ToastService` dentro de una carpeta de componente | `molecules/toast/toast.service.ts` | Baja |
| Sin dependencias circulares reales | verificado | ✔ |

#### Rendimiento

| Hallazgo | Evidencia | Severidad |
|---|---|---|
| Ninguna ruta usa carga diferida | `app.routes.ts` — 3 × `component:` | Alta |
| La vitrina de 433 líneas entra en el bundle inicial | `DesignSystemSample` importado ansiosamente | Alta |
| `OnPush` ausente en los 6 componentes stub | `app.ts`, `toast*.ts`, `home.ts`, `auth.ts` | Media |
| `home.html` embebe 2 SVG gigantes del logo de Angular en línea | `home.html` — ~8 kB de path data | Media |
| Tipografías: Poppins en 3 pesos estáticos + Inter variable | `styles.css:21-24` | Baja (aceptable) |

#### Accesibilidad

Es el eje **más fuerte** del proyecto. Verificado:

- ✔ `FORM_CONTROL_CONTEXT` garantiza `label for`/`id` y `aria-describedby`.
- ✔ `radio-group` usa `aria-labelledby` porque un grupo no acepta `for`.
- ✔ `aria-disabled` en botones (el control sigue enfocable y anunciado).
- ✔ Avisos en desarrollo por nombre accesible ausente (`button`, `badge`).
- ✔ El toast dice el tipo con palabras (`sr-only`), no solo con color.
- ✔ `date-picker` mueve, atrapa y devuelve el foco; cierra con Escape.
- ✔ Controles nativos por debajo (`<input>`, `<select>`, `<button>`).
- ✘ **Sin verificación automatizada** (no hay axe ni pruebas de a11y).
- ✘ El contraste declara excepciones WCAG E1–E4 en una fuente **no disponible**.

#### Calidad y mantenibilidad

| Hallazgo | Evidencia | Severidad |
|---|---|---|
| Suite de pruebas no ejecutable | build roto | **Crítica** |
| `RadioComponent` sin spec | 1 de 4 componentes sin cobertura | Media |
| Sin ESLint | no hay config ni dependencia | Media |
| `console.log` en producción | `server.ts:61` (arranque del servidor — aceptable) | Baja |
| `features/home` es boilerplate del CLI de Angular | logo y enlaces a angular.dev | Media |
| Colisión de nombres `Toast` (clase) / `Toast` (interfaz) | mismo directorio | Media |
| Cero uso de `any` | verificado en todo el repo | ✔ |
| Comentarios de decisión de alta calidad, en español, con el *porqué* | generalizado | ✔ |

---

### 7. Estructura objetivo propuesta

**Decisión de nombre: se conserva `shared/`, no se renombra a `common/`.**
Motivo: `shared/` es la convención de Angular, cumple exactamente el rol que el
encargo asigna a `common/`, y renombrarla obliga a tocar todos los imports del
repositorio sin ningún beneficio técnico — choca con el principio 8
(evitar sobreingeniería) y con la regla 5 (evitar cambios no relacionados).
*Es una decisión reversible: si se prefiere `common/`, se hace en la Fase 2 con
un solo cambio de alias.*

```text
src/app/
  core/                        # singletons de aplicación, una sola instancia
    tokens/                    # design-tokens.types.ts · theme.service.ts   ✔ ya existe
    http/                      # (futuro) interceptores, cliente
    auth/                      # (futuro) sesión, guardas, permisos
  dev/                         # herramientas solo de desarrollo, fuera de core
    toast-dev-panel/
  shared/                      # ≡ el "common" del encargo
    components/
      atoms/                   # button · input · select · checkbox · radio ·
                               # switch · badge · avatar · (+ typography, icon,
                               # spinner, skeleton, divider, tooltip, link)
      molecules/               # form-field · radio-group · avatar-group ·
                               # file-input · toast · (+ search-field, card,
                               # pagination, empty-state, alert)
      organisms/               # dialog · date-picker · toast-container ·
                               # (+ data-table, page-header, confirm-dialog)
    forms/                     # form-control.context.ts · injectFormControl()
    services/                  # toast.service.ts
    utils/                     # class-list.ts · a11y.ts
    types/
    validations/
    index.ts                   # API pública de shared/
  features/
    <feature>/
      components/{atoms,molecules,organisms}/   # solo lo específico del dominio
      services/ · schemas/ · types/ · utils/ · pages/
      index.ts
```

**Alias de rutas a declarar en `tsconfig.json`:**

```jsonc
"paths": {
  "@core/*":     ["src/app/core/*"],
  "@shared/*":   ["src/app/shared/*"],
  "@features/*": ["src/app/features/*"]
}
```

**Reglas de dependencia (a documentar y, más adelante, a verificar):**

- `atoms` → no importan otros componentes. *(Excepción tolerada: `radio` depende
  de `radio-group`; al mover el grupo a molecules queda molecule → atom, correcto.)*
- `molecules` → solo atoms.
- `organisms` → atoms y molecules.
- `features` → cualquier cosa de `shared/` y `core/`, **nunca** de otra feature.
- `shared` → **nunca** importa de `features/`.
- `core` → nunca importa de `features/`. `dev/` sale del bundle de producción.

---

### 8. Plan por fases

| Fase | Contenido | Bloquea a | Riesgo |
|---|---|---|---|
| **1** | *(este documento)* Diagnóstico | — | — |
| **2** | **Reparar el build**: implementar `ToastService`, `Toast`, `ToastContainer`, `ToastDevPanel`, `App`; resolver la colisión de nombres | **todo** | **A** |
| **3** | Infraestructura: alias `@core`/`@shared`/`@features`, barriles `index.ts`, carga diferida de rutas | 4–6 | M |
| **4** | Reubicación atómica: `radio-group`, `avatar-group`, `file-input` → molecules; `date-picker`, `toast-container` → organisms; `form-control` → `shared/forms/`; tipos a su módulo | 5–6 | M |
| **5** | Consolidación: `injectFormControl()`, `classList()`, `a11y.ts`; extraer `organisms/dialog/` desde `date-picker` | 6 | **A** |
| **6** | Calidad: spec de `radio`, specs del sistema de avisos, ESLint, verificación de build/pruebas/a11y/responsive | 7 | M |
| **7** | Documentación: `CLAUDE.md`, reglas de clasificación, guía de componentes nuevos, deuda restante | — | B |

Cada fase cierra con `yarn build && yarn test --watch=false` en verde. Ninguna
avanza con el anterior en rojo.

---

### 9. Riesgos

| Riesgo | Fase | Mitigación |
|---|---|---|
| Implementar el sistema de avisos exige **inventar contratos** que las plantillas presuponen (`toast().type`, `iconLabel()`, duración, cola, "fijo") | 2 | Derivar el contrato de lo que las plantillas y el CSS ya exigen; no inventar de más. Confirmar con quien escribió el commit. |
| Extraer `dialog` desde `date-picker` puede romper la trampa de foco | 5 | Mover el comportamiento tal cual, sin rediseñar; probar con teclado antes y después. |
| Mover archivos rompe imports en cascada | 3–4 | Introducir alias y barriles **antes** de mover, así el destino se toca en un solo lugar. |
| `strictTemplates` convierte cualquier desajuste en error de build | todas | Es una red de seguridad, no un riesgo: se ejecuta el build en cada paso. |
| No hay lint ni e2e: el criterio de aceptación global no es verificable al 100 % | 6 | Documentarlo como deuda explícita; proponer ESLint como tarea separada. |
| La fuente normativa de diseño no está en el repo | todas | Ver *Información faltante*; no se altera ningún valor de token sin ella. |

---

### 10. Comandos de validación

```bash
yarn install                     # 1ª vez: node_modules no estaba instalado
yarn build                       # build de producción + type-check + strictTemplates
yarn test --watch=false          # Vitest, 18 specs
yarn test:coverage               # cobertura
yarn start                       # verificación visual en /design-system
npx prettier --check "src/**/*.{ts,html,css}"
```

Verificación de reglas de arquitectura (manual, hasta que haya lint):

```bash
grep -rn "features/" src/app/shared src/app/core   # debe no devolver nada
grep -rn "\.\./\.\./\.\./" src/app                 # imports profundos restantes
```

---

### 11. Información faltante

No obtenible del repositorio; se requiere del equipo:

1. **`ALOVIDA_Sistema_de_Diseno.html`** — citado como "raíz del repo" en
   `styles.css:4` y `button.types.ts:3`. **No existe en el repositorio.** Es la
   fuente de los valores de color y de las variantes.
2. **`Mantra Core Health Vault/SALUD/Arquitectura/identidad-visual.md`** — fuente
   normativa citada en 3 archivos, incluidas las excepciones WCAG E1–E4.
   **No está en el repositorio.**
3. **Contrato previsto del sistema de avisos**: campos de `Toast`, duraciones,
   política de cola, semántica de "fijo" y de "ráfaga". Las plantillas los
   presuponen; nadie los declaró.
4. **¿`features/home` es un marcador de posición?** Hoy es el boilerplate de
   Angular. Se asume que debe reescribirse; confirmar el contenido real.
5. **¿`shared/` o `common/`?** Se recomienda `shared/`; es reversible en Fase 2.
6. **¿Se adopta `@angular/forms`** (Reactive Forms) o se mantiene el contrato
   propio por señales? Condiciona toda la capa de formularios y validación.
7. **Alcance funcional próximo** (¿qué features entran primero?) — determina qué
   organismos comunes conviene construir y cuáles no.

---

### 12. Criterios de aceptación de la Fase 1

- [x] Arquitectura real mapeada y contrastada con el encargo.
- [x] 22 componentes/artefactos inventariados y clasificados.
- [x] Duplicación analizada: **no hay duplicación de componentes**; sí 4 patrones internos repetidos.
- [x] Dependencias y acoplamientos identificados con archivo y línea.
- [x] Riesgos por fase documentados.
- [x] Evidencia objetiva: `yarn build` y `yarn test` ejecutados, 18 errores capturados.
- [x] Información faltante listada explícitamente.

### Pendientes antes de avanzar

**Bloqueante:** la Fase 2 (reparar el build) necesita el punto 3 de *Información
faltante* — el contrato del sistema de avisos. Puede derivarse de las plantillas
y el CSS existentes, pero conviene confirmarlo antes de fijar la API pública de
`ToastService`.
