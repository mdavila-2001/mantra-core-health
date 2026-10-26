/**
 * Gate de cierre de las correcciones 31–40: lectura de la evidencia, criterios y
 * veredicto por carril.
 *
 * Este módulo no ejecuta navegadores ni compila nada: **juzga evidencia ya
 * producida** y la compara contra el árbol de git. Todo lo que toca git entra por
 * un adaptador (`createGit`), así las pruebas pueden usar repositorios
 * descartables y la CLI (`scripts/check-correcciones.mjs`) el real.
 *
 * ## Veredictos
 *
 * - `PASA`           todos los criterios del carril son `OK`.
 * - `FALLA`          al menos un criterio está contradicho por la evidencia
 *                    (celda en rojo, evidencia anterior al código, hash distinto…).
 * - `NO EVALUABLE`   ningún criterio falla, pero falta evidencia para decidir
 *                    alguno (no hay captura, no hay registro de la suite, el
 *                    backend era simulado…). Nunca se redondea a `PASA`.
 *
 * Un criterio es `OK`, `FALLA` o `FALTA`. Regla de oro: lo que no se puede
 * comprobar es `FALTA`, no `OK`.
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const STATE = Object.freeze({ OK: 'OK', FAIL: 'FALLA', MISSING: 'FALTA' });
export const VERDICT = Object.freeze({ PASS: 'PASA', FAIL: 'FALLA', NOT_EVALUABLE: 'NO EVALUABLE' });

/** Las cuatro celdas que mide `corr-evidencia.spec.ts` por ruta. */
export function expectedCellKinds(config) {
  return [
    ...config.viewportsClaros.map((viewport) => ({ viewport, theme: 'claro' })),
    { viewport: config.viewportOscuro, theme: 'oscuro' },
  ];
}

/**
 * Los criterios, con la fuente de cada uno. `scripts/check-correcciones.mjs --criterios`
 * y `docs/testing/gate-correcciones.md` salen de esta tabla.
 */
export const CRITERIA = Object.freeze([
  { id: 'evidencia.presente', title: 'Hay matriz «después» del carril', source: 'CLAUDE.md (NO_EVIDENCE_NO_DONE); PLAN-31 L19' },
  { id: 'evidencia.fase', title: 'La matriz es de la fase «después» y del carril pedido', source: 'Playbook §46-48 (no reutilizar capturas viejas); REPORT 31 L21' },
  { id: 'arnes.soporta', title: 'El arnés de medición entiende todo lo que declara corr-rutas.json', source: 'Hallazgo de la sincronización dev↔mockup: rutas con `esperado: redirige` medidas con un arnés que no las conoce' },
  { id: 'inventario.vigente', title: 'corr-rutas.json coincide con el mapa de navegación', source: 'REPORT 34 L14-19 (el inventario por rol se regenera con scripts/corr-rutas.mjs)' },
  { id: 'cobertura.celdas', title: 'Están todas las celdas ruta × ancho × tema y la matriz no fue retocada', source: 'REPORT 34 L45-48 (cada celda: 375/768/1440 claro y 1440 oscuro)' },
  { id: 'cobertura.tema-oscuro', title: 'Cada ruta tiene su celda en tema oscuro', source: 'REPORT 34 L45; REPORT 35 L17 (el auditor fija el tema persistido)' },
  { id: 'medicion.verde', title: 'Ninguna celda en rojo (fondo, centrado, ancho, scroll) y el recuento cierra', source: 'MATRIZ 31 L3 (Celdas / en rojo); composition-rules.md §5' },
  { id: 'medicion.consola', title: 'Consola, page errors y respuestas 5xx limpias', source: 'Playbook §1.4; REPORT 33 L44' },
  { id: 'fotos.integras', title: 'Las fotos existen, pesan lo mínimo y coinciden con su hash', source: 'corr-evidencia.spec.ts FOTO_MIN_BYTES («una foto en blanco es peor que ninguna»)' },
  { id: 'frescura.commit', title: 'La medición es posterior al último cambio de código del carril', source: 'Playbook §46-48; REPORT 34 L71-73 (#1165 entró después de la medición y no se remidió)' },
  { id: 'build.servido', title: 'El build servido durante la medición es el commit medido', source: 'core/mock/mock-store.ts (el sello de sessionStorage es buildInfo.commit)' },
  { id: 'acabado.premium', title: 'Acabado premium (nombre accesible, globo, foco, target, tipografía, movimiento) sin rojos ni hallazgos', source: 'docs/qa/premium-visual/ejecucion.md §6 (`premium-visual.sh 34` en el cierre)' },
  { id: 'regresion.typecheck', title: 'typecheck sin errores, sobre el código de hoy', source: 'PLAN-31 L19; frontend-production-gate' },
  { id: 'regresion.lint-dirigido', title: 'eslint sobre lo tocado sin errores', source: 'PLAN-33 L18; REPORT 33 L15' },
  { id: 'regresion.specs-dirigidos', title: 'Specs dirigidos del carril en verde (y que corrieron alguno)', source: 'PLAN-31 L19; REPORT 39 L38' },
  { id: 'regresion.build', title: 'build sin errores', source: 'REPORT 33 L41; REPORT 32 L30' },
  { id: 'regresion.suite', title: 'Suite completa sin rojos nuevos respecto de la base', source: 'PLAN-31 L37 («sin nuevos rojos»); REPORT 35 L50 (74→76 no se declara aprobada)' },
  { id: 'regresion.route-health', title: 'route-health corrido de verdad (API viva)', source: 'PLAN-31 L37; REPORT 36 L42 (bloqueado por apiViva=false)' },
  { id: 'mutacion.cadena', title: 'Las escrituras se demostraron contra API real: UI → request → response → persistencia → recarga → UI', source: 'CLAUDE.md; Playbook §41 (sin API real el techo es TESTED)' },
  { id: 'revision.independiente', title: 'Revisión APROBADA, sin P0/P1/P2 abiertos, por alguien que no escribió el código del carril', source: 'CLAUDE.md (NO_SELF_APPROVAL); docs/qa/premium-visual/ejecucion.md §5; REPORT 38 L68, L79' },
  { id: 'coherencia.entre-carriles', title: 'Dos carriles no exigen cosas opuestas sobre la misma pantalla', source: 'REPORT 34 L74-76 vs REPORT 36 L16, L76 (fondo de /my-account/identity en oscuro)' },
]);

