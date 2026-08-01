# Principios del sistema de diseño

**REDSAT v1.0.** Fuente normativa:
`Mantra Core Health Vault/SALUD/Arquitectura/identidad-visual.md`.
Fuente física de los valores: `src/styles.css`.

---

## La regla de las dos fuentes

```text
src/styles.css                         → los VALORES  (#0B557E, 16px, …)
src/app/core/tokens/design-tokens.types.ts → los NOMBRES (--brand-primary, --sp-4)
```

`design-tokens.types.ts` **no declara ni un hex ni un píxel**, y lo dice:

> *«duplicar un valor sería abrir una quinta frontera de deriva.»*

Un componente nunca escribe `'--bg-surface'` a mano: escribe
`cssVar(SURFACE.surface)` y el compilador atrapa el error de tipeo.

```ts
export function cssVar(token: DesignToken): string {
  return `var(${token})`;
}
```

## Los cinco principios operativos

### 1 · El azul estructura, la aguamarina acciona

En modo claro, `--brand-primary` es el petróleo (`#0B557E`, contraste 7,25 en el
peor caso). En modo oscuro, **las superficies pasan a ser la rampa del petróleo**
y la aguamarina toma la acción primaria:

```css
:root[data-theme='dark'] {
  --bg-surface: var(--c-petrol-800);   /* el azul es fondo */
  --brand-primary: var(--c-aqua-400);  /* la aguamarina acciona */
}
```

No es un cambio de paleta: es un cambio de rol.

### 2 · El ámbar es escaso por regla

> *«ámbar ≤ 10 % de la pantalla y UN solo punto de acción cálido.»*

`--brand-accent` existe para señalar una cosa. Dos puntos ámbar en la misma
pantalla no señalan ninguna.

Y siempre con **tinta oscura encima, nunca blanca**: blanco sobre ámbar da 2,06:1
y no pasa ningún nivel. Lo mismo con la aguamarina (2,51:1).

### 3 · Los estados usan la receta 50 / 700 / 200

Fondo claro, texto oscuro del mismo tono, borde intermedio:

```css
--st-error-bg: var(--c-error-50);
--st-error-fg: var(--c-error-700);
--st-error-bd: var(--c-error-200);
```

En oscuro se invierte a 800 / 200 / 600. Con **una excepción medida**:

```css
/* primary NO sigue el 800/200/600: petrol-800 ES --bg-surface en oscuro
   y el chip desaparecería sobre una tarjeta. Sube a 600/100/400. */
--st-primary-bg: var(--c-petrol-600);
```

Y otra en claro:

```css
/* secondary usa menta 800 y no 700: menta-700 sobre menta-50 da 3,73:1 y no
   llega a AA con texto chico; con el 800 sube a 6,62:1. */
--st-secondary-fg: var(--c-mint-800);
```

**Las dos excepciones están documentadas en el propio CSS con el número que las
justifica.** Es el estándar de rigor de este sistema.

### 4 · La grilla es de 4 px, y los escalones raros no existen

```css
--sp-1: 4px;  --sp-2: 8px;   --sp-3: 12px;  --sp-4: 16px;  --sp-5: 20px;
--sp-6: 24px; --sp-8: 32px;  --sp-10: 40px; --sp-12: 48px; --sp-16: 64px;
--sp-20: 80px;
```

Faltan el 7, el 9, el 11… **a propósito**. Un catálogo con todos los múltiplos no
es un sistema: es una regla graduada.

### 5 · El radio de firma va en un elemento por pantalla

```css
--r-signature: 28px 4px 28px 4px;
```

> *«UN elemento destacado por pantalla; nunca botones/inputs.»*

Es la forma que da identidad. Repetida, deja de identificar.

## Las excepciones WCAG están declaradas, no escondidas

`identidad-visual.md` Parte 8.2 enumera E1–E4. Tres aparecen anotadas en el CSS:

| Excepción | Dónde | Regla de uso |
|---|---|---|
| **E1** · `--text-muted` en claro (3,86–4,27:1) | `--c-neutral-300` | Solo texto terciario. **Jamás información clínica** |
| **E2** · `--text-muted` en oscuro (4,45:1 en la superficie más alta) | `--c-sage-600` | Ídem |
| **E3** · `--border-strong` en oscuro (<3:1) | `rgba(255,255,255,0.24)` | Sin foco. Con foco manda el anillo |

`design-tokens.types.ts` repite la regla de E1 junto al token, para que quien
autocomplete la lea:

```ts
/** Terciario: excepción WCAG E1 — jamás para información clínica. */
muted: '--text-muted',
```

**Declarar una excepción con su número y su regla de uso es lo contrario de
ignorarla.** Ver [color y contraste](../accessibility/color-and-contrast.md).

## Un sistema propio, sin biblioteca de terceros

48 componentes escritos en el repositorio. Cero dependencias de interfaz: no hay
Material, ni PrimeNG, ni Tailwind, ni CDK.

Las consecuencias, en las dos direcciones:

| A favor | En contra |
|---|---|
| Cero peso de biblioteca en el paquete | Todo hay que escribirlo |
| Los tokens son la única fuente de estilo | Y hay que mantenerlos |
| Control total de la accesibilidad | Y responsabilidad total |
| Sin conflictos de versión con Angular 21 | Sin comunidad que reporte defectos |

Registrado en [ADR-0004](../adr/ADR-0004-sistema-de-diseno-propio.md).

## Los nombres de familia están en inglés

Decisión del 2026-07-29 («identificadores en inglés»):

```text
azul → petrol · menta → mint · ámbar → amber · salvia → sage · marfil → ivory
```

`aqua` y `neutral` no cambian. **El resto de los nombres de token sigue siendo el
del diseñador**, para que la conversación entre diseño y desarrollo no necesite
traducción.

## Dónde seguir

- [Tokens](tokens.md) — el catálogo tipado y las tres duplicaciones necesarias
- [Colores](colors.md) · [Tipografía](typography.md) · [Espaciado](spacing.md)
- [Temas](themes.md) — cómo funciona claro/oscuro sin parpadeo
- [Diseño adaptable](responsive-design.md) · [Movimiento](motion.md) · [Íconos](icons.md)
