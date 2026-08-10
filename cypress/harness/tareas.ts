import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { request } from 'node:http';
import { createRequire } from 'node:module';

import { configuracion } from '../support/config';
import { leerContadores, reiniciarContadores, type Contadores } from './api-simulada';
import {
  anotar,
  anotarOmision,
  anotarProblema,
  escribirResumen,
  limpiarEvidencias,
  type Anotacion,
  type Problema,
} from './evidencia';

/**
 * Las tareas de Node que las pruebas pueden pedir con `cy.task`.
 *
 * Cypress corre las pruebas **dentro del navegador**, así que todo lo que
 * necesite el sistema de archivos, un socket crudo o el estado del arnés tiene
 * que pasar por acá. No es un rodeo: es la frontera, y tenerla explícita evita
 * la tentación de meter `node:fs` en un archivo que después se bundlea para el
 * navegador y falla con un error que no menciona la causa.
 *
 * Toda tarea devuelve algo —aunque sea `null`—: Cypress falla si una tarea
 * devuelve `undefined`, porque no puede distinguirlo de una tarea que no existe.
 */

export interface RespuestaCruda {
  readonly estado: number;
  readonly cuerpo: string;
  readonly cabeceras: Record<string, string>;
}

/**
 * Pide una ruta con un `Host` elegido a mano y devuelve la respuesta cruda.
 *
 * Existe porque `Host` es una **cabecera prohibida** para `fetch` y para
 * `cy.request`: las dos la descartan en silencio, así que la petición saldría
 * con el host real y la prueba pasaría sin comprobar nada. `node:http` sí la
 * deja escribir, que es justo lo que hace falta para verificar la defensa
 * contra SSRF del renderizado de Angular.
 */
function pedirConHost(opciones: { host: string; ruta: string }): Promise<RespuestaCruda> {
  const { puerto } = configuracion();

  return new Promise((resolver, rechazar) => {
    const peticion = request(
      {
        host: '127.0.0.1',
        port: puerto,
        path: opciones.ruta,
        headers: { Host: opciones.host },
      },
      (respuesta) => {
        let cuerpo = '';
        respuesta.setEncoding('utf8');
        respuesta.on('data', (trozo: string) => (cuerpo += trozo));
        respuesta.on('end', () =>
          resolver({
            estado: respuesta.statusCode ?? 0,
            cuerpo,
            cabeceras: Object.fromEntries(
              Object.entries(respuesta.headers).map(([clave, valor]) => [
                clave,
                Array.isArray(valor) ? valor.join(', ') : (valor ?? ''),
              ]),
            ),
          }),
        );
      },
    );
    peticion.on('error', rechazar);
    peticion.end();
  });
}

export interface AuditoriaCsp {
  /** La cabecera tal como la emite el servidor. */
  readonly csp: string;
  /** Un hash `sha256-…` por cada `<script>` en línea del documento. */
  readonly hashesDelHtml: readonly string[];
  /** Los hashes que la cabecera autoriza. */
  readonly hashesAutorizados: readonly string[];
  /** Los del documento que la cabecera **no** autoriza. Vacío es lo correcto. */
  readonly sinAutorizar: readonly string[];
}

/**
 * Contrasta los scripts en línea del documento contra los hashes de la CSP.
 *
 * ## Por qué esta prueba existe
 *
 * La suite anterior detectaba una CSP mal armada de rebote: si un hash no
 * cuadraba, el navegador bloqueaba el script, la aplicación arrancaba a medias y
 * la consola lo gritaba. **Cypress elimina la cabecera CSP** de las respuestas
 * para poder inyectarse en la página, así que ese mecanismo ya no salta: el
 * navegador nunca la aplica y una CSP rota daría verde.
 *
 * Esto lo comprueba directamente y sin depender de que el navegador la aplique:
 * se calculan los hashes de los scripts en línea que el servidor manda y se
 * verifica que la cabecera los autorice a todos. Es el mismo defecto —un script
 * cuyo hash no está en la lista— atrapado antes y con un mensaje que lo nombra.
 */
