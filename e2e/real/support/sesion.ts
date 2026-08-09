import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, type Locator, type Page } from '@playwright/test';

import { anotarOmision, capturar, RAIZ } from '../../recorrido/support/evidencia';
import type { Actor } from './actores';

/**
 * Entrar de verdad y mirar qué se rompe mientras se recorre.
 *
 * ## Por qué esta suite vigila la consola
 *
 * Una prueba que sólo comprueba que un título aparezca da verde con la mitad de
 * las peticiones en `403` y tres excepciones en la consola. Contra datos
 * simulados eso casi no pasa —el simulador responde lo que la pantalla espera—;
 * contra la API real pasa todo el tiempo, y es exactamente lo que esta suite
 * existe para encontrar.
 *
 * Se anota **todo** y se falla sólo por lo que no puede ser normal: ver
 * {@link ERRORES_ESPERADOS}.
 */

/** Un problema visto durante el recorrido. */
export interface Problema {
  readonly actor: string;
  readonly pantalla: string;
  readonly tipo: 'consola' | 'excepcion' | 'http';
  readonly detalle: string;
}

/**
 * Respuestas de error que **son** el comportamiento correcto y no un defecto.
 *
 * `403 IDENTITY_VERIFICATION_REQUIRED` es el ejemplo que ordena la lista: un
 * paciente recién registrado *tiene* que recibirlo al pedir su resumen, y la
 * pantalla lo convierte en una puerta hacia la verificación. Tratarlo como
 * fallo haría que la suite exija romper el producto para dar verde.
 *
 * La lista es de **rutas**, no de códigos sueltos: un `403` en cualquier otro
 * lado sigue siendo un hallazgo.
 */
