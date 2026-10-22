/**
 * Evidencia del muelle: abre `app-select` desde su control, congela la animación a
 * 90 ms y mide origen y escala; luego comprueba la salida y la transición de ruta.
 */
import { lanzar, contexto, entrar, ir, capturar } from './lib.mjs';

const sonda = (pagina) => pagina.evaluate(async () => {
  let max = 0; const nombres = new Set();
  const fin = performance.now() + 1800;
  while (performance.now() < fin) {
    const vt = document.getAnimations().filter((a) => a.effect?.pseudoElement?.startsWith('::view-transition'));
    max = Math.max(max, vt.length); vt.forEach((a) => nombres.add(`${a.effect.pseudoElement}:${a.animationName}`));
    await new Promise((r) => requestAnimationFrame(r));
  }
  return { animacionesDeTransicion: max, nombres: [...nombres], url: location.pathname };
});
const nav = await lanzar();
const ctx = await contexto(nav, { ancho: 1440, alto: 900, tema: 'claro' });
const p = await ctx.newPage();
await entrar(p, 'paciente@alovida.mock');
await ir(p, '/my-account/appointments', 'h1');

const disparador = p.getByRole('combobox', { name: /Estado/ }).first();
const caja = await disparador.boundingBox();
await disparador.click();
await p.locator('.select-panel').waitFor();
const medida = await p.evaluate(() => {
  const panel = document.querySelector('.select-panel');
  const anims = document.getAnimations().filter((a) => a.effect?.target === panel);
  anims.forEach((a) => { a.pause(); a.currentTime = 90; });
  const c = getComputedStyle(panel);
  return { origen: c.transformOrigin, transform: c.transform, opacidad: c.opacity, animaciones: anims.length, nombre: anims[0]?.animationName,
    ox: panel.style.getPropertyValue('--origen-x'), oy: panel.style.getPropertyValue('--origen-y'), rect: panel.getBoundingClientRect().toJSON() };
});
await capturar(p, 'despues', 'muelle-select-a-90ms', '1440', 'claro');
console.log('control', JSON.stringify(caja)); console.log('a 90 ms', JSON.stringify(medida));
await p.evaluate(() => document.getAnimations().forEach((a) => { if (Number.isFinite(a.effect?.getComputedTiming().endTime)) a.finish(); }));
await p.waitForTimeout(200);
await capturar(p, 'despues', 'muelle-select-abierto', '1440', 'claro');

// salida: Escape → el panel sale animado y el dialog se cierra después
const salida = await p.evaluate(async () => {
  const panel = document.querySelector('.select-panel');
  const antes = document.querySelector('dialog.select-dialog')?.open;
  document.querySelector('dialog.select-dialog').dispatchEvent(new Event('cancel', { cancelable: true }));
  await new Promise((r) => setTimeout(r, 30));
  const durante = { saliendo: panel.dataset.saliendo, abierto: document.querySelector('dialog.select-dialog')?.open };
  await new Promise((r) => setTimeout(r, 400));
  return { antes, durante, despues: document.querySelector('dialog.select-dialog')?.open ?? 'removido' };
});
console.log('salida', JSON.stringify(salida));

// transición de ruta: debe existir una ViewTransition y sólo `contenido` anima
await p.evaluate(() => { window.__vt = []; const o = document.startViewTransition?.bind(document);
  if (o) document.startViewTransition = (...a) => { const t = o(...a); window.__vt.push('creada'); t.finished.then(() => window.__vt.push('terminada'), () => window.__vt.push('saltada')); return t; }; });
const sondeo = sonda(p);
await p.locator('a[href="/my-account"]').first().click();
console.log('transición de ruta', JSON.stringify(await sondeo));
await ctx.close();

const reducido = await contexto(nav, { ancho: 1440, alto: 900, reducido: true });
const q = await reducido.newPage();
await entrar(q, 'paciente@alovida.mock');
await ir(q, '/my-account/appointments', 'h1');
await q.evaluate(() => { window.__vt = []; const o = document.startViewTransition?.bind(document);
  if (o) document.startViewTransition = (...a) => { const t = o(...a); window.__vt.push('creada'); t.finished.then(() => window.__vt.push('terminada'), () => window.__vt.push('saltada')); return t; }; });
const sondeoQ = sonda(q);
await q.locator('a[href="/my-account"]').first().click();
console.log('movimiento reducido', JSON.stringify(await sondeoQ));
await nav.close();
