import type { Locator, Page } from '@playwright/test';

import { anotarOmision, capturar } from './evidencia';

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
 * El precio es que hay que recordar qué se accionó ya, o el explorador abriría
 * y cerraría el mismo menú para siempre. De eso se encarga `visitados`, con una
 * clave que no depende de la posición: si un clic reordena la lista, el control
 * sigue siendo el mismo.
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

/** Identidad de una pantalla dentro del reporte. */
export interface Pantalla {
  /** Ruta de la aplicación por la que se entra. */
  readonly ruta: string;
  /** Carpeta donde caen sus capturas. */
  readonly carpeta: string;
  /** Rótulo legible para el reporte. */
  readonly titulo: string;
}

export interface OpcionesRecorrido {
  /**
   * Tope de acciones por pantalla.
   *
   * Existe por la vitrina de diseño, que tiene más de doscientos controles y
   * sola se llevaría la mayor parte del tiempo de la corrida. Cuando el tope
   * recorta, **queda anotado** y el reporte lo muestra: un recorte silencioso
   * se leería como cobertura completa.
   */
  readonly maxAcciones?: number;
  /** Nombres accesibles que no se deben accionar, por expresión regular. */
  readonly evitar?: readonly RegExp[];
  /**
   * Capturar la página entera (por defecto) o sólo lo visible.
   *
   * Ver el porqué en `capturar()`: sólo la vitrina de diseño necesita lo
   * segundo, y por su alto, no por su cantidad de controles.
   */
  readonly paginaCompleta?: boolean;
  /** Se ejecuta después de entrar a la ruta y antes de la primera captura. */
  readonly preparar?: (page: Page) => Promise<void>;
}

/** Un control descubierto en el DOM. */
interface Control {
  readonly indice: number;
  readonly clave: string;
  readonly tipo: string;
  readonly nombre: string;
}

/**
 * Lee el nombre accesible y el tipo de cada control visible.
 *
 * Se resuelve dentro del navegador y de una sola vez: preguntarle a Playwright
 * el texto de doscientos elementos, uno por uno, son doscientos viajes entre
 * procesos y domina el tiempo de la corrida.
 *
 * El orden de precedencia del nombre sigue al de la especificación de nombres
 * accesibles —`aria-label`, luego `aria-labelledby`, luego la etiqueta asociada,
 * luego el contenido— porque es el mismo que ve quien usa un lector de pantalla,
 * y así el reporte nombra los controles como los nombraría esa persona.
 */
