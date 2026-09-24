/**
 * H4.S3 — las tres tablas del editor: filtro «Estado», paginación, alto máximo y acciones de fila.
 * Uso (desde la carpeta del trabajo): yarn node evidencia/h4/capturas-h4s3.mjs <urlBase>
 * Sólo la cuenta sintética `medica@alovida.mock`. Los títulos, la especialidad y la matrícula que
 * hacen falta para ver dos páginas y dos estados se cargan con el cliente de la propia app contra
 * el simulador —el mismo camino que usa el alta—, no se escriben a mano en la vista.
 * Escribe en `evidencia/h4/`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.argv[2];
if (!BASE) throw new Error('Falta la URL de la app como primer argumento.');
const DIR = new URL('./', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const CAPS = `${DIR}capturas`;
mkdirSync(CAPS, { recursive: true });

const SELLO = String(Date.now()).slice(-5);
const lineas = [];
const log = (t) => {
  lineas.push(t);
  process.stdout.write(t + '\n');
};
const consola = [];
const red = [];
const plano = (t) => (t ?? '').replace(/\s+/g, ' ').trim();
const esperar = (p, ms = 600) => p.waitForTimeout(ms);

const SECCION = {
  titulos: 'edicion-formacion-cargada',
  especialidades: 'edicion-especialidades-cargadas',
  matriculas: 'edicion-matriculas-cargadas',
};
const TABLA = { titulos: 'tabla-formacion', especialidades: 'tabla-especialidades', matriculas: 'tabla-matriculas' };
const PAGINADOR = { titulos: 'paginacion-formacion', especialidades: 'paginacion-especialidades', matriculas: 'paginacion-matriculas' };

async function nuevaPagina(navegador, { ancho, alto, tema }) {
  const ctx = await navegador.newContext({
    viewport: { width: ancho, height: alto },
    colorScheme: tema,
  });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => consola.push(`[pageerror] ${p.url()} — ${String(e).split('\n')[0]}`));
  p.on('console', (m) => {
    if (m.text().includes('Content Security Policy')) return;
    if (m.type() === 'error' || m.type() === 'warning' || m.text().includes('[mock] sin manejador')) {
      consola.push(`[${m.type()}] ${p.url()} — ${m.text().slice(0, 300)}`);
    }
  });
  p.on('response', (r) => {
    if (r.status() >= 400) red.push(`${r.status()} ${r.request().method()} ${r.url()}`);
  });
  p.on('requestfailed', (r) => red.push(`FAILED ${r.method()} ${r.url()} — ${r.failure()?.errorText}`));
  await p.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await p.getByTestId('login-identifier').fill('medica@alovida.mock');
  await p.getByTestId('login-password').fill('mockup');
  await p.getByTestId('login-submit').click();
  await p.waitForURL(/\/(dashboard|auth\/organization|my-account|home|directory)/, { timeout: 90_000 }).catch(() => {});
  if (p.url().includes('/auth/organization')) {
    await p.getByTestId('tenant-opcion').first().click();
    await esperar(p, 1500);
  }
  return p;
}

const tab = (p, nombre) => p.locator('[data-testid="edicion-pestanas"] [role="tab"]', { hasText: nombre });
const filas = (p, tabla) => p.locator(`[data-testid="${TABLA[tabla]}"] tbody tr.data-table__row`);
const rango = async (p, tabla) => plano(await p.getByTestId(PAGINADOR[tabla]).locator('.pagination__range').innerText());
const barra = (p, tabla) => p.getByTestId(SECCION[tabla]).locator('app-filter-bar');

async function abrirEditor(p, pestana) {
  await p.goto(`${BASE}/my-account/edit`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await tab(p, 'Datos personales').waitFor({ timeout: 60_000 });
  await esperar(p, 800);
  await irA(p, pestana);
}

async function irA(p, pestana) {
  await tab(p, pestana).click();
  const tabla = pestana === 'Trayectoria' ? 'titulos' : 'matriculas';
  await filas(p, tabla).first().waitFor({ timeout: 30_000 });
  await esperar(p, 900);
}

/** Ancho y alto de una tabla: si se desplaza a lo ancho y si tiene alto máximo con desplazamiento vertical. */
const medida = (p, tabla) =>
  p.getByTestId(TABLA[tabla]).evaluate((host) => {
    const caja = host.querySelector('.data-table__scroll');
    return {
      ancho: `${caja.scrollWidth}/${caja.clientWidth}`,
      lateral: caja.scrollWidth > caja.clientWidth,
      altoMaximo: caja.style.maxHeight || 'ninguno',
      vertical: caja.scrollHeight > caja.clientHeight,
    };
  });

