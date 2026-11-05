/**
 * La mutación del catálogo de datos, de punta a punta y contra la API real:
 *
 *   UI → petición → respuesta → fila en la base → vuelta a leer → UI
 *
 *  1. una persona (A) abre una ficha importada de la bóveda, la edita con texto
 *     propio y la envía a revisión → `PUT …/annotation` 200, `origin: MANUAL`,
 *     `NEEDS_REVIEW`; en la base, la ficha en revisión;
 *  2. A intenta aprobar su propia revisión → `POST …/review` 403 y la pantalla
 *     explica la segregación; en la base, ninguna decisión;
 *  3. otra persona (B) la aprueba → 200; en la base, una fila de decisión
 *     `APPROVED` con B como revisora y la ficha `APPROVED`;
 *  4. se vuelve a leer desde el servidor y la pantalla dice «Aprobada».
 *
 * Es demostrable sólo con la API real: el simulador no persiste. La base se
 * consulta con `psql` (variable `PSQL_URL`, por omisión la del entorno de pruebas).
 *
 *   E2E_CHROMIUM=… A_ID=… A_CLAVE=… B_ID=… B_CLAVE=… E2E_TABLA=iam.devices \
 *     node playwright/superadmin-catalogo-aprobacion.mjs [carpeta-de-salida]
 */
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { chromium } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:4200';
const SALIDA = process.argv[2] ?? path.join(process.cwd(), 'artifacts', 'superadmin-catalogo-aprobacion');
const A = { id: process.env.A_ID ?? 'admin@alovidasalud.com', clave: process.env.A_CLAVE ?? '12345678' };
const B = { id: process.env.B_ID ?? 'revisor@alovidasalud.com', clave: process.env.B_CLAVE ?? '12345678' };
const [SCHEMA, TABLA] = (process.env.E2E_TABLA ?? 'iam.devices').split('.');
const PSQL_URL = process.env.PSQL_URL ?? 'postgres://postgres@localhost:54329/alovida';

const registro = [];
const log = (m) => {
  registro.push(m);
  console.log(m);
};
let fallos = 0;
const comprobar = (condicion, mensaje) => {
  log(`${condicion ? '✓' : '✗'} ${mensaje}`);
  if (!condicion) fallos += 1;
};

const sql = (consulta) =>
  execFileSync('psql', [PSQL_URL, '-tA', '-F', '|', '-c', consulta], { encoding: 'utf8' }).trim();

async function entrar(page, cuenta) {
  await page.goto(`${BASE}/auth`);
  await page.waitForFunction(() => document.querySelector('app-root')?.children.length > 0, null, { timeout: 30_000 });
  await page.getByTestId('login-identifier').fill(cuenta.id);
  await page.getByTestId('login-password').fill(cuenta.clave);
  await page.getByTestId('login-submit').click();
  // El administrador con los dos accesos pasa por el selector de portal: tres destinos legítimos.
  await page.waitForURL(/\/(dashboard|auth\/organization|portal-selector)/, { timeout: 60_000 });
  if (page.url().includes('/auth/organization')) {
    await page.getByTestId('tenant-opcion').first().click();
    await page.waitForURL(/\/(dashboard|portal-selector)/, { timeout: 60_000 });
  }
  if (page.url().includes('/portal-selector')) {
    await page.getByRole('link', { name: /Portal de administración/ }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 60_000 });
  }
}

async function irA(page, ruta) {
  await page.evaluate((destino) => {
    window.history.pushState({}, '', destino);
    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
  }, ruta);
}

const ficha = (nombre) =>
  sql(
    `select a.review_status, a.origin, a.current_revision_no, coalesce(a.approved_revision_no::text,''), coalesce(a.approved_by_user_id::text,'')
       from data_catalog.catalog_annotations a join data_catalog.catalog_objects o on o.id = a.object_id
      where o.schema_name='${SCHEMA}' and o.object_name='${nombre}' and a.target_kind='OBJECT'`,
  );
const decisiones = (nombre) =>
  sql(
    `select d.decision, d.revision_no, d.reviewer_user_id
       from data_catalog.catalog_review_decisions d
       join data_catalog.catalog_annotations a on a.id = d.annotation_id
       join data_catalog.catalog_objects o on o.id = a.object_id
      where o.schema_name='${SCHEMA}' and o.object_name='${nombre}'`,
  );

