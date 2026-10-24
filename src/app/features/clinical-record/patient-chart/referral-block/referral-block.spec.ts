import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';

import { ReferralBlock } from './referral-block';
import { AuthService } from '../../../../core/auth/auth.service';

/**
 * Derivar a otro profesional desde la consulta (pedido del propietario,
 * 24/10/2026). Se fija el contrato con la API: qué se manda, qué no se manda
 * (quien deriva sale del token), y que sin encuentro no hay formulario.
 */
describe('ReferralBlock', () => {
  let fixture: ComponentFixture<ReferralBlock>;
  let http: HttpTestingController;

  const FILAS = [
    {
      profileId: 'hp-yo',
      practitionerCode: 'MP-1',
      displayName: 'Dra. Camila Vargas',
      verified: true,
    },
    {
      profileId: 'hp-1',
      practitionerCode: 'MP-2',
      displayName: 'Dra. Lucía Mendoza',
      professionalTitle: 'Endocrinóloga',
      verified: true,
    },
    {
      profileId: 'hp-2',
      practitionerCode: 'MP-3',
      displayName: 'Dr. Álvaro Rojas',
      verified: true,
    },
  ];

  function acc(): {
    opciones: () => readonly { value: string; label: string }[];
    sinEncuentro: () => boolean;
    puedeEnviar: () => boolean;
    buscar(texto: string): void;
    elegir(id: string | null): void;
    escribirMotivo(texto: string): void;
    derivar(): void;
    yaDerivado: () => boolean;
    derivadoA: () => string | null;
    errorDelRegistro: () => string | null;
  } {
    return fixture.componentInstance as never;
  }

  function crear(encounterId: string | null = 'enc-1'): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: { practitionerProfileId: signal<string | null>('hp-yo') },
        },
      ],
    });
    fixture = TestBed.createComponent(ReferralBlock);
    fixture.componentRef.setInput('patientProfileId', 'pat-1');
    fixture.componentRef.setInput('encounterId', encounterId);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  }

  /** El directorio llega en una sola página. */
  function responderDirectorio(): void {
    http
      .expectOne((r) => r.url === '/profiles/practitioners')
      .flush({ items: FILAS, count: FILAS.length, limit: 50, nextCursor: null });
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  it('ofrece a los demás médicos del directorio, nunca a quien deriva', () => {
    crear();
    responderDirectorio();

    const nombres = acc()
      .opciones()
      .map((o) => o.label);
    expect(nombres).toEqual(['Dr. Álvaro Rojas', 'Dra. Lucía Mendoza · Endocrinóloga']);
  });

  it('busca sin tildes ni mayúsculas: «lucia» encuentra a «Lucía»', () => {
    crear();
    responderDirectorio();

    acc().buscar('lucia');

    expect(
      acc()
        .opciones()
        .map((o) => o.value),
    ).toEqual(['hp-1']);
  });

  it('recorre las páginas del directorio hasta que no hay más', () => {
    crear();
    http
      .expectOne((r) => r.url === '/profiles/practitioners')
      .flush({ items: [FILAS[1]], count: 1, limit: 50, nextCursor: 'c-2' });
    const segunda = http.expectOne((r) => r.url === '/profiles/practitioners');
    expect(segunda.request.params.get('cursor')).toBe('c-2');
    segunda.flush({ items: [FILAS[2]], count: 1, limit: 50, nextCursor: null });
    fixture.detectChanges();

    expect(acc().opciones()).toHaveLength(2);
  });

  it('sin encuentro abierto lo dice y no ofrece enviar', () => {
    crear(null);
    responderDirectorio();

    expect(acc().sinEncuentro()).toBe(true);
    expect(acc().puedeEnviar()).toBe(false);
    expect(
      fixture.nativeElement.querySelector('[data-testid="derivacion-sin-encuentro"]'),
    ).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="derivacion-enviar"]')).toBeNull();
  });

  it('sin elegir a nadie no se puede enviar', () => {
    crear();
    responderDirectorio();

    expect(acc().puedeEnviar()).toBe(false);
    acc().elegir('hp-1');
    expect(acc().puedeEnviar()).toBe(true);
  });

  it('deriva: manda la persona, el encuentro y el profesional — y NO quién deriva', () => {
    crear();
    responderDirectorio();
    acc().elegir('hp-1');
    acc().escribirMotivo('  Control de la tiroides  ');

    acc().derivar();

    const req = http.expectOne('/referrals');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      patientProfileId: 'pat-1',
      sourceEncounterId: 'enc-1',
      targetProfileId: 'hp-1',
      reasonText: 'Control de la tiroides',
    });
    expect(req.request.body.referringProfileId).toBeUndefined();
    req.flush({
      id: 'ref-1',
      patientProfileId: 'pat-1',
      statusConceptId: 'x',
      createdAt: '2026-10-24T12:00:00Z',
    });
    fixture.detectChanges();

    expect(acc().derivadoA()).toContain('Lucía Mendoza');
    expect(fixture.nativeElement.querySelector('[data-testid="derivacion-exito"]')).not.toBeNull();
    // El formulario queda limpio para derivar a otro, si hace falta.
    expect(acc().puedeEnviar()).toBe(false);
  });

  it('sin motivo no manda `reasonText`: es opcional', () => {
    crear();
    responderDirectorio();
    acc().elegir('hp-2');

    acc().derivar();

    const req = http.expectOne('/referrals');
    expect('reasonText' in req.request.body).toBe(false);
    req.flush({
      id: 'ref-2',
      patientProfileId: 'pat-1',
      statusConceptId: 'x',
      createdAt: '2026-10-24T12:00:00Z',
    });
  });

  it('un 409 es un aviso («ya la derivó»), no un error', () => {
    crear();
    responderDirectorio();
    acc().elegir('hp-1');

    acc().derivar();
    http
      .expectOne('/referrals')
      .flush(
        { code: 'CONFLICT', message: 'Ya existe una referencia equivalente' },
        { status: 409, statusText: 'Conflict' },
      );
    fixture.detectChanges();

    expect(acc().yaDerivado()).toBe(true);
    expect(acc().errorDelRegistro()).toBeNull();
    expect(
      fixture.nativeElement.querySelector('[data-testid="derivacion-duplicada"]'),
    ).not.toBeNull();
  });

  it('un 404 del encuentro se dice con palabras, no con «error»', () => {
    crear();
    responderDirectorio();
    acc().elegir('hp-1');

    acc().derivar();
    http
      .expectOne('/referrals')
      .flush(
        { code: 'NOT_FOUND', message: 'Encuentro no encontrado' },
        { status: 404, statusText: 'Not Found' },
      );
    fixture.detectChanges();

    expect(acc().errorDelRegistro()).toContain('No encontramos este encuentro');
  });

  it('si el directorio no carga, no hay formulario y se puede reintentar', () => {
    crear();
    http
      .expectOne((r) => r.url === '/profiles/practitioners')
      .flush({ code: 'INTERNAL', message: 'x' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="derivacion-enviar"]')).toBeNull();
  });
});
