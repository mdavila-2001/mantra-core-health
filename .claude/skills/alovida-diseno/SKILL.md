---
name: alovida-diseno
description: El sistema visual de ALOVIDA y sus tres subsistemas reales (front Angular con 188 tokens CSS en dos hojas; app Flutter con MantraTokens; documentación del sistema). Punto de entrada de cualquier trabajo visual en Alovida — dice dónde vive cada cosa, qué gate la mide y qué NO hay que reinventar. Usar antes de tocar un color, un espaciado, un componente o una pantalla en el front o en la app móvil.
---

# El sistema visual de ALOVIDA

Antes de nada: **Alovida ya tiene sistema de diseño, documentado y con gates.** El error caro no es
elegir mal un gris, es inventar un token que ya existe, pintar con un literal, o hacer un barrido
masivo de UI (prohibido: ver `alovida-ui`). Esta skill dice dónde está cada pieza. Portada de
`atlas-diseno`; los fundamentos genéricos están en `frontend-ui-design`, `color-systems`,
`visual-hierarchy-composition` y el gate de calidad visual en `ui-quality-review`.

## 1. El stack real (no hay Next, Tailwind ni Expo)

| Pieza | Repo (bajo `~/Documents/GitHub/alovida/`) | Estilo |
|---|---|---|
| Front | `mantra-core-health` (worktrees `wt-*`) — Angular 21.2, standalone + señales, SSR, Yarn 4 PnP | CSS plano, **sin Tailwind**, 188 custom properties |
| App móvil | `mantra_core_health_mobile` — Flutter (`alovida_mobile`) | `lib/theme/` (`MantraTokens`, `MantraPadding`, `MantraRadius`, `MantraMotion`) |
| API | `mantra-core-health-redesa-api` — NestJS + MikroORM | no pinta; sus catálogos alimentan los `select` |

La marca es **ALOVIDA**. Nunca REDESA, REDSAT ni Vitara (nombres heredados a migrar).

## 2. Dos hojas de tokens que conviven (y por qué)

- `src/styles.css` (444 líneas) — ALOVIDA v1.0, nombres en INGLÉS: `--bg-*`, `--text-*`, `--brand-*`,
  `--border-*`, `--st-<estado>-<bg|fg|bd>`, `--sp-*`, `--r-*`, `--fs-*`, `--lh-*`, `--dur-*`, `--ease-*`,
  rampas `--c-<familia>-<50…900>`. Catálogo tipado: `src/app/core/tokens/design-tokens.types.ts`.
- `src/styles/alovida.css` (4 118 líneas) — ALOVIDA v1.1 de la bóveda, nombres en CASTELLANO:
  `--tinta`, `--tinta-2/3`, `--petroleo`, `--sup-pagina/tarjeta/inset`, `--borde-ctrl`, `--mov-*`…
  **Es GENERADO** (`node scripts/sync-alovida.mjs`): nunca se edita a mano, el próximo sync lo pisa.
  Se carga después de `styles.css`; sus tokens son disjuntos de los de v1.0.
- Documentación: `docs/design-system/` (`tokens.md`, `colors.md`, `themes.md`, `motion.md`,
  `responsive-design.md`, `port-alovida.md`, `paper.md` para PDFs) y `docs/components/` (`catalog.md`,
  `composition-rules.md`, `forms.md`).

## 3. Tema claro/oscuro

Tres modos: `system` (SIN atributo en `<html>`, lo resuelve `@media (prefers-color-scheme: dark)` en
CSS), `light` (`data-theme="light"`) y `dark` (`data-theme="dark"`). La hoja v1.1 además lee
`data-tema="oscuro"`, que estampa `core/tokens/theme.service.ts` junto con el script anti-parpadeo de
`index.html`. Cuidado con los bloques de oscuro **duplicados** (`:root:not([data-theme='light'])` y
`:root[data-theme='dark']`): tocar uno solo rompe el otro.

El oscuro no es el claro invertido: se mide aparte. Una sombra negra sobre fondo oscuro no se ve; la
profundidad va con borde o superficie un tono arriba.

## 4. Los gates que miden esto (ejecutables, en `scripts/` del front)

| Gate | Qué falla | Estado hoy |
|---|---|---|
| `node scripts/check-contrast.mjs` (`yarn check:contrast`) | Texto < 4,5:1, controles/foco < 3:1, en AMBAS hojas, claro y oscuro. Las excepciones E3/R2/R3 están enumeradas: se *esperan* | verde |
| `node scripts/check-css-tokens.mjs` | `var(--x)` que apunta a un token inexistente (la declaración se descarta en silencio) | rojo: `--fs-body-sm` |
| `node scripts/check-tokens.mjs` | Token en CSS ausente del catálogo tipado (y a la inversa) | rojo: 8 `--heat-*` |
| `node scripts/check-colores-sueltos.mjs` (`yarn check:colores-sueltos`) | `#hex`/`rgb()`/`hsl()` literal fuera de las hojas de tokens. Ratchet sobre `scripts/baselines/colores-sueltos.json` | verde (141 heredados) |
| `node scripts/check-max-lines.mjs` (`yarn check:max-lines`) | Archivo nuevo > 600 líneas o uno heredado que crece | verde (135 heredados) |
| `yarn gates:diseno` | Los cinco de arriba seguidos | |

Reglas del contraste, heredadas de Atlas: **nunca aclares un gris "porque queda mejor"** ni toques
los umbrales para que algo pase; se mide contra la PEOR superficie del sistema. Si falta un color, falta
un token semántico: se añade en `styles.css`, con su par en `check-contrast.mjs`.

## 5. Reglas de casa (no salen de teoría de diseño)

- Reglas de `alovida-ui`: formularios ≥ 2 columnas con icono a la izquierda (salvo `/auth`), pestañas
  centradas a ancho completo, cero cards laterales, todo catalogable en `select` desde su catálogo.
- Fichas y formularios: centrados, a lo ancho y en UNA tarjeta con pestañas
  (`docs/components/composition-rules.md` §5).
- Listados: buscador y filtros en una línea con `app-filter-bar`, estado en la URL.
- Formularios de registro: de a una página, tope de 4 campos (`app-paginated-form`, gate
  `check-form-pages.mjs`).
- Español de usted (`check-usted.mjs`); identificadores nuevos en inglés (`check-english-identifiers.mjs`).
- La autoridad es la API: ocultar un control no es seguridad.

## 6. Antes de dar una pantalla por terminada

1. Capturas reales (Playwright desde Node, NUNCA esperar `networkidle` con HMR) a 390, 768 y 1440, claro y oscuro.
2. Rúbrica `ui-quality-review`; para mutaciones: UI → request → response → persistencia (SQL) → recarga.
3. `yarn gates:diseno` y `yarn lint`/`yarn typecheck` — `tsc` NO revisa las plantillas.
4. Selectivo: solo lo que tocaste. Un barrido de 406 campos ya rompió los formularios una vez.

## Checklist
- [ ] Usé tokens existentes; ningún literal de color/tiempo/espaciado.
- [ ] Si toqué color, sé contra qué superficie se mide y `check-contrast` sigue verde.
- [ ] No edité `src/styles/alovida.css` a mano.
- [ ] Lo miré en claro y en oscuro, a 390 y a 1440.
