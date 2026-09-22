# DAG de refactor

Orden de dependencias. Una tarea **no empieza** hasta que su dependencia esté
`REGRESSION_VERIFIED`.

```text
TOKENS -> PRIMITIVAS -> COMPARTIDOS -> LAYOUTS -> FEATURE -> PAGINAS
```

Nunca al revés, y nunca todo a la vez.

## Escala real (medida el 2026-09-08, rama `mockup`)

| | |
|---|---:|
| Pantallas | **232** (28 secciones, 78 hijas, 126 portadas) |
| Componentes | **458** (23 átomos, 37 moléculas, 29 organismos, 134 maquetas) |
| Rutas en `app.routes.ts` | 73 paths, 39 estáticas |
| Pruebas | **4985 en 428 archivos** (Vitest), todas en verde |

Esto es lo que hace que el refactor completo **no sea una tarea**, sino un
programa: a una microtarea por pantalla, con los gates del playbook (cinco
viewports, evidencia, revisión independiente, regresión), son 232 ciclos.

## Waves

| Wave | Alcance | Estado |
|---|---|---|
| 0 | Infraestructura, baseline, inventario | **hecha** — `VISUAL_BASELINE.md` |
| 1 | Fundación de diseño: literales a tokens | **hecha** — `DECISION-DISENO-001.md` |
| 2 | Primitivas (89) | **auditada** — `OLA-2-PRIMITIVAS.md`. Sin deuda de foco ni motion (son centrales). Falta matriz visual, estados M34 y teclado por primitiva. |
| 3 | Layouts y shells | **estructura verificada** — los shells se ejercitan en las 222 rutas de la matriz sin un desborde. |
| 4-6 | Flujos y cola larga | **medidos con los 5 roles** — `MATRIZ-ROLES.md`, 2220 mediciones. Falta interacción, los nueve estados y mutaciones. |
| 7 | Regresión global | **hecha** — `MATRIZ-REGRESION.md`, 1110 mediciones |

## Lo que queda, dicho con números

La matriz dice que **la estructura está sana**: 222 pantallas, cinco anchos,
cero desbordes, cero errores de consola. Eso cierra la pregunta «¿está roto?».

No cierra «¿está terminado?». Lo que falta no es tiempo de máquina, es trabajo
por pantalla que necesita criterio:

| Dimensión | Tamaño |
|---|---:|
| Roles sin medir | **0** — los 5 medidos |
| Pruebas unitarias | **4985 en verde** |
| Estados M34 por pantalla | 9 |
| Primitivas sin matriz visual | 89 |
| Rutas parametrizadas sin cubrir | 10 |
| Mutaciones sin probar `UI -> … -> UI` | todas |

A una microtarea por pantalla con los gates del playbook, es un programa de
equipo. Automatizar la **medición** fue posible y está hecho; automatizar el
**criterio** no.

## Wave 1 — DS-001 hecha

De los 7 literales que el escaneo marca en `atoms/button/button.css`, sólo
**uno** era deuda real: `font-size: 13px`, que coincide exacto con
`--fs-caption`. Se reemplazó y se demostró que no mueve un píxel.

Los otros seis no se tocaron, y esa es la parte importante:

- `#fff` está justificado por el comentario de arriba.
- `14px`, `11px` y `28px` están fuera de escala: cambiarlos altera el diseño.

**Cómo se verificó.** La primera comparación de capturas dio «difieren» y esa
lectura era falsa: la captura del estado previo se tomó mientras HMR
reconstruía. El control lo destapó — dos capturas del mismo código dan el mismo
hash, así que la herramienta es determinista y la diferencia tenía que venir de
otro lado. Repetida con el rebuild ya terminado: `antes == después`, byte a
byte, y el estilo computado (`13px / 8px 14px / 32px`) idéntico en ambos.

## Wave 0 — hecha

- Arnés de baseline: `playwright/fable-baseline.spec.ts`.
- 140 mediciones: 0 fallos de render, 0 desborde, 0 consola, 0 red.
- 1 observación: `/directory` redirige a `/dashboard` con `superadmin@`.
- Deriva documental detectada: la prosa de `docs/` declara 11 rutas y 60
  componentes; el generado dice 232 y 458. Mandan los generados.

