# Gestión del cambio

**No hay CI.** Esta página describe el pipeline que hace falta y las
verificaciones que ya existen para alimentarlo.

---

## Estado

```bash
ls .github/workflows .gitlab-ci.yml .circleci 2>/dev/null
```

No existe ninguno. Toda la batería depende de que alguien la ejecute a mano.

## Pipeline

Las nueve etapas, en orden de coste creciente para que falle pronto lo barato:

```text
1 · Instalación reproducible      yarn install --immutable
2 · Lint                          yarn lint
3 · Tipos                         yarn tsc -p tsconfig.app.json --noEmit
4 · Pruebas + cobertura           yarn test:coverage
5 · Build de producción           yarn build
6 · Presupuestos                  node scripts/check-bundle-budget.mjs
7 · Arquitectura                  node scripts/check-architecture.mjs
8 · Documentación                 node scripts/generate-doc-report.mjs
9 · Auditoría de dependencias     yarn npm audit --recursive --severity high
```

### Propuesta, con lo que existe hoy

```yaml
# PROPUESTA — .github/workflows/ci.yml
name: CI
on: [push, pull_request]

jobs:
  verificar:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
      - run: corepack enable
      - run: yarn install --immutable
      - run: yarn lint
      - run: yarn tsc -p tsconfig.app.json --noEmit
      - run: yarn test:coverage
      - run: yarn build
      - run: node scripts/check-bundle-budget.mjs
      - run: node scripts/check-architecture.mjs
      - run: node scripts/generate-doc-report.mjs
      # No bloqueante: la única vulnerabilidad conocida es moderada,
      # de desarrollo, y no llega al navegador.
      - run: yarn npm audit --recursive --severity high
        continue-on-error: true
```

**No se crea el archivo**: añadir un workflow es un cambio de producto —cambia lo
que pasa en cada `push`— y necesita autorización.

### Lo que hay que tener en cuenta al montarlo

| Detalle | Por qué |
|---|---|
| **Node 24 y Corepack** | El proyecto fija Yarn 4.18.0 en `packageManager` |
| **`--immutable`** | Sin él, Yarn podría resolver versiones distintas |
| **PnP, no `node_modules`** | Cachear `.yarn/cache`, no `node_modules` |
| **Vite avisa de PnP** | Aviso conocido, sin efecto: 807 pruebas pasan |
| El build **avisa** del presupuesto | No falla. `check-bundle-budget.mjs` tampoco, salvo el umbral de error |

## Lo que el pipeline **debe** detectar

| Regresión | Etapa |
|---|---|
| Código que no compila | 3, 5 |
| Prueba rota | 4 |
| **Cobertura que baja** | 4 — los umbrales bloquean |
| Ciclo de importación nuevo | 7 |
| Import contra la dirección de las capas | 7 |
| `this.http` fuera de `core/data-access/` | 7 |
| Endpoint sin documentar | 8 |
| Enlace documental roto | 8 |
| Ruta u organismo sin documentar | 8 |
| Marcador `TODO` en la documentación | 8 |
| Inventario desactualizado | 8 |
| Paquete por encima del umbral de error | 6 |
| Vulnerabilidad alta o crítica | 9 |

## Lo que **no** puede detectar

Declarado, para que nadie confíe de más:

| Regresión | Falta |
|---|---|
| Visual | Regresión visual — [propuesta](../testing/visual-regression.md) |
| De accesibilidad | Auditoría automatizada |
| De contraste | Verificación de contrastes |
| **Cambio de contrato del backend** | Su OpenAPI no es alcanzable |
| De rendimiento en el navegador | Lighthouse |
| Un flujo roto de punta a punta | E2E |
| Un valor por defecto que cambia el aspecto de todo | **Solo la revisión humana** |

**La última es la más peligrosa**, y por eso
[la revisión](review-process.md#lo-que-exige-revisión-explícita) exige
declararla en el pull request.

## La regla de la deuda preexistente

> *«No hacer que CI falle por deuda preexistente sin una estrategia de adopción
> acordada; sí impedir nuevas regresiones.»*

Aplicada a lo que hay:

| Deuda | Trato |
|---|---|
| Aviso de presupuesto (18,95 kB) | **No bloquea.** El umbral de error está en 1 MB |
| Par de dependencias no satisfecho | **No bloquea.** Es un aviso de instalación |
| Vulnerabilidad moderada de desarrollo | **No bloquea.** `--severity high` |
| Aviso de PnP con Vite | **No bloquea** |
| 10 componentes sin prueba propia | **No bloquea.** Los umbrales por área ya se cumplen |

**Ninguna de las cinco impide detectar una regresión nueva.**

## Control de cambios documentales

Lo que obliga a actualizar documentación:

| Cambio | Actualizar |
|---|---|
| Ruta nueva o modificada | Ficha + inventario |
| Componente compartido | Inventario; si es organismo, mencionarlo |
| **Operación de API** | `backend-api.md` — **lo verifica el pipeline** |
| Store, contexto o servicio | Su página |
| Token del sistema de diseño | `design-system/` |
| Decisión de arquitectura | **ADR** |
| Variable de entorno | `environment-variables.md` y `configuration.md` |
| Cierre de una brecha | `documentation-gap-analysis.md` |

Las que dicen «lo verifica el pipeline» **fallan automáticamente**; el resto
depende de la revisión.

## Breaking changes

| Cambio | Rompe la compilación | Procedimiento |
|---|---|---|
| Quitar una entrada o una salida | **Sí** | [Deprecación](../components/deprecation.md) |
| Quitar un valor de una unión | **Sí** | Ídem |
| Renombrar un selector | **Sí** | Ídem |
| **Cambiar un valor por defecto** | **No** | **Declararlo en el PR** |
| Cambiar comportamiento de teclado | **No** | Prueba de accesibilidad |
| Cambiar estilos | **No** | Revisión visual |

## Estado

**`HIGH`.** Sin CI, las nueve etapas dependen de la disciplina, y la disciplina
no escala.

Es de las brechas más baratas de cerrar: **las seis verificaciones documentales
ya existen y no añaden dependencias**. Registrada en
[el análisis de brechas](../reports/documentation-gap-analysis.md).
