# Validación de regresiones

**Fase 19 del plan documental.** Evidencia comparable antes/después de todo el
trabajo documental.

> *«Queda prohibido declarar "sin impacto" sin evidencia comparable
> antes/después.»*

- **Fecha:** 2026-08-01
- **Veredicto:** **cero regresiones atribuibles a este trabajo.**

---

## 1 · Qué archivos tocó este trabajo

```text
docs/**            documentación (excepto docs/auditoria/, preexistente)
scripts/lib/scan.mjs
scripts/generate-inventory.mjs
scripts/check-architecture.mjs
scripts/check-doc-links.mjs
scripts/check-doc-coverage.mjs
scripts/check-api-contract-drift.mjs
scripts/check-bundle-budget.mjs
scripts/generate-doc-report.mjs
structurizr/workspace.dsl
mkdocs.yml
```

**Ninguno entra al bundle.** Ninguno lo lee Angular. Ninguno participa del build.

### Lo que NO se tocó

| Archivo o carpeta | Estado |
|---|---|
| `src/**` | **Sin modificar** |
| `public/**` | **Sin modificar** |
| `package.json` | Sin modificar **por este trabajo** — ver §2 |
| `angular.json` | **Sin modificar** |
| `tsconfig.json`, `tsconfig.app.json`, `tsconfig.spec.json` | **Sin modificar** |
| `eslint.config.js`, `.prettierrc` | **Sin modificar** |
| `vitest.config.ts` | **Sin modificar** |
| `yarn.lock` | Sin modificar **por este trabajo** — ver §2 |
| `Dockerfile.dev`, `docker-compose.yml`, `.dockerignore` | Sin modificar **por este trabajo** — ver §2 |
| `docs/auditoria/**` | **Preservado íntegro** |
| `README.md`, `ESTADO-FRONTEND.md`, `AVANCE-*`, `COORDINACION-AGENTES.md`, `PENDIENTES-BACKEND.md` | **Preservados íntegros** |
| `scripts/generate-env.mjs` | De otro trabajo. **Preservado** |

## 2 · Trabajo concurrente, y por qué no lo confunde

Durante esta sesión, **otro trabajo modificó el repositorio**. `git status` al
cerrar muestra:

```text
M  .dockerignore          M  package.json
M  .env.example           D  scripts/set-env.js
M  .gitignore             M  src/environments/environment.development.ts
M  Dockerfile.dev         M  src/environments/environment.ts
M  docker-compose.yml     M  src/environments/environment.types.ts
 M yarn.lock
```

Es la incorporación de un **generador de entorno público**
(`scripts/generate-env.mjs` + `PUBLIC_API_BASE_URL`).

**No es de este trabajo, y se puede demostrar:**

1. Ninguno de esos archivos aparece en la lista de §1.
2. Los únicos añadidos por este trabajo son `docs/`, los siete scripts de
   verificación, `structurizr/` y `mkdocs.yml` — todos sin seguimiento previo.
3. La documentación **describe** ese trabajo (en
   [variables de entorno](../getting-started/environment-variables.md) y en
   [configuración](../operations/configuration.md)) pero no lo introdujo.

**Se preservó íntegro y se repitió la medición completa sobre el estado nuevo.**

## 3 · Comparación antes/después

Dos pasadas completas de la batería: la primera al empezar, la segunda al
cerrar, con el trabajo concurrente ya incorporado.

| Medición | Antes | Después | Δ | Atribuible a la documentación |
|---|---|---|---|---|
| `yarn install --immutable` | OK | OK | — | — |
| `yarn lint` | **Limpio** | **Limpio** | — | — |
| `yarn tsc --noEmit` | **Limpio** | **Limpio** | — | — |
| `yarn build` | OK | OK | — | — |
| Rutas prerenderizadas | 4 | 4 | — | — |
| Paquete inicial | 516,67 kB | **518,95 kB** | **+2,28 kB** | **No** — ver §3.1 |
| Aviso de presupuesto | +16,67 kB | +18,95 kB | +2,28 kB | **No** |
| Archivos de prueba | 71 | 71 | — | — |
| Pruebas | 804 | **807** | **+3** | **No** — ver §3.2 |
| Fallos | **0** | **0** | — | — |
| Cobertura `core/` (sent.) | 87,37 % | 87,37 % | — | — |
| Cobertura `shared/` (sent.) | 94,21 % | **94,22 %** | +0,01 | No |
| Cobertura `features/` (sent.) | 74,74 % | 74,74 % | — | — |
| Umbrales de cobertura | **Cumplidos** | **Cumplidos** | — | — |
| Vulnerabilidades altas o críticas | **0** | **0** | — | — |