## Wave 1 — backlog medido

**76 colores y 82 medidas literales = 158 valores en 56 archivos**, donde el
sistema ya tiene token. Medido con `tools/fable-literales.py`.

### El desglose que decide cómo se ataca

No son 158 reemplazos mecánicos. Comparando cada literal contra el valor de los
34 tokens de medida y los 130 de color:

| | Cantidad | Qué significa |
|---|---:|---|
| **Coinciden exacto con un token** | **102** (34 colores, 68 medidas) | Swap mecánico. El píxel no se mueve, y se puede demostrar. |
| **Fuera de escala** | **56** (42 colores, 14 medidas) | Reemplazarlos **mueve el píxel**: es una decisión de diseño, no un refactor. Necesitan a quien defina el diseño, no a un agente. |

El caso más repetido fuera de escala es `14px` (11 veces): la escala de
espaciado va 4/8/12/16/20/24/32/40/48/64/80 y la tipográfica
11/13/15/17/21/26/32/44. No hay token de 14.

Parte de los 42 colores «fuera de escala» son además **legítimos y ya
justificados en el código**. Ejemplo real, en `atoms/button/button.css`:

```css
/* blanco literal del spec (btn-danger): en oscuro --text-inverse es
   petrol-900 y el diseñador fija #fff en ambos temas */
--_btn-fg: #fff;
```

Ese `#fff` no es deuda: es una decisión documentada. **Antes de tocar un literal
hay que leer el comentario de al lado.**

Excluidos por legítimos, tras revisarlos uno por uno: `src/styles.css` (es el
archivo que **define** los 172 tokens), `src/styles/alovida.css`,
`pais-bandera.ts` (banderas SVG, el color es el dato), `core/mock/` (datos
simulados, no interfaz) y `features/component-stock/` (la vitrina del sistema
de diseño, que muestra valores crudos a propósito).

Un primer escaneo sin estas exclusiones daba 521 y era una cifra inflada.

### Los 14 archivos con más deuda

| Archivo | Colores | Medidas | Total |
|---|---:|---:|---:|
| `src/app/features/public-profile/public-post-card/public-post-card.css` | 2 | 11 | 13 |
| `src/app/features/public-profile/public-post-comments/public-post-comments.css` | 0 | 9 | 9 |
| `src/app/features/public-profile/public-profile-card/public-profile-card.css` | 0 | 9 | 9 |
| `src/app/features/alovida/shell/alovida-shell.html` | 7 | 0 | 7 |
| `src/app/features/shell-layout/shell-layout.html` | 7 | 0 | 7 |
| `src/app/shared/components/atoms/button/button.css` | 2 | 5 | 7 |
| `src/app/shared/components/organisms/auth-split/auth-split.css` | 7 | 0 | 7 |
| `src/app/features/messaging/thread/thread.css` | 0 | 6 | 6 |
| `src/app/features/agenda/my-agenda/day-view/day-view.css` | 5 | 0 | 5 |
| `src/app/features/alovida/buscar/cercania-detalle/cercania-detalle.html` | 5 | 0 | 5 |
| `src/app/shared/components/molecules/segmented-control/segmented-control.css` | 0 | 5 | 5 |
| `src/app/features/accounting/accounting.css` | 0 | 4 | 4 |
| `src/app/features/assets-liabilities/assets-liabilities.css` | 0 | 4 | 4 |
| `src/app/features/public-profile/public-post-reactions/public-post-reactions.css` | 0 | 4 | 4 |

### Orden de ataque

Por dependencia, no por tamaño: primero los átomos, porque cada literal que se
corrige ahí desaparece de todas las pantallas que los usan.

1. `DS-001` — `atoms/button/button.css` (7). Es el componente más consumido. **HECHA.**
2. `DS-002` — `molecules/segmented-control` (5), `organisms/tree-select` (8),
   `atoms/checkbox` y `atoms/switch`.
3. `LAY-001` — `shell-layout.html` (7) y `alovida-shell.html` (7).
4. `UI-001` — el grupo `public-profile/` (31 entre tres archivos), el más
   concentrado fuera de las primitivas.

