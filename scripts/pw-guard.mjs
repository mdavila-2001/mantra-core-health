#!/usr/bin/env node
/** Guardián serial de Playwright. Contrato y ejemplos: docs/testing/pw-guard.md. */
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { delimiter, dirname, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { stripVTControlCharacters } from 'node:util';

const ROOT = resolve(import.meta.dirname, '..');
const ARTIFACTS = resolve(ROOT, 'artifacts/pw-guard');
const WINDOWS = process.platform === 'win32';
const EXIT_CODES = { PASSED: 0, FAILED: 1, DEADLINE: 124, UNAVAILABLE: 125, INTERRUPTED: 125 };
const ownedChildren = new Set();
const cancellation = new AbortController();

await main();

async function main() {
  const startedAt = Date.now();
  const interrupt = () => cancellation.abort('INTERRUPTED');
  process.on('SIGINT', interrupt);
  process.on('SIGTERM', interrupt);
  process.on('exit', stopOwnedChildren);
  let report = { outcome: 'FAILED', attempt: 0, failedTests: [], attempts: [] };
  try {
    mkdirSync(ARTIFACTS, { recursive: true });
    const options = parseOptions(process.argv.slice(2));
    report = options.selfTest ? await selfTest() : await runPlaywright(options);
  } catch (error) {
    report.message = error instanceof Error ? error.message : String(error);
    console.error(`[pw-guard] ${report.message}`);
  } finally {
    stopOwnedChildren();
    process.off('SIGINT', interrupt);
    process.off('SIGTERM', interrupt);
    process.off('exit', stopOwnedChildren);
    if (cancellation.signal.aborted) report.outcome = cancellation.signal.reason;
    report.durationSeconds = Number(((Date.now() - startedAt) / 1000).toFixed(2));
    report.exitCode = EXIT_CODES[report.outcome];
    try {
      writeFileSync(resolve(ARTIFACTS, 'last-run.json'), `${JSON.stringify(report, null, 2)}\n`);
    } catch (error) {
      console.error(`[pw-guard] No se pudo escribir last-run.json: ${error.message}`);
      report.outcome = 'FAILED';
      report.exitCode = 1;
    }
    console.log(
      `RESUMEN: outcome=${report.outcome} intentos=${report.attempt} duracion=${report.durationSeconds}s`,
    );
    process.exitCode = report.exitCode;
  }
}

function parseOptions(args) {
  const options = { attempts: 3, stall: 120, deadline: 25, specs: [] };
  const flags = { '--serve': 'serve', '--retry-failures': 'retryFailures', '--self-test': 'selfTest' };
  const numbers = { '--port': 'port', '--attempts': 'attempts', '--stall': 'stall', '--deadline': 'deadline' };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (Object.hasOwn(flags, argument)) {
      options[flags[argument]] = true;
      continue;
    }
    if (argument !== '--spec' && !Object.hasOwn(numbers, argument)) throw new Error(`Opción desconocida: ${argument}`);
    const value = args[++index];
    if (!value || value.startsWith('-')) throw new Error(`Falta valor para ${argument}`);
    if (argument === '--spec') {
      options.specs.push(value);
      continue;
    }
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) throw new Error(`${argument} debe ser positivo`);
    if (['--port', '--attempts'].includes(argument) && !Number.isInteger(number)) {
      throw new Error(`${argument} debe ser entero`);
    }
    options[numbers[argument]] = number;
  }
  if (!options.selfTest && !options.port) throw new Error('Se requiere --port (excepto en --self-test)');
  if (options.port > 65535) throw new Error('--port debe estar entre 1 y 65535');
  if (options.deadline * 60_000 > 2_147_483_647) throw new Error('--deadline excede el límite de Node');
  return options;
}

async function runPlaywright(options) {
  const launcher = corepackCommand();
  const baseURL = `http://localhost:${options.port}`;
  const environment = { ...process.env, E2E_BASE_URL: baseURL, PLAYWRIGHT_FORCE_TTY: '0' };
  const health = createHealthCheck(options, launcher, baseURL);
  const command = () => ({
    command: launcher.command,
    args: [...launcher.args, 'yarn', 'playwright', 'test', ...options.specs,
      '--workers=1', '--reporter=list', '--timeout=90000'],
    env: environment,
  });
  return runAttempts(options, command, health);
}

