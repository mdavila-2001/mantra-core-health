#!/usr/bin/env node
// Pre-push gate: nothing leaves this machine unless the merge result into the
// base branch builds AND the change was exercised for real (Playwright for the
// front, integration tests for the back). Modes:
//   run    [--base dev] [--pw spec...] [--int path...]   run checks, write proof
//   verify [--base dev]                                  is the proof valid for HEAD?
//   hook                                                 Claude Code PreToolUse hook
// No dependencies: Node built-ins only. Why it exists: docs/frontend/PRE_PUSH_GATE.md
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const PROOF = '.claude/gate/proof.json';
const GATED_MCP = new Set([
  'mcp__github__create_pull_request',
  'mcp__github__push_files',
  'mcp__github__create_or_update_file',
  'mcp__github__delete_file',
  'mcp__github__merge_pull_request',
  'mcp__github__update_pull_request_branch',
]);

const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();
const gitOk = (...a) => spawnSync('git', a, { stdio: 'ignore' }).status === 0;
const isFront = existsSync('angular.json');
const PROFILE = isFront ? 'front' : 'back';

/** Splits `--pw a b --int c` into { pw: [a, b], int: [c], base }. */
function parseArgs(argv) {
  const out = { pw: [], int: [], base: 'dev', sha: '' };
  let key = null;
  for (const token of argv) {
    if (token === '--base') key = 'base';
    else if (token === '--pw') key = 'pw';
    else if (token === '--int') key = 'int';
    else if (token === '--sha') key = 'sha';
    else if (key === 'base' || key === 'sha') { out[key] = token; key = null; }
    else if (key) out[key].push(token);
  }
  return out;
}

function fail(reasons) {
  process.stderr.write(`\nPRE-PUSH GATE: BLOCKED\n${reasons.map((r) => `  - ${r}`).join('\n')}\n`);
  process.stderr.write('Run: node scripts/pre-push-gate.mjs run --base <base> [--pw <spec>] [--int <spec>]\n');
  process.exit(2);
}

/** Commits of the branch that lack a mandatory trailer (author must state it, not the tool). */
function missingTrailers(base) {
  const rules = [
    { key: 'Responsable', min: 2, why: 'CLAUDE.md, 03/11/2026: who answers for the change' },
    { key: 'Largo plazo', min: 25,
      why: 'does this still serve long term and fix the CAUSE, not the symptom? If not, it must not ship' },
  ];
  const out = [];
  for (const r of rules) {
    // Only commits origin does not have yet: what this session authors, independent of forgeable dates.
    const commits = git('log', '--format=%B%x00', `origin/${base}..HEAD`, '--not', '--remotes=origin').split('\0').map((c) => c.trim()).filter(Boolean);
    const bad = commits.filter((c) => {
      const m = c.match(new RegExp(`^${r.key}:[ \\t]*(.*)$`, 'mi'));
      return !m || m[1].trim().length < r.min || /^(s[ií]|ok|no)\.?$/i.test(m[1].trim());
    });
    if (bad.length) out.push(`${bad.length} commit(s) without a real "${r.key}: <text>" line (${r.why})`);
  }
  return out;
}

/** Static checks on the git state: the tested tree must be the pushed tree. */
function gitState(base) {
  const problems = [];
  if (!gitOk('fetch', '-q', 'origin', base)) return [`cannot fetch origin/${base}`];
  if (git('status', '--porcelain'))
    problems.push('working tree not clean (untracked or modified files would mask the build: commit or remove them)');
  if (!gitOk('merge-base', '--is-ancestor', `origin/${base}`, 'HEAD'))
    problems.push(`HEAD does not contain origin/${base}: merge it first and resolve keeping ${base}'s content`);
  else if (!git('diff', '--name-only', `origin/${base}`, 'HEAD'))
    problems.push(`branch adds nothing over origin/${base} (already merged? start a new branch from ${base})`);
  problems.push(...missingTrailers(base));
  return problems;
}

