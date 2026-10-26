/**
 * CLI del gate de cierre de las correcciones 31–40. El archivo ejecutable es
 * `scripts/check-correcciones.mjs`; la lógica vive acá para poder probarla.
 *
 *   verificar   (por defecto)  juzga los carriles y sale 0 / 1 / 2
 *   registrar   corre un comando y deja el registro (comando, exit, commit, resumen)
 *   revisar     deja la revisión independiente de un carril
 *   criterios   lista los criterios y su fuente
 */

import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  CRITERIA,
  STATE,
  createGit,
  evaluateAll,
  exitCodeOf,
  parseRunSummary,
  stripAnsi,
} from './correcciones-gate.mjs';

export const EXIT = Object.freeze({ PASS: 0, FAIL: 1, NOT_EVALUABLE: 2, USAGE: 64 });

const TAG = { [STATE.OK]: 'OK    ', [STATE.FAIL]: 'FALLA ', [STATE.MISSING]: 'FALTA ' };

function parseArgs(argv) {
  const flags = {};
  const positional = [];
  let rest = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--') {
      rest = argv.slice(i + 1);
      break;
    }
    if (arg.startsWith('--')) {
      const [name, inline] = arg.slice(2).split('=');
      if (inline !== undefined) flags[name] = inline;
      else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) {
        flags[name] = argv[i + 1];
        i += 1;
      } else flags[name] = true;
    } else positional.push(arg);
  }
  return { flags, positional, rest };
}

function loadProject(repo, flags, env) {
  const config = JSON.parse(readFileSync(join(repo, 'scripts/lib/correcciones-carriles.json'), 'utf8'));
  const routesByKey = JSON.parse(readFileSync(join(repo, 'playwright/corr-rutas.json'), 'utf8'));
  const specText = readFileSync(join(repo, 'playwright/corr-evidencia.spec.ts'), 'utf8');
  const root = resolve(repo, String(flags.evidencia ?? env.CORR_EVIDENCIA_DIR ?? 'artifacts/evidencia/correcciones'));
  return { config, routesByKey, specText, root };
}

function laneIdsFrom(flag, config) {
  const all = Object.keys(config.carriles);
  if (!flag || flag === true || flag === 'todos') return all;
  const wanted = String(flag).split(',').map((id) => id.trim());
  const unknown = wanted.filter((id) => !all.includes(id));
  if (unknown.length > 0) throw new Error(`carril desconocido: ${unknown.join(', ')} (hay ${all.join(', ')})`);
  return wanted;
}

function inventoryChecker(repo) {
  return () => {
    const run = spawnSync(process.execPath, ['scripts/corr-rutas.mjs', '--check'], { cwd: repo, encoding: 'utf8' });
    const text = `${run.stdout ?? ''}${run.stderr ?? ''}`.trim().split('\n').join(' · ');
    return { ok: run.status === 0, detail: text || `scripts/corr-rutas.mjs --check terminó con ${run.status}` };
  };
}

export function formatReports(reports, { head, root }) {
  const lines = [];
  lines.push(`Gate de cierre · correcciones · árbol ${head ? head.slice(0, 9) : 's/commit'} · evidencia en ${root}`);
  lines.push('');
  for (const report of reports) {
    lines.push(`Carril ${report.lane} · ${report.title}  →  ${report.verdict}`);
    for (const criterion of report.criteria) {
      const [first = '', ...more] = criterion.details;
      lines.push(`  ${TAG[criterion.state]} ${criterion.id.padEnd(26)} ${first}`);
      for (const detail of more.slice(0, 4)) lines.push(`${' '.repeat(36)}${detail}`);
      if (more.length > 4) lines.push(`${' '.repeat(36)}… y ${more.length - 4} líneas más`);
    }
    lines.push('');
  }
  lines.push('Resumen');
  for (const report of reports) {
    const failing = report.criteria.filter((criterion) => criterion.state === STATE.FAIL).map((criterion) => criterion.id);
    const missing = report.criteria.filter((criterion) => criterion.state === STATE.MISSING).length;
    const parts = [];
    if (failing.length) parts.push(`fallan: ${failing.join(', ')}`);
    if (missing) parts.push(`${missing} sin evidencia`);
    lines.push(`  ${report.lane}  ${report.verdict.padEnd(13)} ${parts.length ? parts.join(' · ') : 'todos los criterios en OK'}`);
  }
  return lines.join('\n');
}

async function runVerify({ repo, flags, env, io }) {
  const { config, routesByKey, specText, root } = loadProject(repo, flags, env);
  const laneIds = laneIdsFrom(flags.carril, config);
  const git = createGit(repo, String(flags.commit ?? 'HEAD'));
  const reports = evaluateAll({ laneIds, config, routesByKey, root, git, specText, inventoryCheck: inventoryChecker(repo) });
  if (flags.json) {
    io.stdout(`${JSON.stringify({ head: git.head(), root, reports }, null, 2)}\n`);
  } else {
    io.stdout(`${formatReports(reports, { head: git.head(), root })}\n`);
  }
  const code = exitCodeOf(reports);
  return code === 0 ? EXIT.PASS : code === 1 ? EXIT.FAIL : EXIT.NOT_EVALUABLE;
}

function signalExit(code, signal) {
  if (typeof code === 'number') return code;
  const signals = { SIGKILL: 137, SIGTERM: 143, SIGINT: 130 };
  return signals[signal] ?? 1;
}

