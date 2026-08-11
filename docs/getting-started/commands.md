# Órdenes

Las que existen en `package.json`, más las que el proyecto usa sin tener alias.
Nada de esta página es aspiracional: si una orden está acá, corre.

## Del proyecto

| Orden | Qué hace | Duración medida |
|---|---|---|
| `yarn start` | Genera el entorno y levanta el servidor de desarrollo en el 4200 | — |
| `yarn build` | Genera el entorno y compila para producción, con SSR y prerenderizado | ~5–10 s |
| `yarn watch` | Compila en modo desarrollo y se queda observando | — |
| `yarn test` | Corre las pruebas en modo observador | — |
| `yarn test:coverage` | Corre las pruebas una vez, con cobertura y umbrales | ~10–19 s |
| `yarn lint` | ESLint sobre todo el repositorio | ~3–5 s |
| `yarn env:generate` | Solo el generador de entorno, para inspeccionar su salida | <1 s |
| `yarn serve:ssr:mantra-core-health` | Sirve el artefacto ya construido con Express | — |
| `yarn ng …` | La CLI de Angular | — |

Las cinco primeras encadenan `yarn env:generate` antes de nada: sin
`src/environments/env.generated.ts` la compilación no resuelve el import.

## Sin alias, pero necesarias

| Orden | Para qué |
|---|---|
| `yarn install --immutable` | Instalación reproducible. Falla si el lockfile no cuadra — es la que va en CI |
| `yarn tsc -p tsconfig.app.json --noEmit` | Comprobación de tipos aislada, sin compilar |
| `yarn npm audit --recursive` | Auditoría de vulnerabilidades del árbol completo |
| `yarn dlx @yarnpkg/sdks vscode` | SDK de Yarn para que el editor resuelva tipos en modo PnP |

## Documentales

Añadidas por el trabajo de documentación. **Ninguna toca código de producto.**

| Orden | Qué hace |
|---|---|
| `node scripts/generate-inventory.mjs` | Regenera `docs/reports/generated/` desde el código |
| `node scripts/generate-inventory.mjs --check` | Falla si el código cambió y el inventario no |
| `node scripts/check-architecture.mjs` | Verifica las fronteras `core`/`shared`/`features` y la ausencia de ciclos |
| `node scripts/check-doc-links.mjs` | Verifica que ningún enlace interno de `docs/` esté roto |
| `node scripts/check-doc-coverage.mjs` | Verifica que toda ruta y todo componente compartido estén documentados |
| `node scripts/check-api-contract-drift.mjs` | Compara los endpoints del código con los documentados |
| `node scripts/check-bundle-budget.mjs` | Compara el artefacto construido con los presupuestos |
| `node scripts/generate-doc-report.mjs` | Corre todas las verificaciones y resume |

## La orden completa antes de un pull request

```bash
yarn install --immutable
yarn lint
yarn tsc -p tsconfig.app.json --noEmit
yarn build
yarn test:coverage
node scripts/generate-doc-report.mjs
```

Es la misma secuencia del [pipeline documental](../governance/change-management.md#pipeline).

## Extremo a extremo

| Orden | Qué hace |
|---|---|
| `yarn test:e2e` | Construye el artefacto, lo sirve en el puerto 4175 y corre la suite funcional |
| `yarn test:e2e:smoke` | Solo humo: si esto falla, el resto de los fallos no significan nada |
| `yarn test:e2e:critical` | Humo + autenticación + navegación + formularios |
| `yarn e2e:open` | El modo interactivo de Cypress, para escribir pruebas |
| `yarn recorrido` | El recorrido visual: cientos de capturas y un reporte HTML |
| `yarn recorrido:real` | El recorrido contra la API viva (requiere el backend levantado) |

Se prueba **contra el artefacto de producción**, no contra `ng serve`: el
prerenderizado y las cabeceras de seguridad solo existen ahí. Lo construye y lo
sirve el propio arnés (`cypress/harness/`), con la API simulada delante, así que
no hace falta una API levantada. Ver [pruebas E2E](../testing/e2e-tests.md).

La primera corrida descarga el binario de Cypress (~200 MB):

```bash
yarn cypress install
```

## Órdenes que **no** existen en este proyecto

Registradas para que nadie las busque:

| Lo que se suele esperar | Estado |
|---|---|
| `yarn format` | No existe. Prettier está configurado pero sin alias: `yarn prettier --write .` |
| `yarn analyze` | No existe. El build imprime tamaños, pero no hay visualizador de bundle |
| `yarn storybook` | No existe. La vitrina es una ruta de la propia aplicación: `/design-system` |
| `yarn docs:serve` | No existe. El portal necesita MkDocs, que no está instalado — ver [el portal](../index.md#cómo-se-lee-esta-documentación) |

## Notas sobre la salida

**`yarn build` ya no avisa del presupuesto.** El umbral se decidió en 560 kB
—ver [presupuestos](../performance/budgets.md)— y `scripts/check-bundle-budget.mjs`
lo verifica en CI contra el umbral de error.

**`yarn test` avisa que PnP con Vite está desaconsejado.** Aviso conocido, sin
efecto medido: las 903 pruebas pasan.

**`yarn test:coverage` imprime un total global bajo (≈56 %).** No es la métrica
del proyecto: los umbrales de `vitest.config.ts` son por glob
(`core` 80 %, `shared` 80 %, `features` 60 %) y los tres se cumplen con holgura.
Ver [la línea base](../reports/baseline.md#cobertura-medida).