const CRITERIA_BY_ID = new Map(CRITERIA.map((criterion) => [criterion.id, criterion]));

function result(id, state, details = []) {
  const criterion = CRITERIA_BY_ID.get(id);
  return { id, title: criterion?.title ?? id, state, details: Array.isArray(details) ? details : [details] };
}

const SEVERITY = { [STATE.OK]: 0, [STATE.MISSING]: 1, [STATE.FAIL]: 2 };

/** El peor de varios estados: FALLA > FALTA > OK. */
export function worstState(states) {
  return states.reduce((worst, state) => (SEVERITY[state] > SEVERITY[worst] ? state : worst), STATE.OK);
}

export function verdictOf(criteria) {
  const worst = worstState(criteria.map((criterion) => criterion.state));
  if (worst === STATE.FAIL) return VERDICT.FAIL;
  if (worst === STATE.MISSING) return VERDICT.NOT_EVALUABLE;
  return VERDICT.PASS;
}

function limit(list, max = 6) {
  return list.length <= max ? list.join(', ') : `${list.slice(0, max).join(', ')} … y ${list.length - max} más`;
}

export function stripAnsi(text) {
  return text.replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, '');
}

/* ----------------------------------------------------------------------------
 * Matriz en markdown (la que escribe corr-evidencia.spec.ts)
 * ------------------------------------------------------------------------- */

const ROW =
  /^\| `(.+?)` \| (\d+) \| (claro|oscuro) \| (.*?) \| (.*?) \| (.*?) \| (.*?) \| (.*?) \| `(.+?)` \|\s*$/;

export function parseMatrix(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const header = /^# MATRIZ visual — carril (\S+) — (\S+) — (\S+)\s*$/.exec(lines[0] ?? '');
  const declared = /^Celdas: (\d+) · en rojo: (\d+)\s*$/m.exec(text);
  const rows = [];
  for (const line of lines) {
    const match = ROW.exec(line);
    if (!match) continue;
    const [, route, viewport, theme, background, centering, width, scroll, consoleCol, photo] = match;
    const name = /([^/]+?)-\d+-(?:claro|oscuro)\.png$/.exec(photo)?.[1] ?? null;
    rows.push({ route, viewport, theme, background, centering, width, scroll, console: consoleCol, photo, name, line });
  }
  const errorsAt = lines.findIndex((line) => line.trim() === '## Errores');
  const errors =
    errorsAt === -1
      ? null
      : lines
          .slice(errorsAt + 1)
          .filter((line) => line.startsWith('- '))
          .map((line) => line.slice(2).trim())
          .filter((line) => line !== 'ninguno');
  return {
    lane: header?.[1] ?? null,
    phase: header?.[2] ?? null,
    generatedAt: header?.[3] ?? null,
    declaredCells: declared ? Number(declared[1]) : null,
    declaredRed: declared ? Number(declared[2]) : null,
    rows,
    errors,
  };
}

const RED = /^(FAIL|SIN CARGAR)/;

export function rowIsRed(row) {
  return [row.background, row.centering, row.width, row.scroll, row.console].some((cell) => RED.test(cell.trim()));
}

export function cellKey(name, viewport, theme) {
  return `${name}|${viewport}|${theme}`;
}

export function expectedCells(routes, config) {
  const kinds = expectedCellKinds(config);
  return routes.flatMap((entry) =>
    kinds.map((kind) => ({
      key: cellKey(entry.nombre, kind.viewport, kind.theme),
      name: entry.nombre,
      route: entry.ruta,
      expected: entry.esperado ?? 'pantalla',
      ...kind,
    })),
  );
}

/**
 * Qué regla de fondo se aplicó a una celda en oscuro: `white` (el fondo tiene
 * que ser blanco también en oscuro) o `dark` (tiene que conservar la superficie
 * oscura). `null` si la celda no mide fondo.
 */