const ERRORES_ESPERADOS: readonly { readonly ruta: RegExp; readonly status: number }[] = [
  // El paciente sin identidad verificada no ve su resumen. Es la puerta, no un muro.
  { ruta: /\/profiles\/patients\/me\/summary$/, status: 403 },
  // Quien no administra el padrón no lista pacientes: el archivo clínico lo
  // contempla y ofrece el acceso por identificador.
  { ruta: /\/profiles\/patients(\?|$)/, status: 403 },
  { ruta: /\/profiles\/patients\/[^/]+$/, status: 403 },
  // Sin rol clínico no hay expediente. La pantalla lo pinta como S5.
  { ruta: /\/(clinical|charts)\/patients\//, status: 403 },
  // Las relaciones asistenciales son un bloque más de la ficha: su 403 no la tumba.
  { ruta: /\/authz\/(care-relationships|legal-representations)/, status: 403 },
  // La agenda pide rol de agenda; sin él, la sección lo dice en su tabla.
  { ruta: /\/scheduling\//, status: 403 },
];

/**
 * Ruidos del navegador que no dicen nada del producto.
 *
 * «Failed to load resource: the server responded with a status of …» merece una
 * línea propia: **no es información nueva**. Es el eco que Chromium escribe en
 * la consola por cada respuesta 4xx/5xx, y esas ya las mira el oyente de
 * `response`, que es el único que sabe **qué ruta** falló y puede compararla
 * con {@link ERRORES_ESPERADOS}. El texto de consola no trae la URL, así que
 * dejarlo pasar convertiría cada `403` legítimo —el del paciente sin identidad
 * verificada, por ejemplo— en un hallazgo imposible de descartar.
 */
const RUIDO = [
  /favicon/i,
  /Download the Angular DevTools/i,
  /\[vite\]/i,
  /Failed to load resource:/i,
];

/**
 * Violaciones de CSP por scripts en línea.
 *
 * **Son un artefacto del servidor de desarrollo, no un defecto del producto**, y
 * la razón está en `src/server/security-headers.ts`: los scripts en línea se
 * autorizan por hash, y los hashes se recolectan al arrancar recorriendo el
 * **artefacto construido**. Bajo `ng serve` ese artefacto no es el que se sirve
 * —la aplicación se transforma por petición y el servidor de desarrollo inyecta
 * sus propios scripts— así que sus hashes no están en la lista y el navegador
 * los bloquea.
 *
 * La CSP de producción se verifica donde corresponde: `playwright.config.ts`
 * corre contra el artefacto construido, que es el que emite las cabeceras de
 * verdad. Si ahí la CSP bloqueara un script, la aplicación no arrancaría y esa
 * suite lo diría.
 *
 * No se descartan en silencio: quedan como nota de cobertura en el reporte, que
 * es la diferencia entre «se decidió ignorar esto» y «nadie lo miró».
 */
const CSP_DE_DESARROLLO = /Content Security Policy directive/i;

/** Acumulador de problemas de una corrida. Se vuelca al final. */
export class Vigilante {
  private readonly problemas: Problema[] = [];
  private pantalla = 'arranque';

  constructor(
    private readonly page: Page,
    private readonly actor: string,
  ) {
    page.on('console', (mensaje) => {
      if (mensaje.type() !== 'error') {
        return;
      }
      const texto = mensaje.text();
      if (RUIDO.some((patron) => patron.test(texto))) {
        return;
      }
      if (CSP_DE_DESARROLLO.test(texto)) {
        this.notarCsp();
        return;
      }
      this.anotar('consola', texto);
    });

    page.on('pageerror', (error) => this.anotar('excepcion', error.message));

    page.on('response', (respuesta) => {
      const status = respuesta.status();
      if (status < 400) {
        return;
      }
      const url = respuesta.url();
      // El favicon y los fragmentos del dev server no son la API.
      if (RUIDO.some((patron) => patron.test(url))) {
        return;
      }
      if (ERRORES_ESPERADOS.some((e) => e.status === status && e.ruta.test(url))) {
        return;
      }
      this.anotar('http', `${status} ${url}`);
    });
  }

  /** Cambia la pantalla a la que se atribuyen los problemas que vengan. */
  en(pantalla: string): void {
    this.pantalla = pantalla;
  }

  /** Los problemas vistos hasta ahora. */
  get hallazgos(): readonly Problema[] {
    return this.problemas;
  }

  /** Deja **una** nota de cobertura por corrida, no una por script bloqueado. */
  private notarCsp(): void {
    if (Vigilante.cspNotada) {
      return;
    }
    Vigilante.cspNotada = true;
    anotarOmision(
      'toda la corrida',
      'Se ignoraron las violaciones de CSP por scripts en línea: bajo `ng serve` los hashes ' +
        'que autoriza `src/server/security-headers.ts` salen del artefacto construido, que no ' +
        'es el que se sirve. La CSP de producción la verifica `yarn e2e`, que corre contra el ' +
        'artefacto.',
    );
  }

  /** Compartida entre pruebas: la nota es de la corrida, no de una pantalla. */
  private static cspNotada = false;

  private anotar(tipo: Problema['tipo'], detalle: string): void {
    const problema: Problema = { actor: this.actor, pantalla: this.pantalla, tipo, detalle };
    this.problemas.push(problema);
    mkdirSync(RAIZ, { recursive: true });
    appendFileSync(join(RAIZ, 'problemas.jsonl'), `${JSON.stringify(problema)}\n`, 'utf8');
  }
}

/**
 * Los hallazgos en texto, para que el fallo diga qué pasó sin abrir archivos.
 *
 * Va como mensaje de la aserción y no como `console.log`: el reporte de
 * Playwright muestra el mensaje, y una lista de problemas que hay que ir a
 * buscar a un `.jsonl` es una lista que nadie mira.
 */
export function resumen(vigilante: Vigilante): string {
  if (vigilante.hallazgos.length === 0) {
    return 'sin hallazgos';
  }
  return vigilante.hallazgos.map((p) => `· [${p.tipo}] ${p.pantalla}: ${p.detalle}`).join('\n');
}

/**
 * Cuántas veces se reintenta el ingreso cuando la API responde `429`.
 *
 * `POST /iam/auth/login` está limitado a **10 por minuto y por IP** con
 * `@Throttle`, y eso es una defensa contra fuerza bruta, no un estorbo: la
 * suite se acomoda a ella en vez de pedir que la aflojen. Cada actor entra una
 * sola vez —su recorrido es una prueba, no seis— así que llegar al tope
 * significa que se relanzó la suite dentro del mismo minuto, y esperar es
 * exactamente lo correcto.
 */
const REINTENTOS_DE_INGRESO = 3;

/** La ventana del `@Throttle` del backend es de 60 s; se espera un poco más. */
const ESPERA_TRAS_429_MS = 65_000;

/**
 * Entra por la pantalla de ingreso, como una persona.
 *
 * La contraseña se localiza por `type="password"` y no por su etiqueta: el campo
 * lleva dentro un botón de mostrar/ocultar cuyo nombre accesible también dice
 * «contraseña», así que buscar por etiqueta devuelve dos elementos.
 */
export async function entrar(page: Page, actor: Actor): Promise<void> {
  for (let intento = 1; ; intento += 1) {
    // El `429` viaja en la respuesta, no en la pantalla: se escucha acá y no se
    // deduce del texto del error, que puede cambiar sin aviso.
    let limitado = false;
    const oyente = (respuesta: { status: () => number; url: () => string }) => {
      if (respuesta.status() === 429 && respuesta.url().includes('/iam/auth/login')) {
        limitado = true;
      }
    };
    page.on('response', oyente);

    await page.goto('/auth');
    await page.getByLabel(/correo o documento/i).fill(actor.identificador);
    await page.locator('input[type="password"]').first().fill(actor.clave);
    await page.getByRole('button', { name: /^entrar$/i }).click();

    try {
      // Dos destinos legítimos: el panel, o la elección de organización cuando
      // la sesión pertenece a más de una. Esperar sólo el panel dejaría la
      // suite roja para cualquiera con dos organizaciones, que es normal.
      await page.waitForURL(/\/(panel|auth\/organizacion)/, { timeout: 20_000 });
      page.off('response', oyente);
      break;
    } catch (error) {
      page.off('response', oyente);
      if (!limitado || intento >= REINTENTOS_DE_INGRESO) {
        throw error;
      }
      console.warn(
        `Ingreso limitado por el backend (429). Reintento ${intento + 1} en ${ESPERA_TRAS_429_MS / 1000} s.`,
      );
      await page.waitForTimeout(ESPERA_TRAS_429_MS);
    }
  }

  if (page.url().includes('/auth/organizacion')) {
    await capturar(
      page,
      { carpeta: 'sesion', titulo: 'Elegir organización' },
      'elegir-organizacion',
    );
    await page
      .getByRole('button', { name: /entrar|continuar|elegir/i })
      .first()
      .click();
    await page.waitForURL(/\/panel/, { timeout: 30_000 });
  }
}

/**
 * Va a una ruta **sin recargar la página**, como lo hace el menú.
 *
 * ## Por qué no `page.goto`
 *
 * Cada carga completa cuesta un canje de refresh token: la sesión sólo persiste
 * el refresh, así que al arrancar `AuthService` lo cambia por un par nuevo. Y
 * `POST /iam/auth/token/refresh` está limitado a **diez por minuto y por IP**.
 * Un recorrido de quince pantallas con `goto` gasta quince canjes y el
 * decimoprimero vuelve `429`, que la aplicación —con razón— trata como sesión
 * caída. La suite se rompía contra una protección que funciona bien.
 *
 * Y además es **más fiel**: nadie recorre una aplicación reescribiendo la
 * dirección quince veces. Se navega por el router, que es lo que hace el menú.
 *
 * `pushState` + `popstate` y no un clic en el menú lateral porque la mitad de
 * los destinos del recorrido no están en el menú —el alta, una ficha, una
 * ventana concreta de la agenda— y hacen falta las dos cosas igual.
 */
export async function irA(page: Page, ruta: string): Promise<void> {
  await page.evaluate((destino) => {
    window.history.pushState({}, '', destino);
    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
  }, ruta);
}

/**
 * Espera a que la pantalla deje de moverse.
 *
 * `networkidle` y no un `waitForTimeout`: las pantallas encadenan lecturas —la
 * agenda pide recursos, después citas y cupos, después terminología— y un plazo
 * fijo capturaría el esqueleto de la última. El tope alto es para la agenda, que
 * es la que más encadena.
 */
export async function estable(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => undefined);
  // Con navegación del router no hay evento de carga que esperar: `networkidle`
  // vuelve al instante si la petición todavía no salió. Este margen corto cubre
  // el hueco entre navegar y que el efecto de la pantalla dispare su lectura.
  await page.waitForTimeout(400);
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => undefined);
}