### 3.1 · Los 2,28 kB

Provienen del **trabajo concurrente**: `environment.ts` y
`environment.development.ts` pasaron de un literal a importar
`env.generated.ts`, y `alovida_logo.svg` sustituyó al favicon en `index.html`.

**Ningún archivo de `docs/`, `scripts/`, `structurizr/` ni `mkdocs.yml` entra al
paquete.** Es verificable: el build no los referencia.

### 3.2 · Las 3 pruebas nuevas

Del mismo trabajo concurrente, sobre el generador de entorno. **Este trabajo
documental no escribió ni modificó ninguna prueba.**

### 3.3 · Dependencias circulares y capas

| Medición | Antes | Después |
|---|---|---|
| Archivos TypeScript | 211 | **212** |
| Importaciones internas | 587 | **590** |
| **Dependencias circulares** | **0** | **0** |
| Violaciones de capa fuera de `core/dev/` | **0** | **0** |
| `this.http` fuera de `core/data-access/` | **0** | **0** |

El archivo y las tres aristas de más son de `env.generated.ts` y sus dos
importadores — del trabajo concurrente.

## 4 · Lo que este trabajo no pudo verificar

Honestidad sobre el alcance, porque un informe de regresiones que promete lo que
no puede medir es peor que ninguno:

| Regresión | Verificada | Por qué |
|---|---|---|
| Compilación, tipos, lint | ✅ | |
| Pruebas y cobertura | ✅ | |
| Tamaño del paquete | ✅ | |
| Ciclos, capas, superficie de red | ✅ | `check-architecture.mjs` |
| Enlaces y cobertura documental | ✅ | Cuatro verificadores |
| Deriva de contrato con la documentación | ✅ | |
| **Visual** | ❌ | **No hay instrumento** |
| **Accesibilidad** | ❌ | **No hay instrumento** |
| **Contraste** | ❌ | **No hay instrumento** |
| **De punta a punta** | ❌ | **No hay instrumento** |
| **Rendimiento en el navegador** | ❌ | **No hay instrumento** |

**Las cinco últimas se declaran no verificables, no cumplidas.**

**Atenuante que las hace irrelevantes para este informe concreto:** este trabajo
**no modificó ni un archivo de `src/` ni de `public/`**. Una regresión visual o
de accesibilidad exige un cambio en el código que las produce, y no lo hubo.

## 5 · Cómo revertir exclusivamente este trabajo

```bash
git status --porcelain              # confirmar el estado
rm -rf structurizr mkdocs.yml
git clean -nd docs scripts          # REVISAR antes de borrar
```

`docs/auditoria/` y `scripts/generate-env.mjs` son de otros trabajos y **no se
tocan**.

Tras revertir, la batería debe dar exactamente lo mismo: **la documentación no
participa del build.**

## 6 · Órdenes ejecutadas

```bash
# Antes
yarn install --immutable && yarn lint && yarn tsc -p tsconfig.app.json --noEmit \
  && yarn build && yarn test:coverage && yarn npm audit --recursive

# Después (idénticas)
yarn install --immutable && yarn lint && yarn tsc -p tsconfig.app.json --noEmit \
  && yarn build && yarn test:coverage

# Y las verificaciones documentales
node scripts/generate-doc-report.mjs
```

## 7 · Veredicto

| Criterio | Resultado |
|---|---|
| Se registró el estado inicial | ✅ [línea base](baseline.md) |
| Se preservaron los cambios preexistentes | ✅ Y también el trabajo concurrente |
| No se modificó comportamiento sin autorización | ✅ **Cero archivos de `src/`** |
| Build, lint, tipos y pruebas iguales o mejores | ✅ 807 pruebas pasan, cobertura igual o superior |
| Toda diferencia fue revisada y explicada | ✅ §3.1 y §3.2 |
| No se actualizaron dependencias ni lockfiles por este trabajo | ✅ |
| Existe evidencia de reversión | ✅ §5 |

**Cero regresiones atribuibles al trabajo documental.**
