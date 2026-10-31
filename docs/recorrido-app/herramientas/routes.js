const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('http://localhost:4200/posts'); await p.waitForTimeout(5000);
  const out = await p.evaluate(() => {
    const root = document.querySelector('app-root');
    const cmp = window.ng.getComponent(root);
    let router = cmp.router;
    if (!router) { for (const k of Object.keys(cmp)) { const v = cmp[k]; if (v && v.config && v.navigate) router = v; } }
    const res = [];
    const walk = (routes, base, guards) => { for (const r of routes || []) {
      const path = [base, r.path].filter(x => x !== undefined && x !== '').join('/');
      const g = guards || (r.canActivate || []).length > 0 || (r.canMatch||[]).length>0;
      if (r.redirectTo !== undefined) res.push({ path: '/' + path, redirect: String(r.redirectTo) });
      else res.push({ path: '/' + path, title: typeof r.title === 'string' ? r.title : (r.title ? 'fn' : ''), lazy: !!r.loadComponent, guarded: g, roles: r.data && (r.data.roles || r.data.secciones) ? JSON.stringify(r.data.roles||'') : '' });
      walk(r.children || r._loadedRoutes, path, g);
    } };
    walk(router.config, '', false);
    return res;
  });
  require('fs').writeFileSync('router-tree.json', JSON.stringify(out, null, 1));
  console.log(out.length, 'entries;', out.filter(r=>!r.redirect).length, 'non-redirect');
  await b.close();
})();
