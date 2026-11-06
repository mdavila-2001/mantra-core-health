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

function leyenda(aristas: readonly AristaDeLaRed[]): HTMLElement {
  const f = TestBed.createComponent(RedLeyenda);
  f.componentRef.setInput('aristas', aristas);
  f.componentRef.setInput('conHitos', false);
  f.detectChanges();
  return f.nativeElement as HTMLElement;
}

describe('RedLeyenda', () => {
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
