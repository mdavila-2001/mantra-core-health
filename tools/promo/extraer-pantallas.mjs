/**
 * Congela las pantallas del frontend: el DOM que pintó Angular más las hojas de
 * estilo de este repositorio, en un archivo autosuficiente por pantalla y sin
 * JavaScript.
 *
 * No son capturas ni recreaciones: es el mismo HTML y el mismo CSS que sirve la
 * aplicación. El video (`video.html`) los monta en iframes y los anima escribiendo
 * en sus campos reales y cambiando las clases del propio sistema de diseño, así que
 * lo que se ve en pantalla no puede alejarse del producto.
 *
 * Deja `pantallas/<nombre>.html` y `fuentes/` dentro de la carpeta de salida.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const VP = { width: 1520, height: 950 };

export async function extraerPantallas({ navegador, base, salida }) {
  const fallos = [];
  const tipografias = new Map();
  mkdirSync(join(salida, 'pantallas'), { recursive: true });

  const congelar = async (pg, nombre) => {
    const crudo = await pg.evaluate(async () => {
      /* las hojas de estilo del repositorio, incrustadas tal cual */
      const hojas = [];
      for (const enlace of [...document.querySelectorAll('link[rel="stylesheet"]')]) {
        try { hojas.push(await (await fetch(enlace.href)).text()); } catch { /* ignorada */ }
      }
      for (const est of [...document.querySelectorAll('style')]) hojas.push(est.textContent ?? '');

      /* el estado que vive en la propiedad y no en el atributo, fijado en el HTML */
      for (const sel of document.querySelectorAll('select')) {
        [...sel.options].forEach((o) => o.toggleAttribute('selected', o.selected));
      }
      for (const inp of document.querySelectorAll('input')) {
        if (inp.type === 'checkbox' || inp.type === 'radio') inp.toggleAttribute('checked', inp.checked);
        else if (inp.value) inp.setAttribute('value', inp.value);
      }
      for (const ta of document.querySelectorAll('textarea')) ta.textContent = ta.value;

      const raiz = document.documentElement.cloneNode(true);
      raiz.querySelectorAll('script, link, style, aside.mock, noscript').forEach((n) => n.remove());
      const cuerpo = raiz.querySelector('body');
      return {
        cuerpo: cuerpo.outerHTML,
        tema: document.documentElement.getAttribute('data-theme') ?? '',
        css: hojas.join('\n'),
      };
    });

    /* las tipografías son las que sirve la propia aplicación: se bajan y se apuntan al lado */
    for (const m of crudo.css.matchAll(/url\(["']?\.?\/?media\/([^)"']+?)["']?\)/gi)) tipografias.set(m[1], ['media', m[1]]);
    for (const m of crudo.css.matchAll(/url\(["']?\/alovida\/tipografias\/([^)"']+?)["']?\)/gi)) tipografias.set(m[1], ['alovida/tipografias', m[1]]);
    const css = crudo.css
      .replace(/url\((["']?)\.?\/?media\/([^)"']+?)\1\)/gi, 'url("../fuentes/$2")')
      .replace(/url\((["']?)\/alovida\/tipografias\/([^)"']+?)\1\)/gi, 'url("../fuentes/$2")')
      .replace(/url\((["']?)\/?alovida\/imagenes\/(alovida-logo[^)"']*?\.svg)\1\)/gi, 'url("../assets/$2")');
    const cuerpo = crudo.cuerpo
      .replace(/src="\/alovida\/imagenes\/(alovida-logo[^"]*?\.svg)"/g, 'src="../assets/$1"')
      .replace(/src="\/alovida_logo\.svg"/g, 'src="../assets/alovida-logo.svg"');

    writeFileSync(join(salida, 'pantallas', `${nombre}.html`), `<!doctype html>
<html lang="es"${crudo.tema ? ` data-theme="${crudo.tema}"` : ''}>
<head>
<meta charset="utf-8">
<title>${nombre}</title>
<style>
/* ---- hojas de estilo de mantra-core-health, incrustadas sin tocar ---- */
${css}
</style>
</head>
${cuerpo}
</html>`);
    console.log('  pantalla · ' + nombre);
  };

  const sesion = async (usuario) => {
    const ctx = await navegador.newContext({ viewport: VP, deviceScaleFactor: 1, locale: 'es-BO', timezoneId: 'America/La_Paz' });
    const pg = await ctx.newPage();
    pg.on('pageerror', (e) => fallos.push(String(e).slice(0, 140)));
    if (!usuario) return pg;
    await pg.goto(base + '/auth', { waitUntil: 'domcontentloaded' });
    await pg.getByTestId('login-identifier').fill(usuario);
    await pg.locator('input[type="password"]').first().fill('demo1234');
    await pg.getByRole('button', { name: 'Entrar' }).click();
    await pg.waitForTimeout(2600);
    return pg;
  };
  const ir = async (pg, ruta, espera = 2600) => {
    await pg.goto(base + ruta, { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(espera);
  };

  /* --- registro, sin sesión --- */
  const pub = await sesion(null);
  await ir(pub, '/auth/register');
  await congelar(pub, 'registro-tipos');
  await ir(pub, '/auth/register/practitioner');
  await congelar(pub, 'registro-medico');

  /* --- paciente --- */
  const pac = await sesion('paciente@alovida.mock');
  await ir(pac, '/my-account/appointments?seccion=pedir');
  await pac.locator('main input[type="text"], main input:not([type])').first().fill('Rojas');
  await pac.waitForTimeout(1600);
  await pac.locator('main').getByText('Valeria Rojas Mendoza').first().click();
  await pac.waitForTimeout(2600);
  await congelar(pac, 'paciente-turnos');
  await ir(pac, '/my-account/appointments');
  await congelar(pac, 'paciente-citas');
  await ir(pac, '/directory');
  await congelar(pac, 'directorio-medicos');
  await ir(pac, '/clinics-directory');
  await congelar(pac, 'directorio-clinicas');

  /* --- médica --- */
  const med = await sesion('medica@alovida.mock');
  await ir(med, '/schedule');
  /* la segunda fila es la que está en «Pago parcial»: el menú tiene algo que cambiar */
  await med.locator('tbody').getByRole('button', { name: /pago/i }).nth(1).click();
  await med.waitForTimeout(1400);
  await congelar(med, 'medico-pago');
  await med.keyboard.press('Escape');
  await med.waitForTimeout(600);
  await med.getByRole('button', { name: /Continuar consulta|Iniciar consulta/i }).first().click();
  await med.waitForTimeout(3000);
  await congelar(med, 'medico-consulta');
  await ir(med, '/feed');
  /* el muro se llena publicando de verdad, con la propia pantalla */
  await med.locator('main textarea').first().fill(
    'Ya está cargado el arancel odontológico 2026 en el catálogo de servicios: endodoncia, ' +
      'periodoncia, ortodoncia y odontopediatría tienen su precio de referencia. #aranceles #odontología');
  await med.waitForTimeout(700);
  await med.getByRole('button', { name: /^Publicar$/ }).first().click();
  await med.waitForTimeout(2600);
  await congelar(med, 'red-muro');

  /* --- las tipografías que pide el CSS congelado --- */
  mkdirSync(join(salida, 'fuentes'), { recursive: true });
  for (const [carpeta, archivo] of tipografias.values()) {
    const r = await fetch(`${base}/${carpeta}/${archivo}`);
    if (!r.ok) { fallos.push(`fuente ${archivo} ${r.status}`); continue; }
    writeFileSync(join(salida, 'fuentes', archivo), Buffer.from(await r.arrayBuffer()));
  }
  console.log(`  tipografías · ${tipografias.size}`);
  if (fallos.length) throw new Error('Al congelar el frontend: ' + [...new Set(fallos)].join(' | '));
}
