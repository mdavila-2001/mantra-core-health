// Capturas del despliegue: la aplicación servida por el proxy local y el enlace
// del túnel. Se guardan en `evidencias/redeploy-tunel/` con ruta absoluta —
// dentro del repositorio, que es donde la herramienta de capturas puede escribir.
//
//   node tools/redeploy/evidencia.mjs
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '../..');
const DIR = resolve(RAIZ, 'evidencias/redeploy-tunel');
mkdirSync(DIR, { recursive: true });

// El enlace lo publica el propio script; si todavía no corrió, se pregunta al
// servicio de túneles en vez de inventarlo.
const url = readFileSync(resolve(AQUI, 'estado/URL'), 'utf8').trim();
const local = `http://127.0.0.1:${process.env.REDEPLOY_PUERTO ?? 4200}/`;

const navegador = await chromium.launch();
const pagina = await navegador.newPage({ viewport: { width: 1280, height: 800 } });

// La tercera captura es la que de verdad importa, y la que faltaba: pedir la
// aplicación **con el hostname del túnel**. El SSR compara ese `Host` contra su
// lista blanca y responde 400 en texto plano si no está — que es exactamente lo
// que veía quien abría el enlace. Se resuelve ese nombre a 127.0.0.1 para
// reproducir la petición del navegador sin tener que pasar por el borde (que
// pide identidad de la organización antes de dejar entrar).
const hostTunel = new URL(url).host;
const navegadorTunel = await chromium.launch({
  args: [`--host-resolver-rules=MAP ${hostTunel} 127.0.0.1`],
});
const paginaTunel = await navegadorTunel.newPage({ viewport: { width: 1280, height: 800 } });

for (const [nombre, destino] of [
  ['01-frontend-local-por-nginx', local],
  ['02-tunel-permanente', url],
]) {
  try {
    const r = await pagina.goto(destino, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await pagina.waitForTimeout(4_000);
    console.log(nombre, '->', r?.status(), pagina.url());
  } catch (e) {
    console.log(nombre, '-> ERROR', e.message);
  }
  await pagina.screenshot({ path: `${DIR}/${nombre}.png` });
}

try {
  const puerto = process.env.REDEPLOY_PUERTO ?? 4200;
  const r = await paginaTunel.goto(`http://${hostTunel}:${puerto}/`, {
    waitUntil: 'domcontentloaded',
    timeout: 45_000,
  });
  await paginaTunel.waitForTimeout(4_000);
  console.log('03-con-el-host-del-tunel ->', r?.status(), paginaTunel.url());
} catch (e) {
  console.log('03-con-el-host-del-tunel -> ERROR', e.message);
}
await paginaTunel.screenshot({ path: `${DIR}/03-con-el-host-del-tunel.png` });

await navegadorTunel.close();
await navegador.close();
