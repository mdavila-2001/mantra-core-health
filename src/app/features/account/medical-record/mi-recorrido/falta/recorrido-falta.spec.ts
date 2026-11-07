import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { forbidden, unexpectedError } from '../../../../../core/view-state/view-state';
import type { ViewState } from '../../../../../core/view-state/view-state.types';
import { RecorridoFalta } from './recorrido-falta';

describe('RecorridoFalta', () => {
  let fixture: ComponentFixture<RecorridoFalta>;
  let raiz: HTMLElement;

  const montar = (estado: ViewState<unknown>): void => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    fixture = TestBed.createComponent(RecorridoFalta);
    fixture.componentRef.setInput('estado', estado);
    fixture.componentRef.setInput('que', 'sus estudios y controles');
    fixture.detectChanges();
    raiz = fixture.nativeElement as HTMLElement;
  };
  const botones = (): string[] => Array.from(raiz.querySelectorAll('button')).map((b) => b.textContent?.trim() ?? '');

  it('S5 es un aviso y no una falla: sin tono de error, sin código de soporte y sin reintentar', () => {
    montar(forbidden({ message: 'Sin permiso', requestId: 'corr-403' }));
    const muro = raiz.querySelector('[data-testid="recorrido-sin-acceso"]');
    expect(muro?.classList).toContain('alert--warning');
    expect(muro?.textContent).toContain('No puede ver sus estudios y controles');
    expect(muro?.textContent).toContain('Sin permiso');
    expect(raiz.querySelector('.alert--error')).toBeNull();
    expect(raiz.querySelector('[data-testid="support-code"]')).toBeNull();
    expect(botones()).not.toContain('Reintentar');
  });

  it('S5 conserva la puerta: la próxima acción enlaza a su ruta con su consulta', () => {
    montar(forbidden({ nextAction: { label: 'Elegir organización', route: '/auth/organization?returnUrl=%2Fx' } }));
    const enlace = raiz.querySelector<HTMLAnchorElement>('[data-testid="recorrido-sin-acceso"] a');
    expect(enlace?.textContent?.trim()).toBe('Elegir organización');
    expect(enlace?.getAttribute('href')).toBe('/auth/organization?returnUrl=%2Fx');
  });

  it('S9 sigue siendo el del host: tono de error, ID de petición y reintentar', () => {
    montar(unexpectedError('mock-500'));
    const pedidos: unknown[] = [];
    fixture.componentInstance.reintentar.subscribe((v) => pedidos.push(v));
    expect(raiz.querySelector('[data-testid="recorrido-sin-acceso"]')).toBeNull();
    expect(raiz.querySelector('[data-testid="support-code"] code')?.textContent?.trim()).toBe('mock-500');
    Array.from(raiz.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Reintentar')!.click();
    expect(pedidos).toHaveLength(1);
  });
});