async function enumerar(page: Page, selector: string): Promise<readonly Control[]> {
  const crudos = await page.locator(selector).evaluateAll((nodos) => {
    const nombreDe = (el: Element): string => {
      const aria = el.getAttribute('aria-label');
      if (aria !== null && aria.trim() !== '') {
        return aria.trim();
      }

      const referencia = el.getAttribute('aria-labelledby');
      if (referencia !== null) {
        const textos = referencia
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent ?? '')
          .join(' ')
          .trim();
        if (textos !== '') {
          return textos;
        }
      }

      const id = el.getAttribute('id');
      if (id !== null && id !== '') {
        const etiqueta = document.querySelector(`label[for="${CSS.escape(id)}"]`);
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
        return tieneSuperficie(document.querySelector(`label[for="${CSS.escape(id)}"]`));
      }

      return false;
    };

    return nodos.map((el) => ({
      tipo: tipoDe(el),
      // El nombre se recorta acá y no al mostrarlo: un `textContent` de una
      // tarjeta entera dentro de un enlace puede tener miles de caracteres, y
      // no hay motivo para moverlos entre procesos.
      nombre: nombreDe(el).replace(/\s+/g, ' ').slice(0, 60),
      visible: seVe(el),
    }));
  });

  const vistos = new Map<string, number>();

  return crudos.flatMap((crudo, indice) => {
    if (!crudo.visible) {
      return [];
    }
    const base = `${crudo.tipo}:${crudo.nombre}`;
    const repeticion = vistos.get(base) ?? 0;
    vistos.set(base, repeticion + 1);
    return [{ indice, clave: `${base}#${repeticion}`, tipo: crudo.tipo, nombre: crudo.nombre }];
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
 * Acciona un control y describe en una frase qué se hizo.
 *
 * Devuelve `null` cuando el control no se pudo accionar —quedó tapado, se fue
 * del DOM entre la enumeración y el clic— y eso **no es un fallo**: el objetivo
 * es juntar evidencia, y romper la corrida entera porque un botón se movió
 * dejaría sin capturas a todas las pantallas que faltaban.
 */
async function accionar(control: Control, elemento: Locator): Promise<string | null> {
  const nombre = control.nombre === '' ? control.tipo : control.nombre;

  try {
    if (control.tipo === 'input:file') {
      await elemento.setInputFiles({
        name: 'evidencia.png',
        mimeType: 'image/png',
        // Un PNG de 1×1 transparente: alcanza para que el control muestre el
        // archivo elegido, que es lo que la captura tiene que mostrar.
        buffer: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          'base64',
        ),
      });
      return `adjuntar archivo en «${nombre}»`;
    }

    if (control.tipo === 'select') {
      const opciones = await elemento.locator('option').count();
      if (opciones < 2) {
        return null;
      }
      await elemento.selectOption({ index: 1 });
      return `elegir opción en «${nombre}»`;
    }

    const muestra = MUESTRAS[control.tipo];
    if (muestra !== undefined) {
      await elemento.fill(muestra, { timeout: 5_000 });
      return `escribir en «${nombre}»`;
    }

    if (control.tipo === 'input:checkbox' || control.tipo === 'input:radio') {
      // `check()` apunta al centro del input, y el de estos componentes mide
      // cero: el clic caería en la nada. Lo que se ve y se toca es la etiqueta
      // que lo envuelve, y activarla marca el input igual —el navegador lo hace
      // por su cuenta— así que también dispara el `(change)` del componente.
      const etiqueta = elemento.locator('xpath=ancestor::label[1]');
      if ((await etiqueta.count()) > 0) {
        await etiqueta.first().click({ timeout: 5_000 });
      } else {
        await elemento.check({ timeout: 5_000 });
      }
      return `marcar «${nombre}»`;
    }

    // Todo lo demás se acciona con un clic: botones, enlaces, pestañas, ítems
    // de menú, interruptores y los `summary` de un desplegable.
    await elemento.click({ timeout: 5_000 });
    return `clic en «${nombre}»`;
  } catch {
    // Un clic que no se pudo dar no siempre significa que no haya nada que
    // capturar. El caso que lo motivó es el enlace «Saltar al contenido» del
    // armazón: es invisible **hasta que recibe el foco**, así que el clic falla
    // y su estado enfocado —el único en que alguien lo ve— quedaba sin registro.
    //
    // Enfocar también es lo correcto para los controles deshabilitados: no
    // hacen nada, pero verlos deshabilitados es justamente la evidencia.
    try {
      await elemento.focus({ timeout: 2_000 });
      return `enfocar «${nombre}»`;
    } catch {
      return null;
    }
  }
}

/**
 * Espera a que la pantalla se quede quieta.
 *
 * `networkidle` sería lo obvio y es justamente lo que no sirve acá: la
 * aplicación abre una conexión de telemetría que nunca cierra, así que la
 * espera vencería siempre. Lo que se espera es que el documento esté cargado y
 * que Angular haya pintado —un `requestAnimationFrame` doble alcanza: el primero
 * corre antes del pintado, el segundo después.
 */
export async function esperarEstable(page: Page): Promise<void> {
  // Con tope propio, y absorbiendo el vencimiento: sin él, una navegación que
  // no completa se come los tres minutos del test y el fallo aparece acá, en
  // una función de apoyo, en vez de en la línea que de verdad no funcionó.
  await page.waitForLoadState('domcontentloaded', { timeout: 15_000 }).catch(() => undefined);
  await page
    .evaluate(
      () =>
        new Promise<void>((listo) => {
          requestAnimationFrame(() => requestAnimationFrame(() => listo()));
        }),
    )
    .catch(() => undefined);
}

/**
 * Recorre una pantalla entera: su estado inicial y el resultado de cada acción.
 *
 * Después de una acción que navega, vuelve a la ruta de la pantalla. La captura
 * del destino ya quedó tomada, así que no se pierde nada, y sin volver el resto
 * de los controles de la pantalla se exploraría sobre la pantalla equivocada.
 *
 * @returns Cuántas capturas se tomaron.
 */
export async function recorrer(
  page: Page,
  pantalla: Pantalla,
  opciones: OpcionesRecorrido = {},
): Promise<number> {
  const { maxAcciones = 40, evitar = [], preparar, paginaCompleta = true } = opciones;

  await page.goto(pantalla.ruta);
  await esperarEstable(page);
  if (preparar !== undefined) {
    await preparar(page);
    await esperarEstable(page);
  }

  await capturar(page, pantalla, 'inicial', { paginaCompleta });
  let capturas = 1;

  const visitados = new Set<string>();
  let omitidosPorFiltro = 0;

  for (let paso = 0; paso < maxAcciones; paso += 1) {
    const controles = await enumerar(page, SELECTOR_INTERACTIVO);

    const siguiente = controles.find((control) => {
      if (visitados.has(control.clave)) {
        return false;
      }
      if (evitar.some((patron) => patron.test(control.nombre))) {
        visitados.add(control.clave);
        omitidosPorFiltro += 1;
        return false;
      }
      return true;
    });

    if (siguiente === undefined) {
      break;
    }

    visitados.add(siguiente.clave);

    const antes = page.url();
    const descripcion = await accionar(
      siguiente,
      page.locator(SELECTOR_INTERACTIVO).nth(siguiente.indice),
    );

    if (descripcion === null) {
      anotarOmision(
        pantalla.carpeta,
        `No se pudo accionar «${siguiente.nombre}» (${siguiente.tipo}).`,
      );
      continue;
    }

    await esperarEstable(page);
    await capturar(page, pantalla, descripcion, { paginaCompleta });
    capturas += 1;

    if (page.url() !== antes) {
      await page.goto(pantalla.ruta);
      await esperarEstable(page);
      if (preparar !== undefined) {
        await preparar(page);
        await esperarEstable(page);
      }
    }
  }

  // Si el tope cortó la exploración, hay que decirlo: quedan controles sin
  // tocar y el reporte no tendría forma de saberlo.
  const restantes = (await enumerar(page, SELECTOR_INTERACTIVO)).filter(
    (control) => !visitados.has(control.clave),
  );
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
  if (omitidosPorFiltro > 0) {
    anotarOmision(
      pantalla.carpeta,
      `${omitidosPorFiltro} controles excluidos a propósito (cierran la sesión o salen del sitio).`,
    );
  }

  return capturas;
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
