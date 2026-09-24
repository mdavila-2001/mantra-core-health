import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { BodyMap, ZONAS_CON_SILUETA, type ZonaElegible } from './body-map';
import { VISTAS_DEL_CUERPO } from './body-zones.geometry';

/**
 * Las zonas con forma, tal como las entrega `symptom-check` a partir de su
 * tabla de zonas: `id` y nombre. Más una sin silueta («piel»), para probar que
 * no se dibuja.
 */
const ZONAS: readonly ZonaElegible[] = [
  { id: 'cabeza', nombre: 'Cabeza' },
  { id: 'ojos', nombre: 'Ojos' },
  { id: 'oidos', nombre: 'Oídos' },
  { id: 'nariz', nombre: 'Nariz' },
  { id: 'boca', nombre: 'Boca y dientes' },
  { id: 'garganta', nombre: 'Garganta y cuello' },
  { id: 'nuca', nombre: 'Nuca' },
  { id: 'hombros', nombre: 'Hombros' },
  { id: 'pecho', nombre: 'Pecho y respiración' },
  { id: 'estomago', nombre: 'Estómago' },
  { id: 'abdomen', nombre: 'Panza e intestino' },
  { id: 'espalda', nombre: 'Espalda' },
  { id: 'rinones', nombre: 'Cintura y riñones' },
  { id: 'intima', nombre: 'Salud íntima' },
  { id: 'gluteos', nombre: 'Glúteos y cola' },
  { id: 'brazos', nombre: 'Brazos y codos' },
  { id: 'manos', nombre: 'Manos y muñecas' },
  { id: 'caderas', nombre: 'Caderas' },
  { id: 'piernas', nombre: 'Piernas' },
  { id: 'rodillas', nombre: 'Rodillas' },
  { id: 'pies', nombre: 'Pies y tobillos' },
  { id: 'piel', nombre: 'Piel y pelo' },
];

