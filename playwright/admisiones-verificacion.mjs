/**
 * Evidencia de «Admisiones» contra la maqueta (mockBackend), de punta a punta:
 *
 *   1. Quien revisa (admin@alovida.mock) abre la bandeja, toma una admisión,
 *      verifica requisito por requisito (con su fuente) y mira el carrusel y el
 *      formulario llenado. Cada escritura se demuestra
 *      UI → petición → respuesta → recarga (F5) → UI.
 *   2. Quien aprueba (aprobador@alovida.mock, otra persona: cuatro ojos) toma
 *      la decisión final.
 *   3. El médico (medico.nuevo@alovida.mock) ve su tarjeta «Estado de su
 *      verificación», corrige y reenvía con atestación, y la bandeja la ve de
 *      nuevo como enviada.
 *   4. Los conflictos: versión vieja (409) y evidencia cambiada (409).
 *
 * Capturas en claro y oscuro a 390 / 768 / 1440. Nunca `networkidle`: con HMR
 * no llega y da verdes falsos.
 *
 * Uso: `node playwright/admisiones-verificacion.mjs [urlBase]`
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:4300';
const SALIDA = fileURLToPath(new URL('../evidencias/admisiones-2026-10-29', import.meta.url));
const VISTAS = [390, 768, 1440];
const TEMAS = ['claro', 'oscuro'];
// MATRIZ=completa (por defecto): 3 anchos x 2 temas. MATRIZ=rapida: 1440 claro, 390 claro y
// 1440 oscuro, para correr con poca memoria (cada captura a página completa pesa).
const COMBINACIONES =
  process.env.MATRIZ === 'rapida'
    ? [['claro', 1440], ['claro', 390], ['oscuro', 1440]]
    : TEMAS.flatMap((tema) => VISTAS.map((ancho) => [tema, ancho]));

const veredictos = [];
const errores = [];
const traza = [];
const ok = (nombre, cond, detalle = '') => {
  veredictos.push({ nombre, cond: Boolean(cond), detalle });
  process.stdout.write(`${cond ? '✔' : '✘'} ${nombre}${detalle ? ' — ' + detalle : ''}\n`);
};

async function main() {
  mkdirSync(SALIDA, { recursive: true });
  const navegador = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH, args: ['--disable-gpu', '--disable-dev-shm-usage'] } : {});
  const contexto = await navegador.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'es-BO' });
  const pagina = await contexto.newPage();
  pagina.on('crash', () => process.stdout.write('!! la pestaña del navegador se cayó\n'));
  pagina.on('pageerror', (e) => errores.push(String(e)));
  pagina.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text()) && !/\/review → 409 · CONFLICT/.test(m.text())) errores.push(m.text());
  });

  const esperar = async (ms = 400) => pagina.waitForTimeout(ms);

  async function fijarTema(tema) {
    await pagina.emulateMedia({ colorScheme: tema === 'oscuro' ? 'dark' : 'light' });
    await pagina.evaluate((t) => {
      document.documentElement.setAttribute('data-theme', t === 'oscuro' ? 'dark' : 'light');
    }, tema);
  }

  /** Una captura por ancho y por tema. */
  async function fotos(nombre, opciones = {}) {
    const archivos = [];
    let temaActual = '';
    for (const [tema, ancho] of COMBINACIONES) {
      if (tema !== temaActual) {
        await fijarTema(tema);
        temaActual = tema;
      }
      await pagina.setViewportSize({ width: ancho, height: ancho === 390 ? 844 : ancho === 768 ? 1024 : 1000 });
      await esperar(250);
      const archivo = `${nombre}__${tema}-${ancho}.png`;
      await pagina.screenshot({ path: `${SALIDA}/${archivo}`, fullPage: opciones.completa ?? true });
      archivos.push(archivo);
    }
    await pagina.setViewportSize({ width: 1440, height: 1000 });
    await fijarTema('claro');
    return archivos;
  }

  const peticiones = () => pagina.evaluate(() => (window.__mockRequests ?? []).slice());
  const desde = async (n) => (await peticiones()).slice(n);
  const cuenta = async () => (await peticiones()).length;

  async function entrar(correo) {
    await pagina.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
    await pagina.getByTestId('login-identifier').fill(correo);
    await pagina.getByTestId('login-password').fill('mockup');
    await pagina.getByTestId('login-submit').click();
    await pagina.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60_000 });
    if (pagina.url().includes('/auth/organization')) {
      await pagina.getByTestId('tenant-opcion').first().click();
      await pagina.waitForURL(/\/dashboard/, { timeout: 60_000 });
    }
    await esperar(600);
  }

  /** Cierra la sesión sin tocar sessionStorage, donde la maqueta guarda las admisiones. */
  async function salir() {
    await pagina.evaluate(() => localStorage.clear());
    await contexto.clearCookies();
  }

  async function ir(ruta) {
    await pagina.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
    await pagina.waitForSelector('app-root', { state: 'attached', timeout: 60_000 });
    await esperar(900);
  }

  const q = (id) => pagina.getByTestId(id);
  const pestana = async (nombre) => {
    await pagina.getByRole('tab', { name: nombre }).click();
    await esperar(500);
  };

  /* ===================== 1 · quien revisa ===================== */
  await entrar('admin@alovida.mock');
  await ir('/administration/admissions');
  await pagina.waitForSelector('[data-testid="admissions-table"]', { timeout: 60_000 });
  ok('La bandeja «Admisiones» carga con filas', (await pagina.locator('tbody tr').count()) > 0);
  ok('La sección está en el menú de Administración', (await pagina.locator('[data-route="administration/admissions"], a[href="/administration/admissions"]').count()) > 0);
  const contadores = await q('admissions-status-tabs').innerText();
  ok('Las pestañas de estado traen contadores', /Enviadas\s*\d+/.test(contadores), contadores.replace(/\s+/g, ' ').slice(0, 120));
  await fotos('01-bandeja');

  // Estado en la URL y búsqueda que no escribe el documento en la dirección.
  await ir('/administration/admissions?status=SUBMITTED');
  ok('El estado queda en la URL y reproduce la bandeja al recargar', pagina.url().includes('status=SUBMITTED'));
  const antes = await cuenta();
  await pagina.locator('app-filter-bar input').first().fill('4567');
  await esperar(900);
  const busq = (await desde(antes)).find((p) => p.url.includes('/admissions/search'));
  ok('La búsqueda va por POST /admissions/search', busq?.method === 'POST', JSON.stringify(busq?.body));
  ok('La búsqueda no escribe el texto en la dirección', !pagina.url().includes('4567'));
  await ir('/administration/admissions?status=SUBMITTED');

  // Abrir la primera enviada.
  await q('admission-open').first().click();
  await pagina.waitForSelector('[data-testid="admission-card"]', { timeout: 60_000 });
  const admisionId = pagina.url().split('/').pop();
  ok('La ficha es UNA tarjeta con pestañas', (await pagina.locator('app-card[data-testid="admission-card"]').count()) === 1 && (await pagina.getByRole('tab').count()) === 5);
  await fotos('02-ficha-resumen-enviada');

  // Tomar la revisión: UI → petición → respuesta → recarga → UI.
  let n = await cuenta();
  await q('admission-action-claim').click();
  await esperar(900);
  const claim = (await desde(n)).find((p) => p.url.endsWith('/claim'));
  ok('Tomar revisión: la petición lleva la versión vista', claim?.method === 'POST' && typeof claim.body?.expectedRowVersion === 'number', JSON.stringify(claim?.body));
  ok('Tomar revisión: la respuesta deja la admisión en revisión', claim?.status === 200 && claim?.respuesta?.status?.code === 'IN_REVIEW', `HTTP ${claim?.status} → ${claim?.respuesta?.status?.code}`);
  await pagina.reload({ waitUntil: 'domcontentloaded' });
  await pagina.waitForSelector('[data-testid="admission-card"]');
  ok('Tras recargar (F5) sigue en revisión', /En revisión/.test(await q('admission-status').innerText()));
  await fotos('03-ficha-en-revision');

  // Requisitos.
  await pestana('Requisitos');
  ok('Los requisitos muestran el avance y qué falta', /requisitos verificados/.test(await q('requirements-progress').innerText()) && (await q('requirements-missing').count()) === 1);
  await fotos('04-requisitos-checklist');

  // Verificar el primero, con su fuente.
  n = await cuenta();
  await q('requirement-verify').first().click();
  await pagina.waitForSelector('[data-testid="admission-review-form"]');
  await fotos('05-dialogo-verificar-fuente', { completa: false });
  await q('admission-review-confirm').click();
  await esperar(500);
  ok('Verificar sin fuente no manda nada y lo dice', (await desde(n)).filter((p) => p.url.includes('/review')).length === 0 && /Elija de dónde obtuvo el dato/.test(await pagina.locator('app-admission-review-dialog').innerText()));
  await pagina.selectOption('[data-testid="admission-review-source-type"]', 'MINSALUD_REGISTRY');
  await fotos('06-dialogo-verificar-error-y-fuente', { completa: false });
  await q('admission-review-confirm').click();
  await esperar(900);
  let rev = (await desde(n)).find((p) => p.url.includes('/review'));
  ok('Verificar: la petición lleva fuente, fecha, huella y versión', rev?.body?.decision === 'VERIFIED' && rev.body.sourceType === 'MINSALUD_REGISTRY' && /^\d{4}-\d{2}-\d{2}$/.test(rev.body.sourceConsultedAt ?? '') && /^[0-9a-f]{64}$/.test(rev.body.evidenceSha256 ?? ''), JSON.stringify(rev?.body));
  ok('Verificar: la respuesta marca el requisito como verificado', rev?.status === 200 && rev.respuesta.requirements.some((r) => r.status === 'VERIFIED'));

  process.stdout.write('estado de las filas: ' + JSON.stringify(await pagina.locator('[data-testid="requirement-row"]').evaluateAll((rows) => rows.map((r) => `${r.dataset.estado}/${r.querySelector('[data-testid=requirement-verify]')?.getAttribute('aria-disabled')}`))) + ' · live: ' + (await q('admission-live').innerText()) + '\n');
  // Verificar los demás obligatorios, uno por uno, esperando a que cada diálogo se cierre.
  for (let i = 0; i < 8; i += 1) {
    const pendiente = pagina.locator('[data-testid="requirement-row"]:has(.requisito__obligatorio--si):not([data-estado="verified"]) [data-testid="requirement-verify"]').first();
    if ((await pendiente.count()) === 0) break;
    await pendiente.click();
    await pagina.waitForSelector('[data-testid="admission-review-form"]');
    await pagina.selectOption('[data-testid="admission-review-source-type"]', 'PROVIDED_DOCUMENT');
    await pagina.locator('app-admission-review-dialog input[type="text"], app-admission-review-dialog input:not([type])').first().fill('Documento cotejado con el original');
    await q('admission-review-confirm').click();
    await pagina.waitForSelector('[data-testid="admission-review-form"]', { state: 'detached', timeout: 20_000 });
    await esperar(400);
  }
  ok('Todos los obligatorios quedan verificados', (await q('requirements-complete').count()) === 1);
  await fotos('07-requisitos-completos');

  // Rechazar un opcional con motivo estructurado (y la nota interna separada).
  n = await cuenta();
  const opcional = pagina.locator('[data-testid="requirement-row"]', { hasText: 'Opcional' }).first();
  await opcional.locator('[data-testid="requirement-reject"]').click();
  await pagina.waitForSelector('[data-testid="admission-review-form"]');
  await q('admission-review-confirm').click();
  ok('Rechazar sin motivo no manda nada', (await desde(n)).filter((p) => p.url.includes('/review')).length === 0);
  await pagina.selectOption('[data-testid="admission-review-reason-code"]', 'INCOMPLETE_DOCUMENT');
  const areas = pagina.locator('app-admission-review-dialog textarea');
  await areas.nth(0).fill('Falta el reverso del documento.');
  await areas.nth(1).fill('Pedir también el original en la próxima cita.');
  await fotos('08-dialogo-rechazar-motivo-y-nota-interna', { completa: false });
  await q('admission-review-confirm').click();
  await esperar(900);
  rev = (await desde(n)).find((p) => p.url.includes('/review'));
  ok('Rechazar: código + texto para el médico + nota interna aparte', rev?.body?.reasonCode === 'INCOMPLETE_DOCUMENT' && rev.body.reason === 'Falta el reverso del documento.' && rev.body.internalNote?.startsWith('Pedir también'), JSON.stringify(rev?.body));
  ok('La nota interna se rotula «no la ve el profesional»', /Nota interna: no la ve el profesional/.test(await pagina.locator('main').innerText()));

  // Carrusel.
  await pestana(/Documentos/);
  await pagina.waitForSelector('[data-testid="evidence-gallery"]');
  await esperar(1200);
  // Tras revisar requisitos el carrusel avanza solo al siguiente pendiente (a propósito):
  // para fotografiar el principio se vuelve al primero con Inicio.
  await q('gallery-prev').focus();
  await pagina.keyboard.press('Home');
  await esperar(1200);
  ok('El carrusel muestra el contador «1 de N»', /^1 de \d+$/.test((await q('gallery-counter').innerText()).trim()), (await q('gallery-counter').innerText()).trim());
  ok('Las imágenes se muestran dentro de la ficha', (await pagina.locator('.visor__imagen').count()) === 1);
  await fotos('09-carrusel-imagen');
  await pagina.keyboard.press('Tab');
  await q('gallery-next').click();
  await esperar(1500);
  await fotos('10-carrusel-pdf');
  const contador1 = (await q('gallery-counter').innerText()).trim();
  await q('gallery-next').focus();
  await pagina.keyboard.press('ArrowRight');
  await esperar(700);
  ok('→ avanza el carrusel con el teclado', (await q('gallery-counter').innerText()).trim() !== contador1);
  await pagina.keyboard.press('Home');
  await esperar(500);
  ok('Inicio vuelve al primero', /^1 de/.test((await q('gallery-counter').innerText()).trim()));
  // Zoom con el teclado.
  await pagina.locator('.visor__escenario').focus();
  await esperar(600);
  await pagina.keyboard.press('+');
  await esperar(150);
  await pagina.keyboard.press('+');
  await esperar(300);
  ok('El zoom responde al teclado', /150/.test(await q('viewer-zoom').innerText()), await q('viewer-zoom').innerText());
  await fotos('11-carrusel-zoom');
  await pagina.keyboard.press('0');
  // Ampliar.
  await q('gallery-expand').click();
  await esperar(800);
  await fotos('12-carrusel-ampliado', { completa: false });
  await pagina.keyboard.press('Escape');
  await esperar(500);

  // Formulario llenado.
  await pestana(/Formulario llenado/);
  ok('El formulario llenado se muestra por secciones', (await pagina.locator('[data-testid="form-section"]').count()) >= 6);
  await fotos('13-formulario-llenado');
  await pestana('Historial');
  ok('El historial lista lo hecho', (await pagina.locator('.historial__evento').count()) >= 4);
  await fotos('14-historial');

  /* ===================== 2 · quien aprueba (cuatro ojos) ===================== */
  await salir();
  await entrar('aprobador@alovida.mock');
  await ir(`/administration/admissions/${admisionId}`);
  await pagina.waitForSelector('[data-testid="admission-card"]');
  ok('El aprobador ve «Verificar al profesional» habilitado', (await q('admission-action-verify').getAttribute('aria-disabled')) === 'false');
  await q('admission-action-verify').click();
  await pagina.waitForSelector('[data-testid="admission-review-form"]');
  await fotos('15-dialogo-decision-final', { completa: false });
  n = await cuenta();
  await q('admission-review-confirm').click();
  await esperar(1000);
  const dec = (await desde(n)).find((p) => p.url.endsWith('/decision'));
  ok('Decisión final: sin ítems en la petición, solo decisión y versión', dec && !('items' in dec.body) && dec.body.decision === 'VERIFIED', JSON.stringify(dec?.body));
  ok('Decisión final: la respuesta es VERIFIED', dec?.status === 200 && dec.respuesta?.status?.code === 'VERIFIED');
  await pagina.reload({ waitUntil: 'domcontentloaded' });
  await pagina.waitForSelector('[data-testid="admission-card"]');
  ok('Tras recargar (F5) sigue verificada', /Verificada/.test(await q('admission-status').innerText()));
  await fotos('16-ficha-verificada');
  await ir('/administration/admissions?status=VERIFIED');
  await pagina.waitForSelector('[data-testid="admissions-table"] tbody tr', { timeout: 30_000 });
  ok('La bandeja la lista ahora en «Verificadas»', (await pagina.locator(`a[href$="${admisionId}"]`).count()) >= 1);
  await fotos('17-bandeja-verificadas');

  /* ===================== 3 · el médico ===================== */
  await salir();
  await entrar('medico.nuevo@alovida.mock');
  await ir('/dashboard');
  await pagina.waitForSelector('[data-testid="admission-status-card"]', { timeout: 30_000 });
  ok('El médico ve «Estado de su verificación» en el panel', /Estado de su verificación/.test(await q('admission-status-card').innerText()));
  await pagina.waitForSelector('[data-testid="admission-card-info"]', { timeout: 15_000 }).catch(() => {});
  ok('Dice qué se le pidió y hasta cuándo puede responder', (await q('admission-card-info').count()) === 1 && (await q('admission-card-info-due').count()) === 1);
  await fotos('18-medico-panel-tarjeta');
  await ir('/my-account');
  await pagina.waitForSelector('[data-testid="admission-status-card"]');
  await fotos('19-medico-perfil-tarjeta');
  await q('admission-card-resubmit').click();
  ok('Reenviar sin la atestación no manda nada y lo dice', (await q('admission-card-attest-error').count()) === 1);
  await q('admission-card-attest').getByText('Declaro').click();
  n = await cuenta();
  await q('admission-card-resubmit').click();
  await esperar(1000);
  const reenvio = (await desde(n)).find((p) => p.url.endsWith('/resubmit'));
  ok('Reenviar: la petición lleva la atestación y su versión', reenvio?.body?.attested === true && /^\d{4}-\d{2}$/.test(reenvio.body.attestationVersion), JSON.stringify(reenvio?.body));
  ok('Reenviar: la respuesta es SUBMITTED', reenvio?.status === 200 && reenvio.respuesta?.status?.code === 'SUBMITTED');
  await pagina.reload({ waitUntil: 'domcontentloaded' });
  await pagina.waitForSelector('[data-testid="admission-status-card"]');
  ok('Tras recargar (F5) la tarjeta dice «Enviada»', /Enviada/.test(await q('admission-card-status').innerText()));
  await fotos('20-medico-reenviada');

  /* ===================== 4 · los conflictos ===================== */
  await salir();
  await entrar('admin@alovida.mock');
  await ir('/administration/admissions?status=SUBMITTED');
  await q('admission-open').nth(1).click();
  await pagina.waitForSelector('[data-testid="admission-card"]');
  const otraId = pagina.url().split('/').pop();
  await q('admission-action-claim').click();
  await esperar(900);
  await pestana('Requisitos');
  // Versión vieja (409): otra persona toca la admisión mientras se llenaba el formulario.
  await q('requirement-reject').first().click();
  await pagina.waitForSelector('[data-testid="admission-review-form"]');
  await pagina.selectOption('[data-testid="admission-review-reason-code"]', 'NAME_MISMATCH');
  await pagina.locator('app-admission-review-dialog textarea').first().fill('El nombre no coincide con el registro.');
  await pagina.evaluate((id) => window.__mockAdmisiones.tocarVersion(id), otraId);
  n = await cuenta();
  await q('admission-review-confirm').click();
  await esperar(900);
  const viejo = (await desde(n)).find((p) => p.url.includes('/review'));
  ok('409: la API responde versión vieja', viejo?.status === 409 && viejo.respuesta?.details?.reason === 'ADMISSION_STALE', `HTTP ${viejo?.status}`);
  ok('409: el diálogo sigue abierto, conserva lo escrito y ofrece «Ver cambios»', (await q('admission-review-stale').count()) === 1 && (await pagina.locator('app-admission-review-dialog textarea').first().inputValue()) === 'El nombre no coincide con el registro.');
  await fotos('21-conflicto-409-version', { completa: false });
  await q('admission-review-reload').click();
  await esperar(800);
  n = await cuenta();
  await q('admission-review-confirm').click();
  await esperar(900);
  const segundo = (await desde(n)).find((p) => p.url.includes('/review'));
  ok('Tras «Ver cambios» la confirmación sale con la versión nueva y funciona', segundo?.status === 200, `HTTP ${segundo?.status}`);
  // Evidencia cambiada (409).
  await q('requirement-verify').nth(1).click();
  await pagina.waitForSelector('[data-testid="admission-review-form"]');
  await pagina.selectOption('[data-testid="admission-review-source-type"]', 'SEDES');
  const codigo = await pagina.evaluate((id) => {
    const r = window.__mockRequests.filter((x) => x.url.endsWith(`/admissions/${id}`)).pop();
    return r?.respuesta?.requirements?.[1]?.code ?? 'PROFESSIONAL_LICENSE';
  }, otraId);
  await pagina.evaluate(([id, c]) => window.__mockAdmisiones.reemplazarEvidencia(id, c), [otraId, codigo]);
  n = await cuenta();
  await q('admission-review-confirm').click();
  await esperar(1200);
  const cambiado = (await desde(n)).find((p) => p.url.includes('/review'));
  ok('409: evidencia cambiada, no se decide a ciegas', cambiado?.status === 409 && cambiado.respuesta?.details?.reason === 'ADMISSION_EVIDENCE_CHANGED');
  ok('Se avisa «El profesional cambió este documento; revíselo de nuevo.»', /El profesional cambió este documento; revíselo de nuevo\./.test(await q('admission-notice').innerText()));
  await fotos('22-conflicto-409-evidencia');

  /* ===================== 5 · límites y accesos ===================== */
  await ir('/administration/admissions');
  await pagina.locator('app-filter-bar input').first().fill('Ramiro');
  await esperar(900);
  // El caso sembrado con 59 documentos y nombres largos.
  await pagina.locator('app-filter-bar input').first().fill('');
  await esperar(900);
  const idGrande = await pagina.evaluate(async () => {
    const lista = (window.__mockRequests ?? []).filter((r) => r.url.startsWith('/admissions') && r.status === 200 && r.respuesta?.items);
    return lista.at(-1)?.respuesta?.items?.map((i) => i.id) ?? [];
  });
  let grande = null;
  for (const id of idGrande) {
    await ir(`/administration/admissions/${id}`);
    await pagina.waitForSelector('[data-testid="admission-card"]');
    if (Number((await pagina.getByRole('tab', { name: /Documentos \(\d+\)/ }).innerText()).match(/\((\d+)\)/)?.[1]) >= 50) { grande = id; break; }
  }
  ok('Existe un caso con 50+ documentos', grande !== null);
  if (grande) {
    await pestana(/Documentos/);
    await esperar(2500);
    ok('Con 59 documentos el contador y la tira aguantan', /^1 de \d{2}$/.test((await q('gallery-counter').innerText()).trim()), (await q('gallery-counter').innerText()).trim());
    await fotos('23-limite-59-documentos-imagen-grande');
  }
  await salir();
  await entrar('paciente@alovida.mock');
  await ir('/administration/admissions');
  ok('El paciente no entra a «Admisiones» (el guard lo manda al panel)', pagina.url().includes('/dashboard'), pagina.url());

  ok('Sin errores de consola de la aplicación', errores.length === 0, errores.slice(0, 3).join(' | '));
  writeFileSync(`${SALIDA}/veredictos.json`, JSON.stringify({ veredictos, errores }, null, 2));
  await navegador.close();
  const fallos = veredictos.filter((v) => !v.cond);
  process.stdout.write(`\n${veredictos.length - fallos.length}/${veredictos.length} comprobaciones\n`);
  process.exit(fallos.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  console.error('Errores de la aplicación:', errores.slice(0, 5));
  process.exit(2);
});
