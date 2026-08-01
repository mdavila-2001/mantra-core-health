# Fases ejecutadas — 2 a 6

**Rama:** `dev` · **Punto de partida:** `ca3a245` (build roto)
**Estado al cierre:** lint ✅ · build ✅ · pruebas ✅ 22/22 archivos, **211/211 casos**

| Métrica | Antes | Después |
|---|---|---|
| Errores de compilación | **18** | 0 |
| Pruebas | 162 (inejecutables) | **211** |
| Bundle inicial (transferencia) | 101,76 kB | **80,96 kB** |
| Lint | no existía | 0 errores |

---

## Fase 2 — Reparación del build

### Objetivo

Devolver el repositorio a un estado compilable. Sin esto ninguna fase posterior
puede validarse (regla 9 del encargo).

### Hallazgos

El commit `ca3a245` incorporó plantillas y CSS completos del sistema de avisos
dejando las clases como *stubs* del CLI: **18 errores de compilación**, suite de
pruebas inejecutable.

### Decisiones tomadas

| Decisión | Motivo |
|---|---|
| El contrato se **deriva** de las plantillas y el CSS existentes | Estaban terminados y son normativos: `toast().type/title/message`, `iconLabel()`, `dismiss()`, clases `toast--{tipo}`, `lanzarFijo`, `lanzarRafaga`. No se inventó API de más. |
| `interface Toast` → **`ToastMessage`** | Colisionaba con `class Toast` en el mismo directorio. |
| El tipo de aviso reusa **`StatusType`** de los tokens | Un catálogo propio sería una quinta frontera de deriva; `--st-*` ya define los cuatro tonos. |
| La **región viva es el contenedor**, no el aviso | Un `aria-live` que nace junto con el primer aviso no se anuncia. Los `app-toast` no llevan `role="alert"`: dos regiones anidadas anuncian dos veces. |
| `aria-live="polite"`, no `assertive` | Los errores llegan tras una acción del usuario, que ya espera respuesta; interrumpir al lector no aporta. |
| Techo de **4 avisos** con descarte del más viejo | Una pila sin techo tapa la pantalla y deja el aviso más reciente fuera de la vista. |
| Sin temporizadores en el servidor | Un `setTimeout` pendiente retrasa el render de SSR y nadie ve expirar un aviso en el HTML inicial. |
| `duration: null` = **fijo** | Es lo que el botón «Fijo» del panel de desarrollo presuponía. |
| `ToastService` cancela sus temporizadores en `DestroyRef.onDestroy` | Un temporizador vivo retiene el servicio y cuelga al runner de pruebas. |

### Archivos afectados

| Archivo | Acción |
|---|---|
| `shared/components/molecules/toast/toast.types.ts` | Reescrito — `ToastMessage`, `ToastOptions`, techos, etiquetas habladas |
| `shared/components/molecules/toast/toast.service.ts` | Reescrito — cola por signals, autocierre, techo, limpieza |
| `shared/components/molecules/toast/toast.ts` | Implementado — `input.required`, `output<number>`, clase por tono |
| `shared/components/molecules/toast-container/toast-container.ts` | Implementado — región viva |
| `core/dev/toast-dev-panel/toast-dev-panel.ts` | Implementado — lanzar/fijo/ráfaga/limpiar |
| `app/app.ts` | `isDev` + imports de contenedor y panel + `OnPush` |
| `toast.service.spec.ts`, `toast.spec.ts`, `toast-container.spec.ts` | **Nuevos** — 34 casos |

### Validaciones ejecutadas

```
yarn build   → 18 errores  →  0 errores  ✅
yarn test    → no compila  →  196/196    ✅
```

`toast-dev-panel` sale en su **propio chunk diferido** (1,28 kB): en producción
nunca se descarga, tal como prometía el comentario de `app.html`.

### Riesgos asumidos

El contrato de `ToastService` es una **derivación**, no una especificación
confirmada. Si el autor del commit tenía otra API en mente (p. ej. acciones
dentro del aviso, o agrupación por clave), habrá que ajustarla. Las pruebas
documentan el comportamiento elegido, así que el cambio sería detectable.

---

## Fase 3 — Infraestructura

### Objetivo

Quitar de en medio lo que encarece cualquier movimiento posterior: rutas de
import frágiles, ausencia de API pública y carga ansiosa.

### Decisiones tomadas

| Decisión | Motivo |
|---|---|
| Alias `@shared`, `@shared/*`, `@core/*`, `@features/*` | Un `../../../` deja de decir de dónde viene y se rompe al mover el archivo. Son además las únicas fronteras que la arquitectura reconoce. |
| `@shared` a secas = el barril; `@shared/*` = lo interno | Un feature importa de la API pública; el interior de shared usa rutas directas. |
| Barriles por capa + barril raíz | Mover una carpeta se paga **una sola vez**, en el barril. |
| **Todas** las rutas con `loadComponent` | La vitrina de diseño son 433 líneas de demo que viajaban en el bundle inicial. |
| **Se conserva `shared/`; no se renombra a `common/`** | Es la convención de Angular y cumple exactamente el rol que el encargo asigna a `common/`. Renombrar obliga a tocar todos los imports sin beneficio técnico (principio 8, regla 5). Reversible: hoy es un cambio de una línea en `tsconfig.json`. |

