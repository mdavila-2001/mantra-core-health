import { defineConfig } from 'vitest/config';

/**
 * Configuración del corredor de pruebas.
 *
 * El builder `@angular/build:unit-test` inicializa los polyfills y el `TestBed`
 * por su cuenta; este archivo existe para lo que el builder no cubre: qué entra
 * en la medición de cobertura y qué umbral la bloquea.
 *
 * Se conecta desde `angular.json` (`runnerConfig`), no por descubrimiento
 * automático, para que quede explícito que se está usando.
 */
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'json-summary', 'lcov'],

      /**
       * No se declara `include`: el builder de Angular instrumenta con rutas
       * propias y acotarlas desde acá dejaba la medición en 0 %. No hace falta,
       * porque los umbrales de abajo son **por glob** y solo evalúan los
       * archivos que caen en cada uno — el total global queda como referencia
       * informativa, arrastrado por el arranque que ninguna prueba unitaria
       * ejercita.
       */
      exclude: [
        // Las pruebas no se miden a sí mismas.
        '**/*.spec.ts',
        // Solo declaraciones de tipos: no hay nada que ejecutar.
        '**/*.types.ts',
        /**
         * La vitrina del sistema de diseño. Es una superficie de exhibición:
         * 118 funciones que son manejadores de demostración, no lógica de
         * producto. Incluirla arrastraba la cobertura de funciones de
         * `features/` de 84,6 % a 26,1 % midiendo algo que nadie va a probar.
         */
        'src/app/features/design-system-sample/**',
        /**
         * Las pantallas portadas de la bóveda. Son **generadas** por
         * `scripts/port-vistas-redsat.mjs` a partir de las maquetas: 126 clases
         * vacías con su plantilla al lado, sin una línea de lógica propia. Lo
         * que hay que probar de ellas —que la ruta existe, que montan el marco
         * que su ficha declara y que el contenido llega— se prueba donde de
         * verdad se puede, contra un navegador: `cypress/e2e/redsat-port.cy.ts`.
         *
         * Mismo criterio que la vitrina de arriba: medir cascarón generado no
         * dice nada del producto, y taparlo con 126 pruebas «se crea» sería
         * inflar el número sin mirar nada.
         *
         * Se excluyen SOLO los generados. `redsat/shell/` está escrito a mano,
         * tiene lógica y se mide como cualquier otra cosa.
         */
        'src/app/features/redsat/*/*/*.ts',
        'src/app/features/redsat/redsat.routes.ts',
        'src/app/features/redsat/redsat-nav.data.ts',
      ],

      /**
       * Umbrales bloqueantes (decisión D2 del plan). **Suben, nunca bajan**: si
       * un cambio deja la cobertura por debajo, la orden falla en vez de avisar.
       *
       * `core/` y `shared/` al 80 % porque son el cimiento —los usan todas las
       * pantallas— y `features/` al 60 % porque una pantalla tiene mucho
       * cascarón que probar aporta poco.
       *
       * Valores medidos al fijarlos: core 83,5/84/90,8/85,4 ·
       * shared 93,9/90,3/90,6/94,3 · features 83,9/84,5/84,6/83,9.
       */
      thresholds: {
        'src/app/core/**': {
          statements: 80,
          branches: 80,
          functions: 80,
          lines: 80,
        },
        'src/app/shared/**': {
          statements: 80,
          branches: 80,
          functions: 80,
          lines: 80,
        },
        'src/app/features/**': {
          statements: 60,
          branches: 60,
          functions: 60,
          lines: 60,
        },
      },
    },
  },
});
