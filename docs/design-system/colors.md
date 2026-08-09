# Colores

Once rampas de diez pasos, más los tokens semánticos que cambian con el tema.
Los valores viven en `src/styles.css`; los nombres, en
`core/tokens/design-tokens.types.ts`.

---

## La paleta de marca

| Nombre | Hex | Token base | Rol |
|---|---|---|---|
| Azul Petróleo | `#0B557E` | `--c-petrol-500` | Marca primaria. **Estructura** |
| Aguamarina | `#4FB3A9` | `--c-aqua-500` | Marca secundaria. **Acciona** |
| Menta | `#9FD8D0` | `--c-mint-500` | Apoyo |
| Ámbar Arena | `#E4A96B` | `--c-amber-500` | Acento cálido. **≤ 10 % de la pantalla** |
| Gris Salvia | `#CDD9D5` | `--c-sage-500` | Bordes y divisores |
| Marfil | `#F6F3ED` | `--c-ivory-500` | Superficie alterna en claro; **tinta** en oscuro |

## Las once rampas

Cada una con diez pasos (50–900) que **no cambian con el tema**:

```text
petrol · aqua · mint · amber · sage · ivory · neutral
success · warning · error · info
```

### Dos son alias, a propósito

```css
--c-warning-*: var(--c-amber-*);   /* warning ≡ ámbar */
--c-info-*:    var(--c-aqua-*);    /* info ≡ aguamarina */
```

No es pereza: es que el sistema decidió que la advertencia **es** el ámbar y la
información **es** la aguamarina. Tener dos rampas distintas para el mismo rol
sería invitar a que se separaran.

`success` y `error` sí tienen rampa propia (`#2E8B6E` y `#B5533C`): son colores
que el sistema no usa para nada más.

## Tokens semánticos

Los que un componente debe usar. **Cambian con el tema**, y ese es el punto:
escribir `var(--bg-surface)` en vez de `#FFFFFF` es lo que hace que el modo
oscuro funcione sin tocar el componente.

### Superficies

| Token | Claro | Oscuro |
|---|---|---|
| `--bg-base` | `#FFFFFF` | `--c-petrol-900` |
| `--bg-surface` | `#FFFFFF` | `--c-petrol-800` |
| `--bg-surface-alt` | `--c-ivory-400` | `--c-petrol-700` |
| `--bg-inset` | `--c-ivory-300` | `#0F2E42` |

**En oscuro, las superficies SON la rampa del petróleo.** El azul deja de ser
marca y pasa a ser estructura.

### Texto

| Token | Claro | Contraste | Oscuro | Contraste |
|---|---|---|---|---|
| `--text-primary` | `--c-neutral-500` | 13,46 AAA | `--c-ivory-500` | — |
| `--text-secondary` | `--c-neutral-400` | 7,24 AAA | `--c-sage-200` | — |
| `--text-muted` | `--c-neutral-300` | **3,86–4,27 · E1** | `--c-sage-600` | **4,45 · E2** |
| `--text-inverse` | `#FFFFFF` | — | `--c-petrol-900` | — |

**El marfil pasa de papel a tinta** entre los dos temas.

### Marca

| Token | Claro | Oscuro |
|---|---|---|
| `--brand-primary` | `--c-petrol-500` (7,25 AAA) | `--c-aqua-400` |
| `--brand-primary-hover` | `--c-petrol-600` | `--c-aqua-300` |
| `--brand-primary-active` | `--c-petrol-700` | `--c-aqua-500` |
| `--brand-secondary` | `--c-aqua-500` | `--c-mint-300` |
| `--brand-accent` | `--c-amber-500` | `--c-amber-400` |

### Bordes

| Token | Uso | Nota |
|---|---|---|
| `--border-default` | Divisor **decorativo** | **No delimita controles** |
| `--border-strong` | El único válido para el borde de un control | 3,34:1 en claro · **E3 en oscuro** |

Confundirlos es el error más fácil de cometer: un `<input>` con
`--border-default` se ve bien y no cumple el mínimo de 3:1 para componentes de
interfaz.

## Estados: la receta tonal

| Tema | Fondo | Texto | Borde |
|---|---|---|---|
| Claro | 50 | 700 | 200 |
| Oscuro | 800 | 200 | 600 |

Aplicada a `success`, `warning`, `error` e `info`.

### Dos excepciones medidas

```css
/* primary NO sigue el 800/200/600: petrol-800 ES --bg-surface en oscuro
   y el chip desaparecería sobre una tarjeta. Sube a 600/100/400. */
--st-primary-bg: var(--c-petrol-600);
--st-primary-fg: var(--c-petrol-100);
--st-primary-bd: var(--c-petrol-400);

/* secondary usa menta 800 y no 700: menta-700 sobre menta-50 da 3,73:1 y no
   llega a AA con texto chico; con el 800 sube a 6,62:1. */
--st-secondary-fg: var(--c-mint-800);
```

**Las dos traen el número que las justifica en el propio CSS.** Es el estándar de
rigor del sistema: no se cambia un token sin decir cuánto mide.

### Los tonos de marca no son estados

`--st-primary-*` y `--st-secondary-*` comparten prefijo con los estados porque
comparten **receta**, pero no son estados de producto:

```ts
/**
 * Chips de marca: la MISMA receta tonal de los `--st-*` aplicada a las rampas
 * de marca. Comparten prefijo porque comparten recipe, pero **no son estados de
 * producto** — por eso viven aparte de `StatusType`.
 */
```

Y `design-tokens.types.ts` refuerza la distinción en el otro sentido:

> *«Semántica de producto de los `--st-*`. **NO es severidad clínica**
> (identidad-visual.md Parte 11.3).»*

Que `--st-error-*` sea rojo no significa que un resultado clínico crítico se
pinte con él. Son dos vocabularios distintos, y mezclarlos en una aplicación de
salud es un error de significado, no de estilo.

## Reglas de tinta que no se negocian

| Sobre | Nunca | Contraste del error | Siempre |
|---|---|---|---|
| Aguamarina (`--brand-secondary`) | Blanco | 2,51:1 | Tinta oscura |
| Ámbar (`--brand-accent`) | Blanco | 2,06:1 | Tinta oscura |

Los dos números están en `styles.css` junto al token.

## Efectos

| Token | Claro | Oscuro |
|---|---|---|
| `--focus-ring` | `rgba(79,179,169,.45)` — aguamarina | `rgba(159,216,208,.45)` — menta |
| `--shadow-sm/md/lg` | Tintadas de petróleo | Negro puro, más opacas |

Las sombras en claro **no son grises**: llevan `rgba(11,85,126,…)`, el propio
petróleo. Una sombra gris sobre una paleta cálida se ve sucia.

## Verificación

- Las pruebas leen `styles.css` y comprueban que cada token declarado en
  TypeScript existe.
- **Los contrastes NO se verifican automáticamente.** Los números de los
  comentarios son de la auditoría de diseño (`identidad-visual.md`), medidos a
  mano. Brecha `MEDIUM` en
  [color y contraste](../accessibility/color-and-contrast.md).
