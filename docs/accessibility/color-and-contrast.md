# Color y contraste

Los números salen de la auditoría de diseño (`identidad-visual.md`), están
anotados en el CSS junto a cada token, y **ninguno se verifica
automáticamente**.

---

## Contrastes declarados

### Texto en modo claro

| Token | Color | Contraste | Nivel |
|---|---|---:|---|
| `--text-primary` | `--c-neutral-500` | 13,46:1 | AAA |
| `--text-secondary` | `--c-neutral-400` | 7,24:1 | AAA |
| `--text-muted` | `--c-neutral-300` | 3,86–4,27:1 | **E1 · no llega a AA** |
| `--brand-primary` | `--c-petrol-500` | 7,25:1 | AAA |

### Bordes

| Token | Contraste | Nivel |
|---|---:|---|
| `--border-strong` (claro) | 3,34:1 | AA para componentes (≥3:1) |
| `--border-strong` (oscuro) | <3:1 | **E3** |
| `--border-default` | — | **No delimita controles.** Es decorativo |

Confundir los dos bordes es el error más fácil: un `<input>` con
`--border-default` se ve bien y **no cumple** el mínimo de 3:1 de WCAG 1.4.11.

### Los pares que se prohíben

| Fondo | Tinta prohibida | Contraste del error |
|---|---|---:|
| Aguamarina `--brand-secondary` | Blanco | 2,51:1 |
| Ámbar `--brand-accent` | Blanco | 2,06:1 |

Los dos números están en `styles.css` junto al token, con la regla: **siempre
tinta oscura encima**.

### Chips de marca

| Token | Ajuste | Motivo |
|---|---|---|
| `--st-secondary-fg` en claro | menta **800**, no 700 | menta-700 sobre menta-50 da **3,73:1**; con el 800 sube a **6,62:1** |
| `--st-primary-*` en oscuro | 600/100/400, no 800/200/600 | `petrol-800` **ES** `--bg-surface` en oscuro: el chip desaparecería sobre una tarjeta |

**Las dos excepciones traen su medición.** Ése es el estándar de rigor del
sistema: no se cambia un token sin decir cuánto mide.

## Las excepciones E1–E3

| # | Qué | Regla |
|---|---|---|
| **E1** | `--text-muted` en claro, 3,86–4,27:1 | Solo texto terciario. **Jamás información clínica** |
| **E2** | `--text-muted` en oscuro, 4,45:1 | Ídem |
| **E3** | `--border-strong` en oscuro, <3:1 | Sin foco. Con foco manda el anillo |

`design-tokens.types.ts` repite la regla de E1 junto al token para que se lea al
autocompletar.

### El hueco de E1 y E2

**Nada impide poner `--text-muted` en un valor de laboratorio.** La regla está
escrita en dos lugares y no está hecha cumplir en ninguno.

En una aplicación de salud, un valor clínico en texto terciario es un riesgo de
lectura real, no una infracción formal. Brecha `MEDIUM`, y de las más específicas
de este dominio.

Una regla de lint o una prueba que busque `--text-muted` en las plantillas de
secciones clínicas sería la mitigación natural — cuando esas secciones existan.

## El foco no depende del color

```css
:focus-visible {
  outline: 2px solid transparent;
  outline-offset: 2px;
  box-shadow: 0 0 0 4px var(--focus-ring);
}
```

El `outline: 2px solid transparent` **no es decorativo**: en modo de contraste
forzado (Windows) los colores se sustituyen y el `box-shadow` desaparece, pero el
`outline` reaparece con el color del sistema.

Sin esa línea, **el foco sería invisible para quien usa contraste forzado** — que
es precisamente quien más lo necesita.

## El color no es el único portador de significado

Verificado por componente:

| Componente | Además del color |
|---|---|
| `app-alert` | Ícono + título de texto |
| `app-badge` | Texto (`value`) |
| `app-form-field` | Texto del error + `aria-invalid` |
| `ViewStateHost` | Título y descripción por estado |
| `app-chip` | Etiqueta |
| `app-progress` | `label` |

**Ninguno comunica solo con color.** Cumple WCAG 1.4.1.

## `color-scheme`

```css
:root { color-scheme: light dark; }
```

Las barras de desplazamiento, los controles nativos y el fondo por defecto siguen
el tema sin necesidad de estilarlos — y con el contraste que el sistema
operativo garantiza.

## Lo que NO se verifica

| Comprobación | Estado |
|---|---|
| Medición automática de contrastes | **No existe** |
| Comprobación de que E1/E2 no se usan en datos clínicos | **No existe** |
| Prueba con la preferencia de contraste alto | No ejecutada |
| Prueba en modo de contraste forzado | No ejecutada |
| Simulación de daltonismo | No ejecutada |
| Regresión visual entre temas | **No existe** |

### La ausencia más costosa

**Un cambio de token puede romper el contraste del modo oscuro sin que nadie lo
vea.** Las pruebas comprueban que los tokens *existan*, no que sus valores
cumplan.

Un script que calcule los contrastes de las combinaciones declaradas y falle bajo
el umbral sería la mitigación —es aritmética sobre valores que ya están en
`styles.css`— y no requiere ninguna dependencia nueva.

Registrado como brecha `MEDIUM` con propuesta concreta en
[el informe de auditoría](audit-report.md).

## Cómo comprobarlo a mano

```text
DevTools › Elements › Accessibility › Contrast ratio
DevTools › Rendering › Emulate CSS media feature forced-colors
DevTools › Rendering › Emulate CSS media feature prefers-contrast
DevTools › Rendering › Emulate vision deficiencies
```

Y la comprobación que más rinde: **abrir `/design-system` en los dos temas y
compararlas**. La vitrina exhibe todos los tokens y todos los estados en una sola
pantalla, que es exactamente lo que hace falta para ver una regresión de
contraste.
