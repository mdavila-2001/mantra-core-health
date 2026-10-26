/* ============================================================================
    Pruebas del gate de cierre de las correcciones 31–40.

    Un gate que nunca se vio fallar no demuestra nada. Acá se arma un
    repositorio git descartable, se escribe evidencia IDÉNTICA en formato a la
    que deja `playwright/corr-evidencia.spec.ts` y se comprueba las dos mitades:

      - el escenario completo y fresco PASA;
      - cada mutación (evidencia vieja, celda faltante, tema oscuro ausente,
        error de consola, foto alterada, matriz retocada, build viejo, carril
        sin captura, regresión roja, autoaprobación…) lo hace FALLAR o lo deja
        NO EVALUABLE, nunca PASA.

    Uso:  node --test scripts/lib/correcciones-gate.test.mjs
    ========================================================================== */

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { main } from './correcciones-cli.mjs';
import {
  CRITERIA,
  STATE,
  VERDICT,
  backgroundRuleOf,
  createGit,
  evaluateAll,
  exitCodeOf,
  expectedCells,
  harnessGaps,
  parseMatrix,
  parseRunSummary,
  whiteInDarkLanes,
} from './correcciones-gate.mjs';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const tmpRoots = [];

after(() => {
  for (const dir of tmpRoots) rmSync(dir, { recursive: true, force: true });
});

/* ----------------------------------------------------------------------------
 * Fixtures
 * ------------------------------------------------------------------------- */

const SPEC_TEXT = `
  const exigeFondoBlanco = LANE === '91' || tema === 'claro';
  esperado: 'pantalla' | 'no-encontrado' | 'redirige';
`;

const CONFIG = {
  version: 1,
  umbrales: { fotoMinBytes: 100 },
  viewportsClaros: ['375', '768', '1440'],
  viewportOscuro: '1440',
  comunes: { codigo: ['src/styles.css'], arnes: ['playwright/corr-rutas.json'], excluir: [':(exclude,glob)**/*.spec.ts'] },
  regresion: { exigidas: ['typecheck', 'lint-dirigido', 'specs-dirigidos', 'build', 'suite', 'route-health'] },
  decisiones: [],
  carriles: {
    90: { titulo: 'Pantalla A', actores: { medica: '90' }, codigo: ['src/app/features/a'], muta: true, premium: true },
    91: { titulo: 'Pantalla A en oscuro', actores: { medica: '91' }, codigo: ['src/app/features/other'], muta: false },
  },
};

/** Sólo el carril 90: la coherencia entre carriles se prueba aparte con CONFIG (90 y 91). */
const CONFIG_ONE = { ...CONFIG, carriles: { 90: CONFIG.carriles[90] } };

const ROUTES = {
  90: [
    { ruta: '/a', nombre: 'a' },
    { ruta: '/b?tab=1', nombre: 'b' },
    { ruta: '/gone', nombre: 'gone', esperado: 'no-encontrado' },
  ],
  91: [{ ruta: '/a', nombre: 'a-otra' }],
};

const CELL_KINDS = [
  ['375', 'claro'],
  ['768', 'claro'],
  ['1440', 'claro'],
  ['1440', 'oscuro'],
];

function sh(cwd, ...args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Dev One',
      GIT_AUTHOR_EMAIL: 'dev.one@example.test',
      GIT_COMMITTER_NAME: 'Dev One',
      GIT_COMMITTER_EMAIL: 'dev.one@example.test',
    },
  }).trim();
}

function write(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'gate-repo-'));
  tmpRoots.push(dir);
  sh(dir, 'init', '-q', '-b', 'main');
  write(join(dir, 'src/styles.css'), ':root{}\n');
  write(join(dir, 'src/app/features/a/a.ts'), 'export const a = 1;\n');
  write(join(dir, 'src/app/features/other/o.ts'), 'export const o = 1;\n');
  write(join(dir, 'src/app/features/zzz/z.ts'), 'export const z = 1;\n');
  sh(dir, 'add', '-A');
  sh(dir, 'commit', '-q', '-m', 'base');
  return dir;
}

function commit(repo, file, content, message = 'cambio') {
  write(join(repo, file), content);
  sh(repo, 'add', '-A');
  sh(repo, 'commit', '-q', '-m', message);
  return sh(repo, 'rev-parse', 'HEAD');
}

function backgroundText(theme, laneRule) {
  if (theme === 'claro') return 'PASS';
  return laneRule === 'white' ? 'PASS' : 'PASS (oscuro conservado)';
}

/**
 * Escribe matriz + manifiesto + fotos con el mismo formato que el spec.
 * `mutate` recibe la lista de celdas ya armadas para alterarlas antes de escribir.
 */
function writeEvidence(root, laneId, routes, { commitSha, mutate, phase = 'despues', generatedAt = new Date().toISOString(), servedBuilds, dirty = [], manifest = true, darkRule = 'dark', declaredRed } = {}) {
  const dir = join(root, `lane-${laneId}`);
  let cells = routes.flatMap((entry) =>
    CELL_KINDS.map(([viewport, theme]) => {
      const gone = entry.esperado === 'no-encontrado';
      const parts = gone
        ? { background: 'BORRADA (esperado)', centering: '—', width: '—', scroll: '—', console: '—' }
        : { background: backgroundText(theme, darkRule), centering: 'PASS', width: 'PASS (1 app-card)', scroll: 'PASS', console: 'PASS' };
      const photo = `fotos/despues/${entry.nombre}-${viewport}-${theme}.png`;
      const row = `| \`${entry.ruta}\` | ${viewport} | ${theme} | ${parts.background} | ${parts.centering} | ${parts.width} | ${parts.scroll} | ${parts.console} | \`${photo}\` |`;
      return {
        route: entry.ruta, name: entry.nombre, viewport, theme, expected: entry.esperado ?? 'pantalla', loaded: !gone, ok: true,
        requiresWhiteBackground: gone ? null : theme === 'claro' || darkRule === 'white',
        parts, row, consoleErrors: [], photo, photoSha256: '', errorsFor: null,
      };
    }),
  );
  if (mutate) cells = mutate(cells) ?? cells;
  const errors = [];
  for (const cell of cells) {
    const path = join(dir, cell.photo);
    if (cell.skipPhoto) continue;
    write(path, `foto ${cell.photo} ${'x'.repeat(300)}`);
    cell.photoSha256 = createHash('sha256').update(readFileSync(path)).digest('hex');
    if (cell.consoleErrors.length > 0) errors.push(`${cell.route} @ ${cell.viewport}/${cell.theme}: consola: ${cell.consoleErrors.join(' | ')}`);
  }
  const red = cells.filter((cell) => !cell.ok).length;
  const matrix = [
    `# MATRIZ visual — carril ${laneId} — ${phase} — ${generatedAt}`,
    '',
    `Celdas: ${cells.length} · en rojo: ${declaredRed ?? red}`,
    '',
    '| Ruta | Viewport | Tema | Fondo blanco | Centrado (≤2 px) | Ancho (≥85 %) | Sin scroll H | Consola | Foto |',
    '|---|---|---|---|---|---|---|---|---|',
    ...cells.map((cell) => cell.row),
    '',
    errors.length ? `## Errores\n${errors.map((error) => `- ${error}`).join('\n')}` : '## Errores\n- ninguno',
  ].join('\n');
  write(join(dir, 'MATRIZ-visual.md'), matrix);
  if (manifest) {
    write(
      join(dir, 'MANIFIESTO.json'),
      JSON.stringify({ version: 1, lane: laneId, phase, user: 'medica', generatedAt, commit: commitSha, branch: 'main', dirty, baseUrl: 'http://localhost', servedBuilds: servedBuilds ?? [commitSha.slice(0, 7)], cells, errors }, null, 2),
    );
  }
}

