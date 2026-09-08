# Inventario del frontend

Este archivo **no duplica** nada. El inventario ya existe en el repositorio; acá
está el índice para que FABLE no reconstruya lo que ya está escrito.

| Qué | Dónde |
|---|---|
| Panorama y stack verificado | `docs/index.md` |
| Rutas (**232**, dato vigente) | `docs/reports/generated/rutas.json` |
| Rutas, lectura en prosa (**desactualizada: dice 11**) | `docs/routes/route-catalog.md` |
| Rutas, inventario generado | `docs/reports/generated/route-inventory.md` |
| Componentes (**458**: 23 atomos, 37 moleculas, 29 organismos, 134 maquetas) | salida de `component-index.generated.ts` |
| Componentes, lectura en prosa (**desactualizada: dice 49+11**) | `docs/components/catalog.md` |
| Componentes, inventario generado | `docs/reports/generated/component-inventory.md` |
| Reglas de composición | `docs/components/composition-rules.md` |
| Formularios, modales, tablas, notificaciones | `docs/components/` |
| 188 tokens | `docs/design-system/tokens.md` |
| Color, espaciado, tipografía, responsive, temas, motion, iconos | `docs/design-system/` |
| Estado y datos | `docs/data-and-state/` |
| Nueve estados M34 | `docs/adr/ADR-0005-view-state-m34.md` |
| Accesibilidad | `docs/accessibility/` |
| Pruebas | `docs/testing/` |
| Decisiones | `docs/adr/` |

Si algo de esta lista queda desactualizado, se corrige **ahí**, no acá.

## Deriva detectada (Wave 0, 2026-09-08)

Las páginas en prosa de `docs/` quedaron atrás respecto del código: declaran
11 rutas y 60 componentes, mientras el inventario generado en cada build
reporta **232 pantallas y 458 componentes**. Los archivos de
`docs/reports/generated/` sí están al día porque se regeneran solos.

**Consecuencia para FABLE:** ante una discrepancia, mandan los generados. La
prosa desactualizada es deuda documental anotada, no una fuente de verdad.

Lo que FABLE sí agrega: `REFACTOR_DAG.md`, `VISUAL_BASELINE.md`, `evidence/`.