/** Corepack de npm ofrece un launcher JS también en Windows: no interpolar .cmd en un shell. */
function corepackCommand() {
  const directories = [dirname(process.execPath), ...(process.env.PATH ?? '').split(delimiter)];
  for (const directory of directories) {
    const launcher = resolve(directory.replace(/^"|"$/g, ''), 'node_modules/corepack/dist/corepack.js');
    if (existsSync(launcher)) return { command: process.execPath, args: [launcher] };
  }
  if (!WINDOWS) return { command: 'corepack', args: [] };
  throw new Error('No se encontró corepack/dist/corepack.js junto a Node ni en PATH');
}

function createHealthCheck(options, launcher, baseURL) {
  let server;
  let serverError;
  return async () => {
    const healthDeadline = Date.now() + 180_000;
    while (Date.now() < healthDeadline && !cancellation.signal.aborted) {
      const checkedAt = Date.now();
      if (await respondsOK(baseURL, healthDeadline)) return true;
      if (options.serve && !server) {
        const log = resolve(ARTIFACTS, `serve-${options.port}.log`);
        console.log(`[pw-guard] Iniciando yarn dev en :${options.port}; log ${log}`);
        server = spawnOwned({ command: launcher.command, args: [...launcher.args, 'yarn', 'dev', '--port', String(options.port)] });
        server.stdout.on('data', (chunk) => appendFileSync(log, chunk));
        server.stderr.on('data', (chunk) => appendFileSync(log, chunk));
        server.on('error', (error) => { serverError = error; });
      }
      if (serverError) throw serverError;
      if (server && server.exitCode !== null) throw new Error(`yarn dev terminó con ${server.exitCode}; revisar serve-${options.port}.log`);
      await pause(Math.max(1, Math.min(5000 - (Date.now() - checkedAt), healthDeadline - Date.now())));
    }
    if (!cancellation.signal.aborted) console.error(`[pw-guard] servidor caído en :${options.port}`);
    return false;
  };
}

async function respondsOK(url, deadline) {
  const signal = AbortSignal.any([
    cancellation.signal,
    AbortSignal.timeout(Math.max(1, Math.min(5000, deadline - Date.now()))),
  ]);
  try {
    const response = await fetch(url, { signal, redirect: 'manual' });
    await response.body?.cancel();
    return response.status === 200;
  } catch {
    return false;
  }
}

async function runAttempts(options, command, health = async () => true, label = '') {
  const attempts = [];
  let infrastructureRetries = options.attempts - 1;
  let failureRepeated = false;
  let outcome = 'UNAVAILABLE';
  let message;
  let phase = 'health';
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, '').replace('T', '-');
  const deadline = setTimeout(() => cancellation.abort('DEADLINE'), options.deadline * 60_000);
  try {
    while (!cancellation.signal.aborted) {
      phase = 'health';
      if (!(await health())) { outcome = 'UNAVAILABLE'; break; }
      phase = 'runner';
      const attempt = attempts.length + 1;
      const log = resolve(ARTIFACTS, `${stamp}${label}-intento-${attempt}.log`);
      console.log(`[pw-guard] Intento ${attempt}; ${log}`);
      const result = await runChild(command(attempt), { stall: options.stall, log, attempt });
      attempts.push(result);
      if (cancellation.signal.aborted) break;
      if (!result.cleanupConfirmed) { outcome = 'UNAVAILABLE'; break; }
      if (result.outcome === 'PASSED') { outcome = 'PASSED'; break; }
      if (result.outcome === 'FAILED') {
        outcome = 'FAILED';
        if (!options.retryFailures || failureRepeated || !result.assertionFailure) break;
        failureRepeated = true;
        console.warn('[pw-guard] Repetición explícita de aserciones (--retry-failures).');
      } else {
        outcome = 'UNAVAILABLE';
        if (infrastructureRetries-- <= 0) break;
        console.warn(`[pw-guard] ${result.outcome}: ${result.reason}; relanzando.`);
      }
    }
  } catch (error) {
    outcome = phase === 'health' ? 'UNAVAILABLE' : 'FAILED';
    message = error instanceof Error ? error.message : String(error);
    console.error('[pw-guard] ' + message);
  } finally {
    clearTimeout(deadline);
  }
  return {
    outcome: cancellation.signal.aborted ? cancellation.signal.reason : outcome,
    attempt: attempts.length,
    ...(message ? { message } : {}),
    failedTests: [...new Set(attempts.flatMap((attempt) => attempt.failedTests))],
    attempts,
  };
}