/** Changed files classified: does the change need a behavioural proof? */
function classify(base) {
  const files = git('diff', '--name-only', `origin/${base}`, 'HEAD').split('\n').filter(Boolean);
  const isSpec = (f) => /\.(spec|test|int-spec|e2e-spec)\.[tj]s$/.test(f);
  const needsProof = files.some((f) =>
    isFront ? /^(src\/|public\/|angular\.json)/.test(f) && !isSpec(f) : /^(src\/|database\/)/.test(f) && !isSpec(f),
  );
  const touchesCode = files.some((f) => /^(src\/|database\/|test\/|playwright\/)/.test(f) || /^(package\.json|yarn\.lock)$/.test(f));
  return { files, needsProof, touchesCode };
}

function step(name, cmd, args, env = {}) {
  const t0 = Date.now();
  process.stderr.write(`\n▶ ${name}: ${cmd} ${args.join(' ')}\n`);
  const r = spawnSync(cmd, args, {
    stdio: 'inherit',
    env: { ...process.env, NODE_OPTIONS: process.env.NODE_OPTIONS ?? '--max-old-space-size=8192', ...env },
  });
  return { name, cmd: `${cmd} ${args.join(' ')}`, code: r.status ?? 1, ms: Date.now() - t0 };
}

const reachable = (url) => fetch(url, { signal: AbortSignal.timeout(2000) }).then(() => true, () => false);

/** Starts `yarn start:demo`, waits for it by condition, runs fn, always kills the process group. */
async function withDemoServer(fn) {
  const url = process.env.E2E_BASE_URL ?? 'http://localhost:4200';
  if (await reachable(url))
    throw new Error(`${url} is already taken: a foreign server may serve other code. Stop it and re-run.`);
  const child = spawn('yarn', ['start:demo'], { detached: true, stdio: 'ignore' });
  const stop = () => { try { process.kill(-child.pid, 'SIGTERM'); } catch { /* already gone */ } };
  for (const sig of ['SIGINT', 'SIGTERM']) process.once(sig, () => { stop(); process.exit(130); });
  try {
    const deadline = Date.now() + 10 * 60_000;
    while (!(await reachable(url))) {
      if (Date.now() > deadline) throw new Error('ng serve did not come up in 10 min');
      await new Promise((r) => setTimeout(r, 2000)); // polling interval, not a wait-for-done
    }
    return await fn();
  } finally {
    stop();
  }
}

