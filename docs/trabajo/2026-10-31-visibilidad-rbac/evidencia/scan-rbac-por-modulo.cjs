#!/usr/bin/env node
/* Escanea los controladores de la API y emite el inventario RBAC por módulo.
   Uso:  node scan-rbac-por-modulo.cjs [rutaApi] > salida.json
   Lee SOLO el código fuente (AST de TypeScript); no ejecuta la API.
   La derivación módulo·recurso·acción es la MISMA que usa el endpoint
   (`authz-modules-route-derivation.ts`, transpilada tal cual). */
const fs = require('fs');
const path = require('path');
const api = process.argv[2] || '/home/user/mantra-core-health-api';
const ts = require(path.join(api, 'node_modules/typescript'));
const src = path.join(api, 'src');

// --- la derivación del endpoint, sin copiarla ---------------------------------
const derSrc = fs.readFileSync(path.join(src, 'modules/authz/services/authz-modules-route-derivation.ts'), 'utf8');
const js = ts.transpileModule(derSrc, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = { exports: {} };
new Function('module', 'exports', js)(mod, mod.exports);
const { deriveRoute, proposedPermissionCode } = mod.exports;

function walk(d, out = []) {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, f.name);
    if (f.isDirectory()) walk(p, out);
    else if (/\.controller\.ts$/.test(f.name)) out.push(p);
  }
  return out;
}
const HTTP = ['Get', 'Post', 'Put', 'Patch', 'Delete'];
const decos = (n) => (ts.canHaveDecorators(n) ? ts.getDecorators(n) : []) || [];
const dinfo = (d) => {
  const e = d.expression;
  return ts.isCallExpression(e) ? { name: e.expression.getText(), args: e.arguments.map((a) => a.getText()) } : { name: e.getText(), args: [] };
};
const unq = (s) => s.replace(/^['"`]|['"`]$/g, '');
const join = (a, b) => '/' + [a, b].filter(Boolean).join('/').split('/').filter(Boolean).join('/');

const routes = [];
for (const f of walk(src)) {
  const rel = path.relative(src, f).split(path.sep);
  const module = rel[0] === 'modules' ? rel[1] : rel[0];
  const sf = ts.createSourceFile(f, fs.readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true);
  sf.forEachChild((c) => {
    if (!ts.isClassDeclaration(c)) return;
    const cd = decos(c).map(dinfo);
    const ctl = cd.find((d) => d.name === 'Controller');
    if (!ctl) return;
    const cRoles = cd.filter((d) => d.name === 'Roles').flatMap((d) => d.args.map(unq));
    const cHasRoles = cd.some((d) => d.name === 'Roles');
    const cPublic = cd.some((d) => d.name === 'Public');
    const cGuards = cd.filter((d) => d.name === 'UseGuards').flatMap((d) => d.args);
    const cpath = ctl.args[0] && !ctl.args[0].startsWith('{') && !ctl.args[0].startsWith('[') ? unq(ctl.args[0]) : '';
    for (const m of c.members) {
      if (!ts.isMethodDeclaration(m)) continue;
      const md = decos(m).map(dinfo);
      const h = md.find((d) => HTTP.includes(d.name));
      if (!h) continue;
      const hasRoles = md.some((d) => d.name === 'Roles') || cHasRoles;
      const roles = md.some((d) => d.name === 'Roles') ? md.filter((d) => d.name === 'Roles').flatMap((d) => d.args.map(unq)) : cRoles;
      const isPublic = md.some((d) => d.name === 'Public') || cPublic;
      const guards = [...cGuards, ...md.filter((d) => d.name === 'UseGuards').flatMap((d) => d.args)];
      const template = join(cpath, h.args[0] ? unq(h.args[0]) : '');
      const d = deriveRoute(h.name, template, module);
      const status = isPublic ? 'PUBLIC' : hasRoles ? 'ROLE_ONLY' : guards.length ? 'GUARD_ONLY' : d.selfService ? 'SELF_SERVICE' : 'AUTHENTICATED_ONLY';
      routes.push({ module, file: rel.join('/'), controller: c.name.getText(), handler: m.name.getText(), method: h.name.toUpperCase(), template, roles, guards, status, ...d, code: proposedPermissionCode(module, d.resource, d.action), audited: md.some((x) => x.name === 'Audited') });
    }
  });
}
process.stdout.write(JSON.stringify(routes, null, 1));
