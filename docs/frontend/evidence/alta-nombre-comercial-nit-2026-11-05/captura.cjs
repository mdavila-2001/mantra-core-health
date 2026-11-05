// Evidencia del alta con nombre comercial: node captura.cjs <carpeta-de-salida>
// Requiere `ng serve --configuration development,demo --port 4200` (backend simulado).
const { chromium } = require('playwright');
const out = process.argv[2];
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:4200';
const problemas = [];

const ALTAS = [
  { clave: 'imagenologia', ruta: '/auth/register/imaging-center', testId: 'registro-imagen-nombre-comercial' },
  { clave: 'laboratorio', ruta: '/auth/register/laboratory', testId: 'registro-lab-nombre-comercial' },
  { clave: 'farmacia', ruta: '/auth/register/pharmacy', testId: 'registro-farmacia-nombre-comercial' },
  { clave: 'organizacion-medica', ruta: '/auth/register/medical-center', testId: 'medical-center-signup-trade-name' },
];

function vigilar(p, etiqueta) {
  p.on('pageerror', (e) => problemas.push(`${etiqueta} pageerror: ${e.message}`));
  p.on('console', (m) => m.type() === 'error' && problemas.push(`${etiqueta} console.error: ${m.text()}`));
}

(async () => {
  // Con el Playwright del proyecto hace falta el Chromium de la imagen.
  const b = await chromium.launch(
    process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  );
  for (const alta of ALTAS) {
    for (const [w, h] of [[1440, 900], [390, 844]]) {
      const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
      vigilar(p, `${alta.clave}@${w}`);
      await p.goto(`${BASE}${alta.ruta}`, { waitUntil: 'domcontentloaded' });
      const campo = p.getByTestId(alta.testId);
      await campo.waitFor({ timeout: 60000 });
      // El rótulo dice «opcional» y el campo no es obligatorio.
      const requerido = await campo.getAttribute('required');
      const ariaReq = await campo.getAttribute('aria-required');
      const rotulo = await p.locator(`label[for="${await campo.getAttribute('id')}"]`).textContent();
      const sw = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      await p.screenshot({ path: `${out}/${alta.clave}-empresa-${w}.png`, fullPage: w === 390 });
      console.log(
        `${alta.clave} ${w}x${h}: rótulo="${(rotulo ?? '').trim()}" required=${requerido} aria-required=${ariaReq} desborde=${sw}px`,
      );
      await p.close();
    }
  }
  await b.close();
  if (problemas.length) {
    console.log('PROBLEMAS:\n' + problemas.join('\n'));
    process.exit(1);
  }
  console.log('Sin errores de página ni de consola.');
})();
