import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';

import { ResultCard } from './result-card';
import type { SearchResultItem } from '../search-result/search-result.types';

@Component({ template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class RoutePlaceholder {}

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
      <li
        app-result-card
        [resultado]="dato()"
        [preventDuplicateNavigation]="impedirDuplicado()"
      ></li>
    </ul>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Anfitrion {
  readonly dato = signal<SearchResultItem>({
    id: 'r-1',
    title: 'Dra. Marisol Quispe Ticona',
    link: '/buscar/perfil-profesional-detalle',
  });

  readonly impedirDuplicado = signal(false);
}

describe('ResultCard', () => {
  let fixture: ComponentFixture<Anfitrion>;
  let anfitrion: Anfitrion;
  let router: Router;

  const elemento = (selector: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(selector);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Anfitrion],
      providers: [provideRouter([{ path: '**', component: RoutePlaceholder }])],
    }).compileComponents();

    fixture = TestBed.createComponent(Anfitrion);
    anfitrion = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('es un `li[app-result-card]`', () => {
    const host = elemento('li');
    expect(host).not.toBeNull();
    expect(host!.hasAttribute('app-result-card')).toBe(true);
  });

  /*
   * Un paciente lee «4,9 · 55 opiniones» como «otros pacientes opinaron». Sin
   * reseñas reales la tarjeta no puede decirlo: antes un respaldo inventaba
   * la nota con un hash del nombre.
   */
  it('sin reseñas reales lo dice, con las estrellas vacías y sin número', () => {
    const resenas = elemento('.tarjeta-resultado__resenas')!;
    expect(resenas.classList).toContain('tarjeta-resultado__resenas--vacias');
    expect(resenas.getAttribute('aria-label')).toBe('Sin reseñas todavía');
    expect(resenas.textContent).toContain('Sin reseñas todavía');
    expect(fixture.nativeElement.textContent).not.toMatch(/\d,\d|Excelente|Muy recomendado/u);
  });

  it('con reseñas reales dibuja las estrellas, la nota y cuántas son', () => {
    anfitrion.dato.update((d) => ({ ...d, rating: { average: 4.6, count: 12 } }));
    fixture.detectChanges();

    const resenas = elemento('.tarjeta-resultado__resenas')!;
    expect(resenas.textContent).toContain('4,6');
    expect(resenas.textContent).toContain('(12)');
    expect(resenas.getAttribute('aria-label')).toBe('4,6 de 5 estrellas, 12 opiniones');
    expect(elemento('.tarjeta-resultado__estrellas-relleno')!.style.inlineSize).toBe('92%');
    expect(elemento('.tarjeta-resultado__distincion')!.textContent).toContain('Muy recomendado');
  });

  // Antes toda nota menor a 4,8 salía «Muy recomendado»: un 3,7 también.
  it('una nota mediana no se lleva un elogio que las reseñas no dicen', () => {
    anfitrion.dato.update((d) => ({ ...d, rating: { average: 3.7, count: 60 } }));
    fixture.detectChanges();

    expect(elemento('.tarjeta-resultado__resenas')!.textContent).toContain('3,7');
    expect(elemento('.tarjeta-resultado__distincion')).toBeNull();
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

  it('cuando opta por navegación única navega solo una vez ante dos activaciones', () => {
    anfitrion.impedirDuplicado.set(true);
    fixture.detectChanges();
    const navigateByUrl = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    const link = elemento('.tarjeta-resultado__titulo a') as HTMLAnchorElement;
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    fixture.detectChanges();

    expect(link.getAttribute('aria-busy')).toBe('true');
    expect(link.getAttribute('aria-disabled')).toBe('true');

    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(navigateByUrl).toHaveBeenCalledTimes(1);
  });

  it('cuando opta por navegación única no deja cargando un Ctrl-clic', () => {
    anfitrion.impedirDuplicado.set(true);
    fixture.detectChanges();

    const link = elemento('.tarjeta-resultado__titulo a') as HTMLAnchorElement;
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }));
    fixture.detectChanges();

    expect(link.getAttribute('aria-busy')).toBeNull();
  });

  /* Clínicas, farmacias y aseguradoras no tienen agenda: su botón no puede
     ofrecer «Revisar disponibilidad». */
  it('sin acción propia, el botón lleva a la ficha', () => {
    const accion = elemento('.tarjeta-resultado__accion') as HTMLAnchorElement;
    expect(accion.textContent?.trim()).toBe('Ver ficha');
    expect(accion.getAttribute('href')).toBe('/buscar/perfil-profesional-detalle');
  });

  it('muestra la acción distinta y tampoco la navega dos veces', () => {
    anfitrion.dato.update((dato) => ({
      ...dato,
      action: {
        label: 'Revisar disponibilidad',
        link: '/buscar/perfil-profesional-detalle',
        fragment: 'horarios',
      },
    }));
    anfitrion.impedirDuplicado.set(true);
    fixture.detectChanges();
    const navegar = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    const accion = elemento('.tarjeta-resultado__accion') as HTMLAnchorElement;
    expect(accion.textContent?.trim()).toBe('Revisar disponibilidad');
    expect(accion.getAttribute('href')).toBe('/buscar/perfil-profesional-detalle#horarios');

    accion.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    accion.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(navegar).toHaveBeenCalledTimes(1);
    expect(navegar).toHaveBeenCalledWith('/buscar/perfil-profesional-detalle#horarios');
  });

  it('con `photoUrl` pinta la foto de cabecera en vez de la figura', () => {
    anfitrion.dato.update((d) => ({
      ...d,
      figureText: 'MQ',
      photoUrl: '/alovida/directorio/medico-01.jpg',
    }));
    fixture.detectChanges();

    expect(elemento('.tarjeta-resultado__foto img')?.getAttribute('src')).toBe(
      '/alovida/directorio/medico-01.jpg',
    );
    expect(elemento('.tarjeta-resultado__figura')).toBeNull();
  });

  it('si la foto falla vuelve a la figura', () => {
    anfitrion.dato.update((d) => ({ ...d, figureText: 'MQ', photoUrl: '/rota.jpg' }));
    fixture.detectChanges();
    elemento('.tarjeta-resultado__foto img')!.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(elemento('.tarjeta-resultado__foto')).toBeNull();
    expect(elemento('.tarjeta-resultado__figura')?.textContent?.trim()).toBe('MQ');
  });

  it('la línea de actividad lleva el pulso; las demás, el pin de ubicación', () => {
    anfitrion.dato.update((d) => ({
      ...d,
      meta: [
        { text: 'Clínica Los Olivos' },
        { text: '312 encuentros atendidos', iconKey: 'actividad' },
      ],
    }));
    fixture.detectChanges();

    const iconos = Array.from<SVGElement>(
      fixture.nativeElement.querySelectorAll('.tarjeta-resultado__meta-icono'),
    );
    expect(iconos).toHaveLength(2);
    expect(iconos[0]!.querySelector('circle')).not.toBeNull();
    expect(iconos[1]!.querySelector('circle')).toBeNull();
    expect(iconos[1]!.querySelector('path')?.getAttribute('d')).toBe('M22 12h-4l-3 9L9 3l-3 9H2');
  });
});
