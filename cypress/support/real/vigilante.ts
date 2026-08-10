import { erroresDeConsola, reiniciarConsola } from '../consola';

/**
 * Entrar de verdad y mirar qué se rompe mientras se recorre.
 *
 * ## Por qué esta suite vigila la consola y la red
 *
 * Una prueba que sólo comprueba que un título aparezca da verde con la mitad de
 * las peticiones en `403` y tres excepciones en la consola. Contra datos
 * simulados eso casi no pasa —el simulador responde lo que la pantalla espera—;
 * contra la API real pasa todo el tiempo, y es exactamente lo que esta suite
 * existe para encontrar.
 *
 * Se anota **todo** y se falla sólo por lo que no puede ser normal: ver
 * {@link ERRORES_ESPERADOS}.
 *
 * ## Cómo se observa la red acá
 *
 * Envolviendo `fetch` y `XMLHttpRequest` en la ventana de la aplicación, no con
 * `cy.intercept`. Interceptar todo con Cypress obligaría a que cada respuesta
 * cruce su proxy —que es lo que hace `cy.intercept`, aunque sólo se quiera
 * mirar— y en un recorrido de quince pantallas eso cambia los tiempos que la
 * suite está tratando de medir. Envolver es pasivo: ve exactamente lo que pasó.
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
 * pantalla lo convierte en una puerta hacia la verificación. Tratarlo como fallo
 * haría que la suite exija romper el producto para dar verde.
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

/** Ruidos del navegador y del entorno que no dicen nada del producto. */
const RUIDO = [/favicon/i, /Download the Angular DevTools/i, /\[vite\]/i, /Failed to load resource:/i];

/**
 * Violaciones de CSP por scripts en línea.
 *
 * **Son un artefacto del servidor de desarrollo, no un defecto del producto.**
 * Los scripts en línea se autorizan por hash, y los hashes se recolectan
 * recorriendo el **artefacto construido**. Bajo `ng serve` ese artefacto no es
 * el que se sirve, así que sus hashes no están en la lista.
 *
 * La CSP de producción se verifica donde corresponde: la suite funcional corre
 * contra el artefacto y audita los hashes uno por uno.
 *
 * No se descartan en silencio: quedan como nota de cobertura en el reporte, que
 * es la diferencia entre «se decidió ignorar esto» y «nadie lo miró».
 */
const CSP_DE_DESARROLLO = /Content Security Policy directive/i;

/** Las respuestas con error que vio la ventana. Se vacía en cada prueba. */
let respuestasFallidas: { status: number; url: string }[] = [];

/**
 * Envuelve `fetch` y `XMLHttpRequest` para anotar cada respuesta de error.
 *
 * Se engancha en `window:before:load`, antes de que la aplicación exista: si se
 * hiciera después, las peticiones del arranque —las que más fallan— ya habrían
 * salido y vuelto.
 */
export function vigilarRed(ventana: Cypress.AUTWindow): void {
  const fetchOriginal = ventana.fetch.bind(ventana);
  ventana.fetch = async (...argumentos: Parameters<typeof fetch>): Promise<Response> => {
    const respuesta = await fetchOriginal(...argumentos);
    if (respuesta.status >= 400) {
      respuestasFallidas.push({ status: respuesta.status, url: respuesta.url });
    }
    return respuesta;
  };

  const abrirOriginal = ventana.XMLHttpRequest.prototype.open;
  ventana.XMLHttpRequest.prototype.open = function (
    this: XMLHttpRequest,
    metodo: string,
    url: string | URL,
    ...resto: unknown[]
  ) {
    this.addEventListener('load', () => {
      if (this.status >= 400) {
        respuestasFallidas.push({ status: this.status, url: String(url) });
      }
    });
    return (abrirOriginal as (...args: unknown[]) => void).apply(this, [metodo, url, ...resto]);
  } as typeof ventana.XMLHttpRequest.prototype.open;
}

/**
 * Acumulador de problemas de una corrida.
 *
 * Se le dice en qué pantalla está para que cada hallazgo quede atribuido, y al
 * final `hallazgos()` devuelve todo lo visto.
 */
export class Vigilante {
  private readonly problemas: Problema[] = [];
  private pantalla = 'arranque';
  private static cspNotada = false;

  constructor(private readonly actor: string) {
    respuestasFallidas = [];
    reiniciarConsola();
  }

  /** Cambia la pantalla a la que se atribuyen los problemas que vengan. */
  en(pantalla: string): void {
    this.pantalla = pantalla;
  }

  /**
   * Recoge lo que se acumuló desde la última recolección.
   *
   * Hay que llamarlo después de cada pantalla: los mensajes de consola y las
   * respuestas viven en el navegador y no se atribuyen solos.
   */
  recoger(): void {
    for (const mensaje of erroresDeConsola()) {
      if (RUIDO.some((patron) => patron.test(mensaje.texto))) {
        continue;
      }
      if (CSP_DE_DESARROLLO.test(mensaje.texto)) {
        this.notarCsp();
        continue;
      }
      this.anotar(mensaje.tipo === 'error' ? 'consola' : 'excepcion', mensaje.texto);
    }
    reiniciarConsola();

    for (const respuesta of respuestasFallidas) {
      if (RUIDO.some((patron) => patron.test(respuesta.url))) {
        continue;
      }
      if (
        ERRORES_ESPERADOS.some((e) => e.status === respuesta.status && e.ruta.test(respuesta.url))
      ) {
        continue;
      }
      this.anotar('http', `${respuesta.status} ${respuesta.url}`);
    }
    respuestasFallidas = [];
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
    cy.task('anotarOmision', {
      pantalla: 'toda la corrida',
      motivo:
        'Se ignoraron las violaciones de CSP por scripts en línea: bajo `ng serve` los hashes ' +
        'que autoriza `src/server/security-headers.ts` salen del artefacto construido, que no ' +
        'es el que se sirve. La CSP de producción la verifica la suite funcional, que corre ' +
        'contra el artefacto y audita los hashes uno por uno.',
    });
  }

  private anotar(tipo: Problema['tipo'], detalle: string): void {
    const problema: Problema = { actor: this.actor, pantalla: this.pantalla, tipo, detalle };
    this.problemas.push(problema);
    cy.task('anotarProblema', problema, { log: false });
  }
}

/** Los hallazgos en texto, para que el fallo diga qué pasó sin abrir archivos. */
export function describirHallazgos(problemas: readonly Problema[]): string {
  if (problemas.length === 0) {
    return 'sin hallazgos';
  }
  return problemas
    .map((p) => `· [${p.tipo}] ${p.actor} · ${p.pantalla}: ${p.detalle}`)
    .join('\n');
}