/**
 * Espera a que algo aparezca, y **deja constancia si no aparece**.
 *
 * Es el reemplazo de `if ((await locator.count()) > 0)`, que tenía dos defectos
 * a la vez: no esperaba —una pantalla que encadena tres lecturas todavía no
 * había pintado su tabla— y, cuando el elemento no estaba, saltaba el bloque
 * **en silencio**. El recorrido perdió las ocho pestañas del expediente en una
 * corrida y el reporte se leyó como cobertura completa.
 *
 * @returns `true` si apareció; `false` y una nota en el reporte si no.
 */
export async function aparece(
  locator: Locator,
  pantalla: string,
  queEs: string,
  timeout = 15_000,
): Promise<boolean> {
  try {
    await locator.first().waitFor({ state: 'visible', timeout });
    return true;
  } catch {
    anotarOmision(pantalla, `No se capturó ${queEs}: no apareció en ${timeout / 1000} s.`);
    return false;
  }
}

/**
 * Va a una ruta, espera, captura y comprueba que se pintó algo.
 *
 * La comprobación mínima —que exista un `h1` con texto— es deliberadamente
 * pobre: lo que de verdad juzga esta suite son los problemas que junta el
 * {@link Vigilante}. Una aserción de contenido por pantalla convertiría esto en
 * pruebas de interfaz, que ya existen en otra suite y con otra herramienta.
 */
export async function recorrer(
  page: Page,
  vigilante: Vigilante,
  destino: { readonly ruta: string; readonly carpeta: string; readonly titulo: string },
): Promise<void> {
  vigilante.en(destino.titulo);
  await irA(page, destino.ruta);
  await estable(page);
  await capturar(page, { carpeta: destino.carpeta, titulo: destino.titulo }, 'al-entrar');

  // Un `h1` vacío es una pantalla que no montó. No dice si el contenido está
  // bien, pero sí que algo se dibujó.
  await expect(page.locator('h1').first()).not.toBeEmpty({ timeout: 15_000 });
}
