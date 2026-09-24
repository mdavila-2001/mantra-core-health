import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { BodyMap, type ZonaElegible } from './body-map';
import { SILUETAS_DEL_CUERPO } from './body-zones.geometry';

/**
 * Las siete zonas con forma, tal como las entrega `symptom-check` a partir de
 * su tabla de zonas: `id` y nombre. Más una sin silueta («piel»), para probar
 * que no se dibuja.
 */
const ZONAS: readonly ZonaElegible[] = [
  { id: 'cabeza', nombre: 'Cabeza y mareos' },
  { id: 'ojos', nombre: 'Ojos' },
  { id: 'orl', nombre: 'Oído, nariz y garganta' },
  { id: 'pecho', nombre: 'Pecho y respiración' },
  { id: 'panza', nombre: 'Panza y digestión' },
  { id: 'huesos', nombre: 'Huesos y músculos' },
  { id: 'intima', nombre: 'Salud íntima' },
  { id: 'piel', nombre: 'Piel y pelo' },
];

describe('BodyMap', () => {
  let fixture: ComponentFixture<BodyMap>;
  let component: BodyMap;
  let html: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [BodyMap] });
    fixture = TestBed.createComponent(BodyMap);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('zonas', ZONAS);
    fixture.detectChanges();
    html = fixture.nativeElement as HTMLElement;
  });

  function formaDe(id: string): SVGPathElement {
    const forma = html.querySelector<SVGPathElement>(`[data-testid="body-map-${id}"]`);
    if (forma === null) throw new Error(`no se dibujó ${id}`);
    return forma;
  }

  /* ---- La geometría ---- */

  it('trae las siete zonas con forma, de arriba abajo', () => {
    expect(SILUETAS_DEL_CUERPO.map((silueta) => silueta.id)).toEqual([
      'cabeza',
      'ojos',
      'orl',
      'pecho',
      'panza',
      'huesos',
      'intima',
    ]);
  });

  /**
   * Cada forma tiene que ser un contorno cerrado: un `<path>` sin `Z` no se
   * rellena, así que no se puede pulsar en su interior —sólo sobre la línea—,
   * y la silueta se volvería inusable con el dedo sin que nada fallara a la vista.
   */
  it('cada zona es un contorno cerrado con vértices', () => {
    for (const silueta of SILUETAS_DEL_CUERPO) {
      expect(silueta.d.startsWith('M'), `${silueta.id} no empieza en un punto`).toBe(true);
      expect(silueta.d.trimEnd().endsWith('Z'), `${silueta.id} no cierra su contorno`).toBe(true);
      expect((silueta.d.match(/[MLC]/g) ?? []).length).toBeGreaterThanOrEqual(4);
    }
  });

  /* ---- El control ---- */

  it('dibuja un control por zona con forma, con su nombre accesible completo', () => {
    const formas = html.querySelectorAll('[role="button"]');
    expect(formas).toHaveLength(7);
    expect(formaDe('pecho').getAttribute('aria-label')).toBe('Pecho y respiración');
  });

  /** «Piel y pelo» no es una parte del cuerpo: se ofrece como pastilla, no acá. */
  it('una zona sin silueta no se dibuja', () => {
    expect(html.querySelector('[data-testid="body-map-piel"]')).toBeNull();
  });

  it('cada zona es alcanzable con el tabulador', () => {
    for (const silueta of SILUETAS_DEL_CUERPO) {
      expect(formaDe(silueta.id).getAttribute('tabindex')).toBe('0');
    }
  });

  it('un clic elige la zona', () => {
    formaDe('pecho').dispatchEvent(new MouseEvent('click'));
    fixture.detectChanges();

    expect(component.value()).toBe('pecho');
    expect(formaDe('pecho').getAttribute('aria-pressed')).toBe('true');
    expect(formaDe('panza').getAttribute('aria-pressed')).toBe('false');
  });

  /** El equivalente por teclado no es un añadido: Enter y la barra hacen lo mismo que el clic. */
  it('Enter elige, y la barra también', () => {
    formaDe('cabeza').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();
    expect(component.value()).toBe('cabeza');

    formaDe('panza').dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    fixture.detectChanges();
    expect(component.value()).toBe('panza');
  });

  it('la barra no desplaza la página', () => {
    const evento = new KeyboardEvent('keydown', { key: ' ', cancelable: true });
    formaDe('huesos').dispatchEvent(evento);

    expect(evento.defaultPrevented).toBe(true);
  });

  it('volver a pulsar la elegida la suelta', () => {
    formaDe('pecho').dispatchEvent(new MouseEvent('click'));
    formaDe('pecho').dispatchEvent(new MouseEvent('click'));
    fixture.detectChanges();

    expect(component.value()).toBeNull();
  });

  /**
   * WCAG 2.2 AA: lo elegido no se comunica sólo por color. Además del relleno
   * y del trazo grueso, el nombre se dice con palabras en una región viva.
   */
  it('dice en palabras cuál quedó elegida', () => {
    const linea = html.querySelector('[data-testid="body-map-elegida"]');
    expect(linea?.textContent).toContain('Tocá una parte del cuerpo');

    formaDe('intima').dispatchEvent(new MouseEvent('click'));
    fixture.detectChanges();

    expect(linea?.textContent).toContain('Salud íntima');
    expect(linea?.getAttribute('aria-live')).toBe('polite');
  });

  /** Quien monta el organismo puede elegir desde afuera (la pastilla) y la figura lo refleja. */
  it('un `value` puesto desde afuera resalta esa zona', () => {
    fixture.componentRef.setInput('value', 'huesos');
    fixture.detectChanges();

    expect(formaDe('huesos').getAttribute('aria-pressed')).toBe('true');
  });

  /** Un `value` que no corresponde a ninguna zona no resalta nada ni rompe. */
  it('un `value` desconocido no resalta nada', () => {
    fixture.componentRef.setInput('value', 'no-existe');
    fixture.detectChanges();

    expect(html.querySelectorAll('[aria-pressed="true"]')).toHaveLength(0);
    expect(html.querySelector('[data-testid="body-map-elegida"]')?.textContent).toContain(
      'Tocá una parte del cuerpo',
    );
  });

  /** Sin zonas no hay silueta: un dibujo que no se puede pulsar es peor que su ausencia. */
  it('sin zonas no dibuja nada', () => {
    fixture.componentRef.setInput('zonas', []);
    fixture.detectChanges();

    expect(html.querySelector('svg')).toBeNull();
  });
});
