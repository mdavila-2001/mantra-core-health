import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ContentPacks } from './content-packs';

/**
 * Aplicar un paquete es una llamada y un reporte, y el reporte es lo que
 * importa: no hay estado de «aplicado» guardado en ningún lado.
 *
 * Lo que estas pruebas fijan: que cero filas se lea como «ya estaba» y no como
 * un fallo, que el paquete que pide contraseña no se aplique sin ella, y que el
 * detalle por tipo de fila no se pierda detrás del total.
 */
const PAQUETES = [
  {
    code: 'ARANCEL_BO',
    name: 'Nomenclador de procedimientos',
    description: 'Arancel con precios de referencia.',
    approxRows: 4408,
    requiresDemoPassword: false,
  },
  {
    code: 'CUENTAS_DEMO',
    name: 'Cuentas de demostración',
    description: 'Cuentas de los socios comerciales.',
    approxRows: 4,
    requiresDemoPassword: true,
  },
];

describe('ContentPacks', () => {
  let fixture: ComponentFixture<ContentPacks>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContentPacks],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: '**', children: [] }]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ContentPacks);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    http.expectOne('/admin/content-packs').flush({ items: PAQUETES });
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function interno<T>(nombre: string): T {
    const valor = (fixture.componentInstance as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(fixture.componentInstance) : valor) as T;
  }

  function crudo<T>(nombre: string): T {
    return (fixture.componentInstance as unknown as Record<string, unknown>)[nombre] as T;
  }

  it('aplica el paquete elegido y muestra lo que dejó', () => {
    interno<(p: unknown) => void>('aplicar')(PAQUETES[0]);

    const pedido = http.expectOne('/admin/content-packs/ARANCEL_BO/apply');
    expect(pedido.request.method).toBe('POST');
    // Sin contraseña: este paquete no crea cuentas.
    expect(pedido.request.body).toEqual({});

    pedido.flush({
      code: 'ARANCEL_BO',
      inserted: 4408,
      tookMs: 3200,
      counters: { procedures: 4408, memberships: 4408 },
    });
    fixture.detectChanges();

    // El detalle por tipo de fila no se pierde detrás del total: es lo que dice
    // QUÉ entró.
    const contadores = interno<(c: string) => readonly { nombre: string; valor: number }[]>(
      'contadoresDe',
    )('ARANCEL_BO');
    expect(contadores).toEqual([
      { nombre: 'procedures', valor: 4408 },
      { nombre: 'memberships', valor: 4408 },
    ]);
  });

  it('cero filas es «ya estaba», no un fallo', () => {
    // Los paquetes convergen: sin esto, re-aplicar uno parecería haber fallado.
    interno<(p: unknown) => void>('aplicar')(PAQUETES[0]);

    http.expectOne('/admin/content-packs/ARANCEL_BO/apply').flush({
      code: 'ARANCEL_BO',
      inserted: 0,
      tookMs: 120,
      counters: { procedures: 0 },
    });
    fixture.detectChanges();

    const resultado = interno<(c: string) => { inserted: number } | undefined>('resultadoDe')(
      'ARANCEL_BO',
    );
    expect(resultado?.inserted).toBe(0);
  });

  it('el paquete que crea cuentas no se aplica sin contraseña', () => {
    expect(interno<(p: unknown) => boolean>('puedeAplicar')(PAQUETES[1])).toBe(false);

    interno<(p: unknown) => void>('aplicar')(PAQUETES[1]);
    http.expectNone('/admin/content-packs/CUENTAS_DEMO/apply');
  });

  it('con contraseña, la manda en el cuerpo', () => {
    crudo<{ set: (v: string) => void }>('demoPassword').set('una-clave');
    fixture.detectChanges();

    expect(interno<(p: unknown) => boolean>('puedeAplicar')(PAQUETES[1])).toBe(true);

    interno<(p: unknown) => void>('aplicar')(PAQUETES[1]);

    const pedido = http.expectOne('/admin/content-packs/CUENTAS_DEMO/apply');
    expect(pedido.request.body).toEqual({ demoPassword: 'una-clave' });
    pedido.flush({ code: 'CUENTAS_DEMO', inserted: 4, tookMs: 90, counters: { created: 4 } });
  });

  it('mientras uno se aplica, no se puede lanzar otro', () => {
    // Dos paquetes a la vez sobre el mismo catálogo es pedir una carrera.
    interno<(p: unknown) => void>('aplicar')(PAQUETES[0]);

    expect(interno<(p: unknown) => boolean>('puedeAplicar')(PAQUETES[1])).toBe(false);

    http
      .expectOne('/admin/content-packs/ARANCEL_BO/apply')
      .flush({ code: 'ARANCEL_BO', inserted: 1, tookMs: 10, counters: {} });
  });
});
