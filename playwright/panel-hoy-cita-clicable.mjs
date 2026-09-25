/**
 * Queja del propietario (25/09/2026): en la primera pantalla del médico, la
 * tarjeta «Ahora» / «A continuación» y los renglones del día no se podían
 * tocar. Tienen que llevar a la cita para poder iniciarla.
 *
 * Recorre el flujo entero: entrar como médica → tocar la tarjeta → la agenda
 * ofrece «Iniciar consulta» (o «Continuar») → se llega a la consulta.
 *
 * Uso: `BASE=http://localhost:4200 yarn node playwright/panel-hoy-cita-clicable.mjs`
 */
import { chromium } from '@playwright/test';

const B = process.env.BASE ?? 'http://localhost:4200';
const OUT = process.env.OUT ?? 'artifacts/panel-hoy-cita-clicable';
const nav = await chromium.launch();
let fallos = 0;

function comprobar(ok, texto) {
  console.log(`${ok ? 'PASS' : 'FAIL'} · ${texto}`);
  if (!ok) fallos += 1;
}

async function entrar(pg) {
  await pg.goto(`${B}/auth`, { waitUntil: 'commit', timeout: 180000 });
  const destino = /\/(dashboard|auth\/organization)/;
  for (let i = 0; i < 6 && !destino.test(pg.url()); i += 1) {
    await pg.getByTestId('login-identifier').fill('medica@alovida.mock');
    await pg.getByTestId('login-password').fill('Alovida123!');
    await pg.getByTestId('login-submit').click({ timeout: 5000 }).catch(() => {});
    await pg.waitForURL(destino, { timeout: 10000 }).catch(() => {});
  }
  if (pg.url().includes('/auth/organization')) {
    await pg.getByTestId('tenant-opcion').first().click();
    await pg.waitForURL(/\/dashboard/, { timeout: 60000 });
  }
}

for (const [nombre, ancho, alto, tema] of [
  ['1280-oscuro', 1280, 720, 'dark'],
  ['390-claro', 390, 844, 'light'],
]) {
  const ctx = await nav.newContext({ viewport: { width: ancho, height: alto }, colorScheme: tema });
  const pg = await ctx.newPage();
  const errores = [];
  pg.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
  await entrar(pg);

  const tarjeta = pg.getByTestId('panel-hoy-destacada');
  await tarjeta.waitFor({ timeout: 30000 });
  await tarjeta.scrollIntoViewIfNeeded();
  await pg.screenshot({ path: `${OUT}/${nombre}-1-panel.png` });
  const paciente = (await tarjeta.locator('.ahora__paciente').innerText()).trim();

  // Se toca la HORA de la tarjeta, no el nombre: toda la superficie tiene que responder.
  await tarjeta.locator('.ahora__hora').click();
  await pg.waitForURL(/\/schedule/, { timeout: 30000 });
  const dialogo = pg.getByRole('dialog');
  await dialogo.waitFor({ timeout: 30000 });
  const iniciar = dialogo.getByRole('button', { name: /Iniciar consulta|Continuar consulta/ });
  await iniciar.waitFor({ timeout: 10000 });
  const textoDialogo = await dialogo.innerText();
  comprobar(textoDialogo.includes(paciente), `${nombre}: el diálogo es de ${paciente}`);
  await pg.screenshot({ path: `${OUT}/${nombre}-2-dialogo.png` });

  await iniciar.click();
  await pg.waitForURL(/\/medical-records\/[^/]+\/consultation/, { timeout: 30000 }).catch(() => {});
  comprobar(/\/consultation/.test(pg.url()), `${nombre}: llegó a la consulta (${pg.url().replace(B, '')})`);
  await pg.waitForTimeout(1000);
  await pg.screenshot({ path: `${OUT}/${nombre}-3-consulta.png` });

  // Un renglón del resto del día también lleva a su cita.
  await pg.goto(`${B}/dashboard`);
  const fila = pg.getByTestId('panel-hoy-fila-abrir').first();
  if (await fila.count()) {
    const nombreFila = (await fila.innerText()).trim();
    await fila.locator('xpath=ancestor::li').locator('time').click();
    await pg.getByRole('dialog').waitFor({ timeout: 30000 });
    comprobar((await pg.getByRole('dialog').innerText()).includes(nombreFila), `${nombre}: el renglón abre la cita de ${nombreFila}`);
  }

  comprobar(errores.length === 0, `${nombre}: consola sin errores (${errores.slice(0, 3).join(' | ')})`);
  await ctx.close();
}

await nav.close();
console.log(fallos === 0 ? 'VEREDICTO: PASS' : `VEREDICTO: FAIL (${fallos})`);
process.exit(fallos === 0 ? 0 : 1);
