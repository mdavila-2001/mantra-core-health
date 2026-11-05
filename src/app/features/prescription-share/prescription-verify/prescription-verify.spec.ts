import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Meta } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap } from '@angular/router';

import { PrescriptionVerify } from './prescription-verify';

/** Un uuid sintético, como el que imprime el QR del PDF. */
const ID = '0b9d3f4e-1a2b-4c3d-8e9f-001122334455';
const VERIFY_URL = `/public/prescriptions/${ID}/verify`;

const ISSUED = {
  id: ID,
  status: 'ISSUED',
  issuedAt: '2026-10-01T10:00:00.000Z',
  contentHash: 'f'.repeat(64),
  prescriberLicense: { number: 'MN-0001', authority: 'Ministerio de prueba', state: 'ACTIVE' },
};

/**
 * `/verify/rx/:id` (FAR-01, REQ-015): a donde apunta el QR del PDF, que hasta
 * ahora caía en «Página no encontrada».
 *
 * Lo que fijan estas pruebas: el verify existente se consulta tal cual; cada
 * estado de la receta tiene su texto; un id inexistente o mal formado tiene
 * texto propio (y el mal formado ni siquiera consulta); los estados de carga y
 * error; el `noindex`.
 */
describe('PrescriptionVerify', () => {
  let http: HttpTestingController;

  function mount(id: string): ComponentFixture<PrescriptionVerify> {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id }) } },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(PrescriptionVerify);
    fixture.detectChanges();
    return fixture;
  }

  function text(fixture: ComponentFixture<PrescriptionVerify>): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  afterEach(() => http.verify());

  it('emitida: con fecha, matrícula y sello, y pide compararlo con el impreso', () => {
    const fixture = mount(ID);
    expect(fixture.nativeElement.querySelector('.view-state-host__loading')).not.toBeNull();

    http.expectOne(VERIFY_URL).flush(ISSUED);
    fixture.detectChanges();

    const shown = text(fixture);
    expect(shown).toContain('Receta emitida');
    // La API solo recalcula el sello: la pantalla no puede afirmar que coincide.
    expect(shown).not.toContain('coincide');
    expect(shown).not.toContain('auténtica');
    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="prescription-share-verify-seal-instruction"]',
      )?.textContent,
    ).toContain(
      'Compare este sello con el impreso al pie de la receta. Si no es exactamente igual, la receta fue alterada: no la acepte.',
    );
    expect(shown).toContain('MN-0001');
    expect(shown).toContain('Ministerio de prueba');
    expect(
      fixture.nativeElement.querySelector('[data-testid="prescription-share-verify-hash"]')
        ?.textContent,
    ).toContain('f'.repeat(64));
  });

  it('anulada y reemplazada dicen que no tienen validez', () => {
    const invalidated = mount(ID);
    http.expectOne(VERIFY_URL).flush({ ...ISSUED, status: 'INVALIDATED' });
    invalidated.detectChanges();
    expect(text(invalidated)).toContain('Receta anulada');

    const replaced = TestBed.createComponent(PrescriptionVerify);
    replaced.detectChanges();
    http.expectOne(VERIFY_URL).flush({ ...ISSUED, status: 'REPLACED', prescriberLicense: null });
    replaced.detectChanges();
    expect(text(replaced)).toContain('Receta reemplazada');
    expect(text(replaced)).toContain('Sin registrar');
  });

  it('un borrador no muestra sello y dice que no tiene validez', () => {
    const fixture = mount(ID);
    http
      .expectOne(VERIFY_URL)
      .flush({ ...ISSUED, status: 'DRAFT', issuedAt: null, contentHash: null });
    fixture.detectChanges();

    expect(text(fixture)).toContain('Receta sin emitir');
    expect(
      fixture.nativeElement.querySelector('[data-testid="prescription-share-verify-hash"]'),
    ).toBeNull();
    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="prescription-share-verify-seal-instruction"]',
      ),
    ).toBeNull();
  });

  it('un id inexistente muestra su propio texto, no la página 404', () => {
    const fixture = mount(ID);
    http
      .expectOne(VERIFY_URL)
      .flush({ code: 'NOT_FOUND', message: 'x' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();

    expect(text(fixture)).toContain('No encontramos esta receta');
  });

  it('un id sin forma de uuid no consulta y muestra el mismo texto', () => {
    const fixture = mount('no-es-un-uuid');

    http.expectNone(() => true);
    expect(
      fixture.nativeElement.querySelector('[data-testid="prescription-share-verify-not-found"]'),
    ).not.toBeNull();
  });

  it('un fallo inesperado queda recuperable con su código de soporte', () => {
    const fixture = mount(ID);
    http
      .expectOne(VERIFY_URL)
      .flush(
        { code: 'INTERNAL', message: 'x', correlationId: 'req-777' },
        { status: 500, statusText: 'Server Error' },
      );
    fixture.detectChanges();

    expect(text(fixture)).toContain('req-777');
    expect(text(fixture)).toContain('Reintentar');
  });

  it('lleva noindex', () => {
    mount(ID);
    expect(TestBed.inject(Meta).getTag('name="robots"')?.content).toBe('noindex, nofollow');
    http.expectOne(VERIFY_URL).flush(ISSUED);
  });
});
