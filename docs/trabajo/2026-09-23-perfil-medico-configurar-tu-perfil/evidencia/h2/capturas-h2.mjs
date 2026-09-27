/**
 * H2 — el perfil del médico DESPUÉS de D-01 (todas las especialidades iguales),
 * D-02 (sin «Estado de la práctica») y D-03 («Contacto» sin datos del trabajo).
 * Uso (desde la raíz del repo): yarn node docs/trabajo/<carpeta>/evidencia/h2/capturas-h2.mjs <urlBase>
 * Sólo cuentas sintéticas `medica@alovida.mock` y `paciente@alovida.mock`. No escribe fuera de `evidencia/h2/`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.argv[2];
if (!BASE) throw new Error('Falta la URL de la app como primer argumento.');
const DIR = new URL('./', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const CAPS = `${DIR}capturas`;
mkdirSync(CAPS, { recursive: true });

// Port de uuid() de core/mock/mock-store.ts, para armar /directory/<id> sin adivinar.
function uuid(seed) {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < seed.length; i++) {
    const c = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x811c9dc5) >>> 0;
  }
  const hex = (n) => n.toString(16).padStart(8, '0');
  const raw = `${hex(h1)}${hex(h2)}${hex((h1 * 31 + h2) >>> 0)}${hex((h2 * 17 + h1) >>> 0)}`;
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-4${raw.slice(13, 16)}-a${raw.slice(17, 20)}-${raw.slice(20, 32)}`;
}
const ID_MEDICA = uuid('hpid-medica');
const SLUG_MEDICA = 'valeria-rojas';

const lineas = [];
const log = (t) => {
  lineas.push(t);
  process.stdout.write(t + '\n');
};
const consola = [];
const red = [];
const plano = (t) => t.replace(/\s+/g, ' ').trim();

async function entrar(navegador, { ancho, alto, tema, cuenta }) {
  const ctx = await navegador.newContext({ viewport: { width: ancho, height: alto }, colorScheme: tema });
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
  await p.getByTestId('login-identifier').fill(cuenta);
  await p.getByTestId('login-password').fill('mockup');
  await p.getByTestId('login-submit').click();
  await p.waitForURL(/\/(dashboard|auth\/organization|my-account|home|directory)/, { timeout: 90_000 }).catch(() => {});
  if (p.url().includes('/auth/organization')) {
    await p.getByTestId('tenant-opcion').first().click();
    await p.waitForTimeout(1500);
  }
  return p;
}
const tab = (p, nombre) => p.getByRole('tab', { name: nombre }).first();
// Espera a que no quede ninguna transición en curso (las animaciones infinitas no cuentan).
const quieto = (p) =>
  p
    .waitForFunction(
      () =>
        document
          .getAnimations()
          .every((a) => a.playState !== 'running' || a.effect?.getComputedTiming().iterations === Infinity),
      null,
      { timeout: 5_000 },
    )
    .catch(() => {});
// La captura de página completa estira la ventana en el acto y la barra lateral anima su ancho
// a mitad de la foto: se agranda la ventana a la altura del documento, se espera quietud y recién
// ahí se captura; después se devuelve la ventana a su tamaño.
const cap = async (p, nombre) => {
  const vp = p.viewportSize();
  const alto = await p.evaluate(() => Math.ceil(document.documentElement.scrollHeight));
  if (alto > vp.height) await p.setViewportSize({ width: vp.width, height: alto });
  await quieto(p);
  await p.screenshot({ path: `${CAPS}/${nombre}.png` });
  if (alto > vp.height) {
    await p.setViewportSize(vp);
    await quieto(p);
  }
};
const asentar = async (p, ms = 900) => p.waitForTimeout(ms);
// El panel inactivo existe pero no se dibuja: se lee el visible, no el primero.
const textoPanel = async (p) => plano(await p.locator('[role="tabpanel"]:visible').first().innerText());
const MODAL = 'dialog[open], [role="dialog"], [role="alertdialog"]';

/** Insignias de especialidad y cualquier «principal» a la vista. */
const insignias = (p) =>
  p.evaluate(() => {
    const raiz = document.querySelector('main') ?? document.body;
    const hosts = [...raiz.querySelectorAll('.specialty-badge')];
    const tonos = [
      ...new Set(hosts.map((h) => [...h.classList].filter((c) => c.startsWith('tone--')).join(' ') || '(sin tono)')),
    ];
    const textoPrincipal = (raiz.innerText.match(/.{0,30}principal.{0,30}/gi) ?? []).map((s) => s.replace(/\s+/g, ' '));
    return {
      n: hosts.length,
      tonos,
      nombres: hosts.map((h) => h.innerText.replace(/\s+/g, ' ').trim()),
      marcaPrincipal: raiz.querySelectorAll('.specialty-badge__principal').length,
      textoPrincipal,
    };
  });
