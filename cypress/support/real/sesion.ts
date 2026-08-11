import { capturar } from '../recorrido/evidencia';
import type { Actor } from './actores';
import type { Vigilante } from './vigilante';

/**
 * Moverse por la aplicación con una sesión real.
 *
 * Todo lo de acá existe por una restricción del backend que **no se puede
 * aflojar desde el frontend**, así que la suite se acomoda a ella.
 */

/**
 * Escribe en un campo y **comprueba que llegó entero**.
 *
 * ## Por qué no alcanza con `type`
 *
 * La aplicación se sirve con render del servidor: el formulario existe en el
 * HTML antes de que Angular lo hidrate, y las teclas que se pulsan en esa
 * ventana se escriben sobre un campo que después se reemplaza. El resultado es
 * un valor al que le faltan los **primeros** caracteres —se midieron pérdidas
 * de uno y de tres en dos corridas seguidas, así que no es un `maxlength` ni
 * una máscara: es una carrera— y un ingreso que responde `401` con las
 * credenciales correctas, que es la peor forma de fallar porque acusa al dato.
 *
 * `esperarAplicacionLista()` no la cubre: comprueba que la aplicación pintó, no
 * que este campo ya escuche. Así que se escribe, se lee lo que quedó, y si no
 * coincide se vuelve a escribir una vez. La aserción final deja el fallo a la
 * vista si el problema fuera otro, en vez de reintentar para siempre.
 */
function escribir(testId: string, texto: string, opciones?: { readonly log: boolean }): void {
  cy.porTestId(testId).clear().type(texto, opciones);
  cy.porTestId(testId).then(($campo) => {
    if ($campo.val() !== texto) {
      cy.porTestId(testId).clear().type(texto, opciones);
    }
  });
  cy.porTestId(testId).should('have.value', texto);
}

/**
 * Entra por la pantalla de ingreso, como una persona.
 *
 * La contraseña se localiza por su identificador de prueba y no por su etiqueta:
 * el campo lleva dentro un botón de mostrar/ocultar cuyo nombre accesible
 * también dice «contraseña», así que buscar por etiqueta devuelve dos elementos.
 */
/** Completa las credenciales y envía. */
function completarYEnviar(actor: Actor): void {
  escribir('login-identifier', actor.identificador);
  escribir('login-password', actor.clave, { log: false });
  cy.porTestId('login-submit').click();
}

export function entrar(actor: Actor): void {
  cy.visit('/auth');
  cy.esperarAplicacionLista();

  completarYEnviar(actor);

  // Segundo síntoma de la misma carrera, y peor que el de las teclas: cuando el
  // clic llega antes de que Angular hidrate, **el navegador envía el formulario
  // por su cuenta**. La página recarga, la dirección gana un `?`, los campos
  // vuelven vacíos y no se pidió nada al backend, así que el ingreso se queda
  // en `/auth` sin un solo mensaje de error que explique por qué.
  //
  // Se reconoce por el campo vacío —después de un envío nativo no queda nada— y
  // se rehace una vez. Se busca dentro del `body` en lugar de con `porTestId`
  // para que un ingreso exitoso, donde el formulario ya no existe, no falle acá.
  cy.get('body').then(($cuerpo) => {
    const campo = $cuerpo.find('[data-testid="login-identifier"]');
    if (campo.length === 1 && campo.val() === '') {
      completarYEnviar(actor);
    }
  });

  // Dos destinos legítimos: el panel, o la elección de organización cuando la
  // sesión pertenece a más de una. Esperar sólo el panel dejaría la suite roja
  // para cualquiera con dos organizaciones, que es normal.
  cy.location('pathname', { timeout: 30_000 }).should('match', /^\/(panel|auth\/organizacion)/);

  cy.location('pathname').then((ruta) => {
    if (!ruta.includes('/auth/organizacion')) {
      return;
    }
    capturar({ carpeta: 'sesion', titulo: 'Elegir organización' }, 'elegir-organizacion');
    cy.porTestId('tenant-opcion').first().click();
    cy.location('pathname', { timeout: 30_000 }).should('match', /\/panel/);
  });
}