function runChild(command, { stall, log, attempt }) {
  const startedAt = Date.now();
  const state = { failedTests: [], completed: 0, assertionFailure: false,
    deterministicError: false, infrastructure: [] };
  writeFileSync(log, '');
  return new Promise((resolveResult) => {
    const child = spawnOwned(command);
    let lastLineAt = Date.now();
    let childReady = !WINDOWS;
    let stopped;
    let spawnError;
    let settled = false;
    let closeDeadline;
    const readers = [child.stdout, child.stderr].map((stream, index) => {
      let pending = '';
      stream.setEncoding('utf8');
      stream.on('data', (chunk) => {
        appendFileSync(log, chunk);
        (index === 0 ? process.stdout : process.stderr).write(chunk);
        pending += chunk;
        const lines = pending.split(/\r\n|\r|\n/);
        pending = lines.pop();
        for (const line of lines) {
          lastLineAt = Date.now();
          if (line === '[pw-guard] CHILD_READY') childReady = true;
          observeLine(state, line);
        }
      });
      return () => { if (pending) observeLine(state, pending); };
    });
    const stop = (reason) => {
      if (stopped) return;
      stopped = reason;
      appendFileSync(log, `\n[pw-guard] ${reason}\n`);
      stopTree(child);
      // No esperar indefinidamente a un descriptor heredado después de matar el árbol.
      closeDeadline = setTimeout(() => finish(child.exitCode, child.signalCode, false), 5000);
    };
    const abort = () => stop(cancellation.signal.reason);
    const watcher = setInterval(() => {
      const silentFor = Date.now() - lastLineAt;
      // PowerShell/Add-Type arranca antes del hijo: no gastar su STALL de 3 s en compilar el helper.
      if ((childReady && silentFor >= stall * 1000) || (!childReady && Date.now() - startedAt >= 30_000)) stop('STALL');
    }, Math.min(250, stall * 1000));
    function finish(code, signal, cleanupConfirmed = true) {
      if (settled) return;
      settled = true;
      clearInterval(watcher);
      clearTimeout(closeDeadline);
      cancellation.signal.removeEventListener('abort', abort);
      for (const flush of readers) flush();
      if (!stopped) stopTree(child);
      if (cleanupConfirmed) ownedChildren.delete(child);
      else child.unref(); // Conservar ownership para la limpieza final; nunca relanzar este intento.
      child.stdout.destroy();
      child.stderr.destroy();
      const classification = cleanupConfirmed
        ? classifyResult(state, { code, stopped, spawnError })
        : { outcome: 'UNAVAILABLE', reason: 'cierre del árbol propio no confirmado; no se relanza' };
      resolveResult({ attempt, ...classification, code, signal, pid: child.pid, log, cleanupConfirmed,
        failedTests: state.failedTests, completedTests: state.completed,
        assertionFailure: state.assertionFailure && !state.deterministicError,
        durationSeconds: Number(((Date.now() - startedAt) / 1000).toFixed(2)) });
    }
    child.on('error', (error) => { spawnError = error; });
    child.on('close', finish);
    cancellation.signal.addEventListener('abort', abort, { once: true });
    if (cancellation.signal.aborted) abort();
  });
}

