# Informe de auditoría de accesibilidad

- **Fecha:** 2026-08-01
- **Norma:** WCAG 2.2 nivel AA
- **Método:** **revisión de código**, no de ejecución. Ver §Limitaciones
- **Alcance:** 8 pantallas navegables, 48 componentes de `shared/`, `src/styles.css`

---

## Resumen

| Severidad | Hallazgos |
|---|---:|
| Bloqueante | **0** |
| Alta | **2** |
| Media | **8** |
| Baja | **4** |

**Ningún hallazgo bloqueante.** Los dos altos son del mismo tipo: una respuesta
del sistema que aparece visualmente y no se anuncia.

> **Advertencia sobre este resumen.** «Cero bloqueantes» describe lo que se puede
> ver leyendo el código. **No hay ninguna auditoría automatizada ni ninguna
> prueba con lector de pantalla**, así que este informe no puede declarar
> conformidad AA. Ver §Limitaciones.

---

## Hallazgos

### A11Y-01 · `HIGH` · El acuse de recuperación no se anuncia

**Dónde:** `/auth/forgot-password` — `forgot-password.ts` / `.html`

Tras enviar, `requested()` pasa a `true` y el formulario se reemplaza por el
acuse. **No hay región viva ni se mueve el foco.**

El acuse **es toda la respuesta** que recibe la persona —y es idéntico exista o
no la cuenta, a propósito—, así que quien use lector de pantalla puede quedarse
esperando algo que ya pasó.

**Criterio:** WCAG 4.1.3 (Mensajes de estado).
**Propuesta:** envolver el acuse en una región viva `polite` y mover el foco a su
encabezado.

### A11Y-02 · `HIGH` · `IDENTITY_VERIFICATION_ROUTE` no lleva a ninguna parte

**Dónde:** `core/http/error-to-view-state.ts`

```ts
export const IDENTITY_VERIFICATION_ROUTE = '/identity/me';
```

Es la ruta **de la API**, no del router de Angular. Ninguna ruta coincide, así que
el comodín la redirige a `/`.

El estado S5 «con acción» —*la puerta*— existe justamente para ofrecer una salida
a quien no verificó su identidad. **Hoy esa salida no lleva a ningún lado**, lo
que la convierte en un muro con cartel de puerta.

**Criterio:** no es estrictamente WCAG, es de producto; pero afecta a quien
depende de la acción explícita para saber qué hacer.
**Propuesta:** apuntarla a la ruta de Angular cuando la pantalla exista, o quitar
la acción hasta entonces.

### A11Y-03 · `MEDIUM` · El error general no se anuncia en 6 pantallas

**Dónde:** las seis pantallas de `features/auth/`

Muestran el error con un `app-alert` propio, **sin región viva y sin mover el
foco** — a diferencia de `ViewStateHost`, que hace las dos cosas.

**Criterio:** WCAG 4.1.3.
**Propuesta:** extraer las dos reglas de `ViewStateHost` a una directiva y
aplicarla. No hay que reescribir nada.

### A11Y-04 · `MEDIUM` · Las confirmaciones no se anuncian

**Dónde:** `/auth/register`, `/auth/reset-password`, `/auth/verify-email`

Reemplazan el formulario sin anuncio ni foco.

**Criterio:** WCAG 4.1.3. **Misma propuesta que A11Y-03.**

### A11Y-05 · `MEDIUM` · Los errores del servidor no se anclan al campo

**Dónde:** `core/http/error-to-view-state.ts` → `issuesOf`

`ViewStateIssue` admite `field` y `ViewStateHost` lo pinta, pero `issuesOf` no lo
rellena: los errores del servidor se muestran como una lista suelta en vez de en
el `aria-describedby` del campo.

**Criterio:** WCAG 3.3.1.
**Propuesta:** mapear `details` a campos cuando el backend los identifique.

### A11Y-06 · `MEDIUM` · Contrastes sin verificación automática

**Dónde:** `src/styles.css`

Los números son de `identidad-visual.md`, medidos a mano. Las pruebas comprueban
que los tokens **existan**, no que sus valores cumplan.

**Riesgo:** un cambio de token puede romper el contraste del modo oscuro sin que
nadie lo vea.
**Propuesta:** un script que calcule los contrastes de las combinaciones
declaradas y falle bajo umbral. Es aritmética sobre valores que ya están en el
CSS; no requiere ninguna dependencia.

### A11Y-07 · `MEDIUM` · E1/E2 no se hacen cumplir

**Dónde:** `--text-muted`

