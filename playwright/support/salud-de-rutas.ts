import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Page } from '@playwright/test';

import { urlDeApi } from './actores';

/**
 * Instrumentación del barrido del carril 19: qué le pasa a una ruta cuando se
 * abre de verdad.
 *
 * Lo que se mide no es «¿renderizó?» —eso lo cumple hasta una pantalla vacía—
 * sino las cuatro formas en que una ruta puede estar rota sin que se note:
 *
 * 1. **no llega**: el router la rebota o se queda donde estaba;
 * 2. **llega y no pinta nada**: la región principal queda vacía;
 * 3. **llega y se queja**: excepción en consola, error de hidratación;
 * 4. **llega y el backend le dice que no**: 4xx/5xx en sus lecturas.
 *
 * Ninguna de las cuatro se ve en una captura de pantalla, que es exactamente el
 * motivo por el que este carril existe.
 */

/** Una ruta del catálogo generado por `scripts/audit-design-views.mjs`. */
export interface RutaDelCatalogo {
  readonly ruta: string;
  readonly componente: string;
  readonly estado: string;
  readonly parametrizada: boolean;
  readonly roles?: readonly string[];
  readonly rolesExclusivos?: boolean;
  readonly etiqueta?: string;
  readonly seccion?: string;
  readonly actor?: string | null;
}

export interface CatalogoDeRutas {
  readonly secciones: readonly RutaDelCatalogo[];
  readonly hijas: readonly RutaDelCatalogo[];
  readonly portadas: readonly RutaDelCatalogo[];
}

/**
 * El catálogo, leído del archivo generado.
 *
 * **No hay una lista de rutas escrita a mano en esta suite** a propósito: se
 * quedaría vieja el día que alguien agregue una pantalla, y el barrido diría
 * «todo bien» sin haberla mirado nunca.
 */
export function catalogoDeRutas(): CatalogoDeRutas {
  return JSON.parse(
    readFileSync(join('docs', 'reports', 'generated', 'rutas.json'), 'utf8'),
  ) as CatalogoDeRutas;
}

/** Cómo terminó una ruta. */
export type EstadoDeRuta =
  | 'ok'
  | 'vacía'
  | 'denegada'
  | 'no navega'
  | 'error de consola'
  | 'error de API';

export interface ResultadoDeRuta {
  readonly ruta: string;
  readonly rol: string;
  readonly componente: string;
  readonly estado: EstadoDeRuta;
  /** Qué se vio: el mensaje del error, el código de la petición, etc. */
  readonly detalle: string;
}

/**
 * Lo que la página fue reportando desde la última vez que se vació.
 *
 * Se acumula por navegación y no por prueba: hay que poder atribuir un error a
 * la ruta que lo produjo, no a la corrida entera.
 */
export interface Vigilante {
  readonly erroresDeConsola: string[];
  readonly peticionesFallidas: string[];
  limpiar(): void;
}

/**
 * Mensajes de consola que **no** son un defecto de la pantalla.
 *
 * La lista es corta y cada entrada está justificada: si crece sin motivo, el
 * barrido deja de servir porque empieza a tapar lo que tiene que encontrar.
 */
const RUIDO_ESPERADO: readonly RegExp[] = [
  // El navegador se queja de los `preload` que el build genera para rutas que
  // esta corrida no visita. Es del empaquetador, no de la pantalla.
  /was preloaded using link preload but not used/i,
  // Angular avisa de la hidratación en desarrollo cuando el DOM del servidor y
  // el del cliente difieren por una extensión del navegador. No hay extensiones
  // en esta corrida, pero el aviso aparece igual en modo desarrollo.
  /NG0505|NG0506/,
  // Chrome DevTools pide este archivo solo cuando hay un depurador conectado.
  /\.well-known\/appspecific/,
  /**
   * Chromium escribe en la consola **toda** petición que no vuelve 2xx, con el
   * mismo `console.error` con el que la aplicación reportaría una excepción. Un
   * `403` de un endpoint que el rol no puede leer es una respuesta correcta —el
   * backend autorizando— y {@link esFalloReal} ya lo declara así del lado de la
   * red.
   *
   * Sin esta línea el barrido se contradecía consigo mismo: descartaba el 403
   * como respuesta y lo volvía a contar como «error de consola», y la matriz
   * marcaba en rojo seis pantallas cuyo único pecado era que la seguridad
   * funciona. Un instrumento que llora lobo deja de servir para encontrar al
   * lobo.
   *
   * Los códigos son los mismos que `esFalloReal` perdona, y por el mismo
   * motivo. Un `500` no entra acá: ése sí se reporta.
   */
  /Failed to load resource.*status of (401|403|404|409|422)\b/,
];

