/** Evidencia de la barra superior: quieta arriba, vidrio al desplazar (claro y oscuro). */
import { lanzar, contexto, entrar, ir, capturar } from './lib.mjs';
const nav = await lanzar();
for (const tema of ['claro', 'oscuro']) {
  const ctx = await contexto(nav, { ancho: 1440, alto: 900, tema });
  const p = await ctx.newPage();
  await entrar(p, 'paciente@alovida.mock');
  await ir(p, '/my-account/appointments', 'h1');
  const medir = () => p.evaluate(() => {
    const h = document.querySelector('.app-header');
    const c = getComputedStyle(h);
    return { scrollY: Math.round(scrollY), fondo: c.backgroundColor, filtro: c.backdropFilter, borde: c.borderBottomColor };
  });
  const arriba = await medir();
  await capturar(p, 'despues', `barra-arriba`, '1440', tema, { clip: { x: 240, y: 0, width: 1200, height: 140 } });
  await p.mouse.move(800, 500);
  await p.mouse.wheel(0, 24);
  await p.waitForTimeout(500);
  const mitad = await medir();
  await p.mouse.wheel(0, 360);
  await p.waitForTimeout(700);
  const abajo = await medir();
  await capturar(p, 'despues', `barra-desplazada`, '1440', tema, { clip: { x: 240, y: 0, width: 1200, height: 140 } });
  console.log(tema, JSON.stringify({ arriba, mitad, abajo }));
  await ctx.close();
}
await nav.close();
