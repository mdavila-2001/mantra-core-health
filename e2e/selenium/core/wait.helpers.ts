import {
  By,
  error,
  Key,
  until,
  type Locator,
  type WebDriver,
  type WebElement,
} from 'selenium-webdriver';

import { configuracion } from '../config/environment';

/**
 * Esperas explícitas.
 *
 * **En toda la suite no hay una sola pausa fija.** Una pausa es una apuesta:
 * en la máquina de quien la escribió alcanzaba, en un agente de CI cargado no,
 * y para que deje de fallar hay que subirla — hasta que la suite tarda veinte
 * minutos y sigue fallando. Cada función de acá espera por una **condición
 * verificable** y falla con un mensaje que dice qué se estaba esperando.
 *
 * El techo sale de `E2E_TIMEOUT` y cada función admite el suyo para los casos
 * que legítimamente tardan más (una navegación, un arranque).
 */

function techo(ms?: number): number {
  return ms ?? configuracion().timeoutMs;
}

/**
 * Ejecuta una comprobación tolerando que el elemento se haya reemplazado.
 *
 * `StaleElementReferenceError` no es un fallo: significa que Angular volvió a
 * pintar entre que se encontró el nodo y que se lo consultó, que es lo normal
 * en una pantalla que reacciona a datos. Tragarse **solo** ese error y seguir
 * puliendo es lo correcto; atrapar cualquier excepción escondería defectos de
 * verdad.
 */
async function tolerandoObsolescencia<T>(
  comprobacion: () => Promise<T>,
  cuandoEsObsoleto: T,
): Promise<T> {
  try {
    return await comprobacion();
  } catch (fallo) {
    if (fallo instanceof error.StaleElementReferenceError) {
      return cuandoEsObsoleto;
    }
    throw fallo;
  }
}

/** Localizador por identificador de prueba. Es el que usan los Page Objects. */
export function porTestId(testId: string): Locator {
  return By.css(`[data-testid="${testId}"]`);
}

/** Presente en el DOM. No garantiza que se vea: para eso está `esperarVisible`. */
export async function esperarPresente(
  driver: WebDriver,
  locator: Locator,
  ms?: number,
): Promise<WebElement> {
  return driver.wait(until.elementLocated(locator), techo(ms), `No apareció en el DOM: ${locator}`);
}

/** Presente **y** visible: es la condición que hace falta antes de leer o clicar. */
export async function esperarVisible(
  driver: WebDriver,
  locator: Locator,
  ms?: number,
): Promise<WebElement> {
  let visible: WebElement | null = null;

  await driver.wait(
    async () => {
      const elementos = await driver.findElements(locator);
      const candidato = elementos[0];
      if (candidato === undefined) {
        return false;
      }
      // Se vuelve a localizar en cada vuelta a propósito: si el nodo anterior
      // quedó obsoleto porque la pantalla se repintó, el siguiente intento
      // trabaja con el nuevo en vez de fallar por uno que ya no existe.
      const seVe = await tolerandoObsolescencia(() => candidato.isDisplayed(), false);
      if (seVe) {
        visible = candidato;
      }
      return seVe;
    },
    techo(ms),
    `Nunca se hizo visible: ${locator}`,
  );

  if (visible === null) {
    throw new Error(`Nunca se hizo visible: ${locator}`);
  }
  return visible;
}

/** Visible y habilitado: lo mínimo para que un clic signifique algo. */
export async function esperarInteractivo(
  driver: WebDriver,
  locator: Locator,
  ms?: number,
): Promise<WebElement> {
  const elemento = await esperarVisible(driver, locator, ms);
  await driver.wait(
    until.elementIsEnabled(elemento),
    techo(ms),
    `Sigue deshabilitado: ${locator}`,
  );
  await driver.wait(
    async () => (await elemento.getAttribute('aria-disabled')) !== 'true',
    techo(ms),
    `Sigue con aria-disabled: ${locator}`,
  );
  return elemento;
}

/**
 * Que el elemento **deje** de estar: un modal que cierra, un cargador que se va,
 * una fila que se borra. Se resuelve también si nunca llegó a existir.
 */
export async function esperarAusente(
  driver: WebDriver,
  locator: Locator,
  ms?: number,
): Promise<void> {
  await driver.wait(
    async () => {
      const elementos = await driver.findElements(locator);
      if (elementos.length === 0) {
        return true;
      }
      // Un elemento que ya no está en el DOM lanza al consultarlo: eso también
      // es haber desaparecido.
      const visibles = await Promise.all(
        elementos.map((e) => tolerandoObsolescencia(() => e.isDisplayed(), false)),
      );
      return !visibles.includes(true);
    },
    techo(ms),
    `Nunca desapareció: ${locator}`,
  );
}

/** Cuántos elementos coinciden, sin esperar: para afirmar que algo NO está. */
export async function contar(driver: WebDriver, locator: Locator): Promise<number> {
  return (await driver.findElements(locator)).length;
}

/**
 * Espera a que la URL cumpla un patrón.
 *
 * Es la condición de «terminó la navegación» de una aplicación de una sola
 * página: el router cambia la dirección cuando la ruta ya se activó.
 */