function lintSpecs(paths, dir, ext) {
  const problems = [];
  for (const p of paths) {
    if (!p.startsWith(`${dir}/`) || !ext.test(p) || !existsSync(p)) {
      problems.push(`${p}: must exist under ${dir}/ and match ${ext}`);
      continue;
    }
    const src = readFileSync(p, 'utf8');
    if (/networkidle|waitForTimeout\(/.test(src)) problems.push(`${p}: uses networkidle/waitForTimeout (false greens with HMR)`);
    if (/\b(it|test|describe)\.(skip|only)\b/.test(src)) problems.push(`${p}: contains skip/only`);
  }
  return problems;
}

async function run(opts) {
  const problems = gitState(opts.base);
  if (problems.length) fail(problems);
  const { files, needsProof, touchesCode } = classify(opts.base);
  const proofArgs = isFront ? opts.pw : opts.int;
  if (needsProof && proofArgs.length === 0)
    fail([isFront ? 'front code changed: pass --pw <spec> (a Playwright spec that exercises the change)'
                  : 'back code changed: pass --int <spec> (an integration test against the real database)']);
  const touched = new Set(files);
  if (needsProof && !proofArgs.some((p) => touched.has(p)))
    fail([`none of the proof specs (${proofArgs.join(', ')}) is new or modified in this branch: write the test that fails without your change (or add the assertion to the existing spec)`]);
  const specProblems = needsProof
    ? isFront ? lintSpecs(opts.pw, 'playwright', /\.spec\.ts$/) : lintSpecs(opts.int, 'test', /(int-spec|e2e-spec)\.ts$/)
    : [];
  if (specProblems.length) fail(specProblems);

  const steps = [];
  const record = (s) => { steps.push(s); return s.code === 0; };
  let ok = true;
  const changedSrc = files.filter((f) => /\.(ts|html)$/.test(f) && existsSync(f));
  if (touchesCode) {
    // A clean checkout has no ignored generated files; `yarn typecheck` does not create them but `yarn build` does.
    if (isFront) ok = record(step('generate-env', 'node', ['scripts/generate-env.mjs']));
    if (ok) ok = record(step('typecheck', 'yarn', ['typecheck']));
    if (ok && changedSrc.length) ok = record(step('lint', 'npx', ['eslint', ...changedSrc]));
    if (ok) ok = record(step('build', 'yarn', ['build']));
    if (ok && !isFront) {
      const related = files.filter((f) => /^src\/.*\.ts$/.test(f) && existsSync(f));
      if (related.length) ok = record(step('unit (related)', 'yarn', ['test', '--findRelatedTests', ...related, '--passWithNoTests']));
    }
  }
  if (ok && needsProof) {
    ok = isFront
      ? await withDemoServer(async () => record(step('playwright', 'yarn', ['pw', ...opts.pw])))
      : record(step('integration', 'yarn', ['test:integration', ...opts.int]));
  }
  const proof = {
    version: 1, profile: PROFILE, base: opts.base, head: git('rev-parse', 'HEAD'),
    baseSha: git('rev-parse', `origin/${opts.base}`), files: files.length, needsProof,
    proofTargets: needsProof ? proofArgs : [], steps, ok, finishedAt: new Date().toISOString(),
  };
  mkdirSync('.claude/gate', { recursive: true });
  writeFileSync(PROOF, `${JSON.stringify(proof, null, 2)}\n`);
  process.stderr.write(`\n${ok ? 'PRE-PUSH GATE: PASS' : 'PRE-PUSH GATE: FAIL'} (${steps.length} steps) → ${PROOF}\n`);
  process.exit(ok ? 0 : 1);
}

/** Is there a PASS proof for exactly this HEAD against the current tip of base? */
function verify(base, sha = '') {
  const problems = gitState(base);
  // Called from the git pre-push hook: the pushed commit must be the one that was tested.
  if (sha && sha !== git('rev-parse', 'HEAD')) problems.push('pushing a commit that is not the checked-out HEAD: check it out and run the gate on it');
  if (!existsSync(PROOF)) return [...problems, 'no proof yet'];
  let p;
  try { p = JSON.parse(readFileSync(PROOF, 'utf8')); } catch { return [...problems, 'proof file unreadable or corrupt: re-run the gate']; }
  if (!p.ok) problems.push('last gate run failed');
  if (p.head !== git('rev-parse', 'HEAD')) problems.push('proof is for another commit: re-run after your last commit');
  if (p.baseSha !== git('rev-parse', `origin/${base}`)) problems.push(`${base} moved since the proof: merge it and re-run`);
  if (p.base !== base) problems.push(`proof was made against ${p.base}, not ${base}`);
  return problems;
}

function hook() {
  // Fail CLOSED: an uncaught error exits 1, which Claude Code treats as non-blocking (i.e. allow).
  const closed = (e) => fail([`gate error, failing closed: ${e?.message ?? e}`]);
  process.on('uncaughtException', closed);
  let input;
  try { input = JSON.parse(readFileSync(0, 'utf8')); } catch (e) { return closed(new Error(`unreadable hook input (${e.message})`)); }
  const cmd = input.tool_input?.command ?? '';
  // Deliberately loose: any command that mentions git AND push (even inside `bash -c "..."`, quotes, aliases
  // or a full path) is gated, and so is gh pr create / gh api. Over-blocking a harmless mention is cheap;
  // the real enforcement is the git pre-push hook and server-side required checks (see SKILL.md).
  const bash = input.tool_name === 'Bash'
    && ((/\bgit\b/.test(cmd) && /\bpush\b/.test(cmd)) || /\bgh\b[^\n]*\b(pr\s+create|api|release)\b/.test(cmd));
  if (!bash && !GATED_MCP.has(input.tool_name)) process.exit(0);
  const problems = verify(process.env.GATE_BASE ?? 'dev');
  if (problems.length) fail(problems);
  process.exit(0);
}

const [mode, ...rest] = process.argv.slice(2);
if (mode === 'run') await run(parseArgs(rest));
else if (mode === 'verify') {
  const a = parseArgs(rest);
  const problems = verify(a.base, a.sha);
  if (problems.length) fail(problems);
  process.stderr.write('PRE-PUSH GATE: proof valid for HEAD\n');
} else if (mode === 'hook') hook();
else { process.stderr.write('usage: pre-push-gate.mjs run|verify|hook\n'); process.exit(64); }
