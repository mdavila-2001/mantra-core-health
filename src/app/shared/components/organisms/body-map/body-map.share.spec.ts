import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { BodyMap, ESPERAR_IMAGEN_DE_VISTA, type ZonaElegible } from './body-map';
import {
  bodyMapCaption,
  bodyMapFileName,
  buildBodyMapSvg,
  type BodyMapSnapshot,
} from './body-map.export';
import { VISTAS_DEL_CUERPO } from './body-zones.geometry';

const ZONAS: readonly ZonaElegible[] = [
  { id: 'cabeza', nombre: 'Cabeza' },
  { id: 'pecho', nombre: 'Pecho y respiración' },
  { id: 'espalda', nombre: 'Espalda' },
  { id: 'piernas', nombre: 'Piernas' },
];

/** El ancho en píxeles de un WebP (cabecera VP8X: el lienzo va en 3 bytes desde el 24). */
function anchoDelWebp(ruta: string): number {
  const cabecera = readFileSync(join(process.cwd(), 'public', ruta));
  return cabecera.readUIntLE(24, 3) + 1;
}

describe('BodyMap · render ultra HD', () => {
  it('cada vista se publica con píxeles de sobra para verla de cerca', () => {
    for (const vista of VISTAS_DEL_CUERPO) {
      const ancho = anchoDelWebp(vista.image);
      // El cuerpo mide 240 unidades de ancho y la cara 200: a 8 px por unidad como mínimo.
      const [, , unidades] = vista.viewBox.split(' ').map(Number);
      expect(ancho / unidades, `${vista.image} tiene ${ancho} px`).toBeGreaterThanOrEqual(8);
    }
  });
});