/**
 * Va a una ruta **sin recargar la página**, como lo hace el menú.
 *
 * ## Por qué no `cy.visit`
 *
 * Cada carga completa cuesta un canje de refresh token: la sesión sólo persiste
 * el refresh, así que al arrancar `AuthService` lo cambia por un par nuevo. Y
 * `POST /iam/auth/token/refresh` está limitado a **diez por minuto y por IP**.
 * Un recorrido de quince pantallas con `visit` gasta quince canjes y el
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
export function irA(ruta: string): void {
  cy.window({ log: false }).then((ventana) => {
    ventana.history.pushState({}, '', ruta);
    ventana.dispatchEvent(new ventana.PopStateEvent('popstate', { state: {} }));
  });
}

/**
 * Espera a que la pantalla deje de moverse.
 *
 * Las pantallas encadenan lecturas —la agenda pide recursos, después citas y
 * cupos, después terminología— así que además de que la aplicación esté viva se
 * espera a que **no quede ningún esqueleto de carga**: es la señal de que la
 * última lectura terminó, y la que no depende de un plazo fijo.
 */
export function estable(): void {
  cy.esperarAplicacionLista();
  cy.get('app-skeleton, [aria-busy="true"]', { log: false, timeout: 20_000 }).should(
    'have.length',
    0,
  );
}

/**
 * Comprueba si algo está, y **deja constancia si no está**.
 *
 * Es el reemplazo de un `if` a secas, que tenía dos defectos a la vez: no
 * esperaba —una pantalla que encadena tres lecturas todavía no había pintado su
 * tabla— y, cuando el elemento no estaba, saltaba el bloque **en silencio**. El
 * recorrido perdió las ocho pestañas del expediente en una corrida y el reporte
 * se leyó como cobertura completa.
 *
 * La espera la aporta `estable()`, que hay que llamar antes: para cuando esto
 * mira el DOM, la pantalla ya terminó de cargar. Se consulta sin `cy.get` a
 * propósito, porque `cy.get` de algo ausente **hace fallar la prueba** y acá la
 * ausencia es un dato, no un fallo.
 *
 * @returns `true` si apareció; `false` y una nota en el reporte si no.
 */
export function aparece(
  selector: string,
  pantalla: string,
  queEs: string,
): Cypress.Chainable<boolean> {
  return cy.get('body', { log: false }).then(($cuerpo) => {
    const esta = $cuerpo.find(selector).length > 0;
    if (!esta) {
      cy.task(
        'anotarOmision',
        { pantalla, motivo: `No se capturó ${queEs}: no estaba en la pantalla.` },
        { log: false },
      );
    }
    return esta;
  });
}

/**
 * Va a una ruta, espera, captura y comprueba que se pintó algo.
 *
 * La comprobación mínima —que exista un `h1` con texto— es deliberadamente
 * pobre: lo que de verdad juzga esta suite son los problemas que junta el
 * {@link Vigilante}. Una aserción de contenido por pantalla convertiría esto en
 * pruebas de interfaz, que ya existen en otra suite y con otra herramienta.
 */
export function recorrer(
  vigilante: Vigilante,
  destino: { readonly ruta: string; readonly carpeta: string; readonly titulo: string },
): void {
  vigilante.en(destino.titulo);
  irA(destino.ruta);
  estable();
  capturar({ carpeta: destino.carpeta, titulo: destino.titulo }, 'al-entrar');

  // Un `h1` vacío es una pantalla que no montó. No dice si el contenido está
  // bien, pero sí que algo se dibujó.
  cy.get('h1', { timeout: 15_000 }).first().invoke('text').should('match', /\S/);

  cy.then(() => vigilante.recoger());
}
