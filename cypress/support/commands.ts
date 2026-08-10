/// <reference types="cypress" />

// Solo el tipo: la fuente de axe llega por `cy.task` y se evalúa en la ventana
// de la aplicación. Importar el paquete de verdad haría que el empaquetador lo
// envuelva, y lo envuelto no se puede inyectar (ver `leerFuenteDeAxe`).
import type axe from 'axe-core';

import {
  ESCENARIO_POR_DEFECTO,
  RUTA_ESCENARIO,
  type NombreEscenario,
} from './fixtures/escenarios';
import { teclaReal, type TeclaSoportada } from './teclado';

/**
 * Comandos propios de la suite.
 *
 * Son las primitivas que toda prueba necesita —abrir una pantalla con su
 * escenario, esperar a que la aplicación esté viva, medir el desborde— para que
 * los Page Objects declaren **solo sus selectores y sus acciones de negocio**.
 *
 * ## Sobre las esperas
 *
 * **En toda la suite no hay una sola pausa fija.** No hace falta: Cypress
 * reintenta cada aserción hasta el techo de `defaultCommandTimeout`, así que la
 * espera es una consecuencia de afirmar, no algo que haya que escribir. Un
 * `cy.wait(500)` es una apuesta: en la máquina de quien lo escribió alcanzaba y
 * en un agente de CI cargado no. Si aparece inestabilidad, se afirma sobre la
 * condición que falta —no se sube un número.
 */

export interface ProblemaA11y {
  readonly id: string;
  readonly impacto: string;
  readonly descripcion: string;
  readonly elementos: readonly string[];
}

/** Severidades que hacen fallar una prueba. Las menores se documentan, no bloquean. */
const IMPACTOS_BLOQUEANTES = new Set(['critical', 'serious']);

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /**
       * Localiza por identificador de prueba.
       *
       * Es el localizador por defecto de la suite: sobrevive a que cambie el
       * texto, la clase o la estructura, que son las tres cosas que cambian.
       */
      porTestId(testId: string, opciones?: Partial<Loggable & Timeoutable>): Chainable<JQuery>;

      /**
       * Localiza un control por el texto de su etiqueta.
       *
       * Es lo que hacía `getByLabel` en la suite anterior y lo que hace una
       * persona: buscar el campo que dice «Buscar pacientes». Cubre las dos
       * formas de asociar —`<label for>` y el `<label>` que envuelve— porque el
       * sistema de diseño usa las dos según el control.
       */
      porEtiqueta(texto: string | RegExp): Chainable<JQuery>;

      /**
       * Abre una pantalla con un escenario de API elegido.
       *
       * La navegación pasa por `/__e2e__/escenario`, que deja la cookie del
       * escenario y redirige: así la elección viaja en **una sola navegación** y
       * no hay una ventana en la que la aplicación pida datos antes de que el
       * arnés sepa qué tiene que responder.
       */
      abrirEscenario(escenario: NombreEscenario, ruta: string): Chainable<void>;

      /** Navega dentro de la aplicación conservando el escenario ya elegido. */
      irA(ruta: string): Chainable<void>;

      /** Recarga la página: es el `F5` que ninguna prueba unitaria puede hacer. */
      recargar(): Chainable<void>;

      /** Espera a que la aplicación esté pintada y quieta. */
      esperarAplicacionLista(): Chainable<void>;

      /** `true` si el navegador tiene una sesión persistida (el refresh token). */
      haySesionPersistida(): Chainable<boolean>;

      /** `true` si hay contenido fuera de la pantalla a lo ancho. */
      hayDesbordeHorizontal(): Chainable<boolean>;

      /** Problemas de accesibilidad graves de la pantalla actual. */
      problemasGraves(opciones?: { reglas?: readonly string[] }): Chainable<ProblemaA11y[]>;

      /** Recorre la página con el tabulador y devuelve qué recibió el foco. */
      recorridoDeTeclado(pasos?: number): Chainable<string[]>;

      /**
       * Pulsa una tecla **de verdad**, vía CDP.
       *
       * Hace falta donde el navegador exige un evento de confianza: el `Escape`
       * que cierra un `<dialog>` nativo y el tabulador, que Cypress no envía.
       * Ver `support/teclado.ts`.
       */
      tecla(tecla: TeclaSoportada): Chainable<void>;

      /** Apaga animaciones, transiciones y el cursor que parpadea. */
      congelar(): Chainable<void>;
    }
  }
}

