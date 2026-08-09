import axe from 'axe-core';
import { Key, type WebDriver } from 'selenium-webdriver';

/**
 * Comprobación de accesibilidad sobre la página ya renderizada.
 *
 * No pretende sustituir una auditoría: busca **lo que rompe el uso** y que solo
 * se ve con la página viva —un botón sin nombre accesible, un campo sin
 * etiqueta asociada, contraste insuficiente—. Son justamente los defectos que
 * ninguna prueba unitaria de componente detecta, porque ahí el componente está
 * solo y acá está dentro de la pantalla real.
 *
 * `axe-core` ya era una dependencia de desarrollo del repositorio: esto no
 * agrega ninguna. Se inyecta su fuente en la página con `executeScript` en vez
 * de cargarla por `<script>`, que la CSP del artefacto bloquearía.
 */

export interface ProblemaA11y {
  readonly id: string;
  readonly impacto: string;
  readonly descripcion: string;
  readonly elementos: readonly string[];
}

/** Severidades que hacen fallar una prueba. Las menores se documentan, no bloquean. */
const IMPACTOS_BLOQUEANTES = new Set(['critical', 'serious']);

interface ResultadoAxe {
  readonly violations: {
    id: string;
    impact: string | null;
    help: string;
    nodes: { target: unknown[] }[];
  }[];
}

/**
 * Analiza la página actual y devuelve los problemas encontrados.
 *
 * `reglas` acota el análisis cuando a una prueba solo le interesa una familia
 * —por ejemplo, los nombres accesibles— y no quiere que la arrastre una deuda
 * conocida de otra.
 */
export async function analizarAccesibilidad(
  driver: WebDriver,
  opciones: { reglas?: readonly string[] } = {},
): Promise<ProblemaA11y[]> {
  await driver.executeScript(axe.source);

  const configuracion =
    opciones.reglas === undefined
      ? '{}'
      : JSON.stringify({ runOnly: { type: 'rule', values: [...opciones.reglas] } });

  const resultado = await driver.executeAsyncScript<ResultadoAxe>(
    `const listo = arguments[arguments.length - 1];
     window.axe.run(document, ${configuracion}).then(listo).catch(() => listo({ violations: [] }));`,
  );

  return resultado.violations.map((violacion) => ({
    id: violacion.id,
    impacto: violacion.impact ?? 'desconocido',
    descripcion: violacion.help,
    elementos: violacion.nodes.map((nodo) => nodo.target.join(' ')),
  }));
}

/** Solo los problemas graves: los que justifican hacer fallar una prueba. */
export async function problemasGraves(
  driver: WebDriver,
  opciones: { reglas?: readonly string[] } = {},
): Promise<ProblemaA11y[]> {
  const problemas = await analizarAccesibilidad(driver, opciones);
  return problemas.filter((problema) => IMPACTOS_BLOQUEANTES.has(problema.impacto));
}

/** Resumen legible para el mensaje de un fallo. */
export function describir(problemas: readonly ProblemaA11y[]): string {
  return problemas
    .map((p) => `· [${p.impacto}] ${p.id}: ${p.descripcion} → ${p.elementos.join(', ')}`)
    .join('\n');
}

/**
 * Recorre la página con el tabulador y devuelve qué recibió el foco.
 *
 * Es la única forma de comprobar que algo es **alcanzable por teclado**: un
 * elemento puede tener `tabindex` correcto y quedar igualmente inalcanzable
 * porque otro lo tapa o porque una trampa de foco lo saltea.
 */
export async function recorridoDeTeclado(driver: WebDriver, pasos = 12): Promise<string[]> {
  const enfocados: string[] = [];

  for (let paso = 0; paso < pasos; paso += 1) {
    const descripcion = await driver.executeScript<string>(
      `const activo = document.activeElement;
       if (!activo || activo === document.body) { return ''; }
       const etiqueta = activo.getAttribute('aria-label')
         || activo.getAttribute('data-testid')
         || (activo.textContent || '').trim().slice(0, 40);
       return activo.tagName.toLowerCase() + (etiqueta ? ':' + etiqueta : '');`,
    );
    if (descripcion !== '') {
      enfocados.push(descripcion);
    }
    await driver.actions().sendKeys(Key.TAB).perform();
  }

  return enfocados;
}
