# Estándar y alcance

**WCAG 2.2 nivel AA**, con cuatro excepciones declaradas por el sistema de diseño
y registradas con su medición.

---

## El estándar

| Aspecto | Valor |
|---|---|
| Norma | WCAG 2.2, nivel **AA** |
| Alcance | Las 8 pantallas navegables + los 48 componentes de `shared/` |
| Idioma | `<html lang="es">` |
| Excepciones | E1–E4 de `identidad-visual.md` Parte 8.2 |

**Por qué AA y no AAA:** AA es el nivel que la normativa suele exigir y el que un
sistema de diseño puede sostener sin renunciar a su identidad. AAA exigiría 7:1
en todo el texto, lo que descartaría la mayor parte de la paleta.

## Las cuatro excepciones, declaradas

No están escondidas: viven anotadas en el CSS con el número que las mide.

| # | Qué | Medición | Regla de uso |
|---|---|---|---|
| **E1** | `--text-muted` en claro | 3,86–4,27:1 | Solo texto terciario. **Jamás información clínica** |
| **E2** | `--text-muted` en oscuro | 4,45:1 en la superficie más alta | Ídem |
| **E3** | `--border-strong` en oscuro | <3:1 | Sin foco. Con foco manda el anillo |
| **E4** | Ver `identidad-visual.md` Parte 8.2 | — | Fuera de este repositorio |

`design-tokens.types.ts` repite la regla junto al token, para que quien
autocomplete la lea:

```ts
/** Terciario: excepción WCAG E1 — jamás para información clínica. */
muted: '--text-muted',
```

**Declarar una excepción con su número y su regla de uso es lo contrario de
ignorarla.** Lo que falta es la comprobación automática de que la regla se
respeta: hoy nada impide poner `--text-muted` en un valor de laboratorio.

## Lo que este proyecto hace especialmente bien

No es habitual, y conviene decirlo antes que los huecos:

| Práctica | Dónde |
|---|---|
| Un token de inyección que garantiza el nombre accesible de **todo** control | `FORM_CONTROL_CONTEXT`, 19 importadores |
| Ids estables entre servidor y cliente, para que la hidratación no rompa | `nextControlId` |
| Enlace de salto, anuncio de ruta y foco al `<main>`, resueltos una vez | `app-shell` |
| Diálogo nativo con trampa de foco del navegador | `app-dialog` con `showModal()` |
| `Escape` cancela, nunca confirma | `app-dialog` |
| El foco inicial **no** cae sobre la acción destructiva | `app-dialog` |
| El deshabilitado es `aria-disabled`, no el atributo nativo | `AppButton` |
| Aviso en desarrollo si un botón de ícono no tiene nombre | `AppButton` |
| El botón de menú **se quita del árbol**, no se oculta con CSS | `Breakpoints` + `Shell` |
| `prefers-reduced-motion` global | `styles.css` |
| S4 mueve el foco al error; S2/S7 **no** lo roban | `ViewStateHost` |
| S6 no filtra la existencia de un recurso | `ViewStateHost` + `notFound()` |
| Cifras tabulares para datos clínicos | `.tabular-nums` |
| `autocomplete` correcto en los cuatro campos que lo necesitan | Las pantallas de `auth/` |

## Alcance de la auditoría

**Lo que se revisó:** el código de las 8 pantallas y los 48 componentes, sus
plantillas, sus estilos y sus pruebas.

**Lo que NO se pudo revisar**, y por qué:

| Método | Estado |
|---|---|
| Auditoría automática (axe, Lighthouse) | **No hay herramienta instalada** |
| Prueba manual con lector de pantalla | No ejecutada en esta auditoría |
| Prueba manual de teclado en un navegador | No ejecutada |
| Medición real de contrastes | Los números salen de `identidad-visual.md`, medidos a mano |
| Zoom al 200 % y reflow a 320 px | No ejecutado |
| Objetivos táctiles (24×24 px, WCAG 2.2 §2.5.8) | **No medidos** |

**Esta auditoría es de código, no de ejecución.** Es una limitación real y está
declarada como tal: encuentra lo que se puede ver leyendo, y no encuentra lo que
solo aparece al usar la aplicación.

Los hallazgos están en [el informe de auditoría](audit-report.md).

## Criterios de WCAG 2.2 que este proyecto toca de forma explícita

| Criterio | Dónde se resuelve |
|---|---|
| 1.3.1 Información y relaciones | `FORM_CONTROL_CONTEXT`, `<dl>` del panel, `<th scope>` de la tabla |
| 1.4.3 Contraste (mínimo) | Tokens semánticos, con E1–E3 declaradas |
| 1.4.11 Contraste de elementos no textuales | `--border-strong`, con E3 declarada |
| 1.4.12 Espaciado de texto | Interlineados de la escala ALOVIDA |
| 2.1.1 Teclado | Controles nativos (`<button>`, `<a>`, `<dialog>`) |
| 2.1.2 Sin trampa de teclado | `app-menu` no atrapa; `app-dialog` sí, y es correcto |
| 2.4.1 Evitar bloques | Enlace de salto de `app-shell` |
| 2.4.3 Orden del foco | Foco al `<main>` tras navegar |
| 2.4.7 Foco visible | `:focus-visible` con anillo de 4 px |
| 2.5.8 Tamaño del objetivo (2.2) | **No medido** |
| 3.2.6 Ayuda consistente (2.2) | No aplica: no hay mecanismo de ayuda |
| 3.3.1 Identificación de errores | `errorMessage` de `app-form-field` |
| 3.3.2 Etiquetas o instrucciones | `label`, `hint`, `required` |
| 3.3.7 Entrada redundante (2.2) | `autocomplete` correcto |
| 3.3.8 Autenticación accesible (2.2) | **No hay CAPTCHA ni prueba cognitiva** — se cumple por ausencia |
| 4.1.2 Nombre, rol, valor | Host nativo + `aria-*` en los componentes |
| 4.1.3 Mensajes de estado | `aria-live` en `ViewStateHost` y en `app-shell`. **Falta en 4 pantallas** |

## Dónde seguir

- [Informe de auditoría](audit-report.md) — los hallazgos, con severidad
- [Teclado](keyboard.md) · [Gestión del foco](focus-management.md)
- [Lectores de pantalla](screen-readers.md)
- [Formularios y errores](forms-and-errors.md)
- [Color y contraste](color-and-contrast.md)
