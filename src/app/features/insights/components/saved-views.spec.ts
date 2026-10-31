import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Router } from '@angular/router';
import { vi } from 'vitest';

import { SavedViews } from './saved-views';

/**
 * Vistas guardadas de Insights: una conveniencia por navegador (localStorage).
 * Guarda la URL actual con un nombre, navega a una guardada y la borra. Nunca
 * acepta una URL fuera de `/insights` aunque alguien la haya escrito a mano en
 * el almacenamiento (no se vuelve un redirector abierto).
 */
describe('SavedViews', () => {
  let fixture: ComponentFixture<SavedViews>;
  let navigateByUrl: ReturnType<typeof vi.fn>;

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const KEY = 'insights.views';

  function pintar(): void {
    fixture = TestBed.createComponent(SavedViews);
    fixture.detectChanges();
  }

  function abrir(): void {
    root().querySelector<HTMLButtonElement>('.sv__btn')!.click();
    fixture.detectChanges();
  }

  beforeEach(() => {
    localStorage.clear();
    navigateByUrl = vi.fn(async () => true);
    TestBed.configureTestingModule({
      providers: [{ provide: Router, useValue: { url: '/insights/campaigns?period=30d', navigateByUrl } }],
    });
  });

  afterEach(() => localStorage.clear());

  it('sin vistas lo explica', () => {
    pintar();
    abrir();
    expect(root().querySelector('.sv__btn')?.getAttribute('aria-expanded')).toBe('true');
    expect(root().querySelector('.sv__empty')).not.toBeNull();
    expect(root().querySelector<HTMLButtonElement>('.sv__save')!.disabled).toBe(true);
  });

  it('guarda la URL actual con el nombre recortado y la persiste', () => {
    pintar();
    abrir();
    const campo = root().querySelector<HTMLInputElement>('#sv-name')!;
    campo.value = '  Octubre  ';
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    root().querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();

    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual([{ name: 'Octubre', url: '/insights/campaigns?period=30d' }]);
    expect(root().querySelector('.sv__go')?.textContent).toBe('Octubre');
    expect(root().querySelector('.sv__n')?.textContent).toBe('1');
    expect(campo.value).toBe('');
  });

  it('ir a una vista navega y cierra el panel; eliminarla la saca del almacenamiento', () => {
    localStorage.setItem(KEY, JSON.stringify([{ name: 'A', url: '/insights/funnel' }]));
    pintar();
    abrir();
    root().querySelector<HTMLButtonElement>('.sv__go')!.click();
    fixture.detectChanges();
    expect(navigateByUrl).toHaveBeenCalledWith('/insights/funnel');
    expect(root().querySelector('.sv__panel')).toBeNull();

    abrir();
    root().querySelector<HTMLButtonElement>('[aria-label="Eliminar la vista A"]')!.click();
    fixture.detectChanges();
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual([]);
  });

  it('descarta lo guardado que no apunta a /insights o está mal formado', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify([
        { name: 'ok', url: '/insights/home' },
        { name: 'afuera', url: 'https://evil.example' },
        { name: 'js', url: 'javascript:alert(1)' },
        { name: 1, url: '/insights/x' },
      ]),
    );
    pintar();
    abrir();
    expect(Array.from(root().querySelectorAll('.sv__go')).map((b) => b.textContent)).toEqual(['ok']);
  });

  it('un almacenamiento corrupto no rompe la pantalla', () => {
    localStorage.setItem(KEY, '{no es json');
    pintar();
    abrir();
    expect(root().querySelector('.sv__empty')).not.toBeNull();
  });
});