// --- Localización -----------------------------------------------------------

Cypress.Commands.add('porTestId', (testId: string, opciones = {}) =>
  cy.get(`[data-testid="${testId}"]`, opciones),
);

Cypress.Commands.add('porEtiqueta', (texto: string | RegExp) =>
  cy.contains('label', texto).then(($etiqueta) => {
    const destino = $etiqueta.attr('for');
    if (destino !== undefined && destino !== '') {
      return cy.get(`#${CSS.escape(destino)}`);
    }
    // Sin `for`, el control va adentro de la etiqueta: es la otra forma de
    // asociar que admite el sistema de diseño.
    return cy.wrap($etiqueta).find('input, select, textarea').first();
  }),
);

// --- Navegación -------------------------------------------------------------

Cypress.Commands.add('esperarAplicacionLista', () => {
  /**
   * La señal es la propia aplicación: `<app-root>` con contenido y el documento
   * completo.
   *
   * Angular con SSR entrega HTML del servidor que **todavía no responde a los
   * clics**: el JavaScript tiene que descargarse e hidratar. Un clic en esa
   * ventana no hace nada y la prueba falla por una carrera, no por un defecto.
   *
   * El doble `requestAnimationFrame` es lo que agrega la garantía de pintado:
   * el primero corre antes del pintado y el segundo después.
   */
  cy.document({ log: false }).should((doc) => {
    expect(doc.readyState, 'el documento terminó de cargar').to.equal('complete');
  });

  cy.get('app-root', { log: false }).should(($raiz) => {
    expect($raiz.children().length, '<app-root> pintó su contenido').to.be.greaterThan(0);
  });

  cy.window({ log: false }).then(
    (ventana) =>
      new Cypress.Promise<void>((listo) => {
        let resuelto = false;
        const terminar = (): void => {
          if (resuelto) {
            return;
          }
          resuelto = true;
          listo();
        };

        // Dos cuadros: el primero corre antes del pintado y el segundo después.
        ventana.requestAnimationFrame(() => ventana.requestAnimationFrame(terminar));

        /**
         * Respaldo por tiempo, y es la única pausa de la suite.
         *
         * `requestAnimationFrame` **no dispara** si el navegador deja de pintar
         * el documento, y en headless eso pasa: la vitrina de diseño mide más de
         * veinte mil píxeles de alto y a mitad del recorrido los cuadros dejaban
         * de llegar. La espera no terminaba nunca y la prueba moría con «tu
         * callback devolvió una promesa que nunca se resolvió», que no dice nada
         * de la causa.
         *
         * Esto es una espera de cortesía —que el pintado se asiente antes de
         * capturar—, no una condición: quedarse colgado esperándola convierte
         * una comodidad en un fallo.
         */
        ventana.setTimeout(terminar, 300);
      }),
  );
});

Cypress.Commands.add(
  'abrirEscenario',
  (escenario: NombreEscenario = ESCENARIO_POR_DEFECTO, ruta = '/') => {
    cy.visit(`${RUTA_ESCENARIO}?id=${escenario}&destino=${encodeURIComponent(ruta)}`);
    cy.esperarAplicacionLista();
  },
);

Cypress.Commands.add('irA', (ruta: string) => {
  cy.visit(ruta);
  cy.esperarAplicacionLista();
});

Cypress.Commands.add('recargar', () => {
  cy.reload();
  cy.esperarAplicacionLista();
});

// --- Estado de sesión -------------------------------------------------------

Cypress.Commands.add('haySesionPersistida', () =>
  cy.window({ log: false }).then((ventana) => {
    const valor = ventana.localStorage.getItem('mantra.refresh-token');
    return valor !== null && valor !== '';
  }),
);

// --- Maquetado --------------------------------------------------------------

Cypress.Commands.add('hayDesbordeHorizontal', () =>
  /**
   * El desborde horizontal es el defecto responsive que más se cuela: en la
   * máquina de quien lo escribió no se nota, y en un teléfono obliga a
   * desplazar de lado para llegar a un botón.
   *
   * Se admite un píxel de holgura: el redondeo de los tamaños fraccionarios que
   * produce un diseño con `rem` genera diferencias de menos de uno que no son
   * un desborde de verdad.
   */
  cy.document({ log: false }).then((doc) => {
    const documento = Math.max(
      doc.documentElement.scrollWidth,
      doc.body === null ? 0 : doc.body.scrollWidth,
    );
    return documento - doc.documentElement.clientWidth > 1;
  }),
);

