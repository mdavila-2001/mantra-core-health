# Reporte — Cinco specs dejaban `animate` tapado y rompían `motion.spec.ts`

> **AVANCE: 1 / 1 — 100 %.**

- Fecha: 2026-10-30 · Rama: `claude/lucid-volta-46naf7` (desde `dev`)
- Peldaño de evidencia: `TESTED` (cambio sólo de pruebas; no hay superficie de UI).

## Qué pasaba

En `test`, las pruebas «escalona el retraso de cada hijo» y «tiene techo» de
`src/app/shared/motion/motion.spec.ts` fallaban según con qué otros archivos corrieran
(`expected [] to deeply equal [0, 45, 90]` y `expected -Infinity to be 360`). Solas pasaban.

Causa: cinco specs reemplazaban `HTMLElement.prototype.animate` y al terminar lo
«restauraban» reasignando el valor guardado. jsdom no trae `animate`, así que lo guardado
era `undefined` y la restauración dejaba en `HTMLElement.prototype` una propiedad propia
`undefined`. Esa propiedad tapa el doble que `motion.spec.ts` pone en `Element.prototype`:
la cascada ve que `animate` no es una función y no anima.

Sólo se nota cuando comparten hilo, porque el builder de Angular corre Vitest con
`isolate: false` (`@angular/build/.../vitest/plugins.js`) y el repo usa 4 hilos. Por eso
dependía de qué archivos entraran en la corrida, y `dev` pasaba con el mismo código.

Specs implicados (los cinco, comprobados uno por uno):

- `shared/components/atoms/select/select.spec.ts`
- `shared/components/molecules/dialog/dialog.spec.ts`
- `shared/components/organisms/content-dialog/content-dialog.spec.ts`
- `shared/components/organisms/date-picker/date-picker.spec.ts`
- `shared/components/organisms/tree-select/tree-select.spec.ts`

## Completado

| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.S1.M1 | `src/testing/animate.ts` (`reemplazarAnimate`) guarda el descriptor propio y al restaurar lo repone o borra la propiedad; los cinco specs lo usan | `ng test` con un solo hilo: cada spec + `motion.spec.ts`, y los seis juntos | antes: los cinco pares fallaban; ahora: 5/5 pares en verde y los seis juntos 6 archivos, 160 pruebas en verde |

## A medias

Ninguna.

## Pendiente

Ninguna.

## Evidencia

```text
# Antes del arreglo (test en 5daeb49c1, un solo hilo vía runnerConfig temporal maxWorkers: 1)
motion.spec.ts solo                          Test Files  1 passed (1)
select.spec.ts + motion.spec.ts              Test Files  1 failed | 1 passed (2)
dialog / content-dialog / date-picker /
tree-select (cada uno) + motion.spec.ts      Test Files  1 failed | 1 passed (2)

# Después del arreglo (dev, mismo método)
select / dialog / content-dialog /
date-picker / tree-select + motion.spec.ts   Test Files  2 passed (2)   (los cinco)
los seis juntos                              Test Files  6 passed (6) · Tests 160 passed (160)

eslint src/testing/animate.ts + los cinco specs   → exit 0
yarn typecheck                                     → exit 0
```

La configuración de un solo hilo fue un archivo temporal (`vitest.bisect.config.ts`) que no
se commiteó.

## No cubierto

- La suite completa no se corrió de una vez: en este contenedor `ng test` se queda sin memoria.

## Desvíos del plan

Ninguno.

## Riesgos residuales

- Cualquier spec nuevo que reasigne a mano un método del prototipo que jsdom no trae puede
  repetir el problema; el helper deja el patrón correcto a mano.

## Decisiones y ambigüedades

- Se arregla en los specs que contaminan y no en `motion.spec.ts`: son ellos los que dejan el
  entorno distinto de como lo encontraron.