### Resultado medible

| Métrica | Antes | Después |
|---|---|---|
| Bundle inicial (crudo) | 391,98 kB | **286,40 kB** (−27 %) |
| Bundle inicial (transferencia) | 101,76 kB | **81,01 kB** (−20 %) |
| Chunks diferidos | 1 | **5** (`home`, `auth`, `design-system-sample`, `toast-dev-panel`, común) |

---

## Fase 4 — Reclasificación atómica

### Objetivo

Que la carpeta de cada componente diga la verdad sobre su nivel de composición.

### Decisiones tomadas

| Componente | De | A | Motivo |
|---|---|---|---|
| `RadioGroupComponent` | atoms | **molecules** | El grupo **es** el control: tiene el `value` y coordina a sus hijos. |
| `RadioComponent` | atoms | **molecules** | Su propia documentación lo dictó: «un radio suelto no significa nada». No es reutilizable de forma independiente, luego no es un atom. Mantenerlo junto al grupo evita además que un atom dependa de una molecule. |
| `AvatarGroupComponent` | atoms | **molecules** | Compone avatares y calcula desborde. |
| `FileInputComponent` | atoms | **molecules** | Área de soltar, validación de tipo/tamaño/cupo y reporte de descartes. |
| `DatePickerComponent` | molecules | **organisms** | Abre un diálogo modal, mueve y atrapa el foco, lo devuelve al cerrar, coordina calendario y hora. |
| `ToastContainer` | molecules | **organisms** | Es la región viva y coordina la cola entera. |
| `form-control.context.ts` | `components/form-control/` | **`shared/forms/`** | No es un componente: es un contrato de DI. Estaba fuera de la clasificación atómica. |

### Tipos devueltos a su componente

| Tipo | De | A |
|---|---|---|
| `SelectOption<T>` | `atoms/input/input.types.ts` | `atoms/select/select.types.ts` |
| `DatePickerMode` | `atoms/input/input.types.ts` | `organisms/date-picker/date-picker.types.ts` |
| `CalendarDay` | dentro de `date-picker.ts` | `organisms/date-picker/date-picker.types.ts` |

> Un atom no debe ser la casa de los contratos de otros: `input.types.ts` obligaba
> a `select` y a `date-picker` a cruzar una frontera de módulo para nada.

### Renombrado

`atoms/button/app-button.{ts,html,css,spec.ts}` → `button.{ts,html,css,spec.ts}`.
El prefijo `app-` pertenece al *selector*, no al archivo; convivía además con un
`button.types.ts` sin prefijo. *(La clase sigue siendo `AppButtonComponent`;
renombrarla es un cambio de API pública y se difiere.)*

### Verificación de las reglas de dependencia

```
¿shared/core importan de features?        ✔ ninguno
¿imports que suben 3+ niveles?            ✔ ninguno
¿atoms importa de molecules/organisms?    ✔ ninguno
¿molecules importa de organisms?          ✔ ninguno
```

### Validaciones ejecutadas

```
yarn build  ✅   yarn test  ✅ 21/21 archivos · 196/196 casos
```

---

## Estructura resultante

```text
src/app/
  core/
    dev/toast-dev-panel/          # fuera del bundle de producción
    tokens/                       # design-tokens.types.ts · theme.service.ts
  shared/
    index.ts                      # API pública  ← @shared
    forms/
      form-control.context.ts     # contrato de accesibilidad por DI
      inject-form-control.ts      # el lado del control (7 consumidores)
    components/
      atoms/       index.ts · avatar · badge · button · checkbox · input · select · switch
      molecules/   index.ts · avatar-group · file-input · form-field · radio ·
                   radio-group · toast
      organisms/   index.ts · dialog · date-picker · toast-container
  features/
    home/ · auth/ · design-system-sample/     # las tres, carga diferida
```

---

## Fase 5 — Consolidación

### Objetivo

Escribir una sola vez lo que estaba escrito muchas veces, sin cambiar
comportamiento.

### 5.1 · `injectFormControl()` — 7 componentes

El bloque que conecta un control con su `app-form-field` (pedir el campo,
generar un id de reserva, derivar `controlId`, `describedBy`, `required` e
`invalid`) estaba repetido en **input, select, checkbox, switch, file-input,
date-picker y radio-group**. Repetido siete veces deja de ser un detalle:
cualquier arreglo de accesibilidad hay que acertarlo siete veces.

Ahora vive en `shared/forms/inject-form-control.ts`:

