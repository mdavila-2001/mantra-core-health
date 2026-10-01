import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { DepartmentMap, type DepartamentoElegible } from './department-map';
import { SILUETAS_DE_BOLIVIA } from './bolivia-departments.geometry';
import { CONTORNOS_DE_MUNICIPIOS } from './bolivia-municipalities.geometry';

/** El mismo módulo que el componente pide con `import()`: ya resuelto acá. */
const CONTORNOS_LISTOS = import('./bolivia-municipalities.geometry');

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

  /**
   * «En TODOS LOS MAPAS se pongan las provincias» —cliente, 24/09/2026—. Las
   * líneas son dibujo, no control: no se tabulan, no se anuncian y no le roban
   * el clic al departamento que tienen debajo.
   */
  it('traza las provincias sin volverlas un control', () => {
    const provincias = html.querySelector('[data-testid="department-map-provincias"]');
    expect(provincias?.getAttribute('d')?.startsWith('M')).toBe(true);
    expect((provincias?.getAttribute('d')?.match(/M/g) ?? []).length).toBeGreaterThan(100);
    expect(provincias?.getAttribute('aria-hidden')).toBe('true');
    expect(provincias?.hasAttribute('tabindex')).toBe(false);
    expect(provincias?.hasAttribute('role')).toBe(false);
  });

  it('las siglas quedan por encima de las provincias, y la del elegido cambia de tono', () => {
    const svg = html.querySelector('svg');
    const hijos = Array.from(svg?.children ?? []);
    const provincias = hijos.findIndex((hijo) =>
      hijo.classList.contains('department-map__provincias'),
    );
    const primeraSigla = hijos.findIndex((hijo) =>
      hijo.classList.contains('department-map__sigla'),
    );
    expect(provincias).toBeGreaterThan(-1);
    expect(primeraSigla).toBeGreaterThan(provincias);

    formaDe('SC').dispatchEvent(new MouseEvent('click'));
    fixture.detectChanges();
    const elegidas = html.querySelectorAll('.department-map__sigla--elegida');
    expect(elegidas).toHaveLength(1);
    expect(elegidas[0].textContent?.trim()).toBe('SC');
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

  /* ---- El municipio y el lugar (pedido del 30/09/2026) ---- */

  /** Espera a que llegue el `import()` diferido de los contornos. */
  async function estabilizar(): Promise<void> {
    fixture.detectChanges();
    await CONTORNOS_LISTOS;
    await new Promise((listo) => setTimeout(listo));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /** Si un punto del `viewBox` cae dentro de un contorno (`M…L…Z`, varios anillos). */
  function dentroDe(d: string, x: number, y: number): boolean {
    return d
      .split('M')
      .filter(Boolean)
      .some((tramo) => {
        const anillo = tramo
          .replace('Z', '')
          .split('L')
          .map((par) => par.split(' ').map(Number));
        let adentro = false;
        for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
          const [xi, yi] = anillo[i];
          const [xj, yj] = anillo[j];
          if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) adentro = !adentro;
        }
        return adentro;
      });
  }

  it('los contornos cubren 339 de los 340 municipios del catálogo, sin INE repetido', () => {
    expect(CONTORNOS_DE_MUNICIPIOS).toHaveLength(339);
    expect(new Set(CONTORNOS_DE_MUNICIPIOS.map((c) => c.ine)).size).toBe(339);
    for (const c of CONTORNOS_DE_MUNICIPIOS) {
      expect(c.d.startsWith('M') && c.d.endsWith('Z'), `${c.ine} no cierra`).toBe(true);
    }
  });

  it('sombrea el municipio por su código INE y dice su nombre', async () => {
    fixture.componentRef.setInput('value', 'dep-SC');
    fixture.componentRef.setInput('municipio', '070101');
    await estabilizar();

    const municipio = html.querySelector('[data-testid="department-map-municipio"]');
    expect(municipio?.getAttribute('data-ine')).toBe('070101');
    expect(municipio?.getAttribute('aria-hidden')).toBe('true');
    expect(html.querySelector('[data-testid="department-map-elegido"]')?.textContent).toContain(
      'Santa Cruz de la Sierra',
    );
  });

  it('busca el nombre sólo dentro del departamento elegido', async () => {
    // «San Pedro» existe en Santa Cruz y en Pando: con Pando elegido, no se
    // marca el de Santa Cruz (ni al revés).
    fixture.componentRef.setInput('value', 'dep-PD');
    fixture.componentRef.setInput('municipio', 'San Pedro');
    await estabilizar();
    expect(
      html.querySelector('[data-testid="department-map-municipio"]')?.getAttribute('data-ine'),
    ).toMatch(/^09/);

    fixture.componentRef.setInput('value', 'dep-LP');
    fixture.detectChanges();
    expect(html.querySelector('[data-testid="department-map-municipio"]')).toBeNull();
  });

  it('sin coordenadas, el punto rojo cae en el centro del municipio', async () => {
    fixture.componentRef.setInput('value', 'dep-CB');
    fixture.componentRef.setInput('municipio', 'cochabamba');
    await estabilizar();

    const contorno = CONTORNOS_DE_MUNICIPIOS.find((c) => c.ine === '030101');
    const punto = html.querySelector('.department-map__marca-punto');
    expect(punto?.getAttribute('cx')).toBe(String(contorno?.x));
    expect(punto?.getAttribute('cy')).toBe(String(contorno?.y));
  });

  /**
   * La prueba de que la proyección de las coordenadas es la misma que la de
   * los contornos: tres plazas principales, cada una tiene que caer **dentro**
   * de su municipio. Con una proyección corrida, el punto rojo quedaría en el
   * municipio de al lado sin que nada fallara a la vista.
   */
  it.each([
    ['dep-SC', '070101', { lat: -17.7834, lng: -63.1821 }], // Plaza 24 de Septiembre
    ['dep-LP', '020101', { lat: -16.4958, lng: -68.1336 }], // Plaza Murillo
    ['dep-CH', '010101', { lat: -19.0476, lng: -65.2594 }], // Plaza 25 de Mayo, Sucre
  ])('con coordenadas, el punto cae dentro de su municipio (%s %s)', async (dep, ine, lugar) => {
    fixture.componentRef.setInput('value', dep);
    fixture.componentRef.setInput('municipio', ine);
    fixture.componentRef.setInput('punto', lugar);
    await estabilizar();

    const punto = html.querySelector('.department-map__marca-punto');
    const x = Number(punto?.getAttribute('cx'));
    const y = Number(punto?.getAttribute('cy'));
    const contorno = CONTORNOS_DE_MUNICIPIOS.find((c) => c.ine === ine);
    expect(contorno).toBeDefined();
    expect(dentroDe(contorno?.d ?? '', x, y), `(${x}, ${y}) fuera de ${ine}`).toBe(true);
    // No es el centro del municipio: es el lugar.
    expect(x).not.toBe(contorno?.x);
  });

  it('sin departamento elegido no hay municipio ni punto', async () => {
    fixture.componentRef.setInput('municipio', '070101');
    await estabilizar();
    expect(html.querySelector('[data-testid="department-map-municipio"]')).toBeNull();
    expect(html.querySelector('[data-testid="department-map-punto"]')).toBeNull();
  });
});
