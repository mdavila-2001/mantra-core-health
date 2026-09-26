// @ts-check
/* ============================================================================
    Reglas de lint — Mantra Core Health.

    Además de las reglas habituales de TypeScript y Angular, este archivo es
    donde las **reglas de arquitectura** dejan de ser un acuerdo y pasan a estar
    verificadas: las fronteras entre capas se comprobaban a mano con `grep`, y
    lo que no falla en CI se erosiona.
    ========================================================================== */

const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

module.exports = tseslint.config(
  {
    /* Nada de esto es código fuente: `dist/` es salida del build y los `.pnp.*`
       los genera Yarn. Sin esta lista, el lint reporta el HTML compilado.

       `.claude/` guarda worktrees de Git creados por herramientas de asistencia.
       Son **copias completas del repositorio**, con su propio `tsconfig.json`, y
       lintearlas duplicaría cada hallazgo sobre un árbol que no se entrega. */
    ignores: [
      'dist/**',
      '.angular/**',
      'coverage/**',
      '.pnp.cjs',
      '.pnp.loader.mjs',
      '.yarn/**',
      '.claude/**',
      /* Evidencias de una corrida de Cypress: capturas de los fallos, videos y
         las del recorrido visual. Es salida de una ejecución, no código, y está
         en `.gitignore`. */
      'artifacts/**',
    ],
  },
  {
    /* La raíz, dicha en voz alta.

       typescript-eslint la deduce buscando `tsconfig.json` hacia arriba, y con
       un worktree dentro del repositorio encuentra **dos candidatas** y se
       niega a elegir: el lint entero se cae con «No tsconfigRootDir was set»,
       508 errores de parseo y ni una sola regla evaluada.

       Ignorar `.claude/**` no alcanza —la detección corre antes—, así que la
       raíz se fija acá y deja de depender de qué haya en el disco. */
    languageOptions: {
      parserOptions: { tsconfigRootDir: __dirname },
    },
  },
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...tseslint.configs.stylistic,
      ...angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      /* Prefijo `app` en selectores, como declara angular.json. */
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'app', style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        // `kebab-case` para elementos; el botón usa selector de atributo
        // (`button[app-button]`) para que el host sea el <button> nativo.
        { type: ['element', 'attribute'], prefix: 'app', style: 'kebab-case' },
      ],

      /* El repositorio no tiene un solo `any` hoy: que siga siendo un error y
         no una advertencia (regla 11 del encargo de refactorización). */
      '@typescript-eslint/no-explicit-any': 'error',

      /* OnPush en todo componente nuevo: el sistema entero es de signals. */
      '@angular-eslint/prefer-on-push-component-change-detection': 'error',

      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  /* OnPush es una decisión de rendimiento de producción: le importa a un
     componente que un usuario real va a montar, no a los dobles ad-hoc que
     una prueba declara para ejercer un `ControlValueAccessor` o un host
     mínimo. `fixture.detectChanges()` los dibuja explícito de todos modos,
     así que la estrategia no cambia nada de lo que la prueba observa —y
     forzarla ahí no es "todo componente nuevo", es ruido sobre un artefacto
     de prueba. Mismo criterio que ya usan los overrides de `atoms/` y
     `molecules/` de más abajo para otras reglas. */
  {
    files: ['**/*.spec.ts', 'playwright/**/*.ts'],
    rules: {
      '@angular-eslint/prefer-on-push-component-change-detection': 'off',
    },
  },

  /* ---- fronteras de la arquitectura ------------------------------------- */
  {
    files: ['src/app/shared/**/*.ts', 'src/app/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@features/*', '**/features/*'],
              message:
                'shared/ y core/ NUNCA importan de features/. Si algo acá necesita conocer un dominio, no pertenece a shared/core.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/app/shared/components/atoms/**/*.ts'],
    /* Una prueba sí puede montar la molecule que envuelve al atom: es la única
       forma de ejercer el contrato que pasa por DI, y no crea dependencia real
       del código de producción. */
    ignores: ['**/*.spec.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/molecules/*', '**/organisms/*'],
              message:
                'Un atom no compone otros componentes. Si necesita una molecule, no es un atom.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/app/shared/components/molecules/**/*.ts'],
    ignores: ['**/*.spec.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/organisms/*'],
              message: 'Una molecule no puede depender de un organism: la composición va al revés.',
            },
          ],
        },
      ],
    },
  },

  /* ---- plantillas -------------------------------------------------------- */
  {
    files: ['**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
    rules: {},
  },
);
