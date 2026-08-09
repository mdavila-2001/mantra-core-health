# Build

```bash
yarn build   # ~5–10 s
```

Que es, según `package.json`:

```text
yarn env:generate  →  src/environments/env.generated.ts
ng build           →  configuración de producción (la de por defecto)
```

---

## Qué produce

```text
dist/mantra-core-health/
├── browser/     lo que descarga el navegador + las 4 rutas prerenderizadas
└── server/      server.mjs, main.server.mjs, polyfills.server.mjs
```

| Artefacto | Tamaño |
|---|---:|
| Paquete inicial del navegador | 516,70 kB crudo · **132,27 kB en tránsito** |
| Fragmento `design-system-sample` | 181,73 kB · 40,29 kB |
| Fragmento `toast-dev-panel` | 2,98 kB · 1,18 kB |
| `server.mjs` | 815,85 kB (no se descarga) |

```text
Prerendered 4 static routes.
```

## Configuración de producción

```json
{
  "optimization": {
    "scripts": true,
    "fonts": true,
    "styles": { "minify": true, "inlineCritical": false }
  },
  "budgets": [
    { "type": "initial",           "maximumWarning": "500kB", "maximumError": "1MB" },
    { "type": "anyComponentStyle", "maximumWarning": "4kB",   "maximumError": "8kB" }
  ],
  "outputHashing": "all"
}
```

| Opción | Efecto operativo |
|---|---|
| `outputHashing: "all"` | Cada archivo lleva su hash. **Es lo que permite el `maxAge: '1y'`** y lo que hace que un chunk viejo dé 404 tras un despliegue |
| `inlineCritical: false` | Hay una petición de CSS bloqueante. **Sin motivo registrado** |
| Sin `sourceMap` | No se generan en producción, que es lo correcto |
| `budgets` | Se evalúan y **avisan**; no fallan salvo el umbral de error |

## El aviso que sale siempre

```text
▲ [WARNING] bundle initial exceeded maximum budget.
  Budget 500.00 kB was not met by 16.70 kB with a total of 516.70 kB.
```

Preexistente. **No rompe el build.** Ver
[presupuestos](../performance/budgets.md#decisión-pendiente).

## El generador de entorno es obligatorio

`src/environments/env.generated.ts` **no se versiona**, así que sin él la
compilación falla al resolver el import.

Lo encadenan `start`, `build`, `watch` y `test`. El contenedor lo llama en su
`CMD`. **Invocar `ng build` directamente no lo genera** y por eso falla — es la
causa más probable de un `Cannot find module './env.generated'`.

## Prerenderizado

Cuatro rutas salen del build ya pintadas:

```text
/auth  /auth/registro  /auth/recuperar  /design-system
```

**Consecuencia operativa: un cambio en cualquiera de esas cuatro pantallas exige
un build nuevo** para que el HTML estático se regenere. No basta con desplegar el
JavaScript.

Ver [estrategia de renderizado](../architecture/rendering-strategy.md).

## Instalación reproducible

```bash
yarn install --immutable
```

**Falla si el lockfile no cuadra.** Es la orden que debe correr un pipeline: sin
`--immutable`, Yarn podría resolver versiones distintas de las declaradas.

Avisos preexistentes al instalar: ver
[la línea base §4.1](../reports/baseline.md#41--par-de-dependencias-no-satisfecho-aviso-de-instalación).

## La batería completa

```bash
yarn install --immutable
yarn lint                                # ~3–5 s
yarn tsc -p tsconfig.app.json --noEmit    # ~1 s
yarn build                                # ~5–10 s
yarn test:coverage                        # ~10–19 s
node scripts/generate-doc-report.mjs      # verificaciones documentales
```

Los cinco primeros deben pasar. Referencias en
[la línea base](../reports/baseline.md).

## Modo PnP

El repositorio no fija `nodeLinker`, así que Yarn 4 instala en Plug'n'Play.
Consecuencias operativas:

| Consecuencia | Detalle |
|---|---|
| `.pnp.cjs` y `.yarn/unplugged/` son **de la plataforma** | Los de macOS no sirven en Linux |
| `.dockerignore` los excluye | Es lo que evita *«Could not find the builder's node package»* |
| Vite avisa que PnP está desaconsejado | Sin efecto medido: 804 pruebas pasan |
| El editor necesita el SDK | `yarn dlx @yarnpkg/sdks vscode` |

## Lo que falta

| Elemento | Estado |
|---|---|
| Imagen de producción | **No existe** |
| Build en CI | **No existe** |
| Versionado del artefacto | **No existe.** `package.json` dice `0.0.0` |
| Firma / SBOM | No existe |
| Caché de build en CI | No aplica |

### El versionado importa más de lo que parece

`"version": "0.0.0"` y ningún identificador de build en el artefacto. **Nada en
la aplicación dice qué versión está corriendo.**

Consecuencia: ante un incidente, no se puede saber qué código está desplegado ni
correlacionar un reporte con un commit.

Es de las cosas más baratas de arreglar y de las que más rinden en operación.
Registrado como brecha `HIGH` en
[el análisis de brechas](../reports/documentation-gap-analysis.md).
