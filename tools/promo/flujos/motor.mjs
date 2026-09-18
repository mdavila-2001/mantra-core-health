/**
 * Maneja la aplicación de verdad y graba el ejercicio completo, fotograma a fotograma.
 *
 * No hay pantallas dibujadas ni capturas quietas: se abre la maqueta, se escribe campo
 * por campo —los que el layout separa van separados—, se hace clic donde hay que hacerlo
 * y se fotografía lo que la aplicación responde. Sale:
 *   <flujo>/app/fNNNNN.png   los fotogramas de la aplicación, sin repetir los que no cambian
 *   <flujo>/guion.js         qué fotograma toca en cada instante, dónde está el puntero,
 *                            y los rótulos y escenas que el escenario pinta encima.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const VP = { width: 1520, height: 950 };
export const FPS = 30;

export function crearMotor({ navegador, base, dir, flujo, seco = false }) {
  const raiz = join(dir, flujo);
  rmSync(raiz, { recursive: true, force: true });
  mkdirSync(join(raiz, 'app'), { recursive: true });

  const frames = [], puntero = [], escenas = [], rotulos = [], fallos = [];
  let nFoto = 0, ultima = null, pos = { x: 60, y: 104 }, visible = false, pulso = -1, pg = null;

  const empujar = (veces = 1) => {
    for (let i = 0; i < veces; i++) {
      frames.push(ultima);
      const p = pulso >= 0 ? Math.min(1, pulso / (FPS * .42)) : -1;
      puntero.push({ x: +pos.x.toFixed(2), y: +pos.y.toFixed(2), v: visible, p: +p.toFixed(3) });
      if (pulso >= 0) { pulso++; if (p >= 1) pulso = -1; }
    }
  };
  /* En seco no se fotografía: el recorrido es el mismo y tarda minutos en vez de
     decenas. Sirve para ajustar un guion largo, no para armar el video. */
  const foto = async (veces = 1) => {
    const nombre = `f${String(nFoto++).padStart(5, '0')}.png`;
    if (!seco) await pg.screenshot({ path: join(raiz, 'app', nombre) });
    ultima = nombre;
    empujar(veces);
  };
  /** Fotografía seguido: para que se vea moverse lo que la aplicación anima sola. */
  const animar = async (cuadros) => { for (let i = 0; i < cuadros; i++) await foto(1); };
  const sostener = (segundos) => empujar(Math.round(segundos * FPS));

  const centro = async (loc) => {
    const b = await loc.boundingBox();
    if (!b) throw new Error('no encontré a dónde apuntar');
    return { x: (b.x + b.width / 2) / VP.width * 100, y: (b.y + b.height / 2) / VP.height * 100 };
  };
  /** El puntero se mueve sin tocar nada: la pantalla no cambia mientras tanto. */
  const mover = (destino, segundos = .5) => {
    const desde = { ...pos }, n = Math.round(segundos * FPS);
    visible = true;
    for (let i = 1; i <= n; i++) {
      const p = i / n, e = p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      pos = { x: desde.x + (destino.x - desde.x) * e, y: desde.y + (destino.y - desde.y) * e };
      empujar(1);
    }
  };
  const clic = async (loc, { mueve = .5, tras = 12, antes = 0 } = {}) => {
    await loc.scrollIntoViewIfNeeded().catch(() => {});
    if (antes) await animar(antes);
    mover(await centro(loc), mueve);
    pulso = 0;
    empujar(2);
    await loc.click();
    await animar(tras);
  };
  /**
   * Escribe en un campo, letra por letra, como lo haría una persona.
   *
   * `limpiar` selecciona antes lo que haya: a un campo que ya trae valor no se
   * lo sobreescribe tecleando, se le pega el dígito al lado —el plazo venía en
   * 1 y quedaba «13»—. Se hace con el atajo de seleccionar todo, que es lo que
   * haría cualquiera, y así se ve en el video.
   */
  const escribir = async (loc, texto, { cps = 22, apuntar = true, limpiar = false } = {}) => {
    await loc.scrollIntoViewIfNeeded().catch(() => {});
    if (apuntar) { mover(await centro(loc), .42); pulso = 0; empujar(2); }
    await loc.click();
    await foto(2);
    if (limpiar) {
      await pg.keyboard.press(process.platform === 'darwin' ? 'Meta+a' : 'Control+a');
      await foto(3);
    }
    const porLetra = Math.max(1, Math.round(FPS / cps));
    for (const letra of texto) { await pg.keyboard.type(letra); await foto(porLetra); }
  };
  /**
   * Escribe de un golpe en un campo con máscara, como quien pega.
   *
   * Los campos de fecha se repintan solos a `DD/MM/AAAA` al recibir el foco, así
   * que ni `fill()` ni teclear dígito por dígito los llenan: lo primero deja
   * `DD/MM/AAAA17/12/2002` y lo segundo se come la mitad. El camino que la
   * máscara sí acepta es el del pegado —el `value` nativo más un `input`—, el
   * mismo que usa la suite de la casa
   * (`playwright/registro-doctor-universidad-y-profesiones.spec.ts`).
   */
  const pegar = async (loc, texto, { apuntar = true } = {}) => {
    await loc.scrollIntoViewIfNeeded().catch(() => {});
    if (apuntar) { mover(await centro(loc), .42); pulso = 0; empujar(2); }
    await loc.click();
    await foto(2);
    await loc.evaluate((el, valor) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(el, valor);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, texto);
    await foto(4);
  };
  /** Elige en un desplegable: el puntero va y queda lo elegido a la vista. */
  const elegir = async (loc, opcion, { apuntar = true } = {}) => {
    await loc.scrollIntoViewIfNeeded().catch(() => {});
    if (apuntar) { mover(await centro(loc), .45); pulso = 0; empujar(2); }
    await loc.selectOption(opcion);
    await foto(6);
  };
  /** Baja o sube la pantalla, fotografiando el recorrido. */
  const desplazar = async (hasta, segundos = 1.1) => {
    const desde = await pg.evaluate(() => window.scrollY);
    const n = Math.max(1, Math.round(segundos * FPS / 2));
    for (let i = 1; i <= n; i++) {
      const p = i / n, e = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      await pg.evaluate((y) => window.scrollTo(0, y), desde + (hasta - desde) * e);
      await foto(2);
    }
  };

  /**
   * Corta acá los rótulos que sigan vivos.
   *
   * Un rótulo habla de la pantalla que está debajo; si la pantalla cambia y el
   * rótulo sigue, el video dice una cosa y muestra otra. `ir()` lo llama solo
   * —navegar siempre cambia la pantalla—; para un clic que también navega, el
   * guion lo llama a mano antes.
   */
  const cortar = () => { for (const r of rotulos) if (r.hasta > frames.length) r.hasta = frames.length; };

  const ir = async (ruta, { espera = 2400, quieto = .35 } = {}) => {
    cortar();
    await pg.goto(base + ruta, { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(espera);
    await pg.addStyleTag({ content: 'aside.mock{display:none!important}' });
    await foto(1);
    sostener(quieto);
  };
  const ocultarPuntero = () => { visible = false; };

  const escena = (nombre) => {
    if (escenas.length) escenas[escenas.length - 1].hasta = frames.length;
    escenas.push({ nombre, desde: frames.length });
  };
  /** Un rótulo abajo a la izquierda, desde este instante. */
  const rotulo = (eyebrow, titulo, segundos = 3.6) =>
    rotulos.push({ desde: frames.length, hasta: frames.length + Math.round(segundos * FPS), eyebrow, titulo });

  const sesion = async (usuario, org) => {
    const ctx = await navegador.newContext({ viewport: VP, deviceScaleFactor: 1, locale: 'es-BO', timezoneId: 'America/La_Paz' });
    pg = await ctx.newPage();
    pg.on('pageerror', (e) => fallos.push(String(e).slice(0, 140)));
    if (!usuario) return pg;
    await pg.goto(base + '/auth', { waitUntil: 'domcontentloaded' });
    await pg.getByTestId('login-identifier').fill(usuario);
    await pg.locator('input[type="password"]').first().fill('demo1234');
    await pg.getByRole('button', { name: 'Entrar' }).click();
    await pg.waitForTimeout(2600);
    if (pg.url().includes('/auth/organization') && org) {
      await pg.getByText(org).first().click();
      await pg.waitForTimeout(2400);
    }
    return pg;
  };

  const guardar = () => {
    if (escenas.length) escenas[escenas.length - 1].hasta = frames.length;
    /* un rótulo no puede sobrevivir a su escena: se corta donde la escena termina */
    for (const r of rotulos) {
      const e = escenas.find((x) => x.desde <= r.desde && r.desde < x.hasta);
      if (e) r.hasta = Math.min(r.hasta, e.hasta);
    }
    writeFileSync(join(raiz, 'guion.js'),
      'window.__guion = ' + JSON.stringify({ fps: FPS, frames, puntero, escenas, rotulos }) + ';\n');
    console.log(`${flujo}: ${frames.length} fotogramas (${(frames.length / FPS).toFixed(1)} s) · ${nFoto} fotos · ${escenas.length} escenas`);
    if (fallos.length) console.log('  avisos de la aplicación:', [...new Set(fallos)].slice(0, 3));
  };

  return {
    get pagina() { return pg; },
    sesion, ir, foto, animar, sostener, mover, clic, escribir, pegar, elegir, desplazar, escena, rotulo, cortar, ocultarPuntero, guardar,
  };
}
