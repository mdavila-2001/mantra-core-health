import { anotarOmision, capturar, esperarEstable, type Pantalla } from './evidencia';

/**
 * El explorador: descubre cada control de una pantalla y lo acciona.
 *
 * ## Por qué se descubre en vez de escribirse a mano
 *
 * «Una captura por cada clic posible» escrito a mano es una lista que nace
 * desactualizada: alguien agrega un botón, nadie agrega su línea, y el reporte
 * sigue diciendo que cubrió todo. Acá la lista **se lee del DOM en cada
 * corrida**, así que un control nuevo aparece en la evidencia sin que nadie
 * toque este archivo — y uno que se borró deja de aparecer.
 *
 * ## Por qué se vuelve a enumerar después de cada acción
 *
 * Es lo que hace que el recorrido alcance lo que solo existe **después** de un
 * clic: los ítems de un menú desplegable, los botones de un diálogo, el segundo
 * paso de un formulario. Enumerar una sola vez al principio los perdería a
 * todos, que son justamente los estados que nadie captura a mano.
 *
 * El precio es que hay que recordar qué se accionó ya, o el explorador abriría y
 * cerraría el mismo menú para siempre. De eso se encarga `visitados`, con una
 * clave que no depende de la posición: si un clic reordena la lista, el control
 * sigue siendo el mismo.
 *
 * ## Qué cambió al pasar de Playwright a Cypress
 *
 * Dos cosas, y las dos son de forma, no de fondo:
 *
 * 1. **El bucle es recursivo.** Cypress encola comandos en vez de ejecutarlos
 *    al llamarlos, así que un `for` con `await` adentro no existe: cada paso se
 *    encadena con `.then()` sobre el anterior.
 * 2. **La accionabilidad se comprueba antes, no se atrapa después.** Playwright
 *    dejaba intentar el clic y capturar la excepción; en Cypress un clic que
 *    falla **hace fallar la prueba** y no hay forma de atraparlo. Así que se
 *    mide primero —¿tiene superficie?, ¿está tapado?, ¿está deshabilitado?— y
 *    con eso se decide entre clicar, enfocar o anotar la omisión. El desenlace
 *    es el mismo; lo que cambia es el orden en que se averigua.
 */

/** Lo que el explorador considera accionable. */
const SELECTOR_INTERACTIVO = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[role="tab"]:not([aria-disabled="true"])',
  '[role="menuitem"]:not([aria-disabled="true"])',
  '[role="switch"]:not([aria-disabled="true"])',
  '[role="checkbox"]:not([aria-disabled="true"])',
  '[role="radio"]:not([aria-disabled="true"])',
  '[role="option"]',
  'summary',
].join(', ');

export interface OpcionesRecorrido {
  /**
   * Tope de acciones por pantalla.
   *
   * Existe por la vitrina de diseño, que tiene más de doscientos controles y
   * sola se llevaría la mayor parte del tiempo de la corrida. Cuando el tope
   * recorta, **queda anotado** y el reporte lo muestra: un recorte silencioso se
   * leería como cobertura completa.
   */
  readonly maxAcciones?: number;
  /** Nombres accesibles que no se deben accionar, por expresión regular. */
  readonly evitar?: readonly RegExp[];
  /** Capturar la página entera (por defecto) o sólo lo visible. */
  readonly paginaCompleta?: boolean;
  /** Se ejecuta después de entrar a la ruta y antes de la primera captura. */
  readonly preparar?: () => void;
}

/** Una pantalla con la ruta por la que se entra. */
export interface PantallaConRuta extends Pantalla {
  readonly ruta: string;
}

/** Un control descubierto en el DOM. */
interface Control {
  readonly indice: number;
  readonly clave: string;
  readonly tipo: string;
  readonly nombre: string;
  /** `true` si se puede clicar de verdad: tiene superficie y nadie lo tapa. */
  readonly accionable: boolean;
  /**
   * `true` si accionarlo sacaría al navegador de la aplicación.
   *
   * Son los enlaces a otro origen y los que abren pestaña nueva. **En Cypress
   * hay que detectarlos y saltearlos**, y no alcanza con excluirlos por nombre:
   * Cypress le quita el `target="_blank"` a los enlaces para no perder el
   * control del navegador, así que un enlace a `who.int` que en otro corredor
   * abría una pestaña aparte acá **navega la misma**, la página externa no carga
   * —no hay red hacia afuera— y el recorrido muere con «tu página no disparó su
   * evento load», que no menciona ningún enlace.
   *
   * Se mira el `href` y no el rótulo porque el rótulo cambia: la lista de
   * nombres que traía la suite anterior («who.int», «paho.org») ya no coincidía
   * con ninguno de los enlaces reales, que hoy se llaman «Guía OMS» y «OPS
   * Bolivia».
   */
  readonly externo: boolean;
}