async function main() {
  await mkdir(SALIDA, { recursive: true });
  const navegador = await chromium.launch(process.env.E2E_CHROMIUM ? { executablePath: process.env.E2E_CHROMIUM } : {});
  const nuevo = () => navegador.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-BO' });

  // ---------------------------------------------------------------- A edita y envía
  const ctxA = await nuevo();
  const pa = await ctxA.newPage();
  await entrar(pa, A);
  await irA(pa, '/superadmin/data-catalog');
  await pa.getByRole('tab', { name: 'Esquemas', exact: true }).click();
  await pa.getByTestId('catalog-schemas').getByText(SCHEMA, { exact: true }).first().click();
  await pa.getByTestId('catalog-schema-tables').click();
  await pa.getByRole('link', { name: new RegExp(`${TABLA}$`) }).first().click();
  await pa.getByTestId('object-tabs').waitFor({ timeout: 20_000 });
  const rutaFicha = new URL(pa.url()).pathname;
  log(`Ficha: ${SCHEMA}.${TABLA} → ${rutaFicha}`);

  const antes = ficha(TABLA);
  log(`Base antes: ${antes}`);
  comprobar(/^DRAFT\|IMPORTED_VAULT\|/.test(antes), 'la ficha parte como borrador importado de la bóveda');
  comprobar(decisiones(TABLA) === '', 'no hay ninguna decisión de revisión');
  await pa.screenshot({ path: path.join(SALIDA, '1-ficha-importada.png') });

  await pa.getByTestId('object-edit').click();
  await pa.getByRole('dialog').getByRole('textbox', { name: /Propósito/ }).first().fill('Registrar cada dispositivo desde el que una persona inicia sesión para poder cerrar sesiones sospechosas.');
  await pa.getByRole('dialog').getByRole('textbox', { name: /Por qué existe/ }).first().fill('Sin esta tabla no se podría saber desde qué equipo se abrió una sesión ni revocar uno robado sin cerrar todas las demás sesiones de la persona.');
  await pa.getByRole('dialog').getByRole('textbox', { name: /Qué significa una fila/ }).first().fill('Un dispositivo conocido de una cuenta de usuario, identificado por su id.');
  for (let i = 0; i < 12; i += 1) {
    const enviar = await pa.getByTestId('annotation-submit-switch').isVisible().catch(() => false);
    if (enviar) break;
    await pa.getByTestId('paginated-form-continuar').click();
    await pa.waitForTimeout(250);
  }
  // «Enviar a revisión» viene encendido por omisión: se comprueba, no se toca.
  const envia = pa.getByTestId('annotation-submit-switch').getByRole('switch');
  comprobar(await envia.isChecked(), '«Enviar a revisión» viene encendido por omisión');
  await pa.screenshot({ path: path.join(SALIDA, '2-formulario-ultimo-paso.png') });
  const put = pa.waitForResponse((r) => /\/admin\/catalog\/objects\/[^/]+\/annotation$/.test(new URL(r.url()).pathname) && r.request().method() === 'PUT');
  await pa.getByRole('button', { name: 'Guardar', exact: true }).click();
  const respuestaPut = await put;
  const cuerpoPut = await respuestaPut.json().catch(() => ({}));
  log(`Cuerpo enviado: ${(respuestaPut.request().postData() ?? '').replace(/("(purpose|existenceRationale|rowGrain)":")[^"]{12}[^"]*/g, '$1…')}`);
  comprobar(respuestaPut.status() === 200, `PUT annotation → ${respuestaPut.status()}`);
  comprobar(cuerpoPut.reviewStatus === 'NEEDS_REVIEW' && cuerpoPut.origin === 'MANUAL', `respuesta: ${cuerpoPut.reviewStatus} · origen ${cuerpoPut.origin}`);
  await pa.getByTestId('object-notice').waitFor({ timeout: 15_000 });
  const despuesEnvio = ficha(TABLA);
  log(`Base tras enviar: ${despuesEnvio}`);
  comprobar(/^NEEDS_REVIEW\|MANUAL\|/.test(despuesEnvio), 'en la base: la ficha está en revisión y ya es de origen manual');
  await pa.screenshot({ path: path.join(SALIDA, '3-enviada-a-revision.png') });

  // ---------------------------------------------------------------- A no puede aprobar la suya
  const post403 = pa.waitForResponse((r) => /\/annotations\/[^/]+\/review$/.test(new URL(r.url()).pathname));
  await pa.getByTestId('object-approve').click();
  await pa.getByRole('dialog').getByRole('button', { name: 'Aprobar', exact: true }).click();
  const r403 = await post403;
  comprobar(r403.status() === 403, `A intenta aprobar su propia revisión → ${r403.status()}`);
  await pa.getByTestId('object-error').waitFor({ timeout: 10_000 });
  comprobar(((await pa.getByTestId('object-error').textContent()) ?? '').includes('No puede revisar una revisión que escribió usted'), 'la pantalla explica la segregación de funciones');
  comprobar(decisiones(TABLA) === '', 'en la base: sigue sin haber ninguna decisión');
  await pa.screenshot({ path: path.join(SALIDA, '4-autoaprobacion-rechazada.png') });
  await ctxA.close();

  // ---------------------------------------------------------------- B aprueba
  const ctxB = await nuevo();
  const pb = await ctxB.newPage();
  await entrar(pb, B);
  await irA(pb, rutaFicha);
  await pb.getByTestId('object-tabs').waitFor({ timeout: 20_000 });
  const estadoAntes = (await pb.getByTestId('object-review-status').textContent()) ?? '';
  comprobar(estadoAntes.includes('En revisión'), `B ve la ficha: «${estadoAntes.trim()}»`);
  const postOk = pb.waitForResponse((r) => /\/annotations\/[^/]+\/review$/.test(new URL(r.url()).pathname));
  await pb.getByTestId('object-approve').click();
  await pb.getByRole('dialog').getByRole('button', { name: 'Aprobar', exact: true }).click();
  const rOk = await postOk;
  comprobar(rOk.status() === 200, `B aprueba → ${rOk.status()}`);
  await pb.getByTestId('object-notice').waitFor({ timeout: 15_000 });
  comprobar(((await pb.getByTestId('object-notice').textContent()) ?? '').includes('Ficha aprobada'), 'la pantalla avisa «Ficha aprobada»');

  const filaFicha = ficha(TABLA);
  const filaDecision = decisiones(TABLA);
  log(`Base tras aprobar: ficha ${filaFicha} · decisión ${filaDecision}`);
  const [estado, , revisionVigente, revisionAprobada, aprobadaPor] = filaFicha.split('|');
  comprobar(estado === 'APPROVED' && revisionAprobada === revisionVigente, 'en la base: ficha APPROVED sobre la revisión vigente');
  const [decision, , revisor] = filaDecision.split('|');
  comprobar(decision === 'APPROVED' && revisor === aprobadaPor, 'en la base: una decisión APPROVED, y quien aprobó es quien figura como aprobador');
  const autor = sql(`select author_user_id from data_catalog.catalog_annotation_revisions r join data_catalog.catalog_annotations a on a.id=r.annotation_id join data_catalog.catalog_objects o on o.id=a.object_id where o.schema_name='${SCHEMA}' and o.object_name='${TABLA}' and r.revision_no=${revisionVigente}`);
  comprobar(autor !== '' && autor !== revisor, 'en la base: quien escribió la revisión no es quien la aprobó');

  // ---------------------------------------------------------------- se vuelve a leer
  await irA(pb, '/superadmin/data-catalog');
  await irA(pb, rutaFicha);
  await pb.getByTestId('object-review-status').waitFor({ timeout: 15_000 });
  const estadoDespues = (await pb.getByTestId('object-review-status').textContent()) ?? '';
  comprobar(estadoDespues.includes('Aprobada'), `al volver a leer desde el servidor: «${estadoDespues.trim()}»`);
  comprobar((await pb.getByTestId('object-origin').count()) === 0, 'ya no figura como «Importado de la bóveda»: una persona la escribió');
  await pb.getByRole('tab', { name: 'Historial', exact: true }).click();
  const historia = (await pb.getByTestId('object-history').textContent()) ?? '';
  comprobar(/Aprobada el/.test(historia), 'el historial registra la aprobación');
  await pb.screenshot({ path: path.join(SALIDA, '5-aprobada-releida.png') });
  await ctxB.close();

  await navegador.close();
  await writeFile(path.join(SALIDA, 'registro.txt'), registro.join('\n') + '\n', 'utf8');
  console.log(fallos ? `\n${fallos} comprobación(es) fallida(s)` : '\nSin fallos');
  process.exit(fallos ? 1 : 0);
}

await main();