```ts
private readonly form = injectFormControl('input', this.hasError);
protected readonly controlId = this.form.controlId;
```

**Decisión fina:** el id de reserva se pide **siempre**, aunque haya campo.
Basta con que un control lo pida condicionalmente para que las secuencias de
servidor y cliente se separen y la hidratación deje de coincidir.

**Validación:** 196/196 pruebas siguieron pasando sin tocar ni una. Como buena
parte comprueba atributos ARIA, es evidencia directa de que el comportamiento se
conservó.

### 5.2 · `organisms/dialog/` — extraído de `date-picker`

Era la **única implementación de trampa de foco del repositorio**, escrita en
línea dentro del date-picker.

**Se hizo con red de seguridad, en este orden:**

1. **Primero** se escribieron 4 pruebas de caracterización de la trampa de Tab
   (que no estaba cubierta) y se comprobó que pasaban contra el código viejo.
2. Recién entonces se extrajo el componente.
3. Las mismas 4 pruebas siguieron pasando: la extracción no cambió nada.

`DialogComponent` se monta **ya abierto** dentro de un `@if`: crear el componente
es abrirlo y destruirlo es cerrarlo, de modo que no hay un estado `open`
duplicado a los dos lados que pueda desincronizarse. Asume foco al abrir, trampa
de Tab, Escape, clic en el fondo, ARIA y devolución del foco (`restoreFocusTo`).

Se le añadió `prefers-reduced-motion`, que la versión original no tenía.

**11 pruebas propias** para el diálogo, independientes del date-picker.

### 5.3 · No hecho, y por qué

`classList()` y `warnIfNoAccessibleName()` quedan pendientes. Son repeticiones
de 10–12 líneas en 2–5 sitios, con variantes reales entre ellos; el beneficio no
está tan claro como en los dos casos anteriores y el principio 8 desaconseja
abstraer por abstraer.

---

## Fase 6 — Calidad

### ESLint

Instalado `angular-eslint` 22 + `typescript-eslint`. `yarn lint` → **0 errores**.

`ng add @angular-eslint/schematics` **falla bajo Yarn PnP** (`Collection
"@schematics/angular" cannot be resolved`), así que el script invoca `eslint .`
directamente en vez de `ng lint`, que exigiría el builder en `angular.json`.

Lo relevante: **las reglas de arquitectura dejaron de ser un acuerdo y pasaron a
estar verificadas**. Lo que antes comprobaba a mano con `grep` ahora falla en CI:

| Regla | Alcance |
|---|---|
| `shared/` y `core/` no importan de `features/` | `no-restricted-imports` |
| Un atom no importa molecules ni organisms | `no-restricted-imports` |
| Una molecule no importa organisms | `no-restricted-imports` |
| `OnPush` obligatorio | `prefer-on-push-component-change-detection` |
| `any` prohibido | `no-explicit-any` (el repo no tiene ninguno) |

### Hallazgo de accesibilidad del lint

El lint marcó el fondo del diálogo: *click sin manejador de teclado* y *elemento
interactivo no enfocable*.

**Se analizó y se suprimió de forma acotada, con la razón escrita en el código.**
El equivalente por teclado existe y es **Escape**, que el diálogo ya atiende.
Añadir `tabindex` a un fondo decorativo lo metería en el orden de tabulación
**dentro de la propia trampa de foco**: sería peor para quien navega con teclado,
no mejor. La regla no puede ver el Escape del elemento hermano.

*(No es «ocultar un error» en el sentido de la regla 10 del encargo: es registrar
un análisis que el linter no puede hacer. La alternativa era empeorar la
accesibilidad para complacer a una regla.)*

### Prettier — deuda deliberada

**47 archivos con diferencias de formato, todas preexistentes** (incluye
`styles.css`, `index.html` y `server.ts`, que nadie tocó). No se ejecutó
`--write`: reformatear 47 archivos mezclaría ruido con la refactorización
(regla 5). Merece un commit propio y aislado.

### Pendiente en Fase 6

- Sin pruebas e2e ni de accesibilidad automatizadas (axe).
- Sin validación manual en navegador (`yarn start`) del date-picker tras extraer
  el diálogo: las pruebas cubren foco y teclado, pero no el aspecto visual.

---

## Fase 7 — Documentación *(no iniciada)*

`CLAUDE.md` con las reglas de clasificación y la guía de componentes nuevos.

### Decisiones que siguen esperando al equipo

1. **Contrato de avisos**: ¿la API derivada es la que se quería?
2. **`shared/` vs `common/`**: se recomienda `shared/`; hoy cuesta una línea revertirlo.
3. **`@angular/forms`** o contrato propio por signals: condiciona toda la capa de formularios.
4. **`features/home`** sigue siendo el boilerplate de Angular (logo y enlaces a angular.dev).
5. Las **fuentes normativas de diseño** citadas en el código siguen sin estar en el repositorio.