/** Carga, con el cliente de la app, lo que hace falta para ver dos páginas y dos estados. */
async function sembrar(p) {
  return p.evaluate(async (sello) => {
    const host = document.querySelector('app-practitioner-profile-edit');
    const c = window.ng.getComponent(host);
    const cumplir = (obs) => new Promise((ok, mal) => obs.subscribe({ next: ok, error: mal }));
    const hasta = async (cond) => {
      for (let i = 0; i < 80 && !cond(); i++) await new Promise((r) => setTimeout(r, 250));
    };
    await hasta(() => c.datos() !== null && c.especialidades().length > 0);
    const datos = c.datos();
    const tipo = datos.credentials[0].credentialTypeConceptId;
    const diploma = datos.credentials.find((x) => x.fileId !== undefined)?.fileId;
    for (let i = 1; i <= 10; i++) {
      await cumplir(
        c.profiles.addOwnCredential({
          credentialTypeConceptId: tipo,
          number: `PAG-${sello}-${String(i).padStart(2, '0')}`,
          issuingInstitutionText: 'Universidad Mayor de San Simón',
          // El primero, con diploma y más reciente que los sembrados: queda en la página 1 con tres acciones.
          issueDate: i === 1 ? '2018-05-15' : `2010-${String(i).padStart(2, '0')}-15`,
          ...(i === 1 && diploma !== undefined ? { fileId: diploma } : {}),
        }),
      );
    }
    const presentes = new Set(datos.specialties.map((s) => s.specialtyConceptId));
    const libre = c.especialidades().find((o) => !presentes.has(o.value));
    if (libre !== undefined) {
      await cumplir(c.profiles.addSpecialty(datos.profileId, { specialtyConceptId: libre.value, isPrimary: false, boardCertified: false }));
    }
    await cumplir(c.profiles.addJurisdictionAuthorization(datos.profileId, { licenseNumber: `MAT-${sello}`, regulatoryAuthority: 'SEDES La Paz' }));
    return { titulosAntes: datos.credentials.length, especialidad: libre?.label ?? null, diploma: diploma !== undefined };
  }, SELLO);
}

async function capturarSecciones(p, ancho, tema) {
  for (const tabla of ['titulos', 'especialidades', 'matriculas']) {
    await irA(p, tabla === 'titulos' ? 'Trayectoria' : 'Credenciales');
    const seccion = p.getByTestId(SECCION[tabla]);
    await seccion.scrollIntoViewIfNeeded();
    await esperar(p, 400);
    const m = await medida(p, tabla);
    log(`H4.S3.M4 · ${ancho} ${tema} · ${tabla}: ancho ${m.ancho} · lateral=${m.lateral} · alto máximo ${m.altoMaximo} · desplaza a lo alto=${m.vertical} · filas en la página=${await filas(p, tabla).count()} · paginador «${await rango(p, tabla)}»`);
    const paginador = await p.getByTestId(PAGINADOR[tabla]).evaluate((host) => {
      const borde = host.closest('section').getBoundingClientRect().right;
      const derecha = Math.max(...[...host.querySelectorAll('*')].map((el) => el.getBoundingClientRect().right));
      return { derecha: Math.round(derecha), borde: Math.round(borde), seSale: derecha > borde + 0.5 };
    });
    log(`H4.S3.M3 · ${ancho} ${tema} · ${tabla}: paginador hasta x=${paginador.derecha} · borde de la sección x=${paginador.borde} · se sale=${paginador.seSale}`);
    // El encabezado de la app es fijo y taparía el comienzo de la sección en la foto: sólo para la
    // captura, se lo deja correr con la página. No cambia el diseño de nada más.
    await p.evaluate(() => document.querySelector('header[app-header]')?.style.setProperty('position', 'relative'));
    await seccion.screenshot({ path: `${CAPS}/h4s3-${tabla}-${ancho}-${tema === 'light' ? 'claro' : 'oscuro'}.png` });
    await p.evaluate(() => document.querySelector('header[app-header]')?.style.removeProperty('position'));
  }
}

