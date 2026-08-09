# Informe de línea base

> **Fase 0 del plan documental.** Estado reproducible del repositorio *antes* de
> escribir una sola línea de documentación, para que cualquier diferencia
> posterior sea atribuible y no discutible.

- **Fecha de la medición:** 2026-08-01
- **Commit:** `ba2efd9` (rama `dev`), 39 commits de historia
- **Ejecutado desde:** macOS (Darwin 25.5.0), arquitectura arm64

---

## 1. Estado del repositorio al empezar

```text
$ git status --porcelain
?? .env
```

Un solo cambio preexistente: un archivo `.env` **vacío**, sin seguimiento de Git
y ya ignorado por `.gitignore`. No se tocó.

### 1.1 · Trabajo concurrente durante la medición

**Este repositorio se estuvo modificando mientras corría la Fase 0.** Entre la
primera y la segunda pasada de la batería aparecieron cambios que no son de este
trabajo documental:

```text
 M .dockerignore          M docker-compose.yml
 M .env.example           M package.json
 M .gitignore             M src/environments/environment.ts
 M Dockerfile.dev         M src/environments/environment.development.ts
                          M src/environments/environment.types.ts
?? scripts/generate-env.mjs
?? src/environments/env.generated.ts
```

Es la incorporación de un **generador de entorno público**: `PUBLIC_API_BASE_URL`
entra por `.env`, `scripts/generate-env.mjs` la traduce a
`src/environments/env.generated.ts` antes de cada `start`/`build`/`watch`/`test`,
y los dos archivos de entorno pasaron de tener valores literales a leer de ahí.

Qué se hizo al respecto, en orden:

1. **Se preservó íntegro.** No se editó ninguno de esos archivos.
2. **Se repitió la batería completa** sobre el estado nuevo. Los números de este
   informe son los de la **segunda** pasada, ya con el generador en la cadena.