const FRENTE = [
  'cabeza',
  'garganta',
  'hombros',
  'pecho',
  'estomago',
  'brazos',
  'abdomen',
  'intima',
  'caderas',
  'manos',
  'piernas',
  'rodillas',
  'pies',
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

  function vistaPuesta(): string | null {
    const lienzo = html.querySelector('svg[data-testid^="body-map-vista-"]');
    return lienzo?.getAttribute('data-testid')?.replace('body-map-vista-', '') ?? null;
  }

  function pasarA(vista: string): void {
    const opcion = Array.from(html.querySelectorAll<HTMLElement>('[role="radio"]')).find(
      (radio) => radio.textContent?.trim() === vista,
    );
    if (opcion === undefined) throw new Error(`no está la vista ${vista}`);
    opcion.click();
    fixture.detectChanges();
  }

  /* ---- La geometría ---- */

  it('trae tres vistas: frente, espalda y cara', () => {
    expect(VISTAS_DEL_CUERPO.map((vista) => vista.id)).toEqual(['frente', 'espalda', 'cara']);
  });

  it('de frente, las zonas van de arriba abajo', () => {
    expect(VISTAS_DEL_CUERPO[0].zonas.map((zona) => zona.id)).toEqual(FRENTE);
  });

  /** Cada parte que alguien señala tiene su zona: veintiuna, no siete. */
  it('entre las tres vistas hay veintiuna zonas distintas', () => {
    expect(ZONAS_CON_SILUETA.size).toBe(21);
    expect(ZONAS_CON_SILUETA.has('piel')).toBe(false);
  });

  /**
   * Cada forma tiene que ser un contorno cerrado: un `<path>` sin `Z` no se
   * rellena, así que no se puede pulsar en su interior —sólo sobre la línea—,
   * y la silueta se volvería inusable con el dedo sin que nada fallara a la vista.
   */
  it('cada zona es un contorno cerrado con vértices', () => {
    for (const vista of VISTAS_DEL_CUERPO) {
      for (const silueta of vista.zonas) {
        const nombre = `${vista.id}/${silueta.id}`;
        expect(silueta.d.startsWith('M'), `${nombre} no empieza en un punto`).toBe(true);
        expect(silueta.d.trimEnd().endsWith('Z'), `${nombre} no cierra su contorno`).toBe(true);
        expect(silueta.d.split(' ').length, `${nombre} tiene pocos vértices`).toBeGreaterThan(8);
      }
    }
  });

  /** Una zona no se repite dentro de una vista: serían dos botones con el mismo nombre. */
  it('ninguna zona aparece dos veces en la misma vista', () => {
    for (const vista of VISTAS_DEL_CUERPO) {
      const ids = vista.zonas.map((zona) => zona.id);
      expect(new Set(ids).size, vista.id).toBe(ids.length);
    }
  });

  /* ---- El control ---- */

  it('empieza de frente, con un control por zona y su nombre accesible completo', () => {
    expect(vistaPuesta()).toBe('frente');
    const formas = html.querySelectorAll('[role="button"]');
    expect(formas).toHaveLength(FRENTE.length);
    expect(formaDe('pecho').getAttribute('aria-label')).toBe('Pecho y respiración');
  });

  /** «Piel y pelo» no es una parte del cuerpo: se ofrece como pastilla, no acá. */
  it('una zona sin silueta no se dibuja', () => {
    expect(html.querySelector('[data-testid="body-map-piel"]')).toBeNull();
  });

  it('cada zona es alcanzable con el tabulador', () => {
    for (const id of FRENTE) {
      expect(formaDe(id).getAttribute('tabindex')).toBe('0');
    }
  });

  /* ---- Las vistas ---- */

  it('de espaldas aparecen la nuca, la espalda, la cintura y los glúteos', () => {
    pasarA('Espalda');

    expect(vistaPuesta()).toBe('espalda');
    for (const id of ['nuca', 'espalda', 'rinones', 'gluteos']) {
      expect(formaDe(id)).toBeTruthy();
    }
    expect(html.querySelector('[data-testid="body-map-pecho"]')).toBeNull();
  });

  /** A escala de cuerpo entero, la cara es más chica que un dedo: tocarla la acerca. */
  it('tocar la cabeza de frente acerca la cara y la deja elegida', () => {
    formaDe('cabeza').dispatchEvent(new MouseEvent('click'));
    fixture.detectChanges();

    expect(vistaPuesta()).toBe('cara');
    expect(component.value()).toBe('cabeza');
    for (const id of ['ojos', 'oidos', 'nariz', 'boca']) {
      expect(formaDe(id)).toBeTruthy();
    }
  });

  /** Lo elegido desde afuera siempre queda a la vista: la figura se da vuelta sola. */
  it('una zona elegida desde afuera que no está en la vista la cambia', () => {
    fixture.componentRef.setInput('value', 'gluteos');
    fixture.detectChanges();

    expect(vistaPuesta()).toBe('espalda');
    expect(formaDe('gluteos').getAttribute('aria-pressed')).toBe('true');
  });

  /**
   * El error que reportó el cliente (24/09/2026): con una zona de la cara
   * elegida, «Frente» y «Espalda» no hacían nada, porque la figura volvía sola
   * a la única vista que tenía esa zona. La vista que elige la persona manda.
   */
  it('desde la cara se puede volver a frente y a espalda con una zona de la cara elegida', () => {
    formaDe('cabeza').dispatchEvent(new MouseEvent('click'));
    fixture.detectChanges();
    formaDe('ojos').dispatchEvent(new MouseEvent('click'));
    fixture.detectChanges();
    expect(component.value()).toBe('ojos');

    pasarA('Frente');
    expect(vistaPuesta()).toBe('frente');
    pasarA('Espalda');
    expect(vistaPuesta()).toBe('espalda');
    pasarA('Cara');
    expect(vistaPuesta()).toBe('cara');
    // Lo elegido no se pierde al mirar otra vista: sigue dicho en palabras.
    expect(component.value()).toBe('ojos');
  });

  it('después de cambiar de vista a mano, elegir desde afuera vuelve a dar vuelta la figura', () => {
    pasarA('Espalda');
    fixture.componentRef.setInput('value', 'pecho');
    fixture.detectChanges();

    expect(vistaPuesta()).toBe('frente');
  });

  /* ---- Lo que se contó ---- */

  it('las zonas marcadas por lo que se contó se ven, se anuncian y se nombran, sin quedar elegidas', () => {
    fixture.componentRef.setInput('marcadas', ['rodillas', 'gluteos', 'piel']);
    fixture.detectChanges();

    const rodillas = formaDe('rodillas');
    expect(rodillas.closest('g')?.classList).toContain('body-map__zona--marcada');
    expect(rodillas.getAttribute('aria-label')).toBe('Rodillas (por lo que contaste)');
    expect(rodillas.getAttribute('aria-pressed')).toBe('false');
    expect(component.value()).toBeNull();
    // Nombra también la que no se ve de frente (glúteos) y la que no tiene forma (piel).
    expect(html.querySelector('[data-testid="body-map-marcadas"]')?.textContent).toContain(
      'Glúteos y cola, Rodillas y Piel y pelo',
    );
    expect(formaDe('pecho').closest('g')?.classList).not.toContain('body-map__zona--marcada');
  });

  it('sin nada contado no hay leyenda de marcadas', () => {
    expect(html.querySelector('[data-testid="body-map-marcadas"]')).toBeNull();
  });

  /* ---- Apuntar antes de tocar ---- */

  it('apuntar una zona la nombra arriba, y cambiar de vista borra el nombre', () => {
    formaDe('pecho').dispatchEvent(new Event('pointerenter'));
    fixture.detectChanges();
    expect(html.querySelector('.body-map__pista')?.textContent?.trim()).toBe('Pecho y respiración');

    // La forma se va con la vista y no avisa que el puntero salió.
    pasarA('Espalda');
    expect(html.querySelector('.body-map__pista')).toBeNull();
  });

  it('dejar la zona borra el nombre, y la elegida no se repite arriba', () => {
    formaDe('pecho').dispatchEvent(new Event('pointerenter'));
    fixture.detectChanges();
    formaDe('pecho').dispatchEvent(new Event('pointerleave'));
    fixture.detectChanges();
    expect(html.querySelector('.body-map__pista')).toBeNull();

    formaDe('pecho').dispatchEvent(new MouseEvent('click'));
    formaDe('pecho').dispatchEvent(new Event('pointerenter'));
    fixture.detectChanges();
    expect(html.querySelector('.body-map__pista')).toBeNull();
  });

  it('con zonas de una sola vista no hay selector de vista', () => {
    fixture.componentRef.setInput('zonas', [{ id: 'pecho', nombre: 'Pecho' }]);
    fixture.detectChanges();

    expect(html.querySelector('[role="radiogroup"]')).toBeNull();
    expect(formaDe('pecho')).toBeTruthy();
  });

  it('un clic elige la zona', () => {
    formaDe('pecho').dispatchEvent(new MouseEvent('click'));
    fixture.detectChanges();

    expect(component.value()).toBe('pecho');
    expect(formaDe('pecho').getAttribute('aria-pressed')).toBe('true');
    expect(formaDe('estomago').getAttribute('aria-pressed')).toBe('false');
  });

  /** El equivalente por teclado no es un añadido: Enter y la barra hacen lo mismo que el clic. */
  it('Enter elige, y la barra también', () => {
    formaDe('rodillas').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();
    expect(component.value()).toBe('rodillas');

    formaDe('estomago').dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    fixture.detectChanges();
    expect(component.value()).toBe('estomago');
  });

  it('la barra no desplaza la página', () => {
    const evento = new KeyboardEvent('keydown', { key: ' ', cancelable: true });
    formaDe('manos').dispatchEvent(evento);

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
    fixture.componentRef.setInput('value', 'hombros');
    fixture.detectChanges();

    expect(formaDe('hombros').getAttribute('aria-pressed')).toBe('true');
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