/** El simulador vive en cada navegador: cada contexto carga lo suyo antes de mirar. */
async function preparar(p) {
  await abrirEditor(p, 'Trayectoria');
  const sembrado = await sembrar(p);
  await p.reload({ waitUntil: 'domcontentloaded' });
  await tab(p, 'Datos personales').waitFor({ timeout: 60_000 });
  await irA(p, 'Trayectoria');
  return sembrado;
}

async function principal(navegador) {
  const p = await nuevaPagina(navegador, { ancho: 1440, alto: 1000, tema: 'light' });
  const sembrado = await preparar(p);
  log(`preparación · títulos antes=${sembrado.titulosAntes} · 10 títulos nuevos (PAG-${SELLO}-01…10, el 01 con diploma) · especialidad pendiente «${sembrado.especialidad}» · matrícula pendiente MAT-${SELLO}`);

  // M3 · paginación de los títulos.
  const total = await p.evaluate(() => window.ng.getComponent(document.querySelector('app-practitioner-profile-edit')).filasFormacion().length);
  log(`H4.S3.M3 · títulos cargados=${total} · filas en la página 1=${await filas(p, 'titulos').count()} · paginador «${await rango(p, 'titulos')}»`);
  const paginador = p.getByTestId(PAGINADOR.titulos);
  const caja = await paginador.boundingBox();
  const seccion = await p.getByTestId(SECCION.titulos).boundingBox();
  log(`H4.S3.M3 · paginador a la derecha: borde derecho del paginador ${Math.round(caja.x + caja.width)} · de la sección ${Math.round(seccion.x + seccion.width)} · debajo de la tabla=${caja.y > (await p.getByTestId(TABLA.titulos).boundingBox()).y}`);
  await paginador.getByRole('button', { name: 'Página siguiente' }).click();
  await esperar(p);
  log(`H4.S3.M3 · «Siguiente» → filas=${await filas(p, 'titulos').count()} · paginador «${await rango(p, 'titulos')}»`);
  await p.getByTestId(SECCION.titulos).screenshot({ path: `${CAPS}/h4s3-titulos-pagina-2.png` });
  const buscador = barra(p, 'titulos').locator('input').first();
  await buscador.fill(`PAG-${SELLO}`);
  await esperar(p, 900);
  log(`H4.S3.M3 · buscar «PAG-${SELLO}» desde la página 2 → vuelve a la 1: paginador «${await rango(p, 'titulos')}» · filas=${await filas(p, 'titulos').count()}`);
  await buscador.fill('');
  await esperar(p, 900);
  await paginador.locator('.pagination__size select').selectOption({ label: '20 por página' });
  await esperar(p);
  log(`H4.S3.M3 · «20 por página» → filas=${await filas(p, 'titulos').count()} · paginador «${await rango(p, 'titulos')}»`);
  await paginador.locator('.pagination__size select').selectOption({ label: '10 por página' });
  await esperar(p);

  // M7 · acciones de fila de los títulos.
  const conDiploma = p.locator(`[data-testid="${TABLA.titulos}"] tbody tr.data-table__row`, { hasText: `PAG-${SELLO}-01` });
  const sinDiploma = p.locator(`[data-testid="${TABLA.titulos}"] tbody tr.data-table__row`, { hasText: `PAG-${SELLO}-10` });
  const verificado = p.locator(`[data-testid="${TABLA.titulos}"] tbody tr.data-table__row`, { hasText: 'ESP-1000' });
  const resumen = async (fila) => ({
    disparador: await fila.getByTestId('row-actions-trigger').count(),
    enFila: (await fila.locator('.row-actions__inline').allInnerTexts()).map(plano),
    nota: await fila.locator('.edicion__acciones-nota').count(),
  });
  log(`H4.S3.M7 · título pendiente con diploma: ${JSON.stringify(await resumen(conDiploma))}`);
  log(`H4.S3.M7 · título pendiente sin diploma: ${JSON.stringify(await resumen(sinDiploma))}`);
  log(`H4.S3.M7 · título verificado: ${JSON.stringify(await resumen(verificado))}`);
  await conDiploma.getByTestId('row-actions-trigger').click();
  await esperar(p, 400);
  const opciones = (await p.locator('app-menu-item >> visible=true').allInnerTexts()).map(plano);
  log(`H4.S3.M7 · «Acciones» abre el desplegable con: ${opciones.join(' · ')}`);
  await p.screenshot({ path: `${CAPS}/h4s3-titulos-menu-acciones.png` });
  await p.locator('app-menu-item[data-action="editar"] >> visible=true').first().click();
  const modal = p.locator('dialog[open]').first();
  await modal.waitFor({ timeout: 10_000 });
  log(`H4.S3.M7 · «Editar» del desplegable abre «${plano(await modal.locator('h2, [data-testid$="titulo"]').first().innerText().catch(() => '?'))}»`);
  await p.keyboard.press('Escape');
  await modal.waitFor({ state: 'detached', timeout: 10_000 }).catch(() => {});
  await esperar(p);

  // M1 · filtro «Estado» de especialidades y matrículas.
  await irA(p, 'Credenciales');
  for (const tabla of ['especialidades', 'matriculas']) {
    const selector = barra(p, tabla).locator('select').first();
    const opcionesEstado = (await selector.locator('option').allInnerTexts()).map(plano).filter(Boolean);
    const antes = await filas(p, tabla).count();
    log(`H4.S3.M1 · ${tabla}: filtro «Estado» con ${opcionesEstado.join(' · ')} · filas sin filtro=${antes}`);
    for (const etiqueta of opcionesEstado.filter((o) => !/^(Estado|Todos|Elegí|Seleccion)/i.test(o))) {
      await selector.selectOption({ label: etiqueta });
      await esperar(p, 900);
      const estados = (await filas(p, tabla).evaluateAll((trs) => trs.length)) || 0;
      const url = [...new URL(p.url()).searchParams.entries()].map(([k, v]) => `${k}=${v.length > 20 ? v.slice(0, 8) + '…' : v}`).join('&');
      log(`H4.S3.M1 · ${tabla}: «${etiqueta}» → filas=${estados} · URL ${url || '(ninguna)'} · «sin coincidencias»=${await p.getByTestId(`${tabla}-sin-coincidencias`).count()}`);
    }
    if (tabla === 'matriculas') {
      await p.getByTestId(SECCION.matriculas).screenshot({ path: `${CAPS}/h4s3-matriculas-filtro-estado.png` });
    }
    const limpiar = barra(p, tabla).getByRole('button', { name: /limpiar|quitar/i }).first();
    if (await limpiar.count()) {
      await limpiar.click();
    } else {
      await selector.selectOption({ index: 0 });
    }
    await esperar(p, 900);
    log(`H4.S3.M1 · ${tabla}: sin filtro otra vez → filas=${await filas(p, tabla).count()}`);
  }
  const esp = p.locator(`[data-testid="${TABLA.especialidades}"] tbody tr.data-table__row`).first();
  const mat = p.locator(`[data-testid="${TABLA.matriculas}"] tbody tr.data-table__row`).first();
  log(`H4.S3.M7 · especialidad: ${JSON.stringify(await resumen(esp))}`);
  log(`H4.S3.M7 · matrícula con carnet: ${JSON.stringify(await resumen(mat))}`);

  await capturarSecciones(p, 1440, 'light');
  await p.context().close();
}