/**
 * Lee el nombre accesible, el tipo y la accionabilidad de cada control visible.
 *
 * Se resuelve de una sola vez sobre el DOM: preguntar elemento por elemento
 * serían doscientas idas y vueltas por la cola de comandos, y eso domina el
 * tiempo de la corrida.
 *
 * El orden de precedencia del nombre sigue al de la especificación de nombres
 * accesibles —`aria-label`, luego `aria-labelledby`, luego la etiqueta asociada,
 * luego el contenido— porque es el mismo que ve quien usa un lector de pantalla,
 * y así el reporte nombra los controles como los nombraría esa persona.
 */
function enumerar(): Cypress.Chainable<Control[]> {
  return cy.document({ log: false }).then((doc) => {
    const nodos = [...doc.querySelectorAll(SELECTOR_INTERACTIVO)];

    const nombreDe = (el: Element): string => {
      const aria = el.getAttribute('aria-label');
      if (aria !== null && aria.trim() !== '') {
        return aria.trim();
      }

      const referencia = el.getAttribute('aria-labelledby');
      if (referencia !== null) {
        const textos = referencia
          .split(/\s+/)
          .map((id) => doc.getElementById(id)?.textContent ?? '')
          .join(' ')
          .trim();
        if (textos !== '') {
          return textos;
        }
      }

      const id = el.getAttribute('id');
      if (id !== null && id !== '') {
        const etiqueta = doc.querySelector(`label[for="${CSS.escape(id)}"]`);
        if (etiqueta?.textContent != null && etiqueta.textContent.trim() !== '') {
          return etiqueta.textContent.trim();
        }
      }

      const envoltorio = el.closest('label');
      if (envoltorio?.textContent != null && envoltorio.textContent.trim() !== '') {
        return envoltorio.textContent.trim();
      }

      const texto = el.textContent?.trim() ?? '';
      if (texto !== '') {
        return texto;
      }

      return (
        el.getAttribute('placeholder') ??
        el.getAttribute('title') ??
        el.getAttribute('name') ??
        el.getAttribute('data-testid') ??
        ''
      );
    };

    const tipoDe = (el: Element): string => {
      const etiqueta = el.tagName.toLowerCase();
      if (etiqueta === 'input') {
        return `input:${(el as HTMLInputElement).type}`;
      }
      const rol = el.getAttribute('role');
      if (rol !== null && rol !== '') {
        return rol;
      }
      return etiqueta;
    };

    /**
     * Si el control cuenta como visible para el recorrido.
     *
     * Medir el elemento y nada más descartaba **todos** los radios, casillas,
     * interruptores y adjuntos de la aplicación: sus componentes envuelven un
     * `<input>` nativo de `width: 0; height: 0; opacity: 0` dentro de un
     * `<label>` que es lo que realmente se ve y se toca. El input mide cero por
     * diseño, no por estar oculto.
     *
     * Por eso también vale la caja de la etiqueta que lo envuelve: si esa se ve,
     * el control se ve.
     */
    const tieneSuperficie = (el: Element | null): boolean => {
      if (el === null) {
        return false;
      }
      const caja = el.getBoundingClientRect();
      return caja.width > 0 && caja.height > 0;
    };

    const seVe = (el: Element): boolean => {
      if (tieneSuperficie(el)) {
        return true;
      }
      // El radio, la casilla y el interruptor envuelven su input en la etiqueta.
      if (tieneSuperficie(el.closest('label'))) {
        return true;
      }
      // El adjunto no: su etiqueta es hermana y lo referencia por `for`, porque
      // la zona de arrastre tiene que poder ocupar toda la caja.
      const id = el.getAttribute('id');
      if (id !== null && id !== '') {
        return tieneSuperficie(doc.querySelector(`label[for="${CSS.escape(id)}"]`));
      }
      return false;
    };

    /**
     * Si un clic real llegaría al control.
     *
     * Es la comprobación que en Playwright hacía el propio `click()` y cuya
     * excepción se atrapaba. Acá hay que adelantarla: se pregunta qué elemento
     * hay en el centro de la caja y se acepta si es el control, un antepasado
     * suyo o un descendiente. El caso que lo motivó es el enlace «Saltar al
     * contenido», que es invisible **hasta que recibe el foco**: no se puede
     * clicar, pero su estado enfocado sí merece quedar registrado.
     */
    const sePuedeClicar = (el: Element): boolean => {
      const superficie = tieneSuperficie(el) ? el : el.closest('label');
      if (superficie === null || !tieneSuperficie(superficie)) {
        return false;
      }
      const caja = superficie.getBoundingClientRect();
      if (caja.bottom < 0 || caja.top > doc.documentElement.clientHeight) {
        // Fuera de la ventana: se puede desplazar hasta él, así que cuenta.
        return true;
      }
      const enElCentro = doc.elementFromPoint(
        caja.left + caja.width / 2,
        caja.top + caja.height / 2,
      );
      return (
        enElCentro !== null &&
        (enElCentro === superficie ||
          superficie.contains(enElCentro) ||
          enElCentro.contains(superficie))
      );
    };

    /** Si accionarlo sacaría al navegador de la aplicación. Ver `Control.externo`. */
    const saleDelSitio = (el: Element): boolean => {
      /**
       * Se compara la etiqueta y no `instanceof HTMLAnchorElement`.
       *
       * El documento que se inspecciona es el de la **aplicación** y la clase
       * `HTMLAnchorElement` que ve este código es la del **corredor**: son dos
       * realms distintos, así que `instanceof` da `false` para todos los
       * enlaces. Falla en silencio —ningún enlace se detecta como externo— y el
       * recorrido se va a `who.int` igual.
       */
      if (el.tagName.toLowerCase() !== 'a') {
        return false;
      }
      if (el.getAttribute('target') === '_blank') {
        return true;
      }
      const href = el.getAttribute('href') ?? '';
      if (href === '' || href.startsWith('#')) {
        return false;
      }
      try {
        return new URL(href, doc.location.href).origin !== doc.location.origin;
      } catch {
        // Un `href` que no es una URL —`mailto:`, `tel:`— tampoco es navegación
        // dentro de la aplicación.
        return true;
      }
    };

    const vistos = new Map<string, number>();

    return nodos.flatMap((el, indice) => {
      if (!seVe(el)) {
        return [];
      }
      const tipo = tipoDe(el);
      // El nombre se recorta acá: un `textContent` de una tarjeta entera dentro
      // de un enlace puede tener miles de caracteres y no hay motivo para
      // arrastrarlos.
      const nombre = nombreDe(el).replace(/\s+/g, ' ').slice(0, 60);
      const base = `${tipo}:${nombre}`;
      const repeticion = vistos.get(base) ?? 0;
      vistos.set(base, repeticion + 1);
      return [
        {
          indice,
          clave: `${base}#${repeticion}`,
          tipo,
          nombre,
          accionable: sePuedeClicar(el),
          externo: saleDelSitio(el),
        },
      ];
    });
  });
}

