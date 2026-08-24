import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SetupNotice } from './setup-notice';

/**
 * El aviso decide solo si aparece, y de eso depende que no sea ruido.
 *
 * Lo que fija: que el tenant semilla no cuente —existe en toda instalación, así
 * que contarlo apagaría el aviso siempre— y que un fallo de lectura no invente
 * un pendiente.
 */
const SEMILLA = {
  id: 't-0',
  code: 'DEFAULT',
  legalName: 'Organización por defecto',
  tenantTypeConceptId: 'c-provider',
  statusConceptId: 'c-activa',
  verificationStatusConceptId: 'c-verificada',
  createdAt: '2026-08-01T12:00:00.000Z',
};

const REAL = { ...SEMILLA, id: 't-9', code: 'CLINICA-SUR', legalName: 'Clínica del Sur' };

describe('SetupNotice', () => {
  let fixture: ComponentFixture<SetupNotice>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SetupNotice],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: '**', children: [] }]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SetupNotice);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  /** Responde el listado y devuelve si el aviso quedó visible. */
  function conOrganizaciones(items: readonly object[]): boolean {
    http
      .expectOne((r) => r.url === '/admin/tenants')
      .flush({ items, count: items.length, limit: 2, nextCursor: null });
    fixture.detectChanges();
    return fixture.nativeElement.textContent.includes('Todavía no hay ninguna organización');
  }

  it('avisa cuando sólo está el tenant semilla', () => {
    // Existe en toda instalación: si contara, el aviso no aparecería nunca.
    expect(conOrganizaciones([SEMILLA])).toBe(true);
  });

  it('no avisa cuando ya hay una organización real', () => {
    expect(conOrganizaciones([SEMILLA, REAL])).toBe(false);
  });

  it('no avisa si la lectura falla', () => {
    // Inventar un pendiente porque una lectura secundaria falló sería decirle a
    // alguien que le falta algo sin saberlo.
    http
      .expectOne((r) => r.url === '/admin/tenants')
      .flush({ message: 'roto' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Todavía no hay ninguna organización');
  });
});