async function runRecord({ repo, flags, positional, rest, env, io }) {
  const name = positional[1];
  if (!name || rest.length === 0) {
    io.stderr('uso: check-correcciones.mjs registrar <nombre> [--carril N] [--backend real|simulado] -- <comando…>\n');
    return EXIT.USAGE;
  }
  const { root } = loadProject(repo, flags, env);
  const git = createGit(repo);
  const startedAt = new Date().toISOString();
  const commit = git.head();
  const dirty = git.dirtyTracked();
  const chunks = [];
  let size = 0;
  const keep = (buffer) => {
    chunks.push(buffer);
    size += buffer.length;
    while (size > 400_000 && chunks.length > 1) size -= chunks.shift().length;
  };
  const exit = await new Promise((done) => {
    const child = spawn(rest[0], rest.slice(1), { cwd: repo, env, stdio: ['inherit', 'pipe', 'pipe'] });
    child.stdout.on('data', (data) => {
      keep(data);
      io.stdout(data.toString());
    });
    child.stderr.on('data', (data) => {
      keep(data);
      io.stderr(data.toString());
    });
    child.on('error', (error) => {
      keep(Buffer.from(`${error.message}\n`));
      done(127);
    });
    child.on('close', (code, signal) => done(signalExit(code, signal)));
  });
  const output = stripAnsi(Buffer.concat(chunks).toString('utf8'));
  const record = {
    version: 1,
    name,
    lane: flags.carril && flags.carril !== true ? String(flags.carril) : null,
    command: rest.join(' '),
    exit,
    commit,
    dirty,
    startedAt,
    finishedAt: new Date().toISOString(),
    backend: flags.backend && flags.backend !== true ? String(flags.backend) : undefined,
    summary: parseRunSummary(output),
    tail: output.split('\n').slice(-40),
  };
  const dir = record.lane ? join(root, `lane-${record.lane}`, 'registros') : join(root, 'registros');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${name}.json`), `${JSON.stringify(record, null, 2)}\n`);
  io.stderr(`\nregistro «${name}»: exit ${exit} sobre ${commit ? commit.slice(0, 9) : 's/commit'} → ${join(dir, `${name}.json`)}\n`);
  return exit;
}

function runReview({ repo, flags, positional, env, io }) {
  const lane = positional[1];
  const { config, root } = loadProject(repo, flags, env);
  if (!lane || !config.carriles[lane] || !flags.revisor || !flags.veredicto || !flags.desde) {
    io.stderr('uso: check-correcciones.mjs revisar <carril> --revisor <nombre> --veredicto APROBADO|RECHAZADO --desde <rev> [--abiertos P2,P3] [--notas "…"]\n');
    return EXIT.USAGE;
  }
  if (!['APROBADO', 'RECHAZADO'].includes(String(flags.veredicto))) {
    io.stderr('el veredicto es APROBADO o RECHAZADO\n');
    return EXIT.USAGE;
  }
  const git = createGit(repo);
  if (!git.resolve(String(flags.desde))) {
    io.stderr(`--desde ${flags.desde} no es un commit de este repositorio\n`);
    return EXIT.USAGE;
  }
  const review = {
    version: 1,
    lane,
    reviewer: String(flags.revisor),
    verdict: String(flags.veredicto),
    since: String(flags.desde),
    commit: git.head(),
    dirty: git.dirtyTracked(),
    at: new Date().toISOString(),
    open: flags.abiertos && flags.abiertos !== true ? String(flags.abiertos).split(',').map((severity) => severity.trim().toUpperCase()).filter(Boolean) : [],
    notes: flags.notas && flags.notas !== true ? String(flags.notas) : undefined,
  };
  const dir = join(root, `lane-${lane}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'REVISION.json'), `${JSON.stringify(review, null, 2)}\n`);
  io.stdout(`revisión del carril ${lane}: ${review.verdict} por ${review.reviewer} sobre ${review.commit?.slice(0, 9)}\n`);
  return EXIT.PASS;
}

export async function main(argv, { repo, env = process.env, io } = {}) {
  const sink = io ?? { stdout: (text) => process.stdout.write(text), stderr: (text) => process.stderr.write(text) };
  const { flags, positional, rest } = parseArgs(argv);
  const command = positional[0] ?? 'verificar';
  try {
    if (flags.ayuda || flags.help) {
      sink.stdout(
        'check-correcciones.mjs [verificar] [--carril 34|31,32|todos] [--evidencia DIR] [--commit REF] [--json]\n' +
          'check-correcciones.mjs registrar <nombre> [--carril N] [--backend real|simulado] -- <comando…>\n' +
          'check-correcciones.mjs revisar <carril> --revisor X --veredicto APROBADO|RECHAZADO --desde REV [--abiertos P2,P3] [--notas "…"]\n' +
          'check-correcciones.mjs criterios\n' +
          'Salida: 0 todos PASA · 1 algún FALLA · 2 sin FALLA pero algún NO EVALUABLE · 64 uso incorrecto\n',
      );
      return EXIT.PASS;
    }
    if (command === 'criterios') {
      for (const criterion of CRITERIA) sink.stdout(`${criterion.id.padEnd(28)} ${criterion.title}\n${' '.repeat(29)}fuente: ${criterion.source}\n`);
      return EXIT.PASS;
    }
    if (command === 'verificar') return await runVerify({ repo, flags, env, io: sink });
    if (command === 'registrar') return await runRecord({ repo, flags, positional, rest, env, io: sink });
    if (command === 'revisar') return runReview({ repo, flags, positional, env, io: sink });
    sink.stderr(`subcomando desconocido: ${command}\n`);
    return EXIT.USAGE;
  } catch (error) {
    sink.stderr(`check-correcciones: ${error.message}\n`);
    return EXIT.USAGE;
  }
}
