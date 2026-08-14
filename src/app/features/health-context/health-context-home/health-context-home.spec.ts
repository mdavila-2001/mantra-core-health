import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { HealthContextHome } from './health-context-home';

/**
 * La portada es el índice de un módulo sin listados: lo que se fija acá es que
 * las **doce** operaciones del contrato estén ofrecidas —las trece rutas del
 * controller menos `internal/schedules/run-due`, que es de `SYSTEM` y ninguna
 * persona puede ejecutar— y que ninguna prometa una pantalla que no existe.
 */
describe('HealthContextHome', () => {
  let fixture: ComponentFixture<HealthContextHome>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HealthContextHome],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(HealthContextHome);
    fixture.detectChanges();
  });

  function raiz(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function enlaces(): readonly string[] {
    return Array.from(
      raiz().querySelectorAll('a[app-link]'),
      (a) => a.getAttribute('href') ?? '',
    );
  }

  it('ofrece las doce operaciones del contrato, agrupadas en cuatro áreas', () => {
    expect(raiz().querySelectorAll('app-card').length).toBe(4);
    expect(raiz().querySelectorAll('.portada__operaciones li').length).toBe(12);
  });

  it('la única lectura del módulo tiene pantalla y apunta bajo administration/', () => {
    // Bajo `administration/` y no bajo `health-context/`: ese es el prefijo de
    // la API y el proxy compara por inicio de ruta.
    expect(enlaces()).toContain('/administration/health-context/contexts/resolve');
  });

  it('lo que todavía no tiene pantalla lo dice, en vez de enlazar a un 404', () => {
    const pendientes = raiz().querySelectorAll('.portada__pendiente');

    expect(pendientes.length + enlaces().length).toBe(12);
    for (const pendiente of pendientes) {
      expect(pendiente.textContent).toContain('en preparación');
    }
  });

  it('avisa por qué no hay listados: el módulo no expone consultas de colección', () => {
    const aviso = raiz().querySelector('app-alert');

    expect(aviso?.textContent).toContain('listados');
  });
});