async function main() {
  const navegador = await chromium.launch();
  try {
    await principal(navegador);
    for (const [ancho, alto, tema] of [
      [1440, 1000, 'dark'],
      [768, 1024, 'light'],
      [768, 1024, 'dark'],
      [375, 812, 'light'],
      [375, 812, 'dark'],
    ]) {
      const p = await nuevaPagina(navegador, { ancho, alto, tema });
      await preparar(p);
      await capturarSecciones(p, ancho, tema);
      await p.context().close();
    }
  } finally {
    await navegador.close();
  }
  writeFileSync(`${DIR}comportamiento-h4s3.txt`, lineas.join('\n') + '\n');
  const unicos = (xs) => [...new Set(xs)];
  writeFileSync(
    `${DIR}consola-red-h4s3.txt`,
    `# Consola y red de H4.S3 — ${new Date().toISOString()}\n\n## Consola (error/warning)\n${consola.length ? unicos(consola).join('\n') : 'ninguno'}\n\n## Red (>= 400 o fallida)\n${red.length ? unicos(red).join('\n') : 'ninguna'}\n`,
  );
  log(`consola: ${unicos(consola).length} distintas · red: ${unicos(red).length} distintas`);
}
main().catch((e) => {
  process.stderr.write(String(e?.stack ?? e) + '\n');
  process.exitCode = 2;
});