Cada uno es una microtarea con el contrato de abajo. Ninguna empieza sin
reproducir en navegador que el valor literal produce una diferencia visible
respecto del token: **un reemplazo que cambia el píxel no es un refactor
visual, es un cambio de diseño** y necesita decisión, no sólo evidencia.

## Plantilla de microtarea

Cada microtarea declara, antes de tocar código:

- **Outcome** — resultado observable, no archivo tocado.
- **IN** — archivos permitidos, rutas, componente, dependencias.
- **OUT** — fuera de alcance: auth, backend no relacionado, rutas ajenas.
- **Preserve** — contrato de API, navegación, permisos, persistencia, validación.
- **Acceptance criteria** — lista numerada, verificable.
- **Browser scenarios** — ruta, rol, viewport, interacción, assertion.
- **Required evidence** — capturas, assertions, consola, red, persistencia si
  hay mutación.

## Registro

| ID | Superficie | Depende de | Estado | Evidencia |
|---|---|---|---|---|
| W0 | Baseline de las 28 secciones | - | `VERIFIED` | `evidence/baseline/mediciones.json` |
| W0.1 | `/directory` redirige | W0 | `DISCOVERED` | `evidence/baseline/directory/` |
| DS-001 | `atoms/button`: `font-size: 13px` -> `var(--fs-caption)` | W0 | `VERIFIED` | `evidence/DS-001/` |
| DS-001.b | `atoms/button`: `font-size: 14px` -> `--fs-body` | DD-001 | `VERIFIED` | decisión de diseño tomada |
| DS-002 | 47 literales con token exacto -> `var()` | W0 | `VERIFIED` | 140 mediciones, 0 desborde |
| DD-001 | Paleta y escala: 27 intrusiones a los tokens ALOVIDA | DS-002 | `VERIFIED` | `DECISION-DISENO-001.md` |
| W0.2 | El baseline es intermitente bajo carga | W0 | `FIXED` | reintento en el arnés |
| DS-003 | `atoms/avatar`: último literal a `--c-neutral-200` | DD-001 | `VERIFIED` | deuda de tokens cerrada |
| O2 | Auditoría de primitivas | DS-002 | `VERIFIED` | `OLA-2-PRIMITIVAS.md` — 38 falsos positivos descartados |
| O7 | Matriz de regresión global | todo | `VERIFIED` | `MATRIZ-REGRESION.md` — 1110 mediciones |
| O7.b | Matriz por rol, 5 cuentas | O7 | `VERIFIED` | `MATRIZ-ROLES.md` — 2220 mediciones |
| W0.1 | `/directory` redirige | O7.b | `CERRADO` | era el guardia: ruta exclusiva de PATIENT |
| G-001 | Desborde 51px en `/administration/medical-laboratory` con `admin@` a 390px | O7.b | `REPRODUCED` | 5/5; culpable sin aislar |
| G-002 | 12 pares rol-ruta redirigen estando habilitados | O7.b | `DISCOVERED` | puede ser guardia legítimo no declarado |
| G-003 | 3 roles entran a `/administration/patients/assisted-registration` | O7.b | `DISCOVERED` | la autoridad es la API; revisar discoverability |
| T-001 | Gate de pruebas, antes bloqueado | - | `VERIFIED` | 4985 pruebas, 428 archivos, 140 s |
| DS-002 | Moléculas y organismos con literales | DS-001 | `DISCOVERED` | - |
| LAY-001 | Shells sin literales | DS-002 | `DISCOVERED` | - |
| UI-001 | `public-profile/` sin literales | DS-002 | `DISCOVERED` | - |

## FILE-UPLOAD — registro y adjuntos compartidos

| ID | Superficie | Depende de | Estado | Evidencia |
|---|---|---|---|---|
| UPLOAD-0 | Baseline laboratorio, cinco tamaños | - | `VERIFIED` | `evidence/file-upload/baseline/` |
| UPLOAD-1 | FileInput, FilePreview y arrastre compacto | UPLOAD-0 | `VERIFIED` | `FILE_UPLOAD_IMPROVEMENT.md` |
| UPLOAD-2 | Registros y consumidores existentes | UPLOAD-1 | `VERIFIED` | `evidence/file-upload/` |
