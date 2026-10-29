/**
 * Prueba funcional y visual de «Registrar médico» (administración › Usuarios).
 *
 * Contra la API real (`E2E_MODO=real`) recorre la mutación entera:
 *   UI → request → response → persistencia → recarga → UI
 *   1. el administrador abre Usuarios, ve el botón y entra a la pantalla;
 *   2. envía vacío y cae en la pestaña del primer error (sin red);
 *   3. completa las tres pestañas y envía: debe salir un POST 201 a
 *      `/iam/users/assisted-practitioner-registration` sin `password` en el cuerpo;
 *   4. la pantalla muestra el código una vez y la matrícula PENDING;
 *   5. el médico activa su cuenta con ese código en `/auth/activate`, inicia sesión
 *      y entra (la persistencia se comprueba además por SQL, fuera de este script);
 *   6. un segundo alta con el mismo correo se señala en el campo (409) y conserva lo escrito.
 * Por cada ancho (390/820/1440) y tema (claro/oscuro) captura las tres pestañas y el
 * resultado, y mide que la tarjeta quede centrada y ocupe el área (regla del cliente).
 *
 *   node playwright/superadmin-registrar-medico.mjs [carpeta-de-salida]
 *
 * Variables: `E2E_BASE_URL`, `E2E_MODO` (real|demo), `E2E_IDENTIFICADOR`, `E2E_CLAVE`,
 * `E2E_CHROMIUM`, `SOLO_VIEWPORT`, `SOLO_TEMA`, `E2E_CORREO` (correo del médico).
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { chromium } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:4200';
const MODO = process.env.E2E_MODO ?? 'demo';
const SALIDA = process.argv[2] ?? path.join(process.cwd(), 'artifacts', 'superadmin-registrar-medico');
const ADMIN = {
  identificador: process.env.E2E_IDENTIFICADOR ?? 'admin@alovida.mock',
  clave: process.env.E2E_CLAVE ?? 'S3cret-passw0rd',
};
const CLAVE_MEDICO = 'MedicoNuevo-2026';
const VIEWPORTS = [
  { nombre: 'telefono', width: 390, height: 844 },
  { nombre: 'tableta', width: 820, height: 1180 },
  { nombre: 'escritorio', width: 1440, height: 900 },
].filter((v) => !process.env.SOLO_VIEWPORT || v.nombre === process.env.SOLO_VIEWPORT);
const TEMAS = process.env.SOLO_TEMA ? [process.env.SOLO_TEMA] : ['light', 'dark'];
const SUFIJO = Date.now().toString(36);

const fallos = [];
const falla = (donde, mensaje) => {
  fallos.push(`${donde}: ${mensaje}`);
  console.error(`  ✗ ${donde}: ${mensaje}`);
};
const ok = (mensaje) => console.log(`  ✓ ${mensaje}`);

async function entrar(page, identificador, clave) {
  await page.goto(`${BASE}/auth`);
  await page.waitForFunction(() => document.querySelector('app-root')?.children.length > 0, null, { timeout: 30_000 });
  await page.getByTestId('login-identifier').fill(identificador);
  await page.getByTestId('login-password').fill(clave);
  await page.getByTestId('login-submit').click();
  await page.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60_000 });
  if (page.url().includes('/auth/organization')) {
    await page.getByTestId('tenant-opcion').first().click();
    await page.waitForURL(/\/dashboard/, { timeout: 60_000 });
  }
}

async function captura(page, archivo, viewport) {
  const alto = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight));
  await page.setViewportSize({ width: viewport.width, height: Math.min(Math.max(alto, viewport.height), 7000) });
  await page.waitForTimeout(250);
  await page.screenshot({ path: archivo });
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
}

async function irA(page, ruta) {
  await page.evaluate((destino) => {
    window.history.pushState({}, '', destino);
    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
  }, ruta);
}

async function pestana(page, nombre) {
  await page.getByRole('tab', { name: nombre }).click();
}

/** Holgura izquierda y derecha de la tarjeta respecto del área de contenido, y cuánto ocupa. */
async function medirCentrado(page) {
  return page.evaluate(() => {
    const area = document.querySelector('.app-main__inner')?.getBoundingClientRect();
    const tarjeta = document.querySelector('app-practitioner-assisted-registration app-card')?.getBoundingClientRect();
    if (!area || !tarjeta) return null;
    return {
      izquierda: Math.round(tarjeta.left - area.left),
      derecha: Math.round(area.right - tarjeta.right),
      ocupa: Math.round((tarjeta.width / area.width) * 100),
    };
  });
}

/** Elige la primera opción de un selector y espera a que su diálogo termine de cerrarse. */
async function elegirPrimera(page) {
  await page.locator('dialog.select-dialog li[role="option"]').first().click();
  await page.locator('dialog.select-dialog').waitFor({ state: 'detached', timeout: 10_000 });
}