/** Valores de muestra por tipo de campo: legibles y constantes entre corridas. */
const MUESTRAS: Readonly<Record<string, string>> = {
  'input:text': 'Texto de muestra',
  'input:email': 'ana@mantra.test',
  'input:search': 'Peña',
  'input:url': 'https://mantra.test',
  'input:tel': '+591 700 00000',
  'input:number': '42',
  'input:password': 'Contrasena-de-prueba-1',
  'input:date': '1988-03-14',
  'input:datetime-local': '2026-08-07T10:30',
  textarea: 'Observación de muestra para la evidencia visual.',
};

/**
 * Un PNG de 1×1 transparente.
 *
 * Alcanza para que el control muestre el archivo elegido, que es lo que la
 * captura tiene que mostrar.
 */
const PNG_MINIMO =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

/**
 * Acciona un control y describe en una frase qué se hizo.
 *
 * Devuelve `null` cuando el control no se pudo accionar, y eso **no es un
 * fallo**: el objetivo es juntar evidencia, y romper la corrida entera porque un
 * botón se movió dejaría sin capturas a todas las pantallas que faltaban.
 *
 * ## Por qué se revalida el elemento antes de tocarlo
 *
 * El control se identifica por su **posición** entre los que coinciden con el
 * selector, y esa posición puede haber cambiado: entre que `enumerar()` leyó el
 * DOM y que esto acciona, la pantalla pudo terminar de cargar datos y repintar.
 * El índice entonces apunta a otro control —un enlace donde había un campo— y
 * `cy.clear()` falla con «requires a valid clearable element», que suena a
 * defecto de la aplicación y es la lista que se movió abajo del dedo.
 *
 * En Playwright esto se resolvía con un `try/catch`; en Cypress un comando que
 * falla **hace fallar la prueba** y no hay forma de atraparlo, así que hay que
 * mirar antes. Si el tipo ya no coincide, se saltea: en la vuelta siguiente el
 * explorador vuelve a enumerar y lo encuentra en su lugar nuevo.
 */
