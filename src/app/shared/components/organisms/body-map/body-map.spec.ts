import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { BodyMap, ESPERAR_IMAGEN_DE_VISTA, ZONAS_CON_SILUETA, type ZonaElegible } from './body-map';
import {
  VISTAS_DEL_CUERPO,
  VISTAS_DEL_CUERPO_FEMENINA,
  VISTAS_DEL_CUERPO_MASCULINA,
} from './body-zones.geometry';

/**
 * Las zonas gruesas, tal como las entrega `symptom-check` a partir de su tabla:
 * `id` y nombre. La lectura de la IA y la leyenda de lo contado hablan en
 * ellas. Más una sin silueta («piel»), para probar que no se dibuja.
 */
const GRUESAS: readonly ZonaElegible[] = [
  { id: 'cabeza', nombre: 'Cabeza' },
  { id: 'ojos', nombre: 'Ojos' },
  { id: 'oidos', nombre: 'Oídos' },
  { id: 'nariz', nombre: 'Nariz' },
  { id: 'boca', nombre: 'Boca y dientes' },
  { id: 'garganta', nombre: 'Garganta' },
  { id: 'nuca', nombre: 'Nuca' },
  { id: 'hombros', nombre: 'Hombros' },
  { id: 'pecho', nombre: 'Pecho y respiración' },
  { id: 'estomago', nombre: 'Estómago' },
  { id: 'abdomen', nombre: 'Panza e intestino' },
  { id: 'espalda', nombre: 'Espalda' },
  { id: 'rinones', nombre: 'Cintura y riñones' },
  { id: 'intima', nombre: 'Salud íntima' },
  { id: 'gluteos', nombre: 'Glúteos' },
  { id: 'brazos', nombre: 'Brazos y codos' },
  { id: 'manos', nombre: 'Manos y muñecas' },
  { id: 'caderas', nombre: 'Caderas' },
  { id: 'piernas', nombre: 'Piernas' },
  { id: 'rodillas', nombre: 'Rodillas' },
  { id: 'pies', nombre: 'Pies y tobillos' },
  { id: 'piel', nombre: 'Piel y pelo' },
];

/** Los nombres de las finas que las pruebas leen; el resto se llama por su `id`. */
const NOMBRES_FINOS: Readonly<Record<string, string>> = {
  'pecho-der': 'Pecho, lado derecho',
  'rodilla-der': 'Rodilla derecha',
  'rodilla-izq': 'Rodilla izquierda',
};

/** Gruesas y finas (2026-11-03): la figura dibuja sólo las finas. */
const ZONAS: readonly ZonaElegible[] = [
  ...GRUESAS,
  ...[...new Set(VISTAS_DEL_CUERPO.flatMap((vista) => vista.zonas.map((zona) => zona.id)))]
    .filter((id) => !GRUESAS.some((zona) => zona.id === id))
    .map((id) => ({ id, nombre: NOMBRES_FINOS[id] ?? id })),
];

// El orden del tabulador: de arriba abajo por el centro de cada zona y, a la
// misma altura, de izquierda a derecha de la pantalla (la derecha del paciente
// primero, de frente). Los brazos bajan junto al tronco: se intercalan.
const FRENTE = [
  'cabeza',
  'cuello-der',
  'garganta',
  'cuello-izq',
  'clavicula-der',
  'clavicula-izq',
  'hombro-der',
  'hombro-izq',
  'axila-der',
  'esternon',
  'axila-izq',
  'pecho-der',
  'pecho-izq',
  'brazo-der',
  'brazo-izq',
  'hipocondrio-der',
  'hipocondrio-izq',
  'epigastrio',
  'codo-der',
  'codo-izq',
  'flanco-der',
  'periumbilical',
  'flanco-izq',
  'antebrazo-der',
  'antebrazo-izq',
  'muneca-der',
  'muneca-izq',
  'fosa-iliaca-der',
  'hipogastrio',
  'fosa-iliaca-izq',
  'mano-der',
  'mano-izq',
  'intima',
  'dedos-der',
  'dedos-izq',
  'cadera-der',
  'cadera-izq',
  'ingle-der',
  'ingle-izq',
  'muslo-interno-der',
  'muslo-interno-izq',
  'muslo-der',
  'muslo-izq',
  'rodilla-der',
  'rodilla-izq',
  'canilla-der',
  'canilla-izq',
  'tobillo-der',
  'tobillo-izq',
  'pie-der',
  'pie-izq',
  'dedos-pie-der',
  'dedos-pie-izq',
];