async function auditarCsp(opciones: { ruta: string }): Promise<AuditoriaCsp> {
  const { baseUrl } = configuracion();
  const respuesta = await fetch(`${baseUrl}${opciones.ruta}`);
  const html = await respuesta.text();
  const csp = respuesta.headers.get('content-security-policy') ?? '';

  // Solo los `<script>` sin `src`: los externos se autorizan por origen, no por
  // hash, y meterlos acá produciría hashes que la CSP nunca va a declarar.
  const enLinea = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((coincidencia) => coincidencia[1] ?? '')
    .filter((cuerpo) => cuerpo.trim() !== '');

  const hashesDelHtml = enLinea.map(
    (cuerpo) => `sha256-${createHash('sha256').update(cuerpo, 'utf8').digest('base64')}`,
  );

  const hashesAutorizados = [...csp.matchAll(/'(sha256-[A-Za-z0-9+/=]+)'/g)].map(
    (coincidencia) => coincidencia[1] ?? '',
  );

  return {
    csp,
    hashesDelHtml,
    hashesAutorizados,
    sinAutorizar: hashesDelHtml.filter((hash) => !hashesAutorizados.includes(hash)),
  };
}

/**
 * La fuente de `axe-core`, leída del paquete instalado.
 *
 * ## Por qué desde disco y no `import axe from 'axe-core'`
 *
 * El análisis tiene que correr **dentro** de la ventana de la aplicación, así
 * que hay que inyectarle la fuente como texto. Importar el paquete en el código
 * de las pruebas parece equivalente y no lo es: eso pasa por el empaquetador de
 * Cypress, que envuelve el módulo, y lo que termina inyectándose en la página
 * arranca con un `exports` que ahí no existe — `ReferenceError: exports is not
 * defined`, y ninguna prueba de accesibilidad corre.
 *
 * Leer el archivo del paquete evita al empaquetador por completo: lo que se
 * inyecta es exactamente el bundle que publica `axe-core`, que está hecho para
 * eso.
 *
 * Se cachea porque son ~600 kB y las pruebas de accesibilidad lo piden una vez
 * por pantalla.
 */
let fuenteDeAxe: string | null = null;

function leerFuenteDeAxe(): string {
  if (fuenteDeAxe === null) {
    const requerir = createRequire(import.meta.url);
    fuenteDeAxe = readFileSync(requerir.resolve('axe-core/axe.min.js'), 'utf8');
  }
  return fuenteDeAxe;
}

/** Registra todas las tareas en el proceso de Node de Cypress. */
export function tareas(): Cypress.Tasks {
  return {
    /** Petición cruda con `Host` a medida. Ver `pedirConHost`. */
    pedirConHost: (opciones: { host: string; ruta: string }) => pedirConHost(opciones),

    /** La fuente de `axe-core` para inyectar en la página. Ver `leerFuenteDeAxe`. */
    fuenteDeAxe: (): string => leerFuenteDeAxe(),

    /** Contrasta los scripts en línea contra los hashes de la CSP. */
    auditarCsp: (opciones: { ruta: string }) => auditarCsp(opciones),

    /** Cuántos logins y refrescos vio el arnés. */
    contadores: (): Contadores => leerContadores(),

    /** Pone los contadores en cero: lo llama el `beforeEach` que los usa. */
    reiniciarContadores: (): null => {
      reiniciarContadores();
      return null;
    },

    // --- Evidencia del recorrido ---------------------------------------------

    limpiarEvidencias: (): null => limpiarEvidencias(),
    anotar: (anotacion: Anotacion): null => anotar(anotacion),
    anotarOmision: (datos: { pantalla: string; motivo: string }): null => anotarOmision(datos),
    anotarProblema: (problema: Problema): null => anotarProblema(problema),
    escribirResumen: (datos: Record<string, unknown>): null => escribirResumen(datos),

    /**
     * Deja constancia en la salida de la corrida.
     *
     * `console.log` dentro de una prueba escribe en la consola del navegador,
     * que en `cypress run` nadie ve. Esto escribe en la del proceso, que es la
     * que queda en el registro de CI.
     */
    registrar: (mensaje: string): null => {
      console.log(`[e2e] ${mensaje}`);
      return null;
    },
  };
}