export function backgroundRuleOf(cell) {
  if (cell.theme !== 'oscuro') return null;
  if (typeof cell.requiresWhiteBackground === 'boolean') return cell.requiresWhiteBackground ? 'white' : 'dark';
  const text = (cell.background ?? '').trim();
  if (text === 'PASS (oscuro conservado)' || text.startsWith('FAIL (se perdió la superficie oscura)')) return 'dark';
  if (text === 'PASS' || /^FAIL \(.*rgb/.test(text)) return 'white';
  return null;
}

/* ----------------------------------------------------------------------------
 * Salida de comandos (vitest, playwright)
 * ------------------------------------------------------------------------- */

function countsOf(line) {
  const counts = {};
  for (const [, n, what] of line.matchAll(/(\d+)\s+(failed|passed|skipped|todo|did not run|flaky)/g)) {
    counts[what] = (counts[what] ?? 0) + Number(n);
  }
  return counts;
}

/**
 * Lee el resumen de una corrida. Devuelve `null` si no reconoce ninguno: un
 * resumen que no se puede leer no se inventa.
 */
export function parseRunSummary(output) {
  const text = stripAnsi(output);
  const files = /^\s*Test Files\s+(.*)$/m.exec(text);
  const tests = /^\s*Tests\s+(.*)$/m.exec(text);
  if (tests) {
    const failedFiles = new Set(
      [...text.matchAll(/^\s*(?:FAIL|×|❯)\s+(\S+\.spec\.ts)/gm)].map((match) => match[1]),
    );
    const testCounts = countsOf(tests[1]);
    return {
      kind: 'vitest',
      files: files ? countsOf(files[1]) : null,
      tests: { passed: testCounts.passed ?? 0, failed: testCounts.failed ?? 0, skipped: testCounts.skipped ?? 0 },
      failedFiles: [...failedFiles].sort(),
    };
  }
  const playwright = [...text.matchAll(/^\s+(\d+)\s+(passed|failed|skipped|did not run|flaky)\b/gm)];
  if (playwright.length > 0) {
    const counts = {};
    for (const [, n, what] of playwright) counts[what] = (counts[what] ?? 0) + Number(n);
    return {
      kind: 'playwright',
      tests: {
        passed: counts.passed ?? 0,
        failed: counts.failed ?? 0,
        skipped: counts.skipped ?? 0,
        didNotRun: counts['did not run'] ?? 0,
      },
    };
  }
  return null;
}

/* ----------------------------------------------------------------------------
 * git
 * ------------------------------------------------------------------------- */

export function createGit(cwd, ref = 'HEAD') {
  // `raw` conserva los espacios iniciales: `git status --porcelain` empieza con « M ».
  const run = (args, { raw = false } = {}) => {
    try {
      const output = execFileSync('git', args, {
        cwd,
        encoding: 'utf8',
        maxBuffer: 256 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      return raw ? output : output.trim();
    } catch {
      return null;
    }
  };
  return {
    ref,
    head: () => run(['rev-parse', '--verify', `${ref}^{commit}`]),
    resolve: (rev) => run(['rev-parse', '--verify', `${rev}^{commit}`]),
    exists: (sha) => typeof sha === 'string' && /^[0-9a-f]{7,40}$/.test(sha) && run(['cat-file', '-e', `${sha}^{commit}`]) !== null,
    isAncestor: (ancestor, descendant) => run(['merge-base', '--is-ancestor', ancestor, descendant]) !== null,
    lastCommit: (pathspecs) => run(['log', '-1', '--format=%H', ref, '--', ...pathspecs]) || null,
    info: (sha) => {
      const out = run(['log', '-1', '--format=%H%x1f%cI%x1f%an%x1f%s', sha]);
      if (!out) return null;
      const [full, date, author, subject] = out.split('\u001f');
      return { sha: full, date, author, subject };
    },
    filesInScope: (pathspecs) => new Set((run(['ls-files', '-z', '--', ...pathspecs]) ?? '').split('\0').filter(Boolean)),
    authors: (from, to, pathspecs) =>
      [...new Set((run(['log', '--format=%an%x1f%ae', `${from}..${to}`, '--', ...pathspecs]) ?? '').split('\n').filter(Boolean))],
    dirtyTracked: () =>
      (run(['status', '--porcelain', '--untracked-files=no'], { raw: true }) ?? '')
        .split('\n')
        .filter(Boolean)
        .map((line) => line.slice(3).trim()),
  };
}

/**
 * El alcance de un carril: lo común más lo propio, sin lo que no cambia lo que se
 * ve. `withHarness` suma el arnés de medición (spec y lista de rutas): cambia lo
 * que una *medición visual* quiere decir, pero no invalida un `typecheck` o una
 * suite que corrieron sobre el producto.
 */
export function scopeOf(config, laneId, { withHarness = false } = {}) {
  const lane = config.carriles[laneId];
  const paths = [...config.comunes.codigo, ...lane.codigo, ...(withHarness ? (config.comunes.arnes ?? []) : [])];
  return [...new Set(paths), ...config.comunes.excluir];
}

function short(sha) {
  return typeof sha === 'string' ? sha.slice(0, 9) : String(sha);
}

/**
 * ¿La medición (o el registro) es posterior al último cambio de código del
 * carril? Con commit se compara por ascendencia; sin commit sólo se puede
 * *refutar* por fecha, nunca aprobar.
 */
export function judgeFreshness({ commit, generatedAt, dirty = [], scope, git, what }) {
  const last = git.lastCommit(scope);
  if (!last) return { state: STATE.OK, details: [`${what}: ningún commit toca el alcance del carril`] };
  const lastInfo = git.info(last);
  const lastText = `${short(last)} (${lastInfo?.date ?? 's/f'}, «${lastInfo?.subject ?? ''}»)`;
  if (!commit) {
    const measuredAt = generatedAt ? Date.parse(generatedAt) : Number.NaN;
    if (Number.isNaN(measuredAt)) {
      return { state: STATE.MISSING, details: [`${what}: sin commit ni fecha legible; no es comparable con el código`] };
    }
    if (lastInfo && Date.parse(lastInfo.date) > measuredAt) {
      return {
        state: STATE.FAIL,
        details: [`${what} del ${generatedAt} es anterior al último cambio de código del carril: ${lastText}`],
      };
    }
    return {
      state: STATE.MISSING,
      details: [`${what} no declara el commit medido (evidencia heredada): la fecha no alcanza para compararla con el código`],
    };
  }
  if (!git.exists(commit)) {
    return { state: STATE.FAIL, details: [`${what}: el commit medido ${short(commit)} no existe en este repositorio`] };
  }
  if (!git.isAncestor(last, commit)) {
    return {
      state: STATE.FAIL,
      details: [`${what} se hizo sobre ${short(commit)}, pero el código del carril cambió después en ${lastText}`],
    };
  }
  if (dirty.length > 0) {
    const inScope = git.filesInScope(scope);
    const touched = dirty.filter((file) => inScope.has(file));
    if (touched.length > 0) {
      return {
        state: STATE.FAIL,
        details: [`${what} se hizo con cambios sin confirmar en el alcance del carril: ${limit(touched, 4)}`],
      };
    }
  }
  return { state: STATE.OK, details: [`${what} sobre ${short(commit)}; último cambio de código ${lastText}`] };
}

/* ----------------------------------------------------------------------------
 * Evidencia visual de un actor
 * ------------------------------------------------------------------------- */

function readJson(path) {
  try {
    return { value: JSON.parse(readFileSync(path, 'utf8')) };
  } catch (error) {
    return { error: error.message };
  }
}

export function actorDirectory(root, laneId, actor) {
  return actor === 'medica' ? join(root, `lane-${laneId}`) : join(root, `lane-${laneId}`, actor);
}

export function readActorEvidence(root, laneId, actor) {
  const dir = actorDirectory(root, laneId, actor);
  const matrixPath = join(dir, 'MATRIZ-visual.md');
  const manifestPath = join(dir, 'MANIFIESTO.json');
  const matrixText = existsSync(matrixPath) ? readFileSync(matrixPath, 'utf8') : null;
  const manifestRead = existsSync(manifestPath) ? readJson(manifestPath) : null;
  if (manifestRead?.value && !Array.isArray(manifestRead.value.cells)) {
    return { actor, dir, matrixPath, matrix: matrixText === null ? null : parseMatrix(matrixText), manifest: null, manifestError: 'no trae el arreglo «cells»' };
  }
  return {
    actor,
    dir,
    matrixPath,
    matrix: matrixText === null ? null : parseMatrix(matrixText),
    manifest: manifestRead?.value ?? null,
    manifestError: manifestRead?.error ?? null,
  };
}

const VISUAL_IDS = [
  'evidencia.fase',
  'cobertura.celdas',
  'cobertura.tema-oscuro',
  'medicion.verde',
  'medicion.consola',
  'fotos.integras',
  'frescura.commit',
  'build.servido',
];

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function evaluateActor({ laneId, evidence, routes, config, scope, git }) {
  // `scope` ya incluye el arnés de medición: ver evaluateLane.
  const out = new Map();
  const set = (id, state, details) => out.set(id, result(id, state, details));

  if (!evidence.matrix) {
    set('evidencia.presente', STATE.MISSING, [`no existe ${evidence.matrixPath}`]);
    for (const id of VISUAL_IDS) set(id, STATE.MISSING, ['sin matriz no hay nada que juzgar']);
    return out;
  }
  const { matrix, manifest } = evidence;
  set('evidencia.presente', STATE.OK, [`${matrix.rows.length} filas en ${evidence.matrixPath}`]);

  // --- fase y carril
  const phaseProblems = [];
  if (matrix.phase !== 'despues') phaseProblems.push(`la matriz es de la fase «${matrix.phase}», no «despues»`);
  if (matrix.lane !== laneId) phaseProblems.push(`la matriz dice carril ${matrix.lane}, no ${laneId}`);
  if (evidence.manifestError) phaseProblems.push(`MANIFIESTO.json ilegible: ${evidence.manifestError}`);
  if (manifest && manifest.phase !== 'despues') phaseProblems.push(`el manifiesto es de la fase «${manifest.phase}»`);
  if (manifest && String(manifest.lane) !== laneId) phaseProblems.push(`el manifiesto es del carril ${manifest.lane}`);
  set('evidencia.fase', phaseProblems.length ? STATE.FAIL : STATE.OK, phaseProblems.length ? phaseProblems : ['fase «despues»']);

  // --- cobertura
  const expected = expectedCells(routes, config);
  const present = new Set(matrix.rows.filter((row) => row.name).map((row) => cellKey(row.name, row.viewport, row.theme)));
  const missing = expected.filter((cell) => !present.has(cell.key));
  const expectedKeys = new Set(expected.map((cell) => cell.key));
  const extra = [...present].filter((key) => !expectedKeys.has(key));
  const coverage = [];
  if (missing.length > 0) {
    coverage.push(
      `faltan ${missing.length} de ${expected.length} celdas: ${limit(missing.map((cell) => `${cell.route} ${cell.viewport}/${cell.theme}`))}`,
    );
  }
  if (matrix.declaredCells !== matrix.rows.length) {
    coverage.push(`la cabecera declara ${matrix.declaredCells} celdas y la tabla trae ${matrix.rows.length}`);
  }
  if (manifest) {
    const manifestKeys = new Set(manifest.cells.map((cell) => cellKey(cell.name, cell.viewport, cell.theme)));
    const onlyMatrix = [...present].filter((key) => !manifestKeys.has(key));
    const onlyManifest = [...manifestKeys].filter((key) => !present.has(key));
    if (onlyMatrix.length || onlyManifest.length) {
      coverage.push(`la matriz y el manifiesto no listan las mismas celdas (solo matriz: ${onlyMatrix.length}, solo manifiesto: ${onlyManifest.length})`);
    }
    const rowByKey = new Map(matrix.rows.map((row) => [cellKey(row.name, row.viewport, row.theme), row.line]));
    const edited = manifest.cells.filter((cell) => {
      const line = rowByKey.get(cellKey(cell.name, cell.viewport, cell.theme));
      return line !== undefined && line.trim() !== String(cell.row).trim();
    });
    if (edited.length > 0) {
      coverage.push(`${edited.length} filas de la matriz no coinciden con el manifiesto (retocadas a mano): ${limit(edited.map((cell) => `${cell.route} ${cell.viewport}/${cell.theme}`), 3)}`);
    }
  }
  const coverageDetails = coverage.length
    ? coverage
    : [`${expected.length} celdas esperadas, todas presentes${extra.length ? ` (+${extra.length} fuera del inventario vigente)` : ''}`];
  set('cobertura.celdas', coverage.length ? STATE.FAIL : STATE.OK, coverageDetails);

  // --- tema oscuro
  const darkMissing = expected.filter((cell) => cell.theme === 'oscuro' && !present.has(cell.key));
  const darkMeasured = matrix.rows.filter((row) => row.theme === 'oscuro').length;
  set(
    'cobertura.tema-oscuro',
    darkMissing.length || darkMeasured === 0 ? STATE.FAIL : STATE.OK,
    darkMissing.length || darkMeasured === 0
      ? [`tema oscuro ausente en ${darkMissing.length} rutas: ${limit(darkMissing.map((cell) => cell.route))}`]
      : [`${darkMeasured} celdas en oscuro`],
  );

  // --- medición
  const red = matrix.rows.filter(rowIsRed);
  const redProblems = [];
  if (red.length > 0) redProblems.push(`${red.length} celdas en rojo: ${limit(red.map((row) => `${row.route} ${row.viewport}/${row.theme}`), 4)}`);
  if (matrix.declaredRed !== red.length) redProblems.push(`la cabecera declara ${matrix.declaredRed} rojas y la tabla tiene ${red.length}`);
  if (manifest) {
    const manifestRed = manifest.cells.filter((cell) => !cell.ok);
    if (manifestRed.length !== red.length) redProblems.push(`el manifiesto marca ${manifestRed.length} celdas en rojo`);
  }
  set('medicion.verde', redProblems.length ? STATE.FAIL : STATE.OK, redProblems.length ? redProblems : [`${matrix.rows.length} celdas, 0 rojas`]);

  const consoleProblems = [];
  const consoleRows = matrix.rows.filter((row) => /^FAIL/.test(row.console.trim()));
  if (consoleRows.length > 0) consoleProblems.push(`consola en rojo en ${consoleRows.length} celdas: ${limit(consoleRows.map((row) => `${row.route} ${row.viewport}/${row.theme}`), 4)}`);
  if (matrix.errors === null) consoleProblems.push('la matriz no trae la sección «## Errores»');
  else if (matrix.errors.length > 0) consoleProblems.push(`la matriz lista ${matrix.errors.length} errores: ${limit(matrix.errors, 3)}`);
  if (manifest) {
    const withErrors = manifest.cells.filter((cell) => cell.consoleErrors?.length > 0);
    if (withErrors.length > 0) consoleProblems.push(`${withErrors.length} celdas con errores de consola en el manifiesto`);
  }
  set('medicion.consola', consoleProblems.length ? STATE.FAIL : STATE.OK, consoleProblems.length ? consoleProblems : ['sin errores de consola ni 5xx']);

  // --- fotos
  const photoRows = manifest
    ? manifest.cells.map((cell) => ({ photo: cell.photo, expected: cell.expected, sha: cell.photoSha256, label: `${cell.route} ${cell.viewport}/${cell.theme}` }))
    : matrix.rows.map((row) => ({ photo: row.photo, expected: null, bytes: null, sha: null, label: `${row.route} ${row.viewport}/${row.theme}` }));
  const absent = [];
  const tiny = [];
  const altered = [];
  for (const row of photoRows) {
    const path = join(evidence.dir, row.photo);
    if (!existsSync(path)) {
      absent.push(row.label);
      continue;
    }
    const size = statSync(path).size;
    const gone = row.expected === 'no-encontrado';
    if (size < config.umbrales.fotoMinBytes && !gone) tiny.push(row.label);
    if (row.sha && sha256(path) !== row.sha) altered.push(row.label);
  }
  if (altered.length || tiny.length) {
    set('fotos.integras', STATE.FAIL, [
      ...(altered.length ? [`${altered.length} fotos no coinciden con su hash: ${limit(altered, 3)}`] : []),
      ...(tiny.length ? [`${tiny.length} fotos por debajo de ${config.umbrales.fotoMinBytes} B: ${limit(tiny, 3)}`] : []),
    ]);
  } else if (absent.length) {
    set('fotos.integras', STATE.MISSING, [`${absent.length} de ${photoRows.length} fotos no están en disco (${evidence.dir}/fotos/despues)`]);
  } else {
    set('fotos.integras', STATE.OK, [`${photoRows.length} fotos íntegras${manifest ? ' (hash verificado)' : ' (sin manifiesto: solo existencia y tamaño)'}`]);
  }

  // --- frescura y build servido
  const fresh = judgeFreshness({
    commit: manifest?.commit,
    generatedAt: manifest?.generatedAt ?? matrix.generatedAt,
    dirty: manifest?.dirty ?? [],
    scope,
    git,
    what: 'la medición',
  });
  set('frescura.commit', fresh.state, fresh.details);

  if (!manifest) {
    set('build.servido', STATE.MISSING, ['sin manifiesto no se sabe qué build servía el puerto']);
  } else if (!manifest.servedBuilds || manifest.servedBuilds.length === 0) {
    set('build.servido', STATE.MISSING, ['no se pudo leer el sello de build de la maqueta durante la medición']);
  } else {
    const wrong = manifest.servedBuilds.filter((build) => !(manifest.commit.startsWith(build) || build.startsWith(manifest.commit)));
    set(
      'build.servido',
      wrong.length ? STATE.FAIL : STATE.OK,
      wrong.length
        ? [`el puerto servía el build ${wrong.join(', ')} y se midió el árbol ${short(manifest.commit)}: dist viejo`]
        : [`el build servido (${manifest.servedBuilds.join(', ')}) es el árbol medido`],
    );
  }
  return out;
}

function mergeActorResults(perActor) {
  const merged = new Map();
  const ids = new Set(perActor.flatMap(({ results }) => [...results.keys()]));
  for (const id of ids) {
    const parts = perActor.map(({ actor, results }) => ({ actor, res: results.get(id) })).filter((part) => part.res);
    const state = worstState(parts.map((part) => part.res.state));
    const multiple = perActor.length > 1;
    if (multiple && parts.every((part) => part.res.state === state && JSON.stringify(part.res.details) === JSON.stringify(parts[0].res.details))) {
      merged.set(id, { id, title: parts[0].res.title, state, details: parts[0].res.details });
      continue;
    }
    const details = parts.flatMap(({ actor, res }) => {
      // Con varios actores, sólo se detallan los que no están en OK (más un resumen).
      if (multiple && res.state === STATE.OK && state !== STATE.OK) return [];
      return res.details.map((detail) => (multiple ? `[${actor}] ${detail}` : detail));
    });
    merged.set(id, { id, title: parts[0].res.title, state, details });
  }
  return merged;
}

/* ----------------------------------------------------------------------------
 * Arnés, regresión, mutación, revisión, coherencia
 * ------------------------------------------------------------------------- */

/** Qué usa corr-rutas.json que el spec tiene que saber manejar. */
export function harnessGaps(routeEntries, specText) {
  const needs = new Map();
  for (const entry of routeEntries) {
    if (entry.esperado && entry.esperado !== 'pantalla') needs.set(`esperado: ${entry.esperado}`, `'${entry.esperado}'`);
    if (entry.fixture) needs.set(`fixture: ${entry.fixture}`, `'${entry.fixture}'`);
    if (entry.accion) needs.set(`accion: ${entry.accion}`, `'${entry.accion}'`);
    if (entry.destino) needs.set('destino', 'destino');
  }
  return [...needs].filter(([, token]) => !specText.includes(token)).map(([label]) => label);
}

function readRecord(root, laneId, name) {
  for (const path of [join(root, `lane-${laneId}`, 'registros', `${name}.json`), join(root, 'registros', `${name}.json`)]) {
    if (existsSync(path)) {
      const read = readJson(path);
      return { path, record: read.value ?? null, error: read.error ?? null };
    }
  }
  return null;
}

const INTERRUPTED = new Set([137, 143, 130]);

function judgeRecord({ id, name, found, scope, git, extra }) {
  if (!found) return result(id, STATE.MISSING, [`no hay registro «${name}» (node scripts/check-correcciones.mjs registrar ${name} -- <comando>)`]);
  if (!found.record) return result(id, STATE.FAIL, [`${found.path} ilegible: ${found.error}`]);
  const { record } = found;
  if (INTERRUPTED.has(record.exit)) {
    return result(id, STATE.MISSING, [`«${record.command}» terminó con ${record.exit} (OOM o señal): no es un fallo del código, hay que repetirlo`]);
  }
  if (record.exit !== 0) return result(id, STATE.FAIL, [`«${record.command}» terminó con código ${record.exit}`]);
  const fresh = judgeFreshness({ commit: record.commit, generatedAt: record.finishedAt, dirty: record.dirty ?? [], scope, git, what: `el registro «${name}»` });
  if (fresh.state !== STATE.OK) return result(id, fresh.state, fresh.details);
  const more = extra ? extra(record) : null;
  if (more) return result(id, more.state, more.details);
  return result(id, STATE.OK, [`«${record.command}» exit 0 sobre ${short(record.commit)}`]);
}

function evaluateRegression({ laneId, root, scope, git, config }) {
  const out = [];
  for (const name of config.regresion.exigidas) {
    const id = `regresion.${name}`;
    const found = readRecord(root, laneId, name);
    if (name === 'specs-dirigidos') {
      out.push(
        judgeRecord({
          id, name, found, scope, git,
          extra: (record) => {
            const summary = record.summary;
            if (!summary) return { state: STATE.MISSING, details: ['no se pudo leer cuántas pruebas corrieron'] };
            if (summary.tests.failed > 0) return { state: STATE.FAIL, details: [`${summary.tests.failed} pruebas fallan`] };
            if (summary.tests.passed === 0) return { state: STATE.FAIL, details: ['exit 0 pero corrieron 0 pruebas: un verde vacío no prueba nada'] };
            return null;
          },
        }),
      );
    } else if (name === 'suite') {
      out.push(judgeSuite({ id, found, base: readRecord(root, laneId, 'suite-base'), scope, git }));
    } else if (name === 'route-health') {
      out.push(
        judgeRecord({
          id, name, found, scope, git,
          extra: (record) => {
            const summary = record.summary;
            if (!summary) return { state: STATE.MISSING, details: ['no se pudo leer el resumen de Playwright'] };
            const { passed, failed, didNotRun } = summary.tests;
            if (failed > 0 || didNotRun > 0) return { state: STATE.FAIL, details: [`${failed} fallan y ${didNotRun} no corrieron (¿API viva?)`] };
            if (passed === 0) return { state: STATE.FAIL, details: ['corrieron 0 pruebas'] };
            return null;
          },
        }),
      );
    } else {
      out.push(judgeRecord({ id, name, found, scope, git }));
    }
  }
  return out;
}

function judgeSuite({ id, found, base, scope, git }) {
  if (!found) return result(id, STATE.MISSING, ['no hay registro «suite» (node scripts/check-correcciones.mjs registrar suite -- <comando>)']);
  if (!found.record) return result(id, STATE.FAIL, [`${found.path} ilegible: ${found.error}`]);
  const { record } = found;
  if (INTERRUPTED.has(record.exit)) {
    return result(id, STATE.MISSING, [`«${record.command}» terminó con ${record.exit} (OOM o señal): no es un fallo del código, hay que repetirlo`]);
  }
  const summary = record.summary;
  if (!summary || summary.kind !== 'vitest') return result(id, STATE.MISSING, ['no se pudo leer el resumen de la suite']);
  // La suite puede tener rojos heredados: lo que importa es no sumar. Un exit
  // distinto de 0 sin ninguna prueba roja, en cambio, es una suite que no terminó.
  if (record.exit !== 0 && summary.tests.failed === 0) {
    return result(id, STATE.FAIL, [`«${record.command}» terminó con código ${record.exit} sin pruebas rojas: la suite no completó`]);
  }
  if (summary.tests.passed === 0) return result(id, STATE.FAIL, ['la suite corrió 0 pruebas']);
  const fresh = judgeFreshness({ commit: record.commit, generatedAt: record.finishedAt, dirty: record.dirty ?? [], scope, git, what: 'la suite' });
  if (fresh.state !== STATE.OK) return result(id, fresh.state, fresh.details);
  if (!base?.record) {
    return result(id, STATE.MISSING, ['no hay registro «suite-base» (la misma suite sobre la base): sin él no se puede decir que no hay rojos nuevos']);
  }
  const baseSummary = base.record.summary;
  if (!baseSummary || baseSummary.kind !== 'vitest') return result(id, STATE.MISSING, ['el registro «suite-base» no tiene resumen legible']);
  if (!git.exists(base.record.commit) || !git.isAncestor(base.record.commit, record.commit)) {
    return result(id, STATE.FAIL, [`«suite-base» (${short(base.record.commit)}) no es ancestro de la suite medida (${short(record.commit)})`]);
  }
  const newFiles = summary.failedFiles.filter((file) => !baseSummary.failedFiles.includes(file));
  const problems = [];
  if (summary.tests.failed > baseSummary.tests.failed) problems.push(`${summary.tests.failed} pruebas rojas contra ${baseSummary.tests.failed} en la base`);
  if (newFiles.length > 0) problems.push(`archivos rojos que la base no tenía: ${limit(newFiles, 4)}`);
  if (problems.length > 0) return result(id, STATE.FAIL, problems);
  return result(id, STATE.OK, [`${summary.tests.failed} rojas contra ${baseSummary.tests.failed} en la base; sin archivos rojos nuevos`]);
}

function evaluatePremium({ laneId, root, scope, git }) {
  const id = 'acabado.premium';
  const dir = join(root, `lane-${laneId}`);
  const matrixPath = join(dir, 'MATRIZ-premium.md');
  const findingsPath = join(dir, 'premium-hallazgos.json');
  const manifestPath = join(dir, 'PREMIUM-MANIFIESTO.json');
  if (!existsSync(matrixPath)) return result(id, STATE.MISSING, [`no existe ${matrixPath} (scripts/premium-visual.sh ${laneId})`]);
  const text = readFileSync(matrixPath, 'utf8');
  const header = /^# MATRIZ de acabado premium — carril (\S+) — (\S+) — (\S+)/.exec(text);
  const counts = /^Celdas: (\d+) · en rojo: (\d+) · hallazgos: (\d+)/m.exec(text);
  const rows = text.split('\n').filter((line) => line.startsWith('| `'));
  const redRows = rows.filter((line) => /\bFAIL\b|SIN CARGAR/.test(line));
  const problems = [];
  if (!header || header[2] !== 'despues') problems.push(`la matriz de acabado es de la fase «${header?.[2] ?? 'desconocida'}»`);
  if (header && header[1] !== laneId) problems.push(`la matriz de acabado es del carril ${header[1]}`);
  if (!counts) problems.push('la matriz de acabado no trae el recuento «Celdas · en rojo · hallazgos»');
  if (counts && Number(counts[2]) !== redRows.length) problems.push(`declara ${counts[2]} rojas y la tabla tiene ${redRows.length}`);
  if (redRows.length > 0) problems.push(`${redRows.length} celdas de acabado en rojo`);
  let findings = null;
  if (existsSync(findingsPath)) {
    const read = readJson(findingsPath);
    if (!Array.isArray(read.value)) problems.push('premium-hallazgos.json ilegible');
    else findings = read.value;
  } else {
    return result(id, STATE.MISSING, [`no existe ${findingsPath}`]);
  }
  if (findings && findings.length > 0) {
    problems.push(`${findings.length} hallazgos: ${limit(findings.map((finding) => `${finding.ruta} ${finding.compuerta}`), 3)}`);
  }
  if (counts && findings && Number(counts[3]) !== findings.length) problems.push(`la matriz declara ${counts[3]} hallazgos y el JSON trae ${findings.length}`);
  if (problems.length > 0) return result(id, STATE.FAIL, problems);
  const manifest = existsSync(manifestPath) ? readJson(manifestPath).value : null;
  const fresh = judgeFreshness({
    commit: manifest?.commit,
    generatedAt: manifest?.generatedAt ?? header?.[3],
    dirty: manifest?.dirty ?? [],
    scope,
    git,
    what: 'la medición de acabado',
  });
  if (fresh.state !== STATE.OK) return result(id, fresh.state, fresh.details);
  return result(id, STATE.OK, [`${rows.length} celdas de acabado, 0 rojas, 0 hallazgos`, ...fresh.details]);
}

function evaluateMutation({ laneId, root, scope, git }) {
  const found = readRecord(root, laneId, 'mutacion');
  if (!found) return result('mutacion.cadena', STATE.MISSING, ['el carril escribe datos y no hay registro «mutacion» (UI → request → response → persistencia → recarga → UI)']);
  const base = judgeRecord({ id: 'mutacion.cadena', name: 'mutacion', found, scope, git });
  if (base.state !== STATE.OK) return base;
  if (found.record.backend !== 'real') {
    return result('mutacion.cadena', STATE.MISSING, [`el registro se hizo contra backend «${found.record.backend ?? 'no declarado'}»: sin API real el techo es TESTED, no VERIFIED`]);
  }
  return base;
}

function evaluateReview({ laneId, root, scope, git }) {
  const path = join(root, `lane-${laneId}`, 'REVISION.json');
  if (!existsSync(path)) return result('revision.independiente', STATE.MISSING, ['no hay REVISION.json (node scripts/check-correcciones.mjs revisar <carril> --revisor … --veredicto … --desde <rev>)']);
  const read = readJson(path);
  if (!read.value) return result('revision.independiente', STATE.FAIL, [`REVISION.json ilegible: ${read.error}`]);
  const review = read.value;
  if (review.verdict === 'RECHAZADO') {
    return result('revision.independiente', STATE.FAIL, [`${review.reviewer} RECHAZÓ el carril sobre ${short(review.commit)}${review.notes ? `: ${review.notes}` : ''}`]);
  }
  if (review.verdict !== 'APROBADO') return result('revision.independiente', STATE.FAIL, [`veredicto «${review.verdict}» no reconocido`]);
  const blocking = (review.open ?? []).filter((severity) => ['P0', 'P1', 'P2'].includes(severity));
  if (blocking.length > 0) {
    return result('revision.independiente', STATE.FAIL, [`aprobada con ${blocking.join(', ')} abiertos: con un P0, P1 o P2 abierto no se cierra el carril`]);
  }
  const fresh = judgeFreshness({ commit: review.commit, generatedAt: review.at, dirty: review.dirty ?? [], scope, git, what: 'la revisión' });
  if (fresh.state !== STATE.OK) return result('revision.independiente', fresh.state, fresh.details);
  if (!git.resolve(review.since)) return result('revision.independiente', STATE.FAIL, [`«${review.since}», el origen del rango de implementadores, no existe`]);
  const authors = git.authors(review.since, review.commit, scope);
  const normalize = (text) => String(text).trim().toLowerCase();
  const reviewer = normalize(review.reviewer);
  const same = authors.filter((entry) => {
    const [name, email = ''] = entry.split('\u001f');
    return normalize(name) === reviewer || normalize(email) === reviewer || normalize(email.split('@')[0]) === reviewer;
  });
  if (same.length > 0) {
    return result('revision.independiente', STATE.FAIL, [`${review.reviewer} escribió commits del carril entre ${review.since} y ${short(review.commit)}: se aprobó a sí mismo`]);
  }
  return result('revision.independiente', STATE.OK, [`${review.reviewer} aprobó ${short(review.commit)}; no figura entre los ${authors.length} autores del alcance`]);
}

/**
 * Lee del spec qué carriles fuerzan fondo blanco en tema oscuro
 * (`const exigeFondoBlanco = LANE === '36' || tema === 'claro'`).
 */
export function whiteInDarkLanes(specText) {
  const expression = /const\s+exigeFondoBlanco\s*=\s*([^;]+);/.exec(specText)?.[1] ?? '';
  return [...expression.matchAll(/LANE\s*===\s*'(\d+)'/g)].map((match) => match[1]);
}

function pathOf(route) {
  return route.split('?')[0].replace(/\/$/, '') || '/';
}

/**
 * Reglas de fondo en oscuro por pantalla (sin query) y quién las exige. La
 * fuente es doble: lo que el arnés *haría* (estática, no necesita evidencia) y lo
 * que la evidencia dice que se midió.
 */
export function collectDarkRules({ config, routesByKey, specText, evidenceByLane }) {
  const rules = new Map();
  const add = (route, rule, lane, origin) => {
    const key = pathOf(route);
    if (!rules.has(key)) rules.set(key, []);
    rules.get(key).push({ rule, lane, origin });
  };
  const whiteLanes = new Set(whiteInDarkLanes(specText));
  for (const [laneId, lane] of Object.entries(config.carriles)) {
    for (const routeKey of Object.values(lane.actores)) {
      for (const entry of routesByKey[routeKey] ?? []) {
        if (entry.esperado === 'redirige' || entry.esperado === 'no-encontrado') continue;
        add(entry.ruta, whiteLanes.has(laneId) ? 'white' : 'dark', laneId, 'arnés');
      }
    }
  }
  for (const [laneId, rows] of Object.entries(evidenceByLane)) {
    for (const row of rows) {
      const rule = backgroundRuleOf(row);
      if (rule) add(row.route, rule, laneId, 'evidencia');
    }
  }
  return rules;
}

export function evaluateCoherence({ laneId, rules, config }) {
  const problems = [];
  for (const [route, entries] of rules) {
    if (!entries.some((entry) => entry.lane === laneId)) continue;
    const distinct = new Set(entries.map((entry) => entry.rule));
    const decision = config.decisiones.find((candidate) => candidate.ruta === route && candidate.tema === 'oscuro');
    const describe = (rule) => {
      const lanes = [...new Set(entries.filter((entry) => entry.rule === rule).map((entry) => `${entry.lane} (${[...new Set(entries.filter((e) => e.rule === rule && e.lane === entry.lane).map((e) => e.origin))].join('+')})`))];
      return `${rule === 'white' ? 'fondo BLANCO' : 'superficie OSCURA'} en oscuro: carril${lanes.length > 1 ? 'es' : ''} ${lanes.join(', ')}`;
    };
    if (decision) {
      const mine = entries.filter((entry) => entry.lane === laneId && entry.rule !== decision.regla);
      if (mine.length > 0) problems.push(`${route} contradice la decisión ${decision.id ?? ''} (${decision.fuente ?? 'sin fuente'}): exige ${mine[0].rule}`);
    } else if (distinct.size > 1) {
      problems.push(`${route}: ${[...distinct].sort().map(describe).join(' ↔ ')}; no hay decisión registrada`);
    }
  }
  return result('coherencia.entre-carriles', problems.length ? STATE.FAIL : STATE.OK, problems.length ? problems : ['sin reglas opuestas sobre las mismas pantallas']);
}

/* ----------------------------------------------------------------------------
 * Un carril, completo
 * ------------------------------------------------------------------------- */

export function evaluateLane({ laneId, config, routesByKey, root, git, specText, inventoryCheck, rules }) {
  const lane = config.carriles[laneId];
  const scope = scopeOf(config, laneId);
  const visualScope = scopeOf(config, laneId, { withHarness: true });
  const criteria = new Map();

  const actors = Object.entries(lane.actores).map(([actor, routeKey]) => ({ actor, routeKey, routes: routesByKey[routeKey] ?? [] }));

  const harness = harnessGaps(actors.flatMap(({ routes }) => routes), specText);
  criteria.set(
    'arnes.soporta',
    result('arnes.soporta', harness.length ? STATE.MISSING : STATE.OK, harness.length ? [`playwright/corr-evidencia.spec.ts no implementa lo que corr-rutas.json declara para este carril: ${harness.join(', ')}`] : ['el spec maneja todo lo que declara corr-rutas.json']),
  );

  if (lane.inventarioGenerado) {
    const check = inventoryCheck();
    criteria.set('inventario.vigente', result('inventario.vigente', check.ok ? STATE.OK : STATE.FAIL, [check.detail]));
  }

  const perActor = actors.map(({ actor, routes }) => {
    const evidence = readActorEvidence(root, laneId, actor);
    if (routes.length === 0) {
      return { actor, results: new Map([['evidencia.presente', result('evidencia.presente', STATE.FAIL, [`corr-rutas.json no tiene rutas para ${actor}`])]]) };
    }
    return { actor, evidence, results: evaluateActor({ laneId, evidence, routes, config, scope: visualScope, git }) };
  });
  const merged = mergeActorResults(perActor);
  for (const [id, value] of merged) criteria.set(id, value);

  for (const entry of evaluateRegression({ laneId, root, scope, git, config })) criteria.set(entry.id, entry);
  if (lane.premium) criteria.set('acabado.premium', evaluatePremium({ laneId, root, scope: visualScope, git }));
  if (lane.muta) criteria.set('mutacion.cadena', evaluateMutation({ laneId, root, scope, git }));
  criteria.set('revision.independiente', evaluateReview({ laneId, root, scope, git }));
  criteria.set('coherencia.entre-carriles', evaluateCoherence({ laneId, rules, config }));

  const ordered = CRITERIA.map((criterion) => criteria.get(criterion.id)).filter(Boolean);
  const evidenceRows = perActor.flatMap(({ evidence }) => evidence?.matrix?.rows ?? []);
  return { lane: laneId, title: lane.titulo, verdict: verdictOf(ordered), criteria: ordered, cells: evidenceRows.length };
}

/** Lo que `evaluateCoherence` necesita de la evidencia: las celdas en oscuro de cada carril. */
export function darkCellsByLane({ config, root }) {
  const byLane = {};
  for (const [laneId, lane] of Object.entries(config.carriles)) {
    byLane[laneId] = [];
    for (const actor of Object.keys(lane.actores)) {
      const evidence = readActorEvidence(root, laneId, actor);
      if (evidence.manifest && Array.isArray(evidence.manifest.cells)) {
        byLane[laneId].push(
          ...evidence.manifest.cells.map((cell) => ({ route: cell.route, theme: cell.theme, requiresWhiteBackground: cell.requiresWhiteBackground, background: cell.parts?.background })),
        );
      } else if (evidence.matrix) {
        byLane[laneId].push(...evidence.matrix.rows.map((row) => ({ route: row.route, theme: row.theme, background: row.background })));
      }
    }
  }
  return byLane;
}

export function evaluateAll({ laneIds, config, routesByKey, root, git, specText, inventoryCheck }) {
  const rules = collectDarkRules({ config, routesByKey, specText, evidenceByLane: darkCellsByLane({ config, root }) });
  return laneIds.map((laneId) => evaluateLane({ laneId, config, routesByKey, root, git, specText, inventoryCheck, rules }));
}

export function exitCodeOf(reports) {
  if (reports.some((report) => report.verdict === VERDICT.FAIL)) return 1;
  if (reports.some((report) => report.verdict === VERDICT.NOT_EVALUABLE)) return 2;
  return 0;
}