const informe = (i) =>
  `insignias=${i.n} · tonos=${JSON.stringify(i.tonos)} · .specialty-badge__principal=${i.marcaPrincipal} · «principal» en pantalla=${i.textoPrincipal.length ? JSON.stringify(i.textoPrincipal) : 0} · nombres=${JSON.stringify(i.nombres)}`;

async function abrirEditor(p, pestana) {
  await p.goto(`${BASE}/my-account/edit`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await p.locator('[data-testid="edicion-pestanas"] [role="tab"]').first().waitFor({ timeout: 60_000 });
  await asentar(p);
  await tab(p, pestana).click();
  await asentar(p);
}


/** Los avisos que la pestaña muestra al abrirse; se espera a que se vayan antes de capturar. */
async function sinAviso(p) {
  const avisos = (await p.locator('.toast__title >> visible=true').allInnerTexts().catch(() => [])).map(plano);
  // Puede haber más de uno (uno por pestaña recorrida): se espera a que no quede ninguno.
  await p
    .waitForFunction(() => ![...document.querySelectorAll('.toast__title')].some((t) => t.getClientRects().length > 0), null, { timeout: 12_000 })
    .catch(() => {});
  await asentar(p, 500);
  return avisos;
}

/** Lo que D-03 y el #645 fijan en un texto de pestaña, dicho en una línea. */
const contactos = (texto) =>
  '«Correo de trabajo»=' + (texto.includes('Correo de trabajo') ? 'SÍ' : 'no') +
  ' · teléfonos del trabajo=' + JSON.stringify(texto.match(/(Celular|Fijo|Teléfono) del trabajo/gi) ?? []) +
  ' · «Correo de acceso»=' + (texto.includes('Correo de acceso') ? 'SÍ' : 'no');

const VIEWPORTS = [
  [1440, 900, 'escritorio'],
  [1920, 1080, 'escritorio-grande'],
  [1024, 768, 'tableta-horizontal'],
  [768, 1024, 'tableta'],
  [390, 844, 'movil'],
];

async function main() {
  const navegador = await chromium.launch();

  // H2.S1.M4 · H2.S3.M8 — ficha: las cuatro pestañas del carril, 5 viewports × 2 temas
  for (const tema of ['light', 'dark']) {
    for (const [ancho, alto, vp] of VIEWPORTS) {
      const p = await entrar(navegador, { ancho, alto, tema, cuenta: 'medica@alovida.mock' });
      const t = tema === 'light' ? 'claro' : 'oscuro';
      await p.goto(BASE + '/my-account', { waitUntil: 'domcontentloaded', timeout: 180_000 });
      await tab(p, /Datos personales/).waitFor({ timeout: 60_000 });
      await asentar(p, 1500);
      const dp = await textoPanel(p);
      log('ficha · Datos personales · ' + vp + ' ' + t + ': «Estado de la práctica»=' + (dp.includes('Estado de la práctica') ? 'SÍ' : 'no') + ' · ' + contactos(dp));
      await cap(p, 'h2-ficha-datos-personales-' + vp + '-' + t);
      await tab(p, /Contacto/).click();
      await asentar(p);
      const co = await textoPanel(p);
      log('ficha · Contacto · ' + vp + ' ' + t + ': ' + contactos(co) + ' · texto: ' + co.slice(0, 300));
      await cap(p, 'h2-ficha-contacto-' + vp + '-' + t);
      // «Trayectoria» avisa por 3 s que los títulos están en «Credenciales» (#650): se anota el
      // aviso y se captura cuando ya se fue, para que no tape la pestaña.
      await tab(p, /Trayectoria/).click();
      await asentar(p, 600);
      log('ficha · Trayectoria · ' + vp + ' ' + t + ': aviso=' + JSON.stringify(await sinAviso(p)));
      await cap(p, 'h2-ficha-trayectoria-' + vp + '-' + t);
      await tab(p, /Credenciales/).click();
      await asentar(p);
      await asentar(p, 600);
      log('ficha · Credenciales · ' + vp + ' ' + t + ': aviso=' + JSON.stringify(await sinAviso(p)) + ' · ' + (await textoPanel(p)).slice(0, 200));
      await cap(p, 'h2-ficha-credenciales-' + vp + '-' + t);
      await p.context().close();
    }
  }

  // H2.S3 — editor: «Datos personales» y «Contacto», 5 viewports × 2 temas. Desde el #645 el
  // correo de trabajo se corrige en Contacto y no hay «Correo de acceso» en Datos personales.
  for (const tema of ['light', 'dark']) {
    for (const [ancho, alto, vp] of VIEWPORTS) {
      const t = tema === 'light' ? 'claro' : 'oscuro';
      const p = await entrar(navegador, { ancho, alto, tema, cuenta: 'medica@alovida.mock' });
      await abrirEditor(p, /Datos personales/);
      const dp = await textoPanel(p);
      log('editor · Datos personales · ' + vp + ' ' + t + ': sección del correo de acceso=' + (await p.getByTestId('edicion-correo-acceso').count()) + ' · ' + contactos(dp));
      await cap(p, 'h2-editor-datos-personales-' + vp + '-' + t);
      await tab(p, /Contacto/).click();
      await asentar(p);
      const co = await textoPanel(p);
      const correo = p.locator('input[data-testid="edicion-correo-trabajo"]');
      log('editor · Contacto · ' + vp + ' ' + t + ': campo del correo de trabajo=' + (await correo.count()) + ((await correo.count()) ? ' con «' + (await correo.inputValue()) + '»' : '') + ' · celular del trabajo=' + (await p.getByTestId('edicion-celular-trabajo').count()) + ' · fijo del trabajo=' + (await p.getByTestId('edicion-fijo-trabajo').count()) + ' · ' + contactos(co));
      await cap(p, 'h2-editor-contacto-' + vp + '-' + t);
      await p.context().close();
    }
  }

  // H2.S2.M8 — insignias: ficha, editor, perfil público (médica) y guía (paciente)
  {
    const p = await entrar(navegador, { ancho: 1440, alto: 900, tema: 'light', cuenta: 'medica@alovida.mock' });
    await p.goto(`${BASE}/my-account`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
    await tab(p, /Datos personales/).waitFor({ timeout: 60_000 });
    await asentar(p, 1500);
    const tabs = p.getByRole('tab');
    const total = await tabs.count();
    for (let i = 0; i < total; i++) {
      await tabs.nth(i).click().catch(() => {});
      await asentar(p, 600);
      log(`insignias · ficha · pestaña «${plano(await tabs.nth(i).innerText())}»: ${informe(await insignias(p))}`);
    }
    await tabs.first().click();
    await asentar(p, 600);
    // Recorrer las pestañas deja sus avisos a la vista: se espera a que se vayan.
    await sinAviso(p);
    await cap(p, 'h2-insignias-ficha');

    await abrirEditor(p, /Datos personales/);
    const encabezados = await p.locator('table thead th').allInnerTexts();
    log(
      `insignias · editor · Datos personales: encabezados=${JSON.stringify(encabezados.map(plano))} · botones con «principal»=${await p.getByRole('button', { name: /principal/i }).count()} · ${informe(await insignias(p))}`,
    );
    // La página entera de «Datos personales» ya es `h2-editor-datos-personales-escritorio-claro`:
    // acá va sólo la sección de especialidades, donde están las insignias.
    const especialidades = p.getByTestId('edicion-especialidades-cargadas');
    await especialidades.scrollIntoViewIfNeeded();
    await quieto(p);
    await especialidades.screenshot({ path: `${CAPS}/h2-insignias-editor.png` });

    // «Credenciales» tiene las matrículas y, debajo, los títulos (24/09/2026): cada fila con sus
    // acciones, dichas como se ven, y si cada botón lleva ícono.
    await tab(p, /Credenciales/).click();
    await asentar(p);
    const botonesDe = (fila) =>
      fila.locator('button').evaluateAll((bs) =>
        bs
          .map((b) => ({ texto: b.textContent.replace(/\s+/g, ' ').trim(), icono: b.querySelector('svg, app-nav-icon') !== null }))
          .map((b) => (b.icono ? `${b.texto || '(sin texto)'} [ícono]` : b.texto))
          .filter(Boolean),
      );
    for (const [nombre, seccion] of [['matrícula', 'edicion-matriculas-cargadas'], ['título', 'edicion-formacion-cargada']]) {
      const filasDe = p.locator(`[data-testid="${seccion}"] tbody tr`);
      for (let i = 0; i < (await filasDe.count()); i++) {
        const fila = filasDe.nth(i);
        log(
          `editor · Credenciales · ${nombre} ${i + 1}: «${plano(await fila.innerText()).slice(0, 120)}» · botones=${JSON.stringify(await botonesDe(fila))}`,
        );
      }
    }
    await cap(p, 'h2-editor-credenciales-escritorio-claro');

    await p.goto(`${BASE}/p/${SLUG_MEDICA}`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
    await asentar(p, 2500);
    log(`insignias · perfil público (/p/${SLUG_MEDICA}): ${informe(await insignias(p))}`);
    await cap(p, 'h2-insignias-perfil-publico');
    await p.context().close();
  }
  {
    const p = await entrar(navegador, { ancho: 1440, alto: 900, tema: 'light', cuenta: 'paciente@alovida.mock' });
    await p.goto(`${BASE}/directory/${ID_MEDICA}`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
    await asentar(p, 3000);
    log(`insignias · guía, detalle (paciente, /directory/${ID_MEDICA}) → ${p.url().replace(BASE, '')}: ${informe(await insignias(p))}`);
    await cap(p, 'h2-insignias-directorio-detalle-paciente');
    await p.goto(`${BASE}/directory`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
    await asentar(p, 3000);
    log(`insignias · guía, lista (paciente, /directory): ${informe(await insignias(p))}`);
    await cap(p, 'h2-insignias-directorio-lista-paciente');
    await p.context().close();
  }

  // H2.S2.M5 — el alta: especialidades sin «principal»
  {
    const ctx = await navegador.newContext({ viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage();
    await p.goto(`${BASE}/auth/register/practitioner`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
    await p.locator('app-paginated-form').waitFor({ timeout: 60_000 });
    await asentar(p, 1500);
    // Las especialidades viven en su propia página del alta. Para no llenar las anteriores con
    // datos inventados, se pone el formulario directamente en esa página.
    const pagina = await p.evaluate((clave) => {
      const c = window.ng?.getComponent(document.querySelector('app-paginated-form'));
      if (!c) return 'sin acceso al componente';
      const i = c.paginas().findIndex((pg) => pg.clave === clave);
      if (i < 0) return 'sin la página';
      c.indice.set(i);
      return `página ${i + 1} de ${c.paginas().length}`;
    }, 'specialties');
    log(`alta · especialidades: ${pagina}`);
    await asentar(p, 800);
    const agregar = p.getByTestId('registro-pro-agregar-especialidad');
    if (await agregar.count()) {
      await agregar.scrollIntoViewIfNeeded();
      await agregar.click();
      await asentar(p, 400);
      await agregar.click();
      await asentar(p, 600);
      const bloque = p.locator('app-form-field', { hasText: /Especialidad 1/ }).first();
      const principal = await p.getByText(/principal/i).count();
      log(
        `alta · especialidades: «Especialidad 1» visible=${await bloque.count()} · «principal» en pantalla=${principal} · botón=«${plano(await agregar.innerText())}»`,
      );
      await bloque.scrollIntoViewIfNeeded().catch(() => {});
      await p.screenshot({ path: `${CAPS}/h2-alta-especialidades.png`, fullPage: false });
    } else {
      log('alta · especialidades: sin el botón «Agregar una especialidad» en la primera pantalla');
      await cap(p, 'h2-alta-especialidades');
    }
    await ctx.close();
  }

  // H2.S3.M6 — el PATCH en la Red. La maqueta lo resuelve en memoria; se deja pasar a la
  // red sólo ese envío (el interruptor del stock de componentes) y se lo retiene ahí.
  {
    const p = await entrar(navegador, { ancho: 1440, alto: 900, tema: 'light', cuenta: 'medica@alovida.mock' });
    await p.goto(`${BASE}/design-system/stock`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
    await p.locator('app-component-stock').waitFor({ timeout: 60_000 });
    const hayInterruptor = await p.evaluate(() => {
      const stock = window.ng?.getComponent(document.querySelector('app-component-stock'));
      window.__apiReal = stock?.apiReal;
      return typeof window.__apiReal?.set === 'function';
    });
    log(`PATCH · interruptor de la API real alcanzable: ${hayInterruptor ? 'SÍ' : 'NO'}`);
    if (hayInterruptor) {
      await p.evaluate(() => {
        history.pushState({}, '', '/my-account/edit');
        dispatchEvent(new PopStateEvent('popstate', { state: {} }));
      });
      await p.locator('[data-testid="edicion-pestanas"] [role="tab"]').first().waitFor({ timeout: 60_000 });
      await asentar(p, 1500);
      log(`PATCH · editor abierto sin recargar: ${p.url().replace(BASE, '')} · interruptor=${await p.evaluate(() => window.__apiReal())}`);
      await tab(p, /Contacto/).click();
      await asentar(p);
      const campo = p
        .locator('input[data-testid="edicion-celular-personal"], [data-testid="edicion-celular-personal"] input')
        .first();
      const antes = await campo.inputValue();
      await campo.fill('71234567');
      await campo.blur();
      await asentar(p, 400);
      await cap(p, 'h2-patch-antes-de-guardar');

      const capturadas = [];
      const todas = [];
      p.on('request', (r) => {
        if (r.url().includes('/profiles/')) todas.push(`${r.method()} ${r.url()}`);
      });
      await p.route(
        (u) => u.pathname.endsWith('/profiles/practitioners/me'),
        async (route) => {
          const r = route.request();
          capturadas.push({ metodo: r.method(), url: r.url(), cuerpo: r.postData(), tipo: r.headers()['content-type'] });
          await p.evaluate(() => window.__apiReal.set(false));
          await route.abort('failed');
        },
      );
      await p.evaluate(() => window.__apiReal.set(true));
      await p.locator('.edicion__guardar').getByRole('button', { name: /Guardar cambios/ }).click();
      await asentar(p, 800);
      if (await p.locator(MODAL).count()) {
        log(`PATCH · al guardar apareció un diálogo: «${plano(await p.locator(MODAL).first().innerText()).slice(0, 200)}»`);
        await p
          .locator(MODAL)
          .getByRole('button', { name: /guardar|confirmar|sí/i })
          .first()
          .click()
          .catch(() => {});
      }
      for (let i = 0; i < 30 && capturadas.length === 0; i++) await asentar(p, 500);
      await p.evaluate(() => window.__apiReal.set(false));

      const salida = [`# H2.S3.M6 — el PATCH del perfil propio, retenido en la red — ${new Date().toISOString()}`, ''];
      salida.push(`Celular personal: «${antes}» → «71234567» (pestaña Contacto del editor, sesión de la médica sintética)`);
      salida.push('Peticiones a /profiles/ que salieron a la red con el interruptor encendido:');
      salida.push(...(todas.length ? todas.map((t) => `  ${t}`) : ['  ninguna']));
      salida.push('');
      for (const c of capturadas) {
        salida.push(`${c.metodo} ${new URL(c.url).pathname}`, `content-type: ${c.tipo}`, `cuerpo: ${c.cuerpo}`);
        let claves = [];
        try {
          claves = Object.keys(JSON.parse(c.cuerpo ?? '{}'));
        } catch {
          claves = ['(cuerpo no JSON)'];
        }
        const laborales = claves.filter((k) => /^work/.test(k));
        salida.push(`claves: ${JSON.stringify(claves)} · del trabajo: ${laborales.length ? JSON.stringify(laborales) : 'ninguna'}`);
        log(`PATCH · ${c.metodo} · claves=${JSON.stringify(claves)} · del trabajo=${laborales.length ? JSON.stringify(laborales) : 'ninguna'}`);
      }
      if (capturadas.length === 0) log('PATCH · no se capturó ninguna petición');
      salida.push('', 'La petición se cortó en la red (abort) después de leerla: no se dio por guardado nada.');
      writeFileSync(`${DIR}red-patch.txt`, salida.join('\n') + '\n');
    }
    await p.context().close();
  }

  await navegador.close();
  writeFileSync(`${DIR}comportamiento-h2.txt`, lineas.join('\n') + '\n');
  const unicos = (xs) => [...new Set(xs)];
  writeFileSync(
    `${DIR}consola-red-h2.txt`,
    `# Consola y red de H2 — ${new Date().toISOString()}\n\n## Consola (error/warning, sin la CSP del servidor de desarrollo)\n${consola.length ? unicos(consola).join('\n') : 'ninguno'}\n\n## Red (>= 400 o fallida)\n${red.length ? unicos(red).join('\n') : 'ninguna'}\n`,
  );
  log(`consola: ${unicos(consola).length} distintas · red: ${unicos(red).length} distintas`);
}
main().catch((e) => {
  process.stderr.write(String(e?.stack ?? e) + '\n');
  process.exitCode = 2;
});
