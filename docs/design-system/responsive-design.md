# Diseño adaptable

Mobile-first, tres puntos de quiebre, y una regla que el CSS no puede cumplir
solo.

---

## La escala

| Token | Valor | Qué es |
|---|---:|---|
| `--bp-sm` | 650 px | Teléfono grande |
| `--bp-md` | **780 px** | Tableta. **El corte principal del sistema** |
| `--bp-lg` | 1024 px | Escritorio |

**Extraída, no inventada.** El comentario del código lo dice:

> *«780 px era el corte de facto con 30 usos y 1024 px el secundario con 2.
> Pendiente de que el diseñador la confirme.»*

Es la forma correcta de fijar una escala en un proyecto que ya existe: se mide lo
que hay y se nombra, en vez de imponer los valores de un framework.

> **Pendiente real, registrado.** La escala espera confirmación de diseño. Está
> anotado como brecha `LOW` — no bloquea nada, pero la nota está en el código y
> conviene cerrarla.

## Mobile-first, sin excepción

```ts
export function mediaFrom(name: BreakpointName): string {
  return `(min-width: ${BREAKPOINTS[name]}px)`;
}
```

**Siempre `min-width`.** Y no hay una función equivalente para `max-width`, a
propósito:

> *«escribirla invitaría a seguir haciéndolo al revés.»*

El teléfono es el caso base y cada corte **agrega**, nunca quita. Una regla
`max-width` obliga a mantener dos verdades sobre el mismo elemento.

## Los tokens `--bp-*` no sirven en `@media`

```css
/* ⚠️ NO se pueden usar en `@media`. CSS no admite custom properties en la
   condición de una consulta de medios: `@media (min-width: var(--bp-md))`
   no funciona en ningún navegador. */
```

Es una limitación de CSS, no del proyecto. Las consultas llevan el número
literal; los tokens sirven para anchos de contenedor y cálculos donde sí valen.

De ahí sale [la primera de las tres duplicaciones necesarias](tokens.md#1--la-escala-de-puntos-de-quiebre).

## El caso que el CSS no puede resolver

`app-shell` recibe `drawerMode` como **entrada**. No mide la ventana:

```ts
// core/layout/breakpoints.ts
export const NAV_DRAWER_MAX_WIDTH = 780;
```

> *«El CSS decide **cómo se ve** el panel y esto decide si el encabezado ofrece el
> botón de hamburguesa. Son dos preguntas distintas sobre el mismo umbral, y una
> de las dos no se puede responder desde una hoja de estilos.»*

Un botón que existe pero está oculto con CSS **sigue en el orden de tabulación y
lo sigue anunciando el lector de pantalla**. Ocultarlo bien exige quitarlo del
árbol, y eso es TypeScript.

Sin esto, `drawerMode` se queda en su valor por omisión y en un teléfono el nav
ocupa una columna fija de 260 px que empuja el contenido fuera de la pantalla.

### Bajo SSR arranca en escritorio

```ts
private readonly narrow = signal(false);   // false = escritorio

constructor() {
  afterNextRender(() => this.observe(), { injector: this.injector });
}
```

El servidor no tiene ventana. Arrancar en `false` y corregir tras el primer
render es lo menos malo:

| Arranque | Qué pasa al hidratar |
|---|---|
| `false` (escritorio) — **el elegido** | En un teléfono, el nav aparece como cajón tras el primer render |
| `true` (cajón) | En un escritorio, **el botón de hamburguesa desaparecería** — un elemento que se va es peor que uno que llega |

Y `matchMedia` puede faltar en un DOM recortado de pruebas: si falta, se queda en
escritorio, *«que es el modo en el que la aplicación es usable de todas formas».*

## Comportamiento por ancho

| Ancho | Navegación | Contenido |
|---|---|---|
| < 780 px | Cajón sobre el contenido, con botón de menú | Una columna |
| ≥ 780 px | Columna fija de 260 px | Junto al nav |
| ≥ 1024 px | Ídem | Más holgura |

El propio `styles.css` cierra con la referencia:

```css
/* breakpoints ALOVIDA (referencia; se usan al construir pantallas):
   móvil < 780 px · tablet 780–1024 px · escritorio > 1024 px — mobile-first */
```

## Lo que no hay

| Técnica | Estado |
|---|---|
| Consultas de contenedor (`@container`) | No se usan. Todo es de ventana |
| Tipografía fluida (`clamp()`) | No. Los tamaños son fijos en todos los anchos |
| Imágenes adaptables (`srcset`) | No hay imágenes de contenido |
| Objetivos táctiles verificados | **No medidos.** WCAG 2.2 pide 24×24 px mínimo |
| Prueba de zoom al 200 % / reflow a 320 px | **No ejecutada** |
| Regresión visual por ancho | No existe |

### Las dos que sí importan

**Tipografía fija.** `--fs-display` son 44 px en todos los anchos. En un teléfono
de 320 px, un título de display ocupa mucho. Brecha `MEDIUM`.

**Reflow sin verificar.** WCAG 2.2 §1.4.10 exige que el contenido sea usable a
320 px sin desplazamiento horizontal. Nadie lo comprobó. Brecha `MEDIUM` en
[la auditoría de accesibilidad](../accessibility/audit-report.md).

## Cómo probar

```bash
yarn start
# 1 · Achicar por debajo de 780 px → el nav pasa a cajón y aparece el botón
# 2 · Con teclado, comprobar que el botón NO está en el orden de tabulación
#     cuando no se ve (debe estar fuera del árbol, no oculto)
# 3 · Zoom al 200 % → sin desplazamiento horizontal
# 4 · Ancho 320 px → el contenido sigue siendo usable
```

Los pasos 3 y 4 son los que hoy nadie ejecuta de forma sistemática.
