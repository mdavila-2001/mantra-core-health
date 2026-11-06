import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { forbidden, offline, unexpectedError } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { ViewStateHost } from './view-state-host';

@Component({
  imports: [ViewStateHost],
  template: `<app-view-state-host [state]="state()" [retryable]="retryable()" />`,
})
class OptionsHost {
  readonly state = signal<ViewState<never>>(forbidden());
  readonly retryable = signal(true);
}

/* The two options of the host: an S5 with its own title, and S8/S9 without «Reintentar». */
describe('ViewStateHost · título de S5 y reintento opcional', () => {
  async function render(state: ViewState<never>, retryable = true): Promise<string> {
    await TestBed.configureTestingModule({ imports: [OptionsHost], providers: [provideRouter([])] }).compileComponents();
    const fixture = TestBed.createComponent(OptionsHost);
    fixture.componentInstance.state.set(state);
    fixture.componentInstance.retryable.set(retryable);
    await fixture.whenStable();
    return ((fixture.nativeElement as HTMLElement).textContent ?? '').replace(/\s+/g, ' ');
  }

  it('S5 usa el título que trae el estado; sin él, el de siempre', async () => {
    expect(await render(forbidden({ title: 'No se pudo quitar la encuesta', message: 'M' }))).toContain('No se pudo quitar la encuesta');
    TestBed.resetTestingModule();
    expect(await render(forbidden({ message: 'M' }))).toContain('No tiene acceso a esta sección');
  });

  it('con retryable=false, S9 y S8 no ofrecen «Reintentar» (S9 conserva «Copiar código»)', async () => {
    const s9 = await render(unexpectedError('c-1', 'M', { title: 'T' }), false);
    expect(s9).toContain('Copiar código');
    expect(s9).not.toContain('Reintentar');
    TestBed.resetTestingModule();
    expect(await render(offline(), false)).not.toContain('Reintentar');
    TestBed.resetTestingModule();
    expect(await render(unexpectedError('c-1', 'M', { title: 'T' }))).toContain('Reintentar');
  });
});
