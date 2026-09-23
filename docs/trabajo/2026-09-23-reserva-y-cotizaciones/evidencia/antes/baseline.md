# Baseline

`corepack yarn test --watch=false` antes de los cambios: fallo de compilación por la ausencia de `src/app/features/component-stock/component-index.generated.ts`, seguido por seis TS7006 en `component-stock.ts`. El error era previo y ajeno a este carril.

Se ejecutó `node scripts/generate-component-index.mjs`, que produjo el artefacto local ignorado: 545 componentes, 3 otros, 303 pantallas, 138 maquetas, 23 átomos, 45 moléculas y 33 organismos.
