import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import type { MotivoDelVinculo } from '../red-clinica.model';
import type { AristaDeLaRed } from '../red-clinica.geometria.types';
import { RedLeyenda } from './red-leyenda';

let n = 0;
const arista = (motivo: MotivoDelVinculo, familia: AristaDeLaRed['familia'], inferido = false): AristaDeLaRed => ({
  clave: `${motivo}:${familia}:${n++}`,
  desde: 'a',
  hasta: 'b',
  motivo,
  familia,
  inferido,
  trazo: 'M 0 0',
  puntos: [],
});

function leyenda(aristas: readonly AristaDeLaRed[], conHitos = false): HTMLElement {
  const f = TestBed.createComponent(RedLeyenda);
  f.componentRef.setInput('aristas', aristas);
  f.componentRef.setInput('conHitos', conHitos);
  f.detectChanges();
  return f.nativeElement as HTMLElement;
}

/** The `::after` declarations of the component sheets whose selector matches the element. */
function tachado(el: Element): CSSStyleDeclaration[] {
  return [...document.styleSheets]
    .flatMap((hoja) => [...hoja.cssRules])
    .filter((r): r is CSSStyleRule => r instanceof CSSStyleRule && r.selectorText.endsWith('::after'))
    .filter((r) => el.matches(r.selectorText.slice(0, -'::after'.length)))
    .map((r) => r.style);
}

describe('RedLeyenda', () => {
  it('el rombo del descartado va tachado con un trazo y el del presuntivo no: la forma, no solo el color (ADR-0021)', () => {
    const raiz = leyenda([], true);
    const muestra = (texto: string): Element =>
      [...raiz.querySelectorAll('li')].find((li) => li.textContent?.trim() === texto)!.querySelector('.red__muestra-hito')!;
    const [trazo] = tachado(muestra('Descartado'));
    expect(trazo).toBeDefined();
    expect(trazo.getPropertyValue('content')).toMatch(/^(''|"")$/);
    expect(trazo.getPropertyValue('inline-size')).toBe('2px');
    // It pokes out of the diamond, in the ruled-out ink.
    expect(trazo.getPropertyValue('inset-block')).toBe('-4px');
    expect(trazo.getPropertyValue('background')).toBe('var(--st-error-fg)');
    // The bar is the cue: the border stays solid so the 11px diamond is still a diamond under it.
    const solido = [...document.styleSheets]
      .flatMap((hoja) => [...hoja.cssRules])
      .filter((r): r is CSSStyleRule => r instanceof CSSStyleRule && !r.selectorText.includes('::') && muestra('Descartado').matches(r.selectorText));
    expect(solido.some((r) => r.style.getPropertyValue('border-style') === 'solid')).toBe(true);
    for (const otro of ['Confirmado', 'Presuntivo', 'Atención o cita']) {
      expect(tachado(muestra(otro)), otro).toEqual([]);
    }
  });

  it('explica las familias que se distinguen en el lienzo, no cada motivo con el mismo trazo', () => {
    const raiz = leyenda([
      arista('registrado-en', 'tronco'),
      arista('indicado-para', 'enlace'),
      arista('pedido-para', 'enlace'),
      arista('resultado-de', 'enlace'),
      arista('reemplazado-por', 'enlace'),
      arista('receta-reemplazada', 'enlace'),
      arista('reconsulta-de', 'enlace'),
      arista('inferido-mismo-dia', 'enlace', true),
    ]);
    const items = [...raiz.querySelectorAll('li')];
    expect(items.map((li) => li.dataset['familia'])).toEqual(['tronco', 'enlace', 'inferido']);
    expect(items[2].textContent).toContain('Inferido');
    // Each family names the reasons it carries, on hover and for assistive technology.
    expect(items[1].title).toContain('Se indicó para ese diagnóstico');
    expect(items[1].title).toContain('Reconsulta de');
    expect(items[1].querySelector('.sr-only')?.textContent).toContain('Resultado del estudio');
  });

  it('cada familia tiene su propio trazo: el tronco sin punta, el enlace y el inferido con la suya', () => {
    const raiz = leyenda([arista('registrado-en', 'tronco'), arista('evidencia', 'enlace'), arista('inferido-mismo-dia', 'enlace', true)]);
    const [tronco, enlace, inferido] = [...raiz.querySelectorAll('li')];
    expect(tronco.querySelector('.red__arista--tronco')).not.toBeNull();
    expect(tronco.querySelector('.red__punta')).toBeNull();
    expect(enlace.querySelector('.red__arista--enlace')).not.toBeNull();
    expect(enlace.querySelector('.red__punta')).not.toBeNull();
    expect(inferido.querySelector('.red__arista--inferido')).not.toBeNull();
    expect(inferido.querySelector('.red__punta--inferido')).not.toBeNull();
  });

  it('no explica una familia que no está en pantalla', () => {
    const raiz = leyenda([arista('indicado-para', 'enlace')]);
    expect([...raiz.querySelectorAll('li')].map((li) => li.dataset['familia'])).toEqual(['enlace']);
  });
});
