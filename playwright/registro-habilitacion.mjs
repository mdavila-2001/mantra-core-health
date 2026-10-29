/**
 * Evidencia del paso «Su habilitación para ejercer» del alta de médico, contra la maqueta:
 *
 * - Tres renglones —matrícula, SEDES y colegio— y cada uno con SU número, SU fecha de
 *   inscripción y SU respaldo (propietario, 27/10/2026).
 * - El colegio es el de la profesión elegida antes: Médico → Colegio Médico de Bolivia,
 *   Odontólogo → Colegio de Odontólogos de Bolivia.
 * - Sin el número del colegio el paso no deja avanzar; con los tres, sí.
 * - Una sola tarjeta centrada, sin desborde horizontal a 390 px; claro y oscuro.
 *
 * Se llega al paso por el borrador guardado que la propia pantalla ofrece retomar: el
 * recorrido entero exige marcar el domicilio en un mapa, que no es lo que se prueba acá.
 *
 * Uso: `node playwright/registro-habilitacion.mjs [urlBase]`
 */
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:4300';
const SALIDA = fileURLToPath(
  new URL('../evidencias/registro-habilitacion-2026-10-27', import.meta.url),
);
const veredictos = [];
const ok = (nombre, cond, detalle = '') => {
  veredictos.push({ nombre, cond: Boolean(cond), detalle });
  process.stdout.write(`${cond ? '✔' : '✘'} ${nombre}${detalle ? ' — ' + detalle : ''}\n`);
};

/** Índice de «Su habilitación para ejercer» en `practitionerFields`. */
const PASO_HABILITACION = 6;

function borrador(titulo) {
  const ahora = new Date().toISOString();
  return {
    draftId: 'evidencia-habilitacion',
    formType: 'practitioner',
    stepIndex: PASO_HABILITACION,
    stepKey: 'credentials',
    stepTitle: 'Su habilitación para ejercer',
    data: {
      name: 'Ana',
      lastName: 'Paz',
      nationalId: '1234567',
      personalEmail: 'ana.paz@example.test',
      mobilePhone: '+591 70012345',
      sexAtBirth: 'FEMALE',
      birthDate: '1985-05-12T04:00:00.000Z',
      professionalTitle: titulo,
    },
    extraData: { gpsDomicilio: { lat: -17.7833, lng: -63.1821 } },
    createdAt: ahora,
    updatedAt: ahora,
    percentComplete: 60,
  };
}

async function abrirEnHabilitacion(p, titulo) {
  await p.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded', timeout: 240_000 });
  await p.evaluate((d) => {
    localStorage.setItem('alovida.onboarding.draft.practitioner', JSON.stringify(d));
  }, borrador(titulo));
  await p.goto(`${BASE}/auth/register/practitioner`, {
    waitUntil: 'domcontentloaded',
    timeout: 240_000,
  });
  await p.getByTestId('onboarding-draft-resume').click({ timeout: 120_000 });
  await p
    .locator('.paginated-form__titulo', { hasText: 'Su habilitación para ejercer' })
    .waitFor({ timeout: 60_000 });
  await p.waitForTimeout(500);
}

const renglones = (p) => p.locator('.registro-habilitacion');

