import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { GENTE_DE_EJEMPLO } from '../pharmacy-profile.fixtures';
import { RepresentanteYGerentes } from './representante-y-gerentes';
import { loading, ready, unexpectedError } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import type { GenteDeLaEmpresa } from '../pharmacy-profile.types';

describe('RepresentanteYGerentes', () => {
  let fixture: ComponentFixture<RepresentanteYGerentes>;

  function montar(state: ViewState<GenteDeLaEmpresa>): HTMLElement {
    fixture = TestBed.createComponent(RepresentanteYGerentes);
    fixture.componentRef.setInput('state', state);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  afterEach(() => fixture.destroy());

  it('pinta al representante y a los tres gerentes, con el representante primero', () => {
    const root = montar(ready(GENTE_DE_EJEMPLO));

    const cargos = Array.from(root.querySelectorAll('h3')).map((titulo) => titulo.textContent?.trim());
    expect(cargos).toEqual([
      'Representante legal',
      'Gerente General',
      'Gerente Comercial',
      'Gerente Marketing',
    ]);
  });

  it('el poder del representante no se copia acá: se va a buscar donde está', () => {
    const root = montar(ready(GENTE_DE_EJEMPLO));
    const pedidos: number[] = [];
    fixture.componentInstance.poderPedido.subscribe(() => pedidos.push(1));

    expect(root.textContent ?? '').not.toContain('.pdf');
    root.querySelector<HTMLButtonElement>('[data-testid="ficha-ver-poder"]')?.click();

    expect(pedidos).toHaveLength(1);
  });

  it('se declara maqueta en la propia pantalla', () => {
    expect(montar(ready(GENTE_DE_EJEMPLO)).textContent ?? '').toContain('Datos de ejemplo');
  });

  it('mientras carga muestra el esqueleto y ningún dato de nadie', () => {
    const root = montar(loading());

    expect(root.querySelector('app-skeleton')).not.toBeNull();
    expect(root.textContent ?? '').not.toContain('Gerente General');
  });

  it('si falla, el código de soporte queda a la vista y se puede reintentar', () => {
    const root = montar(unexpectedError('soporte-9137'));
    const reintentos: number[] = [];
    fixture.componentInstance.retry.subscribe(() => reintentos.push(1));

    expect(root.textContent ?? '').toContain('soporte-9137');

    const botones = Array.from(root.querySelectorAll('button'));
    botones.find((boton) => boton.textContent?.includes('Reintentar'))?.click();
    expect(reintentos).toHaveLength(1);
  });
});