3. Las conclusiones que la primera pasada había sacado de los archivos viejos se
   corrigieron: ver [auditoría de estructura §5](graphify-audit.md#5-derivas-encontradas),
   donde dos derivas quedaron resueltas por este trabajo ajeno y así se anotan.

**Ninguna diferencia entre las dos pasadas es atribuible a la documentación.**
Lint, tipos, build y las 804 pruebas dan lo mismo antes y después.

## 2. Stack verificado

Nada de esta tabla es supuesto: sale de `package.json`, `angular.json` y la
ejecución real de las órdenes.

| Elemento | Valor | Evidencia |
|---|---|---|
| Framework | Angular 21.2 | `package.json` → `@angular/core@^21.2.0` |
| Renderizado | SSR con prerenderizado selectivo | `angular.json` → `outputMode: "server"`, `src/app/app.routes.server.ts` |
| Builder | `@angular/build:application` | `angular.json` |
| Gestor de paquetes | Yarn 4.18.0, modo **PnP** | `packageManager`, presencia de `.pnp.cjs`, ausencia de `nodeLinker` |
| Node | v24.18.0 (host) · `node:24-bookworm-slim` (contenedor) | `node -v`, `Dockerfile.dev` |
| TypeScript | 5.9.2 en modo `strict` | `package.json`, `tsconfig.json` |
| Plantillas | `strictTemplates: true` | `tsconfig.json` → `angularCompilerOptions` |
| Estilos | CSS plano con custom properties | `src/styles.css`, `angular.json` → `styles` |
| Estado | Signals de Angular; **sin** store externo | `session.store.ts`, ausencia de NgRx/Akita en dependencias |
| Estado de servidor | RxJS + `HttpClient` directo; **sin** capa de caché | `core/data-access/*.client.ts` |
| Formularios | Reactive Forms | `@angular/forms`, `login.ts` y hermanos |
| Internacionalización | **No existe** | sin `@angular/localize` ni archivos de traducción |
| Analítica / telemetría | **No existe** | sin dependencias ni llamadas de instrumentación |
| Pruebas | Vitest 4 vía `@angular/build:unit-test` | `angular.json` → `test`, `vitest.config.ts` |
| Lint | ESLint 10 + `angular-eslint` 22 | `eslint.config.js` |
| Formato | Prettier 3.8 | `.prettierrc` |

## 3. Órdenes ejecutadas y resultado

Todas se ejecutaron desde la raíz del repositorio, en este orden.

| # | Orden | Resultado | Duración | Observaciones |
|---|---|---|---|---|
| 1 | `yarn install --immutable` | **OK** | 0,46 s | Lockfile intacto. Avisos preexistentes: ver §4.1 |
| 2 | `yarn lint` | **OK** | 4,82 s | Sin hallazgos |
| 3 | `yarn tsc -p tsconfig.app.json --noEmit` | **OK** | 1,22 s | Sin errores de tipos |
| 4 | `yarn build` | **OK** | 9,75 s | Un aviso de presupuesto: ver §4.2 |
| 5 | `yarn test:coverage` | **OK** | 18,47 s | 71 archivos, 804 pruebas, 0 fallos |
| 6 | `yarn npm audit --recursive` | **1 moderada** | — | Transitiva de desarrollo: ver §4.3 |

### Cobertura medida

Los umbrales de `vitest.config.ts` son **por glob**, no globales. Estos son los
valores reales por área, calculados desde
`coverage/mantra-core-health/coverage-summary.json`:

| Área | Umbral | Sentencias | Ramas | Funciones | Líneas |
|---|---:|---:|---:|---:|---:|
| `src/app/core/**` | 80 % | 87,37 % | 85,12 % | 87,50 % | 87,80 % |
| `src/app/shared/**` | 80 % | 94,21 % | 90,75 % | 91,52 % | 94,67 % |
| `src/app/features/**` | 60 % | 74,74 % | 80,34 % | 77,59 % | 77,90 % |

El total global que imprime el resumen (55,95 % de sentencias) **no es una
métrica de calidad de este proyecto**: incluye el arranque, los polyfills y la
vitrina del sistema de diseño, que `vitest.config.ts` excluye a propósito de los
umbrales. Comparar contra él induciría a error.

### Tamaño del artefacto de producción

```text
Initial total        | 516,67 kB crudo | 132,30 kB estimado en tránsito
  chunk-CBKPS7XQ.js  | 241,89 kB
  chunk-4ULMTLHM.js  | 204,00 kB
  main-CJEZRIXM.js   |  55,15 kB
  styles-KXYBD5G3.css|  14,37 kB
  chunk-3MG7ORXE.js  |   1,28 kB

Lazy
  design-system-sample | 181,73 kB
  toast-dev-panel      |   2,98 kB

Prerenderizadas: 4 rutas estáticas
```

## 4. Fallos y avisos preexistentes

Ninguno fue introducido por este trabajo. Ninguno se corrigió: corregirlos es un
cambio de producto y necesita autorización aparte.

### 4.1 · Par de dependencias no satisfecho (aviso de instalación)

```text
YN0060: @angular/cli está listado con la versión 21.2.19, que no satisface
        lo que angular-eslint y otras dependencias piden (>=22.0.0 <23.0.0).
```

**Impacto medido: ninguno.** El lint corre limpio y el build también. Es una
declaración de par optimista de `angular-eslint`, no una incompatibilidad
observable. Subir `@angular/cli` a 22 sería tocar el lockfile y el toolchain, lo
que este trabajo tiene prohibido sin autorización.

### 4.2 · Presupuesto inicial excedido (aviso de build)

```text
▲ bundle initial exceeded maximum budget.
  Budget 500,00 kB was not met by 16,67 kB with a total of 516,67 kB.
```

`angular.json` declara `maximumWarning: 500kB` y `maximumError: 1MB`. El build
**no falla**; avisa. Está 16,67 kB por encima del umbral de aviso y 483 kB por
debajo del de error. Ver [presupuestos de rendimiento](../performance/budgets.md)
para el análisis y la propuesta, que no se ejecuta acá.

### 4.3 · Vulnerabilidad moderada en una transitiva de desarrollo

```text
moderate · @hono/node-server@1.19.15
  GHSA-frvp-7c67-39w9 — path traversal en serve-static sobre Windows (%5C)
  Cadena: @angular/cli@21.2.19 → @modelcontextprotocol/sdk@1.26.0 → @hono/node-server
```

**No llega al navegador.** `@angular/cli` es `devDependency` y su servidor MCP no
forma parte de ningún artefacto servido. El vector es un servidor estático
corriendo en Windows, que no es ni el entorno de desarrollo del proyecto ni el de
despliegue. Registrada en
[seguridad de dependencias](../security/dependencies.md) con su seguimiento.

## 5. Lo que no se pudo medir, y por qué

El plan pide una batería más amplia que la que este repositorio admite hoy. Cada
ausencia es un hecho comprobable, no una omisión:

| Medición | Estado | Evidencia de la ausencia |
|---|---|---|
| Pruebas E2E | **No existen** | Sin Playwright/Cypress en `package.json`; `README.md` §«Running end-to-end tests» dice que Angular no trae uno por defecto |
| Regresión visual | **No existe** | Sin herramienta de captura; `.gitignore` reserva `__screenshots__/` pero la carpeta no existe |
| Auditoría automática de accesibilidad | **No existe** | Sin `axe-core`, `jest-axe` ni equivalente |
| Lighthouse / Core Web Vitals | **No se ejecuta** | Sin configuración ni script |
| Análisis de bundle | **Parcial** | El build imprime tamaños; no hay visualizador de composición |
| Cobertura E2E de journeys | **No aplica** | Consecuencia de la primera fila |

Estas seis ausencias son el material de
[el análisis de brechas](documentation-gap-analysis.md), no de este informe.

## 6. Flujos que se sabe que funcionan

Verificado por las 804 pruebas unitarias y de componente, y por el registro
previo del equipo en `ESTADO-FRONTEND.md` §«El recorrido que se verificó en un
navegador real»:

- Alta de paciente por documento y de profesional por correo.
- Inicio de sesión con correo o documento, con y sin varias organizaciones.
- Recuperación de contraseña de punta a punta (pedido → correo → nueva clave).
- Verificación de correo desde el enlace.
- Persistencia de la sesión entre recargas mediante el refresh token.
- Cierre de sesión, incluida la limpieza local cuando el servidor no responde.

## 7. Cómo revertir exclusivamente el trabajo documental

Todo lo que este trabajo añade vive en tres lugares y **ninguno entra al bundle**:

```text
docs/          documentación (excepto docs/auditoria/, que es preexistente)
scripts/       generadores y verificadores documentales
structurizr/   modelo C4 como texto
mkdocs.yml     configuración del portal
.env.example   plantilla de entorno (ver nota abajo)
```

Revertir es borrarlos:

```bash
git status --porcelain            # confirmar que no hay nada más
rm -rf scripts structurizr mkdocs.yml .env.example
git clean -nd docs                # revisar antes de borrar
```

`docs/auditoria/` es trabajo previo del equipo y **no se toca**.

`package.json`, `angular.json`, `tsconfig*.json`, `eslint.config.js`,
`vitest.config.ts`, `yarn.lock`, `src/` y `public/` quedan **sin modificar**.
La comprobación está en [validación de regresiones](regression-validation.md).

## 8. Criterio de salida de la Fase 0

| Requisito | Estado |
|---|---|
| Repositorio instalable de forma reproducible | ✅ `--immutable` sin tocar el lockfile |
| Línea base ejecutada y registrada | ✅ §3 |
| Cero archivos funcionales modificados durante el diagnóstico | ✅ §7 |
| Fallos preexistentes diferenciados de regresiones | ✅ §4 |
| Riesgos y cambios ajenos identificados | ✅ §1 |
| Limitaciones de medición documentadas | ✅ §5 |
