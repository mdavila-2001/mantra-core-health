import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ResultCard } from './result-card';
import type { SearchResultItem } from '../search-result/search-result.types';

/**
 * `ResultCard` es el hermano de grilla de `SearchResult` (mismo
 * `SearchResultItem`, ver el JSDoc del componente). Estas pruebas cubren lo que
 * le es propio: el host `li[app-result-card]` y la degradación de la figura
 * cuando la foto falla — el defecto reproducido en el directorio público de
 * profesionales (AG50-FT02 finding FND-04): `avatarUrl` sembrado cuya versión
 * todavía no pasó el escaneo de malware responde 422 y, sin fallback, dejaba
 * un ícono de imagen rota en la tarjeta.
 */
@Component({
  imports: [ResultCard],
  template: `
    <ul>
      <li app-result-card [resultado]="dato()"></li>
    </ul>
  `,
})
class Anfitrion {
  readonly dato = signal<SearchResultItem>({
    id: 'r-1',
    title: 'Dra. Marisol Quispe Ticona',
    link: '/buscar/perfil-profesional-detalle',
  });
}

describe('ResultCard', () => {
  let fixture: ComponentFixture<Anfitrion>;
  let anfitrion: Anfitrion;

  const elemento = (selector: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(selector);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Anfitrion],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Anfitrion);
    anfitrion = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('es un `li[app-result-card]`', () => {
    const host = elemento('li');
    expect(host).not.toBeNull();
    expect(host!.hasAttribute('app-result-card')).toBe(true);
  });

  it('sin imagen pinta `figureText`', () => {
    anfitrion.dato.update((d) => ({ ...d, figureText: 'MQ' }));
    fixture.detectChanges();

    expect(elemento('.tarjeta-resultado__figura')!.textContent!.trim()).toBe('MQ');
    expect(elemento('.tarjeta-resultado__figura img')).toBeNull();
  });

  it('con imagen la pinta y no el texto', () => {
    anfitrion.dato.update((d) => ({ ...d, figureText: 'MQ', figureImageUrl: '/f/foto.jpg' }));
    fixture.detectChanges();

    const img = elemento('.tarjeta-resultado__figura img')!;
    expect(img.getAttribute('src')).toBe('/f/foto.jpg');
    expect(img.getAttribute('alt')).toBe('');
  });

  /**
   * FND-04: una `figureImageUrl` que 422/404 (foto sin escanear, borrada,
   * lo que sea) no puede dejar el cuadrado con un ícono de imagen rota. Tiene
   * que caer al mismo `figureText` que ya pinta cuando no hay foto.
   */
  it('cuando la imagen falla, cae a `figureText` en vez de quedar rota', () => {
    anfitrion.dato.update((d) => ({ ...d, figureText: 'MQ', figureImageUrl: '/f/rota.jpg' }));
    fixture.detectChanges();

    const img = elemento('.tarjeta-resultado__figura img')!;
    img.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(elemento('.tarjeta-resultado__figura img')).toBeNull();
    expect(elemento('.tarjeta-resultado__figura')!.textContent!.trim()).toBe('MQ');
  });

  /**
   * Una tarjeta reutilizada por `@for` con una foto NUEVA no puede quedar
   * varada en el fallback de la foto anterior: `linkedSignal` sobre
   * `resultado` la resetea por cada dato distinto, igual que `Avatar`.
   */
  it('una foto nueva tiene su propia oportunidad tras el fallo de la anterior', () => {
    anfitrion.dato.update((d) => ({ ...d, figureText: 'MQ', figureImageUrl: '/f/rota.jpg' }));
    fixture.detectChanges();
    elemento('.tarjeta-resultado__figura img')!.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(elemento('.tarjeta-resultado__figura img')).toBeNull();

    anfitrion.dato.set({
      id: 'r-2',
      title: 'Dr. Iván Mamani',
      link: '/buscar/perfil-profesional-detalle-2',
      figureText: 'IM',
      figureImageUrl: '/f/buena.jpg',
    });
    fixture.detectChanges();

    const img = elemento('.tarjeta-resultado__figura img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toBe('/f/buena.jpg');
  });
});