/** Las imágenes del maniquí viven en `public/`: lo que baja el navegador. */
const PUBLICO = join(process.cwd(), 'public');
/** Tope por imagen: la figura se descarga en cada consulta de síntomas. */
const PESO_MAXIMO_IMAGEN = 150 * 1024;

describe('BodyMap', () => {
  let fixture: ComponentFixture<BodyMap>;
  let component: BodyMap;
  let html: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [BodyMap],
      providers: [{ provide: ESPERAR_IMAGEN_DE_VISTA, useValue: false }],
    });
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

  /**
   * Cada parte que alguien señala tiene su zona, con su lado: 89 finas, más las
   * gruesas de las que salen (con las que habla la lectura de la IA).
   */
  it('entre las tres vistas hay 89 zonas finas, y con sus madres 104', () => {
    const finas = new Set(VISTAS_DEL_CUERPO.flatMap((vista) => vista.zonas.map((zona) => zona.id)));
    expect(finas.size).toBe(89);
    expect(ZONAS_CON_SILUETA.size).toBe(104);
    expect(ZONAS_CON_SILUETA.has('piel')).toBe(false);
  });

  /** La lectura de la IA habla en zonas gruesas: cada fina tiene que saber de cuál sale. */
  it('cada zona fina sale de una zona gruesa conocida', () => {
    const gruesas = new Set(GRUESAS.map((zona) => zona.id));
    for (const vistas of [VISTAS_DEL_CUERPO, VISTAS_DEL_CUERPO_MASCULINA, VISTAS_DEL_CUERPO_FEMENINA]) {
      for (const zona of vistas.flatMap((vista) => vista.zonas)) {
        expect(gruesas.has(zona.madre), `${zona.id} sale de «${zona.madre}»`).toBe(true);
      }
    }
  });

  /** El lado es el del paciente: de frente su derecha queda a la izquierda de la pantalla. */
  it('la derecha es la del paciente, de frente y de espaldas', () => {
    const centroX = (vista: number, id: string) =>
      VISTAS_DEL_CUERPO[vista].zonas.find((zona) => zona.id === id)!.centros[0][0];
    expect(centroX(0, 'rodilla-der')).toBeLessThan(120);
    expect(centroX(0, 'mano-izq')).toBeGreaterThan(120);
    expect(centroX(1, 'corva-der')).toBeGreaterThan(120);
    expect(centroX(1, 'omoplato-izq')).toBeLessThan(120);
    expect(centroX(2, 'ojo-der')).toBeLessThan(100);
  });

  /**
   * Cada forma tiene que ser un contorno cerrado: un `<path>` sin `Z` no se
   * rellena, así que no se puede pulsar en su interior —sólo sobre la línea—,
   * y la silueta se volvería inusable con el dedo sin que nada fallara a la vista.
   */
  it('cada vista trae el render de su maniquí, publicado y liviano', () => {
    for (const vistas of [VISTAS_DEL_CUERPO, VISTAS_DEL_CUERPO_MASCULINA, VISTAS_DEL_CUERPO_FEMENINA]) {
      for (const vista of vistas) {
        const archivo = join(PUBLICO, vista.image);
        expect(existsSync(archivo), `${vista.image} no está en public/`).toBe(true);
        expect(statSync(archivo).size, `${vista.image} pesa de más`).toBeLessThan(PESO_MAXIMO_IMAGEN);
      }
    }
  });

  it('las tres proporciones usan imágenes distintas', () => {
    const imagenes = [VISTAS_DEL_CUERPO, VISTAS_DEL_CUERPO_MASCULINA, VISTAS_DEL_CUERPO_FEMENINA].flatMap((vistas) =>
      vistas.map((vista) => vista.image),
    );
    expect(new Set(imagenes).size).toBe(imagenes.length);
  });

  it('cada vista trae el render de su maniquí, publicado y liviano', () => {
    for (const vistas of [
      VISTAS_DEL_CUERPO,
      VISTAS_DEL_CUERPO_MASCULINA,
      VISTAS_DEL_CUERPO_FEMENINA,
    ]) {
      for (const vista of vistas) {
        const archivo = join(PUBLICO, vista.image);
        expect(existsSync(archivo), `${vista.image} no está en public/`).toBe(true);
        expect(statSync(archivo).size, `${vista.image} pesa de más`).toBeLessThan(
          PESO_MAXIMO_IMAGEN,
        );
      }
    }
  });

  it('las tres proporciones usan imágenes distintas', () => {
    const imagenes = [
      VISTAS_DEL_CUERPO,
      VISTAS_DEL_CUERPO_MASCULINA,
      VISTAS_DEL_CUERPO_FEMENINA,
    ].flatMap((vistas) => vistas.map((vista) => vista.image));
    expect(new Set(imagenes).size).toBe(imagenes.length);
  });

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

  it('dibuja el maniquí de la vista puesta, decorativo, debajo de las zonas', () => {
    const render = html.querySelector('[data-testid="body-map-render"]');
    expect(render?.getAttribute('href')).toBe(VISTAS_DEL_CUERPO[0].image);
    expect(render?.getAttribute('aria-hidden')).toBe('true');
    // Debajo: en SVG lo que va antes en el documento se pinta primero.
    const primeraZona = formaDe('cabeza');
    expect(render?.compareDocumentPosition(primeraZona) ?? 0).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );

    pasarA('Espalda');
    expect(html.querySelector('[data-testid="body-map-render"]')?.getAttribute('href')).toBe(
      VISTAS_DEL_CUERPO[1].image,
    );
  });

  it('empieza de frente, con un control por zona y su nombre accesible completo', () => {
    expect(vistaPuesta()).toBe('frente');
    const formas = html.querySelectorAll('[role="button"]');
    expect(formas).toHaveLength(FRENTE.length);
    expect(formaDe('pecho-der').getAttribute('aria-label')).toBe('Pecho, lado derecho');
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
    for (const id of ['nuca', 'columna-media', 'columna-lumbar', 'gluteo-izq']) {
      expect(formaDe(id)).toBeTruthy();
    }
    expect(html.querySelector('[data-testid="body-map-pecho-der"]')).toBeNull();
  });

  /** A escala de cuerpo entero, la cara es más chica que un dedo: tocarla la acerca. */
  it('tocar la cabeza de frente acerca la cara y la deja elegida', () => {
    formaDe('cabeza').dispatchEvent(new MouseEvent('click'));
    fixture.detectChanges();

    expect(vistaPuesta()).toBe('cara');
    expect(component.value()).toBe('cabeza');
    for (const id of ['ojo-der', 'oido-izq', 'nariz', 'boca']) {
      expect(formaDe(id)).toBeTruthy();
    }
  });

  /** Lo elegido desde afuera siempre queda a la vista: la figura se da vuelta sola. */
  it('una zona elegida desde afuera que no está en la vista la cambia', () => {
    fixture.componentRef.setInput('value', 'gluteo-izq');
    fixture.detectChanges();

    expect(vistaPuesta()).toBe('espalda');
    expect(formaDe('gluteo-izq').getAttribute('aria-pressed')).toBe('true');
  });

  /**
   * El error que reportó el cliente (24/09/2026): con una zona de la cara
   * elegida, «Frente» y «Espalda» no hacían nada, porque la figura volvía sola
   * a la única vista que tenía esa zona. La vista que elige la persona manda.
   */
  it('desde la cara se puede volver a frente y a espalda con una zona de la cara elegida', () => {
    formaDe('cabeza').dispatchEvent(new MouseEvent('click'));
    fixture.detectChanges();
    formaDe('ojo-der').dispatchEvent(new MouseEvent('click'));
    fixture.detectChanges();
    expect(component.value()).toBe('ojo-der');

    pasarA('Frente');
    expect(vistaPuesta()).toBe('frente');
    pasarA('Espalda');
    expect(vistaPuesta()).toBe('espalda');
    pasarA('Cara');
    expect(vistaPuesta()).toBe('cara');
    // Lo elegido no se pierde al mirar otra vista: sigue dicho en palabras.
    expect(component.value()).toBe('ojo-der');
  });

  it('después de cambiar de vista a mano, elegir desde afuera vuelve a dar vuelta la figura', () => {
    pasarA('Espalda');
    fixture.componentRef.setInput('value', 'pecho-der');
    fixture.detectChanges();

    expect(vistaPuesta()).toBe('frente');
  });

  /* ---- Lo que se contó ---- */

  it('las zonas marcadas por lo que se contó se ven, se anuncian y se nombran, sin quedar elegidas', () => {
    fixture.componentRef.setInput('marcadas', ['rodillas', 'gluteos', 'piel']);
    fixture.detectChanges();

    // «rodillas» es la zona gruesa: se encienden las dos rodillas, cada una con su nombre.
    for (const [id, nombre] of [['rodilla-der', 'Rodilla derecha'], ['rodilla-izq', 'Rodilla izquierda']]) {
      const rodilla = formaDe(id);
      expect(rodilla.closest('g')?.classList).toContain('body-map__zona--marcada');
      expect(rodilla.getAttribute('aria-label')).toBe(`${nombre} (por lo que contó)`);
      expect(rodilla.getAttribute('aria-pressed')).toBe('false');
    }
    expect(component.value()).toBeNull();
    // Nombra también la que no se ve de frente (glúteos) y la que no tiene forma (piel).
    expect(html.querySelector('[data-testid="body-map-marcadas"]')?.textContent).toContain(
      'Glúteos, Rodillas y Piel y pelo',
    );
    expect(formaDe('pecho-der').closest('g')?.classList).not.toContain('body-map__zona--marcada');
  });

  /** «me duelen los ojos»: los ojos sólo están en la cara, así que la figura gira sola a mostrarlos. */
  it('lo marcado que no se ve en la vista puesta la cambia a la que lo muestra', () => {
    fixture.componentRef.setInput('marcadas', ['ojo-der', 'ojo-izq']);
    fixture.detectChanges();
    expect(vistaPuesta()).toBe('cara');
    expect(formaDe('ojo-izq').closest('g')?.classList).toContain('body-map__zona--marcada');

    fixture.componentRef.setInput('marcadas', ['coxis']);
    fixture.detectChanges();
    expect(vistaPuesta()).toBe('espalda');
  });

  it('lo marcado no mueve la figura si ya se ve, ni si hay una zona elegida', () => {
    fixture.componentRef.setInput('marcadas', ['rodilla-der']);
    fixture.detectChanges();
    expect(vistaPuesta()).toBe('frente');

    formaDe('pecho-der').dispatchEvent(new MouseEvent('click'));
    fixture.componentRef.setInput('marcadas', ['coxis']);
    fixture.detectChanges();
    expect(vistaPuesta()).toBe('frente');
  });

  it('sin nada contado no hay leyenda de marcadas', () => {
    expect(html.querySelector('[data-testid="body-map-marcadas"]')).toBeNull();
  });

  /* ---- Apuntar antes de tocar ---- */

  it('apuntar una zona la nombra arriba, y cambiar de vista borra el nombre', () => {
    formaDe('pecho-der').dispatchEvent(new Event('pointerenter'));
    fixture.detectChanges();
    expect(html.querySelector('.body-map__pista')?.textContent?.trim()).toBe('Pecho, lado derecho');

    // La forma se va con la vista y no avisa que el puntero salió.
    pasarA('Espalda');
    expect(html.querySelector('.body-map__pista')).toBeNull();
  });

  it('dejar la zona borra el nombre, y la elegida no se repite arriba', () => {
    formaDe('pecho-der').dispatchEvent(new Event('pointerenter'));
    fixture.detectChanges();
    formaDe('pecho-der').dispatchEvent(new Event('pointerleave'));
    fixture.detectChanges();
    expect(html.querySelector('.body-map__pista')).toBeNull();

    formaDe('pecho-der').dispatchEvent(new MouseEvent('click'));
    formaDe('pecho-der').dispatchEvent(new Event('pointerenter'));
    fixture.detectChanges();
    expect(html.querySelector('.body-map__pista')).toBeNull();
  });

  it('con zonas de una sola vista no hay selector de vista', () => {
    fixture.componentRef.setInput('zonas', [{ id: 'pecho-der', nombre: 'Pecho' }]);
    fixture.detectChanges();

    expect(html.querySelector('[role="radiogroup"]')).toBeNull();
    expect(formaDe('pecho-der')).toBeTruthy();
  });

  it('un clic elige la zona', () => {
    formaDe('pecho-der').dispatchEvent(new MouseEvent('click'));
    fixture.detectChanges();

    expect(component.value()).toBe('pecho-der');
    expect(formaDe('pecho-der').getAttribute('aria-pressed')).toBe('true');
    expect(formaDe('epigastrio').getAttribute('aria-pressed')).toBe('false');
  });

  /** El equivalente por teclado no es un añadido: Enter y la barra hacen lo mismo que el clic. */
  it('Enter elige, y la barra también', () => {
    formaDe('rodilla-der').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();
    expect(component.value()).toBe('rodilla-der');

    formaDe('epigastrio').dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    fixture.detectChanges();
    expect(component.value()).toBe('epigastrio');
  });

  it('la barra no desplaza la página', () => {
    const evento = new KeyboardEvent('keydown', { key: ' ', cancelable: true });
    formaDe('mano-der').dispatchEvent(evento);

    expect(evento.defaultPrevented).toBe(true);
  });

  /** Con ~40 partes por vista, la elegida se nombra sobre el cuerpo, junto a su punto. */
  it('la zona elegida lleva su nombre sobre la figura', () => {
    expect(html.querySelector('[data-testid="body-map-rotulo"]')).toBeNull();
    formaDe('pecho-der').dispatchEvent(new MouseEvent('click'));
    fixture.detectChanges();

    const rotulo = html.querySelector('[data-testid="body-map-rotulo"]');
    expect(rotulo?.textContent?.trim()).toBe('Pecho, lado derecho');
    expect(rotulo?.getAttribute('aria-hidden')).toBe('true');
  });

  /** El resaltado 3D: la zona elegida se pinta con el render recortado y teñido, no con un relleno plano. */
  it('la zona elegida se pinta sobre el volumen del render, recortada a su forma', () => {
    expect(html.querySelector('[data-testid="body-map-pintura-elegida"]')).toBeNull();
    formaDe('rodilla-der').dispatchEvent(new MouseEvent('click'));
    fixture.detectChanges();

    const pintura = html.querySelector('[data-testid="body-map-pintura-elegida"]');
    expect(pintura?.getAttribute('href')).toBe(VISTAS_DEL_CUERPO[0].image);
    const recorte = html.querySelector(pintura?.getAttribute('clip-path')?.slice(4, -1) ?? '#nada');
    expect(recorte?.querySelector('path')?.getAttribute('d')).toBe(formaDe('rodilla-der').getAttribute('d'));
    expect(html.querySelector(pintura?.getAttribute('filter')?.slice(4, -1) ?? '#nada')?.tagName).toBe('filter');
  });

  it('lo contado se pinta también, con todas las hijas de una zona gruesa', () => {
    fixture.componentRef.setInput('marcadas', ['rodillas']);
    fixture.detectChanges();

    const pintura = html.querySelector('[data-testid="body-map-pintura-marcada"]');
    const recorte = html.querySelector(pintura?.getAttribute('clip-path')?.slice(4, -1) ?? '#nada');
    const pintadas = Array.from(recorte?.querySelectorAll('path') ?? []).map((p) => p.getAttribute('d'));
    expect(pintadas).toEqual([formaDe('rodilla-der').getAttribute('d'), formaDe('rodilla-izq').getAttribute('d')]);
  });

  it('volver a pulsar la elegida la suelta', () => {
    formaDe('pecho-der').dispatchEvent(new MouseEvent('click'));
    formaDe('pecho-der').dispatchEvent(new MouseEvent('click'));
    fixture.detectChanges();

    expect(component.value()).toBeNull();
  });

  /* ---- El punto exacto: el lugar que se tocó dentro de la zona ---- */

  /**
   * A pointer click on `id` at drawing coordinates (x, y). jsdom has no layout,
   * so the canvas is given a box the size of its viewBox: client px equal
   * drawing units.
   */
  function tocarEn(id: string, x: number, y: number): void {
    const lienzo = html.querySelector('svg[data-testid^="body-map-vista-"]') as SVGSVGElement;
    const [, , ancho, alto] = (lienzo.getAttribute('viewBox') ?? '').split(' ').map(Number);
    lienzo.getBoundingClientRect = () => new DOMRect(0, 0, ancho, alto);
    formaDe(id).dispatchEvent(new MouseEvent('click', { detail: 1, clientX: x, clientY: y }));
    fixture.detectChanges();
  }

  function marcadores(): string[] {
    return Array.from(html.querySelectorAll('.body-map__marcador')).map(
      (marcador) => marcador.getAttribute('transform') ?? '',
    );
  }

  it('un clic de puntero deja el punto donde se tocó, no en el centro de la zona', () => {
    tocarEn('pecho-der', 100, 110);

    expect(component.value()).toBe('pecho-der');
    expect(marcadores()).toEqual(['translate(100 110)']);
  });

  it('tocar otro lugar de la zona elegida mueve el punto y no la suelta', () => {
    tocarEn('pecho-der', 100, 110);
    tocarEn('pecho-der', 108, 118);

    expect(component.value()).toBe('pecho-der');
    expect(marcadores()).toEqual(['translate(108 118)']);
  });

  it('«Quitar» suelta la zona y el punto', () => {
    tocarEn('pecho-der', 100, 110);
    html.querySelector<HTMLElement>('[data-testid="body-map-quitar"]')?.click();
    fixture.detectChanges();

    expect(component.value()).toBeNull();
    expect(marcadores()).toEqual([]);
    expect(html.querySelector('[data-testid="body-map-quitar"]')).toBeNull();
  });

  it('sin zona elegida no hay «Quitar»', () => {
    expect(html.querySelector('[data-testid="body-map-quitar"]')).toBeNull();
  });

  it('elegir otra zona con el puntero lleva el punto a la nueva', () => {
    tocarEn('pecho-der', 100, 110);
    tocarEn('epigastrio', 118, 142);

    expect(component.value()).toBe('epigastrio');
    expect(marcadores()).toEqual(['translate(118 142)']);
  });

  it('con el teclado el punto queda en el centro de la zona, y no hereda el de antes', () => {
    tocarEn('pecho-der', 100, 110);
    formaDe('pecho-der').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    formaDe('pecho-der').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();

    expect(component.value()).toBe('pecho-der');
    expect(marcadores()).not.toContain('translate(100 110)');
    expect(marcadores()).toHaveLength(1);
  });

  it('un punto de antes no vuelve cuando la zona se elige de nuevo desde afuera', () => {
    tocarEn('pecho-der', 100, 110);
    fixture.componentRef.setInput('value', 'hombro-der');
    fixture.detectChanges();
    fixture.componentRef.setInput('value', 'pecho-der');
    fixture.detectChanges();

    expect(marcadores()).not.toContain('translate(100 110)');
  });

  it('la cabeza de frente sigue acercando la cara, sin dejar un punto de otra vista', () => {
    tocarEn('cabeza', 120, 36);

    expect(vistaPuesta()).toBe('cara');
    expect(component.value()).toBe('cabeza');
    expect(marcadores()).not.toContain('translate(120 36)');
  });

  it('en la cara se puede señalar el lugar exacto de la cabeza', () => {
    formaDe('cabeza').dispatchEvent(new MouseEvent('click'));
    fixture.detectChanges();
    // La cara ya no es una sola zona: se toca la frente, en el punto exacto.
    tocarEn('frente', 100, 55);

    expect(vistaPuesta()).toBe('cara');
    expect(component.value()).toBe('frente');
    expect(marcadores()).toEqual(['translate(100 55)']);
  });

  /**
   * WCAG 2.2 AA: lo elegido no se comunica sólo por color. Además del relleno
   * y del trazo grueso, el nombre se dice con palabras en una región viva.
   */
  it('dice en palabras cuál quedó elegida', () => {
    const linea = html.querySelector('[data-testid="body-map-elegida"]');
    expect(linea?.textContent).toContain('Toque una parte del cuerpo');

    formaDe('intima').dispatchEvent(new MouseEvent('click'));
    fixture.detectChanges();

    expect(linea?.textContent).toContain('Salud íntima');
    expect(linea?.getAttribute('aria-live')).toBe('polite');
  });

  /** Quien monta el organismo puede elegir desde afuera (la pastilla) y la figura lo refleja. */
  it('un `value` puesto desde afuera resalta esa zona', () => {
    fixture.componentRef.setInput('value', 'hombro-der');
    fixture.detectChanges();

    expect(formaDe('hombro-der').getAttribute('aria-pressed')).toBe('true');
  });

  /** Un `value` que no corresponde a ninguna zona no resalta nada ni rompe. */
  it('un `value` desconocido no resalta nada', () => {
    fixture.componentRef.setInput('value', 'no-existe');
    fixture.detectChanges();

    expect(html.querySelectorAll('[aria-pressed="true"]')).toHaveLength(0);
    expect(html.querySelector('[data-testid="body-map-elegida"]')?.textContent).toContain(
      'Toque una parte del cuerpo',
    );
  });

  /** Sin zonas no hay silueta: un dibujo que no se puede pulsar es peor que su ausencia. */
  it('sin zonas no dibuja nada', () => {
    fixture.componentRef.setInput('zonas', []);
    fixture.detectChanges();

    expect(html.querySelector('svg')).toBeNull();
  });
});

