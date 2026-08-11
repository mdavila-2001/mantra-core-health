import { nombreSeguro } from '../nombres';

/**
 * Captura de evidencia visual. **Lado del navegador.**
 *
 * La mitad de Node vive en `cypress/harness/evidencia.ts`: acá se decide qué
 * capturar y cómo se llama; allá se reubica el archivo y se anota el
 * manifiesto. La frontera es `cy.task`, y está donde tiene que estar — escribir
 * archivos no es cosa del navegador.
 */

/** Identidad de una pantalla dentro del reporte. */
export interface Pantalla {
  /** Carpeta donde caen sus capturas. */
  readonly carpeta: string;
  /** Rótulo legible para el reporte. */
  readonly titulo: string;
}

/**
 * Lleva la cuenta del orden de captura dentro de cada pantalla.
 *
 * Es estado de módulo a propósito: Cypress corre un archivo de prueba por vez,
 * así que no hay dos pantallas capturando a la vez, y pasar el contador por
 * parámetro obligaría a que cada prueba lo hilvane por todos lados sin ganar
 * nada.
 */
const contadores = new Map<string, number>();

export interface OpcionesCaptura {
  /**
   * Página entera (por defecto) o sólo lo que se ve.
   *
   * Para una pantalla del producto la página entera es lo correcto: entra
   * completa y se lee de un vistazo. Para la vitrina de diseño no: mide más de
   * veinte mil píxeles de alto, cada captura pesa dos megabytes y medio, y
   * doscientas de ellas son medio giga de imágenes **casi idénticas** —cambia un
   * recuadro y el resto es el mismo—. Recortar a lo visible no pierde nada ahí,
   * porque el clic ya dejó el control accionado a la vista, y da una evidencia
   * más nítida de lo que efectivamente cambió.
   */
  readonly paginaCompleta?: boolean;
}

/**
 * Captura la pantalla y la anota en el manifiesto.
 *
 * El nombre lleva la carpeta adentro (`40-vitrina/03-clic-en-guardar`): Cypress
 * crea los subdirectorios solo, y el evento `after:screenshot` del arnés se
 * encarga de sacar del medio la carpeta del archivo de spec.
 */
export function capturar(
  pantalla: Pantalla,
  accion: string,
  opciones: OpcionesCaptura = {},
): void {
  const { paginaCompleta = true } = opciones;

  const orden = contadores.get(pantalla.carpeta) ?? 0;
  contadores.set(pantalla.carpeta, orden + 1);

  const base = `${String(orden).padStart(2, '0')}-${nombreSeguro(accion)}`;
  const nombre = `${pantalla.carpeta}/${base}`;

  cy.congelar();
  cy.screenshot(nombre, {
    capture: paginaCompleta ? 'fullPage' : 'viewport',
    overwrite: true,
    log: false,
  });

  cy.url({ log: false }).then((url) => {
    const direccion = new URL(url);
    cy.task(
      'anotar',
      {
        pantalla: pantalla.carpeta,
        titulo: pantalla.titulo,
        url: direccion.pathname + direccion.search,
        accion,
        archivo: `artifacts/recorrido/${nombre}.png`,
        orden,
      },
      { log: false },
    );
  });
}

/** Reinicia los contadores. Lo llama el arranque de cada archivo de recorrido. */
export function reiniciarContadores(): void {
  contadores.clear();

  /**
   * El recorrido carga páginas mucho más pesadas que el resto de la suite.
   *
   * La vitrina de diseño mide más de veinte mil píxeles de alto y el explorador
   * vuelve a entrar cada vez que una acción navega, así que la misma pantalla se
   * carga decenas de veces en una prueba. Con el techo de la suite funcional
   * —que prueba pantallas normales— eso vence, y el fallo dice «tu página no
   * disparó su evento load», que suena a defecto de la aplicación y no lo es.
   *
   * Se sube acá y no en `cypress.config.ts` para que la suite funcional
   * conserve un techo exigente: ahí una carga lenta **sí** es un hallazgo.
   */
  Cypress.config('pageLoadTimeout', 120_000);
}

/**
 * Deja constancia de lo que el recorrido **no** capturó.
 *
 * Un recorrido que recorta —por tope de acciones, por un control que no se pudo
 * accionar— y no lo dice se lee como cobertura completa, que es justo la
 * conclusión equivocada.
 */
export function anotarOmision(pantalla: string, motivo: string): void {
  cy.task('anotarOmision', { pantalla, motivo }, { log: false });
}

/**
 * Espera a que la pantalla se quede quieta.
 *
 * Esperar a que no queden peticiones sería lo obvio y es justamente lo que no
 * sirve acá: la aplicación abre una conexión de telemetría que nunca cierra, así
 * que la espera vencería siempre. Lo que se espera es que el documento esté
 * cargado y que Angular haya pintado — un `requestAnimationFrame` doble alcanza:
 * el primero corre antes del pintado, el segundo después.
 */
export function esperarEstable(): void {
  cy.esperarAplicacionLista();
}
