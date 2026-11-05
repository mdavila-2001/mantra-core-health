import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = '/tmp/claude-0/-home-user/7ee55b3b-5956-59f8-8bfe-f84cdff1dc90/scratchpad/evidencia';
const BASE = 'http://localhost:4200';
const FORMS = [
  { nombre: 'imagenologia', ruta: '/auth/register/imaging-center', formType: 'imaging-center', step: 6, titulo: 'Representante legal', tipo: { companyType: 'UNIPERSONAL' } },
  { nombre: 'laboratorio', ruta: '/auth/register/laboratory', formType: 'laboratory', step: 4, titulo: 'Representante legal', tipo: { companyType: 'UNIPERSONAL' } },
  { nombre: 'farmacia', ruta: '/auth/register/pharmacy', formType: 'pharmacy', step: 4, titulo: 'Representante legal', tipo: { companyType: 'UNIPERSONAL' } },
  { nombre: 'centro-medico', ruta: '/auth/register/medical-center', formType: 'medical-center', step: 7, titulo: 'Poder del representante legal', tipo: { legalEntityType: 'UNIPERSONAL' } },
];

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const resultados = [];
for (const f of FORMS) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(String(e)));
  try {
    await page.goto(BASE + f.ruta, { waitUntil: 'domcontentloaded' });
    await page.evaluate(({ formType, step, tipo }) => {
      const ahora = new Date().toISOString();
      localStorage.setItem('alovida.onboarding.draft.' + formType, JSON.stringify({
        draftId: 'evidencia', formType, stepIndex: step, data: tipo, createdAt: ahora, updatedAt: ahora, percentComplete: 50,
      }));
      localStorage.setItem('alovida.onboarding.draft_id.' + formType, 'evidencia');
    }, f);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByTestId('onboarding-draft-resume').click({ timeout: 30000 });
    const titulo = page.locator('.paginated-form__titulo').first();
    await titulo.waitFor({ timeout: 30000 });
    await page.waitForTimeout(800);
    const tituloTexto = (await titulo.textContent())?.trim();
    const textoPagina = await page.locator('.paginated-form').first().innerText();
    const etiquetas = textoPagina.split('\n').filter((l) => /poder/i.test(l));
    await page.screenshot({ path: `${OUT}/${f.nombre}-1-rotulo.png`, fullPage: true });
    // Intentar avanzar sin el poder: debe frenar y mostrar el error de obligatorio.
    await page.getByTestId('paginated-form-continuar').last().click();
    await page.waitForTimeout(800);
    const tituloDespues = (await page.locator('.paginated-form__titulo').first().textContent())?.trim();
    const textoDespues = await page.locator('.paginated-form').first().innerText();
    const mensajes = textoDespues.split('\n').filter((l) => /obligatorio/i.test(l));
    await page.screenshot({ path: `${OUT}/${f.nombre}-2-error.png`, fullPage: true });
    resultados.push({ form: f.nombre, tipoSocietario: 'UNIPERSONAL', titulo: tituloTexto, lineasConPoder: etiquetas, tituloTrasContinuar: tituloDespues, seQuedoEnLaPagina: tituloDespues === tituloTexto, mensajesObligatorio: mensajes, tieneOpcional: /poder[^\n]*opcional/i.test(textoPagina), erroresJs: errores });
  } catch (e) {
    await page.screenshot({ path: `${OUT}/${f.nombre}-fallo.png`, fullPage: true }).catch(() => {});
    resultados.push({ form: f.nombre, error: String(e), erroresJs: errores });
  }
  await ctx.close();
}
await browser.close();
fs.writeFileSync(`${OUT}/resultados.json`, JSON.stringify(resultados, null, 2));
console.log(JSON.stringify(resultados, null, 2));
