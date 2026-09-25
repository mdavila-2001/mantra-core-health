/**
 * Sonda: ¿qué desborda a 375 px, y desde dónde?
 *
 * Nació porque el cierre de la tanda del 2026-09-25 midió `scrollWidth = 403`
 * contra `innerWidth = 375` en **tres pantallas sin relación entre sí** («Mis
 * recetas», «Mi historia» y «Mis citas»). Tres pantallas de tres carriles
 * distintos fallando por los mismos 28 px no es un defecto de pantalla: es el
 * armazón, o es el método de medición. Esta sonda lo decide mirando además una
 * ruta de control que ningún carril de la tanda tocó, y nombrando al elemento
 * más ancho del documento.
 *
 * Uso: node scripts/sonda-desborde-375.mjs [baseUrl]
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:4230';

const RUTAS = [
  ['control · panel', '/dashboard'],
  ['A · mis recetas', '/my-account/pharmacy/prescriptions'],
  ['A · tienda', '/my-account/pharmacy'],
  ['C6 · mi historia', '/my-account/medical-record'],
  ['C4 · mis citas', '/my-account/appointments'],
];

const navegador = await chromium.launch();
const contexto = await navegador.newContext({
  viewport: { width: 375, height: 812 },
  locale: 'es-BO',
});
const pagina = await contexto.newPage();

await pagina.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded' });
await pagina.getByTestId('login-identifier').fill('paciente@alovida.mock');
await pagina.getByTestId('login-password').fill('cualquiera');
await pagina.getByTestId('login-submit').click();
await pagina.waitForURL((u) => !u.pathname.startsWith('/auth'), { timeout: 30_000 });

console.log('ruta'.padEnd(26), 'scrollW', 'innerW', 'desborde', ' culpable más ancho');
console.log('-'.repeat(100));

for (const [nombre, ruta] of RUTAS) {
  try {
    await pagina.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  } catch {
    console.log(nombre.padEnd(26), '  (no cargó a tiempo)');
    continue;
  }
  await pagina.waitForTimeout(3000);

  const medida = await pagina.evaluate(() => {
    const doc = document.documentElement;
    const ancho = window.innerWidth;

    // Un elemento sólo ESTIRA el documento si nada lo recorta: si algún
    // ancestro tiene overflow-x distinto de `visible`, lo que sobresale se
    // queda dentro de esa caja y no suma un pixel al scroll de la página. La
    // primera versión de esta sonda no lo miraba y culpaba a un texto de sólo
    // lectores que en realidad estaba recortado.
    const loRecortaAlguien = (el) => {
      let n = el.parentElement;
      while (n && n !== doc) {
        const o = getComputedStyle(n);
        if (o.overflowX !== 'visible' || o.overflow !== 'visible') return true;
        n = n.parentElement;
      }
      return false;
    };

    const describir = (el) => {
      if (!el) return '(ninguno)';
      const id = el.getAttribute('data-testid');
      const clase = (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean).slice(0, 2).join('.');
      return `${el.tagName.toLowerCase()}${id ? `[${id}]` : ''}${clase ? `.${clase}` : ''}`;
    };

    const culpables = [];
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.right <= ancho + 0.5) continue;
      if (loRecortaAlguien(el)) continue;
      culpables.push({ que: describir(el), derecha: Math.round(r.right) });
    }
    culpables.sort((a, b) => b.derecha - a.derecha);

    const peor = culpables[0] ?? null;
    let cadena = '';
    if (peor) {
      const el = Array.from(document.querySelectorAll('body *')).find(
        (e) => describir(e) === peor.que && Math.round(e.getBoundingClientRect().right) === peor.derecha,
      );
      const partes = [];
      let n = el?.parentElement;
      while (n && n !== document.body && partes.length < 4) {
        partes.push(describir(n));
        n = n.parentElement;
      }
      cadena = partes.join(' ← ');
    }

    return {
      scroll: doc.scrollWidth,
      ventana: ancho,
      culpable: peor ? peor.que : '(ninguno sin recortar)',
      derecha: peor ? peor.derecha : ancho,
      cuantos: culpables.length,
      cadena,
    };
  });

  const desborda = medida.scroll > medida.ventana;
  console.log(
    nombre.padEnd(26),
    String(medida.scroll).padStart(7),
    String(medida.ventana).padStart(6),
    String(desborda).padStart(8),
    ` ${medida.culpable} (llega a ${medida.derecha}px, ${medida.cuantos} sin recortar)`,
  );
  if (desborda && medida.cadena) console.log(' '.repeat(50), `dentro de: ${medida.cadena}`);
}

await navegador.close();