function observeLine(state, rawLine) {
  const line = stripVTControlCharacters(rawLine);
  const result = line.match(/^\s*(✓|✔|√|ok|PASS|✘|✗|×|x|X|FAIL)\s+(\d+)\s+(.+)/);
  if (result) {
    state.completed += 1;
    if (/^(✘|✗|×|x|X|FAIL)$/.test(result[1])) state.failedTests.push(result[3].trim());
  }
  if (/AssertionError|Error:\s*expect\(|\bExpected:|\bReceived:/.test(line)) state.assertionFailure = true;
  if (/SyntaxError|ReferenceError|TypeError|Cannot find (?:module|package)|ERR_MODULE_NOT_FOUND|ERR_INVALID_ARG|No tests found|[Uu]nknown (?:option|command)|Usage Error|Executable doesn't exist/.test(line)) {
    state.deterministicError = true;
  }
  if (/\b(?:connect )?ECONNREFUSED\b|net::ERR_CONNECTION_REFUSED/.test(line)) state.infrastructure.push('conexión rechazada');
  if (/browserType\.launch.*(?:[Tt]imeout|timed out)/.test(line)) state.infrastructure.push('timeout al iniciar navegador');
  if (state.completed === 0 && /Target (?:closed|page, context or browser has been closed)/.test(line)) {
    state.infrastructure.push('navegador cerrado antes de resultados');
  }
}

function classifyResult(state, { code, stopped, spawnError }) {
  if (stopped === 'STALL' && (state.assertionFailure || state.deterministicError)) {
    return { outcome: 'FAILED', reason: 'fallo registrado antes de STALL' };
  }
  if (stopped) return { outcome: stopped, reason: stopped === 'STALL' ? 'sin líneas de salida' : stopped };
  if (spawnError) return { outcome: 'FAILED', reason: spawnError.message };
  if (code === 0) return { outcome: 'PASSED' };
  if (state.assertionFailure || state.deterministicError) return { outcome: 'FAILED', reason: 'aserción o error determinista' };
  if (state.infrastructure.length) return { outcome: 'INFRASTRUCTURE', reason: [...new Set(state.infrastructure)].join(', ') };
  return { outcome: 'FAILED', reason: 'fallo sin evidencia de infraestructura; no se reintenta' };
}

function spawnOwned({ command, args, env = process.env }) {
  const invocation = WINDOWS ? windowsJobCommand({ command, args, env }) : { command, args, env };
  const child = spawn(invocation.command, invocation.args, {
    cwd: ROOT, env: invocation.env, stdio: ['ignore', 'pipe', 'pipe'],
    shell: false, windowsHide: true, detached: !WINDOWS,
  });
  ownedChildren.add(child);
  // En POSIX el grupo sigue existiendo si el padre terminó dejando descendientes.
  child.once('exit', () => { if (!WINDOWS) stopTree(child); });
  child.once('close', () => ownedChildren.delete(child));
  return child;
}

/** Un Job Object conserva la propiedad del árbol aunque termine el launcher. */
function windowsJobCommand({ command, args, env }) {
  const source = windowsJobSource();
  writeFileSync(resolve(ARTIFACTS, 'windows-job.ps1'), source);
  return {
    command: resolve(process.env.SystemRoot ?? 'C:/Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe'),
    args: ['-NoProfile', '-NonInteractive', '-InputFormat', 'Text', '-OutputFormat', 'Text', '-EncodedCommand', Buffer.from(source, 'utf16le').toString('base64')],
    env: { ...env, PW_GUARD_APPLICATION: command,
      PW_GUARD_COMMAND_LINE: [command, ...args].map(quoteWindowsArgument).join(' '), PW_GUARD_CWD: ROOT },
  };
}

function quoteWindowsArgument(value) {
  const escaped = value.replace(/(\\*)"/g, (_match, slashes) => `${slashes}${slashes}\\"`);
  return `"${escaped.replace(/(\\+)$/g, '$1$1')}"`;
}

function windowsJobSource() {
  const nativeSource = Buffer.from(windowsJobNativeSource(), 'utf8').toString('base64');
  return `
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
try {
  [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
  Add-Type -TypeDefinition ([System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${nativeSource}')))
  $application = $env:PW_GUARD_APPLICATION
  $arguments = $env:PW_GUARD_COMMAND_LINE
  $directory = $env:PW_GUARD_CWD
  $env:PW_GUARD_APPLICATION = $null
  $env:PW_GUARD_COMMAND_LINE = $null
  $env:PW_GUARD_CWD = $null
  exit ([PwGuardJob]::Run($application, $arguments, $directory))
} catch {
  [Console]::Error.WriteLine('pw-guard Windows Job Object: ' + $_.Exception.Message)
  exit 125
}
`;
}

/** API de Windows: crear suspendido, asignar al job y recién entonces ejecutar. */
function windowsJobNativeSource() {
  return `
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;
public static class PwGuardJob {
  [StructLayout(LayoutKind.Sequential)] struct BasicLimits {
    public long ProcessTime, JobTime; public uint Flags;
    public UIntPtr MinimumWorkingSet, MaximumWorkingSet; public uint ActiveProcessLimit;
    public UIntPtr Affinity; public uint Priority, Scheduling;
  }
  [StructLayout(LayoutKind.Sequential)] struct IoCounters {
    public ulong ReadOperations, WriteOperations, OtherOperations, ReadBytes, WriteBytes, OtherBytes;
  }
  [StructLayout(LayoutKind.Sequential)] struct Limits {
    public BasicLimits Basic; public IoCounters Io;
    public UIntPtr ProcessMemory, JobMemory, PeakProcessMemory, PeakJobMemory;
  }
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)] struct Startup {
    public int Size; public string Reserved, Desktop, Title;
    public int X, Y, Width, Height, CharactersX, CharactersY, Fill, Flags;
    public short Show, ReservedLength; public IntPtr ReservedBytes, Input, Output, Error;
  }
  [StructLayout(LayoutKind.Sequential)] struct ProcessInfo {
    public IntPtr Process, Thread; public uint ProcessId, ThreadId;
  }
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  static extern IntPtr CreateJobObject(IntPtr attributes, string name);
  [DllImport("kernel32.dll", SetLastError = true)]
  static extern bool SetInformationJobObject(IntPtr job, int kind, ref Limits limits, uint size);
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  static extern bool CreateProcess(string application, StringBuilder arguments, IntPtr processAttributes,
    IntPtr threadAttributes, bool inheritHandles, uint flags, IntPtr environment, string directory,
    ref Startup startup, out ProcessInfo process);
  [DllImport("kernel32.dll", SetLastError = true)]
  static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
  [DllImport("kernel32.dll", SetLastError = true)] static extern uint ResumeThread(IntPtr thread);
  [DllImport("kernel32.dll", SetLastError = true)] static extern uint WaitForSingleObject(IntPtr handle, uint milliseconds);
  [DllImport("kernel32.dll", SetLastError = true)] static extern bool GetExitCodeProcess(IntPtr process, out uint code);
  [DllImport("kernel32.dll")] static extern bool TerminateProcess(IntPtr process, uint code);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
  [DllImport("kernel32.dll")] static extern IntPtr GetStdHandle(int kind);
  [DllImport("kernel32.dll", SetLastError = true)] static extern bool SetHandleInformation(IntPtr handle, uint mask, uint flags);
  static void Check(bool success) { if (!success) throw new Win32Exception(Marshal.GetLastWin32Error()); }
  public static int Run(string application, string arguments, string directory) {
    IntPtr job = CreateJobObject(IntPtr.Zero, null);
    Check(job != IntPtr.Zero);
    ProcessInfo process = new ProcessInfo();
    try {
      Limits limits = new Limits();
      limits.Basic.Flags = 0x2000; // JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
      Check(SetInformationJobObject(job, 9, ref limits, (uint)Marshal.SizeOf(typeof(Limits))));
      Startup startup = new Startup();
      startup.Size = Marshal.SizeOf(typeof(Startup));
      startup.Flags = 0x101; // STARTF_USESTDHANDLES | STARTF_USESHOWWINDOW, oculto
      startup.Input = GetStdHandle(-10); startup.Output = GetStdHandle(-11); startup.Error = GetStdHandle(-12);
      Check(SetHandleInformation(startup.Input, 1, 1));
      Check(SetHandleInformation(startup.Output, 1, 1));
      Check(SetHandleInformation(startup.Error, 1, 1));
      Check(CreateProcess(application, new StringBuilder(arguments), IntPtr.Zero, IntPtr.Zero, true,
        0x08000004, IntPtr.Zero, directory, ref startup, out process)); // CREATE_NO_WINDOW | CREATE_SUSPENDED
      if (!AssignProcessToJobObject(job, process.Process)) {
        int error = Marshal.GetLastWin32Error();
        TerminateProcess(process.Process, 125);
        throw new Win32Exception(error);
      }
      Check(ResumeThread(process.Thread) != 0xffffffff);
      Console.WriteLine("[pw-guard] CHILD_READY");
      Check(WaitForSingleObject(process.Process, 0xffffffff) == 0);
      uint code; Check(GetExitCodeProcess(process.Process, out code));
      return unchecked((int)code);
    } finally {
      // Cerrar primero el job mata también nietos cuyo padre ya haya terminado.
      CloseHandle(job);
      if (process.Thread != IntPtr.Zero) CloseHandle(process.Thread);
      if (process.Process != IntPtr.Zero) CloseHandle(process.Process);
    }
  }
}
`;
}

function stopTree(child) {
  if (!child.pid) return;
  if (WINDOWS) {
    if (child.exitCode === null && child.signalCode === null) {
      const result = spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
        stdio: 'ignore', windowsHide: true, timeout: 5000,
      });
      if (result.error || result.status !== 0) {
        const reason = result.error?.message ?? `exit ${result.status}`;
        console.error(`[pw-guard] taskkill PID ${child.pid}: ${reason}; cerrando el propietario del Job Object.`);
        // TerminateProcess del handle de ESTE hijo cierra el job: no depende de enumerar el árbol.
        try {
          if (!child.kill('SIGKILL')) console.error(`[pw-guard] No se pudo terminar el hijo propio ${child.pid}.`);
        } catch (error) {
          console.error(`[pw-guard] Terminar PID propio ${child.pid}: ${error.message}`);
        }
      }
    }
    return;
  }
  try { process.kill(-child.pid, 'SIGKILL'); }
  catch (error) { if (error.code !== 'ESRCH') console.error(`[pw-guard] kill PID ${child.pid}: ${error.message}`); }
}

function stopOwnedChildren() {
  for (const child of ownedChildren) stopTree(child);
}

async function pause(milliseconds) {
  try { await delay(milliseconds, undefined, { signal: cancellation.signal }); }
  catch (error) { if (error.name !== 'AbortError') throw error; }
}

async function selfTest() {
  const options = { attempts: 3, stall: 3, deadline: 0.5 };
  const scenarios = [];
  const childCommand = (source) => ({ command: process.execPath, args: ['-e', source] });
  const cases = [
    ['silencio: mata árbol y relanza', async () => {
      const pidFile = resolve(ARTIFACTS, `self-test-descendant-${process.pid}.json`);
      const silentSource = `const {spawn}=require('node:child_process'); const {writeFileSync}=require('node:fs');
        const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'inherit',windowsHide:true});
        writeFileSync(${JSON.stringify(pidFile)},JSON.stringify({pid:child.pid,parent:process.pid})); setInterval(()=>{},1000);`;
      const report = await runAttempts(options, (attempt) => childCommand(attempt === 1 ? silentSource : 'process.exit(0)'), undefined, '-self-test-stall');
      scenarios.push(report);
      assert.equal(report.outcome, 'PASSED');
      assert.equal(report.attempt, 2);
      assert.equal(report.attempts[0].outcome, 'STALL');
      const descendant = JSON.parse(readFileSync(pidFile, 'utf8'));
      await assertProcessGone(report.attempts[0].pid);
      await assertProcessGone(descendant.parent);
      await assertProcessGone(descendant.pid);
      const exitedParent = silentSource.replace('setInterval(()=>{},1000);', 'process.exit(0);');
      const orphanReport = await runAttempts({ ...options, attempts: 1 }, () => childCommand(exitedParent), undefined, '-self-test-exited-parent');
      scenarios.push(orphanReport);
      assert.equal(orphanReport.outcome, 'PASSED');
      assert.equal(orphanReport.attempt, 1);
      const orphan = JSON.parse(readFileSync(pidFile, 'utf8'));
      await assertProcessGone(orphan.parent);
      await assertProcessGone(orphan.pid);
    }],
    ['salida 0: acepta reporter Unicode, ASCII y chunks', async () => {
      const source = `process.stdout.write('\\u001b[32'); setTimeout(()=>{
        process.stdout.write('m✓ 1 correcto\\u001b[0m\\n'); process.stderr.write('ok 2 correcto ASCII\\n');},20);`;
      const report = await runAttempts(options, () => childCommand(source), undefined, '-self-test-success');
      scenarios.push(report);
      assert.equal(report.outcome, 'PASSED');
      assert.equal(report.attempt, 1);
      assert.equal(report.attempts[0].completedTests, 2);
    }],
    ['aserción: salida 1 sin relanzar', async () => {
      const source = `process.stdout.write('✘ 1 fallo\\n'); process.stderr.write('\\u001b[31m');
        setTimeout(()=>{process.stderr.write('x 2 fallo ASCII\\u001b[0m\\nError: expect(locator).toBeVisible()\\n'); process.exitCode=1;},20);`;
      const report = await runAttempts(options, () => childCommand(source), undefined, '-self-test-failure');
      scenarios.push(report);
      assert.equal(report.outcome, 'FAILED');
      assert.equal(report.attempt, 1);
      assert.deepEqual(report.failedTests, ['fallo', 'fallo ASCII']);
      const stalledAssertion = `console.log('✘ 1 fallo antes del cuelgue\\nError: expect(locator).toBeVisible()'); setInterval(()=>{},1000);`;
      const stalledReport = await runAttempts(options, () => childCommand(stalledAssertion), undefined, '-self-test-assertion-stall');
      scenarios.push(stalledReport);
      assert.equal(stalledReport.outcome, 'FAILED');
      assert.equal(stalledReport.attempt, 1);
      assert.equal(stalledReport.attempts[0].reason, 'fallo registrado antes de STALL');
      let healthChecks = 0;
      const failedHealth = async () => {
        if (++healthChecks === 2) throw new Error('salud sintética: servidor terminó');
        return true;
      };
      const healthReport = await runAttempts(options,
        () => childCommand(`console.error('Error: connect ECONNREFUSED 127.0.0.1'); process.exitCode=1;`),
        failedHealth, '-self-test-health-error');
      scenarios.push(healthReport);
      assert.equal(healthReport.outcome, 'UNAVAILABLE');
      assert.equal(healthReport.attempt, 1);
      assert.equal(healthReport.attempts[0].outcome, 'INFRASTRUCTURE');
      assert.equal(healthReport.message, 'salud sintética: servidor terminó');
      const repeatReport = await runAttempts({ ...options, retryFailures: true }, (attempt) =>
        childCommand(attempt === 2 ? `console.error('Error: connect ECONNREFUSED 127.0.0.1'); process.exitCode=1;` : source),
        undefined, '-self-test-one-assertion-repeat');
      scenarios.push(repeatReport);
      assert.equal(repeatReport.outcome, 'FAILED');
      assert.equal(repeatReport.attempt, 3);
      assert.deepEqual(repeatReport.attempts.map((attempt) => attempt.outcome), ['FAILED', 'INFRASTRUCTURE', 'FAILED']);
    }],
  ];
  let passed = 0;
  for (const [title, run] of cases) {
    try { await run(); passed += 1; console.log(`PASS: ${title}`); }
    catch (error) { console.error(`FAIL: ${title}: ${error.message}`); }
  }
  console.log(`pw-guard self-test: ${passed} PASS, ${cases.length - passed} FAIL`);
  return { outcome: passed === cases.length ? 'PASSED' : 'FAILED',
    attempt: scenarios.reduce((sum, report) => sum + report.attempt, 0),
    failedTests: [], attempts: [], selfTest: { passed, failed: cases.length - passed, scenarios } };
}

async function assertProcessGone(pid) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try { process.kill(pid, 0); }
    catch (error) { if (error.code === 'ESRCH') return; throw error; }
    await pause(100);
  }
  assert.fail(`El proceso propio ${pid} sigue vivo`);
}
