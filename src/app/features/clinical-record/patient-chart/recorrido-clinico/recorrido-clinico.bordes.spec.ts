import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { RecorridoClinico } from './recorrido-clinico';
import type { RegistroDeLaRed, VinculoDeLaRed } from './red-clinica.model';

/**
 * Los saltos de borde del lienzo («Lo más antiguo» / «Lo más reciente»): van
 * antes del lienzo en el orden de tabulación y, al usarlos, el foco pasa al
 * lienzo en vez de perderse con el botón que se va.
 */
const dia = (d: number): Date => new Date(2026, 0, d);
const REGISTROS: readonly RegistroDeLaRed[] = [1, 9, 20].map((d) => ({
  id: `c${d}`,
  clase: 'atencion',
  titulo: `Atención ${d}`,
  detalle: '',
  estado: 'Atendida',
  cuando: dia(d),
}));
const VINCULOS: readonly VinculoDeLaRed[] = [];

@Component({
  imports: [RecorridoClinico],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-recorrido-clinico [registros]="registros" [vinculos]="vinculos" [resaltados]="[]" [visibles]="[]" [seleccionado]="null" />`,
})
class Anfitrion {
  readonly registros = REGISTROS;
  readonly vinculos = VINCULOS;
}

interface Ventana {
  set(v: { desde: number; hasta: number }): void;
}

describe('RecorridoClinico · saltos de borde', () => {
  let fixture: ComponentFixture<Anfitrion>;
  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  // The window in view, as the canvas' scroll would report it.
  const verDesde = (desde: number, hasta: number): void => {
    const red = fixture.debugElement.query(By.directive(RecorridoClinico)).componentInstance as unknown as { desplazamiento: { ventana: Ventana } };
    red.desplazamiento.ventana.set({ desde, hasta });
    fixture.detectChanges();
  };
  const salto = (borde: 'inicio' | 'final'): HTMLButtonElement | null => raiz().querySelector(`[data-testid="red-borde-${borde}"] button`);

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Anfitrion] }).compileComponents();
    fixture = TestBed.createComponent(Anfitrion);
    document.body.append(raiz());
    fixture.detectChanges();
    await fixture.whenStable();
    verDesde(40, 60);
  });

  afterEach(() => raiz().remove());

  it('van antes del lienzo en el orden de tabulación', () => {
    const lienzo = raiz().querySelector('.red__lienzo')!;
    for (const borde of ['inicio', 'final'] as const) {
      expect(salto(borde)).not.toBeNull();
      expect(salto(borde)!.compareDocumentPosition(lienzo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it('«Lo más antiguo» deja el foco en el lienzo aunque su botón desaparezca', () => {
    salto('inicio')!.focus();
    salto('inicio')!.click();
    verDesde(0, 20);
    expect(salto('inicio')).toBeNull();
    expect(document.activeElement).toBe(raiz().querySelector('.red__lienzo'));
  });

  it('«Lo más reciente» también', () => {
    salto('final')!.focus();
    salto('final')!.click();
    verDesde(40, Number.POSITIVE_INFINITY);
    expect(salto('final')).toBeNull();
    expect(document.activeElement).toBe(raiz().querySelector('.red__lienzo'));
  });
});
