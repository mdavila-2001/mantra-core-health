import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import type { CertezaDiagnostica } from '../red-clinica.model';
import type { NodoDeLaRed } from '../red-clinica.geometria.types';
import { RedNodo } from './red-nodo';

@Component({
  imports: [RedNodo],
  template: `<button
    app-red-nodo
    type="button"
    aria-label="Hipotiroidismo"
    class="tono--error"
    [class.red__nodo--descartado]="descartado()"
    [nodo]="nodo()"
  ></button>`,
})
class Anfitrion {
  readonly nodo = input.required<NodoDeLaRed>();
  readonly descartado = input(false);
}

const nodo = (
  certeza: CertezaDiagnostica,
  forma: NodoDeLaRed['forma'] = 'tarjeta',
): NodoDeLaRed => ({
  id: `dx-${certeza}`,
  forma,
  registro: {
    id: `dx-${certeza}`,
    clase: 'diagnostico',
    titulo: 'Hipotiroidismo',
    detalle: '',
    estado: '',
    cuando: null,
    certeza,
  },
  episodio: 'e1',
  columna: 0,
  x: 0,
  y: 0,
  ancho: 200,
  alto: 60,
});

function marca(n: NodoDeLaRed, descartado: boolean): HTMLElement {
  const f = TestBed.createComponent(Anfitrion);
  f.componentRef.setInput('nodo', n);
  f.componentRef.setInput('descartado', descartado);
  f.detectChanges();
  return (f.nativeElement as HTMLElement).querySelector<HTMLElement>('.red__marca')!;
}

/** The `::after` declarations of the component sheets whose selector matches the element. */
function tachado(el: Element): CSSStyleDeclaration[] {
  return [...document.styleSheets]
    .flatMap((hoja) => [...hoja.cssRules])
    .filter(
      (r): r is CSSStyleRule => r instanceof CSSStyleRule && r.selectorText.endsWith('::after'),
    )
    .filter((r) => el.matches(r.selectorText.slice(0, -'::after'.length)))
    .map((r) => r.style);
}

describe('RedNodo', () => {
  it('tacha la marca del diagnóstico descartado con un trazo, no solo con color (ADR-0021, WCAG 1.4.1)', () => {
    for (const forma of ['tarjeta', 'descartado'] as const) {
      const [trazo] = tachado(marca(nodo('descartado', forma), true));
      expect(trazo, forma).toBeDefined();
      expect(trazo.getPropertyValue('content')).toMatch(/^(''|"")$/);
      expect(trazo.getPropertyValue('rotate')).toBe('45deg');
      // The bar is drawn in the tone's ink over the mark's own background.
      expect(trazo.getPropertyValue('background')).toBe('var(--t-fg)');
      expect(trazo.getPropertyValue('box-shadow')).toContain('var(--t-bg)');
    }
  });

  it('no tacha la marca del confirmado ni la del presuntivo', () => {
    expect(tachado(marca(nodo('confirmado'), false))).toEqual([]);
    expect(tachado(marca(nodo('presuntivo'), false))).toEqual([]);
  });
});
