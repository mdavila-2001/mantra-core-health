# Análisis del paquete

Lo que el build informa, lo que se puede deducir y lo que no se puede saber sin
una herramienta que no está instalada.

---

## Lo que informa el build

```text
Browser bundles
Initial chunk files  | Names                |  Raw size | Estimated transfer size
chunk-CBKPS7XQ.js    | -                    | 241,89 kB |                56,37 kB
chunk-4ULMTLHM.js    | -                    | 204,00 kB |                60,05 kB
main-CJEZRIXM.js     | main                 |  55,15 kB |                12,82 kB
styles-KXYBD5G3.css  | styles               |  14,37 kB |                 2,54 kB
chunk-3MG7ORXE.js    | -                    |   1,28 kB |               531 bytes
                     | Initial total        | 516,70 kB |               132,27 kB

Lazy chunk files
chunk-6P42WO2Z.js    | design-system-sample | 181,73 kB |                40,29 kB
chunk-ON3XGH5T.js    | toast-dev-panel      |   2,98 kB |                 1,18 kB

Server bundles
server.mjs           | server               | 815,85 kB
main.server.mjs      | main.server          | 496,14 kB
polyfills.server.mjs | polyfills.server     | 233,65 kB
…
```

**El servidor no importa para el usuario**: `server.mjs` y sus hermanos corren en
Node, no se descargan.

## Qué hay dentro

Deducible sin herramienta, porque el proyecto tiene **diez dependencias externas
y todas son de Angular**:

| Fragmento | Qué es |
|---|---|
| 241,89 kB y 204,00 kB (sin nombre) | El runtime de Angular: core, common, router, forms, platform-browser |
| `main` 55,15 kB | **El código de la aplicación**: 61 componentes, 15 servicios, 6 clientes |
| `styles` 14,37 kB | `src/styles.css` con los 188 tokens + las tipografías importadas |
| `design-system-sample` 181,73 kB | La vitrina |

**55,15 kB de código propio para 61 componentes es poco.** Casi todo el peso
inicial es el framework, y eso acota mucho lo que se puede optimizar sin cambiar
de framework.

## Los dos fragmentos diferidos

| Fragmento | Crudo | En tránsito | Cuándo se baja |
|---|---:|---:|---|
| `design-system-sample` | 181,73 kB | 40,29 kB | Al entrar a `/design-system` |
| `toast-dev-panel` | 2,98 kB | 1,18 kB | **Nunca**: no está montado en ninguna plantilla |

La vitrina se difirió por una razón medida:

> *«Con import directo se llevaba el presupuesto inicial por delante.»*

181,73 kB son el 35 % de lo que pesa el paquete inicial completo. La decisión
está tomada y es correcta.

## Lo que NO se puede saber

**No hay analizador de bundle instalado**: ni `source-map-explorer`, ni
`webpack-bundle-analyzer`, ni `rollup-plugin-visualizer`.

Sin él no se puede responder:

| Pregunta | |
|---|---|
| ¿Qué parte de esos 241,89 kB es el router y qué parte forms? | Sin dato |
| ¿Cuánto pesa cada uno de los 48 componentes de `shared/`? | Sin dato |
| ¿Hay código duplicado entre fragmentos? | Sin dato |
| ¿Queda algo que el *tree shaking* no eliminó? | Sin dato |
| ¿Cuánto de `main` es plantilla compilada y cuánto lógica? | Sin dato |

### Cómo obtenerlo sin instalar nada permanente

```bash
yarn build --configuration production
npx source-map-explorer 'dist/mantra-core-health/browser/*.js'
```

Requiere `sourceMap: true`, que hoy **solo está en la configuración de
desarrollo**. Habría que generarlo con `--source-map` para el análisis, y
**nunca desplegar ese artefacto**: publicar mapas de fuente expone el código
original. Ver [seguridad](../security/frontend-security.md#mapas-de-fuente).

## Las tres tipografías instaladas y sin usar

`package.json` trae `@fontsource/lato`, `@fontsource-variable/open-sans` y
`@fontsource-variable/roboto`. **Ninguna se importa** desde `styles.css`.

**No pesan en el paquete** —lo que no se importa no se empaqueta— pero sí ocupan
lugar en el lockfile y en la instalación. `styles.css` las llama «reserva».

O se usan, o se quitan. Brecha `LOW`.

## Optimizaciones activas

```json
"optimization": {
  "scripts": true,
  "fonts": true,
  "styles": { "minify": true, "inlineCritical": false }
},
"outputHashing": "all"
```

| Opción | Estado |
|---|---|
| Minificación de scripts | ✅ |
| Optimización de tipografías | ✅ |
| Minificación de estilos | ✅ |
| **CSS crítico en línea** | ❌ **Desactivado, sin motivo registrado** |
| Hash en los nombres de salida | ✅ — es lo que permite el `maxAge: '1y'` |

Sobre `inlineCritical`, ver
[Core Web Vitals](core-web-vitals.md#inlinecritical-false-merece-una-mirada).

## Verificación

```bash
node scripts/check-bundle-budget.mjs
```

Mide `dist/mantra-core-health/browser` y compara con los presupuestos de
`angular.json`. Corre después de `yarn build`.

## Recomendaciones, en orden

1. **Correr `source-map-explorer` una vez.** Sin compromiso: `npx`, y a partir de
   ahí las preguntas de arriba tienen respuesta.
2. **Diferir las pantallas de `auth/`.** La oportunidad más clara; ver
   [presupuestos](budgets.md#la-oportunidad-más-clara).
3. **Quitar o usar las tres tipografías de reserva.**
4. **Añadir un presupuesto por fragmento** para que la vitrina no crezca sin
   aviso.
5. **Recuperar o volver a decidir `inlineCritical`.**

Ninguna se ejecuta en este trabajo documental.
