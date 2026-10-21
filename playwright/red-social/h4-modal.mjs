import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
const BASE = process.argv[2], OUT = process.argv[3], FOTO = process.argv[4];
mkdirSync(OUT, { recursive: true });
const res = []; const ok = (n, c, d = '') => { res.push(!!c); console.log(`${c ? '✔' : '✘'} ${n}${d ? ' — ' + d : ''}`); };
const consola = []; let csp = 0;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
p.on('pageerror', (e) => consola.push('pageerror: ' + e));
p.on('console', (m) => { if (m.type() !== 'error') return; if (/Content Security Policy directive: "script-src/.test(m.text())) { csp++; return; } consola.push(m.text()); });
await p.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await p.getByTestId('login-identifier').fill('medica@alovida.mock');
await p.getByTestId('login-password').fill('mockup');
await p.getByTestId('login-submit').click();
await p.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60000 });
if (p.url().includes('/auth/organization')) { await p.getByTestId('tenant-opcion').first().click(); await p.waitForURL(/\/dashboard/); }
await p.goto(`${BASE}/posts`, { waitUntil: 'domcontentloaded' });
await p.locator('app-public-post-card').first().waitFor({ timeout: 120000 });
await p.getByTestId('feed-crear-abrir').waitFor({ timeout: 30000 });
await p.screenshot({ path: `${OUT}/01-barra.png` });

await p.getByTestId('feed-crear-abrir').click();
await p.getByTestId('post-composer').waitFor({ timeout: 10000 });
await p.waitForTimeout(400);
const dentro = await p.evaluate(() => !!document.activeElement?.closest('dialog'));
ok('el modal se abre y el foco queda adentro', dentro);
ok('el modal tiene título accesible «Crear una publicación»', /Crear una publicación/.test(await p.getByTestId('content-dialog-title').innerText()));
ok('muestra quién publica', /Valeria/.test(await p.getByTestId('post-composer-author').innerText()));
await p.screenshot({ path: `${OUT}/02-modal-vacio.png` });

// Publicar sin texto: deshabilitado
ok('Publicar está deshabilitado sin texto', (await p.getByTestId('post-composer-submit').getAttribute('aria-disabled')) === 'true');

const texto = `Caso clínico de prueba ${Date.now()} #cardiologia #prevencion`;
await p.getByTestId('post-composer-body').locator('textarea').fill(texto);
await p.getByTestId('comment-media-add-image').locator('xpath=following-sibling::input[@type="file"]').setInputFiles(FOTO);
await p.getByTestId('comment-media-item').first().waitFor({ timeout: 20000 });
ok('la imagen se sube y aparece su miniatura', (await p.getByTestId('comment-media-item').count()) === 1);
await p.getByTestId('comment-media-alt').fill('Gradiente de prueba, sin contenido clínico');
await p.waitForTimeout(300);
await p.screenshot({ path: `${OUT}/03-modal-con-imagen.png` });
ok('sólo se ofrece «Imagen» (no sticker ni GIF)', (await p.locator('[data-testid^="comment-media-add-"]').count()) === 1);

// Escape con borrador pregunta
await p.keyboard.press('Escape');
await p.waitForTimeout(500);
const pregunta = await p.getByRole('dialog').count();
ok('Esc con borrador pregunta si se descarta (hay un segundo diálogo)', pregunta >= 1 && (await p.getByText(/descart/i).count()) > 0, `dialogs=${pregunta}`);
await p.screenshot({ path: `${OUT}/04-descartar.png` });
// elegir "seguir editando"
const seguir = p.getByTestId('dialogo').getByRole('button', { name: 'Seguir editando' });
await seguir.click();
await p.waitForTimeout(400);
ok('tras «seguir editando» el modal y el texto siguen', (await p.getByTestId('post-composer-body').locator('textarea').inputValue()) === texto);

await p.getByTestId('post-composer-submit').click();
await p.getByTestId('post-composer').waitFor({ state: 'detached', timeout: 20000 });
ok('al publicar el modal se cierra', true);
await p.waitForTimeout(1500);
const primera = p.locator('app-public-post-card').filter({ hasText: 'Caso clínico de prueba' }).first();
ok('la publicación nueva aparece en el feed tras releer', (await primera.count()) === 1);
const img = primera.locator('img.publicacion__imagen');
ok('con su imagen', (await img.count()) === 1 && (await img.evaluate((e) => e.naturalWidth)) > 0);
await primera.scrollIntoViewIfNeeded();
await primera.screenshot({ path: `${OUT}/05-publicada.png` });

await p.reload({ waitUntil: 'domcontentloaded' });
await p.locator('app-public-post-card').first().waitFor({ timeout: 120000 });
await p.waitForTimeout(2000);
const tras = p.locator('app-public-post-card').filter({ hasText: 'Caso clínico de prueba' }).first();
ok('tras recargar la publicación sigue ahí', (await tras.count()) === 1);
ok('y su imagen también', (await tras.locator('img.publicacion__imagen').count()) === 1);

// Cerrar vacío no pregunta
await p.getByTestId('feed-crear-abrir').click();
await p.getByTestId('post-composer').waitFor();
await p.getByTestId('content-dialog-close').click();
await p.getByTestId('post-composer').waitFor({ state: 'detached', timeout: 10000 });
ok('cerrar sin nada escrito no pregunta', true);
ok('el foco vuelve a la pastilla', await p.evaluate(() => document.activeElement?.getAttribute('data-testid') === 'feed-crear-abrir'));

// móvil
await p.setViewportSize({ width: 390, height: 844 });
await p.getByTestId('feed-crear-abrir').click();
await p.getByTestId('post-composer').waitFor();
await p.waitForTimeout(400);
ok('390px sin scroll horizontal con el modal', await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
await p.screenshot({ path: `${OUT}/06-modal-390.png` });

console.log(`(CSP inline-script aparte: ${csp})`);
ok('sin errores de página ni de consola (salvo CSP)', consola.length === 0, consola.slice(0, 3).join(' | '));
await b.close();
console.log(`\n${res.filter(Boolean).length}/${res.length} en verde`);
process.exit(res.every(Boolean) ? 0 : 1);