function accionar(control: Control): Cypress.Chainable<string | null> {
  const nombre = control.nombre === '' ? control.tipo : control.nombre;
  let descripcion: string | null = null;

  /** El tipo del elemento tal como está **ahora**, con la misma regla que `enumerar`. */
  const tipoVivo = (el: Element): string => {
    const etiqueta = el.tagName.toLowerCase();
    if (etiqueta === 'input') {
      return `input:${(el as HTMLInputElement).type}`;
    }
    const rol = el.getAttribute('role');
    return rol !== null && rol !== '' ? rol : etiqueta;
  };

  cy.get(SELECTOR_INTERACTIVO, { log: false })
    .eq(control.indice)
    .then(($elemento) => {
      const nodo = $elemento[0];
      if (nodo === undefined || tipoVivo(nodo) !== control.tipo) {
        // La lista se movió: se deja para la vuelta siguiente.
        return;
      }

      const alcance = (): Cypress.Chainable<JQuery> => cy.wrap($elemento, { log: false });

      if (control.tipo === 'input:file') {
        alcance().selectFile(
          {
            contents: Cypress.Buffer.from(PNG_MINIMO, 'base64'),
            fileName: 'evidencia.png',
            mimeType: 'image/png',
          },
          { force: true, log: false },
        );
        descripcion = `adjuntar archivo en «${nombre}»`;
        return;
      }

      if (control.tipo === 'select') {
        if ($elemento.find('option').length < 2) {
          return;
        }
        alcance().select(1, { force: true, log: false });
        descripcion = `elegir opción en «${nombre}»`;
        return;
      }

      const muestra = MUESTRAS[control.tipo];
      if (muestra !== undefined) {
        alcance().clear({ force: true, log: false }).type(muestra, { force: true, log: false });
        descripcion = `escribir en «${nombre}»`;
        return;
      }

      if (control.tipo === 'input:checkbox' || control.tipo === 'input:radio') {
        /**
         * Se clica la etiqueta, no el input: el de estos componentes mide cero,
         * así que el clic caería en la nada. Activar la etiqueta marca el input
         * igual —lo hace el navegador— y dispara el `(change)` del componente.
         */
        const $etiqueta = $elemento.closest('label');
        cy.wrap($etiqueta.length > 0 ? $etiqueta : $elemento, { log: false }).click({
          force: true,
          log: false,
        });
        descripcion = `marcar «${nombre}»`;
        return;
      }

      if (!control.accionable) {
        /**
         * No se puede clicar, pero enfocarlo sí deja evidencia: es lo correcto
         * para el enlace de saltar al contenido —invisible hasta que recibe el
         * foco— y para los controles deshabilitados, donde verlos deshabilitados
         * es justamente lo que hay que mostrar.
         */
        alcance().focus({ log: false });
        descripcion = `enfocar «${nombre}»`;
        return;
      }

      // Todo lo demás se acciona con un clic: botones, enlaces, pestañas, ítems
      // de menú, interruptores y los `summary` de un desplegable.
      alcance().scrollIntoView({ log: false }).click({ force: true, log: false });
      descripcion = `clic en «${nombre}»`;
    });

  // El último eslabón de la cadena es el que rinde el resultado: para cuando
  // corre, todo lo encolado arriba ya se ejecutó y `descripcion` está puesta.
  return cy.wrap<string | null>(null, { log: false }).then((): string | null => descripcion);
}

