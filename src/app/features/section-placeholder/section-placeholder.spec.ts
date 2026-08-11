import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterOutlet } from '@angular/router';
import { Component } from '@angular/core';

import { APP_SECTIONS } from '../../core/navigation/navigation.map';
import { SECTION_ROUTE_DATA, type AppSection } from '../../core/navigation/navigation.types';
import { SectionPlaceholder } from './section-placeholder';

/**
 * El placeholder es lo que hace recorrible el armazón antes de que existan las
 * pantallas. Lo que no puede pasar es que sea un callejón: tiene que decir de
 * qué era la sección y ofrecer una salida.
 */
@Component({
  selector: 'app-anfitrion',
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
class Anfitrion {}

const SECCION: AppSection = {
  path: 'schedule',
  label: 'Agenda',
  group: 'Atención',
  icon: 'calendar',
  availability: 'planificada',
  summary: 'Gestioná disponibilidad, reservas y confirmaciones de turno.',
  module: 'M41 scheduling',
};

describe('SectionPlaceholder', () => {
  async function montar(section: AppSection = SECCION) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          {
            path: section.path,
            component: SectionPlaceholder,
            data: { [SECTION_ROUTE_DATA]: section },
          },
        ]),
      ],
    });

    const fixture = TestBed.createComponent(Anfitrion);
    // Se monta por el router y no directamente porque la sección llega en el
    // `data` de la ruta: crear el componente suelto no probaría ese camino.
    await TestBed.inject(Router).navigateByUrl(`/${section.path}`);
    fixture.detectChanges();
    return fixture;
  }

  it('la pantalla se titula con el rótulo de la sección', async () => {
    const fixture = await montar();

    expect(fixture.nativeElement.querySelector('h1')?.textContent?.trim()).toBe('Agenda');
  });

  it('dice de qué es la sección: un vacío mudo no le sirve a nadie', async () => {
    const fixture = await montar();

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Gestioná disponibilidad, reservas y confirmaciones de turno.');
    // Y es explícito sobre por qué está vacía, en vez de sugerir que no hay datos.
    expect(texto).toContain('La pantalla todavía no está construida.');
  });

  it('ofrece la salida que S3 exige', async () => {
    const fixture = await montar();

    // Acotado al estado: el breadcrumb también enlaza al panel, y esa no es la
    // salida que S3 exige — es de dónde venís, no a dónde podés ir desde acá.
    const salida = fixture.nativeElement.querySelector('app-view-state-host a[href="/dashboard"]');
    expect(salida).not.toBeNull();
    expect(salida?.textContent?.trim()).toBe('Volver al panel');
  });

  it('muestra el módulo del modelo que respalda la sección', async () => {
    const fixture = await montar();

    // Trazabilidad: le dice a quien venga a construirla qué ficha de vistas abrir.
    expect(fixture.nativeElement.textContent).toContain('M41 scheduling');
  });

  it('sirve a cualquier sección planificada del registro, sin conocerlas', async () => {
    const otra = APP_SECTIONS.find((s) => s.availability === 'planificada' && s.path !== 'agenda');
    expect(otra).toBeDefined();

    const fixture = await montar(otra!);

    expect(fixture.nativeElement.querySelector('h1')?.textContent?.trim()).toBe(otra!.label);
  });
});