/**
 * Códigos de respuesta que **no** cuentan como ruta rota.
 *
 * El `401` y el `403` son respuestas correctas de un backend que autoriza: si
 * el barrido los contara como error, mediría que la seguridad funciona y lo
 * llamaría defecto. El `404` de un identificador inventado, lo mismo.
 */
function esFalloReal(status: number): boolean {
  return status >= 500 || (status >= 400 && ![401, 403, 404, 409, 422].includes(status));
}

/** Empieza a escuchar lo que la página reporta. */
export function vigilar(page: Page): Vigilante {
  const erroresDeConsola: string[] = [];
  const peticionesFallidas: string[] = [];
  const api = urlDeApi();

  page.on('console', (mensaje) => {
    if (mensaje.type() !== 'error') return;
    const texto = mensaje.text();
    if (RUIDO_ESPERADO.some((patron) => patron.test(texto))) return;
    erroresDeConsola.push(texto.slice(0, 200));
  });

  page.on('pageerror', (error) => {
    erroresDeConsola.push(`excepción sin capturar: ${error.message.slice(0, 200)}`);
  });

  page.on('response', (respuesta) => {
    const url = respuesta.url();
    // Sólo las lecturas de la aplicación: el proxy del dev server las sirve
    // bajo el mismo origen, así que no alcanza con filtrar por host.
    const esDeLaApi = url.startsWith(api) || /\/(iam|profiles|scheduling|clinical|chart|terminology|diagnostics|directory|identity|accounting|billing|forms|geo|public|community|practice|procedures|files|health-context|diagnostic-units|authz|admin)\//.test(url);
    if (!esDeLaApi) return;
    if (esFalloReal(respuesta.status())) {
      peticionesFallidas.push(`${respuesta.status()} ${new URL(url).pathname}`);
    }
  });

  return {
    erroresDeConsola,
    peticionesFallidas,
    limpiar(): void {
      erroresDeConsola.length = 0;
      peticionesFallidas.length = 0;
    },
  };
}

/**
 * ¿La región principal tiene algo adentro?
 *
 * Se mira `<main>` y no `<app-root>`: el armazón siempre pinta —menú,
 * encabezado— así que `app-root` nunca está vacío ni cuando la pantalla de
 * adentro no existe. Es justamente la trampa que hace que una pestaña muerta
 * pase por viva.
 *
 * ## Por qué insiste en vez de mirar una vez
 *
 * Porque mirar una vez medía el reloj, no la pantalla. Las secciones encadenan
 * lecturas —la agenda pide recursos y después citas— y `networkidle` se cumple
 * en el hueco entre las dos: la primera versión de este barrido declaró
 * «vacías» a `/schedule` y `/laboratory-directory` en una corrida y «ok» en la
 * siguiente, con roles distintos cada vez. Un instrumento que da dos veredictos
 * sobre lo mismo no sirve para decidir nada.
 *
 * Ahora se pregunta hasta que haya contenido o hasta el techo. **Vacía sigue
 * significando vacía** —una pantalla que no pinta nunca agota el techo igual—,
 * pero deja de significar «todavía no».
 */
export async function tieneContenido(page: Page, techoMs = 8_000): Promise<boolean> {
  const hasta = Date.now() + techoMs;

  do {
    const hay = await page.evaluate(() => {
      const principal =
        document.querySelector('main') ??
        document.querySelector('.app-main__inner') ??
        document.querySelector('app-root');
      return (principal?.textContent ?? '').trim().length > 20;
    });
    if (hay) return true;
    await page.waitForTimeout(250);
  } while (Date.now() < hasta);

  return false;
}
