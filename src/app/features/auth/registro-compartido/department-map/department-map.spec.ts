import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { DepartmentMap, type DepartamentoElegible } from './department-map';
import { SILUETAS_DE_BOLIVIA } from './bolivia-departments.geometry';

/**
 * Los nueve del catálogo, tal como los entrega `VS_BO_DEPARTMENT` una vez
 * resueltos: `conceptId` de la expansión, sigla del código del concepto.
 */
const DEPARTAMENTOS: readonly DepartamentoElegible[] = SILUETAS_DE_BOLIVIA.map((silueta) => ({
  conceptId: `dep-${silueta.sigla}`,
  sigla: silueta.sigla,
  nombre: silueta.nombre,
}));

describe('DepartmentMap', () => {
  let fixture: ComponentFixture<DepartmentMap>;
  let component: DepartmentMap;
  let html: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [DepartmentMap] });
    fixture = TestBed.createComponent(DepartmentMap);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('departamentos', DEPARTAMENTOS);
    fixture.detectChanges();
    html = fixture.nativeElement as HTMLElement;
  });

  function formaDe(sigla: string): SVGPathElement {
    const forma = html.querySelector<SVGPathElement>(`[data-testid="department-map-${sigla}"]`);
    if (forma === null) throw new Error(`no se dibujó ${sigla}`);
    return forma;
  }

  /* ---- La geometría, que es dato con fuente y no dibujo a ojo ---- */

  it('trae los nueve departamentos, en el orden del INE', () => {
    expect(SILUETAS_DE_BOLIVIA.map((silueta) => silueta.sigla)).toEqual([
      'CH',
      'LP',
      'CB',
      'OR',
      'PT',
      'TJ',
      'SC',
      'BE',
      'PD',
    ]);
  });

  /**
   * Cada silueta tiene que ser un contorno cerrado y no un trazo suelto: un
   * `<path>` sin `Z` no se rellena, así que no se puede pulsar en su interior
   * —sólo sobre la línea—, y el mapa se volvería inusable con el dedo sin que
   * nada fallara a la vista.
   */
  it('cada silueta es un contorno cerrado y con vértices', () => {
    for (const silueta of SILUETAS_DE_BOLIVIA) {
      expect(silueta.d.startsWith('M'), `${silueta.sigla} no empieza en un punto`).toBe(true);
      expect(silueta.d.endsWith('Z'), `${silueta.sigla} no cierra su contorno`).toBe(true);
      expect((silueta.d.match(/[ML]/g) ?? []).length).toBeGreaterThan(20);
    }
  });

  /* ---- El control ---- */

  it('dibuja un control por departamento, con su nombre accesible completo', () => {
    const formas = html.querySelectorAll('[role="button"]');
    expect(formas).toHaveLength(9);
    // El nombre accesible es el completo, no la sigla: «SC» no le dice nada a
    // quien escucha la pantalla.
    expect(formaDe('SC').getAttribute('aria-label')).toBe('Santa Cruz');
  });

  it('cada departamento es alcanzable con el tabulador', () => {
    for (const silueta of SILUETAS_DE_BOLIVIA) {
      expect(formaDe(silueta.sigla).getAttribute('tabindex')).toBe('0');
    }
  });

  it('un clic elige el departamento', () => {
    formaDe('SC').dispatchEvent(new MouseEvent('click'));
    fixture.detectChanges();

    expect(component.value()).toBe('dep-SC');
    expect(formaDe('SC').getAttribute('aria-pressed')).toBe('true');
    expect(formaDe('LP').getAttribute('aria-pressed')).toBe('false');
  });

  /**
   * AC-03-6: el equivalente por teclado no es un añadido, es la mitad del
   * control. Enter y la barra hacen lo mismo que el clic.
   */
  it('Enter elige, y la barra también', () => {
    formaDe('LP').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();
    expect(component.value()).toBe('dep-LP');

    formaDe('CB').dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    fixture.detectChanges();
    expect(component.value()).toBe('dep-CB');
  });

  /**
   * Sin esto la barra desplazaría la página en el momento exacto en que alguien
   * está usando el mapa con el teclado, y el mapa se iría de la vista.
   */
  it('la barra no desplaza la página', () => {
    const evento = new KeyboardEvent('keydown', { key: ' ', cancelable: true });
    formaDe('CB').dispatchEvent(evento);

    expect(evento.defaultPrevented).toBe(true);
  });

  it('volver a pulsar el elegido lo suelta', () => {
    formaDe('SC').dispatchEvent(new MouseEvent('click'));
    formaDe('SC').dispatchEvent(new MouseEvent('click'));
    fixture.detectChanges();

    expect(component.value()).toBeNull();
  });

  /**
   * WCAG 2.2 AA: lo elegido no se comunica sólo por color. Además del relleno
   * y del trazo grueso, el nombre se dice con palabras en una región viva.
   */
  it('dice en palabras cuál quedó elegido', () => {
    const linea = html.querySelector('[data-testid="department-map-elegido"]');
    expect(linea?.textContent).toContain('Todavía no elegiste');

    formaDe('BE').dispatchEvent(new MouseEvent('click'));
    fixture.detectChanges();

    expect(linea?.textContent).toContain('Beni');
    expect(linea?.getAttribute('aria-live')).toBe('polite');
  });

  /**
   * El catálogo manda: sin él no hay `conceptId` que mandar al backend, y un
   * dibujo que no se puede pulsar es peor que su ausencia. Quien monta el
   * componente muestra ahí su «Reintentar».
   */
  it('sin catálogo no dibuja nada', () => {
    fixture.componentRef.setInput('departamentos', []);
    fixture.detectChanges();

    expect(html.querySelector('svg')).toBeNull();
  });

  /** Una silueta que el catálogo no trajo no se dibuja: no tendría a qué apuntar. */
  it('sólo dibuja los departamentos que el catálogo trajo', () => {
    fixture.componentRef.setInput(
      'departamentos',
      DEPARTAMENTOS.filter((departamento) => departamento.sigla === 'SC'),
    );
    fixture.detectChanges();

    expect(html.querySelectorAll('[role="button"]')).toHaveLength(1);
    expect(formaDe('SC')).not.toBeNull();
  });
});