async function completar(page, correo, motivo) {
  await pestana(page, 'Médico');
  await page.getByTestId('alta-medico-nombre').fill('Luis');
  await page.getByTestId('alta-medico-apellido-paterno').fill(`Rojas${SUFIJO}`);
  await page.getByTestId('alta-medico-correo').fill(correo);
  await pestana(page, 'Documento y matrícula');
  await page.getByTestId('alta-medico-cedula').fill(`9${Date.now().toString().slice(-6)}`);
  await page.getByRole('combobox', { name: /Departamento que la emitió/ }).click();
  await elegirPrimera(page);
  await page.getByTestId('alta-medico-matricula-numero').fill(`MP-${SUFIJO}`);
  await page.getByTestId('alta-medico-agregar-especialidad').click();
  await page.getByTestId('alta-medico-especialidad-0').click();
  await elegirPrimera(page);
  await pestana(page, 'Habilitación y motivo');
  await page.getByLabel(/Motivo del registro asistido/).fill(motivo);
}

async function main() {
  await mkdir(SALIDA, { recursive: true });
  const navegador = await chromium.launch(process.env.E2E_CHROMIUM ? { executablePath: process.env.E2E_CHROMIUM } : {});
  const informe = [];

  for (const viewport of VIEWPORTS) {
    for (const tema of TEMAS) {
      const id = `${viewport.nombre}-${tema}`;
      console.log(`\n== ${id}`);
      const contexto = await navegador.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        locale: 'es-BO',
        timezoneId: 'America/La_Paz',
        colorScheme: tema === 'dark' ? 'dark' : 'light',
      });
      await contexto.addInitScript(([k, v]) => {
        try {
          window.localStorage.setItem(k, v);
        } catch {
          /* modo privado */
        }
      }, ['mantra-core-health.theme', tema]);
      const page = await contexto.newPage();
      const consola = [];
      const malas = [];
      const peticiones = [];
      page.on('console', (m) => m.type() === 'error' && consola.push(m.text().slice(0, 200)));
      page.on('pageerror', (e) => consola.push(`pageerror: ${String(e).slice(0, 200)}`));
      page.on('request', (r) => {
        if (r.method() === 'POST' && r.url().includes('assisted-practitioner-registration')) {
          peticiones.push({ url: new URL(r.url()).pathname, cuerpo: r.postDataJSON() });
        }
      });
      page.on('response', (r) => {
        if (r.status() >= 400 && /\/(iam|terminology|authz)\//.test(r.url())) malas.push(`${r.status()} ${new URL(r.url()).pathname}`);
      });

      await entrar(page, ADMIN.identificador, ADMIN.clave);

      // 1. Usuarios ofrece el botón y lleva a la pantalla.
      await irA(page, '/administration/users');
      const boton = page.getByTestId('usuarios-registrar-medico');
      await boton.waitFor({ timeout: 20_000 });
      await boton.click();
      await page.getByTestId('alta-medico-form').waitFor({ timeout: 20_000 });
      if (!page.url().endsWith('/administration/users/practitioner')) falla(id, `la URL es ${page.url()}`);
      else ok('Usuarios → «Registrar médico» abre la pantalla');

      // 2. Centrado y a lo ancho (regla del cliente §5).
      const medida = await medirCentrado(page);
      if (!medida) falla(id, 'no se pudo medir la tarjeta');
      else {
        informe.push({ id, medida });
        if (Math.abs(medida.izquierda - medida.derecha) > 2) falla(id, `tarjeta descentrada: ${medida.izquierda}px / ${medida.derecha}px`);
        else if (medida.ocupa < 85) falla(id, `la tarjeta ocupa ${medida.ocupa}% del área`);
        else ok(`tarjeta centrada (${medida.izquierda}/${medida.derecha}px) y a lo ancho (${medida.ocupa}%)`);
      }
      await captura(page, path.join(SALIDA, `01-medico-${id}.png`), viewport);

      // 3. Enviar vacío: cae en la pestaña del primer error, sin red.
      const antes = peticiones.length;
      await page.getByTestId('alta-medico-enviar').click();
      await page.waitForTimeout(400);
      if (peticiones.length !== antes) falla(id, 'el envío vacío salió a la red');
      const alertas = await page.locator('app-form-field [role="alert"], app-form-field .form-field__error').count();
      if (alertas === 0) falla(id, 'el envío vacío no señala ningún campo');
      else ok(`el envío vacío señala ${alertas} campo(s) y no sale a la red`);
      await captura(page, path.join(SALIDA, `02-errores-${id}.png`), viewport);

      await pestana(page, 'Documento y matrícula');
      await captura(page, path.join(SALIDA, `03-documento-${id}.png`), viewport);
      await pestana(page, 'Habilitación y motivo');
      await captura(page, path.join(SALIDA, `04-habilitacion-${id}.png`), viewport);

      // 4. El alta real y todo lo que sigue sólo en un par (escritorio claro): crea datos.
      if (!(viewport.nombre === 'escritorio' && tema === 'light')) {
        if (consola.length) falla(id, `errores de consola: ${consola.join(' | ')}`);
        await contexto.close();
        continue;
      }

      const correo = process.env.E2E_CORREO ?? `medico.${SUFIJO}@mantra.test`;
      await completar(page, correo, 'Está de viaje y no puede registrarse por sí mismo');
      await captura(page, path.join(SALIDA, '05-completo-escritorio-light.png'), viewport);
      const respuesta = page.waitForResponse((r) => r.url().includes('assisted-practitioner-registration') && r.request().method() === 'POST');
      await page.getByTestId('alta-medico-enviar').click();
      const res = await respuesta.catch(async (e) => {
        const visibles = await page.locator('app-form-field').evaluateAll((els) => els.map((el) => el.textContent?.replace(/\s+/g, ' ').trim().slice(0, 140)));
        await captura(page, path.join(SALIDA, '05b-no-envio.png'), viewport);
        throw new Error(`el alta no salió a la red: ${e.message.split('\n')[0]} · campos: ${JSON.stringify(visibles)}`);
      });
      if (res.status() !== 201) falla(id, `el alta respondió ${res.status()}: ${(await res.text()).slice(0, 200)}`);
      else ok('POST /iam/users/assisted-practitioner-registration → 201');
      const enviado = peticiones.at(-1)?.cuerpo ?? {};
      if ('password' in enviado) falla(id, 'el cuerpo lleva contraseña');
      else ok(`el cuerpo no lleva contraseña (campos: ${Object.keys(enviado).join(', ')})`);

      await page.getByTestId('alta-medico-exito').waitFor({ timeout: 20_000 });
      const token = (await page.getByTestId('alta-medico-token').textContent())?.trim() ?? '';
      const matricula = (await page.getByTestId('alta-medico-matricula').textContent())?.trim();
      if (!token) falla(id, 'no se mostró el código de activación');
      else ok('se muestra el código de activación una vez');
      if (matricula !== 'PENDING') falla(id, `la matrícula dice ${matricula}`);
      else ok('la matrícula figura PENDING');
      await captura(page, path.join(SALIDA, '06-resultado-escritorio-light.png'), viewport);
      await writeFile(path.join(SALIDA, 'resultado.json'), JSON.stringify({ correo, codigoDeProfesional: await page.getByTestId('alta-medico-codigo').textContent(), cuerpo: enviado }, null, 2));

      // 5. Un segundo alta con el mismo correo: 409 señalado en el campo, sin perder lo escrito.
      await page.getByTestId('alta-medico-otra').click();
      await page.getByTestId('alta-medico-form').waitFor();
      await completar(page, correo, 'Intento repetido');
      const segunda = page.waitForResponse((r) => r.url().includes('assisted-practitioner-registration') && r.request().method() === 'POST');
      await page.getByTestId('alta-medico-enviar').click();
      const res2 = await segunda;
      if (res2.status() !== 409) falla(id, `el alta repetida respondió ${res2.status()}`);
      else ok('el correo repetido responde 409');
      await pestana(page, 'Médico');
      const valor = await page.getByTestId('alta-medico-correo').inputValue();
      if (valor !== correo) falla(id, 'se perdió lo escrito tras el 409');
      else ok('tras el 409 se conserva lo escrito');
      const textoCorreo = (await page.locator('app-form-field').filter({ hasText: 'Correo' }).first().textContent()) ?? '';
      if (!/ya existe|existe una cuenta|registrad/i.test(textoCorreo + ((await page.getByTestId('alta-medico-error').textContent().catch(() => '')) ?? ''))) {
        falla(id, 'el 409 no explica que el correo ya existe');
      }
      await captura(page, path.join(SALIDA, '07-conflicto-escritorio-light.png'), viewport);
      await contexto.close();

      // 6. El médico activa su cuenta con el código y entra.
      const ctxMedico = await navegador.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-BO' });
      const medico = await ctxMedico.newPage();
      await medico.goto(`${BASE}/auth/activate?token=${encodeURIComponent(token)}`);
      await medico.getByTestId('activar-password').waitFor({ timeout: 30_000 });
      await medico.getByTestId('activar-password').fill(CLAVE_MEDICO);
      await medico.getByTestId('activar-submit').click();
      await medico.getByTestId('activar-ok').waitFor({ timeout: 30_000 });
      ok('el médico activó su cuenta con el código');
      await entrar(medico, correo, CLAVE_MEDICO);
      ok(`el médico inicia sesión (${new URL(medico.url()).pathname})`);
      await captura(medico, path.join(SALIDA, '08-medico-dentro.png'), { width: 1440, height: 900 });
      await ctxMedico.close();
    }
  }

  await navegador.close();
  await writeFile(path.join(SALIDA, 'informe.json'), JSON.stringify({ modo: MODO, medidas: informe, fallos }, null, 2));
  if (fallos.length) {
    console.error(`\n✗ ${fallos.length} fallo(s)`);
    process.exit(1);
  }
  console.log('\n✓ sin fallos');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
