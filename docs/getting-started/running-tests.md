# Ejecutar las pruebas

## Lo básico

```bash
yarn test            # modo observador
yarn test:coverage   # una pasada, con cobertura y umbrales bloqueantes
```

Resultado de referencia (medido el 2026-08-01):

```text
Test Files  71 passed (71)
     Tests  804 passed (804)
  Duration  ~10–19 s
```

## Cómo está montado

No es Karma ni Jest. El builder `@angular/build:unit-test` compila las pruebas
con el mismo pipeline que la aplicación y se las entrega a **Vitest 4** sobre
jsdom.

```text
angular.json → architect.test
  builder:      @angular/build:unit-test
  runnerConfig: vitest.config.ts        ← cobertura y umbrales
  setupFiles:   src/test-setup.ts       ← preparación compartida
```

El builder inicializa los polyfills y el `TestBed` por su cuenta. `vitest.config.ts`
existe **solo** para lo que el builder no cubre: qué entra en la medición y qué
umbral la bloquea.

## Los umbrales son por área, no globales

```text
src/app/core/**       ≥ 80 %   (medido: 87,37 / 85,12 / 87,50 / 87,80)
src/app/shared/**     ≥ 80 %   (medido: 94,21 / 90,75 / 91,52 / 94,67)
src/app/features/**   ≥ 60 %   (medido: 74,74 / 80,34 / 77,59 / 77,90)
```

`core/` y `shared/` al 80 % porque son el cimiento y los usan todas las
pantallas; `features/` al 60 % porque una pantalla tiene mucho cascarón cuya
prueba aporta poco.

**El total global que imprime el resumen (≈56 %) no es una métrica del
proyecto.** Arrastra el arranque, los polyfills y todo lo que ninguna prueba
unitaria ejercita. Los umbrales que bloquean son los tres de arriba.

### Lo que se excluye de la medición, y por qué

| Excluido | Motivo |
|---|---|
| `**/*.spec.ts` | Las pruebas no se miden a sí mismas |
| `**/*.types.ts` | Solo declaraciones: no hay nada que ejecutar |
| `features/design-system-sample/**` | La vitrina son 118 funciones de demostración. Incluirla bajaba la cobertura de funciones de `features/` de 84,6 % a 26,1 % midiendo algo que nadie va a probar |

## Correr un subconjunto

```bash
yarn test --  --project=... # el builder no expone filtros de Vitest directamente
```

La vía práctica es el modo observador (`yarn test`), que reejecuta solo lo
afectado al guardar un archivo.

## Qué hay en `src/test-setup.ts`

Una sola comprobación, y es deliberado: falla ruidosamente si el entorno no
expone `atob` o `TextDecoder`.

La lectura del JWT (`decodeAccessToken`) usa ambos y devuelve `null` ante
cualquier anomalía, que es lo correcto en producción. Si jsdom dejara de
exponerlos, el síntoma sería un puñado de pruebas fallando por «token ilegible»
y nadie miraría el entorno. Fallar una vez, con el motivo escrito, ahorra esa
cacería.

## Las pruebas que leen archivos del disco

Doce archivos de prueba importan `node:fs`. No es un descuido: leen
`src/styles.css` para comprobar que los tokens declarados en TypeScript existen
de verdad en CSS.

Es la defensa contra las tres duplicaciones necesarias del proyecto (escala de
breakpoints, umbral del cajón de navegación, clave del tema). Ver
[tokens](../design-system/tokens.md#las-tres-duplicaciones-necesarias).

## Lo que `yarn test` **no** cubre

| Capa | Dónde está |
|---|---|
| Extremo a extremo (navegador real) | `yarn e2e` — ver [pruebas E2E](../testing/e2e-tests.md) |
| Accesibilidad automatizada | **Sí la cubre**: `src/app/shared/components/a11y.spec.ts` |
| Contraste de color | `node scripts/check-contrast.mjs` — jsdom no calcula estilos |
| Regresión visual | Configurada, **sin capturas**: hay que generarlas en el contenedor |
| Contrato contra el OpenAPI del backend | **No existe** — el OpenAPI no es alcanzable |
| Rendimiento / Lighthouse | **No existe** |

Las dos últimas están analizadas, con su riesgo y su propuesta, en
[la estrategia de pruebas](../testing/strategy.md) y en
[el análisis de brechas](../reports/documentation-gap-analysis.md).

## Avisos esperables

```text
Using Yarn PnP with Vite is discouraged and PnP-specific bugs will no longer be
actively worked on.
```

Conocido y sin efecto medido. Aparece dos veces por ejecución. Cambiar el
`nodeLinker` para silenciarlo sería tocar el modo de instalación del proyecto
entero, que es un cambio mayor y no está autorizado.