/**
 * El sexo de la silueta (P-04, 2026-09-25): `symptom-check` lo pasa según el
 * propio perfil, y sin ese dato se dibuja la neutra de siempre. Acá sólo se
 * prueba que `BodyMap` elige el arreglo de vistas que corresponde; el ancho
 * de hombro/cintura/cadera de cada uno lo prueba `gen-body-zones.py` al
 * generarlo.
 */
describe('BodyMap · el sexo de la silueta', () => {
  let fixture: ComponentFixture<BodyMap>;
  let html: HTMLElement;

  function dDePecho(vistas: typeof VISTAS_DEL_CUERPO): string {
    const frente = vistas.find((vista) => vista.id === 'frente');
    const pecho = frente?.zonas.find((zona) => zona.id === 'pecho-der');
    if (pecho === undefined) throw new Error('la vista de frente no trae «pecho»');
    return pecho.d;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [BodyMap],
      providers: [{ provide: ESPERAR_IMAGEN_DE_VISTA, useValue: false }],
    });
    fixture = TestBed.createComponent(BodyMap);
    fixture.componentRef.setInput('zonas', ZONAS);
    fixture.detectChanges();
    html = fixture.nativeElement as HTMLElement;
  });

  function dDibujado(id: string): string | null {
    return html.querySelector(`[data-testid="body-map-${id}"]`)?.getAttribute('d') ?? null;
  }

  function imagenDibujada(): string | null {
    return html.querySelector('[data-testid="body-map-render"]')?.getAttribute('href') ?? null;
  }

  it('sin `sexo`, dibuja la silueta neutra', () => {
    expect(dDibujado('pecho-der')).toBe(dDePecho(VISTAS_DEL_CUERPO));
    expect(imagenDibujada()).toBe(VISTAS_DEL_CUERPO[0].image);
  });

  it('con `sexo` "MALE", dibuja la silueta masculina', () => {
    fixture.componentRef.setInput('sexo', 'MALE');
    fixture.detectChanges();

    expect(dDibujado('pecho-der')).toBe(dDePecho(VISTAS_DEL_CUERPO_MASCULINA));
    expect(dDibujado('pecho-der')).not.toBe(dDePecho(VISTAS_DEL_CUERPO));
    expect(imagenDibujada()).toBe(VISTAS_DEL_CUERPO_MASCULINA[0].image);
  });

  it('con `sexo` "FEMALE", dibuja la silueta femenina', () => {
    fixture.componentRef.setInput('sexo', 'FEMALE');
    fixture.detectChanges();

    expect(dDibujado('pecho-der')).toBe(dDePecho(VISTAS_DEL_CUERPO_FEMENINA));
    expect(dDibujado('pecho-der')).not.toBe(dDePecho(VISTAS_DEL_CUERPO));
    expect(imagenDibujada()).toBe(VISTAS_DEL_CUERPO_FEMENINA[0].image);
  });
});

