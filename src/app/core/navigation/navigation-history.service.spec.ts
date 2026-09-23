import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { NavigationHistoryService } from './navigation-history.service';

/**
 * La pantalla profunda. Pide el servicio **en su construcción**, que es cuando
 * lo pediría el control «Volver» de verdad: mientras el router activa la ruta y
 * antes de que emita el `NavigationEnd` de esa misma navegación.
 */
@Component({ template: 'detalle' })
class Detalle {
  readonly historial = inject(NavigationHistoryService);
}

@Component({ template: 'listado' })
class Listado {}

describe('NavigationHistoryService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'listado', component: Listado },
          { path: 'detalle', component: Detalle },
        ]),
      ],
    });
  });

  it('llegar directo a la pantalla no deja nada que deshacer', async () => {
    const harness = await RouterTestingHarness.create();
    const pantalla = await harness.navigateByUrl('/detalle', Detalle);

    // Es el caso del enlace de un correo, el marcador y la recarga: la única
    // navegación que hubo es la que dibujó esta pantalla.
    expect(pantalla.historial.hasInternalHistory()).toBe(false);
  });

  it('llegar navegando sí lo deja, aunque el servicio nazca recién ahí', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/listado', Listado);
    const pantalla = await harness.navigateByUrl('/detalle', Detalle);

    // El servicio es `providedIn: 'root'`: nace la primera vez que alguien lo
    // inyecta, o sea en esta segunda navegación. Si sólo contara desde su
    // nacimiento, acá diría que no hay a dónde volver.
    expect(pantalla.historial.hasInternalHistory()).toBe(true);
  });

  it('sigue contando después de nacer', async () => {
    const harness = await RouterTestingHarness.create();
    const pantalla = await harness.navigateByUrl('/detalle', Detalle);
    expect(pantalla.historial.hasInternalHistory()).toBe(false);

    await harness.navigateByUrl('/listado', Listado);
    await harness.navigateByUrl('/detalle', Detalle);

    expect(pantalla.historial.hasInternalHistory()).toBe(true);
  });

  it('no mira la pila del navegador', () => {
    // `history.length` no distingue «llegué navegando por la aplicación» de
    // «abrí el enlace directo con la pestaña ya usada»: nunca decrece y cuenta
    // también lo que se visitó fuera. La respuesta acá no depende de él.
    const historial = TestBed.inject(NavigationHistoryService);

    expect(window.history.length).toBeGreaterThan(0);
    expect(historial.hasInternalHistory()).toBe(false);
  });
});