function writeRecord(root, name, record, laneId = null) {
  const dir = laneId ? join(root, `lane-${laneId}`, 'registros') : join(root, 'registros');
  write(join(dir, `${name}.json`), JSON.stringify({ version: 1, name, exit: 0, dirty: [], startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), tail: [], ...record }, null, 2));
}

const VITEST = (passed, failed, failedFiles = []) => ({ kind: 'vitest', files: null, tests: { passed, failed, skipped: 0 }, failedFiles });
const PLAYWRIGHT = (passed, failed = 0, didNotRun = 0) => ({ kind: 'playwright', tests: { passed, failed, skipped: 0, didNotRun } });

function writePremium(root, laneId, { commitSha, findings = [], red = 0, phase = 'despues' }) {
  const dir = join(root, `lane-${laneId}`);
  const rows = ['/a', '/b'].map((route) => `| \`${route}\` | 375 | PASS | PASS | PASS | PASS | PASS | PASS | PASS | — |`);
  if (red > 0) rows[0] = rows[0].replace('| PASS | PASS | PASS | PASS | PASS | PASS | PASS |', '| FAIL | PASS | PASS | PASS | PASS | PASS | PASS |');
  write(
    join(dir, 'MATRIZ-premium.md'),
    [`# MATRIZ de acabado premium — carril ${laneId} — ${phase} — ${new Date().toISOString()}`, '', `Celdas: 2 · en rojo: ${red} · hallazgos: ${findings.length}`, '', '| Ruta |', '|---|', ...rows, '', '## Hallazgos', findings.length ? '- algo' : '- ninguno'].join('\n'),
  );
  write(join(dir, 'premium-hallazgos.json'), JSON.stringify(findings));
  write(join(dir, 'PREMIUM-MANIFIESTO.json'), JSON.stringify({ version: 1, lane: laneId, phase, generatedAt: new Date().toISOString(), commit: commitSha, dirty: [], cells: 2, red, findings: findings.length }));
}

/** Todo en verde y fresco para el carril 90. Devuelve lo necesario para mutarlo. */
function passingScenario() {
  const repo = makeRepo();
  const first = sh(repo, 'rev-parse', 'HEAD');
  const head = commit(repo, 'src/app/features/a/a.ts', 'export const a = 2;\n', 'cambia a');
  const root = join(repo, 'artifacts/evidencia/correcciones');
  writeEvidence(root, '90', ROUTES[90], { commitSha: head });
  writeEvidence(root, '91', ROUTES[91], { commitSha: head, darkRule: 'dark' });
  writePremium(root, '90', { commitSha: head });
  for (const name of ['typecheck', 'lint-dirigido', 'build']) writeRecord(root, name, { command: `yarn ${name}`, commit: head });
  writeRecord(root, 'specs-dirigidos', { command: 'yarn test a', commit: head, summary: VITEST(12, 0) });
  writeRecord(root, 'suite-base', { command: 'yarn test', commit: first, exit: 1, summary: VITEST(100, 2, ['src/x.spec.ts']) });
  writeRecord(root, 'suite', { command: 'yarn test', commit: head, exit: 1, summary: VITEST(101, 2, ['src/x.spec.ts']) });
  writeRecord(root, 'route-health', { command: 'yarn pw:rutas', commit: head, summary: PLAYWRIGHT(4) });
  writeRecord(root, 'mutacion', { command: 'yarn pw mutacion', commit: head, backend: 'real', summary: PLAYWRIGHT(2) }, '90');
  write(join(root, 'lane-90', 'REVISION.json'), JSON.stringify({ version: 1, lane: '90', reviewer: 'Reviewer Two', verdict: 'APROBADO', since: first, commit: head, dirty: [], at: new Date().toISOString() }));
  return { repo, root, first, head };
}

function run(scenario, { lanes = ['90'], config = CONFIG_ONE, routes = ROUTES, specText = SPEC_TEXT, gitRef = 'HEAD' } = {}) {
  const reports = evaluateAll({
    laneIds: lanes,
    config,
    routesByKey: routes,
    root: scenario.root,
    git: createGit(scenario.repo, gitRef),
    specText,
    inventoryCheck: () => ({ ok: true, detail: 'ok' }),
  });
  const byLane = Object.fromEntries(reports.map((report) => [report.lane, report]));
  return {
    reports,
    report: reports[0],
    state: (id, lane = lanes[0]) => byLane[lane].criteria.find((criterion) => criterion.id === id)?.state,
    detail: (id, lane = lanes[0]) => byLane[lane].criteria.find((criterion) => criterion.id === id)?.details.join(' / '),
  };
}

function expectVerdict(outcome, verdict, ...failing) {
  assert.equal(outcome.report.verdict, verdict, JSON.stringify(outcome.report.criteria.filter((c) => c.state !== STATE.OK), null, 1));
  for (const id of failing) assert.notEqual(outcome.state(id), STATE.OK, `${id} debería no estar OK`);
}

/* ----------------------------------------------------------------------------
 * El escenario completo
 * ------------------------------------------------------------------------- */

describe('escenario completo y fresco', () => {
  it('PASA, con todos los criterios en OK y salida 0', () => {
    const outcome = run(passingScenario());
    expectVerdict(outcome, VERDICT.PASS);
    assert.deepEqual(outcome.report.criteria.filter((criterion) => criterion.state !== STATE.OK), []);
    assert.equal(exitCodeOf(outcome.reports), 0);
  });

  it('un cambio fuera del alcance del carril no invalida la evidencia', () => {
    const scenario = passingScenario();
    commit(scenario.repo, 'src/app/features/zzz/z.ts', 'export const z = 2;\n');
    expectVerdict(run(scenario), VERDICT.PASS);
  });

  it('un cambio en el arnés de medición invalida la medición visual pero no un typecheck ya registrado', () => {
    const scenario = passingScenario();
    commit(scenario.repo, 'playwright/corr-rutas.json', '{}\n', 'cambia el arnés');
    const outcome = run(scenario);
    assert.equal(outcome.state('frescura.commit'), STATE.FAIL);
    assert.equal(outcome.state('acabado.premium'), STATE.FAIL);
    assert.equal(outcome.state('regresion.typecheck'), STATE.OK);
    assert.equal(outcome.state('regresion.build'), STATE.OK);
  });

  it('un cambio sólo en un .spec.ts del alcance tampoco la invalida (no cambia lo que se ve)', () => {
    const scenario = passingScenario();
    commit(scenario.repo, 'src/app/features/a/a.spec.ts', 'it();\n');
    expectVerdict(run(scenario), VERDICT.PASS);
  });
});