/**
 * Recorre una pantalla entera: su estado inicial y el resultado de cada acción.
 *
 * Después de una acción que navega, vuelve a la ruta de la pantalla. La captura
 * del destino ya quedó tomada, así que no se pierde nada, y sin volver el resto
 * de los controles se exploraría sobre la pantalla equivocada.
 */
export function recorrer(pantalla: PantallaConRuta, opciones: OpcionesRecorrido = {}): void {
  const { maxAcciones = 40, evitar = [], preparar, paginaCompleta = true } = opciones;

  const entrar = (): void => {
    cy.visit(pantalla.ruta);
    esperarEstable();
    if (preparar !== undefined) {
      preparar();
      esperarEstable();
    }
  };

  entrar();
  capturar(pantalla, 'inicial', { paginaCompleta });

  const visitados = new Set<string>();
  const omitidosPorFiltro = { cuenta: 0 };
  const externos = { cuenta: 0 };

  /** Un paso del recorrido. Recursivo porque Cypress encola en vez de ejecutar. */
  const paso = (numero: number): void => {
    if (numero >= maxAcciones) {
      anotarRestantes();
      return;
    }

    enumerar().then((controles) => {
      const siguiente = controles.find((control) => {
        if (visitados.has(control.clave)) {
          return false;
        }
        // Un enlace que sale del sitio se llevaría el navegador fuera de la
        // aplicación y el recorrido no volvería. Ver `Control.externo`.
        if (control.externo) {
          visitados.add(control.clave);
          externos.cuenta += 1;
          return false;
        }
        if (evitar.some((patron) => patron.test(control.nombre))) {
          visitados.add(control.clave);
          omitidosPorFiltro.cuenta += 1;
          return false;
        }
        return true;
      });

      if (siguiente === undefined) {
        anotarFiltrados();
        return;
      }

      visitados.add(siguiente.clave);

      cy.url({ log: false }).then((antes) => {
        accionar(siguiente).then((descripcion) => {
          if (descripcion === null) {
            anotarOmision(
              pantalla.carpeta,
              `No se pudo accionar «${siguiente.nombre}» (${siguiente.tipo}).`,
            );
            paso(numero + 1);
            return;
          }

          esperarEstable();
          capturar(pantalla, descripcion, { paginaCompleta });

          cy.url({ log: false }).then((ahora) => {
            if (ahora !== antes) {
              entrar();
            }
            paso(numero + 1);
          });
        });
      });
    });
  };

  /**
   * Si el tope cortó la exploración, hay que decirlo: quedan controles sin tocar
   * y el reporte no tendría forma de saberlo.
   */
  const anotarRestantes = (): void => {
    enumerar().then((controles) => {
      const restantes = controles.filter((control) => !visitados.has(control.clave));
      if (restantes.length > 0) {
        anotarOmision(
          pantalla.carpeta,
          `Tope de ${maxAcciones} acciones alcanzado: ${restantes.length} controles sin accionar ` +
            `(${restantes
              .slice(0, 8)
              .map((c) => c.nombre)
              .join(', ')}…).`,
        );
      }
      anotarFiltrados();
    });
  };

  const anotarFiltrados = (): void => {
    if (externos.cuenta > 0) {
      anotarOmision(
        pantalla.carpeta,
        `${externos.cuenta} enlaces que salen del sitio no se accionaron: seguirlos dejaría al ` +
          'navegador fuera de la aplicación y el recorrido no volvería.',
      );
    }
    if (omitidosPorFiltro.cuenta > 0) {
      anotarOmision(
        pantalla.carpeta,
        `${omitidosPorFiltro.cuenta} controles excluidos a propósito (cierran la sesión o salen del sitio).`,
      );
    }
  };

  paso(0);
}

/**
 * Controles que el explorador nunca debe accionar.
 *
 * Cerrar la sesión y volver al login desde el medio de una pantalla dejaría al
 * resto del recorrido explorando el formulario de acceso; los enlaces externos
 * se llevarían el navegador fuera de la aplicación. Ambos casos **sí** se
 * capturan, pero en su propia prueba y a propósito.
 */
export const EVITAR_POR_DEFECTO: readonly RegExp[] = [
  /cerrar sesión/i,
  /salir/i,
  /^who\.int/i,
  /^paho\.org/i,
  /mailto:/i,
];
