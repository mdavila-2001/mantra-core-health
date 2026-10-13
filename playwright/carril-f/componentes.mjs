/** Evidencia de las primitivas: botón (carga→éxito, hundimiento), interruptor, error de campo. */
import { lanzar, contexto, entrar, ir, capturar } from './lib.mjs';
const nav = await lanzar();
const ctx = await contexto(nav, { ancho: 1440, alto: 900, tema: 'claro' });
const p = await ctx.newPage();

/* 1 · error de campo en /auth: alto del <p> a 0, 40 % y 100 % de la animación */
await ir(p, '/auth', '[data-testid="login-submit"]');
await p.getByTestId('login-submit').click();
await p.locator('.form-field-error').first().waitFor();
const error = await p.evaluate(() => {
  const el = document.querySelector('.form-field-error');
  const a = document.getAnimations().find((x) => x.effect?.target === el);
  const medir = (t) => { a.pause(); a.currentTime = t; const c = getComputedStyle(el); return { t, alto: Math.round(el.getBoundingClientRect().height * 10) / 10, opacidad: +(+c.opacity).toFixed(2), margen: c.marginTop }; };
  const salida = { nombre: a?.animationName, pasos: [medir(0), medir(80), medir(160), medir(380)] };
  a.finish();
  return salida;
});
console.log('error de campo', JSON.stringify(error));
await capturar(p, 'despues', 'campo-error', '1440', 'claro', { clip: { x: 880, y: 140, width: 400, height: 460 } });

/* 2 · botón: hundimiento y carga → éxito en la vitrina */
await ir(p, '/design-system', '[data-testid="demo-guardar"]');
const b = p.getByTestId('demo-guardar').first();
await b.scrollIntoViewIfNeeded();
await b.hover();
await p.mouse.down();
await p.waitForTimeout(150);
console.log('botón presionado', await b.evaluate((e) => getComputedStyle(e).transform));
await p.mouse.up();
await p.waitForTimeout(250);
console.log('en carga', await b.evaluate((e) => ({ clases: e.className, busy: e.getAttribute('aria-busy') })));
await b.evaluate((e) => e.scrollIntoView({ block: 'center' }));
await capturar(p, 'despues', 'boton-carga', '1440', 'claro', { clip: await b.boundingBox().then((r) => ({ x: r.x - 20, y: r.y - 10, width: r.width + 40, height: r.height + 20 })) });
await p.waitForFunction(() => document.querySelector('[data-testid="demo-guardar"]').classList.contains('btn--success'), null, { timeout: 5000 });
const exito = await b.evaluate((e) => {
  const check = e.querySelector('.btn__check');
  const a = document.getAnimations().find((x) => x.effect?.target === check);
  a?.pause(); if (a) a.currentTime = 120;
  return { clases: e.className, check: !!check, escalaA120ms: check && getComputedStyle(check).transform, nombre: a?.animationName };
});
console.log('éxito', JSON.stringify(exito));
await b.evaluate((e) => document.getAnimations().forEach((a) => { if (Number.isFinite(a.effect?.getComputedTiming().endTime)) a.finish(); }));
await capturar(p, 'despues', 'boton-exito', '1440', 'claro', { clip: await b.boundingBox().then((r) => ({ x: r.x - 20, y: r.y - 10, width: r.width + 40, height: r.height + 20 })) });

/* 3 · interruptor real: farmacia → pedidos */
const q = await (await contexto(nav, { ancho: 1440, alto: 900, tema: 'claro' })).newPage();
await entrar(q, 'farmacia@alovida.mock');
await ir(q, '/administration/pharmacy-orders', '.switch-thumb');
const th = q.locator('.switch-thumb').first();
const antes = await th.evaluate((e) => getComputedStyle(e).transform);
await q.locator('.switch-track').first().click();
const mitad = await th.evaluate((e) => { const a = document.getAnimations().find((x) => x.effect?.target === e); a?.pause(); if (a) a.currentTime = 70; return { transform: getComputedStyle(e).transform, nombre: a?.transitionProperty, dur: a?.effect.getComputedTiming().duration }; });
await th.evaluate((e) => document.getAnimations().forEach((a) => { if (Number.isFinite(a.effect?.getComputedTiming().endTime)) a.finish(); }));
const despues = await th.evaluate((e) => getComputedStyle(e).transform);
console.log('interruptor', JSON.stringify({ antes, mitad, despues }));
await nav.close();