/* ----------------------------------------------------------------------------
 * Mutaciones que tienen que hacerlo FALLAR
 * ------------------------------------------------------------------------- */

describe('mutaciones que hacen FALLAR el gate', () => {
  it('evidencia vieja: el código del carril cambió después de la medición', () => {
    const scenario = passingScenario();
    commit(scenario.repo, 'src/app/features/a/a.ts', 'export const a = 3;\n', 'cambia a otra vez');
    const outcome = run(scenario);
    expectVerdict(outcome, VERDICT.FAIL, 'frescura.commit');
    assert.equal(outcome.state('frescura.commit'), STATE.FAIL);
    assert.match(outcome.detail('frescura.commit'), /cambió después/);
    assert.equal(exitCodeOf(outcome.reports), 1);
  });

  it('evidencia vieja por un estilo global compartido', () => {
    const scenario = passingScenario();
    commit(scenario.repo, 'src/styles.css', ':root{--x:1}\n', 'toca estilos globales');
    expectVerdict(run(scenario), VERDICT.FAIL, 'frescura.commit');
  });

  it('celda faltante', () => {
    const scenario = passingScenario();
    writeEvidence(scenario.root, '90', ROUTES[90], { commitSha: scenario.head, mutate: (cells) => cells.filter((cell) => !(cell.name === 'b' && cell.viewport === '768')) });
    const outcome = run(scenario);
    expectVerdict(outcome, VERDICT.FAIL, 'cobertura.celdas');
    assert.match(outcome.detail('cobertura.celdas'), /faltan 1 de 12 celdas/);
  });

  it('una ruta nueva en corr-rutas.json que la matriz no midió', () => {
    const scenario = passingScenario();
    const routes = { ...ROUTES, 90: [...ROUTES[90], { ruta: '/nueva', nombre: 'nueva' }] };
    const outcome = run(scenario, { routes });
    expectVerdict(outcome, VERDICT.FAIL, 'cobertura.celdas');
    assert.match(outcome.detail('cobertura.celdas'), /\/nueva/);
  });

  it('tema oscuro ausente', () => {
    const scenario = passingScenario();
    writeEvidence(scenario.root, '90', ROUTES[90], { commitSha: scenario.head, mutate: (cells) => cells.filter((cell) => cell.theme !== 'oscuro') });
    const outcome = run(scenario);
    expectVerdict(outcome, VERDICT.FAIL, 'cobertura.tema-oscuro', 'cobertura.celdas');
    assert.equal(outcome.state('cobertura.tema-oscuro'), STATE.FAIL);
    assert.match(outcome.detail('cobertura.tema-oscuro'), /tema oscuro ausente en 3 rutas/);
  });

  it('error de consola en una celda', () => {
    const scenario = passingScenario();
    writeEvidence(scenario.root, '90', ROUTES[90], {
      commitSha: scenario.head,
      mutate: (cells) => {
        const cell = cells.find((candidate) => candidate.name === 'a' && candidate.viewport === '375');
        cell.consoleErrors = ['TypeError: x is undefined'];
        cell.parts = { ...cell.parts, console: 'FAIL (1)' };
        cell.ok = false;
        cell.row = cell.row.replace('| PASS | `fotos', '| FAIL (1) | `fotos');
        return cells;
      },
    });
    const outcome = run(scenario);
    expectVerdict(outcome, VERDICT.FAIL, 'medicion.consola', 'medicion.verde');
    assert.equal(outcome.state('medicion.consola'), STATE.FAIL);
  });

  it('un error de consola que la matriz declara en «## Errores» aunque la columna diga PASS', () => {
    const scenario = passingScenario();
    writeEvidence(scenario.root, '90', ROUTES[90], {
      commitSha: scenario.head,
      mutate: (cells) => {
        cells[0].consoleErrors = ['404 /api/x'];
        return cells;
      },
    });
    const outcome = run(scenario);
    assert.equal(outcome.state('medicion.consola'), STATE.FAIL);
  });

  it('celda en rojo (fondo, centrado, ancho o scroll)', () => {
    const scenario = passingScenario();
    writeEvidence(scenario.root, '90', ROUTES[90], {
      commitSha: scenario.head,
      mutate: (cells) => {
        const cell = cells.find((candidate) => candidate.name === 'a' && candidate.viewport === '1440' && candidate.theme === 'claro');
        cell.parts = { ...cell.parts, width: 'FAIL (65 % · 1 app-card)' };
        cell.ok = false;
        cell.row = cell.row.replace('PASS (1 app-card)', 'FAIL (65 % · 1 app-card)');
        return cells;
      },
    });
    const outcome = run(scenario);
    expectVerdict(outcome, VERDICT.FAIL, 'medicion.verde');
    assert.match(outcome.detail('medicion.verde'), /1 celdas en rojo/);
  });

  it('la cabecera dice «en rojo: 0» pero hay una celda roja (recuento mentiroso)', () => {
    const scenario = passingScenario();
    writeEvidence(scenario.root, '90', ROUTES[90], {
      commitSha: scenario.head,
      declaredRed: 0,
      mutate: (cells) => {
        cells[0].parts = { ...cells[0].parts, scroll: 'FAIL' };
        cells[0].ok = false;
        cells[0].row = cells[0].row.replace('| PASS | PASS | `fotos', '| FAIL | PASS | `fotos');
        return cells;
      },
    });
    const outcome = run(scenario);
    assert.equal(outcome.state('medicion.verde'), STATE.FAIL);
    assert.match(outcome.detail('medicion.verde'), /declara 0 rojas/);
  });

  it('matriz retocada a mano: una fila que ya no coincide con el manifiesto', () => {
    const scenario = passingScenario();
    const path = join(scenario.root, 'lane-90', 'MATRIZ-visual.md');
    const text = readFileSync(path, 'utf8');
    // Cambia el ancho de una fila a un valor que el manifiesto no registró.
    writeFileSync(path, text.replace('PASS (1 app-card)', 'PASS (9 app-card)'));
    const outcome = run(scenario);
    expectVerdict(outcome, VERDICT.FAIL, 'cobertura.celdas');
    assert.match(outcome.detail('cobertura.celdas'), /retocadas a mano/);
  });

  it('foto alterada después de la medición (el hash no coincide)', () => {
    const scenario = passingScenario();
    write(join(scenario.root, 'lane-90', 'fotos/despues/a-375-claro.png'), `otra foto ${'y'.repeat(300)}`);
    const outcome = run(scenario);
    expectVerdict(outcome, VERDICT.FAIL, 'fotos.integras');
    assert.equal(outcome.state('fotos.integras'), STATE.FAIL);
  });

  it('foto por debajo del mínimo (una foto en blanco)', () => {
    const scenario = passingScenario();
    writeEvidence(scenario.root, '90', ROUTES[90], { commitSha: scenario.head });
    const photo = join(scenario.root, 'lane-90', 'fotos/despues/a-375-claro.png');
    write(photo, 'x');
    const manifestPath = join(scenario.root, 'lane-90', 'MANIFIESTO.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    manifest.cells.find((cell) => cell.name === 'a' && cell.viewport === '375').photoSha256 = createHash('sha256').update('x').digest('hex');
    writeFileSync(manifestPath, JSON.stringify(manifest));
    assert.equal(run(scenario).state('fotos.integras'), STATE.FAIL);
  });

  it('medición con cambios sin confirmar en el alcance del carril', () => {
    const scenario = passingScenario();
    writeEvidence(scenario.root, '90', ROUTES[90], { commitSha: scenario.head, dirty: ['src/app/features/a/a.ts'] });
    const outcome = run(scenario);
    expectVerdict(outcome, VERDICT.FAIL, 'frescura.commit');
    assert.match(outcome.detail('frescura.commit'), /sin confirmar/);
  });

  it('cambios sin confirmar FUERA del alcance no invalidan', () => {
    const scenario = passingScenario();
    writeEvidence(scenario.root, '90', ROUTES[90], { commitSha: scenario.head, dirty: ['README.md'] });
    assert.equal(run(scenario).state('frescura.commit'), STATE.OK);
  });

  it('build servido distinto del árbol medido (dist viejo)', () => {
    const scenario = passingScenario();
    writeEvidence(scenario.root, '90', ROUTES[90], { commitSha: scenario.head, servedBuilds: ['deadbee'] });
    const outcome = run(scenario);
    expectVerdict(outcome, VERDICT.FAIL, 'build.servido');
    assert.match(outcome.detail('build.servido'), /dist viejo/);
  });

  it('la matriz «antes» presentada como «después»', () => {
    const scenario = passingScenario();
    writeEvidence(scenario.root, '90', ROUTES[90], { commitSha: scenario.head, phase: 'antes' });
    const outcome = run(scenario);
    expectVerdict(outcome, VERDICT.FAIL, 'evidencia.fase');
  });

  it('el manifiesto apunta a un commit que no existe en este repositorio', () => {
    const scenario = passingScenario();
    writeEvidence(scenario.root, '90', ROUTES[90], { commitSha: 'a'.repeat(40) });
    expectVerdict(run(scenario), VERDICT.FAIL, 'frescura.commit');
  });

  it('typecheck rojo', () => {
    const scenario = passingScenario();
    writeRecord(scenario.root, 'typecheck', { command: 'yarn typecheck', commit: scenario.head, exit: 2 });
    expectVerdict(run(scenario), VERDICT.FAIL, 'regresion.typecheck');
  });

  it('un registro de regresión anterior al último cambio de código', () => {
    const scenario = passingScenario();
    const older = scenario.first;
    writeRecord(scenario.root, 'build', { command: 'yarn build', commit: older });
    const outcome = run(scenario);
    expectVerdict(outcome, VERDICT.FAIL, 'regresion.build');
    assert.match(outcome.detail('regresion.build'), /cambió después/);
  });

  it('specs dirigidos que "pasan" porque corrieron 0 pruebas', () => {
    const scenario = passingScenario();
    writeRecord(scenario.root, 'specs-dirigidos', { command: 'yarn test nada', commit: scenario.head, summary: VITEST(0, 0) });
    const outcome = run(scenario);
    expectVerdict(outcome, VERDICT.FAIL, 'regresion.specs-dirigidos');
    assert.match(outcome.detail('regresion.specs-dirigidos'), /0 pruebas/);
  });

  it('suite con rojos nuevos respecto de la base (74 → 76)', () => {
    const scenario = passingScenario();
    writeRecord(scenario.root, 'suite', { command: 'yarn test', commit: scenario.head, exit: 1, summary: VITEST(99, 4, ['src/x.spec.ts', 'src/nuevo.spec.ts']) });
    const outcome = run(scenario);
    expectVerdict(outcome, VERDICT.FAIL, 'regresion.suite');
    assert.match(outcome.detail('regresion.suite'), /4 pruebas rojas contra 2/);
  });

  it('suite con el mismo número de rojos pero en un archivo distinto', () => {
    const scenario = passingScenario();
    writeRecord(scenario.root, 'suite', { command: 'yarn test', commit: scenario.head, exit: 1, summary: VITEST(100, 2, ['src/otro.spec.ts']) });
    const outcome = run(scenario);
    assert.equal(outcome.state('regresion.suite'), STATE.FAIL);
    assert.match(outcome.detail('regresion.suite'), /otro\.spec\.ts/);
  });

  it('route-health con la API apagada (1 falla, 3 no corrieron)', () => {
    const scenario = passingScenario();
    writeRecord(scenario.root, 'route-health', { command: 'yarn pw:rutas', commit: scenario.head, exit: 1, summary: PLAYWRIGHT(0, 1, 3) });
    expectVerdict(run(scenario), VERDICT.FAIL, 'regresion.route-health');
  });

  it('revisión RECHAZADA', () => {
    const scenario = passingScenario();
    write(join(scenario.root, 'lane-90', 'REVISION.json'), JSON.stringify({ version: 1, lane: '90', reviewer: 'Reviewer Two', verdict: 'RECHAZADO', since: scenario.first, commit: scenario.head, dirty: [], at: new Date().toISOString(), notes: 'el diálogo se corta en 375' }));
    const outcome = run(scenario);
    expectVerdict(outcome, VERDICT.FAIL, 'revision.independiente');
    assert.match(outcome.detail('revision.independiente'), /RECHAZÓ/);
  });

  it('autoaprobación: el revisor es quien escribió el código del carril', () => {
    const scenario = passingScenario();
    write(join(scenario.root, 'lane-90', 'REVISION.json'), JSON.stringify({ version: 1, lane: '90', reviewer: 'Dev One', verdict: 'APROBADO', since: scenario.first, commit: scenario.head, dirty: [], at: new Date().toISOString() }));
    const outcome = run(scenario);
    expectVerdict(outcome, VERDICT.FAIL, 'revision.independiente');
    assert.match(outcome.detail('revision.independiente'), /se aprobó a sí mismo/);
  });

  it('autoaprobación identificada por correo', () => {
    const scenario = passingScenario();
    write(join(scenario.root, 'lane-90', 'REVISION.json'), JSON.stringify({ version: 1, lane: '90', reviewer: 'dev.one@example.test', verdict: 'APROBADO', since: scenario.first, commit: scenario.head, dirty: [], at: new Date().toISOString() }));
    assert.equal(run(scenario).state('revision.independiente'), STATE.FAIL);
  });

  it('revisión aprobada sobre un commit anterior al último cambio', () => {
    const scenario = passingScenario();
    write(join(scenario.root, 'lane-90', 'REVISION.json'), JSON.stringify({ version: 1, lane: '90', reviewer: 'Reviewer Two', verdict: 'APROBADO', since: scenario.first, commit: scenario.first, dirty: [], at: new Date().toISOString() }));
    assert.equal(run(scenario).state('revision.independiente'), STATE.FAIL);
  });
});

describe('acabado premium y severidades abiertas', () => {
  it('hallazgos de acabado abiertos hacen FALLAR', () => {
    const scenario = passingScenario();
    writePremium(scenario.root, '90', { commitSha: scenario.head, findings: [{ ruta: '/a', viewport: '375', compuerta: 'target', detalle: '20x20', selector: 'button' }] });
    const outcome = run(scenario);
    expectVerdict(outcome, VERDICT.FAIL, 'acabado.premium');
    assert.match(outcome.detail('acabado.premium'), /1 hallazgos/);
  });

  it('una celda de acabado en rojo hace FALLAR aunque no haya hallazgos', () => {
    const scenario = passingScenario();
    writePremium(scenario.root, '90', { commitSha: scenario.head, red: 1 });
    assert.equal(run(scenario).state('acabado.premium'), STATE.FAIL);
  });

  it('el acabado medido antes del último cambio de código hace FALLAR', () => {
    const scenario = passingScenario();
    writePremium(scenario.root, '90', { commitSha: scenario.first });
    const outcome = run(scenario);
    assert.equal(outcome.state('acabado.premium'), STATE.FAIL);
    assert.match(outcome.detail('acabado.premium'), /cambió después/);
  });

  it('sin matriz de acabado el carril que la exige no es evaluable', () => {
    const scenario = passingScenario();
    rmSync(join(scenario.root, 'lane-90', 'MATRIZ-premium.md'));
    const outcome = run(scenario);
    assert.equal(outcome.state('acabado.premium'), STATE.MISSING);
    assert.equal(outcome.report.verdict, VERDICT.NOT_EVALUABLE);
  });

  it('una revisión APROBADA con un P2 abierto no cierra el carril', () => {
    const scenario = passingScenario();
    write(join(scenario.root, 'lane-90', 'REVISION.json'), JSON.stringify({ version: 1, lane: '90', reviewer: 'Reviewer Two', verdict: 'APROBADO', since: scenario.first, commit: scenario.head, dirty: [], at: new Date().toISOString(), open: ['P3', 'P2'] }));
    const outcome = run(scenario);
    expectVerdict(outcome, VERDICT.FAIL, 'revision.independiente');
    assert.match(outcome.detail('revision.independiente'), /P2 abiertos/);
  });

  it('un P3 abierto no bloquea', () => {
    const scenario = passingScenario();
    write(join(scenario.root, 'lane-90', 'REVISION.json'), JSON.stringify({ version: 1, lane: '90', reviewer: 'Reviewer Two', verdict: 'APROBADO', since: scenario.first, commit: scenario.head, dirty: [], at: new Date().toISOString(), open: ['P3'] }));
    expectVerdict(run(scenario), VERDICT.PASS);
  });
});

/* ----------------------------------------------------------------------------
 * Lo que NO puede dar PASA aunque nada falle: falta evidencia
 * ------------------------------------------------------------------------- */

describe('faltas de evidencia: NO EVALUABLE, nunca PASA', () => {
  it('carril sin captura', () => {
    const scenario = passingScenario();
    rmSync(join(scenario.root, 'lane-90'), { recursive: true, force: true });
    const outcome = run(scenario);
    assert.equal(outcome.report.verdict, VERDICT.NOT_EVALUABLE);
    assert.equal(outcome.state('evidencia.presente'), STATE.MISSING);
    assert.equal(exitCodeOf(outcome.reports), 2);
  });

  it('carril sin captura Y con una regresión roja: FALLA gana a NO EVALUABLE', () => {
    const scenario = passingScenario();
    rmSync(join(scenario.root, 'lane-90'), { recursive: true, force: true });
    writeRecord(scenario.root, 'typecheck', { command: 'yarn typecheck', commit: scenario.head, exit: 1 });
    assert.equal(run(scenario).report.verdict, VERDICT.FAIL);
  });

  it('las fotos ya no están en disco (la matriz sola no prueba nada)', () => {
    const scenario = passingScenario();
    rmSync(join(scenario.root, 'lane-90', 'fotos'), { recursive: true, force: true });
    const outcome = run(scenario);
    assert.equal(outcome.report.verdict, VERDICT.NOT_EVALUABLE);
    assert.equal(outcome.state('fotos.integras'), STATE.MISSING);
  });

  it('evidencia heredada sin manifiesto y posterior al código: no se puede comparar', () => {
    const scenario = passingScenario();
    rmSync(join(scenario.root, 'lane-90', 'MANIFIESTO.json'));
    const outcome = run(scenario);
    assert.equal(outcome.report.verdict, VERDICT.NOT_EVALUABLE);
    assert.equal(outcome.state('frescura.commit'), STATE.MISSING);
    assert.equal(outcome.state('build.servido'), STATE.MISSING);
  });

  it('evidencia heredada sin manifiesto y ANTERIOR al último cambio de código: FALLA por fecha', () => {
    const scenario = passingScenario();
    rmSync(join(scenario.root, 'lane-90', 'MANIFIESTO.json'));
    const path = join(scenario.root, 'lane-90', 'MATRIZ-visual.md');
    writeFileSync(path, readFileSync(path, 'utf8').replace(/ — \d{4}-\d{2}-\d{2}T[^\n]+/, ' — 2020-01-01T00:00:00.000Z'));
    const outcome = run(scenario);
    expectVerdict(outcome, VERDICT.FAIL, 'frescura.commit');
    assert.match(outcome.detail('frescura.commit'), /anterior al último cambio/);
  });

  it('no se pudo leer el sello de build de la maqueta', () => {
    const scenario = passingScenario();
    writeEvidence(scenario.root, '90', ROUTES[90], { commitSha: scenario.head, servedBuilds: [] });
    const outcome = run(scenario);
    assert.equal(outcome.state('build.servido'), STATE.MISSING);
    assert.equal(outcome.report.verdict, VERDICT.NOT_EVALUABLE);
  });

  it('sin registro de la suite', () => {
    const scenario = passingScenario();
    rmSync(join(scenario.root, 'registros', 'suite.json'));
    const outcome = run(scenario);
    assert.equal(outcome.report.verdict, VERDICT.NOT_EVALUABLE);
    assert.equal(outcome.state('regresion.suite'), STATE.MISSING);
  });

  it('suite sin la suite sobre la base: no se sabe si los rojos son nuevos', () => {
    const scenario = passingScenario();
    rmSync(join(scenario.root, 'registros', 'suite-base.json'));
    const outcome = run(scenario);
    assert.equal(outcome.state('regresion.suite'), STATE.MISSING);
  });

  it('OOM (exit 137) no es un fallo: pide repetir', () => {
    const scenario = passingScenario();
    writeRecord(scenario.root, 'build', { command: 'yarn build', commit: scenario.head, exit: 137 });
    const outcome = run(scenario);
    assert.equal(outcome.state('regresion.build'), STATE.MISSING);
    assert.match(outcome.detail('regresion.build'), /OOM/);
    assert.equal(outcome.report.verdict, VERDICT.NOT_EVALUABLE);
  });

  it('el carril escribe datos y la mutación se probó contra el backend simulado: techo TESTED', () => {
    const scenario = passingScenario();
    writeRecord(scenario.root, 'mutacion', { command: 'yarn pw mutacion', commit: scenario.head, backend: 'simulado', summary: PLAYWRIGHT(2) }, '90');
    const outcome = run(scenario);
    assert.equal(outcome.state('mutacion.cadena'), STATE.MISSING);
    assert.match(outcome.detail('mutacion.cadena'), /techo es TESTED/);
    assert.equal(outcome.report.verdict, VERDICT.NOT_EVALUABLE);
  });

  it('el carril escribe datos y no hay registro de mutación', () => {
    const scenario = passingScenario();
    rmSync(join(scenario.root, 'lane-90', 'registros'), { recursive: true });
    assert.equal(run(scenario).state('mutacion.cadena'), STATE.MISSING);
  });

  it('un carril que no escribe datos no exige mutación', () => {
    const scenario = passingScenario();
    const outcome = run(scenario, { lanes: ['91'], config: CONFIG });
    assert.equal(outcome.state('mutacion.cadena'), undefined);
  });

  it('sin revisión independiente registrada', () => {
    const scenario = passingScenario();
    rmSync(join(scenario.root, 'lane-90', 'REVISION.json'));
    const outcome = run(scenario);
    assert.equal(outcome.state('revision.independiente'), STATE.MISSING);
    assert.equal(outcome.report.verdict, VERDICT.NOT_EVALUABLE);
  });

  it('el arnés no entiende lo que declara corr-rutas.json', () => {
    const scenario = passingScenario();
    const routes = { ...ROUTES, 90: [...ROUTES[90], { ruta: '/x', nombre: 'x', esperado: 'redirige', fixture: 'vacio' }] };
    writeEvidence(scenario.root, '90', routes[90], { commitSha: scenario.head });
    const outcome = run(scenario, { routes, specText: "esperado: 'pantalla' | 'no-encontrado'" });
    assert.equal(outcome.state('arnes.soporta'), STATE.MISSING);
    assert.match(outcome.detail('arnes.soporta'), /esperado: redirige, fixture: vacio/);
    assert.equal(outcome.report.verdict, VERDICT.NOT_EVALUABLE);
  });

  it('el inventario generado está desactualizado (carril con inventarioGenerado)', () => {
    const scenario = passingScenario();
    const config = structuredClone(CONFIG_ONE);
    config.carriles['90'].inventarioGenerado = true;
    const reports = evaluateAll({
      laneIds: ['90'], config, routesByKey: ROUTES, root: scenario.root, git: createGit(scenario.repo), specText: SPEC_TEXT,
      inventoryCheck: () => ({ ok: false, detail: '34: +1 (/nueva) -0' }),
    });
    assert.equal(reports[0].criteria.find((c) => c.id === 'inventario.vigente').state, STATE.FAIL);
    assert.equal(reports[0].verdict, VERDICT.FAIL);
  });
});

/* ----------------------------------------------------------------------------
 * Coherencia entre carriles (34 vs 36: la misma pantalla, reglas opuestas)
 * ------------------------------------------------------------------------- */

describe('coherencia entre carriles', () => {
  it('dos carriles que exigen reglas opuestas sobre la misma pantalla FALLAN los dos', () => {
    // El spec de prueba fuerza fondo blanco en oscuro sólo para el carril 91; el 90 conserva la superficie oscura.
    const scenario = passingScenario();
    const outcome = run(scenario, { lanes: ['90', '91'], config: CONFIG });
    assert.equal(outcome.state('coherencia.entre-carriles', '90'), STATE.FAIL);
    assert.equal(outcome.state('coherencia.entre-carriles', '91'), STATE.FAIL);
    assert.match(outcome.detail('coherencia.entre-carriles', '90'), /\/a: .*OSCURA.*BLANCO|\/a: .*BLANCO.*OSCURA/);
    assert.match(outcome.detail('coherencia.entre-carriles', '90'), /no hay decisión registrada/);
  });

  it('también se detecta sólo con evidencia, aunque el arnés ya no tenga la regla', () => {
    const scenario = passingScenario();
    writeEvidence(scenario.root, '91', ROUTES[91], { commitSha: scenario.head, darkRule: 'white' });
    const outcome = run(scenario, { lanes: ['90', '91'], config: CONFIG, specText: "const exigeFondoBlanco = tema === 'claro';" });
    assert.equal(outcome.state('coherencia.entre-carriles', '90'), STATE.FAIL);
    assert.match(outcome.detail('coherencia.entre-carriles', '90'), /evidencia/);
  });

  it('una decisión registrada resuelve el conflicto: sólo falla quien la contradice', () => {
    const scenario = passingScenario();
    const config = structuredClone(CONFIG);
    config.decisiones = [{ id: 'D-1', ruta: '/a', tema: 'oscuro', regla: 'dark', fuente: 'acta del propietario' }];
    const outcome = run(scenario, { lanes: ['90', '91'], config });
    assert.equal(outcome.state('coherencia.entre-carriles', '90'), STATE.OK);
    assert.equal(outcome.state('coherencia.entre-carriles', '91'), STATE.FAIL);
    assert.match(outcome.detail('coherencia.entre-carriles', '91'), /contradice la decisión D-1/);
  });

  it('la regla del arnés se lee del spec', () => {
    assert.deepEqual(whiteInDarkLanes("const exigeFondoBlanco = LANE === '36' || LANE === '12' || tema === 'claro';"), ['36', '12']);
    assert.deepEqual(whiteInDarkLanes("const exigeFondoBlanco = tema === 'claro';"), []);
  });

  it('clasifica la regla de una celda por su texto cuando no hay manifiesto', () => {
    assert.equal(backgroundRuleOf({ theme: 'oscuro', background: 'PASS (oscuro conservado)' }), 'dark');
    assert.equal(backgroundRuleOf({ theme: 'oscuro', background: 'FAIL (se perdió la superficie oscura)' }), 'dark');
    assert.equal(backgroundRuleOf({ theme: 'oscuro', background: 'PASS' }), 'white');
    assert.equal(backgroundRuleOf({ theme: 'oscuro', background: 'FAIL (body: rgb(18, 40, 50))' }), 'white');
    assert.equal(backgroundRuleOf({ theme: 'oscuro', background: 'REDIRIGE (esperado)' }), null);
    assert.equal(backgroundRuleOf({ theme: 'claro', background: 'PASS' }), null);
  });
});

/* ----------------------------------------------------------------------------
 * Lectura de la matriz real y de la salida de los comandos
 * ------------------------------------------------------------------------- */

const MATRIZ_REAL_31 = `# MATRIZ visual — carril 31 — despues — 2026-10-15T15:19:43.683Z

Celdas: 12 · en rojo: 0

| Ruta | Viewport | Tema | Fondo blanco | Centrado (≤2 px) | Ancho (≥85 %) | Sin scroll H | Consola | Foto |
|---|---|---|---|---|---|---|---|---|
| \`/dashboard\` | 375 | claro | PASS | PASS | PASS (2 app-card) | PASS | PASS | \`fotos/despues/panel-tus-accesos-zona-consultas-375-claro.png\` |
| \`/consultation\` | 375 | claro | BORRADA (esperado) | — | — | — | — | \`fotos/despues/consultation-ya-no-existe-375-claro.png\` |
| \`/schedule\` | 1440 | oscuro | PASS (oscuro conservado) | PASS | PASS (<app-agenda>) | PASS | PASS | \`fotos/despues/consultas-medicas-sigue-viva-1440-oscuro.png\` |
| \`/posts\` | 1440 | oscuro | PASS (oscuro conservado) | PASS | — (<app-alovida-design-notice>; escena conservada) | PASS | PASS | \`fotos/despues/home-1440-oscuro.png\` |

## Errores
- ninguno`;

describe('lectura de la matriz y de los comandos', () => {
  it('lee una matriz con el formato real del repositorio', () => {
    const matrix = parseMatrix(MATRIZ_REAL_31);
    assert.equal(matrix.lane, '31');
    assert.equal(matrix.phase, 'despues');
    assert.equal(matrix.generatedAt, '2026-10-15T15:19:43.683Z');
    assert.equal(matrix.declaredCells, 12);
    assert.equal(matrix.declaredRed, 0);
    assert.equal(matrix.rows.length, 4);
    assert.deepEqual(matrix.errors, []);
    assert.equal(matrix.rows[0].name, 'panel-tus-accesos-zona-consultas');
    assert.equal(matrix.rows[3].width, '— (<app-alovida-design-notice>; escena conservada)');
  });

  it('una matriz con la sección «## Errores» llena devuelve los errores', () => {
    const matrix = parseMatrix(MATRIZ_REAL_31.replace('- ninguno', '- /dashboard @ 375/claro: consola: boom'));
    assert.deepEqual(matrix.errors, ['/dashboard @ 375/claro: consola: boom']);
  });

  it('las celdas esperadas son ruta × (375, 768, 1440 claro, 1440 oscuro)', () => {
    const cells = expectedCells([{ ruta: '/a', nombre: 'a' }], CONFIG);
    assert.deepEqual(cells.map((cell) => cell.key), ['a|375|claro', 'a|768|claro', 'a|1440|claro', 'a|1440|oscuro']);
  });

  it('lee el resumen de vitest, con los archivos rojos', () => {
    const output = [
      ' FAIL  src/app/x/x.spec.ts > suite > caso',
      ' ❯ src/app/y/y.spec.ts (3 tests | 1 failed)',
      '\u001b[2m Test Files \u001b[22m \u001b[1m\u001b[31m8 failed\u001b[39m | 770 passed (778)',
      '\u001b[2m      Tests \u001b[22m \u001b[1m\u001b[31m73 failed\u001b[39m | 10667 passed (10740)',
    ].join('\n');
    const summary = parseRunSummary(output);
    assert.equal(summary.kind, 'vitest');
    assert.deepEqual(summary.tests, { passed: 10667, failed: 73, skipped: 0 });
    assert.deepEqual(summary.files, { failed: 8, passed: 770 });
    assert.deepEqual(summary.failedFiles, ['src/app/x/x.spec.ts', 'src/app/y/y.spec.ts']);
  });

  it('lee el resumen de playwright', () => {
    const summary = parseRunSummary('  1 failed\n    [chromium] › x.spec.ts:1:1 › algo\n  3 did not run\n  2 passed (31.2s)\n');
    assert.deepEqual(summary, { kind: 'playwright', tests: { passed: 2, failed: 1, skipped: 0, didNotRun: 3 } });
  });

  it('no inventa un resumen que no puede leer', () => {
    assert.equal(parseRunSummary('todo bien, creo'), null);
  });

  it('harnessGaps detecta lo que el spec no conoce', () => {
    const entries = [{ ruta: '/x', nombre: 'x', esperado: 'redirige', accion: 'abrir', destino: '/y' }];
    assert.deepEqual(harnessGaps(entries, "'redirige' 'abrir' destino"), []);
    assert.deepEqual(harnessGaps(entries, "'abrir'"), ['esperado: redirige', 'destino']);
  });
});

/* ----------------------------------------------------------------------------
 * La configuración real contra el repositorio real
 * ------------------------------------------------------------------------- */

describe('configuración real', () => {
  const config = JSON.parse(readFileSync(join(REPO_ROOT, 'scripts/lib/correcciones-carriles.json'), 'utf8'));
  const routes = JSON.parse(readFileSync(join(REPO_ROOT, 'playwright/corr-rutas.json'), 'utf8'));
  const specText = readFileSync(join(REPO_ROOT, 'playwright/corr-evidencia.spec.ts'), 'utf8');

  it('cada actor de cada carril tiene rutas en corr-rutas.json, con nombres únicos', () => {
    for (const [laneId, lane] of Object.entries(config.carriles)) {
      for (const routeKey of Object.values(lane.actores)) {
        assert.ok(Array.isArray(routes[routeKey]) && routes[routeKey].length > 0, `carril ${laneId}: sin rutas para ${routeKey}`);
        const names = routes[routeKey].map((entry) => entry.nombre);
        assert.equal(new Set(names).size, names.length, `carril ${laneId}: nombres repetidos en ${routeKey}`);
      }
    }
  });

  it('el alcance de cada carril señala archivos versionados que existen', () => {
    if (!existsSync(join(REPO_ROOT, '.git'))) return;
    const git = createGit(REPO_ROOT);
    for (const [laneId, lane] of Object.entries(config.carriles)) {
      for (const path of [...config.comunes.codigo, ...lane.codigo]) {
        assert.ok(git.filesInScope([path]).size > 0, `carril ${laneId}: «${path}» no coincide con ningún archivo versionado`);
      }
    }
  });

  it('el arnés vigente entiende todo lo que declara corr-rutas.json para 31–40', () => {
    const entries = Object.values(config.carriles).flatMap((lane) => Object.values(lane.actores).flatMap((key) => routes[key]));
    assert.deepEqual(harnessGaps(entries, specText), []);
  });

  it('las regresiones exigidas son las seis y los criterios no tienen ids repetidos', () => {
    assert.deepEqual(config.regresion.exigidas, ['typecheck', 'lint-dirigido', 'specs-dirigidos', 'build', 'suite', 'route-health']);
    const ids = CRITERIA.map((criterion) => criterion.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it('la página de documentación nombra todos los criterios', () => {
    const docs = readFileSync(join(REPO_ROOT, 'docs/testing/gate-correcciones.md'), 'utf8');
    for (const criterion of CRITERIA) assert.ok(docs.includes(`\`${criterion.id}\``), `docs/testing/gate-correcciones.md no nombra ${criterion.id}`);
  });
});

/* ----------------------------------------------------------------------------
 * CLI: salida, registrar, revisar
 * ------------------------------------------------------------------------- */

function cliRepo(scenario) {
  write(join(scenario.repo, 'scripts/lib/correcciones-carriles.json'), JSON.stringify(CONFIG_ONE));
  write(join(scenario.repo, 'playwright/corr-rutas.json'), JSON.stringify(ROUTES));
  write(join(scenario.repo, 'playwright/corr-evidencia.spec.ts'), SPEC_TEXT);
  write(join(scenario.repo, '.gitignore'), 'artifacts/\n');
  sh(scenario.repo, 'add', '-A');
  sh(scenario.repo, 'commit', '-q', '-m', 'config del gate');
  return scenario.repo;
}

function capture() {
  const out = { stdout: '', stderr: '' };
  return { out, io: { stdout: (text) => (out.stdout += text), stderr: (text) => (out.stderr += text) } };
}

describe('CLI', () => {
  it('verificar sale 2 cuando falta evidencia, 1 cuando algo falla y 0 cuando todo pasa', async () => {
    // 0: todo fresco. Los registros llevan el HEAD de después del commit de config.
    const scenario = passingScenario();
    const repo = cliRepo(scenario);
    const head = sh(repo, 'rev-parse', 'HEAD');
    writeEvidence(scenario.root, '90', ROUTES[90], { commitSha: head });
    writePremium(scenario.root, '90', { commitSha: head });
    for (const name of ['typecheck', 'lint-dirigido', 'build']) writeRecord(scenario.root, name, { command: name, commit: head });
    writeRecord(scenario.root, 'specs-dirigidos', { command: 'specs', commit: head, summary: VITEST(3, 0) });
    writeRecord(scenario.root, 'suite', { command: 'suite', commit: head, summary: VITEST(10, 0) });
    writeRecord(scenario.root, 'suite-base', { command: 'suite', commit: scenario.first, summary: VITEST(10, 0) });
    writeRecord(scenario.root, 'route-health', { command: 'rh', commit: head, summary: PLAYWRIGHT(4) });
    writeRecord(scenario.root, 'mutacion', { command: 'mut', commit: head, backend: 'real', summary: PLAYWRIGHT(1) }, '90');
    write(join(scenario.root, 'lane-90', 'REVISION.json'), JSON.stringify({ version: 1, lane: '90', reviewer: 'Reviewer Two', verdict: 'APROBADO', since: scenario.first, commit: head, dirty: [], at: new Date().toISOString() }));
    const ok = capture();
    assert.equal(await main(['--carril', '90'], { repo, io: ok.io }), 0, ok.out.stdout);
    assert.match(ok.out.stdout, /Carril 90 · Pantalla A {2}→ {2}PASA/);

    const failing = capture();
    writeRecord(scenario.root, 'typecheck', { command: 'typecheck', commit: head, exit: 2 });
    assert.equal(await main(['--carril', '90'], { repo, io: failing.io }), 1);
    assert.match(failing.out.stdout, /FALLA {2}regresion\.typecheck/);

    const missing = capture();
    rmSync(join(scenario.root, 'lane-90'), { recursive: true });
    rmSync(join(scenario.root, 'registros', 'typecheck.json'));
    assert.equal(await main(['--carril', '90'], { repo, io: missing.io }), 2);
  });

  it('el ejecutable real termina con el código del veredicto', () => {
    const run = spawnSync(process.execPath, [join(REPO_ROOT, 'scripts/check-correcciones.mjs'), '--carril', '99'], { encoding: 'utf8' });
    assert.equal(run.status, 64);
    assert.match(run.stderr, /carril desconocido: 99/);
  });

  it('--json emite los reportes', async () => {
    const scenario = passingScenario();
    const repo = cliRepo(scenario);
    const { out, io } = capture();
    await main(['--carril', '90', '--json'], { repo, io });
    const parsed = JSON.parse(out.stdout);
    assert.equal(parsed.reports[0].lane, '90');
    assert.ok(Array.isArray(parsed.reports[0].criteria));
  });

  it('registrar corre el comando, deja el registro con exit, commit y resumen, y devuelve el exit del comando', async () => {
    const scenario = passingScenario();
    const repo = cliRepo(scenario);
    const { out, io } = capture();
    const code = await main(['registrar', 'specs-dirigidos', '--carril', '90', '--', process.execPath, '-e', "console.log('      Tests  3 passed (3)')"], { repo, io });
    assert.equal(code, 0);
    const record = JSON.parse(readFileSync(join(repo, 'artifacts/evidencia/correcciones/lane-90/registros/specs-dirigidos.json'), 'utf8'));
    assert.equal(record.exit, 0);
    assert.equal(record.commit, sh(repo, 'rev-parse', 'HEAD'));
    assert.equal(record.summary.kind, 'vitest');
    assert.equal(record.summary.tests.passed, 3);
    assert.match(out.stdout, /3 passed/);
  });

  it('registrar conserva un comando rojo: el exit queda en el registro y se propaga', async () => {
    const scenario = passingScenario();
    const repo = cliRepo(scenario);
    const { io } = capture();
    const code = await main(['registrar', 'typecheck', '--', process.execPath, '-e', 'process.exit(3)'], { repo, io });
    assert.equal(code, 3);
    const record = JSON.parse(readFileSync(join(repo, 'artifacts/evidencia/correcciones/registros/typecheck.json'), 'utf8'));
    assert.equal(record.exit, 3);
  });

  it('registrar anota los archivos versionados sin confirmar', async () => {
    const scenario = passingScenario();
    const repo = cliRepo(scenario);
    write(join(repo, 'src/app/features/a/a.ts'), 'export const a = 99;\n');
    const { io } = capture();
    await main(['registrar', 'build', '--', process.execPath, '-e', '0'], { repo, io });
    const record = JSON.parse(readFileSync(join(repo, 'artifacts/evidencia/correcciones/registros/build.json'), 'utf8'));
    assert.deepEqual(record.dirty, ['src/app/features/a/a.ts']);
  });

  it('un registro hecho con el árbol sucio en el alcance no cuenta como fresco', async () => {
    const scenario = passingScenario();
    const repo = cliRepo(scenario);
    write(join(repo, 'src/app/features/a/a.ts'), 'export const a = 99;\n');
    const { io } = capture();
    await main(['registrar', 'build', '--', process.execPath, '-e', '0'], { repo, io });
    const outcome = run({ ...scenario, repo });
    assert.equal(outcome.state('regresion.build'), STATE.FAIL);
    assert.match(outcome.detail('regresion.build'), /sin confirmar/);
  });

  it('revisar escribe REVISION.json y valida sus argumentos', async () => {
    const scenario = passingScenario();
    const repo = cliRepo(scenario);
    const bad = capture();
    assert.equal(await main(['revisar', '90', '--revisor', 'Ana'], { repo, io: bad.io }), 64);
    const worse = capture();
    assert.equal(await main(['revisar', '90', '--revisor', 'Ana', '--veredicto', 'TAL VEZ', '--desde', scenario.first], { repo, io: worse.io }), 64);
    const good = capture();
    assert.equal(await main(['revisar', '90', '--revisor', 'Ana', '--veredicto', 'RECHAZADO', '--desde', scenario.first, '--notas', 'no'], { repo, io: good.io }), 0);
    const review = JSON.parse(readFileSync(join(repo, 'artifacts/evidencia/correcciones/lane-90/REVISION.json'), 'utf8'));
    assert.equal(review.verdict, 'RECHAZADO');
    assert.equal(review.reviewer, 'Ana');
  });

  it('criterios lista cada criterio con su fuente', async () => {
    const { out, io } = capture();
    assert.equal(await main(['criterios'], { repo: REPO_ROOT, io }), 0);
    assert.match(out.stdout, /frescura\.commit/);
    assert.match(out.stdout, /fuente: /);
  });
});
