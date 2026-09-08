---
name: project-design-system
description: Sistema de diseño obligatorio de Mantra Core Health. Usar SIEMPRE al crear, modificar o revisar UI en este repositorio.
allowed-tools: Read, Grep, Glob
---

# Sistema de diseño del proyecto

Este repositorio **ya tiene** un sistema de diseño maduro y documentado. No lo
reinventes: consúltalo.

| Qué | Dónde |
|---|---|
| 188 tokens CSS | `docs/design-system/tokens.md` · `src/styles/alovida.css` |
| Color, espaciado, tipografía | `docs/design-system/{colors,spacing,typography}.md` |
| Responsive, temas, motion, iconos | `docs/design-system/{responsive-design,themes,motion,icons}.md` |
| Principios | `docs/design-system/principles.md` |
| 60 componentes clasificados | `docs/components/catalog.md` |
| Inventario generado desde el código | `docs/reports/generated/component-inventory.md` |
| Reglas de composición | `docs/components/composition-rules.md` |

## Regla 1 — Reutilizar antes de crear

Hay 49 componentes en `shared/` organizados en átomos (16), moléculas (20) y
organismos (16). Antes de crear cualquier primitiva visual:

1. buscar en `docs/components/catalog.md`;
2. buscar en `src/app/shared/`;
3. buscar variantes del componente existente;
4. sólo crear si no existe equivalente semántico.

Crear `ButtonV2` junto a `app-button` es `ARCH-DUPLICATE`. Es un defecto, no una
solución.

## Regla 2 — Sin valores visuales arbitrarios

**Este proyecto NO usa Tailwind.** Es CSS plano con 188 custom properties.

Prohibido introducir colores, espaciados, radios, sombras, tipografías o puntos
de quiebre literales cuando existe token:

```css
/* MAL */   padding: 17px;  color: #2F6F62;  border-radius: 13px;
/* BIEN */  padding: var(--sp-4);  color: var(--brand-primary);  border-radius: var(--r-md);
```

Prefijos: `--c-*` (rampas) · `--bg-*` · `--text-*` · `--brand-*` · `--border-*` ·
`--st-*` (estados) · `--sp-*` · `--r-*` · `--fs-*` · `--lh-*` · `--bp-*` ·
`--shadow-*` · `--focus-ring`.

Los que cambian con el tema están marcados en `docs/design-system/tokens.md`. Un
valor fijo donde debía ir un token rompe el tema oscuro sin avisar.

## Regla 3 — Los nueve estados son contrato, no sugerencia

El modelo M34 declara nueve estados obligatorios, codificados en `ViewState<T>`
(ver `docs/adr/ADR-0005-view-state-m34.md`):

```text
S1  Autorización de ruta pendiente    S6  No encontrado sin filtrar existencia
S2  Cargando / esqueleto              S7  Datos atrasados / refrescar
S3  Vacío con próxima acción          S8  Sin conexión / reintentar
S4  Validación o conflicto            S9  Error inesperado + ID de petición
S5  Prohibido / propósito denegado
```

Distinciones que **no** son cosméticas:

- **S1 ≠ S2** — autorizar ocurre antes de pedir datos sensibles.
- **S5 ≠ S6** — un «no tenés permiso» sobre un recurso existente filtra su
  existencia. S6 no transporta ningún dato del recurso.
- **S3 exige una próxima acción.** Un vacío sin salida es un defecto.
- **S7 exige exponer la antigüedad del dato.**
- **S9 exige el identificador de la petición.**

Usar `app-view-state-host` en vez de reimplementar los estados a mano.

## Regla 4 — Responsive por contrato

Ninguna UI se da por terminada desde un solo viewport. Línea base obligatoria:

```text
390x844  ·  768x1024  ·  1024x768  ·  1440x900  ·  1920x1080
```

Los puntos de quiebre canónicos son `--bp-*`. No inventar breakpoints nuevos sin
actualizar `docs/design-system/responsive-design.md`.

## Regla 5 — Preservar semántica

Un refactor visual no puede alterar en silencio: autorización, navegación,
contratos de API, persistencia, validación ni reglas de negocio.

**La autoridad es la API.** El frontend no autoriza. Esconder un ítem no protege
nada; es no ofrecer una puerta que va a estar cerrada. No conviertas un control
oculto en una afirmación de seguridad.

## Regla 6 — Accesibilidad

Ver `docs/accessibility/` (estándar, foco, teclado, contraste, formularios,
lectores de pantalla) y `docs/accessibility/audit-report.md`.

Primero HTML semántico. `aria-label` indiscriminado no es una corrección: suele
ser la señal de que el elemento correcto no se usó.

Exigir: HTML semántico · acceso por teclado · foco visible (`--focus-ring`) ·
etiquetas correctas · objetivos táctiles razonables · contraste · comportamiento
de foco en diálogos · jerarquía de encabezados · `prefers-reduced-motion` donde
aplique.

## Regla 7 — Angular 21, standalone y señales

- Todo standalone; sin NgModules nuevos.
- Estado en señales dentro de servicios `providedIn: 'root'`. **Sin store externo.**
- Reactive Forms.
- TypeScript `strict` + `strictTemplates`.
- `tsc` **no** revisa las plantillas: un `@if`/binding roto compila y aparece en
  ejecución como un 404 de ruta. Verificar plantillas en el navegador.