async function main() {
  mkdirSync(SALIDA, { recursive: true });
  const navegador = await chromium.launch(
    process.env['PW_CHROMIUM'] ? { executablePath: process.env['PW_CHROMIUM'] } : {},
  );
  const errores = [];
  const ctx = await navegador.newContext({ viewport: { width: 1440, height: 1300 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errores.push(String(e)));

  // ---- Médico: tres renglones, cada uno con número, fecha y respaldo.
  await abrirEnHabilitacion(p, 'Médico / Médica');
  ok('hay tres renglones de habilitación', (await renglones(p).count()) === 3);
  const claves = await renglones(p).evaluateAll((els) =>
    els.map((el) => el.getAttribute('data-habilitacion')),
  );
  ok('en orden: matrícula, SEDES, colegio', claves.join(',') === 'license,sedes,college', claves.join(','));
  for (const clave of ['license', 'sedes', 'college']) {
    const r = p.locator(`.registro-habilitacion[data-habilitacion="${clave}"]`);
    ok(`«${clave}» tiene su número`, (await r.locator('input[type="text"], input:not([type])').first().count()) === 1);
    ok(`«${clave}» tiene su fecha`, (await r.getByTestId(`registro-pro-fecha-${clave}`).count()) === 1);
    ok(`«${clave}» tiene su respaldo`, (await r.getByTestId(`registro-pro-respaldo-${clave}`).count()) === 1);
  }
  const rotuloColegio = await p.locator('[data-campo="collegeLicenseNumber"] label').first().textContent();
  ok(
    'el colegio es el del título elegido (Médico)',
    /Colegio Médico de Bolivia/.test(rotuloColegio ?? ''),
    (rotuloColegio ?? '').trim(),
  );

  // Los tres números en una fila con su fecha y su archivo, a lo ancho.
  const fila = await p
    .locator('.registro-habilitacion[data-habilitacion="license"] .registro-habilitacion__grilla > *')
    .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
  ok('número, fecha y respaldo en la misma fila a 1440 px', new Set(fila).size === 1, fila.join(','));
  const tarjeta = await p.locator('.paginated-form').first().boundingBox();
  const vista = p.viewportSize();
  if (tarjeta && vista) {
    const izq = Math.round(tarjeta.x);
    const der = Math.round(vista.width - (tarjeta.x + tarjeta.width));
    ok('la tarjeta del formulario ocupa el ancho del área', tarjeta.width > 700, `${Math.round(tarjeta.width)} px · holgura ${izq}/${der}`);
  }
  await p.screenshot({ path: `${SALIDA}/medico-1440-claro.png`, fullPage: true });

  // Sin el número del colegio no se avanza.
  await p.getByTestId('registro-pro-matricula').fill('MP-12345');
  await p.getByTestId('registro-pro-credencial').fill('T.I. 538/14');
  await p.getByTestId('paginated-form-continuar').click();
  await p.waitForTimeout(700);
  const sigueAhi = await p.locator('.paginated-form__titulo', { hasText: 'Su habilitación para ejercer' }).count();
  const errorColegio = await p.locator('[data-campo="collegeLicenseNumber"]').textContent();
  ok('sin el registro del colegio el paso no avanza', sigueAhi === 1);
  ok('y lo dice en el renglón del colegio', /registro en el colegio/i.test(errorColegio ?? ''));
  await p.screenshot({ path: `${SALIDA}/medico-sin-colegio-error.png`, fullPage: true });

  await p.getByTestId('registro-pro-colegio').fill('CMB-4410');
  await p.getByTestId('paginated-form-continuar').click();
  await p
    .locator('.paginated-form__titulo', { hasText: 'Sus especialidades' })
    .waitFor({ timeout: 20_000 })
    .then(() => ok('con los tres números avanza al paso siguiente', true))
    .catch(() => ok('con los tres números avanza al paso siguiente', false));

  // ---- Odontólogo: el colegio cambia solo.
  await abrirEnHabilitacion(p, 'Odontólogo / Odontóloga');
  const rotuloOdonto = await p.locator('[data-campo="collegeLicenseNumber"] label').first().textContent();
  ok(
    'el colegio es el del título elegido (Odontólogo)',
    /Colegio de Odontólogos de Bolivia/.test(rotuloOdonto ?? ''),
    (rotuloOdonto ?? '').trim(),
  );

  // ---- Oscuro.
  await p.emulateMedia({ colorScheme: 'dark' });
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${SALIDA}/odontologo-1440-oscuro.png`, fullPage: true });
  await p.emulateMedia({ colorScheme: 'light' });

  // ---- Teléfono: una columna, sin desborde horizontal.
  await p.setViewportSize({ width: 390, height: 900 });
  await p.waitForTimeout(500);
  const desborde = await p.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  ok('sin desborde horizontal a 390 px', desborde <= 0, `${desborde} px`);
  const apilado = await p
    .locator('.registro-habilitacion[data-habilitacion="license"] .registro-habilitacion__grilla > *')
    .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
  ok('a 390 px número, fecha y respaldo se apilan', new Set(apilado).size === 3, apilado.join(','));
  await p.screenshot({ path: `${SALIDA}/odontologo-390-claro.png`, fullPage: true });

  ok('sin errores de página', errores.length === 0, errores.join(' | '));
  await navegador.close();

  const fallas = veredictos.filter((v) => !v.cond);
  process.stdout.write(`\n${veredictos.length - fallas.length}/${veredictos.length} verificaciones\n`);
  process.exit(fallas.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