export async function esperarUrl(driver: WebDriver, patron: RegExp, ms?: number): Promise<void> {
  let ultima = '';
  await driver.wait(
    async () => {
      ultima = await driver.getCurrentUrl();
      return patron.test(ultima);
    },
    techo(ms),
    // El mensaje lleva la URL real: sin ella, «no cumplió el patrón» obliga a
    // reproducir el fallo a mano para saber dónde terminó.
    `La URL nunca cumplió ${patron}. Última vista: ${ultima || '(ninguna)'}`,
  );
}

/** Espera a que el texto de un elemento cumpla un patrón. */
export async function esperarTexto(
  driver: WebDriver,
  locator: Locator,
  patron: RegExp,
  ms?: number,
): Promise<string> {
  let ultimo = '';
  await driver.wait(
    async () => {
      const elementos = await driver.findElements(locator);
      const candidato = elementos[0];
      if (candidato === undefined) {
        return false;
      }
      // Leer el texto de un nodo que Angular acaba de reemplazar lanza; en la
      // vuelta siguiente se localiza el nuevo y se lee de ahí.
      const texto = await tolerandoObsolescencia(() => candidato.getText(), null);
      if (texto === null) {
        return false;
      }
      ultimo = texto.trim();
      return patron.test(ultimo);
    },
    techo(ms),
    `El texto de ${locator} nunca cumplió ${patron}. Último: «${ultimo}»`,
  );
  return ultimo;
}

/**
 * Espera a que la aplicación esté hidratada y estable.
 *
 * Angular con SSR entrega HTML del servidor que **todavía no responde a los
 * clics**: el JavaScript tiene que descargarse e hidratar. Un clic en esa
 * ventana no hace nada y la prueba falla por una carrera, no por un defecto.
 *
 * La señal es la propia aplicación: `<app-root>` con contenido y sin peticiones
 * pendientes que el navegador siga resolviendo.
 */
export async function esperarAplicacionLista(driver: WebDriver, ms?: number): Promise<void> {
  await driver.wait(
    async () => {
      const listo = await driver.executeScript<boolean>(
        `const root = document.querySelector('app-root');
         return document.readyState === 'complete' && !!root && root.children.length > 0;`,
      );
      return listo === true;
    },
    techo(ms),
    'La aplicación nunca terminó de cargar (app-root vacío o documento incompleto).',
  );
}

/**
 * Espera a que **el elemento** deje de moverse.
 *
 * Un clic sobre algo que todavía se desplaza aterriza en las coordenadas
 * viejas. La condición es la posición real del elemento medida dos veces
 * seguidas: si no cambió entre dos cuadros, ya está quieto.
 *
 * Antes esto esperaba a que **no quedara ninguna animación en el documento**, y
 * era una trampa: cualquier pantalla con un spinner, un esqueleto o una barra
 * de progreso tiene animaciones corriendo para siempre, así que la espera no
 * terminaba nunca y el fallo decía «quedaron animaciones» sin que nada
 * estuviera mal. Lo que importa para clicar no es que la página esté quieta,
 * sino que lo esté el elemento al que se apunta.
 */
export async function esperarPosicionEstable(
  driver: WebDriver,
  elemento: WebElement,
  ms?: number,
): Promise<void> {
  let anterior: string | null = null;

  await driver.wait(
    async () => {
      const actual = await tolerandoObsolescencia(
        () =>
          driver.executeScript<string>(
            `const r = arguments[0].getBoundingClientRect();
             return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)].join(',');`,
            elemento,
          ),
        null,
      );
      if (actual === null) {
        anterior = null;
        return false;
      }
      const quieto = anterior === actual;
      anterior = actual;
      return quieto;
    },
    techo(ms),
    'El elemento nunca dejó de moverse.',
  );
}

/**
 * Desplaza el elemento al centro y lo clica.
 *
 * `element.click()` de Selenium apunta al centro del elemento **en la ventana**:
 * si quedó debajo del encabezado fijo, el clic se lo lleva el encabezado y el
 * error dice «element click intercepted», que no ayuda a nadie.
 */
export async function clicSeguro(driver: WebDriver, locator: Locator, ms?: number): Promise<void> {
  const elemento = await esperarInteractivo(driver, locator, ms);
  await driver.executeScript(
    'arguments[0].scrollIntoView({ block: "center", inline: "nearest" });',
    elemento,
  );
  await esperarPosicionEstable(driver, elemento, ms);
  await elemento.click();
}

/**
 * Escribe en un campo dejándolo con exactamente el valor pedido.
 *
 * Se limpia con selección y borrado, no con `clear()`: `clear()` no dispara los
 * eventos de entrada que Angular escucha, así que el formulario se quedaba con
 * el valor anterior mientras el navegador mostraba el campo vacío.
 */
export async function escribir(
  driver: WebDriver,
  locator: Locator,
  valor: string,
  ms?: number,
): Promise<void> {
  const campo = await esperarInteractivo(driver, locator, ms);
  await campo.click();

  // En macOS el atajo de «seleccionar todo» es Cmd+A; en el resto, Ctrl+A. Con
  // el equivocado se escribiría a continuación de lo que ya había.
  const modificador = process.platform === 'darwin' ? Key.COMMAND : Key.CONTROL;
  await campo.sendKeys(Key.chord(modificador, 'a'), Key.BACK_SPACE);

  if (valor !== '') {
    await campo.sendKeys(valor);
  }
}