/**
 * El cambio de vista no desfasa la imagen de las zonas (reporte del cliente,
 * 24/10/2026): al pasar de frente a espalda, el contorno de la espalda se veía
 * un rato sobre el maniquí de frente, hasta que llegaba la imagen nueva.
 *
 * Acá sí se espera la imagen (conducta de producción), con una `Image` falsa
 * cuya descarga se resuelve a mano.
 */
describe('BodyMap · el cambio de vista espera la imagen', () => {
  interface ImagenFalsa {
    src: string;
    resolver: () => void;
  }

  let imagenes: Map<string, ImagenFalsa>;
  let fixture: ComponentFixture<BodyMap>;
  let html: HTMLElement;

  const FRENTE_IMG = VISTAS_DEL_CUERPO[0].image;
  const ESPALDA_IMG = VISTAS_DEL_CUERPO[1].image;

  beforeEach(() => {
    imagenes = new Map();
    vi.useFakeTimers();
    vi.stubGlobal('fetch', undefined); // Esta suite verifica el respaldo mediante Image.
    vi.stubGlobal(
      'Image',
      class {
        private _src = '';
        get src(): string {
          return this._src;
        }
        set src(valor: string) {
          this._src = valor;
        }
        decode(): Promise<void> {
          return new Promise<void>((resolver) => {
            imagenes.set(this._src, { src: this._src, resolver });
          });
        }
      },
    );
    TestBed.configureTestingModule({ imports: [BodyMap] });
    fixture = TestBed.createComponent(BodyMap);
    fixture.componentRef.setInput('zonas', ZONAS);
    fixture.detectChanges();
    html = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  const imagenDibujada = (): string | null =>
    html.querySelector('[data-testid="body-map-render"]')?.getAttribute('href') ?? null;
  const dibujada = (id: string): boolean =>
    html.querySelector(`[data-testid="body-map-${id}"]`) !== null;
  const escenario = (): HTMLElement => html.querySelector<HTMLElement>('.body-map__escenario')!;

  function pedir(vista: string): void {
    html.querySelector<HTMLButtonElement>(`[data-testid="segmentado-${vista}"]`)!.click();
    fixture.detectChanges();
  }

  async function llegada(url: string): Promise<void> {
    imagenes.get(url)!.resolver();
    // La decodificación compite contra el tope antes de marcar la imagen como lista.
    for (let vuelta = 0; vuelta < 10; vuelta++) await Promise.resolve();
    fixture.detectChanges();
  }

  it('hasta que llega la imagen nueva se ve la figura anterior, con sus propias zonas', async () => {
    await llegada(FRENTE_IMG);

    pedir('espalda');

    expect(imagenDibujada()).toBe(FRENTE_IMG);
    expect(dibujada('pecho-der')).toBe(true);
    expect(dibujada('nuca')).toBe(false);
    expect(escenario().getAttribute('aria-busy')).toBe('true');
    // El selector sí responde al toque: la persona ve que se recibió.
    expect(
      html.querySelector('[data-testid="segmentado-espalda"]')?.getAttribute('aria-checked'),
    ).toBe('true');

    await llegada(ESPALDA_IMG);

    expect(imagenDibujada()).toBe(ESPALDA_IMG);
    expect(dibujada('nuca')).toBe(true);
    expect(dibujada('pecho-der')).toBe(false);
    expect(escenario().getAttribute('aria-busy')).toBe('false');
  });

  it('una vista ya vista cambia al instante', async () => {
    await llegada(FRENTE_IMG);
    pedir('espalda');
    await llegada(ESPALDA_IMG);
    expect(imagenDibujada()).toBe(ESPALDA_IMG);

    pedir('frente');

    expect(imagenDibujada()).toBe(FRENTE_IMG);
    expect(dibujada('pecho-der')).toBe(true);
    expect(escenario().getAttribute('aria-busy')).toBe('false');
  });

  it('una imagen que no llega no deja la figura congelada', async () => {
    await llegada(FRENTE_IMG);
    pedir('espalda');
    expect(imagenDibujada()).toBe(FRENTE_IMG);

    await vi.advanceTimersByTimeAsync(4100);
    fixture.detectChanges();

    expect(imagenDibujada()).toBe(ESPALDA_IMG);
    expect(dibujada('nuca')).toBe(true);
  });
});

/*
 * El cambio de vista no espera a la red (reporte del propietario, 24/10/2026:
 * «tarda muchísimo en cambiar de frente a espalda y cara»). Las tres vistas se
 * bajan al montar la figura y el `<image>` pasa a la copia en memoria.
 */
describe('BodyMap — vistas precargadas en memoria', () => {
  let fixture: ComponentFixture<BodyMap>;
  let html: HTMLElement;
  let pedidas: string[];
  let liberar: ReturnType<typeof vi.fn<(url: string) => void>>;
  const originales = { crear: URL.createObjectURL, liberar: URL.revokeObjectURL };

  beforeEach(() => {
    pedidas = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (ruta: string) => {
        pedidas.push(ruta);
        return new Response('x', { headers: { 'Content-Type': 'image/webp' } });
      }),
    );
    let siguienteCopia = 0;
    liberar = vi.fn<(url: string) => void>();
    URL.createObjectURL = vi.fn(() => `blob:copia-${++siguienteCopia}`);
    URL.revokeObjectURL = liberar;

    TestBed.configureTestingModule({ imports: [BodyMap] });
    fixture = TestBed.createComponent(BodyMap);
    fixture.componentRef.setInput('zonas', ZONAS);
    fixture.componentRef.setInput('sexo', 'FEMALE');
    fixture.detectChanges();
    html = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    URL.createObjectURL = originales.crear;
    URL.revokeObjectURL = originales.liberar;
  });

  async function esperarDescargas(): Promise<void> {
    await fixture.whenStable();
    await new Promise((listo) => setTimeout(listo));
    fixture.detectChanges();
  }

  function imagenDibujada(): string | null {
    return html.querySelector('[data-testid="body-map-render"]')?.getAttribute('href') ?? null;
  }

  it('baja las tres vistas del sexo puesto una sola vez, sin esperar a que se pidan', async () => {
    await esperarDescargas();
    expect([...pedidas].sort()).toEqual(VISTAS_DEL_CUERPO_FEMENINA.map((vista) => vista.image).sort());
  });

  it('al cambiar de vista dibuja la copia en memoria, sin volver a pedirla', async () => {
    await esperarDescargas();
    const antes = pedidas.length;

    for (const nombre of ['Espalda', 'Cara', 'Frente']) {
      const opcion = [...html.querySelectorAll<HTMLElement>('[role="radio"]')].find(
        (radio) => radio.textContent?.trim() === nombre,
      );
      if (opcion === undefined) throw new Error(`no está la vista ${nombre}`);
      opcion.click();
      fixture.detectChanges();
      expect(imagenDibujada(), nombre).toMatch(/^blob:/);
    }
    expect(pedidas.length).toBe(antes);
  });

  it('libera las copias en memoria al destruirse', async () => {
    await esperarDescargas();
    fixture.destroy();
    expect(liberar).toHaveBeenCalledTimes(VISTAS_DEL_CUERPO_FEMENINA.length);
  });
});