Cypress.Commands.add('congelar', () => {
  /**
   * Dos capturas del mismo estado tomadas con medio segundo de diferencia salen
   * distintas si algo se está moviendo, y un reporte donde la misma pantalla se
   * ve diferente en cada corrida no sirve para comparar nada.
   *
   * `caret-color: transparent` es el detalle que se olvida: el cursor de texto
   * parpadeante aparece en aproximadamente la mitad de las capturas de un campo
   * enfocado, y nunca en la otra mitad.
   */
  cy.document({ log: false }).then((doc) => {
    const YA_ESTA = 'e2e-congelado';
    if (doc.getElementById(YA_ESTA) !== null) {
      return;
    }
    const estilo = doc.createElement('style');
    estilo.id = YA_ESTA;
    estilo.textContent = `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        scroll-behavior: auto !important;
      }
      * { caret-color: transparent !important; }
    `;
    doc.head.appendChild(estilo);
  });
});

// --- Accesibilidad ----------------------------------------------------------

Cypress.Commands.add('problemasGraves', (opciones: { reglas?: readonly string[] } = {}) => {
  /**
   * No pretende sustituir una auditoría: busca **lo que rompe el uso** y que
   * solo se ve con la página viva —un botón sin nombre accesible, un campo sin
   * etiqueta asociada—. Son justamente los defectos que ninguna prueba unitaria
   * de componente detecta, porque ahí el componente está solo y acá está dentro
   * de la pantalla real.
   *
   * `axe-core` ya era una dependencia de desarrollo del repositorio: esto no
   * agrega ninguna. Su fuente llega por `cy.task` —ver `leerFuenteDeAxe` en el
   * arnés— y se evalúa **dentro** de la ventana de la aplicación, porque el
   * análisis tiene que mirar el documento que se está probando y no el del
   * corredor.
   */
  return cy.task<string>('fuenteDeAxe', null, { log: false }).then((fuente) =>
    cy.window({ log: false }).then((ventana) => {
      const conAxe = ventana as unknown as {
        axe?: typeof axe;
        eval: (codigo: string) => void;
      };

      if (conAxe.axe === undefined) {
        conAxe.eval(fuente);
      }

      const analizador = conAxe.axe;
      if (analizador === undefined) {
        throw new Error('axe-core no quedó disponible en la ventana de la aplicación.');
      }

      const configuracion =
        opciones.reglas === undefined
          ? {}
          : { runOnly: { type: 'rule' as const, values: [...opciones.reglas] } };

      return analizador
        .run(ventana.document, configuracion)
        .then((resultado) =>
          resultado.violations
            .map(
              (violacion): ProblemaA11y => ({
                id: violacion.id,
                impacto: violacion.impact ?? 'desconocido',
                descripcion: violacion.help,
                elementos: violacion.nodes.map((nodo) => nodo.target.join(' ')),
              }),
            )
            .filter((problema) => IMPACTOS_BLOQUEANTES.has(problema.impacto)),
        );
    }),
  );
});

Cypress.Commands.add('recorridoDeTeclado', (pasos = 12) => {
  /**
   * Es la única forma de comprobar que algo es **alcanzable por teclado**: un
   * elemento puede tener `tabindex` correcto y quedar igualmente inalcanzable
   * porque otro lo tapa o porque una trampa de foco lo saltea.
   */
  const enfocados: string[] = [];

  // Sin anotar el retorno a propósito: cuando el callback de `.then()` no
  // devuelve nada, Cypress deja pasar el sujeto anterior —el documento— y
  // declarar `void` sería mentirle al compilador sobre lo que rinde la cadena.
  const describirActivo = () =>
    cy.document({ log: false }).then((doc) => {
      const activo = doc.activeElement;
      if (activo === null || activo === doc.body) {
        return;
      }
      const etiqueta =
        activo.getAttribute('aria-label') ??
        activo.getAttribute('data-testid') ??
        (activo.textContent ?? '').trim().slice(0, 40);
      const descripcion = activo.tagName.toLowerCase() + (etiqueta === '' ? '' : `:${etiqueta}`);
      enfocados.push(descripcion);
    });

  for (let paso = 0; paso < pasos; paso += 1) {
    describirActivo();
    cy.tecla('Tab');
  }

  return cy.wrap(enfocados, { log: false });
});

Cypress.Commands.add('tecla', (tecla: TeclaSoportada) => teclaReal(tecla));