La regla —*«jamás para información clínica»*— está escrita en dos lugares y **no
está hecha cumplir en ninguno**.

**Riesgo:** específico de este dominio. Un valor de laboratorio en texto
terciario es un riesgo de lectura.
**Propuesta:** una regla de lint o una prueba, cuando existan las secciones
clínicas.

### A11Y-08 · `MEDIUM` · Reflow y zoom sin verificar

WCAG 2.2 §1.4.10 exige contenido usable a 320 px sin desplazamiento horizontal.
**Nadie lo comprobó.** Agravante: la tipografía es fija (`--fs-display` son 44 px
en todos los anchos).

**Propuesta:** verificación manual, y evaluar `clamp()` para los roles grandes.

### A11Y-09 · `MEDIUM` · Objetivos táctiles sin medir

WCAG 2.2 §2.5.8 exige 24×24 px mínimo. Los tamaños de `AppButton` y de los
controles **no se midieron**.

### A11Y-10 · `MEDIUM` · `/auth/organization` sin estado vacío

Sin sesión, la pantalla muestra una lista vacía **sin mensaje ni salida**.

**Criterio:** WCAG 3.3.2 en sentido amplio: no hay instrucción alguna.

### A11Y-11 · `LOW` · El aviso de botón sin nombre no falla

`AppButton` avisa por consola en desarrollo. Un control mudo en producción es
inutilizable, y el aviso no lo impide.

**Propuesta:** una prueba que recorra las plantillas buscando `iconOnly` sin
`aria-label`.

### A11Y-12 · `LOW` · Nada impide un control sin `app-form-field` · **cerrado en parte**

Un `app-input` suelto cae en su propio id **sin nombre accesible**. No hay regla
de lint que lo prohíba.

**Y ocurría.** `axe-core` lo encontró en tres sitios reales —el desplegable de
resultados por página del paginado y los dos filtros de `app-filter-bar`—, con
impacto **crítico** (`select-name`). Los tres pasaban un `placeholder`, que no
nombra al control: se renderiza como `<option hidden>` y el lector de pantalla lo
lee como una opción más.

Corregido dando a `app-select` un `ariaLabel`, la misma vía que
`app-search-field` ya usaba con un `<label>` invisible.

Sigue sin haber regla de lint, pero ya no hace falta que la haya: la
[auditoría de axe](../testing/accessibility-tests.md#2--axe-core--las-reglas-que-nadie-escribió-a-mano)
corre en CI y falla ante el próximo caso.

### A11Y-13 · `LOW` · Sin gestión de foco entre pantallas de `auth/`

No están dentro de `app-shell`, así que al navegar del login al registro el foco
no se mueve.

### A11Y-14 · `LOW` · El comodín redirige en vez de mostrar un 404

Una URL mal escrita lleva al panel sin explicación. Para quien usa lector de
pantalla, el destino inesperado es más desorientador.

---

## Limitaciones de esta auditoría

**Es de código, no de ejecución.** No se pudo hacer, y por qué:

| Método | Por qué no |
|---|---|
| axe-core / Lighthouse | **No hay herramienta instalada** en el proyecto |
| NVDA / JAWS / VoiceOver | No ejecutado |
| Recorrido con teclado en navegador | No ejecutado |
| Medición real de contrastes | Sin herramienta |
| Zoom 200 % y reflow 320 px | No ejecutado |
| Contraste forzado | No ejecutado |

**Consecuencia: este informe no declara conformidad AA.** Declara que el código
no muestra defectos evidentes y enumera catorce que sí lo son.

Un `aria-live` correcto en el HTML puede no anunciarse en un lector real por
razones que solo aparecen al probarlo.

## Recomendaciones, en orden

1. **Probar con un lector de pantalla real.** Es lo que más información aporta
   por unidad de esfuerzo, y no requiere instalar nada.
2. **Ejecutar el [guion de teclado](keyboard.md#guion-de-prueba-manual).**
   Tampoco requiere instalar nada.
3. **Resolver A11Y-01 y A11Y-03/04** con una sola directiva reutilizable.
4. **Añadir la verificación de contrastes** (A11Y-06): script propio, sin
   dependencias.
5. **Incorporar axe-core a las pruebas de componente.** Es la única de la lista
   que añade una dependencia, y por eso va después.

Ninguna se ejecuta en este trabajo documental: las cinco son cambios de producto
o de herramientas. Están en
[el análisis de brechas](../reports/documentation-gap-analysis.md) con su
clasificación.
