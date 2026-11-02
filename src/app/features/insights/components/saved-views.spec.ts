import { HttpErrorResponse } from '@angular/common/http';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { InsightsWorkspaceClient } from '../../../core/data-access/insights/insights-workspace.client';
import type { InsightsSavedView } from '../../../core/data-access/insights/insights.types';
import { SavedViews } from './saved-views';

/**
 * Vistas guardadas de Insights: viven en el API, por usuario. Guarda la URL actual con un
 * nombre, navega a una guardada y la borra. Nunca acepta una URL fuera de `/insights` aunque
 * el API devuelva una (no se vuelve un redirector abierto).
 */
describe('SavedViews', () => {
  let fixture: ComponentFixture<SavedViews>;
  let navigateByUrl: ReturnType<typeof vi.fn>;
  let client: { listSavedViews: ReturnType<typeof vi.fn>; putSavedView: ReturnType<typeof vi.fn>; deleteSavedView: ReturnType<typeof vi.fn> };

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const view = (id: string, name: string, url: string): InsightsSavedView => ({ id, name, url, rowVersion: 1 });
  const meta = {} as never;

  function pintar(): void {
    fixture = TestBed.createComponent(SavedViews);
    fixture.detectChanges();
  }

  function abrir(): void {
    root().querySelector<HTMLButtonElement>('.sv__btn')!.click();
    fixture.detectChanges();
  }

  beforeEach(() => {
    navigateByUrl = vi.fn(async () => true);
    client = {
      listSavedViews: vi.fn(() => of({ data: [], meta })),
      putSavedView: vi.fn((id: string, body: { name: string; url: string }) => of({ data: view(id, body.name, body.url), meta })),
      deleteSavedView: vi.fn(() => of(undefined)),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { url: '/insights/campaigns?period=30d', navigateByUrl } },
        { provide: InsightsWorkspaceClient, useValue: client },
      ],
    });
  });

  it('sin vistas lo explica', () => {
    pintar();
    abrir();
    expect(root().querySelector('.sv__btn')?.getAttribute('aria-expanded')).toBe('true');
    expect(root().querySelector('.sv__empty')).not.toBeNull();
    expect(root().querySelector<HTMLButtonElement>('.sv__save')!.disabled).toBe(true);
  });

  it('guarda la URL actual con el nombre recortado en el API', () => {
    pintar();
    abrir();
    const campo = root().querySelector<HTMLInputElement>('#sv-name')!;
    campo.value = '  Octubre  ';
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    root().querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();

    expect(client.putSavedView).toHaveBeenCalledTimes(1);
    expect(client.putSavedView.mock.calls[0]![1]).toEqual({ name: 'Octubre', url: '/insights/campaigns?period=30d' });
    expect(root().querySelector('.sv__go')?.textContent).toBe('Octubre');
    expect(root().querySelector('.sv__n')?.textContent).toBe('1');
    expect(campo.value).toBe('');
  });

  it('ir a una vista navega y cierra el panel; eliminarla llama al API y la saca de la lista', () => {
    client.listSavedViews.mockReturnValue(of({ data: [view('1', 'A', '/insights/funnel')], meta }));
    pintar();
    abrir();
    root().querySelector<HTMLButtonElement>('.sv__go')!.click();
    fixture.detectChanges();
    expect(navigateByUrl).toHaveBeenCalledWith('/insights/funnel');
    expect(root().querySelector('.sv__panel')).toBeNull();

    abrir();
    root().querySelector<HTMLButtonElement>('[aria-label="Eliminar la vista A"]')!.click();
    fixture.detectChanges();
    expect(client.deleteSavedView).toHaveBeenCalledWith('1');
    expect(root().querySelector('.sv__go')).toBeNull();
  });

  it('descarta lo que no apunta a /insights, incluido un prefijo parecido', () => {
    client.listSavedViews.mockReturnValue(
      of({
        data: [view('1', 'ok', '/insights/home'), view('2', 'afuera', 'https://evil.example'), view('3', 'js', 'javascript:alert(1)'), view('4', 'parecido', '/insightsfoo')],
        meta,
      }),
    );
    pintar();
    abrir();
    expect(Array.from(root().querySelectorAll('.sv__go')).map((b) => b.textContent)).toEqual(['ok']);
  });

  it('un nombre repetido (409) se explica y un fallo de lectura no rompe la pantalla', () => {
    client.putSavedView.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409 })));
    pintar();
    abrir();
    const campo = root().querySelector<HTMLInputElement>('#sv-name')!;
    campo.value = 'Repetida';
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    root().querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
    expect(root().textContent).toContain('Ya tiene una vista con ese nombre.');
  });
});