describe('BodyMap · ver de cerca y compartir', () => {
  let fixture: ComponentFixture<BodyMap>;
  let html: HTMLElement;

  function montar(): void {
    TestBed.configureTestingModule({
      imports: [BodyMap],
      providers: [{ provide: ESPERAR_IMAGEN_DE_VISTA, useValue: false }],
    });
    fixture = TestBed.createComponent(BodyMap);
    fixture.componentRef.setInput('zonas', ZONAS);
    fixture.detectChanges();
    html = fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => history.replaceState(null, '', '/'));
  afterEach(() => history.replaceState(null, '', '/'));

  const boton = (testId: string): HTMLButtonElement =>
    html.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`)!;
  const viewBox = (): string =>
    html.querySelector('svg[data-testid^="body-map-vista-"]')!.getAttribute('viewBox')!;
  const zoom = (): string => boton('body-map-zoom').textContent!.trim();
  const pulsar = (testId: string): void => {
    boton(testId).click();
    fixture.detectChanges();
  };

  describe('acercar y alejar', () => {
    beforeEach(montar);

    it('empieza con la figura entera y sin poder alejar más', () => {
      expect(zoom()).toBe('100 %');
      expect(viewBox()).toBe(VISTAS_DEL_CUERPO[0].viewBox);
      expect(boton('body-map-alejar').getAttribute('aria-disabled')).toBe('true');
      expect(html.querySelector('[data-testid="body-map-restablecer"]')).toBeNull();
    });

    it('acercar achica el cuadro que se mira, sin cambiar la imagen', () => {
      pulsar('body-map-acercar');
      const [, , ancho, alto] = viewBox().split(' ').map(Number);
      expect(zoom()).toBe('150 %');
      expect(ancho).toBeCloseTo(240 / 1.5, 5);
      expect(alto).toBeCloseTo(440 / 1.5, 5);
      expect(html.querySelector('[data-testid="body-map-render"]')?.getAttribute('width')).toBe('240');
    });

    it('«Ver entera» vuelve al cuadro original', () => {
      pulsar('body-map-acercar');
      pulsar('body-map-acercar');
      pulsar('body-map-restablecer');
      expect(zoom()).toBe('100 %');
      expect(viewBox()).toBe(VISTAS_DEL_CUERPO[0].viewBox);
    });

    it('no pasa del máximo', () => {
      for (let i = 0; i < 12; i++) pulsar('body-map-acercar');
      expect(zoom()).toBe('500 %');
      expect(boton('body-map-acercar').getAttribute('aria-disabled')).toBe('true');
    });

    it('el primer acercamiento va a la zona elegida', () => {
      const pecho = html.querySelector<SVGPathElement>('[data-testid="body-map-pecho"]')!;
      pecho.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      fixture.detectChanges();
      pulsar('body-map-acercar');
      const [x, y, ancho, alto] = viewBox().split(' ').map(Number);
      const [cx, cy] = VISTAS_DEL_CUERPO[0].zonas.find((z) => z.id === 'pecho')!.centros[0];
      expect(cx).toBeGreaterThan(x);
      expect(cx).toBeLessThan(x + ancho);
      expect(cy).toBeGreaterThan(y);
      expect(cy).toBeLessThan(y + alto);
    });

    it('un arrastre no elige la zona sobre la que termina', () => {
      pulsar('body-map-acercar');
      const lienzo = html.querySelector('svg[data-testid^="body-map-vista-"]')!;
      const pecho = html.querySelector<SVGPathElement>('[data-testid="body-map-pecho"]')!;
      lienzo.dispatchEvent(new PointerEvent('pointerdown', { clientX: 10, clientY: 10, button: 0, bubbles: true }));
      lienzo.dispatchEvent(new PointerEvent('pointermove', { clientX: 60, clientY: 60, bubbles: true }));
      lienzo.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      pecho.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      fixture.detectChanges();
      expect(html.querySelector('[data-testid="body-map-elegida"]')?.textContent).not.toContain('Pecho');
      // y el clic siguiente, sin arrastre, sí elige.
      pecho.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      fixture.detectChanges();
      expect(html.querySelector('[data-testid="body-map-elegida"]')?.textContent).toContain('Pecho');
    });
  });

  describe('ampliar', () => {
    beforeEach(montar);

    it('ocupa la pantalla como un diálogo y Escape lo cierra', () => {
      const raiz = html.querySelector('.body-map')!;
      expect(raiz.getAttribute('role')).toBeNull();
      pulsar('body-map-ampliar');
      expect(raiz.classList.contains('body-map--ampliado')).toBe(true);
      expect(raiz.getAttribute('role')).toBe('dialog');
      expect(raiz.getAttribute('aria-modal')).toBe('true');
      expect(boton('body-map-ampliar').textContent?.trim()).toBe('Cerrar');
      expect(document.body.style.overflow).toBe('hidden');

      raiz.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      fixture.detectChanges();
      expect(raiz.classList.contains('body-map--ampliado')).toBe(false);
      expect(document.body.style.overflow).not.toBe('hidden');
    });
  });

  describe('el enlace', () => {
    it('abre en la zona y la vista que trae la dirección', () => {
      history.replaceState(null, '', '/?zona=nuca&vista=espalda');
      TestBed.configureTestingModule({
        imports: [BodyMap],
        providers: [{ provide: ESPERAR_IMAGEN_DE_VISTA, useValue: false }],
      });
      fixture = TestBed.createComponent(BodyMap);
      fixture.componentRef.setInput('zonas', [...ZONAS, { id: 'nuca', nombre: 'Nuca' }]);
      fixture.detectChanges();
      html = fixture.nativeElement as HTMLElement;
      expect(fixture.componentInstance.value()).toBe('nuca');
      expect(html.querySelector('svg[data-testid^="body-map-vista-"]')?.getAttribute('data-testid')).toBe(
        'body-map-vista-espalda',
      );
    });

    it('ignora una zona que no existe en vez de elegirla', () => {
      history.replaceState(null, '', '/?zona=inventada&vista=nada');
      montar();
      expect(fixture.componentInstance.value()).toBeNull();
    });

    it('«Compartir» ofrece el enlace con la zona elegida y los tres archivos', () => {
      montar();
      const pecho = html.querySelector<SVGPathElement>('[data-testid="body-map-pecho"]')!;
      pecho.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      fixture.detectChanges();
      const compartir = html.querySelector('app-share-menu')!;
      expect(compartir).not.toBeNull();
      const url = new URL(
        (fixture.componentInstance as unknown as { enlaceParaCompartir(): string }).enlaceParaCompartir(),
      );
      expect(url.searchParams.get('zona')).toBe('pecho');
      expect(url.searchParams.get('vista')).toBe('frente');
    });
  });
});

describe('body-map.export', () => {
  const foto: BodyMapSnapshot = {
    image: '/body-map/neutral-front.webp',
    box: [240, 440],
    viewName: 'Frente',
    zoneName: 'Pecho y respiración',
    zonePath: 'M0 0 10 0 10 10Z',
    zoneCenters: [[5, 5]],
    colors: { surface: '#fff', ink: '#111', inkMuted: '#555', brand: '#0a6', brandStrong: '#054' },
  };

  it('nombra el archivo sin acentos ni espacios', () => {
    expect(bodyMapFileName(foto, 'png')).toBe('mapa-corporal-pecho-y-respiracion-frente.png');
    expect(bodyMapFileName({ ...foto, zoneName: null }, 'pdf')).toBe('mapa-corporal-frente.pdf');
  });

  it('el pie dice la zona y la vista, o sólo la vista', () => {
    expect(bodyMapCaption(foto)).toBe('Zona: Pecho y respiración · Frente');
    expect(bodyMapCaption({ ...foto, zoneName: null })).toBe('Frente');
  });

  it('el SVG lleva la imagen incrustada, la zona marcada y ninguna dirección externa', () => {
    const svg = buildBodyMapSvg(foto, 'data:image/webp;base64,AAAA');
    expect(svg).toContain('href="data:image/webp;base64,AAAA"');
    expect(svg).toContain('d="M0 0 10 0 10 10Z"');
    expect(svg).toContain('Zona: Pecho y respiración · Frente');
    expect(svg).not.toContain('/body-map/');
    expect(svg).toContain('viewBox="0 0 240 473');
  });

  it('el SVG escapa lo que viene de afuera', () => {
    const svg = buildBodyMapSvg({ ...foto, zoneName: '<script>"x"&' }, 'data:,');
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;');
  });
});
